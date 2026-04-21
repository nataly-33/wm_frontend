import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { finalize, timeout } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { Tramite, TramiteService } from '../../../../core/services/tramite.service';

@Component({
  selector: 'app-tramites-admin-depto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tramites.component.html',
  styleUrls: ['./tramites.component.scss']
})
export class TramitesComponent implements OnInit {
  tramites: Tramite[] = [];
  cargando = false;
  error: string | null = null;

  constructor(private authService: AuthService, private tramiteService: TramiteService) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user?.departamentoId) {
      this.error = 'No se encontró departamento para el usuario actual';
      return;
    }

    this.cargando = true;
    this.tramiteService
      .listarPorDepartamento(user.departamentoId)
      .pipe(
        timeout(15000),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (res) => {
          this.tramites = res.data ?? [];
        },
        error: (err) => {
          this.error = err?.error?.message ?? 'No se pudieron cargar los trámites';
        }
      });
  }
}
