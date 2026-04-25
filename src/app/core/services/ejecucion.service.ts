import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

export interface EjecucionNodo {
  id: string;
  tramiteId: string;
  nodoId: string;
  departamentoId: string;
  funcionarioId: string;
  estado: string;
  respuestaFormulario: any;
  archivosAdjuntos: string[];
  iniciadoEn: Date;
  completadoEn?: Date;
  observaciones?: string;

  // Virtual properties for UI
  tramiteTitulo?: string;
  prioridad?: string;
}

export interface EjecucionDetallada {
  id: string;
  estado: string;
  nombreNodo: string;
  nombrePolitica: string;
  tituloTramite: string;
  prioridad: string;
  fechaLimite?: string;
  iniciadoEn?: string;
  nombreDepartamento: string;
  tramiteId: string;
  politicaId: string;
  nodoId: string;
}

@Injectable({
  providedIn: 'root'
})
export class EjecucionService {
  private apiUrl = `${environment.apiUrl}/api/v1/ejecuciones`;

  constructor(private http: HttpClient) {}

  listarPorDepartamento(departamentoId: string): Observable<ApiResponse<EjecucionNodo[]>> {
    return this.http.get<ApiResponse<EjecucionNodo[]>>(`${this.apiUrl}/departamento/${departamentoId}`);
  }

  listarPorFuncionario(usuarioId: string): Observable<ApiResponse<EjecucionDetallada[]>> {
    return this.http.get<ApiResponse<EjecucionDetallada[]>>(`${this.apiUrl}/funcionario/${usuarioId}`);
  }

  listarPorTramite(tramiteId: string): Observable<ApiResponse<EjecucionNodo[]>> {
    return this.http.get<ApiResponse<EjecucionNodo[]>>(`${this.apiUrl}/tramite/${tramiteId}`);
  }

  obtener(id: string): Observable<ApiResponse<EjecucionNodo>> {
    return this.http.get<ApiResponse<EjecucionNodo>>(`${this.apiUrl}/${id}`);
  }

  iniciar(id: string): Observable<ApiResponse<EjecucionNodo>> {
    return this.http.put<ApiResponse<EjecucionNodo>>(`${this.apiUrl}/${id}/iniciar`, {});
  }

  completar(id: string, respuestaFormulario: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/completar`, { respuesta_formulario: respuestaFormulario });
  }

  rechazar(id: string, observaciones: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/rechazar`, { observaciones });
  }

  reasignar(id: string, funcionarioId: string): Observable<ApiResponse<EjecucionNodo>> {
    return this.http.put<ApiResponse<EjecucionNodo>>(`${this.apiUrl}/${id}/reasignar`, { funcionarioId });
  }
}
