// ================================================================
// LEVEL 5: CONTROL FLOW GRAPH
// CFG: basic blocks, branching, loops, merge points, dominators
// Refactored: mutation API, adjacency maps, serialization, validation
// ================================================================

import { EntityId, Timestamp } from '@cos/core';
import { generateId } from '@cos/core';

export type BlockType = 'entry' | 'exit' | 'basic' | 'branch' | 'merge' | 'loop_header' | 'loop_body' | 'condition';

export interface BasicBlock {
  id: EntityId; name: string; type: BlockType;
  instructions?: string[]; condition?: string; loopVar?: string;
  depth?: number; hitCount?: number;
}

export interface CFEdge {
  id: EntityId; source: EntityId; target: EntityId;
  type: 'true' | 'false' | 'jump' | 'fallthrough' | 'back_edge' | 'exception';
  label?: string; probability?: number;
}

export interface ControlFlowGraph {
  id: EntityId; name: string;
  blocks: BasicBlock[]; edges: CFEdge[];
  entryBlock: EntityId; exitBlock?: EntityId; createdAt: Timestamp;
}

export class CFGBuilder {
  private cfgs: Map<EntityId, ControlFlowGraph> = new Map();
  private adj: Map<EntityId, EntityId[]> = new Map();
  private adjRev: Map<EntityId, EntityId[]> = new Map();

  private buildAdjacency(cfg: ControlFlowGraph): void {
    this.adj.clear(); this.adjRev.clear();
    for (const b of cfg.blocks) { this.adj.set(b.id, []); this.adjRev.set(b.id, []); }
    for (const e of cfg.edges) {
      if (this.adj.has(e.source)) this.adj.get(e.source)!.push(e.target);
      if (this.adjRev.has(e.target)) this.adjRev.get(e.target)!.push(e.source);
    }
  }

  createCFG(name: string): EntityId {
    const id = generateId(); const entryId = generateId(); const exitId = generateId();
    this.cfgs.set(id, { id, name, blocks: [
      { id: entryId, name: 'entry', type: 'entry' },
      { id: exitId, name: 'exit', type: 'exit' },
    ], edges: [], entryBlock: entryId, exitBlock: exitId, createdAt: new Date().toISOString() });
    return id;
  }

  addBlock(cfgId: EntityId, name: string, type: BlockType, instructions?: string[]): EntityId {
    const cfg = this.cfgs.get(cfgId);
    if (!cfg) throw new Error(`CFG ${cfgId} not found`);
    const id = generateId();
    if (cfg.blocks.some(b => b.id === id)) throw new Error(`Duplicate block ID: ${id}`);
    cfg.blocks.push({ id, name, type, instructions, depth: 0, hitCount: 0 });
    this.buildAdjacency(cfg);
    return id;
  }

  removeBlock(cfgId: EntityId, blockId: EntityId): void {
    const cfg = this.cfgs.get(cfgId);
    if (!cfg) throw new Error(`CFG ${cfgId} not found`);
    const idx = cfg.blocks.findIndex(b => b.id === blockId);
    if (idx === -1) throw new Error(`Block ${blockId} not found`);
    cfg.blocks.splice(idx, 1);
    cfg.edges = cfg.edges.filter(e => e.source !== blockId && e.target !== blockId);
    this.buildAdjacency(cfg);
  }

  addEdge(cfgId: EntityId, source: EntityId, target: EntityId, type: CFEdge['type'] = 'jump', label?: string): void {
    const cfg = this.cfgs.get(cfgId);
    if (!cfg) throw new Error(`CFG ${cfgId} not found`);
    if (!cfg.blocks.some(b => b.id === source)) throw new Error(`CFG edge source ${source} not found`);
    if (!cfg.blocks.some(b => b.id === target)) throw new Error(`CFG edge target ${target} not found`);
    cfg.edges.push({ id: generateId(), source, target, type, label });
    this.buildAdjacency(cfg);
  }

  removeEdge(cfgId: EntityId, edgeId: EntityId): void {
    const cfg = this.cfgs.get(cfgId);
    if (!cfg) throw new Error(`CFG ${cfgId} not found`);
    const idx = cfg.edges.findIndex(e => e.id === edgeId);
    if (idx === -1) throw new Error(`Edge ${edgeId} not found`);
    cfg.edges.splice(idx, 1);
    this.buildAdjacency(cfg);
  }

  getBlock(cfgId: EntityId, blockId: EntityId): BasicBlock | undefined {
    return this.cfgs.get(cfgId)?.blocks.find(b => b.id === blockId);
  }

  getCFG(id: EntityId): ControlFlowGraph | undefined { return this.cfgs.get(id); }

  buildIfThenElse(cfgId: EntityId, condition: string, thenBlock: string, elseBlock: string, mergeBlock: string): void {
    const cfg = this.cfgs.get(cfgId); if (!cfg) return;
    const condId = this.addBlock(cfgId, `if (${condition})`, 'condition', [condition]);
    const thenId = this.addBlock(cfgId, thenBlock, 'basic', [thenBlock]);
    const elseId = this.addBlock(cfgId, elseBlock, 'basic', [elseBlock]);
    const mergeId = this.addBlock(cfgId, mergeBlock, 'merge' as BlockType);
    this.addEdge(cfgId, cfg.entryBlock, condId, 'fallthrough');
    this.addEdge(cfgId, condId, thenId, 'true', condition);
    this.addEdge(cfgId, condId, elseId, 'false', `!${condition}`);
    this.addEdge(cfgId, thenId, mergeId, 'jump');
    this.addEdge(cfgId, elseId, mergeId, 'jump');
    this.addEdge(cfgId, mergeId, cfg.exitBlock!, 'fallthrough');
  }

  buildLoop(cfgId: EntityId, loopVar: string, init: string, condition: string, body: string): void {
    const cfg = this.cfgs.get(cfgId); if (!cfg) return;
    const initId = this.addBlock(cfgId, init, 'basic', [init]);
    const headerId = this.addBlock(cfgId, `loop: ${condition}`, 'loop_header', [condition]);
    const bodyId = this.addBlock(cfgId, body, 'loop_body', [body]);
    const exitId = this.addBlock(cfgId, 'loop_exit', 'merge' as BlockType);
    this.addEdge(cfgId, cfg.entryBlock, initId, 'fallthrough');
    this.addEdge(cfgId, initId, headerId, 'jump');
    this.addEdge(cfgId, headerId, bodyId, 'true', condition);
    this.addEdge(cfgId, bodyId, headerId, 'back_edge');
    this.addEdge(cfgId, headerId, exitId, 'false', `!${condition}`);
    this.addEdge(cfgId, exitId, cfg.exitBlock!, 'fallthrough');
  }

  buildSwitch(cfgId: EntityId, expression: string, cases: Array<{ value: string; block: string }>, defaultBlock: string): void {
    const cfg = this.cfgs.get(cfgId); if (!cfg) return;
    const switchId = this.addBlock(cfgId, `switch (${expression})`, 'branch', [expression]);
    const mergeId = this.addBlock(cfgId, 'switch_merge', 'merge' as BlockType);
    const defaultId = this.addBlock(cfgId, defaultBlock, 'basic', [defaultBlock]);
    this.addEdge(cfgId, cfg.entryBlock, switchId, 'fallthrough');
    for (const c of cases) {
      const caseId = this.addBlock(cfgId, c.block, 'basic', [`case ${c.value}`]);
      this.addEdge(cfgId, switchId, caseId, 'true', `case ${c.value}`);
      this.addEdge(cfgId, caseId, mergeId, 'jump');
    }
    this.addEdge(cfgId, switchId, defaultId, 'false', 'default');
    this.addEdge(cfgId, defaultId, mergeId, 'jump');
    this.addEdge(cfgId, mergeId, cfg.exitBlock!, 'fallthrough');
  }

  computeDominators(cfgId: EntityId): Map<EntityId, Set<EntityId>> {
    const cfg = this.cfgs.get(cfgId); if (!cfg) return new Map();
    this.buildAdjacency(cfg);
    const dom = new Map<EntityId, Set<EntityId>>();
    const allNodes = new Set(cfg.blocks.map(b => b.id));
    for (const block of cfg.blocks) dom.set(block.id, new Set(allNodes));
    dom.set(cfg.entryBlock, new Set([cfg.entryBlock]));
    let changed = true;
    while (changed) {
      changed = false;
      for (const block of cfg.blocks) {
        if (block.id === cfg.entryBlock) continue;
        const preds = this.adjRev.get(block.id) || [];
        if (preds.length === 0) continue;
        let newDom = new Set(dom.get(preds[0]));
        for (let i = 1; i < preds.length; i++) {
          newDom = new Set([...newDom].filter(x => dom.get(preds[i])?.has(x)));
        }
        newDom.add(block.id);
        const oldDom = dom.get(block.id);
        if (oldDom && !setsEqual(newDom, oldDom)) { dom.set(block.id, newDom); changed = true; }
      }
    }
    return dom;
  }

  detectLoops(cfgId: EntityId): Array<{ header: EntityId; body: EntityId[] }> {
    const cfg = this.cfgs.get(cfgId); if (!cfg) return [];
    const loops: Array<{ header: EntityId; body: EntityId[] }> = [];
    for (const edge of cfg.edges) {
      if (edge.type === 'back_edge') {
        const header = edge.target; const body: EntityId[] = [edge.source];
        let changed = true;
        while (changed) {
          changed = false;
          for (const block of cfg.blocks) {
            if (block.id === header || body.includes(block.id)) continue;
            if (cfg.edges.some(e => e.source === block.id && body.includes(e.target))) { body.push(block.id); changed = true; }
          }
        }
        loops.push({ header, body });
      }
    }
    return loops;
  }

  toMermaid(cfgId: EntityId): string {
    const cfg = this.cfgs.get(cfgId);
    if (!cfg) return 'graph TD\n  title: "CFG not found"';
    let m = `graph TD\n  title: "${cfg.name}"\n`;
    for (const block of cfg.blocks) {
      const shape = block.type === 'entry' || block.type === 'exit' ? '((' : block.type === 'condition' || block.type === 'branch' ? '{' : '[';
      const close = block.type === 'entry' || block.type === 'exit' ? '))' : block.type === 'condition' || block.type === 'branch' ? '}' : ']';
      const label = block.name.length > 30 ? block.name.substring(0, 30) + '...' : block.name;
      m += `    ${block.id.replace(/[^a-zA-Z0-9]/g, '_')}${shape}"${label}"${close}\n`;
    }
    for (const edge of cfg.edges) {
      const s = edge.source.replace(/[^a-zA-Z0-9]/g, '_');
      const t = edge.target.replace(/[^a-zA-Z0-9]/g, '_');
      const style = edge.type === 'back_edge' ? '-.->' : '-->';
      const label = edge.label ? `|${edge.label}|` : '';
      m += `    ${s}${style}${label}${t}\n`;
    }
    return m;
  }

  validate(cfgId: EntityId): string[] {
    const cfg = this.cfgs.get(cfgId); if (!cfg) return ['CFG not found'];
    const errors: string[] = [];
    for (const e of cfg.edges) {
      if (!cfg.blocks.some(b => b.id === e.source)) errors.push(`Dangling edge source: ${e.source}`);
      if (!cfg.blocks.some(b => b.id === e.target)) errors.push(`Dangling edge target: ${e.target}`);
    }
    return errors;
  }

  metrics(cfgId: EntityId): { nodeCount: number; edgeCount: number; avgDegree: number; density: number } {
    const cfg = this.cfgs.get(cfgId);
    if (!cfg) return { nodeCount: 0, edgeCount: 0, avgDegree: 0, density: 0 };
    const n = cfg.blocks.length; const e = cfg.edges.length;
    this.buildAdjacency(cfg);
    const deg = cfg.blocks.map(b => (this.adj.get(b.id)?.length || 0) + (this.adjRev.get(b.id)?.length || 0));
    const avgDeg = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
    const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
    return { nodeCount: n, edgeCount: e, avgDegree: avgDeg, density };
  }

  toJSON(cfgId: EntityId): ControlFlowGraph | undefined {
    const cfg = this.cfgs.get(cfgId);
    return cfg ? JSON.parse(JSON.stringify(cfg)) : undefined;
  }

  static fromJSON(data: ControlFlowGraph): CFGBuilder {
    const builder = new CFGBuilder();
    builder.cfgs.set(data.id, data);
    builder.buildAdjacency(data);
    return builder;
  }
}

function setsEqual(a: Set<any>, b: Set<any>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}