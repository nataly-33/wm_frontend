import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { filter, finalize, take, timeout } from 'rxjs';
import { DepartamentoService, Departamento, CrearDepartamentoRequest } from '../../../../core/services/departamento.service';
import { UsuarioService, Usuario } from '../../../../core/services/usuario.service';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';

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
  todosLosUsuarios: Usuario[] = [];
  form!: FormGroup;
  mostrarModal = false;
  editandoId: string | null = null;
  cargando = false;
  guardando = false;
  error: string | null = null;

  constructor(
    private deptoService: DepartamentoService,
    private usuarioService: UsuarioService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.inicializarForm();
    this.authService.getCurrentUser$().pipe(
      filter((user): user is NonNullable<typeof user> => !!user && !!user.empresaId),
      take(1)
    ).subscribe(() => {
      this.cargarDepartamentos();
      this.cargarUsuarios();
    });
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
    this.deptoService.listar().pipe(
      timeout(15000),
      finalize(() => this.cargando = false)
    ).subscribe({
      next: (res: ApiResponse<Departamento[]>) => {
        this.departamentos = res.data ?? [];
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message || 'Error al cargar departamentos';
      }
    });
  }

  cargarUsuarios(): void {
    this.usuarioService.listar().subscribe({
      next: (res: ApiResponse<Usuario[]>) => {
        this.todosLosUsuarios = res.data ?? [];
        // Filtrar solo ADMIN_DEPARTAMENTO disponibles
        this.usuarios = this.todosLosUsuarios.filter((u: Usuario) =>
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

    const request: CrearDepartamentoRequest = { ...this.form.value };
    if (!request.adminDepartamentoId || request.adminDepartamentoId.trim() === '') {
      // Si esta vacio, lo mandamos como undefined para que evite validar strings vacios como id
      delete (request as any).adminDepartamentoId;
    }
    
    this.guardando = true;
    this.error = null;

    const operacion = this.editandoId
      ? this.deptoService.actualizar(this.editandoId, request)
      : this.deptoService.crear(request);

    operacion.subscribe({
      next: () => {
        this.cargarDepartamentos();
        this.cerrarModal();
        this.guardando = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message || 'Error al guardar departamento';
        this.guardando = false;
      }
    });
  }

  eliminar(id: string): void {
    // Validar front si tiene usuarios asignados
    const tieneUsuarios = this.todosLosUsuarios.some(u => u.departamentoId === id);
    if (tieneUsuarios) {
      this.error = 'No se puede eliminar, tiene usuarios asignados';
      return;
    }

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
