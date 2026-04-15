import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

export type TransicionTipo = 'LINEAL' | 'ALTERNATIVA' | 'PARALELA';

export interface Transicion {
  id: string;
  politicaId: string;
  nodoOrigenId: string;
  nodoDestinoId: string;
  tipo: TransicionTipo;
  condicion: string | null;
  etiqueta: string | null;
  creadoEn: string;
}

export interface CrearTransicionRequest {
  politicaId: string;
  nodoOrigenId: string;
  nodoDestinoId: string;
  tipo: TransicionTipo;
  condicion: string | null;
  etiqueta: string | null;
}

@Injectable({ providedIn: 'root' })
export class TransicionService {
  private readonly baseUrl = `${environment.apiUrl}/api/v1/transiciones`;

  constructor(private http: HttpClient) {}

  listarPorPolitica(politicaId: string): Observable<ApiResponse<Transicion[]>> {
    return this.http.get<ApiResponse<Transicion[]>>(`${this.baseUrl}/politica/${politicaId}`);
  }

  crear(request: CrearTransicionRequest): Observable<ApiResponse<Transicion>> {
    return this.http.post<ApiResponse<Transicion>>(this.baseUrl, request);
  }

  actualizar(id: string, request: CrearTransicionRequest): Observable<ApiResponse<Transicion>> {
    return this.http.put<ApiResponse<Transicion>>(`${this.baseUrl}/${id}`, request);
  }

  eliminar(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }
}
