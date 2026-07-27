/**
 * Streaming y Reactividad en Tiempo Real — Fase 16
 *
 * T-16.1: Streaming de Grafos con WebSocket API y parches diferenciales
 * T-16.2: Reactividad con Observables, subscripciones selectivas,
 *          onNodeAdded, onEdgeRemoved, onStateChanged
 *
 * Zero dependencias externas.
 */

// ============================================================
// Tipos base
// ============================================================

export type PatchType =
  | 'node_added'
  | 'node_removed'
  | 'edge_added'
  | 'edge_removed'
  | 'node_updated'
  | 'graph_created'
  | 'graph_deleted'
  | 'state_changed';

export interface GraphPatch {
  id: string;
  type: PatchType;
  level: number;
  graphId: string;
  nodeId?: string;
  edgeId?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface PatchFilter {
  types?: PatchType[];
  levels?: number[];
  graphIds?: string[];
  nodeIds?: string[];
  since?: number;
  limit?: number;
}

export interface Connection {
  id: string;
  connectedAt: number;
  filters: PatchFilter;
  active: boolean;
}

export interface Subscription {
  id: string;
  label: string;
  filter: PatchFilter;
  active: boolean;
  createdAt: number;
  callCount: number;
}

// ============================================================
// Generador de IDs
// ============================================================

let _counter = 0;
function generateId(prefix: string = 'cos'): string {
  return `${prefix}_${Date.now()}_${++_counter}`;
}

// ============================================================
// GraphPatchBuilder — Construye parches tipados
// ============================================================

export class GraphPatchBuilder {
  static nodeAdded(level: number, graphId: string, nodeId: string, data?: Record<string, unknown>): GraphPatch {
    return { id: generateId('patch'), type: 'node_added', level, graphId, nodeId, data, timestamp: Date.now() };
  }

  static nodeRemoved(level: number, graphId: string, nodeId: string): GraphPatch {
    return { id: generateId('patch'), type: 'node_removed', level, graphId, nodeId, timestamp: Date.now() };
  }

  static edgeAdded(level: number, graphId: string, edgeId: string, data?: Record<string, unknown>): GraphPatch {
    return { id: generateId('patch'), type: 'edge_added', level, graphId, edgeId, data, timestamp: Date.now() };
  }

  static edgeRemoved(level: number, graphId: string, edgeId: string): GraphPatch {
    return { id: generateId('patch'), type: 'edge_removed', level, graphId, edgeId, timestamp: Date.now() };
  }

  static nodeUpdated(level: number, graphId: string, nodeId: string, data?: Record<string, unknown>): GraphPatch {
    return { id: generateId('patch'), type: 'node_updated', level, graphId, nodeId, data, timestamp: Date.now() };
  }

  static graphCreated(level: number, graphId: string): GraphPatch {
    return { id: generateId('patch'), type: 'graph_created', level, graphId, timestamp: Date.now() };
  }

  static graphDeleted(level: number, graphId: string): GraphPatch {
    return { id: generateId('patch'), type: 'graph_deleted', level, graphId, timestamp: Date.now() };
  }

  static stateChanged(level: number, graphId: string, data?: Record<string, unknown>): GraphPatch {
    return { id: generateId('patch'), type: 'state_changed', level, graphId, data, timestamp: Date.now() };
  }
}

// ============================================================
// PatchSerializer — Serializacion de parches
// ============================================================

export class PatchSerializer {
  static serialize(patch: GraphPatch): string {
    return JSON.stringify(patch);
  }

  static deserialize(json: string): GraphPatch {
    const parsed = JSON.parse(json);
    // Validate required fields
    if (!parsed.id || !parsed.type || parsed.level === undefined || !parsed.graphId) {
      throw new Error('Invalid patch: missing required fields');
    }
    if (!['node_added', 'node_removed', 'edge_added', 'edge_removed', 'node_updated',
          'graph_created', 'graph_deleted', 'state_changed'].includes(parsed.type)) {
      throw new Error(`Invalid patch type: ${parsed.type}`);
    }
    return parsed as GraphPatch;
  }

  static serializeBatch(patches: GraphPatch[]): string {
    return JSON.stringify(patches);
  }

  static deserializeBatch(json: string): GraphPatch[] {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) throw new Error('Expected array of patches');
    return parsed.map((p: unknown) => this.deserialize(JSON.stringify(p)));
  }

  static compress(patches: GraphPatch[]): GraphPatch[] {
    // Remove consecutive patches of the same type on the same element
    // (e.g., add then remove = net no-op, but we keep both for history)
    // For compression: merge node_updated patches on same nodeId
    const merged: Map<string, GraphPatch> = new Map();
    for (const p of patches) {
      if (p.type === 'node_updated' && p.nodeId) {
        const key = `${p.graphId}:${p.nodeId}`;
        if (merged.has(key)) {
          // Merge data
          const existing = merged.get(key)!;
          merged.set(key, {
            ...existing,
            data: { ...existing.data, ...p.data },
            timestamp: p.timestamp,
          });
        } else {
          merged.set(key, p);
        }
      } else {
        // Use a unique key per patch id
        merged.set(`__${p.id}`, p);
      }
    }
    return Array.from(merged.values());
  }
}

// ============================================================
// Observable<T> — Patron observable generico
// ============================================================

export class Observable<T> {
  private listeners: Map<string, Set<(data: T) => void>> = new Map();
  private onceListeners: Map<string, Set<(data: T) => void>> = new Map();

  /**
   * Subscribirse a un evento.
   * Retorna funcion de limpieza.
   */
  subscribe(event: string, callback: (data: T) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.unsubscribe(event, callback);
  }

  /**
   * Subscribirse una sola vez.
   */
  subscribeOnce(event: string, callback: (data: T) => void): void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(callback);
  }

  /**
   * Desubscribirse.
   */
  unsubscribe(event: string, callback: (data: T) => void): void {
    this.listeners.get(event)?.delete(callback);
    this.onceListeners.get(event)?.delete(callback);
  }

  /**
   * Emitir un evento a todos los subscriptores.
   */
  emit(event: string, data: T): void {
    // Regular listeners
    this.listeners.get(event)?.forEach(cb => {
      try { cb(data); } catch { /* swallow */ }
    });
    // Once listeners
    this.onceListeners.get(event)?.forEach(cb => {
      try { cb(data); } catch { /* swallow */ }
    });
    this.onceListeners.delete(event);
  }

  /**
   * Emitir a todos los eventos (wildcard).
   */
  emitAll(data: T): void {
    for (const event of this.listeners.keys()) {
      this.emit(event, data);
    }
  }

  /**
   * Contar subscriptores de un evento.
   */
  listenerCount(event: string): number {
    const regular = this.listeners.get(event)?.size ?? 0;
    const once = this.onceListeners.get(event)?.size ?? 0;
    return regular + once;
  }

  /**
   * Listar todos los eventos con subscriptores.
   */
  events(): string[] {
    const events = new Set<string>();
    for (const e of this.listeners.keys()) events.add(e);
    for (const e of this.onceListeners.keys()) events.add(e);
    return Array.from(events);
  }

  /**
   * Limpiar todos los subscriptores.
   */
  clear(): void {
    this.listeners.clear();
    this.onceListeners.clear();
  }
}

// ============================================================
// GraphStream — WebSocket-like API de streaming
// ============================================================

export class GraphStream {
  private patches: GraphPatch[] = [];
  private observable: Observable<GraphPatch> = new Observable<GraphPatch>();
  private connections: Connection[] = [];
  private maxHistory: number = 10000;

  constructor(maxHistory?: number) {
    if (maxHistory) this.maxHistory = maxHistory;
  }

  /**
   * Conectar un nuevo cliente.
   */
  connect(filters?: PatchFilter): Connection {
    const conn: Connection = {
      id: generateId('conn'),
      connectedAt: Date.now(),
      filters: filters ?? {},
      active: true,
    };
    this.connections.push(conn);
    return conn;
  }

  /**
   * Desconectar un cliente.
   */
  disconnect(connectionId: string): boolean {
    const conn = this.connections.find(c => c.id === connectionId);
    if (conn) {
      conn.active = false;
      return true;
    }
    return false;
  }

  /**
   * Enviar un patch a todos los clientes conectados con filtros que matcheen.
   */
  sendPatch(patch: GraphPatch): void {
    // Store in history
    this.patches.push(patch);
    if (this.patches.length > this.maxHistory) {
      this.patches = this.patches.slice(-this.maxHistory);
    }

    // Emit to observable
    this.observable.emit(patch.type, patch);
    this.observable.emit('*', patch);

    // Notificar conexiones activas
    for (const conn of this.connections) {
      if (!conn.active) continue;
      if (this.matchesFilter(patch, conn.filters)) {
        // Connection gets notified
        this.observable.emit(`conn:${conn.id}`, patch);
      }
    }
  }

  /**
   * Enviar multiples patches.
   */
  sendBatch(patches: GraphPatch[]): void {
    for (const patch of patches) {
      this.sendPatch(patch);
    }
  }

  /**
   * Verificar si un patch matchea un filtro.
   */
  private matchesFilter(patch: GraphPatch, filter: PatchFilter): boolean {
    if (filter.types && !filter.types.includes(patch.type)) return false;
    if (filter.levels && !filter.levels.includes(patch.level)) return false;
    if (filter.graphIds && !filter.graphIds.includes(patch.graphId)) return false;
    if (filter.nodeIds && patch.nodeId && !filter.nodeIds.includes(patch.nodeId)) return false;
    if (filter.since && patch.timestamp < filter.since) return false;
    return true;
  }

  /**
   * Obtener historial de patches.
   */
  getHistory(filter?: PatchFilter): GraphPatch[] {
    let result = this.patches;
    if (filter) {
      result = result.filter(p => this.matchesFilter(p, filter));
      if (filter.limit && result.length > filter.limit) {
        result = result.slice(-filter.limit);
      }
    }
    return result;
  }

  /**
   * Obtener historial como diff (solo cambios desde un timestamp).
   */
  getDiffSince(timestamp: number): GraphPatch[] {
    return this.patches.filter(p => p.timestamp >= timestamp);
  }

  /**
   * Subscribirse a parches via callback.
   * Retorna funcion de limpieza.
   */
  subscribe(callback: (patch: GraphPatch) => void, filter?: PatchFilter): () => void {
    const wrapped = (patch: GraphPatch) => {
      if (!filter || this.matchesFilter(patch, filter)) {
        callback(patch);
      }
    };
    const cleanup = this.observable.subscribe('*', wrapped);
    return cleanup;
  }

  /**
   * Subscribirse a un tipo de patch especifico.
   */
  onPatchType(type: PatchType, callback: (patch: GraphPatch) => void, filter?: PatchFilter): () => void {
    const wrapped = (patch: GraphPatch) => {
      if (!filter || this.matchesFilter(patch, filter)) {
        callback(patch);
      }
    };
    return this.observable.subscribe(type, wrapped);
  }

  /**
   * Estadisticas del stream.
   */
  stats(): { totalPatches: number; activeConnections: number; events: string[] } {
    return {
      totalPatches: this.patches.length,
      activeConnections: this.connections.filter(c => c.active).length,
      events: this.observable.events(),
    };
  }

  /**
   * Limpiar todo.
   */
  clear(): void {
    this.patches = [];
    this.connections = [];
    this.observable.clear();
  }
}

// ============================================================
// GraphObserver — Reactividad de grafos
// ============================================================

export class GraphObserver {
  private subscriptions: Map<string, Subscription> = new Map();
  private observable: Observable<GraphPatch> = new Observable<GraphPatch>();
  private subscribed: boolean = false;

  /**
   * Conectar el observer a un GraphStream.
   */
  connectToStream(stream: GraphStream): void {
    if (this.subscribed) return;
    this.subscribed = true;

    stream.subscribe((patch: GraphPatch) => {
      // Re-emitir patches a nuestros subscriptores con filtros
      for (const [, sub] of this.subscriptions) {
        if (!sub.active) continue;
        if (this.matchesFilter(patch, sub.filter)) {
          sub.callCount++;
          this.observable.emit(sub.id, patch);
          this.observable.emit('*', patch);
        }
      }
    });
  }

  /**
   * Construir un observer standalone (sin stream).
   */
  static createStandalone(): { observer: GraphObserver; emitter: { emit: (patch: GraphPatch) => void } } {
    const observer = new GraphObserver();
    const emitter = {
      emit: (patch: GraphPatch) => {
        for (const [, sub] of observer.subscriptions) {
          if (!sub.active) continue;
          if (observer.matchesFilter(patch, sub.filter)) {
            sub.callCount++;
            observer.observable.emit(sub.id, patch);
            observer.observable.emit('*', patch);
          }
        }
      },
    };
    return { observer, emitter };
  }

  private matchesFilter(patch: GraphPatch, filter: PatchFilter): boolean {
    if (filter.types && !filter.types.includes(patch.type)) return false;
    if (filter.levels && !filter.levels.includes(patch.level)) return false;
    if (filter.graphIds && !filter.graphIds.includes(patch.graphId)) return false;
    if (filter.nodeIds && patch.nodeId && !filter.nodeIds.includes(patch.nodeId)) return false;
    return true;
  }

  /**
   * Crear una subscripcion.
   */
  private createSubscription(label: string, filter: PatchFilter): Subscription {
    const sub: Subscription = {
      id: generateId('sub'),
      label,
      filter,
      active: true,
      createdAt: Date.now(),
      callCount: 0,
    };
    this.subscriptions.set(sub.id, sub);
    return sub;
  }

  /**
   * onNodeAdded — callback cuando se agrega un nodo.
   */
  onNodeAdded(callback: (patch: GraphPatch) => void, filter?: PatchFilter): Subscription {
    const sub = this.createSubscription('onNodeAdded', {
      types: ['node_added'],
      ...filter,
    });
    this.observable.subscribe(sub.id, callback);
    return sub;
  }

  /**
   * onNodeRemoved — callback cuando se elimina un nodo.
   */
  onNodeRemoved(callback: (patch: GraphPatch) => void, filter?: PatchFilter): Subscription {
    const sub = this.createSubscription('onNodeRemoved', {
      types: ['node_removed'],
      ...filter,
    });
    this.observable.subscribe(sub.id, callback);
    return sub;
  }

  /**
   * onEdgeAdded — callback cuando se agrega una arista.
   */
  onEdgeAdded(callback: (patch: GraphPatch) => void, filter?: PatchFilter): Subscription {
    const sub = this.createSubscription('onEdgeAdded', {
      types: ['edge_added'],
      ...filter,
    });
    this.observable.subscribe(sub.id, callback);
    return sub;
  }

  /**
   * onEdgeRemoved — callback cuando se elimina una arista.
   */
  onEdgeRemoved(callback: (patch: GraphPatch) => void, filter?: PatchFilter): Subscription {
    const sub = this.createSubscription('onEdgeRemoved', {
      types: ['edge_removed'],
      ...filter,
    });
    this.observable.subscribe(sub.id, callback);
    return sub;
  }

  /**
   * onNodeUpdated — callback cuando se actualiza un nodo.
   */
  onNodeUpdated(callback: (patch: GraphPatch) => void, filter?: PatchFilter): Subscription {
    const sub = this.createSubscription('onNodeUpdated', {
      types: ['node_updated'],
      ...filter,
    });
    this.observable.subscribe(sub.id, callback);
    return sub;
  }

  /**
   * onStateChanged — callback cuando cambia el estado.
   */
  onStateChanged(callback: (patch: GraphPatch) => void, filter?: PatchFilter): Subscription {
    const sub = this.createSubscription('onStateChanged', {
      types: ['state_changed'],
      ...filter,
    });
    this.observable.subscribe(sub.id, callback);
    return sub;
  }

  /**
   * observeLevel — observar cambios en un nivel especifico.
   */
  observeLevel(level: number, callback: (patch: GraphPatch) => void): Subscription {
    const sub = this.createSubscription(`observeLevel(L${level})`, {
      levels: [level],
    });
    this.observable.subscribe(sub.id, callback);
    return sub;
  }

  /**
   * observeGraph — observar cambios en un grafo especifico.
   */
  observeGraph(graphId: string, callback: (patch: GraphPatch) => void): Subscription {
    const sub = this.createSubscription(`observeGraph(${graphId})`, {
      graphIds: [graphId],
    });
    this.observable.subscribe(sub.id, callback);
    return sub;
  }

  /**
   * observe — observar parches que matchean un filtro.
   */
  observe(filter: PatchFilter, callback: (patch: GraphPatch) => void): Subscription {
    const sub = this.createSubscription('observe', filter);
    this.observable.subscribe(sub.id, callback);
    return sub;
  }

  /**
   * Desactivar una subscripcion.
   */
  unsubscribe(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.active = false;
      return true;
    }
    return false;
  }

  /**
   * Reactivar una subscripcion.
   */
  resubscribe(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.active = true;
      return true;
    }
    return false;
  }

  /**
   * Eliminar una subscripcion permanentemente.
   */
  removeSubscription(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Listar subscripciones activas.
   */
  activeSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(s => s.active);
  }

  /**
   * Listar todas las subscripciones.
   */
  allSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Contar subscripciones.
   */
  subscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Estadisticas del observer.
   */
  stats(): { total: number; active: number; totalCalls: number } {
    let totalCalls = 0;
    for (const [, sub] of this.subscriptions) {
      totalCalls += sub.callCount;
    }
    return {
      total: this.subscriptions.size,
      active: this.activeSubscriptions().length,
      totalCalls,
    };
  }

  /**
   * Limpiar todas las subscripciones.
   */
  clear(): void {
    this.subscriptions.clear();
    this.observable.clear();
    this.subscribed = false;
  }
}

// ============================================================
// SubscriptionManager — Gestor centralizado de subscripciones
// ============================================================

export class SubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map();
  private groups: Map<string, Set<string>> = new Map(); // group -> subscription ids

  /**
   * Registrar una subscripcion.
   */
  register(sub: Subscription, group?: string): void {
    this.subscriptions.set(sub.id, sub);
    if (group) {
      if (!this.groups.has(group)) {
        this.groups.set(group, new Set());
      }
      this.groups.get(group)!.add(sub.id);
    }
  }

  /**
   * Activar una subscripcion.
   */
  activate(id: string): boolean {
    const sub = this.subscriptions.get(id);
    if (sub) { sub.active = true; return true; }
    return false;
  }

  /**
   * Desactivar una subscripcion.
   */
  deactivate(id: string): boolean {
    const sub = this.subscriptions.get(id);
    if (sub) { sub.active = false; return true; }
    return false;
  }

  /**
   * Eliminar una subscripcion.
   */
  remove(id: string): boolean {
    const sub = this.subscriptions.get(id);
    if (!sub) return false;
    this.subscriptions.delete(id);
    // Remove from all groups
    for (const [, members] of this.groups) {
      members.delete(id);
    }
    return true;
  }

  /**
   * Activar todas las subscripciones de un grupo.
   */
  activateGroup(group: string): number {
    let count = 0;
    for (const id of this.groups.get(group) ?? []) {
      if (this.activate(id)) count++;
    }
    return count;
  }

  /**
   * Desactivar todas las subscripciones de un grupo.
   */
  deactivateGroup(group: string): number {
    let count = 0;
    for (const id of this.groups.get(group) ?? []) {
      if (this.deactivate(id)) count++;
    }
    return count;
  }

  /**
   * Obtener una subscripcion.
   */
  get(id: string): Subscription | undefined {
    return this.subscriptions.get(id);
  }

  /**
   * Listar subscripciones activas.
   */
  active(): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(s => s.active);
  }

  /**
   * Listar todas las subscripciones.
   */
  all(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Contar subscripciones.
   */
  count(): number {
    return this.subscriptions.size;
  }

  /**
   * Listar grupos.
   */
  listGroups(): string[] {
    return Array.from(this.groups.keys());
  }

  /**
   * Estadisticas.
   */
  stats(): { total: number; active: number; groups: number } {
    return {
      total: this.subscriptions.size,
      active: this.active().length,
      groups: this.groups.size,
    };
  }

  /**
   * Limpiar todo.
   */
  clear(): void {
    this.subscriptions.clear();
    this.groups.clear();
  }
}