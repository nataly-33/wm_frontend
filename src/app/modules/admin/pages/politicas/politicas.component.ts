import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { CrearPoliticaRequest, Politica, PoliticaService, VersionHistorial } from '../../../../core/services/politica.service';
import { TramiteService } from '../../../../core/services/tramite.service';
import { Usuario, UsuarioService } from '../../../../core/services/usuario.service';

@Component({
  selector: 'app-politicas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './politicas.component.html',
  styleUrls: ['./politicas.component.scss']
})
export class PoliticasComponent implements OnInit {
  politicas: Politica[] = [];
  form!: FormGroup;
  formTramite!: FormGroup;
  cargando = false;
  guardando = false;
  error: string | null = null;
  mostrarModal = false;
  mostrarModalTramite = false;
  editandoId: string | null = null;
  politicaSeleccionada: Politica | null = null;
  clientes: Usuario[] = [];

  // Historial de versiones
  mostrarHistorial = false;
  historial: VersionHistorial[] = [];
  cargandoHistorial = false;
  politicaHistorial: Politica | null = null;

  readonly ACCION_ICONS: Record<string, string> = {
    CREAR:      '✦',
    DIAGRAMA:   '⬡',
    EDITAR:     '✎',
    ACTIVAR:    '▶',
    DESACTIVAR: '■'
  };

  readonly ACCION_LABEL: Record<string, string> = {
    CREAR:      'Creación',
    DIAGRAMA:   'Diagrama guardado',
    EDITAR:     'Edición de datos',
    ACTIVAR:    'Política activada',
    DESACTIVAR: 'Política desactivada'
  };

  constructor(
    private politicaService: PoliticaService,
    private tramiteService: TramiteService,
    private usuarioService: UsuarioService,
    private fb: FormBuilder,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: ['', [Validators.required, Validators.minLength(10)]]
    });
    this.formTramite = this.fb.group({
      titulo: ['', [Validators.required, Validators.minLength(5)]],
      clienteId: ['', Validators.required],
      prioridad: ['MEDIA', Validators.required],
      fechaLimite: ['', Validators.required]
    });
    this.cargar();
    this.usuarioService.listarPorRol('CLIENTE').subscribe({
      next: (res) => { this.clientes = res.data ?? []; },
      error: () => { this.clientes = []; }
    });
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.politicaService.listar().pipe(
      timeout(15000),
      finalize(() => this.cargando = false)
    ).subscribe({
      next: (res: ApiResponse<Politica[]>) => {
        this.politicas = res.data ?? [];
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message ?? 'Error al cargar politicas';
      }
    });
  }

  abrirModal(politica?: Politica): void {
    this.error = null;
    if (politica) {
      this.editandoId = politica.id;
      this.form.patchValue({ nombre: politica.nombre, descripcion: politica.descripcion });
      this.mostrarModal = true;
    } else {
      this.router.navigate(['/admin/politicas/nueva']);
    }
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.editandoId = null;
    this.form.reset();
    this.error = null;
  }

  guardar(): void {
    if (this.form.invalid) {
      this.error = 'Completa los campos requeridos';
      return;
    }
    this.guardando = true;
    const request: CrearPoliticaRequest = this.form.value;
    const op = this.editandoId
      ? this.politicaService.actualizar(this.editandoId, request)
      : this.politicaService.crear(request);

    op.subscribe({
      next: () => {
        this.guardando = false;
        this.cerrarModal();
        this.cargar();
      },
      error: (err: { error?: { message?: string } }) => {
        this.guardando = false;
        this.error = err?.error?.message ?? 'Error al guardar politica';
      }
    });
  }

  cambiarEstado(politica: Politica): void {
    const op = politica.estado === 'ACTIVA'
      ? this.politicaService.desactivar(politica.id)
      : this.politicaService.activar(politica.id);
    op.subscribe({
      next: () => this.cargar(),
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message ?? 'No se pudo cambiar el estado';
      }
    });
  }

  eliminar(politicaId: string): void {
    if (!confirm('Se eliminara la politica. Deseas continuar?')) return;
    this.politicaService.eliminar(politicaId).subscribe({
      next: () => this.cargar(),
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message ?? 'No se pudo eliminar';
      }
    });
  }

  irEditor(politicaId: string): void {
    this.router.navigate(['/admin/politicas', politicaId, 'editor']);
  }

  getEstadoClass(estado: string): string {
    if (estado === 'ACTIVA') return 'badge badge--success';
    if (estado === 'INACTIVA') return 'badge badge--warning';
    return 'badge badge--info';
  }

  // ── Historial de versiones ────────────────────────────────────────
  verHistorial(politica: Politica): void {
    this.politicaHistorial = politica;
    this.historial = [];
    this.mostrarHistorial = true;
    this.cargandoHistorial = true;
    this.politicaService.obtenerHistorial(politica.id)
      .pipe(finalize(() => this.cargandoHistorial = false))
      .subscribe({
        next: (res) => { this.historial = res.data ?? []; },
        error: () => { this.historial = []; }
      });
  }

  cerrarHistorial(): void {
    this.mostrarHistorial = false;
    this.politicaHistorial = null;
    this.historial = [];
  }

  getAccionClass(accion: string): string {
    const m: Record<string, string> = {
      CREAR: 'accion-crear', DIAGRAMA: 'accion-diagrama',
      EDITAR: 'accion-editar', ACTIVAR: 'accion-activar', DESACTIVAR: 'accion-desactivar'
    };
    return m[accion] ?? '';
  }

  // ── Trámites ─────────────────────────────────────────────────────
  abrirModalTramite(politica: Politica): void {
    this.error = null;
    this.politicaSeleccionada = politica;
    this.formTramite.reset({ prioridad: 'MEDIA' });
    this.mostrarModalTramite = true;
  }

  cerrarModalTramite(): void {
    this.mostrarModalTramite = false;
    this.politicaSeleccionada = null;
    this.formTramite.reset({ prioridad: 'MEDIA' });
  }

  iniciarTramite(): void {
    if (this.formTramite.invalid || !this.politicaSeleccionada) {
      this.formTramite.markAllAsTouched();
      this.error = 'Completa los campos requeridos';
      return;
    }
    this.guardando = true;
    const body = {
      politicaId: this.politicaSeleccionada.id,
      clienteId: this.formTramite.value.clienteId,
      titulo: this.formTramite.value.titulo,
      prioridad: this.formTramite.value.prioridad,
      fechaLimite: this.formTramite.value.fechaLimite
    };
    this.tramiteService.iniciar(body).subscribe({
      next: () => {
        this.guardando = false;
        this.cerrarModalTramite();
        this.error = null;
      },
      error: (err: { error?: { message?: string } }) => {
        this.guardando = false;
        this.error = err?.error?.message ?? 'Error al iniciar tramite';
      }
    });
  }
}
