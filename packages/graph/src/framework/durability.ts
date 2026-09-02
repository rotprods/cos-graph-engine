import {
  CanonicalGraphDocument,
  GraphModelLimits,
  DEFAULT_GRAPH_MODEL_LIMITS,
  graphDocumentHash,
  parseGraphDocument,
} from './model';
import {
  COS_GRAPH_EVENT_VERSION,
  COS_GRAPH_SNAPSHOT_VERSION,
  CanonicalGraphMutation,
  GraphCommitReceipt,
  GraphEvent,
  GraphMutation,
  GraphReplayResult,
  GraphSnapshot,
  GraphStateError,
  GraphTransaction,
  InMemoryGraphStore,
  replayGraphEvents,
} from './state-store';

export const COS_GRAPH_PERSISTENCE_IMAGE_VERSION = 'cos.graph/persistence-image/v1alpha1' as const;

export interface GraphPersistedIdempotencyRecord {
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly receipt: GraphCommitReceipt;
}

export interface GraphPersistenceImage {
  readonly schema: typeof COS_GRAPH_PERSISTENCE_IMAGE_VERSION;
  readonly graphId: string;
  readonly storageVersion: number;
  readonly snapshot: GraphSnapshot;
  readonly events: readonly GraphEvent[];
  readonly idempotency: readonly GraphPersistedIdempotencyRecord[];
}

export interface GraphPersistenceCommit {
  readonly graphId: string;
  readonly expectedStorageVersion: number;
  readonly event: GraphEvent;
  readonly snapshot: GraphSnapshot;
  readonly idempotency: GraphPersistedIdempotencyRecord;
}

export type GraphPersistenceCompareAndSwapResult =
  | { readonly status: 'committed'; readonly storageVersion: number }
  | { readonly status: 'conflict' };

/**
 * Driver contract for one graph authority.
 *
 * `compareAndSwap` MUST atomically persist the event, head snapshot and
 * idempotency record iff `expectedStorageVersion` is still current.
 * A driver that cannot provide that atomicity is non-conformant.
 *
 * `load` intentionally returns `unknown`: persisted bytes are a trust boundary
 * and are revalidated by DurableGraphStore before they become graph truth.
 */
export interface GraphDurabilityDriver {
  load(graphId: string): unknown | null | Promise<unknown | null>;
  compareAndSwap(commit: GraphPersistenceCommit): GraphPersistenceCompareAndSwapResult | Promise<GraphPersistenceCompareAndSwapResult>;
  close?(): void | Promise<void>;
}

export type GraphDurabilityErrorCode =
  | 'DURABILITY_IMAGE_INVALID'
  | 'DURABILITY_DRIVER_FAILURE'
  | 'DURABILITY_DRIVER_PROTOCOL_INVALID'
  | 'DURABILITY_CAS_RETRY_EXHAUSTED';

export class GraphDurabilityError extends Error {
  readonly code: GraphDurabilityErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: GraphDurabilityErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = 'GraphDurabilityError';
    this.code = code;
    this.details = details;
  }
}

export interface DurableGraphStoreOptions {
  readonly clock?: () => number;
  readonly limits?: GraphModelLimits;
  readonly maxCommitAttempts?: number;
}

interface HydratedGraphAuthority {
  readonly image: GraphPersistenceImage;
  readonly store: InMemoryGraphStore;
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

function asSafeInteger(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new TypeError(`${label} must be a safe integer >= ${minimum}`);
  }
  return value as number;
}

function asFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

function asNullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return asString(value, label);
}

function parseCommitReceipt(value: unknown, label: string): GraphCommitReceipt {
  const record = asRecord(value, label);
  if (typeof record.idempotentReplay !== 'boolean') {
    throw new TypeError(`${label}.idempotentReplay must be boolean`);
  }
  return Object.freeze({
    graphId: asString(record.graphId, `${label}.graphId`),
    revision: asSafeInteger(record.revision, `${label}.revision`, 1),
    eventId: asString(record.eventId, `${label}.eventId`),
    eventHash: asString(record.eventHash, `${label}.eventHash`),
    stateHash: asString(record.stateHash, `${label}.stateHash`),
    requestHash: asString(record.requestHash, `${label}.requestHash`),
    idempotentReplay: record.idempotentReplay,
  });
}

function parseSnapshot(value: unknown): GraphSnapshot {
  const record = asRecord(value, 'persistence snapshot');
  if (record.schema !== COS_GRAPH_SNAPSHOT_VERSION) {
    throw new TypeError(`Unsupported persistence snapshot schema: ${String(record.schema)}`);
  }
  const graph = parseGraphDocument(record.graph);
  const stateHash = asString(record.stateHash, 'persistence snapshot.stateHash');
  if (graphDocumentHash(graph) !== stateHash) {
    throw new TypeError('Persistence snapshot stateHash does not match graph content');
  }
  return Object.freeze({
    schema: COS_GRAPH_SNAPSHOT_VERSION,
    graph,
    stateHash,
    lastEventHash: asNullableString(record.lastEventHash, 'persistence snapshot.lastEventHash'),
    eventCount: asSafeInteger(record.eventCount, 'persistence snapshot.eventCount'),
  });
}

function parseEvent(value: unknown, index: number): GraphEvent {
  const label = `persistence event[${index}]`;
  const record = asRecord(value, label);
  if (record.schema !== COS_GRAPH_EVENT_VERSION) {
    throw new TypeError(`${label} has unsupported schema ${String(record.schema)}`);
  }
  if (!Array.isArray(record.mutations)) throw new TypeError(`${label}.mutations must be an array`);
  return Object.freeze({
    schema: COS_GRAPH_EVENT_VERSION,
    eventId: asString(record.eventId, `${label}.eventId`),
    graphId: asString(record.graphId, `${label}.graphId`),
    operationId: asString(record.operationId, `${label}.operationId`),
    idempotencyKey: asString(record.idempotencyKey, `${label}.idempotencyKey`),
    baseRevision: asSafeInteger(record.baseRevision, `${label}.baseRevision`),
    revision: asSafeInteger(record.revision, `${label}.revision`, 1),
    recordedAt: asFiniteNumber(record.recordedAt, `${label}.recordedAt`),
    requestHash: asString(record.requestHash, `${label}.requestHash`),
    previousEventHash: asNullableString(record.previousEventHash, `${label}.previousEventHash`),
    beforeStateHash: asString(record.beforeStateHash, `${label}.beforeStateHash`),
    afterStateHash: asString(record.afterStateHash, `${label}.afterStateHash`),
    mutations: Object.freeze([...(record.mutations as readonly CanonicalGraphMutation[])]),
    eventHash: asString(record.eventHash, `${label}.eventHash`),
  });
}

function receiptFromEvent(event: GraphEvent): GraphCommitReceipt {
  return Object.freeze({
    graphId: event.graphId,
    revision: event.revision,
    eventId: event.eventId,
    eventHash: event.eventHash,
    stateHash: event.afterStateHash,
    requestHash: event.requestHash,
    idempotentReplay: false,
  });
}

function parseIdempotencyRecord(value: unknown, index: number): GraphPersistedIdempotencyRecord {
  const label = `persistence idempotency[${index}]`;
  const record = asRecord(value, label);
  return Object.freeze({
    idempotencyKey: asString(record.idempotencyKey, `${label}.idempotencyKey`),
    requestHash: asString(record.requestHash, `${label}.requestHash`),
    receipt: parseCommitReceipt(record.receipt, `${label}.receipt`),
  });
}

function sameReceipt(left: GraphCommitReceipt, right: GraphCommitReceipt): boolean {
  return left.graphId === right.graphId
    && left.revision === right.revision
    && left.eventId === right.eventId
    && left.eventHash === right.eventHash
    && left.stateHash === right.stateHash
    && left.requestHash === right.requestHash;
}

export function parseGraphPersistenceImage(
  value: unknown,
  expectedGraphId: string,
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): GraphPersistenceImage {
  try {
    const record = asRecord(value, 'graph persistence image');
    if (record.schema !== COS_GRAPH_PERSISTENCE_IMAGE_VERSION) {
      throw new TypeError(`Unsupported graph persistence image schema: ${String(record.schema)}`);
    }
    const graphId = asString(record.graphId, 'graph persistence image.graphId');
    if (graphId !== expectedGraphId) {
      throw new TypeError(`Persistence image graph ${graphId} does not match requested graph ${expectedGraphId}`);
    }
    const storageVersion = asSafeInteger(record.storageVersion, 'graph persistence image.storageVersion', 1);
    const snapshot = parseSnapshot(record.snapshot);
    if (snapshot.graph.graphId !== graphId) {
      throw new TypeError('Persistence snapshot graphId does not match persistence image graphId');
    }
    if (!Array.isArray(record.events)) throw new TypeError('graph persistence image.events must be an array');
    if (!Array.isArray(record.idempotency)) throw new TypeError('graph persistence image.idempotency must be an array');
    const events = Object.freeze(record.events.map(parseEvent));
    const idempotency = Object.freeze(record.idempotency.map(parseIdempotencyRecord));

    if (storageVersion !== events.length) {
      throw new TypeError(`Persistence storageVersion ${storageVersion} must equal append count ${events.length}`);
    }
    if (snapshot.eventCount !== events.length || snapshot.graph.revision !== events.length) {
      throw new TypeError('Persistence snapshot revision/eventCount does not match append-only event history');
    }

    const replay = replayGraphEvents(graphId, events, limits);
    if (
      replay.stateHash !== snapshot.stateHash
      || replay.lastEventHash !== snapshot.lastEventHash
      || replay.eventCount !== snapshot.eventCount
      || graphDocumentHash(replay.graph) !== graphDocumentHash(snapshot.graph)
    ) {
      throw new TypeError('Persistence snapshot is not equivalent to deterministic event replay');
    }

    const expectedByKey = new Map<string, GraphPersistedIdempotencyRecord>();
    for (const event of events) {
      if (expectedByKey.has(event.idempotencyKey)) {
        throw new TypeError(`Committed event history reused idempotency key ${event.idempotencyKey}`);
      }
      expectedByKey.set(event.idempotencyKey, Object.freeze({
        idempotencyKey: event.idempotencyKey,
        requestHash: event.requestHash,
        receipt: receiptFromEvent(event),
      }));
    }
    if (idempotency.length !== expectedByKey.size) {
      throw new TypeError('Persistence idempotency index cardinality does not match committed event history');
    }
    const seen = new Set<string>();
    for (const persisted of idempotency) {
      if (seen.has(persisted.idempotencyKey)) {
        throw new TypeError(`Persistence idempotency index contains duplicate key ${persisted.idempotencyKey}`);
      }
      seen.add(persisted.idempotencyKey);
      const expected = expectedByKey.get(persisted.idempotencyKey);
      if (!expected) throw new TypeError(`Persistence idempotency key ${persisted.idempotencyKey} has no event`);
      if (
        persisted.requestHash !== expected.requestHash
        || persisted.receipt.idempotentReplay
        || !sameReceipt(persisted.receipt, expected.receipt)
      ) {
        throw new TypeError(`Persistence idempotency record ${persisted.idempotencyKey} does not match its event`);
      }
    }

    return Object.freeze({
      schema: COS_GRAPH_PERSISTENCE_IMAGE_VERSION,
      graphId,
      storageVersion,
      snapshot,
      events,
      idempotency,
    });
  } catch (error: unknown) {
    if (error instanceof GraphDurabilityError) throw error;
    throw new GraphDurabilityError(
      'DURABILITY_IMAGE_INVALID',
      `Persisted graph authority ${expectedGraphId} failed integrity validation`,
      { graphId: expectedGraphId },
      { cause: error },
    );
  }
}

function reconstructStore(
  image: GraphPersistenceImage,
  clock: () => number,
  limits: GraphModelLimits,
): InMemoryGraphStore {
  const store = new InMemoryGraphStore({ clock, limits });
  for (const event of image.events) {
    const receipt = store.commit({
      graphId: event.graphId,
      expectedRevision: event.baseRevision,
      mutations: event.mutations as readonly GraphMutation[],
      idempotencyKey: event.idempotencyKey,
      operationId: event.operationId,
      recordedAt: event.recordedAt,
    });
    if (!sameReceipt(receipt, receiptFromEvent(event))) {
      throw new GraphDurabilityError(
        'DURABILITY_IMAGE_INVALID',
        `Event ${event.eventId} does not reconstruct to the persisted receipt`,
        { graphId: image.graphId, eventId: event.eventId },
      );
    }
  }
  const snapshot = store.snapshot(image.graphId);
  if (
    snapshot.stateHash !== image.snapshot.stateHash
    || snapshot.lastEventHash !== image.snapshot.lastEventHash
    || snapshot.eventCount !== image.snapshot.eventCount
  ) {
    throw new GraphDurabilityError(
      'DURABILITY_IMAGE_INVALID',
      `Reconstructed graph ${image.graphId} does not match persisted head`,
      { graphId: image.graphId },
    );
  }
  return store;
}

function persistedRecordFromEvent(event: GraphEvent): GraphPersistedIdempotencyRecord {
  return Object.freeze({
    idempotencyKey: event.idempotencyKey,
    requestHash: event.requestHash,
    receipt: receiptFromEvent(event),
  });
}

export class DurableGraphStore {
  private readonly clock: () => number;
  private readonly limits: GraphModelLimits;
  private readonly maxCommitAttempts: number;

  constructor(
    private readonly driver: GraphDurabilityDriver,
    options: DurableGraphStoreOptions = {},
  ) {
    this.clock = options.clock ?? Date.now;
    this.limits = options.limits ?? DEFAULT_GRAPH_MODEL_LIMITS;
    this.maxCommitAttempts = options.maxCommitAttempts ?? 8;
    if (!Number.isSafeInteger(this.maxCommitAttempts) || this.maxCommitAttempts < 1) {
      throw new TypeError('maxCommitAttempts must be a positive safe integer');
    }
  }

  async has(graphId: string): Promise<boolean> {
    return (await this.load(graphId)) !== null;
  }

  async get(graphId: string): Promise<CanonicalGraphDocument> {
    const hydrated = await this.load(graphId);
    if (!hydrated) throw new GraphStateError('GRAPH_NOT_FOUND', `Graph ${graphId} does not exist`, { graphId });
    return hydrated.store.get(graphId);
  }

  async events(graphId: string): Promise<readonly GraphEvent[]> {
    const hydrated = await this.load(graphId);
    if (!hydrated) throw new GraphStateError('GRAPH_NOT_FOUND', `Graph ${graphId} does not exist`, { graphId });
    return hydrated.store.events(graphId);
  }

  async snapshot(graphId: string): Promise<GraphSnapshot> {
    const hydrated = await this.load(graphId);
    if (!hydrated) throw new GraphStateError('GRAPH_NOT_FOUND', `Graph ${graphId} does not exist`, { graphId });
    return hydrated.store.snapshot(graphId);
  }

  async verify(graphId: string): Promise<GraphReplayResult> {
    const hydrated = await this.load(graphId);
    if (!hydrated) throw new GraphStateError('GRAPH_NOT_FOUND', `Graph ${graphId} does not exist`, { graphId });
    return hydrated.store.verify(graphId);
  }

  async commit(transaction: GraphTransaction): Promise<GraphCommitReceipt> {
    const recordedAt = transaction.recordedAt ?? this.clock();
    const stableTransaction: GraphTransaction = Object.freeze({ ...transaction, recordedAt });

    for (let attempt = 1; attempt <= this.maxCommitAttempts; attempt += 1) {
      const hydrated = await this.load(transaction.graphId);
      const store = hydrated?.store ?? new InMemoryGraphStore({ clock: this.clock, limits: this.limits });
      const receipt = store.commit(stableTransaction);
      if (receipt.idempotentReplay) return receipt;

      const event = store.events(transaction.graphId).at(-1);
      if (!event) {
        throw new GraphDurabilityError(
          'DURABILITY_DRIVER_PROTOCOL_INVALID',
          'A successful graph commit did not produce an event',
          { graphId: transaction.graphId },
        );
      }
      const snapshot = store.snapshot(transaction.graphId);
      const result = await this.compareAndSwap({
        graphId: transaction.graphId,
        expectedStorageVersion: hydrated?.image.storageVersion ?? 0,
        event,
        snapshot,
        idempotency: persistedRecordFromEvent(event),
      });
      if (result.status === 'committed') {
        const expectedStorageVersion = (hydrated?.image.storageVersion ?? 0) + 1;
        if (result.storageVersion !== expectedStorageVersion) {
          throw new GraphDurabilityError(
            'DURABILITY_DRIVER_PROTOCOL_INVALID',
            `Driver returned storageVersion ${result.storageVersion}; expected ${expectedStorageVersion}`,
            { graphId: transaction.graphId, attempt },
          );
        }
        return receipt;
      }
    }

    throw new GraphDurabilityError(
      'DURABILITY_CAS_RETRY_EXHAUSTED',
      `Durable graph commit exhausted ${this.maxCommitAttempts} compare-and-swap attempts`,
      { graphId: transaction.graphId, maxCommitAttempts: this.maxCommitAttempts },
    );
  }

  async close(): Promise<void> {
    await this.driver.close?.();
  }

  private async load(graphId: string): Promise<HydratedGraphAuthority | null> {
    let raw: unknown | null;
    try {
      raw = await this.driver.load(graphId);
    } catch (error: unknown) {
      throw new GraphDurabilityError(
        'DURABILITY_DRIVER_FAILURE',
        `Durability driver failed while loading graph ${graphId}`,
        { graphId },
        { cause: error },
      );
    }
    if (raw === null) return null;
    const image = parseGraphPersistenceImage(raw, graphId, this.limits);
    return Object.freeze({ image, store: reconstructStore(image, this.clock, this.limits) });
  }

  private async compareAndSwap(commit: GraphPersistenceCommit): Promise<GraphPersistenceCompareAndSwapResult> {
    let result: GraphPersistenceCompareAndSwapResult;
    try {
      result = await this.driver.compareAndSwap(commit);
    } catch (error: unknown) {
      throw new GraphDurabilityError(
        'DURABILITY_DRIVER_FAILURE',
        `Durability driver failed while committing graph ${commit.graphId}`,
        { graphId: commit.graphId, expectedStorageVersion: commit.expectedStorageVersion },
        { cause: error },
      );
    }
    if (result.status === 'conflict') return result;
    if (result.status === 'committed' && Number.isSafeInteger(result.storageVersion) && result.storageVersion >= 1) return result;
    throw new GraphDurabilityError(
      'DURABILITY_DRIVER_PROTOCOL_INVALID',
      'Durability driver returned an invalid compare-and-swap result',
      { graphId: commit.graphId },
    );
  }
}
