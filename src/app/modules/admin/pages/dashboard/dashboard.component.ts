import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { DepartamentoService } from '../../../../core/services/departamento.service';
import { UsuarioService } from '../../../../core/services/usuario.service';
import { ApiResponse } from '../../../../core/models/api-response.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  providers: [DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  userName: string = '';
  totalDepartamentos = 0;
  totalUsuarios = 0;
  cargando = true;
  today = new Date();

  constructor(
    private authService: AuthService,
    private deptoService: DepartamentoService,
    private usuarioService: UsuarioService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName = user.nombre;
    }
    this.cargarMetricas();
  }

  cargarMetricas(): void {
    this.deptoService.listar().subscribe({
      next: (res: ApiResponse<unknown[]>) => {
        this.totalDepartamentos = (res.data ?? []).length;
        this.cargando = false;
      },
      error: () => { this.cargando = false; }
    });

    this.usuarioService.listar().subscribe({
      next: (res: ApiResponse<unknown[]>) => {
        this.totalUsuarios = (res.data ?? []).length;
      },
      error: () => {}
    });
  }
}
