import { EntityId, Timestamp } from '@cos/core';
export interface DepNode {
    id: EntityId;
    name: string;
    version?: string;
    type: 'package' | 'module' | 'service' | 'library' | 'config' | 'file';
    metadata?: Record<string, unknown>;
    size?: number;
}
export interface DepEdge {
    source: EntityId;
    target: EntityId;
    type: 'depends_on' | 'imports' | 'extends' | 'composes' | 'optional';
    version?: string;
    semver?: string;
}
export interface DependencyGraph {
    id: EntityId;
    name: string;
    nodes: DepNode[];
    edges: DepEdge[];
    createdAt: Timestamp;
}
export declare class DependencyResolver {
    private graphs;
    /**
     * Create a dependency graph from node and edge arrays.
     * Validates: no duplicate node IDs, all edge references point to existing nodes.
     *
     * Edge convention: source → target means "source depends on target".
     */
    createGraph(name: string, nodes: DepNode[], edges: DepEdge[]): EntityId;
    /** Add a node to an existing graph. Throws on duplicate ID. */
    addNode(graphId: EntityId, node: DepNode): void;
    /** Remove a node and all its connected edges from an existing graph. Throws if not found. */
    removeNode(graphId: EntityId, nodeId: EntityId): void;
    /**
     * Add a dependency edge to an existing graph.
     * Edge convention: source depends on target (target must resolve before source).
     */
    addEdge(graphId: EntityId, edge: DepEdge): void;
    /** Remove all edges matching source+target from a graph. Throws if graph not found. */
    removeEdge(graphId: EntityId, source: EntityId, target: EntityId): void;
    getGraph(id: EntityId): DependencyGraph | undefined;
    /**
     * Build an adjacency map: source → [target, target, ...]
     * Maps from each node to the nodes that depend on it.
     * Used internally by detectCycle, subgraph for O(n+m) performance.
     */
    private buildForwardAdj;
    /**
     * Build a reverse adjacency map: target → [source, source, ...]
     * Maps from each node to the nodes it depends on.
     * Used internally by computeDepth for O(n+m) performance.
     */
    private buildReverseAdj;
    /**
     * Topological sort — returns node IDs in dependency order.
     * Each node appears AFTER all nodes it depends on.
     * Uses Kahn's algorithm. Throws if graph is not found.
     */
    topologicalSort(graphId: EntityId): EntityId[];
    /**
     * Detect cycles in the dependency graph.
     * Uses DFS with a recursive stack. Returns the cycle path if found, or null.
     * Edge convention: follows source → target direction.
     * Uses O(n+m) performance via a pre-built adjacency map.
     */
    detectCycle(graphId: EntityId): EntityId[] | null;
    /**
     * Compute dependency depth for each node.
     * Depth = longest path from any root. Roots have depth 0.
     * Uses the topological sort order for efficient DP, then traverses
     * via O(n+m) adjacency (target → [sources that depend on it]).
     */
    computeDepth(graphId: EntityId): Map<EntityId, number>;
    /**
     * Find leaf nodes — nodes with no incoming edges (nothing depends on them).
     * These are the "top-level" consumers of the dependency graph.
     */
    findLeaves(graphId: EntityId): DepNode[];
    /**
     * Find root nodes — nodes with no outgoing edges (they depend on nothing).
     * These are the base/primitives of the dependency graph.
     * Convention: a root is a node that is NOT a source of any edge.
     */
    findRoots(graphId: EntityId): DepNode[];
    /**
     * Compute the dependency subtree for a given root node.
     * Returns all nodes reachable from rootId by following edges in the
     * source → target direction (i.e., all dependencies of the root).
     * Uses O(n+m) performance via a pre-built adjacency map.
     */
    subgraph(graphId: EntityId, rootId: EntityId): {
        nodes: DepNode[];
        edges: DepEdge[];
    } | null;
    /** Render graph as Mermaid flowchart */
    toMermaid(graphId: EntityId): string;
}
//# sourceMappingURL=level3-dependency.d.ts.map