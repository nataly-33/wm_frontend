import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DocumentoResponse {
  id: string;
  nombre: string;
  descripcion?: string;
  tipoMime?: string;
  urlArchivo: string;
  s3Key?: string;
  tamanioBytes?: number;
  carpetaId?: string;
  politicaId?: string;
  tramiteId?: string;
  etiquetas?: string[];
  version: number;
  historialVersiones?: any[];
  permisos?: any;
  creadoPorId?: string;
  creadoPorNombre?: string;
  creadoEn?: string;
  modificadoEn?: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentoService {
  private base = `${environment.apiUrl}/api/v1/documentos`;

  constructor(private http: HttpClient) {}

  listar(empresaId: string, params?: { carpetaId?: string; politicaId?: string; tramiteId?: string }): Observable<DocumentoResponse[]> {
    let httpParams = new HttpParams().set('empresaId', empresaId);
    if (params?.carpetaId) httpParams = httpParams.set('carpetaId', params.carpetaId);
    if (params?.politicaId) httpParams = httpParams.set('politicaId', params.politicaId);
    if (params?.tramiteId) httpParams = httpParams.set('tramiteId', params.tramiteId);
    return this.http.get<DocumentoResponse[]>(this.base, { params: httpParams });
  }

  subir(archivo: File, datos: any): Observable<DocumentoResponse> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('datos', new Blob([JSON.stringify(datos)], { type: 'application/json' }));
    return this.http.post<DocumentoResponse>(`${this.base}/upload`, formData);
  }

  subirNuevaVersion(id: string, archivo: File): Observable<DocumentoResponse> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<DocumentoResponse>(`${this.base}/${id}/version`, formData);
  }

  obtenerAuditoria(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/${id}/auditoria`);
  }

  obtenerConfigOnlyOffice(id: string, modo: string = 'view'): Observable<any> {
    return this.http.get<any>(`${this.base}/${id}/onlyoffice-config`, { params: { modo } });
  }
}
