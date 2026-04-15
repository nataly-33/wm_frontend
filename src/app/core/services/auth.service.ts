import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegistroRequest, User } from '../models/auth.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private userSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());

  constructor(private http: HttpClient) {
    // Intentar recuperar el usuario del localStorage
    const storedUser = this.getUserFromStorage();
    if (storedUser) {
      this.userSubject.next(storedUser);
    }
  }

  /**
   * Registrar nueva empresa y admin
   */
  registro(request: RegistroRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/api/v1/auth/registro`, request);
  }

  /**
   * Login del usuario
   */
  login(request: LoginRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/api/v1/auth/login`, request);
  }

  /**
   * Guardar JWT y usuario en localStorage
   */
  saveCredentials(response: AuthResponse): void {
    localStorage.setItem('jwt_token', response.token);
    const user: User = {
      id: response.id,
      nombre: response.nombre,
      email: response.email,
      rol: response.rol,
      empresaId: response.empresaId,
      departamentoId: response.departamentoId
    };
    localStorage.setItem('user', JSON.stringify(user));
    this.userSubject.next(user);
  }

  /**
   * Obtener el JWT del localStorage
   */
  getToken(): string | null {
    return localStorage.getItem('jwt_token');
  }

  /**
   * Obtener el usuario actual
   */
  getCurrentUser(): User | null {
    return this.userSubject.value;
  }

  /**
   * Observable del usuario actual
   */
  getCurrentUser$(): Observable<User | null> {
    return this.userSubject.asObservable();
  }

  /**
   * Obtener rol del usuario actual
   */
  getRol(): string | null {
    const user = this.getCurrentUser();
    return user ? user.rol : null;
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Logout
   */
  logout(): void {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    this.userSubject.next(null);
  }

  /**
   * Recuperar usuario del localStorage
   */
  private getUserFromStorage(): User | null {
    const userJson = localStorage.getItem('user');
    if (!userJson) {
      return null;
    }

    try {
      return JSON.parse(userJson) as User;
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  }
}
