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
import {
  LayoutCarrilInput,
  LayoutNodeSize,
  LayoutNodoInput,
  LayoutNodoTipo,
  LayoutTransicionInput,
  calcularLayout
} from './diagram-layout.util';

interface LaneState {
  laneId: string;
  departamentoId: string;
  nombreDepartamento: string;
  x: number;
  width: number;
}

interface NodePayload {
  id?: string;
  tempId?: string;
  tipo: NodoEstado['tipo'];
  nombre: string;
  departamentoId: string;
  formularioId?: string;
  posicionX?: number;
  posicionY?: number;
  ancho?: number;
  alto?: number;
}

interface ApiNodoDiagrama {
  id: string;
  tipo?: string | null;
  nombre?: string | null;
  departamentoId?: string | null;
  formularioId?: string | null;
}

interface ApiTransicionDiagrama {
  id?: string | null;
  nodoOrigenId: string;
  nodoDestinoId: string;
  tipo?: string | null;
  etiqueta?: string | null;
  condicion?: string | null;
}

@Component({
  selector: 'app-editor-diagrama',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './editor-diagrama.component.html',
  styleUrls: ['./editor-diagrama.component.scss']
})
export class EditorDiagramaComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly laneWidth = 280;
  private readonly laneStartX = 20;
  private readonly portIdleOpacity = 0.18;

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
  private isApplyingAutoLayout = false;

  propiedadesTemp = {
    etiqueta: '',
    tipo: 'LINEAL' as TransicionTipo,
    condicion: ''
  };

  propiedadesNodoTemp = {
    nombre: '',
    formularioId: ''
  };

  mostrarModalNodo = false;
  private nodoModalTarget: joint.dia.Element | null = null;
  nodoModal = {
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
      tempId: `tmp_node_${Date.now()}_${++this.tempCounter}`,
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

  esEtiquetaVisibleEnTransicion(): boolean {
    return this.esTransicionDeDecision(this.selectedLink);
  }

  abrirModalNodoSeleccionado(): void {
    if (!this.selectedElement || this.selectedElement.get('kind') !== 'NODE') {
      return;
    }
    this.abrirModalEdicionNodo(this.selectedElement);
  }

  cancelarModalNodo(): void {
    this.mostrarModalNodo = false;
    this.nodoModalTarget = null;
  }

  guardarModalNodo(): void {
    if (!this.nodoModalTarget) {
      this.cancelarModalNodo();
      return;
    }

    const tipo = (this.nodoModalTarget.get('nodeTipo') as NodoEstado['tipo']) || 'TAREA';
    const limpio = this.nodoModal.nombre.trim();
    const nombre = limpio || this.defaultLabelForTipo(tipo);

    this.nodoModalTarget.set('nodeNombre', nombre);
    if (tipo !== 'INICIO' && tipo !== 'FIN' && tipo !== 'PARALELO') {
      this.nodoModalTarget.attr('label/text', nombre);
    }
    this.nodoModalTarget.set('formularioId', this.nodoModal.formularioId.trim() || undefined);

    this.selectedElement = this.nodoModalTarget;
    this.selectedLink = null;
    this.hasSelection = true;
    this.syncNodePropsFromSelection();
    this.cancelarModalNodo();
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

  autoOrganizarDiagrama(): void {
    const nodeElements = this.graph.getElements().filter((el) => el.get('kind') === 'NODE');
    if (nodeElements.length === 0) {
      this.info = 'No hay nodos para auto organizar.';
      return;
    }

    const layoutIdByGraphId = new Map<string, string>();
    const layoutNodes: LayoutNodoInput[] = nodeElements.map((el) => {
      const key = this.layoutNodeKeyFromElement(el);
      layoutIdByGraphId.set(el.id.toString(), key);
      return {
        id: key,
        tipo: this.normalizeNodoTipo(el.get('nodeTipo') as string | undefined) as LayoutNodoTipo,
        departamentoId: (el.get('departamentoId') as string | undefined) ?? undefined
      };
    });

    const layoutTransitions: LayoutTransicionInput[] = this.graph.getLinks().flatMap((link) => {
      const srcGraphId = link.source().id?.toString();
      const tgtGraphId = link.target().id?.toString();
      if (!srcGraphId || !tgtGraphId) {
        return [];
      }
      const sourceId = layoutIdByGraphId.get(srcGraphId);
      const targetId = layoutIdByGraphId.get(tgtGraphId);
      if (!sourceId || !targetId || sourceId === targetId) {
        return [];
      }
      return [{ nodoOrigenId: sourceId, nodoDestinoId: targetId }];
    });

    const layout = calcularLayout(layoutNodes, layoutTransitions, this.buildLayoutCarriles(), {
      laneWidth: this.laneWidth,
      laneStartX: this.laneStartX,
      nodeSizeByTipo: this.buildLayoutNodeSizeOverrides()
    });

    this.rebuildLanesFromLayout(layout.lanes);

    this.isApplyingAutoLayout = true;
    try {
      for (const el of nodeElements) {
        const key = this.layoutNodeKeyFromElement(el);
        const position = layout.positions.get(key);
        if (!position) {
          continue;
        }

        const tipo = this.normalizeNodoTipo(el.get('nodeTipo') as string | undefined);
        const baseSize = this.getNodeSize(tipo);
        if (tipo === 'PARALELO') {
          const ancho = Math.max(baseSize.w, position.width);
          if (el.size().width !== ancho || el.size().height !== baseSize.h) {
            el.resize(ancho, baseSize.h, { silent: true });
          }
        }

        el.position(position.x, position.y);
        el.set('departamentoId', position.laneId);
        this.configureNodePorts(el, true);
      }
    } finally {
      this.isApplyingAutoLayout = false;
    }

    this.graph.getLinks().forEach((link) => {
      const sourceId = link.source().id?.toString();
      const targetId = link.target().id?.toString();
      if (!sourceId || !targetId) {
        return;
      }
      const sourceEl = this.graph.getCell(sourceId) as joint.dia.Element | null;
      const targetEl = this.graph.getCell(targetId) as joint.dia.Element | null;
      if (!sourceEl || !targetEl) {
        return;
      }
      const ports = this.pickPorts(sourceEl, targetEl);
      link.source({ id: sourceEl.id, port: ports.source });
      link.target({ id: targetEl.id, port: ports.target });
      this.aplicarReglasDeTransicion(link);
    });

    this.ensurePaperDimensions();
    this.error = null;
    this.info = 'Diagrama organizado automaticamente.';
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
        if (cellView.model.isLink()) {
          return {
            linkMove: true,
            arrowheadMove: true,
            vertexMove: true,
            vertexAdd: true,
            vertexRemove: true,
            useLinkTools: true
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
      this.abrirModalEdicionNodo(view.model);
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
      if (this.isApplyingAutoLayout) {
        return;
      }
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
      this.aplicarReglasDeTransicion(link);
    });

    this.graph.on('change:source', (cell: joint.dia.Cell) => {
      if (cell.isLink()) {
        this.aplicarReglasDeTransicion(cell as joint.dia.Link);
      }
    });

    this.graph.on('change:target', (cell: joint.dia.Cell) => {
      if (cell.isLink()) {
        this.aplicarReglasDeTransicion(cell as joint.dia.Link);
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
          strokeDasharray: '0',
          targetMarker: {
            type: 'path',
            d: 'M 10 -5 0 0 10 5 z'
          }
        }
      },
      connector: { name: 'rounded', args: { radius: 10 } },
      router: { name: 'normal' },
      labels: []
    });
    link.set('kind', 'TRANSICION');
    link.set('tempId', `tmp_tr_${Date.now()}_${++this.tempCounter}`);
    link.set('transicionTipo', 'LINEAL');
    link.set('condicion', '');
    return link;
  }

  private createNode(payload: NodePayload): joint.dia.Element {
    const defaultSize = this.getNodeSize(payload.tipo);
    const size = {
      w: payload.ancho ?? defaultSize.w,
      h: payload.alto ?? defaultSize.h
    };
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
            fontWeight: 600,
            textWrap: {
              width: -18,
              height: -18,
              ellipsis: true
            }
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
            fontWeight: 500,
            textWrap: {
              width: -20,
              height: -14,
              ellipsis: true
            }
          }
        }
      });
    }

    element.set('kind', 'NODE');
    element.set('nodoDbId', payload.id || undefined);
    element.set('tempId', payload.tempId || payload.id || `tmp_node_${Date.now()}_${++this.tempCounter}`);
    element.set('nodeTipo', payload.tipo);
    element.set('nodeNombre', payload.nombre || this.defaultLabelForTipo(payload.tipo));
    element.set('departamentoId', payload.departamentoId || '');
    if (payload.formularioId) {
      element.set('formularioId', payload.formularioId);
    }

    this.configureNodePorts(element, true);
    this.graph.addCell(element);
    return element;
  }

  private configureNodePorts(element: joint.dia.Element, withPorts: boolean): void {
    if (!withPorts) {
      return;
    }

    const circleAttrs = {
      r: 6,
      magnet: true,
      stroke: '#6B6F2A',
      strokeWidth: 1.2,
      fill: '#FFFFFF',
      opacity: this.portIdleOpacity
    };

    element.prop('ports/groups', {
      top: {
        position: { name: 'top', args: { x: '50%' } },
        attrs: {
          circle: circleAttrs
        }
      },
      right: {
        position: { name: 'right', args: { y: '50%' } },
        attrs: {
          circle: circleAttrs
        }
      },
      bottom: {
        position: { name: 'bottom', args: { x: '50%' } },
        attrs: {
          circle: circleAttrs
        }
      },
      left: {
        position: { name: 'left', args: { y: '50%' } },
        attrs: {
          circle: circleAttrs
        }
      },
      topLeft: {
        position: { name: 'absolute', args: { x: '6%', y: '6%' } },
        attrs: {
          circle: circleAttrs
        }
      },
      topRight: {
        position: { name: 'absolute', args: { x: '94%', y: '6%' } },
        attrs: {
          circle: circleAttrs
        }
      },
      bottomLeft: {
        position: { name: 'absolute', args: { x: '6%', y: '94%' } },
        attrs: {
          circle: circleAttrs
        }
      },
      bottomRight: {
        position: { name: 'absolute', args: { x: '94%', y: '94%' } },
        attrs: {
          circle: circleAttrs
        }
      }
    });

    const existing = new Set((element.getPorts() || []).map((p) => p.id));
    const required = ['top', 'right', 'bottom', 'left', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
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
      this.configureNodePorts(el, true);

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
      link.connector({ name: 'rounded', args: { radius: 10 } });
      link.router('normal');
      link.attr(['line', 'stroke'], '#7A7A40');
      link.attr(['line', 'strokeWidth'], 2.2);
      this.aplicarReglasDeTransicion(link);
    });
  }

  private reconstruirDesdeApi(data: DiagramaResponse): void {
    const nodos = (data.nodos ?? []).flatMap((raw): ApiNodoDiagrama[] => {
      const n = raw as Partial<ApiNodoDiagrama>;
      if (typeof n.id !== 'string' || n.id.trim().length === 0) {
        return [];
      }
      return [
        {
          id: n.id,
          tipo: n.tipo ?? null,
          nombre: n.nombre ?? null,
          departamentoId: n.departamentoId ?? null,
          formularioId: n.formularioId ?? null
        }
      ];
    });

    const transiciones = (data.transiciones ?? []).flatMap((raw): ApiTransicionDiagrama[] => {
      const t = raw as Partial<ApiTransicionDiagrama>;
      if (typeof t.nodoOrigenId !== 'string' || typeof t.nodoDestinoId !== 'string') {
        return [];
      }
      return [
        {
          id: typeof t.id === 'string' ? t.id : null,
          nodoOrigenId: t.nodoOrigenId,
          nodoDestinoId: t.nodoDestinoId,
          tipo: t.tipo ?? null,
          etiqueta: t.etiqueta ?? null,
          condicion: t.condicion ?? null
        }
      ];
    });

    if (nodos.length === 0) {
      return;
    }

    const layout = calcularLayout(
      nodos.map((n) => ({
        id: n.id,
        tipo: this.normalizeNodoTipo(n.tipo) as LayoutNodoTipo,
        departamentoId: n.departamentoId ?? undefined
      } as LayoutNodoInput)),
      transiciones.map((t) => ({
        nodoOrigenId: t.nodoOrigenId,
        nodoDestinoId: t.nodoDestinoId
      } as LayoutTransicionInput)),
      this.buildLayoutCarriles(),
      {
        laneWidth: this.laneWidth,
        laneStartX: this.laneStartX,
        nodeSizeByTipo: this.buildLayoutNodeSizeOverrides()
      }
    );

    this.rebuildLanesFromLayout(layout.lanes);

    const nodeByDbId = new Map<string, joint.dia.Element>();

    const sortedNodes = [...nodos].sort((a, b) => (layout.levels.get(a.id) ?? 0) - (layout.levels.get(b.id) ?? 0));

    for (const n of sortedNodes) {
      const tipo = this.normalizeNodoTipo(n.tipo);
      const position = layout.positions.get(n.id);
      if (!position) {
        continue;
      }

      const defaultSize = this.getNodeSize(tipo);
      const ancho = tipo === 'PARALELO' && position.width > defaultSize.w ? position.width : undefined;

      const cell = this.createNode({
        id: n.id,
        tempId: n.id,
        tipo,
        nombre: n.nombre || this.defaultLabelForTipo(tipo),
        departamentoId: position.laneId,
        formularioId: n.formularioId || undefined,
        posicionX: position.x,
        posicionY: position.y,
        ancho
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

  private normalizeNodoTipo(raw: string | null | undefined): NodoEstado['tipo'] {
    if (raw === 'INICIO' || raw === 'TAREA' || raw === 'DECISION' || raw === 'FIN' || raw === 'PARALELO') {
      return raw;
    }
    return 'TAREA';
  }

  private buildLayoutCarriles(): LayoutCarrilInput[] {
    const byId = new Map<string, string>();

    this.departamentosCompletos.forEach((d) => byId.set(d.id, d.nombre));
    this.lanes.forEach((lane) => {
      if (!byId.has(lane.departamentoId)) {
        byId.set(lane.departamentoId, lane.nombreDepartamento);
      }
    });

    const orderedIds: string[] = [];
    const seen = new Set<string>();

    this.lanes.forEach((lane) => {
      if (lane.departamentoId && !seen.has(lane.departamentoId)) {
        seen.add(lane.departamentoId);
        orderedIds.push(lane.departamentoId);
      }
    });

    this.departamentosCompletos.forEach((depto) => {
      if (!seen.has(depto.id)) {
        seen.add(depto.id);
        orderedIds.push(depto.id);
      }
    });

    return orderedIds.map((id) => ({ id, nombre: byId.get(id) ?? 'Departamento' }));
  }

  private buildLayoutNodeSizeOverrides(): Partial<Record<LayoutNodoTipo, LayoutNodeSize>> {
    const inicio = this.getNodeSize('INICIO');
    const tarea = this.getNodeSize('TAREA');
    const decision = this.getNodeSize('DECISION');
    const paralelo = this.getNodeSize('PARALELO');
    const fin = this.getNodeSize('FIN');

    return {
      INICIO: { width: inicio.w, height: inicio.h },
      TAREA: { width: tarea.w, height: tarea.h },
      DECISION: { width: decision.w, height: decision.h },
      PARALELO: { width: paralelo.w, height: paralelo.h },
      PARALELO_FORK: { width: paralelo.w, height: paralelo.h },
      PARALELO_JOIN: { width: paralelo.w, height: paralelo.h },
      FIN: { width: fin.w, height: fin.h }
    };
  }

  private layoutNodeKeyFromElement(el: joint.dia.Element): string {
    const dbId = (el.get('nodoDbId') as string | undefined) || '';
    if (dbId) {
      return dbId;
    }
    const tempId = (el.get('tempId') as string | undefined) || '';
    if (tempId) {
      return tempId;
    }
    return el.id.toString();
  }

  private rebuildLanesFromLayout(layoutLanes: LayoutCarrilInput[]): void {
    const laneCells = this.graph.getElements().filter((el) => el.get('kind') === 'LANE');
    if (laneCells.length > 0) {
      this.graph.removeCells(laneCells);
    }

    this.lanes = [];

    layoutLanes.forEach((lane) => {
      this.insertLane(lane.id, lane.nombre);
    });
  }

  private insertLane(departamentoId: string, nombre: string): void {
    const x = this.laneStartX + this.lanes.length * this.laneWidth;
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
      const newX = this.laneStartX + index * this.laneWidth;
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

    if (node.size().width > lane.width - 32) {
      node.set('departamentoId', lane.departamentoId);
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

    if (Math.abs(dx) > 90 && Math.abs(dy) > 90) {
      if (dx >= 0 && dy >= 0) {
        return { source: 'bottomRight', target: 'topLeft' };
      }
      if (dx >= 0 && dy < 0) {
        return { source: 'topRight', target: 'bottomLeft' };
      }
      if (dx < 0 && dy >= 0) {
        return { source: 'bottomLeft', target: 'topRight' };
      }
      return { source: 'topLeft', target: 'bottomRight' };
    }

    const sameLane = (source.get('departamentoId') as string) === (target.get('departamentoId') as string);
    if (sameLane || Math.abs(dy) > Math.abs(dx)) {
      return dy >= 0 ? { source: 'bottom', target: 'top' } : { source: 'top', target: 'bottom' };
    }

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
    const vertices = new joint.linkTools.Vertices({ vertexAdding: true });
    const removeButton = new joint.linkTools.Remove({ distance: '76%' });

    const tools = new joint.dia.ToolsView({
      tools: [vertices, removeButton]
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
    if (!text) {
      link.labels([]);
      return;
    }

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
    if (tipo !== 'ALTERNATIVA') {
      return '';
    }
    const clean = etiqueta.trim();
    if (!clean) {
      return '';
    }
    return `[${clean}]`;
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

  private abrirModalEdicionNodo(node: joint.dia.Element): void {
    if (node.get('kind') !== 'NODE') {
      return;
    }

    const tipo = (node.get('nodeTipo') as NodoEstado['tipo']) || 'TAREA';
    if (tipo === 'INICIO' || tipo === 'FIN') {
      return;
    }

    this.nodoModalTarget = node;
    this.nodoModal = {
      nombre: (node.get('nodeNombre') as string) || this.defaultLabelForTipo(tipo),
      formularioId: (node.get('formularioId') as string) || ''
    };
    this.mostrarModalNodo = true;
  }

  private esTransicionDeDecision(link: joint.dia.Link | null): boolean {
    if (!link) {
      return false;
    }
    const source = link.source();
    if (!source.id) {
      return false;
    }
    const sourceCell = this.graph.getCell(source.id.toString()) as joint.dia.Element | null;
    return !!sourceCell && sourceCell.get('kind') === 'NODE' && sourceCell.get('nodeTipo') === 'DECISION';
  }

  private aplicarReglasDeTransicion(link: joint.dia.Link): void {
    const source = link.source();
    const target = link.target();
    if (!source.id || !target.id) {
      return;
    }

    const sourceCell = this.graph.getCell(source.id.toString()) as joint.dia.Element | null;
    const targetCell = this.graph.getCell(target.id.toString()) as joint.dia.Element | null;
    if (!sourceCell || !targetCell) {
      return;
    }

    const sourceTipo = sourceCell.get('nodeTipo') as NodoEstado['tipo'];
    const targetTipo = targetCell.get('nodeTipo') as NodoEstado['tipo'];

    if (sourceTipo === 'DECISION') {
      const outgoing = this.graph
        .getLinks()
        .filter((l) => l.source().id?.toString() === source.id!.toString())
        .sort((a, b) => a.id.toString().localeCompare(b.id.toString()));

      outgoing.forEach((outLink, index) => {
        outLink.set('transicionTipo', 'ALTERNATIVA');
        const etiqueta = index === 0 ? 'Si' : index === 1 ? 'No' : `Opcion ${index + 1}`;
        this.setLinkLabel(outLink, this.formatLinkLabel(etiqueta, 'ALTERNATIVA'));
      });
      return;
    }

    if (sourceTipo === 'PARALELO' || targetTipo === 'PARALELO') {
      link.set('transicionTipo', 'PARALELA');
      this.setLinkLabel(link, '');
      return;
    }

    link.set('transicionTipo', 'LINEAL');
    this.setLinkLabel(link, '');
  }

  private togglePorts(element: joint.dia.Element, visible: boolean): void {
    if (element.get('kind') !== 'NODE') {
      return;
    }

    for (const port of element.getPorts()) {
      if (port.id) {
        element.portProp(port.id, 'attrs/circle/opacity', visible ? 1 : this.portIdleOpacity);
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

    const lanesWidth = Math.max(1, this.lanes.length) * this.laneWidth;
    const minW = Math.max(this.diagramCanvasRef.nativeElement.clientWidth, this.laneStartX * 2 + lanesWidth + 520);
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
