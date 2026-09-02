import {
  GraphDurabilityDriver,
  GraphPersistenceCommit,
  GraphPersistenceCompaction,
  GraphPersistenceCompactionResult,
  GraphPersistenceCompareAndSwapResult,
  GraphPersistenceImage,
  DurableGraphStore,
  createGraphPersistenceAnchor,
  parseGraphPersistenceImage,
} from './durability';
import {
  COS_GRAPH_SNAPSHOT_VERSION,
  GraphCommitReceipt,
  GraphStateError,
  GraphTransaction,
  materializeGraphCommit,
  prepareGraphTransaction,
} from './state-store';
import {
  canonicalGraphHash,
  createGraphDocument,
  graphDocumentHash,
} from './model';

export const COS_GRAPH_DURABILITY_CONFORMANCE_VERSION = 'cos.graph/durability-conformance/v1alpha1' as const;
export const COS_GRAPH_DURABILITY_PROFILE_M2D = 'cos.graph/durability-profile/m2d/v1' as const;

export type GraphDurabilityConformanceLaw =
  | 'first-commit-atomicity'
  | 'stale-storage-cas'
  | 'restart-recovery'
  | 'compaction-clock-separation'
  | 'compaction-cas'
  | 'post-anchor-continuity'
  | 'pruned-exact-retry'
  | 'pruned-idempotency-conflict'
  | 'anchor-time-monotonicity'
  | 'compaction-noop';

export const GRAPH_DURABILITY_M2D_LAWS: readonly GraphDurabilityConformanceLaw[] = Object.freeze([
  'first-commit-atomicity',
  'stale-storage-cas',
  'restart-recovery',
  'compaction-clock-separation',
  'compaction-cas',
  'post-anchor-continuity',
  'pruned-exact-retry',
  'pruned-idempotency-conflict',
  'anchor-time-monotonicity',
  'compaction-noop',
]);

export interface GraphDurabilityConformanceFactory {
  /** Stable adapter identifier shown in certification reports. */
  readonly backendId: string;
  /**
   * Open one handle to the durable authority addressed by `scope`.
   * Repeated calls with the same scope MUST address the same storage.
   */
  open(scope: string): GraphDurabilityDriver | Promise<GraphDurabilityDriver>;
  /**
   * Permanently remove/reset the scope. The TCK calls this only for namespaces
   * derived from the caller-provided suite namespace.
   */
  destroy(scope: string): void | Promise<void>;
}

export interface GraphDurabilityConformanceOptions {
  /** Unique namespace preventing parallel TCK runs from sharing storage. */
  readonly namespace: string;
}

export interface GraphDurabilityConformanceReport {
  readonly schema: typeof COS_GRAPH_DURABILITY_CONFORMANCE_VERSION;
  readonly profile: typeof COS_GRAPH_DURABILITY_PROFILE_M2D;
  readonly backendId: string;
  readonly namespace: string;
  readonly laws: readonly GraphDurabilityConformanceLaw[];
  readonly certificationHash: string;
  readonly certified: true;
}

export type GraphDurabilityConformanceErrorCode =
  | 'CONFORMANCE_FACTORY_INVALID'
  | 'CONFORMANCE_LAW_FAILED';

export class GraphDurabilityConformanceError extends Error {
  readonly code: GraphDurabilityConformanceErrorCode;
  readonly backendId: string;
  readonly law: GraphDurabilityConformanceLaw | null;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: GraphDurabilityConformanceErrorCode,
    message: string,
    backendId: string,
    law: GraphDurabilityConformanceLaw | null,
    details: Readonly<Record<string, unknown>> = {},
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = 'GraphDurabilityConformanceError';
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

function lawTransaction(
  graphId: string,
  revision: number,
  idempotencyKey: string,
  recordedAt: number,
  nodeId: string,
): GraphTransaction {
  return Object.freeze({
    graphId,
    expectedRevision: revision,
    idempotencyKey,
    operationId: `tck-op-${idempotencyKey}`,
    recordedAt,
    mutations: Object.freeze([
      Object.freeze({
        type: 'node.put' as const,
        node: Object.freeze({
          id: nodeId,
          type: 'tck-node',
          properties: Object.freeze({ ordinal: revision + 1 }),
        }),
      }),
    ]),
  });
}

function persistenceCommitFromTransaction(transaction: GraphTransaction): GraphPersistenceCommit {
  const prepared = prepareGraphTransaction(transaction);
  const current = createGraphDocument({ graphId: prepared.graphId });
  lawAssert(prepared.expectedRevision === 0, 'TCK direct persistence commit helper supports revision zero only');
  const materialized = materializeGraphCommit(current, prepared, {
    previousEventHash: null,
    previousRecordedAt: null,
    clock: () => transaction.recordedAt ?? 0,
  });
  const snapshot = Object.freeze({
    schema: COS_GRAPH_SNAPSHOT_VERSION,
    graph: materialized.graph,
    stateHash: graphDocumentHash(materialized.graph),
    lastEventHash: materialized.event.eventHash,
    eventCount: materialized.event.revision,
  });
  return Object.freeze({
    graphId: transaction.graphId,
    expectedStorageVersion: 0,
    event: materialized.event,
    snapshot,
    idempotency: Object.freeze({
      idempotencyKey: materialized.event.idempotencyKey,
      requestHash: materialized.event.requestHash,
      receipt: materialized.receipt,
    }),
  });
}

function receiptMatches(left: GraphCommitReceipt, right: GraphCommitReceipt): boolean {
  return left.graphId === right.graphId
    && left.revision === right.revision
    && left.eventId === right.eventId
    && left.eventHash === right.eventHash
    && left.stateHash === right.stateHash
    && left.requestHash === right.requestHash;
}

async function closeDriver(driver: GraphDurabilityDriver | null): Promise<void> {
  await driver?.close?.();
}

async function openParsed(
  factory: GraphDurabilityConformanceFactory,
  scope: string,
  graphId: string,
): Promise<{ readonly driver: GraphDurabilityDriver; readonly image: GraphPersistenceImage }> {
  const driver = await factory.open(scope);
  const raw = await driver.load(graphId);
  lawAssert(raw !== null, 'Expected durable graph authority to exist after commit', { scope, graphId });
  return Object.freeze({ driver, image: parseGraphPersistenceImage(raw, graphId) });
}

async function runScopedLaw(
  factory: GraphDurabilityConformanceFactory,
  namespace: string,
  law: GraphDurabilityConformanceLaw,
  execute: (scope: string) => Promise<void>,
): Promise<void> {
  const scope = `${namespace}--${law}`;
  try {
    await factory.destroy(scope);
    await execute(scope);
  } catch (error: unknown) {
    throw new GraphDurabilityConformanceError(
      'CONFORMANCE_LAW_FAILED',
      `Durability backend ${factory.backendId} failed conformance law ${law}`,
      factory.backendId,
      law,
      { scope },
      { cause: error },
    );
  } finally {
    try {
      await factory.destroy(scope);
    } catch {
      // Test cleanup failure must not replace the conformance law failure.
    }
  }
}

async function lawFirstCommitAtomicity(
  factory: GraphDurabilityConformanceFactory,
  scope: string,
): Promise<void> {
  const graphId = 'tck-first-commit';
  const transaction = lawTransaction(graphId, 0, 'first-1', 1_000, 'a');
  const driver = await factory.open(scope);
  try {
    lawAssert(await driver.load(graphId) === null, 'Fresh scope must not contain graph authority');
    const commit = persistenceCommitFromTransaction(transaction);
    const result = await driver.compareAndSwap(commit);
    lawAssert(result.status === 'committed', 'First storage CAS must commit from storageVersion zero');
    lawAssert(result.storageVersion === 1, 'First storage CAS must produce storageVersion 1', { result });
    const raw = await driver.load(graphId);
    lawAssert(raw !== null, 'Committed graph must become readable');
    const image = parseGraphPersistenceImage(raw, graphId);
    lawAssert(image.storageVersion === 1, 'Persisted storageVersion must equal committed result');
    lawAssert(image.snapshot.graph.revision === 1, 'First commit must create semantic graph revision 1');
    lawAssert(image.events.length === 1, 'First commit must atomically persist one event');
    lawAssert(image.idempotency.length === 1, 'First commit must atomically persist one idempotency record');
    lawAssert(image.events[0]?.eventHash === image.snapshot.lastEventHash, 'First event must bind snapshot terminal hash');
  } finally {
    await closeDriver(driver);
  }
}

async function lawStaleStorageCas(
  factory: GraphDurabilityConformanceFactory,
  scope: string,
): Promise<void> {
  const graphId = 'tck-storage-cas';
  const commit = persistenceCommitFromTransaction(lawTransaction(graphId, 0, 'cas-1', 1_000, 'a'));
  const left = await factory.open(scope);
  const right = await factory.open(scope);
  try {
    lawAssert(await left.load(graphId) === null, 'Left handle must observe fresh scope');
    lawAssert(await right.load(graphId) === null, 'Right handle must observe the same fresh scope');
    const winner = await left.compareAndSwap(commit);
    lawAssert(winner.status === 'committed' && winner.storageVersion === 1, 'First writer must win storage CAS');
    const loser = await right.compareAndSwap(commit);
    lawAssert(loser.status === 'conflict', 'Stale second writer must return storage CAS conflict, never last-write-wins', {
      loser,
    });
    const raw = await right.load(graphId);
    lawAssert(raw !== null, 'Winning graph authority must remain readable');
    const image = parseGraphPersistenceImage(raw, graphId);
    lawAssert(image.storageVersion === 1, 'Stale CAS must not manufacture a storage revision');
    lawAssert(image.events.length === 1, 'Stale CAS must not duplicate the event');
    lawAssert(image.idempotency.length === 1, 'Stale CAS must not duplicate idempotency authority');
  } finally {
    await closeDriver(left);
    await closeDriver(right);
  }
}

async function lawRestartRecovery(
  factory: GraphDurabilityConformanceFactory,
  scope: string,
): Promise<void> {
  const graphId = 'tck-restart';
  const firstDriver = await factory.open(scope);
  const firstStore = new DurableGraphStore(firstDriver);
  const first = await firstStore.commit(lawTransaction(graphId, 0, 'restart-1', 1_000, 'a'));
  const second = await firstStore.commit(lawTransaction(graphId, 1, 'restart-2', 2_000, 'b'));
  const before = await firstStore.snapshot(graphId);
  lawAssert(before.graph.revision === 2, 'Pre-restart graph must reach revision 2');
  await firstStore.close();

  const reopenedDriver = await factory.open(scope);
  const reopened = new DurableGraphStore(reopenedDriver);
  try {
    const after = await reopened.snapshot(graphId);
    const replay = await reopened.verify(graphId);
    lawAssert(after.stateHash === before.stateHash, 'Restart must preserve canonical state hash');
    lawAssert(after.lastEventHash === before.lastEventHash, 'Restart must preserve terminal event hash');
    lawAssert(replay.stateHash === before.stateHash, 'Restart replay must reconstruct canonical state');
    lawAssert(replay.eventCount === 2, 'Restart replay must preserve semantic event count');
    const firstRetry = await reopened.commit(lawTransaction(graphId, 0, 'restart-1', 1_000, 'a'));
    lawAssert(firstRetry.idempotentReplay, 'Old exact retry after restart must converge');
    lawAssert(receiptMatches(firstRetry, first), 'Old exact retry must reproduce original first receipt');
    const secondRetry = await reopened.commit(lawTransaction(graphId, 1, 'restart-2', 2_000, 'b'));
    lawAssert(secondRetry.idempotentReplay, 'Second exact retry after restart must converge');
    lawAssert(receiptMatches(secondRetry, second), 'Second retry must reproduce original second receipt');
  } finally {
    await reopened.close();
  }
}

async function seedCompactionGraph(
  factory: GraphDurabilityConformanceFactory,
  scope: string,
  graphId: string,
): Promise<{ readonly store: DurableGraphStore; readonly receipts: readonly GraphCommitReceipt[] }> {
  const store = new DurableGraphStore(await factory.open(scope));
  const receipts = [
    await store.commit(lawTransaction(graphId, 0, 'seed-1', 1_000, 'a')),
    await store.commit(lawTransaction(graphId, 1, 'seed-2', 2_000, 'b')),
    await store.commit(lawTransaction(graphId, 2, 'seed-3', 3_000, 'c')),
  ];
  return Object.freeze({ store, receipts: Object.freeze(receipts) });
}

async function lawCompactionClockSeparation(
  factory: GraphDurabilityConformanceFactory,
  scope: string,
): Promise<void> {
  const graphId = 'tck-compaction-clock';
  const { store } = await seedCompactionGraph(factory, scope, graphId);
  try {
    const before = await store.history(graphId);
    const beforeSnapshot = await store.snapshot(graphId);
    lawAssert(before.storageVersion === 3 && before.eventCount === 3, 'Seed graph clocks must initially coincide at 3');
    const compacted = await store.compact(graphId);
    const after = await store.history(graphId);
    const afterSnapshot = await store.snapshot(graphId);
    lawAssert(compacted.storageVersion === 4, 'Compaction must advance storageVersion exactly once');
    lawAssert(after.storageVersion === 4, 'Persisted compaction storageVersion must be 4');
    lawAssert(after.graphRevision === 3 && after.eventCount === 3, 'Compaction must not mutate semantic graph clocks');
    lawAssert(after.compactedEventCount === 3, 'Compaction anchor must cover all prior events');
    lawAssert(after.retainedEvents.length === 0, 'Full-head compaction must prune retained event tail');
    lawAssert(afterSnapshot.stateHash === beforeSnapshot.stateHash, 'Compaction must preserve canonical graph state hash');
    lawAssert(afterSnapshot.lastEventHash === beforeSnapshot.lastEventHash, 'Compaction must preserve semantic terminal event hash');
  } finally {
    await store.close();
  }
}

async function lawCompactionCas(
  factory: GraphDurabilityConformanceFactory,
  scope: string,
): Promise<void> {
  const graphId = 'tck-compaction-cas';
  const seeded = await seedCompactionGraph(factory, scope, graphId);
  await seeded.store.close();

  const leftParsed = await openParsed(factory, scope, graphId);
  const right = await factory.open(scope);
  try {
    lawAssert(typeof leftParsed.driver.compact === 'function', 'M2D profile requires driver.compact()');
    lawAssert(typeof right.compact === 'function', 'M2D profile requires compaction on every reopened handle');
    const image = leftParsed.image;
    const lastRecordedAt = image.events.at(-1)?.recordedAt;
    lawAssert(lastRecordedAt !== undefined, 'Pre-compaction image must expose a retained terminal event timestamp');
    const anchor = createGraphPersistenceAnchor(image.snapshot, lastRecordedAt, image.idempotency);
    const request: GraphPersistenceCompaction = Object.freeze({
      graphId,
      expectedStorageVersion: image.storageVersion,
      anchor,
    });
    const winner = await leftParsed.driver.compact(request);
    lawAssert(winner.status === 'compacted', 'First compaction CAS must win');
    lawAssert(winner.storageVersion === image.storageVersion + 1, 'Compaction CAS must advance storage clock once');
    lawAssert(winner.prunedEvents === image.events.length, 'Compaction must report exactly the pruned retained tail');
    const loser = await right.compact(request);
    lawAssert(loser.status === 'conflict', 'Stale compaction CAS must conflict');
    const raw = await right.load(graphId);
    lawAssert(raw !== null, 'Compacted authority must remain readable after stale compactor');
    const current = parseGraphPersistenceImage(raw, graphId);
    lawAssert(current.storageVersion === image.storageVersion + 1, 'Stale compactor must not advance storage clock');
    lawAssert(current.anchor?.anchorHash === anchor.anchorHash, 'Winning anchor must remain authoritative');
  } finally {
    await closeDriver(leftParsed.driver);
    await closeDriver(right);
  }
}

async function lawPostAnchorContinuity(
  factory: GraphDurabilityConformanceFactory,
  scope: string,
): Promise<void> {
  const graphId = 'tck-anchor-continuity';
  const { store } = await seedCompactionGraph(factory, scope, graphId);
  try {
    await store.compact(graphId);
    const anchored = await store.history(graphId);
    lawAssert(anchored.anchor !== null, 'Compaction must install anchor');
    const anchorLastHash = anchored.anchor.snapshot.lastEventHash;
    const fourth = await store.commit(lawTransaction(graphId, 3, 'seed-4', 4_000, 'd'));
    const history = await store.history(graphId);
    lawAssert(history.graphRevision === 4 && history.eventCount === 4, 'Post-anchor commit must advance semantic clocks');
    lawAssert(history.storageVersion === 5, 'Post-anchor commit must also advance storage clock');
    lawAssert(history.compactedEventCount === 3, 'Post-anchor commit must preserve existing compacted prefix');
    lawAssert(history.retainedEvents.length === 1, 'Post-anchor commit must retain exactly one new tail event');
    const tail = history.retainedEvents[0];
    lawAssert(tail?.previousEventHash === anchorLastHash, 'First retained event must chain directly from anchor terminal hash');
    lawAssert(tail?.eventHash === fourth.eventHash, 'Retained tail event must match commit receipt');
    const replay = await store.verify(graphId);
    lawAssert(replay.stateHash === fourth.stateHash && replay.eventCount === 4, 'Anchored replay must include post-anchor event');
  } finally {
    await store.close();
  }
}

async function lawPrunedExactRetry(
  factory: GraphDurabilityConformanceFactory,
  scope: string,
): Promise<void> {
  const graphId = 'tck-pruned-retry';
  const { store, receipts } = await seedCompactionGraph(factory, scope, graphId);
  try {
    await store.compact(graphId);
    const before = await store.history(graphId);
    lawAssert(before.retainedEvents.length === 0, 'Seed event envelopes must be physically pruned before retry law');
    const retry = await store.commit(lawTransaction(graphId, 0, 'seed-1', 1_000, 'a'));
    lawAssert(retry.idempotentReplay, 'Pruned old transaction must converge through retained idempotency authority');
    lawAssert(receiptMatches(retry, receipts[0] as GraphCommitReceipt), 'Pruned retry must reproduce original receipt');
    const after = await store.history(graphId);
    lawAssert(after.storageVersion === before.storageVersion, 'Exact pruned retry must not mutate storage clock');
    lawAssert(after.eventCount === before.eventCount, 'Exact pruned retry must not mutate semantic event count');
    lawAssert(after.retainedEvents.length === 0, 'Exact pruned retry must not recreate pruned event envelope');
  } finally {
    await store.close();
  }
}

async function lawPrunedIdempotencyConflict(
  factory: GraphDurabilityConformanceFactory,
  scope: string,
): Promise<void> {
  const graphId = 'tck-pruned-conflict';
  const { store } = await seedCompactionGraph(factory, scope, graphId);
  try {
    await store.compact(graphId);
    let conflict: unknown = null;
    try {
      await store.commit(Object.freeze({
        ...lawTransaction(graphId, 0, 'seed-1', 1_000, 'changed'),
        mutations: Object.freeze([{ type: 'node.put' as const, node: Object.freeze({ id: 'changed' }) }]),
      }));
    } catch (error: unknown) {
      conflict = error;
    }
    lawAssert(conflict instanceof GraphStateError, 'Changed payload under pruned idempotency key must fail with GraphStateError');
    lawAssert(conflict.code === 'IDEMPOTENCY_CONFLICT', 'Changed payload under pruned key must produce IDEMPOTENCY_CONFLICT', {
      actualCode: conflict.code,
    });
  } finally {
    await store.close();
  }
}

async function lawAnchorTimeMonotonicity(
  factory: GraphDurabilityConformanceFactory,
  scope: string,
): Promise<void> {
  const graphId = 'tck-anchor-time';
  const { store } = await seedCompactionGraph(factory, scope, graphId);
  try {
    await store.compact(graphId);
    let failure: unknown = null;
    try {
      await store.commit(lawTransaction(graphId, 3, 'time-regression', 2_999, 'too-early'));
    } catch (error: unknown) {
      failure = error;
    }
    lawAssert(failure instanceof GraphStateError, 'Post-anchor timestamp regression must fail with GraphStateError');
    lawAssert(failure.code === 'EVENT_TIME_REGRESSION', 'Anchor timestamp must remain monotonicity boundary', {
      actualCode: failure.code,
    });
  } finally {
    await store.close();
  }
}

async function lawCompactionNoop(
  factory: GraphDurabilityConformanceFactory,
  scope: string,
): Promise<void> {
  const graphId = 'tck-compaction-noop';
  const { store } = await seedCompactionGraph(factory, scope, graphId);
  try {
    const first = await store.compact(graphId);
    lawAssert(!first.noOp, 'First compaction over retained history must not be a no-op');
    const second = await store.compact(graphId);
    lawAssert(second.noOp, 'Second compaction at unchanged anchored head must be a no-op');
    lawAssert(second.storageVersion === first.storageVersion, 'No-op compaction must not manufacture storage revisions');
    lawAssert(second.anchorHash === first.anchorHash, 'No-op compaction must preserve anchor identity');
  } finally {
    await store.close();
  }
}

/**
 * Run the mandatory M2D durability technology-compatibility kit against a real
 * backend. A successful report certifies only these laws and profile; it is not
 * a whole-repository production certification.
 */
export async function runGraphDurabilityConformance(
  factory: GraphDurabilityConformanceFactory,
  options: GraphDurabilityConformanceOptions,
): Promise<GraphDurabilityConformanceReport> {
  let backendId: string;
  let namespace: string;
  try {
    backendId = requireNonEmpty(factory.backendId, 'factory.backendId');
    namespace = requireNonEmpty(options.namespace, 'options.namespace');
    if (typeof factory.open !== 'function' || typeof factory.destroy !== 'function') {
      throw new TypeError('Durability conformance factory must implement open() and destroy()');
    }
  } catch (error: unknown) {
    throw new GraphDurabilityConformanceError(
      'CONFORMANCE_FACTORY_INVALID',
      'Durability conformance factory/options are invalid',
      typeof factory?.backendId === 'string' ? factory.backendId : 'unknown',
      null,
      {},
      { cause: error },
    );
  }

  const laws: ReadonlyArray<readonly [GraphDurabilityConformanceLaw, (scope: string) => Promise<void>]> = Object.freeze([
    ['first-commit-atomicity', (scope) => lawFirstCommitAtomicity(factory, scope)],
    ['stale-storage-cas', (scope) => lawStaleStorageCas(factory, scope)],
    ['restart-recovery', (scope) => lawRestartRecovery(factory, scope)],
    ['compaction-clock-separation', (scope) => lawCompactionClockSeparation(factory, scope)],
    ['compaction-cas', (scope) => lawCompactionCas(factory, scope)],
    ['post-anchor-continuity', (scope) => lawPostAnchorContinuity(factory, scope)],
    ['pruned-exact-retry', (scope) => lawPrunedExactRetry(factory, scope)],
    ['pruned-idempotency-conflict', (scope) => lawPrunedIdempotencyConflict(factory, scope)],
    ['anchor-time-monotonicity', (scope) => lawAnchorTimeMonotonicity(factory, scope)],
    ['compaction-noop', (scope) => lawCompactionNoop(factory, scope)],
  ]);

  const passed: GraphDurabilityConformanceLaw[] = [];
  for (const [law, execute] of laws) {
    await runScopedLaw(factory, namespace, law, execute);
    passed.push(law);
  }

  lawAssert(
    passed.length === GRAPH_DURABILITY_M2D_LAWS.length
      && passed.every((law, index) => law === GRAPH_DURABILITY_M2D_LAWS[index]),
    'Internal TCK law order drifted from exported M2D law manifest',
  );

  const reportWithoutHash = Object.freeze({
    schema: COS_GRAPH_DURABILITY_CONFORMANCE_VERSION,
    profile: COS_GRAPH_DURABILITY_PROFILE_M2D,
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

/** Structural helper for adapter authors that need to forward conformance calls. */
export type GraphDurabilityConformanceDriverResult =
  | GraphPersistenceCompareAndSwapResult
  | GraphPersistenceCompactionResult;
