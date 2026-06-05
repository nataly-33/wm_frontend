import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DocumentoService } from '../../../../../core/services/documento.service';

@Component({
  selector: 'app-editor-onlyoffice',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="editor-page">
      <div class="editor-topbar">
        <button class="btn-volver" (click)="volver()">
          <span class="icon-back">&#8592;</span> Volver
        </button>
        <span class="editor-titulo">{{ tituloDoc }}</span>
      </div>
      <div *ngIf="cargando" class="editor-estado">
        <div class="spinner"></div>
        <p>Cargando editor...</p>
      </div>
      <div *ngIf="error" class="editor-error">
        <p>{{ error }}</p>
        <button class="btn-volver" (click)="volver()">Volver</button>
      </div>
      <div id="onlyoffice-container" [style.display]="cargando || error ? 'none' : 'block'"
           style="width:100%; height:calc(100vh - 56px);"></div>
    </div>
  `,
  styles: [`
    .editor-page {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100vh;
      background: var(--bg-dark, #1a1a00);
    }
    .editor-topbar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 0 20px;
      height: 56px;
      background: var(--bg-card, #2c2c12);
      border-bottom: 1px solid var(--border, #4a4a1e);
      flex-shrink: 0;
    }
    .btn-volver {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px;
      background: transparent;
      color: var(--primary-200, #9D9D60);
      border: 1px solid var(--border, #4a4a1e);
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }
    .btn-volver:hover {
      background: var(--bg-surface, #1f1f0a);
      border-color: var(--primary-200, #9D9D60);
      color: var(--text-primary, #f0f0e0);
    }
    .editor-titulo {
      font-size: 14px;
      color: var(--text-primary, #f0f0e0);
      font-weight: 500;
    }
    .editor-estado {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: calc(100vh - 56px);
      gap: 16px;
      color: var(--text-muted, #9D9D60);
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border, #4a4a1e);
      border-top-color: var(--primary-200, #9D9D60);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .editor-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: calc(100vh - 56px);
      gap: 16px;
      color: var(--danger, #F44250);
    }
  `]
})
export class EditorOnlyofficeComponent implements OnInit, OnDestroy {
  @Input() documentoId: string = '';
  @Input() modo: 'edit' | 'view' = 'edit';

  /** URL pública de S3 del documento de trámite (cuando esTramite=true en queryParams) */
  urlS3Tramite: string = '';

  cargando = true;
  error: string | null = null;
  tituloDoc = 'Editor de documentos';
  private editor: any;
  private scriptInyectado = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private documentoService: DocumentoService
  ) {}

  ngOnInit(): void {
    // Leer el id desde la ruta si no viene como @Input
    const idRuta = this.route.snapshot.paramMap.get('id');
    if (idRuta) this.documentoId = idRuta;

    const modoRuta = this.route.snapshot.queryParamMap.get('modo');
    if (modoRuta === 'edit' || modoRuta === 'view') this.modo = modoRuta;

    // Detectar si es un documento de trámite (no está en la colección Documento)
    const esTramiteParam = this.route.snapshot.queryParamMap.get('esTramite');
    if (esTramiteParam === 'true') {
      // Recuperar la URL original de S3 del state de navegación (Router)
      const navState = window.history.state as { urlS3Original?: string };
      if (navState?.urlS3Original) {
        this.urlS3Tramite = navState.urlS3Original;
      }
    }

    if (!this.documentoId && !this.urlS3Tramite) {
      this.error = 'No se especificó un documento para editar.';
      this.cargando = false;
      return;
    }

    this.cargarConfigYEditor();
  }

  private cargarConfigYEditor(): void {
    // Si es un documento de trámite, usar el endpoint especial
    const config$ = this.urlS3Tramite
      ? this.documentoService.obtenerConfigOnlyOfficeTramite(this.urlS3Tramite, this.modo)
      : this.documentoService.obtenerConfigOnlyOffice(this.documentoId, this.modo);

    config$.subscribe({
      next: (config) => {
        this.tituloDoc = config.document?.title || 'Editor';
        // Usar scriptUrl del backend (no hardcodeado)
        const scriptUrl = config.scriptUrl;
        if (!scriptUrl) {
          this.error = 'El backend no devolvió la URL del script de OnlyOffice.';
          this.cargando = false;
          return;
        }
        this.inyectarScriptYAbrir(scriptUrl, config);
      },
      error: () => {
        this.error = 'Error al obtener la configuración del documento desde el servidor.';
        this.cargando = false;
      }
    });
  }

  private inyectarScriptYAbrir(scriptUrl: string, config: any): void {
    // Si el script ya fue cargado previamente, inicializar directamente
    if ((window as any).DocsAPI) {
      this.inicializarEditor(config);
      return;
    }

    // Evitar duplicar el script si ya existe en el DOM
    const yaExiste = document.querySelector(`script[src="${scriptUrl}"]`);
    if (yaExiste && !this.scriptInyectado) {
      // Esperar a que cargue
      const interval = setInterval(() => {
        if ((window as any).DocsAPI) {
          clearInterval(interval);
          this.inicializarEditor(config);
        }
      }, 200);
      return;
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    this.scriptInyectado = true;
    script.onload = () => this.inicializarEditor(config);
    script.onerror = () => {
      this.error = 'No se pudo conectar con OnlyOffice. Verifica que Docker esté corriendo en el puerto 8088.';
      this.cargando = false;
    };
    document.head.appendChild(script);
  }

  private inicializarEditor(config: any): void {
    this.cargando = false;
    try {
      // Extraer scriptUrl antes de pasar al DocsAPI (no es un campo del editor config)
      const { scriptUrl, ...editorConfig } = config;
      this.editor = new (window as any).DocsAPI.DocEditor('onlyoffice-container', {
        ...editorConfig,
        height: '100%',
        width: '100%',
        events: {
          onDocumentStateChange: (e: any) => {
            if (e.data) console.log('[OnlyOffice] Documento modificado');
          }
        }
      });
    } catch (e) {
      this.error = 'Error al inicializar el editor OnlyOffice.';
    }
  }

  volver(): void {
    const backUrl = this.route.snapshot.queryParamMap.get('back');
    if (backUrl) {
      this.router.navigateByUrl(backUrl);
    } else {
      window.history.back();
    }
  }

  ngOnDestroy(): void {
    if (this.editor) {
      try { this.editor.destroyEditor(); } catch (e) {}
    }
  }
}
