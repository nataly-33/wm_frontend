import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize, timeout } from 'rxjs';
import { environment } from '../../../../../../environments/environment';

interface EjecucionItem {
  id: string;
  nodoNombre?: string;
  nodoTipo?: string;
  departamentoNombre?: string;
  funcionarioNombre?: string;
  estado: string;
  iniciadoEn?: string;
  completadoEn?: string;
  observaciones?: string;
}

interface TramiteResumen {
  id: string;
  titulo: string;
  estadoGeneral: string;
  prioridad: string;
  nombrePolitica?: string;
  iniciadoPorNombre?: string;
  iniciadoEn?: string;
  finalizadoEn?: string;
  duracionTotal?: string;
}

@Component({
  selector: 'app-tramite-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tramite-detalle.component.html',
  styleUrls: ['./tramite-detalle.component.scss']
})
export class TramiteDetalleComponent implements OnInit {
  tramite: TramiteResumen | null = null;
  historial: EjecucionItem[] = [];
  cargando = false;
  error: string | null = null;

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.cargar(id);
  }

  cargar(id: string): void {
    this.cargando = true;
    this.http
      .get<{ data: { tramite: TramiteResumen; historial: EjecucionItem[] } }>(
        `${environment.apiUrl}/api/v1/tramites/${id}`
      )
      .pipe(timeout(15000), finalize(() => (this.cargando = false)))
      .subscribe({
        next: (res) => {
          this.tramite = res.data?.tramite ?? null;
          this.historial = (res.data?.historial ?? []).slice().reverse();
        },
        error: () => {
          this.error = 'No se pudo cargar el detalle del tramite';
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
    if (!fecha) return '—';
    return new Date(fecha).toLocaleString('es-BO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
