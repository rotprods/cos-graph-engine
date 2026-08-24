import type { EntityId, MemoryLayer, Timestamp } from './types';
import type { BitemporalWindow, EpistemicType, ProvenanceRef } from './temporal';
import { assertValidTemporalWindow, isValidAt, wasKnownAt } from './temporal';

export type AuthoritySensitivity = 'public' | 'internal' | 'private' | 'restricted';
export type AuthorityMemoryStatus = 'active' | 'superseded' | 'contradicted' | 'retracted';
export type AuthorityMemoryRelationType = 'contradicts' | 'confirms' | 'evidence_for' | 'derived_from';

export interface AuthorityMemoryRecord<T = unknown> {
  id: EntityId;
  projectId: string;
  layer: MemoryLayer;
  content: T;
  temporal: BitemporalWindow;
  provenance: ProvenanceRef[];
  epistemicType: EpistemicType;
  confidence: number;
  sensitivity: AuthoritySensitivity;
  status: AuthorityMemoryStatus;
  supersedes: EntityId | null;
  source: EntityId;
  tags: string[];
  importance: number;
  lastVerifiedAt: Timestamp | null;
  metadata: Record<string, unknown>;
}

export interface AuthorityMemoryRelation {
  id: EntityId;
  projectId: string;
  type: AuthorityMemoryRelationType;
  from: EntityId;
  to: EntityId;
  confidence: number;
  provenance: ProvenanceRef[];
  recordedAt: Timestamp;
  metadata: Record<string, unknown>;
}

export interface AuthorityMemoryQuery {
  projectId: string;
  layers?: MemoryLayer[];
  epistemicTypes?: EpistemicType[];
  statuses?: AuthorityMemoryStatus[];
  tags?: string[];
  minConfidence?: number;
  minImportance?: number;
  maxSensitivity?: AuthoritySensitivity;
  /** Domain-time visibility. */
  asOf?: Timestamp;
  /** System-knowledge visibility. */
  knownAt?: Timestamp;
  limit?: number;
  offset?: number;
}

const SENSITIVITY_ORDER: Record<AuthoritySensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

export function assertAuthorityMemoryRecord(record: AuthorityMemoryRecord): void {
  if (!String(record.id).trim()) throw new Error('Authority memory ID must not be empty');
  if (!record.projectId.trim()) throw new Error('Authority memory projectId must not be empty');
  assertValidTemporalWindow(record.temporal);
  if (!record.provenance.length) throw new Error(`Authority memory ${String(record.id)} requires provenance`);
  for (const provenance of record.provenance) {
    if (!provenance.source.trim()) throw new Error(`Authority memory ${String(record.id)} has empty provenance source`);
  }
  if (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1) {
    throw new Error(`Authority memory ${String(record.id)} confidence must be in [0,1]`);
  }
  if (!Number.isFinite(record.importance) || record.importance < 0 || record.importance > 1) {
    throw new Error(`Authority memory ${String(record.id)} importance must be in [0,1]`);
  }
  if (record.lastVerifiedAt !== null && !Number.isFinite(Date.parse(record.lastVerifiedAt))) {
    throw new Error(`Authority memory ${String(record.id)} has invalid lastVerifiedAt`);
  }
  if (record.status === 'active' && (record.temporal.validUntil !== null || record.temporal.supersededAt !== null)) {
    throw new Error(`Active authority memory ${String(record.id)} cannot have a closed temporal window`);
  }
  if (record.status === 'superseded' && record.temporal.supersededAt === null) {
    throw new Error(`Superseded authority memory ${String(record.id)} requires supersededAt`);
  }
}

export function assertAuthorityMemoryRelation(relation: AuthorityMemoryRelation): void {
  if (!String(relation.id).trim()) throw new Error('Authority memory relation ID must not be empty');
  if (!relation.projectId.trim()) throw new Error('Authority memory relation projectId must not be empty');
  if (relation.from === relation.to) throw new Error('Authority memory relation cannot self-reference');
  if (!relation.provenance.length || relation.provenance.some(item => !item.source.trim())) {
    throw new Error(`Authority memory relation ${String(relation.id)} requires provenance`);
  }
  if (!Number.isFinite(relation.confidence) || relation.confidence < 0 || relation.confidence > 1) {
    throw new Error(`Authority memory relation ${String(relation.id)} confidence must be in [0,1]`);
  }
  if (!Number.isFinite(Date.parse(relation.recordedAt))) {
    throw new Error(`Authority memory relation ${String(relation.id)} has invalid recordedAt`);
  }
}

export function authorityMemoryMatches(
  record: AuthorityMemoryRecord,
  query: AuthorityMemoryQuery,
): boolean {
  if (record.projectId !== query.projectId) return false;
  if (query.layers?.length && !query.layers.includes(record.layer)) return false;
  if (query.epistemicTypes?.length && !query.epistemicTypes.includes(record.epistemicType)) return false;
  if (query.statuses?.length && !query.statuses.includes(record.status)) return false;
  if (query.tags?.length && !query.tags.some(tag => record.tags.includes(tag))) return false;
  if (query.minConfidence !== undefined && record.confidence < query.minConfidence) return false;
  if (query.minImportance !== undefined && record.importance < query.minImportance) return false;
  const maximum = SENSITIVITY_ORDER[query.maxSensitivity || 'internal'];
  if (SENSITIVITY_ORDER[record.sensitivity] > maximum) return false;
  if (query.asOf && !isValidAt(record.temporal, query.asOf)) return false;
  if (query.knownAt && !wasKnownAt(record.temporal, query.knownAt)) return false;
  return true;
}
