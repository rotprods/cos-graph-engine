import { stableHash128, stableSerialize } from '@cos/core';
import {
  AuthorityContextPackCompiler,
  AuthorityGraphRAGIndex,
  type AuthorityContextPack,
  type AuthorityGraphRAGConfig,
} from '@cos/graph';
import {
  AuthorityAgenticRegistry,
  type AuthorityAgenticRelation,
  type AuthorityAgenticResource,
} from './authority-agentic-registry';
import type { AgenticResourceType, AgenticSensitivity } from './agentic-registry';

export interface AuthorityTextEmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  embed(text: string): number[];
}

/**
 * Zero-cost deterministic lexical fallback. It is deliberately not marketed as
 * a semantic embedding model; production deployments can inject a stronger provider.
 */
export class AuthorityFeatureHashEmbedding implements AuthorityTextEmbeddingProvider {
  readonly id = 'feature-hash-v1';

  constructor(readonly dimensions = 256) {
    if (!Number.isSafeInteger(dimensions) || dimensions < 32 || dimensions > 4096) {
      throw new Error('Feature-hash dimensions must be a safe integer in [32,4096]');
    }
  }

  embed(text: string): number[] {
    const normalized = text.normalize('NFKC').toLocaleLowerCase('en-US');
    const tokens = normalized.match(/[\p{L}\p{N}_-]+/gu) ?? [];
    const vector = new Array<number>(this.dimensions).fill(0);
    for (const token of tokens) {
      const hash = stableHash128(token);
      const bucket = Number.parseInt(hash.slice(0, 8), 16) % this.dimensions;
      const sign = (Number.parseInt(hash.slice(8, 10), 16) & 1) === 0 ? 1 : -1;
      vector[bucket] += sign;
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (norm === 0) return vector;
    return vector.map(value => value / norm);
  }
}

export interface AuthorityContextProjectionOptions {
  projectId: string;
  asOf: string;
  knownAt: string;
  maxSensitivity?: AgenticSensitivity;
  includeGlobal?: boolean;
  embeddingProvider?: AuthorityTextEmbeddingProvider;
  graphConfig?: Partial<AuthorityGraphRAGConfig>;
  maxResourceTextLength?: number;
}

export interface AuthorityContextProjectionReport {
  projectId: string;
  asOf: string;
  knownAt: string;
  maxSensitivity: AgenticSensitivity;
  sourceProjectionVersion: number;
  sourceProjectionHash: string;
  retrievalProjectionVersion: number;
  retrievalProjectionHash: string;
  embeddingProviderId: string;
  resourceCount: number;
  relationCount: number;
  chunkCount: number;
}

export interface AuthorityCompileProjectContextRequest extends AuthorityContextProjectionOptions {
  task: string;
  generatedAt: string;
  maxTokens?: number;
  minScore?: number;
  expectedSourceProjectionVersion?: number;
  expectedSourceProjectionHash?: string;
}

/**
 * Canonical AGENTIC topology → GraphRAG → verified ContextPack bridge.
 *
 * Source scope is applied by `AuthorityAgenticRegistry` before projection, then
 * independently re-enforced by `AuthorityGraphRAGIndex` and
 * `AuthorityContextPackCompiler`. This intentional defense-in-depth prevents a
 * future projector regression from turning post-prompt filtering into the only
 * privacy boundary.
 */
export class AuthorityHubContextProjector {
  constructor(private readonly registry: AuthorityAgenticRegistry) {}

  project(options: AuthorityContextProjectionOptions): {
    index: AuthorityGraphRAGIndex;
    provider: AuthorityTextEmbeddingProvider;
    report: AuthorityContextProjectionReport;
  } {
    const projectId = nonEmpty(options.projectId, 'projectId');
    const asOf = canonicalTime(options.asOf, 'asOf');
    const knownAt = canonicalTime(options.knownAt, 'knownAt');
    const maxSensitivity = options.maxSensitivity ?? 'internal';
    const includeGlobal = options.includeGlobal ?? true;
    const maxText = options.maxResourceTextLength ?? 12_000;
    if (!Number.isSafeInteger(maxText) || maxText < 256 || maxText > 100_000) {
      throw new Error('maxResourceTextLength must be a safe integer in [256,100000]');
    }
    if (this.registry.projectionVersion < 1) throw new Error('AGENTIC_AUTHORITY_PROJECTION_EMPTY');

    const provider = options.embeddingProvider ?? new AuthorityFeatureHashEmbedding();
    const scope = { projectId, asOf, knownAt, maxSensitivity, includeGlobal };
    const resources = this.registry.listResources(scope);
    const visibleIds = new Set(resources.map(resource => resource.id));
    const relations = this.registry.listRelations(scope)
      .filter(relation => visibleIds.has(relation.from) && visibleIds.has(relation.to));
    const sourceProjectionHash = this.registry.projectionHash(scope);
    const index = new AuthorityGraphRAGIndex(options.graphConfig);

    const entities = resources.map(resource => ({
      id: resource.id,
      name: resource.title,
      type: resource.type,
      projectId: resource.projectId,
      sensitivity: resource.sensitivity,
      provenanceRef: resource.provenanceRef,
      validFrom: resource.validFrom,
      validUntil: resource.validUntil,
      recordedAt: resource.systemFrom,
      metadata: {
        status: resource.status,
        revision: resource.revision,
        contentHash: resource.contentHash,
      },
    }));

    const chunks = resources.map(resource => {
      const text = renderResource(resource).slice(0, maxText);
      return {
        id: `achunk_${stableHash128({ id: resource.id, revision: resource.revision, contentHash: resource.contentHash })}`,
        text,
        source: resource.canonicalUri,
        embedding: provider.embed(text),
        entities: [resource.id],
        projectId: resource.projectId,
        sensitivity: resource.sensitivity,
        provenanceRef: resource.provenanceRef,
        authority: authorityFor(resource.type),
        validFrom: resource.validFrom,
        validUntil: resource.validUntil,
        recordedAt: resource.systemFrom,
        metadata: {
          resourceId: resource.id,
          resourceType: resource.type,
          revision: resource.revision,
          contentHash: resource.contentHash,
        },
      };
    });

    const graphRelations = relations.map(relation => relationToGraphInput(relation));
    const snapshot = index.replaceProjection({
      version: this.registry.projectionVersion,
      sourceCursor: `agentic-projection:${this.registry.projectionVersion}`,
      entities,
      relations: graphRelations,
      chunks,
      metadata: {
        projectId,
        asOf,
        knownAt,
        maxSensitivity,
        includeGlobal,
        sourceProjectionHash,
        embeddingProviderId: provider.id,
        embeddingDimensions: provider.dimensions,
      },
    }, {
      expectedCurrentVersion: 0,
      expectedCurrentHash: index.projectionHash,
    });

    const errors = index.validate();
    if (errors.length) throw new Error(`AUTHORITY_CONTEXT_PROJECTION_INVALID: ${errors.join('; ')}`);

    return {
      index,
      provider,
      report: {
        projectId,
        asOf,
        knownAt,
        maxSensitivity,
        sourceProjectionVersion: this.registry.projectionVersion,
        sourceProjectionHash,
        retrievalProjectionVersion: snapshot.version,
        retrievalProjectionHash: snapshot.projectionHash,
        embeddingProviderId: provider.id,
        resourceCount: resources.length,
        relationCount: relations.length,
        chunkCount: chunks.length,
      },
    };
  }

  async compileVerified(request: AuthorityCompileProjectContextRequest): Promise<{
    pack: AuthorityContextPack;
    projection: AuthorityContextProjectionReport;
  }> {
    const projection = this.project(request);
    if (request.expectedSourceProjectionVersion !== undefined
      && request.expectedSourceProjectionVersion !== projection.report.sourceProjectionVersion) {
      throw new Error(
        `STALE_AGENTIC_SOURCE_VERSION expected=${request.expectedSourceProjectionVersion} current=${projection.report.sourceProjectionVersion}`,
      );
    }
    if (request.expectedSourceProjectionHash !== undefined
      && request.expectedSourceProjectionHash !== projection.report.sourceProjectionHash) {
      throw new Error(
        `STALE_AGENTIC_SOURCE_HASH expected=${request.expectedSourceProjectionHash} current=${projection.report.sourceProjectionHash}`,
      );
    }

    const compiler = new AuthorityContextPackCompiler(projection.index);
    const pack = await compiler.compileVerified({
      projectId: projection.report.projectId,
      task: nonEmpty(request.task, 'task'),
      queryEmbedding: projection.provider.embed(request.task),
      permission: projection.report.maxSensitivity,
      asOf: projection.report.asOf,
      knownAt: projection.report.knownAt,
      generatedAt: canonicalTime(request.generatedAt, 'generatedAt'),
      expectedProjectionVersion: projection.report.retrievalProjectionVersion,
      expectedProjectionHash: projection.report.retrievalProjectionHash,
      maxTokens: request.maxTokens,
      minScore: request.minScore,
      allowGlobal: request.includeGlobal ?? true,
    });
    await compiler.verify(pack);
    return { pack, projection: projection.report };
  }
}

function relationToGraphInput(relation: AuthorityAgenticRelation) {
  return {
    id: relation.id,
    identityKey: relation.identityKey,
    source: relation.from,
    target: relation.to,
    type: relation.type,
    projectId: relation.projectId,
    sensitivity: relation.sensitivity,
    provenanceRef: relation.provenanceRef,
    confidence: relation.confidence,
    validFrom: relation.validFrom,
    validUntil: relation.validUntil,
    recordedAt: relation.systemFrom,
    metadata: {
      revision: relation.revision,
      contentHash: relation.contentHash,
    },
  };
}

function renderResource(resource: AuthorityAgenticResource): string {
  return [
    `TYPE: ${resource.type}`,
    `TITLE: ${resource.title}`,
    `STATUS: ${resource.status}`,
    `CANONICAL_URI: ${resource.canonicalUri}`,
    `PROJECT: ${resource.projectId ?? 'global'}`,
    `SENSITIVITY: ${resource.sensitivity}`,
    `PROVENANCE: ${resource.provenanceRef}`,
    `REVISION: ${resource.revision}`,
    `SYSTEM_FROM: ${resource.systemFrom}`,
    `SYSTEM_UNTIL: ${resource.systemUntil ?? 'current'}`,
    `VALID_FROM: ${resource.validFrom ?? 'unspecified'}`,
    `VALID_UNTIL: ${resource.validUntil ?? 'current'}`,
    `OBSERVED_AT: ${resource.observedAt ?? 'unspecified'}`,
    `METADATA: ${stableSerialize(resource.metadata)}`,
  ].join('\n');
}

function authorityFor(type: AgenticResourceType): number {
  const weights: Partial<Record<AgenticResourceType, number>> = {
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
  return weights[type] ?? 0.7;
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}
