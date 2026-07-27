/**
 * Sharding de Grafos — Fase 17 (T-17.1)
 *
 * Particionamiento horizontal de grafos por nivel o por dominio.
 * Shard key: nivel + hash de id. Routing consistente.
 *
 * Zero dependencias externas.
 */
export type ShardStrategy = 'hash' | 'range' | 'level';
export interface ShardConfig {
    totalShards: number;
    strategy: ShardStrategy;
    replicationFactor: number;
}
export interface ShardInfo {
    shardId: number;
    level: number;
    nodeCount: number;
    edgeCount: number;
    sizeBytes: number;
    load: number;
}
export interface ShardKey {
    shardId: number;
    level: number;
    originalId: string;
}
interface ShardNode {
    id: string;
    level: number;
    type: string;
    data: Record<string, unknown>;
}
interface ShardEdge {
    id: string;
    source: string;
    target: string;
    level: number;
    data: Record<string, unknown>;
}
export declare class ConsistentHash {
    private totalShards;
    private ring;
    private virtualNodes;
    constructor(totalShards: number, virtualNodes?: number);
    private buildRing;
    private hash;
    /**
     * Obtener el shard para una clave.
     */
    getShard(key: string): number;
    /**
     * Obtener N shards para replicacion.
     */
    getShards(key: string, count: number): number[];
    /**
     * Reconstruir el ring (cuando cambia el numero de shards).
     */
    rebuild(newTotal: number): void;
}
export declare class GraphShard {
    id: number;
    level: number;
    private nodes;
    private edges;
    private adjacency;
    constructor(id: number, level: number);
    addNode(node: ShardNode): void;
    addEdge(edge: ShardEdge): void;
    getNode(id: string): ShardNode | undefined;
    getEdge(id: string): ShardEdge | undefined;
    hasNode(id: string): boolean;
    removeNode(id: string): boolean;
    removeEdge(id: string): boolean;
    getAllNodes(): ShardNode[];
    getAllEdges(): ShardEdge[];
    nodeCount(): number;
    edgeCount(): number;
    /**
     * Tamanio estimado en bytes.
     */
    sizeBytes(): number;
    /**
     * Carga estimada (proporcional a nodos + aristas).
     */
    load(): number;
    info(): ShardInfo;
    clear(): void;
}
export declare class ShardManager {
    private shards;
    private hashRing;
    private config;
    constructor(config?: Partial<ShardConfig>);
    private initializeShards;
    /**
     * Calcular shard key para un nodo/arista.
     */
    private computeShardKey;
    /**
     * Agregar un nodo al shard correspondiente.
     */
    addNode(id: string, level: number, type?: string, data?: Record<string, unknown>): number;
    /**
     * Agregar una arista.
     */
    addEdge(id: string, source: string, target: string, level: number, data?: Record<string, unknown>): number;
    /**
     * Obtener un nodo desde cualquier shard.
     */
    getNode(id: string, level: number): ShardNode | undefined;
    /**
     * Obtener arista.
     */
    getEdge(id: string, level: number): ShardEdge | undefined;
    /**
     * Obtener un shard por ID.
     */
    getShard(shardId: number): GraphShard | undefined;
    /**
     * Listar todos los shards.
     */
    getAllShards(): GraphShard[];
    /**
     * Obtener info de todos los shards.
     */
    getAllShardInfo(): ShardInfo[];
    /**
     * Estadisticas de distribucion.
     */
    distributionStats(): {
        totalNodes: number;
        totalEdges: number;
        shardCount: number;
        balance: number;
        shards: ShardInfo[];
    };
    /**
     * Rebalancear: redistribuir nodos entre shards.
     */
    rebalance(): void;
    /**
     * Agregar un shard (escalar horizontalmente).
     */
    addShard(): number;
    /**
     * Limpiar todo.
     */
    clear(): void;
}
export {};
//# sourceMappingURL=sharding.d.ts.map