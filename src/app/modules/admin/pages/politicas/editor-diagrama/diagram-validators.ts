export interface NodoEstado {
  id?: string;
  tempId: string;
  tipo: 'INICIO' | 'TAREA' | 'DECISION' | 'FIN' | 'PARALELO' | 'PARALELO_FORK' | 'PARALELO_JOIN';
  nombre: string;
  departamentoId: string;
  formularioId?: string;
  posicionX: number;
  posicionY: number;
}

export interface TransicionEstado {
  id?: string;
  tempId: string;
  nodoOrigenId: string;
  nodoDestinoId: string;
  tipo: 'LINEAL' | 'ALTERNATIVA' | 'PARALELA';
  etiqueta?: string;
  condicion?: string;
}

export interface EstadoEditor {
  politicaId: string;
  nodos: NodoEstado[];
  transiciones: TransicionEstado[];
}

export function validarDiagrama(estado: EstadoEditor): string[] {
  const errores: string[] = [];
  const { nodos, transiciones } = estado;

  const inicios = nodos.filter(n => n.tipo === 'INICIO');
  if (inicios.length !== 1) {
    errores.push('El diagrama debe tener exactamente un nodo de Inicio');
  }

  const fines = nodos.filter(n => n.tipo === 'FIN');
  if (fines.length === 0) {
    errores.push('El diagrama debe tener al menos un nodo de Fin');
  }

  const tareas = nodos.filter(n => n.tipo === 'TAREA');
  if (tareas.length === 0) {
    errores.push('El diagrama debe tener al menos una tarea');
  }

  // Verificar nodos en carriles y conexiones
  nodos.forEach(nodo => {
    if (['TAREA', 'DECISION', 'PARALELO', 'PARALELO_FORK', 'PARALELO_JOIN'].includes(nodo.tipo) && (!nodo.departamentoId || nodo.departamentoId === '')) {
      errores.push(`El nodo '${nodo.nombre}' debe estar dentro de un carril de departamento`);
    }

    const entradas = transiciones.filter(t => t.nodoDestinoId === nodo.tempId);
    const salidas = transiciones.filter(t => t.nodoOrigenId === nodo.tempId);

    if (nodo.tipo !== 'INICIO' && entradas.length === 0) {
      errores.push(`El nodo '${nodo.nombre}' esta desconectado (ninguna entrada)`);
    }
    if (nodo.tipo !== 'FIN' && salidas.length === 0) {
      errores.push(`El nodo '${nodo.nombre}' esta desconectado (ninguna salida)`);
    }

    if (nodo.tipo === 'DECISION') {
      if (salidas.length < 2) {
        errores.push(`El nodo de Decision '${nodo.nombre}' debe tener 2 o mas salidas con etiqueta`);
      }
      salidas.forEach(s => {
        if (!s.etiqueta || s.etiqueta.trim() === '') {
          errores.push(`La salida del nodo Decision '${nodo.nombre}' requiere una etiqueta`);
        }
      });
    }

    if (nodo.tipo === 'PARALELO_FORK' || (nodo.tipo === 'PARALELO' && salidas.length > 1)) {
      if (salidas.length < 2) {
        errores.push(`El nodo Paralelo Fork '${nodo.nombre}' debe tener al menos 2 salidas.`);
      }
    }
  });

  return errores;
}
