import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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

  politicaId = '';
  politica: Politica | null = null;
  departamentos: Departamento[] = [];
  nodos: Nodo[] = [];
  transiciones: Transicion[] = [];
  cargando = false;
  error: string | null = null;

  nodoForm!: FormGroup;
  transicionForm!: FormGroup;

  tiposNodo: NodoTipo[] = ['INICIO', 'TAREA', 'DECISION', 'FIN', 'PARALELO'];
  tiposTransicion: TransicionTipo[] = ['LINEAL', 'ALTERNATIVA', 'PARALELA'];

  private draggingNodeId: string | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  constructor(
    private route: ActivatedRoute,
    private politicaService: PoliticaService,
    private departamentoService: DepartamentoService,
    private nodoService: NodoService,
    private transicionService: TransicionService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.politicaId = this.route.snapshot.paramMap.get('id') ?? '';
    this.nodoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      tipo: ['TAREA', Validators.required],
      departamentoId: ['', Validators.required]
    });
    this.transicionForm = this.fb.group({
      nodoOrigenId: ['', Validators.required],
      nodoDestinoId: ['', Validators.required],
      tipo: ['LINEAL', Validators.required],
      etiqueta: [''],
      condicion: ['']
    });
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
    this.politicaService.obtener(this.politicaId).subscribe({
      next: (res: ApiResponse<Politica>) => {
        this.politica = res.data;
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message ?? 'No se pudo cargar la politica';
      }
    });
    this.departamentoService.listar().subscribe({
      next: (res: ApiResponse<Departamento[]>) => this.departamentos = res.data ?? [],
      error: () => {}
    });
    this.refrescarDiagrama();
  }

  refrescarDiagrama(): void {
    this.nodoService.listarPorPolitica(this.politicaId).subscribe({
      next: (res: ApiResponse<Nodo[]>) => {
        this.nodos = res.data ?? [];
        this.cargando = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message ?? 'Error al cargar nodos';
        this.cargando = false;
      }
    });
    this.transicionService.listarPorPolitica(this.politicaId).subscribe({
      next: (res: ApiResponse<Transicion[]>) => this.transiciones = res.data ?? [],
      error: () => {}
    });
  }

  crearNodo(): void {
    if (this.nodoForm.invalid) {
      return;
    }
    const laneIndex = this.departamentos.findIndex(d => d.id === this.nodoForm.value.departamentoId);
    const request: CrearNodoRequest = {
      politicaId: this.politicaId,
      nombre: this.nodoForm.value.nombre,
      tipo: this.nodoForm.value.tipo,
      departamentoId: this.nodoForm.value.departamentoId,
      posicionX: 80 + (this.nodos.length * 40),
      posicionY: 60 + Math.max(laneIndex, 0) * 180,
      formularioId: null
    };
    this.nodoService.crear(request).subscribe({
      next: () => {
        this.nodoForm.patchValue({ nombre: '' });
        this.refrescarDiagrama();
      },
      error: (err: { error?: { message?: string } }) => this.error = err?.error?.message ?? 'No se pudo crear el nodo'
    });
  }

  crearTransicion(): void {
    if (this.transicionForm.invalid) return;
    const request: CrearTransicionRequest = {
      politicaId: this.politicaId,
      nodoOrigenId: this.transicionForm.value.nodoOrigenId,
      nodoDestinoId: this.transicionForm.value.nodoDestinoId,
      tipo: this.transicionForm.value.tipo,
      etiqueta: this.transicionForm.value.etiqueta || null,
      condicion: this.transicionForm.value.condicion || null
    };
    this.transicionService.crear(request).subscribe({
      next: () => this.refrescarDiagrama(),
      error: (err: { error?: { message?: string } }) => this.error = err?.error?.message ?? 'No se pudo crear la transicion'
    });
  }

  eliminarNodo(id: string): void {
    this.nodoService.eliminar(id).subscribe({
      next: () => this.refrescarDiagrama(),
      error: (err: { error?: { message?: string } }) => this.error = err?.error?.message ?? 'No se pudo eliminar el nodo'
    });
  }

  eliminarTransicion(id: string): void {
    this.transicionService.eliminar(id).subscribe({
      next: () => this.refrescarDiagrama(),
      error: (err: { error?: { message?: string } }) => this.error = err?.error?.message ?? 'No se pudo eliminar la transicion'
    });
  }

  iniciarDrag(event: MouseEvent, nodo: Nodo): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.draggingNodeId = nodo.id;
    this.dragOffsetX = event.clientX - rect.left;
    this.dragOffsetY = event.clientY - rect.top;
  }

  onMouseMove = (event: MouseEvent): void => {
    if (!this.draggingNodeId || !this.canvasRef) return;
    const canvasRect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = Math.max(0, event.clientX - canvasRect.left - this.dragOffsetX);
    const y = Math.max(0, event.clientY - canvasRect.top - this.dragOffsetY);
    this.nodos = this.nodos.map(n => n.id === this.draggingNodeId ? { ...n, posicionX: x, posicionY: y } : n);
  };

  onMouseUp = (): void => {
    if (!this.draggingNodeId) return;
    const nodo = this.nodos.find(n => n.id === this.draggingNodeId);
    this.draggingNodeId = null;
    if (!nodo) return;
    this.nodoService.actualizarPosicion(nodo.id, nodo.posicionX, nodo.posicionY).subscribe({
      error: () => {}
    });
  };

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
}
