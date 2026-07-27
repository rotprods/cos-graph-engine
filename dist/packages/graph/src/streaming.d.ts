/**
 * Streaming y Reactividad en Tiempo Real — Fase 16
 *
 * T-16.1: Streaming de Grafos con WebSocket API y parches diferenciales
 * T-16.2: Reactividad con Observables, subscripciones selectivas,
 *          onNodeAdded, onEdgeRemoved, onStateChanged
 *
 * Zero dependencias externas.
 */
export type PatchType = 'node_added' | 'node_removed' | 'edge_added' | 'edge_removed' | 'node_updated' | 'graph_created' | 'graph_deleted' | 'state_changed';
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
export declare class GraphPatchBuilder {
    static nodeAdded(level: number, graphId: string, nodeId: string, data?: Record<string, unknown>): GraphPatch;
    static nodeRemoved(level: number, graphId: string, nodeId: string): GraphPatch;
    static edgeAdded(level: number, graphId: string, edgeId: string, data?: Record<string, unknown>): GraphPatch;
    static edgeRemoved(level: number, graphId: string, edgeId: string): GraphPatch;
    static nodeUpdated(level: number, graphId: string, nodeId: string, data?: Record<string, unknown>): GraphPatch;
    static graphCreated(level: number, graphId: string): GraphPatch;
    static graphDeleted(level: number, graphId: string): GraphPatch;
    static stateChanged(level: number, graphId: string, data?: Record<string, unknown>): GraphPatch;
}
export declare class PatchSerializer {
    static serialize(patch: GraphPatch): string;
    static deserialize(json: string): GraphPatch;
    static serializeBatch(patches: GraphPatch[]): string;
    static deserializeBatch(json: string): GraphPatch[];
    static compress(patches: GraphPatch[]): GraphPatch[];
}
export declare class Observable<T> {
    private listeners;
    private onceListeners;
    /**
     * Subscribirse a un evento.
     * Retorna funcion de limpieza.
     */
    subscribe(event: string, callback: (data: T) => void): () => void;
    /**
     * Subscribirse una sola vez.
     */
    subscribeOnce(event: string, callback: (data: T) => void): void;
    /**
     * Desubscribirse.
     */
    unsubscribe(event: string, callback: (data: T) => void): void;
    /**
     * Emitir un evento a todos los subscriptores.
     */
    emit(event: string, data: T): void;
    /**
     * Emitir a todos los eventos (wildcard).
     */
    emitAll(data: T): void;
    /**
     * Contar subscriptores de un evento.
     */
    listenerCount(event: string): number;
    /**
     * Listar todos los eventos con subscriptores.
     */
    events(): string[];
    /**
     * Limpiar todos los subscriptores.
     */
    clear(): void;
}
export declare class GraphStream {
    private patches;
    private observable;
    private connections;
    private maxHistory;
    constructor(maxHistory?: number);
    /**
     * Conectar un nuevo cliente.
     */
    connect(filters?: PatchFilter): Connection;
    /**
     * Desconectar un cliente.
     */
    disconnect(connectionId: string): boolean;
    /**
     * Enviar un patch a todos los clientes conectados con filtros que matcheen.
     */
    sendPatch(patch: GraphPatch): void;
    /**
     * Enviar multiples patches.
     */
    sendBatch(patches: GraphPatch[]): void;
    /**
     * Verificar si un patch matchea un filtro.
     */
    private matchesFilter;
    /**
     * Obtener historial de patches.
     */
    getHistory(filter?: PatchFilter): GraphPatch[];
    /**
     * Obtener historial como diff (solo cambios desde un timestamp).
     */
    getDiffSince(timestamp: number): GraphPatch[];
    /**
     * Subscribirse a parches via callback.
     * Retorna funcion de limpieza.
     */
    subscribe(callback: (patch: GraphPatch) => void, filter?: PatchFilter): () => void;
    /**
     * Subscribirse a un tipo de patch especifico.
     */
    onPatchType(type: PatchType, callback: (patch: GraphPatch) => void, filter?: PatchFilter): () => void;
    /**
     * Estadisticas del stream.
     */
    stats(): {
        totalPatches: number;
        activeConnections: number;
        events: string[];
    };
    /**
     * Limpiar todo.
     */
    clear(): void;
}
export declare class GraphObserver {
    private subscriptions;
    private observable;
    private subscribed;
    /**
     * Conectar el observer a un GraphStream.
     */
    connectToStream(stream: GraphStream): void;
    /**
     * Construir un observer standalone (sin stream).
     */
    static createStandalone(): {
        observer: GraphObserver;
        emitter: {
            emit: (patch: GraphPatch) => void;
        };
    };
    private matchesFilter;
    /**
     * Crear una subscripcion.
     */
    private createSubscription;
    /**
     * onNodeAdded — callback cuando se agrega un nodo.
     */
    onNodeAdded(callback: (patch: GraphPatch) => void, filter?: PatchFilter): Subscription;
    /**
     * onNodeRemoved — callback cuando se elimina un nodo.
     */
    onNodeRemoved(callback: (patch: GraphPatch) => void, filter?: PatchFilter): Subscription;
    /**
     * onEdgeAdded — callback cuando se agrega una arista.
     */
    onEdgeAdded(callback: (patch: GraphPatch) => void, filter?: PatchFilter): Subscription;
    /**
     * onEdgeRemoved — callback cuando se elimina una arista.
     */
    onEdgeRemoved(callback: (patch: GraphPatch) => void, filter?: PatchFilter): Subscription;
    /**
     * onNodeUpdated — callback cuando se actualiza un nodo.
     */
    onNodeUpdated(callback: (patch: GraphPatch) => void, filter?: PatchFilter): Subscription;
    /**
     * onStateChanged — callback cuando cambia el estado.
     */
    onStateChanged(callback: (patch: GraphPatch) => void, filter?: PatchFilter): Subscription;
    /**
     * observeLevel — observar cambios en un nivel especifico.
     */
    observeLevel(level: number, callback: (patch: GraphPatch) => void): Subscription;
    /**
     * observeGraph — observar cambios en un grafo especifico.
     */
    observeGraph(graphId: string, callback: (patch: GraphPatch) => void): Subscription;
    /**
     * observe — observar parches que matchean un filtro.
     */
    observe(filter: PatchFilter, callback: (patch: GraphPatch) => void): Subscription;
    /**
     * Desactivar una subscripcion.
     */
    unsubscribe(subscriptionId: string): boolean;
    /**
     * Reactivar una subscripcion.
     */
    resubscribe(subscriptionId: string): boolean;
    /**
     * Eliminar una subscripcion permanentemente.
     */
    removeSubscription(subscriptionId: string): boolean;
    /**
     * Listar subscripciones activas.
     */
    activeSubscriptions(): Subscription[];
    /**
     * Listar todas las subscripciones.
     */
    allSubscriptions(): Subscription[];
    /**
     * Contar subscripciones.
     */
    subscriptionCount(): number;
    /**
     * Estadisticas del observer.
     */
    stats(): {
        total: number;
        active: number;
        totalCalls: number;
    };
    /**
     * Limpiar todas las subscripciones.
     */
    clear(): void;
}
export declare class SubscriptionManager {
    private subscriptions;
    private groups;
    /**
     * Registrar una subscripcion.
     */
    register(sub: Subscription, group?: string): void;
    /**
     * Activar una subscripcion.
     */
    activate(id: string): boolean;
    /**
     * Desactivar una subscripcion.
     */
    deactivate(id: string): boolean;
    /**
     * Eliminar una subscripcion.
     */
    remove(id: string): boolean;
    /**
     * Activar todas las subscripciones de un grupo.
     */
    activateGroup(group: string): number;
    /**
     * Desactivar todas las subscripciones de un grupo.
     */
    deactivateGroup(group: string): number;
    /**
     * Obtener una subscripcion.
     */
    get(id: string): Subscription | undefined;
    /**
     * Listar subscripciones activas.
     */
    active(): Subscription[];
    /**
     * Listar todas las subscripciones.
     */
    all(): Subscription[];
    /**
     * Contar subscripciones.
     */
    count(): number;
    /**
     * Listar grupos.
     */
    listGroups(): string[];
    /**
     * Estadisticas.
     */
    stats(): {
        total: number;
        active: number;
        groups: number;
    };
    /**
     * Limpiar todo.
     */
    clear(): void;
}
//# sourceMappingURL=streaming.d.ts.map