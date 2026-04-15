import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormularioService } from '../../../../core/services/formulario.service';
import { Nodo, NodoService } from '../../../../core/services/nodo.service';
import { Politica, PoliticaService } from '../../../../core/services/politica.service';

@Component({
  selector: 'app-formularios-admin-depto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './formularios.component.html',
  styleUrls: ['./formularios.component.scss']
})
export class FormulariosComponent implements OnInit {
  politicas: Politica[] = [];
  nodos: Nodo[] = [];
  politicaId = '';
  nodoId = '';
  formularioId: string | null = null;
  error: string | null = null;
  guardando = false;

  form!: FormGroup;

  constructor(
    private politicaService: PoliticaService,
    private nodoService: NodoService,
    private formularioService: FormularioService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      campos: this.fb.array([])
    });
    this.agregarCampo();
    this.politicaService.listar().subscribe({
      next: res => this.politicas = res.data ?? [],
      error: () => this.error = 'No se pudieron cargar politicas'
    });
  }

  get campos(): FormArray {
    return this.form.get('campos') as FormArray;
  }

  agregarCampo(): void {
    this.campos.push(this.fb.group({
      nombre: ['', Validators.required],
      etiqueta: ['', Validators.required],
      tipo: ['TEXTO', Validators.required],
      requerido: [true],
      esCampoPrioridad: [false],
      opcionesRaw: ['']
    }));
  }

  quitarCampo(index: number): void {
    if (this.campos.length <= 1) return;
    this.campos.removeAt(index);
  }

  cargarNodos(): void {
    if (!this.politicaId) return;
    this.nodoService.listarPorPolitica(this.politicaId).subscribe({
      next: res => this.nodos = (res.data ?? []).filter(n => n.tipo === 'TAREA' || n.tipo === 'DECISION'),
      error: () => this.error = 'No se pudieron cargar nodos'
    });
  }

  onPoliticaChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.politicaId = value;
    this.nodoId = '';
    this.formularioId = null;
    this.cargarNodos();
  }

  onNodoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.nodoId = value;
    this.cargarFormulario();
  }

  cargarFormulario(): void {
    if (!this.nodoId) return;
    this.formularioService.obtenerPorNodo(this.nodoId).subscribe({
      next: res => {
        const data = res.data;
        if (!data) return;
        this.formularioId = data.id;
        this.form.patchValue({ nombre: data.nombre });
        this.campos.clear();
        data.campos.forEach(c => {
          this.campos.push(this.fb.group({
            nombre: [c.nombre, Validators.required],
            etiqueta: [c.etiqueta, Validators.required],
            tipo: [c.tipo, Validators.required],
            requerido: [c.requerido],
            esCampoPrioridad: [c.esCampoPrioridad],
            opcionesRaw: [(c.opciones ?? []).join(',')]
          }));
        });
      },
      error: () => {
        this.formularioId = null;
        this.form.patchValue({ nombre: '' });
        this.campos.clear();
        this.agregarCampo();
      }
    });
  }

  guardar(): void {
    if (this.form.invalid || !this.politicaId || !this.nodoId) {
      this.error = 'Selecciona politica/nodo y completa el formulario';
      return;
    }
    this.guardando = true;
    const request = {
      politicaId: this.politicaId,
      nodoId: this.nodoId,
      nombre: this.form.value.nombre,
      generadoPorIa: false,
      campos: this.campos.controls.map(ctrl => ({
        nombre: ctrl.value.nombre,
        etiqueta: ctrl.value.etiqueta,
        tipo: ctrl.value.tipo,
        requerido: !!ctrl.value.requerido,
        esCampoPrioridad: !!ctrl.value.esCampoPrioridad,
        opciones: (ctrl.value.opcionesRaw ?? '')
          .split(',')
          .map((v: string) => v.trim())
          .filter((v: string) => v.length > 0)
      }))
    };
    const op = this.formularioId
      ? this.formularioService.actualizar(this.formularioId, request)
      : this.formularioService.crear(request);
    op.subscribe({
      next: res => {
        this.guardando = false;
        this.formularioId = res.data?.id ?? this.formularioId;
      },
      error: err => {
        this.guardando = false;
        this.error = err?.error?.message ?? 'No se pudo guardar';
      }
    });
  }
}
