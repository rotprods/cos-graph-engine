import { GraphFrameworkError } from './errors';
import {
  GraphProperties,
  GraphValue,
  canonicalGraphHash,
  canonicalGraphSerialize,
} from './model';
import {
  COS_GRAPH_PROTOCOL_VERSION,
  GraphDeterminism,
  GraphExecutionMode,
  GraphExecutionReceipt,
  GraphReference,
  GraphSideEffects,
} from './protocol';
import { GraphRuntime } from './runtime';

export const COS_GRAPH_EXECUTION_PLAN_VERSION = 'cos.graph/execution-plan/v1alpha1' as const;
export const COS_GRAPH_CHECKPOINT_VERSION = 'cos.graph/checkpoint/v1alpha1' as const;

export type GraphWorkflowPathSegment = string | number;

export type GraphWorkflowInputBinding =
  | { readonly kind: 'literal'; readonly value: GraphValue }
  | { readonly kind: 'run-input'; readonly path?: readonly GraphWorkflowPathSegment[] }
  | { readonly kind: 'step-output'; readonly stepId: string; readonly path?: readonly GraphWorkflowPathSegment[] };

export interface GraphExecutionPlanStep {
  readonly id: string;
  readonly capabilityId: string;
  readonly mode: GraphExecutionMode;
  readonly input: GraphWorkflowInputBinding;
  readonly graph?: GraphReference;
  readonly metadata?: GraphProperties;
}

export interface GraphExecutionPlan {
  readonly schema: typeof COS_GRAPH_EXECUTION_PLAN_VERSION;
  readonly id: string;
  readonly version: string;
  readonly steps: readonly GraphExecutionPlanStep[];
}

export interface GraphWorkflowLease {
  readonly ownerId: string;
  readonly token: string;
  readonly expiresAt: number;
}

export interface GraphWorkflowStepRecord {
  readonly stepId: string;
  readonly capabilityId: string;
  readonly idempotencyKey: string;
  readonly output: GraphValue;
  readonly receipt: GraphExecutionReceipt;
}

export interface GraphWorkflowFailure {
  readonly stepId: string | null;
  readonly code: string;
  readonly message: string;
  readonly failedAt: number;
}

export type GraphWorkflowStatus = 'running' | 'succeeded' | 'failed';

export interface GraphWorkflowCheckpoint {
  readonly schema: typeof COS_GRAPH_CHECKPOINT_VERSION;
  readonly runId: string;
  readonly planId: string;
  readonly planHash: string;
  readonly inputHash: string;
  readonly revision: number;
  readonly status: GraphWorkflowStatus;
  readonly nextStepIndex: number;
  readonly runInput: GraphValue;
  readonly steps: readonly GraphWorkflowStepRecord[];
  readonly lease: GraphWorkflowLease | null;
  readonly failure: GraphWorkflowFailure | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly checkpointHash: string;
}

export interface GraphCheckpointDriver {
  load(runId: string): unknown | null | Promise<unknown | null>;
  compareAndSwap(
    expectedRevision: number,
    checkpoint: GraphWorkflowCheckpoint,
  ): GraphCheckpointCompareAndSwapResult | Promise<GraphCheckpointCompareAndSwapResult>;
  close?(): void | Promise<void>;
}

export type GraphCheckpointCompareAndSwapResult =
  | { readonly status: 'committed'; readonly revision: number }
  | { readonly status: 'conflict' };

export type GraphCheckpointErrorCode =
  | 'CHECKPOINT_IMAGE_INVALID'
  | 'CHECKPOINT_DRIVER_FAILURE'
  | 'CHECKPOINT_DRIVER_PROTOCOL_INVALID';

export class GraphCheckpointError extends Error {
  readonly code: GraphCheckpointErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: GraphCheckpointErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = 'GraphCheckpointError';
    this.code = code;
    this.details = details;
  }
}

export type GraphWorkflowErrorCode =
  | 'WORKFLOW_PLAN_INVALID'
  | 'WORKFLOW_PLAN_MISMATCH'
  | 'WORKFLOW_INPUT_MISMATCH'
  | 'WORKFLOW_UNSAFE_SIDE_EFFECT'
  | 'WORKFLOW_LEASE_HELD'
  | 'WORKFLOW_LEASE_LOST'
  | 'WORKFLOW_CHECKPOINT_CONFLICT'
  | 'WORKFLOW_ALREADY_FAILED'
  | 'WORKFLOW_STEP_FAILED'
  | 'WORKFLOW_BINDING_INVALID'
  | 'WORKFLOW_CLOCK_REGRESSION';

export class GraphWorkflowError extends Error {
  readonly code: GraphWorkflowErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: GraphWorkflowErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = 'GraphWorkflowError';
    this.code = code;
    this.details = details;
  }
}

export interface GraphCheckpointRuntimeOptions {
  readonly workerId: string;
  readonly leaseDurationMs?: number;
  readonly maxCheckpointAttempts?: number;
  readonly clock?: () => number;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function asFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

function asSafeInteger(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new TypeError(`${label} must be a safe integer >= ${minimum}`);
  }
  return value as number;
}

function asExecutionMode(value: unknown, label: string): GraphExecutionMode {
  if (value === 'stream' || value === 'stats' || value === 'mutate' || value === 'write') return value;
  throw new TypeError(`${label} must be a supported graph execution mode`);
}

function asDeterminism(value: unknown, label: string): GraphDeterminism {
  if (value === 'deterministic' || value === 'best-effort' || value === 'nondeterministic') return value;
  throw new TypeError(`${label} must be a supported determinism value`);
}

function asSideEffects(value: unknown, label: string): GraphSideEffects {
  if (value === 'none' || value === 'graph' || value === 'external') return value;
  throw new TypeError(`${label} must be a supported side-effects value`);
}

function deepFreezeGraphValue(value: GraphValue): GraphValue {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => deepFreezeGraphValue(entry)));
  }
  if (value !== null && typeof value === 'object') {
    const frozen = Object.create(null) as Record<string, GraphValue>;
    for (const key of Object.keys(value).sort()) {
      Object.defineProperty(frozen, key, {
        value: deepFreezeGraphValue((value as GraphProperties)[key]),
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(frozen);
  }
  return value;
}

/** Convert an arbitrary runtime value into immutable canonical checkpoint data. */
export function normalizeCheckpointValue(value: unknown): GraphValue {
  const serialized = canonicalGraphSerialize(value);
  return deepFreezeGraphValue(JSON.parse(serialized) as GraphValue);
}

function normalizePath(
  value: readonly GraphWorkflowPathSegment[] | undefined,
  label: string,
): readonly GraphWorkflowPathSegment[] | undefined {
  if (value === undefined) return undefined;
  const path = value.map((segment, index) => {
    if (typeof segment === 'string' && segment.length > 0) return segment;
    if (Number.isSafeInteger(segment) && (segment as number) >= 0) return segment as number;
    throw new GraphWorkflowError(
      'WORKFLOW_PLAN_INVALID',
      `${label}[${index}] must be a non-empty string or non-negative integer`,
    );
  });
  return Object.freeze(path);
}

function normalizeReference(value: GraphReference | undefined): GraphReference | undefined {
  if (value === undefined) return undefined;
  return Object.freeze({
    id: asString(value.id, 'step.graph.id'),
    ...(value.revision !== undefined ? { revision: asString(value.revision, 'step.graph.revision') } : {}),
    ...(value.snapshot !== undefined ? { snapshot: asString(value.snapshot, 'step.graph.snapshot') } : {}),
  });
}

function normalizeBinding(
  binding: GraphWorkflowInputBinding,
  previousStepIds: ReadonlySet<string>,
): GraphWorkflowInputBinding {
  switch (binding.kind) {
    case 'literal':
      return Object.freeze({ kind: 'literal', value: normalizeCheckpointValue(binding.value) });
    case 'run-input': {
      const path = normalizePath(binding.path, 'run-input.path');
      return Object.freeze({ kind: 'run-input', ...(path ? { path } : {}) });
    }
    case 'step-output': {
      const stepId = asString(binding.stepId, 'step-output.stepId');
      if (!previousStepIds.has(stepId)) {
        throw new GraphWorkflowError(
          'WORKFLOW_PLAN_INVALID',
          `step-output binding may reference only an earlier step: ${stepId}`,
          { stepId },
        );
      }
      const path = normalizePath(binding.path, 'step-output.path');
      return Object.freeze({ kind: 'step-output', stepId, ...(path ? { path } : {}) });
    }
  }
}

export function normalizeGraphExecutionPlan(plan: GraphExecutionPlan): GraphExecutionPlan {
  if (plan.schema !== COS_GRAPH_EXECUTION_PLAN_VERSION) {
    throw new GraphWorkflowError(
      'WORKFLOW_PLAN_INVALID',
      `Unsupported workflow plan schema ${String(plan.schema)}`,
    );
  }
  const id = asString(plan.id, 'plan.id');
  const version = asString(plan.version, 'plan.version');
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    throw new GraphWorkflowError('WORKFLOW_PLAN_INVALID', 'Workflow plan must contain at least one step');
  }
  if (plan.steps.length > 10_000) {
    throw new GraphWorkflowError('WORKFLOW_PLAN_INVALID', 'Workflow plan exceeds 10000 steps');
  }

  const previousStepIds = new Set<string>();
  const steps = plan.steps.map((step, index): GraphExecutionPlanStep => {
    const stepId = asString(step.id, `plan.steps[${index}].id`);
    if (previousStepIds.has(stepId)) {
      throw new GraphWorkflowError('WORKFLOW_PLAN_INVALID', `Duplicate workflow step id ${stepId}`, { stepId });
    }
    const normalized: GraphExecutionPlanStep = Object.freeze({
      id: stepId,
      capabilityId: asString(step.capabilityId, `plan.steps[${index}].capabilityId`),
      mode: asExecutionMode(step.mode, `plan.steps[${index}].mode`),
      input: normalizeBinding(step.input, previousStepIds),
      ...(step.graph ? { graph: normalizeReference(step.graph) } : {}),
      ...(step.metadata ? { metadata: normalizeCheckpointValue(step.metadata) as GraphProperties } : {}),
    });
    previousStepIds.add(stepId);
    return normalized;
  });

  return Object.freeze({
    schema: COS_GRAPH_EXECUTION_PLAN_VERSION,
    id,
    version,
    steps: Object.freeze(steps),
  });
}

export function graphExecutionPlanHash(plan: GraphExecutionPlan): string {
  return canonicalGraphHash(normalizeGraphExecutionPlan(plan));
}

function parseReceipt(value: unknown): GraphExecutionReceipt {
  const record = asRecord(value, 'workflow receipt');
  if (record.protocol !== COS_GRAPH_PROTOCOL_VERSION) {
    throw new TypeError('workflow receipt protocol is unsupported');
  }
  if (record.status !== 'succeeded') {
    throw new TypeError('workflow receipt must represent a succeeded execution');
  }

  let graph: GraphReference | undefined;
  if (record.graph !== undefined) {
    const graphRecord = asRecord(record.graph, 'workflow receipt.graph');
    graph = Object.freeze({
      id: asString(graphRecord.id, 'workflow receipt.graph.id'),
      ...(graphRecord.revision !== undefined
        ? { revision: asString(graphRecord.revision, 'workflow receipt.graph.revision') }
        : {}),
      ...(graphRecord.snapshot !== undefined
        ? { snapshot: asString(graphRecord.snapshot, 'workflow receipt.graph.snapshot') }
        : {}),
    });
  }

  const startedAt = asFiniteNumber(record.startedAt, 'workflow receipt.startedAt');
  const finishedAt = asFiniteNumber(record.finishedAt, 'workflow receipt.finishedAt');
  const durationMs = asFiniteNumber(record.durationMs, 'workflow receipt.durationMs');
  if (finishedAt < startedAt || durationMs !== Math.max(0, finishedAt - startedAt)) {
    throw new TypeError('workflow receipt timing is invalid');
  }

  return Object.freeze({
    operationId: asString(record.operationId, 'workflow receipt.operationId'),
    moduleId: asString(record.moduleId, 'workflow receipt.moduleId'),
    capabilityId: asString(record.capabilityId, 'workflow receipt.capabilityId'),
    capabilityVersion: asString(record.capabilityVersion, 'workflow receipt.capabilityVersion'),
    protocol: COS_GRAPH_PROTOCOL_VERSION,
    mode: asExecutionMode(record.mode, 'workflow receipt.mode'),
    determinism: asDeterminism(record.determinism, 'workflow receipt.determinism'),
    sideEffects: asSideEffects(record.sideEffects, 'workflow receipt.sideEffects'),
    ...(record.idempotencyKey !== undefined
      ? { idempotencyKey: asString(record.idempotencyKey, 'workflow receipt.idempotencyKey') }
      : {}),
    ...(graph ? { graph } : {}),
    startedAt,
    finishedAt,
    durationMs,
    status: 'succeeded',
  });
}

function checkpointPayload(
  checkpoint: Omit<GraphWorkflowCheckpoint, 'checkpointHash'>,
): Readonly<Record<string, unknown>> {
  return {
    schema: checkpoint.schema,
    runId: checkpoint.runId,
    planId: checkpoint.planId,
    planHash: checkpoint.planHash,
    inputHash: checkpoint.inputHash,
    revision: checkpoint.revision,
    status: checkpoint.status,
    nextStepIndex: checkpoint.nextStepIndex,
    runInput: checkpoint.runInput,
    steps: checkpoint.steps,
    lease: checkpoint.lease,
    failure: checkpoint.failure,
    createdAt: checkpoint.createdAt,
    updatedAt: checkpoint.updatedAt,
  };
}

function finalizeCheckpoint(
  checkpoint: Omit<GraphWorkflowCheckpoint, 'checkpointHash'>,
): GraphWorkflowCheckpoint {
  return Object.freeze({
    ...checkpoint,
    steps: Object.freeze([...checkpoint.steps]),
    checkpointHash: canonicalGraphHash(checkpointPayload(checkpoint)),
  });
}

export function parseGraphWorkflowCheckpoint(
  value: unknown,
  expectedRunId?: string,
): GraphWorkflowCheckpoint {
  try {
    const record = asRecord(value, 'workflow checkpoint');
    if (record.schema !== COS_GRAPH_CHECKPOINT_VERSION) {
      throw new TypeError(`Unsupported checkpoint schema ${String(record.schema)}`);
    }
    const runId = asString(record.runId, 'workflow checkpoint.runId');
    if (expectedRunId !== undefined && runId !== expectedRunId) {
      throw new TypeError(`Checkpoint run ${runId} does not match ${expectedRunId}`);
    }
    if (!Array.isArray(record.steps)) throw new TypeError('workflow checkpoint.steps must be an array');

    const completedIds = new Set<string>();
    const steps = Object.freeze(record.steps.map((value, index): GraphWorkflowStepRecord => {
      const step = asRecord(value, `workflow checkpoint.steps[${index}]`);
      const stepId = asString(step.stepId, `workflow checkpoint.steps[${index}].stepId`);
      if (completedIds.has(stepId)) throw new TypeError(`workflow checkpoint contains duplicate completed step ${stepId}`);
      completedIds.add(stepId);
      const capabilityId = asString(step.capabilityId, `workflow checkpoint.steps[${index}].capabilityId`);
      const idempotencyKey = asString(step.idempotencyKey, `workflow checkpoint.steps[${index}].idempotencyKey`);
      const receipt = parseReceipt(step.receipt);
      if (receipt.capabilityId !== capabilityId) {
        throw new TypeError(`workflow checkpoint step ${stepId} capability does not match its receipt`);
      }
      if (receipt.idempotencyKey !== idempotencyKey) {
        throw new TypeError(`workflow checkpoint step ${stepId} idempotency key does not match its receipt`);
      }
      return Object.freeze({
        stepId,
        capabilityId,
        idempotencyKey,
        output: normalizeCheckpointValue(step.output),
        receipt,
      });
    }));

    const nextStepIndex = asSafeInteger(record.nextStepIndex, 'workflow checkpoint.nextStepIndex');
    if (nextStepIndex !== steps.length) {
      throw new TypeError('workflow checkpoint nextStepIndex must equal completed step count');
    }

    let lease: GraphWorkflowLease | null = null;
    if (record.lease !== null) {
      const leaseRecord = asRecord(record.lease, 'workflow checkpoint.lease');
      lease = Object.freeze({
        ownerId: asString(leaseRecord.ownerId, 'workflow checkpoint.lease.ownerId'),
        token: asString(leaseRecord.token, 'workflow checkpoint.lease.token'),
        expiresAt: asFiniteNumber(leaseRecord.expiresAt, 'workflow checkpoint.lease.expiresAt'),
      });
    }

    let failure: GraphWorkflowFailure | null = null;
    if (record.failure !== null) {
      const failureRecord = asRecord(record.failure, 'workflow checkpoint.failure');
      failure = Object.freeze({
        stepId: failureRecord.stepId === null
          ? null
          : asString(failureRecord.stepId, 'workflow checkpoint.failure.stepId'),
        code: asString(failureRecord.code, 'workflow checkpoint.failure.code'),
        message: asString(failureRecord.message, 'workflow checkpoint.failure.message'),
        failedAt: asFiniteNumber(failureRecord.failedAt, 'workflow checkpoint.failure.failedAt'),
      });
    }

    const statusValue = record.status;
    if (statusValue !== 'running' && statusValue !== 'succeeded' && statusValue !== 'failed') {
      throw new TypeError('workflow checkpoint.status is invalid');
    }
    const status: GraphWorkflowStatus = statusValue;
    if (status !== 'running' && lease !== null) {
      throw new TypeError('terminal workflow checkpoint cannot hold a lease');
    }
    if (status === 'failed' && failure === null) {
      throw new TypeError('failed workflow checkpoint requires failure metadata');
    }
    if (status !== 'failed' && failure !== null) {
      throw new TypeError('non-failed workflow checkpoint cannot contain failure metadata');
    }

    const createdAt = asFiniteNumber(record.createdAt, 'workflow checkpoint.createdAt');
    const updatedAt = asFiniteNumber(record.updatedAt, 'workflow checkpoint.updatedAt');
    if (updatedAt < createdAt) throw new TypeError('workflow checkpoint updatedAt cannot precede createdAt');
    if (lease !== null && lease.expiresAt <= updatedAt) {
      throw new TypeError('workflow checkpoint lease expiry must be later than checkpoint updatedAt');
    }
    if (failure !== null && failure.failedAt !== updatedAt) {
      throw new TypeError('workflow checkpoint failure time must equal checkpoint updatedAt');
    }

    const withoutHash: Omit<GraphWorkflowCheckpoint, 'checkpointHash'> = {
      schema: COS_GRAPH_CHECKPOINT_VERSION,
      runId,
      planId: asString(record.planId, 'workflow checkpoint.planId'),
      planHash: asString(record.planHash, 'workflow checkpoint.planHash'),
      inputHash: asString(record.inputHash, 'workflow checkpoint.inputHash'),
      revision: asSafeInteger(record.revision, 'workflow checkpoint.revision', 1),
      status,
      nextStepIndex,
      runInput: normalizeCheckpointValue(record.runInput),
      steps,
      lease,
      failure,
      createdAt,
      updatedAt,
    };
    const checkpointHash = asString(record.checkpointHash, 'workflow checkpoint.checkpointHash');
    if (canonicalGraphHash(checkpointPayload(withoutHash)) !== checkpointHash) {
      throw new TypeError('workflow checkpoint hash does not match canonical checkpoint payload');
    }
    return Object.freeze({ ...withoutHash, checkpointHash });
  } catch (error: unknown) {
    if (error instanceof GraphCheckpointError) throw error;
    throw new GraphCheckpointError(
      'CHECKPOINT_IMAGE_INVALID',
      'Persisted workflow checkpoint failed integrity validation',
      { expectedRunId },
      { cause: error },
    );
  }
}

export class GraphCheckpointStore {
  constructor(private readonly driver: GraphCheckpointDriver) {}

  async load(runId: string): Promise<GraphWorkflowCheckpoint | null> {
    try {
      const raw = await this.driver.load(runId);
      return raw === null ? null : parseGraphWorkflowCheckpoint(raw, runId);
    } catch (error: unknown) {
      if (error instanceof GraphCheckpointError) throw error;
      throw new GraphCheckpointError(
        'CHECKPOINT_DRIVER_FAILURE',
        `Checkpoint driver failed while loading run ${runId}`,
        { runId },
        { cause: error },
      );
    }
  }

  async compareAndSwap(
    expectedRevision: number,
    checkpoint: GraphWorkflowCheckpoint,
  ): Promise<GraphCheckpointCompareAndSwapResult> {
    let result: GraphCheckpointCompareAndSwapResult;
    try {
      result = await this.driver.compareAndSwap(expectedRevision, checkpoint);
    } catch (error: unknown) {
      throw new GraphCheckpointError(
        'CHECKPOINT_DRIVER_FAILURE',
        `Checkpoint driver failed while saving run ${checkpoint.runId}`,
        { runId: checkpoint.runId, expectedRevision },
        { cause: error },
      );
    }
    if (result.status === 'conflict') return result;
    if (result.status === 'committed' && result.revision === checkpoint.revision) return result;
    throw new GraphCheckpointError(
      'CHECKPOINT_DRIVER_PROTOCOL_INVALID',
      'Checkpoint driver returned an invalid compare-and-swap result',
      { runId: checkpoint.runId, expectedRevision, checkpointRevision: checkpoint.revision },
    );
  }

  async close(): Promise<void> {
    await this.driver.close?.();
  }
}

function resolvePath(root: GraphValue, path: readonly GraphWorkflowPathSegment[] | undefined): GraphValue {
  if (!path || path.length === 0) return root;
  let current: GraphValue = root;
  for (const segment of path) {
    if (typeof segment === 'number') {
      if (!Array.isArray(current) || segment >= current.length) {
        throw new GraphWorkflowError('WORKFLOW_BINDING_INVALID', `Array path segment ${segment} cannot be resolved`);
      }
      current = current[segment];
      continue;
    }
    if (
      current === null
      || typeof current !== 'object'
      || Array.isArray(current)
      || !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      throw new GraphWorkflowError('WORKFLOW_BINDING_INVALID', `Object path segment ${segment} cannot be resolved`);
    }
    current = (current as GraphProperties)[segment];
  }
  return current;
}

function resolveStepInput(
  binding: GraphWorkflowInputBinding,
  checkpoint: GraphWorkflowCheckpoint,
): GraphValue {
  switch (binding.kind) {
    case 'literal':
      return binding.value;
    case 'run-input':
      return resolvePath(checkpoint.runInput, binding.path);
    case 'step-output': {
      const completed = checkpoint.steps.find((step) => step.stepId === binding.stepId);
      if (!completed) {
        throw new GraphWorkflowError(
          'WORKFLOW_BINDING_INVALID',
          `Step ${binding.stepId} has no completed output`,
          { stepId: binding.stepId },
        );
      }
      return resolvePath(completed.output, binding.path);
    }
  }
}

function errorSummary(error: unknown, failedAt: number, stepId: string | null): GraphWorkflowFailure {
  const code = error instanceof GraphFrameworkError
    ? error.code
    : error instanceof GraphWorkflowError
      ? error.code
      : error instanceof GraphCheckpointError
        ? error.code
        : 'STEP_FAILURE';
  return Object.freeze({
    stepId,
    code,
    message: error instanceof Error ? error.message : String(error),
    failedAt,
  });
}

export class GraphCheckpointRuntime {
  private readonly workerId: string;
  private readonly leaseDurationMs: number;
  private readonly maxCheckpointAttempts: number;
  private readonly clock: () => number;

  constructor(
    private readonly runtime: GraphRuntime,
    private readonly checkpoints: GraphCheckpointStore,
    options: GraphCheckpointRuntimeOptions,
  ) {
    this.workerId = asString(options.workerId, 'workerId');
    this.leaseDurationMs = options.leaseDurationMs ?? 30_000;
    this.maxCheckpointAttempts = options.maxCheckpointAttempts ?? 8;
    this.clock = options.clock ?? Date.now;
    if (!Number.isSafeInteger(this.leaseDurationMs) || this.leaseDurationMs < 1) {
      throw new TypeError('leaseDurationMs must be a positive safe integer');
    }
    if (!Number.isSafeInteger(this.maxCheckpointAttempts) || this.maxCheckpointAttempts < 1) {
      throw new TypeError('maxCheckpointAttempts must be a positive safe integer');
    }
  }

  async get(runId: string): Promise<GraphWorkflowCheckpoint | null> {
    return this.checkpoints.load(runId);
  }

  async run(
    planInput: GraphExecutionPlan,
    runId: string,
    input: unknown,
  ): Promise<GraphWorkflowCheckpoint> {
    const plan = normalizeGraphExecutionPlan(planInput);
    const planHash = canonicalGraphHash(plan);
    const runInput = normalizeCheckpointValue(input);
    const inputHash = canonicalGraphHash(runInput);
    this.assertPlanCapabilities(plan);

    let checkpoint = await this.ensureCheckpoint(plan, planHash, runId, runInput, inputHash);
    this.assertCheckpointIdentity(checkpoint, plan, planHash, inputHash);
    if (checkpoint.status === 'succeeded') return checkpoint;
    if (checkpoint.status === 'failed') this.throwAlreadyFailed(checkpoint);

    checkpoint = await this.acquireLease(checkpoint);
    if (checkpoint.status === 'succeeded') return checkpoint;
    if (checkpoint.status === 'failed') this.throwAlreadyFailed(checkpoint);

    while (checkpoint.nextStepIndex < plan.steps.length) {
      const step = plan.steps[checkpoint.nextStepIndex];
      if (!step) {
        throw new GraphWorkflowError(
          'WORKFLOW_PLAN_INVALID',
          'Workflow nextStepIndex exceeded plan bounds',
          { runId },
        );
      }

      let activeLease = this.requireOwnedLease(checkpoint);
      const observedNow = this.readClock(checkpoint.updatedAt);
      if (activeLease.expiresAt <= observedNow) {
        checkpoint = await this.acquireLease(checkpoint);
        if (checkpoint.status !== 'running') {
          if (checkpoint.status === 'succeeded') return checkpoint;
          this.throwAlreadyFailed(checkpoint);
        }
        activeLease = this.requireOwnedLease(checkpoint);
      }

      const idempotencyKey = `gw_${canonicalGraphHash({
        runId,
        planHash,
        stepId: step.id,
      }).slice(0, 40)}`;
      const stepInput = resolveStepInput(step.input, checkpoint);

      let execution;
      try {
        execution = await this.runtime.invokeById(step.capabilityId, stepInput, {
          mode: step.mode,
          graph: step.graph,
          idempotencyKey,
          metadata: Object.freeze({
            ...(step.metadata ?? {}),
            workflowRunId: runId,
            workflowPlanHash: planHash,
            workflowStepId: step.id,
            workflowLeaseToken: activeLease.token,
          }),
        });
      } catch (error: unknown) {
        await this.persistFailure(checkpoint, step.id, error);
        throw new GraphWorkflowError(
          'WORKFLOW_STEP_FAILED',
          `Workflow ${runId} step ${step.id} failed`,
          { runId, stepId: step.id, capabilityId: step.capabilityId },
          { cause: error },
        );
      }

      let output: GraphValue;
      try {
        output = normalizeCheckpointValue(execution.value);
      } catch (error: unknown) {
        await this.persistFailure(checkpoint, step.id, error);
        throw new GraphWorkflowError(
          'WORKFLOW_STEP_FAILED',
          `Workflow ${runId} step ${step.id} returned a non-checkpointable value`,
          { runId, stepId: step.id, capabilityId: step.capabilityId },
          { cause: error },
        );
      }

      const record: GraphWorkflowStepRecord = Object.freeze({
        stepId: step.id,
        capabilityId: step.capabilityId,
        idempotencyKey,
        output,
        receipt: parseReceipt(execution.receipt),
      });
      const isLast = checkpoint.nextStepIndex + 1 === plan.steps.length;
      const now = this.readClock(checkpoint.updatedAt);
      const next = finalizeCheckpoint({
        ...checkpoint,
        revision: checkpoint.revision + 1,
        status: isLast ? 'succeeded' : 'running',
        nextStepIndex: checkpoint.nextStepIndex + 1,
        steps: Object.freeze([...checkpoint.steps, record]),
        lease: isLast
          ? null
          : Object.freeze({ ...activeLease, expiresAt: now + this.leaseDurationMs }),
        failure: null,
        updatedAt: now,
      });
      const saved = await this.checkpoints.compareAndSwap(checkpoint.revision, next);
      if (saved.status === 'committed') {
        checkpoint = next;
        continue;
      }

      const latest = await this.checkpoints.load(runId);
      if (!latest) {
        throw new GraphWorkflowError(
          'WORKFLOW_CHECKPOINT_CONFLICT',
          `Workflow ${runId} checkpoint disappeared after CAS conflict`,
          { runId },
        );
      }
      this.assertCheckpointIdentity(latest, plan, planHash, inputHash);
      const converged = latest.steps.find(
        (completed) => completed.stepId === step.id && completed.idempotencyKey === idempotencyKey,
      );
      if (latest.nextStepIndex > checkpoint.nextStepIndex && converged) {
        checkpoint = latest;
        if (checkpoint.status === 'succeeded') return checkpoint;
        if (checkpoint.status === 'failed') this.throwAlreadyFailed(checkpoint);
        continue;
      }
      throw new GraphWorkflowError(
        'WORKFLOW_LEASE_LOST',
        `Workflow ${runId} checkpoint changed under worker ${this.workerId}`,
        { runId, stepId: step.id },
      );
    }

    return checkpoint;
  }

  private assertPlanCapabilities(plan: GraphExecutionPlan): void {
    for (const step of plan.steps) {
      const registered = this.runtime.registry.resolveCapability(step.capabilityId);
      if (!registered.descriptor.modes.includes(step.mode)) {
        throw new GraphWorkflowError(
          'WORKFLOW_PLAN_INVALID',
          `Capability ${step.capabilityId} does not support workflow mode ${step.mode}`,
          { stepId: step.id, capabilityId: step.capabilityId, mode: step.mode },
        );
      }
      const sideEffecting = step.mode === 'mutate'
        || step.mode === 'write'
        || registered.descriptor.sideEffects !== 'none';
      if (sideEffecting && registered.descriptor.idempotency !== 'required') {
        throw new GraphWorkflowError(
          'WORKFLOW_UNSAFE_SIDE_EFFECT',
          `Checkpointed side-effecting step ${step.id} must require idempotency`,
          {
            stepId: step.id,
            capabilityId: step.capabilityId,
            idempotency: registered.descriptor.idempotency,
          },
        );
      }
    }
  }

  private async ensureCheckpoint(
    plan: GraphExecutionPlan,
    planHash: string,
    runIdValue: string,
    runInput: GraphValue,
    inputHash: string,
  ): Promise<GraphWorkflowCheckpoint> {
    const runId = asString(runIdValue, 'runId');
    const existing = await this.checkpoints.load(runId);
    if (existing) return existing;

    const now = this.readClock();
    const initial = finalizeCheckpoint({
      schema: COS_GRAPH_CHECKPOINT_VERSION,
      runId,
      planId: plan.id,
      planHash,
      inputHash,
      revision: 1,
      status: 'running',
      nextStepIndex: 0,
      runInput,
      steps: Object.freeze([]),
      lease: null,
      failure: null,
      createdAt: now,
      updatedAt: now,
    });
    const result = await this.checkpoints.compareAndSwap(0, initial);
    if (result.status === 'committed') return initial;

    const raced = await this.checkpoints.load(runId);
    if (!raced) {
      throw new GraphWorkflowError(
        'WORKFLOW_CHECKPOINT_CONFLICT',
        `Workflow ${runId} creation conflicted but no checkpoint is readable`,
        { runId },
      );
    }
    return raced;
  }

  private assertCheckpointIdentity(
    checkpoint: GraphWorkflowCheckpoint,
    plan: GraphExecutionPlan,
    planHash: string,
    inputHash: string,
  ): void {
    if (checkpoint.planId !== plan.id || checkpoint.planHash !== planHash) {
      throw new GraphWorkflowError(
        'WORKFLOW_PLAN_MISMATCH',
        `Workflow ${checkpoint.runId} was created with another plan`,
        {
          runId: checkpoint.runId,
          expectedPlanHash: checkpoint.planHash,
          receivedPlanHash: planHash,
        },
      );
    }
    if (checkpoint.inputHash !== inputHash) {
      throw new GraphWorkflowError(
        'WORKFLOW_INPUT_MISMATCH',
        `Workflow ${checkpoint.runId} was created with different input`,
        { runId: checkpoint.runId },
      );
    }
    if (checkpoint.nextStepIndex > plan.steps.length) {
      throw new GraphWorkflowError(
        'WORKFLOW_PLAN_MISMATCH',
        `Workflow ${checkpoint.runId} checkpoint exceeds supplied plan length`,
        { runId: checkpoint.runId },
      );
    }
    for (let index = 0; index < checkpoint.steps.length; index += 1) {
      const persisted = checkpoint.steps[index];
      const planned = plan.steps[index];
      if (!planned || persisted?.stepId !== planned.id || persisted.capabilityId !== planned.capabilityId) {
        throw new GraphWorkflowError(
          'WORKFLOW_PLAN_MISMATCH',
          `Workflow ${checkpoint.runId} completed-step history does not match plan`,
          { runId: checkpoint.runId, index },
        );
      }
    }
    if (checkpoint.status === 'succeeded' && checkpoint.nextStepIndex !== plan.steps.length) {
      throw new GraphWorkflowError(
        'WORKFLOW_PLAN_MISMATCH',
        `Succeeded workflow ${checkpoint.runId} has incomplete step history`,
        { runId: checkpoint.runId },
      );
    }
  }

  private async acquireLease(
    checkpointInput: GraphWorkflowCheckpoint,
  ): Promise<GraphWorkflowCheckpoint> {
    let checkpoint = checkpointInput;
    for (let attempt = 1; attempt <= this.maxCheckpointAttempts; attempt += 1) {
      if (checkpoint.status !== 'running') return checkpoint;
      const now = this.readClock(checkpoint.updatedAt);
      if (
        checkpoint.lease
        && checkpoint.lease.expiresAt > now
        && checkpoint.lease.ownerId !== this.workerId
      ) {
        throw new GraphWorkflowError(
          'WORKFLOW_LEASE_HELD',
          `Workflow ${checkpoint.runId} lease is held by ${checkpoint.lease.ownerId}`,
          {
            runId: checkpoint.runId,
            ownerId: checkpoint.lease.ownerId,
            expiresAt: checkpoint.lease.expiresAt,
          },
        );
      }

      const token = `lease_${canonicalGraphHash({
        runId: checkpoint.runId,
        ownerId: this.workerId,
        revision: checkpoint.revision,
        now,
      }).slice(0, 40)}`;
      const leased = finalizeCheckpoint({
        ...checkpoint,
        revision: checkpoint.revision + 1,
        lease: Object.freeze({
          ownerId: this.workerId,
          token,
          expiresAt: now + this.leaseDurationMs,
        }),
        updatedAt: now,
      });
      const result = await this.checkpoints.compareAndSwap(checkpoint.revision, leased);
      if (result.status === 'committed') return leased;

      const latest = await this.checkpoints.load(checkpoint.runId);
      if (!latest) {
        throw new GraphWorkflowError(
          'WORKFLOW_CHECKPOINT_CONFLICT',
          `Workflow ${checkpoint.runId} disappeared during lease acquisition`,
          { runId: checkpoint.runId },
        );
      }
      checkpoint = latest;
    }
    throw new GraphWorkflowError(
      'WORKFLOW_CHECKPOINT_CONFLICT',
      `Workflow ${checkpoint.runId} lease acquisition exhausted CAS attempts`,
      { runId: checkpoint.runId },
    );
  }

  private requireOwnedLease(checkpoint: GraphWorkflowCheckpoint): GraphWorkflowLease {
    const lease = checkpoint.lease;
    if (!lease || lease.ownerId !== this.workerId) {
      throw new GraphWorkflowError(
        'WORKFLOW_LEASE_LOST',
        `Worker ${this.workerId} no longer owns workflow ${checkpoint.runId}`,
        { runId: checkpoint.runId },
      );
    }
    return lease;
  }

  private throwAlreadyFailed(checkpoint: GraphWorkflowCheckpoint): never {
    throw new GraphWorkflowError(
      'WORKFLOW_ALREADY_FAILED',
      `Workflow run ${checkpoint.runId} is already failed`,
      { runId: checkpoint.runId, failure: checkpoint.failure },
    );
  }

  private readClock(lowerBound?: number): number {
    const now = this.clock();
    if (!Number.isFinite(now)) {
      throw new GraphWorkflowError('WORKFLOW_CLOCK_REGRESSION', 'Workflow clock must return a finite number', { now });
    }
    if (lowerBound !== undefined && now < lowerBound) {
      throw new GraphWorkflowError(
        'WORKFLOW_CLOCK_REGRESSION',
        'Workflow clock moved backwards relative to persisted checkpoint time',
        { now, lowerBound },
      );
    }
    return now;
  }

  private async persistFailure(
    checkpoint: GraphWorkflowCheckpoint,
    stepId: string | null,
    error: unknown,
  ): Promise<void> {
    const now = this.readClock(checkpoint.updatedAt);
    const failed = finalizeCheckpoint({
      ...checkpoint,
      revision: checkpoint.revision + 1,
      status: 'failed',
      lease: null,
      failure: errorSummary(error, now, stepId),
      updatedAt: now,
    });
    const result = await this.checkpoints.compareAndSwap(checkpoint.revision, failed);
    if (result.status === 'conflict') {
      throw new GraphWorkflowError(
        'WORKFLOW_LEASE_LOST',
        `Workflow ${checkpoint.runId} changed while persisting failure`,
        { runId: checkpoint.runId, stepId },
        { cause: error },
      );
    }
  }
}
