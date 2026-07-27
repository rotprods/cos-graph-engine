"use strict";
// ================================================================
// LEVEL 5: CONTROL FLOW GRAPH
// CFG: basic blocks, branching, loops, merge points, dominators
// Refactored: mutation API, adjacency maps, serialization, validation
// ================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.CFGBuilder = void 0;
const core_1 = require("@cos/core");
class CFGBuilder {
    cfgs = new Map();
    adj = new Map();
    adjRev = new Map();
    buildAdjacency(cfg) {
        this.adj.clear();
        this.adjRev.clear();
        for (const b of cfg.blocks) {
            this.adj.set(b.id, []);
            this.adjRev.set(b.id, []);
        }
        for (const e of cfg.edges) {
            if (this.adj.has(e.source))
                this.adj.get(e.source).push(e.target);
            if (this.adjRev.has(e.target))
                this.adjRev.get(e.target).push(e.source);
        }
    }
    createCFG(name) {
        const id = (0, core_1.generateId)();
        const entryId = (0, core_1.generateId)();
        const exitId = (0, core_1.generateId)();
        this.cfgs.set(id, { id, name, blocks: [
                { id: entryId, name: 'entry', type: 'entry' },
                { id: exitId, name: 'exit', type: 'exit' },
            ], edges: [], entryBlock: entryId, exitBlock: exitId, createdAt: new Date().toISOString() });
        return id;
    }
    addBlock(cfgId, name, type, instructions) {
        const cfg = this.cfgs.get(cfgId);
        if (!cfg)
            throw new Error(`CFG ${cfgId} not found`);
        const id = (0, core_1.generateId)();
        if (cfg.blocks.some(b => b.id === id))
            throw new Error(`Duplicate block ID: ${id}`);
        cfg.blocks.push({ id, name, type, instructions, depth: 0, hitCount: 0 });
        this.buildAdjacency(cfg);
        return id;
    }
    removeBlock(cfgId, blockId) {
        const cfg = this.cfgs.get(cfgId);
        if (!cfg)
            throw new Error(`CFG ${cfgId} not found`);
        const idx = cfg.blocks.findIndex(b => b.id === blockId);
        if (idx === -1)
            throw new Error(`Block ${blockId} not found`);
        cfg.blocks.splice(idx, 1);
        cfg.edges = cfg.edges.filter(e => e.source !== blockId && e.target !== blockId);
        this.buildAdjacency(cfg);
    }
    addEdge(cfgId, source, target, type = 'jump', label) {
        const cfg = this.cfgs.get(cfgId);
        if (!cfg)
            throw new Error(`CFG ${cfgId} not found`);
        if (!cfg.blocks.some(b => b.id === source))
            throw new Error(`CFG edge source ${source} not found`);
        if (!cfg.blocks.some(b => b.id === target))
            throw new Error(`CFG edge target ${target} not found`);
        cfg.edges.push({ id: (0, core_1.generateId)(), source, target, type, label });
        this.buildAdjacency(cfg);
    }
    removeEdge(cfgId, edgeId) {
        const cfg = this.cfgs.get(cfgId);
        if (!cfg)
            throw new Error(`CFG ${cfgId} not found`);
        const idx = cfg.edges.findIndex(e => e.id === edgeId);
        if (idx === -1)
            throw new Error(`Edge ${edgeId} not found`);
        cfg.edges.splice(idx, 1);
        this.buildAdjacency(cfg);
    }
    getBlock(cfgId, blockId) {
        return this.cfgs.get(cfgId)?.blocks.find(b => b.id === blockId);
    }
    getCFG(id) { return this.cfgs.get(id); }
    buildIfThenElse(cfgId, condition, thenBlock, elseBlock, mergeBlock) {
        const cfg = this.cfgs.get(cfgId);
        if (!cfg)
            return;
        const condId = this.addBlock(cfgId, `if (${condition})`, 'condition', [condition]);
        const thenId = this.addBlock(cfgId, thenBlock, 'basic', [thenBlock]);
        const elseId = this.addBlock(cfgId, elseBlock, 'basic', [elseBlock]);
        const mergeId = this.addBlock(cfgId, mergeBlock, 'merge');
        this.addEdge(cfgId, cfg.entryBlock, condId, 'fallthrough');
        this.addEdge(cfgId, condId, thenId, 'true', condition);
        this.addEdge(cfgId, condId, elseId, 'false', `!${condition}`);
        this.addEdge(cfgId, thenId, mergeId, 'jump');
        this.addEdge(cfgId, elseId, mergeId, 'jump');
        this.addEdge(cfgId, mergeId, cfg.exitBlock, 'fallthrough');
    }
    buildLoop(cfgId, loopVar, init, condition, body) {
        const cfg = this.cfgs.get(cfgId);
        if (!cfg)
            return;
        const initId = this.addBlock(cfgId, init, 'basic', [init]);
        const headerId = this.addBlock(cfgId, `loop: ${condition}`, 'loop_header', [condition]);
        const bodyId = this.addBlock(cfgId, body, 'loop_body', [body]);
        const exitId = this.addBlock(cfgId, 'loop_exit', 'merge');
        this.addEdge(cfgId, cfg.entryBlock, initId, 'fallthrough');
        this.addEdge(cfgId, initId, headerId, 'jump');
        this.addEdge(cfgId, headerId, bodyId, 'true', condition);
        this.addEdge(cfgId, bodyId, headerId, 'back_edge');
        this.addEdge(cfgId, headerId, exitId, 'false', `!${condition}`);
        this.addEdge(cfgId, exitId, cfg.exitBlock, 'fallthrough');
    }
    buildSwitch(cfgId, expression, cases, defaultBlock) {
        const cfg = this.cfgs.get(cfgId);
        if (!cfg)
            return;
        const switchId = this.addBlock(cfgId, `switch (${expression})`, 'branch', [expression]);
        const mergeId = this.addBlock(cfgId, 'switch_merge', 'merge');
        const defaultId = this.addBlock(cfgId, defaultBlock, 'basic', [defaultBlock]);
        this.addEdge(cfgId, cfg.entryBlock, switchId, 'fallthrough');
        for (const c of cases) {
            const caseId = this.addBlock(cfgId, c.block, 'basic', [`case ${c.value}`]);
            this.addEdge(cfgId, switchId, caseId, 'true', `case ${c.value}`);
            this.addEdge(cfgId, caseId, mergeId, 'jump');
        }
        this.addEdge(cfgId, switchId, defaultId, 'false', 'default');
        this.addEdge(cfgId, defaultId, mergeId, 'jump');
        this.addEdge(cfgId, mergeId, cfg.exitBlock, 'fallthrough');
    }
    computeDominators(cfgId) {
        const cfg = this.cfgs.get(cfgId);
        if (!cfg)
            return new Map();
        this.buildAdjacency(cfg);
        const dom = new Map();
        const allNodes = new Set(cfg.blocks.map(b => b.id));
        for (const block of cfg.blocks)
            dom.set(block.id, new Set(allNodes));
        dom.set(cfg.entryBlock, new Set([cfg.entryBlock]));
        let changed = true;
        while (changed) {
            changed = false;
            for (const block of cfg.blocks) {
                if (block.id === cfg.entryBlock)
                    continue;
                const preds = this.adjRev.get(block.id) || [];
                if (preds.length === 0)
                    continue;
                let newDom = new Set(dom.get(preds[0]));
                for (let i = 1; i < preds.length; i++) {
                    newDom = new Set([...newDom].filter(x => dom.get(preds[i])?.has(x)));
                }
                newDom.add(block.id);
                const oldDom = dom.get(block.id);
                if (oldDom && !setsEqual(newDom, oldDom)) {
                    dom.set(block.id, newDom);
                    changed = true;
                }
            }
        }
        return dom;
    }
    detectLoops(cfgId) {
        const cfg = this.cfgs.get(cfgId);
        if (!cfg)
            return [];
        const loops = [];
        for (const edge of cfg.edges) {
            if (edge.type === 'back_edge') {
                const header = edge.target;
                const body = [edge.source];
                let changed = true;
                while (changed) {
                    changed = false;
                    for (const block of cfg.blocks) {
                        if (block.id === header || body.includes(block.id))
                            continue;
                        if (cfg.edges.some(e => e.source === block.id && body.includes(e.target))) {
                            body.push(block.id);
                            changed = true;
                        }
                    }
                }
                loops.push({ header, body });
            }
        }
        return loops;
    }
    toMermaid(cfgId) {
        const cfg = this.cfgs.get(cfgId);
        if (!cfg)
            return 'graph TD\n  title: "CFG not found"';
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
    validate(cfgId) {
        const cfg = this.cfgs.get(cfgId);
        if (!cfg)
            return ['CFG not found'];
        const errors = [];
        for (const e of cfg.edges) {
            if (!cfg.blocks.some(b => b.id === e.source))
                errors.push(`Dangling edge source: ${e.source}`);
            if (!cfg.blocks.some(b => b.id === e.target))
                errors.push(`Dangling edge target: ${e.target}`);
        }
        return errors;
    }
    metrics(cfgId) {
        const cfg = this.cfgs.get(cfgId);
        if (!cfg)
            return { nodeCount: 0, edgeCount: 0, avgDegree: 0, density: 0 };
        const n = cfg.blocks.length;
        const e = cfg.edges.length;
        this.buildAdjacency(cfg);
        const deg = cfg.blocks.map(b => (this.adj.get(b.id)?.length || 0) + (this.adjRev.get(b.id)?.length || 0));
        const avgDeg = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
        const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
        return { nodeCount: n, edgeCount: e, avgDegree: avgDeg, density };
    }
    toJSON(cfgId) {
        const cfg = this.cfgs.get(cfgId);
        return cfg ? JSON.parse(JSON.stringify(cfg)) : undefined;
    }
    static fromJSON(data) {
        const builder = new CFGBuilder();
        builder.cfgs.set(data.id, data);
        builder.buildAdjacency(data);
        return builder;
    }
}
exports.CFGBuilder = CFGBuilder;
function setsEqual(a, b) {
    if (a.size !== b.size)
        return false;
    for (const item of a)
        if (!b.has(item))
            return false;
    return true;
}
//# sourceMappingURL=level5-cfg.js.map