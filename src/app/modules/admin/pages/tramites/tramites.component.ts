import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { TramiteDetallado, TramiteService } from '../../../../core/services/tramite.service';

@Component({
  selector: 'app-tramites-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tramites.component.html',
  styleUrls: ['./tramites.component.scss']
})
export class TramitesComponent implements OnInit {
  tramites: TramiteDetallado[] = [];
  cargando = false;
  error: string | null = null;

  constructor(private authService: AuthService, private tramiteService: TramiteService) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user?.empresaId) {
      this.error = 'No se encontró empresa para el usuario actual';
      return;
    }
    this.cargar(user.empresaId);
  }

  cargar(empresaId: string): void {
    this.cargando = true;
    this.tramiteService
      .listarPorEmpresaDetallado(empresaId)
      .pipe(timeout(15000), finalize(() => (this.cargando = false)))
      .subscribe({
        next: (res) => {
          this.tramites = res.data ?? [];
        },
        error: (err) => {
          this.error = err?.error?.message ?? 'No se pudieron cargar los trámites';
        }
      });
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'EN_PROCESO':  return 'badge-en-proceso';
      case 'PENDIENTE':   return 'badge-pendiente';
      case 'COMPLETADO':  return 'badge-completado';
      case 'RECHAZADO':   return 'badge-rechazado';
      case 'BLOQUEADO':   return 'badge-bloqueado';
      default:            return 'badge-pendiente';
    }
  }

  getPrioridadClass(prioridad: string): string {
    switch (prioridad) {
      case 'ALTA':  return 'badge-alta';
      case 'MEDIA': return 'badge-media';
      case 'BAJA':  return 'badge-baja';
      default:      return 'badge-media';
    }
  }

  formatFecha(fecha: string | undefined): string {
    if (!fecha) return '';
    return new Date(fecha).toLocaleString('es-BO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatFechaSolo(fecha: string | undefined): string {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-BO', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  estaVencido(fechaLimite: string | undefined): boolean {
    if (!fechaLimite) return false;
    return new Date(fechaLimite) < new Date();
  }
}
