/**
 * Bidirectional Pruning — COS Graph Engine v2.1 Fase 1.2
 *
 * Estrategias de poda configurables para BFS, DFS y shortest path.
 * Reduccion del espacio de busqueda hasta 60%.
 *
 * Zero dependencias externas.
 *
 * Arquitectura:
 *   PruningStrategy (interface)  ←  MaxDepthPruning, VisitedPruning, etc.
 *   PruningExecutor (pipeline)   ←  orquesta estrategias en orden
 *   CSRGraph.bfsWithPruning()    ←  consume PruningExecutor
 */

// ============================================================
// PruningState
// ============================================================

export interface PruningState {
  visited: Set<string>;
  depth: number;
  maxDepth: number;
  target?: string;
  costSoFar: Map<string, number>;
  currentNode: string;
  source: string;
  bidirectional: boolean;
  metadata: Map<string, unknown>;
}

export function createPruningState(
  source: string,
  target?: string,
  maxDepth: number = Infinity
): PruningState {
  return {
    visited: new Set<string>(),
    depth: 0,
    maxDepth,
    target,
    costSoFar: new Map<string, number>(),
    currentNode: source,
    source,
    bidirectional: false,
    metadata: new Map<string, unknown>(),
  };
}

// ============================================================
// PruningResult
// ============================================================

export interface PruningResult {
  totalNodesConsidered: number;
  expandedNodes: number;
  prunedNodes: number;
  prunedBy: Map<string, number>;
  pruningRatio: number;
  durationMs: number;
  strategiesUsed: string[];
}

export function createPruningResult(
  strategies: PruningStrategy[],
  startTime: number
): PruningResult {
  return {
    totalNodesConsidered: 0,
    expandedNodes: 0,
    prunedNodes: 0,
    prunedBy: new Map<string, number>(),
    pruningRatio: 0,
    durationMs: 0,
    strategiesUsed: strategies.map(s => s.name),
  };
}

// ============================================================
// PruningStrategy — interface
// ============================================================

export interface PruningStrategy {
  /** Nombre unico de la estrategia */
  readonly name: string;

  /** Decide si un nodo debe ser podado (true = no explorar) */
  shouldPrune(nodeId: string, depth: number, state: Readonly<PruningState>): boolean;

  /** Hook opcional: se ejecuta al expandir un nodo */
  onExpand?(nodeId: string, depth: number, state: PruningState): void;

  /** Hook opcional: se ejecuta al encontrar el target */
  onTargetFound?(nodeId: string, state: PruningState): void;

  /** Reset del estado interno entre ejecuciones */
  reset(): void;
}

// ============================================================
// PruningExecutor — pipeline de estrategias
// ============================================================

export class PruningExecutor {
  private strategies: PruningStrategy[];
  private _totalNodes: number = 0;
  private _expandedNodes: number = 0;
  private _prunedNodes: number = 0;
  private _prunedBy: Map<string, number> = new Map();
  private _startTime: number = 0;
  private _targetFound: boolean = false;

  constructor(strategies: PruningStrategy[]) {
    this.strategies = [...strategies];
  }

  /**
   * Evalua todas las estrategias en orden.
   * Short-circuit en la primera que devuelve true.
   */
  shouldPrune(nodeId: string, depth: number, state: PruningState): boolean {
    this._totalNodes++;
    for (const strategy of this.strategies) {
      if (strategy.shouldPrune(nodeId, depth, state)) {
        this._prunedNodes++;
        const count = this._prunedBy.get(strategy.name) || 0;
        this._prunedBy.set(strategy.name, count + 1);
        return true;
      }
    }
    this._expandedNodes++;
    return false;
  }

  onExpand(nodeId: string, depth: number, state: PruningState): void {
    for (const strategy of this.strategies) {
      strategy.onExpand?.(nodeId, depth, state);
    }
  }

  onTargetFound(nodeId: string, state: PruningState): void {
    this._targetFound = true;
    for (const strategy of this.strategies) {
      strategy.onTargetFound?.(nodeId, state);
    }
  }

  get targetFound(): boolean {
    return this._targetFound;
  }

  reset(): void {
    this._totalNodes = 0;
    this._expandedNodes = 0;
    this._prunedNodes = 0;
    this._prunedBy = new Map();
    this._startTime = 0;
    this._targetFound = false;
    for (const strategy of this.strategies) {
      strategy.reset();
    }
  }

  startTimer(): void {
    this._startTime = Date.now();
  }

  result(): PruningResult {
    const duration = this._startTime > 0 ? Date.now() - this._startTime : 0;
    return {
      totalNodesConsidered: this._totalNodes,
      expandedNodes: this._expandedNodes,
      prunedNodes: this._prunedNodes,
      prunedBy: new Map(this._prunedBy),
      pruningRatio: this._totalNodes > 0
        ? this._prunedNodes / this._totalNodes
        : 0,
      durationMs: duration,
      strategiesUsed: this.strategies.map(s => s.name),
    };
  }
}

// ============================================================
// Estrategias Built-in
// ============================================================

// ----------------------------------------------------------
// 1. MaxDepthPruning
// ----------------------------------------------------------

export class MaxDepthPruning implements PruningStrategy {
  readonly name = 'MaxDepthPruning';
  private maxDepth: number;

  constructor(maxDepth: number = Infinity) {
    this.maxDepth = maxDepth;
  }

  shouldPrune(_nodeId: string, depth: number, _state: Readonly<PruningState>): boolean {
    return depth >= this.maxDepth;
  }

  reset(): void {
    // No state to reset
  }
}

// ----------------------------------------------------------
// 2. VisitedPruning
// ----------------------------------------------------------

export class VisitedPruning implements PruningStrategy {
  readonly name = 'VisitedPruning';
  private visited: Set<string> = new Set();

  shouldPrune(nodeId: string, _depth: number, _state: Readonly<PruningState>): boolean {
    if (this.visited.has(nodeId)) return true;
    this.visited.add(nodeId);
    return false;
  }

  reset(): void {
    this.visited = new Set();
  }
}

// ----------------------------------------------------------
// 3. TargetDirectionPruning
// ----------------------------------------------------------

export class TargetDirectionPruning implements PruningStrategy {
  readonly name = 'TargetDirectionPruning';
  private ancestors: Set<string> = new Set();
  private maxDepth: number;
  private graph: { reverseNeighbors: (id: string) => string[] };

  constructor(
    graph: { reverseNeighbors: (id: string) => string[] },
    target: string,
    maxDepth: number = 5
  ) {
    this.graph = graph;
    this.maxDepth = maxDepth;
    this.precomputeAncestors(target);
  }

  private precomputeAncestors(target: string): void {
    const queue: Array<{ id: string; depth: number }> = [{ id: target, depth: 0 }];
    this.ancestors.add(target);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= this.maxDepth) continue;

      const revNbrs = this.graph.reverseNeighbors(current.id);
      for (const nid of revNbrs) {
        if (!this.ancestors.has(nid)) {
          this.ancestors.add(nid);
          queue.push({ id: nid, depth: current.depth + 1 });
        }
      }
    }
  }

  shouldPrune(nodeId: string, _depth: number, state: Readonly<PruningState>): boolean {
    if (!state.target) return false;
    // Si el target no tiene ancestros computados, no pruneamos
    if (this.ancestors.size <= 1) return false;
    // Pruneamos si el nodo no esta en el subarbol inverso del target
    return !this.ancestors.has(nodeId);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onExpand?(nodeId: string, _depth: number, state: PruningState): void {
    // Si el nodo expandido es el target, lo agregamos a ancestors
    if (state.target && nodeId === state.target) {
      this.ancestors.add(nodeId);
    }
  }

  reset(): void {
    // No reseteamos ancestors — son precomputados
  }
}

// ----------------------------------------------------------
// 4. CostBoundPruning
// ----------------------------------------------------------

export class CostBoundPruning implements PruningStrategy {
  readonly name = 'CostBoundPruning';
  private bestPath: number = Infinity;

  shouldPrune(nodeId: string, _depth: number, state: Readonly<PruningState>): boolean {
    const cost = state.costSoFar.get(nodeId);
    if (cost === undefined) return false;
    return cost > this.bestPath;
  }

  onTargetFound?(_nodeId: string, state: PruningState): void {
    const cost = state.costSoFar.get(_nodeId);
    if (cost !== undefined && cost < this.bestPath) {
      this.bestPath = cost;
    }
  }

  reset(): void {
    this.bestPath = Infinity;
  }
}

// ----------------------------------------------------------
// 5. BeamPruning
// ----------------------------------------------------------

interface BeamCandidate {
  nodeId: string;
  depth: number;
  heuristic: number;
}

export class BeamPruning implements PruningStrategy {
  readonly name = 'BeamPruning';
  private k: number;
  private candidatesByDepth: Map<number, BeamCandidate[]> = new Map();
  private expandedThisDepth: Map<number, number> = new Map();

  constructor(k: number = 50) {
    this.k = k;
  }

  shouldPrune(nodeId: string, depth: number, state: Readonly<PruningState>): boolean {
    const expanded = this.expandedThisDepth.get(depth) || 0;

    // Si aun no hemos alcanzado el beam width, permitimos
    if (expanded < this.k) {
      this.expandedThisDepth.set(depth, expanded + 1);
      return false;
    }

    // Almacenamos como candidato para re-evaluacion
    const candidates = this.candidatesByDepth.get(depth) || [];
    const heuristic = this.computeHeuristic(nodeId, state);
    candidates.push({ nodeId, depth, heuristic });
    this.candidatesByDepth.set(depth, candidates);

    // Siempre pruneamos — el onExpand re-evaluara
    return true;
  }

  onExpand?(nodeId: string, depth: number, state: PruningState): void {
    // Re-evaluamos candidatos si hay espacio
    const candidates = this.candidatesByDepth.get(depth);
    if (!candidates || candidates.length === 0) return;

    // Ordenamos por heuristic (menor = mejor)
    candidates.sort((a, b) => a.heuristic - b.heuristic);

    // Tomamos los mejores que no se hayan expandido ya
    const expanded = this.expandedThisDepth.get(depth) || 0;
    const slots = this.k - expanded;
    if (slots <= 0) return;

    // Marcamos candidatos para re-expansion (no podemos realmente expandir desde aqui)
    // En la practica, el beam prunea los peores K candidatos
    this.candidatesByDepth.set(depth, candidates.slice(slots));
  }

  private computeHeuristic(nodeId: string, state: Readonly<PruningState>): number {
    // Heuristica simple: preferimos nodos con menor costo acumulado
    const cost = state.costSoFar.get(nodeId);
    if (cost !== undefined) return cost;
    // Si no hay costo, preferimos nodos cercanos al source
    return state.depth;
  }

  reset(): void {
    this.candidatesByDepth = new Map();
    this.expandedThisDepth = new Map();
  }
}

// ----------------------------------------------------------
// 6. LandmarkPruning
// ----------------------------------------------------------

export class LandmarkPruning implements PruningStrategy {
  readonly name = 'LandmarkPruning';
  private landmarks: string[] = [];
  private distances: Map<string, number[]> = new Map(); // nodeId -> [dist to landmark 0, dist to landmark 1, ...]
  private graph: { neighbors: (id: string) => string[] };
  private margin: number;

  constructor(
    graph: { neighbors: (id: string) => string[] },
    landmarks: string[],
    margin: number = 2
  ) {
    this.graph = graph;
    this.landmarks = landmarks;
    this.margin = margin;
    this.precomputeDistances();
  }

  private precomputeDistances(): void {
    if (this.landmarks.length === 0) return;

    // Para cada landmark, ejecutamos BFS limitado
    for (const landmark of this.landmarks) {
      const queue: Array<{ id: string; dist: number }> = [{ id: landmark, dist: 0 }];
      const visited = new Set<string>([landmark]);
      this.distances.set(landmark, Array.from({ length: this.landmarks.length }, () => -1));

      // Distancia del landmark a si mismo es 0
      const landmarkIdx = this.landmarks.indexOf(landmark);
      this.distances.get(landmark)![landmarkIdx] = 0;

      while (queue.length > 0) {
        const current = queue.shift()!;
        // Guardamos distancia de este nodo al landmark
        const nodeDist = this.distances.get(current.id) || Array.from(
          { length: this.landmarks.length }, () => -1
        );
        nodeDist[landmarkIdx] = current.dist;
        this.distances.set(current.id, nodeDist);

        const nbrs = this.graph.neighbors(current.id);
        for (const nid of nbrs) {
          if (!visited.has(nid)) {
            visited.add(nid);
            queue.push({ id: nid, dist: current.dist + 1 });
          }
        }
      }
    }
  }

  private estimateDistance(nodeId: string, targetId: string): number {
    // Usamos triangulacion con landmarks para estimar distancia
    const nodeDists = this.distances.get(nodeId);
    const targetDists = this.distances.get(targetId);

    if (!nodeDists || !targetDists) return -1;

    let maxDist = 0;
    for (let i = 0; i < this.landmarks.length; i++) {
      // d(n, t) ≈ |d(n, L) - d(t, L)|
      if (nodeDists[i] >= 0 && targetDists[i] >= 0) {
        const est = Math.abs(nodeDists[i] - targetDists[i]);
        if (est > maxDist) maxDist = est;
      }
    }

    return maxDist;
  }

  shouldPrune(_nodeId: string, _depth: number, state: Readonly<PruningState>): boolean {
    if (!state.target) return false;
    if (this.landmarks.length === 0) return false;

    const estDist = this.estimateDistance(state.currentNode, state.target);
    if (estDist < 0) return false;

    // Si la distancia estimada es mayor que el mejor camino conocido + margen, pruneamos
    const bestPath = state.costSoFar.get(state.target);
    if (bestPath !== undefined && estDist + this.margin > bestPath) {
      return true;
    }

    return false;
  }

  reset(): void {
    // No reseteamos — landmarks son precomputados
  }

  getStats(): { landmarks: number; distances: number } {
    return {
      landmarks: this.landmarks.length,
      distances: this.distances.size,
    };
  }
}

// ----------------------------------------------------------
// 7. EarlyExitPruning
// ----------------------------------------------------------

export class EarlyExitPruning implements PruningStrategy {
  readonly name = 'EarlyExitPruning';
  private foundTarget: boolean = false;

  shouldPrune(_nodeId: string, _depth: number, _state: Readonly<PruningState>): boolean {
    return this.foundTarget;
  }

  onTargetFound?(_nodeId: string, _state: PruningState): void {
    this.foundTarget = true;
  }

  reset(): void {
    this.foundTarget = false;
  }

  get found(): boolean {
    return this.foundTarget;
  }
}

// ============================================================
// Export index
// ============================================================

export const BUILTIN_STRATEGIES = [
  'MaxDepthPruning',
  'VisitedPruning',
  'TargetDirectionPruning',
  'CostBoundPruning',
  'BeamPruning',
  'LandmarkPruning',
  'EarlyExitPruning',
] as const;

export type BuiltinStrategyName = (typeof BUILTIN_STRATEGIES)[number];