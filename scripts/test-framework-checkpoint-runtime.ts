import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  COS_GRAPH_EXECUTION_PLAN_VERSION,
  COS_GRAPH_PROTOCOL_VERSION,
  DurableGraphStore,
  GraphCheckpointCompareAndSwapResult,
  GraphCheckpointDriver,
  GraphCheckpointError,
  GraphCheckpointRuntime,
  GraphCheckpointStore,
  GraphExecutionPlan,
  GraphSchema,
  GraphWorkflowCheckpoint,
  GraphWorkflowError,
  SQLiteGraphCheckpointDriver,
  SQLiteGraphDurabilityDriver,
  createGraphRuntime,
  createGraphStateModule,
  defineGraphCapability,
  defineGraphModule,
} from '../packages/graph/src/framework';

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

class FailCompletedStepOnceDriver implements GraphCheckpointDriver {
  private failed = false;

  constructor(private readonly delegate: GraphCheckpointDriver) {}

  load(runId: string): unknown | null | Promise<unknown | null> {
    return this.delegate.load(runId);
  }

  compareAndSwap(
    expectedRevision: number,
    checkpoint: GraphWorkflowCheckpoint,
  ): GraphCheckpointCompareAndSwapResult | Promise<GraphCheckpointCompareAndSwapResult> {
    if (!this.failed && checkpoint.steps.length === 1) {
      this.failed = true;
      throw new Error('simulated checkpoint persistence outage after graph side effect');
    }
    return this.delegate.compareAndSwap(expectedRevision, checkpoint);
  }

  close(): void | Promise<void> {
    return this.delegate.close?.();
  }
}

class TamperedCheckpointReadDriver implements GraphCheckpointDriver {
  constructor(private readonly delegate: GraphCheckpointDriver) {}

  async load(runId: string): Promise<unknown | null> {
    const value = await this.delegate.load(runId);
    if (value === null) return null;
    const clone = JSON.parse(JSON.stringify(value)) as unknown;
    if (typeof clone === 'object' && clone !== null && !Array.isArray(clone)) {
      (clone as Record<string, unknown>).checkpointHash = '0'.repeat(64);
    }
    return clone;
  }

  compareAndSwap(
    expectedRevision: number,
    checkpoint: GraphWorkflowCheckpoint,
  ): GraphCheckpointCompareAndSwapResult | Promise<GraphCheckpointCompareAndSwapResult> {
    return this.delegate.compareAndSwap(expectedRevision, checkpoint);
  }
}

const booleanSchema: GraphSchema<boolean> = {
  parse(value: unknown): boolean {
    if (typeof value !== 'boolean') throw new TypeError('expected boolean');
    return value;
  },
};

function createUnsafeModule(counter: { value: number }) {
  const unsafe = defineGraphCapability({
    descriptor: {
      id: 'cos.test.unsafe-side-effect',
      kind: 'adapter',
      version: '1.0.0-alpha.1',
      maturity: 'experimental',
      description: 'Test capability proving checkpoint runtime rejects non-idempotent side effects',
      modes: ['write'],
      determinism: 'deterministic',
      sideEffects: 'external',
      idempotency: 'none',
    },
    input: booleanSchema,
    output: booleanSchema,
    execute(input) {
      counter.value += 1;
      return input;
    },
  });
  return defineGraphModule({
    manifest: {
      id: 'cos.test.unsafe-module',
      name: 'Unsafe test module',
      version: '1.0.0-alpha.1',
      protocol: COS_GRAPH_PROTOCOL_VERSION,
      maturity: 'experimental',
      description: 'Only used by the checkpoint gauntlet',
      capabilities: [unsafe.descriptor],
    },
    capabilities: [unsafe],
  });
}

function durablePlan(): GraphExecutionPlan {
  return {
    schema: COS_GRAPH_EXECUTION_PLAN_VERSION,
    id: 'durable-enterprise-bootstrap',
    version: '1.0.0',
    steps: [{
      id: 'commit-enterprise-node',
      capabilityId: 'cos.graph.state.commit',
      mode: 'mutate',
      graph: { id: 'enterprise', revision: '0' },
      input: {
        kind: 'literal',
        value: {
          graphId: 'enterprise',
          expectedRevision: 0,
          mutations: [{
            type: 'node.put',
            node: { id: 'xai', type: 'company', properties: { domain: 'ai' } },
          }],
        },
      },
      metadata: { purpose: 'checkpoint-crash-recovery-gauntlet' },
    }],
  };
}

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cos-graph-m2b-'));
  const graphDatabasePath = join(directory, 'graph-state.sqlite');
  const checkpointDatabasePath = join(directory, 'workflow-checkpoints.sqlite');
  let workflowNow = 10_000;
  let runtimeNow = 1_000;

  try {
    const stateDriver1 = new SQLiteGraphDurabilityDriver(graphDatabasePath);
    const durableState1 = new DurableGraphStore(stateDriver1, { clock: () => runtimeNow });
    const stateModule1 = createGraphStateModule(durableState1, {
      moduleId: 'cos.graph.state.sqlite',
      name: 'COS SQLite Durable Graph State',
      description: 'Durable state module used by the checkpoint runtime gauntlet',
    });
    const runtime1 = createGraphRuntime({
      clock: () => runtimeNow++,
      policy: {
        authorize(request) {
          assert.equal(request.moduleId, 'cos.graph.state.sqlite');
          assert.equal(request.capability.id, 'cos.graph.state.commit');
          assert.equal(request.mode, 'mutate');
          assert.ok(request.idempotencyKey?.startsWith('gw_'));
          assert.equal(request.metadata.workflowRunId, 'enterprise-run-1');
          return true;
        },
      },
    });
    await runtime1.install(stateModule1.module);

    const sqliteCheckpoint1 = new SQLiteGraphCheckpointDriver(checkpointDatabasePath);
    const failingCheckpointDriver = new FailCompletedStepOnceDriver(sqliteCheckpoint1);
    const checkpoints1 = new GraphCheckpointStore(failingCheckpointDriver);
    const worker1 = new GraphCheckpointRuntime(runtime1, checkpoints1, {
      workerId: 'worker-1',
      leaseDurationMs: 100,
      clock: () => workflowNow,
    });
    const plan = durablePlan();
    const runInput = { requestedBy: 'integration-test' };

    // Simulate the hardest crash window: graph side effect committed, but the
    // completed-step checkpoint cannot be persisted.
    await expectCheckpointError(
      () => worker1.run(plan, 'enterprise-run-1', runInput),
      'CHECKPOINT_DRIVER_FAILURE',
    );
    const afterCrash = await durableState1.snapshot('enterprise');
    assert.equal(afterCrash.graph.revision, 1);
    assert.equal(afterCrash.eventCount, 1);

    const persistedPreStep = await checkpoints1.load('enterprise-run-1');
    assert.ok(persistedPreStep);
    assert.equal(persistedPreStep.status, 'running');
    assert.equal(persistedPreStep.nextStepIndex, 0);
    assert.equal(persistedPreStep.steps.length, 0);
    assert.equal(persistedPreStep.lease?.ownerId, 'worker-1');

    // A second worker may not replay a side effect while the first lease is active.
    const impatientWorker = new GraphCheckpointRuntime(runtime1, checkpoints1, {
      workerId: 'worker-2',
      leaseDurationMs: 100,
      clock: () => workflowNow,
    });
    await expectWorkflowError(
      () => impatientWorker.run(plan, 'enterprise-run-1', runInput),
      'WORKFLOW_LEASE_HELD',
    );
    assert.equal((await durableState1.events('enterprise')).length, 1);

    await checkpoints1.close();
    await durableState1.close();

    // Fresh process-facing instances recover both state and checkpoint from disk.
    workflowNow = 10_200;
    runtimeNow = 2_000;
    const stateDriver2 = new SQLiteGraphDurabilityDriver(graphDatabasePath);
    const durableState2 = new DurableGraphStore(stateDriver2, { clock: () => runtimeNow });
    const stateModule2 = createGraphStateModule(durableState2, {
      moduleId: 'cos.graph.state.sqlite',
      name: 'COS SQLite Durable Graph State',
    });
    const runtime2 = createGraphRuntime({
      clock: () => runtimeNow++,
      policy: { authorize: () => true },
    });
    await runtime2.install(stateModule2.module);
    const checkpoints2 = new GraphCheckpointStore(new SQLiteGraphCheckpointDriver(checkpointDatabasePath));
    const worker2 = new GraphCheckpointRuntime(runtime2, checkpoints2, {
      workerId: 'worker-2',
      leaseDurationMs: 100,
      clock: () => workflowNow,
    });

    const resumed = await worker2.run(plan, 'enterprise-run-1', runInput);
    assert.equal(resumed.status, 'succeeded');
    assert.equal(resumed.nextStepIndex, 1);
    assert.equal(resumed.steps.length, 1);
    assert.equal(resumed.lease, null);
    const persistedOutput = resumed.steps[0]?.output;
    assert.ok(typeof persistedOutput === 'object' && persistedOutput !== null && !Array.isArray(persistedOutput));
    assert.equal((persistedOutput as Record<string, unknown>).idempotentReplay, true);
    assert.equal((await durableState2.events('enterprise')).length, 1, 'resume must not duplicate committed graph side effects');
    assert.equal((await durableState2.snapshot('enterprise')).graph.revision, 1);

    // A completed workflow is an exact deterministic replay barrier: no capability rerun.
    const completedAgain = await worker2.run(plan, 'enterprise-run-1', runInput);
    assert.equal(completedAgain.checkpointHash, resumed.checkpointHash);
    assert.equal((await durableState2.events('enterprise')).length, 1);

    const changedPlan: GraphExecutionPlan = {
      ...plan,
      version: '1.0.1',
    };
    await expectWorkflowError(
      () => worker2.run(changedPlan, 'enterprise-run-1', runInput),
      'WORKFLOW_PLAN_MISMATCH',
    );
    await expectWorkflowError(
      () => worker2.run(plan, 'enterprise-run-1', { requestedBy: 'different-input' }),
      'WORKFLOW_INPUT_MISMATCH',
    );

    // Persisted checkpoint bytes are revalidated on every load.
    const tamperBase = new SQLiteGraphCheckpointDriver(checkpointDatabasePath);
    const tampered = new GraphCheckpointStore(new TamperedCheckpointReadDriver(tamperBase));
    await expectCheckpointError(() => tampered.load('enterprise-run-1'), 'CHECKPOINT_IMAGE_INVALID');
    tamperBase.close();

    // Unsafe side effects are rejected before execution and before checkpoint creation.
    const unsafeCounter = { value: 0 };
    await runtime2.install(createUnsafeModule(unsafeCounter));
    const unsafeRun = new GraphCheckpointRuntime(runtime2, checkpoints2, {
      workerId: 'worker-unsafe',
      leaseDurationMs: 100,
      clock: () => workflowNow,
    });
    const unsafePlan: GraphExecutionPlan = {
      schema: COS_GRAPH_EXECUTION_PLAN_VERSION,
      id: 'unsafe-plan',
      version: '1.0.0',
      steps: [{
        id: 'unsafe-write',
        capabilityId: 'cos.test.unsafe-side-effect',
        mode: 'write',
        input: { kind: 'literal', value: true },
      }],
    };
    await expectWorkflowError(
      () => unsafeRun.run(unsafePlan, 'unsafe-run-1', null),
      'WORKFLOW_UNSAFE_SIDE_EFFECT',
    );
    assert.equal(unsafeCounter.value, 0);
    assert.equal(await checkpoints2.load('unsafe-run-1'), null);

    // A step cannot depend on an output that does not exist yet.
    const forwardReferencePlan: GraphExecutionPlan = {
      schema: COS_GRAPH_EXECUTION_PLAN_VERSION,
      id: 'forward-ref',
      version: '1.0.0',
      steps: [
        {
          id: 'first',
          capabilityId: 'cos.graph.state.snapshot',
          mode: 'stream',
          input: { kind: 'step-output', stepId: 'second' },
        },
        {
          id: 'second',
          capabilityId: 'cos.graph.state.snapshot',
          mode: 'stream',
          input: { kind: 'literal', value: { graphId: 'enterprise' } },
        },
      ],
    };
    await expectWorkflowError(
      () => worker2.run(forwardReferencePlan, 'forward-ref-run', null),
      'WORKFLOW_PLAN_INVALID',
    );

    await checkpoints2.close();
    await durableState2.close();
    console.log('COS Graph Framework M2B: checkpointed crash-safe runtime suite passed');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

void main();
