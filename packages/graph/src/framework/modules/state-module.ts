import {
  COS_GRAPH_PROTOCOL_VERSION,
  GraphCapability,
  GraphExecutionContext,
  GraphModule,
  GraphSchema,
  defineGraphCapability,
  defineGraphModule,
} from '../protocol';
import { graphDocumentHash, parseGraphDocument } from '../model';
import {
  GraphCommitReceipt,
  GraphMutation,
  GraphReplayResult,
  GraphSnapshot,
  GraphTransaction,
} from '../state-store';

export interface GraphStateCommitInput {
  readonly graphId: string;
  readonly expectedRevision: number;
  readonly mutations: readonly GraphMutation[];
}

export interface GraphStateReadInput {
  readonly graphId: string;
}

export interface GraphStateStorePort {
  commit(transaction: GraphTransaction): GraphCommitReceipt | Promise<GraphCommitReceipt>;
  snapshot(graphId: string): GraphSnapshot | Promise<GraphSnapshot>;
  verify(graphId: string): GraphReplayResult | Promise<GraphReplayResult>;
}

export interface GraphStateModuleOptions {
  readonly moduleId?: string;
  readonly name?: string;
  readonly version?: string;
  readonly description?: string;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asOptionalRecord(value: unknown, label: string): Readonly<Record<string, unknown>> | undefined {
  if (value === undefined) return undefined;
  return asRecord(value, label);
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function parseMutation(value: unknown): GraphMutation {
  const record = asRecord(value, 'mutation');
  switch (record.type) {
    case 'node.put': {
      const node = asRecord(record.node, 'node.put.node');
      const labelsValue = node.labels;
      if (labelsValue !== undefined && (!Array.isArray(labelsValue) || labelsValue.some((label) => typeof label !== 'string'))) {
        throw new TypeError('node.put.node.labels must be a string array');
      }
      return {
        type: 'node.put',
        node: {
          id: asString(node.id, 'node.put.node.id'),
          ...(node.type !== undefined ? { type: asString(node.type, 'node.put.node.type') } : {}),
          ...(labelsValue !== undefined ? { labels: labelsValue as readonly string[] } : {}),
          ...(node.properties !== undefined ? { properties: asOptionalRecord(node.properties, 'node.put.node.properties') } : {}),
        },
      };
    }
    case 'node.remove':
      if (record.cascade !== undefined && typeof record.cascade !== 'boolean') throw new TypeError('node.remove.cascade must be boolean');
      return {
        type: 'node.remove',
        nodeId: asString(record.nodeId, 'node.remove.nodeId'),
        ...(record.cascade !== undefined ? { cascade: record.cascade } : {}),
      };
    case 'edge.put': {
      const edge = asRecord(record.edge, 'edge.put.edge');
      if (edge.directed !== undefined && typeof edge.directed !== 'boolean') throw new TypeError('edge.put.edge.directed must be boolean');
      return {
        type: 'edge.put',
        edge: {
          ...(edge.id !== undefined ? { id: asString(edge.id, 'edge.put.edge.id') } : {}),
          ...(edge.identityKey !== undefined ? { identityKey: asString(edge.identityKey, 'edge.put.edge.identityKey') } : {}),
          source: asString(edge.source, 'edge.put.edge.source'),
          target: asString(edge.target, 'edge.put.edge.target'),
          ...(edge.type !== undefined ? { type: asString(edge.type, 'edge.put.edge.type') } : {}),
          ...(edge.directed !== undefined ? { directed: edge.directed } : {}),
          ...(edge.properties !== undefined ? { properties: asOptionalRecord(edge.properties, 'edge.put.edge.properties') } : {}),
        },
      };
    }
    case 'edge.remove':
      return { type: 'edge.remove', edgeId: asString(record.edgeId, 'edge.remove.edgeId') };
    case 'metadata.merge':
      return { type: 'metadata.merge', metadata: asRecord(record.metadata, 'metadata.merge.metadata') };
    default:
      throw new TypeError(`Unsupported graph mutation type: ${String(record.type)}`);
  }
}

const commitInputSchema: GraphSchema<GraphStateCommitInput> = {
  parse(value: unknown): GraphStateCommitInput {
    const record = asRecord(value, 'graph state commit input');
    if (!Number.isSafeInteger(record.expectedRevision) || (record.expectedRevision as number) < 0) {
      throw new TypeError('expectedRevision must be a non-negative safe integer');
    }
    if (!Array.isArray(record.mutations)) throw new TypeError('mutations must be an array');
    return Object.freeze({
      graphId: asString(record.graphId, 'graphId'),
      expectedRevision: record.expectedRevision as number,
      mutations: Object.freeze(record.mutations.map(parseMutation)),
    });
  },
};

const readInputSchema: GraphSchema<GraphStateReadInput> = {
  parse(value: unknown): GraphStateReadInput {
    const record = asRecord(value, 'graph state read input');
    return Object.freeze({ graphId: asString(record.graphId, 'graphId') });
  },
};

function commitReceiptSchema(): GraphSchema<GraphCommitReceipt> {
  return {
    parse(value: unknown): GraphCommitReceipt {
      const record = asRecord(value, 'graph commit receipt');
      const revision = record.revision;
      if (!Number.isSafeInteger(revision) || (revision as number) < 1) throw new TypeError('receipt revision must be a positive safe integer');
      if (typeof record.idempotentReplay !== 'boolean') throw new TypeError('receipt idempotentReplay must be boolean');
      return Object.freeze({
        graphId: asString(record.graphId, 'receipt.graphId'),
        revision: revision as number,
        eventId: asString(record.eventId, 'receipt.eventId'),
        eventHash: asString(record.eventHash, 'receipt.eventHash'),
        stateHash: asString(record.stateHash, 'receipt.stateHash'),
        requestHash: asString(record.requestHash, 'receipt.requestHash'),
        idempotentReplay: record.idempotentReplay,
      });
    },
  };
}

const snapshotSchema: GraphSchema<GraphSnapshot> = {
  parse(value: unknown): GraphSnapshot {
    const record = asRecord(value, 'graph snapshot');
    if (record.schema !== 'cos.graph/snapshot/v1alpha1') throw new TypeError('Unsupported graph snapshot schema');
    const graph = parseGraphDocument(record.graph);
    const eventCount = record.eventCount;
    if (!Number.isSafeInteger(eventCount) || (eventCount as number) < 0) throw new TypeError('snapshot eventCount must be a non-negative safe integer');
    const lastEventHash = record.lastEventHash;
    if (lastEventHash !== null && typeof lastEventHash !== 'string') throw new TypeError('snapshot lastEventHash must be a string or null');
    const stateHash = asString(record.stateHash, 'snapshot.stateHash');
    if (stateHash !== graphDocumentHash(graph)) throw new TypeError('snapshot stateHash does not match graph content');
    return Object.freeze({
      schema: 'cos.graph/snapshot/v1alpha1',
      graph,
      stateHash,
      lastEventHash,
      eventCount: eventCount as number,
    });
  },
};

const replayResultSchema: GraphSchema<GraphReplayResult> = {
  parse(value: unknown): GraphReplayResult {
    const record = asRecord(value, 'graph replay result');
    const graph = parseGraphDocument(record.graph);
    const eventCount = record.eventCount;
    if (!Number.isSafeInteger(eventCount) || (eventCount as number) < 0) throw new TypeError('replay eventCount must be a non-negative safe integer');
    const lastEventHash = record.lastEventHash;
    if (lastEventHash !== null && typeof lastEventHash !== 'string') throw new TypeError('replay lastEventHash must be a string or null');
    const stateHash = asString(record.stateHash, 'replay.stateHash');
    if (stateHash !== graphDocumentHash(graph)) throw new TypeError('replay stateHash does not match graph content');
    return Object.freeze({
      graph,
      stateHash,
      lastEventHash,
      eventCount: eventCount as number,
    });
  },
};

function bindGraphContext(input: GraphStateCommitInput, context: GraphExecutionContext): void {
  if (context.graph && context.graph.id !== input.graphId) {
    throw new TypeError(`Execution graph ${context.graph.id} does not match transaction graph ${input.graphId}`);
  }
  if (context.graph?.revision !== undefined && context.graph.revision !== String(input.expectedRevision)) {
    throw new TypeError(`Execution graph revision ${context.graph.revision} does not match expected revision ${input.expectedRevision}`);
  }
  if (!context.idempotencyKey) throw new TypeError('Graph state commit requires a runtime idempotency key');
}

export interface GraphStateModule {
  readonly module: GraphModule;
  readonly commit: GraphCapability<GraphStateCommitInput, GraphCommitReceipt>;
  readonly snapshot: GraphCapability<GraphStateReadInput, GraphSnapshot>;
  readonly verify: GraphCapability<GraphStateReadInput, GraphReplayResult>;
}

export function createGraphStateModule(
  store: GraphStateStorePort,
  options: GraphStateModuleOptions = {},
): GraphStateModule {
  const version = options.version ?? '1.0.0-alpha.1';
  const commit = defineGraphCapability({
    descriptor: {
      id: 'cos.graph.state.commit',
      kind: 'store',
      version,
      maturity: 'experimental',
      description: 'Commit a canonical graph transaction with optimistic concurrency and payload-bound idempotency',
      modes: ['mutate'],
      determinism: 'deterministic',
      sideEffects: 'graph',
      idempotency: 'required',
    },
    input: commitInputSchema,
    output: commitReceiptSchema(),
    execute(input, context) {
      bindGraphContext(input, context);
      return store.commit({
        graphId: input.graphId,
        expectedRevision: input.expectedRevision,
        mutations: input.mutations,
        idempotencyKey: context.idempotencyKey as string,
        operationId: context.operationId,
        recordedAt: context.startedAt,
      });
    },
  });

  const snapshot = defineGraphCapability({
    descriptor: {
      id: 'cos.graph.state.snapshot',
      kind: 'store',
      version,
      maturity: 'experimental',
      description: 'Read an immutable canonical graph snapshot with an integrity hash',
      modes: ['stream'],
      determinism: 'deterministic',
      sideEffects: 'none',
      idempotency: 'none',
    },
    input: readInputSchema,
    output: snapshotSchema,
    execute(input) {
      return store.snapshot(input.graphId);
    },
  });

  const verify = defineGraphCapability({
    descriptor: {
      id: 'cos.graph.state.verify',
      kind: 'store',
      version,
      maturity: 'experimental',
      description: 'Replay the graph event chain and prove projection equivalence',
      modes: ['stats'],
      determinism: 'deterministic',
      sideEffects: 'none',
      idempotency: 'none',
    },
    input: readInputSchema,
    output: replayResultSchema,
    execute(input) {
      return store.verify(input.graphId);
    },
  });

  const module = defineGraphModule({
    manifest: {
      id: options.moduleId ?? 'cos.graph.state.memory',
      name: options.name ?? 'COS Canonical In-Memory Graph State',
      version,
      protocol: COS_GRAPH_PROTOCOL_VERSION,
      maturity: 'experimental',
      description: options.description ?? 'Canonical versioned graph state, event chain, deterministic replay, CAS and idempotency reference implementation',
      capabilities: [commit.descriptor, snapshot.descriptor, verify.descriptor],
    },
    capabilities: [commit, snapshot, verify],
  });

  return Object.freeze({ module, commit, snapshot, verify });
}
