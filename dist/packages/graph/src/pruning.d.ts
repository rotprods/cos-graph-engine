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
export declare function createPruningState(source: string, target?: string, maxDepth?: number): PruningState;
export interface PruningResult {
    totalNodesConsidered: number;
    expandedNodes: number;
    prunedNodes: number;
    prunedBy: Map<string, number>;
    pruningRatio: number;
    durationMs: number;
    strategiesUsed: string[];
}
export declare function createPruningResult(strategies: PruningStrategy[], startTime: number): PruningResult;
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
export declare class PruningExecutor {
    private strategies;
    private _totalNodes;
    private _expandedNodes;
    private _prunedNodes;
    private _prunedBy;
    private _startTime;
    private _targetFound;
    constructor(strategies: PruningStrategy[]);
    /**
     * Evalua todas las estrategias en orden.
     * Short-circuit en la primera que devuelve true.
     */
    shouldPrune(nodeId: string, depth: number, state: PruningState): boolean;
    onExpand(nodeId: string, depth: number, state: PruningState): void;
    onTargetFound(nodeId: string, state: PruningState): void;
    get targetFound(): boolean;
    reset(): void;
    startTimer(): void;
    result(): PruningResult;
}
export declare class MaxDepthPruning implements PruningStrategy {
    readonly name = "MaxDepthPruning";
    private maxDepth;
    constructor(maxDepth?: number);
    shouldPrune(_nodeId: string, depth: number, _state: Readonly<PruningState>): boolean;
    reset(): void;
}
export declare class VisitedPruning implements PruningStrategy {
    readonly name = "VisitedPruning";
    private visited;
    shouldPrune(nodeId: string, _depth: number, _state: Readonly<PruningState>): boolean;
    reset(): void;
}
export declare class TargetDirectionPruning implements PruningStrategy {
    readonly name = "TargetDirectionPruning";
    private ancestors;
    private maxDepth;
    private graph;
    constructor(graph: {
        reverseNeighbors: (id: string) => string[];
    }, target: string, maxDepth?: number);
    private precomputeAncestors;
    shouldPrune(nodeId: string, _depth: number, state: Readonly<PruningState>): boolean;
    onExpand?(nodeId: string, _depth: number, state: PruningState): void;
    reset(): void;
}
export declare class CostBoundPruning implements PruningStrategy {
    readonly name = "CostBoundPruning";
    private bestPath;
    shouldPrune(nodeId: string, _depth: number, state: Readonly<PruningState>): boolean;
    onTargetFound?(_nodeId: string, state: PruningState): void;
    reset(): void;
}
export declare class BeamPruning implements PruningStrategy {
    readonly name = "BeamPruning";
    private k;
    private candidatesByDepth;
    private expandedThisDepth;
    constructor(k?: number);
    shouldPrune(nodeId: string, depth: number, state: Readonly<PruningState>): boolean;
    onExpand?(nodeId: string, depth: number, state: PruningState): void;
    private computeHeuristic;
    reset(): void;
}
export declare class LandmarkPruning implements PruningStrategy {
    readonly name = "LandmarkPruning";
    private landmarks;
    private distances;
    private graph;
    private margin;
    constructor(graph: {
        neighbors: (id: string) => string[];
    }, landmarks: string[], margin?: number);
    private precomputeDistances;
    private estimateDistance;
    shouldPrune(_nodeId: string, _depth: number, state: Readonly<PruningState>): boolean;
    reset(): void;
    getStats(): {
        landmarks: number;
        distances: number;
    };
}
export declare class EarlyExitPruning implements PruningStrategy {
    readonly name = "EarlyExitPruning";
    private foundTarget;
    shouldPrune(_nodeId: string, _depth: number, _state: Readonly<PruningState>): boolean;
    onTargetFound?(_nodeId: string, _state: PruningState): void;
    reset(): void;
    get found(): boolean;
}
export declare const BUILTIN_STRATEGIES: readonly ["MaxDepthPruning", "VisitedPruning", "TargetDirectionPruning", "CostBoundPruning", "BeamPruning", "LandmarkPruning", "EarlyExitPruning"];
export type BuiltinStrategyName = (typeof BUILTIN_STRATEGIES)[number];
//# sourceMappingURL=pruning.d.ts.map