import { EntityId, Timestamp } from '@cos/core';
export type AgentRole = 'ceo' | 'planner' | 'researcher' | 'developer' | 'reviewer' | 'marketer' | 'analyst' | 'designer' | 'coordinator';
export type AgentEdgeType = 'delegates_to' | 'reports_to' | 'collaborates_with' | 'reviews' | 'approves';
export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'done' | 'error';
export interface AgentNode {
    id: EntityId;
    name: string;
    role: AgentRole;
    status: AgentStatus;
    capabilities: string[];
    tools: string[];
    memoryIds: string[];
    confidence: number;
    createdAt: Timestamp;
}
export interface AgentEdge {
    id: EntityId;
    source: EntityId;
    target: EntityId;
    type: AgentEdgeType;
    priority: number;
    createdAt: Timestamp;
}
export interface AgentGraph {
    id: EntityId;
    name: string;
    createdAt: Timestamp;
    nodes: AgentNode[];
    edges: AgentEdge[];
}
export declare class AgentGraphEngine {
    private graph;
    private adj;
    constructor(name?: string);
    private buildAdjacency;
    addNode(n: Omit<AgentNode, 'id' | 'createdAt' | 'status'>): EntityId;
    removeNode(nodeId: EntityId): void;
    addEdge(source: EntityId, target: EntityId, type: AgentEdgeType, priority?: number): EntityId;
    removeEdge(edgeId: EntityId): void;
    getNode(nodeId: EntityId): AgentNode | undefined;
    getNodes(): AgentNode[];
    getEdges(): AgentEdge[];
    buildDevTeam(): void;
    delegationChain(fromId: EntityId, toId: EntityId): AgentNode[];
    findByCapability(capability: string): AgentNode[];
    validate(): string[];
    metrics(): {
        nodeCount: number;
        edgeCount: number;
        avgOutDegree: number;
        roles: number;
    };
    toJSON(): AgentGraph;
    static fromJSON(data: AgentGraph): AgentGraphEngine;
    toMermaid(): string;
}
//# sourceMappingURL=level13-agent.d.ts.map