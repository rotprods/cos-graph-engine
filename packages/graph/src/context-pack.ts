import { stableHash128 } from '@cos/core';
import type {
  RankedChunk,
  RetrievalScope,
  RetrievalSensitivity,
} from './level11-graphrag';
import type { ScopedGraphRetriever } from './authority-graphrag';

export interface VersionedScopedGraphRetriever extends ScopedGraphRetriever {
  readonly projectionVersion?: number;
  readonly projectionHash?: string;
}

export interface ContextPackItem {
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
}

export interface ContextPack {
  id: string;
  projectId: string;
  task: string;
  generatedAt: string;
  asOf: string;
  permission: RetrievalSensitivity;
  projectionVersion: number;
  projectionHash?: string;
  maxTokens: number;
  estimatedTokens: number;
  items: ContextPackItem[];
  provenance: string[];
  context: string;
  evidenceHash: string;
}

export interface ContextPackCompileRequest {
  projectId: string;
  task: string;
  queryEmbedding: number[];
  queryEntities?: string[];
  permission?: RetrievalSensitivity;
  asOf?: string;
  projectionVersion: number;
  expectedProjectionVersion?: number;
  expectedProjectionHash?: string;
  maxTokens?: number;
  minScore?: number;
  allowGlobal?: boolean;
}

/**
 * Converts scope-safe retrieval evidence into a deterministic, bounded context
 * contract suitable for cross-agent handoff.
 *
 * The compiler depends on a structural retriever contract rather than the
 * legacy GraphRAG class. AuthorityGraphRAGIndex can therefore provide strict
 * deterministic projection semantics while existing callers remain compatible.
 */
export class ContextPackCompiler {
  constructor(private readonly graphRag: VersionedScopedGraphRetriever) {}

  compile(request: ContextPackCompileRequest): ContextPack {
    const projectId = request.projectId.trim();
    const task = request.task.trim();
    if (!projectId) throw new Error('ContextPack projectId must not be empty');
    if (!task) throw new Error('ContextPack task must not be empty');
    if (!Number.isInteger(request.projectionVersion) || request.projectionVersion < 0) {
      throw new Error('projectionVersion must be a non-negative integer');
    }

    const retrieverVersion = this.graphRag.projectionVersion;
    if (retrieverVersion !== undefined && retrieverVersion !== request.projectionVersion) {
      throw new Error(
        `STALE_CONTEXT_RETRIEVER requested=${request.projectionVersion} current=${retrieverVersion}`,
      );
    }
    if (
      request.expectedProjectionVersion !== undefined
      && request.expectedProjectionVersion !== request.projectionVersion
    ) {
      throw new Error(
        `STALE_CONTEXT_PROJECTION expected=${request.expectedProjectionVersion} current=${request.projectionVersion}`,
      );
    }
    if (
      request.expectedProjectionHash !== undefined
      && this.graphRag.projectionHash !== undefined
      && request.expectedProjectionHash !== this.graphRag.projectionHash
    ) {
      throw new Error(
        `STALE_CONTEXT_HASH expected=${request.expectedProjectionHash} current=${this.graphRag.projectionHash}`,
      );
    }

    const maxTokens = request.maxTokens ?? 4_000;
    if (!Number.isInteger(maxTokens) || maxTokens < 128 || maxTokens > 128_000) {
      throw new Error('ContextPack maxTokens must be an integer in [128,128000]');
    }

    const asOf = request.asOf || new Date().toISOString();
    if (!Number.isFinite(Date.parse(asOf))) throw new Error(`Invalid ContextPack asOf '${asOf}'`);
    const permission = request.permission ?? 'internal';
    const scope: RetrievalScope = {
      projectId,
      permission,
      asOf,
      allowGlobal: request.allowGlobal ?? true,
      minScore: request.minScore ?? 0,
    };

    const retrieved = this.graphRag.retrieveScoped(
      request.queryEmbedding,
      request.queryEntities || [],
      scope,
    );

    const header = [
      `PROJECT: ${projectId}`,
      `TASK: ${task}`,
      `AS_OF: ${asOf}`,
      `PROJECTION: ${request.projectionVersion}`,
      this.graphRag.projectionHash ? `PROJECTION_HASH: ${this.graphRag.projectionHash}` : null,
    ].filter((line): line is string => Boolean(line)).join('\n') + '\n';
    const headerTokens = this.estimateTokens(header);
    let remaining = Math.max(0, maxTokens - headerTokens);
    const items: ContextPackItem[] = [];

    for (const candidate of retrieved.rankedChunks) {
      const item = this.toItem(candidate, permission);
      const rendered = this.renderItem(item);
      const tokens = this.estimateTokens(rendered);
      if (tokens > remaining) continue;
      items.push(item);
      remaining -= tokens;
    }

    const contextBody = items.map(item => this.renderItem(item)).join('\n\n');
    const context = `${header}\n${contextBody}`.trim();
    const estimatedTokens = this.estimateTokens(context);
    if (estimatedTokens > maxTokens) {
      throw new Error(`CONTEXT_BUDGET_INVARIANT estimated=${estimatedTokens} budget=${maxTokens}`);
    }

    const provenance = Array.from(new Set(items.map(item => item.provenanceRef))).sort();
    const evidenceHash = stableHash128(items.map(item => ({
      id: item.chunkId,
      score: item.score,
      provenance: item.provenanceRef,
      text: item.text,
    })));
    const id = `ctx_${stableHash128({
      projectId,
      task,
      asOf,
      permission,
      projectionVersion: request.projectionVersion,
      projectionHash: this.graphRag.projectionHash || null,
      evidenceHash,
      maxTokens,
    })}`;

    return {
      id,
      projectId,
      task,
      generatedAt: new Date().toISOString(),
      asOf,
      permission,
      projectionVersion: request.projectionVersion,
      projectionHash: this.graphRag.projectionHash,
      maxTokens,
      estimatedTokens,
      items,
      provenance,
      context,
      evidenceHash,
    };
  }

  assertCurrent(pack: ContextPack, currentProjectionVersion: number, currentProjectionHash?: string): void {
    if (pack.projectionVersion !== currentProjectionVersion) {
      throw new Error(
        `STALE_CONTEXT_PACK pack=${pack.projectionVersion} current=${currentProjectionVersion}`,
      );
    }
    if (pack.projectionHash && currentProjectionHash && pack.projectionHash !== currentProjectionHash) {
      throw new Error(
        `STALE_CONTEXT_PACK_HASH pack=${pack.projectionHash} current=${currentProjectionHash}`,
      );
    }
  }

  private toItem(candidate: RankedChunk, permission: RetrievalSensitivity): ContextPackItem {
    const chunk = candidate.chunk;
    if (!chunk.provenanceRef) {
      throw new Error(`AUTHORITY_CONTEXT_REQUIRES_PROVENANCE chunk=${chunk.id}`);
    }
    return {
      chunkId: chunk.id,
      source: chunk.source,
      text: chunk.text,
      score: candidate.score,
      provenanceRef: chunk.provenanceRef,
      authority: chunk.authority ?? 0.5,
      projectId: chunk.projectId,
      sensitivity: chunk.sensitivity ?? permission,
      validFrom: chunk.validFrom,
      validUntil: chunk.validUntil,
    };
  }

  private renderItem(item: ContextPackItem): string {
    return [
      `[${item.chunkId}] score=${item.score.toFixed(4)} authority=${item.authority.toFixed(2)}`,
      `source=${item.source} provenance=${item.provenanceRef}`,
      item.text,
    ].join('\n');
  }

  private estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }
}
