export type EntityType = 'concept' | 'person' | 'org' | 'product' | 'tech' | 'event' | 'place' | 'system';
export type RelationType = 'created' | 'uses' | 'part_of' | 'subclass_of' | 'located_in' | 'produced_by' | 'has' | 'related_to';
export interface KGEntity {
    id: string;
    name: string;
    type: EntityType;
    aliases?: string[];
    description?: string;
    properties?: Record<string, string>;
}
export interface KGRelation {
    id: string;
    source: string;
    target: string;
    type: RelationType;
    confidence?: number;
    sourceDoc?: string;
    properties?: Record<string, string>;
}
export interface SPARQLQuery {
    select: string[];
    where: Array<{
        subject: string;
        predicate: string;
        object: string;
    }>;
    limit?: number;
}
export declare class KnowledgeGraphEngine {
    entities: KGEntity[];
    relations: KGRelation[];
    private adj;
    private adjRev;
    private buildAdjacency;
    addEntity(e: KGEntity): string;
    removeEntity(entityId: string): void;
    addRelation(r: KGRelation): void;
    removeRelation(relationId: string): void;
    getEntity(entityId: string): KGEntity | undefined;
    getRelation(relationId: string): KGRelation | undefined;
    getRelations(entityId: string): KGRelation[];
    buildAIEcosystem(): void;
    buildCOS(): void;
    sparql(query: SPARQLQuery): Array<Record<string, KGEntity>>;
    query(sourceId: string, relation?: RelationType, maxDepth?: number): KGEntity[];
    inferTransitive(): KGRelation[];
    toMermaid(): string;
    validate(): string[];
    metrics(): {
        nodeCount: number;
        edgeCount: number;
        avgDegree: number;
        density: number;
    };
    toJSON(): {
        entities: KGEntity[];
        relations: KGRelation[];
    };
    static fromJSON(data: {
        entities: KGEntity[];
        relations: KGRelation[];
    }): KnowledgeGraphEngine;
}
//# sourceMappingURL=level8-knowledge.d.ts.map