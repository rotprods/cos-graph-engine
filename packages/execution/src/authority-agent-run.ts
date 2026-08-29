import {
  canonicalHash128,
  canonicalIdentity,
  canonicalSerialize,
  type ProvenanceRef,
} from '@cos/core';

export type AuthorityAgentRunState =
  | 'created'
  | 'planned'
  | 'running'
  | 'waiting_approval'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'compensation_required'
  | 'compensated';

export type AuthorityStepOutcome = 'accepted' | 'failed' | 'partial' | 'skipped';

export interface AuthorityGoalSpec {
  intent: string;
  desiredOutcome: string;
  constraints: string[];
  projectId: string;
  requestedBy: string;
  provenance: ProvenanceRef[];
}

export interface AuthorityAcceptanceCriterion {
  id: string;
  description: string;
  required: boolean;
  evaluatorId: string;
  evaluatorVersion: string;
}

export interface AuthorityPlanStep {
  id: string;
  name: string;
  capability: string;
  critical: boolean;
  sideEffecting: boolean;
  dependencies: string[];
  acceptanceCriterionIds: string[];
  input: unknown;
  inputHash: string;
  metadata: Record<string, unknown>;
}

export interface AuthorityStepResult {
  stepId: string;
  attempt: number;
  outcome: AuthorityStepOutcome;
  result: unknown | null;
  resultHash: string | null;
  error: { code: string; message: string; retryable: boolean; details: Record<string, unknown> } | null;
  evidenceRefs: string[];
  sideEffectOperationId: string | null;
  sideEffectTerminalState: 'committed' | 'compensated' | 'failed' | null;
  startedAt: string;
  completedAt: string;
  metadata: Record<string, unknown>;
}

export interface AuthorityCriterionResult {
  criterionId: string;
  passed: boolean;
  evaluatorId: string;
  evaluatorVersion: string;
  evidenceRefs: string[];
  evaluatedAt: string;
  details: Record<string, unknown>;
}

export interface AuthorityAgentRunRevision {
  revisionId: string;
  runId: string;
  projectId: string;
  operationKey: string;
  operationHash: string;
  revision: number;
  previousRevisionId: string | null;
  state: AuthorityAgentRunState;
  principalId: string;
  agentId: string;
  goal: AuthorityGoalSpec;
  acceptanceCriteria: AuthorityAcceptanceCriterion[];
  plan: AuthorityPlanStep[];
  stepResults: AuthorityStepResult[];
  criterionResults: AuthorityCriterionResult[];
  terminalReason: string | null;
  correlationId: string;
  causationId: string | null;
  createdAt: string;
  recordedAt: string;
  metadata: Record<string, unknown>;
  contentHash: string;
}

export interface AuthorityAgentRunView extends AuthorityAgentRunRevision {
  terminal: boolean;
  systemUntil: string | null;
}

export interface AuthorityAgentRunAppendResult {
  revision: AuthorityAgentRunRevision;
  appended: boolean;
}

export interface IAuthorityAgentRunStore {
  append(
    revision: AuthorityAgentRunRevision,
    expectedRevision: number,
  ): Promise<AuthorityAgentRunAppendResult>;
  getCurrent(runId: string): Promise<AuthorityAgentRunRevision | null>;
  getByOperationKey(projectId: string, operationKey: string): Promise<AuthorityAgentRunRevision | null>;
  getHistory(runId: string): Promise<AuthorityAgentRunRevision[]>;
}

export interface AuthorityAgentRunCreateInput {
  projectId: string;
  principalId: string;
  agentId: string;
  operationKey: string;
  goal: AuthorityGoalSpec;
  acceptanceCriteria: AuthorityAcceptanceCriterion[];
  correlationId: string;
  causationId?: string | null;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityAgentRunMutationBase {
  runId: string;
  expectedRevision: number;
  operationKey: string;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityAgentRunPlanInput extends AuthorityAgentRunMutationBase {
  steps: Array<Omit<AuthorityPlanStep, 'inputHash'>>;
}

export interface AuthorityAgentRunStepInput extends AuthorityAgentRunMutationBase {
  result: AuthorityStepResult;
}

export interface AuthorityAgentRunCompleteInput extends AuthorityAgentRunMutationBase {
  criteria: AuthorityCriterionResult[];
  terminalReason?: string;
}

export interface AuthorityAgentRunTerminalInput extends AuthorityAgentRunMutationBase {
  terminalReason: string;
  state: 'failed' | 'cancelled' | 'blocked' | 'waiting_approval' | 'compensation_required' | 'compensated';
}

/** Append-only serialized reference store for durable agent-run aggregates. */
export class InMemoryAuthorityAgentRunStore implements IAuthorityAgentRunStore {
  private readonly histories = new Map<string, AuthorityAgentRunRevision[]>();
  private readonly byOperation = new Map<string, AuthorityAgentRunRevision>();
  private readonly revisionById = new Map<string, AuthorityAgentRunRevision>();
  private readonly tails = new Map<string, Promise<void>>();

  append(
    raw: AuthorityAgentRunRevision,
    expectedRevision: number,
  ): Promise<AuthorityAgentRunAppendResult> {
    return this.enqueue(raw.runId, async () => {
      const revision = cloneAndVerify(raw);
      assertNonNegativeInteger(expectedRevision, 'expectedRevision');
      const operationIdentity = operationMapKey(revision.projectId, revision.operationKey);
      const duplicate = this.byOperation.get(operationIdentity);
      if (duplicate) {
        if (duplicate.operationHash !== revision.operationHash) {
          throw new Error(`AGENT_RUN_OPERATION_KEY_CONFLICT key=${revision.operationKey}`);
        }
        return { revision: cloneRevision(duplicate), appended: false };
      }

      const history = this.histories.get(revision.runId) ?? [];
      const current = history.at(-1);
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== expectedRevision) {
        throw new Error(`STALE_AGENT_RUN_REVISION expected=${expectedRevision} current=${currentRevision}`);
      }
      if (revision.revision !== currentRevision + 1) {
        throw new Error(`AGENT_RUN_REVISION_SEQUENCE expected=${currentRevision + 1} incoming=${revision.revision}`);
      }
      if (current) {
        if (revision.previousRevisionId !== current.revisionId) {
          throw new Error(`AGENT_RUN_REVISION_PARENT_MISMATCH run=${revision.runId}`);
        }
        if (Date.parse(revision.recordedAt) <= Date.parse(current.recordedAt)) {
          throw new Error(`AGENT_RUN_SYSTEM_TIME_NOT_MONOTONIC run=${revision.runId}`);
        }
        assertImmutableRunIdentity(current, revision);
      } else if (revision.revision !== 1
        || revision.previousRevisionId !== null
        || revision.state !== 'created') {
        throw new Error(`AGENT_RUN_INVALID_INITIAL_REVISION run=${revision.runId}`);
      }

      const collision = this.revisionById.get(revision.revisionId);
      if (collision) {
        if (collision.contentHash !== revision.contentHash) {
          throw new Error(`AGENT_RUN_REVISION_ID_COLLISION id=${revision.revisionId}`);
        }
        return { revision: cloneRevision(collision), appended: false };
      }

      const stored = cloneRevision(revision);
      history.push(stored);
      this.histories.set(stored.runId, history);
      this.byOperation.set(operationIdentity, stored);
      this.revisionById.set(stored.revisionId, stored);
      return { revision: cloneRevision(stored), appended: true };
    });
  }

  async getCurrent(runId: string): Promise<AuthorityAgentRunRevision | null> {
    const current = this.histories.get(nonEmpty(runId, 'runId'))?.at(-1);
    return current ? cloneRevision(current) : null;
  }

  async getByOperationKey(
    projectId: string,
    operationKey: string,
  ): Promise<AuthorityAgentRunRevision | null> {
    const revision = this.byOperation.get(operationMapKey(projectId, operationKey));
    return revision ? cloneRevision(revision) : null;
  }

  async getHistory(runId: string): Promise<AuthorityAgentRunRevision[]> {
    return (this.histories.get(nonEmpty(runId, 'runId')) ?? []).map(cloneRevision);
  }

  private enqueue<T>(runId: string, operation: () => Promise<T>): Promise<T> {
    const key = nonEmpty(runId, 'runId');
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(operation);
    const tail = result.then(() => undefined, () => undefined);
    this.tails.set(key, tail);
    return result.finally(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
  }
}

/** Durable, explicit-evidence agent-run aggregate service. */
export class AuthorityAgentRunService {
  constructor(private readonly store: IAuthorityAgentRunStore) {}

  async create(input: AuthorityAgentRunCreateInput): Promise<AuthorityAgentRunAppendResult> {
    const normalized = normalizeCreate(input);
    const existing = await this.store.getByOperationKey(normalized.projectId, normalized.operationKey);
    const operationHash = canonicalHash128({
      action: 'create',
      projectId: normalized.projectId,
      principalId: normalized.principalId,
      agentId: normalized.agentId,
      goal: normalized.goal,
      acceptanceCriteria: normalized.acceptanceCriteria,
      correlationId: normalized.correlationId,
      causationId: normalized.causationId,
    });
    if (existing) {
      if (existing.operationHash !== operationHash) {
        throw new Error(`AGENT_RUN_OPERATION_KEY_CONFLICT key=${normalized.operationKey}`);
      }
      return { revision: cloneRevision(existing), appended: false };
    }

    const runIdentity = canonicalIdentity({
      scheme: 'agentic',
      authority: normalized.projectId,
      resourceType: 'agent-run',
      resourceId: normalized.operationKey,
    }, 'run');
    const runId = String(runIdentity.id);
    const revision = sealRevision({
      revisionId: revisionIdentity(runId, 1, normalized.recordedAt),
      runId,
      projectId: normalized.projectId,
      operationKey: normalized.operationKey,
      operationHash,
      revision: 1,
      previousRevisionId: null,
      state: 'created',
      principalId: normalized.principalId,
      agentId: normalized.agentId,
      goal: normalized.goal,
      acceptanceCriteria: normalized.acceptanceCriteria,
      plan: [],
      stepResults: [],
      criterionResults: [],
      terminalReason: null,
      correlationId: normalized.correlationId,
      causationId: normalized.causationId,
      createdAt: normalized.recordedAt,
      recordedAt: normalized.recordedAt,
      metadata: normalized.metadata,
    });
    return this.store.append(revision, 0);
  }

  async setPlan(input: AuthorityAgentRunPlanInput): Promise<AuthorityAgentRunAppendResult> {
    const current = await this.requireCurrent(input.runId);
    if (current.state !== 'created' && current.state !== 'planned') {
      throw invalidTransition(current, 'planned');
    }
    const plan = normalizePlan(input.steps, current.acceptanceCriteria);
    return this.transition(current, input, 'planned', {
      plan,
      stepResults: [],
      criterionResults: [],
      terminalReason: null,
    });
  }

  async start(input: AuthorityAgentRunMutationBase): Promise<AuthorityAgentRunAppendResult> {
    const current = await this.requireCurrent(input.runId);
    if (current.state !== 'planned' && current.state !== 'blocked' && current.state !== 'waiting_approval') {
      throw invalidTransition(current, 'running');
    }
    if (current.plan.length === 0) throw new Error(`AGENT_RUN_PLAN_EMPTY run=${current.runId}`);
    return this.transition(current, input, 'running', { terminalReason: null });
  }

  async recordStep(input: AuthorityAgentRunStepInput): Promise<AuthorityAgentRunAppendResult> {
    const current = await this.requireCurrent(input.runId);
    if (current.state !== 'running') throw invalidTransition(current, 'running');
    const result = normalizeStepResult(input.result);
    const step = current.plan.find(candidate => candidate.id === result.stepId);
    if (!step) throw new Error(`AGENT_RUN_UNKNOWN_STEP step=${result.stepId}`);
    const priorForStep = current.stepResults.filter(candidate => candidate.stepId === result.stepId);
    const expectedAttempt = priorForStep.length + 1;
    if (result.attempt !== expectedAttempt) {
      throw new Error(`AGENT_RUN_STEP_ATTEMPT_SEQUENCE step=${result.stepId} expected=${expectedAttempt} incoming=${result.attempt}`);
    }
    for (const dependencyId of step.dependencies) {
      const dependency = latestStepResult(current.stepResults, dependencyId);
      if (!dependency || dependency.outcome !== 'accepted') {
        throw new Error(`AGENT_RUN_STEP_DEPENDENCY_UNSATISFIED step=${result.stepId} dependency=${dependencyId}`);
      }
    }
    if (step.sideEffecting) {
      if (!result.sideEffectOperationId) {
        throw new Error(`AGENT_RUN_SIDE_EFFECT_EVIDENCE_MISSING step=${step.id}`);
      }
      if (result.outcome === 'accepted' && result.sideEffectTerminalState !== 'committed') {
        throw new Error(`AGENT_RUN_SIDE_EFFECT_NOT_COMMITTED step=${step.id}`);
      }
      if (result.outcome === 'partial'
        && result.sideEffectTerminalState !== 'compensated'
        && result.sideEffectTerminalState !== 'failed') {
        throw new Error(`AGENT_RUN_PARTIAL_SIDE_EFFECT_UNRESOLVED step=${step.id}`);
      }
    }
    const stepResults = [...current.stepResults.map(cloneStepResult), result]
      .sort(compareStepResult);
    return this.transition(current, input, current.state, { stepResults });
  }

  async complete(input: AuthorityAgentRunCompleteInput): Promise<AuthorityAgentRunAppendResult> {
    const current = await this.requireCurrent(input.runId);
    if (current.state !== 'running') throw invalidTransition(current, 'completed');
    const criteria = normalizeCriterionResults(input.criteria, current.acceptanceCriteria);

    for (const step of current.plan.filter(candidate => candidate.critical)) {
      const latest = latestStepResult(current.stepResults, step.id);
      if (!latest || latest.outcome !== 'accepted') {
        throw new Error(`AGENT_RUN_CRITICAL_STEP_INCOMPLETE step=${step.id}`);
      }
    }
    for (const criterion of current.acceptanceCriteria.filter(candidate => candidate.required)) {
      const result = criteria.find(candidate => candidate.criterionId === criterion.id);
      if (!result || !result.passed) {
        throw new Error(`AGENT_RUN_ACCEPTANCE_NOT_MET criterion=${criterion.id}`);
      }
    }

    return this.transition(current, input, 'completed', {
      criterionResults: criteria,
      terminalReason: nonEmpty(input.terminalReason ?? 'all required evidence accepted', 'terminalReason'),
    });
  }

  async setTerminal(input: AuthorityAgentRunTerminalInput): Promise<AuthorityAgentRunAppendResult> {
    const current = await this.requireCurrent(input.runId);
    if (isTerminal(current.state)) {
      throw new Error(`AGENT_RUN_TERMINAL run=${current.runId} state=${current.state}`);
    }
    if (input.state === 'compensated' && current.state !== 'compensation_required') {
      throw invalidTransition(current, 'compensated');
    }
    return this.transition(current, input, input.state, {
      terminalReason: nonEmpty(input.terminalReason, 'terminalReason'),
    });
  }

  async get(runId: string): Promise<AuthorityAgentRunView | null> {
    const current = await this.store.getCurrent(runId);
    return current ? viewOf(current, null) : null;
  }

  async history(runId: string): Promise<AuthorityAgentRunView[]> {
    const history = await this.store.getHistory(runId);
    return history.map((revision, index) =>
      viewOf(revision, history[index + 1]?.recordedAt ?? null));
  }

  private async transition(
    current: AuthorityAgentRunRevision,
    input: AuthorityAgentRunMutationBase,
    state: AuthorityAgentRunState,
    changes: Partial<Pick<
      AuthorityAgentRunRevision,
      'plan' | 'stepResults' | 'criterionResults' | 'terminalReason'
    >>,
  ): Promise<AuthorityAgentRunAppendResult> {
    assertNonNegativeInteger(input.expectedRevision, 'expectedRevision');
    if (current.revision !== input.expectedRevision) {
      throw new Error(`STALE_AGENT_RUN_REVISION expected=${input.expectedRevision} current=${current.revision}`);
    }
    if (isTerminal(current.state)) {
      throw new Error(`AGENT_RUN_TERMINAL run=${current.runId} state=${current.state}`);
    }
    const recordedAt = canonicalTime(input.recordedAt, 'run transition recordedAt');
    const operationKey = nonEmpty(input.operationKey, 'operationKey');
    const nextRevision = current.revision + 1;
    const candidate = {
      ...cloneRevision(current),
      revisionId: revisionIdentity(current.runId, nextRevision, recordedAt),
      operationKey,
      operationHash: canonicalHash128({
        action: state,
        runId: current.runId,
        expectedRevision: input.expectedRevision,
        changes,
        recordedAt,
      }),
      revision: nextRevision,
      previousRevisionId: current.revisionId,
      state,
      plan: changes.plan ?? current.plan,
      stepResults: changes.stepResults ?? current.stepResults,
      criterionResults: changes.criterionResults ?? current.criterionResults,
      terminalReason: changes.terminalReason === undefined
        ? current.terminalReason
        : changes.terminalReason,
      recordedAt,
      metadata: canonicalClone(
        { ...current.metadata, ...(input.metadata ?? {}) },
        'agent run metadata',
      ) as Record<string, unknown>,
    };
    return this.store.append(sealRevision(candidate), input.expectedRevision);
  }

  private async requireCurrent(runId: string): Promise<AuthorityAgentRunRevision> {
    const current = await this.store.getCurrent(nonEmpty(runId, 'runId'));
    if (!current) throw new Error(`AGENT_RUN_NOT_FOUND id=${runId}`);
    return current;
  }
}

function normalizeCreate(input: AuthorityAgentRunCreateInput) {
  const projectId = nonEmpty(input.projectId, 'projectId');
  const principalId = nonEmpty(input.principalId, 'principalId');
  const agentId = nonEmpty(input.agentId, 'agentId');
  const operationKey = nonEmpty(input.operationKey, 'operationKey');
  const goal = normalizeGoal(input.goal, projectId, principalId);
  const acceptanceCriteria = normalizeCriteria(input.acceptanceCriteria);
  return {
    projectId,
    principalId,
    agentId,
    operationKey,
    goal,
    acceptanceCriteria,
    correlationId: nonEmpty(input.correlationId, 'correlationId'),
    causationId: optional(input.causationId),
    recordedAt: canonicalTime(input.recordedAt, 'run createdAt'),
    metadata: canonicalClone(input.metadata ?? {}, 'agent run metadata') as Record<string, unknown>,
  };
}

function normalizeGoal(
  input: AuthorityGoalSpec,
  projectId: string,
  requestedBy: string,
): AuthorityGoalSpec {
  if (input.projectId !== projectId) throw new Error('goal projectId must match run projectId');
  if (input.requestedBy !== requestedBy) throw new Error('goal requestedBy must match run principalId');
  return {
    intent: nonEmpty(input.intent, 'goal intent'),
    desiredOutcome: nonEmpty(input.desiredOutcome, 'goal desiredOutcome'),
    constraints: uniqueStrings(input.constraints, 'goal constraints'),
    projectId,
    requestedBy,
    provenance: normalizeProvenance(input.provenance),
  };
}

function normalizeCriteria(
  criteria: AuthorityAcceptanceCriterion[],
): AuthorityAcceptanceCriterion[] {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw new Error('agent run requires at least one acceptance criterion');
  }
  const normalized = criteria.map(item => ({
    id: nonEmpty(item.id, 'criterion id'),
    description: nonEmpty(item.description, 'criterion description'),
    required: Boolean(item.required),
    evaluatorId: nonEmpty(item.evaluatorId, 'criterion evaluatorId'),
    evaluatorVersion: nonEmpty(item.evaluatorVersion, 'criterion evaluatorVersion'),
  })).sort((left, right) => left.id.localeCompare(right.id));
  assertUnique(normalized.map(item => item.id), 'criterion');
  if (!normalized.some(item => item.required)) {
    throw new Error('agent run requires at least one required acceptance criterion');
  }
  return normalized;
}

function normalizePlan(
  steps: Array<Omit<AuthorityPlanStep, 'inputHash'>>,
  criteria: AuthorityAcceptanceCriterion[],
): AuthorityPlanStep[] {
  if (!Array.isArray(steps) || steps.length === 0) throw new Error('plan requires at least one step');
  const criterionIds = new Set(criteria.map(item => item.id));
  const normalized = steps.map(step => {
    const input = canonicalClone(step.input, `step ${step.id} input`);
    const acceptanceCriterionIds = uniqueStrings(
      step.acceptanceCriterionIds,
      `step ${step.id} acceptanceCriterionIds`,
    );
    for (const criterionId of acceptanceCriterionIds) {
      if (!criterionIds.has(criterionId)) {
        throw new Error(`AGENT_RUN_UNKNOWN_CRITERION step=${step.id} criterion=${criterionId}`);
      }
    }
    return {
      id: nonEmpty(step.id, 'step id'),
      name: nonEmpty(step.name, 'step name'),
      capability: nonEmpty(step.capability, 'step capability'),
      critical: Boolean(step.critical),
      sideEffecting: Boolean(step.sideEffecting),
      dependencies: uniqueStrings(step.dependencies, `step ${step.id} dependencies`),
      acceptanceCriterionIds,
      input,
      inputHash: canonicalHash128(input),
      metadata: canonicalClone(step.metadata ?? {}, `step ${step.id} metadata`) as Record<string, unknown>,
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  const ids = normalized.map(step => step.id);
  assertUnique(ids, 'step');
  const idSet = new Set(ids);
  for (const step of normalized) {
    if (step.dependencies.includes(step.id)) throw new Error(`AGENT_RUN_STEP_SELF_DEPENDENCY step=${step.id}`);
    for (const dependency of step.dependencies) {
      if (!idSet.has(dependency)) {
        throw new Error(`AGENT_RUN_UNKNOWN_DEPENDENCY step=${step.id} dependency=${dependency}`);
      }
    }
  }
  assertAcyclic(normalized);
  return normalized;
}

function normalizeStepResult(input: AuthorityStepResult): AuthorityStepResult {
  const result = input.result === null ? null : canonicalClone(input.result, 'step result');
  const error = input.error === null ? null : {
    code: nonEmpty(input.error.code, 'step error code'),
    message: nonEmpty(input.error.message, 'step error message'),
    retryable: Boolean(input.error.retryable),
    details: canonicalClone(input.error.details ?? {}, 'step error details') as Record<string, unknown>,
  };
  const normalized: AuthorityStepResult = {
    stepId: nonEmpty(input.stepId, 'stepId'),
    attempt: positiveInteger(input.attempt, 'step attempt'),
    outcome: input.outcome,
    result,
    resultHash: result === null ? null : canonicalHash128(result),
    error,
    evidenceRefs: uniqueStrings(input.evidenceRefs, 'step evidenceRefs'),
    sideEffectOperationId: optional(input.sideEffectOperationId),
    sideEffectTerminalState: input.sideEffectTerminalState,
    startedAt: canonicalTime(input.startedAt, 'step startedAt'),
    completedAt: canonicalTime(input.completedAt, 'step completedAt'),
    metadata: canonicalClone(input.metadata ?? {}, 'step metadata') as Record<string, unknown>,
  };
  if (Date.parse(normalized.completedAt) < Date.parse(normalized.startedAt)) {
    throw new Error('step completedAt cannot precede startedAt');
  }
  if (normalized.outcome === 'accepted' && normalized.error !== null) {
    throw new Error(`AGENT_RUN_ACCEPTED_STEP_HAS_ERROR step=${normalized.stepId}`);
  }
  if (normalized.outcome === 'failed' && normalized.error === null) {
    throw new Error(`AGENT_RUN_FAILED_STEP_REQUIRES_ERROR step=${normalized.stepId}`);
  }
  if (normalized.evidenceRefs.length === 0) {
    throw new Error(`AGENT_RUN_STEP_REQUIRES_EVIDENCE step=${normalized.stepId}`);
  }
  return normalized;
}

function normalizeCriterionResults(
  inputs: AuthorityCriterionResult[],
  criteria: AuthorityAcceptanceCriterion[],
): AuthorityCriterionResult[] {
  const criterionById = new Map(criteria.map(item => [item.id, item]));
  const normalized = inputs.map(input => {
    const definition = criterionById.get(input.criterionId);
    if (!definition) throw new Error(`AGENT_RUN_UNKNOWN_CRITERION criterion=${input.criterionId}`);
    if (input.evaluatorId !== definition.evaluatorId
      || input.evaluatorVersion !== definition.evaluatorVersion) {
      throw new Error(`AGENT_RUN_EVALUATOR_MISMATCH criterion=${input.criterionId}`);
    }
    const evidenceRefs = uniqueStrings(input.evidenceRefs, 'criterion evidenceRefs');
    if (evidenceRefs.length === 0) {
      throw new Error(`AGENT_RUN_CRITERION_REQUIRES_EVIDENCE criterion=${input.criterionId}`);
    }
    return {
      criterionId: input.criterionId,
      passed: Boolean(input.passed),
      evaluatorId: input.evaluatorId,
      evaluatorVersion: input.evaluatorVersion,
      evidenceRefs,
      evaluatedAt: canonicalTime(input.evaluatedAt, 'criterion evaluatedAt'),
      details: canonicalClone(input.details ?? {}, 'criterion details') as Record<string, unknown>,
    };
  }).sort((left, right) => left.criterionId.localeCompare(right.criterionId));
  assertUnique(normalized.map(item => item.criterionId), 'criterion result');
  return normalized;
}

function sealRevision(
  raw: Omit<AuthorityAgentRunRevision, 'contentHash'> & { contentHash?: string },
): AuthorityAgentRunRevision {
  const normalized = {
    revisionId: nonEmpty(raw.revisionId, 'revisionId'),
    runId: nonEmpty(raw.runId, 'runId'),
    projectId: nonEmpty(raw.projectId, 'projectId'),
    operationKey: nonEmpty(raw.operationKey, 'operationKey'),
    operationHash: nonEmpty(raw.operationHash, 'operationHash'),
    revision: positiveInteger(raw.revision, 'revision'),
    previousRevisionId: optional(raw.previousRevisionId),
    state: raw.state,
    principalId: nonEmpty(raw.principalId, 'principalId'),
    agentId: nonEmpty(raw.agentId, 'agentId'),
    goal: normalizeGoal(raw.goal, raw.projectId, raw.principalId),
    acceptanceCriteria: normalizeCriteria(raw.acceptanceCriteria),
    plan: raw.plan.map(step => ({ ...structuredClone(step), inputHash: nonEmpty(step.inputHash, 'step inputHash') })),
    stepResults: raw.stepResults.map(cloneStepResult).sort(compareStepResult),
    criterionResults: raw.criterionResults.map(item => structuredClone(item))
      .sort((left, right) => left.criterionId.localeCompare(right.criterionId)),
    terminalReason: optional(raw.terminalReason),
    correlationId: nonEmpty(raw.correlationId, 'correlationId'),
    causationId: optional(raw.causationId),
    createdAt: canonicalTime(raw.createdAt, 'createdAt'),
    recordedAt: canonicalTime(raw.recordedAt, 'recordedAt'),
    metadata: canonicalClone(raw.metadata, 'agent run metadata') as Record<string, unknown>,
  };
  canonicalSerialize(normalized);
  return { ...normalized, contentHash: canonicalHash128(normalized) };
}

function cloneAndVerify(raw: AuthorityAgentRunRevision): AuthorityAgentRunRevision {
  const revision = structuredClone(raw);
  canonicalSerialize(revision);
  const { contentHash: _ignored, ...payload } = revision;
  if (canonicalHash128(payload) !== revision.contentHash) {
    throw new Error(`AGENT_RUN_CONTENT_HASH_MISMATCH revision=${revision.revisionId}`);
  }
  return revision;
}

function assertImmutableRunIdentity(
  current: AuthorityAgentRunRevision,
  incoming: AuthorityAgentRunRevision,
): void {
  const currentHash = canonicalHash128({
    runId: current.runId,
    projectId: current.projectId,
    principalId: current.principalId,
    agentId: current.agentId,
    goal: current.goal,
    acceptanceCriteria: current.acceptanceCriteria,
    correlationId: current.correlationId,
    causationId: current.causationId,
    createdAt: current.createdAt,
  });
  const incomingHash = canonicalHash128({
    runId: incoming.runId,
    projectId: incoming.projectId,
    principalId: incoming.principalId,
    agentId: incoming.agentId,
    goal: incoming.goal,
    acceptanceCriteria: incoming.acceptanceCriteria,
    correlationId: incoming.correlationId,
    causationId: incoming.causationId,
    createdAt: incoming.createdAt,
  });
  if (currentHash !== incomingHash) throw new Error(`AGENT_RUN_IDENTITY_DRIFT run=${current.runId}`);
}

function assertAcyclic(steps: AuthorityPlanStep[]): void {
  const byId = new Map(steps.map(step => [step.id, step]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`AGENT_RUN_PLAN_CYCLE step=${id}`);
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependencies ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const step of steps) visit(step.id);
}

function latestStepResult(
  results: AuthorityStepResult[],
  stepId: string,
): AuthorityStepResult | null {
  return results
    .filter(result => result.stepId === stepId)
    .sort((left, right) => right.attempt - left.attempt)[0] ?? null;
}

function compareStepResult(left: AuthorityStepResult, right: AuthorityStepResult): number {
  return left.stepId.localeCompare(right.stepId) || left.attempt - right.attempt;
}

function cloneStepResult(result: AuthorityStepResult): AuthorityStepResult {
  return structuredClone(result);
}

function viewOf(
  revision: AuthorityAgentRunRevision,
  systemUntil: string | null,
): AuthorityAgentRunView {
  return {
    ...cloneRevision(revision),
    terminal: isTerminal(revision.state),
    systemUntil,
  };
}

function isTerminal(state: AuthorityAgentRunState): boolean {
  return state === 'completed'
    || state === 'failed'
    || state === 'cancelled'
    || state === 'compensated';
}

function invalidTransition(
  current: AuthorityAgentRunRevision,
  target: AuthorityAgentRunState,
): Error {
  return new Error(`AGENT_RUN_INVALID_TRANSITION run=${current.runId} from=${current.state} to=${target}`);
}

function revisionIdentity(runId: string, revision: number, recordedAt: string): string {
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: 'cos-execution',
    resourceType: 'agent-run-revision',
    resourceId: `${runId}:${revision}:${recordedAt}`,
  }, 'arr').id);
}

function operationMapKey(projectId: string, operationKey: string): string {
  return `${nonEmpty(projectId, 'projectId')}\u0000${nonEmpty(operationKey, 'operationKey')}`;
}

function uniqueStrings(values: string[], label: string): string[] {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  return Array.from(new Set(values.map(value => nonEmpty(value, label)))).sort();
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} IDs must be unique`);
}

function normalizeProvenance(provenance: ProvenanceRef[]): ProvenanceRef[] {
  if (!Array.isArray(provenance) || provenance.length === 0) {
    throw new Error('agent run provenance requires at least one source');
  }
  return provenance.map((entry, index) => ({
    source: nonEmpty(entry.source, `provenance[${index}].source`),
    ...(entry.revision === undefined ? {} : { revision: nonEmpty(entry.revision, `provenance[${index}].revision`) }),
    ...(entry.actor === undefined ? {} : { actor: nonEmpty(entry.actor, `provenance[${index}].actor`) }),
    ...(entry.locator === undefined ? {} : { locator: nonEmpty(entry.locator, `provenance[${index}].locator`) }),
  }));
}

function cloneRevision(revision: AuthorityAgentRunRevision): AuthorityAgentRunRevision {
  return structuredClone(revision);
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${message(error)}`);
  }
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function optional(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  return nonEmpty(value, 'optional string');
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive safe integer`);
  return value;
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
