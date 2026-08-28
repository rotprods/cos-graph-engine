import {
  canonicalIdentity,
  stableHash128,
  type EpistemicType,
  type MemoryLayer,
  type ProvenanceRef,
} from '@cos/core';

export type AuthorityMemorySensitivity = 'public' | 'internal' | 'private' | 'restricted';
export type AuthorityMemoryBaseStatus = 'active' | 'retracted';
export type AuthorityMemoryEffectiveStatus = AuthorityMemoryBaseStatus | 'superseded' | 'contradicted';
export type AuthorityMemoryRelationType =
  | 'supersedes'
  | 'contradicts'
  | 'confirms'
  | 'evidence_for'
  | 'derived_from';

const SENSITIVITY_ORDER: Record<AuthorityMemorySensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

export interface AuthorityMemoryRevision<T = unknown> {
  revisionId: string;
  memoryId: string;
  operationKey: string;
  revision: number;
  projectId: string;
  identityKey: string;
  layer: MemoryLayer;
  content: T;
  epistemicType: EpistemicType;
  confidence: number;
  sensitivity: AuthorityMemorySensitivity;
  baseStatus: AuthorityMemoryBaseStatus;
  validFrom: string;
  validUntil: string | null;
  observedAt: string;
  /** Transaction/system time at which this immutable revision became known. */
  systemFrom: string;
  provenance: ProvenanceRef[];
  source: string;
  tags: string[];
  importance: number;
  lastVerifiedAt: string | null;
  metadata: Record<string, unknown>;
  supersedesRevisionId: string | null;
  contentHash: string;
}

export interface AuthorityMemoryView<T = unknown> extends AuthorityMemoryRevision<T> {
  /** Derived from the next revision; never persisted by the authority ledger. */
  systemUntil: string | null;
  effectiveStatus: AuthorityMemoryEffectiveStatus;
}

export interface AuthorityMemoryRelation {
  id: string;
  operationKey: string;
  projectId: string;
  type: AuthorityMemoryRelationType;
  fromMemoryId: string;
  toMemoryId: string;
  identityKey: string;
  confidence: number;
  sensitivity: AuthorityMemorySensitivity;
  provenance: ProvenanceRef[];
  recordedAt: string;
  metadata: Record<string, unknown>;
  contentHash: string;
}

export interface AuthorityMemoryCreateInput<T = unknown> {
  projectId: string;
  identityKey: string;
  layer: MemoryLayer;
  content: T;
  epistemicType: EpistemicType;
  confidence: number;
  sensitivity?: AuthorityMemorySensitivity;
  validFrom: string;
  validUntil?: string | null;
  observedAt: string;
  recordedAt: string;
  provenance: ProvenanceRef[];
  source: string;
  tags?: string[];
  importance?: number;
  lastVerifiedAt?: string | null;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
}

export interface AuthorityMemoryRevisionChanges<T = unknown> {
  layer?: MemoryLayer;
  content?: T;
  epistemicType?: EpistemicType;
  confidence?: number;
  sensitivity?: AuthorityMemorySensitivity;
  baseStatus?: AuthorityMemoryBaseStatus;
  validFrom?: string;
  validUntil?: string | null;
  observedAt?: string;
  provenance?: ProvenanceRef[];
  tags?: string[];
  importance?: number;
  lastVerifiedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuthorityMemoryReviseInput<T = unknown> {
  memoryId: string;
  expectedRevision: number;
  recordedAt: string;
  idempotencyKey: string;
  changes: AuthorityMemoryRevisionChanges<T>;
}

export interface AuthorityMemoryRelationInput {
  projectId: string;
  type: AuthorityMemoryRelationType;
  fromMemoryId: string;
  toMemoryId: string;
  identityKey?: string;
  confidence?: number;
  sensitivity?: AuthorityMemorySensitivity;
  provenance: ProvenanceRef[];
  recordedAt: string;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
}

export interface AuthorityMemoryQuery {
  projectId: string;
  /** Domain-valid time. Required for authority queries. */
  asOf: string;
  /** Transaction/system-knowledge time. Required for authority queries. */
  knownAt: string;
  layers?: MemoryLayer[];
  epistemicTypes?: EpistemicType[];
  statuses?: AuthorityMemoryEffectiveStatus[];
  tags?: string[];
  minConfidence?: number;
  minImportance?: number;
  maxSensitivity?: AuthorityMemorySensitivity;
  limit?: number;
  offset?: number;
}

export interface AuthorityMemoryAppendResult<T = unknown> {
  revision: AuthorityMemoryRevision<T>;
  appended: boolean;
}

export interface AuthorityMemoryRelationAppendResult {
  relation: AuthorityMemoryRelation;
  appended: boolean;
}

export interface IAuthorityMemoryRevisionStore {
  appendRevision<T>(
    revision: AuthorityMemoryRevision<T>,
    expectedCurrentRevision: number,
  ): Promise<AuthorityMemoryAppendResult<T>>;
  getCurrent<T = unknown>(memoryId: string): Promise<AuthorityMemoryRevision<T> | null>;
  getHistory<T = unknown>(memoryId: string): Promise<AuthorityMemoryRevision<T>[]>;
  listProjectRevisions<T = unknown>(projectId: string): Promise<AuthorityMemoryRevision<T>[]>;
  appendRelation(relation: AuthorityMemoryRelation): Promise<AuthorityMemoryRelationAppendResult>;
  listProjectRelations(projectId: string): Promise<AuthorityMemoryRelation[]>;
}

/** Reference append-only in-memory authority store. */
export class InMemoryAuthorityMemoryStore implements IAuthorityMemoryRevisionStore {
  private readonly histories = new Map<string, AuthorityMemoryRevision[]>();
  private readonly revisionById = new Map<string, AuthorityMemoryRevision>();
  private readonly revisionByOperation = new Map<string, AuthorityMemoryRevision>();
  private readonly relations = new Map<string, AuthorityMemoryRelation>();
  private readonly relationByOperation = new Map<string, AuthorityMemoryRelation>();
  private readonly operationTails = new Map<string, Promise<void>>();

  appendRevision<T>(
    revision: AuthorityMemoryRevision<T>,
    expectedCurrentRevision: number,
  ): Promise<AuthorityMemoryAppendResult<T>> {
    return this.enqueue(`memory:${revision.memoryId}`, async () => {
      assertRevision(revision);
      const duplicate = this.revisionByOperation.get(revision.operationKey);
      if (duplicate) {
        if (duplicate.contentHash !== revision.contentHash) {
          throw new Error(`MEMORY_IDEMPOTENCY_CONFLICT key=${revision.operationKey}`);
        }
        return { revision: cloneRevision(duplicate) as AuthorityMemoryRevision<T>, appended: false };
      }
      const history = this.histories.get(revision.memoryId) ?? [];
      const current = history.at(-1);
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== expectedCurrentRevision) {
        throw new Error(`STALE_MEMORY_REVISION expected=${expectedCurrentRevision} current=${currentRevision}`);
      }
      if (revision.revision !== currentRevision + 1) {
        throw new Error(`MEMORY_REVISION_SEQUENCE expected=${currentRevision + 1} incoming=${revision.revision}`);
      }
      if (current) {
        if (revision.supersedesRevisionId !== current.revisionId) {
          throw new Error(`MEMORY_REVISION_PARENT_MISMATCH memory=${revision.memoryId}`);
        }
        if (Date.parse(revision.systemFrom) <= Date.parse(current.systemFrom)) {
          throw new Error(`MEMORY_SYSTEM_TIME_NOT_MONOTONIC memory=${revision.memoryId}`);
        }
      } else if (revision.supersedesRevisionId !== null) {
        throw new Error(`MEMORY_INITIAL_REVISION_HAS_PARENT memory=${revision.memoryId}`);
      }
      const idCollision = this.revisionById.get(revision.revisionId);
      if (idCollision && idCollision.contentHash !== revision.contentHash) {
        throw new Error(`MEMORY_REVISION_ID_COLLISION id=${revision.revisionId}`);
      }
      const stored = cloneRevision(revision);
      history.push(stored);
      this.histories.set(revision.memoryId, history);
      this.revisionById.set(revision.revisionId, stored);
      this.revisionByOperation.set(revision.operationKey, stored);
      return { revision: cloneRevision(stored) as AuthorityMemoryRevision<T>, appended: true };
    });
  }

  async getCurrent<T = unknown>(memoryId: string): Promise<AuthorityMemoryRevision<T> | null> {
    const current = this.histories.get(memoryId)?.at(-1);
    return current ? cloneRevision(current) as AuthorityMemoryRevision<T> : null;
  }

  async getHistory<T = unknown>(memoryId: string): Promise<AuthorityMemoryRevision<T>[]> {
    return (this.histories.get(memoryId) ?? []).map(revision => cloneRevision(revision) as AuthorityMemoryRevision<T>);
  }

  async listProjectRevisions<T = unknown>(projectId: string): Promise<AuthorityMemoryRevision<T>[]> {
    const project = projectId.trim();
    return Array.from(this.histories.values())
      .flat()
      .filter(revision => revision.projectId === project)
      .map(revision => cloneRevision(revision) as AuthorityMemoryRevision<T>)
      .sort(compareRevision);
  }

  appendRelation(relation: AuthorityMemoryRelation): Promise<AuthorityMemoryRelationAppendResult> {
    return this.enqueue(`relation:${relation.id}`, async () => {
      assertRelation(relation);
      const duplicate = this.relationByOperation.get(relation.operationKey);
      if (duplicate) {
        if (duplicate.contentHash !== relation.contentHash) {
          throw new Error(`MEMORY_RELATION_IDEMPOTENCY_CONFLICT key=${relation.operationKey}`);
        }
        return { relation: cloneRelation(duplicate), appended: false };
      }
      const collision = this.relations.get(relation.id);
      if (collision) {
        if (collision.contentHash !== relation.contentHash) {
          throw new Error(`MEMORY_RELATION_ID_COLLISION id=${relation.id}`);
        }
        return { relation: cloneRelation(collision), appended: false };
      }
      const stored = cloneRelation(relation);
      this.relations.set(relation.id, stored);
      this.relationByOperation.set(relation.operationKey, stored);
      return { relation: cloneRelation(stored), appended: true };
    });
  }

  async listProjectRelations(projectId: string): Promise<AuthorityMemoryRelation[]> {
    const project = projectId.trim();
    return Array.from(this.relations.values())
      .filter(relation => relation.projectId === project)
      .map(cloneRelation)
      .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.id.localeCompare(right.id));
  }

  private enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.operationTails.get(key) ?? Promise.resolve();
    const result = previous.then(operation);
    const tail = result.then(() => undefined, () => undefined);
    this.operationTails.set(key, tail);
    return result.finally(() => {
      if (this.operationTails.get(key) === tail) this.operationTails.delete(key);
    });
  }
}

/**
 * Authority memory service. `systemUntil` and effective superseded/contradicted
 * status are derived from immutable later facts; historical rows are never updated.
 */
export class AuthorityMemoryService {
  constructor(private readonly store: IAuthorityMemoryRevisionStore) {}

  async create<T>(input: AuthorityMemoryCreateInput<T>): Promise<AuthorityMemoryAppendResult<T>> {
    const normalized = normalizeCreate(input);
    const memoryIdentity = canonicalIdentity({
      scheme: 'agentic',
      authority: normalized.projectId,
      resourceType: 'memory',
      resourceId: normalized.identityKey,
    }, 'mem');
    const revision = sealRevision<T>({
      revisionId: revisionIdentity(normalized.projectId, String(memoryIdentity.id), 1, normalized.recordedAt),
      memoryId: String(memoryIdentity.id),
      operationKey: normalized.idempotencyKey,
      revision: 1,
      projectId: normalized.projectId,
      identityKey: normalized.identityKey,
      layer: normalized.layer,
      content: normalized.content,
      epistemicType: normalized.epistemicType,
      confidence: normalized.confidence,
      sensitivity: normalized.sensitivity,
      baseStatus: 'active',
      validFrom: normalized.validFrom,
      validUntil: normalized.validUntil,
      observedAt: normalized.observedAt,
      systemFrom: normalized.recordedAt,
      provenance: normalized.provenance,
      source: normalized.source,
      tags: normalized.tags,
      importance: normalized.importance,
      lastVerifiedAt: normalized.lastVerifiedAt,
      metadata: normalized.metadata,
      supersedesRevisionId: null,
    });
    return this.store.appendRevision(revision, 0);
  }

  async revise<T>(input: AuthorityMemoryReviseInput<T>): Promise<AuthorityMemoryAppendResult<T>> {
    const memoryId = nonEmpty(input.memoryId, 'memoryId');
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
      throw new Error('expectedRevision must be a positive safe integer');
    }
    const current = await this.store.getCurrent<T>(memoryId);
    if (!current) throw new Error(`Authority memory not found: ${memoryId}`);
    if (current.revision !== input.expectedRevision) {
      throw new Error(`STALE_MEMORY_REVISION expected=${input.expectedRevision} current=${current.revision}`);
    }
    const recordedAt = canonicalTime(input.recordedAt, 'memory revision recordedAt');
    if (Date.parse(recordedAt) <= Date.parse(current.systemFrom)) {
      throw new Error('memory revision recordedAt must be strictly greater than current systemFrom');
    }
    const changes = normalizeChanges(input.changes);
    const base = {
      revisionId: revisionIdentity(current.projectId, memoryId, current.revision + 1, recordedAt),
      memoryId,
      operationKey: nonEmpty(input.idempotencyKey, 'memory revision idempotencyKey'),
      revision: current.revision + 1,
      projectId: current.projectId,
      identityKey: current.identityKey,
      layer: changes.layer ?? current.layer,
      content: changes.hasContent ? changes.content as T : cloneJson(current.content),
      epistemicType: changes.epistemicType ?? current.epistemicType,
      confidence: changes.confidence ?? current.confidence,
      sensitivity: changes.sensitivity ?? current.sensitivity,
      baseStatus: changes.baseStatus ?? current.baseStatus,
      validFrom: changes.validFrom ?? current.validFrom,
      validUntil: changes.hasValidUntil ? changes.validUntil : current.validUntil,
      observedAt: changes.observedAt ?? current.observedAt,
      systemFrom: recordedAt,
      provenance: changes.provenance ?? cloneProvenance(current.provenance),
      source: current.source,
      tags: changes.tags ?? [...current.tags],
      importance: changes.importance ?? current.importance,
      lastVerifiedAt: changes.hasLastVerifiedAt ? changes.lastVerifiedAt : current.lastVerifiedAt,
      metadata: changes.metadata ?? cloneJson(current.metadata),
      supersedesRevisionId: current.revisionId,
    };
    return this.store.appendRevision(sealRevision<T>(base), current.revision);
  }

  async retract(
    memoryId: string,
    expectedRevision: number,
    recordedAt: string,
    idempotencyKey: string,
    provenance: ProvenanceRef[],
  ): Promise<AuthorityMemoryAppendResult> {
    return this.revise({
      memoryId,
      expectedRevision,
      recordedAt,
      idempotencyKey,
      changes: { baseStatus: 'retracted', provenance },
    });
  }

  async relate(input: AuthorityMemoryRelationInput): Promise<AuthorityMemoryRelationAppendResult> {
    const projectId = nonEmpty(input.projectId, 'memory relation projectId');
    const from = await this.store.getCurrent(input.fromMemoryId);
    const to = await this.store.getCurrent(input.toMemoryId);
    if (!from || !to) throw new Error('Memory relation endpoints must exist');
    if (from.projectId !== projectId || to.projectId !== projectId) {
      throw new Error('CROSS_PROJECT_MEMORY_RELATION_REJECTED');
    }
    if (from.memoryId === to.memoryId) throw new Error('Memory relation cannot self-reference');
    const minimumSensitivity = maxSensitivity(from.sensitivity, to.sensitivity);
    const sensitivity = input.sensitivity ?? minimumSensitivity;
    if (SENSITIVITY_ORDER[sensitivity] < SENSITIVITY_ORDER[minimumSensitivity]) {
      throw new Error(`MEMORY_RELATION_SENSITIVITY_DOWNGRADE required=${minimumSensitivity} requested=${sensitivity}`);
    }
    const recordedAt = canonicalTime(input.recordedAt, 'memory relation recordedAt');
    const identityKey = nonEmpty(input.identityKey ?? 'default', 'memory relation identityKey');
    const provenance = normalizeProvenance(input.provenance);
    const confidence = unit(input.confidence ?? 1, 'memory relation confidence');
    const metadata = canonicalJson(input.metadata ?? {}, 'memory relation metadata');
    const id = `mrel_${stableHash128({
      projectId,
      type: input.type,
      from: from.memoryId,
      to: to.memoryId,
      identityKey,
      recordedAt,
    })}`;
    const relation = sealRelation({
      id,
      operationKey: nonEmpty(input.idempotencyKey, 'memory relation idempotencyKey'),
      projectId,
      type: input.type,
      fromMemoryId: from.memoryId,
      toMemoryId: to.memoryId,
      identityKey,
      confidence,
      sensitivity,
      provenance,
      recordedAt,
      metadata,
    });
    return this.store.appendRelation(relation);
  }

  async current<T = unknown>(memoryId: string): Promise<AuthorityMemoryView<T> | null> {
    const history = await this.store.getHistory<T>(memoryId);
    if (!history.length) return null;
    const relations = await this.store.listProjectRelations(history[0].projectId);
    return viewsForHistory(history, relations).at(-1) ?? null;
  }

  async history<T = unknown>(memoryId: string): Promise<AuthorityMemoryView<T>[]> {
    const history = await this.store.getHistory<T>(memoryId);
    if (!history.length) return [];
    const relations = await this.store.listProjectRelations(history[0].projectId);
    return viewsForHistory(history, relations);
  }

  async query<T = unknown>(query: AuthorityMemoryQuery): Promise<AuthorityMemoryView<T>[]> {
    const normalized = normalizeQuery(query);
    const revisions = await this.store.listProjectRevisions<T>(normalized.projectId);
    const relations = (await this.store.listProjectRelations(normalized.projectId))
      .filter(relation => Date.parse(relation.recordedAt) <= normalized.knownAtMs)
      .filter(relation => SENSITIVITY_ORDER[relation.sensitivity] <= SENSITIVITY_ORDER[normalized.maxSensitivity]);
    const byMemory = new Map<string, AuthorityMemoryRevision<T>[]>();
    for (const revision of revisions) {
      let bucket = byMemory.get(revision.memoryId);
      if (!bucket) { bucket = []; byMemory.set(revision.memoryId, bucket); }
      bucket.push(revision);
    }

    const selected: AuthorityMemoryView<T>[] = [];
    for (const history of byMemory.values()) {
      history.sort(compareRevision);
      const visibleIndex = findKnownRevisionIndex(history, normalized.knownAtMs);
      if (visibleIndex < 0) continue;
      const revision = history[visibleIndex];
      const view = toView(revision, history[visibleIndex + 1]?.systemFrom ?? null, relations);
      if (!domainVisible(view, normalized.asOfMs)) continue;
      if (SENSITIVITY_ORDER[view.sensitivity] > SENSITIVITY_ORDER[normalized.maxSensitivity]) continue;
      if (normalized.layers?.length && !normalized.layers.includes(view.layer)) continue;
      if (normalized.epistemicTypes?.length && !normalized.epistemicTypes.includes(view.epistemicType)) continue;
      if (normalized.statuses?.length && !normalized.statuses.includes(view.effectiveStatus)) continue;
      if (normalized.tags?.length && !normalized.tags.some(tag => view.tags.includes(tag))) continue;
      if (normalized.minConfidence !== undefined && view.confidence < normalized.minConfidence) continue;
      if (normalized.minImportance !== undefined && view.importance < normalized.minImportance) continue;
      selected.push(view);
    }

    selected.sort((left, right) =>
      right.importance - left.importance
      || right.confidence - left.confidence
      || left.memoryId.localeCompare(right.memoryId));
    return selected.slice(normalized.offset, normalized.offset + normalized.limit);
  }
}

function normalizeCreate<T>(input: AuthorityMemoryCreateInput<T>) {
  const projectId = nonEmpty(input.projectId, 'memory projectId');
  const identityKey = nonEmpty(input.identityKey, 'memory identityKey');
  const validFrom = canonicalTime(input.validFrom, 'memory validFrom');
  const validUntil = input.validUntil === undefined || input.validUntil === null
    ? null
    : canonicalTime(input.validUntil, 'memory validUntil');
  if (validUntil && Date.parse(validUntil) <= Date.parse(validFrom)) throw new Error('memory validUntil must be after validFrom');
  const observedAt = canonicalTime(input.observedAt, 'memory observedAt');
  const recordedAt = canonicalTime(input.recordedAt, 'memory recordedAt');
  if (Date.parse(recordedAt) < Date.parse(observedAt)) throw new Error('memory recordedAt cannot precede observedAt');
  const content = canonicalJson(input.content, 'memory content') as T;
  return {
    projectId,
    identityKey,
    layer: input.layer,
    content,
    epistemicType: input.epistemicType,
    confidence: unit(input.confidence, 'memory confidence'),
    sensitivity: input.sensitivity ?? 'internal' as AuthorityMemorySensitivity,
    validFrom,
    validUntil,
    observedAt,
    recordedAt,
    provenance: normalizeProvenance(input.provenance),
    source: nonEmpty(input.source, 'memory source'),
    tags: normalizeTags(input.tags ?? []),
    importance: unit(input.importance ?? 0.5, 'memory importance'),
    lastVerifiedAt: input.lastVerifiedAt === undefined || input.lastVerifiedAt === null
      ? null
      : canonicalTime(input.lastVerifiedAt, 'memory lastVerifiedAt'),
    metadata: canonicalJson(input.metadata ?? {}, 'memory metadata') as Record<string, unknown>,
    idempotencyKey: nonEmpty(input.idempotencyKey, 'memory idempotencyKey'),
  };
}

function normalizeChanges<T>(changes: AuthorityMemoryRevisionChanges<T>) {
  const hasContent = Object.prototype.hasOwnProperty.call(changes, 'content');
  const hasValidUntil = Object.prototype.hasOwnProperty.call(changes, 'validUntil');
  const hasLastVerifiedAt = Object.prototype.hasOwnProperty.call(changes, 'lastVerifiedAt');
  return {
    layer: changes.layer,
    hasContent,
    content: hasContent ? canonicalJson(changes.content, 'memory revision content') as T : undefined,
    epistemicType: changes.epistemicType,
    confidence: changes.confidence === undefined ? undefined : unit(changes.confidence, 'memory revision confidence'),
    sensitivity: changes.sensitivity,
    baseStatus: changes.baseStatus,
    validFrom: changes.validFrom === undefined ? undefined : canonicalTime(changes.validFrom, 'memory revision validFrom'),
    hasValidUntil,
    validUntil: !hasValidUntil || changes.validUntil === null || changes.validUntil === undefined
      ? null
      : canonicalTime(changes.validUntil, 'memory revision validUntil'),
    observedAt: changes.observedAt === undefined ? undefined : canonicalTime(changes.observedAt, 'memory revision observedAt'),
    provenance: changes.provenance === undefined ? undefined : normalizeProvenance(changes.provenance),
    tags: changes.tags === undefined ? undefined : normalizeTags(changes.tags),
    importance: changes.importance === undefined ? undefined : unit(changes.importance, 'memory revision importance'),
    hasLastVerifiedAt,
    lastVerifiedAt: !hasLastVerifiedAt || changes.lastVerifiedAt === null || changes.lastVerifiedAt === undefined
      ? null
      : canonicalTime(changes.lastVerifiedAt, 'memory revision lastVerifiedAt'),
    metadata: changes.metadata === undefined
      ? undefined
      : canonicalJson(changes.metadata, 'memory revision metadata') as Record<string, unknown>,
  };
}

function normalizeQuery(query: AuthorityMemoryQuery) {
  const asOf = canonicalTime(query.asOf, 'memory query asOf');
  const knownAt = canonicalTime(query.knownAt, 'memory query knownAt');
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000) throw new Error('memory query limit must be in [1,10000]');
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('memory query offset must be non-negative');
  return {
    ...query,
    projectId: nonEmpty(query.projectId, 'memory query projectId'),
    asOf,
    knownAt,
    asOfMs: Date.parse(asOf),
    knownAtMs: Date.parse(knownAt),
    maxSensitivity: query.maxSensitivity ?? 'internal' as AuthorityMemorySensitivity,
    minConfidence: query.minConfidence === undefined ? undefined : unit(query.minConfidence, 'query minConfidence'),
    minImportance: query.minImportance === undefined ? undefined : unit(query.minImportance, 'query minImportance'),
    limit,
    offset,
  };
}

function sealRevision<T>(base: Omit<AuthorityMemoryRevision<T>, 'contentHash'>): AuthorityMemoryRevision<T> {
  assertRevisionBase(base);
  return {
    ...base,
    content: cloneJson(base.content),
    provenance: cloneProvenance(base.provenance),
    tags: [...base.tags],
    metadata: cloneJson(base.metadata),
    contentHash: stableHash128(base),
  };
}

function sealRelation(base: Omit<AuthorityMemoryRelation, 'contentHash'>): AuthorityMemoryRelation {
  assertRelationBase(base);
  return {
    ...base,
    provenance: cloneProvenance(base.provenance),
    metadata: cloneJson(base.metadata),
    contentHash: stableHash128(base),
  };
}

function assertRevision(revision: AuthorityMemoryRevision): void {
  const { contentHash, ...base } = revision;
  assertRevisionBase(base);
  if (stableHash128(base) !== contentHash) throw new Error(`MEMORY_CONTENT_HASH_MISMATCH revision=${revision.revisionId}`);
}

function assertRevisionBase(base: Omit<AuthorityMemoryRevision, 'contentHash'>): void {
  nonEmpty(base.revisionId, 'revisionId');
  nonEmpty(base.memoryId, 'memoryId');
  nonEmpty(base.operationKey, 'operationKey');
  nonEmpty(base.projectId, 'projectId');
  nonEmpty(base.identityKey, 'identityKey');
  nonEmpty(base.source, 'source');
  if (!Number.isSafeInteger(base.revision) || base.revision < 1) throw new Error('memory revision must be positive');
  unit(base.confidence, 'memory confidence');
  unit(base.importance, 'memory importance');
  const validFrom = canonicalTime(base.validFrom, 'memory validFrom');
  if (base.validUntil && Date.parse(canonicalTime(base.validUntil, 'memory validUntil')) <= Date.parse(validFrom)) {
    throw new Error('memory validUntil must be after validFrom');
  }
  const observedAt = canonicalTime(base.observedAt, 'memory observedAt');
  const systemFrom = canonicalTime(base.systemFrom, 'memory systemFrom');
  if (Date.parse(systemFrom) < Date.parse(observedAt)) throw new Error('memory systemFrom cannot precede observedAt');
  if (base.lastVerifiedAt) canonicalTime(base.lastVerifiedAt, 'memory lastVerifiedAt');
  canonicalJson(base.content, 'memory content');
  canonicalJson(base.metadata, 'memory metadata');
  normalizeProvenance(base.provenance);
  normalizeTags(base.tags);
}

function assertRelation(relation: AuthorityMemoryRelation): void {
  const { contentHash, ...base } = relation;
  assertRelationBase(base);
  if (stableHash128(base) !== contentHash) throw new Error(`MEMORY_RELATION_HASH_MISMATCH id=${relation.id}`);
}

function assertRelationBase(base: Omit<AuthorityMemoryRelation, 'contentHash'>): void {
  nonEmpty(base.id, 'relation id');
  nonEmpty(base.operationKey, 'relation operationKey');
  nonEmpty(base.projectId, 'relation projectId');
  nonEmpty(base.fromMemoryId, 'relation fromMemoryId');
  nonEmpty(base.toMemoryId, 'relation toMemoryId');
  nonEmpty(base.identityKey, 'relation identityKey');
  if (base.fromMemoryId === base.toMemoryId) throw new Error('memory relation cannot self-reference');
  unit(base.confidence, 'memory relation confidence');
  canonicalTime(base.recordedAt, 'memory relation recordedAt');
  normalizeProvenance(base.provenance);
  canonicalJson(base.metadata, 'memory relation metadata');
}

function revisionIdentity(projectId: string, memoryId: string, revision: number, systemFrom: string): string {
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: projectId,
    resourceType: 'memory-revision',
    resourceId: `${memoryId}:${revision}:${systemFrom}`,
  }, 'mrev').id);
}

function viewsForHistory<T>(
  history: AuthorityMemoryRevision<T>[],
  relations: AuthorityMemoryRelation[],
): AuthorityMemoryView<T>[] {
  const sorted = [...history].sort(compareRevision);
  return sorted.map((revision, index) =>
    toView(revision, sorted[index + 1]?.systemFrom ?? null, relations.filter(relation =>
      Date.parse(relation.recordedAt) >= Date.parse(revision.systemFrom))),
  );
}

function toView<T>(
  revision: AuthorityMemoryRevision<T>,
  systemUntil: string | null,
  relations: AuthorityMemoryRelation[],
): AuthorityMemoryView<T> {
  return {
    ...cloneRevision(revision),
    systemUntil,
    effectiveStatus: effectiveStatus(revision, relations),
  };
}

function effectiveStatus(
  revision: AuthorityMemoryRevision,
  relations: AuthorityMemoryRelation[],
): AuthorityMemoryEffectiveStatus {
  if (revision.baseStatus === 'retracted') return 'retracted';
  const relevant = relations.filter(relation => relation.toMemoryId === revision.memoryId);
  if (relevant.some(relation => relation.type === 'supersedes')) return 'superseded';
  if (relevant.some(relation => relation.type === 'contradicts')) return 'contradicted';
  return 'active';
}

function findKnownRevisionIndex<T>(history: AuthorityMemoryRevision<T>[], knownAtMs: number): number {
  let selected = -1;
  for (let index = 0; index < history.length; index += 1) {
    if (Date.parse(history[index].systemFrom) <= knownAtMs) selected = index;
    else break;
  }
  return selected;
}

function domainVisible(revision: AuthorityMemoryRevision, asOfMs: number): boolean {
  if (Date.parse(revision.validFrom) > asOfMs) return false;
  if (revision.validUntil && Date.parse(revision.validUntil) <= asOfMs) return false;
  return true;
}

function compareRevision(left: AuthorityMemoryRevision, right: AuthorityMemoryRevision): number {
  return left.memoryId.localeCompare(right.memoryId)
    || left.revision - right.revision
    || left.systemFrom.localeCompare(right.systemFrom);
}

function cloneRevision<T>(revision: AuthorityMemoryRevision<T>): AuthorityMemoryRevision<T> {
  return {
    ...revision,
    content: cloneJson(revision.content),
    provenance: cloneProvenance(revision.provenance),
    tags: [...revision.tags],
    metadata: cloneJson(revision.metadata),
  };
}

function cloneRelation(relation: AuthorityMemoryRelation): AuthorityMemoryRelation {
  return {
    ...relation,
    provenance: cloneProvenance(relation.provenance),
    metadata: cloneJson(relation.metadata),
  };
}

function normalizeProvenance(provenance: ProvenanceRef[]): ProvenanceRef[] {
  if (!Array.isArray(provenance) || provenance.length === 0) throw new Error('authority memory requires provenance');
  return provenance.map((item, index) => ({
    source: nonEmpty(item.source, `provenance[${index}].source`),
    revision: item.revision === undefined ? undefined : nonEmpty(item.revision, `provenance[${index}].revision`),
    actor: item.actor === undefined ? undefined : nonEmpty(item.actor, `provenance[${index}].actor`),
    locator: item.locator === undefined ? undefined : nonEmpty(item.locator, `provenance[${index}].locator`),
  }));
}

function cloneProvenance(provenance: ProvenanceRef[]): ProvenanceRef[] {
  return provenance.map(item => ({ ...item }));
}

function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag, index) => nonEmpty(tag, `tag[${index}]`)))).sort();
}

function maxSensitivity(
  left: AuthorityMemorySensitivity,
  right: AuthorityMemorySensitivity,
): AuthorityMemorySensitivity {
  return SENSITIVITY_ORDER[left] >= SENSITIVITY_ORDER[right] ? left : right;
}

function unit(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be in [0,1]`);
  return value;
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

function canonicalJson<T>(value: T, path: string): T {
  assertCanonicalJson(value, path);
  return cloneJson(value);
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

function assertCanonicalJson(value: unknown, path: string, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`);
    return;
  }
  if (typeof value !== 'object') throw new Error(`${path} contains unsupported ${typeof value}`);
  if (seen.has(value as object)) throw new Error(`${path} contains a cycle`);
  seen.add(value as object);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertCanonicalJson(item, `${path}[${index}]`, seen));
    seen.delete(value as object);
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${path} contains a non-plain object`);
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    assertCanonicalJson(item, `${path}.${key}`, seen);
  }
  seen.delete(value as object);
}
