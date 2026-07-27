"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_STRATEGIES = exports.EarlyExitPruning = exports.LandmarkPruning = exports.BeamPruning = exports.CostBoundPruning = exports.TargetDirectionPruning = exports.VisitedPruning = exports.MaxDepthPruning = exports.PruningExecutor = void 0;
exports.createPruningState = createPruningState;
exports.createPruningResult = createPruningResult;
function createPruningState(source, target, maxDepth = Infinity) {
    return {
        visited: new Set(),
        depth: 0,
        maxDepth,
        target,
        costSoFar: new Map(),
        currentNode: source,
        source,
        bidirectional: false,
        metadata: new Map(),
    };
}
function createPruningResult(strategies, startTime) {
    return {
        totalNodesConsidered: 0,
        expandedNodes: 0,
        prunedNodes: 0,
        prunedBy: new Map(),
        pruningRatio: 0,
        durationMs: 0,
        strategiesUsed: strategies.map(s => s.name),
    };
}
// ============================================================
// PruningExecutor — pipeline de estrategias
// ============================================================
class PruningExecutor {
    strategies;
    _totalNodes = 0;
    _expandedNodes = 0;
    _prunedNodes = 0;
    _prunedBy = new Map();
    _startTime = 0;
    _targetFound = false;
    constructor(strategies) {
        this.strategies = [...strategies];
    }
    /**
     * Evalua todas las estrategias en orden.
     * Short-circuit en la primera que devuelve true.
     */
    shouldPrune(nodeId, depth, state) {
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
    onExpand(nodeId, depth, state) {
        for (const strategy of this.strategies) {
            strategy.onExpand?.(nodeId, depth, state);
        }
    }
    onTargetFound(nodeId, state) {
        this._targetFound = true;
        for (const strategy of this.strategies) {
            strategy.onTargetFound?.(nodeId, state);
        }
    }
    get targetFound() {
        return this._targetFound;
    }
    reset() {
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
    startTimer() {
        this._startTime = Date.now();
    }
    result() {
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
exports.PruningExecutor = PruningExecutor;
// ============================================================
// Estrategias Built-in
// ============================================================
// ----------------------------------------------------------
// 1. MaxDepthPruning
// ----------------------------------------------------------
class MaxDepthPruning {
    name = 'MaxDepthPruning';
    maxDepth;
    constructor(maxDepth = Infinity) {
        this.maxDepth = maxDepth;
    }
    shouldPrune(_nodeId, depth, _state) {
        return depth >= this.maxDepth;
    }
    reset() {
        // No state to reset
    }
}
exports.MaxDepthPruning = MaxDepthPruning;
// ----------------------------------------------------------
// 2. VisitedPruning
// ----------------------------------------------------------
class VisitedPruning {
    name = 'VisitedPruning';
    visited = new Set();
    shouldPrune(nodeId, _depth, _state) {
        if (this.visited.has(nodeId))
            return true;
        this.visited.add(nodeId);
        return false;
    }
    reset() {
        this.visited = new Set();
    }
}
exports.VisitedPruning = VisitedPruning;
// ----------------------------------------------------------
// 3. TargetDirectionPruning
// ----------------------------------------------------------
class TargetDirectionPruning {
    name = 'TargetDirectionPruning';
    ancestors = new Set();
    maxDepth;
    graph;
    constructor(graph, target, maxDepth = 5) {
        this.graph = graph;
        this.maxDepth = maxDepth;
        this.precomputeAncestors(target);
    }
    precomputeAncestors(target) {
        const queue = [{ id: target, depth: 0 }];
        this.ancestors.add(target);
        while (queue.length > 0) {
            const current = queue.shift();
            if (current.depth >= this.maxDepth)
                continue;
            const revNbrs = this.graph.reverseNeighbors(current.id);
            for (const nid of revNbrs) {
                if (!this.ancestors.has(nid)) {
                    this.ancestors.add(nid);
                    queue.push({ id: nid, depth: current.depth + 1 });
                }
            }
        }
    }
    shouldPrune(nodeId, _depth, state) {
        if (!state.target)
            return false;
        // Si el target no tiene ancestros computados, no pruneamos
        if (this.ancestors.size <= 1)
            return false;
        // Pruneamos si el nodo no esta en el subarbol inverso del target
        return !this.ancestors.has(nodeId);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onExpand(nodeId, _depth, state) {
        // Si el nodo expandido es el target, lo agregamos a ancestors
        if (state.target && nodeId === state.target) {
            this.ancestors.add(nodeId);
        }
    }
    reset() {
        // No reseteamos ancestors — son precomputados
    }
}
exports.TargetDirectionPruning = TargetDirectionPruning;
// ----------------------------------------------------------
// 4. CostBoundPruning
// ----------------------------------------------------------
class CostBoundPruning {
    name = 'CostBoundPruning';
    bestPath = Infinity;
    shouldPrune(nodeId, _depth, state) {
        const cost = state.costSoFar.get(nodeId);
        if (cost === undefined)
            return false;
        return cost > this.bestPath;
    }
    onTargetFound(_nodeId, state) {
        const cost = state.costSoFar.get(_nodeId);
        if (cost !== undefined && cost < this.bestPath) {
            this.bestPath = cost;
        }
    }
    reset() {
        this.bestPath = Infinity;
    }
}
exports.CostBoundPruning = CostBoundPruning;
class BeamPruning {
    name = 'BeamPruning';
    k;
    candidatesByDepth = new Map();
    expandedThisDepth = new Map();
    constructor(k = 50) {
        this.k = k;
    }
    shouldPrune(nodeId, depth, state) {
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
    onExpand(nodeId, depth, state) {
        // Re-evaluamos candidatos si hay espacio
        const candidates = this.candidatesByDepth.get(depth);
        if (!candidates || candidates.length === 0)
            return;
        // Ordenamos por heuristic (menor = mejor)
        candidates.sort((a, b) => a.heuristic - b.heuristic);
        // Tomamos los mejores que no se hayan expandido ya
        const expanded = this.expandedThisDepth.get(depth) || 0;
        const slots = this.k - expanded;
        if (slots <= 0)
            return;
        // Marcamos candidatos para re-expansion (no podemos realmente expandir desde aqui)
        // En la practica, el beam prunea los peores K candidatos
        this.candidatesByDepth.set(depth, candidates.slice(slots));
    }
    computeHeuristic(nodeId, state) {
        // Heuristica simple: preferimos nodos con menor costo acumulado
        const cost = state.costSoFar.get(nodeId);
        if (cost !== undefined)
            return cost;
        // Si no hay costo, preferimos nodos cercanos al source
        return state.depth;
    }
    reset() {
        this.candidatesByDepth = new Map();
        this.expandedThisDepth = new Map();
    }
}
exports.BeamPruning = BeamPruning;
// ----------------------------------------------------------
// 6. LandmarkPruning
// ----------------------------------------------------------
class LandmarkPruning {
    name = 'LandmarkPruning';
    landmarks = [];
    distances = new Map(); // nodeId -> [dist to landmark 0, dist to landmark 1, ...]
    graph;
    margin;
    constructor(graph, landmarks, margin = 2) {
        this.graph = graph;
        this.landmarks = landmarks;
        this.margin = margin;
        this.precomputeDistances();
    }
    precomputeDistances() {
        if (this.landmarks.length === 0)
            return;
        // Para cada landmark, ejecutamos BFS limitado
        for (const landmark of this.landmarks) {
            const queue = [{ id: landmark, dist: 0 }];
            const visited = new Set([landmark]);
            this.distances.set(landmark, Array.from({ length: this.landmarks.length }, () => -1));
            // Distancia del landmark a si mismo es 0
            const landmarkIdx = this.landmarks.indexOf(landmark);
            this.distances.get(landmark)[landmarkIdx] = 0;
            while (queue.length > 0) {
                const current = queue.shift();
                // Guardamos distancia de este nodo al landmark
                const nodeDist = this.distances.get(current.id) || Array.from({ length: this.landmarks.length }, () => -1);
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
    estimateDistance(nodeId, targetId) {
        // Usamos triangulacion con landmarks para estimar distancia
        const nodeDists = this.distances.get(nodeId);
        const targetDists = this.distances.get(targetId);
        if (!nodeDists || !targetDists)
            return -1;
        let maxDist = 0;
        for (let i = 0; i < this.landmarks.length; i++) {
            // d(n, t) ≈ |d(n, L) - d(t, L)|
            if (nodeDists[i] >= 0 && targetDists[i] >= 0) {
                const est = Math.abs(nodeDists[i] - targetDists[i]);
                if (est > maxDist)
                    maxDist = est;
            }
        }
        return maxDist;
    }
    shouldPrune(_nodeId, _depth, state) {
        if (!state.target)
            return false;
        if (this.landmarks.length === 0)
            return false;
        const estDist = this.estimateDistance(state.currentNode, state.target);
        if (estDist < 0)
            return false;
        // Si la distancia estimada es mayor que el mejor camino conocido + margen, pruneamos
        const bestPath = state.costSoFar.get(state.target);
        if (bestPath !== undefined && estDist + this.margin > bestPath) {
            return true;
        }
        return false;
    }
    reset() {
        // No reseteamos — landmarks son precomputados
    }
    getStats() {
        return {
            landmarks: this.landmarks.length,
            distances: this.distances.size,
        };
    }
}
exports.LandmarkPruning = LandmarkPruning;
// ----------------------------------------------------------
// 7. EarlyExitPruning
// ----------------------------------------------------------
class EarlyExitPruning {
    name = 'EarlyExitPruning';
    foundTarget = false;
    shouldPrune(_nodeId, _depth, _state) {
        return this.foundTarget;
    }
    onTargetFound(_nodeId, _state) {
        this.foundTarget = true;
    }
    reset() {
        this.foundTarget = false;
    }
    get found() {
        return this.foundTarget;
    }
}
exports.EarlyExitPruning = EarlyExitPruning;
// ============================================================
// Export index
// ============================================================
exports.BUILTIN_STRATEGIES = [
    'MaxDepthPruning',
    'VisitedPruning',
    'TargetDirectionPruning',
    'CostBoundPruning',
    'BeamPruning',
    'LandmarkPruning',
    'EarlyExitPruning',
];
//# sourceMappingURL=pruning.js.map