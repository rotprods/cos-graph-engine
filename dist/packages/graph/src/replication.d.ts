/**
 * Replicacion de Grafos — Fase 17 (T-17.3)
 *
 * Master-slave: un master escribe, slaves leen
 * Multi-master: todos escriben, resolucion de conflictos
 *
 * Zero dependencias externas.
 */
export type ReplicaRole = 'master' | 'slave' | 'multi_master';
export type ConflictStrategy = 'last_write_wins' | 'first_write_wins' | 'merge';
export interface ReplicaConfig {
    id: string;
    role: ReplicaRole;
    syncInterval: number;
    conflictStrategy: ConflictStrategy;
}
export interface ReplicaNode {
    id: string;
    value: unknown;
    version: number;
    updatedAt: number;
    replicaId: string;
}
export interface ReplicaEdge {
    id: string;
    sourceNode: string;
    targetNode: string;
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
export declare class Replica {
    id: string;
    role: ReplicaRole;
    private nodes;
    private edges;
    private conflictStrategy;
    private _writes;
    private _reads;
    private _conflicts;
    constructor(config: ReplicaConfig);
    /**
     * Escribir un nodo.
     */
    writeNode(id: string, value: unknown, version?: number): ReplicaNode;
    /**
     * Leer un nodo.
     */
    readNode(id: string): ReplicaNode | undefined;
    /**
     * Escribir una arista.
     */
    writeEdge(id: string, sourceNode: string, targetNode: string, value: unknown, version?: number): ReplicaEdge;
    /**
     * Leer una arista.
     */
    readEdge(id: string): ReplicaEdge | undefined;
    /**
     * Sincronizar desde otra replica.
     * Retorna resultado de sincronizacion.
     */
    syncFrom(other: Replica): SyncResult;
    /**
     * Resolver conflicto entre dos nodos.
     */
    private resolveConflict;
    private resolveEdgeConflict;
    /**
     * Contar nodos.
     */
    nodeCount(): number;
    /**
     * Contar aristas.
     */
    edgeCount(): number;
    /**
     * Estadisticas.
     */
    stats(): {
        id: string;
        role: ReplicaRole;
        nodes: number;
        edges: number;
        writes: number;
        reads: number;
        conflicts: number;
    };
    /**
     * Limpiar todo.
     */
    clear(): void;
}
export declare class MasterSlaveReplication {
    private master;
    private slaves;
    private config;
    private _totalSyncs;
    private _totalConflicts;
    constructor(masterId?: string, conflictStrategy?: ConflictStrategy);
    /**
     * Agregar un slave.
     */
    addSlave(id: string): Replica;
    /**
     * Obtener el master.
     */
    getMaster(): Replica;
    /**
     * Obtener slaves.
     */
    getSlaves(): Replica[];
    /**
     * Obtener un slave por id.
     */
    getSlave(id: string): Replica | undefined;
    /**
     * Escribir en master (y propagar a slaves).
     */
    writeNode(id: string, value: unknown): void;
    /**
     * Escribir edge en master.
     */
    writeEdge(id: string, source: string, target: string, value: unknown): void;
    /**
     * Leer (round-robin entre slaves + master).
     */
    readNode(id: string): ReplicaNode | undefined;
    /**
     * Sincronizar todos los slaves desde el master.
     */
    syncSlaves(): SyncResult[];
    /**
     * Estadisticas.
     */
    stats(): {
        master: ReturnType<Replica['stats']>;
        slaves: ReturnType<Replica['stats']>[];
        totalSyncs: number;
        totalConflicts: number;
    };
    /**
     * Limpiar.
     */
    clear(): void;
}
export declare class MultiMasterReplication {
    private replicas;
    private conflictStrategy;
    private _totalSyncs;
    private _totalConflicts;
    constructor(conflictStrategy?: ConflictStrategy);
    /**
     * Agregar un nodo multi-master.
     */
    addReplica(id: string): Replica;
    /**
     * Obtener una replica.
     */
    getReplica(id: string): Replica | undefined;
    /**
     * Listar todas las replicas.
     */
    getAllReplicas(): Replica[];
    /**
     * Escribir en una replica especifica.
     */
    writeNode(replicaId: string, id: string, value: unknown): void;
    /**
     * Escribir edge en una replica.
     */
    writeEdge(replicaId: string, id: string, source: string, target: string, value: unknown): void;
    /**
     * Leer de una replica especifica.
     */
    readNode(replicaId: string, id: string): ReplicaNode | undefined;
    /**
     * Sincronizar todas las replicas entre si (gossip).
     */
    syncAll(): SyncResult[];
    /**
     * Sincronizar una replica con todas las demas.
     */
    syncReplica(replicaId: string): SyncResult[];
    /**
     * Contar replicas.
     */
    replicaCount(): number;
    /**
     * Estadisticas.
     */
    stats(): {
        replicas: ReturnType<Replica['stats']>[];
        totalSyncs: number;
        totalConflicts: number;
    };
    /**
     * Limpiar.
     */
    clear(): void;
}
//# sourceMappingURL=replication.d.ts.map