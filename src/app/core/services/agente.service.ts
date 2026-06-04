import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MensajeChatItem {
  rol: 'agente' | 'cliente';
  contenido: string;
  tipo: string;
  timestamp: string;
}

export interface RespuestaAgente {
  conversacionId: string;
  estadoConversacion: string;
  mensajeAgente: string;
  estado?: string;
  campoActual?: string;
  campoMeta?: {
    tipo: string;
    etiqueta: string;
    opciones: string[];
    requerido: boolean;
  };
  politicaDetectada?: string;
  formularioCompletado?: boolean;
}

export interface EstadoTramiteCliente {
  tramiteId: string;
  titulo: string;
  estadoGeneral: string;
  nodoActualNombre?: string;
  departamentoActualNombre?: string;
  mensajeEstado: string;
  prioridad: string;
  iniciadoEn?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AgenteService {
  private apiUrl = `${environment.apiUrl}/api/v1/cliente/agente`;

  constructor(private http: HttpClient) {}

  enviarMensaje(conversacionId: string | null, clienteId: string, mensaje: string, tipo = 'texto'): Observable<RespuestaAgente> {
    return this.http.post<RespuestaAgente>(`${this.apiUrl}/mensaje`, {
      conversacionId,
      clienteId,
      mensaje,
      tipo
    });
  }

  subirArchivo(conversacionId: string, clienteId: string, archivoUrl: string, nombreArchivo: string): Observable<RespuestaAgente> {
    return this.http.post<RespuestaAgente>(`${this.apiUrl}/subir-archivo`, {
      conversacionId,
      clienteId,
      archivoUrl,
      nombreArchivo
    });
  }

  obtenerHistorial(clienteId: string): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.apiUrl}/historial?clienteId=${clienteId}`);
  }

  obtenerEstadoTramite(tramiteId: string): Observable<{ data: EstadoTramiteCliente }> {
    return this.http.get<{ data: EstadoTramiteCliente }>(`${this.apiUrl}/estado-tramite/${tramiteId}`);
  }

  obtenerConversacionActiva(clienteId: string): Observable<{
    tieneConversacionActiva: boolean;
    conversacionId?: string;
    estadoConversacion?: string;
    mensajes?: any[];
    tramiteId?: string;
  }> {
    return this.http.get<any>(`${this.apiUrl}/conversacion-activa?clienteId=${clienteId}`);
  }
}
