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

@Injectable({
  providedIn: 'root'
})
export class EjecucionService {
  private apiUrl = `${environment.apiUrl}/ejecuciones`;

  constructor(private http: HttpClient) {}

  listarPorDepartamento(departamentoId: string): Observable<ApiResponse<EjecucionNodo[]>> {
    return this.http.get<ApiResponse<EjecucionNodo[]>>(`${this.apiUrl}/departamento/${departamentoId}`);
  }

  completar(id: string, respuestaFormulario: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/completar`, { respuesta_formulario: respuestaFormulario });
  }

  rechazar(id: string, observaciones: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/rechazar`, { observaciones });
  }
}
