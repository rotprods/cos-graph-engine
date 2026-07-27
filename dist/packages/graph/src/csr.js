"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompressedAdjacency = exports.CSRGraph = void 0;
const core_1 = require("@cos/core");
// ============================================================
// CSRGraph — Compressed Sparse Row Graph
// ============================================================
class CSRGraph {
    // CSR arrays
    _nodeIds = [];
    _nodeData = new Map();
    _indices = [];
    _indptr = [0];
    _edgeData = new Map();
    _edgeIdMap = new Map(); // "src->tgt" -> edgeId
    _nodeIndex = new Map(); // nodeId -> row index
    _dirty = false;
    // ============================================================
    // Node operations
    // ============================================================
    addNode(node) {
        if (this._nodeData.has(node.id)) {
            this._nodeData.set(node.id, node);
            return;
        }
        this._nodeData.set(node.id, node);
        this._nodeIds.push(node.id);
        this._nodeIndex.set(node.id, this._nodeIds.length - 1);
        this._indptr.push(this._indptr[this._indptr.length - 1]);
        this._dirty = true;
    }
    hasNode(id) {
        return this._nodeData.has(id);
    }
    getNode(id) {
        return this._nodeData.get(id);
    }
    removeNode(id) {
        const idx = this._nodeIndex.get(id);
        if (idx === undefined)
            return false;
        // Remove all edges connected to this node
        const edgesToRemove = [];
        for (const [key, eid] of this._edgeIdMap) {
            if (key.startsWith(id + '->') || key.endsWith('->' + id)) {
                edgesToRemove.push(key);
            }
        }
        for (const key of edgesToRemove) {
            const eid = this._edgeIdMap.get(key);
            this._edgeData.delete(eid);
            this._edgeIdMap.delete(key);
        }
        // Remove node
        this._nodeData.delete(id);
        this._nodeIds.splice(idx, 1);
        this._nodeIndex.delete(id);
        // Rebuild indices from scratch (simplest approach)
        this.rebuild();
        return true;
    }
    nodeCount() {
        return this._nodeIds.length;
    }
    getAllNodes() {
        return Array.from(this._nodeData.values());
    }
    // ============================================================
    // Edge operations
    // ============================================================
    addEdge(source, target, data) {
        const edgeId = (0, core_1.generateId)();
        const cell = { source, target, weight: 1, ...data };
        this._edgeData.set(edgeId, cell);
        this._edgeIdMap.set(`${source}->${target}`, edgeId);
        this._dirty = true;
        // Ensure source and target have nodes
        if (!this._nodeIndex.has(source)) {
            this.addNode({ id: source });
        }
        if (!this._nodeIndex.has(target)) {
            this.addNode({ id: target });
        }
        return edgeId;
    }
    hasEdge(source, target) {
        return this._edgeIdMap.has(`${source}->${target}`);
    }
    getEdge(source, target) {
        const eid = this._edgeIdMap.get(`${source}->${target}`);
        if (!eid)
            return undefined;
        return this._edgeData.get(eid);
    }
    removeEdge(source, target) {
        const key = `${source}->${target}`;
        const eid = this._edgeIdMap.get(key);
        if (!eid)
            return false;
        this._edgeData.delete(eid);
        this._edgeIdMap.delete(key);
        this._dirty = true;
        return true;
    }
    edgeCount() {
        return this._edgeData.size;
    }
    getAllEdges() {
        return Array.from(this._edgeData.values());
    }
    // ============================================================
    // CSR traversal
    // ============================================================
    /**
     * Get neighbors of a node (outgoing edges).
     * O(degree) — fast sequential access from CSR arrays.
     */
    neighbors(id) {
        this._ensureIndices();
        const idx = this._nodeIndex.get(id);
        if (idx === undefined)
            return [];
        const start = this._indptr[idx];
        const end = this._indptr[idx + 1];
        const result = [];
        for (let i = start; i < end; i++) {
            result.push(this._indices[i]);
        }
        return result;
    }
    /**
     * Get reverse neighbors (incoming edges).
     * O(E) — scans all edges. Use reverse CSR for frequent reverse lookups.
     */
    reverseNeighbors(id) {
        const result = [];
        for (const [key] of this._edgeIdMap) {
            const [, target] = key.split('->');
            if (target === id) {
                const [src] = key.split('->');
                result.push(src);
            }
        }
        return result;
    }
    /**
     * BFS traversal from a source node.
     * Returns ordered array of node IDs.
     */
    bfs(source, maxDepth = Infinity, traceSession, profilingHook) {
        if (!this._nodeIndex.has(source))
            return [];
        this._ensureIndices();
        const visited = new Set();
        const result = [];
        const queue = [{ id: source, depth: 0 }];
        visited.add(source);
        let hopIndex = 0;
        if (profilingHook)
            profilingHook.onStart(source, 'bfs');
        while (queue.length > 0) {
            const current = queue.shift();
            result.push(current);
            if (profilingHook)
                profilingHook.onNodeVisit(current.id, current.depth, performance.now());
            if (traceSession) {
                traceSession.addHop({
                    nodeId: current.id,
                    depth: current.depth,
                    source: 'forward',
                    metadata: { hopIndex: hopIndex++ },
                });
            }
            if (current.depth >= maxDepth) {
                if (traceSession) {
                    const nbrs = this.neighbors(current.id);
                    for (const nid of nbrs) {
                        if (!visited.has(nid)) {
                            traceSession.addHop({
                                nodeId: nid,
                                depth: current.depth + 1,
                                source: 'pruned',
                                metadata: { hopIndex: hopIndex++, prunedBy: 'maxDepth' },
                            });
                        }
                    }
                }
                continue;
            }
            const neighbors = this.neighbors(current.id);
            for (const nid of neighbors) {
                if (!visited.has(nid)) {
                    visited.add(nid);
                    queue.push({ id: nid, depth: current.depth + 1 });
                }
            }
        }
        if (profilingHook)
            profilingHook.onComplete('bfs', performance.now(), result.length);
        return result;
    }
    /**
     * Bidirectional BFS — meet-in-the-middle.
     * Up to 2x faster for deep graphs vs standard BFS.
     * Returns shortest path or null.
     */
    bidirectionalBFS(source, target, maxDepth = 20, traceSession, profilingHook) {
        if (!this._nodeIndex.has(source) || !this._nodeIndex.has(target))
            return null;
        if (source === target) {
            if (traceSession) {
                traceSession.addHop({ nodeId: source, depth: 0, source: 'forward' });
            }
            return [{ id: source, depth: 0 }];
        }
        this._ensureIndices();
        // Forward BFS
        const fVisited = new Map();
        const fQueue = [{ id: source, depth: 0 }];
        fVisited.set(source, 0);
        // Backward BFS
        const bVisited = new Map();
        const bQueue = [{ id: target, depth: 0 }];
        bVisited.set(target, 0);
        // For reconstructing path: store predecessors
        const fParent = new Map();
        const bParent = new Map();
        fParent.set(source, null);
        bParent.set(target, null);
        let meeting = null;
        let fIdx = 0, bIdx = 0;
        if (profilingHook)
            profilingHook.onStart(source, 'bidirectionalBFS');
        if (traceSession) {
            traceSession.addHop({ nodeId: source, depth: 0, source: 'forward' });
            traceSession.addHop({ nodeId: target, depth: 0, source: 'backward' });
        }
        while (fIdx < fQueue.length || bIdx < bQueue.length) {
            // Expand forward
            if (fIdx < fQueue.length) {
                const cur = fQueue[fIdx++];
                if (profilingHook)
                    profilingHook.onNodeVisit(cur.id, cur.depth, performance.now());
                if (cur.depth >= maxDepth) {
                    if (traceSession) {
                        const nbrs = this.neighbors(cur.id);
                        for (const nid of nbrs) {
                            if (!fVisited.has(nid)) {
                                traceSession.addHop({ nodeId: nid, depth: cur.depth + 1, source: 'pruned', metadata: { prunedBy: 'maxDepth', side: 'forward' } });
                            }
                        }
                    }
                    continue;
                }
                const nbrs = this.neighbors(cur.id);
                for (const nid of nbrs) {
                    if (!fVisited.has(nid)) {
                        fVisited.set(nid, cur.depth + 1);
                        fParent.set(nid, cur.id);
                        fQueue.push({ id: nid, depth: cur.depth + 1 });
                        if (traceSession) {
                            traceSession.addHop({ nodeId: nid, depth: cur.depth + 1, source: 'forward' });
                        }
                        if (bVisited.has(nid)) {
                            meeting = nid;
                            break;
                        }
                    }
                }
                if (meeting)
                    break;
            }
            // Expand backward
            if (bIdx < bQueue.length) {
                const cur = bQueue[bIdx++];
                if (profilingHook)
                    profilingHook.onNodeVisit(cur.id, cur.depth, performance.now());
                if (cur.depth >= maxDepth) {
                    if (traceSession) {
                        const revNbrs = this.reverseNeighbors(cur.id);
                        for (const nid of revNbrs) {
                            if (!bVisited.has(nid)) {
                                traceSession.addHop({ nodeId: nid, depth: cur.depth + 1, source: 'pruned', metadata: { prunedBy: 'maxDepth', side: 'backward' } });
                            }
                        }
                    }
                    continue;
                }
                const revNbrs = this.reverseNeighbors(cur.id);
                for (const nid of revNbrs) {
                    if (!bVisited.has(nid)) {
                        bVisited.set(nid, cur.depth + 1);
                        bParent.set(nid, cur.id);
                        bQueue.push({ id: nid, depth: cur.depth + 1 });
                        if (traceSession) {
                            traceSession.addHop({ nodeId: nid, depth: cur.depth + 1, source: 'backward' });
                        }
                        if (fVisited.has(nid)) {
                            meeting = nid;
                            break;
                        }
                    }
                }
                if (meeting)
                    break;
            }
        }
        if (profilingHook)
            profilingHook.onComplete('bidirectionalBFS', performance.now(), fVisited.size + bVisited.size);
        if (!meeting)
            return null;
        // Reconstruct path
        const path = [];
        // Forward path: source -> meeting
        const fPath = [];
        let node = meeting;
        while (node !== null) {
            fPath.unshift(node);
            node = fParent.get(node) || null;
        }
        // Backward path: meeting -> target (excluding meeting)
        const bPath = [];
        node = bParent.get(meeting) || null;
        while (node !== null) {
            bPath.push(node);
            node = bParent.get(node) || null;
        }
        const fullPath = [...fPath, ...bPath];
        for (let i = 0; i < fullPath.length; i++) {
            path.push({ id: fullPath[i], depth: i });
        }
        return path;
    }
    /**
     * DFS traversal.
     */
    dfs(source, maxDepth = Infinity, traceSession, profilingHook) {
        if (!this._nodeIndex.has(source))
            return [];
        this._ensureIndices();
        const visited = new Set();
        const result = [];
        const stack = [{ id: source, depth: 0 }];
        if (profilingHook)
            profilingHook.onStart(source, 'dfs');
        while (stack.length > 0) {
            const current = stack.pop();
            if (visited.has(current.id))
                continue;
            visited.add(current.id);
            result.push(current);
            if (profilingHook)
                profilingHook.onNodeVisit(current.id, current.depth, performance.now());
            if (traceSession) {
                traceSession.addHop({ nodeId: current.id, depth: current.depth, source: 'forward' });
            }
            if (current.depth >= maxDepth) {
                if (traceSession) {
                    const nbrs = this.neighbors(current.id);
                    for (const nid of nbrs) {
                        if (!visited.has(nid)) {
                            traceSession.addHop({ nodeId: nid, depth: current.depth + 1, source: 'pruned', metadata: { prunedBy: 'maxDepth' } });
                        }
                    }
                }
                continue;
            }
            const nbrs = this.neighbors(current.id);
            // Push in reverse order to maintain original order
            for (let i = nbrs.length - 1; i >= 0; i--) {
                if (!visited.has(nbrs[i])) {
                    stack.push({ id: nbrs[i], depth: current.depth + 1 });
                }
            }
        }
        if (profilingHook)
            profilingHook.onComplete('dfs', performance.now(), result.length);
        return result;
    }
    // ============================================================
    // Memory estimation
    // ============================================================
    /**
     * Estimate memory usage in bytes.
     */
    memoryEstimate() {
        const strSize = (s) => s.length * 2 + 8; // rough JS string overhead
        const indices = this._indices.reduce((acc, s) => acc + strSize(s), 0);
        const indptr = this._indptr.length * 8;
        const nodeData = this._nodeIds.reduce((acc, id) => acc + strSize(id), 0) + this._nodeData.size * 64;
        const edgeData = this._edgeData.size * 128;
        const total = indices + indptr + nodeData + edgeData;
        return { indices, indptr, nodeData, edgeData, total };
    }
    // ============================================================
    // Serialization
    // ============================================================
    toJSON() {
        return {
            nodes: this.getAllNodes(),
            edges: this.getAllEdges(),
        };
    }
    static fromJSON(data) {
        const graph = new CSRGraph();
        for (const node of data.nodes) {
            graph.addNode(node);
        }
        for (const edge of data.edges) {
            const { source, target, ...rest } = edge;
            graph.addEdge(source, target, rest);
        }
        return graph;
    }
    // ============================================================
    // Internal
    // ============================================================
    _ensureIndices() {
        if (!this._dirty)
            return;
        this.rebuild();
    }
    rebuild() {
        // Build CSR arrays — O(N + E) instead of O(N * E)
        const newIndices = [];
        const newIndptr = [0];
        const newEdgeIdMap = new Map();
        // Build a source->targets map in one pass
        const srcMap = new Map();
        for (const [key, eid] of this._edgeIdMap) {
            const [src, tgt] = key.split('->');
            if (!srcMap.has(src))
                srcMap.set(src, []);
            srcMap.get(src).push(tgt);
            newEdgeIdMap.set(key, eid);
        }
        // Build CSR arrays in order of nodeIds
        for (let i = 0; i < this._nodeIds.length; i++) {
            const nid = this._nodeIds[i];
            const targets = srcMap.get(nid);
            if (targets) {
                for (const tgt of targets) {
                    newIndices.push(tgt);
                }
                newIndptr.push(newIndptr[newIndptr.length - 1] + targets.length);
            }
            else {
                newIndptr.push(newIndptr[newIndptr.length - 1]);
            }
        }
        this._indices = newIndices;
        this._indptr = newIndptr;
        this._edgeIdMap = newEdgeIdMap;
        // Rebuild node index
        this._nodeIndex.clear();
        for (let i = 0; i < this._nodeIds.length; i++) {
            this._nodeIndex.set(this._nodeIds[i], i);
        }
        this._dirty = false;
    }
    /**
     * Get degree of a node.
     */
    degree(id) {
        this._ensureIndices();
        const idx = this._nodeIndex.get(id);
        if (idx === undefined)
            return 0;
        return this._indptr[idx + 1] - this._indptr[idx];
    }
    /**
     * Memory-efficient node iteration.
     * Returns [nodeId, rowIndex][] without allocating the node objects.
     */
    *iterateNodeIds() {
        for (let i = 0; i < this._nodeIds.length; i++) {
            yield [this._nodeIds[i], i];
        }
    }
    /**
     * Clear all data.
     */
    clear() {
        this._nodeIds = [];
        this._nodeData.clear();
        this._indices = [];
        this._indptr = [0];
        this._edgeData.clear();
        this._edgeIdMap.clear();
        this._nodeIndex.clear();
        this._dirty = false;
    }
}
exports.CSRGraph = CSRGraph;
// ============================================================
// CompressedAdjacency — utility for existing levels
// ============================================================
/**
 * Drop-in replacement for `Map<string, string[]>` adjacency.
 * Each level can use this instead of their own adjacency maps.
 *
 * Usage:
 *   const adj = new CompressedAdjacency();
 *   adj.addEdge('a', 'b');
 *   adj.neighbors('a'); // ['b']
 */
class CompressedAdjacency {
    csr = new CSRGraph();
    addEdge(source, target) {
        if (!this.csr.hasNode(source)) {
            this.csr.addNode({ id: source });
        }
        if (!this.csr.hasNode(target)) {
            this.csr.addNode({ id: target });
        }
        this.csr.addEdge(source, target);
    }
    removeEdge(source, target) {
        this.csr.removeEdge(source, target);
    }
    neighbors(id) {
        return this.csr.neighbors(id);
    }
    hasEdge(source, target) {
        return this.csr.hasEdge(source, target);
    }
    nodeCount() {
        return this.csr.nodeCount();
    }
    edgeCount() {
        return this.csr.edgeCount();
    }
    degree(id) {
        if (!this.csr.hasNode(id))
            return 0;
        return this.csr.neighbors(id).length;
    }
    clear() {
        this.csr.clear();
    }
    /**
     * Memory improvement vs Map<string, string[]>.
     */
    memoryImprovement() {
        return this.csr.memoryImprovement();
    }
}
exports.CompressedAdjacency = CompressedAdjacency;
//# sourceMappingURL=csr.js.map