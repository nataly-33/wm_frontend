import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { EjecucionNodo } from './ejecucion.service';

// ─── Modelo base ──────────────────────────────────────────────────────────────

export interface Tramite {
  id: string;
  politicaId: string;
  empresaId: string;
  titulo: string;
  estadoGeneral: string;
  nodoActualId: string;
  prioridad: string;
  fechaLimite?: Date;
  iniciadoPor: string;
  iniciadoEn: Date;
  finalizadoEn?: Date;
}

export interface TramiteDetalle {
  tramite: Tramite;
  ejecuciones: EjecucionNodo[];
}

// ─── Trámite detallado (dashboard enriquecido) ────────────────────────────────

export interface TramiteDetallado {
  id: string;
  titulo: string;
  estadoGeneral: string;
  prioridad: string;
  nombrePolitica?: string;
  nodoActualNombre?: string;
  departamentoActualNombre?: string;
  funcionarioActualNombre?: string;
  iniciadoEn?: string;
  finalizadoEn?: string;
  fechaLimite?: string;
  tiempoTranscurrido?: string;
  duracionTotal?: string;
  motivoRechazo?: string;
  nodoRechazoNombre?: string;
  departamentoRechazoNombre?: string;
}

// ─── Monitor ──────────────────────────────────────────────────────────────────

export interface MonitorTramiteEnNodo {
  tramiteId: string;
  titulo: string;
  prioridad: string;
  ejecucionId: string;
  funcionarioNombre: string;
  tiempoTranscurrido: string;
}

export interface MonitorNodoActivo {
  nodoId: string;
  nombreNodo: string;
  tramitesActivos: MonitorTramiteEnNodo[];
}

export interface MonitorDepartamento {
  departamentoId: string;
  nombreDepartamento: string;
  color: 'AMARILLO' | 'ROJO' | 'VACIO';
  nodosActivos: MonitorNodoActivo[];
}

export interface MonitorEstadisticas {
  activos: number;
  completados: number;
  rechazados: number;
}

export interface MonitorTramiteActivo {
  tramiteId: string;
  titulo: string;
  prioridad: string;
  estadoGeneral: string;
  departamentoActualNombre?: string;
}

export interface MonitorPoliticaResponse {
  politicaId?: string;
  nombrePolitica?: string;
  estadisticas: MonitorEstadisticas;
  departamentos: MonitorDepartamento[];
  tramitesActivos: MonitorTramiteActivo[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class TramiteService {
  private apiUrl = `${environment.apiUrl}/api/v1/tramites`;

  constructor(private http: HttpClient) {}

  iniciar(body: Partial<Tramite>): Observable<Tramite> {
    return this.http.post<Tramite>(this.apiUrl, body);
  }

  listarPorEmpresa(empresaId: string): Observable<ApiResponse<Tramite[]>> {
    return this.http.get<ApiResponse<Tramite[]>>(`${this.apiUrl}/empresa/${empresaId}`);
  }

  listarPorEmpresaDetallado(empresaId: string): Observable<ApiResponse<TramiteDetallado[]>> {
    return this.http.get<ApiResponse<TramiteDetallado[]>>(`${this.apiUrl}/empresa/${empresaId}`);
  }

  listarPorPolitica(politicaId: string): Observable<ApiResponse<Tramite[]>> {
    return this.http.get<ApiResponse<Tramite[]>>(`${this.apiUrl}/politica/${politicaId}`);
  }

  listarPorDepartamento(departamentoId: string): Observable<ApiResponse<Tramite[]>> {
    return this.http.get<ApiResponse<Tramite[]>>(`${this.apiUrl}/departamento/${departamentoId}`);
  }

  obtener(id: string): Observable<ApiResponse<TramiteDetalle>> {
    return this.http.get<ApiResponse<TramiteDetalle>>(`${this.apiUrl}/${id}`);
  }

  cancelar(id: string): Observable<ApiResponse<Tramite>> {
    return this.http.put<ApiResponse<Tramite>>(`${this.apiUrl}/${id}/cancelar`, {});
  }

  obtenerMonitor(politicaId: string): Observable<ApiResponse<MonitorPoliticaResponse>> {
    return this.http.get<ApiResponse<MonitorPoliticaResponse>>(`${this.apiUrl}/monitor/${politicaId}`);
  }
}
