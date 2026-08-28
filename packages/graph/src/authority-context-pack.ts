import { sha256Hex, stableHash128 } from '@cos/core';
import type { RetrievalSensitivity } from './level11-graphrag';
import type {
  AuthorityGraphChunk,
  AuthorityScopedRetriever,
} from './authority-graphrag-index';

const SENSITIVITY_ORDER: Record<RetrievalSensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

export interface AuthorityContextPackItem {
  chunkId: string;
  source: string;
  text: string;
  score: number;
  provenanceRef: string;
  authority: number;
  projectId?: string;
  sensitivity: RetrievalSensitivity;
  validFrom?: string;
  validUntil?: string | null;
  recordedAt: string;
}

export interface AuthorityContextPackDraft {
  schemaVersion: 1;
  id: string;
  projectId: string;
  task: string;
  generatedAt: string;
  asOf: string;
  knownAt: string;
  permission: RetrievalSensitivity;
  projectionVersion: number;
  projectionHash: string;
  maxTokens: number;
  estimatedTokens: number;
  items: AuthorityContextPackItem[];
  provenance: string[];
  context: string;
  evidenceHash: string;
}

export interface AuthorityContextPack extends AuthorityContextPackDraft {
  integrityAlgorithm: 'sha256';
  integrityHash: string;
}

export interface AuthorityContextPackCompileRequest {
  projectId: string;
  task: string;
  queryEmbedding: number[];
  queryEntities?: string[];
  permission?: RetrievalSensitivity;
  /** Required domain-valid cutoff. */
  asOf: string;
  /** Required system-knowledge cutoff. */
  knownAt: string;
  /** Required source/system timestamp for deterministic pack creation. */
  generatedAt: string;
  expectedProjectionVersion: number;
  expectedProjectionHash: string;
  maxTokens?: number;
  minScore?: number;
  allowGlobal?: boolean;
}

/**
 * Authority-only context compiler.
 *
 * The legacy `ContextPackCompiler` remains available for shadow compatibility.
 * This compiler accepts only an `AuthorityScopedRetriever`, fences both
 * projection version and hash, requires explicit timestamps, applies scope and
 * permission checks before rendering, and can seal the resulting evidence pack
 * with SHA-256.
 */
export class AuthorityContextPackCompiler {
  constructor(private readonly retriever: AuthorityScopedRetriever) {}

  compile(request: AuthorityContextPackCompileRequest): AuthorityContextPackDraft {
    const projectId = nonEmpty(request.projectId, 'ContextPack projectId');
    const task = nonEmpty(request.task, 'ContextPack task');
    const asOf = canonicalTime(request.asOf, 'ContextPack asOf');
    const knownAt = canonicalTime(request.knownAt, 'ContextPack knownAt');
    const generatedAt = canonicalTime(request.generatedAt, 'ContextPack generatedAt');
    const permission = request.permission ?? 'internal';
    const allowGlobal = request.allowGlobal ?? true;

    if (!Number.isSafeInteger(request.expectedProjectionVersion)
      || request.expectedProjectionVersion < 0) {
      throw new Error('expectedProjectionVersion must be a non-negative safe integer');
    }
    if (request.expectedProjectionVersion !== this.retriever.projectionVersion) {
      throw new Error(
        `STALE_CONTEXT_PROJECTION expected=${request.expectedProjectionVersion} current=${this.retriever.projectionVersion}`,
      );
    }
    const expectedHash = nonEmpty(request.expectedProjectionHash, 'expectedProjectionHash');
    if (expectedHash !== this.retriever.projectionHash) {
      throw new Error(
        `STALE_CONTEXT_PROJECTION_HASH expected=${expectedHash} current=${this.retriever.projectionHash}`,
      );
    }

    assertFiniteVector(request.queryEmbedding, 'queryEmbedding');
    const queryEntities = Array.from(new Set((request.queryEntities || []).map(entity => nonEmpty(entity, 'query entity'))))
      .sort();
    const maxTokens = request.maxTokens ?? 4_000;
    if (!Number.isSafeInteger(maxTokens) || maxTokens < 128 || maxTokens > 128_000) {
      throw new Error('ContextPack maxTokens must be a safe integer in [128,128000]');
    }
    const minScore = request.minScore ?? 0;
    if (!Number.isFinite(minScore) || minScore < 0 || minScore > 1) {
      throw new Error('ContextPack minScore must be in [0,1]');
    }

    const retrieved = this.retriever.retrieveScoped(
      [...request.queryEmbedding],
      queryEntities,
      {
        projectId,
        permission,
        asOf,
        knownAt,
        allowGlobal,
        minScore,
      },
    );

    const header = [
      `PROJECT: ${projectId}`,
      `TASK: ${task}`,
      `AS_OF: ${asOf}`,
      `KNOWN_AT: ${knownAt}`,
      `PROJECTION_VERSION: ${this.retriever.projectionVersion}`,
      `PROJECTION_HASH: ${this.retriever.projectionHash}`,
    ].join('\n');
    const headerTokens = estimateTokens(header);
    let remaining = Math.max(0, maxTokens - headerTokens);
    const items: AuthorityContextPackItem[] = [];

    for (const candidate of retrieved.rankedChunks) {
      const chunk = assertAuthorityChunk(candidate.chunk);
      assertCandidateScope(chunk, projectId, permission, allowGlobal, asOf, knownAt);
      if (!Number.isFinite(candidate.score)) {
        throw new Error(`CONTEXT_SCORE_INVALID chunk=${chunk.id}`);
      }
      const item: AuthorityContextPackItem = {
        chunkId: nonEmpty(chunk.id, 'chunk id'),
        source: nonEmpty(chunk.source, `chunk ${chunk.id} source`),
        text: nonEmpty(chunk.text, `chunk ${chunk.id} text`),
        score: candidate.score,
        provenanceRef: nonEmpty(chunk.provenanceRef, `chunk ${chunk.id} provenanceRef`),
        authority: assertUnitInterval(chunk.authority, `chunk ${chunk.id} authority`),
        projectId: chunk.projectId,
        sensitivity: chunk.sensitivity,
        validFrom: chunk.validFrom,
        validUntil: chunk.validUntil,
        recordedAt: canonicalTime(chunk.recordedAt, `chunk ${chunk.id} recordedAt`),
      };
      const rendered = renderItem(item);
      const tokens = estimateTokens(rendered);
      if (tokens > remaining) continue;
      items.push(item);
      remaining -= tokens;
    }

    const contextBody = items.map(renderItem).join('\n\n');
    const context = `${header}\n\n${contextBody}`.trim();
    const estimatedTokens = estimateTokens(context);
    if (estimatedTokens > maxTokens) {
      throw new Error(`CONTEXT_BUDGET_INVARIANT estimated=${estimatedTokens} budget=${maxTokens}`);
    }

    const provenance = Array.from(new Set(items.map(item => item.provenanceRef))).sort();
    const evidenceHash = stableHash128({
      projectId,
      asOf,
      knownAt,
      permission,
      projectionVersion: this.retriever.projectionVersion,
      projectionHash: this.retriever.projectionHash,
      items: items.map(canonicalItem),
    });
    const id = `actx_${stableHash128({
      schemaVersion: 1,
      projectId,
      task,
      generatedAt,
      asOf,
      knownAt,
      permission,
      projectionVersion: this.retriever.projectionVersion,
      projectionHash: this.retriever.projectionHash,
      evidenceHash,
      maxTokens,
    })}`;

    return cloneDraft({
      schemaVersion: 1,
      id,
      projectId,
      task,
      generatedAt,
      asOf,
      knownAt,
      permission,
      projectionVersion: this.retriever.projectionVersion,
      projectionHash: this.retriever.projectionHash,
      maxTokens,
      estimatedTokens,
      items,
      provenance,
      context,
      evidenceHash,
    });
  }

  async compileVerified(request: AuthorityContextPackCompileRequest): Promise<AuthorityContextPack> {
    const draft = this.compile(request);
    const integrityHash = await sha256Hex(integrityPayload(draft));
    return {
      ...cloneDraft(draft),
      integrityAlgorithm: 'sha256',
      integrityHash,
    };
  }

  assertCurrent(pack: AuthorityContextPackDraft): void {
    if (pack.projectionVersion !== this.retriever.projectionVersion) {
      throw new Error(
        `STALE_CONTEXT_PACK pack=${pack.projectionVersion} current=${this.retriever.projectionVersion}`,
      );
    }
    if (pack.projectionHash !== this.retriever.projectionHash) {
      throw new Error(
        `STALE_CONTEXT_PACK_HASH pack=${pack.projectionHash} current=${this.retriever.projectionHash}`,
      );
    }
  }

  async verify(pack: AuthorityContextPack): Promise<void> {
    if (pack.integrityAlgorithm !== 'sha256') {
      throw new Error(`Unsupported context integrity algorithm: ${pack.integrityAlgorithm}`);
    }
    const expected = await sha256Hex(integrityPayload(pack));
    if (expected !== pack.integrityHash) {
      throw new Error(`CONTEXT_PACK_INTEGRITY_MISMATCH expected=${expected} actual=${pack.integrityHash}`);
    }
    const evidenceHash = stableHash128({
      projectId: pack.projectId,
      asOf: pack.asOf,
      knownAt: pack.knownAt,
      permission: pack.permission,
      projectionVersion: pack.projectionVersion,
      projectionHash: pack.projectionHash,
      items: pack.items.map(canonicalItem),
    });
    if (evidenceHash !== pack.evidenceHash) {
      throw new Error(`CONTEXT_EVIDENCE_HASH_MISMATCH expected=${evidenceHash} actual=${pack.evidenceHash}`);
    }
  }
}

function assertAuthorityChunk(value: unknown): AuthorityGraphChunk {
  if (!value || typeof value !== 'object') throw new Error('Authority retrieval returned a non-object chunk');
  const chunk = value as Partial<AuthorityGraphChunk>;
  if (typeof chunk.provenanceRef !== 'string' || !chunk.provenanceRef.trim()) {
    throw new Error(`AUTHORITY_CONTEXT_REQUIRES_PROVENANCE chunk=${String(chunk.id || 'unknown')}`);
  }
  if (typeof chunk.recordedAt !== 'string' || !chunk.recordedAt.trim()) {
    throw new Error(`AUTHORITY_CONTEXT_REQUIRES_RECORDED_AT chunk=${String(chunk.id || 'unknown')}`);
  }
  if (typeof chunk.sensitivity !== 'string' || !(chunk.sensitivity in SENSITIVITY_ORDER)) {
    throw new Error(`AUTHORITY_CONTEXT_REQUIRES_SENSITIVITY chunk=${String(chunk.id || 'unknown')}`);
  }
  if (typeof chunk.authority !== 'number') {
    throw new Error(`AUTHORITY_CONTEXT_REQUIRES_AUTHORITY chunk=${String(chunk.id || 'unknown')}`);
  }
  return chunk as AuthorityGraphChunk;
}

function assertCandidateScope(
  chunk: AuthorityGraphChunk,
  projectId: string,
  permission: RetrievalSensitivity,
  allowGlobal: boolean,
  asOf: string,
  knownAt: string,
): void {
  if (chunk.projectId !== projectId && !(allowGlobal && chunk.projectId === undefined)) {
    throw new Error(`CONTEXT_SCOPE_INVARIANT chunk=${chunk.id} project=${String(chunk.projectId)}`);
  }
  if (SENSITIVITY_ORDER[chunk.sensitivity] > SENSITIVITY_ORDER[permission]) {
    throw new Error(`CONTEXT_PERMISSION_INVARIANT chunk=${chunk.id} sensitivity=${chunk.sensitivity}`);
  }
  const domainTime = Date.parse(asOf);
  if (chunk.validFrom && Date.parse(chunk.validFrom) > domainTime) {
    throw new Error(`CONTEXT_VALID_TIME_INVARIANT chunk=${chunk.id}`);
  }
  if (chunk.validUntil && Date.parse(chunk.validUntil) <= domainTime) {
    throw new Error(`CONTEXT_VALID_TIME_INVARIANT chunk=${chunk.id}`);
  }
  if (Date.parse(chunk.recordedAt) > Date.parse(knownAt)) {
    throw new Error(`CONTEXT_KNOWN_TIME_INVARIANT chunk=${chunk.id}`);
  }
}

function canonicalItem(item: AuthorityContextPackItem): Record<string, unknown> {
  return {
    chunkId: item.chunkId,
    source: item.source,
    text: item.text,
    score: item.score,
    provenanceRef: item.provenanceRef,
    authority: item.authority,
    projectId: item.projectId ?? null,
    sensitivity: item.sensitivity,
    validFrom: item.validFrom ?? null,
    validUntil: item.validUntil ?? null,
    recordedAt: item.recordedAt,
  };
}

function integrityPayload(pack: AuthorityContextPackDraft): Record<string, unknown> {
  return {
    schemaVersion: pack.schemaVersion,
    id: pack.id,
    projectId: pack.projectId,
    task: pack.task,
    generatedAt: pack.generatedAt,
    asOf: pack.asOf,
    knownAt: pack.knownAt,
    permission: pack.permission,
    projectionVersion: pack.projectionVersion,
    projectionHash: pack.projectionHash,
    maxTokens: pack.maxTokens,
    estimatedTokens: pack.estimatedTokens,
    items: pack.items.map(canonicalItem),
    provenance: [...pack.provenance],
    context: pack.context,
    evidenceHash: pack.evidenceHash,
  };
}

function cloneDraft(pack: AuthorityContextPackDraft): AuthorityContextPackDraft {
  return {
    ...pack,
    items: pack.items.map(item => ({ ...item })),
    provenance: [...pack.provenance],
  };
}

function renderItem(item: AuthorityContextPackItem): string {
  return [
    `[${item.chunkId}] score=${item.score.toFixed(4)} authority=${item.authority.toFixed(2)} sensitivity=${item.sensitivity}`,
    `source=${item.source} provenance=${item.provenanceRef} recorded_at=${item.recordedAt}`,
    item.text,
  ].join('\n');
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function assertFiniteVector(vector: number[], label: string): void {
  if (!Array.isArray(vector) || vector.length === 0 || vector.some(value => !Number.isFinite(value))) {
    throw new Error(`${label} must contain finite numbers`);
  }
}

function assertUnitInterval(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be in [0,1]`);
  }
  return value;
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}
