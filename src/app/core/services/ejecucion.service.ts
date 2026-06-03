import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

export interface CampoFormulario {
  nombre: string;
  etiqueta: string;
  tipo: string;
  requerido: boolean;
  esCampoPrioridad: boolean;
  opciones: string[];
  columnasGrid?: string[];
  llenadoPor: string;
}

export interface CampoConValor {
  campo: CampoFormulario;
  valor: any;
}

export interface VistaFuncionarioResponse {
  ejecucionId: string;
  fase: string;
  camposCliente: CampoConValor[];
  camposFuncionario: CampoFormulario[];
}

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

  // Virtual properties populated by the backend on single-fetch
  tramiteTitulo?: string;
  prioridad?: string;
  nombreNodo?: string;
  nombrePolitica?: string;
}

export interface CampoRellenado {
  nombre: string;
  etiqueta: string;
  tipo: string;
  valor: any;
  esArchivo: boolean;
  esTablaGrid: boolean;
}

export interface NodoHistorial {
  ejecucionId: string;
  nodoId: string;
  nodoNombre: string;
  departamento: string;
  fase: string;
  estado: string;
  camposCliente: CampoRellenado[];
  camposFuncionario: CampoRellenado[];
  funcionarioNombre: string;
  clienteCompletadoEn: string;
  funcionarioCompletadoEn: string;
  creadoEn: string;
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

  obtenerVistaFuncionario(ejecucionId: string): Observable<VistaFuncionarioResponse> {
    return this.http.get<VistaFuncionarioResponse>(`${this.apiUrl}/${ejecucionId}/vista-funcionario`);
  }

  funcionarioCompletar(ejecucionId: string, respuestas: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${ejecucionId}/funcionario-completar`, respuestas);
  }

  historialFormularios(tramiteId: string): Observable<NodoHistorial[]> {
    return this.http.get<NodoHistorial[]>(
      `${environment.apiUrl}/api/v1/tramites/${tramiteId}/historial-formularios`
    );
  }
}
