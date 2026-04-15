import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuarioService, Usuario, CrearUsuarioRequest } from '../../../../core/services/usuario.service';
import { DepartamentoService, Departamento } from '../../../../core/services/departamento.service';
import { ApiResponse } from '../../../../core/models/api-response.model';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.scss']
})
export class UsuariosComponent implements OnInit {
  usuarios: Usuario[] = [];
  departamentos: Departamento[] = [];
  form!: FormGroup;
  mostrarModal = false;
  editandoId: string | null = null;
  cargando = false;
  guardando = false;
  error: string | null = null;
  esNuevo = true;

  rolesDisponibles = [
    { id: 'ADMIN_DEPARTAMENTO', nombre: 'Admin del Departamento' },
    { id: 'FUNCIONARIO', nombre: 'Funcionario' }
  ];

  constructor(
    private usuarioService: UsuarioService,
    private deptoService: DepartamentoService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.inicializarForm();
    this.cargarUsuarios();
    this.cargarDepartamentos();
  }

  inicializarForm(): void {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rol: ['', Validators.required],
      departamentoId: [null]
    });
  }

  cargarUsuarios(): void {
    this.cargando = true;
    this.error = null;
    this.usuarioService.listar().subscribe({
      next: (res: ApiResponse<Usuario[]>) => {
        this.usuarios = res.data ?? [];
        this.cargando = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message || 'Error al cargar usuarios';
        this.cargando = false;
      }
    });
  }

  cargarDepartamentos(): void {
    this.deptoService.listar().subscribe({
      next: (res: ApiResponse<Departamento[]>) => {
        this.departamentos = res.data ?? [];
      },
      error: () => {
        // Error silencioso para no bloquear la pantalla de usuarios.
      }
    });
  }

  abrirModal(usuario?: Usuario): void {
    this.error = null;
    if (usuario) {
      this.editandoId = usuario.id;
      this.esNuevo = false;
      this.form.patchValue({
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        departamentoId: usuario.departamentoId
      });
      // Al editar, no requerimos password
      this.form.get('password')?.clearValidators();
      this.form.get('password')?.updateValueAndValidity();
    } else {
      this.editandoId = null;
      this.esNuevo = true;
      this.form.reset();
      this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.form.get('password')?.updateValueAndValidity();
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

    const rol = this.form.get('rol')?.value;
    const deptoId = this.form.get('departamentoId')?.value;

    // Validar que si es FUNCIONARIO, tiene departamento
    if (rol === 'FUNCIONARIO' && !deptoId) {
      this.error = 'Departamento requerido para Funcionario';
      return;
    }

    const request: CrearUsuarioRequest = {
      nombre: this.form.get('nombre')?.value,
      email: this.form.get('email')?.value,
      password: this.form.get('password')?.value,
      rol: rol,
      departamentoId: deptoId
    };

    this.guardando = true;
    this.error = null;

    const requestActualizacion: CrearUsuarioRequest = this.esNuevo
      ? request
      : { ...request, password: '' };

    const operacion = this.editandoId
      ? this.usuarioService.actualizar(this.editandoId, requestActualizacion)
      : this.usuarioService.crear(request);

    operacion.subscribe({
      next: () => {
        this.cargarUsuarios();
        this.cerrarModal();
        this.guardando = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message || 'Error al guardar usuario';
        this.guardando = false;
      }
    });
  }

  eliminar(id: string): void {
    if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      this.usuarioService.eliminar(id).subscribe({
        next: () => {
          this.cargarUsuarios();
        },
        error: (err: { error?: { message?: string } }) => {
          this.error = err?.error?.message || 'Error al eliminar usuario';
        }
      });
    }
  }

  getNombreRol(rol: string): string {
    const rolObj = this.rolesDisponibles.find(r => r.id === rol);
    return rolObj ? rolObj.nombre : rol;
  }

  getNombreDepartamento(deptoId: string): string {
    if (!deptoId) return '-';
    const depto = this.departamentos.find(d => d.id === deptoId);
    return depto ? depto.nombre : '-';
  }

  onRolChange(): void {
    const rol = this.form.get('rol')?.value;
    const deptoControl = this.form.get('departamentoId');
    
    if (rol === 'ADMIN_DEPARTAMENTO' || rol === 'FUNCIONARIO') {
      deptoControl?.setValidators([Validators.required]);
    } else {
      deptoControl?.clearValidators();
      deptoControl?.setValue(null);
    }
    deptoControl?.updateValueAndValidity();
  }

  getIniciales(nombre: string): string {
    if (!nombre) return 'U';
    const parts = nombre.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return nombre.substring(0, 2).toUpperCase();
  }

  getRolClass(rol: string): string {
    if (rol === 'ADMIN_DEPARTAMENTO') return 'role-admin';
    if (rol === 'FUNCIONARIO') return 'role-func';
    return '';
  }
}
