import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

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

@Injectable({
  providedIn: 'root'
})
export class TramiteService {
  private apiUrl = `${environment.apiUrl}/tramites`;

  constructor(private http: HttpClient) {}

  iniciar(body: Partial<Tramite>): Observable<Tramite> {
    return this.http.post<Tramite>(this.apiUrl, body);
  }

  listarPorEmpresa(empresaId: string): Observable<ApiResponse<Tramite[]>> {
    return this.http.get<ApiResponse<Tramite[]>>(`${this.apiUrl}/empresa/${empresaId}`);
  }

  obtener(id: string): Observable<ApiResponse<Tramite>> {
    return this.http.get<ApiResponse<Tramite>>(`${this.apiUrl}/${id}`);
  }
}
