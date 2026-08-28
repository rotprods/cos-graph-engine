import {
  canonicalIdentity,
  stableHash128,
  type ProvenanceRef,
} from '@cos/core';
import {
  AuthorityMemoryService,
  type AuthorityMemoryAppendResult,
  type AuthorityMemoryCreateInput,
  type AuthorityMemoryQuery,
  type AuthorityMemoryRelation,
  type AuthorityMemoryRelationAppendResult,
  type AuthorityMemoryRelationInput,
  type AuthorityMemoryRevision,
  type AuthorityMemoryReviseInput,
  type AuthorityMemorySensitivity,
  type AuthorityMemoryView,
  type IAuthorityMemoryRevisionStore,
} from './authority-memory';

const SENSITIVITY_ORDER: Record<AuthorityMemorySensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

/**
 * Canonical authority entrypoint over the append-only memory ledger.
 *
 * The lower-level `AuthorityMemoryService` remains a construction/query helper.
 * This coordinator adds the cross-operation guarantees needed at the authority
 * boundary:
 *
 * - a late transport retry of an already accepted revision returns that exact
 *   historical result even if newer revisions now exist;
 * - reuse of the same idempotency key with different semantics fails closed;
 * - new stale writes remain rejected;
 * - relation sensitivity is derived from endpoint revisions that were known at
 *   the relation's recordedAt, never from future endpoint state;
 * - relation retries remain stable after endpoints are later reclassified.
 */
export class AuthorityMemoryCoordinator {
  private readonly base: AuthorityMemoryService;

  constructor(private readonly store: IAuthorityMemoryRevisionStore) {
    this.base = new AuthorityMemoryService(store);
  }

  create<T>(input: AuthorityMemoryCreateInput<T>): Promise<AuthorityMemoryAppendResult<T>> {
    return this.base.create(input);
  }

  async revise<T>(input: AuthorityMemoryReviseInput<T>): Promise<AuthorityMemoryAppendResult<T>> {
    const memoryId = nonEmpty(input.memoryId, 'memoryId');
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
      throw new Error('expectedRevision must be a positive safe integer');
    }
    const operationKey = nonEmpty(input.idempotencyKey, 'memory revision idempotencyKey');
    const history = await this.store.getHistory<T>(memoryId);
    if (!history.length) throw new Error(`Authority memory not found: ${memoryId}`);
    const parent = history.find(revision => revision.revision === input.expectedRevision);
    if (!parent) {
      const current = history.at(-1)!.revision;
      throw new Error(`STALE_MEMORY_REVISION expected=${input.expectedRevision} current=${current}`);
    }

    const candidate = buildRevisionCandidate(parent, input, operationKey);
    const accepted = history.find(revision => revision.operationKey === operationKey);
    if (accepted) {
      if (accepted.contentHash !== candidate.contentHash || accepted.revisionId !== candidate.revisionId) {
        throw new Error(`MEMORY_IDEMPOTENCY_CONFLICT key=${operationKey}`);
      }
      return { revision: cloneRevision(accepted), appended: false };
    }

    // The store owns the final CAS. If another unrelated revision already moved
    // the head, appendRevision rejects the stale expectedCurrentRevision.
    return this.store.appendRevision(candidate, input.expectedRevision);
  }

  retract(
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
    const operationKey = nonEmpty(input.idempotencyKey, 'memory relation idempotencyKey');
    const recordedAt = canonicalTime(input.recordedAt, 'memory relation recordedAt');
    const fromHistory = await this.store.getHistory(input.fromMemoryId);
    const toHistory = await this.store.getHistory(input.toMemoryId);
    const from = revisionKnownAt(fromHistory, recordedAt);
    const to = revisionKnownAt(toHistory, recordedAt);
    if (!from || !to) throw new Error('Memory relation endpoints must exist at recordedAt');
    if (from.projectId !== projectId || to.projectId !== projectId) {
      throw new Error('CROSS_PROJECT_MEMORY_RELATION_REJECTED');
    }
    if (from.memoryId === to.memoryId) throw new Error('Memory relation cannot self-reference');

    const minimumSensitivity = maxSensitivity(from.sensitivity, to.sensitivity);
    const sensitivity = input.sensitivity ?? minimumSensitivity;
    if (SENSITIVITY_ORDER[sensitivity] < SENSITIVITY_ORDER[minimumSensitivity]) {
      throw new Error(`MEMORY_RELATION_SENSITIVITY_DOWNGRADE required=${minimumSensitivity} requested=${sensitivity}`);
    }
    const identityKey = nonEmpty(input.identityKey ?? 'default', 'memory relation identityKey');
    const confidence = unit(input.confidence ?? 1, 'memory relation confidence');
    const provenance = normalizeProvenance(input.provenance);
    const metadata = canonicalJson(input.metadata ?? {}, 'memory relation metadata') as Record<string, unknown>;
    const id = `mrel_${stableHash128({
      projectId,
      type: input.type,
      from: from.memoryId,
      to: to.memoryId,
      identityKey,
      recordedAt,
    })}`;
    const candidate = sealRelation({
      id,
      operationKey,
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

    const accepted = (await this.store.listProjectRelations(projectId))
      .find(relation => relation.operationKey === operationKey);
    if (accepted) {
      if (accepted.contentHash !== candidate.contentHash || accepted.id !== candidate.id) {
        throw new Error(`MEMORY_RELATION_IDEMPOTENCY_CONFLICT key=${operationKey}`);
      }
      return { relation: cloneRelation(accepted), appended: false };
    }
    return this.store.appendRelation(candidate);
  }

  current<T = unknown>(memoryId: string): Promise<AuthorityMemoryView<T> | null> {
    return this.base.current<T>(memoryId);
  }

  history<T = unknown>(memoryId: string): Promise<AuthorityMemoryView<T>[]> {
    return this.base.history<T>(memoryId);
  }

  query<T = unknown>(query: AuthorityMemoryQuery): Promise<AuthorityMemoryView<T>[]> {
    return this.base.query<T>(query);
  }
}

function buildRevisionCandidate<T>(
  parent: AuthorityMemoryRevision<T>,
  input: AuthorityMemoryReviseInput<T>,
  operationKey: string,
): AuthorityMemoryRevision<T> {
  const recordedAt = canonicalTime(input.recordedAt, 'memory revision recordedAt');
  if (Date.parse(recordedAt) <= Date.parse(parent.systemFrom)) {
    throw new Error('memory revision recordedAt must be strictly greater than parent systemFrom');
  }
  const changes = normalizeChanges(input.changes);
  const base = {
    revisionId: revisionIdentity(parent.projectId, parent.memoryId, parent.revision + 1, recordedAt),
    memoryId: parent.memoryId,
    operationKey,
    revision: parent.revision + 1,
    projectId: parent.projectId,
    identityKey: parent.identityKey,
    layer: changes.layer ?? parent.layer,
    content: changes.hasContent ? changes.content as T : cloneJson(parent.content),
    epistemicType: changes.epistemicType ?? parent.epistemicType,
    confidence: changes.confidence ?? parent.confidence,
    sensitivity: changes.sensitivity ?? parent.sensitivity,
    baseStatus: changes.baseStatus ?? parent.baseStatus,
    validFrom: changes.validFrom ?? parent.validFrom,
    validUntil: changes.hasValidUntil ? changes.validUntil : parent.validUntil,
    observedAt: changes.observedAt ?? parent.observedAt,
    systemFrom: recordedAt,
    provenance: changes.provenance ?? cloneProvenance(parent.provenance),
    source: parent.source,
    tags: changes.tags ?? [...parent.tags],
    importance: changes.importance ?? parent.importance,
    lastVerifiedAt: changes.hasLastVerifiedAt ? changes.lastVerifiedAt : parent.lastVerifiedAt,
    metadata: changes.metadata ?? cloneJson(parent.metadata),
    supersedesRevisionId: parent.revisionId,
  };
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

function revisionKnownAt<T>(history: AuthorityMemoryRevision<T>[], recordedAt: string): AuthorityMemoryRevision<T> | null {
  const cutoff = Date.parse(recordedAt);
  let selected: AuthorityMemoryRevision<T> | null = null;
  for (const revision of [...history].sort((a, b) => a.revision - b.revision)) {
    if (Date.parse(revision.systemFrom) <= cutoff) selected = revision;
    else break;
  }
  return selected ? cloneRevision(selected) : null;
}

function normalizeChanges<T>(changes: AuthorityMemoryReviseInput<T>['changes']) {
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

function sealRelation(base: Omit<AuthorityMemoryRelation, 'contentHash'>): AuthorityMemoryRelation {
  return {
    ...base,
    provenance: cloneProvenance(base.provenance),
    metadata: cloneJson(base.metadata),
    contentHash: stableHash128(base),
  };
}

function revisionIdentity(projectId: string, memoryId: string, revision: number, systemFrom: string): string {
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: projectId,
    resourceType: 'memory-revision',
    resourceId: `${memoryId}:${revision}:${systemFrom}`,
  }, 'mrev').id);
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

function maxSensitivity(left: AuthorityMemorySensitivity, right: AuthorityMemorySensitivity): AuthorityMemorySensitivity {
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
