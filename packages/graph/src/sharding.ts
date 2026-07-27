/**
 * Sharding de Grafos — Fase 17 (T-17.1)
 *
 * Particionamiento horizontal de grafos por nivel o por dominio.
 * Shard key: nivel + hash de id. Routing consistente.
 *
 * Zero dependencias externas.
 */

// ============================================================
// Tipos
// ============================================================

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

// ============================================================
// Generador de IDs
// ============================================================

let _counter = 0;
function generateId(prefix: string = 'cos'): string {
  return `${prefix}_${Date.now()}_${++_counter}`;
}

// ============================================================
// Node/Edge types
// ============================================================

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

// ============================================================
// ConsistentHash — Hash ring para distribucion uniforme
// ============================================================

export class ConsistentHash {
  private ring: Map<number, number> = new Map(); // hash -> shardId
  private virtualNodes: number;

  constructor(
    private totalShards: number,
    virtualNodes: number = 100,
  ) {
    this.virtualNodes = Math.max(10, virtualNodes);
    this.buildRing();
  }

  private buildRing(): void {
    this.ring.clear();
    for (let shard = 0; shard < this.totalShards; shard++) {
      for (let v = 0; v < this.virtualNodes; v++) {
        const hash = this.hash(`shard-${shard}-vnode-${v}`);
        this.ring.set(hash, shard);
      }
    }
  }

  private hash(key: string): number {
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
  getShard(key: string): number {
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
  getShards(key: string, count: number): number[] {
    const shards = new Set<number>();
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
  rebuild(newTotal: number): void {
    this.totalShards = newTotal;
    this.buildRing();
  }
}

// ============================================================
// GraphShard — Almacena nodos/aristas de un subconjunto
// ============================================================

export class GraphShard {
  id: number;
  level: number;
  private nodes: Map<string, ShardNode> = new Map();
  private edges: Map<string, ShardEdge> = new Map();
  private adjacency: Map<string, Set<string>> = new Map();

  constructor(id: number, level: number) {
    this.id = id;
    this.level = level;
  }

  addNode(node: ShardNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, new Set());
    }
  }

  addEdge(edge: ShardEdge): void {
    this.edges.set(edge.id, edge);
    if (!this.adjacency.has(edge.source)) {
      this.adjacency.set(edge.source, new Set());
    }
    this.adjacency.get(edge.source)!.add(edge.target);
  }

  getNode(id: string): ShardNode | undefined {
    return this.nodes.get(id);
  }

  getEdge(id: string): ShardEdge | undefined {
    return this.edges.get(id);
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  removeNode(id: string): boolean {
    this.adjacency.delete(id);
    return this.nodes.delete(id);
  }

  removeEdge(id: string): boolean {
    const edge = this.edges.get(id);
    if (edge) {
      this.adjacency.get(edge.source)?.delete(edge.target);
    }
    return this.edges.delete(id);
  }

  getAllNodes(): ShardNode[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): ShardEdge[] {
    return Array.from(this.edges.values());
  }

  nodeCount(): number { return this.nodes.size; }
  edgeCount(): number { return this.edges.size; }

  /**
   * Tamanio estimado en bytes.
   */
  sizeBytes(): number {
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
  load(): number {
    return this.nodes.size + this.edges.size * 0.5;
  }

  info(): ShardInfo {
    return {
      shardId: this.id,
      level: this.level,
      nodeCount: this.nodeCount(),
      edgeCount: this.edgeCount(),
      sizeBytes: this.sizeBytes(),
      load: this.load(),
    };
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacency.clear();
  }
}

// ============================================================
// ShardManager — Gestiona la distribucion entre shards
// ============================================================

export class ShardManager {
  private shards: Map<number, GraphShard> = new Map();
  private hashRing: ConsistentHash;
  private config: ShardConfig;

  constructor(config: Partial<ShardConfig> = {}) {
    this.config = {
      totalShards: config.totalShards ?? 4,
      strategy: config.strategy ?? 'hash',
      replicationFactor: config.replicationFactor ?? 1,
    };
    this.hashRing = new ConsistentHash(this.config.totalShards);
    this.initializeShards();
  }

  private initializeShards(): void {
    for (let i = 0; i < this.config.totalShards; i++) {
      this.shards.set(i, new GraphShard(i, 0));
    }
  }

  /**
   * Calcular shard key para un nodo/arista.
   */
  private computeShardKey(id: string, level: number): number {
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
  addNode(id: string, level: number, type: string = 'node', data: Record<string, unknown> = {}): number {
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
  addEdge(id: string, source: string, target: string, level: number, data: Record<string, unknown> = {}): number {
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
  getNode(id: string, level: number): ShardNode | undefined {
    const shardId = this.computeShardKey(id, level);
    return this.shards.get(shardId)?.getNode(id);
  }

  /**
   * Obtener arista.
   */
  getEdge(id: string, level: number): ShardEdge | undefined {
    const shardId = this.computeShardKey(id, level);
    return this.shards.get(shardId)?.getEdge(id);
  }

  /**
   * Obtener un shard por ID.
   */
  getShard(shardId: number): GraphShard | undefined {
    return this.shards.get(shardId);
  }

  /**
   * Listar todos los shards.
   */
  getAllShards(): GraphShard[] {
    return Array.from(this.shards.values());
  }

  /**
   * Obtener info de todos los shards.
   */
  getAllShardInfo(): ShardInfo[] {
    return this.getAllShards().map(s => s.info());
  }

  /**
   * Estadisticas de distribucion.
   */
  distributionStats(): {
    totalNodes: number;
    totalEdges: number;
    shardCount: number;
    balance: number; // 0 = perfect, higher = unbalanced
    shards: ShardInfo[];
  } {
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
  rebalance(): void {
    const allNodes: ShardNode[] = [];
    const allEdges: ShardEdge[] = [];

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
  addShard(): number {
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
  clear(): void {
    for (const [, shard] of this.shards) {
      shard.clear();
    }
  }
}