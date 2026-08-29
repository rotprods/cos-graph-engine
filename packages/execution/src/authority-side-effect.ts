import {
  canonicalHash128,
  canonicalIdentity,
  canonicalSerialize,
  type ProvenanceRef,
} from '@cos/core';

export type AuthoritySideEffectState =
  | 'claimed'
  | 'prepared'
  | 'executing'
  | 'reconciliation_required'
  | 'committed'
  | 'failed'
  | 'compensation_required'
  | 'compensating'
  | 'compensated';

export type AuthorityEffectKnowledge =
  | 'not_started'
  | 'unknown'
  | 'not_applied'
  | 'applied'
  | 'partial'
  | 'compensated';

export interface AuthorityOperationError {
  code: string;
  message: string;
  retryable: boolean;
  details: Record<string, unknown>;
}

export interface AuthorityCompensationEvidence {
  capability: string;
  resourceUri: string;
  input: unknown;
  inputHash: string;
  result: unknown | null;
  resultHash: string | null;
  error: AuthorityOperationError | null;
}

export interface AuthoritySideEffectRevision {
  revisionId: string;
  operationId: string;
  projectId: string;
  idempotencyKey: string;
  transitionKey: string;
  transitionHash: string;
  logicalHash: string;
  revision: number;
  previousRevisionId: string | null;
  state: AuthoritySideEffectState;
  effectKnowledge: AuthorityEffectKnowledge;
  principalId: string;
  agentRunId: string | null;
  capability: string;
  resourceUri: string;
  input: unknown;
  inputHash: string;
  attempt: number;
  fencingToken: number | null;
  providerIdempotencyKey: string | null;
  result: unknown | null;
  resultHash: string | null;
  error: AuthorityOperationError | null;
  errorHash: string | null;
  compensation: AuthorityCompensationEvidence | null;
  correlationId: string;
  causationId: string | null;
  provenance: ProvenanceRef[];
  metadata: Record<string, unknown>;
  createdAt: string;
  recordedAt: string;
  contentHash: string;
}

export interface AuthoritySideEffectView extends AuthoritySideEffectRevision {
  systemUntil: string | null;
  terminal: boolean;
}

export interface AuthoritySideEffectAppendResult {
  revision: AuthoritySideEffectRevision;
  appended: boolean;
}

export interface IAuthoritySideEffectStore {
  append(
    revision: AuthoritySideEffectRevision,
    expectedCurrentRevision: number,
  ): Promise<AuthoritySideEffectAppendResult>;
  getCurrent(operationId: string): Promise<AuthoritySideEffectRevision | null>;
  getHistory(operationId: string): Promise<AuthoritySideEffectRevision[]>;
  getByIdempotencyKey(projectId: string, idempotencyKey: string): Promise<AuthoritySideEffectRevision | null>;
  getByTransitionKey(projectId: string, transitionKey: string): Promise<AuthoritySideEffectRevision | null>;
}

export interface AuthorityFencingValidator {
  assertCurrent(resourceUri: string, fencingToken: number): Promise<void>;
}

export interface AuthoritySideEffectClaimInput {
  projectId: string;
  idempotencyKey: string;
  principalId: string;
  agentRunId?: string | null;
  capability: string;
  resourceUri: string;
  input: unknown;
  correlationId: string;
  causationId?: string | null;
  provenance: ProvenanceRef[];
  metadata?: Record<string, unknown>;
  recordedAt: string;
}

export interface AuthoritySideEffectTransitionBase {
  operationId: string;
  expectedRevision: number;
  transitionKey: string;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityPrepareInput extends AuthoritySideEffectTransitionBase {
  fencingToken: number;
  providerIdempotencyKey: string;
}

export interface AuthorityCommitInput extends AuthoritySideEffectTransitionBase {
  result: unknown;
}

export interface AuthorityFailureInput extends AuthoritySideEffectTransitionBase {
  error: AuthorityOperationError;
}

export interface AuthorityReconciliationInput extends AuthoritySideEffectTransitionBase {
  outcome: 'applied' | 'not_applied' | 'partial';
  result?: unknown;
  error?: AuthorityOperationError;
  /** Required when outcome=not_applied and a new attempt is prepared. */
  nextFencingToken?: number;
  nextProviderIdempotencyKey?: string;
}

export interface AuthorityCompensationRequiredInput extends AuthoritySideEffectTransitionBase {
  compensationCapability: string;
  compensationResourceUri?: string;
  compensationInput: unknown;
  error?: AuthorityOperationError;
}

export interface AuthorityCompensationCompleteInput extends AuthoritySideEffectTransitionBase {
  result: unknown;
}

/**
 * Append-only reference authority store.
 *
 * Every accepted transition is immutable. Operation and transition-key writes
 * are serialized separately so concurrent retries converge rather than bypass
 * expected-revision checks. Returned values are detached from canonical state.
 */
export class InMemoryAuthoritySideEffectStore implements IAuthoritySideEffectStore {
  private readonly histories = new Map<string, AuthoritySideEffectRevision[]>();
  private readonly byIdempotencyKey = new Map<string, string>();
  private readonly byTransitionKey = new Map<string, AuthoritySideEffectRevision>();
  private readonly revisionById = new Map<string, AuthoritySideEffectRevision>();
  private readonly operationTails = new Map<string, Promise<void>>();

  append(
    revision: AuthoritySideEffectRevision,
    expectedCurrentRevision: number,
  ): Promise<AuthoritySideEffectAppendResult> {
    return this.enqueue(`operation:${revision.operationId}`, async () => {
      assertRevision(revision);
      assertExpectedRevision(expectedCurrentRevision);

      const transitionIdentity = transitionMapKey(revision.projectId, revision.transitionKey);
      const duplicateTransition = this.byTransitionKey.get(transitionIdentity);
      if (duplicateTransition) {
        if (duplicateTransition.transitionHash !== revision.transitionHash
          || duplicateTransition.operationId !== revision.operationId) {
          throw new Error(`SIDE_EFFECT_TRANSITION_KEY_CONFLICT key=${revision.transitionKey}`);
        }
        return { revision: cloneRevision(duplicateTransition), appended: false };
      }

      const claimIdentity = idempotencyMapKey(revision.projectId, revision.idempotencyKey);
      const claimedOperation = this.byIdempotencyKey.get(claimIdentity);
      if (claimedOperation && claimedOperation !== revision.operationId) {
        throw new Error(`SIDE_EFFECT_IDEMPOTENCY_KEY_COLLISION key=${revision.idempotencyKey}`);
      }

      const history = this.histories.get(revision.operationId) ?? [];
      const current = history.at(-1);
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== expectedCurrentRevision) {
        throw new Error(`STALE_SIDE_EFFECT_REVISION expected=${expectedCurrentRevision} current=${currentRevision}`);
      }
      if (revision.revision !== currentRevision + 1) {
        throw new Error(`SIDE_EFFECT_REVISION_SEQUENCE expected=${currentRevision + 1} incoming=${revision.revision}`);
      }

      if (current) {
        if (revision.previousRevisionId !== current.revisionId) {
          throw new Error(`SIDE_EFFECT_REVISION_PARENT_MISMATCH operation=${revision.operationId}`);
        }
        if (revision.logicalHash !== current.logicalHash) {
          throw new Error(`SIDE_EFFECT_LOGICAL_IDENTITY_DRIFT operation=${revision.operationId}`);
        }
        if (Date.parse(revision.recordedAt) <= Date.parse(current.recordedAt)) {
          throw new Error(`SIDE_EFFECT_SYSTEM_TIME_NOT_MONOTONIC operation=${revision.operationId}`);
        }
      } else {
        if (revision.revision !== 1 || revision.previousRevisionId !== null || revision.state !== 'claimed') {
          throw new Error(`SIDE_EFFECT_INVALID_INITIAL_REVISION operation=${revision.operationId}`);
        }
      }

      const revisionCollision = this.revisionById.get(revision.revisionId);
      if (revisionCollision) {
        if (revisionCollision.contentHash !== revision.contentHash) {
          throw new Error(`SIDE_EFFECT_REVISION_ID_COLLISION id=${revision.revisionId}`);
        }
        return { revision: cloneRevision(revisionCollision), appended: false };
      }

      const stored = cloneRevision(revision);
      history.push(stored);
      this.histories.set(stored.operationId, history);
      this.revisionById.set(stored.revisionId, stored);
      this.byIdempotencyKey.set(claimIdentity, stored.operationId);
      this.byTransitionKey.set(transitionIdentity, stored);
      return { revision: cloneRevision(stored), appended: true };
    });
  }

  async getCurrent(operationId: string): Promise<AuthoritySideEffectRevision | null> {
    const current = this.histories.get(nonEmpty(operationId, 'operationId'))?.at(-1);
    return current ? cloneRevision(current) : null;
  }

  async getHistory(operationId: string): Promise<AuthoritySideEffectRevision[]> {
    return (this.histories.get(nonEmpty(operationId, 'operationId')) ?? []).map(cloneRevision);
  }

  async getByIdempotencyKey(projectId: string, idempotencyKey: string): Promise<AuthoritySideEffectRevision | null> {
    const operationId = this.byIdempotencyKey.get(idempotencyMapKey(projectId, idempotencyKey));
    return operationId ? this.getCurrent(operationId) : null;
  }

  async getByTransitionKey(projectId: string, transitionKey: string): Promise<AuthoritySideEffectRevision | null> {
    const revision = this.byTransitionKey.get(transitionMapKey(projectId, transitionKey));
    return revision ? cloneRevision(revision) : null;
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
 * Authority lifecycle service for side-effecting operations.
 *
 * This service records truth about attempts and outcomes. It does not pretend to
 * make an arbitrary external provider transactional. A crash from `executing`
 * enters reconciliation; the caller must inspect provider/resource state before
 * the ledger permits re-execution or commitment.
 */
export class AuthoritySideEffectService {
  constructor(
    private readonly store: IAuthoritySideEffectStore,
    private readonly fencing: AuthorityFencingValidator,
  ) {}

  async claim(input: AuthoritySideEffectClaimInput): Promise<AuthoritySideEffectAppendResult> {
    const normalized = normalizeClaim(input);
    const existing = await this.store.getByIdempotencyKey(normalized.projectId, normalized.idempotencyKey);
    const logicalHash = operationLogicalHash(normalized);
    if (existing) {
      if (existing.logicalHash !== logicalHash) {
        throw new Error(`SIDE_EFFECT_IDEMPOTENCY_CONFLICT key=${normalized.idempotencyKey}`);
      }
      return { revision: cloneRevision(existing), appended: false };
    }

    const identity = canonicalIdentity({
      scheme: 'agentic',
      authority: normalized.projectId,
      resourceType: 'side-effect-operation',
      resourceId: normalized.idempotencyKey,
    }, 'op');
    const transitionKey = `claim:${normalized.idempotencyKey}`;
    const transitionHash = canonicalHash128({
      action: 'claim',
      logicalHash,
      transitionKey,
    });
    const revision = sealRevision({
      revisionId: revisionIdentity(String(identity.id), 1, normalized.recordedAt),
      operationId: String(identity.id),
      projectId: normalized.projectId,
      idempotencyKey: normalized.idempotencyKey,
      transitionKey,
      transitionHash,
      logicalHash,
      revision: 1,
      previousRevisionId: null,
      state: 'claimed',
      effectKnowledge: 'not_started',
      principalId: normalized.principalId,
      agentRunId: normalized.agentRunId,
      capability: normalized.capability,
      resourceUri: normalized.resourceUri,
      input: normalized.input,
      inputHash: canonicalHash128(normalized.input),
      attempt: 0,
      fencingToken: null,
      providerIdempotencyKey: null,
      result: null,
      resultHash: null,
      error: null,
      errorHash: null,
      compensation: null,
      correlationId: normalized.correlationId,
      causationId: normalized.causationId,
      provenance: normalized.provenance,
      metadata: normalized.metadata,
      createdAt: normalized.recordedAt,
      recordedAt: normalized.recordedAt,
    });
    return this.store.append(revision, 0);
  }

  async prepare(input: AuthorityPrepareInput): Promise<AuthoritySideEffectAppendResult> {
    const current = await this.requireCurrent(input.operationId);
    const token = fencingToken(input.fencingToken);
    if (current.fencingToken !== null && token <= current.fencingToken) {
      throw new Error(`SIDE_EFFECT_FENCING_NOT_MONOTONIC previous=${current.fencingToken} incoming=${token}`);
    }
    if (current.state === 'failed' && !current.error?.retryable) {
      throw new Error(`SIDE_EFFECT_NON_RETRYABLE_FAILURE operation=${current.operationId}`);
    }
    if (!['claimed', 'failed', 'reconciliation_required'].includes(current.state)) {
      throw invalidTransition(current, 'prepared');
    }
    if (current.state === 'reconciliation_required' && current.effectKnowledge !== 'not_applied') {
      throw new Error(`SIDE_EFFECT_RECONCILIATION_REQUIRED operation=${current.operationId}`);
    }
    return this.transition(current, {
      ...input,
      action: 'prepare',
      state: 'prepared',
      effectKnowledge: 'not_started',
      attempt: current.attempt + 1,
      fencingToken: token,
      providerIdempotencyKey: nonEmpty(input.providerIdempotencyKey, 'providerIdempotencyKey'),
      result: null,
      error: null,
    });
  }

  async beginExecution(input: AuthoritySideEffectTransitionBase): Promise<AuthoritySideEffectAppendResult> {
    const current = await this.requireCurrent(input.operationId);
    if (current.state !== 'prepared') throw invalidTransition(current, 'executing');
    if (current.fencingToken === null || current.providerIdempotencyKey === null) {
      throw new Error(`SIDE_EFFECT_PREPARE_EVIDENCE_MISSING operation=${current.operationId}`);
    }
    await this.fencing.assertCurrent(current.resourceUri, current.fencingToken);
    return this.transition(current, {
      ...input,
      action: 'begin_execution',
      state: 'executing',
      effectKnowledge: 'unknown',
    });
  }

  async markReconciliationRequired(
    input: AuthoritySideEffectTransitionBase & { reason: AuthorityOperationError },
  ): Promise<AuthoritySideEffectAppendResult> {
    const current = await this.requireCurrent(input.operationId);
    if (current.state !== 'executing') throw invalidTransition(current, 'reconciliation_required');
    return this.transition(current, {
      ...input,
      action: 'mark_reconciliation_required',
      state: 'reconciliation_required',
      effectKnowledge: 'unknown',
      error: normalizeError(input.reason),
    });
  }

  async commit(input: AuthorityCommitInput): Promise<AuthoritySideEffectAppendResult> {
    const current = await this.requireCurrent(input.operationId);
    if (!['executing', 'reconciliation_required'].includes(current.state)) {
      throw invalidTransition(current, 'committed');
    }
    if (current.fencingToken === null) throw new Error(`SIDE_EFFECT_FENCING_MISSING operation=${current.operationId}`);
    await this.fencing.assertCurrent(current.resourceUri, current.fencingToken);
    const result = canonicalClone(input.result, 'side-effect result');
    return this.transition(current, {
      ...input,
      action: 'commit',
      state: 'committed',
      effectKnowledge: 'applied',
      result,
      resultHash: canonicalHash128(result),
      error: null,
    });
  }

  async failWithoutEffect(input: AuthorityFailureInput): Promise<AuthoritySideEffectAppendResult> {
    const current = await this.requireCurrent(input.operationId);
    if (!['claimed', 'prepared', 'executing', 'reconciliation_required'].includes(current.state)) {
      throw invalidTransition(current, 'failed');
    }
    if (current.state === 'executing' || current.state === 'reconciliation_required') {
      if (current.effectKnowledge !== 'not_applied') {
        throw new Error(`SIDE_EFFECT_EFFECT_NOT_PROVEN_ABSENT operation=${current.operationId}`);
      }
    }
    return this.transition(current, {
      ...input,
      action: 'fail_without_effect',
      state: 'failed',
      effectKnowledge: 'not_applied',
      error: normalizeError(input.error),
      result: null,
      resultHash: null,
    });
  }

  async reconcile(input: AuthorityReconciliationInput): Promise<AuthoritySideEffectAppendResult> {
    const current = await this.requireCurrent(input.operationId);
    if (current.state !== 'reconciliation_required') {
      throw invalidTransition(current, 'reconciliation_required');
    }

    if (input.outcome === 'applied') {
      return this.commit({
        operationId: input.operationId,
        expectedRevision: input.expectedRevision,
        transitionKey: input.transitionKey,
        recordedAt: input.recordedAt,
        metadata: input.metadata,
        result: input.result ?? null,
      });
    }

    if (input.outcome === 'partial') {
      const error = input.error ?? {
        code: 'SIDE_EFFECT_PARTIAL_APPLICATION',
        message: 'Provider/resource reports partial application',
        retryable: false,
        details: {},
      };
      return this.transition(current, {
        ...input,
        action: 'reconcile_partial',
        state: 'compensation_required',
        effectKnowledge: 'partial',
        error: normalizeError(error),
      });
    }

    const nextToken = fencingToken(input.nextFencingToken);
    if (current.fencingToken !== null && nextToken <= current.fencingToken) {
      throw new Error(`SIDE_EFFECT_FENCING_NOT_MONOTONIC previous=${current.fencingToken} incoming=${nextToken}`);
    }
    return this.transition(current, {
      ...input,
      action: 'reconcile_not_applied',
      state: 'prepared',
      effectKnowledge: 'not_started',
      attempt: current.attempt + 1,
      fencingToken: nextToken,
      providerIdempotencyKey: nonEmpty(input.nextProviderIdempotencyKey ?? '', 'nextProviderIdempotencyKey'),
      error: input.error ? normalizeError(input.error) : null,
      result: null,
      resultHash: null,
    });
  }

  async requireCompensation(input: AuthorityCompensationRequiredInput): Promise<AuthoritySideEffectAppendResult> {
    const current = await this.requireCurrent(input.operationId);
    if (!['executing', 'reconciliation_required'].includes(current.state)) {
      throw invalidTransition(current, 'compensation_required');
    }
    const compensationInput = canonicalClone(input.compensationInput, 'compensation input');
    const compensation: AuthorityCompensationEvidence = {
      capability: nonEmpty(input.compensationCapability, 'compensationCapability'),
      resourceUri: nonEmpty(input.compensationResourceUri ?? current.resourceUri, 'compensationResourceUri'),
      input: compensationInput,
      inputHash: canonicalHash128(compensationInput),
      result: null,
      resultHash: null,
      error: null,
    };
    return this.transition(current, {
      ...input,
      action: 'require_compensation',
      state: 'compensation_required',
      effectKnowledge: 'partial',
      compensation,
      error: input.error ? normalizeError(input.error) : current.error,
    });
  }

  async beginCompensation(input: AuthoritySideEffectTransitionBase): Promise<AuthoritySideEffectAppendResult> {
    const current = await this.requireCurrent(input.operationId);
    if (current.state !== 'compensation_required' || !current.compensation) {
      throw invalidTransition(current, 'compensating');
    }
    return this.transition(current, {
      ...input,
      action: 'begin_compensation',
      state: 'compensating',
      effectKnowledge: current.effectKnowledge,
    });
  }

  async completeCompensation(input: AuthorityCompensationCompleteInput): Promise<AuthoritySideEffectAppendResult> {
    const current = await this.requireCurrent(input.operationId);
    if (current.state !== 'compensating' || !current.compensation) {
      throw invalidTransition(current, 'compensated');
    }
    const result = canonicalClone(input.result, 'compensation result');
    return this.transition(current, {
      ...input,
      action: 'complete_compensation',
      state: 'compensated',
      effectKnowledge: 'compensated',
      compensation: {
        ...current.compensation,
        result,
        resultHash: canonicalHash128(result),
        error: null,
      },
    });
  }

  async get(operationId: string): Promise<AuthoritySideEffectView | null> {
    const current = await this.store.getCurrent(operationId);
    if (!current) return null;
    return viewOf(current, null);
  }

  async history(operationId: string): Promise<AuthoritySideEffectView[]> {
    const history = await this.store.getHistory(operationId);
    return history.map((revision, index) => viewOf(revision, history[index + 1]?.recordedAt ?? null));
  }

  private async requireCurrent(operationId: string): Promise<AuthoritySideEffectRevision> {
    const current = await this.store.getCurrent(nonEmpty(operationId, 'operationId'));
    if (!current) throw new Error(`SIDE_EFFECT_OPERATION_NOT_FOUND id=${operationId}`);
    return current;
  }

  private async transition(
    current: AuthoritySideEffectRevision,
    input: AuthoritySideEffectTransitionBase & {
      action: string;
      state: AuthoritySideEffectState;
      effectKnowledge: AuthorityEffectKnowledge;
      attempt?: number;
      fencingToken?: number | null;
      providerIdempotencyKey?: string | null;
      result?: unknown | null;
      resultHash?: string | null;
      error?: AuthorityOperationError | null;
      compensation?: AuthorityCompensationEvidence | null;
    },
  ): Promise<AuthoritySideEffectAppendResult> {
    assertExpectedRevision(input.expectedRevision);
    const transitionKey = nonEmpty(input.transitionKey, 'transitionKey');
    const recordedAt = canonicalTime(input.recordedAt, 'transition recordedAt');
    const metadata = mergeMetadata(current.metadata, input.metadata ?? {});
    const error = input.error === undefined ? current.error : input.error;
    const compensation = input.compensation === undefined ? current.compensation : input.compensation;
    const intent = {
      action: input.action,
      operationId: current.operationId,
      expectedRevision: input.expectedRevision,
      state: input.state,
      effectKnowledge: input.effectKnowledge,
      attempt: input.attempt ?? current.attempt,
      fencingToken: input.fencingToken === undefined ? current.fencingToken : input.fencingToken,
      providerIdempotencyKey: input.providerIdempotencyKey === undefined
        ? current.providerIdempotencyKey
        : input.providerIdempotencyKey,
      result: input.result === undefined ? current.result : input.result,
      error,
      compensation,
      metadata,
      recordedAt,
    };
    const transitionHash = canonicalHash128(intent);
    const duplicate = await this.store.getByTransitionKey(current.projectId, transitionKey);
    if (duplicate) {
      if (duplicate.operationId !== current.operationId || duplicate.transitionHash !== transitionHash) {
        throw new Error(`SIDE_EFFECT_TRANSITION_KEY_CONFLICT key=${transitionKey}`);
      }
      return { revision: cloneRevision(duplicate), appended: false };
    }
    if (current.revision !== input.expectedRevision) {
      throw new Error(`STALE_SIDE_EFFECT_REVISION expected=${input.expectedRevision} current=${current.revision}`);
    }
    if (isTerminal(current)) throw new Error(`SIDE_EFFECT_TERMINAL operation=${current.operationId} state=${current.state}`);

    const nextRevision = current.revision + 1;
    const result = input.result === undefined ? current.result : canonicalNullable(input.result, 'side-effect result');
    const normalizedError = error ? normalizeError(error) : null;
    const normalizedCompensation = compensation ? normalizeCompensation(compensation) : null;
    const revision = sealRevision({
      ...cloneRevision(current),
      revisionId: revisionIdentity(current.operationId, nextRevision, recordedAt),
      transitionKey,
      transitionHash,
      revision: nextRevision,
      previousRevisionId: current.revisionId,
      state: input.state,
      effectKnowledge: input.effectKnowledge,
      attempt: input.attempt ?? current.attempt,
      fencingToken: input.fencingToken === undefined ? current.fencingToken : input.fencingToken,
      providerIdempotencyKey: input.providerIdempotencyKey === undefined
        ? current.providerIdempotencyKey
        : input.providerIdempotencyKey,
      result,
      resultHash: input.resultHash === undefined
        ? (result === null ? null : canonicalHash128(result))
        : input.resultHash,
      error: normalizedError,
      errorHash: normalizedError ? canonicalHash128(normalizedError) : null,
      compensation: normalizedCompensation,
      metadata,
      recordedAt,
    });
    return this.store.append(revision, input.expectedRevision);
  }
}

function normalizeClaim(input: AuthoritySideEffectClaimInput) {
  const projectId = nonEmpty(input.projectId, 'projectId');
  const idempotencyKey = nonEmpty(input.idempotencyKey, 'idempotencyKey');
  const principalId = nonEmpty(input.principalId, 'principalId');
  const agentRunId = optionalString(input.agentRunId);
  const capability = nonEmpty(input.capability, 'capability');
  const resourceUri = nonEmpty(input.resourceUri, 'resourceUri');
  const correlationId = nonEmpty(input.correlationId, 'correlationId');
  const causationId = optionalString(input.causationId);
  const recordedAt = canonicalTime(input.recordedAt, 'claim recordedAt');
  const value = canonicalClone(input.input, 'side-effect input');
  const provenance = normalizeProvenance(input.provenance);
  const metadata = canonicalClone(input.metadata ?? {}, 'side-effect metadata') as Record<string, unknown>;
  return {
    projectId,
    idempotencyKey,
    principalId,
    agentRunId,
    capability,
    resourceUri,
    input: value,
    correlationId,
    causationId,
    provenance,
    metadata,
    recordedAt,
  };
}

function operationLogicalHash(input: ReturnType<typeof normalizeClaim>): string {
  return canonicalHash128({
    projectId: input.projectId,
    principalId: input.principalId,
    agentRunId: input.agentRunId,
    capability: input.capability,
    resourceUri: input.resourceUri,
    input: input.input,
  });
}

function sealRevision(
  revision: Omit<AuthoritySideEffectRevision, 'contentHash'> & { contentHash?: string },
): AuthoritySideEffectRevision {
  const withoutHash = {
    revisionId: nonEmpty(revision.revisionId, 'revisionId'),
    operationId: nonEmpty(revision.operationId, 'operationId'),
    projectId: nonEmpty(revision.projectId, 'projectId'),
    idempotencyKey: nonEmpty(revision.idempotencyKey, 'idempotencyKey'),
    transitionKey: nonEmpty(revision.transitionKey, 'transitionKey'),
    transitionHash: nonEmpty(revision.transitionHash, 'transitionHash'),
    logicalHash: nonEmpty(revision.logicalHash, 'logicalHash'),
    revision: safeInteger(revision.revision, 'revision', 1),
    previousRevisionId: optionalString(revision.previousRevisionId),
    state: revision.state,
    effectKnowledge: revision.effectKnowledge,
    principalId: nonEmpty(revision.principalId, 'principalId'),
    agentRunId: optionalString(revision.agentRunId),
    capability: nonEmpty(revision.capability, 'capability'),
    resourceUri: nonEmpty(revision.resourceUri, 'resourceUri'),
    input: canonicalClone(revision.input, 'side-effect input'),
    inputHash: nonEmpty(revision.inputHash, 'inputHash'),
    attempt: safeInteger(revision.attempt, 'attempt', 0),
    fencingToken: revision.fencingToken === null ? null : fencingToken(revision.fencingToken),
    providerIdempotencyKey: optionalString(revision.providerIdempotencyKey),
    result: canonicalNullable(revision.result, 'side-effect result'),
    resultHash: optionalString(revision.resultHash),
    error: revision.error ? normalizeError(revision.error) : null,
    errorHash: optionalString(revision.errorHash),
    compensation: revision.compensation ? normalizeCompensation(revision.compensation) : null,
    correlationId: nonEmpty(revision.correlationId, 'correlationId'),
    causationId: optionalString(revision.causationId),
    provenance: normalizeProvenance(revision.provenance),
    metadata: canonicalClone(revision.metadata, 'side-effect metadata') as Record<string, unknown>,
    createdAt: canonicalTime(revision.createdAt, 'createdAt'),
    recordedAt: canonicalTime(revision.recordedAt, 'recordedAt'),
  };
  assertStateSemantics(withoutHash);
  return {
    ...withoutHash,
    contentHash: canonicalHash128(withoutHash),
  };
}

function assertRevision(revision: AuthoritySideEffectRevision): void {
  const expected = sealRevision({ ...cloneRevision(revision), contentHash: undefined });
  if (expected.contentHash !== revision.contentHash) {
    throw new Error(`SIDE_EFFECT_CONTENT_HASH_MISMATCH revision=${revision.revisionId}`);
  }
}

function assertStateSemantics(revision: Omit<AuthoritySideEffectRevision, 'contentHash'>): void {
  if (revision.revision === 1 && revision.createdAt !== revision.recordedAt) {
    throw new Error('Initial side-effect revision createdAt must equal recordedAt');
  }
  if (Date.parse(revision.recordedAt) < Date.parse(revision.createdAt)) {
    throw new Error('Side-effect recordedAt cannot precede createdAt');
  }
  if (revision.inputHash !== canonicalHash128(revision.input)) {
    throw new Error(`SIDE_EFFECT_INPUT_HASH_MISMATCH operation=${revision.operationId}`);
  }
  if ((revision.result === null) !== (revision.resultHash === null)) {
    throw new Error(`SIDE_EFFECT_RESULT_HASH_PRESENCE_MISMATCH operation=${revision.operationId}`);
  }
  if (revision.result !== null && revision.resultHash !== canonicalHash128(revision.result)) {
    throw new Error(`SIDE_EFFECT_RESULT_HASH_MISMATCH operation=${revision.operationId}`);
  }
  if ((revision.error === null) !== (revision.errorHash === null)) {
    throw new Error(`SIDE_EFFECT_ERROR_HASH_PRESENCE_MISMATCH operation=${revision.operationId}`);
  }
  if (revision.error !== null && revision.errorHash !== canonicalHash128(revision.error)) {
    throw new Error(`SIDE_EFFECT_ERROR_HASH_MISMATCH operation=${revision.operationId}`);
  }
  if (revision.attempt === 0 && (revision.fencingToken !== null || revision.providerIdempotencyKey !== null)) {
    throw new Error(`SIDE_EFFECT_ATTEMPT_EVIDENCE_WITHOUT_ATTEMPT operation=${revision.operationId}`);
  }
  if (revision.attempt > 0 && (revision.fencingToken === null || revision.providerIdempotencyKey === null)) {
    throw new Error(`SIDE_EFFECT_ATTEMPT_EVIDENCE_MISSING operation=${revision.operationId}`);
  }
  if (revision.state === 'committed' && revision.effectKnowledge !== 'applied') {
    throw new Error(`SIDE_EFFECT_COMMIT_WITHOUT_APPLIED_EVIDENCE operation=${revision.operationId}`);
  }
  if (revision.state === 'compensated' && revision.effectKnowledge !== 'compensated') {
    throw new Error(`SIDE_EFFECT_COMPENSATION_STATE_INVALID operation=${revision.operationId}`);
  }
  if (['compensation_required', 'compensating', 'compensated'].includes(revision.state)
    && revision.compensation === null) {
    throw new Error(`SIDE_EFFECT_COMPENSATION_EVIDENCE_MISSING operation=${revision.operationId}`);
  }
}

function viewOf(revision: AuthoritySideEffectRevision, systemUntil: string | null): AuthoritySideEffectView {
  return {
    ...cloneRevision(revision),
    systemUntil,
    terminal: isTerminal(revision),
  };
}

function isTerminal(revision: AuthoritySideEffectRevision): boolean {
  return revision.state === 'committed'
    || revision.state === 'compensated'
    || (revision.state === 'failed' && revision.error?.retryable === false);
}

function normalizeError(error: AuthorityOperationError): AuthorityOperationError {
  return {
    code: nonEmpty(error.code, 'error code'),
    message: nonEmpty(error.message, 'error message'),
    retryable: Boolean(error.retryable),
    details: canonicalClone(error.details ?? {}, 'error details') as Record<string, unknown>,
  };
}

function normalizeCompensation(compensation: AuthorityCompensationEvidence): AuthorityCompensationEvidence {
  const input = canonicalClone(compensation.input, 'compensation input');
  const result = canonicalNullable(compensation.result, 'compensation result');
  const error = compensation.error ? normalizeError(compensation.error) : null;
  const normalized: AuthorityCompensationEvidence = {
    capability: nonEmpty(compensation.capability, 'compensation capability'),
    resourceUri: nonEmpty(compensation.resourceUri, 'compensation resourceUri'),
    input,
    inputHash: nonEmpty(compensation.inputHash, 'compensation inputHash'),
    result,
    resultHash: optionalString(compensation.resultHash),
    error,
  };
  if (normalized.inputHash !== canonicalHash128(input)) throw new Error('SIDE_EFFECT_COMPENSATION_INPUT_HASH_MISMATCH');
  if ((result === null) !== (normalized.resultHash === null)) throw new Error('SIDE_EFFECT_COMPENSATION_RESULT_HASH_PRESENCE_MISMATCH');
  if (result !== null && normalized.resultHash !== canonicalHash128(result)) throw new Error('SIDE_EFFECT_COMPENSATION_RESULT_HASH_MISMATCH');
  return normalized;
}

function normalizeProvenance(provenance: ProvenanceRef[]): ProvenanceRef[] {
  if (!Array.isArray(provenance) || provenance.length === 0) {
    throw new Error('side-effect provenance requires at least one source');
  }
  return provenance.map((entry, index) => ({
    source: nonEmpty(entry.source, `provenance[${index}].source`),
    ...(entry.revision === undefined ? {} : { revision: nonEmpty(entry.revision, `provenance[${index}].revision`) }),
    ...(entry.actor === undefined ? {} : { actor: nonEmpty(entry.actor, `provenance[${index}].actor`) }),
    ...(entry.locator === undefined ? {} : { locator: nonEmpty(entry.locator, `provenance[${index}].locator`) }),
  }));
}

function mergeMetadata(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  return canonicalClone({ ...current, ...incoming }, 'side-effect metadata') as Record<string, unknown>;
}

function revisionIdentity(operationId: string, revision: number, recordedAt: string): string {
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: 'cos-execution',
    resourceType: 'side-effect-revision',
    resourceId: `${operationId}:${revision}:${recordedAt}`,
  }, 'opr').id);
}

function idempotencyMapKey(projectId: string, key: string): string {
  return `${nonEmpty(projectId, 'projectId')}\u0000${nonEmpty(key, 'idempotencyKey')}`;
}

function transitionMapKey(projectId: string, key: string): string {
  return `${nonEmpty(projectId, 'projectId')}\u0000${nonEmpty(key, 'transitionKey')}`;
}

function cloneRevision(revision: AuthoritySideEffectRevision): AuthoritySideEffectRevision {
  return structuredClone(revision);
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${errorMessage(error)}`);
  }
}

function canonicalNullable<T>(value: T | null, label: string): T | null {
  return value === null ? null : canonicalClone(value, label);
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function optionalString(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  return nonEmpty(value, 'optional string');
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function safeInteger(value: number, label: string, minimum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`${label} must be a safe integer >= ${minimum}`);
  return value;
}

function fencingToken(value?: number): number {
  if (value === undefined || !Number.isSafeInteger(value) || value < 1) {
    throw new Error('fencingToken must be a positive safe integer');
  }
  return value;
}

function assertExpectedRevision(value: number): void {
  safeInteger(value, 'expectedRevision', 0);
}

function invalidTransition(current: AuthoritySideEffectRevision, target: AuthoritySideEffectState): Error {
  return new Error(`SIDE_EFFECT_INVALID_TRANSITION operation=${current.operationId} from=${current.state} to=${target}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
