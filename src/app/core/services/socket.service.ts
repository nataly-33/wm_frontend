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
  private monitorSubject = new Subject<any>();

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
    if (this.client && this.client.connected) {
      this.client.subscribe(`/topic/politica/${politicaId}`, (message: Message) => {
        this.monitorSubject.next(JSON.parse(message.body));
      });
    } else {
      // Reintentar o poner callbacks si no esta listo
      setTimeout(() => {
        if (this.client && this.client.connected) {
          this.client.subscribe(`/topic/politica/${politicaId}`, (message: Message) => {
            this.monitorSubject.next(JSON.parse(message.body));
          });
        }
      }, 2000);
    }
    return this.monitorSubject.asObservable();
  }

  getNotificaciones(): Observable<any> {
    return this.notificacionesSubject.asObservable();
  }
}
