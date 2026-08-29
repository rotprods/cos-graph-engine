import assert from 'node:assert/strict';
import {
  AuthorityAgentRunService,
  InMemoryAuthorityAgentRunStore,
} from '../packages/execution/src/authority-agent-run';

const at = (minute: number): string =>
  new Date(Date.parse('2026-08-28T21:00:00.000Z') + minute * 60_000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const store = new InMemoryAuthorityAgentRunStore();
  const service = new AuthorityAgentRunService(store);
  const principalId = 'agent://builder/roberto';
  const createInput = {
    projectId: 'COS_GRAPH_ENGINE',
    principalId,
    agentId: 'agent://cos/release-orchestrator',
    operationKey: 'agent-run-release-v2.1.0',
    goal: {
      intent: 'Qualify and publish one COS release candidate',
      desiredOutcome: 'A release is published only after all authority gates pass',
      constraints: ['no automatic CD', 'no unresolved critical step'],
      projectId: 'COS_GRAPH_ENGINE',
      requestedBy: principalId,
      provenance: [{ source: 'github://rotprods/cos-graph-engine/pull/46' }],
    },
    acceptanceCriteria: [
      {
        id: 'criterion-build-green',
        description: 'The exact candidate build is green',
        required: true,
        evaluatorId: 'evaluator://cos/build-gate',
        evaluatorVersion: '1.0.0',
      },
      {
        id: 'criterion-release-observed',
        description: 'The provider confirms the release exists',
        required: true,
        evaluatorId: 'evaluator://github/release-observer',
        evaluatorVersion: '1.0.0',
      },
    ],
    correlationId: 'corr-agent-run-release-v2.1.0',
    recordedAt: at(0),
    metadata: { phase: 5 },
  };

  const concurrentCreates = await Promise.all([
    service.create(createInput),
    service.create({ ...createInput, recordedAt: at(1) }),
  ]);
  check(
    concurrentCreates.filter(result => result.appended).length === 1,
    'concurrent create retries converge to one run',
  );
  const runId = concurrentCreates[0]!.revision.runId;
  check(
    concurrentCreates.every(result => result.revision.runId === runId),
    'all create callers resolve the same run identity',
  );

  await assert.rejects(() => service.create({
    ...createInput,
    goal: {
      ...createInput.goal,
      desiredOutcome: 'A conflicting outcome under the same operation key',
    },
    recordedAt: at(2),
  }), /AGENT_RUN_OPERATION_KEY_CONFLICT/);
  assertions += 1;

  const leakedCreate = concurrentCreates[0]!.revision;
  leakedCreate.goal.intent = 'caller mutation';
  check(
    (await service.get(runId))?.goal.intent === createInput.goal.intent,
    'create receipt mutation cannot alter canonical goal',
  );

  await assert.rejects(() => service.setPlan({
    runId,
    expectedRevision: 1,
    operationKey: 'agent-run-plan-cycle',
    recordedAt: at(2),
    steps: [
      {
        id: 'step-a',
        name: 'Cycle A',
        capability: 'cos.test.a',
        critical: true,
        sideEffecting: false,
        dependencies: ['step-b'],
        acceptanceCriterionIds: ['criterion-build-green'],
        input: {},
        metadata: {},
      },
      {
        id: 'step-b',
        name: 'Cycle B',
        capability: 'cos.test.b',
        critical: true,
        sideEffecting: false,
        dependencies: ['step-a'],
        acceptanceCriterionIds: ['criterion-build-green'],
        input: {},
        metadata: {},
      },
    ],
  }), /AGENT_RUN_PLAN_CYCLE/);
  assertions += 1;
  check((await service.get(runId))?.state === 'created', 'invalid plan does not mutate run state');

  const planned = await service.setPlan({
    runId,
    expectedRevision: 1,
    operationKey: 'agent-run-plan-v1',
    recordedAt: at(3),
    steps: [
      {
        id: 'step-build',
        name: 'Build exact candidate',
        capability: 'cos.build.qualify',
        critical: true,
        sideEffecting: false,
        dependencies: [],
        acceptanceCriterionIds: ['criterion-build-green'],
        input: { candidateSha: 'abc123' },
        metadata: { lane: 'qualification' },
      },
      {
        id: 'step-release',
        name: 'Publish release',
        capability: 'github.release.publish',
        critical: true,
        sideEffecting: true,
        dependencies: ['step-build'],
        acceptanceCriterionIds: ['criterion-release-observed'],
        input: { tag: 'v2.1.0' },
        metadata: { lane: 'provider' },
      },
    ],
  });
  check(planned.revision.state === 'planned' && planned.revision.plan.length === 2, 'valid DAG is stored');
  check(
    planned.revision.plan.every(step => typeof step.inputHash === 'string'),
    'every plan step input is content-addressed',
  );

  const started = await service.start({
    runId,
    expectedRevision: 2,
    operationKey: 'agent-run-start-v1',
    recordedAt: at(4),
  });
  check(started.revision.state === 'running', 'planned run enters running state');

  await assert.rejects(() => service.recordStep({
    runId,
    expectedRevision: 3,
    operationKey: 'agent-run-release-too-early',
    recordedAt: at(5),
    result: {
      stepId: 'step-release',
      attempt: 1,
      outcome: 'accepted',
      result: { releaseId: 42 },
      resultHash: null,
      error: null,
      evidenceRefs: ['provider://github/release/42'],
      sideEffectOperationId: 'operation://release/42',
      sideEffectTerminalState: 'committed',
      startedAt: at(4.5),
      completedAt: at(5),
      metadata: {},
    },
  }), /AGENT_RUN_STEP_DEPENDENCY_UNSATISFIED/);
  assertions += 1;
  check((await service.get(runId))?.revision === 3, 'dependency rejection appends no revision');

  const buildAccepted = await service.recordStep({
    runId,
    expectedRevision: 3,
    operationKey: 'agent-run-build-accepted',
    recordedAt: at(6),
    result: {
      stepId: 'step-build',
      attempt: 1,
      outcome: 'accepted',
      result: { buildHash: 'build-abc123', passed: true },
      resultHash: null,
      error: null,
      evidenceRefs: ['artifact://build/build-abc123'],
      sideEffectOperationId: null,
      sideEffectTerminalState: null,
      startedAt: at(5),
      completedAt: at(6),
      metadata: { executor: 'manual-qualification' },
    },
  });
  check(buildAccepted.revision.revision === 4, 'accepted prerequisite appends one run revision');

  await assert.rejects(() => service.recordStep({
    runId,
    expectedRevision: 4,
    operationKey: 'agent-run-release-no-side-effect-evidence',
    recordedAt: at(7),
    result: {
      stepId: 'step-release',
      attempt: 1,
      outcome: 'accepted',
      result: { releaseId: 42 },
      resultHash: null,
      error: null,
      evidenceRefs: ['provider://github/release/42'],
      sideEffectOperationId: null,
      sideEffectTerminalState: null,
      startedAt: at(6),
      completedAt: at(7),
      metadata: {},
    },
  }), /AGENT_RUN_SIDE_EFFECT_EVIDENCE_MISSING/);
  assertions += 1;

  const releaseFailed = await service.recordStep({
    runId,
    expectedRevision: 4,
    operationKey: 'agent-run-release-attempt-1-failed',
    recordedAt: at(8),
    result: {
      stepId: 'step-release',
      attempt: 1,
      outcome: 'failed',
      result: null,
      resultHash: null,
      error: {
        code: 'PROVIDER_TIMEOUT',
        message: 'Provider did not return an accepted outcome',
        retryable: true,
        details: { timeoutMs: 30_000 },
      },
      evidenceRefs: ['near-miss://provider-timeout/1'],
      sideEffectOperationId: 'operation://release/attempt-1',
      sideEffectTerminalState: 'failed',
      startedAt: at(7),
      completedAt: at(8),
      metadata: {},
    },
  });
  check(releaseFailed.revision.revision === 5, 'failed attempt is retained as immutable evidence');

  await assert.rejects(() => service.recordStep({
    runId,
    expectedRevision: 5,
    operationKey: 'agent-run-release-attempt-3-invalid',
    recordedAt: at(9),
    result: {
      stepId: 'step-release',
      attempt: 3,
      outcome: 'accepted',
      result: { releaseId: 43 },
      resultHash: null,
      error: null,
      evidenceRefs: ['provider://github/release/43'],
      sideEffectOperationId: 'operation://release/attempt-3',
      sideEffectTerminalState: 'committed',
      startedAt: at(8),
      completedAt: at(9),
      metadata: {},
    },
  }), /AGENT_RUN_STEP_ATTEMPT_SEQUENCE/);
  assertions += 1;

  const releaseAccepted = await service.recordStep({
    runId,
    expectedRevision: 5,
    operationKey: 'agent-run-release-attempt-2-accepted',
    recordedAt: at(10),
    result: {
      stepId: 'step-release',
      attempt: 2,
      outcome: 'accepted',
      result: { releaseId: 43, tag: 'v2.1.0' },
      resultHash: null,
      error: null,
      evidenceRefs: ['provider://github/release/43', 'operation://release/attempt-2'],
      sideEffectOperationId: 'operation://release/attempt-2',
      sideEffectTerminalState: 'committed',
      startedAt: at(9),
      completedAt: at(10),
      metadata: { reconciled: true },
    },
  });
  check(releaseAccepted.revision.revision === 6, 'second attempt can become accepted after first failure');

  await assert.rejects(() => service.complete({
    runId,
    expectedRevision: 6,
    operationKey: 'agent-run-complete-evaluator-mismatch',
    recordedAt: at(11),
    criteria: [
      {
        criterionId: 'criterion-build-green',
        passed: true,
        evaluatorId: 'evaluator://wrong',
        evaluatorVersion: '1.0.0',
        evidenceRefs: ['artifact://build/build-abc123'],
        evaluatedAt: at(11),
        details: {},
      },
      {
        criterionId: 'criterion-release-observed',
        passed: true,
        evaluatorId: 'evaluator://github/release-observer',
        evaluatorVersion: '1.0.0',
        evidenceRefs: ['provider://github/release/43'],
        evaluatedAt: at(11),
        details: {},
      },
    ],
  }), /AGENT_RUN_EVALUATOR_MISMATCH/);
  assertions += 1;

  await assert.rejects(() => service.complete({
    runId,
    expectedRevision: 6,
    operationKey: 'agent-run-complete-false-despite-positive-text',
    recordedAt: at(12),
    criteria: [
      {
        criterionId: 'criterion-build-green',
        passed: false,
        evaluatorId: 'evaluator://cos/build-gate',
        evaluatorVersion: '1.0.0',
        evidenceRefs: ['artifact://text/says-all-tests-passed'],
        evaluatedAt: at(12),
        details: { text: 'all tests passed' },
      },
      {
        criterionId: 'criterion-release-observed',
        passed: true,
        evaluatorId: 'evaluator://github/release-observer',
        evaluatorVersion: '1.0.0',
        evidenceRefs: ['provider://github/release/43'],
        evaluatedAt: at(12),
        details: {},
      },
    ],
  }), /AGENT_RUN_ACCEPTANCE_NOT_MET/);
  assertions += 1;
  check((await service.get(runId))?.state === 'running', 'failed completion gate leaves run non-terminal');

  const completed = await service.complete({
    runId,
    expectedRevision: 6,
    operationKey: 'agent-run-complete-accepted',
    recordedAt: at(13),
    terminalReason: 'all required machine-evaluated criteria passed',
    criteria: [
      {
        criterionId: 'criterion-build-green',
        passed: true,
        evaluatorId: 'evaluator://cos/build-gate',
        evaluatorVersion: '1.0.0',
        evidenceRefs: ['artifact://build/build-abc123'],
        evaluatedAt: at(13),
        details: { buildHash: 'build-abc123' },
      },
      {
        criterionId: 'criterion-release-observed',
        passed: true,
        evaluatorId: 'evaluator://github/release-observer',
        evaluatorVersion: '1.0.0',
        evidenceRefs: ['provider://github/release/43'],
        evaluatedAt: at(13),
        details: { providerId: 43 },
      },
    ],
  });
  check(completed.revision.state === 'completed', 'explicit evidence gates produce terminal completion');

  const restarted = new AuthorityAgentRunService(store);
  const restored = await restarted.get(runId);
  check(restored?.state === 'completed' && restored.terminal, 'fresh service reconstructs completed run');
  check(restored?.stepResults.length === 3, 'restored run retains failed and accepted attempts');
  check(restored?.criterionResults.every(item => item.passed), 'restored run retains explicit criterion outcomes');

  const history = await restarted.history(runId);
  check(history.length === 7, 'run keeps create/plan/start/three step outcomes/completion revisions');
  check(history[0]!.systemUntil === at(3) && history.at(-1)!.systemUntil === null, 'run systemUntil is derived from successor revisions');
  history[0]!.goal.intent = 'tampered';
  check((await restarted.history(runId))[0]!.goal.intent === createInput.goal.intent, 'run history reads are detached');

  await assert.rejects(() => restarted.start({
    runId,
    expectedRevision: 7,
    operationKey: 'agent-run-illegal-restart-after-complete',
    recordedAt: at(14),
  }), /AGENT_RUN_INVALID_TRANSITION|AGENT_RUN_TERMINAL/);
  assertions += 1;

  console.log(`Authority agent-run contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
