import {
  CANONICAL_JSON_WIRE_VERSION,
  canonicalHash128,
  canonicalIdentity,
  canonicalizeJsonValue,
  type CanonicalJsonValue,
} from '@cos/core';

export const SIDE_EFFECT_LEDGER_SCHEMA_VERSION = 1 as const;

export const SIDE_EFFECT_OPERATION_STATES = [
  'claimed',
  'prepared',
  'executing',
  'succeeded',
  'failed',
  'uncertain',
  'compensating',
  'compensated',
] as const;

export type SideEffectOperationState = typeof SIDE_EFFECT_OPERATION_STATES[number];

const TERMINAL_STATES = new Set<SideEffectOperationState>([
  'succeeded',
  'failed',
  'compensated',
]);

const ALLOWED_TRANSITIONS: Record<SideEffectOperationState, readonly SideEffectOperationState[]> = {
  claimed: ['prepared', 'failed'],
  prepared: ['executing', 'failed'],
  executing: ['succeeded', 'failed', 'uncertain'],
  succeeded: ['compensating'],
  failed: [],
  uncertain: ['succeeded', 'failed', 'compensating'],
  compensating: ['compensated', 'failed', 'uncertain'],
  compensated: [],
};

export interface SideEffectError {
  code: string;
  message: string;
  retryable: boolean;
  details: CanonicalJsonValue | null;
}

/**
 * Immutable aggregate revision for one externally visible operation.
 *
 * `operationKey` is unique inside principal+project scope. Reusing it for a
 * different resource/action/request resolves to the same operation ID and fails
 * closed instead of creating a second effect under a different derived ID.
 */
export interface SideEffectOperationRevision {
  schemaVersion: typeof SIDE_EFFECT_LEDGER_SCHEMA_VERSION;
  serializationVersion: typeof CANONICAL_JSON_WIRE_VERSION;
  revisionId: string;
  operationId: string;
  transitionKey: string;
  transitionIntentHash: string;
  operationKey: string;
  revision: number;
  state: SideEffectOperationState;
  principalId: string;
  projectId: string;
  resource: string;
  action: string;
  request: CanonicalJsonValue;
  requestHash: string;
  sourceRef: string;
  systemFrom: string;
  fencingVersion: number | null;
  providerReference: string | null;
  result: CanonicalJsonValue | null;
  error: SideEffectError | null;
  uncertaintyReason: string | null;
  compensationReference: string | null;
  metadata: Record<string, CanonicalJsonValue>;
  previousRevisionId: string | null;
  contentHash: string;
}

export interface SideEffectAppendResult {
  revision: SideEffectOperationRevision;
  appended: boolean;
}

export interface ISideEffectLedgerStore {
  appendRevision(
    revision: SideEffectOperationRevision,
    expectedCurrentRevision: number,
  ): Promise<SideEffectAppendResult>;
  getCurrent(operationId: string): Promise<SideEffectOperationRevision | null>;
  getHistory(operationId: string): Promise<SideEffectOperationRevision[]>;
  getByTransitionKey(transitionKey: string): Promise<SideEffectOperationRevision | null>;
  listProjectOperations(projectId: string): Promise<SideEffectOperationRevision[]>;
}

export interface SideEffectClaimInput {
  principalId: string;
  projectId: string;
  resource: string;
  action: string;
  operationKey: string;
  request: unknown;
  sourceRef: string;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface SideEffectTransitionInput {
  operationId: string;
  expectedRevision: number;
  state: Exclude<SideEffectOperationState, 'claimed'>;
  idempotencyKey: string;
  recordedAt: string;
  fencingVersion?: number;
  providerReference?: string;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
    details?: unknown;
  };
  uncertaintyReason?: string;
  compensationReference?: string;
  metadata?: Record<string, unknown>;
}

export type SideEffectProviderOutcome =
  | {
      disposition: 'succeeded';
      providerReference: string;
      result?: unknown;
      metadata?: Record<string, unknown>;
    }
  | {
      disposition: 'failed';
      providerReference?: string;
      error: { code: string; message: string; retryable?: boolean; details?: unknown };
      metadata?: Record<string, unknown>;
    }
  | {
      disposition: 'uncertain';
      providerReference?: string;
      reason: string;
      metadata?: Record<string, unknown>;
    };

export interface SideEffectExecutionInput extends SideEffectClaimInput {
  fencingVersion?: number;
}

export interface SideEffectExecutionReceipt {
  operation: SideEffectOperationRevision;
  providerInvoked: boolean;
  reusedTerminalResult: boolean;
}

/** Append-only in-memory reference store. */
export class InMemorySideEffectLedgerStore implements ISideEffectLedgerStore {
  private readonly histories = new Map<string, SideEffectOperationRevision[]>();
  private readonly revisionById = new Map<string, SideEffectOperationRevision>();
  private readonly revisionByTransition = new Map<string, SideEffectOperationRevision>();
  private readonly operationTails = new Map<string, Promise<void>>();

  appendRevision(
    revision: SideEffectOperationRevision,
    expectedCurrentRevision: number,
  ): Promise<SideEffectAppendResult> {
    return this.enqueue(revision.operationId, async () => {
      assertSideEffectRevision(revision);
      assertExpectedRevision(expectedCurrentRevision, 'expectedCurrentRevision');

      const duplicate = this.revisionByTransition.get(revision.transitionKey);
      if (duplicate) {
        if (duplicate.transitionIntentHash !== revision.transitionIntentHash) {
          throw new Error(`SIDE_EFFECT_TRANSITION_CONFLICT key=${revision.transitionKey}`);
        }
        return { revision: cloneSideEffectRevision(duplicate), appended: false };
      }

      const history = this.histories.get(revision.operationId) ?? [];
      const current = history.at(-1);
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== expectedCurrentRevision) {
        throw new Error(
          `STALE_SIDE_EFFECT_REVISION operation=${revision.operationId} expected=${expectedCurrentRevision} current=${currentRevision}`,
        );
      }
      if (revision.revision !== currentRevision + 1) {
        throw new Error(
          `SIDE_EFFECT_REVISION_SEQUENCE operation=${revision.operationId} expected=${currentRevision + 1} incoming=${revision.revision}`,
        );
      }
      if (current) assertSideEffectContinuity(current, revision);
      else assertInitialSideEffectRevision(revision);

      const idCollision = this.revisionById.get(revision.revisionId);
      if (idCollision) {
        if (idCollision.contentHash !== revision.contentHash) {
          throw new Error(`SIDE_EFFECT_REVISION_ID_COLLISION id=${revision.revisionId}`);
        }
        return { revision: cloneSideEffectRevision(idCollision), appended: false };
      }

      const stored = cloneSideEffectRevision(revision);
      history.push(stored);
      this.histories.set(revision.operationId, history);
      this.revisionById.set(revision.revisionId, stored);
      this.revisionByTransition.set(revision.transitionKey, stored);
      return { revision: cloneSideEffectRevision(stored), appended: true };
    });
  }

  async getCurrent(operationId: string): Promise<SideEffectOperationRevision | null> {
    const current = this.histories.get(nonEmpty(operationId, 'operationId'))?.at(-1);
    return current ? cloneSideEffectRevision(current) : null;
  }

  async getHistory(operationId: string): Promise<SideEffectOperationRevision[]> {
    return (this.histories.get(nonEmpty(operationId, 'operationId')) ?? [])
      .map(cloneSideEffectRevision);
  }

  async getByTransitionKey(transitionKey: string): Promise<SideEffectOperationRevision | null> {
    const revision = this.revisionByTransition.get(nonEmpty(transitionKey, 'transitionKey'));
    return revision ? cloneSideEffectRevision(revision) : null;
  }

  async listProjectOperations(projectId: string): Promise<SideEffectOperationRevision[]> {
    const project = nonEmpty(projectId, 'projectId');
    return Array.from(this.histories.values())
      .flat()
      .filter(revision => revision.projectId === project)
      .map(cloneSideEffectRevision)
      .sort(compareSideEffectRevision);
  }

  private enqueue<T>(operationId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.operationTails.get(operationId) ?? Promise.resolve();
    const result = previous.then(operation);
    const tail = result.then(() => undefined, () => undefined);
    this.operationTails.set(operationId, tail);
    return result.finally(() => {
      if (this.operationTails.get(operationId) === tail) this.operationTails.delete(operationId);
    });
  }
}

/**
 * Owns operation identity and append-only state transitions.
 *
 * An `executing` or `compensating` revision discovered after interruption cannot
 * be run again automatically. It must first become `uncertain` and be reconciled
 * against provider evidence.
 */
export class SideEffectLedger {
  constructor(private readonly store: ISideEffectLedgerStore) {}

  async claim(input: SideEffectClaimInput): Promise<SideEffectAppendResult> {
    const normalized = normalizeClaim(input);
    const operationId = sideEffectOperationId(normalized);
    const transitionKey = sideEffectTransitionKey(operationId, normalized.operationKey);
    const requestHash = sideEffectRequestHash(normalized.request);
    const transitionIntentHash = claimIntentHash({
      ...normalized,
      operationId,
      requestHash,
    });

    const historical = await this.store.getByTransitionKey(transitionKey);
    if (historical) {
      if (historical.transitionIntentHash !== transitionIntentHash) {
        throw new Error(`SIDE_EFFECT_OPERATION_CONFLICT id=${operationId}`);
      }
      const current = await this.store.getCurrent(operationId);
      if (!current) throw new Error(`SIDE_EFFECT_LEDGER_CORRUPT operation=${operationId}`);
      assertClaimCompatible(current, normalized, requestHash);
      return { revision: current, appended: false };
    }

    const current = await this.store.getCurrent(operationId);
    if (current) {
      throw new Error(`SIDE_EFFECT_CLAIM_REVISION_MISSING operation=${operationId}`);
    }

    const revision = sealSideEffectRevision({
      revisionId: sideEffectRevisionId(operationId, 1, transitionKey),
      operationId,
      transitionKey,
      transitionIntentHash,
      operationKey: normalized.operationKey,
      revision: 1,
      state: 'claimed',
      principalId: normalized.principalId,
      projectId: normalized.projectId,
      resource: normalized.resource,
      action: normalized.action,
      request: normalized.request,
      requestHash,
      sourceRef: normalized.sourceRef,
      systemFrom: normalized.recordedAt,
      fencingVersion: null,
      providerReference: null,
      result: null,
      error: null,
      uncertaintyReason: null,
      compensationReference: null,
      metadata: normalized.metadata,
      previousRevisionId: null,
    });
    return this.store.appendRevision(revision, 0);
  }

  async transition(input: SideEffectTransitionInput): Promise<SideEffectAppendResult> {
    const normalized = normalizeTransition(input);
    const transitionKey = sideEffectTransitionKey(normalized.operationId, normalized.idempotencyKey);
    const transitionIntentHash = transitionIntentHashFor(normalized);

    const historical = await this.store.getByTransitionKey(transitionKey);
    if (historical) {
      if (historical.transitionIntentHash !== transitionIntentHash) {
        throw new Error(`SIDE_EFFECT_TRANSITION_CONFLICT key=${transitionKey}`);
      }
      return { revision: historical, appended: false };
    }

    const current = await this.store.getCurrent(normalized.operationId);
    if (!current) throw new Error(`SIDE_EFFECT_OPERATION_NOT_FOUND id=${normalized.operationId}`);
    if (current.revision !== normalized.expectedRevision) {
      throw new Error(
        `STALE_SIDE_EFFECT_REVISION operation=${normalized.operationId} expected=${normalized.expectedRevision} current=${current.revision}`,
      );
    }
    assertAllowedSideEffectTransition(current.state, normalized.state);
    if (Date.parse(normalized.recordedAt) <= Date.parse(current.systemFrom)) {
      throw new Error(`SIDE_EFFECT_SYSTEM_TIME_NOT_MONOTONIC operation=${normalized.operationId}`);
    }

    const effectiveFencingVersion = normalized.fencingVersion ?? current.fencingVersion;
    if (effectiveFencingVersion !== null
      && current.fencingVersion !== null
      && effectiveFencingVersion < current.fencingVersion) {
      throw new Error(
        `SIDE_EFFECT_FENCING_REGRESSION operation=${normalized.operationId} current=${current.fencingVersion} incoming=${effectiveFencingVersion}`,
      );
    }

    const effectiveProviderReference = normalized.providerReference ?? current.providerReference;
    const effectiveCompensationReference = normalized.compensationReference ?? current.compensationReference;
    const effectiveResult = resultForTransition(current, normalized);
    const effectiveEvidence = {
      state: normalized.state,
      providerReference: effectiveProviderReference,
      result: effectiveResult,
      error: normalized.error,
      uncertaintyReason: normalized.uncertaintyReason,
      compensationReference: effectiveCompensationReference,
    };
    assertStateEvidence(effectiveEvidence);

    const revisionNumber = current.revision + 1;
    const revision = sealSideEffectRevision({
      revisionId: sideEffectRevisionId(current.operationId, revisionNumber, transitionKey),
      operationId: current.operationId,
      transitionKey,
      transitionIntentHash,
      operationKey: current.operationKey,
      revision: revisionNumber,
      state: normalized.state,
      principalId: current.principalId,
      projectId: current.projectId,
      resource: current.resource,
      action: current.action,
      request: current.request,
      requestHash: current.requestHash,
      sourceRef: current.sourceRef,
      systemFrom: normalized.recordedAt,
      fencingVersion: effectiveFencingVersion,
      providerReference: effectiveProviderReference,
      result: effectiveResult,
      error: normalized.error,
      uncertaintyReason: normalized.uncertaintyReason,
      compensationReference: effectiveCompensationReference,
      metadata: mergeMetadata(current.metadata, normalized.metadata),
      previousRevisionId: current.revisionId,
    });
    return this.store.appendRevision(revision, current.revision);
  }

  getCurrent(operationId: string): Promise<SideEffectOperationRevision | null> {
    return this.store.getCurrent(operationId);
  }

  getHistory(operationId: string): Promise<SideEffectOperationRevision[]> {
    return this.store.getHistory(operationId);
  }

  listProjectOperations(projectId: string): Promise<SideEffectOperationRevision[]> {
    return this.store.listProjectOperations(projectId);
  }

  async recoverInterrupted(
    operationId: string,
    expectedRevision: number,
    recordedAt: string,
    idempotencyKey: string,
    reason = 'worker interrupted while provider outcome may be unknown',
  ): Promise<SideEffectAppendResult> {
    const current = await this.store.getCurrent(operationId);
    if (!current) throw new Error(`SIDE_EFFECT_OPERATION_NOT_FOUND id=${operationId}`);
    if (current.state !== 'executing' && current.state !== 'compensating') {
      throw new Error(`SIDE_EFFECT_RECOVERY_NOT_REQUIRED state=${current.state}`);
    }
    return this.transition({
      operationId,
      expectedRevision,
      state: 'uncertain',
      idempotencyKey,
      recordedAt,
      ...(current.fencingVersion === null ? {} : { fencingVersion: current.fencingVersion }),
      ...(current.providerReference === null ? {} : { providerReference: current.providerReference }),
      uncertaintyReason: reason,
      metadata: { recoveredFromState: current.state },
    });
  }
}

/**
 * Provider-execution coordinator.
 *
 * A provider callback must return an explicit disposition. A thrown exception is
 * `uncertain`, not `failed`, because the provider may have accepted the effect
 * before the caller lost the response. If the terminal ledger append fails, the
 * stored state remains `executing`, and later attempts require reconciliation.
 */
export class SideEffectCoordinator {
  constructor(
    private readonly ledger: SideEffectLedger,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async execute(
    input: SideEffectExecutionInput,
    provider: (operation: SideEffectOperationRevision) => Promise<SideEffectProviderOutcome>,
  ): Promise<SideEffectExecutionReceipt> {
    const claim = await this.ledger.claim(input);
    let current = claim.revision;

    if (TERMINAL_STATES.has(current.state)) {
      return { operation: current, providerInvoked: false, reusedTerminalResult: true };
    }
    if (current.state === 'executing'
      || current.state === 'uncertain'
      || current.state === 'compensating') {
      throw new Error(`SIDE_EFFECT_RECONCILIATION_REQUIRED operation=${current.operationId} state=${current.state}`);
    }

    if (current.state === 'claimed') {
      current = (await this.ledger.transition({
        operationId: current.operationId,
        expectedRevision: current.revision,
        state: 'prepared',
        idempotencyKey: `${input.operationKey}:prepared`,
        recordedAt: this.nextTime(current.systemFrom),
        ...(input.fencingVersion === undefined ? {} : { fencingVersion: input.fencingVersion }),
      })).revision;
    }

    current = (await this.ledger.transition({
      operationId: current.operationId,
      expectedRevision: current.revision,
      state: 'executing',
      idempotencyKey: `${input.operationKey}:executing`,
      recordedAt: this.nextTime(current.systemFrom),
      ...(input.fencingVersion === undefined ? {} : { fencingVersion: input.fencingVersion }),
    })).revision;

    let outcome: SideEffectProviderOutcome;
    try {
      outcome = await provider(current);
    } catch (error) {
      outcome = {
        disposition: 'uncertain',
        reason: error instanceof Error ? error.message : String(error),
        metadata: { providerCallbackThrew: true },
      };
    }

    const recordedAt = this.nextTime(current.systemFrom);
    if (outcome.disposition === 'succeeded') {
      current = (await this.ledger.transition({
        operationId: current.operationId,
        expectedRevision: current.revision,
        state: 'succeeded',
        idempotencyKey: `${input.operationKey}:succeeded`,
        recordedAt,
        ...(input.fencingVersion === undefined ? {} : { fencingVersion: input.fencingVersion }),
        providerReference: outcome.providerReference,
        ...(outcome.result === undefined ? {} : { result: outcome.result }),
        metadata: outcome.metadata,
      })).revision;
    } else if (outcome.disposition === 'failed') {
      current = (await this.ledger.transition({
        operationId: current.operationId,
        expectedRevision: current.revision,
        state: 'failed',
        idempotencyKey: `${input.operationKey}:failed`,
        recordedAt,
        ...(input.fencingVersion === undefined ? {} : { fencingVersion: input.fencingVersion }),
        ...(outcome.providerReference === undefined ? {} : { providerReference: outcome.providerReference }),
        error: outcome.error,
        metadata: outcome.metadata,
      })).revision;
    } else {
      current = (await this.ledger.transition({
        operationId: current.operationId,
        expectedRevision: current.revision,
        state: 'uncertain',
        idempotencyKey: `${input.operationKey}:uncertain`,
        recordedAt,
        ...(input.fencingVersion === undefined ? {} : { fencingVersion: input.fencingVersion }),
        ...(outcome.providerReference === undefined ? {} : { providerReference: outcome.providerReference }),
        uncertaintyReason: outcome.reason,
        metadata: outcome.metadata,
      })).revision;
    }

    return { operation: current, providerInvoked: true, reusedTerminalResult: false };
  }

  private nextTime(after: string): string {
    const candidate = canonicalTime(this.clock(), 'side-effect clock');
    if (Date.parse(candidate) > Date.parse(after)) return candidate;
    return new Date(Date.parse(after) + 1).toISOString();
  }
}

export function sideEffectRequestHash(request: unknown): string {
  return canonicalHash128({
    serializationVersion: CANONICAL_JSON_WIRE_VERSION,
    request: canonicalizeJsonValue(request),
  });
}

/** Operation key identity is scoped by principal+project, not by requested effect. */
export function sideEffectOperationId(input: {
  principalId: string;
  projectId: string;
  operationKey: string;
}): string {
  const projectId = nonEmpty(input.projectId, 'projectId');
  const identityHash = canonicalHash128({
    principalId: nonEmpty(input.principalId, 'principalId'),
    projectId,
    operationKey: nonEmpty(input.operationKey, 'operationKey'),
  });
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: projectId,
    resourceType: 'side-effect-operation',
    resourceId: identityHash,
  }, 'sfx').id);
}

export function sideEffectTransitionKey(operationId: string, idempotencyKey: string): string {
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: nonEmpty(operationId, 'operationId'),
    resourceType: 'side-effect-transition',
    resourceId: nonEmpty(idempotencyKey, 'transition idempotencyKey'),
  }, 'sfxt').id);
}

export function sealSideEffectRevision(
  input: Omit<SideEffectOperationRevision, 'schemaVersion' | 'serializationVersion' | 'contentHash'>,
): SideEffectOperationRevision {
  const canonical = canonicalizeJsonValue({
    schemaVersion: SIDE_EFFECT_LEDGER_SCHEMA_VERSION,
    serializationVersion: CANONICAL_JSON_WIRE_VERSION,
    ...input,
  });
  if (!canonical || Array.isArray(canonical) || typeof canonical !== 'object') {
    throw new Error('side-effect revision must canonicalize to an object');
  }
  const revision = canonical as unknown as Omit<SideEffectOperationRevision, 'contentHash'>;
  return { ...revision, contentHash: canonicalHash128(canonical) };
}

export function assertSideEffectRevision(revision: SideEffectOperationRevision): void {
  if (revision.schemaVersion !== SIDE_EFFECT_LEDGER_SCHEMA_VERSION) {
    throw new Error(`Unsupported side-effect ledger schema ${revision.schemaVersion}`);
  }
  if (revision.serializationVersion !== CANONICAL_JSON_WIRE_VERSION) {
    throw new Error(`Unsupported side-effect serialization ${revision.serializationVersion}`);
  }
  if (!isSideEffectState(revision.state)) {
    throw new Error(`Unsupported side-effect state ${String(revision.state)}`);
  }
  assertExpectedRevision(revision.revision, 'revision');
  if (revision.revision < 1) throw new Error('side-effect revision must be >=1');
  nonEmpty(revision.revisionId, 'revisionId');
  nonEmpty(revision.operationId, 'operationId');
  nonEmpty(revision.transitionKey, 'transitionKey');
  nonEmpty(revision.transitionIntentHash, 'transitionIntentHash');
  nonEmpty(revision.operationKey, 'operationKey');
  nonEmpty(revision.principalId, 'principalId');
  nonEmpty(revision.projectId, 'projectId');
  nonEmpty(revision.resource, 'resource');
  nonEmpty(revision.action, 'action');
  nonEmpty(revision.requestHash, 'requestHash');
  nonEmpty(revision.sourceRef, 'sourceRef');
  canonicalTime(revision.systemFrom, 'systemFrom');
  if (revision.fencingVersion !== null
    && (!Number.isSafeInteger(revision.fencingVersion) || revision.fencingVersion < 1)) {
    throw new Error('fencingVersion must be null or a positive safe integer');
  }
  if (revision.revision === 1 && revision.previousRevisionId !== null) {
    throw new Error('initial side-effect revision cannot have a parent');
  }
  if (revision.revision > 1 && !revision.previousRevisionId) {
    throw new Error('non-initial side-effect revision requires a parent');
  }

  const expectedOperationId = sideEffectOperationId(revision);
  if (revision.operationId !== expectedOperationId) {
    throw new Error(
      `SIDE_EFFECT_OPERATION_ID_MISMATCH expected=${expectedOperationId} actual=${revision.operationId}`,
    );
  }
  const expectedRequestHash = sideEffectRequestHash(revision.request);
  if (revision.requestHash !== expectedRequestHash) {
    throw new Error(
      `SIDE_EFFECT_REQUEST_HASH_MISMATCH expected=${expectedRequestHash} actual=${revision.requestHash}`,
    );
  }
  const expectedRevisionId = sideEffectRevisionId(
    revision.operationId,
    revision.revision,
    revision.transitionKey,
  );
  if (revision.revisionId !== expectedRevisionId) {
    throw new Error(
      `SIDE_EFFECT_REVISION_ID_MISMATCH expected=${expectedRevisionId} actual=${revision.revisionId}`,
    );
  }

  assertStateEvidence(revision);
  const expectedHash = sealSideEffectRevision({
    revisionId: revision.revisionId,
    operationId: revision.operationId,
    transitionKey: revision.transitionKey,
    transitionIntentHash: revision.transitionIntentHash,
    operationKey: revision.operationKey,
    revision: revision.revision,
    state: revision.state,
    principalId: revision.principalId,
    projectId: revision.projectId,
    resource: revision.resource,
    action: revision.action,
    request: revision.request,
    requestHash: revision.requestHash,
    sourceRef: revision.sourceRef,
    systemFrom: revision.systemFrom,
    fencingVersion: revision.fencingVersion,
    providerReference: revision.providerReference,
    result: revision.result,
    error: revision.error,
    uncertaintyReason: revision.uncertaintyReason,
    compensationReference: revision.compensationReference,
    metadata: revision.metadata,
    previousRevisionId: revision.previousRevisionId,
  }).contentHash;
  if (expectedHash !== revision.contentHash) {
    throw new Error(`SIDE_EFFECT_REVISION_HASH_MISMATCH id=${revision.revisionId}`);
  }
}

export function assertInitialSideEffectRevision(revision: SideEffectOperationRevision): void {
  assertSideEffectRevision(revision);
  if (revision.revision !== 1
    || revision.state !== 'claimed'
    || revision.previousRevisionId !== null) {
    throw new Error(`SIDE_EFFECT_INITIAL_REVISION_INVALID operation=${revision.operationId}`);
  }
}

/** Store-level invariant; authority adapters must call this independently. */
export function assertSideEffectContinuity(
  current: SideEffectOperationRevision,
  next: SideEffectOperationRevision,
): void {
  assertSideEffectRevision(current);
  assertSideEffectRevision(next);
  if (next.previousRevisionId !== current.revisionId) {
    throw new Error(`SIDE_EFFECT_PARENT_MISMATCH operation=${next.operationId}`);
  }
  if (next.revision !== current.revision + 1) {
    throw new Error(
      `SIDE_EFFECT_REVISION_SEQUENCE operation=${next.operationId} expected=${current.revision + 1} incoming=${next.revision}`,
    );
  }
  const immutableFields: Array<keyof SideEffectOperationRevision> = [
    'operationId',
    'operationKey',
    'principalId',
    'projectId',
    'resource',
    'action',
    'requestHash',
    'sourceRef',
  ];
  for (const field of immutableFields) {
    if (next[field] !== current[field]) {
      throw new Error(`SIDE_EFFECT_IDENTITY_MUTATION field=${String(field)} operation=${next.operationId}`);
    }
  }
  if (canonicalHash128(next.request) !== canonicalHash128(current.request)) {
    throw new Error(`SIDE_EFFECT_REQUEST_MUTATION operation=${next.operationId}`);
  }
  if (Date.parse(next.systemFrom) <= Date.parse(current.systemFrom)) {
    throw new Error(`SIDE_EFFECT_SYSTEM_TIME_NOT_MONOTONIC operation=${next.operationId}`);
  }
  if (current.fencingVersion !== null
    && (next.fencingVersion === null || next.fencingVersion < current.fencingVersion)) {
    throw new Error(
      `SIDE_EFFECT_FENCING_REGRESSION operation=${next.operationId} current=${current.fencingVersion} incoming=${String(next.fencingVersion)}`,
    );
  }
  assertAllowedSideEffectTransition(current.state, next.state);
}

export function assertAllowedSideEffectTransition(
  from: SideEffectOperationState,
  to: SideEffectOperationState,
): void {
  if (!isSideEffectState(from) || !isSideEffectState(to)) {
    throw new Error(`SIDE_EFFECT_TRANSITION_UNKNOWN from=${String(from)} to=${String(to)}`);
  }
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`SIDE_EFFECT_TRANSITION_INVALID from=${from} to=${to}`);
  }
}

export function cloneSideEffectRevision(
  revision: SideEffectOperationRevision,
): SideEffectOperationRevision {
  assertSideEffectRevision(revision);
  return structuredClone(revision);
}

function claimIntentHash(input: {
  operationId: string;
  principalId: string;
  projectId: string;
  resource: string;
  action: string;
  operationKey: string;
  requestHash: string;
  sourceRef: string;
  metadata: Record<string, CanonicalJsonValue>;
}): string {
  return canonicalHash128({
    schemaVersion: SIDE_EFFECT_LEDGER_SCHEMA_VERSION,
    serializationVersion: CANONICAL_JSON_WIRE_VERSION,
    operationId: input.operationId,
    targetState: 'claimed',
    principalId: input.principalId,
    projectId: input.projectId,
    resource: input.resource,
    action: input.action,
    operationKey: input.operationKey,
    requestHash: input.requestHash,
    sourceRef: input.sourceRef,
    metadata: input.metadata,
  });
}

function normalizeClaim(input: SideEffectClaimInput): {
  principalId: string;
  projectId: string;
  resource: string;
  action: string;
  operationKey: string;
  request: CanonicalJsonValue;
  sourceRef: string;
  recordedAt: string;
  metadata: Record<string, CanonicalJsonValue>;
} {
  return {
    principalId: nonEmpty(input.principalId, 'principalId'),
    projectId: nonEmpty(input.projectId, 'projectId'),
    resource: nonEmpty(input.resource, 'resource'),
    action: nonEmpty(input.action, 'action'),
    operationKey: nonEmpty(input.operationKey, 'operationKey'),
    request: canonicalizeJsonValue(input.request),
    sourceRef: nonEmpty(input.sourceRef, 'sourceRef'),
    recordedAt: canonicalTime(input.recordedAt, 'recordedAt'),
    metadata: canonicalObject(input.metadata ?? {}, 'operation metadata'),
  };
}

function normalizeTransition(input: SideEffectTransitionInput): {
  operationId: string;
  expectedRevision: number;
  state: Exclude<SideEffectOperationState, 'claimed'>;
  idempotencyKey: string;
  recordedAt: string;
  fencingVersion: number | null;
  providerReference: string | null;
  result: CanonicalJsonValue | null;
  resultProvided: boolean;
  error: SideEffectError | null;
  uncertaintyReason: string | null;
  compensationReference: string | null;
  metadata: Record<string, CanonicalJsonValue>;
} {
  assertExpectedRevision(input.expectedRevision, 'expectedRevision');
  if (!isSideEffectState(input.state) || input.state === 'claimed') {
    throw new Error(`Invalid side-effect transition target ${String(input.state)}`);
  }
  const fencingVersion = input.fencingVersion ?? null;
  if (fencingVersion !== null
    && (!Number.isSafeInteger(fencingVersion) || fencingVersion < 1)) {
    throw new Error('fencingVersion must be a positive safe integer');
  }
  const resultProvided = Object.prototype.hasOwnProperty.call(input, 'result');
  return {
    operationId: nonEmpty(input.operationId, 'operationId'),
    expectedRevision: input.expectedRevision,
    state: input.state,
    idempotencyKey: nonEmpty(input.idempotencyKey, 'transition idempotencyKey'),
    recordedAt: canonicalTime(input.recordedAt, 'recordedAt'),
    fencingVersion,
    providerReference: optionalString(input.providerReference, 'providerReference'),
    result: resultProvided ? canonicalizeJsonValue(input.result) : null,
    resultProvided,
    error: input.error ? normalizeError(input.error) : null,
    uncertaintyReason: optionalString(input.uncertaintyReason, 'uncertaintyReason'),
    compensationReference: optionalString(input.compensationReference, 'compensationReference'),
    metadata: canonicalObject(input.metadata ?? {}, 'transition metadata'),
  };
}

function transitionIntentHashFor(input: ReturnType<typeof normalizeTransition>): string {
  return canonicalHash128({
    schemaVersion: SIDE_EFFECT_LEDGER_SCHEMA_VERSION,
    serializationVersion: CANONICAL_JSON_WIRE_VERSION,
    operationId: input.operationId,
    expectedRevision: input.expectedRevision,
    targetState: input.state,
    fencingVersion: input.fencingVersion,
    providerReference: input.providerReference,
    resultProvided: input.resultProvided,
    result: input.result,
    error: input.error,
    uncertaintyReason: input.uncertaintyReason,
    compensationReference: input.compensationReference,
    metadata: input.metadata,
  });
}

function assertClaimCompatible(
  current: SideEffectOperationRevision,
  input: ReturnType<typeof normalizeClaim>,
  requestHash: string,
): void {
  const compatible = current.principalId === input.principalId
    && current.projectId === input.projectId
    && current.resource === input.resource
    && current.action === input.action
    && current.operationKey === input.operationKey
    && current.requestHash === requestHash
    && current.sourceRef === input.sourceRef;
  if (!compatible) throw new Error(`SIDE_EFFECT_OPERATION_CONFLICT id=${current.operationId}`);
}

function resultForTransition(
  current: SideEffectOperationRevision,
  input: ReturnType<typeof normalizeTransition>,
): CanonicalJsonValue | null {
  if (input.state === 'succeeded') return input.resultProvided ? input.result : null;
  if (input.state === 'compensating' || input.state === 'compensated') {
    return input.resultProvided ? input.result : current.result;
  }
  return null;
}

function assertStateEvidence(input: {
  state: SideEffectOperationState;
  providerReference: string | null;
  result: CanonicalJsonValue | null;
  error: SideEffectError | null;
  uncertaintyReason: string | null;
  compensationReference: string | null;
}): void {
  if (input.state === 'succeeded' && !input.providerReference) {
    throw new Error('SIDE_EFFECT_SUCCESS_REQUIRES_PROVIDER_REFERENCE');
  }
  if (input.state === 'failed' && !input.error) {
    throw new Error('SIDE_EFFECT_FAILURE_REQUIRES_ERROR');
  }
  if (input.state === 'uncertain' && !input.uncertaintyReason) {
    throw new Error('SIDE_EFFECT_UNCERTAIN_REQUIRES_REASON');
  }
  if ((input.state === 'compensating' || input.state === 'compensated')
    && !input.compensationReference) {
    throw new Error(`SIDE_EFFECT_${input.state.toUpperCase()}_REQUIRES_COMPENSATION_REFERENCE`);
  }
  if (input.state !== 'failed' && input.error) {
    throw new Error(`SIDE_EFFECT_ERROR_NOT_ALLOWED state=${input.state}`);
  }
  if (input.state !== 'uncertain' && input.uncertaintyReason) {
    throw new Error(`SIDE_EFFECT_UNCERTAINTY_NOT_ALLOWED state=${input.state}`);
  }
  if (input.result !== null
    && input.state !== 'succeeded'
    && input.state !== 'compensating'
    && input.state !== 'compensated') {
    throw new Error(`SIDE_EFFECT_RESULT_NOT_ALLOWED state=${input.state}`);
  }
}

function sideEffectRevisionId(operationId: string, revision: number, transitionKey: string): string {
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: operationId,
    resourceType: 'side-effect-revision',
    resourceId: canonicalHash128({ revision, transitionKey }),
  }, 'sfxr').id);
}

function normalizeError(input: {
  code: string;
  message: string;
  retryable?: boolean;
  details?: unknown;
}): SideEffectError {
  return {
    code: nonEmpty(input.code, 'error code'),
    message: nonEmpty(input.message, 'error message'),
    retryable: input.retryable ?? false,
    details: input.details === undefined ? null : canonicalizeJsonValue(input.details),
  };
}

function mergeMetadata(
  current: Record<string, CanonicalJsonValue>,
  next: Record<string, CanonicalJsonValue>,
): Record<string, CanonicalJsonValue> {
  return canonicalObject({ ...current, ...next }, 'operation metadata');
}

function canonicalObject(value: unknown, label: string): Record<string, CanonicalJsonValue> {
  const canonical = canonicalizeJsonValue(value);
  if (!canonical || Array.isArray(canonical) || typeof canonical !== 'object') {
    throw new Error(`${label} must canonicalize to an object`);
  }
  return canonical as Record<string, CanonicalJsonValue>;
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

function optionalString(value: string | undefined, label: string): string | null {
  if (value === undefined) return null;
  return nonEmpty(value, label);
}

function assertExpectedRevision(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function isSideEffectState(value: unknown): value is SideEffectOperationState {
  return typeof value === 'string'
    && (SIDE_EFFECT_OPERATION_STATES as readonly string[]).includes(value);
}

function compareSideEffectRevision(
  left: SideEffectOperationRevision,
  right: SideEffectOperationRevision,
): number {
  return left.systemFrom.localeCompare(right.systemFrom)
    || left.operationId.localeCompare(right.operationId)
    || left.revision - right.revision
    || left.revisionId.localeCompare(right.revisionId);
}
