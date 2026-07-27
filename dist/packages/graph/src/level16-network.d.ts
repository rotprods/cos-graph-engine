import { EntityId, Timestamp } from '@cos/core';
export type NetworkNodeType = 'server' | 'router' | 'cdn' | 'client' | 'load_balancer' | 'pod' | 'service' | 'gateway' | 'database' | 'cache';
export type NetworkEdgeType = 'routes_to' | 'load_balanced_by' | 'proxies_to' | 'depends_on' | 'replicates_to' | 'connects_to';
export interface NetworkNode {
    id: EntityId;
    name: string;
    type: NetworkNodeType;
    healthy: boolean;
    ip?: string;
    region?: string;
    latency?: number;
    throughput?: number;
    cpu?: number;
    memory?: number;
    replicas?: number;
    createdAt: Timestamp;
}
export interface NetworkEdge {
    id: EntityId;
    source: EntityId;
    target: EntityId;
    type: NetworkEdgeType;
    bandwidth?: number;
    createdAt: Timestamp;
}
export interface NetworkGraph {
    id: EntityId;
    name: string;
    createdAt: Timestamp;
    nodes: NetworkNode[];
    edges: NetworkEdge[];
}
export declare class NetworkGraphEngine {
    private graph;
    private adj;
    constructor(name?: string);
    private buildAdjacency;
    addNode(n: Omit<NetworkNode, 'id' | 'createdAt'>): EntityId;
    removeNode(nodeId: EntityId): void;
    addEdge(source: EntityId, target: EntityId, type: NetworkEdgeType, bandwidth?: number): EntityId;
    removeEdge(edgeId: EntityId): void;
    getNode(nodeId: EntityId): NetworkNode | undefined;
    getNodes(): NetworkNode[];
    getEdges(): NetworkEdge[];
    buildInfrastructure(): void;
    shortestPath(fromId: EntityId, toId: EntityId): NetworkNode[];
    findUnhealthy(): NetworkNode[];
    validate(): string[];
    metrics(): {
        nodeCount: number;
        edgeCount: number;
        unhealthyCount: number;
        avgLatency: number;
        regionCount: number;
    };
    toJSON(): NetworkGraph;
    static fromJSON(data: NetworkGraph): NetworkGraphEngine;
    toMermaid(): string;
}
//# sourceMappingURL=level16-network.d.ts.map