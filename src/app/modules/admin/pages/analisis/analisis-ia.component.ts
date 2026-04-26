import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IaService } from '../../../../core/services/ia.service';
import { PoliticaService, Politica } from '../../../../core/services/politica.service';

interface ResultadoNodo {
  nodo_id: string;
  nombre_nodo: string;
  es_cuello_botella: boolean;
  es_anomalia_estadistica: boolean;
  probabilidad_cuello: number;
  prob_random_forest: number;
  prob_gradient_boosting: number;
  severidad: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
  metricas: {
    tiempo_promedio_minutos: number;
    tasa_rechazo_pct: number;
    ejecuciones_activas: number;
  };
  sugerencias: string[];
}

@Component({
  selector: 'app-analisis-ia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analisis-ia.component.html',
  styleUrls: ['./analisis-ia.component.scss']
})
export class AnalisisIaComponent implements OnInit {
  politicas: Politica[] = [];
  politicaId = '';
  cargando = false;
  cargandoPoliticas = false;
  resultados: ResultadoNodo[] = [];
  mensajeSinDatos = '';
  error: string | null = null;
  analisisRealizado = false;

  constructor(
    private iaService: IaService,
    private politicaService: PoliticaService
  ) {}

  ngOnInit(): void {
    this.cargarPoliticas();
  }

  cargarPoliticas(): void {
    this.cargandoPoliticas = true;
    this.politicaService.listar().subscribe({
      next: (res) => {
        this.politicas = res.data ?? [];
        this.cargandoPoliticas = false;
      },
      error: () => {
        this.cargandoPoliticas = false;
      }
    });
  }

  analizarPolitica(): void {
    if (!this.politicaId) return;
    this.cargando = true;
    this.error = null;
    this.resultados = [];
    this.mensajeSinDatos = '';
    this.analisisRealizado = false;

    this.iaService.analizarPolitica(this.politicaId).subscribe({
      next: (respuesta) => {
        this.cargando = false;
        this.analisisRealizado = true;
        this.resultados = respuesta.data?.resultados ?? [];

        if (this.resultados.length === 0) {
          this.mensajeSinDatos = respuesta.data?.mensaje ||
            'No hay suficientes datos. Completa mas tramites primero.';
        }
      },
      error: (err) => {
        this.cargando = false;
        this.error = err?.error?.message ?? 'Error al analizar la politica';
      }
    });
  }

  get nodosConCuello(): ResultadoNodo[] {
    return this.resultados.filter(r => r.es_cuello_botella);
  }

  get top3(): ResultadoNodo[] {
    return this.resultados.slice(0, 3);
  }

  get aucRoc(): string {
    return '—';
  }

  getSeveridadClass(severidad: string): string {
    const map: Record<string, string> = {
      CRITICA: 'badge--critica',
      ALTA: 'badge--alta',
      MEDIA: 'badge--media',
      BAJA: 'badge--baja'
    };
    return `badge ${map[severidad] || ''}`;
  }

  getBarraClass(severidad: string): string {
    const map: Record<string, string> = {
      CRITICA: 'barra-fill--critica',
      ALTA: 'barra-fill--alta',
      MEDIA: 'barra-fill--media',
      BAJA: 'barra-fill--baja'
    };
    return `barra-fill ${map[severidad] || ''}`;
  }

  formatMinutos(min: number): string {
    if (min >= 60) {
      return `${(min / 60).toFixed(1)}h`;
    }
    return `${Math.round(min)}min`;
  }
}
