/**
 * Compressed Sparse Row (CSR) Storage — v2.1 Fase 1
 *
 * CSR format for adjacency matrices:
 *   - indices[]: flat array of all target node IDs
 *   - indptr[]: row pointers into indices[] for each source node
 *   - nodeIds[]: ordered array of node IDs (maps row index <-> node ID)
 *
 * Memory: ~50% of Map<string, string[]> for sparse graphs.
 * Cache-friendly sequential access during BFS/DFS traversal.
 *
 * Zero dependencias externas.
 */
export interface TraceHop {
    nodeId: string;
    depth: number;
    source: 'forward' | 'backward' | 'pruned';
    metadata?: Record<string, unknown>;
}
export interface TraceSession {
    readonly id: string;
    addHop(hop: TraceHop): void;
    reset(): void;
}
export interface ProfilingHook {
    onStart(source: string, operation: string): void;
    onNodeVisit(nodeId: string, depth: number, elapsed: number): void;
    onComplete(operation: string, duration: number, nodesVisited: number): void;
}
export interface CSRNode {
    id: string;
    [key: string]: unknown;
}
export interface CSRCell {
    source: string;
    target: string;
    weight?: number;
    label?: string;
    [key: string]: unknown;
}
export declare class CSRGraph<N extends CSRNode = CSRNode, E extends CSRCell = CSRCell> {
    private _nodeIds;
    private _nodeData;
    private _indices;
    private _indptr;
    private _edgeData;
    private _edgeIdMap;
    private _nodeIndex;
    private _dirty;
    addNode(node: N): void;
    hasNode(id: string): boolean;
    getNode(id: string): N | undefined;
    removeNode(id: string): boolean;
    nodeCount(): number;
    getAllNodes(): N[];
    addEdge(source: string, target: string, data?: Partial<E>): string;
    hasEdge(source: string, target: string): boolean;
    getEdge(source: string, target: string): E | undefined;
    removeEdge(source: string, target: string): boolean;
    edgeCount(): number;
    getAllEdges(): E[];
    /**
     * Get neighbors of a node (outgoing edges).
     * O(degree) — fast sequential access from CSR arrays.
     */
    neighbors(id: string): string[];
    /**
     * Get reverse neighbors (incoming edges).
     * O(E) — scans all edges. Use reverse CSR for frequent reverse lookups.
     */
    reverseNeighbors(id: string): string[];
    /**
     * BFS traversal from a source node.
     * Returns ordered array of node IDs.
     */
    bfs(source: string, maxDepth?: number, traceSession?: TraceSession, profilingHook?: ProfilingHook): Array<{
        id: string;
        depth: number;
    }>;
    /**
     * Bidirectional BFS — meet-in-the-middle.
     * Up to 2x faster for deep graphs vs standard BFS.
     * Returns shortest path or null.
     */
    bidirectionalBFS(source: string, target: string, maxDepth?: number, traceSession?: TraceSession, profilingHook?: ProfilingHook): Array<{
        id: string;
        depth: number;
    }> | null;
    /**
     * DFS traversal.
     */
    dfs(source: string, maxDepth?: number, traceSession?: TraceSession, profilingHook?: ProfilingHook): Array<{
        id: string;
        depth: number;
    }>;
    /**
     * Estimate memory usage in bytes.
     */
    memoryEstimate(): {
        indices: number;
        indptr: number;
        nodeData: number;
        edgeData: number;
        total: number;
    };
    toJSON(): {
        nodes: N[];
        edges: E[];
    };
    static fromJSON<N extends CSRNode, E extends CSRCell>(data: {
        nodes: N[];
        edges: E[];
    }): CSRGraph<N, E>;
    private _ensureIndices;
    private rebuild;
    /**
     * Get degree of a node.
     */
    degree(id: string): number;
    /**
     * Memory-efficient node iteration.
     * Returns [nodeId, rowIndex][] without allocating the node objects.
     */
    iterateNodeIds(): Generator<[string, number]>;
    /**
     * Clear all data.
     */
    clear(): void;
}
/**
 * Drop-in replacement for `Map<string, string[]>` adjacency.
 * Each level can use this instead of their own adjacency maps.
 *
 * Usage:
 *   const adj = new CompressedAdjacency();
 *   adj.addEdge('a', 'b');
 *   adj.neighbors('a'); // ['b']
 */
export declare class CompressedAdjacency {
    private csr;
    addEdge(source: string, target: string): void;
    removeEdge(source: string, target: string): void;
    neighbors(id: string): string[];
    hasEdge(source: string, target: string): boolean;
    nodeCount(): number;
    edgeCount(): number;
    degree(id: string): number;
    clear(): void;
    /**
     * Memory improvement vs Map<string, string[]>.
     */
    memoryImprovement(): number;
}
//# sourceMappingURL=csr.d.ts.map