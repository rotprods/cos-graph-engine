import assert from 'node:assert/strict';
import {
  AuthorityAgentRunPostgresStore,
  AuthorityAgentRunService,
} from '../packages/execution/src/authority-phase05-clean';
import { FakeAuthorityAgentRunPostgres } from './fixtures/fake-authority-agent-run-postgres';

const at = (minute: number): string =>
  new Date(Date.parse('2026-08-28T22:00:00.000Z') + minute * 60_000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const db = new FakeAuthorityAgentRunPostgres();
  const store = new AuthorityAgentRunPostgresStore(db);
  await store.ensureSchema();
  const service = new AuthorityAgentRunService(store);
  const principalId = 'agent://builder/roberto';
  const createInput = {
    projectId: 'COS_GRAPH_ENGINE',
    principalId,
    agentId: 'agent://cos/phase05-postgres-contract',
    operationKey: 'postgres-agent-run-create-v1',
    goal: {
      intent: 'Prove durable agent-run reconstruction',
      desiredOutcome: 'A completed evidence-backed run survives service restart',
      constraints: ['append-only', 'no implicit success'],
      projectId: 'COS_GRAPH_ENGINE',
      requestedBy: principalId,
      provenance: [{ source: 'github://rotprods/cos-graph-engine/pull/50' }],
    },
    acceptanceCriteria: [{
      id: 'criterion-evidence-recorded',
      description: 'The exact step evidence is accepted',
      required: true,
      evaluatorId: 'evaluator://cos/evidence-contract',
      evaluatorVersion: '1.0.0',
    }],
    correlationId: 'corr-postgres-agent-run-v1',
    recordedAt: at(0),
    metadata: { phase: 5 },
  };

  const created = await service.create(createInput);
  check(created.appended && created.revision.revision === 1, 'Postgres store appends initial run revision');
  const retry = await service.create({ ...createInput, recordedAt: at(1) });
  check(!retry.appended && retry.revision.runId === created.revision.runId, 'late create retry converges to the original run');

  await assert.rejects(() => service.create({
    ...createInput,
    goal: { ...createInput.goal, desiredOutcome: 'conflicting meaning' },
    recordedAt: at(1),
  }), /AGENT_RUN_OPERATION_KEY_CONFLICT/);
  assertions += 1;

  const runId = created.revision.runId;
  const planned = await service.setPlan({
    runId,
    expectedRevision: 1,
    operationKey: 'postgres-agent-run-plan-v1',
    recordedAt: at(2),
    steps: [{
      id: 'step-evidence',
      name: 'Record exact evidence',
      capability: 'cos.evidence.record',
      critical: true,
      sideEffecting: false,
      dependencies: [],
      acceptanceCriterionIds: ['criterion-evidence-recorded'],
      input: { evidenceId: 'artifact://phase05/postgres-run' },
      metadata: {},
    }],
  });
  check(planned.revision.state === 'planned' && planned.revision.revision === 2, 'plan is append-only revision 2');

  const started = await service.start({
    runId,
    expectedRevision: 2,
    operationKey: 'postgres-agent-run-start-v1',
    recordedAt: at(3),
  });
  check(started.revision.state === 'running' && started.revision.revision === 3, 'start is append-only revision 3');

  await assert.rejects(() => service.start({
    runId,
    expectedRevision: 2,
    operationKey: 'postgres-agent-run-stale-start',
    recordedAt: at(4),
  }), /STALE_AGENT_RUN_REVISION|AGENT_RUN_INVALID_TRANSITION/);
  assertions += 1;

  const stepped = await service.recordStep({
    runId,
    expectedRevision: 3,
    operationKey: 'postgres-agent-run-step-v1',
    recordedAt: at(4),
    result: {
      stepId: 'step-evidence',
      attempt: 1,
      outcome: 'accepted',
      result: { evidenceHash: 'evidence-abc' },
      resultHash: null,
      error: null,
      evidenceRefs: ['artifact://phase05/postgres-run'],
      sideEffectOperationId: null,
      sideEffectTerminalState: null,
      startedAt: at(3),
      completedAt: at(4),
      metadata: {},
    },
  });
  check(stepped.revision.revision === 4 && stepped.revision.stepResults.length === 1, 'accepted step is retained as revision 4');

  const completed = await service.complete({
    runId,
    expectedRevision: 4,
    operationKey: 'postgres-agent-run-complete-v1',
    recordedAt: at(5),
    criteria: [{
      criterionId: 'criterion-evidence-recorded',
      passed: true,
      evaluatorId: 'evaluator://cos/evidence-contract',
      evaluatorVersion: '1.0.0',
      evidenceRefs: ['artifact://phase05/postgres-run'],
      evaluatedAt: at(5),
      details: { evidenceHash: 'evidence-abc' },
    }],
  });
  check(completed.revision.state === 'completed' && completed.revision.revision === 5, 'explicit criteria produce terminal revision 5');

  const restartedStore = new AuthorityAgentRunPostgresStore(db);
  const restarted = new AuthorityAgentRunService(restartedStore);
  const restored = await restarted.get(runId);
  check(restored?.terminal && restored.state === 'completed', 'fresh service reconstructs completed run from Postgres rows');
  check(restored?.stepResults[0]?.resultHash === stepped.revision.stepResults[0]?.resultHash, 'step evidence hash survives restart');

  const history = await restarted.history(runId);
  check(history.length === 5, 'all five immutable run revisions remain available');
  check(history[0]?.systemUntil === at(2) && history.at(-1)?.systemUntil === null, 'systemUntil is derived from successor rows');
  history[0]!.goal.intent = 'tampered';
  check((await restarted.history(runId))[0]?.goal.intent === createInput.goal.intent, 'Postgres history reads are detached');

  const rows = db.snapshotRevisions();
  check(rows.length === 5, 'fixture contains exactly five revision rows');
  check(!db.statements.some(sql => /^(update|delete|truncate)\b/i.test(sql)), 'agent-run store never updates or deletes historical rows');
  check(db.statements.some(sql => sql.includes('pg_advisory_xact_lock')), 'agent-run writers are serialized with a transaction advisory lock');

  const lastRevisionId = rows.at(-1)!.revision_id;
  db.corruptRevision(lastRevisionId, row => { row.terminal_reason = 'tampered'; });
  await assert.rejects(() => restarted.get(runId), /AGENT_RUN_CONTENT_HASH_MISMATCH/);
  assertions += 1;

  console.log(`Authority agent-run Postgres contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
