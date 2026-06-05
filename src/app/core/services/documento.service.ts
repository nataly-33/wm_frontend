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
  esDocumentoOficina?: boolean;
  tipoDocumento?: string;
}

export interface OnlyOfficeConfig {
  scriptUrl: string;
  documentType: string;
  document: {
    fileType: string;
    key: string;
    title: string;
    url: string;
  };
  editorConfig: {
    callbackUrl: string;
    mode: string;
    user: { id: string; name: string };
    lang: string;
  };
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

  obtenerConfigOnlyOffice(id: string, modo: string = 'view'): Observable<OnlyOfficeConfig> {
    return this.http.get<OnlyOfficeConfig>(`${this.base}/${id}/onlyoffice-config`, { params: { modo } });
  }

  /**
   * Busca un documento en MongoDB por su URL almacenada en S3.
   * Retorna el id, nombre, tipo y si es tramite (esTramite=true) también urlPresignada.
   * Cuando esTramite=true, usar obtenerConfigOnlyOfficeTramite(urlPresignada) en lugar del
   * endpoint /onlyoffice-config que requiere un ID de la colección Documento.
   */
  buscarPorUrl(url: string): Observable<{
    id: string;
    nombre: string;
    tipoDocumento: string;
    esDocumentoOficina: boolean;
    esTramite?: boolean;
    urlPresignada?: string;
  }> {
    return this.http.get<{
      id: string;
      nombre: string;
      tipoDocumento: string;
      esDocumentoOficina: boolean;
      esTramite?: boolean;
      urlPresignada?: string;
    }>(
      `${this.base}/buscar-por-url`,
      { params: { url } }
    );
  }

  /**
   * Genera la config de OnlyOffice para un archivo de trámite (DocumentoTramite)
   * pasando la URL pública de S3. El backend extrae la key, genera la URL pre-firmada
   * y arma el config directamente sin necesitar el documento en la colección Documento.
   */
  obtenerConfigOnlyOfficeTramite(urlS3: string, modo: string = 'edit'): Observable<OnlyOfficeConfig> {
    return this.http.get<OnlyOfficeConfig>(
      `${environment.apiUrl}/api/v1/onlyoffice/config-tramite`,
      { params: { url: urlS3, modo } }
    );
  }

  /**
   * Crea un documento de oficina en blanco (docx, xlsx, pptx, odt, ods, odp, csv, txt)
   * y lo sube a S3. Devuelve el DocumentoResponse con su id para abrir el editor.
   */
  crearDocumentoOficina(nombre: string, tipo: string): Observable<DocumentoResponse> {
    return this.http.post<DocumentoResponse>(`${this.base}/crear-oficina`, { nombre, tipo });
  }

  /**
   * Retorna todos los documentos de oficina creados desde el editor (esDocumentoOficina=true).
   * No requiere empresaId.
   */
  listarOficina(): Observable<DocumentoResponse[]> {
    return this.http.get<DocumentoResponse[]>(`${this.base}/oficina`);
  }
}
