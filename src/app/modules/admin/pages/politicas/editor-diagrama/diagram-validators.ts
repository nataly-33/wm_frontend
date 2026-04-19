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

export interface ResultadoValidacionDiagrama {
  errores: string[];
  advertencias: string[];
}

function existeCaminoInicioFin(nodos: NodoEstado[], transiciones: TransicionEstado[]): boolean {
  const inicio = nodos.find((n) => n.tipo === 'INICIO');
  const fines = new Set(nodos.filter((n) => n.tipo === 'FIN').map((n) => n.tempId));
  if (!inicio || fines.size === 0) {
    return false;
  }
  const adj = new Map<string, string[]>();
  for (const t of transiciones) {
    if (!adj.has(t.nodoOrigenId)) {
      adj.set(t.nodoOrigenId, []);
    }
    adj.get(t.nodoOrigenId)!.push(t.nodoDestinoId);
  }
  const q = [inicio.tempId];
  const vis = new Set(q);
  while (q.length) {
    const u = q.shift()!;
    if (fines.has(u)) {
      return true;
    }
    for (const v of adj.get(u) ?? []) {
      if (!vis.has(v)) {
        vis.add(v);
        q.push(v);
      }
    }
  }
  return false;
}

/** deptosConAdminIds: ids permitidos para carriles (GET completos). */
export function validarDiagrama(estado: EstadoEditor, deptosConAdminIds?: Set<string>): string[] {
  return validarDiagramaDetallado(estado, deptosConAdminIds).errores;
}

export function validarDiagramaDetallado(estado: EstadoEditor, deptosConAdminIds?: Set<string>): ResultadoValidacionDiagrama {
  const errores: string[] = [];
  const advertencias: string[] = [];
  const { nodos, transiciones } = estado;

  const inicios = nodos.filter((n) => n.tipo === 'INICIO');
  if (inicios.length !== 1) {
    errores.push('El diagrama debe tener exactamente un nodo de Inicio');
  }

  const fines = nodos.filter((n) => n.tipo === 'FIN');
  if (fines.length === 0) {
    errores.push('El diagrama debe tener al menos un nodo de Fin');
  }

  const tareas = nodos.filter((n) => n.tipo === 'TAREA');
  if (tareas.length === 0) {
    errores.push('El diagrama debe tener al menos una tarea');
  }

  nodos.forEach((nodo) => {
    const necesitaCarril = ['TAREA', 'DECISION', 'PARALELO', 'PARALELO_FORK', 'PARALELO_JOIN'].includes(nodo.tipo);
    if (necesitaCarril && (!nodo.departamentoId || nodo.departamentoId === '')) {
      errores.push(`El nodo '${nodo.nombre}' debe estar dentro de un carril de departamento`);
    }

    if (deptosConAdminIds && necesitaCarril && nodo.departamentoId && !deptosConAdminIds.has(nodo.departamentoId)) {
      errores.push(`El departamento del nodo '${nodo.nombre}' no tiene administrador asignado o no es válido`);
    }

    const entradas = transiciones.filter((t) => t.nodoDestinoId === nodo.tempId);
    const salidas = transiciones.filter((t) => t.nodoOrigenId === nodo.tempId);

    if (nodo.tipo !== 'INICIO' && entradas.length === 0) {
      errores.push(`El nodo '${nodo.nombre}' esta desconectado (ninguna entrada)`);
    }
    if (nodo.tipo !== 'FIN' && salidas.length === 0) {
      errores.push(`El nodo '${nodo.nombre}' esta desconectado (ninguna salida)`);
    }

    if (nodo.tipo === 'DECISION') {
      const salAlt = salidas.filter((s) => s.tipo === 'ALTERNATIVA');
      if (entradas.length !== 1 || salidas.length < 2 || salAlt.length !== salidas.length) {
        errores.push(`El nodo de Decision '${nodo.nombre}' debe tener 2 o mas salidas de tipo Alternativa con etiqueta`);
      }
      salAlt.forEach((s) => {
        if (!s.etiqueta || s.etiqueta.trim() === '') {
          errores.push(`La salida ALTERNATIVA desde '${nodo.nombre}' requiere etiqueta`);
        }
      });
    }

    if (nodo.tipo === 'PARALELO') {
      const entradasPar = entradas.filter((e) => e.tipo === 'PARALELA').length;
      const salidasPar = salidas.filter((s) => s.tipo === 'PARALELA').length;
      const esForkValido = entradas.length === 1 && salidas.length >= 2 && salidasPar === salidas.length;
      const esJoinValido = entradas.length >= 2 && entradasPar === entradas.length && salidas.length === 1;
      if (!esForkValido && !esJoinValido) {
        errores.push(`El nodo Paralelo '${nodo.nombre}' no tiene el numero correcto de conexiones`);
      }
    }

    if (nodo.tipo === 'TAREA' && (!nodo.formularioId || nodo.formularioId.trim() === '')) {
      advertencias.push(`Advertencia: '${nodo.nombre}' no tiene formulario`);
    }
  });

  transiciones
    .filter((t) => t.tipo === 'ALTERNATIVA' && (!t.condicion || t.condicion.trim() === ''))
    .forEach((t) => {
      const et = t.etiqueta && t.etiqueta.trim() ? t.etiqueta : t.tempId;
      advertencias.push(`Advertencia: condicion vacia en transicion '${et}'`);
    });

  if (!existeCaminoInicioFin(nodos, transiciones)) {
    errores.push('No existe un camino valido desde Inicio hasta Fin');
  }

  return { errores, advertencias };
}
