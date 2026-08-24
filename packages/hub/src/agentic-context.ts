import { stableHash128 } from '@cos/core';
import {
  AuthorityGraphRAGIndex,
  ContextPackCompiler,
  type AuthorityGraphChunk,
  type AuthorityGraphEntity,
  type AuthorityGraphRelation,
  type ContextPack,
  type ContextPackCompileRequest,
  type RetrievalSensitivity,
} from '@cos/graph';
import {
  AgenticResourceRegistry,
  type AgenticGraphScope,
  type AgenticResource,
  type AgenticRelation,
  type AgenticSensitivity,
} from './agentic-registry';

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): number[];
}

export interface AgenticContextProjectionOptions {
  version: number;
  scope?: AgenticGraphScope;
  /** Shared resources are included by default when projecting one project. */
  includeGlobal?: boolean;
  sourceCursor?: string;
  embeddingProvider?: EmbeddingProvider;
  includeResourceTypes?: AgenticResource['type'][];
}

export interface AgenticContextProjectionReport {
  version: number;
  projectionHash: string;
  sourceCursor?: string;
  embeddingProvider: string;
  entities: number;
  relations: number;
  chunks: number;
}

/**
 * Deterministic zero-cost fallback. This is lexical feature hashing, not a
 * semantic model. The provider name is persisted so no caller can mistake it
 * for a learned embedding. A local/remote embedding implementation may be
 * injected without changing projection or context contracts.
 */
export class LexicalHashEmbeddingProvider implements EmbeddingProvider {
  readonly name: string;

  constructor(readonly dimensions = 96) {
    if (!Number.isInteger(dimensions) || dimensions < 16 || dimensions > 4096) {
      throw new Error('Lexical hash embedding dimensions must be in [16,4096]');
    }
    this.name = `lexical-hash-v1-${dimensions}`;
  }

  embed(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    for (const token of tokenize(text)) {
      const digest = stableHash128(token);
      const index = Number.parseInt(digest.slice(0, 8), 16) % this.dimensions;
      const sign = (Number.parseInt(digest.slice(8, 10), 16) & 1) === 0 ? 1 : -1;
      vector[index] += sign * (1 + Math.min(3, token.length / 8));
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    return norm > 0 ? vector.map(value => value / norm) : vector;
  }
}

/** Projects the canonical AgenticResourceRegistry into authority retrieval. */
export class AgenticContextProjector {
  readonly index: AuthorityGraphRAGIndex;
  readonly compiler: ContextPackCompiler;
  private embeddingProvider: EmbeddingProvider;

  constructor(
    index = new AuthorityGraphRAGIndex(),
    embeddingProvider: EmbeddingProvider = new LexicalHashEmbeddingProvider(),
  ) {
    this.index = index;
    this.compiler = new ContextPackCompiler(index);
    this.embeddingProvider = embeddingProvider;
  }

  project(registry: AgenticResourceRegistry, options: AgenticContextProjectionOptions): AgenticContextProjectionReport {
    if (!Number.isInteger(options.version) || options.version < 1) {
      throw new Error('Agentic context projection version must be a positive integer');
    }
    const provider = options.embeddingProvider || this.embeddingProvider;
    const effectiveScope: AgenticGraphScope = {
      ...(options.scope || {}),
      includeGlobal: options.includeGlobal
        ?? options.scope?.includeGlobal
        ?? Boolean(options.scope?.projectId),
    };
    const include = options.includeResourceTypes ? new Set(options.includeResourceTypes) : null;
    const resources = registry.listResources(effectiveScope)
      .filter(resource => !include || include.has(resource.type));
    const resourceIds = new Set(resources.map(resource => resource.id));
    const relations = registry.listRelations(effectiveScope)
      .filter(relation => resourceIds.has(relation.from) && resourceIds.has(relation.to));

    const entities: AuthorityGraphEntity[] = resources.map(resource => ({
      id: resource.id,
      name: resource.title,
      type: resource.type,
      projectId: resource.projectId,
      sensitivity: toRetrievalSensitivity(resource.sensitivity),
      provenanceRef: resource.provenanceRef,
      validFrom: resource.validFrom,
      validUntil: resource.validUntil,
      recordedAt: resource.recordedAt,
      metadata: {
        canonicalUri: resource.canonicalUri,
        status: resource.status,
        observedAt: resource.observedAt || null,
        revision: resource.revision,
        contentHash: resource.contentHash,
        ...structuredClone(resource.metadata),
      },
    }));

    const graphRelations: AuthorityGraphRelation[] = relations.map(relation => ({
      id: relation.id,
      source: relation.from,
      target: relation.to,
      type: relation.type,
      projectId: relation.projectId,
      sensitivity: toRetrievalSensitivity(relation.sensitivity),
      provenanceRef: relation.provenanceRef,
      confidence: relation.confidence,
      validFrom: relation.validFrom,
      validUntil: relation.validUntil,
      recordedAt: relation.recordedAt,
      metadata: {
        revision: relation.revision,
        contentHash: relation.contentHash,
        ...structuredClone(relation.metadata),
      },
    }));

    const chunks: AuthorityGraphChunk[] = resources.map(resource => {
      const text = renderResourceEvidence(resource, relations);
      return {
        id: `achunk_${stableHash128({ resourceId: resource.id, contentHash: resource.contentHash, text })}`,
        text,
        source: resource.canonicalUri,
        embedding: provider.embed(text),
        entities: [resource.id, ...neighborIds(resource.id, relations)].sort(),
        projectId: resource.projectId,
        sensitivity: toRetrievalSensitivity(resource.sensitivity),
        provenanceRef: resource.provenanceRef,
        authority: authorityFor(resource),
        validFrom: resource.validFrom,
        validUntil: resource.validUntil,
        recordedAt: resource.recordedAt,
        metadata: {
          resourceType: resource.type,
          status: resource.status,
          revision: resource.revision,
          contentHash: resource.contentHash,
          embeddingProvider: provider.name,
        },
      };
    });

    const snapshot = this.index.replaceProjection({
      version: options.version,
      sourceCursor: options.sourceCursor,
      entities,
      relations: graphRelations,
      chunks,
      metadata: {
        scope: structuredClone(effectiveScope),
        embeddingProvider: provider.name,
        registryHash: registry.projectionHash(effectiveScope),
      },
    });
    this.embeddingProvider = provider;

    return {
      version: snapshot.version,
      projectionHash: snapshot.projectionHash,
      sourceCursor: snapshot.sourceCursor,
      embeddingProvider: provider.name,
      entities: snapshot.entities.length,
      relations: snapshot.relations.length,
      chunks: snapshot.chunks.length,
    };
  }

  compile(
    request: Omit<ContextPackCompileRequest, 'queryEmbedding' | 'projectionVersion'> & { queryEmbedding?: number[] },
  ): ContextPack {
    const queryEmbedding = request.queryEmbedding || this.embeddingProvider.embed(request.task);
    return this.compiler.compile({
      ...request,
      queryEmbedding,
      projectionVersion: this.index.projectionVersion,
      expectedProjectionHash: request.expectedProjectionHash || this.index.projectionHash,
    });
  }
}

function renderResourceEvidence(resource: AgenticResource, relations: AgenticRelation[]): string {
  const relevant = relations
    .filter(relation => relation.from === resource.id || relation.to === resource.id)
    .map(relation => ({
      direction: relation.from === resource.id ? 'out' : 'in',
      type: relation.type,
      peer: relation.from === resource.id ? relation.to : relation.from,
      confidence: relation.confidence,
      revision: relation.revision,
    }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.peer.localeCompare(b.peer));

  return [
    `TYPE: ${resource.type}`,
    `TITLE: ${resource.title}`,
    `STATUS: ${resource.status}`,
    `REVISION: ${resource.revision}`,
    `CONTENT_HASH: ${resource.contentHash}`,
    `CANONICAL_URI: ${resource.canonicalUri}`,
    `PROJECT: ${resource.projectId || 'GLOBAL'}`,
    `PROVENANCE: ${resource.provenanceRef}`,
    `METADATA: ${JSON.stringify(stableMetadata(resource.metadata))}`,
    `RELATIONS: ${JSON.stringify(relevant)}`,
  ].join('\n');
}

function authorityFor(resource: AgenticResource): number {
  const base: Record<AgenticResource['type'], number> = {
    portfolio: 0.95, program: 0.94, project: 1.0, workstream: 0.90,
    chat: 0.65, session: 0.70, agent_run: 0.78, task: 0.95,
    decision: 1.0, artifact: 0.90, memory: 0.82, source: 0.92,
    repository: 0.92, commit: 0.94, pull_request: 0.90,
    checkpoint: 0.98, risk: 0.94, release_gate: 0.98,
  };
  const statusPenalty = ['deleted', 'retracted', 'superseded', 'stale'].includes(resource.status.toLowerCase()) ? 0.25 : 0;
  return Math.max(0, base[resource.type] - statusPenalty);
}

function neighborIds(resourceId: string, relations: AgenticRelation[]): string[] {
  return Array.from(new Set(relations.flatMap(relation => {
    if (relation.from === resourceId) return [relation.to];
    if (relation.to === resourceId) return [relation.from];
    return [];
  })));
}

function toRetrievalSensitivity(value: AgenticSensitivity): RetrievalSensitivity { return value; }

function stableMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(metadata).sort().map(key => [key, structuredClone(metadata[key])]));
}

function tokenize(text: string): string[] {
  return text.normalize('NFKC').toLowerCase()
    .split(/[^\p{L}\p{N}_:/.-]+/u)
    .map(token => token.trim())
    .filter(token => token.length >= 2)
    .slice(0, 20_000);
}
