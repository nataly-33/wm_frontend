import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TramiteService, TramiteDetallado } from '../../../core/services/tramite.service';

@Component({
  selector: 'app-mis-tramites-cliente',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink],
  templateUrl: './mis-tramites.component.html',
  styleUrls: ['./mis-tramites.component.scss']
})
export class MisTramitesComponent implements OnInit {
  tramites: TramiteDetallado[] = [];
  cargando = false;
  error: string | null = null;
  clienteId = '';
  empresaId = '';

  constructor(
    private authService: AuthService,
    private tramiteService: TramiteService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.clienteId = user.id ?? '';
      this.empresaId = user.empresaId ?? '';
    }
    if (this.empresaId) {
      this.cargar();
    } else {
      this.error = 'No se encontró la empresa del usuario actual';
    }
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.tramiteService
      .listarPorCliente(this.clienteId)
      .pipe(
        timeout(15000),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (res) => {
          this.tramites = res.data ?? [];
        },
        error: (err) => {
          this.error = err?.error?.message ?? 'No se pudieron cargar tus trámites';
        }
      });
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'EN_PROCESO': return 'estado-proceso';
      case 'COMPLETADO': return 'estado-completado';
      case 'RECHAZADO': return 'estado-rechazado';
      default: return 'estado-proceso';
    }
  }

  getEstadoLabel(estado: string): string {
    switch (estado) {
      case 'EN_PROCESO': return 'En proceso';
      case 'COMPLETADO': return 'Completado';
      case 'RECHAZADO': return 'Rechazado';
      default: return estado;
    }
  }

  getPrioridadClass(prioridad: string): string {
    switch (prioridad) {
      case 'ALTA': return 'prio-alta';
      case 'MEDIA': return 'prio-media';
      case 'BAJA': return 'prio-baja';
      default: return 'prio-media';
    }
  }

  formatFecha(fecha: Date | string | undefined): string {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
