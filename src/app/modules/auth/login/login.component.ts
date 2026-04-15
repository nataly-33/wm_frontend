import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AuthResponse, LoginRequest, RegistroRequest } from '../../../core/models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  registroForm!: FormGroup;
  isLoading = false;
  error: string | null = null;
  showRegistro = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeForms();
  }

  initializeForms(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.registroForm = this.fb.group({
      nombreEmpresa: ['', [Validators.required, Validators.minLength(3)]],
      nombreAdmin: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  toggleForm(): void {
    this.showRegistro = !this.showRegistro;
    this.error = null;
  }

  onLogin(): void {
    if (this.loginForm.invalid) {
      this.error = 'Por favor completa los campos correctamente';
      return;
    }

    this.isLoading = true;
    this.error = null;

    const request: LoginRequest = this.loginForm.value;

    this.authService.login(request).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.data) {
          this.authService.saveCredentials(response.data);
          this.redirectBasedOnRole(response.data.rol);
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        if (error.error && error.error.message) {
          this.error = error.error.message;
        } else if (error.status === 400) {
          this.error = 'Email o contraseña incorrectos';
        } else {
          this.error = 'Error al iniciar sesión. Intenta de nuevo.';
        }
      }
    });
  }

  onRegistro(): void {
    if (this.registroForm.invalid) {
      this.error = 'Por favor completa los campos correctamente';
      return;
    }

    this.isLoading = true;
    this.error = null;

    const request: RegistroRequest = this.registroForm.value;

    this.authService.registro(request).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.data) {
          this.authService.saveCredentials(response.data);
          this.redirectBasedOnRole(response.data.rol);
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        if (error.error && error.error.message) {
          this.error = error.error.message;
        } else if (error.status === 409) {
          this.error = 'El email ya está registrado';
        } else {
          this.error = 'Error al registrarse. Intenta de nuevo.';
        }
      }
    });
  }

  private redirectBasedOnRole(rol: string): void {
    switch (rol) {
      case 'ADMIN_GENERAL':
        this.router.navigate(['/admin']);
        break;
      case 'ADMIN_DEPARTAMENTO':
        this.router.navigate(['/admin-depto']);
        break;
      case 'FUNCIONARIO':
        this.router.navigate(['/funcionario']);
        break;
      default:
        this.router.navigate(['/login']);
    }
  }
}
