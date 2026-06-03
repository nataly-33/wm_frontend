import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { EjecucionService, NodoHistorial } from '../../../../../core/services/ejecucion.service';
import { TablaGridViewerComponent } from '../../../../../shared/components/tabla-grid-viewer/tabla-grid-viewer.component';

@Component({
  selector: 'app-historial-formularios',
  standalone: true,
  imports: [CommonModule, RouterModule, TablaGridViewerComponent],
  templateUrl: './historial-formularios.component.html',
  styleUrls: ['./historial-formularios.component.scss']
})
export class HistorialFormulariosComponent implements OnInit {
  tramiteId = '';
  historial: NodoHistorial[] = [];
  cargando = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private ejecucionService: EjecucionService
  ) {}

  ngOnInit(): void {
    this.tramiteId =
      this.route.snapshot.paramMap.get('tramiteId') ||
      this.route.snapshot.paramMap.get('id') ||
      '';
    if (this.tramiteId) {
      this.cargar();
    } else {
      this.cargando = false;
    }
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.ejecucionService.historialFormularios(this.tramiteId).subscribe({
      next: (data) => {
        this.historial = data;
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el historial de formularios.';
        this.cargando = false;
      }
    });
  }

  descargarArchivo(url: string): void {
    window.open(url, '_blank');
  }

  exportarPDF(): void {
    window.print();
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'COMPLETADA': return 'badge badge-completado';
      case 'RECHAZADA':  return 'badge badge-rechazado';
      case 'ESPERANDO_FUNCIONARIO': return 'badge badge-en-proceso';
      case 'ESPERANDO_CLIENTE': return 'badge badge-pendiente';
      default: return 'badge badge-pendiente';
    }
  }

  formatFecha(fecha: string | undefined | null): string {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleString('es-BO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  esDecision(nombre: string): boolean {
    return nombre.includes('resultado') || nombre.includes('decision');
  }
}
