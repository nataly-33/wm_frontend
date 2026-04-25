import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, finalize, timeout } from 'rxjs';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { Politica, PoliticaService } from '../../../../core/services/politica.service';
import { SocketService } from '../../../../core/services/socket.service';
import {
  MonitorDepartamento,
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

  readonly colorBorder: Record<string, string> = {
    AMARILLO: '#fecc1b',
    ROJO:     '#f44250',
    VACIO:    '#565620'
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
      .pipe(timeout(15000), finalize(() => (this.cargando = false)))
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
    if (!this.politicaSeleccionadaId) return;

    this.cargando = true;
    this.tramiteService
      .obtenerMonitor(this.politicaSeleccionadaId)
      .pipe(timeout(15000), finalize(() => (this.cargando = false)))
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
    if (!this.politicaSeleccionadaId) return;

    this.monitorSubscription?.unsubscribe();
    this.monitorSubscription = this.socketService
      .suscribirAMonitor(this.politicaSeleccionadaId)
      .subscribe((evento) => {
        this.eventosRecientes.unshift(evento);
        if (this.eventosRecientes.length > 8) this.eventosRecientes.pop();
        this.manejarEventoSocket(evento);
        this.cargarMonitor();
      });
  }

  private manejarEventoSocket(evento: any): void {
    if (!this.monitor) return;
    switch (evento.tipo) {
      case 'TRAMITE_COMPLETADO':
        if (this.monitor.estadisticas) {
          this.monitor.estadisticas.activos = Math.max(0, this.monitor.estadisticas.activos - 1);
          this.monitor.estadisticas.completados++;
        }
        break;
      case 'TRAMITE_RECHAZADO':
        if (this.monitor.estadisticas) {
          this.monitor.estadisticas.activos = Math.max(0, this.monitor.estadisticas.activos - 1);
          this.monitor.estadisticas.rechazados++;
        }
        break;
      case 'TRAMITE_INICIADO':
        if (this.monitor.estadisticas) {
          this.monitor.estadisticas.activos++;
        }
        break;
    }
  }

  getDeptoClass(depto: MonitorDepartamento): string {
    if (depto.color === 'ROJO') return 'tiene-rechazado';
    if (depto.color === 'AMARILLO') return 'tiene-activos';
    return 'vacio';
  }

  getPrioridadClass(prioridad: string): string {
    switch (prioridad) {
      case 'ALTA':  return 'chip-alta';
      case 'MEDIA': return 'chip-media';
      case 'BAJA':  return 'chip-baja';
      default:      return 'chip-media';
    }
  }

  get activos(): number {
    return this.monitor?.estadisticas?.activos ?? 0;
  }

  get completados(): number {
    return this.monitor?.estadisticas?.completados ?? 0;
  }

  get rechazados(): number {
    return this.monitor?.estadisticas?.rechazados ?? 0;
  }
}
