/**
 * Constantes visuales UML 2.5 Activity (maxGraph / estilo mxGraph).
 * Sin fondos azules; bordes grises oscuros; carril con título superior (horizontal=1).
 */

/** Círculo negro sólido ~40px */
export const STYLE_INICIO = 'ellipse;fillColor=#000000;strokeColor=#000000;html=1;fontColor=#FFFFFF;fontSize=11;';

/** Actividad: blanco, esquinas ligeramente redondeadas */
export const STYLE_TAREA =
  'rounded=1;fillColor=#FFFFFF;strokeColor=#666666;arcSize=15;html=1;fontColor=#111111;fontSize=11;whiteSpace=wrap;';

/** Decisión: rombo blanco */
export const STYLE_DECISION = 'rhombus;fillColor=#FFFFFF;strokeColor=#666666;html=1;fontColor=#111111;fontSize=11;';

/** Fork/Join: barra negra ancha (alternativa a stencil flowchart.or no registrado en maxGraph) */
export const STYLE_PARALELO =
  'rounded=0;fillColor=#000000;strokeColor=#000000;html=1;strokeWidth=1;';

/** Fin: doble elipse — borde gris, interior claro (legible); ajustar si prefieres todo negro */
export const STYLE_FIN =
  'shape=doubleEllipse;fillColor=#FFFFFF;strokeColor=#666666;html=1;fontColor=#111111;fontSize=10;';

/**
 * Carril vertical con nombre en la parte SUPERIOR (horizontal=1 en mxGraph/maxGraph).
 * Ancho ~240px; franja de título startSize; contenido debajo.
 */
export const STYLE_SWIMLANE =
  'swimlane;horizontal=1;startSize=38;html=1;' +
  'fillColor=#e8ebe3;swimlaneFillColor=#f6f9ed;strokeColor=#888888;' +
  'fontColor=#222222;fontStyle=1;fontSize=12;';

/** Flechas delgadas gris oscuro */
export const STYLE_EDGE =
  'orthogonalEdgeStyle;html=1;strokeWidth=1;strokeColor=#555555;fontColor=#555555;fontSize=10;' +
  'endArrow=classic;endFill=1;rounded=0;';

export const PALETTE_SVGS: Record<string, string> = {
  INICIO:
    '<svg width="30" height="30" aria-hidden="true"><circle cx="15" cy="15" r="12" fill="#000"/></svg>',
  TAREA:
    '<svg width="50" height="25" aria-hidden="true"><rect width="48" height="23" x="1" y="1" rx="4" fill="#fff" stroke="#666"/></svg>',
  DECISION:
    '<svg width="40" height="40" aria-hidden="true"><polygon points="20,2 38,20 20,38 2,20" fill="#fff" stroke="#666"/></svg>',
  PARALELO:
    '<svg width="50" height="15" aria-hidden="true"><rect width="48" height="6" x="1" y="4" fill="#000"/></svg>',
  FIN:
    '<svg width="30" height="30" aria-hidden="true"><circle cx="15" cy="15" r="12" fill="#fff" stroke="#000" stroke-width="2"/><circle cx="15" cy="15" r="7" fill="#000"/></svg>'
};

export function styleForTipo(tipo: string): string {
  switch (tipo) {
    case 'INICIO':
      return STYLE_INICIO;
    case 'TAREA':
      return STYLE_TAREA;
    case 'DECISION':
      return STYLE_DECISION;
    case 'PARALELO':
      return STYLE_PARALELO;
    case 'FIN':
      return STYLE_FIN;
    default:
      return STYLE_TAREA;
  }
}

export function sizeForTipo(tipo: string): { w: number; h: number } {
  switch (tipo) {
    case 'INICIO':
      return { w: 40, h: 40 };
    case 'DECISION':
      return { w: 88, h: 88 };
    case 'PARALELO':
      return { w: 120, h: 8 };
    case 'FIN':
      return { w: 40, h: 40 };
    case 'TAREA':
    default:
      return { w: 160, h: 56 };
  }
}
