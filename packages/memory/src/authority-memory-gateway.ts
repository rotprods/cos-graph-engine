import type {
  EpistemicType,
  MemoryLayer,
  ProvenanceRef,
} from '@cos/core';
import {
  AuthorityMemoryCoordinator,
} from './authority-memory-coordinator';
import type {
  AuthorityMemoryAppendResult,
  AuthorityMemoryCreateInput,
  AuthorityMemoryEffectiveStatus,
  AuthorityMemoryQuery,
  AuthorityMemoryRelation,
  AuthorityMemoryRelationAppendResult,
  AuthorityMemoryRelationInput,
  AuthorityMemoryRevision,
  AuthorityMemoryReviseInput,
  AuthorityMemorySensitivity,
  AuthorityMemoryView,
  IAuthorityMemoryRevisionStore,
} from './authority-memory';

const SENSITIVITY_ORDER: Record<AuthorityMemorySensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

export interface AuthorityMemoryPointRead {
  memoryId: string;
  asOf: string;
  knownAt: string;
  maxSensitivity?: AuthorityMemorySensitivity;
}

/**
 * Canonical authority façade for memory reads and writes.
 *
 * Lower-level stores/services remain reusable primitives, but agents and Hub
 * authority paths should use this gateway because it enforces two information
 * boundaries that a plain current-row/query helper cannot:
 *
 * 1. `knownAt` never leaks the existence/time of a future revision. Therefore a
 *    revision visible at T has `systemUntil=null` unless its successor was also
 *    known by T (which cannot be true for the latest visible revision).
 * 2. Relation visibility is promoted to the maximum sensitivity of both endpoint
 *    revisions as known at T. A later endpoint reclassification can therefore
 *    hide a previously lower-labelled relation rather than leaking restricted
 *    state through an old `supersedes`/`contradicts` edge.
 */
export class AuthorityMemoryGateway {
  private readonly coordinator: AuthorityMemoryCoordinator;

  constructor(private readonly store: IAuthorityMemoryRevisionStore) {
    this.coordinator = new AuthorityMemoryCoordinator(store);
  }

  create<T>(input: AuthorityMemoryCreateInput<T>): Promise<AuthorityMemoryAppendResult<T>> {
    return this.coordinator.create(input);
  }

  revise<T>(input: AuthorityMemoryReviseInput<T>): Promise<AuthorityMemoryAppendResult<T>> {
    return this.coordinator.revise(input);
  }

  retract(
    memoryId: string,
    expectedRevision: number,
    recordedAt: string,
    idempotencyKey: string,
    provenance: ProvenanceRef[],
  ): Promise<AuthorityMemoryAppendResult> {
    return this.coordinator.retract(memoryId, expectedRevision, recordedAt, idempotencyKey, provenance);
  }

  relate(input: AuthorityMemoryRelationInput): Promise<AuthorityMemoryRelationAppendResult> {
    return this.coordinator.relate(input);
  }

  /** For forensic/admin tooling only: complete immutable revision history. */
  history<T = unknown>(memoryId: string): Promise<AuthorityMemoryView<T>[]> {
    return this.coordinator.history<T>(memoryId);
  }

  async getAt<T = unknown>(request: AuthorityMemoryPointRead): Promise<AuthorityMemoryView<T> | null> {
    const results = await this.query<T>({
      projectId: await this.resolveProjectId(request.memoryId),
      asOf: request.asOf,
      knownAt: request.knownAt,
      maxSensitivity: request.maxSensitivity,
      limit: 10_000,
    });
    return results.find(item => item.memoryId === request.memoryId) ?? null;
  }

  async query<T = unknown>(query: AuthorityMemoryQuery): Promise<AuthorityMemoryView<T>[]> {
    const normalized = normalizeQuery(query);
    const revisions = await this.store.listProjectRevisions<T>(normalized.projectId);
    const grouped = groupRevisions(revisions);
    const selected = new Map<string, AuthorityMemoryRevision<T>>();

    for (const [memoryId, history] of grouped) {
      const revision = latestKnownRevision(history, normalized.knownAtMs);
      if (revision) selected.set(memoryId, revision);
    }

    const visibleRelations = (await this.store.listProjectRelations(normalized.projectId))
      .filter(relation => Date.parse(relation.recordedAt) <= normalized.knownAtMs)
      .filter(relation => relationIsReadableAt(relation, selected, normalized.maxSensitivity));

    const output: AuthorityMemoryView<T>[] = [];
    for (const revision of selected.values()) {
      if (!domainVisible(revision, normalized.asOfMs)) continue;
      if (SENSITIVITY_ORDER[revision.sensitivity] > SENSITIVITY_ORDER[normalized.maxSensitivity]) continue;
      const view: AuthorityMemoryView<T> = {
        ...cloneRevision(revision),
        // The next system revision is, by definition, not visible at this
        // knownAt cutoff because `revision` is the latest known revision.
        systemUntil: null,
        effectiveStatus: effectiveStatusAt(revision, visibleRelations),
      };
      if (!matchesFilters(view, normalized)) continue;
      output.push(view);
    }

    output.sort((left, right) =>
      right.importance - left.importance
      || right.confidence - left.confidence
      || left.memoryId.localeCompare(right.memoryId));
    return output.slice(normalized.offset, normalized.offset + normalized.limit);
  }

  private async resolveProjectId(memoryId: string): Promise<string> {
    const history = await this.store.getHistory(memoryId);
    if (!history.length) throw new Error(`Authority memory not found: ${memoryId}`);
    return history[0].projectId;
  }
}

interface NormalizedQuery {
  projectId: string;
  asOf: string;
  knownAt: string;
  asOfMs: number;
  knownAtMs: number;
  layers?: MemoryLayer[];
  epistemicTypes?: EpistemicType[];
  statuses?: AuthorityMemoryEffectiveStatus[];
  tags?: string[];
  minConfidence?: number;
  minImportance?: number;
  maxSensitivity: AuthorityMemorySensitivity;
  limit: number;
  offset: number;
}

function normalizeQuery(query: AuthorityMemoryQuery): NormalizedQuery {
  const projectId = nonEmpty(query.projectId, 'memory query projectId');
  const asOf = canonicalTime(query.asOf, 'memory query asOf');
  const knownAt = canonicalTime(query.knownAt, 'memory query knownAt');
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000) {
    throw new Error('memory query limit must be a safe integer in [1,10000]');
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('memory query offset must be a non-negative safe integer');
  }
  const minConfidence = query.minConfidence === undefined
    ? undefined
    : unit(query.minConfidence, 'query minConfidence');
  const minImportance = query.minImportance === undefined
    ? undefined
    : unit(query.minImportance, 'query minImportance');
  return {
    projectId,
    asOf,
    knownAt,
    asOfMs: Date.parse(asOf),
    knownAtMs: Date.parse(knownAt),
    layers: query.layers ? [...query.layers] : undefined,
    epistemicTypes: query.epistemicTypes ? [...query.epistemicTypes] : undefined,
    statuses: query.statuses ? [...query.statuses] : undefined,
    tags: query.tags ? Array.from(new Set(query.tags.map(tag => nonEmpty(tag, 'query tag')))).sort() : undefined,
    minConfidence,
    minImportance,
    maxSensitivity: query.maxSensitivity ?? 'internal',
    limit,
    offset,
  };
}

function groupRevisions<T>(revisions: AuthorityMemoryRevision<T>[]): Map<string, AuthorityMemoryRevision<T>[]> {
  const grouped = new Map<string, AuthorityMemoryRevision<T>[]>();
  for (const revision of revisions) {
    let history = grouped.get(revision.memoryId);
    if (!history) { history = []; grouped.set(revision.memoryId, history); }
    history.push(cloneRevision(revision));
  }
  for (const history of grouped.values()) {
    history.sort((left, right) => left.revision - right.revision || left.systemFrom.localeCompare(right.systemFrom));
  }
  return grouped;
}

function latestKnownRevision<T>(
  history: AuthorityMemoryRevision<T>[],
  knownAtMs: number,
): AuthorityMemoryRevision<T> | null {
  let selected: AuthorityMemoryRevision<T> | null = null;
  for (const revision of history) {
    if (Date.parse(revision.systemFrom) <= knownAtMs) selected = revision;
    else break;
  }
  return selected ? cloneRevision(selected) : null;
}

function relationIsReadableAt<T>(
  relation: AuthorityMemoryRelation,
  selected: Map<string, AuthorityMemoryRevision<T>>,
  maxSensitivity: AuthorityMemorySensitivity,
): boolean {
  const from = selected.get(relation.fromMemoryId);
  const to = selected.get(relation.toMemoryId);
  if (!from || !to) return false;
  const effectiveSensitivity = maxSensitivityOf(relation.sensitivity, from.sensitivity, to.sensitivity);
  return SENSITIVITY_ORDER[effectiveSensitivity] <= SENSITIVITY_ORDER[maxSensitivity];
}

function effectiveStatusAt(
  revision: AuthorityMemoryRevision,
  relations: AuthorityMemoryRelation[],
): AuthorityMemoryEffectiveStatus {
  if (revision.baseStatus === 'retracted') return 'retracted';
  const incoming = relations.filter(relation => relation.toMemoryId === revision.memoryId);
  if (incoming.some(relation => relation.type === 'supersedes')) return 'superseded';
  if (incoming.some(relation => relation.type === 'contradicts')) return 'contradicted';
  return 'active';
}

function matchesFilters(view: AuthorityMemoryView, query: NormalizedQuery): boolean {
  if (query.layers?.length && !query.layers.includes(view.layer)) return false;
  if (query.epistemicTypes?.length && !query.epistemicTypes.includes(view.epistemicType)) return false;
  if (query.statuses?.length && !query.statuses.includes(view.effectiveStatus)) return false;
  if (query.tags?.length && !query.tags.some(tag => view.tags.includes(tag))) return false;
  if (query.minConfidence !== undefined && view.confidence < query.minConfidence) return false;
  if (query.minImportance !== undefined && view.importance < query.minImportance) return false;
  return true;
}

function domainVisible(revision: AuthorityMemoryRevision, asOfMs: number): boolean {
  if (Date.parse(revision.validFrom) > asOfMs) return false;
  if (revision.validUntil && Date.parse(revision.validUntil) <= asOfMs) return false;
  return true;
}

function maxSensitivityOf(
  ...values: AuthorityMemorySensitivity[]
): AuthorityMemorySensitivity {
  return values.reduce((left, right) =>
    SENSITIVITY_ORDER[left] >= SENSITIVITY_ORDER[right] ? left : right,
  );
}

function cloneRevision<T>(revision: AuthorityMemoryRevision<T>): AuthorityMemoryRevision<T> {
  return {
    ...revision,
    content: structuredClone(revision.content),
    provenance: revision.provenance.map(item => ({ ...item })),
    tags: [...revision.tags],
    metadata: structuredClone(revision.metadata),
  };
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

function unit(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be in [0,1]`);
  return value;
}
