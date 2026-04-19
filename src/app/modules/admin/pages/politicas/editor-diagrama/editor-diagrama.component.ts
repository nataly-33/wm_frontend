import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as joint from '@joint/core';
import { firstValueFrom, forkJoin } from 'rxjs';

import {
  DiagramaNodoPayload,
  DiagramaResponse,
  DiagramaTransicionPayload,
  GuardarDiagramaRequest,
  Politica,
  PoliticaService
} from '../../../../../core/services/politica.service';
import { Departamento, DepartamentoService } from '../../../../../core/services/departamento.service';
import { EstadoEditor, NodoEstado, TransicionEstado, validarDiagramaDetallado } from './diagram-validators';
import { TransicionTipo } from '../../../../../core/services/transicion.service';

interface LaneState {
  laneId: string;
  departamentoId: string;
  nombreDepartamento: string;
  x: number;
  width: number;
}

interface NodePayload {
  id: string;
  tipo: NodoEstado['tipo'];
  nombre: string;
  departamentoId: string;
  formularioId?: string;
  posicionX?: number;
  posicionY?: number;
}

@Component({
  selector: 'app-editor-diagrama',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './editor-diagrama.component.html',
  styleUrls: ['./editor-diagrama.component.scss']
})
export class EditorDiagramaComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly laneWidth = 220;

  @ViewChild('diagramCanvas', { static: true }) diagramCanvasRef!: ElementRef<HTMLDivElement>;

  politicaId = '';
  politica: Politica | null = null;
  departamentosCompletos: Departamento[] = [];
  mostrarMenuCarriles = false;

  cargando = true;
  guardando = false;
  error: string | null = null;
  info: string | null = null;

  hasSelection = false;

  private graph!: joint.dia.Graph;
  private paper!: joint.dia.Paper;
  private lanes: LaneState[] = [];
  private selectedLink: joint.dia.Link | null = null;
  private selectedElement: joint.dia.Element | null = null;
  private tempCounter = 0;

  propiedadesTemp = {
    etiqueta: '',
    tipo: 'LINEAL' as TransicionTipo,
    condicion: ''
  };

  propiedadesNodoTemp = {
    nombre: '',
    formularioId: ''
  };

  readonly paletteItems: Array<{ tipo: NodoEstado['tipo']; label: string; preview: string }> = [
    { tipo: 'INICIO', label: 'Inicio', preview: 'shape-inicio' },
    { tipo: 'TAREA', label: 'Actividad', preview: 'shape-tarea' },
    { tipo: 'DECISION', label: 'Decision', preview: 'shape-decision' },
    { tipo: 'PARALELO', label: 'Fork / Join', preview: 'shape-fork' },
    { tipo: 'FIN', label: 'Fin', preview: 'shape-fin' }
  ];

  constructor(
    private route: ActivatedRoute,
    private politicaService: PoliticaService,
    private departamentoService: DepartamentoService
  ) {}

  ngOnInit(): void {
    this.politicaId = this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngAfterViewInit(): void {
    this.initJointEditor();
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    if (this.paper) {
      this.paper.remove();
    }
  }

  get departamentosDisponiblesParaCarril(): Departamento[] {
    const usados = new Set(this.lanes.map((l) => l.departamentoId));
    return this.departamentosCompletos.filter((d) => !usados.has(d.id));
  }

  get carrilesActuales(): LaneState[] {
    return this.lanes;
  }

  onPaletteDragStart(event: DragEvent, tipo: NodoEstado['tipo']): void {
    if (!event.dataTransfer) {
      return;
    }
    event.dataTransfer.setData('application/x-wm-node-type', tipo);
    event.dataTransfer.effectAllowed = 'copy';
  }

  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    if (!event.dataTransfer || !this.paper) {
      return;
    }

    const tipo = event.dataTransfer.getData('application/x-wm-node-type') as NodoEstado['tipo'];
    if (!tipo) {
      return;
    }

    const point = this.paper.clientToLocalPoint({ x: event.clientX, y: event.clientY });
    const lane = this.findLaneByX(point.x);
    if (!lane) {
      this.error = 'Suelta el nodo dentro de un carril de departamento.';
      return;
    }

    if (tipo === 'INICIO') {
      const hasInicio = this.graph
        .getElements()
        .some((el) => el.get('kind') === 'NODE' && el.get('nodeTipo') === 'INICIO');
      if (hasInicio) {
        this.error = 'Solo puede existir un nodo Inicio en el diagrama.';
        return;
      }
    }

    this.error = null;

    const size = this.getNodeSize(tipo);
    const x = Math.max(lane.x + 16, Math.min(point.x - size.w / 2, lane.x + lane.width - size.w - 16));
    const y = Math.max(80, point.y - size.h / 2);

    this.createNode({
      id: `tmp_node_${Date.now()}_${++this.tempCounter}`,
      tipo,
      nombre: this.defaultLabelForTipo(tipo),
      departamentoId: lane.departamentoId,
      posicionX: x,
      posicionY: y
    });
  }

  agregarCarril(depto: Departamento): void {
    if (this.lanes.some((l) => l.departamentoId === depto.id)) {
      this.error = `El departamento ${depto.nombre} ya esta en el diagrama.`;
      return;
    }

    this.error = null;
    this.insertLane(depto.id, depto.nombre);
    this.mostrarMenuCarriles = false;
  }

  eliminarCarril(departamentoId: string): void {
    const lane = this.lanes.find((l) => l.departamentoId === departamentoId);
    if (!lane) {
      return;
    }

    const cellsToRemove: joint.dia.Cell[] = [];

    this.graph.getElements().forEach((el) => {
      if (el.get('kind') === 'NODE' && el.get('departamentoId') === departamentoId) {
        cellsToRemove.push(el);
      }
      if (el.get('kind') === 'LANE' && el.id.toString() === lane.laneId) {
        cellsToRemove.push(el);
      }
    });

    if (cellsToRemove.length > 0) {
      this.graph.removeCells(cellsToRemove);
    }

    this.lanes = this.lanes.filter((l) => l.departamentoId !== departamentoId);
    this.reflowLanes();
    this.clearSelection();
  }

  eliminarSeleccion(): void {
    if (this.selectedLink) {
      this.selectedLink.remove();
      this.clearSelection();
      return;
    }

    if (this.selectedElement) {
      const isLane = this.selectedElement.get('kind') === 'LANE';
      const depId = this.selectedElement.get('departamentoId') as string | undefined;
      if (isLane && depId) {
        this.eliminarCarril(depId);
        return;
      }

      this.selectedElement.remove();
      this.clearSelection();
    }
  }

  esTransicionSeleccionada(): boolean {
    return !!this.selectedLink;
  }

  esNodoSeleccionado(): boolean {
    return !!this.selectedElement && this.selectedElement.get('kind') === 'NODE';
  }

  actualizarNodoSeleccionado(): void {
    if (!this.esNodoSeleccionado() || !this.selectedElement) {
      return;
    }

    const tipo = (this.selectedElement.get('nodeTipo') as NodoEstado['tipo']) || 'TAREA';
    const limpio = this.propiedadesNodoTemp.nombre.trim();
    const nombre = limpio || this.defaultLabelForTipo(tipo);

    this.selectedElement.set('nodeNombre', nombre);

    if (tipo !== 'INICIO' && tipo !== 'FIN' && tipo !== 'PARALELO') {
      this.selectedElement.attr('label/text', nombre);
    }

    const form = this.propiedadesNodoTemp.formularioId.trim();
    this.selectedElement.set('formularioId', form || undefined);
  }

  actualizarTransicion(): void {
    if (!this.selectedLink) {
      return;
    }

    this.selectedLink.set('transicionTipo', this.propiedadesTemp.tipo);
    this.selectedLink.set('condicion', this.propiedadesTemp.condicion || '');
    this.setLinkLabel(this.selectedLink, this.formatLinkLabel(this.propiedadesTemp.etiqueta, this.propiedadesTemp.tipo));
  }

  async guardarDiagrama(): Promise<void> {
    this.guardando = true;
    this.error = null;
    this.info = null;

    if (!this.politicaId || !this.graph) {
      this.guardando = false;
      return;
    }

    const estado = this.buildEstadoEditor();
    const deptosOk = new Set(this.departamentosCompletos.map((d) => d.id));
    const validacion = validarDiagramaDetallado(estado, deptosOk);

    if (validacion.errores.length > 0) {
      this.error = validacion.errores.join(' · ');
      this.guardando = false;
      return;
    }

    if (validacion.advertencias.length > 0) {
      this.info = validacion.advertencias.join(' · ');
    }

    const nodos: DiagramaNodoPayload[] = estado.nodos.map((n) => ({
      id: n.id ?? null,
      tempId: n.tempId,
      tipo: n.tipo,
      nombre: n.nombre,
      departamentoId: n.departamentoId || '',
      formularioId: n.formularioId ?? null,
      posicionX: n.posicionX,
      posicionY: n.posicionY
    }));

    const transiciones: DiagramaTransicionPayload[] = estado.transiciones.map((t) => ({
      id: t.id ?? null,
      nodoOrigenTempId: t.nodoOrigenId,
      nodoDestinoTempId: t.nodoDestinoId,
      tipo: t.tipo,
      etiqueta: t.etiqueta ?? null,
      condicion: t.condicion ?? null
    }));

    const payload: GuardarDiagramaRequest = {
      datosDiagramaJson: JSON.stringify(this.graph.toJSON()),
      nodos,
      transiciones
    };

    try {
      const saved = await firstValueFrom(this.politicaService.guardarDiagrama(this.politicaId, payload));
      if (saved.data) {
        this.politica = saved.data;
      }
      this.info = 'Diagrama guardado correctamente.';
    } catch (e: unknown) {
      const err = e as { error?: { message?: string }; message?: string };
      this.error = err.error?.message || err.message || 'Error al guardar el diagrama.';
    } finally {
      this.guardando = false;
    }
  }

  exportarPng(): void {
    if (!this.politica) {
      return;
    }

    this.capturarCanvasCompleto().then((canvas) => {
      const link = document.createElement('a');
      link.download = `${this.politica!.nombre}-diagrama.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    });
  }

  exportarPdf(): void {
    if (!this.politica) {
      return;
    }

    this.capturarCanvasCompleto().then((canvas) => {
      const imgData = canvas.toDataURL('image/png', 1.0);
      const isLandscape = canvas.width >= canvas.height;
      const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const x = (pageW - imgW) / 2;
      const y = (pageH - imgH) / 2;
      pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);
      pdf.save(`${this.politica!.nombre}-diagrama.pdf`);
    });
  }

  private initJointEditor(): void {
    this.graph = new joint.dia.Graph({}, { cellNamespace: joint.shapes });

    this.paper = new joint.dia.Paper({
      el: this.diagramCanvasRef.nativeElement,
      model: this.graph,
      width: '100%',
      height: '100%',
      background: { color: '#ffffff' },
      gridSize: 10,
      drawGrid: { name: 'mesh', args: { color: '#E8E8E8' } },
      interactive: (cellView: joint.dia.CellView) => {
        const isLane = cellView.model.get('kind') === 'LANE';
        if (isLane) {
          return {
            elementMove: false,
            addLinkFromMagnet: false,
            linkMove: false
          };
        }
        return true;
      },
      linkPinning: false,
      cellViewNamespace: joint.shapes,
      defaultConnector: { name: 'normal' },
      defaultLink: () => this.createLink(),
      validateMagnet: (cellView: joint.dia.CellView, magnet: SVGElement | null) => {
        if (cellView.model.get('kind') === 'LANE') {
          return false;
        }
        return !!magnet;
      },
      validateConnection: (
        sourceView: joint.dia.CellView,
        sourceMagnet: SVGElement | null,
        targetView: joint.dia.CellView,
        targetMagnet: SVGElement | null
      ) => {
        if (!sourceMagnet || !targetMagnet) {
          return false;
        }
        if (sourceView === targetView) {
          return false;
        }
        if (sourceView.model.get('kind') === 'LANE' || targetView.model.get('kind') === 'LANE') {
          return false;
        }
        return true;
      }
    });

    this.paper.on('blank:pointerdown', () => this.clearSelection());

    this.paper.on('element:pointerclick', (view: joint.dia.ElementView) => {
      this.selectedElement = view.model;
      this.selectedLink = null;
      this.hasSelection = true;
      this.paper.hideTools();
      this.syncNodePropsFromSelection();
    });

    this.paper.on('element:pointerdblclick', (view: joint.dia.ElementView) => {
      this.editarNombreNodoPrompt(view.model);
    });

    this.paper.on('link:pointerclick', (view: joint.dia.LinkView) => {
      this.selectLink(view.model);
      this.showLinkTools(view);
    });

    this.paper.on('element:mouseenter', (view: joint.dia.ElementView) => {
      this.togglePorts(view.model, true);
    });

    this.paper.on('element:mouseleave', (view: joint.dia.ElementView) => {
      this.togglePorts(view.model, false);
    });

    this.graph.on('change:position', (cell: joint.dia.Cell) => {
      if (!cell.isElement() || cell.get('kind') !== 'NODE') {
        return;
      }
      this.snapNodeIntoLane(cell as joint.dia.Element);
    });

    this.graph.on('add', (cell: joint.dia.Cell) => {
      if (!cell.isLink()) {
        return;
      }
      const link = cell as joint.dia.Link;
      if (!link.get('tempId')) {
        link.set('tempId', `tmp_tr_${Date.now()}_${++this.tempCounter}`);
      }
      if (!link.get('transicionTipo')) {
        link.set('transicionTipo', 'LINEAL');
      }
    });

    this.ensurePaperDimensions();
  }

  private createLink(): joint.shapes.standard.Link {
    const link = new joint.shapes.standard.Link({
      attrs: {
        line: {
          stroke: '#7A7A40',
          strokeWidth: 2.2,
          targetMarker: {
            type: 'path',
            d: 'M 10 -5 0 0 10 5 z'
          }
        }
      },
      connector: { name: 'normal' },
      router: { name: 'manhattan', args: { padding: 16 } },
      labels: []
    });
    link.set('kind', 'TRANSICION');
    link.set('tempId', `tmp_tr_${Date.now()}_${++this.tempCounter}`);
    link.set('transicionTipo', 'LINEAL');
    link.set('condicion', '');
    return link;
  }

  private createNode(payload: NodePayload): joint.dia.Element {
    const size = this.getNodeSize(payload.tipo);
    const position = {
      x: payload.posicionX ?? 40,
      y: payload.posicionY ?? 90
    };

    let element: joint.dia.Element;

    if (payload.tipo === 'INICIO') {
      element = new joint.shapes.standard.Circle({
        position,
        size: { width: size.w, height: size.h },
        attrs: {
          body: { fill: '#111111', stroke: '#111111', strokeWidth: 1 },
          label: { text: '', fill: '#ffffff' }
        }
      });
    } else if (payload.tipo === 'FIN') {
      element = new joint.shapes.standard.Circle({
        position,
        size: { width: size.w, height: size.h },
        attrs: {
          body: { fill: '#ffffff', stroke: '#111111', strokeWidth: 2 },
          label: { text: '●', fill: '#111111', fontSize: 17, fontWeight: 700 }
        }
      });
    } else if (payload.tipo === 'DECISION') {
      element = new joint.shapes.standard.Polygon({
        position,
        size: { width: size.w, height: size.h },
        attrs: {
          body: {
            refPoints: '0,43 43,0 86,43 43,86',
            fill: 'transparent',
            stroke: '#4B5563',
            strokeWidth: 2
          },
          label: {
            text: payload.nombre,
            fill: '#111827',
            fontSize: 10,
            fontWeight: 600
          }
        }
      });
    } else if (payload.tipo === 'PARALELO') {
      element = new joint.shapes.standard.Rectangle({
        position,
        size: { width: size.w, height: size.h },
        attrs: {
          body: { fill: '#111111', stroke: '#111111', strokeWidth: 1, rx: 2, ry: 2 },
          label: { text: '', fill: '#111111' }
        }
      });
    } else {
      element = new joint.shapes.standard.Rectangle({
        position,
        size: { width: size.w, height: size.h },
        attrs: {
          body: {
            fill: 'transparent',
            stroke: '#4B5563',
            strokeWidth: 1.8,
            rx: 10,
            ry: 10
          },
          label: {
            text: payload.nombre,
            fill: '#111827',
            fontSize: 10,
            fontWeight: 500
          }
        }
      });
    }

    element.set('kind', 'NODE');
    element.set('nodoDbId', payload.id || undefined);
    element.set('tempId', payload.id || `tmp_node_${Date.now()}_${++this.tempCounter}`);
    element.set('nodeTipo', payload.tipo);
    element.set('nodeNombre', payload.nombre || this.defaultLabelForTipo(payload.tipo));
    element.set('departamentoId', payload.departamentoId || '');
    if (payload.formularioId) {
      element.set('formularioId', payload.formularioId);
    }

    this.configureNodePorts(element, payload.tipo !== 'PARALELO');
    this.graph.addCell(element);
    return element;
  }

  private configureNodePorts(element: joint.dia.Element, withPorts: boolean): void {
    if (!withPorts) {
      return;
    }

    element.prop('ports/groups', {
      top: {
        position: 'top',
        attrs: {
          circle: { r: 5, magnet: true, stroke: '#1F2937', strokeWidth: 1.2, fill: '#FFFFFF', opacity: 0 }
        }
      },
      right: {
        position: 'right',
        attrs: {
          circle: { r: 5, magnet: true, stroke: '#1F2937', strokeWidth: 1.2, fill: '#FFFFFF', opacity: 0 }
        }
      },
      bottom: {
        position: 'bottom',
        attrs: {
          circle: { r: 5, magnet: true, stroke: '#1F2937', strokeWidth: 1.2, fill: '#FFFFFF', opacity: 0 }
        }
      },
      left: {
        position: 'left',
        attrs: {
          circle: { r: 5, magnet: true, stroke: '#1F2937', strokeWidth: 1.2, fill: '#FFFFFF', opacity: 0 }
        }
      }
    });

    const existing = new Set((element.getPorts() || []).map((p) => p.id));
    const required = ['top', 'right', 'bottom', 'left'];
    const newPorts = required.filter((id) => !existing.has(id)).map((id) => ({ id, group: id }));
    if (newPorts.length > 0) {
      element.addPorts(newPorts);
    }
  }

  private defaultLabelForTipo(tipo: NodoEstado['tipo']): string {
    switch (tipo) {
      case 'INICIO':
        return 'Inicio';
      case 'TAREA':
        return 'Actividad';
      case 'DECISION':
        return 'Decision';
      case 'PARALELO':
        return 'Fork / Join';
      case 'FIN':
        return 'Fin';
      default:
        return 'Nodo';
    }
  }

  private getNodeSize(tipo: NodoEstado['tipo']): { w: number; h: number } {
    switch (tipo) {
      case 'INICIO':
      case 'FIN':
        return { w: 40, h: 40 };
      case 'DECISION':
        return { w: 86, h: 86 };
      case 'PARALELO':
        return { w: 150, h: 12 };
      default:
        return { w: 170, h: 64 };
    }
  }

  private async cargarDatos(): Promise<void> {
    this.cargando = true;
    this.error = null;

    try {
      const { politica, diagrama, deptos } = await firstValueFrom(
        forkJoin({
          politica: this.politicaService.obtener(this.politicaId),
          diagrama: this.politicaService.obtenerDiagrama(this.politicaId),
          deptos: this.departamentoService.listarCompletos()
        })
      );

      this.politica = politica.data;
      this.departamentosCompletos = deptos.data ?? diagrama.data?.departamentos ?? [];
      this.hidratarDesdeDiagrama(diagrama.data ?? undefined);

      if (this.graph.getCells().length === 0) {
        this.info = 'Sin diagrama guardado aun. Agrega carriles y arrastra figuras desde la paleta.';
      }
    } catch (e: unknown) {
      const err = e as { error?: { message?: string }; message?: string };
      this.error = err.error?.message || err.message || 'Error al cargar el editor';
    } finally {
      this.cargando = false;
    }
  }

  private hidratarDesdeDiagrama(data?: DiagramaResponse): void {
    this.graph.clear();
    this.lanes = [];
    this.clearSelection();

    if (!data) {
      return;
    }

    const raw = data.datosDiagramaJson;
    let loadedFromJointJson = false;

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { cells?: Array<Record<string, any>> };
        if (parsed && Array.isArray(parsed.cells) && parsed.cells.length > 0) {
          parsed.cells.forEach((cell) => {
            if (cell?.['type']?.includes('Link')) {
              if (cell['connector']?.name === 'orthogonal') {
                cell['connector'] = { name: 'normal' };
              }
              if (!cell['router'] || cell['router']?.name !== 'manhattan') {
                cell['router'] = { name: 'manhattan', args: { padding: 16 } };
              }
            }
          });
          this.graph.fromJSON(parsed as joint.dia.Graph.JSON);
          this.syncLanesFromGraph();
          this.normalizeLoadedGraph();
          loadedFromJointJson = this.lanes.length > 0;
        }
      } catch {
        loadedFromJointJson = false;
      }
    }

    if (!loadedFromJointJson && (data.nodos?.length ?? 0) > 0) {
      this.reconstruirDesdeApi(data);
    }

    this.ensurePaperDimensions();
  }

  private normalizeLoadedGraph(): void {
    const laneByDept = new Map(this.lanes.map((l) => [l.departamentoId, l] as const));

    this.graph.getElements().forEach((el) => {
      if (el.get('kind') !== 'NODE') {
        return;
      }

      const tipo = (el.get('nodeTipo') as NodoEstado['tipo']) || 'TAREA';
      el.set('nodeTipo', tipo);
      const nombreActual = (el.get('nodeNombre') as string) || (el.attr('label/text') as string) || this.defaultLabelForTipo(tipo);
      el.set('nodeNombre', nombreActual);
      this.configureNodePorts(el, tipo !== 'PARALELO');

      const depId = (el.get('departamentoId') as string) || '';
      const lane = depId ? laneByDept.get(depId) : null;
      if (lane) {
        const size = el.size();
        const pos = el.position();
        const x = Math.max(lane.x + 16, Math.min(pos.x, lane.x + lane.width - size.width - 16));
        el.position(x, Math.max(80, pos.y));
      }
    });

    this.graph.getLinks().forEach((link) => {
      if (!link.get('transicionTipo')) {
        link.set('transicionTipo', 'LINEAL');
      }
      if (!link.get('tempId')) {
        link.set('tempId', `tmp_tr_${Date.now()}_${++this.tempCounter}`);
      }
      link.connector({ name: 'normal' });
      link.router('manhattan', { padding: 16 });
      link.attr(['line', 'stroke'], '#7A7A40');
      link.attr(['line', 'strokeWidth'], 2.2);
    });
  }

  private reconstruirDesdeApi(data: DiagramaResponse): void {
    const nodos = (data.nodos ?? []) as Array<any>;
    const transiciones = (data.transiciones ?? []) as Array<any>;
    if (nodos.length === 0) {
      return;
    }

    const deptOrder = this.buildDeptOrder(nodos, this.departamentosCompletos);
    deptOrder.forEach((d) => this.insertLane(d.id, d.nombre));

    const topoIndex = this.computeTopologicalOrder(nodos, transiciones);
    const laneCounters = new Map<string, number>();
    const nodeByDbId = new Map<string, joint.dia.Element>();

    const sortedNodes = [...nodos].sort((a, b) => {
      const ai = topoIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bi = topoIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) {
        return ai - bi;
      }
      return Number(a.posicionY ?? 0) - Number(b.posicionY ?? 0);
    });

    for (const n of sortedNodes) {
      const tipo = ((n.tipo as NodoEstado['tipo']) || 'TAREA');
      const dep = this.resolveDeptForNode(n, transiciones, nodos);
      const lane = dep ? this.lanes.find((l) => l.departamentoId === dep) : this.lanes[0];
      if (!lane) {
        continue;
      }

      const seq = laneCounters.get(lane.departamentoId) ?? 0;
      laneCounters.set(lane.departamentoId, seq + 1);

      const size = this.getNodeSize(tipo);
      const x = lane.x + (lane.width - size.w) / 2;
      const y = Math.max(80, 110 + seq * 150);

      const cell = this.createNode({
        id: n.id,
        tipo,
        nombre: n.nombre || this.defaultLabelForTipo(tipo),
        departamentoId: lane.departamentoId,
        formularioId: n.formularioId || undefined,
        posicionX: x,
        posicionY: y
      });

      nodeByDbId.set(n.id, cell);
    }

    for (const t of transiciones) {
      const source = nodeByDbId.get(t.nodoOrigenId);
      const target = nodeByDbId.get(t.nodoDestinoId);
      if (!source || !target) {
        continue;
      }

      const ports = this.pickPorts(source, target);

      const link = this.createLink();
      link.source({ id: source.id, port: ports.source });
      link.target({ id: target.id, port: ports.target });
      link.set('transicionDbId', t.id);
      link.set('transicionTipo', (t.tipo as TransicionTipo) || 'LINEAL');
      link.set('condicion', t.condicion || '');
      this.setLinkLabel(link, this.formatLinkLabel(t.etiqueta || '', (t.tipo as TransicionTipo) || 'LINEAL'));
      this.graph.addCell(link);
    }
  }

  private computeTopologicalOrder(nodos: Array<any>, transiciones: Array<any>): Map<string, number> {
    const order = new Map<string, number>();
    const indegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    nodos.forEach((n) => {
      indegree.set(n.id, 0);
      adj.set(n.id, []);
    });

    transiciones.forEach((t) => {
      if (!adj.has(t.nodoOrigenId) || !indegree.has(t.nodoDestinoId)) {
        return;
      }
      adj.get(t.nodoOrigenId)!.push(t.nodoDestinoId);
      indegree.set(t.nodoDestinoId, (indegree.get(t.nodoDestinoId) || 0) + 1);
    });

    const queue: string[] = [];
    const inicio = nodos.find((n) => n.tipo === 'INICIO');
    if (inicio?.id) {
      queue.push(inicio.id);
    }

    if (queue.length === 0) {
      indegree.forEach((value, key) => {
        if (value === 0) {
          queue.push(key);
        }
      });
    }

    let idx = 0;
    const visited = new Set<string>();

    while (queue.length > 0) {
      const u = queue.shift()!;
      if (visited.has(u)) {
        continue;
      }
      visited.add(u);
      order.set(u, idx++);

      for (const v of adj.get(u) ?? []) {
        const next = (indegree.get(v) || 0) - 1;
        indegree.set(v, next);
        if (next <= 0) {
          queue.push(v);
        }
      }
    }

    nodos.forEach((n) => {
      if (!order.has(n.id)) {
        order.set(n.id, idx++);
      }
    });

    return order;
  }

  private resolveDeptForNode(node: any, transiciones: Array<any>, nodos: Array<any>): string {
    if (node.departamentoId) {
      return node.departamentoId;
    }

    const out = transiciones.find((t) => t.nodoOrigenId === node.id);
    if (out) {
      const dst = nodos.find((n) => n.id === out.nodoDestinoId);
      if (dst?.departamentoId) {
        return dst.departamentoId;
      }
    }

    const incoming = transiciones.find((t) => t.nodoDestinoId === node.id);
    if (incoming) {
      const src = nodos.find((n) => n.id === incoming.nodoOrigenId);
      if (src?.departamentoId) {
        return src.departamentoId;
      }
    }

    return this.lanes[0]?.departamentoId || '';
  }

  private buildDeptOrder(
    nodos: Array<{ departamentoId?: string | null }>,
    deptos: Departamento[]
  ): Array<{ id: string; nombre: string }> {
    const byId = new Map(deptos.map((d) => [d.id, d.nombre] as const));
    const seen = new Set<string>();
    const out: Array<{ id: string; nombre: string }> = [];

    for (const n of nodos) {
      const id = n.departamentoId;
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);
      out.push({ id, nombre: byId.get(id) ?? 'Departamento' });
    }

    return out;
  }

  private insertLane(departamentoId: string, nombre: string): void {
    const x = this.lanes.length * this.laneWidth;
    const laneId = `lane_${departamentoId}`;

    const lane = new joint.shapes.standard.Rectangle({
      id: laneId,
      position: { x, y: 0 },
      size: { width: this.laneWidth, height: this.getPaperHeight() },
      attrs: {
        body: {
          fill: '#F9F9F9',
          stroke: '#CCCCCC',
          strokeWidth: 1
        },
        label: {
          text: nombre,
          fill: '#4B5563',
          fontSize: 11,
          fontWeight: 600,
          textAnchor: 'middle',
          textVerticalAnchor: 'top',
          x: this.laneWidth / 2,
          y: 10
        }
      }
    });

    lane.set('kind', 'LANE');
    lane.set('departamentoId', departamentoId);
    this.graph.addCell(lane);
    lane.toBack();

    this.lanes.push({ laneId, departamentoId, nombreDepartamento: nombre, x, width: this.laneWidth });
    this.ensurePaperDimensions();
  }

  private reflowLanes(): void {
    this.lanes = this.lanes.map((lane, index) => {
      const newX = index * this.laneWidth;
      const cell = this.graph.getCell(lane.laneId) as joint.dia.Element | null;
      const oldX = lane.x;
      const dx = newX - oldX;

      if (cell) {
        const pos = cell.position();
        cell.position(newX, pos.y);
      }

      this.graph.getElements().forEach((el) => {
        if (el.get('kind') === 'NODE' && el.get('departamentoId') === lane.departamentoId) {
          const pos = el.position();
          el.position(pos.x + dx, pos.y);
        }
      });

      return { ...lane, x: newX };
    });

    this.ensurePaperDimensions();
  }

  private syncLanesFromGraph(): void {
    const laneElements = this.graph
      .getElements()
      .filter((el) => el.get('kind') === 'LANE')
      .sort((a, b) => a.position().x - b.position().x);

    this.lanes = laneElements.map((lane) => ({
      laneId: lane.id.toString(),
      departamentoId: (lane.get('departamentoId') as string) || '',
      nombreDepartamento: (lane.attr('label/text') as string) || 'Departamento',
      x: lane.position().x,
      width: lane.size().width
    }));

    laneElements.forEach((lane) => lane.toBack());
  }

  private snapNodeIntoLane(node: joint.dia.Element): void {
    const pos = node.position();
    const lane = this.findLaneByX(pos.x + node.size().width / 2);
    if (!lane) {
      return;
    }

    const x = Math.max(lane.x + 16, Math.min(pos.x, lane.x + lane.width - node.size().width - 16));
    if (x !== pos.x) {
      node.position(x, pos.y, { silent: true });
    }
    node.set('departamentoId', lane.departamentoId);
  }

  private findLaneByX(x: number): LaneState | null {
    const lane = this.lanes.find((l) => x >= l.x && x <= l.x + l.width);
    return lane || null;
  }

  private pickPorts(source: joint.dia.Element, target: joint.dia.Element): { source: string; target: string } {
    const s = source.getBBox();
    const t = target.getBBox();
    const dx = t.center().x - s.center().x;
    const dy = t.center().y - s.center().y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? { source: 'right', target: 'left' } : { source: 'left', target: 'right' };
    }
    return dy >= 0 ? { source: 'bottom', target: 'top' } : { source: 'top', target: 'bottom' };
  }

  private clearSelection(): void {
    this.selectedElement = null;
    this.selectedLink = null;
    this.hasSelection = false;
    this.paper.hideTools();
    this.propiedadesTemp = {
      etiqueta: '',
      tipo: 'LINEAL',
      condicion: ''
    };
    this.propiedadesNodoTemp = {
      nombre: '',
      formularioId: ''
    };
  }

  private selectLink(link: joint.dia.Link): void {
    this.selectedElement = null;
    this.selectedLink = link;
    this.hasSelection = true;
    this.propiedadesNodoTemp = {
      nombre: '',
      formularioId: ''
    };

    this.propiedadesTemp.tipo = (link.get('transicionTipo') as TransicionTipo) || 'LINEAL';
    this.propiedadesTemp.condicion = (link.get('condicion') as string) || '';
    this.propiedadesTemp.etiqueta = this.unformatLinkLabel(this.getLinkLabel(link));
  }

  private showLinkTools(linkView: joint.dia.LinkView): void {
    const detailsButton = new joint.linkTools.Button({
      distance: '50%',
      markup: [
        {
          tagName: 'circle',
          selector: 'button',
          attributes: {
            r: 8,
            fill: '#1F2937',
            stroke: '#ffffff',
            'stroke-width': 1
          }
        },
        {
          tagName: 'path',
          selector: 'icon',
          attributes: {
            d: 'M -2 -2 L 2 -2 L 2 2 L -2 2 Z',
            fill: '#ffffff'
          }
        }
      ]
    });

    const removeButton = new joint.linkTools.Remove({ distance: '76%' });

    const tools = new joint.dia.ToolsView({
      tools: [detailsButton, removeButton]
    });

    linkView.addTools(tools);
    linkView.showTools();
  }

  private getLinkLabel(link: joint.dia.Link): string {
    const labels = link.labels();
    if (!labels || labels.length === 0) {
      return '';
    }
    const textAttrs = labels[0].attrs?.['text'] as { text?: string } | undefined;
    return (textAttrs?.text || '').trim();
  }

  private setLinkLabel(link: joint.dia.Link, text: string): void {
    link.labels([
      {
        position: 0.5,
        attrs: {
          text: {
            text,
            fontSize: 10,
            fill: '#374151'
          },
          rect: {
            fill: '#ffffff',
            stroke: '#d1d5db',
            strokeWidth: 1,
            rx: 4,
            ry: 4
          }
        }
      }
    ]);
  }

  private formatLinkLabel(etiqueta: string, tipo: TransicionTipo): string {
    const clean = etiqueta.trim();
    if (!clean) {
      return '';
    }
    return tipo === 'ALTERNATIVA' ? `[${clean}]` : clean;
  }

  private unformatLinkLabel(label: string): string {
    const trimmed = label.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return trimmed.substring(1, trimmed.length - 1);
    }
    return trimmed;
  }

  private syncNodePropsFromSelection(): void {
    if (!this.selectedElement || this.selectedElement.get('kind') !== 'NODE') {
      this.propiedadesNodoTemp = { nombre: '', formularioId: '' };
      return;
    }

    const tipo = (this.selectedElement.get('nodeTipo') as NodoEstado['tipo']) || 'TAREA';
    const nombre = (this.selectedElement.get('nodeNombre') as string) || this.defaultLabelForTipo(tipo);
    const formularioId = (this.selectedElement.get('formularioId') as string) || '';

    this.propiedadesNodoTemp = {
      nombre,
      formularioId
    };
  }

  private editarNombreNodoPrompt(node: joint.dia.Element): void {
    if (node.get('kind') !== 'NODE') {
      return;
    }

    const tipo = (node.get('nodeTipo') as NodoEstado['tipo']) || 'TAREA';
    if (tipo === 'INICIO' || tipo === 'FIN') {
      return;
    }

    const actual = (node.get('nodeNombre') as string) || this.defaultLabelForTipo(tipo);
    const nuevo = window.prompt('Nombre del nodo', actual);
    if (nuevo === null) {
      return;
    }

    const limpio = nuevo.trim();
    const nombre = limpio || this.defaultLabelForTipo(tipo);
    node.set('nodeNombre', nombre);
    if (tipo !== 'PARALELO') {
      node.attr('label/text', nombre);
    }

    this.selectedElement = node;
    this.selectedLink = null;
    this.hasSelection = true;
    this.syncNodePropsFromSelection();
  }

  private togglePorts(element: joint.dia.Element, visible: boolean): void {
    if (element.get('kind') !== 'NODE') {
      return;
    }

    for (const port of element.getPorts()) {
      if (port.id) {
        element.portProp(port.id, 'attrs/circle/opacity', visible ? 1 : 0);
      }
    }
  }

  private async capturarCanvasCompleto(): Promise<HTMLCanvasElement> {
    this.ensurePaperDimensions();
    const size = this.paper.getComputedSize();
    const width = Math.ceil(size.width || this.diagramCanvasRef.nativeElement.clientWidth);
    const height = Math.ceil(size.height || this.diagramCanvasRef.nativeElement.clientHeight);

    return html2canvas(this.diagramCanvasRef.nativeElement, {
      backgroundColor: '#ffffff',
      useCORS: true,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0
    });
  }

  private buildEstadoEditor(): EstadoEditor {
    const nodos = this.graph
      .getElements()
      .filter((el) => el.get('kind') === 'NODE')
      .map((el) => {
        const graphId = el.id.toString();
        const tipo = (el.get('nodeTipo') as NodoEstado['tipo']) || 'TAREA';
        const pos = el.position();
        const text = (el.get('nodeNombre') as string) || this.defaultLabelForTipo(tipo);
        const tempId = (el.get('tempId') as string) || graphId;

        return {
          id: (el.get('nodoDbId') as string) || undefined,
          tempId,
          tipo,
          nombre: text || this.defaultLabelForTipo(tipo),
          departamentoId: (el.get('departamentoId') as string) || '',
          formularioId: (el.get('formularioId') as string) || undefined,
          posicionX: pos.x,
          posicionY: pos.y,
          graphId
        };
      });

    const nodosEstado: NodoEstado[] = nodos.map(({ graphId: _graphId, ...rest }) => rest as NodoEstado);

    const tempByGraphId = new Map<string, string>();
    nodos.forEach((n) => tempByGraphId.set(n.graphId, n.tempId));

    const transiciones: TransicionEstado[] = this.graph
      .getLinks()
      .map((link) => {
        const src = link.source();
        const tgt = link.target();
        const srcId = src.id ? src.id.toString() : '';
        const tgtId = tgt.id ? tgt.id.toString() : '';

        return {
          id: (link.get('transicionDbId') as string) || undefined,
          tempId: (link.get('tempId') as string) || `tmp_tr_${Date.now()}_${++this.tempCounter}`,
          nodoOrigenId: tempByGraphId.get(srcId) || srcId,
          nodoDestinoId: tempByGraphId.get(tgtId) || tgtId,
          tipo: (link.get('transicionTipo') as TransicionTipo) || 'LINEAL',
          etiqueta: this.unformatLinkLabel(this.getLinkLabel(link)) || undefined,
          condicion: (link.get('condicion') as string) || undefined
        };
      })
      .filter((t) => !!t.nodoOrigenId && !!t.nodoDestinoId);

    return {
      politicaId: this.politicaId,
      nodos: nodosEstado,
      transiciones
    };
  }

  private ensurePaperDimensions(): void {
    if (!this.paper) {
      return;
    }

    const minW = Math.max(this.diagramCanvasRef.nativeElement.clientWidth, Math.max(1, this.lanes.length) * this.laneWidth + 700);
    const minH = Math.max(this.diagramCanvasRef.nativeElement.clientHeight, 1600);

    this.paper.setDimensions(minW, minH);

    this.graph.getElements().forEach((el) => {
      if (el.get('kind') === 'LANE') {
        el.resize(el.size().width, minH);
      }
    });
  }

  private getPaperHeight(): number {
    if (!this.paper) {
      return 1600;
    }
    const size = this.paper.getComputedSize();
    return Math.max(size.height || 0, 1600);
  }
}
