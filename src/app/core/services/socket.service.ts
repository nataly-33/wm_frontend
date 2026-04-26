import { Injectable } from '@angular/core';
import { Client, Message } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private client!: Client;
  private conectando = false;
  private notificacionesSubject = new Subject<any>();
  private monitorSubjects = new Map<string, Subject<any>>();
  private monitorSubscriptions = new Set<string>();
  private formulariosEmpresaSubjects = new Map<string, Subject<any>>();
  private formulariosDeptoSubjects = new Map<string, Subject<any>>();
  private formulariosSubscriptions = new Set<string>();

  constructor(private authService: AuthService) {
    this.authService.getCurrentUser$().subscribe((user) => {
      if (!user || !this.authService.getToken()) {
        this.desconectar();
        return;
      }

      this.ensureConectado();
    });

    this.ensureConectado();
  }

  private conectar(): void {
    if (this.conectando) return;
    const token = this.authService.getToken();
    if (!token) return;

    this.conectando = true;

    this.client = new Client({
      webSocketFactory: () => new SockJS(`${environment.apiUrl}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      debug: (str) => {
        // console.log(str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    this.client.onConnect = () => {
      this.conectando = false;
      console.log('WebSocket conectado');
      const user = this.authService.getCurrentUser();
      if (user) {
        this.client.subscribe(`/topic/usuario/${user.id}`, (message: Message) => {
          this.notificacionesSubject.next(JSON.parse(message.body));
        });
      }

      // Suscribir todos los topics de monitor pendientes
      for (const [politicaId, subject] of this.monitorSubjects.entries()) {
        const topic = `/topic/politica/${politicaId}`;
        if (!this.monitorSubscriptions.has(topic)) {
          this.client.subscribe(topic, (message: Message) => {
            console.log(`Evento WebSocket monitor recibido [politica=${politicaId}]:`, message.body);
            subject.next(JSON.parse(message.body));
          });
          this.monitorSubscriptions.add(topic);
        }
      }

      // Suscribir todos los topics de formularios empresa pendientes
      for (const [empresaId, subject] of this.formulariosEmpresaSubjects.entries()) {
        const topic = `/topic/empresa/${empresaId}/formularios`;
        if (!this.formulariosSubscriptions.has(topic)) {
          this.client.subscribe(topic, (message: Message) => {
            subject.next(JSON.parse(message.body));
          });
          this.formulariosSubscriptions.add(topic);
        }
      }

      // Suscribir todos los topics de formularios departamento pendientes
      for (const [deptoId, subject] of this.formulariosDeptoSubjects.entries()) {
        const topic = `/topic/departamento/${deptoId}/formularios`;
        if (!this.formulariosSubscriptions.has(topic)) {
          this.client.subscribe(topic, (message: Message) => {
            subject.next(JSON.parse(message.body));
          });
          this.formulariosSubscriptions.add(topic);
        }
      }
    };

    this.client.onDisconnect = () => {
      this.conectando = false;
      console.log('WebSocket desconectado');
      this.monitorSubscriptions.clear();
      this.formulariosSubscriptions.clear();
    };

    this.client.onStompError = (frame) => {
      this.conectando = false;
      console.error('Error STOMP:', frame);
    };

    this.client.onWebSocketError = () => {
      this.conectando = false;
    };

    this.client.activate();
  }

  private ensureConectado(): void {
    if (this.client && this.client.active) return;
    this.conectar();
  }

  private desconectar(): void {
    if (this.client) {
      this.client.deactivate();
    }
    this.monitorSubscriptions.clear();
    this.formulariosSubscriptions.clear();
    this.conectando = false;
  }

  suscribirAMonitor(politicaId: string): Observable<any> {
    this.ensureConectado();

    if (!this.monitorSubjects.has(politicaId)) {
      this.monitorSubjects.set(politicaId, new Subject<any>());
    }

    const monitorSubject = this.monitorSubjects.get(politicaId)!;
    const topic = `/topic/politica/${politicaId}`;

    if (this.client && this.client.connected && !this.monitorSubscriptions.has(topic)) {
      this.client.subscribe(topic, (message: Message) => {
        console.log(`Evento WebSocket monitor recibido [politica=${politicaId}]:`, message.body);
        monitorSubject.next(JSON.parse(message.body));
      });
      this.monitorSubscriptions.add(topic);
    }
    // Si no está conectado, el subject ya está en monitorSubjects y se suscribirá en onConnect

    return monitorSubject.asObservable();
  }

  getNotificaciones(): Observable<any> {
    return this.notificacionesSubject.asObservable();
  }

  suscribirAFormulariosEmpresa(empresaId: string): Observable<any> {
    this.ensureConectado();

    if (!this.formulariosEmpresaSubjects.has(empresaId)) {
      this.formulariosEmpresaSubjects.set(empresaId, new Subject<any>());
    }

    const subject = this.formulariosEmpresaSubjects.get(empresaId)!;
    const topic = `/topic/empresa/${empresaId}/formularios`;

    if (this.client && this.client.connected && !this.formulariosSubscriptions.has(topic)) {
      this.client.subscribe(topic, (message: Message) => {
        subject.next(JSON.parse(message.body));
      });
      this.formulariosSubscriptions.add(topic);
    }

    return subject.asObservable();
  }

  suscribirAFormulariosDepartamento(departamentoId: string): Observable<any> {
    this.ensureConectado();

    if (!this.formulariosDeptoSubjects.has(departamentoId)) {
      this.formulariosDeptoSubjects.set(departamentoId, new Subject<any>());
    }

    const subject = this.formulariosDeptoSubjects.get(departamentoId)!;
    const topic = `/topic/departamento/${departamentoId}/formularios`;

    if (this.client && this.client.connected && !this.formulariosSubscriptions.has(topic)) {
      this.client.subscribe(topic, (message: Message) => {
        subject.next(JSON.parse(message.body));
      });
      this.formulariosSubscriptions.add(topic);
    }

    return subject.asObservable();
  }
}
