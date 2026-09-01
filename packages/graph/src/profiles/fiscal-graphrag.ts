import { GraphRAGEngine, type Chunk } from '../level11-graphrag';
import type { FiscalAuthorityRank, FiscalTruthClass } from './fiscal-knowledge';

export type FiscalSensitivity = 'PUBLIC' | 'INTERNAL' | 'RESTRICTED_FINANCIAL';
export type FiscalQueryIntent = 'GENERAL' | 'FILED_STATUS' | 'PAYMENT_STATUS' | 'DEDUCTIBILITY' | 'TAX_CALCULATION';

export interface FiscalEvidenceChunk extends Chunk {
  authorityRank: FiscalAuthorityRank;
  truthClass: FiscalTruthClass;
  evidenceClass: string;
  observedAt?: string;
  eventTime?: string;
  validFrom?: string;
  validTo?: string;
  sensitivity: FiscalSensitivity;
  provenanceCompleteness: number;
  entityResolutionConfidence: number;
  centrality?: number;
  contradictionIds?: string[];
  evidencePath?: string[];
}

export interface FiscalGraphRAGWeights {
  semantic: number;
  graph: number;
  authority: number;
  temporal: number;
  provenance: number;
  entityResolution: number;
  centrality: number;
  stalenessPenalty: number;
  contradictionPenalty: number;
}

export interface FiscalQueryPolicy {
  intent: FiscalQueryIntent;
  validAt?: string;
  observedAt?: string;
  maxSensitivity: FiscalSensitivity;
  forbiddenEvidenceClasses: string[];
  minimumAuthorityScore?: number;
  requireOfficialForAnswer?: boolean;
  includeContradictions?: boolean;
}

export interface FiscalContextCandidate {
  chunk: FiscalEvidenceChunk;
  retrievalScore: number;
  truthConfidence: number;
  authorityScore: number;
  temporalScore: number;
  provenanceScore: number;
  entityResolutionScore: number;
  centralityScore: number;
  stalenessPenalty: number;
  contradictionPenalty: number;
  reasons: string[];
}

export interface FiscalContextPack {
  query: string;
  intent: FiscalQueryIntent;
  selected: FiscalContextCandidate[];
  contradictions: FiscalContextCandidate[];
  entities: string[];
  relationships: Array<{ source: string; target: string; relation: string }>;
  evidencePaths: string[][];
  unresolvedGaps: string[];
  answerable: boolean;
  answerabilityReason: string;
  retrievalTrace: string[];
}

const DEFAULT_WEIGHTS: FiscalGraphRAGWeights = {
  semantic: 0.28,
  graph: 0.12,
  authority: 0.20,
  temporal: 0.10,
  provenance: 0.10,
  entityResolution: 0.08,
  centrality: 0.02,
  stalenessPenalty: 0.05,
  contradictionPenalty: 0.05,
};

const AUTHORITY_SCORE: Record<FiscalAuthorityRank, number> = {
  '1_FILED_OR_OFFICIAL_ASSESSMENT': 1.00,
  '2_OFFICIAL_BANK_BROKER_STATEMENT': 0.90,
  '3_CONTRACT_INVOICE_RECEIPT': 0.80,
  '4_SIGNED_PROFESSIONAL_MEMO': 0.65,
  '5_RECONSTRUCTED_LEDGER': 0.50,
  '6_USER_REPORTED': 0.30,
  '7_HYPOTHESIS': 0.10,
};

const TRUTH_SCORE: Record<FiscalTruthClass, number> = {
  CONFIRMED: 1.00,
  RECONSTRUCTED: 0.82,
  PRELIMINARY: 0.62,
  REVIEW: 0.48,
  SCENARIO: 0.25,
  BLOCKED: 0.35,
};

const SENSITIVITY_ORDER: Record<FiscalSensitivity, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  RESTRICTED_FINANCIAL: 2,
};

export function fiscalPolicyForIntent(
  intent: FiscalQueryIntent,
  overrides: Partial<FiscalQueryPolicy> = {},
): FiscalQueryPolicy {
  const base: FiscalQueryPolicy = {
    intent,
    maxSensitivity: 'RESTRICTED_FINANCIAL',
    forbiddenEvidenceClasses: [],
    includeContradictions: true,
  };

  if (intent === 'FILED_STATUS') {
    base.requireOfficialForAnswer = true;
    base.minimumAuthorityScore = 1.0;
    base.forbiddenEvidenceClasses = [
      'TEMPLATE_NOT_FILING',
      'PREPARED_NOT_FILED',
      'PREPARED_COPY_NOT_FILING_PROOF',
      'STALE_TEMPLATE_NOT_FILING',
    ];
  }
  if (intent === 'PAYMENT_STATUS') {
    base.requireOfficialForAnswer = true;
    base.minimumAuthorityScore = 0.9;
    base.forbiddenEvidenceClasses = [
      'PAYMENT_LETTER_NOT_PROOF',
      'INSTRUCTION_NOT_SETTLEMENT',
      'CARTA_DE_PAGO_NOT_SETTLEMENT_PROOF',
    ];
  }
  if (intent === 'DEDUCTIBILITY') {
    base.minimumAuthorityScore = 0.65;
  }
  if (intent === 'TAX_CALCULATION') {
    base.minimumAuthorityScore = 0.5;
  }

  return { ...base, ...overrides };
}

function normalizeEntityKey(value: string): string {
  return value.trim().toLowerCase();
}

function cosine(a: number[], b: number[]): number {
  return GraphRAGEngine.cosineSim(a, b);
}

function temporalValidity(chunk: FiscalEvidenceChunk, validAt?: string): number {
  if (!validAt) return 1;
  if (chunk.validFrom && validAt < chunk.validFrom) return 0;
  if (chunk.validTo && validAt > chunk.validTo) return 0;
  return 1;
}

function stalenessPenalty(chunk: FiscalEvidenceChunk, observedAt?: string): number {
  if (!observedAt || !chunk.observedAt) return 0;
  const q = Date.parse(observedAt);
  const c = Date.parse(chunk.observedAt);
  if (!Number.isFinite(q) || !Number.isFinite(c) || q <= c) return 0;
  const days = (q - c) / 86_400_000;
  return Math.min(1, days / 3650);
}

function sensitivityAllowed(chunk: FiscalEvidenceChunk, max: FiscalSensitivity): boolean {
  return SENSITIVITY_ORDER[chunk.sensitivity] <= SENSITIVITY_ORDER[max];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Fiscal/financial context compiler built on top of native COS L11 GraphRAG.
 * Native GraphRAG performs candidate vector+graph retrieval; this layer adds fiscal
 * authority, temporal validity, provenance, sensitivity and contradiction policy.
 */
export class FiscalAuthorityGraphRAG {
  private readonly engine: GraphRAGEngine;
  private readonly chunks = new Map<string, FiscalEvidenceChunk>();
  private readonly weights: FiscalGraphRAGWeights;
  private readonly finalTopK: number;

  constructor(options: {
    candidateTopK?: number;
    finalTopK?: number;
    walkDepth?: number;
    similarityWeight?: number;
    weights?: Partial<FiscalGraphRAGWeights>;
  } = {}) {
    this.finalTopK = options.finalTopK ?? 8;
    this.weights = { ...DEFAULT_WEIGHTS, ...options.weights };
    this.engine = new GraphRAGEngine({
      topK: options.candidateTopK ?? 30,
      walkDepth: options.walkDepth ?? 3,
      similarityWeight: options.similarityWeight ?? 0.55,
    });
  }

  addEntity(id: string, name: string, type = 'concept'): void {
    this.engine.addEntity(id, name, type);
  }

  addRelation(source: string, target: string, type = 'related_to'): void {
    this.engine.addRelation(source, target, type);
  }

  addEvidenceChunk(chunk: FiscalEvidenceChunk): void {
    if (this.chunks.has(chunk.id)) throw new Error(`Duplicate fiscal evidence chunk: ${chunk.id}`);
    if (chunk.provenanceCompleteness < 0 || chunk.provenanceCompleteness > 1) {
      throw new Error(`Invalid provenanceCompleteness for ${chunk.id}`);
    }
    if (chunk.entityResolutionConfidence < 0 || chunk.entityResolutionConfidence > 1) {
      throw new Error(`Invalid entityResolutionConfidence for ${chunk.id}`);
    }
    this.chunks.set(chunk.id, structuredClone(chunk));
    this.engine.addChunk(chunk);
  }

  compile(
    query: string,
    queryEmbedding: number[],
    queryEntities: string[] = [],
    policy: FiscalQueryPolicy = fiscalPolicyForIntent('GENERAL'),
  ): FiscalContextPack {
    const native = this.engine.retrieve(queryEmbedding, queryEntities);

    // Native L11 returns entity names for display, while chunks and relations use canonical IDs.
    // Build overlap on IDs first and add names only as a compatibility fallback.
    const graphEntitySet = new Set<string>(queryEntities.map(normalizeEntityKey));
    for (const relation of native.relations) {
      graphEntitySet.add(normalizeEntityKey(relation.source));
      graphEntitySet.add(normalizeEntityKey(relation.target));
    }
    for (const name of native.entities) {
      graphEntitySet.add(normalizeEntityKey(name));
      const entity = this.engine.entities.find(e => e.name === name);
      if (entity) graphEntitySet.add(normalizeEntityKey(entity.id));
    }

    const candidates: FiscalContextCandidate[] = [];
    const contradictions: FiscalContextCandidate[] = [];

    for (const baseChunk of native.chunks) {
      const chunk = this.chunks.get(baseChunk.id);
      if (!chunk) continue;
      if (!sensitivityAllowed(chunk, policy.maxSensitivity)) continue;
      if (policy.forbiddenEvidenceClasses.includes(chunk.evidenceClass)) continue;

      const temporalScore = temporalValidity(chunk, policy.validAt);
      if (temporalScore === 0) continue;

      const semanticScore = clamp01((cosine(chunk.embedding, queryEmbedding) + 1) / 2);
      const graphOverlap = chunk.entities.length === 0
        ? 0
        : chunk.entities.filter(e => graphEntitySet.has(normalizeEntityKey(e))).length / chunk.entities.length;
      const authorityScore = AUTHORITY_SCORE[chunk.authorityRank];
      const provenanceScore = clamp01(chunk.provenanceCompleteness);
      const entityResolutionScore = clamp01(chunk.entityResolutionConfidence);
      const centralityScore = clamp01(chunk.centrality ?? 0);
      const stalePenalty = stalenessPenalty(chunk, policy.observedAt);
      const isContradiction = Boolean(chunk.contradictionIds?.length);
      const contradictionPenalty = isContradiction ? 1 : 0;

      const retrievalScore = clamp01(
        this.weights.semantic * semanticScore +
        this.weights.graph * graphOverlap +
        this.weights.authority * authorityScore +
        this.weights.temporal * temporalScore +
        this.weights.provenance * provenanceScore +
        this.weights.entityResolution * entityResolutionScore +
        this.weights.centrality * centralityScore -
        this.weights.stalenessPenalty * stalePenalty -
        this.weights.contradictionPenalty * contradictionPenalty
      );

      const truthConfidence = clamp01(
        TRUTH_SCORE[chunk.truthClass] * 0.45 +
        authorityScore * 0.30 +
        provenanceScore * 0.15 +
        entityResolutionScore * 0.10
      );

      const reasons = [
        `semantic=${semanticScore.toFixed(3)}`,
        `graph=${graphOverlap.toFixed(3)}`,
        `authority=${authorityScore.toFixed(3)}`,
        `temporal=${temporalScore.toFixed(3)}`,
        `provenance=${provenanceScore.toFixed(3)}`,
        `entityResolution=${entityResolutionScore.toFixed(3)}`,
      ];
      if (isContradiction) reasons.push('contradiction-present');
      if (stalePenalty > 0) reasons.push(`stalenessPenalty=${stalePenalty.toFixed(3)}`);

      const candidate: FiscalContextCandidate = {
        chunk,
        retrievalScore,
        truthConfidence,
        authorityScore,
        temporalScore,
        provenanceScore,
        entityResolutionScore,
        centralityScore,
        stalenessPenalty: stalePenalty,
        contradictionPenalty,
        reasons,
      };

      if (isContradiction) contradictions.push(candidate);
      candidates.push(candidate);
    }

    candidates.sort((a, b) => b.retrievalScore - a.retrievalScore);
    contradictions.sort((a, b) => b.retrievalScore - a.retrievalScore);

    let selected = candidates.slice(0, this.finalTopK);

    // For authority-gated intents, never accidentally discard the best qualifying official
    // candidate merely because a semantic candidate occupied the finalTopK boundary.
    if (policy.minimumAuthorityScore !== undefined) {
      const bestQualified = candidates.find(c => c.authorityScore >= policy.minimumAuthorityScore!);
      if (bestQualified && !selected.some(c => c.chunk.id === bestQualified.chunk.id)) {
        selected = [...selected.slice(0, Math.max(0, this.finalTopK - 1)), bestQualified]
          .sort((a, b) => b.retrievalScore - a.retrievalScore);
      }
    }

    const unresolvedGaps: string[] = [];
    if (selected.length === 0) unresolvedGaps.push('No eligible evidence chunks survived retrieval/policy filters.');
    if (policy.minimumAuthorityScore !== undefined && !selected.some(c => c.authorityScore >= policy.minimumAuthorityScore!)) {
      unresolvedGaps.push(`No evidence meets minimum authority score ${policy.minimumAuthorityScore}.`);
    }

    let answerable = selected.length > 0;
    let answerabilityReason = answerable ? 'Eligible evidence context available.' : 'No eligible evidence context.';

    if (policy.requireOfficialForAnswer) {
      const meetsOfficial = selected.some(c => c.authorityScore >= (policy.minimumAuthorityScore ?? 1));
      if (!meetsOfficial) {
        answerable = false;
        answerabilityReason = 'Official/required-authority evidence is missing for this query intent.';
      }
    }

    if (contradictions.length > 0 && policy.includeContradictions !== false) {
      unresolvedGaps.push(`${contradictions.length} contradictory evidence chunk(s) require explicit reconciliation.`);
    }

    return {
      query,
      intent: policy.intent,
      selected,
      contradictions: policy.includeContradictions === false ? [] : contradictions,
      entities: native.entities,
      relationships: native.relations.map(r => ({ source: r.source, target: r.target, relation: r.type })),
      evidencePaths: selected.map(c => c.chunk.evidencePath ?? [c.chunk.source, c.chunk.id]),
      unresolvedGaps,
      answerable,
      answerabilityReason,
      retrievalTrace: [
        `native-candidate-topK=${this.engine.config.topK}`,
        `native-walk-depth=${this.engine.config.walkDepth}`,
        `fiscal-final-topK=${this.finalTopK}`,
        `intent=${policy.intent}`,
        `eligible=${candidates.length}`,
        `selected=${selected.length}`,
      ],
    };
  }
}