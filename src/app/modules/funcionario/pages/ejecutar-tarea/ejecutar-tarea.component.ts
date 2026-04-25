import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize, timeout } from 'rxjs';
import { EjecucionService, EjecucionNodo } from '../../../../core/services/ejecucion.service';
import { Formulario, FormularioCampo, FormularioService } from '../../../../core/services/formulario.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NavbarComponent } from '../../../../shared/components/navbar/navbar.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-ejecutar-tarea',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NavbarComponent],
  templateUrl: './ejecutar-tarea.component.html',
  styleUrls: ['./ejecutar-tarea.component.scss']
})
export class EjecutarTareaComponent implements OnInit {
  tareaId: string | null = null;
  tarea: EjecucionNodo | null = null;
  formulario: Formulario | null = null;
  respuesta: Record<string, any> = {};
  decisionManual = '';
  observaciones = '';
  cargando = false;
  cargandoFormulario = false;
  guardando = false;
  error: string | null = null;
  userName = '';

  isUploadingMap: Record<string, boolean> = {};
  previewMap: Record<string, string> = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ejecucionService: EjecucionService,
    private formularioService: FormularioService,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) this.userName = user.nombre;
    this.tareaId = this.route.snapshot.paramMap.get('id');
    if (this.tareaId) {
      this.cargarTarea(this.tareaId);
    }
  }

  cargarTarea(id: string): void {
    this.cargando = true;
    this.ejecucionService.obtener(id).pipe(
      timeout(15000),
      finalize(() => this.cargando = false)
    ).subscribe({
      next: (res) => {
        this.tarea = res.data ?? null;
        if (!this.tarea) {
          this.error = 'No se encontró la tarea';
          return;
        }

        this.ejecucionService.iniciar(id).subscribe();
        this.cargarFormulario(this.tarea.nodoId);
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'No se pudo cargar la tarea';
      }
    });
  }

  cargarFormulario(nodoId: string): void {
    this.cargandoFormulario = true;
    this.formularioService.obtenerPorNodo(nodoId).pipe(
      timeout(15000),
      finalize(() => this.cargandoFormulario = false)
    ).subscribe({
      next: (res) => {
        this.formulario = res.data ?? null;
        this.inicializarRespuestas(this.formulario?.campos ?? []);
      },
      error: () => {
        // Si no hay formulario para el nodo, se habilita campo manual de decision.
        this.formulario = null;
        this.respuesta = {};
      }
    });
  }

  private inicializarRespuestas(campos: FormularioCampo[]): void {
    this.respuesta = {};
    campos.forEach((campo) => {
      this.respuesta[campo.nombre] = campo.tipo === 'SELECCION' ? '' : '';
    });
  }

  completar(): void {
    if (!this.tareaId) return;

    const payload = { ...this.respuesta };
    if (!this.formulario && this.decisionManual.trim()) {
      payload['decision'] = this.decisionManual.trim();
    }

    this.guardando = true;
    this.ejecucionService.completar(this.tareaId, payload).subscribe({
      next: () => {
        this.router.navigate(['/funcionario/tareas']);
      },
      error: () => {
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
      error: () => {
        this.error = 'Error al rechazar';
        this.guardando = false;
      }
    });
  }

  subirArchivo(event: Event, nombreCampo: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const archivo = input.files[0];
    const formData = new FormData();
    formData.append('archivo', archivo);

    this.isUploadingMap[nombreCampo] = true;
    this.error = null;

    this.http.post<{ url: string; nombreOriginal: string; tipo: string }>(
      `${environment.apiUrl}/api/v1/archivos/subir`,
      formData
    ).subscribe({
      next: (response) => {
        this.respuesta[nombreCampo] = response.url;
        this.isUploadingMap[nombreCampo] = false;
        if (archivo.type.startsWith('image/')) {
          this.previewMap[nombreCampo] = URL.createObjectURL(archivo);
        } else {
          this.previewMap[nombreCampo] = archivo.name;
        }
      },
      error: () => {
        this.isUploadingMap[nombreCampo] = false;
        this.error = 'Error al subir el archivo. Verifica el tamaño (max. 10MB).';
      }
    });
  }
}
