import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

export interface Politica {
  id: string;
  nombre: string;
  descripcion: string;
  version: number;
  estado: 'BORRADOR' | 'ACTIVA' | 'INACTIVA';
  generadoPorIa: boolean;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
  datosDiagramaJson?: string | null;
}

export interface CrearPoliticaRequest {
  nombre: string;
  descripcion: string;
}

export interface DiagramaNodoPayload {
  id?: string | null;
  tempId: string;
  tipo: string;
  nombre: string;
  departamentoId: string;
  formularioId?: string | null;
  posicionX: number;
  posicionY: number;
}

export interface DiagramaTransicionPayload {
  id?: string | null;
  nodoOrigenTempId: string;
  nodoDestinoTempId: string;
  tipo: string;
  etiqueta?: string | null;
  condicion?: string | null;
}

export interface GuardarDiagramaRequest {
  datosDiagramaJson: string;
  nodos: DiagramaNodoPayload[];
  transiciones: DiagramaTransicionPayload[];
}

export interface DiagramaResponse {
  datosDiagramaJson: string | null;
  nodos: any[];
  transiciones: any[];
  departamentos: any[];
}

@Injectable({ providedIn: 'root' })
export class PoliticaService {
  private readonly baseUrl = `${environment.apiUrl}/api/v1/politicas`;

  constructor(private http: HttpClient) {}

  listar(): Observable<ApiResponse<Politica[]>> {
    return this.http.get<ApiResponse<Politica[]>>(this.baseUrl);
  }

  obtener(id: string): Observable<ApiResponse<Politica>> {
    return this.http.get<ApiResponse<Politica>>(`${this.baseUrl}/${id}`);
  }

  crear(request: CrearPoliticaRequest): Observable<ApiResponse<Politica>> {
    return this.http.post<ApiResponse<Politica>>(this.baseUrl, request);
  }

  actualizar(id: string, request: CrearPoliticaRequest): Observable<ApiResponse<Politica>> {
    return this.http.put<ApiResponse<Politica>>(`${this.baseUrl}/${id}`, request);
  }

  eliminar(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }

  activar(id: string): Observable<ApiResponse<Politica>> {
    return this.http.put<ApiResponse<Politica>>(`${this.baseUrl}/${id}/activar`, {});
  }

  desactivar(id: string): Observable<ApiResponse<Politica>> {
    return this.http.put<ApiResponse<Politica>>(`${this.baseUrl}/${id}/desactivar`, {});
  }

  obtenerDiagrama(id: string): Observable<ApiResponse<DiagramaResponse>> {
    return this.http.get<ApiResponse<DiagramaResponse>>(`${this.baseUrl}/${id}/diagrama`);
  }

  guardarDiagrama(id: string, request: GuardarDiagramaRequest): Observable<ApiResponse<Politica>> {
    return this.http.put<ApiResponse<Politica>>(`${this.baseUrl}/${id}/diagrama`, request);
  }
}
