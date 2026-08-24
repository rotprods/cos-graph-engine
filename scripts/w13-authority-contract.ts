import { mkdirSync, writeFileSync } from 'node:fs';
import {
  AuthorityGraphRAGIndex,
  VersionedStateMachine,
} from '../packages/graph/src';
import { InMemoryAuthorityMemoryStore } from '../packages/memory/src';
import {
  AgenticResourceRegistry,
  AgenticContextProjector,
  CosHub,
  HubSnapshotManager,
  InMemoryHubSnapshotStore,
} from '../packages/hub/src';
import { InMemoryEventLog } from '../packages/runtime/src';
import type { EntityId } from '../packages/core/src';

interface CheckResult {
  name: string;
  passed: boolean;
  durationMs: number;
  detail?: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const results: CheckResult[] = [];

  async function check(name: string, fn: () => Promise<void> | void): Promise<void> {
    const started = Date.now();
    try {
      await fn();
      results.push({ name, passed: true, durationMs: Date.now() - started });
      console.log(`PASS ${name}`);
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      results.push({ name, passed: false, durationMs: Date.now() - started, detail });
      console.error(`FAIL ${name}: ${detail}`);
    }
  }

  const fixed = {
    validFrom: '2026-08-24T10:00:00.000Z',
    observedAt: '2026-08-24T10:01:00.000Z',
    recordedAt: '2026-08-24T10:02:00.000Z',
  };

  await check('authority projection is deterministic and scope-safe', () => {
    const registry = new AgenticResourceRegistry();
    const project = registry.addResource({
      identity: { scheme: 'agentic', authority: 'rot', resourceType: 'project', resourceId: 'P-001' },
      type: 'project',
      title: 'Project One',
      projectId: 'P-001',
      status: 'active',
      sensitivity: 'internal',
      provenanceRef: 'fixture:project',
      ...fixed,
    });
    const task = registry.addResource({
      identity: { scheme: 'agentic', authority: 'rot', resourceType: 'task', resourceId: 'T-001' },
      type: 'task',
      title: 'Close authority gaps',
      projectId: 'P-001',
      status: 'in_progress',
      sensitivity: 'internal',
      provenanceRef: 'fixture:task',
      metadata: { priority: 'P0' },
      ...fixed,
    });
    registry.addResource({
      identity: { scheme: 'agentic', authority: 'rot', resourceType: 'memory', resourceId: 'M-SECRET' },
      type: 'memory',
      title: 'Restricted evidence',
      projectId: 'P-001',
      status: 'active',
      sensitivity: 'restricted',
      provenanceRef: 'fixture:restricted',
      ...fixed,
    });
    registry.addRelation({
      type: 'contains',
      from: project.id,
      to: task.id,
      projectId: 'P-001',
      provenanceRef: 'fixture:relation',
      recordedAt: fixed.recordedAt,
    });

    const first = new AgenticContextProjector(new AuthorityGraphRAGIndex());
    const second = new AgenticContextProjector(new AuthorityGraphRAGIndex());
    const options = {
      version: 1,
      scope: { projectId: 'P-001', maxSensitivity: 'internal' as const, asOf: '2026-08-24T11:00:00.000Z' },
      sourceCursor: '1',
    };
    const reportA = first.project(registry, options);
    const reportB = second.project(registry, options);
    assert(reportA.projectionHash === reportB.projectionHash, 'same registry produced different projection hashes');
    assert(reportA.entities === 2, `restricted entity leaked into internal projection: ${reportA.entities}`);

    const pack = first.compile({
      projectId: 'P-001',
      task: 'close authority gaps',
      permission: 'internal',
      asOf: '2026-08-24T11:00:00.000Z',
      maxTokens: 1200,
    });
    assert(pack.projectionHash === reportA.projectionHash, 'context pack lost projection hash');
    assert(!pack.context.includes('Restricted evidence'), 'restricted evidence leaked into context pack');
    assert(pack.provenance.length > 0, 'context pack has no provenance');
  });

  await check('state transitions serialize and stale revisions fail', async () => {
    const machine = new VersionedStateMachine(
      'qualification',
      [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }, { id: 'C', label: 'C' }],
      [
        { from: 'A', to: 'B', event: 'next' },
        { from: 'B', to: 'C', event: 'next' },
      ],
      'A',
    );
    const attempts = await Promise.allSettled([
      machine.send('next', undefined, { expectedState: 'A', expectedRevision: 0 }),
      machine.send('next', undefined, { expectedState: 'A', expectedRevision: 0 }),
    ]);
    const fulfilled = attempts.filter(result => result.status === 'fulfilled').length;
    const rejected = attempts.filter(result => result.status === 'rejected').length;
    assert(fulfilled === 1 && rejected === 1, `expected one commit/one stale rejection; got ${fulfilled}/${rejected}`);
    assert(machine.state === 'B' && machine.currentRevision === 1, 'state machine committed an invalid concurrent state');
  });

  await check('authority memory preserves superseded historical truth', async () => {
    const store = new InMemoryAuthorityMemoryStore();
    const original = await store.append({
      id: 'mem-original' as EntityId,
      projectId: 'P-001',
      layer: 'semantic',
      content: { architecture: 'v1' },
      temporal: {
        validFrom: '2026-08-24T10:00:00.000Z',
        validUntil: null,
        observedAt: '2026-08-24T10:01:00.000Z',
        recordedAt: '2026-08-24T10:02:00.000Z',
        supersededAt: null,
      },
      provenance: [{ source: 'fixture:memory:v1', revision: '1' }],
      epistemicType: 'observed',
      confidence: 0.9,
      sensitivity: 'internal',
      source: 'source-1' as EntityId,
      importance: 0.9,
    });
    const pair = await store.supersede({
      currentId: original.id,
      replacementId: 'mem-replacement' as EntityId,
      content: { architecture: 'v2' },
      at: '2026-08-24T12:00:00.000Z',
      provenance: [{ source: 'fixture:memory:v2', revision: '2' }],
    });
    assert(pair.previous.status === 'superseded', 'previous memory revision was not closed');
    assert(pair.replacement.supersedes === original.id, 'replacement lost supersession lineage');

    const historical = await store.query({
      projectId: 'P-001',
      asOf: '2026-08-24T11:00:00.000Z',
      knownAt: '2026-08-24T11:00:00.000Z',
      maxSensitivity: 'internal',
    });
    assert(historical.some(record => record.id === original.id), 'historical memory disappeared after correction');
    assert(!historical.some(record => record.id === pair.replacement.id), 'replacement appeared before it was known/valid');
  });

  await check('Hub snapshot integrity and replay recover repository state', async () => {
    const eventLog = new InMemoryEventLog();
    const hub = new CosHub(eventLog);
    const repo = hub.registerRepository('rotprods', 'qualification-fixture');
    await hub.applyRepoEvent(repo.id, 'init', {
      idempotencyKey: 'fixture:init',
      correlationId: 'fixture:hub',
      sourceRef: 'fixture:hub:init',
      occurredAt: '2026-08-24T10:00:00.000Z',
    });
    await hub.applyRepoEvent(repo.id, 'deployment_succeeded', {
      idempotencyKey: 'fixture:deploy',
      correlationId: 'fixture:hub',
      sourceRef: 'fixture:hub:deploy',
      occurredAt: '2026-08-24T10:05:00.000Z',
    });
    const snapshots = new InMemoryHubSnapshotStore();
    const manager = new HubSnapshotManager(snapshots, eventLog);
    const envelope = await manager.create(hub, 'fixture-snapshot');
    assert(envelope.integrityHash.length === 64, 'Hub snapshot is not protected by SHA-256');
    const restored = await manager.restoreLatest();
    assert(restored.hub.getRepository(repo.id)?.state === 'LIVE', 'restored Hub repository state diverged');
    assert(restored.report.exactSnapshotStateRecreated, 'Hub exact snapshot state was not recreated');
  });

  const failed = results.filter(result => !result.passed);
  const evidence = {
    generatedAt: new Date().toISOString(),
    passed: failed.length === 0,
    checks: results,
    summary: {
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
    },
  };
  mkdirSync('artifacts/w13', { recursive: true });
  writeFileSync('artifacts/w13/authority-contract.json', JSON.stringify(evidence, null, 2));

  if (failed.length) {
    throw new Error(`W13 authority contract failed: ${failed.length}/${results.length}`);
  }
  console.log(`W13 authority contract passed: ${results.length}/${results.length}`);
}

void main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
