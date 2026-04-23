import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FormularioDepartamentoItem,
  FormularioService,
  FormulariosAgrupadosPorPolitica
} from '../../../../core/services/formulario.service';
import { AuthService } from '../../../../core/services/auth.service';

interface PoliticaOption {
  id: string;
  nombre: string;
}

interface NodoOption {
  id: string;
  nombre: string;
  tipo: string;
}

@Component({
  selector: 'app-formularios-admin-depto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './formularios.component.html',
  styleUrls: ['./formularios.component.scss']
})
export class FormulariosComponent implements OnInit {
  politicas: PoliticaOption[] = [];
  nodos: NodoOption[] = [];
  itemsDepartamento: FormularioDepartamentoItem[] = [];
  gruposVista: FormulariosAgrupadosPorPolitica[] = [];

  politicaId = '';
  nodoId = '';
  formularioId: string | null = null;
  error: string | null = null;
  guardando = false;

  userDepartamentoId = '';

  form!: FormGroup;

  constructor(
    private formularioService: FormularioService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      campos: this.fb.array([])
    });
    this.agregarCampo();

    const user = this.authService.getCurrentUser();
    if (!user?.departamentoId) {
      this.error = 'No se pudo identificar el departamento del usuario';
      return;
    }

    this.userDepartamentoId = user.departamentoId;
    this.cargarDatosDepartamento();
  }

  get campos(): FormArray {
    return this.form.get('campos') as FormArray;
  }

  agregarCampo(): void {
    this.campos.push(
      this.fb.group({
        nombre: ['', Validators.required],
        etiqueta: ['', Validators.required],
        tipo: ['TEXTO', Validators.required],
        requerido: [true],
        esCampoPrioridad: [false],
        opcionesRaw: ['']
      })
    );
  }

  quitarCampo(index: number): void {
    if (this.campos.length <= 1) return;
    this.campos.removeAt(index);
  }

  cargarDatosDepartamento(): void {
    this.formularioService.listarPorDepartamento(this.userDepartamentoId).subscribe({
      next: (res) => {
        this.itemsDepartamento = res.data ?? [];
        this.gruposVista = this.agruparPorPolitica(this.itemsDepartamento);

        const politicasMap = new Map<string, PoliticaOption>();
        this.itemsDepartamento.forEach((item) => {
          politicasMap.set(item.politicaId, { id: item.politicaId, nombre: item.politicaNombre });
        });

        this.politicas = Array.from(politicasMap.values());
        this.cargarNodos();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'No se pudieron cargar formularios del departamento';
      }
    });
  }

  editarDesdeListado(item: FormularioDepartamentoItem): void {
    this.politicaId = item.politicaId;
    this.cargarNodos();
    this.nodoId = item.nodoId;
    this.cargarFormularioDesdeLista();
  }

  eliminarDesdeListado(item: FormularioDepartamentoItem): void {
    if (!item.formulario) {
      this.error = 'Este nodo no tiene formulario para eliminar';
      return;
    }

    this.guardando = true;
    this.formularioService.eliminar(item.formulario.id).subscribe({
      next: () => {
        this.guardando = false;
        this.cargarDatosDepartamento();
        if (this.nodoId === item.nodoId) {
          this.formularioId = null;
          this.resetFormulario();
        }
      },
      error: (err) => {
        this.guardando = false;
        this.error = err?.error?.message ?? 'No se pudo eliminar';
      }
    });
  }

  private agruparPorPolitica(items: FormularioDepartamentoItem[]): FormulariosAgrupadosPorPolitica[] {
    const mapa = new Map<string, FormulariosAgrupadosPorPolitica>();
    items.forEach((item) => {
      if (!mapa.has(item.politicaId)) {
        mapa.set(item.politicaId, {
          politicaId: item.politicaId,
          politicaNombre: item.politicaNombre,
          formularios: []
        });
      }
      mapa.get(item.politicaId)!.formularios.push(item);
    });
    return Array.from(mapa.values());
  }

  cargarNodos(): void {
    if (!this.politicaId) {
      this.nodos = [];
      return;
    }

    this.nodos = this.itemsDepartamento
      .filter((item) => item.politicaId === this.politicaId)
      .map((item) => ({ id: item.nodoId, nombre: item.nodoNombre, tipo: 'TAREA/DECISION' }));
  }

  onPoliticaChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.politicaId = value;
    this.nodoId = '';
    this.formularioId = null;
    this.cargarNodos();
    this.resetFormulario();
  }

  onNodoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.nodoId = value;
    this.cargarFormularioDesdeLista();
  }

  cargarFormularioDesdeLista(): void {
    const item = this.itemsDepartamento.find((i) => i.nodoId === this.nodoId);
    if (!item?.formulario) {
      this.formularioId = null;
      this.resetFormulario();
      return;
    }

    const data = item.formulario;
    this.formularioId = data.id;
    this.form.patchValue({ nombre: data.nombre });
    this.campos.clear();
    data.campos.forEach((c) => {
      this.campos.push(
        this.fb.group({
          nombre: [c.nombre, Validators.required],
          etiqueta: [c.etiqueta, Validators.required],
          tipo: [c.tipo, Validators.required],
          requerido: [c.requerido],
          esCampoPrioridad: [c.esCampoPrioridad],
          opcionesRaw: [(c.opciones ?? []).join(',')]
        })
      );
    });
  }

  guardar(): void {
    if (this.form.invalid || !this.politicaId || !this.nodoId) {
      this.error = 'Selecciona política/nodo y completa el formulario';
      return;
    }

    this.guardando = true;
    const request = {
      politicaId: this.politicaId,
      nodoId: this.nodoId,
      nombre: this.form.value.nombre,
      generadoPorIa: false,
      campos: this.campos.controls.map((ctrl) => ({
        nombre: ctrl.value.nombre,
        etiqueta: ctrl.value.etiqueta,
        tipo: ctrl.value.tipo,
        requerido: !!ctrl.value.requerido,
        esCampoPrioridad: !!ctrl.value.esCampoPrioridad,
        opciones: (ctrl.value.opcionesRaw ?? '')
          .split(',')
          .map((v: string) => v.trim())
          .filter((v: string) => v.length > 0)
      }))
    };

    const op = this.formularioId
      ? this.formularioService.actualizar(this.formularioId, request)
      : this.formularioService.crear(request);

    op.subscribe({
      next: () => {
        this.guardando = false;
        this.cargarDatosDepartamento();
      },
      error: (err) => {
        this.guardando = false;
        this.error = err?.error?.message ?? 'No se pudo guardar';
      }
    });
  }

  private resetFormulario(): void {
    this.form.patchValue({ nombre: '' });
    this.campos.clear();
    this.agregarCampo();
  }
}
