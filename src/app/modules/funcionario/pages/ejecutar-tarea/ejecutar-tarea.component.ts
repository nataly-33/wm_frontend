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
  // Para GRID: filas de datos, indexadas por nombre del campo
  gridRows: Record<string, Array<Record<string, string>>> = {};
  // Para CHECKBOX: las opciones seleccionadas como Set
  checkboxSets: Record<string, Set<string>> = {};
  // Estado de sugerencia IA por campo
  sugeriendo: Record<string, boolean> = {};

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
        this.formulario = null;
        this.respuesta = {};
      }
    });
  }

  private inicializarRespuestas(campos: FormularioCampo[]): void {
    this.respuesta = {};
    this.gridRows = {};
    this.checkboxSets = {};
    campos.forEach((campo) => {
      switch (campo.tipo) {
        case 'CHECKBOX':
          this.checkboxSets[campo.nombre] = new Set<string>();
          this.respuesta[campo.nombre] = [];
          break;
        case 'GRID': {
          const cols = campo.columnas ?? [];
          this.gridRows[campo.nombre] = [];
          if (cols.length > 0) {
            this.agregarFilaGrid(campo.nombre, cols);
          }
          this.respuesta[campo.nombre] = [];
          break;
        }
        case 'ETIQUETA':
          // No se guarda valor
          break;
        default:
          this.respuesta[campo.nombre] = '';
      }
    });
  }

  // ─── GRID helpers ────────────────────────────────────────────────
  agregarFilaGrid(nombreCampo: string, columnas: string[]): void {
    if (!this.gridRows[nombreCampo]) this.gridRows[nombreCampo] = [];
    const filaVacia: Record<string, string> = {};
    columnas.forEach(col => filaVacia[col] = '');
    this.gridRows[nombreCampo].push(filaVacia);
  }

  quitarFilaGrid(nombreCampo: string, index: number): void {
    this.gridRows[nombreCampo]?.splice(index, 1);
    this.sincronizarGrid(nombreCampo);
  }

  sincronizarGrid(nombreCampo: string): void {
    this.respuesta[nombreCampo] = [...(this.gridRows[nombreCampo] ?? [])];
  }

  // ─── CHECKBOX helpers ─────────────────────────────────────────────
  toggleCheckbox(nombreCampo: string, opcion: string): void {
    const set = this.checkboxSets[nombreCampo] ?? new Set<string>();
    if (set.has(opcion)) {
      set.delete(opcion);
    } else {
      set.add(opcion);
    }
    this.checkboxSets[nombreCampo] = set;
    this.respuesta[nombreCampo] = Array.from(set);
  }

  isChecked(nombreCampo: string, opcion: string): boolean {
    return this.checkboxSets[nombreCampo]?.has(opcion) ?? false;
  }

  // ─── Sugerir con IA ──────────────────────────────────────────────
  sugerirCampo(campo: FormularioCampo): void {
    this.sugeriendo[campo.nombre] = true;
    this.http.post<{ sugerencia: string }>(
      `${environment.apiUrl}/api/v1/ia/sugerir-campo`,
      {
        nombre_campo: campo.nombre,
        tipo_nodo: this.tarea?.nombreNodo ?? '',
        nombre_politica: this.tarea?.nombrePolitica ?? '',
        contexto: this.respuesta[campo.nombre] ?? ''
      }
    ).pipe(finalize(() => this.sugeriendo[campo.nombre] = false))
    .subscribe({
      next: (r) => {
        if (r.sugerencia) {
          this.respuesta[campo.nombre] = r.sugerencia;
        }
      },
      error: () => {} // silencioso
    });
  }

  // ─── Completar / Rechazar ─────────────────────────────────────────
  completar(): void {
    if (!this.tareaId) return;
    const payload = { ...this.respuesta };
    if (!this.formulario && this.decisionManual.trim()) {
      payload['decision'] = this.decisionManual.trim();
    }
    this.guardando = true;
    this.ejecucionService.completar(this.tareaId, payload).subscribe({
      next: () => { this.router.navigate(['/funcionario/tareas']); },
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
      next: () => { this.router.navigate(['/funcionario/tareas']); },
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
        this.previewMap[nombreCampo] = archivo.type.startsWith('image/')
          ? URL.createObjectURL(archivo)
          : archivo.name;
      },
      error: () => {
        this.isUploadingMap[nombreCampo] = false;
        this.error = 'Error al subir el archivo. Verifica el tamaño (max. 10MB).';
      }
    });
  }
}
