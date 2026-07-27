import { EntityId, Timestamp } from '@cos/core';
export type SocialNodeType = 'person' | 'company' | 'event' | 'group' | 'page' | 'influencer';
export type SocialEdgeType = 'friend_of' | 'follows' | 'works_at' | 'attended' | 'likes' | 'family_of' | 'mentions';
export interface SocialNode {
    id: EntityId;
    name: string;
    type: SocialNodeType;
    verified: boolean;
    followers?: number;
    influence?: number;
    interests?: string[];
    location?: string;
    createdAt: Timestamp;
}
export interface SocialEdge {
    id: EntityId;
    source: EntityId;
    target: EntityId;
    type: SocialEdgeType;
    strength: number;
    createdAt: Timestamp;
}
export interface SocialGraph {
    id: EntityId;
    name: string;
    createdAt: Timestamp;
    nodes: SocialNode[];
    edges: SocialEdge[];
}
export declare class SocialGraphEngine {
    private graph;
    private adj;
    constructor(name?: string);
    private buildAdjacency;
    addNode(n: Omit<SocialNode, 'id' | 'joinedAt'>): EntityId;
    removeNode(nodeId: EntityId): void;
    addEdge(source: EntityId, target: EntityId, type: SocialEdgeType, strength?: number): EntityId;
    removeEdge(edgeId: EntityId): void;
    getNode(nodeId: EntityId): SocialNode | undefined;
    getNodes(): SocialNode[];
    getEdge(edgeId: EntityId): SocialEdge | undefined;
    getEdges(): SocialEdge[];
    buildTechNetwork(): void;
    mutualFriends(personA: EntityId, personB: EntityId): SocialNode[];
    mostInfluential(): SocialNode | undefined;
    recommendFriends(personId: EntityId): SocialNode[];
    validate(): string[];
    metrics(): {
        nodeCount: number;
        edgeCount: number;
        avgDegree: number;
        avgInfluence: number;
        verifiedCount: number;
    };
    toJSON(): SocialGraph;
    static fromJSON(data: SocialGraph): SocialGraphEngine;
    toMermaid(): string;
}
//# sourceMappingURL=level17-social.d.ts.map