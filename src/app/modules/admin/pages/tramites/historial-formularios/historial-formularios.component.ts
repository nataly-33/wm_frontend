import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { EjecucionService, NodoHistorial } from '../../../../../core/services/ejecucion.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { DocumentoService } from '../../../../../core/services/documento.service';
import { TablaGridViewerComponent } from '../../../../../shared/components/tabla-grid-viewer/tabla-grid-viewer.component';
import { environment } from '../../../../../../environments/environment';

@Component({
  selector: 'app-historial-formularios',
  standalone: true,
  imports: [CommonModule, RouterModule, TablaGridViewerComponent, MatIconModule],
  templateUrl: './historial-formularios.component.html',
  styleUrls: ['./historial-formularios.component.scss']
})
export class HistorialFormulariosComponent implements OnInit {
  tramiteId = '';
  historial: NodoHistorial[] = [];
  cargando = true;
  error: string | null = null;
  backUrl = '/admin/tramites';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ejecucionService: EjecucionService,
    private authService: AuthService,
    private documentoService: DocumentoService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      if (user.rol === 'CLIENTE') {
        this.backUrl = '/cliente/mis-tramites';
      } else if (user.rol === 'FUNCIONARIO') {
        this.backUrl = '/funcionario/tareas';
      } else if (user.rol === 'ADMIN_DEPARTAMENTO') {
        this.backUrl = '/admin-depto/tramites';
      }
    }

    this.tramiteId =
      this.route.snapshot.paramMap.get('tramiteId') ||
      this.route.snapshot.paramMap.get('id') ||
      '';
    if (this.tramiteId) {
      this.cargar();
    } else {
      this.cargando = false;
    }
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.ejecucionService.historialFormularios(this.tramiteId).subscribe({
      next: (data) => {
        this.historial = data;
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el historial de formularios.';
        this.cargando = false;
      }
    });
  }

  /**
   * Resuelve la URL pasandola por el proxy del backend para soportar
   * buckets S3 privados y URLs pre-firmadas automaticamente.
   * Para archivos locales (ruta relativa) agrega el host del backend para
   * evitar que el navegador los pida al servidor del frontend.
   */
  urlVer(url: string): string {
    if (!url) return '';
    // Archivos locales: ruta relativa apunta al backend, agregar host
    if (url.startsWith('/api/v1/archivos/') && !url.startsWith('/api/v1/archivos/ver')) {
      return `${environment.apiUrl}${url}`;
    }
    // URL ya absoluta con el backend: devolver tal cual
    if (url.startsWith(environment.apiUrl)) {
      return url;
    }
    // URL http/https externas (S3, Azure, simuladas): pasar por el proxy
    if (url.startsWith('http')) {
      return `${environment.apiUrl}/api/v1/archivos/ver?url=${encodeURIComponent(url)}`;
    }
    return url;
  }

  descargarArchivo(url: string): void {
    window.open(this.urlVer(url), '_blank');
  }

  exportarPDF(): void {
    window.print();
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'COMPLETADA': return 'badge badge-completado';
      case 'RECHAZADA':  return 'badge badge-rechazado';
      case 'ESPERANDO_FUNCIONARIO': return 'badge badge-en-proceso';
      case 'ESPERANDO_CLIENTE': return 'badge badge-pendiente';
      default: return 'badge badge-pendiente';
    }
  }

  formatFecha(fecha: string | undefined | null): string {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleString('es-BO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  esDecision(nombre: string): boolean {
    return nombre.includes('resultado') || nombre.includes('decision');
  }

  esArchivoOficina(url: string): boolean {
    if (!url) return false;
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || '';
    return ['docx','xlsx','pptx','odt','ods','odp','doc','xls','ppt'].includes(ext);
  }

  abrirEditorOnlyOffice(urlArchivo: string): void {
    // Buscar el documento por URL en el backend
    this.documentoService.buscarPorUrl(urlArchivo).subscribe({
      next: (doc) => {
        if (doc.esTramite && doc.urlPresignada) {
          // Documento de trámite: navegar con la URL pre-firmada en el state
          // El editor usará el endpoint /api/v1/onlyoffice/config-tramite
          this.router.navigate(['/editor-documento', doc.id], {
            queryParams: { modo: 'edit', back: this.router.url, esTramite: 'true' },
            state: { urlS3Original: urlArchivo }
          });
        } else {
          // Documento normal en la colección Documento
          this.router.navigate(['/editor-documento', doc.id], {
            queryParams: { modo: 'edit', back: this.router.url }
          });
        }
      },
      error: () => {
        // Si no está en ninguna colección, abrir en nueva ventana como fallback
        window.open(urlArchivo, '_blank');
      }
    });
  }
}
