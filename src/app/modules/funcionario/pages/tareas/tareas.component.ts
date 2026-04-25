import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, finalize, timeout, takeUntil } from 'rxjs';
import { EjecucionService, EjecucionDetallada } from '../../../../core/services/ejecucion.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NavbarComponent } from '../../../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-tareas',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent],
  templateUrl: './tareas.component.html',
  styleUrls: ['./tareas.component.scss']
})
export class TareasComponent implements OnInit, OnDestroy {
  tareas: EjecucionDetallada[] = [];
  cargando = false;
  error: string | null = null;
  userName = '';

  private destroy$ = new Subject<void>();

  constructor(
    private ejecucionService: EjecucionService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName = user.nombre;
    }
    this.cargarTareas();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarTareas(): void {
    const user = this.authService.getCurrentUser();
    if (!user?.id) {
      return;
    }

    this.cargando = true;
    this.error = null;
    this.ejecucionService.listarPorFuncionario(user.id).pipe(
      timeout(15000),
      takeUntil(this.destroy$),
      finalize(() => this.cargando = false)
    ).subscribe({
      next: (res) => {
        this.tareas = res.data ?? [];
      },
      error: () => {
        this.error = 'Error al cargar tareas. Intente nuevamente.';
      }
    });
  }

  getPrioridadClass(prioridad: string): string {
    switch (prioridad) {
      case 'ALTA': return 'chip-alta';
      case 'MEDIA': return 'chip-media';
      case 'BAJA': return 'chip-baja';
      default: return 'chip-media';
    }
  }

  getEstadoClass(estado: string): string {
    return estado === 'EN_PROCESO' ? 'estado-en-proceso' : 'estado-pendiente';
  }

  formatFecha(fecha: string | undefined): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
