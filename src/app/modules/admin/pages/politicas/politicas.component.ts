import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { CrearPoliticaRequest, Politica, PoliticaService } from '../../../../core/services/politica.service';

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
  cargando = false;
  guardando = false;
  error: string | null = null;
  mostrarModal = false;
  editandoId: string | null = null;

  constructor(
    private politicaService: PoliticaService,
    private fb: FormBuilder,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: ['', [Validators.required, Validators.minLength(10)]]
    });
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.politicaService.listar().subscribe({
      next: (res: ApiResponse<Politica[]>) => {
        this.politicas = res.data ?? [];
        this.cargando = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message ?? 'Error al cargar politicas';
        this.cargando = false;
      }
    });
  }

  abrirModal(politica?: Politica): void {
    this.error = null;
    if (politica) {
      this.editandoId = politica.id;
      this.form.patchValue({
        nombre: politica.nombre,
        descripcion: politica.descripcion
      });
    } else {
      this.editandoId = null;
      this.form.reset();
    }
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.form.reset();
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
    if (!confirm('Se eliminara la politica. Deseas continuar?')) {
      return;
    }
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
}
