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
    if (!user?.id) {
      return;
    }

    this.cargando = true;
    this.ejecucionService.listarPorFuncionario(user.id).pipe(
      timeout(15000),
      finalize(() => this.cargando = false)
    ).subscribe({
      next: (res) => {
        this.tareas = res.data ?? [];
      },
      error: () => {
        this.error = 'Error al cargar tareas';
      }
    });
  }
}
