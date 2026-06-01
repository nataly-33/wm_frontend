import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { DepartamentoService, Departamento } from '../../../core/services/departamento.service';
import { TramiteService, Tramite } from '../../../core/services/tramite.service';
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
  totalDepartamentos = 0;
  tramitesActivos = 0;
  tramitesCompletados = 0;
  tramitesRechazados = 0;
  politicasDisponibles = 0;

  departamentos: Departamento[] = [];
  misTramites: Tramite[] = [];
  politicas: Politica[] = [];

  constructor(
    private authService: AuthService,
    private deptoService: DepartamentoService,
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
      departamentos: this.deptoService.listar(),
      tramites: this.tramiteService.listarPorEmpresa(this.empresaId),
      politicas: this.politicaService.listar()
    }).subscribe({
      next: ({ departamentos, tramites, politicas }) => {
        this.departamentos = (departamentos.data ?? []).slice(0, 6);
        this.totalDepartamentos = departamentos.data?.length ?? 0;

        const todos: Tramite[] = tramites.data ?? [];
        this.misTramites = todos
          .filter((t: Tramite) => t.iniciadoPor === this.clienteId)
          .slice(0, 4);

        this.tramitesActivos = this.misTramites.filter((t: Tramite) => t.estadoGeneral === 'EN_PROCESO').length;
        this.tramitesCompletados = this.misTramites.filter((t: Tramite) => t.estadoGeneral === 'COMPLETADO').length;
        this.tramitesRechazados = this.misTramites.filter((t: Tramite) => t.estadoGeneral === 'RECHAZADO').length;

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

  getDepartamentoIniciales(nombre: string): string {
    const palabras = nombre.trim().split(' ');
    if (palabras.length >= 2) return (palabras[0][0] + palabras[1][0]).toUpperCase();
    return nombre.substring(0, 2).toUpperCase();
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
