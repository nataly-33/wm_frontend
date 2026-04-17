import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { EjecucionService, EjecucionNodo } from '../../../../core/services/ejecucion.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-tareas',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tareas.component.html',
  styleUrls: ['./tareas.component.scss']
})
export class TareasComponent implements OnInit {
  tareas: EjecucionNodo[] = [];
  cargando = false;
  error: string | null = null;

  constructor(
    private ejecucionService: EjecucionService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarTareas();
  }

  cargarTareas(): void {
    const user = this.authService.getCurrentUser();
    if (!user || (!user.departamentoId && user.rol !== 'ADMIN_DEPARTAMENTO' && user.rol !== 'FUNCIONARIO')) {
      return;
    }
    
    // Suponemos que todos en el departamento ven las tareas del departamento, o el backend ya filtro.
    this.cargando = true;
    this.ejecucionService.listarPorDepartamento(user.departamentoId || '').pipe(
      timeout(15000),
      finalize(() => this.cargando = false)
    ).subscribe({
      next: (res) => {
        this.tareas = res.data ?? [];
      },
      error: (err) => {
        this.error = 'Error al cargar tareas';
      }
    });
  }
}
