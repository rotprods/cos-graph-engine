"use strict";
// LEVEL 8: KNOWLEDGE GRAPH
// Ontologies, entities, relationships, SPARQL queries, transitive inference
// Refactored: mutation API, adjacency maps, serialization, validation
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeGraphEngine = void 0;
const core_1 = require("@cos/core");
class KnowledgeGraphEngine {
    entities = [];
    relations = [];
    adj = new Map();
    adjRev = new Map();
    buildAdjacency() {
        this.adj.clear();
        this.adjRev.clear();
        for (const e of this.entities) {
            this.adj.set(e.id, []);
            this.adjRev.set(e.id, []);
        }
        for (const r of this.relations) {
            if (this.adj.has(r.source))
                this.adj.get(r.source).push(r.target);
            if (this.adjRev.has(r.target))
                this.adjRev.get(r.target).push(r.source);
        }
    }
    addEntity(e) {
        if (this.entities.some(x => x.id === e.id))
            throw new Error(`Duplicate entity ID: ${e.id}`);
        this.entities.push(e);
        this.buildAdjacency();
        return e.id;
    }
    removeEntity(entityId) {
        const idx = this.entities.findIndex(e => e.id === entityId);
        if (idx === -1)
            throw new Error(`Entity ${entityId} not found`);
        this.entities.splice(idx, 1);
        this.relations = this.relations.filter(r => r.source !== entityId && r.target !== entityId);
        this.buildAdjacency();
    }
    addRelation(r) {
        if (!this.entities.some(e => e.id === r.source))
            throw new Error(`Relation source ${r.source} not found`);
        if (!this.entities.some(e => e.id === r.target))
            throw new Error(`Relation target ${r.target} not found`);
        this.relations.push(r);
        this.buildAdjacency();
    }
    removeRelation(relationId) {
        const idx = this.relations.findIndex(r => r.id === relationId);
        if (idx === -1)
            throw new Error(`Relation ${relationId} not found`);
        this.relations.splice(idx, 1);
        this.buildAdjacency();
    }
    getEntity(entityId) { return this.entities.find(e => e.id === entityId); }
    getRelation(relationId) { return this.relations.find(r => r.id === relationId); }
    getRelations(entityId) {
        return this.relations.filter(r => r.source === entityId || r.target === entityId);
    }
    buildAIEcosystem() {
        this.addEntity({ id: 'openai', name: 'OpenAI', type: 'org', description: 'AI research company' });
        this.addEntity({ id: 'gpt5', name: 'GPT-5', type: 'product', description: 'Large language model' });
        this.addEntity({ id: 'transformer', name: 'Transformer', type: 'tech', description: 'Neural network architecture' });
        this.addEntity({ id: 'llm', name: 'LLM', type: 'concept', description: 'Large Language Model' });
        this.addEntity({ id: 'rag', name: 'RAG', type: 'tech', description: 'Retrieval Augmented Generation' });
        this.addEntity({ id: 'embedding', name: 'Embedding', type: 'tech', description: 'Vector representation' });
        this.addRelation({ id: (0, core_1.generateId)(), source: 'openai', target: 'gpt5', type: 'created' });
        this.addRelation({ id: (0, core_1.generateId)(), source: 'gpt5', target: 'transformer', type: 'uses' });
        this.addRelation({ id: (0, core_1.generateId)(), source: 'gpt5', target: 'llm', type: 'subclass_of' });
        this.addRelation({ id: (0, core_1.generateId)(), source: 'rag', target: 'llm', type: 'uses' });
        this.addRelation({ id: (0, core_1.generateId)(), source: 'rag', target: 'embedding', type: 'uses' });
    }
    buildCOS() {
        this.addEntity({ id: 'cos', name: 'Cognitive OS', type: 'system' });
        this.addEntity({ id: 'cos-memory', name: 'Memory', type: 'concept' });
        this.addEntity({ id: 'cos-reasoning', name: 'Reasoning', type: 'concept' });
        this.addEntity({ id: 'cos-knowledge', name: 'Knowledge', type: 'concept' });
        this.addEntity({ id: 'cos-execution', name: 'Execution', type: 'concept' });
        this.addEntity({ id: 'cos-orch', name: 'Orchestration', type: 'concept' });
        this.addRelation({ id: (0, core_1.generateId)(), source: 'cos', target: 'cos-memory', type: 'has' });
        this.addRelation({ id: (0, core_1.generateId)(), source: 'cos', target: 'cos-reasoning', type: 'has' });
        this.addRelation({ id: (0, core_1.generateId)(), source: 'cos', target: 'cos-knowledge', type: 'has' });
        this.addRelation({ id: (0, core_1.generateId)(), source: 'cos', target: 'cos-execution', type: 'has' });
        this.addRelation({ id: (0, core_1.generateId)(), source: 'cos', target: 'cos-orch', type: 'has' });
    }
    sparql(query) {
        const results = [];
        for (const entity of this.entities) {
            let match = true;
            for (const pattern of query.where) {
                if (pattern.subject.startsWith('?')) {
                    if (pattern.predicate !== 'type' || entity.type !== pattern.object) {
                        match = false;
                        break;
                    }
                }
                else if (pattern.object.startsWith('?')) {
                    if (!this.relations.some(r => r.source === pattern.subject && r.target === entity.id && r.type === pattern.predicate)) {
                        match = false;
                        break;
                    }
                }
            }
            if (match) {
                const binding = {};
                for (const v of query.select)
                    binding[v] = entity;
                results.push(binding);
            }
        }
        return results;
    }
    query(sourceId, relation, maxDepth = 2) {
        const visited = new Set();
        const results = [];
        const dfs = (id, depth) => {
            if (depth > maxDepth || visited.has(id))
                return;
            visited.add(id);
            const entity = this.entities.find(e => e.id === id);
            if (entity && id !== sourceId)
                results.push(entity);
            for (const r of this.relations) {
                if (r.source === id && (!relation || r.type === relation))
                    dfs(r.target, depth + 1);
                if (r.target === id && (!relation || r.type === relation))
                    dfs(r.source, depth + 1);
            }
        };
        dfs(sourceId, 0);
        return results;
    }
    inferTransitive() {
        const inferred = [];
        for (const r1 of this.relations) {
            for (const r2 of this.relations) {
                if (r1.target === r2.source && r1.type === r2.type) {
                    if (!this.relations.some(r => r.source === r1.source && r.target === r2.target)) {
                        inferred.push({ id: (0, core_1.generateId)(), source: r1.source, target: r2.target, type: r1.type, confidence: (r1.confidence || 0.5) * (r2.confidence || 0.5) * 0.9 });
                    }
                }
            }
        }
        return inferred;
    }
    toMermaid() {
        let m = 'graph LR\n';
        for (const e of this.entities) {
            m += `    ${e.id}["${e.name}"]\n`;
        }
        for (const r of this.relations) {
            m += `    ${r.source} -->|"${r.type}"| ${r.target}\n`;
        }
        return m;
    }
    validate() {
        const errors = [];
        for (const r of this.relations) {
            if (!this.entities.some(e => e.id === r.source))
                errors.push(`Dangling relation source: ${r.source}`);
            if (!this.entities.some(e => e.id === r.target))
                errors.push(`Dangling relation target: ${r.target}`);
        }
        return errors;
    }
    metrics() {
        const n = this.entities.length;
        const e = this.relations.length;
        this.buildAdjacency();
        const deg = this.entities.map(en => (this.adj.get(en.id)?.length || 0) + (this.adjRev.get(en.id)?.length || 0));
        const avgDeg = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
        const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
        return { nodeCount: n, edgeCount: e, avgDegree: avgDeg, density };
    }
    toJSON() { return { entities: this.entities, relations: this.relations }; }
    static fromJSON(data) {
        const g = new KnowledgeGraphEngine();
        g.entities = data.entities;
        g.relations = data.relations;
        g.buildAdjacency();
        return g;
    }
}
exports.KnowledgeGraphEngine = KnowledgeGraphEngine;
//# sourceMappingURL=level8-knowledge.js.map