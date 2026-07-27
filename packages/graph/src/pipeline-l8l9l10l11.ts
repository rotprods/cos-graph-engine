// ================================================================
// PIPELINE L8 -> L9 -> L10 -> L11
// Cross-level integration: Knowledge -> Semantic -> Embedding -> GraphRAG
// Fase 8: Integracion Cruzada
// ================================================================

import { KnowledgeGraphEngine, KGEntity, KGRelation, RelationType } from './level8-knowledge';
import { SemanticGraph, SemanticNode, SemanticEdge } from './level9-semantic';
import { EmbeddingGraph, EmbeddingNode, EmbeddingEdge } from './level10-embedding';
import { GraphRAGEngine, Chunk, GraphRAGConfig } from './level11-graphrag';
import { generateId } from '@cos/core';

// ===== Pipeline Query Types =====

export interface QueryIntent {
  text: string;
  entities?: string[];
  embedding?: number[];
  topK?: number;
  walkDepth?: number;
}

export interface PipelineKGtoRAGResult {
  query: string;
  knowledgeGraph: KnowledgeGraphEngine;
  semanticGraph: SemanticGraph;
  embeddingGraph: EmbeddingGraph;
  ragResult: {
    chunks: Chunk[];
    entities: string[];
    relations: Array<{ source: string; target: string; relation: string }>;
    context: string;
    answer: string;
    confidence: number;
    trace: string[];
  };
  metrics: {
    l8: { nodeCount: number; edgeCount: number; density: number };
    l9: { nodeCount: number; edgeCount: number; density: number };
    l10: { nodeCount: number; edgeCount: number; avgDegree: number };
    l11: { entityCount: number; chunkCount: number; relationCount: number };
  };
}

// ===== Pipeline Options =====

export interface PipelineKGtoRAGOptions {
  /** Embedding dimension for vector conversion */
  embeddingDim?: number;
  /** KNN parameter for embedding graph */
  knnK?: number;
  /** Default GraphRAG config */
  graphRAGConfig?: Partial<GraphRAGConfig>;
  /** Auto-build demo data if empty */
  autoBuildDemo?: boolean;
}

// ===== Pipeline L8 -> L9 -> L10 -> L11 =====

export class PipelineL8L9L10L11 {
  knowledgeGraph: KnowledgeGraphEngine;
  semanticGraph: SemanticGraph;
  embeddingGraph: EmbeddingGraph;
  graphRAG: GraphRAGEngine;
  private options: Required<PipelineKGtoRAGOptions>;

  constructor(options?: PipelineKGtoRAGOptions) {
    this.knowledgeGraph = new KnowledgeGraphEngine();
    this.semanticGraph = new SemanticGraph();
    this.embeddingGraph = new EmbeddingGraph();
    this.graphRAG = new GraphRAGEngine(options?.graphRAGConfig);
    this.options = {
      embeddingDim: options?.embeddingDim ?? 8,
      knnK: options?.knnK ?? 3,
      graphRAGConfig: options?.graphRAGConfig ?? {},
      autoBuildDemo: options?.autoBuildDemo ?? false,
    };
  }

  /** Step 1: Build Knowledge Graph from entity/relation seed data */
  buildKnowledgeGraph(entities: KGEntity[], relations: KGRelation[]): void {
    for (const e of entities) {
      this.knowledgeGraph.addEntity(e);
    }
    for (const r of relations) {
      this.knowledgeGraph.addRelation(r);
    }
  }

  /** Step 2: Convert KG entities into a Semantic taxonomy */
  knowledgeToSemantic(): SemanticGraph {
    this.semanticGraph = new SemanticGraph();

    // Map entity types to semantic classes
    const typeMap: Record<string, string> = {
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
        type: semType as SemanticNode['type'],
        definition: e.description,
      });
    }

    // Create semantic edges from KG relations
    for (const r of this.knowledgeGraph.relations) {
      const semRelation = this.mapRelationType(r.type);
      this.semanticGraph.addEdge({
        id: generateId(),
        source: `sem_${r.source}`,
        target: `sem_${r.target}`,
        relation: semRelation,
        strength: r.confidence ?? 0.8,
      });
    }

    return this.semanticGraph;
  }

  /** Step 3: Convert Semantic nodes into an Embedding vector space */
  semanticToEmbedding(): EmbeddingGraph {
    this.embeddingGraph = new EmbeddingGraph();
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
  embeddingToGraphRAG(queryIntent?: QueryIntent): PipelineKGtoRAGResult['ragResult'] {
    this.graphRAG = new GraphRAGEngine(this.options.graphRAGConfig);

    // Add KG entities to GraphRAG
    const entityIdMap = new Map<string, string>();
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
      const semId = (emb.metadata?.semanticId as string) || '';
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
      const retrieved = this.graphRAG.retrieve(qEmbedding, qEntities) as any;
      return {
        chunks: retrieved.chunks || [],
        entities: retrieved.entities || [],
        relations: retrieved.relations || [],
        context: retrieved.chunks ? retrieved.chunks.map((c: any) => c.text).join('\n') : '',
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
  runPipeline(
    entities: KGEntity[],
    relations: KGRelation[],
    query?: QueryIntent
  ): PipelineKGtoRAGResult {
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
  buildDemo(): PipelineKGtoRAGResult {
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
      const semId = (emb.metadata?.semanticId as string) || '';
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
  async answerQuery(query: QueryIntent): Promise<PipelineKGtoRAGResult['ragResult']> {
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
  getKnowledgeGraph(): KnowledgeGraphEngine { return this.knowledgeGraph; }
  getSemanticGraph(): SemanticGraph { return this.semanticGraph; }
  getEmbeddingGraph(): EmbeddingGraph { return this.embeddingGraph; }
  getGraphRAG(): GraphRAGEngine { return this.graphRAG; }

  /** Validate all four graphs */
  validate(): { l8: string[]; l9: string[]; l10: string[]; l11: string[] } {
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

  private nameToVector(name: string, dim: number): number[] {
    // Deterministic hash-based embedding from name
    const vector: number[] = new Array(dim).fill(0);
    for (let i = 0; i < name.length; i++) {
      const code = name.charCodeAt(i);
      vector[i % dim] += (code % 100) / 100;
    }
    // Normalize
    const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    if (mag > 0) {
      for (let i = 0; i < dim; i++) vector[i] /= mag;
    }
    return vector;
  }

  private mapRelationType(kind: string): SemanticEdge['relation'] {
    const map: Record<string, SemanticEdge['relation']> = {
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

  private findRelatedEntities(concept: string): string[] {
    const lower = concept.toLowerCase();
    return this.knowledgeGraph.entities
      .filter(e => e.name.toLowerCase().includes(lower) || lower.includes(e.name.toLowerCase()))
      .map(e => e.id);
  }

  private getEntityDescriptions(entityIds: string[]): string {
    return entityIds
      .map(id => {
        const e = this.knowledgeGraph.getEntity(id);
        return e ? `${e.name} (${e.type})` : '';
      })
      .filter(Boolean)
      .join(', ');
  }

  private findMatchingEntityId(label: string): string {
    const lower = label.toLowerCase();
    const found = this.knowledgeGraph.entities.find(e => e.name.toLowerCase() === lower);
    return found?.id || 'unknown';
  }
}