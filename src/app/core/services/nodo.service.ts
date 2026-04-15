import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

export type NodoTipo = 'INICIO' | 'TAREA' | 'DECISION' | 'FIN' | 'PARALELO';

export interface Nodo {
  id: string;
  politicaId: string;
  departamentoId: string;
  nombre: string;
  tipo: NodoTipo;
  posicionX: number;
  posicionY: number;
  formularioId: string | null;
  creadoEn: string;
}

export interface CrearNodoRequest {
  politicaId: string;
  departamentoId: string;
  nombre: string;
  tipo: NodoTipo;
  posicionX: number;
  posicionY: number;
  formularioId: string | null;
}

@Injectable({ providedIn: 'root' })
export class NodoService {
  private readonly baseUrl = `${environment.apiUrl}/api/v1/nodos`;

  constructor(private http: HttpClient) {}

  listarPorPolitica(politicaId: string): Observable<ApiResponse<Nodo[]>> {
    return this.http.get<ApiResponse<Nodo[]>>(`${this.baseUrl}/politica/${politicaId}`);
  }

  crear(request: CrearNodoRequest): Observable<ApiResponse<Nodo>> {
    return this.http.post<ApiResponse<Nodo>>(this.baseUrl, request);
  }

  actualizar(id: string, request: CrearNodoRequest): Observable<ApiResponse<Nodo>> {
    return this.http.put<ApiResponse<Nodo>>(`${this.baseUrl}/${id}`, request);
  }

  actualizarPosicion(id: string, posicionX: number, posicionY: number): Observable<ApiResponse<Nodo>> {
    return this.http.put<ApiResponse<Nodo>>(`${this.baseUrl}/${id}/posicion`, { posicionX, posicionY });
  }

  eliminar(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }
}
