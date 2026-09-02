import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  COS_GRAPH_CHECKPOINT_LEGACY_VERSION,
  COS_GRAPH_CHECKPOINT_VERSION,
  COS_GRAPH_EXECUTION_PLAN_VERSION,
  DurableGraphStore,
  GraphCheckpointCompareAndSwapResult,
  GraphCheckpointDriver,
  GraphCheckpointError,
  GraphCheckpointRuntime,
  GraphCheckpointStore,
  GraphExecutionPlan,
  GraphWorkflowCheckpoint,
  GraphWorkflowDecisionInput,
  GraphWorkflowError,
  SQLiteGraphCheckpointDriver,
  SQLiteGraphDurabilityDriver,
  canonicalGraphHash,
  createGraphRuntime,
  createGraphStateModule,
  parseGraphWorkflowCheckpoint,
} from '../packages/graph/src/framework';

async function expectWorkflowError(
  action: () => Promise<unknown>,
  code: GraphWorkflowError['code'],
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof GraphWorkflowError);
    assert.equal(error.code, code);
    return true;
  });
}

async function expectCheckpointError(
  action: () => Promise<unknown>,
  code: GraphCheckpointError['code'],
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof GraphCheckpointError);
    assert.equal(error.code, code);
    return true;
  });
}

class InnerDecisionTamperDriver implements GraphCheckpointDriver {
  constructor(private readonly delegate: GraphCheckpointDriver) {}

  async load(runId: string): Promise<unknown | null> {
    const value = await this.delegate.load(runId);
    if (value === null) return null;
    const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    const decisions = clone.decisions;
    if (!Array.isArray(decisions) || decisions.length === 0) return clone;
    const decision = decisions[0];
    if (typeof decision !== 'object' || decision === null || Array.isArray(decision)) return clone;
    (decision as Record<string, unknown>).requestHash = 'f'.repeat(64);
    const { checkpointHash: _ignored, ...payload } = clone;
    clone.checkpointHash = canonicalGraphHash(payload);
    return clone;
  }

  compareAndSwap(
    expectedRevision: number,
    checkpoint: GraphWorkflowCheckpoint,
  ): GraphCheckpointCompareAndSwapResult | Promise<GraphCheckpointCompareAndSwapResult> {
    return this.delegate.compareAndSwap(expectedRevision, checkpoint);
  }
}

function approvalPlan(graphId: string): GraphExecutionPlan {
  return {
    schema: COS_GRAPH_EXECUTION_PLAN_VERSION,
    id: `approval-${graphId}`,
    version: '1.0.0',
    steps: [{
      id: 'commit-approved-node',
      capabilityId: 'cos.graph.state.commit',
      mode: 'mutate',
      graph: { id: graphId, revision: '0' },
      input: {
        kind: 'literal',
        value: {
          graphId,
          expectedRevision: 0,
          mutations: [{
            type: 'node.put',
            node: { id: 'authorized-node', type: 'decision', properties: { approved: true } },
          }],
        },
      },
      approval: {
        reason: 'Human approval is required before mutating the durable graph',
        payload: { graphId, operation: 'node.put' },
        metadata: { requiredControl: 'human-in-the-loop' },
      },
    }],
  };
}

function approvalDecision(
  checkpoint: GraphWorkflowCheckpoint,
  overrides: Partial<GraphWorkflowDecisionInput> = {},
): GraphWorkflowDecisionInput {
  assert.ok(checkpoint.interrupt);
  return {
    expectedRevision: checkpoint.revision,
    interruptId: checkpoint.interrupt.id,
    decisionId: 'decision-approve-1',
    outcome: 'approved',
    actorId: 'operator-1',
    comment: 'Reviewed and approved',
    payload: { ticket: 'CAB-42' },
    ...overrides,
  };
}

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cos-graph-m2c-'));
  const graphDatabasePath = join(directory, 'graph-state.sqlite');
  const checkpointDatabasePath = join(directory, 'workflow-checkpoints.sqlite');
  let workflowNow = 20_000;
  let runtimeNow = 3_000;

  try {
    const durableState = new DurableGraphStore(new SQLiteGraphDurabilityDriver(graphDatabasePath), {
      clock: () => runtimeNow,
    });
    const stateModule = createGraphStateModule(durableState, {
      moduleId: 'cos.graph.state.sqlite',
      name: 'COS SQLite Durable Graph State',
    });
    const runtime = createGraphRuntime({
      clock: () => runtimeNow++,
      policy: { authorize: () => true },
    });
    await runtime.install(stateModule.module);

    const checkpoints = new GraphCheckpointStore(new SQLiteGraphCheckpointDriver(checkpointDatabasePath));
    const executionWorker = new GraphCheckpointRuntime(runtime, checkpoints, {
      workerId: 'executor-1',
      leaseDurationMs: 500,
      clock: () => workflowNow,
    });
    const plan = approvalPlan('approved-graph');
    const runInput = { source: 'human-review-test' };

    // The capability must not run merely because a workflow reached the gated step.
    const interrupted = await executionWorker.run(plan, 'approval-run-1', runInput);
    assert.equal(interrupted.status, 'interrupted');
    assert.equal(interrupted.nextStepIndex, 0);
    assert.equal(interrupted.steps.length, 0);
    assert.equal(interrupted.lease, null);
    assert.ok(interrupted.interrupt?.id.startsWith('int_'));
    assert.equal(interrupted.interrupt?.stepId, 'commit-approved-node');
    assert.equal(interrupted.interrupt?.payload && typeof interrupted.interrupt.payload === 'object', true);
    assert.equal(await durableState.has('approved-graph'), false, 'approval gate must precede graph side effect');

    // Interrupted state survives a real checkpoint connection restart.
    await checkpoints.close();
    const restartedCheckpoints = new GraphCheckpointStore(new SQLiteGraphCheckpointDriver(checkpointDatabasePath));
    const recoveredInterrupt = await restartedCheckpoints.load('approval-run-1');
    assert.ok(recoveredInterrupt);
    assert.equal(recoveredInterrupt.status, 'interrupted');
    assert.equal(recoveredInterrupt.checkpointHash, interrupted.checkpointHash);

    const decision = approvalDecision(recoveredInterrupt);

    // No implicit trust path: decision APIs fail closed without an authorization policy.
    const noPolicyControl = new GraphCheckpointRuntime(runtime, restartedCheckpoints, {
      workerId: 'control-no-policy',
      clock: () => workflowNow,
    });
    await expectWorkflowError(
      () => noPolicyControl.decide('approval-run-1', decision),
      'WORKFLOW_DECISION_POLICY_REQUIRED',
    );
    assert.equal((await restartedCheckpoints.load('approval-run-1'))?.revision, recoveredInterrupt.revision);

    const deniedControl = new GraphCheckpointRuntime(runtime, restartedCheckpoints, {
      workerId: 'control-denied',
      clock: () => workflowNow,
      decisionPolicy: { authorize: () => false },
    });
    await expectWorkflowError(
      () => deniedControl.decide('approval-run-1', decision),
      'WORKFLOW_DECISION_DENIED',
    );
    assert.equal((await restartedCheckpoints.load('approval-run-1'))?.status, 'interrupted');

    const brokenPolicyControl = new GraphCheckpointRuntime(runtime, restartedCheckpoints, {
      workerId: 'control-broken',
      clock: () => workflowNow,
      decisionPolicy: {
        authorize() {
          throw new Error('identity provider unavailable');
        },
      },
    });
    await expectWorkflowError(
      () => brokenPolicyControl.decide('approval-run-1', decision),
      'WORKFLOW_DECISION_POLICY_FAILED',
    );

    let policyChecks = 0;
    const approvedControl = new GraphCheckpointRuntime(runtime, restartedCheckpoints, {
      workerId: 'control-approved',
      clock: () => workflowNow,
      decisionPolicy: {
        authorize(request) {
          policyChecks += 1;
          assert.equal(request.runId, 'approval-run-1');
          assert.equal(request.decision.actorId, 'operator-1');
          assert.equal(request.decision.outcome, 'approved');
          return request.decision.actorId === 'operator-1';
        },
      },
    });

    workflowNow = 20_100;
    const approved = await approvedControl.decide('approval-run-1', decision);
    assert.equal(approved.status, 'running');
    assert.equal(approved.interrupt, null);
    assert.equal(approved.lease, null);
    assert.equal(approved.decisions.length, 1);
    assert.equal(approved.decisions[0]?.outcome, 'approved');
    assert.equal(approved.decisions[0]?.stepId, 'commit-approved-node');
    assert.equal(await durableState.has('approved-graph'), false, 'approval decision itself must not execute the capability');

    // Decision IDs are payload-bound and replay before revision checks.
    const exactDecisionReplay = await approvedControl.decide('approval-run-1', decision);
    assert.equal(exactDecisionReplay.checkpointHash, approved.checkpointHash);
    assert.ok(policyChecks >= 2, 'authorization policy also protects exact decision replays');
    await expectWorkflowError(
      () => approvedControl.decide('approval-run-1', {
        ...decision,
        comment: 'changed after acceptance',
      }),
      'WORKFLOW_DECISION_CONFLICT',
    );

    // Execution resumes only after approval, then the original M2B idempotency laws apply.
    const resumedWorker = new GraphCheckpointRuntime(runtime, restartedCheckpoints, {
      workerId: 'executor-2',
      leaseDurationMs: 500,
      clock: () => workflowNow,
    });
    workflowNow = 20_200;
    const succeeded = await resumedWorker.run(plan, 'approval-run-1', runInput);
    assert.equal(succeeded.status, 'succeeded');
    assert.equal(succeeded.steps.length, 1);
    assert.equal(succeeded.decisions.length, 1);
    assert.equal((await durableState.events('approved-graph')).length, 1);
    assert.equal((await durableState.snapshot('approved-graph')).graph.revision, 1);

    // Accepted human decision remains exactly replayable even after later workflow revisions.
    const replayAfterSuccess = await approvedControl.decide('approval-run-1', decision);
    assert.equal(replayAfterSuccess.status, 'succeeded');
    assert.equal(replayAfterSuccess.decisions.length, 1);

    // Rejection is a durable terminal outcome and never invokes the guarded side effect.
    const rejectionPlan = approvalPlan('rejected-graph');
    workflowNow = 21_000;
    const rejectedPause = await resumedWorker.run(rejectionPlan, 'approval-run-reject', { source: 'reject-test' });
    assert.equal(rejectedPause.status, 'interrupted');
    assert.equal(await durableState.has('rejected-graph'), false);

    const rejectionControl = new GraphCheckpointRuntime(runtime, restartedCheckpoints, {
      workerId: 'control-reject',
      clock: () => workflowNow,
      decisionPolicy: { authorize: () => true },
    });
    workflowNow = 21_100;
    const rejected = await rejectionControl.decide('approval-run-reject', approvalDecision(rejectedPause, {
      decisionId: 'decision-reject-1',
      outcome: 'rejected',
      actorId: 'operator-2',
      comment: 'Risk not accepted',
      payload: { ticket: 'CAB-43' },
    }));
    assert.equal(rejected.status, 'cancelled');
    assert.equal(rejected.interrupt, null);
    assert.equal(rejected.decisions.at(-1)?.outcome, 'rejected');
    assert.equal(await durableState.has('rejected-graph'), false);

    const cancelledReplay = await resumedWorker.run(rejectionPlan, 'approval-run-reject', { source: 'reject-test' });
    assert.equal(cancelledReplay.status, 'cancelled');
    assert.equal(await durableState.has('rejected-graph'), false);

    // Inner decision request hash is independently checked even if an attacker recomputes the outer checkpoint hash.
    const tamperBase = new SQLiteGraphCheckpointDriver(checkpointDatabasePath);
    const tamperedStore = new GraphCheckpointStore(new InnerDecisionTamperDriver(tamperBase));
    await expectCheckpointError(() => tamperedStore.load('approval-run-1'), 'CHECKPOINT_IMAGE_INVALID');
    tamperBase.close();

    // v1alpha1 checkpoints remain readable and are normalized in memory to v1alpha2.
    const legacyPayload = {
      schema: COS_GRAPH_CHECKPOINT_LEGACY_VERSION,
      runId: 'legacy-run',
      planId: 'legacy-plan',
      planHash: 'legacy-plan-hash',
      inputHash: 'legacy-input-hash',
      revision: 1,
      status: 'running' as const,
      nextStepIndex: 0,
      runInput: null,
      steps: [],
      lease: null,
      failure: null,
      createdAt: 1,
      updatedAt: 1,
    };
    const migrated = parseGraphWorkflowCheckpoint({
      ...legacyPayload,
      checkpointHash: canonicalGraphHash(legacyPayload),
    }, 'legacy-run');
    assert.equal(migrated.schema, COS_GRAPH_CHECKPOINT_VERSION);
    assert.equal(migrated.status, 'running');
    assert.equal(migrated.interrupt, null);
    assert.deepEqual(migrated.decisions, []);
    assert.notEqual(migrated.checkpointHash, canonicalGraphHash(legacyPayload));

    await restartedCheckpoints.close();
    await durableState.close();
    console.log('COS Graph Framework M2C: durable HITL interrupt/decision suite passed');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

void main();
