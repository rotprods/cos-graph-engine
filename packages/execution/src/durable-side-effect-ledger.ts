import {
  CANONICAL_JSON_WIRE_VERSION,
  canonicalHash128,
  canonicalIdentity,
  canonicalizeJsonValue,
  type CanonicalJsonValue,
} from '@cos/core';

export const DURABLE_SIDE_EFFECT_SCHEMA_VERSION = 2 as const;

export type DurableSideEffectState =
  | 'claimed'
  | 'prepared'
  | 'executing'
  | 'effect_observed'
  | 'committed'
  | 'failed'
  | 'uncertain'
  | 'compensation_required'
  | 'compensating'
  | 'compensated';

export interface DurableSideEffectError {
  code: string;
  message: string;
  retryable: boolean;
  details: CanonicalJsonValue | null;
}

/**
 * Immutable full-state revision of one external-effect operation.
 *
 * `effect_observed` means the provider reported an effect and that evidence was
 * durably recorded. `committed` is a separate local terminal acknowledgement.
 * If the provider may have changed the world but no observation revision was
 * persisted, recovery must classify the still-`executing` operation as
 * `uncertain`; it must never call the provider again blindly.
 */
export interface DurableSideEffectRevision {
  schemaVersion: typeof DURABLE_SIDE_EFFECT_SCHEMA_VERSION;
  serializationVersion: typeof CANONICAL_JSON_WIRE_VERSION;
  revisionId: string;
  operationId: string;
  transitionKey: string;
  transitionIntentHash: string;
  operationKey: string;
  revision: number;
  state: DurableSideEffectState;
  principalId: string;
  projectId: string;
  resource: string;
  capability: string;
  action: string;
  requestHash: string;
  sourceRef: string;
  systemFrom: string;
  /** Evidence only until P05.2 validates this at the resource commit boundary. */
  fencingVersion: number | null;
  providerReference: string | null;
  effectReceiptHash: string | null;
  result: CanonicalJsonValue | null;
  error: DurableSideEffectError | null;
  uncertaintyReason: string | null;
  compensationReference: string | null;
  metadata: Record<string, CanonicalJsonValue>;
  previousRevisionId: string | null;
  contentHash: string;
}

export interface DurableSideEffectAppendResult {
  revision: DurableSideEffectRevision;
  appended: boolean;
}

export interface IDurableSideEffectStore {
  appendRevision(
    revision: DurableSideEffectRevision,
    expectedCurrentRevision: number,
  ): Promise<DurableSideEffectAppendResult>;
  getCurrent(operationId: string): Promise<DurableSideEffectRevision | null>;
  getHistory(operationId: string): Promise<DurableSideEffectRevision[]>;
  getByTransitionKey(transitionKey: string): Promise<DurableSideEffectRevision | null>;
  listProjectOperations(projectId: string): Promise<DurableSideEffectRevision[]>;
}

export interface DurableSideEffectClaimInput {
  principalId: string;
  projectId: string;
  resource: string;
  capability: string;
  action: string;
  operationKey: string;
  request: unknown;
  sourceRef: string;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface DurableSideEffectTransitionInput {
  operationId: string;
  expectedRevision: number;
  state: Exclude<DurableSideEffectState, 'claimed'>;
  idempotencyKey: string;
  recordedAt: string;
  fencingVersion?: number | null;
  providerReference?: string | null;
  effectReceiptHash?: string | null;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
    details?: unknown;
  } | null;
  uncertaintyReason?: string | null;
  compensationReference?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * `failed` means the provider explicitly confirmed failure/no accepted effect.
 * Thrown transport errors are never converted to `failed`; they become
 * `uncertain` because the provider may have accepted the mutation.
 */
export type DurableProviderOutcome =
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

export interface DurableSideEffectExecutionInput extends DurableSideEffectClaimInput {
  fencingVersion?: number | null;
}

export interface DurableSideEffectExecutionReceipt {
  operation: DurableSideEffectRevision;
  providerInvoked: boolean;
  reusedTerminalResult: boolean;
  resumedAfterObservedEffect: boolean;
}

export class InMemoryDurableSideEffectStore implements IDurableSideEffectStore {
  private readonly histories = new Map<string, DurableSideEffectRevision[]>();
  private readonly byRevisionId = new Map<string, DurableSideEffectRevision>();
  private readonly byTransitionKey = new Map<string, DurableSideEffectRevision>();
  private readonly tails = new Map<string, Promise<void>>();

  appendRevision(
    revision: DurableSideEffectRevision,
    expectedCurrentRevision: number,
  ): Promise<DurableSideEffectAppendResult> {
    return this.enqueue(revision.operationId, async () => {
      assertDurableSideEffectRevision(revision);
      assertExpectedRevision(expectedCurrentRevision);

      const duplicate = this.byTransitionKey.get(revision.transitionKey);
      if (duplicate) {
        if (duplicate.transitionIntentHash !== revision.transitionIntentHash
          || duplicate.contentHash !== revision.contentHash) {
          throw new Error(`SIDE_EFFECT_TRANSITION_CONFLICT key=${revision.transitionKey}`);
        }
        return { revision: cloneDurableSideEffectRevision(duplicate), appended: false };
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
      if (current) assertContinuity(current, revision);
      else if (revision.previousRevisionId !== null || revision.state !== 'claimed') {
        throw new Error(`SIDE_EFFECT_INITIAL_REVISION_INVALID operation=${revision.operationId}`);
      }

      const collision = this.byRevisionId.get(revision.revisionId);
      if (collision) {
        if (collision.contentHash !== revision.contentHash) {
          throw new Error(`SIDE_EFFECT_REVISION_ID_COLLISION id=${revision.revisionId}`);
        }
        return { revision: cloneDurableSideEffectRevision(collision), appended: false };
      }

      const stored = cloneDurableSideEffectRevision(revision);
      history.push(stored);
      this.histories.set(revision.operationId, history);
      this.byRevisionId.set(revision.revisionId, stored);
      this.byTransitionKey.set(revision.transitionKey, stored);
      return { revision: cloneDurableSideEffectRevision(stored), appended: true };
    });
  }

  async getCurrent(operationId: string): Promise<DurableSideEffectRevision | null> {
    const revision = this.histories.get(nonEmpty(operationId, 'operationId'))?.at(-1);
    return revision ? cloneDurableSideEffectRevision(revision) : null;
  }

  async getHistory(operationId: string): Promise<DurableSideEffectRevision[]> {
    return (this.histories.get(nonEmpty(operationId, 'operationId')) ?? [])
      .map(cloneDurableSideEffectRevision);
  }

  async getByTransitionKey(transitionKey: string): Promise<DurableSideEffectRevision | null> {
    const revision = this.byTransitionKey.get(nonEmpty(transitionKey, 'transitionKey'));
    return revision ? cloneDurableSideEffectRevision(revision) : null;
  }

  async listProjectOperations(projectId: string): Promise<DurableSideEffectRevision[]> {
    const project = nonEmpty(projectId, 'projectId');
    return Array.from(this.histories.values())
      .flat()
      .filter(revision => revision.projectId === project)
      .map(cloneDurableSideEffectRevision)
      .sort(compareRevision);
  }

  private enqueue<T>(operationId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(operationId) ?? Promise.resolve();
    const result = previous.then(operation);
    const tail = result.then(() => undefined, () => undefined);
    this.tails.set(operationId, tail);
    return result.finally(() => {
      if (this.tails.get(operationId) === tail) this.tails.delete(operationId);
    });
  }
}

export class DurableSideEffectLedger {
  constructor(private readonly store: IDurableSideEffectStore) {}

  async claim(input: DurableSideEffectClaimInput): Promise<DurableSideEffectAppendResult> {
    const normalized = normalizeClaim(input);
    const operationId = durableSideEffectOperationId(normalized);
    const requestHash = durableSideEffectRequestHash(normalized.request);
    const current = await this.store.getCurrent(operationId);
    if (current) {
      assertClaimCompatible(current, normalized, requestHash);
      return { revision: current, appended: false };
    }

    const transitionKey = durableSideEffectTransitionKey(operationId, normalized.operationKey);
    const transitionIntentHash = canonicalHash128({
      schemaVersion: DURABLE_SIDE_EFFECT_SCHEMA_VERSION,
      serializationVersion: CANONICAL_JSON_WIRE_VERSION,
      operationId,
      targetState: 'claimed',
      principalId: normalized.principalId,
      projectId: normalized.projectId,
      resource: normalized.resource,
      capability: normalized.capability,
      action: normalized.action,
      operationKey: normalized.operationKey,
      requestHash,
      sourceRef: normalized.sourceRef,
      metadata: normalized.metadata,
    });
    const revision = sealDurableSideEffectRevision({
      revisionId: durableSideEffectRevisionId(operationId, 1, transitionKey),
      operationId,
      transitionKey,
      transitionIntentHash,
      operationKey: normalized.operationKey,
      revision: 1,
      state: 'claimed',
      principalId: normalized.principalId,
      projectId: normalized.projectId,
      resource: normalized.resource,
      capability: normalized.capability,
      action: normalized.action,
      requestHash,
      sourceRef: normalized.sourceRef,
      systemFrom: normalized.recordedAt,
      fencingVersion: null,
      providerReference: null,
      effectReceiptHash: null,
      result: null,
      error: null,
      uncertaintyReason: null,
      compensationReference: null,
      metadata: normalized.metadata,
      previousRevisionId: null,
    });
    return this.store.appendRevision(revision, 0);
  }

  async transition(input: DurableSideEffectTransitionInput): Promise<DurableSideEffectAppendResult> {
    const normalized = normalizeTransition(input);
    const transitionKey = durableSideEffectTransitionKey(normalized.operationId, normalized.idempotencyKey);
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
    assertAllowedTransition(current.state, normalized.state);
    if (Date.parse(normalized.recordedAt) <= Date.parse(current.systemFrom)) {
      throw new Error(`SIDE_EFFECT_SYSTEM_TIME_NOT_MONOTONIC operation=${normalized.operationId}`);
    }
    if (normalized.fencingVersion !== null
      && current.fencingVersion !== null
      && normalized.fencingVersion < current.fencingVersion) {
      throw new Error(
        `SIDE_EFFECT_FENCING_REGRESSION operation=${normalized.operationId} current=${current.fencingVersion} incoming=${normalized.fencingVersion}`,
      );
    }

    const evidence = nextEvidence(current, normalized);
    assertStateEvidence({ state: normalized.state, ...evidence });
    const revisionNumber = current.revision + 1;
    const revision = sealDurableSideEffectRevision({
      revisionId: durableSideEffectRevisionId(current.operationId, revisionNumber, transitionKey),
      operationId: current.operationId,
      transitionKey,
      transitionIntentHash,
      operationKey: current.operationKey,
      revision: revisionNumber,
      state: normalized.state,
      principalId: current.principalId,
      projectId: current.projectId,
      resource: current.resource,
      capability: current.capability,
      action: current.action,
      requestHash: current.requestHash,
      sourceRef: current.sourceRef,
      systemFrom: normalized.recordedAt,
      fencingVersion: normalized.fencingVersion ?? current.fencingVersion,
      providerReference: evidence.providerReference,
      effectReceiptHash: evidence.effectReceiptHash,
      result: evidence.result,
      error: evidence.error,
      uncertaintyReason: evidence.uncertaintyReason,
      compensationReference: evidence.compensationReference,
      metadata: mergeMetadata(current.metadata, normalized.metadata),
      previousRevisionId: current.revisionId,
    });
    return this.store.appendRevision(revision, current.revision);
  }

  getCurrent(operationId: string): Promise<DurableSideEffectRevision | null> {
    return this.store.getCurrent(operationId);
  }

  getHistory(operationId: string): Promise<DurableSideEffectRevision[]> {
    return this.store.getHistory(operationId);
  }

  listProjectOperations(projectId: string): Promise<DurableSideEffectRevision[]> {
    return this.store.listProjectOperations(projectId);
  }

  async recoverInterrupted(
    operationId: string,
    expectedRevision: number,
    recordedAt: string,
    idempotencyKey: string,
    reason = 'worker interrupted while provider outcome may be unknown',
  ): Promise<DurableSideEffectAppendResult> {
    const current = await this.store.getCurrent(operationId);
    if (!current) throw new Error(`SIDE_EFFECT_OPERATION_NOT_FOUND id=${operationId}`);
    if (current.state === 'effect_observed') {
      throw new Error(`SIDE_EFFECT_EFFECT_OBSERVED_CAN_RESUME_COMMIT operation=${operationId}`);
    }
    if (current.state !== 'executing' && current.state !== 'compensating') {
      throw new Error(`SIDE_EFFECT_RECOVERY_NOT_REQUIRED state=${current.state}`);
    }
    return this.transition({
      operationId,
      expectedRevision,
      state: 'uncertain',
      idempotencyKey,
      recordedAt,
      fencingVersion: current.fencingVersion,
      providerReference: current.providerReference,
      uncertaintyReason: reason,
      metadata: { recoveredFromState: current.state },
    });
  }
}

/**
 * Orchestrates provider invocation without claiming provider exactly-once.
 *
 * Crash windows:
 * - provider may succeed while ledger still says `executing` → future recovery
 *   must move to `uncertain` and reconcile provider state before retry;
 * - ledger says `effect_observed` but not `committed` → execute() resumes the
 *   local commit without invoking the provider again.
 */
export class DurableSideEffectCoordinator {
  constructor(
    private readonly ledger: DurableSideEffectLedger,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async execute(
    input: DurableSideEffectExecutionInput,
    provider: (operation: DurableSideEffectRevision) => Promise<DurableProviderOutcome>,
  ): Promise<DurableSideEffectExecutionReceipt> {
    const claim = await this.ledger.claim(input);
    let current = claim.revision;

    if (isReusableTerminal(current.state)) {
      return {
        operation: current,
        providerInvoked: false,
        reusedTerminalResult: true,
        resumedAfterObservedEffect: false,
      };
    }
    if (current.state === 'effect_observed') {
      current = await this.commitObserved(input.operationKey, current, input.fencingVersion);
      return {
        operation: current,
        providerInvoked: false,
        reusedTerminalResult: false,
        resumedAfterObservedEffect: true,
      };
    }
    if (current.state === 'executing'
      || current.state === 'uncertain'
      || current.state === 'compensation_required'
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
        fencingVersion: input.fencingVersion,
      })).revision;
    }

    current = (await this.ledger.transition({
      operationId: current.operationId,
      expectedRevision: current.revision,
      state: 'executing',
      idempotencyKey: `${input.operationKey}:executing`,
      recordedAt: this.nextTime(current.systemFrom),
      fencingVersion: input.fencingVersion,
    })).revision;

    let outcome: DurableProviderOutcome;
    try {
      outcome = await provider(current);
    } catch (error) {
      outcome = {
        disposition: 'uncertain',
        reason: error instanceof Error ? error.message : String(error),
        metadata: { providerCallbackThrew: true },
      };
    }

    if (outcome.disposition === 'failed') {
      current = (await this.ledger.transition({
        operationId: current.operationId,
        expectedRevision: current.revision,
        state: 'failed',
        idempotencyKey: `${input.operationKey}:failed`,
        recordedAt: this.nextTime(current.systemFrom),
        fencingVersion: input.fencingVersion,
        providerReference: outcome.providerReference,
        error: outcome.error,
        metadata: outcome.metadata,
      })).revision;
      return {
        operation: current,
        providerInvoked: true,
        reusedTerminalResult: false,
        resumedAfterObservedEffect: false,
      };
    }

    if (outcome.disposition === 'uncertain') {
      current = (await this.ledger.transition({
        operationId: current.operationId,
        expectedRevision: current.revision,
        state: 'uncertain',
        idempotencyKey: `${input.operationKey}:uncertain`,
        recordedAt: this.nextTime(current.systemFrom),
        fencingVersion: input.fencingVersion,
        providerReference: outcome.providerReference,
        uncertaintyReason: outcome.reason,
        metadata: outcome.metadata,
      })).revision;
      return {
        operation: current,
        providerInvoked: true,
        reusedTerminalResult: false,
        resumedAfterObservedEffect: false,
      };
    }

    const canonicalResult = outcome.result === undefined ? null : canonicalizeJsonValue(outcome.result);
    const effectReceiptHash = durableEffectReceiptHash({
      operationId: current.operationId,
      providerReference: outcome.providerReference,
      result: canonicalResult,
      metadata: outcome.metadata ?? {},
    });
    current = (await this.ledger.transition({
      operationId: current.operationId,
      expectedRevision: current.revision,
      state: 'effect_observed',
      idempotencyKey: `${input.operationKey}:effect_observed`,
      recordedAt: this.nextTime(current.systemFrom),
      fencingVersion: input.fencingVersion,
      providerReference: outcome.providerReference,
      effectReceiptHash,
      result: canonicalResult,
      metadata: outcome.metadata,
    })).revision;

    current = await this.commitObserved(input.operationKey, current, input.fencingVersion);
    return {
      operation: current,
      providerInvoked: true,
      reusedTerminalResult: false,
      resumedAfterObservedEffect: false,
    };
  }

  private async commitObserved(
    operationKey: string,
    current: DurableSideEffectRevision,
    fencingVersion?: number | null,
  ): Promise<DurableSideEffectRevision> {
    if (current.state !== 'effect_observed') {
      throw new Error(`SIDE_EFFECT_COMMIT_REQUIRES_OBSERVED_EFFECT state=${current.state}`);
    }
    return (await this.ledger.transition({
      operationId: current.operationId,
      expectedRevision: current.revision,
      state: 'committed',
      idempotencyKey: `${operationKey}:committed`,
      recordedAt: this.nextTime(current.systemFrom),
      fencingVersion,
      providerReference: current.providerReference,
      effectReceiptHash: current.effectReceiptHash,
      result: current.result,
    })).revision;
  }

  private nextTime(after: string): string {
    const candidate = canonicalTime(this.clock(), 'side-effect clock');
    if (Date.parse(candidate) > Date.parse(after)) return candidate;
    return new Date(Date.parse(after) + 1).toISOString();
  }
}

export function durableSideEffectRequestHash(request: unknown): string {
  return canonicalHash128({
    serializationVersion: CANONICAL_JSON_WIRE_VERSION,
    request: canonicalizeJsonValue(request),
  });
}

export function durableSideEffectOperationId(input: {
  principalId: string;
  projectId: string;
  resource: string;
  capability: string;
  action: string;
  operationKey: string;
}): string {
  const identityHash = canonicalHash128({
    principalId: nonEmpty(input.principalId, 'principalId'),
    projectId: nonEmpty(input.projectId, 'projectId'),
    resource: nonEmpty(input.resource, 'resource'),
    capability: nonEmpty(input.capability, 'capability'),
    action: nonEmpty(input.action, 'action'),
    operationKey: nonEmpty(input.operationKey, 'operationKey'),
  });
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: nonEmpty(input.projectId, 'projectId'),
    resourceType: 'durable-side-effect-operation',
    resourceId: identityHash,
  }, 'sfx').id);
}

export function durableSideEffectTransitionKey(operationId: string, idempotencyKey: string): string {
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: nonEmpty(operationId, 'operationId'),
    resourceType: 'durable-side-effect-transition',
    resourceId: nonEmpty(idempotencyKey, 'transition idempotencyKey'),
  }, 'sfxt').id);
}

export function durableEffectReceiptHash(input: {
  operationId: string;
  providerReference: string;
  result: CanonicalJsonValue | null;
  metadata: Record<string, unknown>;
}): string {
  return canonicalHash128({
    serializationVersion: CANONICAL_JSON_WIRE_VERSION,
    operationId: nonEmpty(input.operationId, 'operationId'),
    providerReference: nonEmpty(input.providerReference, 'providerReference'),
    result: input.result,
    metadata: canonicalObject(input.metadata, 'provider metadata'),
  });
}

export function sealDurableSideEffectRevision(
  input: Omit<DurableSideEffectRevision, 'schemaVersion' | 'serializationVersion' | 'contentHash'>,
): DurableSideEffectRevision {
  const canonical = canonicalizeJsonValue({
    schemaVersion: DURABLE_SIDE_EFFECT_SCHEMA_VERSION,
    serializationVersion: CANONICAL_JSON_WIRE_VERSION,
    ...input,
  }) as Record<string, CanonicalJsonValue>;
  const revision = canonical as unknown as Omit<DurableSideEffectRevision, 'contentHash'>;
  return { ...revision, contentHash: canonicalHash128(canonical) };
}

export function assertDurableSideEffectRevision(revision: DurableSideEffectRevision): void {
  if (revision.schemaVersion !== DURABLE_SIDE_EFFECT_SCHEMA_VERSION) {
    throw new Error(`Unsupported durable side-effect schema ${revision.schemaVersion}`);
  }
  if (revision.serializationVersion !== CANONICAL_JSON_WIRE_VERSION) {
    throw new Error(`Unsupported durable side-effect serialization ${revision.serializationVersion}`);
  }
  if (!Number.isSafeInteger(revision.revision) || revision.revision < 1) {
    throw new Error('side-effect revision must be a positive safe integer');
  }
  for (const [value, label] of [
    [revision.revisionId, 'revisionId'],
    [revision.operationId, 'operationId'],
    [revision.transitionKey, 'transitionKey'],
    [revision.transitionIntentHash, 'transitionIntentHash'],
    [revision.operationKey, 'operationKey'],
    [revision.principalId, 'principalId'],
    [revision.projectId, 'projectId'],
    [revision.resource, 'resource'],
    [revision.capability, 'capability'],
    [revision.action, 'action'],
    [revision.requestHash, 'requestHash'],
    [revision.sourceRef, 'sourceRef'],
  ] as Array<[string, string]>) nonEmpty(value, label);
  canonicalTime(revision.systemFrom, 'systemFrom');
  if (revision.fencingVersion !== null
    && (!Number.isSafeInteger(revision.fencingVersion) || revision.fencingVersion < 1)) {
    throw new Error('fencingVersion must be null or a positive safe integer');
  }
  assertStateEvidence(revision);
  const { contentHash, schemaVersion: _schema, serializationVersion: _serialization, ...rest } = revision;
  const expected = sealDurableSideEffectRevision(rest).contentHash;
  if (contentHash !== expected) {
    throw new Error(`SIDE_EFFECT_REVISION_HASH_MISMATCH id=${revision.revisionId}`);
  }
}

export function cloneDurableSideEffectRevision(revision: DurableSideEffectRevision): DurableSideEffectRevision {
  assertDurableSideEffectRevision(revision);
  return structuredClone(revision);
}

function normalizeClaim(input: DurableSideEffectClaimInput) {
  return {
    principalId: nonEmpty(input.principalId, 'principalId'),
    projectId: nonEmpty(input.projectId, 'projectId'),
    resource: nonEmpty(input.resource, 'resource'),
    capability: nonEmpty(input.capability, 'capability'),
    action: nonEmpty(input.action, 'action'),
    operationKey: nonEmpty(input.operationKey, 'operationKey'),
    request: canonicalizeJsonValue(input.request),
    sourceRef: nonEmpty(input.sourceRef, 'sourceRef'),
    recordedAt: canonicalTime(input.recordedAt, 'recordedAt'),
    metadata: canonicalObject(input.metadata ?? {}, 'operation metadata'),
  };
}

type NormalizedTransition = {
  operationId: string;
  expectedRevision: number;
  state: Exclude<DurableSideEffectState, 'claimed'>;
  idempotencyKey: string;
  recordedAt: string;
  fencingVersion: number | null;
  providerReference: string | null;
  effectReceiptHash: string | null;
  result: CanonicalJsonValue | null;
  resultProvided: boolean;
  error: DurableSideEffectError | null;
  uncertaintyReason: string | null;
  compensationReference: string | null;
  metadata: Record<string, CanonicalJsonValue>;
};

function normalizeTransition(input: DurableSideEffectTransitionInput): NormalizedTransition {
  assertExpectedRevision(input.expectedRevision);
  const fencingVersion = input.fencingVersion ?? null;
  if (fencingVersion !== null && (!Number.isSafeInteger(fencingVersion) || fencingVersion < 1)) {
    throw new Error('fencingVersion must be null or a positive safe integer');
  }
  return {
    operationId: nonEmpty(input.operationId, 'operationId'),
    expectedRevision: input.expectedRevision,
    state: input.state,
    idempotencyKey: nonEmpty(input.idempotencyKey, 'transition idempotencyKey'),
    recordedAt: canonicalTime(input.recordedAt, 'recordedAt'),
    fencingVersion,
    providerReference: optionalString(input.providerReference),
    effectReceiptHash: optionalString(input.effectReceiptHash),
    result: input.result === undefined ? null : canonicalizeJsonValue(input.result),
    resultProvided: input.result !== undefined,
    error: input.error ? normalizeError(input.error) : null,
    uncertaintyReason: optionalString(input.uncertaintyReason),
    compensationReference: optionalString(input.compensationReference),
    metadata: canonicalObject(input.metadata ?? {}, 'transition metadata'),
  };
}

function transitionIntentHashFor(input: NormalizedTransition): string {
  return canonicalHash128({
    schemaVersion: DURABLE_SIDE_EFFECT_SCHEMA_VERSION,
    serializationVersion: CANONICAL_JSON_WIRE_VERSION,
    operationId: input.operationId,
    expectedRevision: input.expectedRevision,
    targetState: input.state,
    fencingVersion: input.fencingVersion,
    providerReference: input.providerReference,
    effectReceiptHash: input.effectReceiptHash,
    result: input.result,
    resultProvided: input.resultProvided,
    error: input.error,
    uncertaintyReason: input.uncertaintyReason,
    compensationReference: input.compensationReference,
    metadata: input.metadata,
  });
}

function nextEvidence(current: DurableSideEffectRevision, input: NormalizedTransition) {
  const providerReference = input.providerReference ?? current.providerReference;
  const effectReceiptHash = input.effectReceiptHash ?? current.effectReceiptHash;
  const result = input.resultProvided ? input.result : current.result;
  const error = input.state === 'failed' ? input.error : null;
  const uncertaintyReason = input.state === 'uncertain' ? input.uncertaintyReason : null;
  const compensationReference = input.compensationReference ?? current.compensationReference;
  return { providerReference, effectReceiptHash, result, error, uncertaintyReason, compensationReference };
}

function assertClaimCompatible(
  current: DurableSideEffectRevision,
  input: ReturnType<typeof normalizeClaim>,
  requestHash: string,
): void {
  const compatible = current.principalId === input.principalId
    && current.projectId === input.projectId
    && current.resource === input.resource
    && current.capability === input.capability
    && current.action === input.action
    && current.operationKey === input.operationKey
    && current.requestHash === requestHash
    && current.sourceRef === input.sourceRef;
  if (!compatible) throw new Error(`SIDE_EFFECT_OPERATION_CONFLICT id=${current.operationId}`);
}

function assertAllowedTransition(from: DurableSideEffectState, to: DurableSideEffectState): void {
  const allowed: Record<DurableSideEffectState, DurableSideEffectState[]> = {
    claimed: ['prepared', 'failed'],
    prepared: ['executing', 'failed'],
    executing: ['effect_observed', 'failed', 'uncertain'],
    effect_observed: ['committed', 'compensation_required'],
    committed: ['compensation_required'],
    failed: [],
    uncertain: ['effect_observed', 'failed', 'compensation_required'],
    compensation_required: ['compensating'],
    compensating: ['compensated', 'failed', 'uncertain'],
    compensated: [],
  };
  if (!allowed[from].includes(to)) {
    throw new Error(`SIDE_EFFECT_TRANSITION_INVALID from=${from} to=${to}`);
  }
}

function assertStateEvidence(input: {
  state: DurableSideEffectState;
  providerReference: string | null;
  effectReceiptHash: string | null;
  error: DurableSideEffectError | null;
  uncertaintyReason: string | null;
  compensationReference: string | null;
}): void {
  if ((input.state === 'effect_observed' || input.state === 'committed')
    && (!input.providerReference || !input.effectReceiptHash)) {
    throw new Error(`SIDE_EFFECT_${input.state.toUpperCase()}_REQUIRES_EFFECT_EVIDENCE`);
  }
  if (input.state === 'failed' && !input.error) {
    throw new Error('SIDE_EFFECT_FAILURE_REQUIRES_ERROR');
  }
  if (input.state === 'uncertain' && !input.uncertaintyReason) {
    throw new Error('SIDE_EFFECT_UNCERTAIN_REQUIRES_REASON');
  }
  if ((input.state === 'compensation_required'
      || input.state === 'compensating'
      || input.state === 'compensated')
    && !input.compensationReference) {
    throw new Error(`SIDE_EFFECT_${input.state.toUpperCase()}_REQUIRES_COMPENSATION_REFERENCE`);
  }
  if (input.state !== 'failed' && input.error) {
    throw new Error(`SIDE_EFFECT_ERROR_NOT_ALLOWED state=${input.state}`);
  }
  if (input.state !== 'uncertain' && input.uncertaintyReason) {
    throw new Error(`SIDE_EFFECT_UNCERTAINTY_NOT_ALLOWED state=${input.state}`);
  }
}

function assertContinuity(current: DurableSideEffectRevision, next: DurableSideEffectRevision): void {
  if (next.previousRevisionId !== current.revisionId) {
    throw new Error(`SIDE_EFFECT_PARENT_MISMATCH operation=${next.operationId}`);
  }
  const immutable: Array<keyof DurableSideEffectRevision> = [
    'operationId', 'operationKey', 'principalId', 'projectId', 'resource', 'capability', 'action', 'requestHash', 'sourceRef',
  ];
  for (const field of immutable) {
    if (next[field] !== current[field]) {
      throw new Error(`SIDE_EFFECT_IDENTITY_MUTATION field=${String(field)} operation=${next.operationId}`);
    }
  }
  if (Date.parse(next.systemFrom) <= Date.parse(current.systemFrom)) {
    throw new Error(`SIDE_EFFECT_SYSTEM_TIME_NOT_MONOTONIC operation=${next.operationId}`);
  }
  if (next.fencingVersion !== null
    && current.fencingVersion !== null
    && next.fencingVersion < current.fencingVersion) {
    throw new Error(`SIDE_EFFECT_FENCING_REGRESSION operation=${next.operationId}`);
  }
  assertAllowedTransition(current.state, next.state);
}

function durableSideEffectRevisionId(operationId: string, revision: number, transitionKey: string): string {
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: operationId,
    resourceType: 'durable-side-effect-revision',
    resourceId: canonicalHash128({ revision, transitionKey }),
  }, 'sfxr').id);
}

function isReusableTerminal(state: DurableSideEffectState): boolean {
  return state === 'committed' || state === 'failed' || state === 'compensated';
}

function normalizeError(input: {
  code: string;
  message: string;
  retryable?: boolean;
  details?: unknown;
}): DurableSideEffectError {
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

function optionalString(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  return nonEmpty(value, 'optional string');
}

function assertExpectedRevision(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('expectedRevision must be a non-negative safe integer');
  }
}

function compareRevision(left: DurableSideEffectRevision, right: DurableSideEffectRevision): number {
  return left.systemFrom.localeCompare(right.systemFrom)
    || left.operationId.localeCompare(right.operationId)
    || left.revision - right.revision
    || left.revisionId.localeCompare(right.revisionId);
}
