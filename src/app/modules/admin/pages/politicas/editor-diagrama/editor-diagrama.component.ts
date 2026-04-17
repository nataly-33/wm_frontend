import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ApiResponse } from '../../../../../core/models/api-response.model';
import { Departamento, DepartamentoService } from '../../../../../core/services/departamento.service';
import { CrearNodoRequest, Nodo, NodoService, NodoTipo } from '../../../../../core/services/nodo.service';
import { Politica, PoliticaService } from '../../../../../core/services/politica.service';
import { CrearTransicionRequest, Transicion, TransicionService, TransicionTipo } from '../../../../../core/services/transicion.service';

@Component({
  selector: 'app-editor-diagrama',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './editor-diagrama.component.html',
  styleUrls: ['./editor-diagrama.component.scss']
})
export class EditorDiagramaComponent implements OnInit, OnDestroy {
  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLDivElement>;

  readonly laneHeight = 180;
  readonly nodeWidth = 140;
  readonly nodeHeight = 72;
  readonly canvasWidth = 1700;

  politicaId = '';
  politica: Politica | null = null;
  departamentos: Departamento[] = [];
  departamentosVisibles: Departamento[] = [];
  nodos: Nodo[] = [];
  transiciones: Transicion[] = [];
  private nodosOriginales: Nodo[] = [];
  private transicionesOriginales: Transicion[] = [];
  cargando = false;
  guardando = false;
  error: string | null = null;
  info: string | null = null;

  tiposNodo: NodoTipo[] = ['INICIO', 'TAREA', 'DECISION', 'PARALELO', 'FIN'];
  conectandoDesdeId: string | null = null;
  nodoSeleccionadoId: string | null = null;
  transicionSeleccionadaId: string | null = null;
  mostrarMenuCarriles = false;

  private draggingNodeId: string | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  constructor(
    private route: ActivatedRoute,
    private politicaService: PoliticaService,
    private departamentoService: DepartamentoService,
    private nodoService: NodoService,
    private transicionService: TransicionService
  ) {}

  ngOnInit(): void {
    this.politicaId = this.route.snapshot.paramMap.get('id') ?? '';
    this.cargarTodo();
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  ngOnDestroy(): void {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  }

  cargarTodo(): void {
    this.cargando = true;
    this.error = null;
    forkJoin({
      politica: this.politicaService.obtener(this.politicaId),
      departamentos: this.departamentoService.listar(),
      nodos: this.nodoService.listarPorPolitica(this.politicaId),
      transiciones: this.transicionService.listarPorPolitica(this.politicaId)
    }).subscribe({
      next: ({ politica, departamentos, nodos, transiciones }) => {
        this.politica = politica.data;
        this.departamentos = departamentos.data ?? [];
        this.departamentosVisibles = [...this.departamentos];
        this.nodos = (nodos.data ?? []).map((n) => ({ ...n }));
        this.transiciones = (transiciones.data ?? []).map((t) => ({ ...t }));
        this.nodosOriginales = this.nodos.map((n) => ({ ...n }));
        this.transicionesOriginales = this.transiciones.map((t) => ({ ...t }));
        this.cargando = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message ?? 'No se pudo cargar el editor';
        this.cargando = false;
      }
    });
  }

  get canvasHeight(): number {
    return Math.max(600, this.departamentosVisibles.length * this.laneHeight);
  }

  get departamentosDisponiblesParaCarril(): Departamento[] {
    const visibles = new Set(this.departamentosVisibles.map((d) => d.id));
    return this.departamentos.filter((d) => !visibles.has(d.id));
  }

  getNodeById(id: string): Nodo | undefined {
    return this.nodos.find((n) => n.id === id);
  }

  laneTop(index: number): number {
    return index * this.laneHeight;
  }

  laneCenterY(index: number): number {
    return this.laneTop(index) + this.laneHeight / 2;
  }

  getNodeShapeClass(tipo: NodoTipo): string {
    switch (tipo) {
      case 'INICIO':
        return 'uml-inicio';
      case 'FIN':
        return 'uml-fin';
      case 'DECISION':
        return 'uml-decision';
      case 'PARALELO':
        return 'uml-paralelo';
      default:
        return 'uml-tarea';
    }
  }

  getNodeLabel(tipo: NodoTipo): string {
    switch (tipo) {
      case 'INICIO': return 'Initial Node';
      case 'FIN': return 'Activity Final';
      case 'DECISION': return 'Decision/Merge';
      case 'PARALELO': return 'Fork/Join';
      default: return 'Action Node';
    }
  }

  onPaletteDragStart(event: DragEvent, tipo: NodoTipo): void {
    event.dataTransfer?.setData('application/uml-node-type', tipo);
    event.dataTransfer!.effectAllowed = 'copy';
  }

  permitirDrop(event: DragEvent): void {
    event.preventDefault();
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    const tipo = event.dataTransfer?.getData('application/uml-node-type') as NodoTipo;
    if (!tipo || !this.canvasRef) return;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;
    const laneIndex = this.getLaneIndexByY(rawY);
    const lane = this.departamentosVisibles[laneIndex];

    if (!lane) {
      this.error = 'Debes soltar el nodo dentro de un carril';
      return;
    }

    const x = this.clamp(rawX - this.nodeWidth / 2, 20, this.canvasWidth - this.nodeWidth - 20);
    const y = this.laneTop(laneIndex) + (this.laneHeight - this.nodeHeight) / 2;
    const baseName = this.nombrePorTipo(tipo);
    const contador = this.nodos.filter((n) => n.tipo === tipo).length + 1;

    this.nodos.push({
      id: this.tempId('nodo'),
      politicaId: this.politicaId,
      departamentoId: lane.id,
      nombre: `${baseName} ${contador}`,
      tipo,
      posicionX: x,
      posicionY: y,
      formularioId: null,
      creadoEn: new Date().toISOString()
    });
    this.info = `Nodo ${baseName} agregado`;
    this.error = null;
  }

  agregarCarril(departamento: Departamento): void {
    this.departamentosVisibles.push(departamento);
    this.mostrarMenuCarriles = false;
  }

  quitarCarril(departamentoId: string): void {
    const tieneNodos = this.nodos.some((n) => n.departamentoId === departamentoId);
    if (tieneNodos) {
      this.error = 'No puedes quitar un carril que tiene nodos.';
      return;
    }
    this.departamentosVisibles = this.departamentosVisibles.filter((d) => d.id !== departamentoId);
  }

  seleccionarNodo(nodoId: string): void {
    if (this.conectandoDesdeId) {
      this.crearTransicionVisual(this.conectandoDesdeId, nodoId);
      this.conectandoDesdeId = null;
      return;
    }
    this.nodoSeleccionadoId = nodoId;
    this.transicionSeleccionadaId = null;
  }

  iniciarConexion(event: MouseEvent, nodoId: string): void {
    event.stopPropagation();
    this.conectandoDesdeId = nodoId;
    this.nodoSeleccionadoId = nodoId;
    this.info = 'Haz clic en otro nodo para conectar.';
    this.error = null;
  }

  cancelarConexion(): void {
    this.conectandoDesdeId = null;
  }

  crearTransicionVisual(origenId: string, destinoId: string): void {
    if (origenId === destinoId) {
      this.error = 'No puedes conectar un nodo consigo mismo.';
      return;
    }
    const existe = this.transiciones.some((t) => t.nodoOrigenId === origenId && t.nodoDestinoId === destinoId);
    if (existe) {
      this.error = 'Esa transicion ya existe.';
      return;
    }
    const origen = this.getNodeById(origenId);
    if (!origen) return;
    const tipo = this.inferirTipoTransicion(origen.tipo);
    this.transiciones.push({
      id: this.tempId('transicion'),
      politicaId: this.politicaId,
      nodoOrigenId: origenId,
      nodoDestinoId: destinoId,
      tipo,
      etiqueta: this.etiquetaDefault(tipo),
      condicion: tipo === 'ALTERNATIVA' ? '[condicion]' : null,
      creadoEn: new Date().toISOString()
    });
    this.info = 'Transicion creada visualmente.';
    this.error = null;
  }

  seleccionarTransicion(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.transicionSeleccionadaId = id;
    this.nodoSeleccionadoId = null;
  }

  eliminarNodo(id: string): void {
    this.nodos = this.nodos.filter((n) => n.id !== id);
    this.transiciones = this.transiciones.filter((t) => t.nodoOrigenId !== id && t.nodoDestinoId !== id);
    if (this.nodoSeleccionadoId === id) this.nodoSeleccionadoId = null;
  }

  eliminarTransicion(id: string): void {
    this.transiciones = this.transiciones.filter((t) => t.id !== id);
    if (this.transicionSeleccionadaId === id) this.transicionSeleccionadaId = null;
  }

  iniciarDrag(event: MouseEvent, nodo: Nodo): void {
    if ((event.target as HTMLElement).closest('.node-action')) {
      return;
    }
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.draggingNodeId = nodo.id;
    this.dragOffsetX = event.clientX - rect.left;
    this.dragOffsetY = event.clientY - rect.top;
  }

  onMouseMove = (event: MouseEvent): void => {
    if (!this.draggingNodeId || !this.canvasRef) return;
    const canvasRect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = this.clamp(event.clientX - canvasRect.left - this.dragOffsetX, 20, this.canvasWidth - this.nodeWidth - 20);
    const yLibre = this.clamp(event.clientY - canvasRect.top - this.dragOffsetY, 10, this.canvasHeight - this.nodeHeight - 10);
    const laneIndex = this.getLaneIndexByY(yLibre + this.nodeHeight / 2);
    const lane = this.departamentosVisibles[laneIndex];
    const y = this.laneTop(laneIndex) + (this.laneHeight - this.nodeHeight) / 2;

    this.nodos = this.nodos.map((n) => n.id === this.draggingNodeId
      ? { ...n, posicionX: x, posicionY: y, departamentoId: lane.id }
      : n);
  };

  onMouseUp = (): void => {
    if (!this.draggingNodeId) return;
    this.draggingNodeId = null;
  };

  async guardarDiagrama(): Promise<void> {
    this.error = null;
    this.info = null;
    this.guardando = true;
    try {
      const mapTempToReal = new Map<string, string>();

      const nodosActualesReales = new Set(this.nodos.filter((n) => !this.esTemporal(n.id)).map((n) => n.id));
      const nodosEliminados = this.nodosOriginales.filter((n) => !nodosActualesReales.has(n.id));
      for (const n of nodosEliminados) {
        await firstValueFrom(this.nodoService.eliminar(n.id));
      }

      for (const nodo of this.nodos) {
        const request = this.mapNodoRequest(nodo);
        if (this.esTemporal(nodo.id)) {
          const creado = await firstValueFrom(this.nodoService.crear(request));
          const nuevoId = creado.data?.id;
          if (!nuevoId) throw new Error('No se recibio id al crear nodo');
          mapTempToReal.set(nodo.id, nuevoId);
          nodo.id = nuevoId;
        } else {
          const original = this.nodosOriginales.find((o) => o.id === nodo.id);
          if (this.nodoCambio(original, nodo)) {
            await firstValueFrom(this.nodoService.actualizar(nodo.id, request));
          }
        }
      }

      this.transiciones = this.transiciones
        .map((t) => ({
          ...t,
          nodoOrigenId: mapTempToReal.get(t.nodoOrigenId) ?? t.nodoOrigenId,
          nodoDestinoId: mapTempToReal.get(t.nodoDestinoId) ?? t.nodoDestinoId
        }))
        .filter((t) => this.getNodeById(t.nodoOrigenId) && this.getNodeById(t.nodoDestinoId));

      const transicionesActualesReales = new Set(this.transiciones.filter((t) => !this.esTemporal(t.id)).map((t) => t.id));
      const transicionesEliminadas = this.transicionesOriginales.filter((t) => !transicionesActualesReales.has(t.id));
      for (const t of transicionesEliminadas) {
        await firstValueFrom(this.transicionService.eliminar(t.id));
      }

      for (const transicion of this.transiciones) {
        const request = this.mapTransicionRequest(transicion);
        if (this.esTemporal(transicion.id)) {
          const creada = await firstValueFrom(this.transicionService.crear(request));
          const nuevoId = creada.data?.id;
          if (!nuevoId) throw new Error('No se recibio id al crear transicion');
          transicion.id = nuevoId;
        } else {
          const original = this.transicionesOriginales.find((o) => o.id === transicion.id);
          if (this.transicionCambio(original, transicion)) {
            await firstValueFrom(this.transicionService.actualizar(transicion.id, request));
          }
        }
      }

      this.nodosOriginales = this.nodos.map((n) => ({ ...n }));
      this.transicionesOriginales = this.transiciones.map((t) => ({ ...t }));
      this.info = 'Diagrama guardado correctamente.';
    } catch (e: unknown) {
      const message = (e as { error?: { message?: string }; message?: string })?.error?.message
        || (e as { message?: string })?.message
        || 'No se pudo guardar el diagrama';
      this.error = message;
    } finally {
      this.guardando = false;
    }
  }

  exportarPng(): void {
    if (!this.canvasRef) return;
    html2canvas(this.canvasRef.nativeElement).then(canvas => {
      const link = document.createElement('a');
      link.download = `diagrama-${this.politicaId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  exportarPdf(): void {
    if (!this.canvasRef) return;
    html2canvas(this.canvasRef.nativeElement).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 10, pageWidth, Math.min(pageHeight, 180));
      pdf.save(`diagrama-${this.politicaId}.pdf`);
    });
  }

  getDepartamentoNombre(departamentoId: string): string {
    return this.departamentos.find(d => d.id === departamentoId)?.nombre ?? 'Sin departamento';
  }

  getTransitionPath(transicion: Transicion): string {
    const origen = this.getNodeById(transicion.nodoOrigenId);
    const destino = this.getNodeById(transicion.nodoDestinoId);
    if (!origen || !destino) return '';

    const startX = origen.posicionX + this.nodeWidth;
    const startY = origen.posicionY + this.nodeHeight / 2;
    const endX = destino.posicionX;
    const endY = destino.posicionY + this.nodeHeight / 2;
    const curve = Math.max(40, Math.abs(endX - startX) * 0.35);
    return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
  }

  getTransitionLabelX(transicion: Transicion): number {
    const origen = this.getNodeById(transicion.nodoOrigenId);
    const destino = this.getNodeById(transicion.nodoDestinoId);
    if (!origen || !destino) return 0;
    return (origen.posicionX + this.nodeWidth + destino.posicionX) / 2;
  }

  getTransitionLabelY(transicion: Transicion): number {
    const origen = this.getNodeById(transicion.nodoOrigenId);
    const destino = this.getNodeById(transicion.nodoDestinoId);
    if (!origen || !destino) return 0;
    return ((origen.posicionY + this.nodeHeight / 2) + (destino.posicionY + this.nodeHeight / 2)) / 2 - 8;
  }

  limpiarSeleccion(): void {
    this.nodoSeleccionadoId = null;
    this.transicionSeleccionadaId = null;
  }

  private inferirTipoTransicion(tipoNodo: NodoTipo): TransicionTipo {
    if (tipoNodo === 'DECISION') return 'ALTERNATIVA';
    if (tipoNodo === 'PARALELO') return 'PARALELA';
    return 'LINEAL';
  }

  private etiquetaDefault(tipo: TransicionTipo): string {
    if (tipo === 'ALTERNATIVA') return 'Decision';
    if (tipo === 'PARALELA') return 'Paralelo';
    return 'Flujo';
  }

  private getLaneIndexByY(y: number): number {
    if (this.departamentosVisibles.length === 0) return 0;
    const idx = Math.floor(y / this.laneHeight);
    return this.clamp(idx, 0, this.departamentosVisibles.length - 1);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private nombrePorTipo(tipo: NodoTipo): string {
    if (tipo === 'INICIO') return 'Inicio';
    if (tipo === 'FIN') return 'Fin';
    if (tipo === 'DECISION') return 'Decision';
    if (tipo === 'PARALELO') return 'Paralelo';
    return 'Tarea';
  }

  private esTemporal(id: string): boolean {
    return id.startsWith('tmp_');
  }

  private tempId(prefix: string): string {
    return `tmp_${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`;
  }

  private mapNodoRequest(nodo: Nodo): CrearNodoRequest {
    return {
      politicaId: this.politicaId,
      nombre: nodo.nombre,
      tipo: nodo.tipo,
      departamentoId: nodo.departamentoId,
      posicionX: Math.round(nodo.posicionX),
      posicionY: Math.round(nodo.posicionY),
      formularioId: nodo.formularioId ?? null
    };
  }

  private mapTransicionRequest(transicion: Transicion): CrearTransicionRequest {
    return {
      politicaId: this.politicaId,
      nodoOrigenId: transicion.nodoOrigenId,
      nodoDestinoId: transicion.nodoDestinoId,
      tipo: transicion.tipo,
      etiqueta: transicion.etiqueta ?? null,
      condicion: transicion.condicion ?? null
    };
  }

  private nodoCambio(original: Nodo | undefined, actual: Nodo): boolean {
    if (!original) return true;
    return original.nombre !== actual.nombre
      || original.tipo !== actual.tipo
      || original.departamentoId !== actual.departamentoId
      || Math.round(original.posicionX) !== Math.round(actual.posicionX)
      || Math.round(original.posicionY) !== Math.round(actual.posicionY)
      || (original.formularioId ?? null) !== (actual.formularioId ?? null);
  }

  private transicionCambio(original: Transicion | undefined, actual: Transicion): boolean {
    if (!original) return true;
    return original.nodoOrigenId !== actual.nodoOrigenId
      || original.nodoDestinoId !== actual.nodoDestinoId
      || original.tipo !== actual.tipo
      || (original.etiqueta ?? null) !== (actual.etiqueta ?? null)
      || (original.condicion ?? null) !== (actual.condicion ?? null);
  }
}
