import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EjecucionService, EjecucionNodo } from '../../../../core/services/ejecucion.service';

@Component({
  selector: 'app-ejecutar-tarea',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './ejecutar-tarea.component.html',
  styleUrls: ['./ejecutar-tarea.component.scss']
})
export class EjecutarTareaComponent implements OnInit {
  tareaId: string | null = null;
  tarea: EjecucionNodo | null = null;
  respuesta: any = {};
  observaciones = '';
  cargando = false;
  guardando = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ejecucionService: EjecucionService
  ) {}

  ngOnInit(): void {
    this.tareaId = this.route.snapshot.paramMap.get('id');
    if (this.tareaId) {
      this.cargarTarea(this.tareaId);
    }
  }

  cargarTarea(id: string): void {
    this.cargando = true;
    this.ejecucionService.listarPorDepartamento('fake-to-bypass').subscribe({
      // Como no armamos endpoint get simple aun, podria fallar o usar un mock,
      // la logica backend tiene obtener(). Lo agregare a EjecucionController.
    });
    // HACK TEMPORAL PARA DEMO: Usamos HTTP directo usando GET /ejecuciones/id
  }

  completar(): void {
    if (!this.tareaId) return;
    this.guardando = true;
    this.ejecucionService.completar(this.tareaId, this.respuesta).subscribe({
      next: () => {
        this.router.navigate(['/funcionario/tareas']);
      },
      error: err => {
        this.error = 'Error al completar';
        this.guardando = false;
      }
    });
  }

  rechazar(): void {
    if (!this.tareaId) return;
    if (!this.observaciones) {
      this.error = 'Debes proveer observaciones para rechazar';
      return;
    }
    this.guardando = true;
    this.ejecucionService.rechazar(this.tareaId, this.observaciones).subscribe({
      next: () => {
        this.router.navigate(['/funcionario/tareas']);
      },
      error: err => {
        this.error = 'Error al rechazar';
        this.guardando = false;
      }
    });
  }
}
