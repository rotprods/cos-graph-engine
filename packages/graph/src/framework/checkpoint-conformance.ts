import {
  COS_GRAPH_CHECKPOINT_VERSION,
  GraphCheckpointCompareAndSwapResult,
  GraphCheckpointDriver,
  GraphCheckpointStore,
  GraphWorkflowCheckpoint,
  GraphWorkflowDecisionRecord,
  GraphWorkflowInterrupt,
  GraphWorkflowLease,
} from './checkpoint-runtime';
import { GraphValue, canonicalGraphHash } from './model';

export const COS_GRAPH_CHECKPOINT_CONFORMANCE_VERSION = 'cos.graph/checkpoint-conformance/v1alpha1' as const;
export const COS_GRAPH_CHECKPOINT_PROFILE_M2C = 'cos.graph/checkpoint-profile/m2c/v1' as const;

export type GraphCheckpointConformanceLaw =
  | 'first-checkpoint-atomicity'
  | 'stale-checkpoint-cas'
  | 'revision-progression'
  | 'conflict-preserves-winner'
  | 'restart-roundtrip'
  | 'run-isolation'
  | 'lease-roundtrip'
  | 'interrupt-roundtrip'
  | 'decision-roundtrip';

export const GRAPH_CHECKPOINT_M2C_LAWS: readonly GraphCheckpointConformanceLaw[] = Object.freeze([
  'first-checkpoint-atomicity',
  'stale-checkpoint-cas',
  'revision-progression',
  'conflict-preserves-winner',
  'restart-roundtrip',
  'run-isolation',
  'lease-roundtrip',
  'interrupt-roundtrip',
  'decision-roundtrip',
]);

export interface GraphCheckpointConformanceFactory {
  readonly backendId: string;
  /** Repeated open(scope) calls MUST address the same durable checkpoint authority. */
  open(scope: string): GraphCheckpointDriver | Promise<GraphCheckpointDriver>;
  /** Permanently reset a TCK-owned scope. */
  destroy(scope: string): void | Promise<void>;
}

export interface GraphCheckpointConformanceOptions {
  readonly namespace: string;
}

export interface GraphCheckpointConformanceReport {
  readonly schema: typeof COS_GRAPH_CHECKPOINT_CONFORMANCE_VERSION;
  readonly profile: typeof COS_GRAPH_CHECKPOINT_PROFILE_M2C;
  readonly backendId: string;
  readonly namespace: string;
  readonly laws: readonly GraphCheckpointConformanceLaw[];
  readonly certificationHash: string;
  readonly certified: true;
}

export type GraphCheckpointConformanceErrorCode =
  | 'CHECKPOINT_CONFORMANCE_FACTORY_INVALID'
  | 'CHECKPOINT_CONFORMANCE_LAW_FAILED';

export class GraphCheckpointConformanceError extends Error {
  readonly code: GraphCheckpointConformanceErrorCode;
  readonly backendId: string;
  readonly law: GraphCheckpointConformanceLaw | null;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: GraphCheckpointConformanceErrorCode,
    message: string,
    backendId: string,
    law: GraphCheckpointConformanceLaw | null,
    details: Readonly<Record<string, unknown>> = {},
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = 'GraphCheckpointConformanceError';
    this.code = code;
    this.backendId = backendId;
    this.law = law;
    this.details = details;
  }
}

function requireNonEmpty(value: string, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function lawAssert(
  condition: unknown,
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): asserts condition {
  if (!condition) {
    const error = new Error(message);
    Object.defineProperty(error, 'details', { value: details, enumerable: false });
    throw error;
  }
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
    interrupt: checkpoint.interrupt,
    decisions: checkpoint.decisions,
    createdAt: checkpoint.createdAt,
    updatedAt: checkpoint.updatedAt,
  };
}

function buildCheckpoint(input: Readonly<{
  runId: string;
  revision: number;
  status?: GraphWorkflowCheckpoint['status'];
  lease?: GraphWorkflowLease | null;
  interrupt?: GraphWorkflowInterrupt | null;
  decisions?: readonly GraphWorkflowDecisionRecord[];
  runInput?: GraphValue;
  createdAt?: number;
  updatedAt?: number;
}>): GraphWorkflowCheckpoint {
  const createdAt = input.createdAt ?? 1_000;
  const updatedAt = input.updatedAt ?? createdAt;
  const withoutHash: Omit<GraphWorkflowCheckpoint, 'checkpointHash'> = {
    schema: COS_GRAPH_CHECKPOINT_VERSION,
    runId: input.runId,
    planId: 'tck-plan',
    planHash: 'tck-plan-hash',
    inputHash: 'tck-input-hash',
    revision: input.revision,
    status: input.status ?? 'running',
    nextStepIndex: 0,
    runInput: input.runInput ?? null,
    steps: Object.freeze([]),
    lease: input.lease ?? null,
    failure: null,
    interrupt: input.interrupt ?? null,
    decisions: Object.freeze([...(input.decisions ?? [])]),
    createdAt,
    updatedAt,
  };
  return Object.freeze({
    ...withoutHash,
    checkpointHash: canonicalGraphHash(checkpointPayload(withoutHash)),
  });
}

function buildLease(ownerId: string, token: string, updatedAt: number): GraphWorkflowLease {
  return Object.freeze({ ownerId, token, expiresAt: updatedAt + 30_000 });
}

function buildInterrupt(runId: string, updatedAt: number): GraphWorkflowInterrupt {
  return Object.freeze({
    id: `int_${canonicalGraphHash({ runId, stepId: 'guarded-step' }).slice(0, 40)}`,
    stepId: 'guarded-step',
    reason: 'TCK human approval gate',
    payload: Object.freeze({ operation: 'graph.write' }),
    metadata: Object.freeze({ control: 'human-in-the-loop' }),
    requestedAt: updatedAt,
  });
}

function buildRejectedDecision(
  interrupt: GraphWorkflowInterrupt,
  decidedAt: number,
): GraphWorkflowDecisionRecord {
  const semantic = Object.freeze({
    interruptId: interrupt.id,
    decisionId: 'tck-decision-reject-1',
    outcome: 'rejected' as const,
    actorId: 'tck-operator',
    comment: 'TCK rejection',
    payload: Object.freeze({ ticket: 'TCK-1' }),
  });
  return Object.freeze({
    ...semantic,
    stepId: interrupt.stepId,
    requestHash: canonicalGraphHash(semantic),
    decidedAt,
  });
}

function sameCheckpoint(left: GraphWorkflowCheckpoint, right: GraphWorkflowCheckpoint): boolean {
  return left.runId === right.runId
    && left.revision === right.revision
    && left.status === right.status
    && left.checkpointHash === right.checkpointHash;
}

async function closeDriver(driver: GraphCheckpointDriver | null): Promise<void> {
  await driver?.close?.();
}

async function loadValidated(
  driver: GraphCheckpointDriver,
  runId: string,
): Promise<GraphWorkflowCheckpoint | null> {
  return new GraphCheckpointStore(driver).load(runId);
}

async function runScopedLaw(
  factory: GraphCheckpointConformanceFactory,
  namespace: string,
  law: GraphCheckpointConformanceLaw,
  execute: (scope: string) => Promise<void>,
): Promise<void> {
  const scope = `${namespace}--${law}`;
  try {
    await factory.destroy(scope);
    await execute(scope);
  } catch (error: unknown) {
    throw new GraphCheckpointConformanceError(
      'CHECKPOINT_CONFORMANCE_LAW_FAILED',
      `Checkpoint backend ${factory.backendId} failed conformance law ${law}`,
      factory.backendId,
      law,
      { scope },
      { cause: error },
    );
  } finally {
    try {
      await factory.destroy(scope);
    } catch {
      // Cleanup failure must not replace the conformance result.
    }
  }
}

async function lawFirstCheckpointAtomicity(
  factory: GraphCheckpointConformanceFactory,
  scope: string,
): Promise<void> {
  const driver = await factory.open(scope);
  try {
    lawAssert(await driver.load('run-1') === null, 'Fresh checkpoint scope must be empty');
    const checkpoint = buildCheckpoint({ runId: 'run-1', revision: 1 });
    const result = await driver.compareAndSwap(0, checkpoint);
    lawAssert(result.status === 'committed', 'First checkpoint CAS from revision zero must commit');
    lawAssert(result.revision === 1, 'First checkpoint CAS must report revision 1', { result });
    const loaded = await loadValidated(driver, 'run-1');
    lawAssert(loaded !== null, 'Committed checkpoint must become readable');
    lawAssert(sameCheckpoint(loaded, checkpoint), 'Committed checkpoint must round-trip without mutation');
  } finally {
    await closeDriver(driver);
  }
}

async function lawStaleCheckpointCas(
  factory: GraphCheckpointConformanceFactory,
  scope: string,
): Promise<void> {
  const left = await factory.open(scope);
  const right = await factory.open(scope);
  const checkpoint = buildCheckpoint({ runId: 'run-race', revision: 1 });
  try {
    lawAssert(await left.load('run-race') === null, 'Left handle must observe fresh scope');
    lawAssert(await right.load('run-race') === null, 'Right handle must observe same fresh scope');
    const winner = await left.compareAndSwap(0, checkpoint);
    lawAssert(winner.status === 'committed' && winner.revision === 1, 'First writer must win checkpoint CAS');
    const loser = await right.compareAndSwap(0, checkpoint);
    lawAssert(loser.status === 'conflict', 'Stale second writer must conflict, never last-write-wins', { loser });
    const loaded = await loadValidated(right, 'run-race');
    lawAssert(loaded !== null && loaded.revision === 1, 'Stale CAS must not manufacture another revision');
    lawAssert(loaded.checkpointHash === checkpoint.checkpointHash, 'Stale CAS must preserve winning checkpoint');
  } finally {
    await closeDriver(left);
    await closeDriver(right);
  }
}

async function lawRevisionProgression(
  factory: GraphCheckpointConformanceFactory,
  scope: string,
): Promise<void> {
  const driver = await factory.open(scope);
  try {
    const initial = buildCheckpoint({ runId: 'run-progress', revision: 1, updatedAt: 1_000 });
    const first = await driver.compareAndSwap(0, initial);
    lawAssert(first.status === 'committed', 'Initial checkpoint must commit');
    const updatedAt = 2_000;
    const next = buildCheckpoint({
      runId: 'run-progress',
      revision: 2,
      updatedAt,
      lease: buildLease('worker-a', 'lease-a', updatedAt),
    });
    const second = await driver.compareAndSwap(1, next);
    lawAssert(second.status === 'committed' && second.revision === 2, 'Checkpoint CAS must advance exactly one revision');
    const loaded = await loadValidated(driver, 'run-progress');
    lawAssert(loaded !== null && sameCheckpoint(loaded, next), 'Revision 2 checkpoint must become authoritative');
  } finally {
    await closeDriver(driver);
  }
}

async function lawConflictPreservesWinner(
  factory: GraphCheckpointConformanceFactory,
  scope: string,
): Promise<void> {
  const firstDriver = await factory.open(scope);
  const secondDriver = await factory.open(scope);
  try {
    const initial = buildCheckpoint({ runId: 'run-conflict', revision: 1 });
    lawAssert((await firstDriver.compareAndSwap(0, initial)).status === 'committed', 'Initial checkpoint must commit');
    const winner = buildCheckpoint({
      runId: 'run-conflict',
      revision: 2,
      updatedAt: 2_000,
      lease: buildLease('winner', 'winner-token', 2_000),
    });
    lawAssert((await firstDriver.compareAndSwap(1, winner)).status === 'committed', 'Revision 2 winner must commit');
    const staleCandidate = buildCheckpoint({
      runId: 'run-conflict',
      revision: 2,
      updatedAt: 2_100,
      lease: buildLease('loser', 'loser-token', 2_100),
    });
    const loser = await secondDriver.compareAndSwap(1, staleCandidate);
    lawAssert(loser.status === 'conflict', 'Stale revision-1 writer must conflict after winner advanced to 2');
    const loaded = await loadValidated(secondDriver, 'run-conflict');
    lawAssert(loaded !== null, 'Winning checkpoint must remain readable');
    lawAssert(loaded.checkpointHash === winner.checkpointHash, 'Conflict must not overwrite winning lease/checkpoint');
    lawAssert(loaded.lease?.ownerId === 'winner', 'Conflict must preserve winning lease owner');
  } finally {
    await closeDriver(firstDriver);
    await closeDriver(secondDriver);
  }
}

async function lawRestartRoundtrip(
  factory: GraphCheckpointConformanceFactory,
  scope: string,
): Promise<void> {
  const first = await factory.open(scope);
  const checkpoint = buildCheckpoint({
    runId: 'run-restart',
    revision: 1,
    runInput: Object.freeze({ graphId: 'enterprise', requestedBy: 'tck' }),
  });
  lawAssert((await first.compareAndSwap(0, checkpoint)).status === 'committed', 'Checkpoint must commit before restart');
  await closeDriver(first);

  const reopened = await factory.open(scope);
  try {
    const loaded = await loadValidated(reopened, 'run-restart');
    lawAssert(loaded !== null, 'Checkpoint must survive close/reopen');
    lawAssert(loaded.checkpointHash === checkpoint.checkpointHash, 'Restart must preserve checkpoint canonical hash');
    lawAssert(canonicalGraphHash(loaded.runInput) === canonicalGraphHash(checkpoint.runInput), 'Restart must preserve run input');
  } finally {
    await closeDriver(reopened);
  }
}

async function lawRunIsolation(
  factory: GraphCheckpointConformanceFactory,
  scope: string,
): Promise<void> {
  const driver = await factory.open(scope);
  try {
    const left = buildCheckpoint({ runId: 'run-left', revision: 1, runInput: Object.freeze({ side: 'left' }) });
    const right = buildCheckpoint({ runId: 'run-right', revision: 1, runInput: Object.freeze({ side: 'right' }) });
    lawAssert((await driver.compareAndSwap(0, left)).status === 'committed', 'Left run must commit');
    lawAssert((await driver.compareAndSwap(0, right)).status === 'committed', 'Right run must commit independently');
    const loadedLeft = await loadValidated(driver, 'run-left');
    const loadedRight = await loadValidated(driver, 'run-right');
    lawAssert(loadedLeft !== null && loadedRight !== null, 'Both isolated runs must remain readable');
    lawAssert(loadedLeft.checkpointHash === left.checkpointHash, 'Left run must not be overwritten by right run');
    lawAssert(loadedRight.checkpointHash === right.checkpointHash, 'Right run must not be overwritten by left run');
  } finally {
    await closeDriver(driver);
  }
}

async function lawLeaseRoundtrip(
  factory: GraphCheckpointConformanceFactory,
  scope: string,
): Promise<void> {
  const driver = await factory.open(scope);
  try {
    const initial = buildCheckpoint({ runId: 'run-lease', revision: 1, updatedAt: 1_000 });
    lawAssert((await driver.compareAndSwap(0, initial)).status === 'committed', 'Initial lease run must commit');
    const updatedAt = 2_000;
    const lease = buildLease('worker-lease', 'opaque-lease-token', updatedAt);
    const leased = buildCheckpoint({ runId: 'run-lease', revision: 2, updatedAt, lease });
    lawAssert((await driver.compareAndSwap(1, leased)).status === 'committed', 'Leased checkpoint must commit');
    await closeDriver(driver);

    const reopened = await factory.open(scope);
    try {
      const loaded = await loadValidated(reopened, 'run-lease');
      lawAssert(loaded !== null, 'Leased checkpoint must survive reopen');
      lawAssert(loaded.lease?.ownerId === lease.ownerId, 'Lease owner must round-trip');
      lawAssert(loaded.lease?.token === lease.token, 'Lease token must round-trip exactly');
      lawAssert(loaded.lease?.expiresAt === lease.expiresAt, 'Lease expiry must round-trip exactly');
    } finally {
      await closeDriver(reopened);
    }
  } finally {
    // driver may already be closed; compliant drivers must make close idempotent or ignore this path.
    try { await closeDriver(driver); } catch { /* preserve primary law result */ }
  }
}

async function lawInterruptRoundtrip(
  factory: GraphCheckpointConformanceFactory,
  scope: string,
): Promise<void> {
  const driver = await factory.open(scope);
  try {
    const requestedAt = 2_000;
    const interrupt = buildInterrupt('run-interrupt', requestedAt);
    const checkpoint = buildCheckpoint({
      runId: 'run-interrupt',
      revision: 1,
      status: 'interrupted',
      interrupt,
      updatedAt: requestedAt,
    });
    lawAssert((await driver.compareAndSwap(0, checkpoint)).status === 'committed', 'Interrupted checkpoint must commit atomically');
    const loaded = await loadValidated(driver, 'run-interrupt');
    lawAssert(loaded !== null && loaded.status === 'interrupted', 'Interrupted status must round-trip');
    lawAssert(loaded.lease === null, 'Interrupted checkpoint must not acquire an implicit lease');
    lawAssert(loaded.interrupt?.id === interrupt.id, 'Interrupt identity must round-trip');
    lawAssert(loaded.interrupt?.reason === interrupt.reason, 'Interrupt reason must round-trip');
    lawAssert(canonicalGraphHash(loaded.interrupt?.payload) === canonicalGraphHash(interrupt.payload), 'Interrupt payload must round-trip');
  } finally {
    await closeDriver(driver);
  }
}

async function lawDecisionRoundtrip(
  factory: GraphCheckpointConformanceFactory,
  scope: string,
): Promise<void> {
  const driver = await factory.open(scope);
  try {
    const requestedAt = 2_000;
    const interrupt = buildInterrupt('run-decision', requestedAt);
    const interrupted = buildCheckpoint({
      runId: 'run-decision',
      revision: 1,
      status: 'interrupted',
      interrupt,
      updatedAt: requestedAt,
    });
    lawAssert((await driver.compareAndSwap(0, interrupted)).status === 'committed', 'Interrupted checkpoint must commit before decision');

    const decidedAt = 3_000;
    const decision = buildRejectedDecision(interrupt, decidedAt);
    const cancelled = buildCheckpoint({
      runId: 'run-decision',
      revision: 2,
      status: 'cancelled',
      decisions: Object.freeze([decision]),
      updatedAt: decidedAt,
    });
    lawAssert((await driver.compareAndSwap(1, cancelled)).status === 'committed', 'Rejected decision checkpoint must commit');
    await closeDriver(driver);

    const reopened = await factory.open(scope);
    try {
      const loaded = await loadValidated(reopened, 'run-decision');
      lawAssert(loaded !== null && loaded.status === 'cancelled', 'Cancelled decision state must survive reopen');
      lawAssert(loaded.interrupt === null, 'Cancelled checkpoint must clear active interrupt');
      lawAssert(loaded.decisions.length === 1, 'Decision history must survive reopen');
      const persisted = loaded.decisions[0];
      lawAssert(persisted?.decisionId === decision.decisionId, 'Decision id must round-trip');
      lawAssert(persisted?.requestHash === decision.requestHash, 'Decision requestHash must round-trip');
      lawAssert(persisted?.outcome === 'rejected', 'Decision outcome must round-trip');
      lawAssert(persisted?.actorId === decision.actorId, 'Decision actorId must round-trip');
    } finally {
      await closeDriver(reopened);
    }
  } finally {
    try { await closeDriver(driver); } catch { /* preserve primary law result */ }
  }
}

export async function runGraphCheckpointConformance(
  factory: GraphCheckpointConformanceFactory,
  options: GraphCheckpointConformanceOptions,
): Promise<GraphCheckpointConformanceReport> {
  let backendId: string;
  let namespace: string;
  try {
    backendId = requireNonEmpty(factory.backendId, 'factory.backendId');
    namespace = requireNonEmpty(options.namespace, 'options.namespace');
    if (typeof factory.open !== 'function' || typeof factory.destroy !== 'function') {
      throw new TypeError('Checkpoint conformance factory must implement open() and destroy()');
    }
  } catch (error: unknown) {
    throw new GraphCheckpointConformanceError(
      'CHECKPOINT_CONFORMANCE_FACTORY_INVALID',
      'Checkpoint conformance factory/options are invalid',
      typeof factory?.backendId === 'string' ? factory.backendId : 'unknown',
      null,
      {},
      { cause: error },
    );
  }

  const laws: ReadonlyArray<readonly [GraphCheckpointConformanceLaw, (scope: string) => Promise<void>]> = Object.freeze([
    ['first-checkpoint-atomicity', (scope) => lawFirstCheckpointAtomicity(factory, scope)],
    ['stale-checkpoint-cas', (scope) => lawStaleCheckpointCas(factory, scope)],
    ['revision-progression', (scope) => lawRevisionProgression(factory, scope)],
    ['conflict-preserves-winner', (scope) => lawConflictPreservesWinner(factory, scope)],
    ['restart-roundtrip', (scope) => lawRestartRoundtrip(factory, scope)],
    ['run-isolation', (scope) => lawRunIsolation(factory, scope)],
    ['lease-roundtrip', (scope) => lawLeaseRoundtrip(factory, scope)],
    ['interrupt-roundtrip', (scope) => lawInterruptRoundtrip(factory, scope)],
    ['decision-roundtrip', (scope) => lawDecisionRoundtrip(factory, scope)],
  ]);

  const passed: GraphCheckpointConformanceLaw[] = [];
  for (const [law, execute] of laws) {
    await runScopedLaw(factory, namespace, law, execute);
    passed.push(law);
  }

  lawAssert(
    passed.length === GRAPH_CHECKPOINT_M2C_LAWS.length
      && passed.every((law, index) => law === GRAPH_CHECKPOINT_M2C_LAWS[index]),
    'Internal checkpoint TCK law order drifted from exported M2C law manifest',
  );

  const reportWithoutHash = Object.freeze({
    schema: COS_GRAPH_CHECKPOINT_CONFORMANCE_VERSION,
    profile: COS_GRAPH_CHECKPOINT_PROFILE_M2C,
    backendId,
    namespace,
    laws: Object.freeze([...passed]),
    certified: true as const,
  });
  return Object.freeze({
    ...reportWithoutHash,
    certificationHash: canonicalGraphHash(reportWithoutHash),
  });
}

/** Structural helper for adapter authors forwarding checkpoint CAS results. */
export type GraphCheckpointConformanceDriverResult = GraphCheckpointCompareAndSwapResult;
