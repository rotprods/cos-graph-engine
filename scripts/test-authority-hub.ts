import assert from 'node:assert/strict';
import {
  AuthorityAgenticRegistry,
  AuthorityHub,
  AuthorityHubContextProjector,
  AuthorityHubQueryService,
  AuthorityHubSnapshotManager,
  InMemoryAuthorityHubSnapshotStore,
} from '../packages/hub/src';
import {
  InMemoryEventLog,
  type AppendEventInput,
  type AppendResult,
  type DurableEvent,
  type EventLogCursor,
  type IEventLog,
} from '../packages/runtime/src';
import type { EntityId } from '../packages/core/src';

const T0 = '2026-08-25T12:00:00.000Z';
const T1 = '2026-08-25T12:00:01.000Z';
const T2 = '2026-08-25T12:00:02.000Z';
const T3 = '2026-08-25T12:00:03.000Z';
const T4 = '2026-08-25T12:00:04.000Z';
const T5 = '2026-08-25T12:00:05.000Z';

class FailOutcomeEventLog implements IEventLog {
  constructor(private readonly inner: IEventLog) {}
  async append(input: AppendEventInput): Promise<AppendResult> {
    if (input.type === 'hub.authority.repo.transition_outcome') {
      throw new Error('SIMULATED_OUTCOME_STORE_FAILURE');
    }
    return this.inner.append(input);
  }
  get(eventId: EntityId): Promise<DurableEvent | null> { return this.inner.get(eventId); }
  getByIdempotencyKey(key: string): Promise<DurableEvent | null> { return this.inner.getByIdempotencyKey(key); }
  readFrom(cursor?: EventLogCursor, limit?: number): Promise<DurableEvent[]> { return this.inner.readFrom(cursor, limit); }
  latestCursor(): Promise<EventLogCursor> { return this.inner.latestCursor(); }
  clear(): Promise<void> { return this.inner.clear(); }
}

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const log = new InMemoryEventLog();
  const hub = new AuthorityHub(log);
  const repo = await hub.registerRepository({
    owner: 'rotprods',
    name: 'cos-graph-engine',
    projectId: 'COS_GRAPH_ENGINE',
    metadata: { purpose: 'authority substrate' },
    idempotencyKey: 'repo:cos-graph-engine',
    correlationId: 'corr-register',
    sourceRef: 'github://rotprods/cos-graph-engine',
    occurredAt: T0,
    recordedAt: T0,
  });
  check(repo.state === 'PENDING' && repo.stateRevision === 0, 'registration materializes deterministic initial state');

  const duplicateRepo = await hub.registerRepository({
    owner: 'rotprods',
    name: 'cos-graph-engine',
    projectId: 'COS_GRAPH_ENGINE',
    metadata: { purpose: 'authority substrate' },
    idempotencyKey: 'repo:cos-graph-engine',
    correlationId: 'corr-register',
    sourceRef: 'github://rotprods/cos-graph-engine',
    occurredAt: T0,
    recordedAt: T0,
  });
  check(duplicateRepo.id === repo.id && (await log.latestCursor()).sequence === 1, 'exact registration retry is idempotent');

  await assert.rejects(() => hub.registerRepository({
    owner: 'rotprods',
    name: 'different-repository',
    idempotencyKey: 'repo:cos-graph-engine',
    correlationId: 'corr-conflict',
    sourceRef: 'github://rotprods/different-repository',
    occurredAt: T0,
    recordedAt: T0,
  }), /HUB_REGISTRATION_IDEMPOTENCY_CONFLICT/);
  assertions += 1;

  const init = await hub.applyRepoEvent(repo.id, 'init', {
    idempotencyKey: 'cmd:init:1',
    correlationId: 'corr-init',
    sourceRef: 'github://rotprods/cos-graph-engine/actions/init',
    occurredAt: T1,
    recordedAt: T1,
    expectedState: 'PENDING',
    expectedRevision: 0,
  });
  check(init.applied && init.state === 'DEV' && init.revision === 1, 'init command applies and records outcome');

  const initRetry = await hub.applyRepoEvent(repo.id, 'init', {
    idempotencyKey: 'cmd:init:1',
    correlationId: 'corr-init',
    sourceRef: 'github://rotprods/cos-graph-engine/actions/init',
    occurredAt: T1,
    recordedAt: T1,
    expectedState: 'PENDING',
    expectedRevision: 0,
  });
  check(initRetry.duplicate && initRetry.outcomeEventId === init.outcomeEventId, 'command retry resolves to recorded outcome');

  await assert.rejects(() => hub.applyRepoEvent(repo.id, 'change', {
    idempotencyKey: 'cmd:init:1',
    correlationId: 'corr-conflicting-retry',
    sourceRef: 'github://rotprods/cos-graph-engine/actions/change',
    occurredAt: T2,
    recordedAt: T2,
    expectedState: 'DEV',
    expectedRevision: 1,
  }), /HUB_COMMAND_(IDEMPOTENCY_CONFLICT|LOGICAL_HASH_MISMATCH)/);
  assertions += 1;

  const stale = await hub.applyRepoEvent(repo.id, 'change', {
    idempotencyKey: 'cmd:stale:1',
    correlationId: 'corr-stale',
    sourceRef: 'agentic://near-miss/stale-worker',
    occurredAt: T2,
    recordedAt: T2,
    expectedState: 'PENDING',
    expectedRevision: 0,
  });
  check(!stale.applied && stale.state === 'DEV' && stale.revision === 1, 'stale command is recorded but cannot mutate state');

  const beforeSnapshot = await hub.snapshot(T2);
  const store = new InMemoryAuthorityHubSnapshotStore();
  const manager = new AuthorityHubSnapshotManager(store, log);
  const envelope = await manager.create(hub, { id: 'snapshot-before-change', createdAt: T2 });
  check(envelope.semanticHash === beforeSnapshot.stateHash, 'sealed snapshot preserves semantic state hash');

  const change = await hub.applyRepoEvent(repo.id, 'change', {
    idempotencyKey: 'cmd:change:1',
    correlationId: 'corr-change',
    sourceRef: 'github://rotprods/cos-graph-engine/commit/change',
    occurredAt: T3,
    recordedAt: T3,
    expectedState: 'DEV',
    expectedRevision: 1,
  });
  check(change.applied && change.state === 'DEV' && change.revision === 2, 'self transition advances revision');
  const liveHash = hub.projectionHash();

  const recovered = await manager.restoreLatest();
  check(recovered.report.postSnapshotEvents === 2, 'restore replays exactly command + outcome after snapshot cursor');
  check(recovered.hub.projectionHash() === liveHash, 'snapshot + outcome replay reconstructs live semantic state');
  check(recovered.hub.getRepository(repo.id)?.stateRevision === 2, 'recovered repository has latest revision');

  const replayed = new AuthorityHub(log);
  const replayReport = await replayed.replayFrom();
  check(replayReport.stateHash === liveHash, 'full replay from event zero converges to same state hash');
  check(replayReport.rejected === 1 && replayReport.applied === 2, 'replay preserves recorded rejected/applied outcomes');

  const failingInner = new InMemoryEventLog();
  const failingLog = new FailOutcomeEventLog(failingInner);
  const failingHub = new AuthorityHub(failingLog);
  const failingRepo = await failingHub.registerRepository({
    owner: 'rotprods',
    name: 'outcome-failure-fixture',
    idempotencyKey: 'repo:failure-fixture',
    correlationId: 'corr-failure-register',
    sourceRef: 'github://rotprods/outcome-failure-fixture',
    occurredAt: T0,
    recordedAt: T0,
  });
  await assert.rejects(() => failingHub.applyRepoEvent(failingRepo.id, 'init', {
    idempotencyKey: 'cmd:failure:init',
    correlationId: 'corr-failure-command',
    sourceRef: 'fixture://outcome-store-failure',
    occurredAt: T1,
    recordedAt: T1,
    expectedState: 'PENDING',
    expectedRevision: 0,
  }), /SIMULATED_OUTCOME_STORE_FAILURE/);
  assertions += 1;
  check(failingHub.getRepository(failingRepo.id)?.state === 'PENDING', 'outcome append failure rolls in-memory state back');
  await assert.rejects(() => failingHub.snapshot(T2), /HUB_SNAPSHOT_INCOMPLETE_COMMANDS/);
  assertions += 1;

  const registry = new AuthorityAgenticRegistry();
  const project = registry.addResource({
    identity: { scheme: 'agentic', authority: 'rotprods', resourceType: 'project', resourceId: 'COS_GRAPH_ENGINE' },
    type: 'project',
    title: 'COS Graph Engine',
    projectId: 'COS_GRAPH_ENGINE',
    status: 'active',
    sensitivity: 'internal',
    provenanceRef: 'github://rotprods/cos-graph-engine',
    recordedAt: T0,
  });
  const task = registry.addResource({
    identity: { scheme: 'agentic', authority: 'rotprods', resourceType: 'task', resourceId: 'R5-HUB' },
    type: 'task',
    title: 'Converge authority Hub',
    projectId: 'COS_GRAPH_ENGINE',
    status: 'in_progress',
    sensitivity: 'internal',
    provenanceRef: 'github://rotprods/cos-graph-engine/pull/40',
    recordedAt: T0,
    metadata: { priority: 'P0' },
  });
  const global = registry.addResource({
    identity: { scheme: 'drive', authority: 'google', resourceType: 'document', resourceId: 'doctrine' },
    type: 'source',
    title: 'Engineering Doctrine',
    status: 'active',
    sensitivity: 'public',
    provenanceRef: 'drive://google/document/doctrine',
    recordedAt: T0,
  });
  registry.addResource({
    identity: { scheme: 'agentic', authority: 'rotprods', resourceType: 'artifact', resourceId: 'restricted' },
    type: 'artifact',
    title: 'Restricted Evidence',
    projectId: 'COS_GRAPH_ENGINE',
    status: 'active',
    sensitivity: 'restricted',
    provenanceRef: 'agentic://artifact/restricted',
    recordedAt: T0,
  });
  registry.addRelation({
    type: 'belongs_to',
    from: task.id,
    to: project.id,
    projectId: 'COS_GRAPH_ENGINE',
    provenanceRef: 'github://rotprods/cos-graph-engine/pull/40',
    recordedAt: T0,
  });

  const query = new AuthorityHubQueryService(registry);
  const runtime = query.projectRuntime('COS_GRAPH_ENGINE', {
    asOf: T4,
    knownAt: T4,
    maxSensitivity: 'internal',
    includeGlobal: true,
  });
  check(runtime.tasks.some(resource => resource.id === task.id), 'authority query exposes visible project task');
  check(runtime.openLoops.some(resource => resource.id === task.id), 'authority query detects open task');
  check(runtime.project?.id === project.id, 'authority query resolves project resource');

  const context = new AuthorityHubContextProjector(registry);
  const compiled = await context.compileVerified({
    projectId: 'COS_GRAPH_ENGINE',
    task: 'What remains to converge the Hub?',
    asOf: T4,
    knownAt: T4,
    generatedAt: T5,
    maxSensitivity: 'internal',
    includeGlobal: true,
    expectedSourceProjectionVersion: registry.projectionVersion,
    expectedSourceProjectionHash: runtime.projectionHash,
  });
  check(compiled.pack.items.some(item => item.source === global.canonicalUri), 'verified context can include explicitly allowed global source');
  check(!compiled.pack.items.some(item => item.sensitivity === 'restricted'), 'verified context excludes restricted evidence');
  check(compiled.projection.sourceProjectionHash === runtime.projectionHash, 'query and context agree on source projection hash');

  console.log(`Authority Hub contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
