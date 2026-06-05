import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TramiteService, TramiteDetallado } from '../../../core/services/tramite.service';
import { PoliticaService, Politica } from '../../../core/services/politica.service';

@Component({
  selector: 'app-cliente-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class ClienteDashboardComponent implements OnInit {
  nombreUsuario = '';
  iniciales = '';
  empresaId = '';
  clienteId = '';
  horaActual = new Date();

  cargando = true;

  // Estadísticas
  tramitesActivos = 0;
  tramitesCompletados = 0;
  tramitesRechazados = 0;
  politicasDisponibles = 0;

  misTramites: TramiteDetallado[] = [];
  politicas: Politica[] = [];

  constructor(
    private authService: AuthService,
    private tramiteService: TramiteService,
    private politicaService: PoliticaService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.nombreUsuario = user.nombre;
      this.iniciales = this.calcularIniciales(user.nombre);
      this.empresaId = user.empresaId ?? '';
      this.clienteId = user.id ?? '';
    }

    this.cargarDatos();

    // Actualizar hora cada minuto
    setInterval(() => this.horaActual = new Date(), 60000);
  }

  cargarDatos(): void {
    this.cargando = true;

    forkJoin({
      tramites: this.tramiteService.listarPorCliente(this.clienteId),
      politicas: this.politicaService.listar()
    }).subscribe({
      next: ({ tramites, politicas }) => {
        const todos: TramiteDetallado[] = tramites.data ?? [];
        
        // Calculate stats on all client tramites
        this.tramitesActivos = todos.filter((t) => t.estadoGeneral === 'EN_PROCESO' || t.estadoGeneral === 'PENDIENTE').length;
        this.tramitesCompletados = todos.filter((t) => t.estadoGeneral === 'COMPLETADO').length;
        this.tramitesRechazados = todos.filter((t) => t.estadoGeneral === 'RECHAZADO').length;

        // Show only the 4 most recent for the dashboard
        this.misTramites = todos.slice(0, 4);

        const pol: Politica[] = politicas.data ?? [];
        this.politicas = pol.filter((p: Politica) => p.estado === 'ACTIVA').slice(0, 4);
        this.politicasDisponibles = this.politicas.length;

        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'EN_PROCESO': return 'estado-proceso';
      case 'COMPLETADO': return 'estado-completado';
      case 'RECHAZADO': return 'estado-rechazado';
      default: return '';
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
      default: return '';
    }
  }



  formatFecha(fecha: Date | string | undefined): string {
    if (!fecha) return '-';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getSaludo(): string {
    const hora = this.horaActual.getHours();
    if (hora < 12) return 'Buenos dias';
    if (hora < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  private calcularIniciales(nombre: string): string {
    if (!nombre) return 'U';
    const partes = nombre.trim().split(' ');
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return nombre.substring(0, 2).toUpperCase();
  }
}
