"use strict";
/**
 * Replicacion de Grafos — Fase 17 (T-17.3)
 *
 * Master-slave: un master escribe, slaves leen
 * Multi-master: todos escriben, resolucion de conflictos
 *
 * Zero dependencias externas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiMasterReplication = exports.MasterSlaveReplication = exports.Replica = void 0;
// ============================================================
// Generador de IDs
// ============================================================
let _counter = 0;
function generateId(prefix = 'cos') {
    return `${prefix}_${Date.now()}_${++_counter}`;
}
// ============================================================
// Replica — Una instancia replicada del grafo
// ============================================================
class Replica {
    id;
    role;
    nodes = new Map();
    edges = new Map();
    conflictStrategy;
    _writes = 0;
    _reads = 0;
    _conflicts = 0;
    constructor(config) {
        this.id = config.id;
        this.role = config.role;
        this.conflictStrategy = config.conflictStrategy;
    }
    /**
     * Escribir un nodo.
     */
    writeNode(id, value, version) {
        const existing = this.nodes.get(id);
        const newVersion = version ?? (existing ? existing.version + 1 : 1);
        const node = {
            id,
            value,
            version: newVersion,
            updatedAt: Date.now(),
            replicaId: this.id,
        };
        this.nodes.set(id, node);
        this._writes++;
        return node;
    }
    /**
     * Leer un nodo.
     */
    readNode(id) {
        this._reads++;
        return this.nodes.get(id);
    }
    /**
     * Escribir una arista.
     */
    writeEdge(id, sourceNode, targetNode, value, version) {
        const existing = this.edges.get(id);
        const newVersion = version ?? (existing ? existing.version + 1 : 1);
        const edge = {
            id,
            sourceNode,
            targetNode,
            value,
            version: newVersion,
            updatedAt: Date.now(),
            replicaId: this.id,
        };
        this.edges.set(id, edge);
        this._writes++;
        return edge;
    }
    /**
     * Leer una arista.
     */
    readEdge(id) {
        this._reads++;
        return this.edges.get(id);
    }
    /**
     * Sincronizar desde otra replica.
     * Retorna resultado de sincronizacion.
     */
    syncFrom(other) {
        const start = Date.now();
        let synced = 0;
        let conflicts = 0;
        let resolved = 0;
        // Sync nodes
        for (const [, remoteNode] of other.nodes) {
            const local = this.nodes.get(remoteNode.id);
            if (!local) {
                // New node
                this.nodes.set(remoteNode.id, { ...remoteNode });
                synced++;
            }
            else if (remoteNode.version > local.version) {
                // Remote is newer
                this.nodes.set(remoteNode.id, { ...remoteNode });
                synced++;
            }
            else if (remoteNode.version === local.version && remoteNode.replicaId !== local.replicaId) {
                // Conflict — same version, different sources
                conflicts++;
                const resolvedNode = this.resolveConflict(local, remoteNode);
                if (resolvedNode) {
                    this.nodes.set(remoteNode.id, resolvedNode);
                    resolved++;
                }
            }
        }
        // Sync edges
        for (const [, remoteEdge] of other.edges) {
            const local = this.edges.get(remoteEdge.id);
            if (!local) {
                this.edges.set(remoteEdge.id, { ...remoteEdge });
                synced++;
            }
            else if (remoteEdge.version > local.version) {
                this.edges.set(remoteEdge.id, { ...remoteEdge });
                synced++;
            }
            else if (remoteEdge.version === local.version && remoteEdge.replicaId !== local.replicaId) {
                conflicts++;
                const resolvedEdge = this.resolveEdgeConflict(local, remoteEdge);
                if (resolvedEdge) {
                    this.edges.set(remoteEdge.id, resolvedEdge);
                    resolved++;
                }
            }
        }
        return { synced, conflicts, resolved, duration: Date.now() - start };
    }
    /**
     * Resolver conflicto entre dos nodos.
     */
    resolveConflict(local, remote) {
        switch (this.conflictStrategy) {
            case 'last_write_wins':
                return local.updatedAt >= remote.updatedAt ? local : remote;
            case 'first_write_wins':
                return local.updatedAt <= remote.updatedAt ? local : remote;
            case 'merge':
                return {
                    id: local.id,
                    value: { ...local.value, ...remote.value },
                    version: Math.max(local.version, remote.version) + 1,
                    updatedAt: Date.now(),
                    replicaId: `${local.replicaId}+${remote.replicaId}`,
                };
            default:
                return null;
        }
    }
    resolveEdgeConflict(local, remote) {
        switch (this.conflictStrategy) {
            case 'last_write_wins':
                return local.updatedAt >= remote.updatedAt ? local : remote;
            case 'first_write_wins':
                return local.updatedAt <= remote.updatedAt ? local : remote;
            case 'merge':
                return {
                    ...local,
                    value: { ...local.value, ...remote.value },
                    version: Math.max(local.version, remote.version) + 1,
                    replicaId: `${local.replicaId}+${remote.replicaId}`,
                };
            default:
                return null;
        }
    }
    /**
     * Contar nodos.
     */
    nodeCount() { return this.nodes.size; }
    /**
     * Contar aristas.
     */
    edgeCount() { return this.edges.size; }
    /**
     * Estadisticas.
     */
    stats() {
        return {
            id: this.id,
            role: this.role,
            nodes: this.nodes.size,
            edges: this.edges.size,
            writes: this._writes,
            reads: this._reads,
            conflicts: this._conflicts,
        };
    }
    /**
     * Limpiar todo.
     */
    clear() {
        this.nodes.clear();
        this.edges.clear();
        this._writes = 0;
        this._reads = 0;
        this._conflicts = 0;
    }
}
exports.Replica = Replica;
// ============================================================
// MasterSlaveReplication — Topologia master-slave
// ============================================================
class MasterSlaveReplication {
    master;
    slaves = [];
    config;
    _totalSyncs = 0;
    _totalConflicts = 0;
    constructor(masterId = 'master-1', conflictStrategy = 'last_write_wins') {
        this.config = {
            id: masterId,
            role: 'master',
            syncInterval: 5000,
            conflictStrategy,
        };
        this.master = new Replica(this.config);
    }
    /**
     * Agregar un slave.
     */
    addSlave(id) {
        const slave = new Replica({
            id,
            role: 'slave',
            syncInterval: 5000,
            conflictStrategy: this.config.conflictStrategy,
        });
        this.slaves.push(slave);
        return slave;
    }
    /**
     * Obtener el master.
     */
    getMaster() { return this.master; }
    /**
     * Obtener slaves.
     */
    getSlaves() { return this.slaves; }
    /**
     * Obtener un slave por id.
     */
    getSlave(id) {
        return this.slaves.find(s => s.id === id);
    }
    /**
     * Escribir en master (y propagar a slaves).
     */
    writeNode(id, value) {
        this.master.writeNode(id, value);
        this.syncSlaves();
    }
    /**
     * Escribir edge en master.
     */
    writeEdge(id, source, target, value) {
        this.master.writeEdge(id, source, target, value);
        this.syncSlaves();
    }
    /**
     * Leer (round-robin entre slaves + master).
     */
    readNode(id) {
        if (this.slaves.length > 0) {
            const slave = this.slaves[Math.floor(Math.random() * this.slaves.length)];
            return slave.readNode(id) ?? this.master.readNode(id);
        }
        return this.master.readNode(id);
    }
    /**
     * Sincronizar todos los slaves desde el master.
     */
    syncSlaves() {
        this._totalSyncs++;
        const results = [];
        for (const slave of this.slaves) {
            const result = slave.syncFrom(this.master);
            this._totalConflicts += result.conflicts;
            results.push(result);
        }
        return results;
    }
    /**
     * Estadisticas.
     */
    stats() {
        return {
            master: this.master.stats(),
            slaves: this.slaves.map(s => s.stats()),
            totalSyncs: this._totalSyncs,
            totalConflicts: this._totalConflicts,
        };
    }
    /**
     * Limpiar.
     */
    clear() {
        this.master.clear();
        this.slaves.forEach(s => s.clear());
        this._totalSyncs = 0;
        this._totalConflicts = 0;
    }
}
exports.MasterSlaveReplication = MasterSlaveReplication;
// ============================================================
// MultiMasterReplication — Topologia multi-master
// ============================================================
class MultiMasterReplication {
    replicas = new Map();
    conflictStrategy;
    _totalSyncs = 0;
    _totalConflicts = 0;
    constructor(conflictStrategy = 'last_write_wins') {
        this.conflictStrategy = conflictStrategy;
    }
    /**
     * Agregar un nodo multi-master.
     */
    addReplica(id) {
        if (this.replicas.has(id)) {
            throw new Error(`Replica ${id} already exists`);
        }
        const replica = new Replica({
            id,
            role: 'multi_master',
            syncInterval: 5000,
            conflictStrategy: this.conflictStrategy,
        });
        this.replicas.set(id, replica);
        return replica;
    }
    /**
     * Obtener una replica.
     */
    getReplica(id) {
        return this.replicas.get(id);
    }
    /**
     * Listar todas las replicas.
     */
    getAllReplicas() {
        return Array.from(this.replicas.values());
    }
    /**
     * Escribir en una replica especifica.
     */
    writeNode(replicaId, id, value) {
        const replica = this.replicas.get(replicaId);
        if (!replica)
            throw new Error(`Replica ${replicaId} not found`);
        replica.writeNode(id, value);
    }
    /**
     * Escribir edge en una replica.
     */
    writeEdge(replicaId, id, source, target, value) {
        const replica = this.replicas.get(replicaId);
        if (!replica)
            throw new Error(`Replica ${replicaId} not found`);
        replica.writeEdge(id, source, target, value);
    }
    /**
     * Leer de una replica especifica.
     */
    readNode(replicaId, id) {
        return this.replicas.get(replicaId)?.readNode(id);
    }
    /**
     * Sincronizar todas las replicas entre si (gossip).
     */
    syncAll() {
        this._totalSyncs++;
        const results = [];
        const replicas = this.getAllReplicas();
        for (let i = 0; i < replicas.length; i++) {
            for (let j = i + 1; j < replicas.length; j++) {
                // Bidirectional sync
                const r1 = replicas[i];
                const r2 = replicas[j];
                const r1to2 = r2.syncFrom(r1);
                const r2to1 = r1.syncFrom(r2);
                this._totalConflicts += r1to2.conflicts + r2to1.conflicts;
                results.push(r1to2, r2to1);
            }
        }
        return results;
    }
    /**
     * Sincronizar una replica con todas las demas.
     */
    syncReplica(replicaId) {
        this._totalSyncs++;
        const results = [];
        const source = this.replicas.get(replicaId);
        if (!source)
            return results;
        for (const [id, target] of this.replicas) {
            if (id !== replicaId) {
                const result = target.syncFrom(source);
                this._totalConflicts += result.conflicts;
                results.push(result);
            }
        }
        return results;
    }
    /**
     * Contar replicas.
     */
    replicaCount() { return this.replicas.size; }
    /**
     * Estadisticas.
     */
    stats() {
        return {
            replicas: this.getAllReplicas().map(r => r.stats()),
            totalSyncs: this._totalSyncs,
            totalConflicts: this._totalConflicts,
        };
    }
    /**
     * Limpiar.
     */
    clear() {
        this.replicas.forEach(r => r.clear());
        this.replicas.clear();
        this._totalSyncs = 0;
        this._totalConflicts = 0;
    }
}
exports.MultiMasterReplication = MultiMasterReplication;
//# sourceMappingURL=replication.js.map