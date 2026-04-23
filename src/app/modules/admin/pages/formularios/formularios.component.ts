import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, timeout } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import {
  CrearFormularioRequest,
  Formulario,
  FormularioDepartamentoItem,
  FormularioEmpresaGrupo,
  FormularioService,
  FormulariosAgrupadosPorPolitica
} from '../../../../core/services/formulario.service';
import { Nodo, NodoService } from '../../../../core/services/nodo.service';
import { Politica, PoliticaService } from '../../../../core/services/politica.service';

@Component({
  selector: 'app-formularios-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './formularios.component.html',
  styleUrls: ['./formularios.component.scss']
})
export class FormulariosComponent implements OnInit {
  grupos: FormularioEmpresaGrupo[] = [];
  gruposVista: FormulariosAgrupadosPorPolitica[] = [];

  politicasActivas: Politica[] = [];
  nodosPoliticaSeleccionada: Nodo[] = [];

  cargando = false;
  error: string | null = null;
  guardando = false;
  eliminando = false;

  mostrarModal = false;
  modo: 'crear' | 'editar' = 'crear';

  empresaId = '';
  formularioActual: Formulario | null = null;

  form!: FormGroup;

  constructor(
    private authService: AuthService,
    private formularioService: FormularioService,
    private politicaService: PoliticaService,
    private nodoService: NodoService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      politicaId: ['', Validators.required],
      nodoId: ['', Validators.required],
      nombre: ['', Validators.required],
      campos: this.fb.array([])
    });
    this.agregarCampo();

    const user = this.authService.getCurrentUser();
    if (!user?.empresaId) {
      this.error = 'No se encontró empresa para el usuario actual';
      return;
    }

    this.empresaId = user.empresaId;
    this.cargarCatalogos();
    this.cargarFormularios();
  }

  get campos(): FormArray {
    return this.form.get('campos') as FormArray;
  }

  agregarCampo(): void {
    this.campos.push(
      this.fb.group({
        nombre: ['', Validators.required],
        etiqueta: ['', Validators.required],
        tipo: ['TEXTO', Validators.required],
        requerido: [true],
        esCampoPrioridad: [false],
        opcionesRaw: ['']
      })
    );
  }

  quitarCampo(index: number): void {
    if (this.campos.length <= 1) {
      return;
    }
    this.campos.removeAt(index);
  }

  abrirModalCrear(politicaId?: string): void {
    this.modo = 'crear';
    this.formularioActual = null;
    this.mostrarModal = true;
    this.resetFormulario();

    if (politicaId) {
      this.form.patchValue({ politicaId });
      this.onPoliticaChange();
    }
  }

  abrirModalEditar(item: FormularioDepartamentoItem): void {
    if (!item.formulario) {
      this.error = 'El nodo no tiene formulario para editar';
      return;
    }

    this.modo = 'editar';
    this.formularioActual = item.formulario;
    this.mostrarModal = true;

    this.form.patchValue({
      politicaId: item.politicaId,
      nodoId: item.nodoId,
      nombre: item.formulario.nombre
    });

    this.onPoliticaChange(item.nodoId);

    this.campos.clear();
    item.formulario.campos.forEach((c) => {
      this.campos.push(
        this.fb.group({
          nombre: [c.nombre, Validators.required],
          etiqueta: [c.etiqueta, Validators.required],
          tipo: [c.tipo, Validators.required],
          requerido: [c.requerido],
          esCampoPrioridad: [c.esCampoPrioridad],
          opcionesRaw: [(c.opciones ?? []).join(',')]
        })
      );
    });
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.formularioActual = null;
    this.guardando = false;
    this.eliminando = false;
    this.error = null;
  }

  onPoliticaChange(nodoSeleccionado?: string): void {
    const politicaId = this.form.value.politicaId as string;
    if (!politicaId) {
      this.nodosPoliticaSeleccionada = [];
      this.form.patchValue({ nodoId: '' });
      return;
    }

    this.nodoService.listarPorPolitica(politicaId).subscribe({
      next: (res) => {
        this.nodosPoliticaSeleccionada = (res.data ?? []).filter(
          (n) => n.tipo === 'TAREA' || n.tipo === 'DECISION'
        );

        if (nodoSeleccionado) {
          this.form.patchValue({ nodoId: nodoSeleccionado });
        } else {
          this.form.patchValue({ nodoId: '' });
        }
      },
      error: () => {
        this.nodosPoliticaSeleccionada = [];
      }
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.error = 'Completa política, nodo y nombre del formulario';
      return;
    }

    this.guardando = true;
    this.error = null;

    const request: CrearFormularioRequest = {
      politicaId: this.form.value.politicaId,
      nodoId: this.form.value.nodoId,
      nombre: this.form.value.nombre,
      generadoPorIa: false,
      campos: this.campos.controls.map((ctrl) => ({
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

    const op = this.modo === 'editar' && this.formularioActual
      ? this.formularioService.actualizar(this.formularioActual.id, request)
      : this.formularioService.crear(request);

    op.subscribe({
      next: () => {
        this.guardando = false;
        this.cerrarModal();
        this.cargarFormularios();
      },
      error: (err) => {
        this.guardando = false;
        this.error = err?.error?.message ?? 'No se pudo guardar el formulario';
      }
    });
  }

  eliminarFormulario(item: FormularioDepartamentoItem): void {
    if (!item.formulario) {
      this.error = 'No existe formulario para eliminar';
      return;
    }

    this.eliminando = true;
    this.formularioService.eliminar(item.formulario.id).subscribe({
      next: () => {
        this.eliminando = false;
        this.cerrarModal();
        this.cargarFormularios();
      },
      error: (err) => {
        this.eliminando = false;
        this.error = err?.error?.message ?? 'No se pudo eliminar el formulario';
      }
    });
  }

  private cargarCatalogos(): void {
    this.politicaService.listar().subscribe({
      next: (res) => {
        this.politicasActivas = (res.data ?? []).filter((p) => p.estado === 'ACTIVA');
      }
    });
  }

  private cargarFormularios(): void {
    this.cargando = true;
    this.formularioService
      .listarPorEmpresa(this.empresaId)
      .pipe(
        timeout(15000),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (res) => {
          this.grupos = res.data ?? [];
          this.gruposVista = this.mapearGruposVista(this.grupos);
        },
        error: (err) => {
          this.error = err?.error?.message ?? 'No se pudieron cargar los formularios';
        }
      });
  }

  private mapearGruposVista(grupos: FormularioEmpresaGrupo[]): FormulariosAgrupadosPorPolitica[] {
    return grupos.map((g) => ({
      politicaId: g.politicaId,
      politicaNombre: g.politicaNombre,
      formularios: g.formularios.map((f) => ({
        nodoId: f.nodoId,
        nodoNombre: f.nodoNombre,
        politicaId: g.politicaId,
        politicaNombre: g.politicaNombre,
        formulario: f.formulario
      }))
    }));
  }

  private resetFormulario(): void {
    this.form.patchValue({
      politicaId: '',
      nodoId: '',
      nombre: ''
    });
    this.nodosPoliticaSeleccionada = [];
    this.campos.clear();
    this.agregarCampo();
  }
}
