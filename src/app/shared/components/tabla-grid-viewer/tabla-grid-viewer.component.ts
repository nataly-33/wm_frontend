import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tabla-grid-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tabla-grid-viewer" *ngIf="datos && datos.length > 0">
      <div class="tabla-scroll">
        <table class="tabla-grid">
          <thead>
            <tr>
              <th *ngFor="let col of columnas">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let fila of datos">
              <td *ngFor="let col of columnas">{{ fila[col] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <p class="sin-datos" *ngIf="!datos || datos.length === 0">Sin datos en la tabla</p>
  `,
  styles: [`
    .tabla-grid-viewer { width: 100%; }
    .tabla-scroll { overflow-x: auto; }
    .tabla-grid {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .tabla-grid th {
      background: var(--bg-panel, #242410);
      color: var(--primary-200, #9D9D60);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 8px 10px;
      border: 1px solid var(--border, #565620);
      text-align: left;
    }
    .tabla-grid td {
      padding: 7px 10px;
      border: 1px solid var(--border, #565620);
      color: var(--text-primary, #f5f5e8);
    }
    .tabla-grid tbody tr:nth-child(even) {
      background: var(--bg-panel, #242410);
    }
    .sin-datos {
      color: var(--text-muted, #9D9D60);
      font-size: 13px;
      font-style: italic;
      margin: 0;
    }
  `]
})
export class TablaGridViewerComponent implements OnInit {
  @Input() datos: any[] = [];
  columnas: string[] = [];

  ngOnInit(): void {
    if (this.datos?.length > 0) {
      this.columnas = Object.keys(this.datos[0]);
    }
  }
}
