import assert from 'node:assert/strict';
import {
  AuthorityMemoryService,
  InMemoryAuthorityMemoryStore,
} from '../packages/memory/src';

const T0 = '2026-08-25T12:00:00.000Z';
const T1 = '2026-08-25T12:00:01.000Z';
const T2 = '2026-08-25T12:00:02.000Z';
const T3 = '2026-08-25T12:00:03.000Z';
const T4 = '2026-08-25T12:00:04.000Z';
const T5 = '2026-08-25T12:00:05.000Z';
const T6 = '2026-08-25T12:00:06.000Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const store = new InMemoryAuthorityMemoryStore();
  const memory = new AuthorityMemoryService(store);
  const provenance = [{ source: 'github://rotprods/cos-graph-engine/pull/40' }];

  const created = await memory.create({
    projectId: 'COS_GRAPH_ENGINE',
    identityKey: 'late-correction-fact',
    layer: 'semantic',
    content: { statement: 'state remained valid' },
    epistemicType: 'observed',
    confidence: 0.9,
    sensitivity: 'internal',
    validFrom: T0,
    observedAt: T0,
    recordedAt: T0,
    provenance,
    source: 'github://rotprods/cos-graph-engine',
    tags: ['phase-01', 'fact'],
    importance: 0.8,
    metadata: { owner: 'cos' },
    idempotencyKey: 'memory:create:late-correction-fact',
  });
  check(created.appended && created.revision.revision === 1, 'initial revision is appended');

  const duplicate = await memory.create({
    projectId: 'COS_GRAPH_ENGINE',
    identityKey: 'late-correction-fact',
    layer: 'semantic',
    content: { statement: 'state remained valid' },
    epistemicType: 'observed',
    confidence: 0.9,
    sensitivity: 'internal',
    validFrom: T0,
    observedAt: T0,
    recordedAt: T0,
    provenance,
    source: 'github://rotprods/cos-graph-engine',
    tags: ['fact', 'phase-01'],
    importance: 0.8,
    metadata: { owner: 'cos' },
    idempotencyKey: 'memory:create:late-correction-fact',
  });
  check(!duplicate.appended && duplicate.revision.revisionId === created.revision.revisionId, 'exact create retry converges');

  await assert.rejects(() => memory.create({
    projectId: 'COS_GRAPH_ENGINE',
    identityKey: 'late-correction-fact',
    layer: 'semantic',
    content: { statement: 'conflicting content' },
    epistemicType: 'observed',
    confidence: 0.9,
    sensitivity: 'internal',
    validFrom: T0,
    observedAt: T0,
    recordedAt: T0,
    provenance,
    source: 'github://rotprods/cos-graph-engine',
    idempotencyKey: 'memory:create:late-correction-fact',
  }), /MEMORY_IDEMPOTENCY_CONFLICT/);
  assertions += 1;

  const revised = await memory.revise<{ statement: string }>({
    memoryId: created.revision.memoryId,
    expectedRevision: 1,
    recordedAt: T2,
    idempotencyKey: 'memory:revise:late-correction-fact:2',
    changes: {
      content: { statement: 'corrected state' },
      provenance: [{ source: 'github://rotprods/cos-graph-engine/pull/40', revision: 'correction-1' }],
      confidence: 0.98,
    },
  });
  check(revised.appended && revised.revision.revision === 2, 'revision appends instead of overwriting row one');

  await assert.rejects(() => memory.revise({
    memoryId: created.revision.memoryId,
    expectedRevision: 1,
    recordedAt: T3,
    idempotencyKey: 'memory:stale-write',
    changes: { confidence: 0.5 },
  }), /STALE_MEMORY_REVISION/);
  assertions += 1;

  const knownBeforeCorrection = await memory.query<{ statement: string }>({
    projectId: 'COS_GRAPH_ENGINE',
    asOf: T3,
    knownAt: T1,
    maxSensitivity: 'internal',
  });
  const beforeFact = knownBeforeCorrection.find(item => item.memoryId === created.revision.memoryId);
  check(beforeFact?.content.statement === 'state remained valid' && beforeFact.revision === 1, 'knownAt before correction sees original revision');

  const knownAfterCorrection = await memory.query<{ statement: string }>({
    projectId: 'COS_GRAPH_ENGINE',
    asOf: T3,
    knownAt: T3,
    maxSensitivity: 'internal',
  });
  const afterFact = knownAfterCorrection.find(item => item.memoryId === created.revision.memoryId);
  check(afterFact?.content.statement === 'corrected state' && afterFact.revision === 2, 'knownAt after correction sees revised knowledge');

  const domainCorrection = await memory.revise({
    memoryId: created.revision.memoryId,
    expectedRevision: 2,
    recordedAt: T4,
    idempotencyKey: 'memory:revise:late-correction-fact:domain-close',
    changes: {
      validUntil: T2,
      provenance: [{ source: 'agentic://late-discovery/domain-closure' }],
    },
  });
  check(domainCorrection.revision.revision === 3, 'late domain closure is a new system-time revision');

  const beforeLateDiscovery = await memory.query({
    projectId: 'COS_GRAPH_ENGINE',
    asOf: T3,
    knownAt: T3,
    maxSensitivity: 'internal',
  });
  check(beforeLateDiscovery.some(item => item.memoryId === created.revision.memoryId), 'past knowledge does not see a future domain closure');

  const afterLateDiscovery = await memory.query({
    projectId: 'COS_GRAPH_ENGINE',
    asOf: T3,
    knownAt: T5,
    maxSensitivity: 'internal',
  });
  check(!afterLateDiscovery.some(item => item.memoryId === created.revision.memoryId), 'after late discovery, domain query reflects corrected validity');

  const history = await memory.history<{ statement: string }>(created.revision.memoryId);
  check(history.length === 3, 'all three revisions remain available');
  check(history[0].systemUntil === T2 && history[1].systemUntil === T4 && history[2].systemUntil === null, 'systemUntil is derived from next immutable revision');
  history[2].metadata.owner = 'mutated-by-caller';
  (history[2].content as { statement: string }).statement = 'caller mutation';
  const currentAfterLeakAttempt = await memory.current<{ statement: string }>(created.revision.memoryId);
  check(currentAfterLeakAttempt?.metadata.owner === 'cos', 'metadata reads are copy-safe');
  check(currentAfterLeakAttempt?.content.statement === 'corrected state', 'content reads are copy-safe');

  const oldPolicy = await memory.create({
    projectId: 'COS_GRAPH_ENGINE',
    identityKey: 'policy-old',
    layer: 'semantic',
    content: { policy: 'old' },
    epistemicType: 'decision',
    confidence: 1,
    sensitivity: 'internal',
    validFrom: T0,
    observedAt: T0,
    recordedAt: T0,
    provenance,
    source: 'agentic://decision/policy-old',
    idempotencyKey: 'memory:create:policy-old',
  });
  const newPolicy = await memory.create({
    projectId: 'COS_GRAPH_ENGINE',
    identityKey: 'policy-new',
    layer: 'semantic',
    content: { policy: 'new' },
    epistemicType: 'decision',
    confidence: 1,
    sensitivity: 'internal',
    validFrom: T5,
    observedAt: T5,
    recordedAt: T5,
    provenance,
    source: 'agentic://decision/policy-new',
    idempotencyKey: 'memory:create:policy-new',
  });

  const relation = await memory.relate({
    projectId: 'COS_GRAPH_ENGINE',
    type: 'supersedes',
    fromMemoryId: newPolicy.revision.memoryId,
    toMemoryId: oldPolicy.revision.memoryId,
    confidence: 1,
    provenance: [{ source: 'agentic://decision/policy-new' }],
    recordedAt: T5,
    idempotencyKey: 'memory:relation:policy-new-supersedes-old',
  });
  check(relation.appended, 'supersession relation is append-only');

  const relationRetry = await memory.relate({
    projectId: 'COS_GRAPH_ENGINE',
    type: 'supersedes',
    fromMemoryId: newPolicy.revision.memoryId,
    toMemoryId: oldPolicy.revision.memoryId,
    confidence: 1,
    provenance: [{ source: 'agentic://decision/policy-new' }],
    recordedAt: T5,
    idempotencyKey: 'memory:relation:policy-new-supersedes-old',
  });
  check(!relationRetry.appended && relationRetry.relation.id === relation.relation.id, 'relation retry converges');

  const statusBeforeRelation = await memory.query({
    projectId: 'COS_GRAPH_ENGINE',
    asOf: T6,
    knownAt: T4,
    statuses: ['active'],
    maxSensitivity: 'internal',
  });
  check(statusBeforeRelation.some(item => item.memoryId === oldPolicy.revision.memoryId), 'old policy is active before supersession is known');

  const statusAfterRelation = await memory.query({
    projectId: 'COS_GRAPH_ENGINE',
    asOf: T6,
    knownAt: T6,
    statuses: ['superseded'],
    maxSensitivity: 'internal',
  });
  check(statusAfterRelation.some(item => item.memoryId === oldPolicy.revision.memoryId), 'old policy becomes superseded only after relation recordedAt');

  const restricted = await memory.create({
    projectId: 'COS_GRAPH_ENGINE',
    identityKey: 'restricted-memory',
    layer: 'semantic',
    content: { secret: true },
    epistemicType: 'observed',
    confidence: 1,
    sensitivity: 'restricted',
    validFrom: T0,
    observedAt: T0,
    recordedAt: T0,
    provenance,
    source: 'agentic://restricted',
    idempotencyKey: 'memory:create:restricted',
  });
  const internalView = await memory.query({
    projectId: 'COS_GRAPH_ENGINE',
    asOf: T6,
    knownAt: T6,
    maxSensitivity: 'internal',
  });
  check(!internalView.some(item => item.memoryId === restricted.revision.memoryId), 'restricted memory is excluded from internal query');

  await assert.rejects(() => memory.relate({
    projectId: 'COS_GRAPH_ENGINE',
    type: 'evidence_for',
    fromMemoryId: restricted.revision.memoryId,
    toMemoryId: oldPolicy.revision.memoryId,
    sensitivity: 'internal',
    provenance,
    recordedAt: T6,
    idempotencyKey: 'memory:relation:sensitivity-downgrade',
  }), /MEMORY_RELATION_SENSITIVITY_DOWNGRADE/);
  assertions += 1;

  const otherProject = await memory.create({
    projectId: 'OTHER',
    identityKey: 'other-project-memory',
    layer: 'semantic',
    content: { other: true },
    epistemicType: 'observed',
    confidence: 1,
    validFrom: T0,
    observedAt: T0,
    recordedAt: T0,
    provenance,
    source: 'agentic://other',
    idempotencyKey: 'memory:create:other-project',
  });
  await assert.rejects(() => memory.relate({
    projectId: 'COS_GRAPH_ENGINE',
    type: 'derived_from',
    fromMemoryId: oldPolicy.revision.memoryId,
    toMemoryId: otherProject.revision.memoryId,
    provenance,
    recordedAt: T6,
    idempotencyKey: 'memory:relation:cross-project',
  }), /CROSS_PROJECT_MEMORY_RELATION_REJECTED/);
  assertions += 1;

  console.log(`Authority memory contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
