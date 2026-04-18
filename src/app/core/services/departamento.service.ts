import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

export interface Departamento {
  id: string;
  nombre: string;
  descripcion: string;
  adminDepartamentoId: string;
  activo: boolean;
  creadoEn: string;
}

export interface CrearDepartamentoRequest {
  nombre: string;
  descripcion: string;
  adminDepartamentoId: string;
}

@Injectable({
  providedIn: 'root'
})
export class DepartamentoService {
  private baseUrl = `${environment.apiUrl}/api/v1/departamentos`;

  constructor(private http: HttpClient) {}

  listar(): Observable<ApiResponse<Departamento[]>> {
    return this.http.get<ApiResponse<Departamento[]>>(this.baseUrl);
  }

  listarSinAdmin(): Observable<ApiResponse<Departamento[]>> {
    return this.http.get<ApiResponse<Departamento[]>>(`${this.baseUrl}/sin-admin`);
  }

  listarCompletos(): Observable<ApiResponse<Departamento[]>> {
    return this.http.get<ApiResponse<Departamento[]>>(`${this.baseUrl}/completos`);
  }

  obtener(id: string): Observable<ApiResponse<Departamento>> {
    return this.http.get<ApiResponse<Departamento>>(`${this.baseUrl}/${id}`);
  }

  crear(request: CrearDepartamentoRequest): Observable<ApiResponse<Departamento>> {
    return this.http.post<ApiResponse<Departamento>>(this.baseUrl, request);
  }

  actualizar(id: string, request: CrearDepartamentoRequest): Observable<ApiResponse<Departamento>> {
    return this.http.put<ApiResponse<Departamento>>(`${this.baseUrl}/${id}`, request);
  }

  eliminar(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }
}
