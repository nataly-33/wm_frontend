export interface AuthResponse {
  token: string;
  id: string;
  nombre: string;
  email: string;
  rol: string;
  empresaId?: string;
  departamentoId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegistroRequest {
  nombreEmpresa: string;
  nombreAdmin: string;
  email: string;
  password: string;
}

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  empresaId?: string;
  departamentoId?: string;
}
