import { stableHash128, stableSerialize } from '@cos/core';
import {
  VerifiedAuthorityGraphRAGEngine,
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
import { FeatureHashEmbedding, type TextEmbeddingProvider } from './context-projector';

export interface VerifiedAgenticProjectionOptions {
  scope: AgenticGraphScope & { projectId: string };
  embeddingProvider?: TextEmbeddingProvider;
  graphRagConfig?: Partial<GraphRAGConfig>;
  maxResourceTextLength?: number;
}

export interface VerifiedAgenticProjection {
  engine: VerifiedAuthorityGraphRAGEngine;
  embeddingProviderId: string;
  sourceProjectionHash: string;
  retrievalProjectionHash: string;
  projectionVersion: number;
  resourceCount: number;
  relationCount: number;
  chunkCount: number;
}

export interface VerifiedCompileRequest {
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
 * Authority-only projector used for W13 qualification and later cutover.
 * Every projected relation must carry a source recordedAt timestamp, so replay
 * never synthesizes wall-clock time while reconstructing retrieval topology.
 */
export class VerifiedAgenticContextProjector {
  constructor(private readonly registry: AgenticResourceRegistry) {}

  project(options: VerifiedAgenticProjectionOptions): VerifiedAgenticProjection {
    const projectId = options.scope.projectId.trim();
    if (!projectId) throw new Error('Verified projection requires projectId');
    const maxText = options.maxResourceTextLength ?? 12_000;
    if (!Number.isInteger(maxText) || maxText < 256 || maxText > 100_000) {
      throw new Error('maxResourceTextLength must be an integer in [256,100000]');
    }

    const provider = options.embeddingProvider || new FeatureHashEmbedding();
    const engine = new VerifiedAuthorityGraphRAGEngine(options.graphRagConfig);
    const resources = this.registry.listResources(options.scope);
    const visibleIds = new Set(resources.map(resource => resource.id));
    const relations = this.registry.listRelations(options.scope)
      .filter(relation => visibleIds.has(relation.from) && visibleIds.has(relation.to));

    for (const resource of resources) {
      if (!resource.provenanceRef.trim()) throw new Error(`Resource ${resource.id} lacks provenance`);
      if (!resource.recordedAt || !Number.isFinite(Date.parse(resource.recordedAt))) {
        throw new Error(`Resource ${resource.id} lacks valid recordedAt`);
      }
      engine.addEntity({
        id: resource.id,
        name: resource.title,
        type: resource.type,
        projectId: resource.projectId,
        sensitivity: resource.sensitivity,
      });
      const text = renderResource(resource).slice(0, maxText);
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
        recordedAt: new Date(resource.recordedAt).toISOString(),
      });
    }

    for (const relation of relations) {
      if (!relation.recordedAt || !Number.isFinite(Date.parse(relation.recordedAt))) {
        throw new Error(`Relation ${relation.id} lacks valid recordedAt`);
      }
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
        recordedAt: new Date(relation.recordedAt).toISOString(),
      });
    }

    const errors = engine.validate();
    if (errors.length) throw new Error(`VERIFIED_AGENTIC_PROJECTION_INVALID: ${errors.join('; ')}`);

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

  async compileVerified(request: VerifiedCompileRequest): Promise<{
    pack: ContextPack;
    projection: Omit<VerifiedAgenticProjection, 'engine'>;
  }> {
    const permission = request.permission || 'internal';
    const provider = request.embeddingProvider || new FeatureHashEmbedding();
    const projection = this.project({
      scope: { projectId: request.projectId, maxSensitivity: permission, asOf: request.asOf },
      embeddingProvider: provider,
      graphRagConfig: request.graphRagConfig,
    });

    if (request.expectedSourceProjectionHash !== undefined
      && request.expectedSourceProjectionHash !== projection.sourceProjectionHash) {
      throw new Error(`STALE_AGENTIC_SOURCE_GRAPH expected=${request.expectedSourceProjectionHash} current=${projection.sourceProjectionHash}`);
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
