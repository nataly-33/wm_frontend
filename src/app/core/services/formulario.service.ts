import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

export type CampoTipo = 'TEXTO' | 'NUMERO' | 'FECHA' | 'SELECCION' | 'ARCHIVO' | 'IMAGEN';

export interface FormularioCampo {
  nombre: string;
  etiqueta: string;
  tipo: CampoTipo;
  requerido: boolean;
  esCampoPrioridad: boolean;
  opciones: string[];
}

export interface Formulario {
  id: string;
  politicaId: string;
  nodoId: string;
  nombre: string;
  campos: FormularioCampo[];
  generadoPorIa: boolean;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearFormularioRequest {
  politicaId: string;
  nodoId: string;
  nombre: string;
  campos: FormularioCampo[];
  generadoPorIa: boolean;
}

@Injectable({ providedIn: 'root' })
export class FormularioService {
  private readonly baseUrl = `${environment.apiUrl}/api/v1/formularios`;

  constructor(private http: HttpClient) {}

  obtenerPorNodo(nodoId: string): Observable<ApiResponse<Formulario>> {
    return this.http.get<ApiResponse<Formulario>>(`${this.baseUrl}/nodo/${nodoId}`);
  }

  crear(request: CrearFormularioRequest): Observable<ApiResponse<Formulario>> {
    return this.http.post<ApiResponse<Formulario>>(this.baseUrl, request);
  }

  actualizar(id: string, request: CrearFormularioRequest): Observable<ApiResponse<Formulario>> {
    return this.http.put<ApiResponse<Formulario>>(`${this.baseUrl}/${id}`, request);
  }

  eliminar(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }
}
