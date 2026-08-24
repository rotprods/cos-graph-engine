import { stableHash128, stableSerialize } from '@cos/core';
import {
  AuthorityGraphRAGEngine,
  ContextPackCompiler,
  type ContextPack,
  type ContextPackCompileRequest,
  type GraphRAGConfig,
  type RetrievalSensitivity,
} from '@cos/graph';
import {
  AgenticResourceRegistry,
  type AgenticGraphScope,
  type AgenticResource,
  type AgenticSensitivity,
} from './agentic-registry';

export interface TextEmbeddingProvider {
  readonly id: string;
  embed(text: string): number[];
}

/**
 * Zero-cost deterministic lexical fallback.
 *
 * This is intentionally not described as a semantic embedding model. It gives
 * reproducible lexical feature vectors for cold-start/local operation and can be
 * replaced by a real embedding provider without changing projection contracts.
 */
export class FeatureHashEmbedding implements TextEmbeddingProvider {
  readonly id: string;

  constructor(private readonly dimensions = 256) {
    if (!Number.isInteger(dimensions) || dimensions < 32 || dimensions > 4096) {
      throw new Error('FeatureHashEmbedding dimensions must be an integer in [32,4096]');
    }
    this.id = `feature-hash-v1-${dimensions}`;
  }

  embed(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = text.toLowerCase().match(/[\p{L}\p{N}_:/.-]+/gu) || [];
    for (const token of tokens) {
      const hash = stableHash128(token);
      const bucket = Number.parseInt(hash.slice(0, 8), 16) % this.dimensions;
      const sign = Number.parseInt(hash.slice(8, 10), 16) % 2 === 0 ? 1 : -1;
      vector[bucket] += sign;
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    return norm > 0 ? vector.map(value => value / norm) : vector;
  }
}

export interface AgenticContextProjectionOptions {
  scope: AgenticGraphScope & { projectId: string };
  embeddingProvider?: TextEmbeddingProvider;
  graphRagConfig?: Partial<GraphRAGConfig>;
  maxResourceTextLength?: number;
}

export interface AgenticContextProjection {
  engine: AuthorityGraphRAGEngine;
  embeddingProviderId: string;
  sourceProjectionHash: string;
  retrievalProjectionHash: string;
  projectionVersion: number;
  resourceCount: number;
  relationCount: number;
  chunkCount: number;
}

export interface CompileAgenticContextRequest {
  projectId: string;
  task: string;
  permission?: AgenticSensitivity;
  asOf?: string;
  maxTokens?: number;
  minScore?: number;
  allowGlobal?: boolean;
  expectedSourceProjectionHash?: string;
  generatedAt?: string;
  embeddingProvider?: TextEmbeddingProvider;
  graphRagConfig?: Partial<GraphRAGConfig>;
}

/**
 * Projects the canonical agentic topology into an authority GraphRAG projection
 * and compiles bounded context for one project/task.
 */
export class AgenticContextProjector {
  constructor(private readonly registry: AgenticResourceRegistry) {}

  project(options: AgenticContextProjectionOptions): AgenticContextProjection {
    const projectId = options.scope.projectId.trim();
    if (!projectId) throw new Error('Agentic context projection requires projectId');
    const maxResourceTextLength = options.maxResourceTextLength ?? 12_000;
    if (!Number.isInteger(maxResourceTextLength) || maxResourceTextLength < 256 || maxResourceTextLength > 100_000) {
      throw new Error('maxResourceTextLength must be an integer in [256,100000]');
    }

    const provider = options.embeddingProvider || new FeatureHashEmbedding();
    const engine = new AuthorityGraphRAGEngine(options.graphRagConfig);
    const resources = this.registry.listResources(options.scope);
    const visibleIds = new Set(resources.map(resource => resource.id));
    const relations = this.registry.listRelations(options.scope)
      .filter(relation => visibleIds.has(relation.from) && visibleIds.has(relation.to));

    for (const resource of resources) {
      engine.addEntity({
        id: resource.id,
        name: resource.title,
        type: resource.type,
        projectId: resource.projectId,
        sensitivity: resource.sensitivity,
      });

      const text = renderResource(resource).slice(0, maxResourceTextLength);
      engine.upsertChunk({
        id: `achunk_${stableHash128(resource.canonicalUri)}`,
        text,
        source: resource.canonicalUri,
        embedding: provider.embed(text),
        entities: [resource.id],
        projectId: resource.projectId,
        sensitivity: resource.sensitivity,
        provenanceRef: resource.provenanceRef,
        authority: authorityFor(resource),
        validFrom: resource.validFrom,
        validUntil: resource.validUntil,
        recordedAt: resource.recordedAt,
      });
    }

    for (const relation of relations) {
      engine.addRelation({
        source: relation.from,
        target: relation.to,
        type: relation.type,
        projectId: relation.projectId,
        sensitivity: relation.sensitivity,
        provenanceRef: relation.provenanceRef,
        confidence: relation.confidence,
        validFrom: relation.validFrom,
        validUntil: relation.validUntil,
        recordedAt: relation.recordedAt,
      });
    }

    const errors = engine.validate();
    if (errors.length > 0) {
      throw new Error(`AGENTIC_CONTEXT_PROJECTION_INVALID: ${errors.join('; ')}`);
    }

    return {
      engine,
      embeddingProviderId: provider.id,
      sourceProjectionHash: this.registry.projectionHash(options.scope),
      retrievalProjectionHash: engine.projectionHash(),
      projectionVersion: engine.getProjectionVersion(),
      resourceCount: resources.length,
      relationCount: relations.length,
      chunkCount: engine.listChunks().length,
    };
  }

  async compileVerified(request: CompileAgenticContextRequest): Promise<{
    pack: ContextPack;
    projection: Omit<AgenticContextProjection, 'engine'>;
  }> {
    const permission = request.permission || 'internal';
    const projection = this.project({
      scope: {
        projectId: request.projectId,
        maxSensitivity: permission,
        asOf: request.asOf,
      },
      embeddingProvider: request.embeddingProvider,
      graphRagConfig: request.graphRagConfig,
    });

    if (
      request.expectedSourceProjectionHash !== undefined
      && request.expectedSourceProjectionHash !== projection.sourceProjectionHash
    ) {
      throw new Error(
        `STALE_AGENTIC_SOURCE_GRAPH expected=${request.expectedSourceProjectionHash} current=${projection.sourceProjectionHash}`,
      );
    }

    const provider = request.embeddingProvider || new FeatureHashEmbedding();
    if (provider.id !== projection.embeddingProviderId) {
      throw new Error(
        `EMBEDDING_PROVIDER_DRIFT projected=${projection.embeddingProviderId} compile=${provider.id}`,
      );
    }

    const compiler = new ContextPackCompiler(projection.engine);
    const compileRequest: ContextPackCompileRequest = {
      projectId: request.projectId,
      task: request.task,
      queryEmbedding: provider.embed(request.task),
      permission: permission as RetrievalSensitivity,
      asOf: request.asOf,
      generatedAt: request.generatedAt,
      projectionVersion: projection.projectionVersion,
      expectedProjectionVersion: projection.projectionVersion,
      projectionHash: projection.retrievalProjectionHash,
      expectedProjectionHash: projection.retrievalProjectionHash,
      maxTokens: request.maxTokens,
      minScore: request.minScore,
      allowGlobal: request.allowGlobal,
    };
    const pack = await compiler.compileVerified(compileRequest);
    const { engine: _engine, ...report } = projection;
    return { pack, projection: report };
  }
}

function renderResource(resource: AgenticResource): string {
  return [
    `TYPE: ${resource.type}`,
    `TITLE: ${resource.title}`,
    `STATUS: ${resource.status}`,
    `CANONICAL_URI: ${resource.canonicalUri}`,
    `PROJECT: ${resource.projectId || 'global'}`,
    `SENSITIVITY: ${resource.sensitivity}`,
    `PROVENANCE: ${resource.provenanceRef}`,
    `VALID_FROM: ${resource.validFrom || 'unspecified'}`,
    `VALID_UNTIL: ${resource.validUntil || 'current'}`,
    `OBSERVED_AT: ${resource.observedAt || 'unspecified'}`,
    `RECORDED_AT: ${resource.recordedAt}`,
    `METADATA: ${stableSerialize(resource.metadata)}`,
  ].join('\n');
}

function authorityFor(resource: AgenticResource): number {
  const byType: Partial<Record<AgenticResource['type'], number>> = {
    decision: 1,
    release_gate: 1,
    task: 0.95,
    risk: 0.95,
    source: 0.9,
    artifact: 0.88,
    checkpoint: 0.88,
    project: 0.85,
    repository: 0.82,
    pull_request: 0.8,
    commit: 0.78,
    memory: 0.72,
    agent_run: 0.68,
    session: 0.62,
    chat: 0.58,
  };
  return byType[resource.type] ?? 0.7;
}