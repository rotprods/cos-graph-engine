"use strict";
/**
 * Streaming y Reactividad en Tiempo Real — Fase 16
 *
 * T-16.1: Streaming de Grafos con WebSocket API y parches diferenciales
 * T-16.2: Reactividad con Observables, subscripciones selectivas,
 *          onNodeAdded, onEdgeRemoved, onStateChanged
 *
 * Zero dependencias externas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionManager = exports.GraphObserver = exports.GraphStream = exports.Observable = exports.PatchSerializer = exports.GraphPatchBuilder = void 0;
// ============================================================
// Generador de IDs
// ============================================================
let _counter = 0;
function generateId(prefix = 'cos') {
    return `${prefix}_${Date.now()}_${++_counter}`;
}
// ============================================================
// GraphPatchBuilder — Construye parches tipados
// ============================================================
class GraphPatchBuilder {
    static nodeAdded(level, graphId, nodeId, data) {
        return { id: generateId('patch'), type: 'node_added', level, graphId, nodeId, data, timestamp: Date.now() };
    }
    static nodeRemoved(level, graphId, nodeId) {
        return { id: generateId('patch'), type: 'node_removed', level, graphId, nodeId, timestamp: Date.now() };
    }
    static edgeAdded(level, graphId, edgeId, data) {
        return { id: generateId('patch'), type: 'edge_added', level, graphId, edgeId, data, timestamp: Date.now() };
    }
    static edgeRemoved(level, graphId, edgeId) {
        return { id: generateId('patch'), type: 'edge_removed', level, graphId, edgeId, timestamp: Date.now() };
    }
    static nodeUpdated(level, graphId, nodeId, data) {
        return { id: generateId('patch'), type: 'node_updated', level, graphId, nodeId, data, timestamp: Date.now() };
    }
    static graphCreated(level, graphId) {
        return { id: generateId('patch'), type: 'graph_created', level, graphId, timestamp: Date.now() };
    }
    static graphDeleted(level, graphId) {
        return { id: generateId('patch'), type: 'graph_deleted', level, graphId, timestamp: Date.now() };
    }
    static stateChanged(level, graphId, data) {
        return { id: generateId('patch'), type: 'state_changed', level, graphId, data, timestamp: Date.now() };
    }
}
exports.GraphPatchBuilder = GraphPatchBuilder;
// ============================================================
// PatchSerializer — Serializacion de parches
// ============================================================
class PatchSerializer {
    static serialize(patch) {
        return JSON.stringify(patch);
    }
    static deserialize(json) {
        const parsed = JSON.parse(json);
        // Validate required fields
        if (!parsed.id || !parsed.type || parsed.level === undefined || !parsed.graphId) {
            throw new Error('Invalid patch: missing required fields');
        }
        if (!['node_added', 'node_removed', 'edge_added', 'edge_removed', 'node_updated',
            'graph_created', 'graph_deleted', 'state_changed'].includes(parsed.type)) {
            throw new Error(`Invalid patch type: ${parsed.type}`);
        }
        return parsed;
    }
    static serializeBatch(patches) {
        return JSON.stringify(patches);
    }
    static deserializeBatch(json) {
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed))
            throw new Error('Expected array of patches');
        return parsed.map((p) => this.deserialize(JSON.stringify(p)));
    }
    static compress(patches) {
        // Remove consecutive patches of the same type on the same element
        // (e.g., add then remove = net no-op, but we keep both for history)
        // For compression: merge node_updated patches on same nodeId
        const merged = new Map();
        for (const p of patches) {
            if (p.type === 'node_updated' && p.nodeId) {
                const key = `${p.graphId}:${p.nodeId}`;
                if (merged.has(key)) {
                    // Merge data
                    const existing = merged.get(key);
                    merged.set(key, {
                        ...existing,
                        data: { ...existing.data, ...p.data },
                        timestamp: p.timestamp,
                    });
                }
                else {
                    merged.set(key, p);
                }
            }
            else {
                // Use a unique key per patch id
                merged.set(`__${p.id}`, p);
            }
        }
        return Array.from(merged.values());
    }
}
exports.PatchSerializer = PatchSerializer;
// ============================================================
// Observable<T> — Patron observable generico
// ============================================================
class Observable {
    listeners = new Map();
    onceListeners = new Map();
    /**
     * Subscribirse a un evento.
     * Retorna funcion de limpieza.
     */
    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.unsubscribe(event, callback);
    }
    /**
     * Subscribirse una sola vez.
     */
    subscribeOnce(event, callback) {
        if (!this.onceListeners.has(event)) {
            this.onceListeners.set(event, new Set());
        }
        this.onceListeners.get(event).add(callback);
    }
    /**
     * Desubscribirse.
     */
    unsubscribe(event, callback) {
        this.listeners.get(event)?.delete(callback);
        this.onceListeners.get(event)?.delete(callback);
    }
    /**
     * Emitir un evento a todos los subscriptores.
     */
    emit(event, data) {
        // Regular listeners
        this.listeners.get(event)?.forEach(cb => {
            try {
                cb(data);
            }
            catch { /* swallow */ }
        });
        // Once listeners
        this.onceListeners.get(event)?.forEach(cb => {
            try {
                cb(data);
            }
            catch { /* swallow */ }
        });
        this.onceListeners.delete(event);
    }
    /**
     * Emitir a todos los eventos (wildcard).
     */
    emitAll(data) {
        for (const event of this.listeners.keys()) {
            this.emit(event, data);
        }
    }
    /**
     * Contar subscriptores de un evento.
     */
    listenerCount(event) {
        const regular = this.listeners.get(event)?.size ?? 0;
        const once = this.onceListeners.get(event)?.size ?? 0;
        return regular + once;
    }
    /**
     * Listar todos los eventos con subscriptores.
     */
    events() {
        const events = new Set();
        for (const e of this.listeners.keys())
            events.add(e);
        for (const e of this.onceListeners.keys())
            events.add(e);
        return Array.from(events);
    }
    /**
     * Limpiar todos los subscriptores.
     */
    clear() {
        this.listeners.clear();
        this.onceListeners.clear();
    }
}
exports.Observable = Observable;
// ============================================================
// GraphStream — WebSocket-like API de streaming
// ============================================================
class GraphStream {
    patches = [];
    observable = new Observable();
    connections = [];
    maxHistory = 10000;
    constructor(maxHistory) {
        if (maxHistory)
            this.maxHistory = maxHistory;
    }
    /**
     * Conectar un nuevo cliente.
     */
    connect(filters) {
        const conn = {
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
    disconnect(connectionId) {
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
    sendPatch(patch) {
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
            if (!conn.active)
                continue;
            if (this.matchesFilter(patch, conn.filters)) {
                // Connection gets notified
                this.observable.emit(`conn:${conn.id}`, patch);
            }
        }
    }
    /**
     * Enviar multiples patches.
     */
    sendBatch(patches) {
        for (const patch of patches) {
            this.sendPatch(patch);
        }
    }
    /**
     * Verificar si un patch matchea un filtro.
     */
    matchesFilter(patch, filter) {
        if (filter.types && !filter.types.includes(patch.type))
            return false;
        if (filter.levels && !filter.levels.includes(patch.level))
            return false;
        if (filter.graphIds && !filter.graphIds.includes(patch.graphId))
            return false;
        if (filter.nodeIds && patch.nodeId && !filter.nodeIds.includes(patch.nodeId))
            return false;
        if (filter.since && patch.timestamp < filter.since)
            return false;
        return true;
    }
    /**
     * Obtener historial de patches.
     */
    getHistory(filter) {
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
    getDiffSince(timestamp) {
        return this.patches.filter(p => p.timestamp >= timestamp);
    }
    /**
     * Subscribirse a parches via callback.
     * Retorna funcion de limpieza.
     */
    subscribe(callback, filter) {
        const wrapped = (patch) => {
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
    onPatchType(type, callback, filter) {
        const wrapped = (patch) => {
            if (!filter || this.matchesFilter(patch, filter)) {
                callback(patch);
            }
        };
        return this.observable.subscribe(type, wrapped);
    }
    /**
     * Estadisticas del stream.
     */
    stats() {
        return {
            totalPatches: this.patches.length,
            activeConnections: this.connections.filter(c => c.active).length,
            events: this.observable.events(),
        };
    }
    /**
     * Limpiar todo.
     */
    clear() {
        this.patches = [];
        this.connections = [];
        this.observable.clear();
    }
}
exports.GraphStream = GraphStream;
// ============================================================
// GraphObserver — Reactividad de grafos
// ============================================================
class GraphObserver {
    subscriptions = new Map();
    observable = new Observable();
    subscribed = false;
    /**
     * Conectar el observer a un GraphStream.
     */
    connectToStream(stream) {
        if (this.subscribed)
            return;
        this.subscribed = true;
        stream.subscribe((patch) => {
            // Re-emitir patches a nuestros subscriptores con filtros
            for (const [, sub] of this.subscriptions) {
                if (!sub.active)
                    continue;
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
    static createStandalone() {
        const observer = new GraphObserver();
        const emitter = {
            emit: (patch) => {
                for (const [, sub] of observer.subscriptions) {
                    if (!sub.active)
                        continue;
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
    matchesFilter(patch, filter) {
        if (filter.types && !filter.types.includes(patch.type))
            return false;
        if (filter.levels && !filter.levels.includes(patch.level))
            return false;
        if (filter.graphIds && !filter.graphIds.includes(patch.graphId))
            return false;
        if (filter.nodeIds && patch.nodeId && !filter.nodeIds.includes(patch.nodeId))
            return false;
        return true;
    }
    /**
     * Crear una subscripcion.
     */
    createSubscription(label, filter) {
        const sub = {
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
    onNodeAdded(callback, filter) {
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
    onNodeRemoved(callback, filter) {
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
    onEdgeAdded(callback, filter) {
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
    onEdgeRemoved(callback, filter) {
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
    onNodeUpdated(callback, filter) {
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
    onStateChanged(callback, filter) {
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
    observeLevel(level, callback) {
        const sub = this.createSubscription(`observeLevel(L${level})`, {
            levels: [level],
        });
        this.observable.subscribe(sub.id, callback);
        return sub;
    }
    /**
     * observeGraph — observar cambios en un grafo especifico.
     */
    observeGraph(graphId, callback) {
        const sub = this.createSubscription(`observeGraph(${graphId})`, {
            graphIds: [graphId],
        });
        this.observable.subscribe(sub.id, callback);
        return sub;
    }
    /**
     * observe — observar parches que matchean un filtro.
     */
    observe(filter, callback) {
        const sub = this.createSubscription('observe', filter);
        this.observable.subscribe(sub.id, callback);
        return sub;
    }
    /**
     * Desactivar una subscripcion.
     */
    unsubscribe(subscriptionId) {
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
    resubscribe(subscriptionId) {
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
    removeSubscription(subscriptionId) {
        return this.subscriptions.delete(subscriptionId);
    }
    /**
     * Listar subscripciones activas.
     */
    activeSubscriptions() {
        return Array.from(this.subscriptions.values()).filter(s => s.active);
    }
    /**
     * Listar todas las subscripciones.
     */
    allSubscriptions() {
        return Array.from(this.subscriptions.values());
    }
    /**
     * Contar subscripciones.
     */
    subscriptionCount() {
        return this.subscriptions.size;
    }
    /**
     * Estadisticas del observer.
     */
    stats() {
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
    clear() {
        this.subscriptions.clear();
        this.observable.clear();
        this.subscribed = false;
    }
}
exports.GraphObserver = GraphObserver;
// ============================================================
// SubscriptionManager — Gestor centralizado de subscripciones
// ============================================================
class SubscriptionManager {
    subscriptions = new Map();
    groups = new Map(); // group -> subscription ids
    /**
     * Registrar una subscripcion.
     */
    register(sub, group) {
        this.subscriptions.set(sub.id, sub);
        if (group) {
            if (!this.groups.has(group)) {
                this.groups.set(group, new Set());
            }
            this.groups.get(group).add(sub.id);
        }
    }
    /**
     * Activar una subscripcion.
     */
    activate(id) {
        const sub = this.subscriptions.get(id);
        if (sub) {
            sub.active = true;
            return true;
        }
        return false;
    }
    /**
     * Desactivar una subscripcion.
     */
    deactivate(id) {
        const sub = this.subscriptions.get(id);
        if (sub) {
            sub.active = false;
            return true;
        }
        return false;
    }
    /**
     * Eliminar una subscripcion.
     */
    remove(id) {
        const sub = this.subscriptions.get(id);
        if (!sub)
            return false;
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
    activateGroup(group) {
        let count = 0;
        for (const id of this.groups.get(group) ?? []) {
            if (this.activate(id))
                count++;
        }
        return count;
    }
    /**
     * Desactivar todas las subscripciones de un grupo.
     */
    deactivateGroup(group) {
        let count = 0;
        for (const id of this.groups.get(group) ?? []) {
            if (this.deactivate(id))
                count++;
        }
        return count;
    }
    /**
     * Obtener una subscripcion.
     */
    get(id) {
        return this.subscriptions.get(id);
    }
    /**
     * Listar subscripciones activas.
     */
    active() {
        return Array.from(this.subscriptions.values()).filter(s => s.active);
    }
    /**
     * Listar todas las subscripciones.
     */
    all() {
        return Array.from(this.subscriptions.values());
    }
    /**
     * Contar subscripciones.
     */
    count() {
        return this.subscriptions.size;
    }
    /**
     * Listar grupos.
     */
    listGroups() {
        return Array.from(this.groups.keys());
    }
    /**
     * Estadisticas.
     */
    stats() {
        return {
            total: this.subscriptions.size,
            active: this.active().length,
            groups: this.groups.size,
        };
    }
    /**
     * Limpiar todo.
     */
    clear() {
        this.subscriptions.clear();
        this.groups.clear();
    }
}
exports.SubscriptionManager = SubscriptionManager;
//# sourceMappingURL=streaming.js.map