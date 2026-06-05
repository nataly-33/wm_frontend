import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AgenteService, RespuestaAgente } from '../../../core/services/agente.service';
import { AuthService } from '../../../core/services/auth.service';
import { SocketService } from '../../../core/services/socket.service';

interface MensajeUI {
  rol: 'agente' | 'cliente';
  contenido: string;
  tipo: string;
  timestamp: Date;
}

interface CampoMeta {
  tipo: string;
  etiqueta: string;
  opciones: string[];
  requerido: boolean;
}

@Component({
  selector: 'app-chat-agente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-agente.component.html',
  styleUrls: ['./chat-agente.component.scss']
})
export class ChatAgenteComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('mensajesContainer') mensajesContainer!: ElementRef;

  mensajes: MensajeUI[] = [];
  mensajeActual = '';
  conversacionId: string | null = null;
  estadoConversacion = 'DETECTANDO_POLITICA';
  procesando = false;
  escuchandoVoz = false;
  archivoSeleccionado: File | null = null;
  estadoBadge: string | null = null;
  clienteId: string = '';

  // Estado de campo activo para widgets interactivos
  campoActivo: CampoMeta | null = null;
  seleccionCheckboxArray: string[] = [];
  fechaSeleccionada = '';

  private recognition: any = null;
  private subcripciones: Subscription[] = [];
  private autoScroll = true;

  constructor(
    private agenteService: AgenteService,
    private authService: AuthService,
    private socketService: SocketService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.clienteId = user?.id ?? 'anonimo';

    this.iniciarVozReconocimiento();
    this.suscribirNotificaciones();

    // Intentar restaurar conversacion activa existente
    this.agenteService.obtenerConversacionActiva(this.clienteId).subscribe({
      next: (resultado) => {
        if (resultado.tieneConversacionActiva && resultado.conversacionId) {
          this.conversacionId = resultado.conversacionId;
          this.estadoConversacion = resultado.estadoConversacion ?? 'DETECTANDO_POLITICA';

          if (resultado.mensajes && resultado.mensajes.length > 0) {
            this.mensajes = resultado.mensajes.map((m: any) => ({
              rol: m.rol as 'agente' | 'cliente',
              contenido: m.contenido ?? '',
              tipo: m.tipo ?? 'texto',
              timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
            }));
            this.agregarMensajeAgente(
              'Bienvenido de vuelta. Retomamos donde lo dejaste.',
              'texto'
            );
          } else {
            this.agregarMensajeAgente(
              'Hola! Soy el asistente de CRE. Puedo ayudarte a iniciar un tramite o consultar el estado de uno existente. Que necesitas hoy?',
              'texto'
            );
          }
        } else {
          this.agregarMensajeAgente(
            'Hola! Soy el asistente de CRE. Puedo ayudarte a iniciar un tramite o consultar el estado de uno existente. Que necesitas hoy?',
            'texto'
          );
        }
      },
      error: () => {
        this.agregarMensajeAgente(
          'Hola! Soy el asistente de CRE. Puedo ayudarte a iniciar un tramite o consultar el estado de uno existente. Que necesitas hoy?',
          'texto'
        );
      }
    });
  }

  ngOnDestroy(): void {
    this.subcripciones.forEach(s => s.unsubscribe());
    this.detenerVoz();
  }

  ngAfterViewChecked(): void {
    if (this.autoScroll) {
      this.scrollAbajo();
    }
  }

  // ─── Enviar mensaje ────────────────────────────────────────────────────────

  enviar(): void {
    const texto = this.mensajeActual.trim();
    if (!texto || this.procesando) return;

    this.agregarMensajeCliente(texto, 'texto');
    this.mensajeActual = '';
    this.procesando = true;

    this.agenteService.enviarMensaje(this.conversacionId, this.clienteId, texto, 'texto').subscribe({
      next: (resp) => this.manejarRespuesta(resp),
      error: () => {
        this.procesando = false;
        this.agregarMensajeAgente('Ocurrio un error de conexion. Por favor intenta de nuevo.', 'texto');
      }
    });
  }

  enviarConfirmacion(valor: string): void {
    this.mensajeActual = valor;
    this.enviar();
  }

  // ─── Widgets interactivos ─────────────────────────────────────────────────

  confirmarPolitica(valor: boolean): void {
    this.enviarConfirmacion(valor ? 'si' : 'no');
    this.campoActivo = null;
  }

  seleccionarOpcion(opcion: string): void {
    if (this.procesando) return;
    this.agregarMensajeCliente(opcion, 'texto');
    this.procesando = true;
    this.campoActivo = null;
    this.agenteService.enviarMensaje(this.conversacionId, this.clienteId, opcion, 'texto')
      .subscribe({
        next: r => this.manejarRespuesta(r),
        error: () => { this.procesando = false; }
      });
  }

  toggleCheckbox(opcion: string): void {
    const idx = this.seleccionCheckboxArray.indexOf(opcion);
    if (idx >= 0) {
      this.seleccionCheckboxArray.splice(idx, 1);
    } else {
      this.seleccionCheckboxArray.push(opcion);
    }
  }

  isCheckboxSeleccionado(opcion: string): boolean {
    return this.seleccionCheckboxArray.indexOf(opcion) >= 0;
  }

  confirmarCheckboxes(): void {
    if (this.seleccionCheckboxArray.length === 0) return;
    const valor = this.seleccionCheckboxArray.join(', ');
    this.seleccionCheckboxArray = [];
    this.seleccionarOpcion(valor);
  }

  enviarFecha(): void {
    if (!this.fechaSeleccionada) return;
    const partes = this.fechaSeleccionada.split('-');
    const fechaFormateada = partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : this.fechaSeleccionada;
    this.fechaSeleccionada = '';
    this.seleccionarOpcion(fechaFormateada);
  }

  // ─── Getters para template ────────────────────────────────────────────────

  get esEstadoConfirmacion(): boolean {
    return this.estadoConversacion === 'CONFIRMANDO_POLITICA';
  }

  get esCampoFecha(): boolean {
    return this.campoActivo?.tipo === 'FECHA';
  }

  get esCampoSelector(): boolean {
    return ['SELECTOR', 'SELECCION', 'RADIO'].includes(this.campoActivo?.tipo ?? '');
  }

  get esCampoCheckbox(): boolean {
    return this.campoActivo?.tipo === 'CHECKBOX';
  }

  get esCampoArchivo(): boolean {
    return ['ARCHIVO', 'IMAGEN', 'VIDEO'].includes(this.campoActivo?.tipo ?? '');
  }

  get esCampoNumero(): boolean {
    return this.campoActivo?.tipo === 'NUMERO';
  }

  get esCampoTexto(): boolean {
    return !this.esCampoFecha && !this.esCampoSelector && !this.esCampoCheckbox && !this.esCampoArchivo;
  }

  esUltimoMensajeAgente(msg: MensajeUI): boolean {
    const ultimoConfirmacion = [...this.mensajes]
      .reverse()
      .find(m => m.tipo === 'confirmacion' && m.rol === 'agente');
    return ultimoConfirmacion === msg;
  }

  // ─── Archivo ──────────────────────────────────────────────────────────────

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.archivoSeleccionado = input.files[0];
      this.subirArchivo();
    }
  }

  private subirArchivo(): void {
    if (!this.archivoSeleccionado || !this.conversacionId) return;

    this.procesando = true;
    const formData = new FormData();
    formData.append('archivo', this.archivoSeleccionado);
    if (this.clienteId) {
      formData.append('clienteId', this.clienteId);
    }

    this.http.post<any>(`${environment.apiUrl}/api/v1/archivos/subir`, formData).subscribe({
      next: (res) => {
        const archivoUrl = res.url ?? res.data?.url ?? '';
        this.agregarMensajeCliente('[Archivo: ' + this.archivoSeleccionado!.name + ']', 'archivo');
        this.agenteService.subirArchivo(
          this.conversacionId!,
          this.clienteId,
          archivoUrl,
          this.archivoSeleccionado!.name
        ).subscribe({
          next: (resp) => {
            this.archivoSeleccionado = null;
            this.manejarRespuesta(resp);
          },
          error: () => {
            this.procesando = false;
            this.agregarMensajeAgente('No se pudo procesar el archivo. Por favor intenta de nuevo.', 'texto');
          }
        });
      },
      error: () => {
        this.procesando = false;
        this.agregarMensajeAgente('Error al subir el archivo. Verifica tu conexion.', 'texto');
      }
    });
  }

  // ─── Voz ──────────────────────────────────────────────────────────────────

  private iniciarVozReconocimiento(): void {
    const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-BO';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onresult = (event: any) => {
      const texto = event.results[0][0].transcript;
      this.mensajeActual = texto;
      this.escuchandoVoz = false;
    };

    this.recognition.onerror = () => {
      this.escuchandoVoz = false;
    };

    this.recognition.onend = () => {
      this.escuchandoVoz = false;
    };
  }

  toggleVoz(): void {
    if (!this.recognition) return;
    if (this.escuchandoVoz) {
      this.detenerVoz();
    } else {
      this.escuchandoVoz = true;
      this.recognition.start();
    }
  }

  private detenerVoz(): void {
    if (this.recognition && this.escuchandoVoz) {
      this.recognition.stop();
      this.escuchandoVoz = false;
    }
  }

  get vozDisponible(): boolean {
    return !!((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition);
  }

  // ─── WebSocket ────────────────────────────────────────────────────────────

  private suscribirNotificaciones(): void {
    const sub = this.socketService.getNotificaciones().subscribe((evento) => {
      if (!evento) return;

      if (evento.tipo === 'MENSAJE_AGENTE' && evento.mensaje) {
        const tipoMsg = evento.tipoMensaje ?? 'texto';
        this.agregarMensajeAgente(evento.mensaje, tipoMsg);

        // Actualizar estado si el motor lo cambio (para desbloquear el input instantaneamente)
        if (evento.estadoConversacion) {
          this.estadoConversacion = evento.estadoConversacion;
        }

        // Actualizar campoActivo si el WS incluye campoMeta
        if (evento.campoMeta) {
          this.campoActivo = evento.campoMeta as CampoMeta;
          this.seleccionCheckboxArray = [];
        } else if (tipoMsg !== 'DEPARTAMENTO') {
          // Si no hay campo meta en el evento, limpiar el campo activo
          this.campoActivo = null;
        }
        return;
      }

      if (evento.tipo === 'SOLICITUD_ENVIADA' || evento.tipo === 'COMPLETADO' || evento.tipo === 'RECHAZADO') {
        this.estadoBadge = evento.tipo;
        this.agregarMensajeAgente(evento.mensaje ?? 'Tu tramite fue actualizado.', 'estado');
        this.campoActivo = null;
      }

      if (evento.tipo === 'COMPLETADO') {
        this.estadoConversacion = 'COMPLETADO';
        this.estadoBadge = 'COMPLETADO';
      } else if (evento.tipo === 'RECHAZADO') {
        this.estadoConversacion = 'RECHAZADO';
        this.estadoBadge = 'RECHAZADO';
      }
    });
    this.subcripciones.push(sub);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private manejarRespuesta(resp: RespuestaAgente): void {
    this.procesando = false;
    if (resp.conversacionId) {
      this.conversacionId = resp.conversacionId;
    }
    if (resp.estadoConversacion) {
      this.estadoConversacion = resp.estadoConversacion;
    }
    if (resp.mensajeAgente) {
      const tipo = resp.estadoConversacion === 'CONFIRMANDO_POLITICA' ? 'confirmacion' : 'texto';
      this.agregarMensajeAgente(resp.mensajeAgente, tipo);
    }

    // Actualizar campo activo segun la respuesta
    if (resp.estadoConversacion === 'RECOPILANDO_DATOS_NODO' && resp.campoMeta) {
      this.campoActivo = resp.campoMeta as CampoMeta;
      this.seleccionCheckboxArray = [];
    } else {
      this.campoActivo = null;
    }

    if (resp.estadoConversacion === 'COMPLETADO' || resp.estadoConversacion === 'RECHAZADO') {
      this.estadoBadge = resp.estadoConversacion;
    }
  }

  agregarMensajeCliente(contenido: string, tipo: string): void {
    this.mensajes.push({ rol: 'cliente', contenido, tipo, timestamp: new Date() });
    this.autoScroll = true;
  }

  private agregarMensajeAgente(contenido: string, tipo: string): void {
    this.mensajes.push({ rol: 'agente', contenido, tipo, timestamp: new Date() });
    this.autoScroll = true;
  }

  private scrollAbajo(): void {
    try {
      const container = this.mensajesContainer?.nativeElement;
      if (container) container.scrollTop = container.scrollHeight;
    } catch {}
  }

  formatHora(fecha: Date): string {
    return fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  }

  getBadgeClass(): string {
    switch (this.estadoBadge) {
      case 'COMPLETADO': return 'badge-completado';
      case 'RECHAZADO': return 'badge-rechazado';
      default: return 'badge-proceso';
    }
  }

  getBadgeTexto(): string {
    switch (this.estadoBadge) {
      case 'COMPLETADO': return 'Tramite completado';
      case 'RECHAZADO': return 'Tramite rechazado';
      case 'ESPERANDO_APROBACION': return 'En revision';
      default: return 'En proceso';
    }
  }
}
