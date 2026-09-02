import {
  CanonicalGraphDocument,
  GraphModelLimits,
  DEFAULT_GRAPH_MODEL_LIMITS,
  canonicalGraphHash,
  createGraphDocument,
  graphDocumentHash,
  parseGraphDocument,
} from './model';
import {
  COS_GRAPH_EVENT_VERSION,
  COS_GRAPH_SNAPSHOT_VERSION,
  CanonicalGraphMutation,
  GraphCommitReceipt,
  GraphEvent,
  GraphReplayAnchorContext,
  GraphReplayResult,
  GraphSnapshot,
  GraphStateError,
  GraphTransaction,
  materializeGraphCommit,
  prepareGraphTransaction,
  replayGraphEventsFromAnchor,
} from './state-store';

export const COS_GRAPH_PERSISTENCE_IMAGE_VERSION = 'cos.graph/persistence-image/v1alpha2' as const;
export const COS_GRAPH_PERSISTENCE_IMAGE_LEGACY_VERSION = 'cos.graph/persistence-image/v1alpha1' as const;
export const COS_GRAPH_PERSISTENCE_ANCHOR_VERSION = 'cos.graph/persistence-anchor/v1alpha1' as const;

export interface GraphPersistedIdempotencyRecord {
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly receipt: GraphCommitReceipt;
}

export interface GraphPersistenceAnchor {
  readonly schema: typeof COS_GRAPH_PERSISTENCE_ANCHOR_VERSION;
  readonly snapshot: GraphSnapshot;
  readonly lastRecordedAt: number;
  readonly idempotencyCount: number;
  readonly idempotencyHash: string;
  readonly anchorHash: string;
}

export interface GraphPersistenceImage {
  readonly schema: typeof COS_GRAPH_PERSISTENCE_IMAGE_VERSION;
  readonly graphId: string;
  /** Storage CAS clock. It is intentionally independent from graph revision. */
  readonly storageVersion: number;
  /** Current canonical graph head. */
  readonly snapshot: GraphSnapshot;
  /** Optional compacted prefix. Events contains only history strictly after this anchor. */
  readonly anchor: GraphPersistenceAnchor | null;
  /** Retained event tail. Pre-anchor events may have been physically deleted. */
  readonly events: readonly GraphEvent[];
  /** Full idempotency authority is retained even when old event envelopes are compacted. */
  readonly idempotency: readonly GraphPersistedIdempotencyRecord[];
}

export interface GraphPersistenceCommit {
  readonly graphId: string;
  readonly expectedStorageVersion: number;
  readonly event: GraphEvent;
  readonly snapshot: GraphSnapshot;
  readonly idempotency: GraphPersistedIdempotencyRecord;
}

export interface GraphPersistenceCompaction {
  readonly graphId: string;
  readonly expectedStorageVersion: number;
  readonly anchor: GraphPersistenceAnchor;
}

export type GraphPersistenceCompareAndSwapResult =
  | { readonly status: 'committed'; readonly storageVersion: number }
  | { readonly status: 'conflict' };

export type GraphPersistenceCompactionResult =
  | { readonly status: 'compacted'; readonly storageVersion: number; readonly prunedEvents: number }
  | { readonly status: 'conflict' };

/**
 * Driver contract for one graph authority.
 *
 * `compareAndSwap` MUST atomically persist the new event, head snapshot and
 * idempotency record iff `expectedStorageVersion` is still current.
 *
 * `compact`, when implemented, MUST atomically install the supplied anchor,
 * delete only event envelopes at or below the anchor revision, preserve every
 * idempotency row, and advance storageVersion exactly once.
 *
 * `load` intentionally returns `unknown`: persisted bytes are a trust boundary
 * and are revalidated by DurableGraphStore before they become graph truth.
 */
export interface GraphDurabilityDriver {
  load(graphId: string): unknown | null | Promise<unknown | null>;
  compareAndSwap(
    commit: GraphPersistenceCommit,
  ): GraphPersistenceCompareAndSwapResult | Promise<GraphPersistenceCompareAndSwapResult>;
  compact?(
    compaction: GraphPersistenceCompaction,
  ): GraphPersistenceCompactionResult | Promise<GraphPersistenceCompactionResult>;
  close?(): void | Promise<void>;
}

export type GraphDurabilityErrorCode =
  | 'DURABILITY_IMAGE_INVALID'
  | 'DURABILITY_DRIVER_FAILURE'
  | 'DURABILITY_DRIVER_PROTOCOL_INVALID'
  | 'DURABILITY_CAS_RETRY_EXHAUSTED'
  | 'DURABILITY_COMPACTION_UNSUPPORTED';

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

export interface GraphDurableHistory {
  readonly graphId: string;
  readonly graphRevision: number;
  readonly eventCount: number;
  readonly storageVersion: number;
  readonly compactedEventCount: number;
  readonly retainedEvents: readonly GraphEvent[];
  readonly anchor: GraphPersistenceAnchor | null;
}

export interface GraphCompactionReceipt {
  readonly graphId: string;
  readonly graphRevision: number;
  readonly eventCount: number;
  readonly storageVersion: number;
  readonly prunedEvents: number;
  readonly retainedEvents: number;
  readonly anchorHash: string;
  readonly idempotencyCount: number;
  readonly noOp: boolean;
}

interface HydratedGraphAuthority {
  readonly image: GraphPersistenceImage;
  readonly replay: GraphReplayResult;
  readonly idempotencyByKey: ReadonlyMap<string, GraphPersistedIdempotencyRecord>;
  readonly lastRecordedAt: number | null;
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

function parseSnapshot(value: unknown, label = 'persistence snapshot'): GraphSnapshot {
  const record = asRecord(value, label);
  if (record.schema !== COS_GRAPH_SNAPSHOT_VERSION) {
    throw new TypeError(`Unsupported ${label} schema: ${String(record.schema)}`);
  }
  const graph = parseGraphDocument(record.graph);
  const stateHash = asString(record.stateHash, `${label}.stateHash`);
  if (graphDocumentHash(graph) !== stateHash) {
    throw new TypeError(`${label} stateHash does not match graph content`);
  }
  const eventCount = asSafeInteger(record.eventCount, `${label}.eventCount`);
  if (eventCount !== graph.revision) {
    throw new TypeError(`${label} eventCount must equal graph revision`);
  }
  const lastEventHash = asNullableString(record.lastEventHash, `${label}.lastEventHash`);
  if (eventCount === 0 && lastEventHash !== null) {
    throw new TypeError(`${label} with zero events cannot contain lastEventHash`);
  }
  if (eventCount > 0 && lastEventHash === null) {
    throw new TypeError(`${label} with events requires lastEventHash`);
  }
  return Object.freeze({
    schema: COS_GRAPH_SNAPSHOT_VERSION,
    graph,
    stateHash,
    lastEventHash,
    eventCount,
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

function cloneReceipt(receipt: GraphCommitReceipt, idempotentReplay: boolean): GraphCommitReceipt {
  return Object.freeze({ ...receipt, idempotentReplay });
}

function parseIdempotencyRecord(value: unknown, index: number): GraphPersistedIdempotencyRecord {
  const label = `persistence idempotency[${index}]`;
  const record = asRecord(value, label);
  const requestHash = asString(record.requestHash, `${label}.requestHash`);
  const receipt = parseCommitReceipt(record.receipt, `${label}.receipt`);
  if (receipt.requestHash !== requestHash) {
    throw new TypeError(`${label}.requestHash does not match its receipt`);
  }
  if (receipt.idempotentReplay) {
    throw new TypeError(`${label}.receipt must store the original non-replay receipt`);
  }
  return Object.freeze({
    idempotencyKey: asString(record.idempotencyKey, `${label}.idempotencyKey`),
    requestHash,
    receipt,
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

function orderedIdempotencyRecords(
  records: readonly GraphPersistedIdempotencyRecord[],
): readonly GraphPersistedIdempotencyRecord[] {
  return Object.freeze([...records].sort((left, right) => {
    if (left.receipt.revision !== right.receipt.revision) return left.receipt.revision - right.receipt.revision;
    return left.idempotencyKey < right.idempotencyKey ? -1 : left.idempotencyKey > right.idempotencyKey ? 1 : 0;
  }));
}

function assertTerminalReceiptMatchesSnapshot(
  snapshot: GraphSnapshot,
  orderedRecords: readonly GraphPersistedIdempotencyRecord[],
  label: string,
): void {
  if (snapshot.eventCount === 0) {
    if (orderedRecords.length !== 0) {
      throw new TypeError(`${label} with zero events cannot have idempotency receipts`);
    }
    return;
  }
  const terminal = orderedRecords.at(-1);
  if (!terminal || terminal.receipt.revision !== snapshot.eventCount) {
    throw new TypeError(`${label} terminal idempotency receipt revision does not match snapshot eventCount`);
  }
  if (
    terminal.receipt.graphId !== snapshot.graph.graphId
    || terminal.receipt.eventHash !== snapshot.lastEventHash
    || terminal.receipt.stateHash !== snapshot.stateHash
  ) {
    throw new TypeError(`${label} terminal idempotency receipt does not bind the snapshot terminal state`);
  }
}

export function graphIdempotencyHash(
  records: readonly GraphPersistedIdempotencyRecord[],
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): string {
  return canonicalGraphHash(orderedIdempotencyRecords(records), limits);
}

function anchorPayload(anchor: Omit<GraphPersistenceAnchor, 'anchorHash'>): Readonly<Record<string, unknown>> {
  return {
    schema: anchor.schema,
    snapshot: anchor.snapshot,
    lastRecordedAt: anchor.lastRecordedAt,
    idempotencyCount: anchor.idempotencyCount,
    idempotencyHash: anchor.idempotencyHash,
  };
}

export function createGraphPersistenceAnchor(
  snapshot: GraphSnapshot,
  lastRecordedAt: number,
  idempotency: readonly GraphPersistedIdempotencyRecord[],
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): GraphPersistenceAnchor {
  if (snapshot.eventCount < 1 || snapshot.lastEventHash === null) {
    throw new GraphDurabilityError(
      'DURABILITY_IMAGE_INVALID',
      'Persistence anchor requires a non-empty graph event history',
      { graphId: snapshot.graph.graphId, eventCount: snapshot.eventCount },
    );
  }
  if (!Number.isFinite(lastRecordedAt)) {
    throw new GraphDurabilityError(
      'DURABILITY_IMAGE_INVALID',
      'Persistence anchor requires finite lastRecordedAt',
      { graphId: snapshot.graph.graphId, lastRecordedAt },
    );
  }
  const prefix = orderedIdempotencyRecords(
    idempotency.filter((record) => record.receipt.revision <= snapshot.graph.revision),
  );
  if (prefix.length !== snapshot.eventCount) {
    throw new GraphDurabilityError(
      'DURABILITY_IMAGE_INVALID',
      'Persistence anchor idempotency prefix must contain exactly one record per anchored event',
      { graphId: snapshot.graph.graphId, eventCount: snapshot.eventCount, idempotencyCount: prefix.length },
    );
  }
  try {
    assertTerminalReceiptMatchesSnapshot(snapshot, prefix, 'Persistence anchor');
  } catch (error: unknown) {
    throw new GraphDurabilityError(
      'DURABILITY_IMAGE_INVALID',
      'Persistence anchor terminal receipt does not bind its snapshot',
      { graphId: snapshot.graph.graphId, eventCount: snapshot.eventCount },
      { cause: error },
    );
  }
  const withoutHash: Omit<GraphPersistenceAnchor, 'anchorHash'> = {
    schema: COS_GRAPH_PERSISTENCE_ANCHOR_VERSION,
    snapshot,
    lastRecordedAt,
    idempotencyCount: prefix.length,
    idempotencyHash: graphIdempotencyHash(prefix, limits),
  };
  return Object.freeze({
    ...withoutHash,
    anchorHash: canonicalGraphHash(anchorPayload(withoutHash), limits),
  });
}

function parseAnchor(
  value: unknown,
  graphId: string,
  idempotency: readonly GraphPersistedIdempotencyRecord[],
  limits: GraphModelLimits,
): GraphPersistenceAnchor {
  const record = asRecord(value, 'persistence anchor');
  if (record.schema !== COS_GRAPH_PERSISTENCE_ANCHOR_VERSION) {
    throw new TypeError(`Unsupported persistence anchor schema: ${String(record.schema)}`);
  }
  const snapshot = parseSnapshot(record.snapshot, 'persistence anchor.snapshot');
  if (snapshot.graph.graphId !== graphId) {
    throw new TypeError('Persistence anchor graphId does not match persistence image graphId');
  }
  if (snapshot.eventCount < 1 || snapshot.lastEventHash === null) {
    throw new TypeError('Persistence anchor must represent at least one event');
  }
  const lastRecordedAt = asFiniteNumber(record.lastRecordedAt, 'persistence anchor.lastRecordedAt');
  const idempotencyCount = asSafeInteger(record.idempotencyCount, 'persistence anchor.idempotencyCount', 1);
  if (idempotencyCount !== snapshot.eventCount) {
    throw new TypeError('Persistence anchor idempotencyCount must equal anchored eventCount');
  }
  const prefix = orderedIdempotencyRecords(
    idempotency.filter((entry) => entry.receipt.revision <= snapshot.graph.revision),
  );
  if (prefix.length !== idempotencyCount) {
    throw new TypeError('Persistence anchor idempotency prefix cardinality is invalid');
  }
  assertTerminalReceiptMatchesSnapshot(snapshot, prefix, 'Persistence anchor');
  const idempotencyHash = asString(record.idempotencyHash, 'persistence anchor.idempotencyHash');
  if (graphIdempotencyHash(prefix, limits) !== idempotencyHash) {
    throw new TypeError('Persistence anchor idempotencyHash does not match retained idempotency authority');
  }
  const withoutHash: Omit<GraphPersistenceAnchor, 'anchorHash'> = {
    schema: COS_GRAPH_PERSISTENCE_ANCHOR_VERSION,
    snapshot,
    lastRecordedAt,
    idempotencyCount,
    idempotencyHash,
  };
  const anchorHash = asString(record.anchorHash, 'persistence anchor.anchorHash');
  if (canonicalGraphHash(anchorPayload(withoutHash), limits) !== anchorHash) {
    throw new TypeError('Persistence anchor hash does not match canonical anchor payload');
  }
  return Object.freeze({ ...withoutHash, anchorHash });
}

function validateIdempotencyAuthority(
  graphId: string,
  eventCount: number,
  idempotency: readonly GraphPersistedIdempotencyRecord[],
  events: readonly GraphEvent[],
): ReadonlyMap<string, GraphPersistedIdempotencyRecord> {
  if (idempotency.length !== eventCount) {
    throw new TypeError('Persistence idempotency authority must retain one record per graph event');
  }
  const byKey = new Map<string, GraphPersistedIdempotencyRecord>();
  const byRevision = new Map<number, GraphPersistedIdempotencyRecord>();
  for (const persisted of idempotency) {
    if (byKey.has(persisted.idempotencyKey)) {
      throw new TypeError(`Persistence idempotency authority contains duplicate key ${persisted.idempotencyKey}`);
    }
    if (persisted.receipt.graphId !== graphId) {
      throw new TypeError(`Persistence idempotency key ${persisted.idempotencyKey} belongs to another graph`);
    }
    if (persisted.receipt.revision < 1 || persisted.receipt.revision > eventCount) {
      throw new TypeError(`Persistence idempotency key ${persisted.idempotencyKey} has an invalid receipt revision`);
    }
    if (byRevision.has(persisted.receipt.revision)) {
      throw new TypeError(`Persistence idempotency authority has duplicate receipt revision ${persisted.receipt.revision}`);
    }
    byKey.set(persisted.idempotencyKey, persisted);
    byRevision.set(persisted.receipt.revision, persisted);
  }
  for (let revision = 1; revision <= eventCount; revision += 1) {
    if (!byRevision.has(revision)) {
      throw new TypeError(`Persistence idempotency authority is missing receipt revision ${revision}`);
    }
  }

  for (const event of events) {
    const persisted = byRevision.get(event.revision);
    if (!persisted || persisted.idempotencyKey !== event.idempotencyKey) {
      throw new TypeError(`Retained event ${event.eventId} does not map to its idempotency record`);
    }
    const expected = receiptFromEvent(event);
    if (persisted.requestHash !== event.requestHash || !sameReceipt(persisted.receipt, expected)) {
      throw new TypeError(`Persistence idempotency record ${persisted.idempotencyKey} does not match retained event ${event.eventId}`);
    }
  }
  return byKey;
}

export function parseGraphPersistenceImage(
  value: unknown,
  expectedGraphId: string,
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): GraphPersistenceImage {
  try {
    const record = asRecord(value, 'graph persistence image');
    const schema = record.schema;
    const isLegacy = schema === COS_GRAPH_PERSISTENCE_IMAGE_LEGACY_VERSION;
    if (!isLegacy && schema !== COS_GRAPH_PERSISTENCE_IMAGE_VERSION) {
      throw new TypeError(`Unsupported graph persistence image schema: ${String(schema)}`);
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
    if (snapshot.eventCount < 1) {
      throw new TypeError('Persisted graph authority must contain at least one semantic graph event');
    }
    if (!Array.isArray(record.events)) throw new TypeError('graph persistence image.events must be an array');
    if (!Array.isArray(record.idempotency)) throw new TypeError('graph persistence image.idempotency must be an array');
    const events = Object.freeze(record.events.map(parseEvent));
    const idempotency = Object.freeze(record.idempotency.map(parseIdempotencyRecord));

    if (storageVersion < snapshot.eventCount) {
      throw new TypeError('Persistence storageVersion cannot be behind semantic graph eventCount');
    }
    if (isLegacy && storageVersion !== events.length) {
      throw new TypeError('Legacy persistence storageVersion must equal append count');
    }

    const idempotencyByKey = validateIdempotencyAuthority(graphId, snapshot.eventCount, idempotency, events);
    const orderedAuthority = orderedIdempotencyRecords(idempotency);
    assertTerminalReceiptMatchesSnapshot(snapshot, orderedAuthority, 'Persistence head');

    let anchor: GraphPersistenceAnchor | null = null;
    if (!isLegacy && record.anchor !== null) {
      anchor = parseAnchor(record.anchor, graphId, idempotency, limits);
    }

    const compactedEventCount = anchor?.snapshot.eventCount ?? 0;
    if (snapshot.eventCount !== compactedEventCount + events.length) {
      throw new TypeError('Persistence head eventCount must equal compacted prefix plus retained event tail');
    }
    if (anchor === null && compactedEventCount !== 0) {
      throw new TypeError('Persistence image without anchor cannot claim compacted history');
    }

    const replayAnchor: GraphReplayAnchorContext = anchor
      ? {
          graph: anchor.snapshot.graph,
          lastEventHash: anchor.snapshot.lastEventHash,
          eventCount: anchor.snapshot.eventCount,
          lastRecordedAt: anchor.lastRecordedAt,
        }
      : {
          graph: createGraphDocument({ graphId }, limits),
          lastEventHash: null,
          eventCount: 0,
          lastRecordedAt: null,
        };
    const replay = replayGraphEventsFromAnchor(graphId, events, replayAnchor, limits);
    if (
      replay.stateHash !== snapshot.stateHash
      || replay.lastEventHash !== snapshot.lastEventHash
      || replay.eventCount !== snapshot.eventCount
      || graphDocumentHash(replay.graph) !== graphDocumentHash(snapshot.graph)
    ) {
      throw new TypeError('Persistence snapshot is not equivalent to anchored deterministic event replay');
    }

    if (idempotencyByKey.size !== snapshot.eventCount) {
      throw new TypeError('Persistence idempotency authority cardinality changed during validation');
    }

    return Object.freeze({
      schema: COS_GRAPH_PERSISTENCE_IMAGE_VERSION,
      graphId,
      storageVersion,
      snapshot,
      anchor,
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

function persistedRecordFromEvent(event: GraphEvent): GraphPersistedIdempotencyRecord {
  return Object.freeze({
    idempotencyKey: event.idempotencyKey,
    requestHash: event.requestHash,
    receipt: receiptFromEvent(event),
  });
}

function hydrateImage(
  image: GraphPersistenceImage,
  limits: GraphModelLimits,
): HydratedGraphAuthority {
  const replayAnchor: GraphReplayAnchorContext = image.anchor
    ? {
        graph: image.anchor.snapshot.graph,
        lastEventHash: image.anchor.snapshot.lastEventHash,
        eventCount: image.anchor.snapshot.eventCount,
        lastRecordedAt: image.anchor.lastRecordedAt,
      }
    : {
        graph: createGraphDocument({ graphId: image.graphId }, limits),
        lastEventHash: null,
        eventCount: 0,
        lastRecordedAt: null,
      };
  const replay = replayGraphEventsFromAnchor(image.graphId, image.events, replayAnchor, limits);
  const idempotencyByKey = new Map<string, GraphPersistedIdempotencyRecord>();
  for (const record of image.idempotency) idempotencyByKey.set(record.idempotencyKey, record);
  const lastRecordedAt = image.events.at(-1)?.recordedAt ?? image.anchor?.lastRecordedAt ?? null;
  return Object.freeze({ image, replay, idempotencyByKey, lastRecordedAt });
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
    const hydrated = await this.require(graphId);
    return hydrated.image.snapshot.graph;
  }

  /** Returns the physically retained event tail. Use history() to inspect compaction coverage. */
  async events(graphId: string): Promise<readonly GraphEvent[]> {
    const hydrated = await this.require(graphId);
    return hydrated.image.events;
  }

  async history(graphId: string): Promise<GraphDurableHistory> {
    const hydrated = await this.require(graphId);
    return Object.freeze({
      graphId,
      graphRevision: hydrated.image.snapshot.graph.revision,
      eventCount: hydrated.image.snapshot.eventCount,
      storageVersion: hydrated.image.storageVersion,
      compactedEventCount: hydrated.image.anchor?.snapshot.eventCount ?? 0,
      retainedEvents: hydrated.image.events,
      anchor: hydrated.image.anchor,
    });
  }

  async snapshot(graphId: string): Promise<GraphSnapshot> {
    const hydrated = await this.require(graphId);
    return hydrated.image.snapshot;
  }

  async verify(graphId: string): Promise<GraphReplayResult> {
    const hydrated = await this.require(graphId);
    return hydrated.replay;
  }

  async commit(transaction: GraphTransaction): Promise<GraphCommitReceipt> {
    const stableTransaction: GraphTransaction = Object.freeze({
      ...transaction,
      recordedAt: transaction.recordedAt ?? this.clock(),
    });
    const prepared = prepareGraphTransaction(stableTransaction, this.limits);

    for (let attempt = 1; attempt <= this.maxCommitAttempts; attempt += 1) {
      const hydrated = await this.load(prepared.graphId);
      const prior = hydrated?.idempotencyByKey.get(prepared.idempotencyKey);
      if (prior) {
        if (prior.requestHash !== prepared.requestHash) {
          throw new GraphStateError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key was reused with a different graph mutation payload',
            {
              graphId: prepared.graphId,
              idempotencyKey: prepared.idempotencyKey,
              priorRequestHash: prior.requestHash,
              requestHash: prepared.requestHash,
            },
          );
        }
        return cloneReceipt(prior.receipt, true);
      }

      const current = hydrated?.image.snapshot.graph
        ?? createGraphDocument({ graphId: prepared.graphId }, this.limits);
      const materialized = materializeGraphCommit(
        current,
        prepared,
        {
          previousEventHash: hydrated?.image.snapshot.lastEventHash ?? null,
          previousRecordedAt: hydrated?.lastRecordedAt ?? null,
          clock: this.clock,
        },
        this.limits,
      );
      const snapshot: GraphSnapshot = Object.freeze({
        schema: COS_GRAPH_SNAPSHOT_VERSION,
        graph: materialized.graph,
        stateHash: graphDocumentHash(materialized.graph),
        lastEventHash: materialized.event.eventHash,
        eventCount: materialized.event.revision,
      });
      const result = await this.compareAndSwap({
        graphId: prepared.graphId,
        expectedStorageVersion: hydrated?.image.storageVersion ?? 0,
        event: materialized.event,
        snapshot,
        idempotency: persistedRecordFromEvent(materialized.event),
      });
      if (result.status === 'committed') {
        const expectedStorageVersion = (hydrated?.image.storageVersion ?? 0) + 1;
        if (result.storageVersion !== expectedStorageVersion) {
          throw new GraphDurabilityError(
            'DURABILITY_DRIVER_PROTOCOL_INVALID',
            `Driver returned storageVersion ${result.storageVersion}; expected ${expectedStorageVersion}`,
            { graphId: prepared.graphId, attempt },
          );
        }
        return materialized.receipt;
      }
    }

    throw new GraphDurabilityError(
      'DURABILITY_CAS_RETRY_EXHAUSTED',
      `Durable graph commit exhausted ${this.maxCommitAttempts} compare-and-swap attempts`,
      { graphId: prepared.graphId, maxCommitAttempts: this.maxCommitAttempts },
    );
  }

  /** Compact every currently retained event into a new verified head anchor. */
  async compact(graphId: string): Promise<GraphCompactionReceipt> {
    if (!this.driver.compact) {
      throw new GraphDurabilityError(
        'DURABILITY_COMPACTION_UNSUPPORTED',
        'Configured graph durability driver does not implement compaction',
        { graphId },
      );
    }

    for (let attempt = 1; attempt <= this.maxCommitAttempts; attempt += 1) {
      const hydrated = await this.require(graphId);
      const image = hydrated.image;
      if (image.events.length === 0 && image.anchor?.snapshot.eventCount === image.snapshot.eventCount) {
        return Object.freeze({
          graphId,
          graphRevision: image.snapshot.graph.revision,
          eventCount: image.snapshot.eventCount,
          storageVersion: image.storageVersion,
          prunedEvents: 0,
          retainedEvents: 0,
          anchorHash: image.anchor.anchorHash,
          idempotencyCount: image.idempotency.length,
          noOp: true,
        });
      }
      if (hydrated.lastRecordedAt === null) {
        throw new GraphDurabilityError(
          'DURABILITY_IMAGE_INVALID',
          'Non-empty durable graph has no lastRecordedAt for compaction anchor',
          { graphId, eventCount: image.snapshot.eventCount },
        );
      }

      const anchor = createGraphPersistenceAnchor(
        image.snapshot,
        hydrated.lastRecordedAt,
        image.idempotency,
        this.limits,
      );
      const result = await this.compactCompareAndSwap({
        graphId,
        expectedStorageVersion: image.storageVersion,
        anchor,
      });
      if (result.status === 'compacted') {
        const expectedStorageVersion = image.storageVersion + 1;
        if (result.storageVersion !== expectedStorageVersion || result.prunedEvents !== image.events.length) {
          throw new GraphDurabilityError(
            'DURABILITY_DRIVER_PROTOCOL_INVALID',
            'Durability driver returned an invalid compaction result',
            {
              graphId,
              expectedStorageVersion,
              actualStorageVersion: result.storageVersion,
              expectedPrunedEvents: image.events.length,
              actualPrunedEvents: result.prunedEvents,
            },
          );
        }
        return Object.freeze({
          graphId,
          graphRevision: image.snapshot.graph.revision,
          eventCount: image.snapshot.eventCount,
          storageVersion: result.storageVersion,
          prunedEvents: result.prunedEvents,
          retainedEvents: 0,
          anchorHash: anchor.anchorHash,
          idempotencyCount: image.idempotency.length,
          noOp: false,
        });
      }
    }

    throw new GraphDurabilityError(
      'DURABILITY_CAS_RETRY_EXHAUSTED',
      `Graph compaction exhausted ${this.maxCommitAttempts} compare-and-swap attempts`,
      { graphId, maxCommitAttempts: this.maxCommitAttempts },
    );
  }

  async close(): Promise<void> {
    await this.driver.close?.();
  }

  private async require(graphId: string): Promise<HydratedGraphAuthority> {
    const hydrated = await this.load(graphId);
    if (!hydrated) throw new GraphStateError('GRAPH_NOT_FOUND', `Graph ${graphId} does not exist`, { graphId });
    return hydrated;
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
    return hydrateImage(parseGraphPersistenceImage(raw, graphId, this.limits), this.limits);
  }

  private async compareAndSwap(
    commit: GraphPersistenceCommit,
  ): Promise<GraphPersistenceCompareAndSwapResult> {
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
    if (
      result.status === 'committed'
      && Number.isSafeInteger(result.storageVersion)
      && result.storageVersion >= 1
    ) return result;
    throw new GraphDurabilityError(
      'DURABILITY_DRIVER_PROTOCOL_INVALID',
      'Durability driver returned an invalid compare-and-swap result',
      { graphId: commit.graphId },
    );
  }

  private async compactCompareAndSwap(
    compaction: GraphPersistenceCompaction,
  ): Promise<GraphPersistenceCompactionResult> {
    const compact = this.driver.compact;
    if (!compact) {
      throw new GraphDurabilityError(
        'DURABILITY_COMPACTION_UNSUPPORTED',
        'Configured graph durability driver does not implement compaction',
        { graphId: compaction.graphId },
      );
    }
    let result: GraphPersistenceCompactionResult;
    try {
      result = await compact.call(this.driver, compaction);
    } catch (error: unknown) {
      throw new GraphDurabilityError(
        'DURABILITY_DRIVER_FAILURE',
        `Durability driver failed while compacting graph ${compaction.graphId}`,
        { graphId: compaction.graphId, expectedStorageVersion: compaction.expectedStorageVersion },
        { cause: error },
      );
    }
    if (result.status === 'conflict') return result;
    if (
      result.status === 'compacted'
      && Number.isSafeInteger(result.storageVersion)
      && result.storageVersion >= 1
      && Number.isSafeInteger(result.prunedEvents)
      && result.prunedEvents >= 0
    ) return result;
    throw new GraphDurabilityError(
      'DURABILITY_DRIVER_PROTOCOL_INVALID',
      'Durability driver returned an invalid compaction result',
      { graphId: compaction.graphId },
    );
  }
}
