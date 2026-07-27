"use strict";
/**
 * Sharding de Grafos — Fase 17 (T-17.1)
 *
 * Particionamiento horizontal de grafos por nivel o por dominio.
 * Shard key: nivel + hash de id. Routing consistente.
 *
 * Zero dependencias externas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShardManager = exports.GraphShard = exports.ConsistentHash = void 0;
// ============================================================
// Generador de IDs
// ============================================================
let _counter = 0;
function generateId(prefix = 'cos') {
    return `${prefix}_${Date.now()}_${++_counter}`;
}
// ============================================================
// ConsistentHash — Hash ring para distribucion uniforme
// ============================================================
class ConsistentHash {
    totalShards;
    ring = new Map(); // hash -> shardId
    virtualNodes;
    constructor(totalShards, virtualNodes = 100) {
        this.totalShards = totalShards;
        this.virtualNodes = Math.max(10, virtualNodes);
        this.buildRing();
    }
    buildRing() {
        this.ring.clear();
        for (let shard = 0; shard < this.totalShards; shard++) {
            for (let v = 0; v < this.virtualNodes; v++) {
                const hash = this.hash(`shard-${shard}-vnode-${v}`);
                this.ring.set(hash, shard);
            }
        }
    }
    hash(key) {
        let h = 0;
        for (let i = 0; i < key.length; i++) {
            h = ((h << 5) - h) + key.charCodeAt(i);
            h |= 0; // Convert to 32-bit int
        }
        return Math.abs(h);
    }
    /**
     * Obtener el shard para una clave.
     */
    getShard(key) {
        const h = this.hash(key);
        let closest = -1;
        let closestDist = Infinity;
        for (const [ringHash, shardId] of this.ring) {
            const dist = Math.abs(h - ringHash);
            if (dist < closestDist) {
                closestDist = dist;
                closest = shardId;
            }
        }
        return closest >= 0 ? closest : 0;
    }
    /**
     * Obtener N shards para replicacion.
     */
    getShards(key, count) {
        const shards = new Set();
        shards.add(this.getShard(key));
        // Find additional shards by trying nearby keys
        for (let i = 1; i < 100 && shards.size < count; i++) {
            shards.add(this.getShard(`${key}-alt-${i}`));
        }
        return Array.from(shards).slice(0, count);
    }
    /**
     * Reconstruir el ring (cuando cambia el numero de shards).
     */
    rebuild(newTotal) {
        this.totalShards = newTotal;
        this.buildRing();
    }
}
exports.ConsistentHash = ConsistentHash;
// ============================================================
// GraphShard — Almacena nodos/aristas de un subconjunto
// ============================================================
class GraphShard {
    id;
    level;
    nodes = new Map();
    edges = new Map();
    adjacency = new Map();
    constructor(id, level) {
        this.id = id;
        this.level = level;
    }
    addNode(node) {
        this.nodes.set(node.id, node);
        if (!this.adjacency.has(node.id)) {
            this.adjacency.set(node.id, new Set());
        }
    }
    addEdge(edge) {
        this.edges.set(edge.id, edge);
        if (!this.adjacency.has(edge.source)) {
            this.adjacency.set(edge.source, new Set());
        }
        this.adjacency.get(edge.source).add(edge.target);
    }
    getNode(id) {
        return this.nodes.get(id);
    }
    getEdge(id) {
        return this.edges.get(id);
    }
    hasNode(id) {
        return this.nodes.has(id);
    }
    removeNode(id) {
        this.adjacency.delete(id);
        return this.nodes.delete(id);
    }
    removeEdge(id) {
        const edge = this.edges.get(id);
        if (edge) {
            this.adjacency.get(edge.source)?.delete(edge.target);
        }
        return this.edges.delete(id);
    }
    getAllNodes() {
        return Array.from(this.nodes.values());
    }
    getAllEdges() {
        return Array.from(this.edges.values());
    }
    nodeCount() { return this.nodes.size; }
    edgeCount() { return this.edges.size; }
    /**
     * Tamanio estimado en bytes.
     */
    sizeBytes() {
        let bytes = 0;
        for (const [, n] of this.nodes) {
            bytes += n.id.length + n.type.length + JSON.stringify(n.data).length;
        }
        for (const [, e] of this.edges) {
            bytes += e.id.length + e.source.length + e.target.length + JSON.stringify(e.data).length;
        }
        return bytes;
    }
    /**
     * Carga estimada (proporcional a nodos + aristas).
     */
    load() {
        return this.nodes.size + this.edges.size * 0.5;
    }
    info() {
        return {
            shardId: this.id,
            level: this.level,
            nodeCount: this.nodeCount(),
            edgeCount: this.edgeCount(),
            sizeBytes: this.sizeBytes(),
            load: this.load(),
        };
    }
    clear() {
        this.nodes.clear();
        this.edges.clear();
        this.adjacency.clear();
    }
}
exports.GraphShard = GraphShard;
// ============================================================
// ShardManager — Gestiona la distribucion entre shards
// ============================================================
class ShardManager {
    shards = new Map();
    hashRing;
    config;
    constructor(config = {}) {
        this.config = {
            totalShards: config.totalShards ?? 4,
            strategy: config.strategy ?? 'hash',
            replicationFactor: config.replicationFactor ?? 1,
        };
        this.hashRing = new ConsistentHash(this.config.totalShards);
        this.initializeShards();
    }
    initializeShards() {
        for (let i = 0; i < this.config.totalShards; i++) {
            this.shards.set(i, new GraphShard(i, 0));
        }
    }
    /**
     * Calcular shard key para un nodo/arista.
     */
    computeShardKey(id, level) {
        switch (this.config.strategy) {
            case 'level':
                return level % this.config.totalShards;
            case 'range': {
                const rangeSize = 20 / this.config.totalShards; // 20 levels
                return Math.min(Math.floor(level / rangeSize), this.config.totalShards - 1);
            }
            case 'hash':
            default:
                return this.hashRing.getShard(`${level}:${id}`);
        }
    }
    /**
     * Agregar un nodo al shard correspondiente.
     */
    addNode(id, level, type = 'node', data = {}) {
        const shardId = this.computeShardKey(id, level);
        const shard = this.shards.get(shardId);
        if (shard) {
            shard.addNode({ id, level, type, data });
        }
        return shardId;
    }
    /**
     * Agregar una arista.
     */
    addEdge(id, source, target, level, data = {}) {
        const shardId = this.computeShardKey(id, level);
        const shard = this.shards.get(shardId);
        if (shard) {
            shard.addEdge({ id, source, target, level, data });
        }
        return shardId;
    }
    /**
     * Obtener un nodo desde cualquier shard.
     */
    getNode(id, level) {
        const shardId = this.computeShardKey(id, level);
        return this.shards.get(shardId)?.getNode(id);
    }
    /**
     * Obtener arista.
     */
    getEdge(id, level) {
        const shardId = this.computeShardKey(id, level);
        return this.shards.get(shardId)?.getEdge(id);
    }
    /**
     * Obtener un shard por ID.
     */
    getShard(shardId) {
        return this.shards.get(shardId);
    }
    /**
     * Listar todos los shards.
     */
    getAllShards() {
        return Array.from(this.shards.values());
    }
    /**
     * Obtener info de todos los shards.
     */
    getAllShardInfo() {
        return this.getAllShards().map(s => s.info());
    }
    /**
     * Estadisticas de distribucion.
     */
    distributionStats() {
        const shards = this.getAllShardInfo();
        const totalNodes = shards.reduce((s, i) => s + i.nodeCount, 0);
        const totalEdges = shards.reduce((s, i) => s + i.edgeCount, 0);
        const loads = shards.map(s => s.load);
        const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
        const maxDev = Math.max(...loads.map(l => Math.abs(l - avgLoad)));
        return {
            totalNodes,
            totalEdges,
            shardCount: shards.length,
            balance: avgLoad > 0 ? maxDev / avgLoad : 0,
            shards,
        };
    }
    /**
     * Rebalancear: redistribuir nodos entre shards.
     */
    rebalance() {
        const allNodes = [];
        const allEdges = [];
        for (const [, shard] of this.shards) {
            allNodes.push(...shard.getAllNodes());
            allEdges.push(...shard.getAllEdges());
            shard.clear();
        }
        for (const node of allNodes) {
            this.addNode(node.id, node.level, node.type, node.data);
        }
        for (const edge of allEdges) {
            this.addEdge(edge.id, edge.source, edge.target, edge.level, edge.data);
        }
    }
    /**
     * Agregar un shard (escalar horizontalmente).
     */
    addShard() {
        const newId = this.shards.size;
        this.shards.set(newId, new GraphShard(newId, 0));
        this.config.totalShards = this.shards.size;
        this.hashRing.rebuild(this.config.totalShards);
        this.rebalance();
        return newId;
    }
    /**
     * Limpiar todo.
     */
    clear() {
        for (const [, shard] of this.shards) {
            shard.clear();
        }
    }
}
exports.ShardManager = ShardManager;
//# sourceMappingURL=sharding.js.map