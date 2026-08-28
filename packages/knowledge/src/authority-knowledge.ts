import {
  canonicalHash128,
  canonicalIdentity,
  canonicalizeJsonValue,
  type EntityId,
  type EpistemicType,
  type IPropertyGraph,
  type ProvenanceRef,
} from '@cos/core';
import { PropertyGraph } from './property-graph';

export type AuthorityKnowledgeSensitivity = 'public' | 'internal' | 'private' | 'restricted';
export type AuthorityKnowledgeBaseStatus = 'active' | 'retracted';

const SENSITIVITY_ORDER: Record<AuthorityKnowledgeSensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

export interface AuthorityKnowledgeRevision {
  revisionId: string;
  statementId: string;
  operationKey: string;
  operationHash: string;
  revision: number;
  projectId: string;
  identityKey: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  epistemicType: EpistemicType;
  sensitivity: AuthorityKnowledgeSensitivity;
  baseStatus: AuthorityKnowledgeBaseStatus;
  /** Domain-valid interval. Independent from transaction/system supersession. */
  validFrom: string;
  validUntil: string | null;
  observedAt: string;
  /** Transaction/system time when this immutable revision became known. */
  systemFrom: string;
  provenance: ProvenanceRef[];
  source: string;
  metadata: Record<string, string | number | boolean | null>;
  supersedesRevisionId: string | null;
  contentHash: string;
}

export interface AuthorityKnowledgeView extends AuthorityKnowledgeRevision {
  /** Derived from visible successor revisions, never persisted. */
  systemUntil: string | null;
}

export interface AuthorityKnowledgeCreateInput {
  projectId: string;
  identityKey: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  epistemicType?: EpistemicType;
  sensitivity?: AuthorityKnowledgeSensitivity;
  validFrom: string;
  validUntil?: string | null;
  observedAt: string;
  recordedAt: string;
  provenance: ProvenanceRef[];
  source: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  idempotencyKey: string;
}

export interface AuthorityKnowledgeRevisionChanges {
  subject?: string;
  predicate?: string;
  object?: string;
  confidence?: number;
  epistemicType?: EpistemicType;
  sensitivity?: AuthorityKnowledgeSensitivity;
  baseStatus?: AuthorityKnowledgeBaseStatus;
  validFrom?: string;
  validUntil?: string | null;
  observedAt?: string;
  provenance?: ProvenanceRef[];
  source?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface AuthorityKnowledgeReviseInput {
  statementId: string;
  expectedRevision: number;
  recordedAt: string;
  idempotencyKey: string;
  changes: AuthorityKnowledgeRevisionChanges;
}

export interface AuthorityKnowledgeQuery {
  projectId: string;
  asOf: string;
  knownAt: string;
  subject?: string;
  predicate?: string;
  object?: string;
  epistemicTypes?: EpistemicType[];
  minConfidence?: number;
  maxSensitivity?: AuthorityKnowledgeSensitivity;
  includeRetracted?: boolean;
  limit?: number;
  offset?: number;
}

export interface AuthorityKnowledgeAppendResult {
  revision: AuthorityKnowledgeRevision;
  appended: boolean;
}

export interface IAuthorityKnowledgeRevisionStore {
  appendRevision(
    revision: AuthorityKnowledgeRevision,
    expectedCurrentRevision: number,
  ): Promise<AuthorityKnowledgeAppendResult>;
  getByOperation(operationKey: string): Promise<AuthorityKnowledgeRevision | null>;
  getCurrent(statementId: string): Promise<AuthorityKnowledgeRevision | null>;
  getHistory(statementId: string): Promise<AuthorityKnowledgeRevision[]>;
  listProjectRevisions(projectId: string): Promise<AuthorityKnowledgeRevision[]>;
}

export class InMemoryAuthorityKnowledgeStore implements IAuthorityKnowledgeRevisionStore {
  private readonly histories = new Map<string, AuthorityKnowledgeRevision[]>();
  private readonly byOperation = new Map<string, AuthorityKnowledgeRevision>();
  private readonly byRevisionId = new Map<string, AuthorityKnowledgeRevision>();
  private readonly tails = new Map<string, Promise<void>>();

  appendRevision(
    revision: AuthorityKnowledgeRevision,
    expectedCurrentRevision: number,
  ): Promise<AuthorityKnowledgeAppendResult> {
    return this.enqueue(revision.statementId, async () => {
      assertRevision(revision);
      const duplicate = this.byOperation.get(revision.operationKey);
      if (duplicate) {
        if (duplicate.operationHash !== revision.operationHash) {
          throw new Error(`KNOWLEDGE_IDEMPOTENCY_CONFLICT key=${revision.operationKey}`);
        }
        return { revision: cloneRevision(duplicate), appended: false };
      }

      const history = this.histories.get(revision.statementId) ?? [];
      const current = history.at(-1);
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== expectedCurrentRevision) {
        throw new Error(`STALE_KNOWLEDGE_REVISION expected=${expectedCurrentRevision} current=${currentRevision}`);
      }
      if (revision.revision !== currentRevision + 1) {
        throw new Error(`KNOWLEDGE_REVISION_SEQUENCE expected=${currentRevision + 1} incoming=${revision.revision}`);
      }
      if (current) {
        if (revision.supersedesRevisionId !== current.revisionId) {
          throw new Error(`KNOWLEDGE_REVISION_PARENT_MISMATCH statement=${revision.statementId}`);
        }
        if (Date.parse(revision.systemFrom) <= Date.parse(current.systemFrom)) {
          throw new Error(`KNOWLEDGE_SYSTEM_TIME_NOT_MONOTONIC statement=${revision.statementId}`);
        }
      } else if (revision.supersedesRevisionId !== null) {
        throw new Error(`KNOWLEDGE_INITIAL_REVISION_HAS_PARENT statement=${revision.statementId}`);
      }

      const collision = this.byRevisionId.get(revision.revisionId);
      if (collision && collision.contentHash !== revision.contentHash) {
        throw new Error(`KNOWLEDGE_REVISION_ID_COLLISION id=${revision.revisionId}`);
      }

      const stored = cloneRevision(revision);
      history.push(stored);
      this.histories.set(revision.statementId, history);
      this.byOperation.set(revision.operationKey, stored);
      this.byRevisionId.set(revision.revisionId, stored);
      return { revision: cloneRevision(stored), appended: true };
    });
  }

  async getByOperation(operationKey: string): Promise<AuthorityKnowledgeRevision | null> {
    const revision = this.byOperation.get(nonEmpty(operationKey, 'operationKey'));
    return revision ? cloneRevision(revision) : null;
  }

  async getCurrent(statementId: string): Promise<AuthorityKnowledgeRevision | null> {
    const current = this.histories.get(nonEmpty(statementId, 'statementId'))?.at(-1);
    return current ? cloneRevision(current) : null;
  }

  async getHistory(statementId: string): Promise<AuthorityKnowledgeRevision[]> {
    return (this.histories.get(nonEmpty(statementId, 'statementId')) ?? []).map(cloneRevision);
  }

  async listProjectRevisions(projectId: string): Promise<AuthorityKnowledgeRevision[]> {
    const project = nonEmpty(projectId, 'projectId');
    return Array.from(this.histories.values())
      .flat()
      .filter(revision => revision.projectId === project)
      .map(cloneRevision)
      .sort(compareRevision);
  }

  private enqueue<T>(statementId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(statementId) ?? Promise.resolve();
    const result = previous.then(operation);
    const tail = result.then(() => undefined, () => undefined);
    this.tails.set(statementId, tail);
    return result.finally(() => {
      if (this.tails.get(statementId) === tail) this.tails.delete(statementId);
    });
  }
}

export class AuthorityKnowledgeGateway {
  constructor(private readonly store: IAuthorityKnowledgeRevisionStore) {}

  async create(input: AuthorityKnowledgeCreateInput): Promise<AuthorityKnowledgeAppendResult> {
    const normalized = normalizeCreate(input);
    const operationHash = canonicalHash128({ kind: 'create', ...normalized });
    const duplicate = await this.store.getByOperation(normalized.idempotencyKey);
    if (duplicate) return duplicateOperation(duplicate, operationHash);

    const identity = canonicalIdentity({
      scheme: 'agentic',
      authority: normalized.projectId,
      resourceType: 'knowledge-statement',
      resourceId: normalized.identityKey,
    }, 'knw');
    const statementId = String(identity.id);
    const existing = await this.store.getCurrent(statementId);
    if (existing) throw new Error(`KNOWLEDGE_IDENTITY_ALREADY_EXISTS statement=${statementId}`);

    const revision = sealRevision({
      revisionId: revisionIdentity(statementId, 1, normalized.recordedAt),
      statementId,
      operationKey: normalized.idempotencyKey,
      operationHash,
      revision: 1,
      projectId: normalized.projectId,
      identityKey: normalized.identityKey,
      subject: normalized.subject,
      predicate: normalized.predicate,
      object: normalized.object,
      confidence: normalized.confidence,
      epistemicType: normalized.epistemicType,
      sensitivity: normalized.sensitivity,
      baseStatus: 'active',
      validFrom: normalized.validFrom,
      validUntil: normalized.validUntil,
      observedAt: normalized.observedAt,
      systemFrom: normalized.recordedAt,
      provenance: normalized.provenance,
      source: normalized.source,
      metadata: normalized.metadata,
      supersedesRevisionId: null,
    });
    return this.store.appendRevision(revision, 0);
  }

  async revise(input: AuthorityKnowledgeReviseInput): Promise<AuthorityKnowledgeAppendResult> {
    const normalized = normalizeRevise(input);
    const operationHash = canonicalHash128({ kind: 'revise', ...normalized });
    const duplicate = await this.store.getByOperation(normalized.idempotencyKey);
    if (duplicate) return duplicateOperation(duplicate, operationHash);

    const current = await this.store.getCurrent(normalized.statementId);
    if (!current) throw new Error(`KNOWLEDGE_STATEMENT_NOT_FOUND id=${normalized.statementId}`);
    if (current.revision !== normalized.expectedRevision) {
      throw new Error(`STALE_KNOWLEDGE_REVISION expected=${normalized.expectedRevision} current=${current.revision}`);
    }
    if (Date.parse(normalized.recordedAt) <= Date.parse(current.systemFrom)) {
      throw new Error(`KNOWLEDGE_SYSTEM_TIME_NOT_MONOTONIC statement=${normalized.statementId}`);
    }

    const changes = normalized.changes;
    const next = sealRevision({
      ...cloneRevision(current),
      revisionId: revisionIdentity(current.statementId, current.revision + 1, normalized.recordedAt),
      operationKey: normalized.idempotencyKey,
      operationHash,
      revision: current.revision + 1,
      subject: changes.subject ?? current.subject,
      predicate: changes.predicate ?? current.predicate,
      object: changes.object ?? current.object,
      confidence: changes.confidence ?? current.confidence,
      epistemicType: changes.epistemicType ?? current.epistemicType,
      sensitivity: changes.sensitivity ?? current.sensitivity,
      baseStatus: changes.baseStatus ?? current.baseStatus,
      validFrom: changes.validFrom ?? current.validFrom,
      validUntil: changes.validUntil === undefined ? current.validUntil : changes.validUntil,
      observedAt: changes.observedAt ?? current.observedAt,
      systemFrom: normalized.recordedAt,
      provenance: changes.provenance ?? current.provenance,
      source: changes.source ?? current.source,
      metadata: changes.metadata ?? current.metadata,
      supersedesRevisionId: current.revisionId,
    });
    return this.store.appendRevision(next, normalized.expectedRevision);
  }

  async query(query: AuthorityKnowledgeQuery): Promise<AuthorityKnowledgeView[]> {
    const normalized = normalizeQuery(query);
    const revisions = await this.store.listProjectRevisions(normalized.projectId);
    const histories = groupHistories(revisions);
    const results: AuthorityKnowledgeView[] = [];

    for (const history of histories.values()) {
      const visible = history.filter(revision => revision.systemFrom <= normalized.knownAt);
      const current = visible.at(-1);
      if (!current) continue;
      const systemUntil = visible.length > 1 ? null : null;
      const view: AuthorityKnowledgeView = { ...cloneRevision(current), systemUntil };
      if (!normalized.includeRetracted && view.baseStatus === 'retracted') continue;
      if (!validAt(view, normalized.asOf)) continue;
      if (SENSITIVITY_ORDER[view.sensitivity] > SENSITIVITY_ORDER[normalized.maxSensitivity]) continue;
      if (view.confidence < normalized.minConfidence) continue;
      if (normalized.epistemicTypes && !normalized.epistemicTypes.includes(view.epistemicType)) continue;
      if (normalized.subject && !view.subject.toLowerCase().includes(normalized.subject.toLowerCase())) continue;
      if (normalized.predicate && !view.predicate.toLowerCase().includes(normalized.predicate.toLowerCase())) continue;
      if (normalized.object && !view.object.toLowerCase().includes(normalized.object.toLowerCase())) continue;
      results.push(view);
    }

    return results
      .sort((a, b) => b.confidence - a.confidence || a.statementId.localeCompare(b.statementId))
      .slice(normalized.offset, normalized.offset + normalized.limit)
      .map(cloneView);
  }

  async history(statementId: string): Promise<AuthorityKnowledgeView[]> {
    const history = (await this.store.getHistory(statementId)).sort(compareRevision);
    return history.map((revision, index) => ({
      ...cloneRevision(revision),
      systemUntil: history[index + 1]?.systemFrom ?? null,
    }));
  }
}

export interface KnowledgeProjectionFailure {
  revisionId: string;
  statementId: string;
  recordedAt: string;
  error: string;
}

/**
 * Derived graph projection. Authority is the revision ledger; graph state can be
 * discarded and rebuilt from the ledger without redefining truth.
 */
export class AuthorityKnowledgeProjector {
  constructor(private readonly graph: IPropertyGraph = new PropertyGraph()) {}

  async project(revision: AuthorityKnowledgeRevision): Promise<void> {
    assertRevision(revision);
    const subject = await this.ensureNode(revision.projectId, revision.subject, revision.systemFrom);
    const object = await this.ensureNode(revision.projectId, revision.object, revision.systemFrom);
    const edgeId = projectionEdgeIdentity(revision.revisionId) as EntityId;
    const existing = await this.graph.getEdge(edgeId);
    if (existing) {
      const expected = canonicalHash128(projectionEdgeShape(revision, subject, object));
      const actual = canonicalHash128({
        source: String(existing.source),
        target: String(existing.target),
        label: existing.label,
        confidence: existing.confidence,
        properties: existing.properties,
      });
      if (expected !== actual) throw new Error(`KNOWLEDGE_PROJECTION_EDGE_CONFLICT revision=${revision.revisionId}`);
      return;
    }
    const shape = projectionEdgeShape(revision, subject, object);
    await this.graph.addEdge({
      id: edgeId,
      source: subject,
      target: object,
      type: 'knowledge_authority_revision',
      label: revision.predicate,
      weight: revision.confidence,
      properties: shape.properties,
      directed: true,
      confidence: revision.confidence,
      createdAt: revision.systemFrom,
      updatedAt: revision.systemFrom,
    });
  }

  async stats() { return this.graph.stats(); }

  private async ensureNode(projectId: string, label: string, recordedAt: string): Promise<EntityId> {
    const identity = canonicalIdentity({
      scheme: 'agentic', authority: projectId, resourceType: 'knowledge-entity', resourceId: label,
    }, 'kent');
    const id = identity.id as EntityId;
    if (await this.graph.getNode(id)) return id;
    await this.graph.addNode({
      id,
      type: 'knowledge_entity',
      label,
      representations: {},
      properties: { projectId },
      tags: [],
      createdAt: recordedAt,
      updatedAt: recordedAt,
      version: { major: 1, minor: 0, patch: 0 },
    });
    return id;
  }
}

/**
 * Saga coordinator: ledger commit is authoritative; graph projection is a
 * rebuildable derived effect. Projection failure is surfaced and retained for
 * deterministic retry instead of rolling back accepted knowledge.
 */
export class AuthorityKnowledgeCoordinator {
  private readonly failures = new Map<string, KnowledgeProjectionFailure>();

  constructor(
    private readonly gateway: AuthorityKnowledgeGateway,
    private readonly projector: AuthorityKnowledgeProjector,
  ) {}

  async create(input: AuthorityKnowledgeCreateInput): Promise<AuthorityKnowledgeAppendResult> {
    const result = await this.gateway.create(input);
    await this.projectOrDegrade(result.revision);
    return { revision: cloneRevision(result.revision), appended: result.appended };
  }

  async revise(input: AuthorityKnowledgeReviseInput): Promise<AuthorityKnowledgeAppendResult> {
    const result = await this.gateway.revise(input);
    await this.projectOrDegrade(result.revision);
    return { revision: cloneRevision(result.revision), appended: result.appended };
  }

  getProjectionFailures(): KnowledgeProjectionFailure[] {
    return Array.from(this.failures.values(), failure => ({ ...failure }))
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.revisionId.localeCompare(b.revisionId));
  }

  async repair(revision: AuthorityKnowledgeRevision): Promise<void> {
    await this.projector.project(revision);
    this.failures.delete(revision.revisionId);
  }

  private async projectOrDegrade(revision: AuthorityKnowledgeRevision): Promise<void> {
    try {
      await this.projector.project(revision);
      this.failures.delete(revision.revisionId);
    } catch (error) {
      this.failures.set(revision.revisionId, {
        revisionId: revision.revisionId,
        statementId: revision.statementId,
        recordedAt: revision.systemFrom,
        error: message(error),
      });
      throw new Error(`KNOWLEDGE_PROJECTION_DEGRADED revision=${revision.revisionId}: ${message(error)}`);
    }
  }
}

function normalizeCreate(input: AuthorityKnowledgeCreateInput) {
  const projectId = nonEmpty(input.projectId, 'projectId');
  const identityKey = nonEmpty(input.identityKey, 'identityKey');
  const subject = nonEmpty(input.subject, 'subject');
  const predicate = nonEmpty(input.predicate, 'predicate');
  const object = nonEmpty(input.object, 'object');
  const confidence = bounded(input.confidence, 'confidence');
  const sensitivity = input.sensitivity ?? 'internal';
  assertSensitivity(sensitivity);
  const validFrom = canonicalTime(input.validFrom, 'validFrom');
  const validUntil = input.validUntil == null ? null : canonicalTime(input.validUntil, 'validUntil');
  if (validUntil !== null && validUntil <= validFrom) throw new Error('validUntil must be after validFrom');
  const observedAt = canonicalTime(input.observedAt, 'observedAt');
  const recordedAt = canonicalTime(input.recordedAt, 'recordedAt');
  if (recordedAt < observedAt) throw new Error('recordedAt cannot precede observedAt');
  return {
    projectId,
    identityKey,
    subject,
    predicate,
    object,
    confidence,
    epistemicType: input.epistemicType ?? 'observed' as EpistemicType,
    sensitivity,
    validFrom,
    validUntil,
    observedAt,
    recordedAt,
    provenance: normalizeProvenance(input.provenance),
    source: nonEmpty(input.source, 'source'),
    metadata: normalizeMetadata(input.metadata ?? {}),
    idempotencyKey: nonEmpty(input.idempotencyKey, 'idempotencyKey'),
  };
}

function normalizeRevise(input: AuthorityKnowledgeReviseInput) {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new Error('expectedRevision must be a positive safe integer');
  }
  const changes = { ...input.changes };
  if (changes.subject !== undefined) changes.subject = nonEmpty(changes.subject, 'subject');
  if (changes.predicate !== undefined) changes.predicate = nonEmpty(changes.predicate, 'predicate');
  if (changes.object !== undefined) changes.object = nonEmpty(changes.object, 'object');
  if (changes.confidence !== undefined) changes.confidence = bounded(changes.confidence, 'confidence');
  if (changes.sensitivity !== undefined) assertSensitivity(changes.sensitivity);
  if (changes.validFrom !== undefined) changes.validFrom = canonicalTime(changes.validFrom, 'validFrom');
  if (changes.validUntil !== undefined && changes.validUntil !== null) changes.validUntil = canonicalTime(changes.validUntil, 'validUntil');
  if (changes.observedAt !== undefined) changes.observedAt = canonicalTime(changes.observedAt, 'observedAt');
  if (changes.provenance !== undefined) changes.provenance = normalizeProvenance(changes.provenance);
  if (changes.source !== undefined) changes.source = nonEmpty(changes.source, 'source');
  if (changes.metadata !== undefined) changes.metadata = normalizeMetadata(changes.metadata);
  return {
    statementId: nonEmpty(input.statementId, 'statementId'),
    expectedRevision: input.expectedRevision,
    recordedAt: canonicalTime(input.recordedAt, 'recordedAt'),
    idempotencyKey: nonEmpty(input.idempotencyKey, 'idempotencyKey'),
    changes,
  };
}

function normalizeQuery(query: AuthorityKnowledgeQuery) {
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > 10_000) throw new Error('limit must be in [0,10000]');
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('offset must be a non-negative safe integer');
  const maxSensitivity = query.maxSensitivity ?? 'internal';
  assertSensitivity(maxSensitivity);
  return {
    projectId: nonEmpty(query.projectId, 'projectId'),
    asOf: canonicalTime(query.asOf, 'asOf'),
    knownAt: canonicalTime(query.knownAt, 'knownAt'),
    subject: query.subject?.normalize('NFC'),
    predicate: query.predicate?.normalize('NFC'),
    object: query.object?.normalize('NFC'),
    epistemicTypes: query.epistemicTypes,
    minConfidence: bounded(query.minConfidence ?? 0, 'minConfidence'),
    maxSensitivity,
    includeRetracted: query.includeRetracted ?? false,
    limit,
    offset,
  };
}

function sealRevision(input: Omit<AuthorityKnowledgeRevision, 'contentHash'>): AuthorityKnowledgeRevision {
  const base = {
    ...input,
    provenance: normalizeProvenance(input.provenance),
    metadata: normalizeMetadata(input.metadata),
  };
  assertRevision({ ...base, contentHash: 'pending' });
  const contentHash = canonicalHash128(base);
  return { ...base, contentHash };
}

function assertRevision(revision: AuthorityKnowledgeRevision): void {
  nonEmpty(revision.revisionId, 'revisionId');
  nonEmpty(revision.statementId, 'statementId');
  nonEmpty(revision.operationKey, 'operationKey');
  nonEmpty(revision.operationHash, 'operationHash');
  nonEmpty(revision.projectId, 'projectId');
  nonEmpty(revision.identityKey, 'identityKey');
  nonEmpty(revision.subject, 'subject');
  nonEmpty(revision.predicate, 'predicate');
  nonEmpty(revision.object, 'object');
  nonEmpty(revision.source, 'source');
  if (!Number.isSafeInteger(revision.revision) || revision.revision < 1) throw new Error('invalid knowledge revision');
  bounded(revision.confidence, 'confidence');
  assertSensitivity(revision.sensitivity);
  const validFrom = canonicalTime(revision.validFrom, 'validFrom');
  if (revision.validUntil !== null && canonicalTime(revision.validUntil, 'validUntil') <= validFrom) {
    throw new Error('validUntil must be after validFrom');
  }
  const observedAt = canonicalTime(revision.observedAt, 'observedAt');
  const systemFrom = canonicalTime(revision.systemFrom, 'systemFrom');
  if (systemFrom < observedAt) throw new Error('systemFrom cannot precede observedAt');
  normalizeProvenance(revision.provenance);
  normalizeMetadata(revision.metadata);
}

function duplicateOperation(existing: AuthorityKnowledgeRevision, operationHash: string): AuthorityKnowledgeAppendResult {
  if (existing.operationHash !== operationHash) {
    throw new Error(`KNOWLEDGE_IDEMPOTENCY_CONFLICT key=${existing.operationKey}`);
  }
  return { revision: cloneRevision(existing), appended: false };
}

function validAt(revision: AuthorityKnowledgeRevision, asOf: string): boolean {
  return asOf >= revision.validFrom && (revision.validUntil === null || asOf < revision.validUntil);
}

function groupHistories(revisions: AuthorityKnowledgeRevision[]): Map<string, AuthorityKnowledgeRevision[]> {
  const histories = new Map<string, AuthorityKnowledgeRevision[]>();
  for (const revision of revisions) {
    const history = histories.get(revision.statementId) ?? [];
    history.push(cloneRevision(revision));
    histories.set(revision.statementId, history);
  }
  for (const history of histories.values()) history.sort(compareRevision);
  return histories;
}

function compareRevision(left: AuthorityKnowledgeRevision, right: AuthorityKnowledgeRevision): number {
  return left.systemFrom.localeCompare(right.systemFrom)
    || left.revision - right.revision
    || left.revisionId.localeCompare(right.revisionId);
}

function revisionIdentity(statementId: string, revision: number, systemFrom: string): string {
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: statementId,
    resourceType: 'knowledge-revision',
    resourceId: `${revision}:${systemFrom}`,
  }, 'knwr').id);
}

function projectionEdgeIdentity(revisionId: string): string {
  return String(canonicalIdentity({
    scheme: 'agentic', authority: 'knowledge-projection', resourceType: 'revision-edge', resourceId: revisionId,
  }, 'kedge').id);
}

function projectionEdgeShape(revision: AuthorityKnowledgeRevision, source: EntityId, target: EntityId) {
  return {
    source: String(source),
    target: String(target),
    label: revision.predicate,
    confidence: revision.confidence,
    properties: {
      projectId: revision.projectId,
      statementId: revision.statementId,
      revisionId: revision.revisionId,
      revision: revision.revision,
      epistemicType: revision.epistemicType,
      sensitivity: revision.sensitivity,
      baseStatus: revision.baseStatus,
      validFrom: revision.validFrom,
      validUntil: revision.validUntil,
      systemFrom: revision.systemFrom,
      source: revision.source,
    },
  };
}

function cloneRevision(revision: AuthorityKnowledgeRevision): AuthorityKnowledgeRevision {
  return {
    ...revision,
    provenance: structuredClone(revision.provenance),
    metadata: structuredClone(revision.metadata),
  };
}

function cloneView(view: AuthorityKnowledgeView): AuthorityKnowledgeView {
  return { ...cloneRevision(view), systemUntil: view.systemUntil };
}

function normalizeProvenance(provenance: ProvenanceRef[]): ProvenanceRef[] {
  if (!Array.isArray(provenance) || provenance.length === 0) throw new Error('provenance must contain at least one source');
  return provenance.map((ref, index) => {
    const source = nonEmpty(ref.source, `provenance[${index}].source`);
    return {
      source,
      ...(ref.revision?.trim() ? { revision: ref.revision.normalize('NFC').trim() } : {}),
      ...(ref.actor?.trim() ? { actor: ref.actor.normalize('NFC').trim() } : {}),
      ...(ref.locator?.trim() ? { locator: ref.locator.normalize('NFC').trim() } : {}),
    };
  });
}

function normalizeMetadata(
  metadata: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean | null> {
  const canonical = canonicalizeJsonValue(metadata);
  if (!canonical || Array.isArray(canonical) || typeof canonical !== 'object') throw new Error('metadata must be an object');
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(canonical)) {
    if (value !== null && typeof value === 'object') throw new Error(`metadata.${key} must be scalar`);
    output[key] = value as string | number | boolean | null;
  }
  return output;
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function bounded(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be in [0,1]`);
  return value;
}

function assertSensitivity(value: string): asserts value is AuthorityKnowledgeSensitivity {
  if (!(value in SENSITIVITY_ORDER)) throw new Error(`Invalid knowledge sensitivity ${value}`);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
