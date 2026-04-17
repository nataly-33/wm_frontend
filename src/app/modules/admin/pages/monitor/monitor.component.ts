import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { finalize, timeout } from 'rxjs';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { Politica, PoliticaService } from '../../../../core/services/politica.service';
import { SocketService } from '../../../../core/services/socket.service';

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './monitor.component.html',
  styleUrls: ['./monitor.component.scss']
})
export class MonitorComponent implements OnInit {
  politicas: Politica[] = [];
  cargando = false;
  error: string | null = null;
  alertas: any[] = [];

  constructor(
    private politicaService: PoliticaService,
    private socketService: SocketService
  ) {}

  ngOnInit(): void {
    this.cargando = true;
    this.politicaService.listar().pipe(
      timeout(15000),
      finalize(() => this.cargando = false)
    ).subscribe({
      next: (res: ApiResponse<Politica[]>) => {
        this.politicas = res.data ?? [];
        // Suscribirse a web sockets para politicas activas
        this.politicas.forEach(p => {
          if (p.estado === 'ACTIVA') {
            this.socketService.suscribirAMonitor(p.id).subscribe(evento => {
              this.alertas.push({ politica: p.nombre, ...evento });
              // Mantenemos solo las ultimas 5 alertas
              if (this.alertas.length > 5) this.alertas.shift();
            });
          }
        });
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message ?? 'No se pudo cargar monitor';
      }
    });
  }
}
