import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PoliticaService, DiagramaNodoPayload, DiagramaTransicionPayload } from '../../../../../core/services/politica.service';
import { IaService, NodoIaResponse } from '../../../../../core/services/ia.service';
import { DepartamentoService, Departamento } from '../../../../../core/services/departamento.service';

type ProgresoStep = 'idle' | 'creando' | 'analizando' | 'generando' | 'guardando' | 'listo' | 'error';

@Component({
  selector: 'app-nueva-politica',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './nueva-politica.component.html',
  styleUrls: ['./nueva-politica.component.scss']
})
export class NuevaPoliticaComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  departamentos: Departamento[] = [];
  grabando = false;
  progreso: ProgresoStep = 'idle';
  mensajeProgreso = '';
  advertenciaIa: string | null = null;
  error: string | null = null;

  private recognition: any = null;
  private textoAcumulado = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private politicaService: PoliticaService,
    private iaService: IaService,
    private departamentoService: DepartamentoService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: ['', [Validators.required, Validators.minLength(10)]]
    });
    this.cargarDepartamentos();
  }

  ngOnDestroy(): void {
    this.detenerGrabacion();
  }

  cargarDepartamentos(): void {
    this.departamentoService.listar().subscribe({
      next: (res) => this.departamentos = res.data ?? [],
      error: () => this.departamentos = []
    });
  }

  toggleGrabacion(): void {
    if (this.grabando) {
      this.detenerGrabacion();
    } else {
      this.iniciarGrabacion();
    }
  }

  iniciarGrabacion(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.error = 'Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.';
      return;
    }

    this.error = null;
    this.textoAcumulado = this.form.value.descripcion || '';
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-BO';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event: any) => {
      let textoInterim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          this.textoAcumulado += event.results[i][0].transcript + ' ';
        } else {
          textoInterim = event.results[i][0].transcript;
        }
      }
      this.form.patchValue({ descripcion: this.textoAcumulado + textoInterim });
    };

    this.recognition.onerror = () => {
      this.grabando = false;
    };

    this.recognition.onend = () => {
      if (this.grabando) {
        this.recognition.start();
      }
    };

    this.recognition.start();
    this.grabando = true;
  }

  detenerGrabacion(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    this.grabando = false;
  }

  crearManualmente(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.detenerGrabacion();
    const { nombre, descripcion } = this.form.value;
    this.progreso = 'creando';
    this.mensajeProgreso = 'Creando politica...';
    this.error = null;

    this.politicaService.crear({ nombre, descripcion }).subscribe({
      next: (res) => {
        const id = res.data?.id;
        if (id) {
          this.router.navigate(['/admin/politicas', id, 'editor']);
        }
      },
      error: (err) => {
        this.progreso = 'error';
        this.error = err?.error?.message ?? 'Error al crear la politica';
      }
    });
  }

  crearConIa(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.detenerGrabacion();
    const { nombre, descripcion } = this.form.value;
    this.error = null;
    this.advertenciaIa = null;

    // Paso 1: crear politica
    this.progreso = 'creando';
    this.mensajeProgreso = 'Creando politica...';

    this.politicaService.crear({ nombre, descripcion }).subscribe({
      next: (resPolitica) => {
        const politicaId = resPolitica.data?.id;
        if (!politicaId) {
          this.progreso = 'error';
          this.error = 'No se recibio ID de la politica creada';
          return;
        }

        // Paso 2: generar diagrama con IA
        this.progreso = 'analizando';
        this.mensajeProgreso = 'Analizando descripcion con IA...';

        const deptsIa = this.departamentos.map(d => ({ id: d.id, nombre: d.nombre }));

        this.iaService.generarDiagrama({
          prompt: descripcion,
          departamentos: deptsIa,
          politicaId
        }).subscribe({
          next: (resIa) => {
            this.progreso = 'generando';
            this.mensajeProgreso = 'Generando diagrama...';

            const diagramaData = resIa.data as any;
            if (diagramaData?.advertencia) {
              this.advertenciaIa = diagramaData.advertencia;
            }

            const nodos: NodoIaResponse[] = diagramaData?.nodos ?? [];
            const transicionesRaw = diagramaData?.transiciones ?? [];

            // Paso 3: guardar diagrama
            this.progreso = 'guardando';
            this.mensajeProgreso = 'Guardando diagrama...';

            const nodosPayload: DiagramaNodoPayload[] = nodos.map(n => ({
              tempId: n.tempId,
              tipo: n.tipo,
              nombre: n.nombre,
              departamentoId: n.departamentoId ?? '',
              formularioId: n.formularioId,
              posicionX: n.posicion_x,
              posicionY: n.posicion_y
            }));

            const transicionesPayload: DiagramaTransicionPayload[] = transicionesRaw.map((t: any) => ({
              nodoOrigenTempId: t.nodoOrigenTempId,
              nodoDestinoTempId: t.nodoDestinoTempId,
              tipo: t.tipo ?? 'LINEAL',
              etiqueta: t.etiqueta ?? null,
              condicion: t.condicion ?? null
            }));

            this.politicaService.guardarDiagrama(politicaId, {
              datosDiagramaJson: '{}',
              nodos: nodosPayload,
              transiciones: transicionesPayload
            }).subscribe({
              next: () => {
                this.progreso = 'listo';
                this.mensajeProgreso = 'Diagrama generado! Abriendo editor...';
                setTimeout(() => {
                  this.router.navigate(['/admin/politicas', politicaId, 'editor']);
                }, 1200);
              },
              error: (err) => {
                this.progreso = 'error';
                this.error = err?.error?.message ?? 'Error al guardar el diagrama';
              }
            });
          },
          error: (err) => {
            this.progreso = 'error';
            this.error = err?.error?.message ?? 'Error al generar el diagrama con IA';
          }
        });
      },
      error: (err) => {
        this.progreso = 'error';
        this.error = err?.error?.message ?? 'Error al crear la politica';
      }
    });
  }

  cancelar(): void {
    this.detenerGrabacion();
    this.router.navigate(['/admin/politicas']);
  }

  get enProgreso(): boolean {
    return ['creando', 'analizando', 'generando', 'guardando'].includes(this.progreso);
  }
}
