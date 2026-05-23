import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';
import { environment } from '../../../../../../environments/environment';

export interface CampoRellenado {
  nombre: string;
  etiqueta: string;
  tipo: string;
  valor: any;
  esArchivo: boolean;
}

export interface FormularioRellenado {
  ejecucionId: string;
  nodoId: string;
  nombreNodo: string;
  departamentoNombre?: string;
  funcionarioNombre?: string;
  estado: string;
  completadoEn?: string;
  observaciones?: string;
  campos: CampoRellenado[];
}

@Component({
  selector: 'app-historial-formularios',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './historial-formularios.component.html',
  styleUrls: ['./historial-formularios.component.scss']
})
export class HistorialFormulariosComponent implements OnInit {
  tramiteId: string = '';
  historial: FormularioRellenado[] = [];
  cargando = false;
  error: string | null = null;

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    this.tramiteId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.tramiteId) {
      this.cargar();
    }
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.http
      .get<{ data: FormularioRellenado[] }>(
        `${environment.apiUrl}/api/v1/ejecuciones/tramite/${this.tramiteId}/historial-formularios`
      )
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (res) => {
          this.historial = res.data ?? [];
        },
        error: () => {
          this.error = 'No se pudo cargar el historial de formularios.';
        }
      });
  }

  formatFecha(fecha: string | undefined): string {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleString('es-BO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatValor(campo: CampoRellenado): string {
    if (campo.valor === null || campo.valor === undefined) return '-';
    if (campo.esArchivo) return '[Archivo adjunto]';
    if (typeof campo.valor === 'object') return JSON.stringify(campo.valor);
    return String(campo.valor);
  }

  esUrl(valor: any): boolean {
    if (typeof valor !== 'string') return false;
    return valor.startsWith('http://') || valor.startsWith('https://');
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'COMPLETADO': return 'badge badge-completado';
      case 'RECHAZADO': return 'badge badge-rechazado';
      case 'EN_PROCESO': return 'badge badge-en-proceso';
      default: return 'badge badge-pendiente';
    }
  }
}
