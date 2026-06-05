import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DocumentoService, DocumentoResponse } from '../../../../core/services/documento.service';
import { AuthService } from '../../../../core/services/auth.service';

interface TipoOficina {
  tipo: string;
  icono: string;
  etiqueta: string;
  color: string;
}

@Component({
  selector: 'app-documentos',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, MatIconModule],
  template: `
    <div class="doc-page">

      <!-- HEADER -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Gestión Documental</h1>
          <p class="page-subtitle">Documentos del sistema — {{ documentos.length }} archivo(s)</p>
        </div>
        <div class="header-acciones">
          <div class="search-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input type="text" [(ngModel)]="filtroTexto" placeholder="Buscar documentos..."
              class="search-input" (input)="filtrar()">
          </div>
          <button class="btn btn-primary" (click)="abrirSubir()">
            <mat-icon>upload_file</mat-icon>
            Subir archivo
          </button>
        </div>
      </div>

      <!-- ALERTS -->
      <div *ngIf="error" class="alerta-error">
        <mat-icon>error_outline</mat-icon>
        {{ error }}
        <button class="btn-close-alert" (click)="error = null">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div *ngIf="msgExito" class="alerta-exito">
        <mat-icon>check_circle</mat-icon>
        {{ msgExito }}
        <button class="btn-close-alert" (click)="msgExito = null">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- ============================
           SECCION: CREAR DOCUMENTO NUEVO (solo admin)
           ============================ -->
      <div class="seccion-crear">
        <div class="seccion-crear-header">
          <mat-icon class="seccion-icono">add_circle_outline</mat-icon>
          <h2 class="seccion-titulo">Crear documento nuevo</h2>
        </div>
        <p class="seccion-desc">Crea un documento en blanco y ábrelo directamente en el editor OnlyOffice.</p>

        <div class="tipos-grid">
          <button *ngFor="let t of tiposOficina" class="tipo-btn"
                  [class.creando]="creandoTipo === t.tipo"
                  (click)="solicitarCrearDocumento(t)">
            <mat-icon class="tipo-icono" [style.color]="t.color">{{ t.icono }}</mat-icon>
            <span class="tipo-label">{{ t.etiqueta }}</span>
            <span class="tipo-ext">.{{ t.tipo }}</span>
            <div *ngIf="creandoTipo === t.tipo" class="tipo-spinner"></div>
          </button>
        </div>
      </div>

      <!-- Modal nombre documento -->
      <div *ngIf="mostrarModalNombre" class="modal-overlay" (click)="cancelarCrear()">
        <div class="modal-dialog" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>
              <mat-icon>{{ tipoSeleccionado?.icono }}</mat-icon>
              Nuevo {{ tipoSeleccionado?.etiqueta }}
            </h2>
            <button class="btn-close-modal" (click)="cancelarCrear()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="modal-form">
            <div class="form-group">
              <label class="form-label">Nombre del documento</label>
              <input type="text" [(ngModel)]="nombreNuevoDoc"
                     placeholder="Ej: Informe mensual"
                     class="form-input"
                     (keyup.enter)="confirmarCrear()">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="cancelarCrear()">Cancelar</button>
            <button class="btn btn-primary" (click)="confirmarCrear()"
                    [disabled]="!nombreNuevoDoc.trim() || !!creandoTipo">
              <mat-icon>open_in_new</mat-icon>
              {{ creandoTipo ? 'Creando...' : 'Crear y abrir' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ============================
           SECCION: DOCUMENTOS DE OFICINA
           ============================ -->
      <div class="seccion-docs" *ngIf="docsOficina.length > 0">
        <div class="seccion-titulo-row">
          <mat-icon class="seccion-icono">description</mat-icon>
          <h2 class="seccion-titulo">Documentos de oficina</h2>
          <span class="badge-count">{{ docsOficina.length }}</span>
        </div>

        <div class="docs-grid">
          <div *ngFor="let doc of docsOficina" class="doc-card">
            <div class="doc-card-icon">
              <mat-icon [style.color]="getColorTipo(doc.tipoDocumento)">{{ getIconoTipo(doc.tipoDocumento) }}</mat-icon>
            </div>
            <div class="doc-card-info">
              <span class="doc-nombre">{{ doc.nombre }}</span>
              <span class="doc-meta">v{{ doc.version }} · {{ doc.creadoEn | date:'dd/MM/yy HH:mm' }}</span>
            </div>
            <div class="doc-card-acciones">
              <button class="btn-accion btn-editar" (click)="abrirEditor(doc.id)" title="Editar en OnlyOffice">
                <mat-icon>edit</mat-icon>
              </button>
              <button class="btn-accion btn-ver" (click)="verDocumento(doc)" title="Ver/Descargar">
                <mat-icon>open_in_new</mat-icon>
              </button>
              <button class="btn-accion btn-eliminar" (click)="eliminarDocumento(doc)" title="Eliminar documento">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================
           SECCION: TODOS LOS DOCUMENTOS
           ============================ -->
      <div class="seccion-docs">
        <div class="seccion-titulo-row">
          <mat-icon class="seccion-icono">folder_open</mat-icon>
          <h2 class="seccion-titulo">Archivos subidos</h2>
          <span class="badge-count">{{ documentosFiltrados.length }}</span>
        </div>

        <div *ngIf="cargando" class="loading-state">
          <div class="spinner"></div>
          <p>Cargando documentos...</p>
        </div>

        <div class="tabla-wrapper" *ngIf="!cargando">
          <table class="tabla-docs">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Versión</th>
                <th>Subido por</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let doc of documentosFiltrados">
                <td class="td-nombre">
                  <mat-icon class="td-icono">{{ getIconoMime(doc.tipoMime) }}</mat-icon>
                  {{ doc.nombre }}
                </td>
                <td><span class="badge-tipo">{{ getExtension(doc.nombre) }}</span></td>
                <td>v{{ doc.version }}</td>
                <td>{{ doc.creadoPorNombre || '-' }}</td>
                <td>{{ doc.creadoEn | date:'dd/MM/yyyy HH:mm' }}</td>
                <td class="td-acciones">
                  <button class="btn-accion btn-editar" (click)="abrirEditor(doc.id)"
                          *ngIf="esEditableOnlyOffice(doc)" title="Editar en OnlyOffice">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button class="btn-accion btn-ver" (click)="verDocumento(doc)" title="Ver/Descargar">
                    <mat-icon>open_in_new</mat-icon>
                  </button>
                  <button class="btn-accion btn-auditoria" (click)="verAuditoria(doc)" title="Ver auditoría">
                    <mat-icon>history</mat-icon>
                  </button>
                </td>
              </tr>
              <tr *ngIf="documentosFiltrados.length === 0">
                <td colspan="6" class="sin-datos">
                  <mat-icon>folder_off</mat-icon>
                  <span>No hay documentos</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal subir documento -->
      <div *ngIf="mostrarSubir" class="modal-overlay" (click)="cerrarSubir()">
        <div class="modal-dialog" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2><mat-icon>upload_file</mat-icon> Subir documento</h2>
            <button class="btn-close-modal" (click)="cerrarSubir()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="modal-form">
            <div class="form-group">
              <label class="form-label">Archivo</label>
              <input type="file" (change)="onFileSelected($event)" class="form-input file-input">
            </div>
            <div class="form-group">
              <label class="form-label">Nombre</label>
              <input type="text" [(ngModel)]="nuevoNombre" placeholder="Nombre del documento"
                     class="form-input">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="cerrarSubir()">Cancelar</button>
            <button class="btn btn-primary" (click)="subirDocumento()"
                    [disabled]="!archivoSeleccionado || subiendo">
              {{ subiendo ? 'Subiendo...' : 'Subir' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Modal auditoría -->
      <div *ngIf="mostrarAuditoria" class="modal-overlay" (click)="cerrarAuditoria()">
        <div class="modal-dialog modal-grande" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2><mat-icon>history</mat-icon> Auditoría: {{ docAuditoriaActual?.nombre }}</h2>
            <button class="btn-close-modal" (click)="cerrarAuditoria()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="modal-form">
            <div *ngIf="cargandoAuditoria" class="loading-state">
              <div class="spinner"></div>
            </div>
            <table class="tabla-docs" *ngIf="!cargandoAuditoria">
              <thead>
                <tr>
                  <th>Acción</th><th>Usuario</th><th>Detalles</th><th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let a of auditoria">
                  <td>{{ a.accion }}</td>
                  <td>{{ a.usuarioNombre }}</td>
                  <td>{{ a.detalles }}</td>
                  <td>{{ a.fechaHora | date:'dd/MM/yyyy HH:mm' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="cerrarAuditoria()">Cerrar</button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .doc-page {
      padding: 28px;
      min-height: 100vh;
      background: var(--bg-dark, #1a1a00);
      color: var(--text-primary, #f0f0e0);
    }

    /* HEADER */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
    }
    .page-title {
      font-size: 26px;
      font-weight: 800;
      color: var(--text-primary, #f0f0e0);
      margin: 0 0 4px;
    }
    .page-subtitle {
      font-size: 13px;
      color: var(--text-muted, #9D9D60);
      margin: 0;
    }
    .header-acciones { display: flex; gap: 12px; align-items: center; }
    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: var(--bg-surface, #1f1f0a);
      border: 1px solid var(--border, #4a4a1e);
      border-radius: 10px;
    }
    .search-icon { font-size: 18px; color: var(--text-muted, #9D9D60); }
    .search-input {
      background: transparent !important;
      border: none !important;
      outline: none;
      color: var(--text-primary, #f0f0e0) !important;
      font-size: 14px;
      width: 200px;
      padding: 0 !important;
    }

    /* BOTONES */
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 18px; border-radius: 10px; font-size: 14px;
      font-weight: 600; cursor: pointer; border: none; transition: all 0.2s;
    }
    .btn-primary {
      background: linear-gradient(135deg, var(--primary-300, #7A7A40), var(--primary-400, #565620));
      color: var(--text-primary, #f0f0e0);
    }
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(86, 86, 32, 0.5);
    }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      background: transparent;
      color: var(--text-muted, #9D9D60);
      border: 1px solid var(--border, #4a4a1e);
    }
    .btn-secondary:hover {
      background: var(--bg-surface, #1f1f0a);
      color: var(--text-primary, #f0f0e0);
    }

    /* ALERTAS */
    .alerta-error, .alerta-exito {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-radius: 10px; margin-bottom: 16px;
      font-size: 14px;
    }
    .alerta-error {
      background: rgba(244, 66, 80, 0.1);
      border: 1px solid rgba(244, 66, 80, 0.3);
      color: #ff7b86;
    }
    .alerta-exito {
      background: rgba(107, 217, 104, 0.1);
      border: 1px solid rgba(107, 217, 104, 0.3);
      color: #6BD968;
    }
    .btn-close-alert {
      margin-left: auto; background: none; border: none;
      cursor: pointer; color: inherit; display: flex;
    }

    /* SECCIONES */
    .seccion-crear {
      background: var(--bg-card, #2c2c12);
      border: 1px solid var(--border, #4a4a1e);
      border-radius: 14px;
      padding: 22px 24px;
      margin-bottom: 24px;
    }
    .seccion-crear-header {
      display: flex; align-items: center; gap: 10px; margin-bottom: 6px;
    }
    .seccion-icono { color: var(--primary-200, #9D9D60); font-size: 22px; }
    .seccion-titulo {
      font-size: 16px; font-weight: 700;
      color: var(--text-primary, #f0f0e0); margin: 0;
    }
    .seccion-desc { font-size: 13px; color: var(--text-muted, #9D9D60); margin: 0 0 18px; }

    /* GRID DE TIPOS */
    .tipos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 12px;
    }
    .tipo-btn {
      position: relative;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 16px 12px 12px;
      background: var(--bg-surface, #1f1f0a);
      border: 1px solid var(--border, #4a4a1e);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tipo-btn:hover:not(.creando) {
      border-color: var(--primary-200, #9D9D60);
      background: var(--bg-dark, #1a1a00);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .tipo-btn.creando { opacity: 0.7; cursor: wait; }
    .tipo-icono { font-size: 32px !important; }
    .tipo-label { font-size: 12px; font-weight: 600; color: var(--text-primary, #f0f0e0); }
    .tipo-ext { font-size: 11px; color: var(--text-muted, #9D9D60); }
    .tipo-spinner {
      position: absolute; top: 6px; right: 6px;
      width: 14px; height: 14px;
      border: 2px solid var(--border, #4a4a1e);
      border-top-color: var(--primary-200, #9D9D60);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* SECCION DOCS */
    .seccion-docs {
      background: var(--bg-card, #2c2c12);
      border: 1px solid var(--border, #4a4a1e);
      border-radius: 14px;
      padding: 22px 24px;
      margin-bottom: 24px;
    }
    .seccion-titulo-row {
      display: flex; align-items: center; gap: 10px; margin-bottom: 18px;
    }
    .badge-count {
      background: var(--primary-400, #565620);
      color: var(--primary-100, #C0C080);
      font-size: 11px; font-weight: 700;
      padding: 2px 8px; border-radius: 20px;
    }

    /* DOCS GRID (tarjetas para docs de oficina) */
    .docs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    .doc-card {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px;
      background: var(--bg-surface, #1f1f0a);
      border: 1px solid var(--border, #4a4a1e);
      border-radius: 10px;
      transition: all 0.2s;
    }
    .doc-card:hover {
      border-color: var(--border-light, #6a6a30);
      background: var(--bg-dark, #1a1a00);
    }
    .doc-card-icon mat-icon { font-size: 28px !important; }
    .doc-card-info { flex: 1; min-width: 0; }
    .doc-nombre {
      display: block; font-size: 13px; font-weight: 600;
      color: var(--text-primary, #f0f0e0);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .doc-meta { font-size: 11px; color: var(--text-muted, #9D9D60); }
    .doc-card-acciones { display: flex; gap: 4px; }

    /* TABLA */
    .tabla-wrapper { overflow-x: auto; }
    .tabla-docs { width: 100%; border-collapse: collapse; font-size: 13px; }
    .tabla-docs th {
      padding: 10px 14px;
      background: var(--bg-surface, #1f1f0a);
      color: var(--primary-200, #9D9D60);
      text-align: left; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.5px;
      border-bottom: 1px solid var(--border, #4a4a1e);
    }
    .tabla-docs td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border, #4a4a1e);
      color: var(--text-primary, #f0f0e0);
      vertical-align: middle;
    }
    .tabla-docs tr:hover td { background: var(--bg-surface, #1f1f0a); }
    .td-nombre { display: flex; align-items: center; gap: 8px; }
    .td-icono { font-size: 16px !important; color: var(--text-muted, #9D9D60); }
    .badge-tipo {
      display: inline-block;
      padding: 2px 8px;
      background: var(--bg-surface, #1f1f0a);
      border: 1px solid var(--border, #4a4a1e);
      border-radius: 4px;
      font-size: 11px; color: var(--text-muted, #9D9D60);
      text-transform: uppercase;
    }
    .td-acciones { display: flex; gap: 4px; }
    .sin-datos {
      text-align: center; padding: 40px;
      color: var(--text-muted, #9D9D60);
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }

    /* BOTONES DE ACCIÓN */
    .btn-accion {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px;
      background: transparent; border: 1px solid var(--border, #4a4a1e);
      border-radius: 8px; cursor: pointer; transition: all 0.2s;
    }
    .btn-accion mat-icon { font-size: 16px !important; }
    .btn-editar {
      color: var(--primary-200, #9D9D60);
    }
    .btn-editar:hover {
      background: rgba(157, 157, 96, 0.12);
      border-color: var(--primary-200, #9D9D60);
      color: var(--primary-100, #C0C080);
    }
    .btn-ver { color: var(--info, #3992FF); }
    .btn-ver:hover {
      background: rgba(57, 146, 255, 0.1);
      border-color: var(--info, #3992FF);
    }
    .btn-eliminar { color: var(--danger, #F44250); }
    .btn-eliminar:hover {
      background: rgba(244, 66, 80, 0.1);
      border-color: var(--danger, #F44250);
    }
    .btn-auditoria { color: var(--text-muted, #9D9D60); }
    .btn-auditoria:hover {
      background: var(--bg-surface, #1f1f0a);
      border-color: var(--border-light, #6a6a30);
      color: var(--text-primary, #f0f0e0);
    }

    /* LOADING */
    .loading-state {
      display: flex; align-items: center; justify-content: center;
      gap: 12px; padding: 32px; color: var(--text-muted, #9D9D60);
    }
    .spinner {
      width: 28px; height: 28px;
      border: 3px solid var(--border, #4a4a1e);
      border-top-color: var(--primary-200, #9D9D60);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    /* MODALES */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; padding: 16px;
    }
    .modal-dialog {
      background: var(--bg-panel, #222212);
      border: 1px solid var(--border, #4a4a1e);
      border-radius: 16px;
      width: 100%; max-width: 480px;
      max-height: 90vh; overflow-y: auto;
      box-shadow: 0 16px 48px rgba(0,0,0,0.6);
    }
    .modal-grande { max-width: 700px; }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px 16px;
      border-bottom: 1px solid var(--border, #4a4a1e);
    }
    .modal-header h2 {
      display: flex; align-items: center; gap: 8px;
      font-size: 16px; font-weight: 700;
      color: var(--primary-100, #C0C080); margin: 0;
    }
    .btn-close-modal {
      width: 30px; height: 30px; border-radius: 50%;
      background: var(--bg-card, #2c2c12);
      border: 1px solid var(--border, #4a4a1e);
      color: var(--text-muted, #9D9D60); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .btn-close-modal:hover {
      background: rgba(244, 66, 80, 0.1);
      border-color: var(--danger, #F44250);
      color: var(--danger, #F44250);
    }
    .modal-form { padding: 20px 24px; }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 16px 24px 20px;
      border-top: 1px solid var(--border, #4a4a1e);
    }
    .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .form-label {
      font-size: 12px; font-weight: 700;
      color: var(--primary-200, #9D9D60);
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .form-input {
      padding: 10px 14px;
      background: var(--bg-surface, #1f1f0a) !important;
      border: 1.5px solid var(--border, #4a4a1e) !important;
      border-radius: 8px;
      color: var(--text-primary, #f0f0e0) !important;
      font-size: 14px;
    }
    .form-input:focus {
      outline: none;
      border-color: var(--primary-200, #9D9D60) !important;
    }
    .file-input { cursor: pointer; }
  `]
})
export class DocumentosComponent implements OnInit {
  documentos: DocumentoResponse[] = [];
  documentosFiltrados: DocumentoResponse[] = [];
  docsOficina: DocumentoResponse[] = [];
  cargando = true;
  error: string | null = null;
  msgExito: string | null = null;
  filtroTexto = '';

  mostrarSubir = false;
  archivoSeleccionado: File | null = null;
  nuevoNombre = '';
  subiendo = false;

  mostrarAuditoria = false;
  cargandoAuditoria = false;
  docAuditoriaActual: DocumentoResponse | null = null;
  auditoria: any[] = [];

  mostrarModalNombre = false;
  tipoSeleccionado: TipoOficina | null = null;
  nombreNuevoDoc = '';
  creandoTipo: string | null = null;

  private empresaId = '';

  readonly tiposOficina: TipoOficina[] = [
    { tipo: 'docx', icono: 'description',    etiqueta: 'Word',         color: '#2b579a' },
    { tipo: 'xlsx', icono: 'table_chart',     etiqueta: 'Excel',        color: '#217346' },
    { tipo: 'pptx', icono: 'slideshow',       etiqueta: 'PowerPoint',   color: '#b7472a' },
    { tipo: 'odt',  icono: 'article',         etiqueta: 'OpenDoc Text', color: '#9D9D60' },
    { tipo: 'ods',  icono: 'grid_on',         etiqueta: 'OpenDoc Hoja', color: '#6BD968' },
    { tipo: 'odp',  icono: 'present_to_all',  etiqueta: 'OpenDoc Pres', color: '#C0C080' },
    { tipo: 'csv',  icono: 'format_list_numbered', etiqueta: 'CSV',     color: '#FECC1B' },
    { tipo: 'txt',  icono: 'text_snippet',    etiqueta: 'Texto plano',  color: '#9D9D60' },
  ];

  constructor(
    private documentoService: DocumentoService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.empresaId = (user as any)?.empresaId || 'general';
    this.cargarDocumentos();
  }

  cargarDocumentos(): void {
    this.cargando = true;
    // Cargamos documentos normales y de oficina en paralelo via forkJoin
    import('rxjs').then(({ forkJoin }) => {
      forkJoin({
        normales: this.documentoService.listar(this.empresaId),
        oficina:  this.documentoService.listarOficina()
      }).subscribe({
        next: ({ normales, oficina }) => {
          // Combinar evitando duplicados (un doc de oficina puede aparecer en ambas si empresaId coincide)
          const idsNormales = new Set(normales.map(d => d.id));
          const oficinaExtra = oficina.filter(d => !idsNormales.has(d.id));
          const todos = [...normales, ...oficinaExtra];
          this.documentos = todos;
          this.docsOficina = todos.filter(d => d.esDocumentoOficina);
          this.documentosFiltrados = todos.filter(d => !d.esDocumentoOficina);
          this.cargando = false;
        },
        error: () => {
          this.error = 'Error al cargar documentos';
          this.cargando = false;
        }
      });
    });
  }

  filtrar(): void {
    const f = this.filtroTexto.toLowerCase();
    this.documentosFiltrados = this.documentos
      .filter(d => !d.esDocumentoOficina)
      .filter(d => d.nombre.toLowerCase().includes(f) || (d.descripcion || '').toLowerCase().includes(f));
  }

  // ============ CREAR DOCUMENTOS DE OFICINA ============
  solicitarCrearDocumento(tipo: TipoOficina): void {
    this.tipoSeleccionado = tipo;
    this.nombreNuevoDoc = '';
    this.mostrarModalNombre = true;
  }

  cancelarCrear(): void {
    this.mostrarModalNombre = false;
    this.tipoSeleccionado = null;
    this.nombreNuevoDoc = '';
  }

  confirmarCrear(): void {
    if (!this.nombreNuevoDoc.trim() || !this.tipoSeleccionado) return;
    const tipo = this.tipoSeleccionado;
    this.creandoTipo = tipo.tipo;
    this.mostrarModalNombre = false;

    this.documentoService.crearDocumentoOficina(this.nombreNuevoDoc.trim(), tipo.tipo).subscribe({
      next: (doc) => {
        this.creandoTipo = null;
        this.msgExito = `"${doc.nombre}" creado correctamente. Abriendo editor...`;
        setTimeout(() => this.msgExito = null, 4000);
        this.cargarDocumentos();
        this.abrirEditor(doc.id);
      },
      error: () => {
        this.creandoTipo = null;
        this.error = 'Error al crear el documento. Inténtalo de nuevo.';
      }
    });
  }

  // ============ EDITOR ============
  abrirEditor(docId: string): void {
    this.router.navigate(['/editor-documento', docId], { queryParams: { modo: 'edit' } });
  }

  eliminarDocumento(doc: DocumentoResponse): void {
    if (!confirm(`¿Eliminar "${doc.nombre}"? Esta acción no se puede deshacer.`)) return;
    this.documentoService.eliminarDocumento(doc.id).subscribe({
      next: () => {
        this.docsOficina = this.docsOficina.filter(d => d.id !== doc.id);
        this.msgExito = 'Documento eliminado correctamente.';
        setTimeout(() => this.msgExito = null, 3000);
      },
      error: (err) => {
        console.error('Error al eliminar:', err);
        this.error = 'Error al eliminar el documento.';
        setTimeout(() => this.error = null, 3000);
      }
    });
  }

  // ============ SUBIR ARCHIVO ============
  abrirSubir(): void { this.mostrarSubir = true; }
  cerrarSubir(): void { this.mostrarSubir = false; this.archivoSeleccionado = null; this.nuevoNombre = ''; }

  onFileSelected(event: any): void {
    this.archivoSeleccionado = event.target.files[0] || null;
    if (this.archivoSeleccionado && !this.nuevoNombre) {
      this.nuevoNombre = this.archivoSeleccionado.name;
    }
  }

  subirDocumento(): void {
    if (!this.archivoSeleccionado) return;
    this.subiendo = true;
    const datos = { empresaId: this.empresaId, nombre: this.nuevoNombre || this.archivoSeleccionado.name };
    this.documentoService.subir(this.archivoSeleccionado, datos).subscribe({
      next: () => {
        this.cerrarSubir();
        this.subiendo = false;
        this.msgExito = 'Documento subido correctamente.';
        setTimeout(() => this.msgExito = null, 3000);
        this.cargarDocumentos();
      },
      error: () => { this.error = 'Error al subir el documento'; this.subiendo = false; }
    });
  }

  // ============ VISUALIZAR ============
  verDocumento(doc: DocumentoResponse): void {
    window.open(doc.urlArchivo, '_blank');
  }

  verAuditoria(doc: DocumentoResponse): void {
    this.docAuditoriaActual = doc;
    this.mostrarAuditoria = true;
    this.cargandoAuditoria = true;
    this.documentoService.obtenerAuditoria(doc.id).subscribe({
      next: (a) => { this.auditoria = a; this.cargandoAuditoria = false; },
      error: () => { this.cargandoAuditoria = false; }
    });
  }

  cerrarAuditoria(): void { this.mostrarAuditoria = false; this.auditoria = []; }

  // ============ HELPERS ============
  esEditableOnlyOffice(doc: DocumentoResponse): boolean {
    const ext = this.getExtension(doc.nombre);
    return ['docx','xlsx','pptx','odt','ods','odp','doc','xls','ppt','csv','txt'].includes(ext);
  }

  getExtension(nombre: string): string {
    if (!nombre || !nombre.includes('.')) return '';
    return nombre.substring(nombre.lastIndexOf('.') + 1).toLowerCase();
  }

  getIconoTipo(tipo?: string): string {
    if (!tipo) return 'description';
    const m: Record<string,string> = {
      docx: 'description', doc: 'description',
      xlsx: 'table_chart',  xls: 'table_chart',
      pptx: 'slideshow',    ppt: 'slideshow',
      odt:  'article',      ods: 'grid_on',
      odp:  'present_to_all', csv: 'format_list_numbered',
      txt:  'text_snippet', pdf: 'picture_as_pdf',
    };
    return m[tipo.toLowerCase()] || 'insert_drive_file';
  }

  getColorTipo(tipo?: string): string {
    if (!tipo) return '#9D9D60';
    const found = this.tiposOficina.find(t => t.tipo === tipo.toLowerCase());
    return found?.color || '#9D9D60';
  }

  getIconoMime(mime?: string): string {
    if (!mime) return 'insert_drive_file';
    if (mime.includes('word') || mime.includes('odt')) return 'description';
    if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return 'table_chart';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return 'slideshow';
    if (mime.includes('pdf')) return 'picture_as_pdf';
    if (mime.includes('image')) return 'image';
    if (mime.includes('video')) return 'videocam';
    return 'insert_drive_file';
  }
}
