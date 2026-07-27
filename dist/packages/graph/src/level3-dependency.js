"use strict";
// ================================================================
// LEVEL 3: DEPENDENCY GRAPH — "Representa dependencias"
// DAG resolution, topological sort, tree diffing, cycle detection
//
// Edge convention: source → target means "source depends on target"
//   - A root has no outgoing edges (depends on nothing)
//   - A leaf has no incoming edges (nothing depends on it)
//   - Topological order: each node appears AFTER all its dependencies
// ================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyResolver = void 0;
const core_1 = require("@cos/core");
class DependencyResolver {
    graphs = new Map();
    /**
     * Create a dependency graph from node and edge arrays.
     * Validates: no duplicate node IDs, all edge references point to existing nodes.
     *
     * Edge convention: source → target means "source depends on target".
     */
    createGraph(name, nodes, edges) {
        const id = (0, core_1.generateId)();
        const nodeIds = new Set();
        for (const node of nodes) {
            if (nodeIds.has(node.id))
                throw new Error(`Duplicate node ID: ${node.id}`);
            nodeIds.add(node.id);
        }
        for (const edge of edges) {
            if (!nodeIds.has(edge.source))
                throw new Error(`Edge source '${edge.source}' not found in nodes`);
            if (!nodeIds.has(edge.target))
                throw new Error(`Edge target '${edge.target}' not found in nodes`);
        }
        this.graphs.set(id, { id, name, nodes, edges, createdAt: new Date().toISOString() });
        return id;
    }
    /** Add a node to an existing graph. Throws on duplicate ID. */
    addNode(graphId, node) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            throw new Error(`Graph ${graphId} not found`);
        if (graph.nodes.some(n => n.id === node.id))
            throw new Error(`Node '${node.id}' already exists`);
        graph.nodes.push(node);
    }
    /** Remove a node and all its connected edges from an existing graph. Throws if not found. */
    removeNode(graphId, nodeId) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            throw new Error(`Graph ${graphId} not found`);
        const idx = graph.nodes.findIndex(n => n.id === nodeId);
        if (idx === -1)
            throw new Error(`Node '${nodeId}' not found`);
        graph.nodes.splice(idx, 1);
        graph.edges = graph.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    }
    /**
     * Add a dependency edge to an existing graph.
     * Edge convention: source depends on target (target must resolve before source).
     */
    addEdge(graphId, edge) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            throw new Error(`Graph ${graphId} not found`);
        if (!graph.nodes.some(n => n.id === edge.source))
            throw new Error(`Edge source '${edge.source}' not found`);
        if (!graph.nodes.some(n => n.id === edge.target))
            throw new Error(`Edge target '${edge.target}' not found`);
        graph.edges.push(edge);
    }
    /** Remove all edges matching source+target from a graph. Throws if graph not found. */
    removeEdge(graphId, source, target) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            throw new Error(`Graph ${graphId} not found`);
        const before = graph.edges.length;
        graph.edges = graph.edges.filter(e => !(e.source === source && e.target === target));
        if (graph.edges.length === before)
            throw new Error(`Edge '${source}→${target}' not found`);
    }
    getGraph(id) {
        return this.graphs.get(id);
    }
    /**
     * Build an adjacency map: source → [target, target, ...]
     * Maps from each node to the nodes that depend on it.
     * Used internally by detectCycle, subgraph for O(n+m) performance.
     */
    buildForwardAdj(graph) {
        const adj = new Map();
        for (const node of graph.nodes)
            adj.set(node.id, []);
        for (const edge of graph.edges)
            adj.get(edge.source).push(edge.target);
        return adj;
    }
    /**
     * Build a reverse adjacency map: target → [source, source, ...]
     * Maps from each node to the nodes it depends on.
     * Used internally by computeDepth for O(n+m) performance.
     */
    buildReverseAdj(graph) {
        const adj = new Map();
        for (const node of graph.nodes)
            adj.set(node.id, []);
        for (const edge of graph.edges)
            adj.get(edge.target).push(edge.source);
        return adj;
    }
    /**
     * Topological sort — returns node IDs in dependency order.
     * Each node appears AFTER all nodes it depends on.
     * Uses Kahn's algorithm. Throws if graph is not found.
     */
    topologicalSort(graphId) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            throw new Error(`Graph ${graphId} not found`);
        const inDegree = new Map();
        const adj = new Map();
        for (const node of graph.nodes) {
            inDegree.set(node.id, 0);
            adj.set(node.id, []);
        }
        // adj[target] → [sources that depend on target]. When processing a node,
        // we decrement the in-degree of all sources that depend on it.
        for (const edge of graph.edges) {
            adj.get(edge.target)?.push(edge.source);
            inDegree.set(edge.source, (inDegree.get(edge.source) || 0) + 1);
        }
        const queue = [];
        for (const [id, deg] of inDegree) {
            if (deg === 0)
                queue.push(id);
        }
        const result = [];
        while (queue.length > 0) {
            const node = queue.shift();
            result.push(node);
            for (const neighbor of adj.get(node) || []) {
                const newDeg = (inDegree.get(neighbor) || 1) - 1;
                inDegree.set(neighbor, newDeg);
                if (newDeg === 0)
                    queue.push(neighbor);
            }
        }
        return result;
    }
    /**
     * Detect cycles in the dependency graph.
     * Uses DFS with a recursive stack. Returns the cycle path if found, or null.
     * Edge convention: follows source → target direction.
     * Uses O(n+m) performance via a pre-built adjacency map.
     */
    detectCycle(graphId) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            return null;
        const adj = this.buildForwardAdj(graph);
        const visited = new Set();
        const inStack = new Set();
        const parent = new Map();
        function dfs(node, adjacency) {
            visited.add(node);
            inStack.add(node);
            for (const target of adjacency.get(node) || []) {
                if (!visited.has(target)) {
                    parent.set(target, node);
                    const cycle = dfs(target, adjacency);
                    if (cycle)
                        return cycle;
                }
                else if (inStack.has(target)) {
                    // Cycle found — reconstruct path
                    const path = [target, node];
                    let curr = node;
                    while (parent.has(curr) && curr !== target) {
                        curr = parent.get(curr);
                        path.push(curr);
                    }
                    return path.reverse();
                }
            }
            inStack.delete(node);
            return null;
        }
        for (const node of graph.nodes) {
            if (!visited.has(node.id)) {
                const cycle = dfs(node.id, adj);
                if (cycle)
                    return cycle;
            }
        }
        return null;
    }
    /**
     * Compute dependency depth for each node.
     * Depth = longest path from any root. Roots have depth 0.
     * Uses the topological sort order for efficient DP, then traverses
     * via O(n+m) adjacency (target → [sources that depend on it]).
     */
    computeDepth(graphId) {
        const order = this.topologicalSort(graphId);
        const graph = this.graphs.get(graphId);
        if (!graph)
            return new Map();
        const depth = new Map();
        for (const id of order)
            depth.set(id, 0);
        const revAdj = this.buildReverseAdj(graph);
        for (const id of order) {
            const currentDepth = depth.get(id) || 0;
            for (const source of revAdj.get(id) || []) {
                depth.set(source, Math.max(depth.get(source) || 0, currentDepth + 1));
            }
        }
        return depth;
    }
    /**
     * Find leaf nodes — nodes with no incoming edges (nothing depends on them).
     * These are the "top-level" consumers of the dependency graph.
     */
    findLeaves(graphId) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            return [];
        const hasDependents = new Set();
        for (const edge of graph.edges)
            hasDependents.add(edge.target);
        return graph.nodes.filter(n => !hasDependents.has(n.id));
    }
    /**
     * Find root nodes — nodes with no outgoing edges (they depend on nothing).
     * These are the base/primitives of the dependency graph.
     * Convention: a root is a node that is NOT a source of any edge.
     */
    findRoots(graphId) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            return [];
        const hasDeps = new Set();
        for (const edge of graph.edges)
            hasDeps.add(edge.source);
        return graph.nodes.filter(n => !hasDeps.has(n.id));
    }
    /**
     * Compute the dependency subtree for a given root node.
     * Returns all nodes reachable from rootId by following edges in the
     * source → target direction (i.e., all dependencies of the root).
     * Uses O(n+m) performance via a pre-built adjacency map.
     */
    subgraph(graphId, rootId) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            return null;
        const adj = this.buildForwardAdj(graph);
        const visited = new Set();
        const nodes = [];
        const edges = [];
        function dfs(nodeId) {
            if (visited.has(nodeId))
                return;
            visited.add(nodeId);
            const node = graph.nodes.find(n => n.id === nodeId);
            if (node)
                nodes.push(node);
            // Look up target edges from the adjacency map (O(1) per neighbor)
            const edgeTargets = adj.get(nodeId) || [];
            for (const targetId of edgeTargets) {
                // Find the matching edge — still O(m) worst case but done once per edge, not per DFS call
                const edge = graph.edges.find(e => e.source === nodeId && e.target === targetId);
                if (edge)
                    edges.push(edge);
                dfs(targetId);
            }
        }
        // Only start DFS if rootId exists in the graph
        if (!graph.nodes.some(n => n.id === rootId))
            return { nodes: [], edges: [] };
        dfs(rootId);
        return { nodes, edges };
    }
    /** Render graph as Mermaid flowchart */
    toMermaid(graphId) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            return 'graph TD\n  title: "Graph not found"';
        let m = 'graph LR\n  title: "' + graph.name + '"\n';
        for (const node of graph.nodes) {
            const id = node.id.replace(/[^a-zA-Z0-9]/g, '_');
            let open = '[', close = ']';
            if (node.type === 'service') {
                open = '((';
                close = '))';
            }
            else if (node.type === 'library') {
                open = '[(';
                close = ')]';
            }
            m += `    ${id}${open}"${node.name}${node.version ? ' (' + node.version + ')' : ''}"${close}\n`;
        }
        for (const edge of graph.edges) {
            const s = edge.source.replace(/[^a-zA-Z0-9]/g, '_');
            const t = edge.target.replace(/[^a-zA-Z0-9]/g, '_');
            const label = edge.semver ? `|${edge.semver}|` : '';
            const style = edge.type === 'optional' ? '-.-' : '-->';
            m += `    ${s}${style}${label}${t}\n`;
        }
        return m;
    }
}
exports.DependencyResolver = DependencyResolver;
//# sourceMappingURL=level3-dependency.js.map