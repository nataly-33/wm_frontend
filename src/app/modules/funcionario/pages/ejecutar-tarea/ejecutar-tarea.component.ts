import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { finalize, timeout } from 'rxjs';
import {
  EjecucionService,
  VistaFuncionarioResponse,
  CampoFormulario
} from '../../../../core/services/ejecucion.service';
import { AuthService } from '../../../../core/services/auth.service';
import { DocumentoService } from '../../../../core/services/documento.service';
import { NavbarComponent } from '../../../../shared/components/navbar/navbar.component';
import { TablaGridViewerComponent } from '../../../../shared/components/tabla-grid-viewer/tabla-grid-viewer.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-ejecutar-tarea',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule, NavbarComponent, TablaGridViewerComponent, MatIconModule],
  templateUrl: './ejecutar-tarea.component.html',
  styleUrls: ['./ejecutar-tarea.component.scss']
})
export class EjecutarTareaComponent implements OnInit {
  ejecucionId: string | null = null;
  vistaFuncionario: VistaFuncionarioResponse | null = null;
  formFuncionario: FormGroup = new FormGroup({});

  cargando = false;
  guardando = false;
  error: string | null = null;
  userName = '';

  archivosSubidos: Record<string, boolean> = {};
  previewMap: Record<string, string> = {};
  isUploadingMap: Record<string, boolean> = {};

  gridRows: Record<string, Array<Record<string, string>>> = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ejecucionService: EjecucionService,
    private authService: AuthService,
    private http: HttpClient,
    private documentoService: DocumentoService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) this.userName = user.nombre;
    this.ejecucionId = this.route.snapshot.paramMap.get('id');
    if (this.ejecucionId) {
      this.cargarVista(this.ejecucionId);
    }
  }

  cargarVista(id: string): void {
    this.cargando = true;
    this.ejecucionService.obtenerVistaFuncionario(id).pipe(
      timeout(15000),
      finalize(() => this.cargando = false)
    ).subscribe({
      next: (vista) => {
        this.vistaFuncionario = vista;
        this.construirFormFuncionario(vista.camposFuncionario);
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'No se pudo cargar la vista del funcionario';
      }
    });
  }

  construirFormFuncionario(campos: CampoFormulario[]): void {
    const controls: Record<string, FormControl> = {};
    this.gridRows = {};
    campos.forEach((campo) => {
      const validators = campo.requerido ? [Validators.required] : [];
      if (campo.tipo === 'CHECKBOX') {
        controls[campo.nombre] = new FormControl([], validators);
      } else if (campo.tipo === 'TABLA_GRID') {
        const cols = campo.columnasGrid ?? [];
        this.gridRows[campo.nombre] = [];
        if (cols.length > 0) {
          this.agregarFilaGrid(campo.nombre, cols);
        }
        controls[campo.nombre] = new FormControl([], validators);
      } else if (campo.tipo === 'ETIQUETA') {
        // No se agrega control para etiquetas
      } else {
        controls[campo.nombre] = new FormControl('', validators);
      }
    });
    this.formFuncionario = new FormGroup(controls);
  }

  toggleCheckbox(nombreCampo: string, opcion: string, checked: boolean): void {
    const control = this.formFuncionario.get(nombreCampo);
    if (!control) return;
    const current: string[] = control.value ?? [];
    if (checked) {
      control.setValue([...current, opcion]);
    } else {
      control.setValue(current.filter((v) => v !== opcion));
    }
    control.markAsDirty();
  }

  isChecked(nombreCampo: string, opcion: string): boolean {
    const val: string[] = this.formFuncionario.get(nombreCampo)?.value ?? [];
    return val.includes(opcion);
  }

  subirArchivoFuncionario(event: Event, nombreCampo: string): void {
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
        this.formFuncionario.get(nombreCampo)?.setValue(response.url);
        this.isUploadingMap[nombreCampo] = false;
        this.archivosSubidos[nombreCampo] = true;
        this.previewMap[nombreCampo] = archivo.type.startsWith('image/')
          ? URL.createObjectURL(archivo)
          : archivo.name;
      },
      error: () => {
        this.isUploadingMap[nombreCampo] = false;
        this.error = 'Error al subir el archivo. Verifica el tamano (max. 10MB).';
      }
    });
  }

  agregarFilaGrid(nombreCampo: string, columnas: string[]): void {
    if (!this.gridRows[nombreCampo]) this.gridRows[nombreCampo] = [];
    const filaVacia: Record<string, string> = {};
    columnas.forEach((col) => (filaVacia[col] = ''));
    this.gridRows[nombreCampo].push(filaVacia);
    this.sincronizarGrid(nombreCampo);
  }

  quitarFilaGrid(nombreCampo: string, index: number): void {
    this.gridRows[nombreCampo]?.splice(index, 1);
    this.sincronizarGrid(nombreCampo);
  }

  sincronizarGrid(nombreCampo: string): void {
    this.formFuncionario.get(nombreCampo)?.setValue([...(this.gridRows[nombreCampo] ?? [])]);
  }

  aprobar(): void {
    if (!this.ejecucionId) return;
    if (this.formFuncionario.invalid) {
      this.formFuncionario.markAllAsTouched();
      this.error = 'Completa los campos requeridos antes de aprobar';
      return;
    }
    this.guardando = true;
    this.ejecucionService.funcionarioCompletar(this.ejecucionId, this.formFuncionario.value).subscribe({
      next: () => { this.router.navigate(['/funcionario/tareas']); },
      error: (err) => {
        this.error = err?.error?.mensaje ?? err?.error?.message ?? 'Error al aprobar la tarea';
        this.guardando = false;
      }
    });
  }

  rechazar(): void {
    if (!this.ejecucionId) return;
    if (!confirm('¿Seguro que deseas rechazar esta tarea? Esta accion no se puede deshacer.')) return;
    this.guardando = true;
    const campoPrioridad = this.vistaFuncionario?.camposFuncionario.find((c) => c.esCampoPrioridad);
    const respuestas = campoPrioridad
      ? { ...this.formFuncionario.value, [campoPrioridad.nombre]: 'Rechazado' }
      : { resultado: 'Rechazado' };
    this.ejecucionService.funcionarioCompletar(this.ejecucionId, respuestas).subscribe({
      next: () => { this.router.navigate(['/funcionario/tareas']); },
      error: (err) => {
        this.error = err?.error?.mensaje ?? err?.error?.message ?? 'Error al rechazar la tarea';
        this.guardando = false;
      }
    });
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) img.style.display = 'none';
  }

  getValorTexto(valor: any): string {
    if (Array.isArray(valor)) return valor.join(', ');
    if (valor === null || valor === undefined) return '';
    return String(valor);
  }

  /**
   * Resuelve la URL de visualizacion/descarga pasandola por el proxy del backend.
   * Para archivos locales (ruta relativa /api/v1/archivos/) prepend el apiUrl del backend
   * para que el navegador no intente cargarlos desde el origen del frontend (puerto 4200).
   * Para archivos en S3 (URL http/https), pasa por el proxy /ver que genera la URL pre-firmada.
   */
  urlVer(url: string): string {
    if (!url) return '';
    // Archivos locales: la ruta relativa apunta al backend, hay que agregar el host
    if (url.startsWith('/api/v1/archivos/') && !url.startsWith('/api/v1/archivos/ver')) {
      return `${environment.apiUrl}${url}`;
    }
    // URL ya absoluta y local (mismo origen del backend): devolver tal cual
    if (url.startsWith(environment.apiUrl)) {
      return url;
    }
    // URL http/https externas (S3, Azure, simuladas): pasar por el proxy del backend
    if (url.startsWith('http')) {
      return `${environment.apiUrl}/api/v1/archivos/ver?url=${encodeURIComponent(url)}`;
    }
    return url;
  }

  esArchivoOficina(url: string): boolean {
    if (!url) return false;
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || '';
    return ['docx','xlsx','pptx','odt','ods','odp','doc','xls','ppt'].includes(ext);
  }

  abrirEditorOnlyOffice(urlArchivo: string): void {
    this.documentoService.buscarPorUrl(urlArchivo).subscribe({
      next: (doc) => {
        if (doc.esTramite && doc.urlPresignada) {
          // Documento de trámite: pasar URL original en state para que el editor
          // use el endpoint /api/v1/onlyoffice/config-tramite con URL presignada
          this.router.navigate(['/editor-documento', doc.id], {
            queryParams: { modo: 'edit', esTramite: 'true' },
            state: { urlS3Original: urlArchivo }
          });
        } else {
          this.router.navigate(['/editor-documento', doc.id], { queryParams: { modo: 'edit' } });
        }
      },
      error: () => {
        window.open(urlArchivo, '_blank');
      }
    });
  }
}
