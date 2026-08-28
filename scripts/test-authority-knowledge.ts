import assert from 'node:assert/strict';
import type { GraphEdge, GraphNode, GraphPath, GraphQuery, GraphStats, IPropertyGraph, EntityId } from '../packages/core/src';
import {
  AuthorityKnowledgeCoordinator,
  AuthorityKnowledgeGateway,
  AuthorityKnowledgeProjector,
  InMemoryAuthorityKnowledgeStore,
  PropertyGraph,
  type AuthorityKnowledgeCreateInput,
} from '../packages/knowledge/src';

const T0 = '2026-08-01T10:00:00.000Z';
const T1 = '2026-08-05T10:00:00.000Z';
const T2 = '2026-08-10T10:00:00.000Z';
const T3 = '2026-08-15T10:00:00.000Z';
const T4 = '2026-08-20T10:00:00.000Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (value: unknown, message: string): void => {
    assert.ok(value, message);
    assertions += 1;
  };

  const store = new InMemoryAuthorityKnowledgeStore();
  const gateway = new AuthorityKnowledgeGateway(store);

  const created = await gateway.create({
    projectId: 'COS_GRAPH_ENGINE',
    identityKey: 'repo-authority-status',
    subject: 'COS Graph Engine',
    predicate: 'authority_status',
    object: 'SHADOW_ONLY',
    confidence: 1,
    sensitivity: 'internal',
    validFrom: T0,
    observedAt: T1,
    recordedAt: T1,
    provenance: [{ source: 'github://rotprods/cos-graph-engine/pull/45' }],
    source: 'github://rotprods/cos-graph-engine/pull/45',
    metadata: { phase: '04', optional: undefined },
    idempotencyKey: 'kn-op-1',
  });
  check(created.appended && created.revision.revision === 1, 'initial authority revision appended');
  check(!('optional' in created.revision.metadata), 'undefined optional metadata is omitted at wire boundary');

  const beforeCorrection = await gateway.query({
    projectId: 'COS_GRAPH_ENGINE', asOf: T2, knownAt: T2, maxSensitivity: 'internal',
  });
  check(beforeCorrection.at(0)?.object === 'SHADOW_ONLY', 'knownAt before correction sees original belief');

  const corrected = await gateway.revise({
    statementId: created.revision.statementId,
    expectedRevision: 1,
    recordedAt: T3,
    idempotencyKey: 'kn-op-2',
    changes: {
      object: 'HARDENING_ACTIVE',
      validFrom: T2,
      observedAt: T3,
      provenance: [{ source: 'github://rotprods/cos-graph-engine/pull/45', revision: 'phase04' }],
    },
  });
  check(corrected.revision.revision === 2 && corrected.revision.validFrom === T2, 'late correction gets new immutable system revision with independent validFrom');

  const historicalKnowledge = await gateway.query({
    projectId: 'COS_GRAPH_ENGINE', asOf: T2, knownAt: T2, maxSensitivity: 'internal',
  });
  check(historicalKnowledge.at(0)?.object === 'SHADOW_ONLY', 'future correction does not leak into historical knownAt');

  const afterCorrection = await gateway.query({
    projectId: 'COS_GRAPH_ENGINE', asOf: T2, knownAt: T3, maxSensitivity: 'internal',
  });
  check(afterCorrection.at(0)?.object === 'HARDENING_ACTIVE', 'same domain time resolves to corrected fact once correction is known');

  const closed = await gateway.revise({
    statementId: created.revision.statementId,
    expectedRevision: 2,
    recordedAt: T4,
    idempotencyKey: 'kn-op-3',
    changes: { validUntil: T4, observedAt: T4 },
  });
  check(closed.revision.validUntil === T4 && corrected.revision.validUntil === null, 'domain closure does not rewrite prior revision');

  const beforeClosureKnown = await gateway.query({
    projectId: 'COS_GRAPH_ENGINE', asOf: T4, knownAt: T3, maxSensitivity: 'internal',
  });
  check(beforeClosureKnown.at(0)?.object === 'HARDENING_ACTIVE', 'closure learned later does not rewrite earlier system knowledge');
  const afterClosureKnown = await gateway.query({
    projectId: 'COS_GRAPH_ENGINE', asOf: T4, knownAt: T4, maxSensitivity: 'internal',
  });
  check(afterClosureKnown.length === 0, 'domain closure applies after the closing revision is known');

  const history = await gateway.history(created.revision.statementId);
  check(history.length === 3, 'all knowledge revisions remain append-only');
  check(
    history.at(0)?.systemUntil === T3 && history.at(1)?.systemUntil === T4 && history.at(2)?.systemUntil === null,
    'systemUntil is derived from successor revisions',
  );

  const retry = await gateway.revise({
    statementId: created.revision.statementId,
    expectedRevision: 1,
    recordedAt: T3,
    idempotencyKey: 'kn-op-2',
    changes: {
      object: 'HARDENING_ACTIVE',
      validFrom: T2,
      observedAt: T3,
      provenance: [{ source: 'github://rotprods/cos-graph-engine/pull/45', revision: 'phase04' }],
    },
  });
  check(!retry.appended && retry.revision.revisionId === corrected.revision.revisionId, 'late retry resolves to the historical accepted revision');

  await assert.rejects(() => gateway.revise({
    statementId: created.revision.statementId,
    expectedRevision: 1,
    recordedAt: T3,
    idempotencyKey: 'kn-op-2',
    changes: { object: 'CONFLICTING_RETRY' },
  }), /KNOWLEDGE_IDEMPOTENCY_CONFLICT/);
  assertions += 1;

  const leaked = await store.getHistory(created.revision.statementId);
  const leakedFirst = leaked.at(0);
  if (!leakedFirst) throw new Error('expected knowledge history');
  leakedFirst.metadata.phase = 'tampered';
  const pristine = await store.getHistory(created.revision.statementId);
  check(pristine.at(0)?.metadata.phase === '04', 'store history reads are detached from canonical revisions');

  const restricted = await gateway.create({
    projectId: 'COS_GRAPH_ENGINE',
    identityKey: 'restricted-fact',
    subject: 'Secret', predicate: 'classification', object: 'restricted',
    confidence: 1, sensitivity: 'restricted', validFrom: T0, observedAt: T1, recordedAt: T1,
    provenance: [{ source: 'agentic://restricted/evidence' }], source: 'agentic://restricted/evidence',
    idempotencyKey: 'kn-op-restricted',
  });
  check(restricted.appended, 'restricted knowledge can be stored');
  const internalView = await gateway.query({
    projectId: 'COS_GRAPH_ENGINE', asOf: T2, knownAt: T2, maxSensitivity: 'internal',
  });
  check(!internalView.some(item => item.statementId === restricted.revision.statementId), 'sensitivity filter prevents restricted leakage');

  const flakyGraph = new FailOnceGraph();
  const sagaStore = new InMemoryAuthorityKnowledgeStore();
  const sagaGateway = new AuthorityKnowledgeGateway(sagaStore);
  const coordinator = new AuthorityKnowledgeCoordinator(sagaGateway, new AuthorityKnowledgeProjector(flakyGraph));
  const sagaInput: AuthorityKnowledgeCreateInput = {
    projectId: 'COS_GRAPH_ENGINE', identityKey: 'projection-saga',
    subject: 'Authority Ledger', predicate: 'projects_to', object: 'Property Graph',
    confidence: 0.9, validFrom: T0, observedAt: T1, recordedAt: T1,
    provenance: [{ source: 'test://projection-saga' }], source: 'test://projection-saga',
    idempotencyKey: 'kn-saga-1',
  };
  await assert.rejects(() => coordinator.create(sagaInput), /KNOWLEDGE_PROJECTION_DEGRADED/);
  assertions += 1;
  check((await sagaStore.listProjectRevisions('COS_GRAPH_ENGINE')).length === 1, 'projection crash does not erase accepted authority revision');
  check(coordinator.getProjectionFailures().length === 1, 'projection failure is retained as degraded evidence');
  const repaired = await coordinator.create(sagaInput);
  check(!repaired.appended, 'retry reuses accepted ledger revision instead of duplicating truth');
  check(coordinator.getProjectionFailures().length === 0, 'successful retry repairs degraded projection state');

  console.log(`Authority knowledge contract: ${assertions} assertions passed`);
}

class FailOnceGraph implements IPropertyGraph {
  private readonly delegate = new PropertyGraph();
  private fail = true;
  async addNode(node: GraphNode): Promise<EntityId> { return this.delegate.addNode(node); }
  async getNode(id: EntityId): Promise<GraphNode | null> { return this.delegate.getNode(id); }
  async updateNode(id: EntityId, updates: Partial<GraphNode>): Promise<void> { return this.delegate.updateNode(id, updates); }
  async deleteNode(id: EntityId): Promise<void> { return this.delegate.deleteNode(id); }
  async addEdge(edge: GraphEdge): Promise<EntityId> {
    if (this.fail) { this.fail = false; throw new Error('injected projection failure'); }
    return this.delegate.addEdge(edge);
  }
  async getEdge(id: EntityId): Promise<GraphEdge | null> { return this.delegate.getEdge(id); }
  async updateEdge(id: EntityId, updates: Partial<GraphEdge>): Promise<void> { return this.delegate.updateEdge(id, updates); }
  async deleteEdge(id: EntityId): Promise<void> { return this.delegate.deleteEdge(id); }
  async queryNodes(q: GraphQuery): Promise<GraphNode[]> { return this.delegate.queryNodes(q); }
  async queryEdges(q: GraphQuery): Promise<GraphEdge[]> { return this.delegate.queryEdges(q); }
  async traverse(start: EntityId, edgeTypes: string[], depth: number): Promise<GraphPath[]> { return this.delegate.traverse(start, edgeTypes, depth); }
  async stats(): Promise<GraphStats> { return this.delegate.stats(); }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
