import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, finalize, timeout } from 'rxjs';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { Politica, PoliticaService } from '../../../../core/services/politica.service';
import { SocketService } from '../../../../core/services/socket.service';
import {
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

  private cargarMonitor(): void {
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
        this.cargarMonitor();
      });
  }
}
