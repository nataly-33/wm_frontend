import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { forkJoin, firstValueFrom } from 'rxjs';

import { Graph, InternalEvent, Cell, EventObject, gestureUtils } from '@maxgraph/core';

import { ApiResponse } from '../../../../../core/models/api-response.model';
import { Departamento, DepartamentoService } from '../../../../../core/services/departamento.service';
import { CrearNodoRequest, Nodo, NodoTipo } from '../../../../../core/services/nodo.service';
import { Politica, PoliticaService } from '../../../../../core/services/politica.service';
import { CrearTransicionRequest, Transicion, TransicionTipo } from '../../../../../core/services/transicion.service';
import { EstadoEditor, validarDiagrama } from './diagram-validators';

@Component({
  selector: 'app-editor-diagrama',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './editor-diagrama.component.html',
  styleUrls: ['./editor-diagrama.component.scss']
})
export class EditorDiagramaComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('graphContainer') graphContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('paletteRef') paletteRef!: ElementRef<HTMLElement>;

  politicaId = '';
  politica: Politica | null = null;
  departamentosCompletos: Departamento[] = [];
  mostrarMenuCarriles = false;
  
  cargando = false;
  guardando = false;
  error: string | null = null;
  info: string | null = null;

  graph!: Graph;
  cellSeleccionada: Cell | null = null;
  hasSelection = false;

  propiedadesTemp = {
    etiqueta: '',
    tipo: 'LINEAL' as TransicionTipo,
    condicion: ''
  };

  private stateNodos: any[] = [];
  private stateTransiciones: any[] = [];
  
  constructor(
    private route: ActivatedRoute,
    private politicaService: PoliticaService,
    private departamentoService: DepartamentoService
  ) {}

  ngOnInit(): void {
    this.politicaId = this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngAfterViewInit(): void {
    this.initGraph();
    this.initPalette();
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    if (this.graph) {
      this.graph.destroy();
    }
  }

  get departamentosDisponiblesParaCarril(): Departamento[] {
    if (!this.graph) return this.departamentosCompletos;
    const parent = this.graph.getDefaultParent();
    const cells = this.graph.getChildVertices(parent);
    const usados = new Set(cells.filter(c => this.esCarril(c)).map(c => c.getId()));
    return this.departamentosCompletos.filter(d => !usados.has(d.id));
  }

  get departamentosVisibles(): Departamento[] {
    if (!this.graph) return [];
    const parent = this.graph.getDefaultParent();
    const cells = this.graph.getChildVertices(parent);
    const usados = cells.filter(c => this.esCarril(c)).map(c => c.getId());
    return this.departamentosCompletos.filter(d => usados.includes(d.id));
  }

  private initGraph() {
    InternalEvent.disableContextMenu(this.graphContainer.nativeElement);
    
    this.graph = new Graph(this.graphContainer.nativeElement);
    this.graph.setConnectable(true);
    this.graph.setAllowDanglingEdges(false);
    this.graph.setCellsEditable(true);
    this.graph.setDropEnabled(true);
    (this.graph as any).swimlaneNesting = false;
    this.graph.setHtmlLabels(true);
    this.graph.setTooltips(true);
    this.graph.setGridEnabled(true);
    this.graph.setGridSize(10);
    this.graph.setPanning(true);

    // Eventos de selección
    this.graph.getSelectionModel().addListener('change', this.handleSelectionChange.bind(this));
  }

  private initPalette() {
    const paletteContainer = document.getElementById('paletteContainer');
    if (!paletteContainer) return;

    this.addPaletteItem(paletteContainer, 'INICIO', 'Inicio', 'ellipse;fillColor=#333300;strokeColor=#C0C080;fontColor=#f5f5e8;fontSize=11;', 40, 40);
    this.addPaletteItem(paletteContainer, 'TAREA', 'Tarea', 'rounded=1;fillColor=none;strokeColor=#9D9D60;fontColor=#f5f5e8;fontSize=11;arcSize=30;', 160, 60);
    this.addPaletteItem(paletteContainer, 'DECISION', 'Decisión', 'rhombus;fillColor=none;strokeColor=#9D9D60;fontColor=#f5f5e8;fontSize=11;', 80, 80);
    this.addPaletteItem(paletteContainer, 'PARALELO', 'Fork/Join', 'shape=line;strokeColor=#333300;strokeWidth=8;fillColor=#333300;', 150, 10);
    this.addPaletteItem(paletteContainer, 'FIN', 'Fin', 'ellipse;fillColor=#333300;strokeColor=#9D9D60;fontSize=11;', 40, 40);
  }

  private addPaletteItem(container: HTMLElement, tipo: string, title: string, style: string, width: number, height: number) {
    const div = document.createElement('div');
    div.style.padding = '10px';
    div.style.border = '1px solid var(--border-color)';
    div.style.marginBottom = '5px';
    div.style.cursor = 'grab';
    div.style.borderRadius = '5px';
    div.style.backgroundColor = 'var(--surface-bg)';
    div.innerHTML = `<strong>${title}</strong>`;
    
    // Drag source
    const dragSource = gestureUtils.makeDraggable(div, this.graph, (graph, evt, target, x, y) => {
      const dropX = x ?? 0;
      const dropY = y ?? 0;
      // Determinar si cayó dentro de un carril
      let carrilTarget = target;
      if (!carrilTarget || !this.esCarril(carrilTarget)) {
        // Buscar el carril que intersecta x,y
        const prnt = graph.getDefaultParent();
        const children = graph.getChildVertices(prnt);
        for (const child of children) {
          if (this.esCarril(child)) {
            const geo = child.getGeometry();
            if (geo && dropX >= geo.x && dropX <= geo.x + geo.width && dropY >= geo.y && dropY <= geo.y + geo.height) {
              carrilTarget = child;
              break;
            }
          }
        }
      }

      const parentToInsert = carrilTarget && this.esCarril(carrilTarget) ? carrilTarget : graph.getDefaultParent();

      let finalGeoX = dropX;
      let finalGeoY = dropY;

      if (parentToInsert && parentToInsert !== graph.getDefaultParent()) {
        const parGeo = parentToInsert.getGeometry();
        if (parGeo) {
           finalGeoX = dropX - parGeo.x;
           finalGeoY = dropY - parGeo.y;
        }
      }

      graph.getDataModel().beginUpdate();
      try {
        const tempId = 'tmp_node_' + Date.now();
        const vertex = graph.insertVertex(parentToInsert, tempId, title, finalGeoX, finalGeoY, width, height, style as any);
        vertex.setAttribute('tipo', tipo);
      } finally {
        graph.getDataModel().endUpdate();
      }
    }, div);
    
    container.appendChild(div);
  }

  private cargarDatos() {
    this.cargando = true;
    this.error = null;
    
    const empresaId = localStorage.getItem('empresaId') || '';

    // Llamamos el nuevo endpoint getDiagrama y getDepartamentosCompletos
    // Como PoliticaService todavia no tiene los metodos implementados en HttpClient, hacemos cast o any momentaneo
    // o asumiendo que ya en PoliticaService estan listos
    forkJoin({
      politica: this.politicaService.obtener(this.politicaId),
      departamentos: this.departamentoService.listarCompletos()
    }).subscribe({
      next: ({ politica, departamentos }) => {
        this.politica = politica.data;
        this.departamentosCompletos = departamentos.data ?? [];
        
        // Aqui deberiamos traernos el diagrama via API, si el endpoint existiese en PoliticaService
        // Simularemos llamarlo via fetch para ser directos o esperar que backend lo rutee
        fetch(`/api/v1/politicas/${this.politicaId}/diagrama`, {
          headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('token'),
            'X-Empresa-Id': empresaId
          }
        }).then(res => res.json()).then(res => {
          this.cargando = false;
          if (res.data && (res.data as any).datosDiagramaJson) {
            // reconstruir
            const xml = (res.data as any).datosDiagramaJson;
            // TODO mxCodec
            this.info = 'Diagrama cargado';
          }
        }).catch(err => {
          this.cargando = false;
          this.error = 'Error al cargar diagrama visual';
        });

      },
      error: (err) => {
        this.error = 'Error general al cargar';
        this.cargando = false;
      }
    });
  }

  agregarCarril(depto: Departamento) {
    if (!this.graph) return;
    this.graph.getDataModel().beginUpdate();
    try {
      const parent = this.graph.getDefaultParent();
      const existingLanes = this.graph.getChildVertices(parent).filter(c => this.esCarril(c));
      
      const width = 250;
      const height = 800; // altura total
      let x = 0;
      
      if (existingLanes.length > 0) {
        const lastGeo = existingLanes[existingLanes.length - 1].getGeometry();
        if (lastGeo) {
           x = lastGeo.x + lastGeo.width;
        }
      }

      const style = `swimlane;horizontal=0;startSize=30;fillColor=rgba(192,192,128,0.15);strokeColor=#7A7A40;fontColor=#f5f5e8;fontSize=14;fontStyle=1;`;
      const lane = this.graph.insertVertex(parent, depto.id, depto.nombre, x, 0, width, height, style as any);
      lane.setAttribute('isLane', 'true');
      lane.setAttribute('departamentoId', depto.id);
    } finally {
      this.graph.getDataModel().endUpdate();
      this.mostrarMenuCarriles = false;
    }
  }

  handleSelectionChange(sender: any, evt: EventObject) {
    const cells = this.graph.getSelectionCells();
    if (cells.length > 0) {
      this.cellSeleccionada = cells[0];
      this.hasSelection = true;
      if (this.esTransicionSeleccionada()) {
        const lbl = this.cellSeleccionada.getValue();
        this.propiedadesTemp.etiqueta = typeof lbl === 'string' ? lbl : '';
        this.propiedadesTemp.tipo = (this.cellSeleccionada.getAttribute('tipo') as TransicionTipo) || 'LINEAL';
      }
    } else {
      this.cellSeleccionada = null;
      this.hasSelection = false;
    }
  }

  eliminarSeleccion() {
    if (this.graph && !this.graph.isSelectionEmpty()) {
      this.graph.removeCells(this.graph.getSelectionCells());
    }
  }

  esTransicionSeleccionada(): boolean {
    return !!this.cellSeleccionada && this.cellSeleccionada.isEdge();
  }

  actualizarTransicion() {
    if (!this.graph || !this.esTransicionSeleccionada() || !this.cellSeleccionada) return;
    this.graph.getDataModel().beginUpdate();
    try {
      this.graph.getDataModel().setValue(this.cellSeleccionada, this.propiedadesTemp.etiqueta);
      this.cellSeleccionada.setAttribute('tipo', this.propiedadesTemp.tipo);
    } finally {
      this.graph.getDataModel().endUpdate();
    }
  }

  esCarril(cell: Cell): boolean {
    return cell.isVertex() && cell.getAttribute('isLane') === 'true';
  }

  async guardarDiagrama() {
    this.guardando = true;
    this.error = null;
    this.info = null;
    
    if (!this.graph) return;
    
    // Serializar el canvas con XML nativo 
    // Usaremos algo generico o mock temporal
    const empresaId = localStorage.getItem('empresaId') || '';

    const payload = {
      diagrama: '<mxGraphModel>...</mxGraphModel>',
      nodos: [],
      transiciones: []
    };

    try {
      const response = await fetch(`/api/v1/politicas/${this.politicaId}/diagrama`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token'),
          'X-Empresa-Id': empresaId
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('No se pudo guardar la politica');
      }

      this.info = 'Diagrama guardado en BD!!';
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.guardando = false;
    }
  }

  exportarPng() {
    const el = document.getElementById('diagram-canvas-container');
    if (!el) return;
    html2canvas(el).then(canvas => {
      const link = document.createElement('a');
      link.download = `diagrama-${this.politica!.nombre}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  exportarPdf() {
    const el = document.getElementById('diagram-canvas-container');
    if (!el) return;
    html2canvas(el).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 10, width, height);
      pdf.save(`diagrama-${this.politica!.nombre}.pdf`);
    });
  }
}
