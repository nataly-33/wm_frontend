import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, finalize, timeout } from 'rxjs';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { Politica, PoliticaService } from '../../../../core/services/politica.service';
import { SocketService } from '../../../../core/services/socket.service';
import {
  MonitorNodoEstado,
  MonitorPoliticaResponse,
  TramiteService
} from '../../../../core/services/tramite.service';

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './monitor.component.html',
  styleUrls: ['./monitor.component.scss']
})
export class MonitorComponent implements OnInit, OnDestroy {
  politicas: Politica[] = [];
  politicaSeleccionadaId = '';

  monitor: MonitorPoliticaResponse | null = null;
  cargando = false;
  error: string | null = null;
  eventosRecientes: any[] = [];

  private monitorSubscription?: Subscription;

  readonly colorHex: Record<string, string> = {
    VERDE: '#6bd968',
    AMARILLO: '#fecc1b',
    ROJO: '#f44250',
    NARANJA: '#ff9800',
    GRIS: '#9D9D60'
  };

  constructor(
    private politicaService: PoliticaService,
    private tramiteService: TramiteService,
    private socketService: SocketService
  ) {}

  ngOnInit(): void {
    this.cargarPoliticas();
  }

  ngOnDestroy(): void {
    this.monitorSubscription?.unsubscribe();
  }

  onPoliticaChange(event: Event): void {
    this.politicaSeleccionadaId = (event.target as HTMLSelectElement).value;
    if (!this.politicaSeleccionadaId) {
      this.monitor = null;
      return;
    }
    this.cargarMonitor();
    this.suscribirEventos();
  }

  private cargarPoliticas(): void {
    this.cargando = true;
    this.politicaService
      .listar()
      .pipe(
        timeout(15000),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (res: ApiResponse<Politica[]>) => {
          this.politicas = (res.data ?? []).filter((p) => p.estado === 'ACTIVA');
          if (this.politicas.length > 0) {
            this.politicaSeleccionadaId = this.politicas[0].id;
            this.cargarMonitor();
            this.suscribirEventos();
          }
        },
        error: (err: { error?: { message?: string } }) => {
          this.error = err?.error?.message ?? 'No se pudieron cargar políticas activas';
        }
      });
  }

  cargarMonitor(): void {
    if (!this.politicaSeleccionadaId) {
      return;
    }

    this.cargando = true;
    this.tramiteService
      .obtenerMonitor(this.politicaSeleccionadaId)
      .pipe(
        timeout(15000),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (res) => {
          this.monitor = res.data ?? null;
        },
        error: (err) => {
          this.error = err?.error?.message ?? 'No se pudo cargar el estado del monitor';
        }
      });
  }

  private suscribirEventos(): void {
    if (!this.politicaSeleccionadaId) {
      return;
    }

    this.monitorSubscription?.unsubscribe();
    this.monitorSubscription = this.socketService
      .suscribirAMonitor(this.politicaSeleccionadaId)
      .subscribe((evento) => {
        this.eventosRecientes.unshift(evento);
        if (this.eventosRecientes.length > 8) {
          this.eventosRecientes.pop();
        }
        this.manejarEventoSocket(evento);
        this.cargarMonitor();
      });
  }

  private manejarEventoSocket(evento: any): void {
    if (!this.monitor) return;
    switch (evento.tipo) {
      case 'NODO_COMPLETADO':
        this.actualizarColorNodo(evento.nodoAnteriorId, 'VERDE');
        this.actualizarColorNodo(evento.nodoActualId, 'AMARILLO');
        break;
      case 'TRAMITE_COMPLETADO':
        this.monitor.tramitesCompletados = (this.monitor.tramitesCompletados || 0) + 1;
        break;
      case 'TRAMITE_RECHAZADO':
        this.actualizarColorNodo(evento.nodoActualId, 'ROJO');
        this.monitor.tramitesRechazados = (this.monitor.tramitesRechazados || 0) + 1;
        break;
      case 'TRAMITE_INICIADO':
        this.actualizarColorNodo(evento.nodoActualId, 'AMARILLO');
        break;
    }
  }

  private actualizarColorNodo(nodoId: string, color: MonitorNodoEstado['color']): void {
    if (!this.monitor || !nodoId) return;
    const nodo = this.monitor.nodos.find(n => n.nodoId === nodoId);
    if (nodo) {
      nodo.color = color;
    }
  }

  get nodosAgrupados(): { departamento: string; nodos: MonitorNodoEstado[] }[] {
    if (!this.monitor?.nodos) return [];

    const grupos = new Map<string, MonitorNodoEstado[]>();
    const nodosVisibles = this.monitor.nodos.filter(n =>
      n.tipo !== 'INICIO' && n.tipo !== 'FIN' && n.tipo !== 'PARALELO'
    );

    for (const nodo of nodosVisibles) {
      const depto = nodo.nombreDepartamento || 'Sin departamento';
      if (!grupos.has(depto)) {
        grupos.set(depto, []);
      }
      grupos.get(depto)!.push(nodo);
    }

    return Array.from(grupos.entries()).map(([departamento, nodos]) => ({
      departamento,
      nodos
    }));
  }

  getTooltip(nodo: MonitorNodoEstado): string {
    if (!nodo.tramitesActivos?.length) return nodo.nombreNodo || '';
    const lista = nodo.tramitesActivos
      .map(t => `${t.titulo} (${t.prioridad})`)
      .join('\n');
    return `${nodo.nombreNodo}\n${nodo.tramitesActivos.length} activo(s):\n${lista}`;
  }

  getPrioridadClass(prioridad: string): string {
    switch (prioridad) {
      case 'ALTA': return 'chip-alta';
      case 'MEDIA': return 'chip-media';
      case 'BAJA': return 'chip-baja';
      default: return 'chip-media';
    }
  }

  get totalActivos(): number {
    return this.monitor?.tramitesActivos?.length ?? 0;
  }
}
