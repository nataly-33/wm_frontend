import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth.service';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-reportes-dinamicos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reportes-container">
      <h2>Generador de Reportes con IA</h2>

      <div class="consulta-card">
        <label class="consulta-label">Describe el reporte que quieres</label>
        <textarea
          [(ngModel)]="consulta"
          rows="3"
          class="consulta-textarea"
          placeholder="Ej: Muestrame los tramites completados este mes ordenados por departamento">
        </textarea>
        <div class="botones-consulta">
          <button class="btn-mic" (click)="grabar()" [class.grabando]="escuchando"
            [title]="escuchando ? 'Escuchando...' : 'Grabar por voz'">
            {{ escuchando ? 'Escuchando...' : 'Voz' }}
          </button>
          <button class="btn-primary" (click)="generarReporte()" [disabled]="estado === 'procesando'">
            <span *ngIf="estado !== 'procesando'">Generar Reporte</span>
            <span *ngIf="estado === 'procesando'">Procesando...</span>
          </button>
        </div>
      </div>

      <div *ngIf="estado === 'preguntas'" class="preguntas-card">
        <h3>Necesito mas informacion</h3>
        <div *ngFor="let pregunta of preguntasFaltantes; let i = index" class="pregunta-item">
          <p>{{ pregunta }}</p>
          <input type="text" [(ngModel)]="respuestasUsuario[i]" class="input-respuesta">
        </div>
        <button class="btn-primary" (click)="responderPreguntas()">Continuar</button>
      </div>

      <div *ngIf="estado === 'resultado'" id="reporte-contenido" class="resultado-section">
        <h3>Vista Previa del Reporte</h3>
        <div class="descripcion-card">
          <p class="descripcion-texto">{{ descripcionReporte }}</p>
          <div class="export-buttons">
            <button class="btn-export" (click)="exportarExcel()">Exportar Excel</button>
            <button class="btn-export" (click)="exportarPDF()">Exportar PDF</button>
          </div>
        </div>

        <div class="tabla-wrapper" *ngIf="datosReporte.length > 0">
          <table class="tabla-reporte">
            <thead>
              <tr>
                <th *ngFor="let col of columnasReporte">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let fila of datosReporte">
                <td *ngFor="let col of columnasReporte">{{ fila[col] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div *ngIf="datosReporte.length === 0" class="sin-datos">Sin datos para mostrar</div>
      </div>
    </div>
  `,
  styles: [`
    .reportes-container { padding: 24px; max-width: 960px; color: var(--text-primary); }
    h2 { font-size: 1.4rem; margin-bottom: 20px; color: var(--text-primary); }
    h3 { font-size: 1.1rem; margin: 0 0 16px; color: var(--primary-200); }
    .consulta-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .consulta-label { display: block; font-weight: 600; margin-bottom: 8px; color: var(--primary-200); }
    .consulta-textarea { width: 100%; padding: 12px; border: 1.5px solid var(--border) !important; border-radius: 8px; font-size: 14px; resize: vertical; box-sizing: border-box; background: var(--bg-surface) !important; color: var(--text-primary) !important; }
    .consulta-textarea:focus { border-color: var(--primary-200) !important; outline: none; background: var(--bg-dark) !important; }
    .botones-consulta { display: flex; gap: 8px; margin-top: 12px; align-items: center; }
    .btn-primary { padding: 10px 20px; background: linear-gradient(135deg, var(--primary-300), var(--primary-400)); color: var(--text-primary); border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; box-shadow: 0 2px 8px rgba(86, 86, 32, 0.4); transition: var(--transition); }
    .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(86, 86, 32, 0.5); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
    .btn-mic { padding: 10px 16px; background: rgba(244, 66, 80, 0.15); color: var(--danger); border: 1px solid rgba(244, 66, 80, 0.3); border-radius: 8px; cursor: pointer; font-weight: 600; transition: var(--transition); }
    .btn-mic.grabando { animation: pulse 1s infinite; background: rgba(244, 66, 80, 0.3); }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .preguntas-card { background: var(--bg-panel); border: 1px solid var(--warning); border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .pregunta-item { margin-bottom: 12px; }
    .pregunta-item p { margin: 0 0 6px; font-size: 14px; color: var(--text-primary); }
    .input-respuesta { width: 100%; padding: 10px; border: 1.5px solid var(--border) !important; border-radius: 8px; box-sizing: border-box; background: var(--bg-surface) !important; color: var(--text-primary) !important; }
    .input-respuesta:focus { border-color: var(--primary-200) !important; outline: none; background: var(--bg-dark) !important; }
    .resultado-section { margin-top: 20px; }
    .descripcion-card { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .descripcion-texto { margin: 0; font-size: 14px; flex: 1; color: var(--text-primary); }
    .export-buttons { display: flex; gap: 8px; }
    .btn-export { padding: 8px 14px; background: var(--primary-400); color: var(--text-primary); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; transition: var(--transition); }
    .btn-export:hover { background: var(--primary-300); }
    .tabla-wrapper { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
    .tabla-reporte { width: 100%; border-collapse: collapse; }
    .tabla-reporte th, .tabla-reporte td { padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: left; font-size: 13px; color: var(--text-primary); }
    .tabla-reporte th { background: var(--bg-panel); font-weight: 600; color: var(--primary-200); }
    .sin-datos { text-align: center; padding: 24px; color: var(--text-muted); }
  `]
})
export class ReportesDinamicosComponent {
  consulta = '';
  escuchando = false;
  estado: 'idle' | 'procesando' | 'preguntas' | 'resultado' = 'idle';
  preguntasFaltantes: string[] = [];
  respuestasUsuario: { [key: number]: string } = {};
  datosReporte: any[] = [];
  columnasReporte: string[] = [];
  descripcionReporte = '';

  private recognition: any;

  constructor(private http: HttpClient, private authService: AuthService) {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      this.recognition = new SR();
      this.recognition.lang = 'es-BO';
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.onresult = (e: any) => {
        let text = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            text += e.results[i][0].transcript + ' ';
          }
        }
        if (text) {
          this.consulta = (this.consulta ? this.consulta + ' ' : '') + text.trim();
        }
      };
      this.recognition.onerror = () => { this.escuchando = false; };
      this.recognition.onend = () => { this.escuchando = false; };
    }
  }

  grabar(): void {
    if (!this.recognition) return;
    if (this.escuchando) {
      this.recognition.stop();
      this.escuchando = false;
    } else {
      this.escuchando = true;
      this.recognition.start();
    }
  }

  generarReporte(): void {
    if (!this.consulta.trim()) return;
    this.estado = 'procesando';
    const empresaId = this.authService.getCurrentUser()?.empresaId || '';
    this.http.post<any>(`${environment.apiUrl}/api/v1/reportes/interpretar`, { consulta: this.consulta, empresaId }).subscribe({
      next: (spec) => {
        if (spec.preguntas_faltantes?.length > 0) {
          this.preguntasFaltantes = spec.preguntas_faltantes;
          this.estado = 'preguntas';
        } else {
          this.ejecutarReporte(spec);
        }
      },
      error: () => { this.estado = 'idle'; }
    });
  }

  responderPreguntas(): void {
    const extra = Object.values(this.respuestasUsuario).join(' ');
    this.consulta = this.consulta + ' ' + extra;
    this.preguntasFaltantes = [];
    this.respuestasUsuario = {};
    this.estado = 'procesando';
    this.generarReporte();
  }

  private ejecutarReporte(spec: any): void {
    const empresaId = this.authService.getCurrentUser()?.empresaId || '';
    this.http.post<any>(`${environment.apiUrl}/api/v1/reportes/generar`, {
      consulta: this.consulta,
      empresaId
    }).subscribe({
      next: (resultado) => {
        this.datosReporte = resultado.datos || [];
        this.descripcionReporte = resultado.descripcion || spec.descripcion_reporte || spec.descripcionReporte || '';
        this.columnasReporte = this.datosReporte.length > 0 ? Object.keys(this.datosReporte[0]) : [];
        this.estado = 'resultado';
      },
      error: () => { this.estado = 'idle'; }
    });
  }

  exportarExcel(): void {
    if (this.datosReporte.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(this.datosReporte);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
    XLSX.writeFile(workbook, 'reporte_workflowmanager.xlsx');
  }

  exportarPDF(): void {
    if (this.datosReporte.length === 0) return;
    const doc = new jsPDF();
    doc.text('Reporte WorkflowManager', 14, 15);
    doc.setFontSize(10);
    doc.text(this.descripcionReporte, 14, 25);
    
    const body = this.datosReporte.map(row => this.columnasReporte.map(col => row[col] ?? ''));
    
    autoTable(doc, {
      head: [this.columnasReporte],
      body: body,
      startY: 35,
    });
    
    doc.save('reporte_workflowmanager.pdf');
  }
}
