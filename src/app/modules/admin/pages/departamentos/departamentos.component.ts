import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DepartamentoService, Departamento, CrearDepartamentoRequest } from '../../../../core/services/departamento.service';
import { UsuarioService, Usuario } from '../../../../core/services/usuario.service';
import { ApiResponse } from '../../../../core/models/api-response.model';

@Component({
  selector: 'app-departamentos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './departamentos.component.html',
  styleUrls: ['./departamentos.component.scss']
})
export class DepartamentosComponent implements OnInit {
  departamentos: Departamento[] = [];
  usuarios: Usuario[] = [];
  form!: FormGroup;
  mostrarModal = false;
  editandoId: string | null = null;
  cargando = false;
  error: string | null = null;

  constructor(
    private deptoService: DepartamentoService,
    private usuarioService: UsuarioService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.inicializarForm();
    this.cargarDepartamentos();
    this.cargarUsuarios();
  }

  inicializarForm(): void {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: ['', [Validators.required, Validators.minLength(10)]],
      adminDepartamentoId: ['']
    });
  }

  cargarDepartamentos(): void {
    this.cargando = true;
    this.error = null;
    this.deptoService.listar().subscribe({
      next: (res: ApiResponse<Departamento[]>) => {
        this.departamentos = res.data ?? [];
        this.cargando = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message || 'Error al cargar departamentos';
        this.cargando = false;
      }
    });
  }

  cargarUsuarios(): void {
    this.usuarioService.listar().subscribe({
      next: (res: ApiResponse<Usuario[]>) => {
        // Filtrar solo ADMIN_DEPARTAMENTO disponibles
        this.usuarios = (res.data ?? []).filter((u: Usuario) =>
          u.rol === 'ADMIN_DEPARTAMENTO' && u.activo === true
        );
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message || 'Error al cargar usuarios';
      }
    });
  }

  abrirModal(depto?: Departamento): void {
    this.error = null;
    if (depto) {
      this.editandoId = depto.id;
      this.form.patchValue({
        nombre: depto.nombre,
        descripcion: depto.descripcion,
        adminDepartamentoId: depto.adminDepartamentoId
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
      this.error = 'Por favor completa los campos requeridos';
      return;
    }

    const request: CrearDepartamentoRequest = this.form.value;
    this.cargando = true;
    this.error = null;

    const operacion = this.editandoId
      ? this.deptoService.actualizar(this.editandoId, request)
      : this.deptoService.crear(request);

    operacion.subscribe({
      next: () => {
        this.cargarDepartamentos();
        this.cerrarModal();
        this.cargando = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message || 'Error al guardar departamento';
        this.cargando = false;
      }
    });
  }

  eliminar(id: string): void {
    if (confirm('¿Estás seguro de que deseas eliminar este departamento?')) {
      this.deptoService.eliminar(id).subscribe({
        next: () => {
          this.cargarDepartamentos();
        },
        error: (err: { error?: { message?: string } }) => {
          this.error = err?.error?.message || 'Error al eliminar departamento';
        }
      });
    }
  }

  getNombreAdmin(adminId: string): string {
    const admin = this.usuarios.find(u => u.id === adminId);
    return admin ? admin.nombre : 'No asignado';
  }
}
