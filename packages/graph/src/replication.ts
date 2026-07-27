/**
 * Replicacion de Grafos — Fase 17 (T-17.3)
 *
 * Master-slave: un master escribe, slaves leen
 * Multi-master: todos escriben, resolucion de conflictos
 *
 * Zero dependencias externas.
 */

// ============================================================
// Tipos
// ============================================================

export type ReplicaRole = 'master' | 'slave' | 'multi_master';
export type ConflictStrategy = 'last_write_wins' | 'first_write_wins' | 'merge';

export interface ReplicaConfig {
  id: string;
  role: ReplicaRole;
  syncInterval: number; // ms
  conflictStrategy: ConflictStrategy;
}

export interface ReplicaNode {
  id: string;
  value: unknown;
  version: number;
  updatedAt: number;
  replicaId: string; // which replica created this
}

export interface ReplicaEdge {
  id: string;
  sourceNode: string; // source node id
  targetNode: string; // target node id
  value: unknown;
  version: number;
  updatedAt: number;
  replicaId: string;
}

export interface SyncResult {
  synced: number;
  conflicts: number;
  resolved: number;
  duration: number;
}

// ============================================================
// Generador de IDs
// ============================================================

let _counter = 0;
function generateId(prefix: string = 'cos'): string {
  return `${prefix}_${Date.now()}_${++_counter}`;
}

// ============================================================
// Replica — Una instancia replicada del grafo
// ============================================================

export class Replica {
  id: string;
  role: ReplicaRole;
  private nodes: Map<string, ReplicaNode> = new Map();
  private edges: Map<string, ReplicaEdge> = new Map();
  private conflictStrategy: ConflictStrategy;
  private _writes: number = 0;
  private _reads: number = 0;
  private _conflicts: number = 0;

  constructor(config: ReplicaConfig) {
    this.id = config.id;
    this.role = config.role;
    this.conflictStrategy = config.conflictStrategy;
  }

  /**
   * Escribir un nodo.
   */
  writeNode(id: string, value: unknown, version?: number): ReplicaNode {
    const existing = this.nodes.get(id);
    const newVersion = version ?? (existing ? existing.version + 1 : 1);

    const node: ReplicaNode = {
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
  readNode(id: string): ReplicaNode | undefined {
    this._reads++;
    return this.nodes.get(id);
  }

  /**
   * Escribir una arista.
   */
  writeEdge(id: string, sourceNode: string, targetNode: string, value: unknown, version?: number): ReplicaEdge {
    const existing = this.edges.get(id);
    const newVersion = version ?? (existing ? existing.version + 1 : 1);

    const edge: ReplicaEdge = {
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
  readEdge(id: string): ReplicaEdge | undefined {
    this._reads++;
    return this.edges.get(id);
  }

  /**
   * Sincronizar desde otra replica.
   * Retorna resultado de sincronizacion.
   */
  syncFrom(other: Replica): SyncResult {
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
      } else if (remoteNode.version > local.version) {
        // Remote is newer
        this.nodes.set(remoteNode.id, { ...remoteNode });
        synced++;
      } else if (remoteNode.version === local.version && remoteNode.replicaId !== local.replicaId) {
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
      } else if (remoteEdge.version > local.version) {
        this.edges.set(remoteEdge.id, { ...remoteEdge });
        synced++;
      } else if (remoteEdge.version === local.version && remoteEdge.replicaId !== local.replicaId) {
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
  private resolveConflict(local: ReplicaNode, remote: ReplicaNode): ReplicaNode | null {
    switch (this.conflictStrategy) {
      case 'last_write_wins':
        return local.updatedAt >= remote.updatedAt ? local : remote;
      case 'first_write_wins':
        return local.updatedAt <= remote.updatedAt ? local : remote;
      case 'merge':
        return {
          id: local.id,
          value: { ...(local.value as object), ...(remote.value as object) },
          version: Math.max(local.version, remote.version) + 1,
          updatedAt: Date.now(),
          replicaId: `${local.replicaId}+${remote.replicaId}`,
        };
      default:
        return null;
    }
  }

  private resolveEdgeConflict(local: ReplicaEdge, remote: ReplicaEdge): ReplicaEdge | null {
    switch (this.conflictStrategy) {
      case 'last_write_wins':
        return local.updatedAt >= remote.updatedAt ? local : remote;
      case 'first_write_wins':
        return local.updatedAt <= remote.updatedAt ? local : remote;
      case 'merge':
        return {
          ...local,
          value: { ...(local.value as object), ...(remote.value as object) },
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
  nodeCount(): number { return this.nodes.size; }

  /**
   * Contar aristas.
   */
  edgeCount(): number { return this.edges.size; }

  /**
   * Estadisticas.
   */
  stats(): { id: string; role: ReplicaRole; nodes: number; edges: number; writes: number; reads: number; conflicts: number } {
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
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this._writes = 0;
    this._reads = 0;
    this._conflicts = 0;
  }
}

// ============================================================
// MasterSlaveReplication — Topologia master-slave
// ============================================================

export class MasterSlaveReplication {
  private master: Replica;
  private slaves: Replica[] = [];
  private config: ReplicaConfig;
  private _totalSyncs: number = 0;
  private _totalConflicts: number = 0;

  constructor(masterId: string = 'master-1', conflictStrategy: ConflictStrategy = 'last_write_wins') {
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
  addSlave(id: string): Replica {
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
  getMaster(): Replica { return this.master; }

  /**
   * Obtener slaves.
   */
  getSlaves(): Replica[] { return this.slaves; }

  /**
   * Obtener un slave por id.
   */
  getSlave(id: string): Replica | undefined {
    return this.slaves.find(s => s.id === id);
  }

  /**
   * Escribir en master (y propagar a slaves).
   */
  writeNode(id: string, value: unknown): void {
    this.master.writeNode(id, value);
    this.syncSlaves();
  }

  /**
   * Escribir edge en master.
   */
  writeEdge(id: string, source: string, target: string, value: unknown): void {
    this.master.writeEdge(id, source, target, value);
    this.syncSlaves();
  }

  /**
   * Leer (round-robin entre slaves + master).
   */
  readNode(id: string): ReplicaNode | undefined {
    if (this.slaves.length > 0) {
      const slave = this.slaves[Math.floor(Math.random() * this.slaves.length)];
      return slave.readNode(id) ?? this.master.readNode(id);
    }
    return this.master.readNode(id);
  }

  /**
   * Sincronizar todos los slaves desde el master.
   */
  syncSlaves(): SyncResult[] {
    this._totalSyncs++;
    const results: SyncResult[] = [];

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
  stats(): { master: ReturnType<Replica['stats']>; slaves: ReturnType<Replica['stats']>[]; totalSyncs: number; totalConflicts: number } {
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
  clear(): void {
    this.master.clear();
    this.slaves.forEach(s => s.clear());
    this._totalSyncs = 0;
    this._totalConflicts = 0;
  }
}

// ============================================================
// MultiMasterReplication — Topologia multi-master
// ============================================================

export class MultiMasterReplication {
  private replicas: Map<string, Replica> = new Map();
  private conflictStrategy: ConflictStrategy;
  private _totalSyncs: number = 0;
  private _totalConflicts: number = 0;

  constructor(conflictStrategy: ConflictStrategy = 'last_write_wins') {
    this.conflictStrategy = conflictStrategy;
  }

  /**
   * Agregar un nodo multi-master.
   */
  addReplica(id: string): Replica {
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
  getReplica(id: string): Replica | undefined {
    return this.replicas.get(id);
  }

  /**
   * Listar todas las replicas.
   */
  getAllReplicas(): Replica[] {
    return Array.from(this.replicas.values());
  }

  /**
   * Escribir en una replica especifica.
   */
  writeNode(replicaId: string, id: string, value: unknown): void {
    const replica = this.replicas.get(replicaId);
    if (!replica) throw new Error(`Replica ${replicaId} not found`);
    replica.writeNode(id, value);
  }

  /**
   * Escribir edge en una replica.
   */
  writeEdge(replicaId: string, id: string, source: string, target: string, value: unknown): void {
    const replica = this.replicas.get(replicaId);
    if (!replica) throw new Error(`Replica ${replicaId} not found`);
    replica.writeEdge(id, source, target, value);
  }

  /**
   * Leer de una replica especifica.
   */
  readNode(replicaId: string, id: string): ReplicaNode | undefined {
    return this.replicas.get(replicaId)?.readNode(id);
  }

  /**
   * Sincronizar todas las replicas entre si (gossip).
   */
  syncAll(): SyncResult[] {
    this._totalSyncs++;
    const results: SyncResult[] = [];
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
  syncReplica(replicaId: string): SyncResult[] {
    this._totalSyncs++;
    const results: SyncResult[] = [];
    const source = this.replicas.get(replicaId);
    if (!source) return results;

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
  replicaCount(): number { return this.replicas.size; }

  /**
   * Estadisticas.
   */
  stats(): { replicas: ReturnType<Replica['stats']>[]; totalSyncs: number; totalConflicts: number } {
    return {
      replicas: this.getAllReplicas().map(r => r.stats()),
      totalSyncs: this._totalSyncs,
      totalConflicts: this._totalConflicts,
    };
  }

  /**
   * Limpiar.
   */
  clear(): void {
    this.replicas.forEach(r => r.clear());
    this.replicas.clear();
    this._totalSyncs = 0;
    this._totalConflicts = 0;
  }
}