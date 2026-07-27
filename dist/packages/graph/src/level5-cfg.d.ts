import { EntityId, Timestamp } from '@cos/core';
export type BlockType = 'entry' | 'exit' | 'basic' | 'branch' | 'merge' | 'loop_header' | 'loop_body' | 'condition';
export interface BasicBlock {
    id: EntityId;
    name: string;
    type: BlockType;
    instructions?: string[];
    condition?: string;
    loopVar?: string;
    depth?: number;
    hitCount?: number;
}
export interface CFEdge {
    id: EntityId;
    source: EntityId;
    target: EntityId;
    type: 'true' | 'false' | 'jump' | 'fallthrough' | 'back_edge' | 'exception';
    label?: string;
    probability?: number;
}
export interface ControlFlowGraph {
    id: EntityId;
    name: string;
    blocks: BasicBlock[];
    edges: CFEdge[];
    entryBlock: EntityId;
    exitBlock?: EntityId;
    createdAt: Timestamp;
}
export declare class CFGBuilder {
    private cfgs;
    private adj;
    private adjRev;
    private buildAdjacency;
    createCFG(name: string): EntityId;
    addBlock(cfgId: EntityId, name: string, type: BlockType, instructions?: string[]): EntityId;
    removeBlock(cfgId: EntityId, blockId: EntityId): void;
    addEdge(cfgId: EntityId, source: EntityId, target: EntityId, type?: CFEdge['type'], label?: string): void;
    removeEdge(cfgId: EntityId, edgeId: EntityId): void;
    getBlock(cfgId: EntityId, blockId: EntityId): BasicBlock | undefined;
    getCFG(id: EntityId): ControlFlowGraph | undefined;
    buildIfThenElse(cfgId: EntityId, condition: string, thenBlock: string, elseBlock: string, mergeBlock: string): void;
    buildLoop(cfgId: EntityId, loopVar: string, init: string, condition: string, body: string): void;
    buildSwitch(cfgId: EntityId, expression: string, cases: Array<{
        value: string;
        block: string;
    }>, defaultBlock: string): void;
    computeDominators(cfgId: EntityId): Map<EntityId, Set<EntityId>>;
    detectLoops(cfgId: EntityId): Array<{
        header: EntityId;
        body: EntityId[];
    }>;
    toMermaid(cfgId: EntityId): string;
    validate(cfgId: EntityId): string[];
    metrics(cfgId: EntityId): {
        nodeCount: number;
        edgeCount: number;
        avgDegree: number;
        density: number;
    };
    toJSON(cfgId: EntityId): ControlFlowGraph | undefined;
    static fromJSON(data: ControlFlowGraph): CFGBuilder;
}
//# sourceMappingURL=level5-cfg.d.ts.map