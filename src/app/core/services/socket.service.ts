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
  private notificacionesSubject = new Subject<any>();
  private monitorSubjects = new Map<string, Subject<any>>();
  private monitorSubscriptions = new Set<string>();

  constructor(private authService: AuthService) {
    this.conectar();
  }

  private conectar(): void {
    const token = this.authService.getToken(); 
    if (!token) return;

    this.client = new Client({
      webSocketFactory: () => new SockJS(`${environment.apiUrl}/ws`),
      debug: (str) => {
        // console.log(str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    this.client.onConnect = () => {
      const user = this.authService.getCurrentUser();
      if (user) {
        // Suscribirse a notificaciones personales
        this.client.subscribe(`/topic/usuario/${user.id}`, (message: Message) => {
          this.notificacionesSubject.next(JSON.parse(message.body));
        });
      }
    };

    this.client.activate();
  }

  suscribirAMonitor(politicaId: string): Observable<any> {
    if (!this.monitorSubjects.has(politicaId)) {
      this.monitorSubjects.set(politicaId, new Subject<any>());
    }

    const monitorSubject = this.monitorSubjects.get(politicaId)!;
    const topic = `/topic/politica/${politicaId}`;

    const intentarSuscripcion = () => {
      if (this.client && this.client.connected && !this.monitorSubscriptions.has(topic)) {
        this.client.subscribe(topic, (message: Message) => {
          monitorSubject.next(JSON.parse(message.body));
        });
        this.monitorSubscriptions.add(topic);
      }
    };

    if (this.client && this.client.connected) {
      intentarSuscripcion();
    } else {
      setTimeout(() => {
        intentarSuscripcion();
      }, 2000);
    }

    return monitorSubject.asObservable();
  }

  getNotificaciones(): Observable<any> {
    return this.notificacionesSubject.asObservable();
  }
}
