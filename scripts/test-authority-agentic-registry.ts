import assert from 'node:assert/strict';
import { AuthorityAgenticRegistry } from '../packages/hub/src/authority-agentic-registry';

const T0 = '2026-08-25T12:00:00.000Z';
const T05 = '2026-08-25T12:00:00.500Z';
const T1 = '2026-08-25T12:00:01.000Z';
const T2 = '2026-08-25T12:00:02.000Z';
const T3 = '2026-08-25T12:00:03.000Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const registry = new AuthorityAgenticRegistry();
  const project = registry.addResource({
    identity: { scheme: 'agentic', authority: 'rotprods', resourceType: 'project', resourceId: 'COS_GRAPH_ENGINE' },
    type: 'project',
    title: 'COS Graph Engine',
    projectId: 'COS_GRAPH_ENGINE',
    sensitivity: 'internal',
    provenanceRef: 'github://rotprods/cos-graph-engine',
    recordedAt: T0,
    metadata: { owner: 'rotprods' },
  }, { expectedProjectionVersion: 0 });
  check(project.revision === 1 && registry.projectionVersion === 1, 'resource create advances projection once');

  const duplicate = registry.addResource({
    identity: { scheme: 'agentic', authority: 'rotprods', resourceType: 'project', resourceId: 'COS_GRAPH_ENGINE' },
    type: 'project',
    title: 'COS Graph Engine',
    projectId: 'COS_GRAPH_ENGINE',
    sensitivity: 'internal',
    provenanceRef: 'github://rotprods/cos-graph-engine',
    recordedAt: T0,
    metadata: { owner: 'rotprods' },
  });
  check(duplicate.id === project.id && registry.projectionVersion === 1, 'exact create retry is idempotent');

  assert.throws(() => registry.addResource({
    identity: { scheme: 'agentic', authority: 'rotprods', resourceType: 'project', resourceId: 'COS_GRAPH_ENGINE' },
    type: 'project',
    title: 'Conflicting title',
    projectId: 'COS_GRAPH_ENGINE',
    sensitivity: 'internal',
    provenanceRef: 'github://rotprods/cos-graph-engine',
    recordedAt: T0,
  }), /AGENTIC_RESOURCE_CREATE_CONFLICT/);
  assertions += 1;

  const globalSource = registry.addResource({
    identity: { scheme: 'drive', authority: 'google', resourceType: 'document', resourceId: 'global-doctrine' },
    type: 'source',
    title: 'Global Doctrine',
    sensitivity: 'internal',
    provenanceRef: 'drive://google/document/global-doctrine',
    recordedAt: T0,
  });
  const task = registry.addResource({
    identity: { scheme: 'agentic', authority: 'rotprods', resourceType: 'task', resourceId: 'TASK-001' },
    type: 'task',
    title: 'Reconcile authority branches',
    projectId: 'COS_GRAPH_ENGINE',
    sensitivity: 'internal',
    provenanceRef: 'github://rotprods/cos-graph-engine/issues/39',
    recordedAt: T0,
    metadata: { priority: 'P0' },
  });
  const secret = registry.addResource({
    identity: { scheme: 'agentic', authority: 'rotprods', resourceType: 'artifact', resourceId: 'restricted-evidence' },
    type: 'artifact',
    title: 'Restricted Evidence',
    projectId: 'COS_GRAPH_ENGINE',
    sensitivity: 'restricted',
    provenanceRef: 'agentic://evidence/restricted',
    recordedAt: T0,
  });
  check(registry.getResource(secret.id) === null, 'default direct read cannot access restricted resource');
  check(registry.getResource(secret.id, { maxSensitivity: 'restricted' })?.id === secret.id, 'explicit restricted read can access it');

  const relation = registry.addRelation({
    type: 'depends_on',
    from: task.id,
    to: project.id,
    projectId: 'COS_GRAPH_ENGINE',
    provenanceRef: 'github://rotprods/cos-graph-engine/issues/39',
    recordedAt: T0,
  });
  const parallel = registry.addRelation({
    type: 'depends_on',
    from: task.id,
    to: project.id,
    identityKey: 'secondary-evidence',
    projectId: 'COS_GRAPH_ENGINE',
    provenanceRef: 'github://rotprods/cos-graph-engine/pull/38',
    recordedAt: T0,
  });
  check(relation.id !== parallel.id, 'identityKey preserves intentional parallel relations');

  assert.throws(() => registry.addRelation({
    type: 'evidence_for',
    from: secret.id,
    to: task.id,
    projectId: 'COS_GRAPH_ENGINE',
    sensitivity: 'internal',
    provenanceRef: 'agentic://evidence/restricted',
    recordedAt: T0,
  }), /RELATION_SENSITIVITY_DOWNGRADE/);
  assertions += 1;

  const historical = registry.addResource({
    identity: { scheme: 'agentic', authority: 'rotprods', resourceType: 'artifact', resourceId: 'historical-artifact' },
    type: 'artifact',
    title: 'Historical Artifact',
    projectId: 'COS_GRAPH_ENGINE',
    sensitivity: 'internal',
    provenanceRef: 'agentic://artifact/historical',
    validFrom: '2020-01-01T00:00:00.000Z',
    validUntil: '2021-01-01T00:00:00.000Z',
    observedAt: T0,
    recordedAt: T0,
  });
  check(registry.snapshot().resources.some(resource => resource.id === historical.id), 'full snapshot includes current revision even when domain validity expired');
  check(!registry.listResources({ projectId: 'COS_GRAPH_ENGINE', asOf: T1, knownAt: T1 }).some(resource => resource.id === historical.id), 'domain query excludes expired resource');

  const projectionBeforeUpdate = registry.projectionVersion;
  const updatedTask = registry.updateResource(task.id, 1, {
    title: 'Reconcile #34 and #35',
    recordedAt: T1,
    metadata: { priority: 'P0', phase: 1 },
  }, { expectedProjectionVersion: projectionBeforeUpdate });
  check(updatedTask.revision === 2, 'resource update appends revision');
  check(registry.getResource(task.id, { knownAt: T05 })?.title === 'Reconcile authority branches', 'knownAt returns historical revision');
  check(registry.getResource(task.id, { knownAt: T2 })?.title === 'Reconcile #34 and #35', 'knownAt returns current revision after update');
  check(registry.getResourceHistory(task.id).length === 2, 'resource history preserves both revisions');

  const leaked = registry.getResource(task.id)!;
  leaked.metadata.phase = 999;
  check(registry.getResource(task.id)?.metadata.phase === 1, 'resource reads are deep-copy safe');

  assert.throws(() => registry.updateResource(task.id, 1, {
    status: 'stale',
    recordedAt: T2,
  }), /STALE_AGENTIC_RESOURCE_REVISION/);
  assertions += 1;

  assert.throws(() => registry.updateRelation(relation.id, 1, {
    confidence: 0.5,
    recordedAt: T2,
  }, { expectedProjectionVersion: 0 }), /STALE_AGENTIC_PROJECTION/);
  assertions += 1;

  const internalPeer = registry.addResource({
    identity: { scheme: 'agentic', authority: 'rotprods', resourceType: 'artifact', resourceId: 'internal-peer' },
    type: 'artifact',
    title: 'Internal Peer',
    projectId: 'COS_GRAPH_ENGINE',
    sensitivity: 'internal',
    provenanceRef: 'agentic://artifact/internal-peer',
    recordedAt: T0,
  });
  const classificationRelation = registry.addRelation({
    type: 'references',
    from: internalPeer.id,
    to: project.id,
    projectId: 'COS_GRAPH_ENGINE',
    sensitivity: 'internal',
    provenanceRef: 'agentic://relation/classification',
    recordedAt: T0,
  });
  assert.throws(() => registry.updateResource(internalPeer.id, 1, {
    sensitivity: 'restricted',
    recordedAt: T1,
  }), /RELATION_RECLASSIFICATION_REQUIRED/);
  assertions += 1;
  registry.updateRelation(classificationRelation.id, 1, {
    sensitivity: 'restricted',
    recordedAt: T1,
  });
  registry.updateResource(internalPeer.id, 1, {
    sensitivity: 'restricted',
    recordedAt: T2,
  });
  check(registry.getResource(internalPeer.id) === null, 'resource reclassification is enforced after relation upgrade');

  const otherProject = registry.addResource({
    identity: { scheme: 'agentic', authority: 'rotprods', resourceType: 'project', resourceId: 'OTHER' },
    type: 'project',
    title: 'Other Project',
    projectId: 'OTHER',
    sensitivity: 'internal',
    provenanceRef: 'agentic://project/other',
    recordedAt: T0,
  });
  assert.throws(() => registry.addRelation({
    type: 'depends_on',
    from: task.id,
    to: otherProject.id,
    provenanceRef: 'agentic://relation/cross-project',
    recordedAt: T3,
  }), /CROSS_PROJECT_RELATION_REQUIRES_GOVERNED_BRIDGE/);
  assertions += 1;

  const projectView = registry.listResources({
    projectId: 'COS_GRAPH_ENGINE',
    includeGlobal: true,
    maxSensitivity: 'internal',
    asOf: T2,
    knownAt: T2,
  });
  check(projectView.some(resource => resource.id === globalSource.id), 'project view explicitly includes global context');
  check(!projectView.some(resource => resource.id === secret.id), 'project view excludes unreadable sensitivity');

  const scopedHash1 = registry.projectionHash({
    projectId: 'COS_GRAPH_ENGINE',
    includeGlobal: true,
    maxSensitivity: 'internal',
    asOf: T2,
    knownAt: T2,
  });
  const scopedHash2 = registry.projectionHash({
    projectId: 'COS_GRAPH_ENGINE',
    includeGlobal: true,
    maxSensitivity: 'internal',
    asOf: T2,
    knownAt: T2,
  });
  check(scopedHash1 === scopedHash2, 'scoped projection hash is deterministic with explicit times');
  assert.throws(() => registry.projectionHash({ projectId: 'COS_GRAPH_ENGINE' }), /requires explicit asOf and knownAt/);
  assertions += 1;

  const snapshot1 = registry.snapshot();
  const snapshot2 = registry.snapshot();
  check(snapshot1.projectionHash === snapshot2.projectionHash, 'full snapshot is wall-clock independent');
  check(registry.validate().length === 0, `registry invariants validate: ${registry.validate().join('; ')}`);

  console.log(`AuthorityAgenticRegistry: ${assertions} assertions passed`);
}

void main().catch(error => {
  console.error(error);
  process.exit(1);
});
