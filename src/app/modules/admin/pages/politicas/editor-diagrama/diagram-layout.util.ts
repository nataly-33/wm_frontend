export type LayoutNodoTipo =
  | 'INICIO'
  | 'TAREA'
  | 'DECISION'
  | 'FIN'
  | 'PARALELO'
  | 'PARALELO_FORK'
  | 'PARALELO_JOIN';

export interface LayoutNodoInput {
  id: string;
  tipo: LayoutNodoTipo;
  departamentoId?: string | null;
}

export interface LayoutTransicionInput {
  nodoOrigenId: string;
  nodoDestinoId: string;
}

export interface LayoutCarrilInput {
  id: string;
  nombre: string;
}

export interface LayoutNodeSize {
  width: number;
  height: number;
}

export interface LayoutOptions {
  laneWidth?: number;
  laneStartX?: number;
  baseY?: number;
  levelGap?: number;
  nodeSizeByTipo?: Partial<Record<LayoutNodoTipo, LayoutNodeSize>>;
}

export interface LayoutNodePosition {
  x: number;
  y: number;
  laneId: string;
  laneIndex: number;
  width: number;
  height: number;
  spanFromLaneIndex: number;
  spanToLaneIndex: number;
}

export interface LayoutResult {
  laneOrder: string[];
  lanes: LayoutCarrilInput[];
  levels: Map<string, number>;
  positions: Map<string, LayoutNodePosition>;
}

const DEFAULT_LANE_WIDTH = 280;
const DEFAULT_LANE_START_X = 20;
const DEFAULT_BASE_Y = 60;
const DEFAULT_LEVEL_GAP = 160;
const FALLBACK_LANE_ID = '__default_lane__';

const DEFAULT_NODE_SIZE_BY_TIPO: Record<LayoutNodoTipo, LayoutNodeSize> = {
  INICIO: { width: 50, height: 50 },
  TAREA: { width: 160, height: 70 },
  DECISION: { width: 100, height: 90 },
  PARALELO: { width: 200, height: 15 },
  PARALELO_FORK: { width: 200, height: 15 },
  PARALELO_JOIN: { width: 200, height: 15 },
  FIN: { width: 50, height: 50 }
};

function normalizeDeptId(raw?: string | null): string | undefined {
  if (!raw) {
    return undefined;
  }
  const clean = raw.trim();
  return clean.length > 0 ? clean : undefined;
}

function isParallelTipo(tipo: LayoutNodoTipo): boolean {
  return tipo === 'PARALELO' || tipo === 'PARALELO_FORK' || tipo === 'PARALELO_JOIN';
}

function getNodeSize(tipo: LayoutNodoTipo, options?: LayoutOptions): LayoutNodeSize {
  const override = options?.nodeSizeByTipo?.[tipo];
  if (override) {
    return override;
  }
  return DEFAULT_NODE_SIZE_BY_TIPO[tipo] ?? DEFAULT_NODE_SIZE_BY_TIPO.TAREA;
}

function findNearestDepartment(
  startNodeId: string,
  adjacency: Map<string, string[]>,
  nodeById: Map<string, LayoutNodoInput>
): string | undefined {
  const queue: string[] = [startNodeId];
  const visited = new Set<string>(queue);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) {
        continue;
      }
      visited.add(next);
      const dept = normalizeDeptId(nodeById.get(next)?.departamentoId);
      if (dept) {
        return dept;
      }
      queue.push(next);
    }
  }

  return undefined;
}

function buildTopologicalOrder(
  nodeIds: string[],
  successors: Map<string, string[]>,
  predecessors: Map<string, string[]>,
  startNodeId?: string
): string[] {
  const indegree = new Map<string, number>();
  for (const id of nodeIds) {
    indegree.set(id, (predecessors.get(id) ?? []).length);
  }

  const queue: string[] = [];
  const pushed = new Set<string>();

  if (startNodeId && (indegree.get(startNodeId) ?? 0) === 0) {
    queue.push(startNodeId);
    pushed.add(startNodeId);
  }

  for (const id of nodeIds) {
    if ((indegree.get(id) ?? 0) === 0 && !pushed.has(id)) {
      queue.push(id);
      pushed.add(id);
    }
  }

  const order: string[] = [];
  const processed = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || processed.has(current)) {
      continue;
    }

    processed.add(current);
    order.push(current);

    for (const next of successors.get(current) ?? []) {
      const nextIn = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextIn);
      if (nextIn <= 0 && !processed.has(next) && !pushed.has(next)) {
        queue.push(next);
        pushed.add(next);
      }
    }
  }

  const remaining = new Set(nodeIds.filter((id) => !processed.has(id)));
  if (remaining.size === 0) {
    return order;
  }

  if (startNodeId) {
    const bfsQueue: string[] = [startNodeId];
    const bfsSeen = new Set<string>(bfsQueue);

    while (bfsQueue.length > 0) {
      const current = bfsQueue.shift();
      if (!current) {
        continue;
      }

      if (remaining.has(current)) {
        order.push(current);
        remaining.delete(current);
      }

      for (const next of successors.get(current) ?? []) {
        if (!bfsSeen.has(next)) {
          bfsSeen.add(next);
          bfsQueue.push(next);
        }
      }
    }
  }

  for (const id of nodeIds) {
    if (remaining.has(id)) {
      order.push(id);
      remaining.delete(id);
    }
  }

  return order;
}

function alignBranchLevels(
  levels: Map<string, number>,
  topoIndex: Map<string, number>,
  successors: Map<string, string[]>,
  maxIterations: number
): void {
  let changed = true;
  let guard = 0;

  while (changed && guard < maxIterations) {
    changed = false;
    guard += 1;

    for (const [nodeId, nextNodes] of successors.entries()) {
      const srcIndex = topoIndex.get(nodeId);
      if (srcIndex === undefined) {
        continue;
      }

      const forward = nextNodes.filter((nextId) => {
        const nextIndex = topoIndex.get(nextId);
        return nextIndex !== undefined && srcIndex < nextIndex;
      });

      if (forward.length < 2) {
        continue;
      }

      let branchLevel = 0;
      for (const nextId of forward) {
        branchLevel = Math.max(branchLevel, levels.get(nextId) ?? 0);
      }

      for (const nextId of forward) {
        if ((levels.get(nextId) ?? 0) !== branchLevel) {
          levels.set(nextId, branchLevel);
          changed = true;
        }
      }
    }

    for (const [srcId, nextNodes] of successors.entries()) {
      const srcIndex = topoIndex.get(srcId);
      if (srcIndex === undefined) {
        continue;
      }

      const srcLevel = levels.get(srcId) ?? 0;
      for (const nextId of nextNodes) {
        const nextIndex = topoIndex.get(nextId);
        if (nextIndex === undefined || srcIndex >= nextIndex) {
          continue;
        }

        const candidate = srcLevel + 1;
        if ((levels.get(nextId) ?? 0) < candidate) {
          levels.set(nextId, candidate);
          changed = true;
        }
      }
    }
  }
}

export function calcularLayout(
  nodos: LayoutNodoInput[],
  transiciones: LayoutTransicionInput[],
  carriles: LayoutCarrilInput[],
  options?: LayoutOptions
): LayoutResult {
  const laneWidth = options?.laneWidth ?? DEFAULT_LANE_WIDTH;
  const laneStartX = options?.laneStartX ?? DEFAULT_LANE_START_X;
  const baseY = options?.baseY ?? DEFAULT_BASE_Y;
  const levelGap = options?.levelGap ?? DEFAULT_LEVEL_GAP;

  const nodeById = new Map<string, LayoutNodoInput>();
  for (const nodo of nodos) {
    nodeById.set(nodo.id, nodo);
  }

  const nodeIds = Array.from(nodeById.keys());
  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  for (const id of nodeIds) {
    successors.set(id, []);
    predecessors.set(id, []);
  }

  for (const tr of transiciones) {
    if (!nodeById.has(tr.nodoOrigenId) || !nodeById.has(tr.nodoDestinoId)) {
      continue;
    }
    if (tr.nodoOrigenId === tr.nodoDestinoId) {
      continue;
    }
    successors.get(tr.nodoOrigenId)?.push(tr.nodoDestinoId);
    predecessors.get(tr.nodoDestinoId)?.push(tr.nodoOrigenId);
  }

  const inicioNodeId = nodos.find((n) => n.tipo === 'INICIO')?.id ?? nodeIds[0];

  const laneOrder: string[] = [];
  const seenLane = new Set<string>();

  const pushLane = (laneId?: string): void => {
    if (!laneId || seenLane.has(laneId)) {
      return;
    }
    seenLane.add(laneId);
    laneOrder.push(laneId);
  };

  const deptFrequency = new Map<string, number>();
  for (const node of nodos) {
    const dept = normalizeDeptId(node.departamentoId);
    if (!dept) {
      continue;
    }
    deptFrequency.set(dept, (deptFrequency.get(dept) ?? 0) + 1);
  }

  let mostFrequentDept: string | undefined;
  let maxCount = -1;
  deptFrequency.forEach((count, dept) => {
    if (count > maxCount) {
      maxCount = count;
      mostFrequentDept = dept;
    }
  });

  const bfsQueue: string[] = [];
  const bfsVisited = new Set<string>();
  if (inicioNodeId) {
    bfsQueue.push(inicioNodeId);
  }

  while (bfsQueue.length > 0) {
    const current = bfsQueue.shift();
    if (!current || bfsVisited.has(current)) {
      continue;
    }
    bfsVisited.add(current);

    const dept = normalizeDeptId(nodeById.get(current)?.departamentoId);
    pushLane(dept);

    for (const next of successors.get(current) ?? []) {
      if (!bfsVisited.has(next)) {
        bfsQueue.push(next);
      }
    }
  }

  for (const node of nodos) {
    pushLane(normalizeDeptId(node.departamentoId));
  }

  const resolvedDeptByNode = new Map<string, string>();
  const resolveDeptForNode = (nodeId: string): string => {
    const cached = resolvedDeptByNode.get(nodeId);
    if (cached) {
      return cached;
    }

    const node = nodeById.get(nodeId);
    let dept = normalizeDeptId(node?.departamentoId);

    if (!dept && node) {
      if (node.tipo === 'INICIO') {
        dept = findNearestDepartment(nodeId, successors, nodeById);
      } else if (node.tipo === 'FIN') {
        dept = findNearestDepartment(nodeId, predecessors, nodeById);
      } else {
        dept = findNearestDepartment(nodeId, successors, nodeById) ?? findNearestDepartment(nodeId, predecessors, nodeById);
      }
    }

    if (!dept) {
      dept = mostFrequentDept ?? laneOrder[0] ?? carriles[0]?.id ?? FALLBACK_LANE_ID;
    }

    pushLane(dept);
    resolvedDeptByNode.set(nodeId, dept);
    return dept;
  };

  for (const id of nodeIds) {
    resolveDeptForNode(id);
  }

  if (laneOrder.length === 0) {
    pushLane(carriles[0]?.id ?? FALLBACK_LANE_ID);
  }

  const laneIndexById = new Map<string, number>();
  laneOrder.forEach((laneId, index) => laneIndexById.set(laneId, index));

  const topoOrder = buildTopologicalOrder(nodeIds, successors, predecessors, inicioNodeId);
  const topoIndex = new Map<string, number>();
  topoOrder.forEach((id, index) => topoIndex.set(id, index));

  const levels = new Map<string, number>();
  if (inicioNodeId) {
    levels.set(inicioNodeId, 0);
  }

  for (const nodeId of topoOrder) {
    const idx = topoIndex.get(nodeId);
    if (idx === undefined) {
      continue;
    }

    let level = levels.get(nodeId) ?? 0;
    const preds = predecessors.get(nodeId) ?? [];
    for (const predId of preds) {
      const predIdx = topoIndex.get(predId);
      if (predIdx === undefined || predIdx >= idx) {
        continue;
      }
      level = Math.max(level, (levels.get(predId) ?? 0) + 1);
    }

    if (nodeId === inicioNodeId) {
      level = 0;
    }

    levels.set(nodeId, level);
  }

  alignBranchLevels(levels, topoIndex, successors, nodeIds.length * 3);

  const positions = new Map<string, LayoutNodePosition>();

  for (const nodeId of nodeIds) {
    const node = nodeById.get(nodeId);
    if (!node) {
      continue;
    }

    const laneId = resolveDeptForNode(nodeId);
    const laneIndex = laneIndexById.get(laneId) ?? 0;
    const level = levels.get(nodeId) ?? 0;

    const nodeSize = getNodeSize(node.tipo, options);
    let width = nodeSize.width;
    const height = nodeSize.height;

    let spanFromLaneIndex = laneIndex;
    let spanToLaneIndex = laneIndex;

    if (isParallelTipo(node.tipo)) {
      const candidateLaneIndexes = new Set<number>([laneIndex]);
      for (const nextId of successors.get(nodeId) ?? []) {
        candidateLaneIndexes.add(laneIndexById.get(resolveDeptForNode(nextId)) ?? laneIndex);
      }
      for (const prevId of predecessors.get(nodeId) ?? []) {
        candidateLaneIndexes.add(laneIndexById.get(resolveDeptForNode(prevId)) ?? laneIndex);
      }

      const arr = Array.from(candidateLaneIndexes.values());
      spanFromLaneIndex = Math.min(...arr);
      spanToLaneIndex = Math.max(...arr);

      if (spanToLaneIndex > spanFromLaneIndex) {
        width = nodeSize.width + (spanToLaneIndex - spanFromLaneIndex) * laneWidth;
      }
    }

    const laneStart = laneStartX + laneIndex * laneWidth;
    let x = laneStart + laneWidth / 2 - width / 2;
    if (isParallelTipo(node.tipo)) {
      x = laneStartX + spanFromLaneIndex * laneWidth + 40;
    }

    const y = baseY + level * levelGap;

    positions.set(nodeId, {
      x,
      y,
      laneId,
      laneIndex,
      width,
      height,
      spanFromLaneIndex,
      spanToLaneIndex
    });
  }

  const laneNameById = new Map(carriles.map((lane) => [lane.id, lane.nombre] as const));
  const lanes = laneOrder.map((laneId) => ({
    id: laneId,
    nombre: laneNameById.get(laneId) ?? 'Departamento'
  }));

  return {
    laneOrder,
    lanes,
    levels,
    positions
  };
}
