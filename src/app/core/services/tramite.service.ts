import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { EjecucionNodo } from './ejecucion.service';

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

export interface MonitorNodoEstado {
  nodoId: string;
  color: 'VERDE' | 'AMARILLO' | 'ROJO' | 'NARANJA' | 'GRIS';
  tramitesActivos: Array<{
    tramiteId: string;
    titulo: string;
    prioridad: string;
  }>;
}

export interface MonitorPoliticaResponse {
  nodos: MonitorNodoEstado[];
  tramitesActivos: Array<{
    tramiteId: string;
    titulo: string;
    prioridad: string;
    estado: string;
  }>;
  tramitesCompletados: number;
  tramitesRechazados: number;
}

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
