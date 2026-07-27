"use strict";
// ================================================================
// PIPELINE L8 -> L9 -> L10 -> L11
// Cross-level integration: Knowledge -> Semantic -> Embedding -> GraphRAG
// Fase 8: Integracion Cruzada
// ================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineL8L9L10L11 = void 0;
const level8_knowledge_1 = require("./level8-knowledge");
const level9_semantic_1 = require("./level9-semantic");
const level10_embedding_1 = require("./level10-embedding");
const level11_graphrag_1 = require("./level11-graphrag");
const core_1 = require("@cos/core");
// ===== Pipeline L8 -> L9 -> L10 -> L11 =====
class PipelineL8L9L10L11 {
    knowledgeGraph;
    semanticGraph;
    embeddingGraph;
    graphRAG;
    options;
    constructor(options) {
        this.knowledgeGraph = new level8_knowledge_1.KnowledgeGraphEngine();
        this.semanticGraph = new level9_semantic_1.SemanticGraph();
        this.embeddingGraph = new level10_embedding_1.EmbeddingGraph();
        this.graphRAG = new level11_graphrag_1.GraphRAGEngine(options?.graphRAGConfig);
        this.options = {
            embeddingDim: options?.embeddingDim ?? 8,
            knnK: options?.knnK ?? 3,
            graphRAGConfig: options?.graphRAGConfig ?? {},
            autoBuildDemo: options?.autoBuildDemo ?? false,
        };
    }
    /** Step 1: Build Knowledge Graph from entity/relation seed data */
    buildKnowledgeGraph(entities, relations) {
        for (const e of entities) {
            this.knowledgeGraph.addEntity(e);
        }
        for (const r of relations) {
            this.knowledgeGraph.addRelation(r);
        }
    }
    /** Step 2: Convert KG entities into a Semantic taxonomy */
    knowledgeToSemantic() {
        this.semanticGraph = new level9_semantic_1.SemanticGraph();
        // Map entity types to semantic classes
        const typeMap = {
            system: 'class',
            concept: 'class',
            tech: 'class',
            org: 'entity',
            person: 'entity',
            product: 'entity',
            event: 'entity',
            place: 'entity',
        };
        // Create semantic nodes from KG entities
        for (const e of this.knowledgeGraph.entities) {
            const semType = typeMap[e.type] || 'entity';
            this.semanticGraph.addNode({
                id: `sem_${e.id}`,
                concept: e.name,
                type: semType,
                definition: e.description,
            });
        }
        // Create semantic edges from KG relations
        for (const r of this.knowledgeGraph.relations) {
            const semRelation = this.mapRelationType(r.type);
            this.semanticGraph.addEdge({
                id: (0, core_1.generateId)(),
                source: `sem_${r.source}`,
                target: `sem_${r.target}`,
                relation: semRelation,
                strength: r.confidence ?? 0.8,
            });
        }
        return this.semanticGraph;
    }
    /** Step 3: Convert Semantic nodes into an Embedding vector space */
    semanticToEmbedding() {
        this.embeddingGraph = new level10_embedding_1.EmbeddingGraph();
        const dim = this.options.embeddingDim;
        for (const n of this.semanticGraph.nodes) {
            // Generate a deterministic embedding from the concept name
            const vector = this.nameToVector(n.concept, dim);
            this.embeddingGraph.addNode({
                id: `emb_${n.id}`,
                label: n.concept,
                vector,
                metadata: { semanticId: n.id, type: n.type },
            });
        }
        // Build KNN graph
        if (this.embeddingGraph.nodes.length > 1) {
            this.embeddingGraph.buildKNN(this.options.knnK);
        }
        return this.embeddingGraph;
    }
    /** Step 4: Build GraphRAG from KG + Embeddings */
    embeddingToGraphRAG(queryIntent) {
        this.graphRAG = new level11_graphrag_1.GraphRAGEngine(this.options.graphRAGConfig);
        // Add KG entities to GraphRAG
        const entityIdMap = new Map();
        for (const e of this.knowledgeGraph.entities) {
            this.graphRAG.addEntity(e.id, e.name, e.type);
            entityIdMap.set(e.id, e.id);
        }
        // Add KG relations to GraphRAG
        for (const r of this.knowledgeGraph.relations) {
            this.graphRAG.addRelation(r.source, r.target, r.type);
        }
        // Create chunks from embedding nodes
        for (const emb of this.embeddingGraph.nodes) {
            const semId = emb.metadata?.semanticId || '';
            const semNode = this.semanticGraph.getNode(semId.replace('sem_', ''));
            const relatedEntities = this.findRelatedEntities(semNode?.concept || emb.label);
            this.graphRAG.addChunk({
                id: `chunk_${emb.id}`,
                text: `${emb.label}: ${semNode?.definition || 'Semantic concept'} - ${this.getEntityDescriptions(relatedEntities)}`,
                source: 'knowledge-pipeline',
                embedding: emb.vector,
                entities: relatedEntities,
            });
        }
        // If we have a query, run retrieval
        if (queryIntent) {
            const qEmbedding = queryIntent.embedding || this.nameToVector(queryIntent.text, this.options.embeddingDim);
            const qEntities = queryIntent.entities || this.findRelatedEntities(queryIntent.text);
            const retrieved = this.graphRAG.retrieve(qEmbedding, qEntities);
            return {
                chunks: retrieved.chunks || [],
                entities: retrieved.entities || [],
                relations: retrieved.relations || [],
                context: retrieved.chunks ? retrieved.chunks.map((c) => c.text).join('\n') : '',
                answer: `Retrieved ${retrieved.chunks?.length || 0} chunks from ${retrieved.entities?.length || 0} entities.`,
                confidence: (retrieved.chunks?.length || 0) > 0 ? Math.min(1, (retrieved.entities?.length || 0) / 10) : 0,
                trace: [`Vector similarity: top ${this.options.graphRAGConfig.topK || 5}`, `KG traversal: depth ${this.options.graphRAGConfig.walkDepth || 2}`],
            };
        }
        // Return empty result
        return {
            chunks: [],
            entities: [],
            relations: [],
            context: '',
            answer: 'No query provided. Call answer() with a query.',
            confidence: 0,
            trace: ['Pipeline built, no query executed'],
        };
    }
    /** End-to-end: seed data -> KG -> Semantic -> Embedding -> GraphRAG */
    runPipeline(entities, relations, query) {
        this.buildKnowledgeGraph(entities, relations);
        this.knowledgeToSemantic();
        this.semanticToEmbedding();
        const ragResult = this.embeddingToGraphRAG(query);
        return {
            query: query?.text || '',
            knowledgeGraph: this.knowledgeGraph,
            semanticGraph: this.semanticGraph,
            embeddingGraph: this.embeddingGraph,
            graphRAG: this.graphRAG,
            ragResult,
            metrics: {
                l8: this.knowledgeGraph.metrics(),
                l9: this.semanticGraph.metrics(),
                l10: this.embeddingGraph.metrics(),
                l11: this.graphRAG.metrics(),
            },
        };
    }
    /** Build demo data and run full pipeline */
    buildDemo() {
        this.knowledgeGraph.buildAIEcosystem();
        this.knowledgeToSemantic();
        this.semanticToEmbedding();
        // Set up GraphRAG with the KG data
        for (const e of this.knowledgeGraph.entities) {
            this.graphRAG.addEntity(e.id, e.name, e.type);
        }
        for (const r of this.knowledgeGraph.relations) {
            this.graphRAG.addRelation(r.source, r.target, r.type);
        }
        // Create chunks from embedding nodes
        for (const emb of this.embeddingGraph.nodes) {
            const semId = emb.metadata?.semanticId || '';
            const semNode = this.semanticGraph.getNode(semId.replace('sem_', ''));
            this.graphRAG.addChunk({
                id: `chunk_${emb.id}`,
                text: `${emb.label}: ${semNode?.definition || 'AI concept'}`,
                source: 'demo',
                embedding: emb.vector,
                entities: [this.findMatchingEntityId(emb.label)],
            });
        }
        // Run a default query
        return {
            query: 'Tell me about AI models',
            knowledgeGraph: this.knowledgeGraph,
            semanticGraph: this.semanticGraph,
            embeddingGraph: this.embeddingGraph,
            graphRAG: this.graphRAG,
            ragResult: {
                chunks: this.graphRAG.chunks,
                entities: this.graphRAG.entities.map(e => e.name),
                relations: this.graphRAG.relations.map(r => ({ source: r.source, target: r.target, relation: r.type })),
                context: this.graphRAG.chunks.map(c => c.text).join('\n'),
                answer: `Pipeline built with ${this.knowledgeGraph.entities.length} entities, ${this.semanticGraph.nodes.length} semantic nodes, ${this.embeddingGraph.nodes.length} embeddings, ${this.graphRAG.chunks.length} chunks.`,
                confidence: 0.9,
                trace: [
                    `KG: ${this.knowledgeGraph.entities.length} entities, ${this.knowledgeGraph.relations.length} relations`,
                    `Semantic: ${this.semanticGraph.nodes.length} nodes, ${this.semanticGraph.edges.length} edges`,
                    `Embedding: ${this.embeddingGraph.nodes.length} nodes, ${this.embeddingGraph.edges.length} edges`,
                    `GraphRAG: ${this.graphRAG.chunks.length} chunks, ${this.graphRAG.entities.length} entities`,
                ],
            },
            metrics: {
                l8: this.knowledgeGraph.metrics(),
                l9: this.semanticGraph.metrics(),
                l10: this.embeddingGraph.metrics(),
                l11: this.graphRAG.metrics(),
            },
        };
    }
    /** Answer a query through the full pipeline */
    async answerQuery(query) {
        const qEmbedding = query.embedding || this.nameToVector(query.text, this.options.embeddingDim);
        const qEntities = query.entities || this.findRelatedEntities(query.text);
        const result = await this.graphRAG.answer(query.text, qEmbedding, qEntities);
        return {
            chunks: result.chunks,
            entities: result.entities,
            relations: result.relationships,
            context: result.context,
            answer: result.answer,
            confidence: result.confidence,
            trace: result.trace,
        };
    }
    /** Access underlying engines */
    getKnowledgeGraph() { return this.knowledgeGraph; }
    getSemanticGraph() { return this.semanticGraph; }
    getEmbeddingGraph() { return this.embeddingGraph; }
    getGraphRAG() { return this.graphRAG; }
    /** Validate all four graphs */
    validate() {
        return {
            l8: this.knowledgeGraph.validate(),
            l9: this.semanticGraph.validate(),
            l10: this.embeddingGraph.validate(),
            l11: this.graphRAG.validate(),
        };
    }
    /** Metrics for all four graphs */
    metrics() {
        return {
            l8: this.knowledgeGraph.metrics(),
            l9: this.semanticGraph.metrics(),
            l10: this.embeddingGraph.metrics(),
            l11: this.graphRAG.metrics(),
        };
    }
    // ===== Private Helpers =====
    nameToVector(name, dim) {
        // Deterministic hash-based embedding from name
        const vector = new Array(dim).fill(0);
        for (let i = 0; i < name.length; i++) {
            const code = name.charCodeAt(i);
            vector[i % dim] += (code % 100) / 100;
        }
        // Normalize
        const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
        if (mag > 0) {
            for (let i = 0; i < dim; i++)
                vector[i] /= mag;
        }
        return vector;
    }
    mapRelationType(kind) {
        const map = {
            created: 'requires',
            uses: 'requires',
            part_of: 'part_of',
            subclass_of: 'is_a',
            located_in: 'part_of',
            produced_by: 'requires',
            has: 'has_property',
            related_to: 'related_to',
        };
        return map[kind] || 'related_to';
    }
    findRelatedEntities(concept) {
        const lower = concept.toLowerCase();
        return this.knowledgeGraph.entities
            .filter(e => e.name.toLowerCase().includes(lower) || lower.includes(e.name.toLowerCase()))
            .map(e => e.id);
    }
    getEntityDescriptions(entityIds) {
        return entityIds
            .map(id => {
            const e = this.knowledgeGraph.getEntity(id);
            return e ? `${e.name} (${e.type})` : '';
        })
            .filter(Boolean)
            .join(', ');
    }
    findMatchingEntityId(label) {
        const lower = label.toLowerCase();
        const found = this.knowledgeGraph.entities.find(e => e.name.toLowerCase() === lower);
        return found?.id || 'unknown';
    }
}
exports.PipelineL8L9L10L11 = PipelineL8L9L10L11;
//# sourceMappingURL=pipeline-l8l9l10l11.js.map