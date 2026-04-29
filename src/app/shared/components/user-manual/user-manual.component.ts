import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface HelpStep {
  id: string;
  titulo: string;
  descripcion: string;
  imagen: string;
  tips: string[];
  icono: string;
  color: string;
}

@Component({
  selector: 'app-user-manual',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-manual.component.html',
  styleUrls: ['./user-manual.component.scss']
})
export class UserManualComponent implements OnInit {
  isOpen = false;
  currentStep = 0;
  isAnimating = false;

  steps: HelpStep[] = [
    {
      id: 'bienvenida',
      titulo: 'Bienvenido al Panel de Administración',
      descripcion: 'Este sistema te permite gestionar flujos de trabajo (workflows) de forma visual e intuitiva. Desde aquí puedes crear políticas, iniciar trámites, monitorear procesos y analizar cuellos de botella con inteligencia artificial.',
      imagen: 'help_dashboard.png',
      tips: [
        'Usa el menú lateral para navegar entre secciones',
        'El Dashboard muestra un resumen en tiempo real',
        'Tu nombre de usuario aparece en la barra superior'
      ],
      icono: 'dashboard',
      color: '#487331ff'
    },
    {
      id: 'politicas',
      titulo: 'Cómo crear una Política',
      descripcion: 'Las políticas definen las reglas y el flujo que seguirá un trámite. Primero crea la política con nombre y descripción, luego diseña su diagrama de flujo en el editor visual.',
      imagen: 'help_politicas.png',
      tips: [
        'Haz clic en "Nueva política" (botón superior derecho)',
        'Completa el nombre y descripción',
        'Luego usa "Editor de diagrama" para diseñar el flujo',
        'Activa la política para poder iniciar trámites con ella'
      ],
      icono: 'politicas',
      color: '#58af3dff'
    },
    {
      id: 'editor',
      titulo: 'Editor de Diagrama de Flujo',
      descripcion: 'El editor visual te permite arrastrar y conectar nodos para definir el proceso. Puedes agregar tareas, decisiones, condiciones y nodos especiales como el cuello de botella.',
      imagen: 'help_editor.png',
      tips: [
        'Arrastra nodos desde el panel izquierdo al canvas',
        'Conecta nodos haciendo clic en los puntos de conexión',
        'El nodo INICIO siempre debe ser el punto de partida',
        'El nodo FIN marca donde termina el proceso',
        'Guarda el diagrama antes de salir'
      ],
      icono: 'editor',
      color: '#1d8f3aff'
    },
    {
      id: 'cuello',
      titulo: 'Cuello de Botella',
      descripcion: 'El nodo "Cuello de Botella" identifica puntos críticos en el flujo donde las tareas se acumulan. El sistema de IA analiza automáticamente estos puntos y te alerta cuando hay retrasos anormales.',
      imagen: 'help_cuello_botella.png',
      tips: [
        'Agrega un nodo de tipo "Cuello de Botella" en zonas de riesgo',
        'El sistema monitorea el tiempo de espera en ese nodo',
        'Si se acumulan más trámites de lo normal, recibirás alertas',
        'Ve a "Análisis IA" para ver predicciones y recomendaciones'
      ],
      icono: 'cuello',
      color: '#1d8757ff'
    },
    {
      id: 'tramites',
      titulo: 'Cómo iniciar un Trámite',
      descripcion: 'Los trámites son instancias de una política en ejecución. Para iniciar uno, ve a Políticas, selecciona una política ACTIVA y haz clic en "Iniciar trámite". Define el título, prioridad y fecha límite.',
      imagen: 'help_tramites.png',
      tips: [
        'La política debe estar en estado ACTIVA',
        'Asigna un título descriptivo al trámite',
        'Define la prioridad: BAJA, MEDIA o ALTA',
        'Establece una fecha límite para el seguimiento',
        'En "Trámites" puedes ver todos los trámites activos'
      ],
      icono: 'tramites',
      color: '#10b981'
    },
    {
      id: 'monitor',
      titulo: 'Monitor de Procesos',
      descripcion: 'El Monitor te muestra en tiempo real el estado de todos los trámites activos: en qué nodo se encuentran, cuánto tiempo llevan, quién los tiene asignados y si hay retrasos.',
      imagen: 'help_monitor.png',
      tips: [
        'Los trámites en rojo tienen fecha límite vencida',
        'Puedes filtrar por estado: EN_PROCESO, COMPLETADO, RECHAZADO',
        'Haz clic en "Ver detalle" para ver el historial completo',
        'Los cuellos de botella aparecen resaltados en naranja'
      ],
      icono: 'monitor',
      color: '#55914aff'
    }
  ];

  get currentStepData(): HelpStep {
    return this.steps[this.currentStep];
  }

  get progress(): number {
    return ((this.currentStep + 1) / this.steps.length) * 100;
  }

  ngOnInit(): void { }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.currentStep = 0;
  }

  close(): void {
    this.isOpen = false;
  }

  goTo(index: number): void {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.currentStep = index;
    setTimeout(() => this.isAnimating = false, 300);
  }

  next(): void {
    if (this.currentStep < this.steps.length - 1) {
      this.goTo(this.currentStep + 1);
    }
  }

  prev(): void {
    if (this.currentStep > 0) {
      this.goTo(this.currentStep - 1);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
