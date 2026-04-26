import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

export interface DepartamentoIaDto {
  id: string;
  nombre: string;
}

export interface GenerarDiagramaRequest {
  prompt: string;
  departamentos: DepartamentoIaDto[];
  politicaId?: string;
}

export interface NodoIaResponse {
  tempId: string;
  tipo: string;
  nombre: string;
  departamentoId: string | null;
  posicion_x: number;
  posicion_y: number;
  formularioId: string | null;
}

export interface TransicionIaResponse {
  nodoOrigenTempId: string;
  nodoDestinoTempId: string;
  tipo: string;
  etiqueta: string | null;
  condicion: string | null;
}

export interface DiagramaIaResponse {
  nodos: NodoIaResponse[];
  transiciones: TransicionIaResponse[];
  departamentosDetectados: string[];
  metodo_usado?: string;
  advertencia?: string | null;
}

export interface GenerarFormularioRequest {
  descripcion: string;
  nombreNodo: string;
}

export interface CampoFormularioIa {
  nombre: string;
  etiqueta: string;
  tipo: string;
  requerido: boolean;
  es_campo_prioridad: boolean;
  opciones: string[];
}

@Injectable({ providedIn: 'root' })
export class IaService {
  private readonly base = `${environment.apiUrl}/api/v1/ia`;

  constructor(private http: HttpClient) {}

  generarDiagrama(request: GenerarDiagramaRequest): Observable<ApiResponse<DiagramaIaResponse>> {
    return this.http.post<ApiResponse<DiagramaIaResponse>>(`${this.base}/generar-diagrama`, request);
  }

  generarFormulario(request: GenerarFormularioRequest): Observable<ApiResponse<{ campos: CampoFormularioIa[] }>> {
    return this.http.post<ApiResponse<{ campos: CampoFormularioIa[] }>>(`${this.base}/generar-formulario`, request);
  }

  analizarPolitica(politicaId: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/analizar-politica`, { politicaId });
  }
}
