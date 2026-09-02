import {
  CanonicalGraphDocument,
  CanonicalGraphEdge,
  CanonicalGraphNode,
  GraphEdgeInput,
  GraphModelLimits,
  GraphNodeInput,
  GraphProperties,
  DEFAULT_GRAPH_MODEL_LIMITS,
  canonicalGraphHash,
  createGraphDocument,
  graphDocumentHash,
  normalizeGraphEdge,
  normalizeGraphNode,
  normalizeGraphProperties,
} from './model';

export const COS_GRAPH_EVENT_VERSION = 'cos.graph/event/v1alpha1' as const;
export const COS_GRAPH_SNAPSHOT_VERSION = 'cos.graph/snapshot/v1alpha1' as const;

export type GraphMutation =
  | { readonly type: 'node.put'; readonly node: GraphNodeInput }
  | { readonly type: 'node.remove'; readonly nodeId: string; readonly cascade?: boolean }
  | { readonly type: 'edge.put'; readonly edge: GraphEdgeInput }
  | { readonly type: 'edge.remove'; readonly edgeId: string }
  | { readonly type: 'metadata.merge'; readonly metadata: Readonly<Record<string, unknown>> };

export type CanonicalGraphMutation =
  | { readonly type: 'node.put'; readonly node: CanonicalGraphNode }
  | { readonly type: 'node.remove'; readonly nodeId: string; readonly cascade: boolean }
  | { readonly type: 'edge.put'; readonly edge: CanonicalGraphEdge }
  | { readonly type: 'edge.remove'; readonly edgeId: string }
  | { readonly type: 'metadata.merge'; readonly metadata: GraphProperties };

export interface GraphTransaction {
  readonly graphId: string;
  readonly expectedRevision: number;
  readonly mutations: readonly GraphMutation[];
  readonly idempotencyKey: string;
  readonly operationId?: string;
  readonly recordedAt?: number;
}

export interface PreparedGraphTransaction {
  readonly graphId: string;
  readonly expectedRevision: number;
  readonly mutations: readonly CanonicalGraphMutation[];
  readonly idempotencyKey: string;
  readonly operationId?: string;
  readonly recordedAt?: number;
  readonly requestHash: string;
}

export interface GraphEvent {
  readonly schema: typeof COS_GRAPH_EVENT_VERSION;
  readonly eventId: string;
  readonly graphId: string;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly baseRevision: number;
  readonly revision: number;
  readonly recordedAt: number;
  readonly requestHash: string;
  readonly previousEventHash: string | null;
  readonly beforeStateHash: string;
  readonly afterStateHash: string;
  readonly mutations: readonly CanonicalGraphMutation[];
  readonly eventHash: string;
}

export interface GraphCommitReceipt {
  readonly graphId: string;
  readonly revision: number;
  readonly eventId: string;
  readonly eventHash: string;
  readonly stateHash: string;
  readonly requestHash: string;
  readonly idempotentReplay: boolean;
}

export interface GraphSnapshot {
  readonly schema: typeof COS_GRAPH_SNAPSHOT_VERSION;
  readonly graph: CanonicalGraphDocument;
  readonly stateHash: string;
  readonly lastEventHash: string | null;
  readonly eventCount: number;
}

export interface GraphReplayResult {
  readonly graph: CanonicalGraphDocument;
  readonly stateHash: string;
  readonly lastEventHash: string | null;
  readonly eventCount: number;
}

export interface GraphReplayAnchorContext {
  readonly graph: CanonicalGraphDocument;
  readonly lastEventHash: string | null;
  readonly eventCount: number;
  readonly lastRecordedAt: number | null;
}

export interface MaterializedGraphCommit {
  readonly graph: CanonicalGraphDocument;
  readonly event: GraphEvent;
  readonly receipt: GraphCommitReceipt;
}

export interface GraphCommitHistoryContext {
  readonly previousEventHash: string | null;
  readonly previousRecordedAt: number | null;
  readonly clock?: () => number;
}

export type GraphStateErrorCode =
  | 'GRAPH_NOT_FOUND'
  | 'INVALID_TRANSACTION'
  | 'INVALID_MUTATION'
  | 'REVISION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'EMPTY_TRANSACTION'
  | 'NODE_NOT_FOUND'
  | 'EDGE_NOT_FOUND'
  | 'NODE_HAS_EDGES'
  | 'EVENT_CHAIN_INVALID'
  | 'EVENT_HASH_INVALID'
  | 'EVENT_STATE_HASH_INVALID'
  | 'EVENT_REVISION_INVALID'
  | 'EVENT_TIME_REGRESSION';

export class GraphStateError extends Error {
  readonly code: GraphStateErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: GraphStateErrorCode, message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = 'GraphStateError';
    this.code = code;
    this.details = details;
  }
}

interface IdempotencyRecord {
  readonly requestHash: string;
  readonly receipt: GraphCommitReceipt;
}

interface GraphRecord {
  graph: CanonicalGraphDocument;
  events: GraphEvent[];
  idempotency: Map<string, IdempotencyRecord>;
}

export interface InMemoryGraphStoreOptions {
  readonly clock?: () => number;
  readonly limits?: GraphModelLimits;
}

function normalizeMutation(mutation: GraphMutation, limits: GraphModelLimits): CanonicalGraphMutation {
  if (typeof mutation !== 'object' || mutation === null) {
    throw new GraphStateError('INVALID_MUTATION', 'Graph mutation must be an object');
  }
  switch (mutation.type) {
    case 'node.put':
      return Object.freeze({ type: 'node.put', node: normalizeGraphNode(mutation.node, limits) });
    case 'node.remove':
      if (typeof mutation.nodeId !== 'string' || mutation.nodeId.length === 0) {
        throw new GraphStateError('INVALID_MUTATION', 'node.remove requires a non-empty nodeId');
      }
      return Object.freeze({ type: 'node.remove', nodeId: mutation.nodeId, cascade: mutation.cascade ?? false });
    case 'edge.put':
      return Object.freeze({ type: 'edge.put', edge: normalizeGraphEdge(mutation.edge, limits) });
    case 'edge.remove':
      if (typeof mutation.edgeId !== 'string' || mutation.edgeId.length === 0) {
        throw new GraphStateError('INVALID_MUTATION', 'edge.remove requires a non-empty edgeId');
      }
      return Object.freeze({ type: 'edge.remove', edgeId: mutation.edgeId });
    case 'metadata.merge':
      return Object.freeze({ type: 'metadata.merge', metadata: normalizeGraphProperties(mutation.metadata, limits) });
    default:
      throw new GraphStateError(
        'INVALID_MUTATION',
        `Unsupported graph mutation type: ${String((mutation as { readonly type?: unknown }).type)}`,
      );
  }
}

export function canonicalizeGraphMutations(
  mutations: readonly GraphMutation[],
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): readonly CanonicalGraphMutation[] {
  if (!Array.isArray(mutations)) {
    throw new GraphStateError('INVALID_TRANSACTION', 'Graph transaction mutations must be an array');
  }
  if (mutations.length === 0) {
    throw new GraphStateError('EMPTY_TRANSACTION', 'Graph transaction must contain at least one mutation');
  }
  return Object.freeze(mutations.map((mutation) => normalizeMutation(mutation, limits)));
}

export function applyCanonicalGraphMutations(
  document: CanonicalGraphDocument,
  mutations: readonly CanonicalGraphMutation[],
  revision: number,
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): CanonicalGraphDocument {
  const nodes = new Map(document.nodes.map((node) => [node.id, node]));
  const edges = new Map(document.edges.map((edge) => [edge.id, edge]));
  let metadata = document.metadata;

  for (const mutation of mutations) {
    switch (mutation.type) {
      case 'node.put':
        nodes.set(mutation.node.id, mutation.node);
        break;
      case 'node.remove': {
        if (!nodes.has(mutation.nodeId)) {
          throw new GraphStateError('NODE_NOT_FOUND', `Cannot remove missing node ${mutation.nodeId}`, {
            nodeId: mutation.nodeId,
          });
        }
        const incident = Array.from(edges.values()).filter(
          (edge) => edge.source === mutation.nodeId || edge.target === mutation.nodeId,
        );
        if (incident.length > 0 && !mutation.cascade) {
          throw new GraphStateError(
            'NODE_HAS_EDGES',
            `Cannot remove node ${mutation.nodeId} while incident edges exist`,
            { nodeId: mutation.nodeId, incidentEdgeIds: incident.map((edge) => edge.id) },
          );
        }
        if (mutation.cascade) {
          for (const edge of incident) edges.delete(edge.id);
        }
        nodes.delete(mutation.nodeId);
        break;
      }
      case 'edge.put':
        edges.set(mutation.edge.id, mutation.edge);
        break;
      case 'edge.remove':
        if (!edges.has(mutation.edgeId)) {
          throw new GraphStateError('EDGE_NOT_FOUND', `Cannot remove missing edge ${mutation.edgeId}`, {
            edgeId: mutation.edgeId,
          });
        }
        edges.delete(mutation.edgeId);
        break;
      case 'metadata.merge':
        metadata = normalizeGraphProperties({ ...metadata, ...mutation.metadata }, limits);
        break;
    }
  }

  return createGraphDocument({
    graphId: document.graphId,
    revision,
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
    metadata,
  }, limits);
}

export function graphEventPayload(event: Omit<GraphEvent, 'eventHash'>): Readonly<Record<string, unknown>> {
  return {
    schema: event.schema,
    eventId: event.eventId,
    graphId: event.graphId,
    operationId: event.operationId,
    idempotencyKey: event.idempotencyKey,
    baseRevision: event.baseRevision,
    revision: event.revision,
    recordedAt: event.recordedAt,
    requestHash: event.requestHash,
    previousEventHash: event.previousEventHash,
    beforeStateHash: event.beforeStateHash,
    afterStateHash: event.afterStateHash,
    mutations: event.mutations,
  };
}

function freezeEvent(event: GraphEvent): GraphEvent {
  return Object.freeze({ ...event, mutations: Object.freeze([...event.mutations]) });
}

function cloneReceipt(receipt: GraphCommitReceipt, idempotentReplay: boolean): GraphCommitReceipt {
  return Object.freeze({ ...receipt, idempotentReplay });
}

export function prepareGraphTransaction(
  transaction: GraphTransaction,
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): PreparedGraphTransaction {
  if (typeof transaction !== 'object' || transaction === null) {
    throw new GraphStateError('INVALID_TRANSACTION', 'Graph transaction must be an object');
  }
  if (typeof transaction.graphId !== 'string' || transaction.graphId.length === 0) {
    throw new GraphStateError('INVALID_TRANSACTION', 'Graph transaction graphId must be a non-empty string');
  }
  if (!Number.isSafeInteger(transaction.expectedRevision) || transaction.expectedRevision < 0) {
    throw new GraphStateError(
      'INVALID_TRANSACTION',
      'Graph transaction expectedRevision must be a non-negative safe integer',
      { expectedRevision: transaction.expectedRevision },
    );
  }
  if (typeof transaction.idempotencyKey !== 'string' || transaction.idempotencyKey.length === 0) {
    throw new GraphStateError('INVALID_TRANSACTION', 'Graph transaction idempotencyKey must be a non-empty string');
  }
  if (
    transaction.operationId !== undefined
    && (typeof transaction.operationId !== 'string' || transaction.operationId.length === 0)
  ) {
    throw new GraphStateError('INVALID_TRANSACTION', 'Graph transaction operationId must be a non-empty string when provided');
  }
  if (transaction.recordedAt !== undefined && !Number.isFinite(transaction.recordedAt)) {
    throw new GraphStateError('EVENT_TIME_REGRESSION', 'Graph event time must be finite', {
      graphId: transaction.graphId,
      recordedAt: transaction.recordedAt,
    });
  }

  const mutations = canonicalizeGraphMutations(transaction.mutations, limits);
  const requestHash = canonicalGraphHash({ graphId: transaction.graphId, mutations }, limits);
  return Object.freeze({
    graphId: transaction.graphId,
    expectedRevision: transaction.expectedRevision,
    mutations,
    idempotencyKey: transaction.idempotencyKey,
    ...(transaction.operationId !== undefined ? { operationId: transaction.operationId } : {}),
    ...(transaction.recordedAt !== undefined ? { recordedAt: transaction.recordedAt } : {}),
    requestHash,
  });
}

export function materializeGraphCommit(
  current: CanonicalGraphDocument,
  transaction: PreparedGraphTransaction,
  context: GraphCommitHistoryContext,
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): MaterializedGraphCommit {
  if (current.graphId !== transaction.graphId) {
    throw new GraphStateError('INVALID_TRANSACTION', 'Prepared transaction graphId does not match current graph', {
      currentGraphId: current.graphId,
      transactionGraphId: transaction.graphId,
    });
  }
  if (transaction.expectedRevision !== current.revision) {
    throw new GraphStateError('REVISION_CONFLICT', 'Graph expected revision does not match current revision', {
      graphId: transaction.graphId,
      expectedRevision: transaction.expectedRevision,
      currentRevision: current.revision,
    });
  }

  const recordedAt = transaction.recordedAt ?? (context.clock ?? Date.now)();
  if (
    !Number.isFinite(recordedAt)
    || (context.previousRecordedAt !== null && recordedAt < context.previousRecordedAt)
  ) {
    throw new GraphStateError('EVENT_TIME_REGRESSION', 'Graph event time must be finite and monotonic', {
      graphId: transaction.graphId,
      previousRecordedAt: context.previousRecordedAt,
      recordedAt,
    });
  }

  const revision = current.revision + 1;
  const next = applyCanonicalGraphMutations(current, transaction.mutations, revision, limits);
  const beforeStateHash = graphDocumentHash(current);
  const afterStateHash = graphDocumentHash(next);
  const operationId = transaction.operationId ?? `graph-op-${transaction.requestHash.slice(0, 16)}`;
  const eventId = `ge_${canonicalGraphHash({
    graphId: transaction.graphId,
    revision,
    operationId,
    idempotencyKey: transaction.idempotencyKey,
    requestHash: transaction.requestHash,
  }, limits).slice(0, 32)}`;

  const eventWithoutHash: Omit<GraphEvent, 'eventHash'> = {
    schema: COS_GRAPH_EVENT_VERSION,
    eventId,
    graphId: transaction.graphId,
    operationId,
    idempotencyKey: transaction.idempotencyKey,
    baseRevision: current.revision,
    revision,
    recordedAt,
    requestHash: transaction.requestHash,
    previousEventHash: context.previousEventHash,
    beforeStateHash,
    afterStateHash,
    mutations: transaction.mutations,
  };
  const event = freezeEvent({
    ...eventWithoutHash,
    eventHash: canonicalGraphHash(graphEventPayload(eventWithoutHash), limits),
  });
  const receipt: GraphCommitReceipt = Object.freeze({
    graphId: transaction.graphId,
    revision,
    eventId: event.eventId,
    eventHash: event.eventHash,
    stateHash: afterStateHash,
    requestHash: transaction.requestHash,
    idempotentReplay: false,
  });
  return Object.freeze({ graph: next, event, receipt });
}

function validateReplayAnchor(
  graphId: string,
  anchor: GraphReplayAnchorContext,
): void {
  if (anchor.graph.graphId !== graphId) {
    throw new GraphStateError('EVENT_CHAIN_INVALID', 'Replay anchor belongs to another graph', {
      graphId,
      anchorGraphId: anchor.graph.graphId,
    });
  }
  if (!Number.isSafeInteger(anchor.eventCount) || anchor.eventCount < 0 || anchor.eventCount !== anchor.graph.revision) {
    throw new GraphStateError('EVENT_REVISION_INVALID', 'Replay anchor eventCount must equal graph revision', {
      graphId,
      eventCount: anchor.eventCount,
      graphRevision: anchor.graph.revision,
    });
  }
  if (anchor.eventCount === 0) {
    if (anchor.lastEventHash !== null || anchor.lastRecordedAt !== null) {
      throw new GraphStateError('EVENT_CHAIN_INVALID', 'Empty replay anchor cannot contain event history markers', {
        graphId,
      });
    }
    return;
  }
  if (typeof anchor.lastEventHash !== 'string' || anchor.lastEventHash.length === 0) {
    throw new GraphStateError('EVENT_CHAIN_INVALID', 'Non-empty replay anchor requires lastEventHash', { graphId });
  }
  if (anchor.lastRecordedAt === null || !Number.isFinite(anchor.lastRecordedAt)) {
    throw new GraphStateError('EVENT_TIME_REGRESSION', 'Non-empty replay anchor requires finite lastRecordedAt', {
      graphId,
      lastRecordedAt: anchor.lastRecordedAt,
    });
  }
}

export function replayGraphEventsFromAnchor(
  graphId: string,
  events: readonly GraphEvent[],
  anchor: GraphReplayAnchorContext,
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): GraphReplayResult {
  validateReplayAnchor(graphId, anchor);
  let graph = anchor.graph;
  let previousEventHash = anchor.lastEventHash;
  let previousRecordedAt = anchor.lastRecordedAt ?? Number.NEGATIVE_INFINITY;

  for (const event of events) {
    if (event.schema !== COS_GRAPH_EVENT_VERSION || event.graphId !== graphId) {
      throw new GraphStateError('EVENT_CHAIN_INVALID', 'Event does not belong to the requested graph or schema', {
        eventId: event.eventId,
        graphId: event.graphId,
        schema: event.schema,
      });
    }
    if (event.baseRevision !== graph.revision || event.revision !== graph.revision + 1) {
      throw new GraphStateError('EVENT_REVISION_INVALID', 'Event revision sequence is invalid', {
        eventId: event.eventId,
        expectedBaseRevision: graph.revision,
        actualBaseRevision: event.baseRevision,
        actualRevision: event.revision,
      });
    }
    if (event.previousEventHash !== previousEventHash) {
      throw new GraphStateError('EVENT_CHAIN_INVALID', 'Event previous hash does not match the replay chain', {
        eventId: event.eventId,
        expectedPreviousEventHash: previousEventHash,
        actualPreviousEventHash: event.previousEventHash,
      });
    }
    if (!Number.isFinite(event.recordedAt) || event.recordedAt < previousRecordedAt) {
      throw new GraphStateError('EVENT_TIME_REGRESSION', 'Event recordedAt must be finite and monotonic', {
        eventId: event.eventId,
        previousRecordedAt,
        recordedAt: event.recordedAt,
      });
    }

    const requestHash = canonicalGraphHash({ graphId, mutations: event.mutations }, limits);
    if (requestHash !== event.requestHash) {
      throw new GraphStateError('EVENT_HASH_INVALID', 'Event request hash does not match its mutation payload', {
        eventId: event.eventId,
      });
    }

    const beforeStateHash = graphDocumentHash(graph);
    if (beforeStateHash !== event.beforeStateHash) {
      throw new GraphStateError('EVENT_STATE_HASH_INVALID', 'Event before-state hash does not match replay state', {
        eventId: event.eventId,
        expected: beforeStateHash,
        actual: event.beforeStateHash,
      });
    }

    const eventWithoutHash: Omit<GraphEvent, 'eventHash'> = {
      schema: event.schema,
      eventId: event.eventId,
      graphId: event.graphId,
      operationId: event.operationId,
      idempotencyKey: event.idempotencyKey,
      baseRevision: event.baseRevision,
      revision: event.revision,
      recordedAt: event.recordedAt,
      requestHash: event.requestHash,
      previousEventHash: event.previousEventHash,
      beforeStateHash: event.beforeStateHash,
      afterStateHash: event.afterStateHash,
      mutations: event.mutations,
    };
    const eventHash = canonicalGraphHash(graphEventPayload(eventWithoutHash), limits);
    if (eventHash !== event.eventHash) {
      throw new GraphStateError('EVENT_HASH_INVALID', 'Event hash does not match its canonical envelope', {
        eventId: event.eventId,
      });
    }

    graph = applyCanonicalGraphMutations(graph, event.mutations, event.revision, limits);
    const afterStateHash = graphDocumentHash(graph);
    if (afterStateHash !== event.afterStateHash) {
      throw new GraphStateError('EVENT_STATE_HASH_INVALID', 'Event after-state hash does not match replay state', {
        eventId: event.eventId,
        expected: afterStateHash,
        actual: event.afterStateHash,
      });
    }

    previousEventHash = event.eventHash;
    previousRecordedAt = event.recordedAt;
  }

  return Object.freeze({
    graph,
    stateHash: graphDocumentHash(graph),
    lastEventHash: previousEventHash,
    eventCount: anchor.eventCount + events.length,
  });
}

export function replayGraphEvents(
  graphId: string,
  events: readonly GraphEvent[],
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): GraphReplayResult {
  return replayGraphEventsFromAnchor(
    graphId,
    events,
    {
      graph: createGraphDocument({ graphId }, limits),
      lastEventHash: null,
      eventCount: 0,
      lastRecordedAt: null,
    },
    limits,
  );
}

export class InMemoryGraphStore {
  private readonly records = new Map<string, GraphRecord>();
  private readonly clock: () => number;
  private readonly limits: GraphModelLimits;

  constructor(options: InMemoryGraphStoreOptions = {}) {
    this.clock = options.clock ?? Date.now;
    this.limits = options.limits ?? DEFAULT_GRAPH_MODEL_LIMITS;
  }

  has(graphId: string): boolean {
    return this.records.has(graphId);
  }

  get(graphId: string): CanonicalGraphDocument {
    const record = this.records.get(graphId);
    if (!record) throw new GraphStateError('GRAPH_NOT_FOUND', `Graph ${graphId} does not exist`, { graphId });
    return record.graph;
  }

  events(graphId: string): readonly GraphEvent[] {
    const record = this.records.get(graphId);
    if (!record) throw new GraphStateError('GRAPH_NOT_FOUND', `Graph ${graphId} does not exist`, { graphId });
    return Object.freeze([...record.events]);
  }

  snapshot(graphId: string): GraphSnapshot {
    const record = this.records.get(graphId);
    if (!record) throw new GraphStateError('GRAPH_NOT_FOUND', `Graph ${graphId} does not exist`, { graphId });
    return Object.freeze({
      schema: COS_GRAPH_SNAPSHOT_VERSION,
      graph: record.graph,
      stateHash: graphDocumentHash(record.graph),
      lastEventHash: record.events.at(-1)?.eventHash ?? null,
      eventCount: record.events.length,
    });
  }

  commit(transaction: GraphTransaction): GraphCommitReceipt {
    const prepared = prepareGraphTransaction(transaction, this.limits);
    let record = this.records.get(prepared.graphId);

    if (record) {
      const prior = record.idempotency.get(prepared.idempotencyKey);
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
    }

    const current = record?.graph ?? createGraphDocument({ graphId: prepared.graphId }, this.limits);
    const previousEvent = record?.events.at(-1);
    const materialized = materializeGraphCommit(
      current,
      prepared,
      {
        previousEventHash: previousEvent?.eventHash ?? null,
        previousRecordedAt: previousEvent?.recordedAt ?? null,
        clock: this.clock,
      },
      this.limits,
    );

    if (!record) {
      record = { graph: current, events: [], idempotency: new Map() };
      this.records.set(prepared.graphId, record);
    }

    record.graph = materialized.graph;
    record.events.push(materialized.event);
    record.idempotency.set(
      prepared.idempotencyKey,
      Object.freeze({ requestHash: prepared.requestHash, receipt: materialized.receipt }),
    );
    return materialized.receipt;
  }

  verify(graphId: string): GraphReplayResult {
    const record = this.records.get(graphId);
    if (!record) throw new GraphStateError('GRAPH_NOT_FOUND', `Graph ${graphId} does not exist`, { graphId });
    const replay = replayGraphEvents(graphId, record.events, this.limits);
    const liveHash = graphDocumentHash(record.graph);
    if (replay.stateHash !== liveHash) {
      throw new GraphStateError(
        'EVENT_STATE_HASH_INVALID',
        'Replay result does not match the live graph projection',
        { graphId, liveHash, replayHash: replay.stateHash },
      );
    }
    return replay;
  }
}
