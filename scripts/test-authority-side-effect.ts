import assert from 'node:assert/strict';
import {
  AuthoritySideEffectService,
  InMemoryAuthoritySideEffectStore,
  type AuthorityFencingValidator,
} from '../packages/execution/src/authority-side-effect';

const times = Array.from({ length: 24 }, (_, index) =>
  new Date(Date.parse('2026-08-28T12:00:00.000Z') + index * 60_000).toISOString());

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const store = new InMemoryAuthoritySideEffectStore();
  const fencing = new TestFencingAuthority();
  const service = new AuthoritySideEffectService(store, fencing);

  const claimInput = {
    projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: 'publish-release-42',
    principalId: 'agent://release-orchestrator',
    agentRunId: 'run://phase05/1',
    capability: 'github.release.publish',
    resourceUri: 'github://rotprods/repository/cos-graph-engine/release/v2.1.0',
    input: { tag: 'v2.1.0', notesHash: 'abc123' },
    correlationId: 'corr-side-effect-normal',
    provenance: [{ source: 'github://rotprods/cos-graph-engine/pull/46' }],
    metadata: { phase: '05' },
    recordedAt: times[0],
  };

  const concurrentClaims = await Promise.all([
    service.claim(claimInput),
    service.claim({ ...claimInput, recordedAt: times[1], correlationId: 'retry-transport-correlation' }),
  ]);
  check(concurrentClaims.filter(result => result.appended).length === 1, 'concurrent logical claim converges to one accepted operation');
  const operation = concurrentClaims[0].revision;
  check(concurrentClaims.every(result => result.revision.operationId === operation.operationId), 'all claim callers resolve the same operation identity');

  await assert.rejects(() => service.claim({
    ...claimInput,
    input: { tag: 'v2.1.1', notesHash: 'different' },
    recordedAt: times[2],
  }), /SIDE_EFFECT_IDEMPOTENCY_CONFLICT/);
  assertions += 1;

  operation.input.tag = 'caller-tamper';
  const pristineClaim = await service.get(operation.operationId);
  check((pristineClaim?.input as { tag: string }).tag === 'v2.1.0', 'claim result mutation cannot alter canonical operation input');

  const prepared = await service.prepare({
    operationId: operation.operationId,
    expectedRevision: 1,
    transitionKey: 'publish-release-42:prepare:1',
    recordedAt: times[2],
    fencingToken: 100,
    providerIdempotencyKey: 'github-release-v2.1.0',
  });
  check(prepared.revision.state === 'prepared' && prepared.revision.attempt === 1, 'prepare creates first fenced attempt');
  fencing.set(claimInput.resourceUri, 100);

  const executing = await service.beginExecution({
    operationId: operation.operationId,
    expectedRevision: 2,
    transitionKey: 'publish-release-42:execute:1',
    recordedAt: times[3],
  });
  check(executing.revision.state === 'executing' && executing.revision.effectKnowledge === 'unknown', 'execution records the crash-ambiguous window');

  const committed = await service.commit({
    operationId: operation.operationId,
    expectedRevision: 3,
    transitionKey: 'publish-release-42:commit:1',
    recordedAt: times[4],
    result: { releaseId: 42, url: 'github://rotprods/release/v2.1.0' },
  });
  check(committed.revision.state === 'committed' && committed.revision.effectKnowledge === 'applied', 'fenced commit produces terminal accepted outcome');
  check(typeof committed.revision.resultHash === 'string', 'committed result is content-hashed');

  const wholeOperationRetry = await service.claim({ ...claimInput, recordedAt: times[5] });
  check(!wholeOperationRetry.appended && wholeOperationRetry.revision.state === 'committed', 'retry after restart returns accepted terminal result');
  check(wholeOperationRetry.revision.resultHash === committed.revision.resultHash, 'terminal retry returns the same result evidence');
  await assert.rejects(() => service.prepare({
    operationId: operation.operationId,
    expectedRevision: 4,
    transitionKey: 'publish-release-42:illegal-retry',
    recordedAt: times[5],
    fencingToken: 101,
    providerIdempotencyKey: 'illegal',
  }), /SIDE_EFFECT_INVALID_TRANSITION|SIDE_EFFECT_TERMINAL/);
  assertions += 1;

  const history = await service.history(operation.operationId);
  check(history.length === 4, 'normal operation retains every immutable revision');
  check(history[0].systemUntil === times[2] && history[3].systemUntil === null, 'systemUntil is derived from successor revisions');
  history[0].metadata.phase = 'tampered';
  check((await service.history(operation.operationId))[0].metadata.phase === '05', 'history views are detached');

  // Crash/reconciliation path: stale worker cannot commit, then provider proves no effect.
  const crashClaim = await service.claim({
    ...claimInput,
    idempotencyKey: 'publish-release-crash-window',
    resourceUri: 'github://rotprods/repository/cos-graph-engine/release/v2.2.0',
    input: { tag: 'v2.2.0' },
    correlationId: 'corr-crash-window',
    recordedAt: times[6],
  });
  const crashOperation = crashClaim.revision.operationId;
  await service.prepare({
    operationId: crashOperation, expectedRevision: 1, transitionKey: 'crash:prepare:1',
    recordedAt: times[7], fencingToken: 200, providerIdempotencyKey: 'github-release-v2.2.0-attempt-1',
  });
  fencing.set('github://rotprods/repository/cos-graph-engine/release/v2.2.0', 200);
  await service.beginExecution({
    operationId: crashOperation, expectedRevision: 2, transitionKey: 'crash:execute:1', recordedAt: times[8],
  });
  fencing.set('github://rotprods/repository/cos-graph-engine/release/v2.2.0', 201);
  await assert.rejects(() => service.commit({
    operationId: crashOperation, expectedRevision: 3, transitionKey: 'crash:stale-commit',
    recordedAt: times[9], result: { releaseId: 43 },
  }), /STALE_FENCING_TOKEN/);
  assertions += 1;

  const reconciliation = await service.markReconciliationRequired({
    operationId: crashOperation,
    expectedRevision: 3,
    transitionKey: 'crash:reconciliation-required',
    recordedAt: times[9],
    reason: {
      code: 'WORKER_LOST_AFTER_PROVIDER_CALL',
      message: 'Worker died before a durable provider outcome was accepted',
      retryable: true,
      details: { attempt: 1 },
    },
  });
  check(reconciliation.revision.state === 'reconciliation_required', 'crash window becomes explicit reconciliation state');

  const secondAttempt = await service.reconcile({
    operationId: crashOperation,
    expectedRevision: 4,
    transitionKey: 'crash:provider-says-not-applied',
    recordedAt: times[10],
    outcome: 'not_applied',
    nextFencingToken: 202,
    nextProviderIdempotencyKey: 'github-release-v2.2.0-attempt-2',
  });
  check(secondAttempt.revision.state === 'prepared' && secondAttempt.revision.attempt === 2, 'not-applied reconciliation permits a new fenced attempt');
  fencing.set('github://rotprods/repository/cos-graph-engine/release/v2.2.0', 202);
  await service.beginExecution({
    operationId: crashOperation, expectedRevision: 5, transitionKey: 'crash:execute:2', recordedAt: times[11],
  });
  const recoveredCommit = await service.commit({
    operationId: crashOperation, expectedRevision: 6, transitionKey: 'crash:commit:2',
    recordedAt: times[12], result: { releaseId: 44, reconciled: true },
  });
  check(recoveredCommit.revision.state === 'committed' && recoveredCommit.revision.attempt === 2, 'reconciled retry commits exactly one accepted terminal result');

  // Partial application enters compensation and cannot be represented as success.
  const partialClaim = await service.claim({
    ...claimInput,
    idempotencyKey: 'partial-provider-effect',
    resourceUri: 'provider://example/resource/partial',
    capability: 'provider.resource.create',
    input: { name: 'partial-resource' },
    correlationId: 'corr-partial',
    recordedAt: times[13],
  });
  const partialOperation = partialClaim.revision.operationId;
  await service.prepare({
    operationId: partialOperation, expectedRevision: 1, transitionKey: 'partial:prepare',
    recordedAt: times[14], fencingToken: 300, providerIdempotencyKey: 'partial-attempt-1',
  });
  fencing.set('provider://example/resource/partial', 300);
  await service.beginExecution({
    operationId: partialOperation, expectedRevision: 2, transitionKey: 'partial:execute', recordedAt: times[15],
  });
  await service.markReconciliationRequired({
    operationId: partialOperation,
    expectedRevision: 3,
    transitionKey: 'partial:unknown',
    recordedAt: times[16],
    reason: { code: 'PARTIAL_UNKNOWN', message: 'Provider timeout after partial response', retryable: false, details: {} },
  });
  const partial = await service.reconcile({
    operationId: partialOperation,
    expectedRevision: 4,
    transitionKey: 'partial:reconciled-partial',
    recordedAt: times[17],
    outcome: 'partial',
    error: { code: 'PARTIAL_APPLIED', message: 'Provider reports partial application', retryable: false, details: {} },
  });
  check(partial.revision.state === 'compensation_required', 'partial application cannot be committed as success');

  // Add explicit compensation plan after partial reconciliation.
  // A second operation exercises the direct compensation-evidence path.
  const compensateClaim = await service.claim({
    ...claimInput,
    idempotencyKey: 'compensated-operation',
    resourceUri: 'provider://example/resource/to-compensate',
    capability: 'provider.resource.create',
    input: { name: 'resource' },
    correlationId: 'corr-compensate',
    recordedAt: times[18],
  });
  const compensateOperation = compensateClaim.revision.operationId;
  await service.prepare({
    operationId: compensateOperation, expectedRevision: 1, transitionKey: 'comp:prepare',
    recordedAt: times[19], fencingToken: 400, providerIdempotencyKey: 'comp-attempt-1',
  });
  fencing.set('provider://example/resource/to-compensate', 400);
  await service.beginExecution({
    operationId: compensateOperation, expectedRevision: 2, transitionKey: 'comp:execute', recordedAt: times[20],
  });
  const required = await service.requireCompensation({
    operationId: compensateOperation,
    expectedRevision: 3,
    transitionKey: 'comp:required',
    recordedAt: times[21],
    compensationCapability: 'provider.resource.delete',
    compensationInput: { resourceId: 'external-77' },
    error: { code: 'POST_EFFECT_VALIDATION_FAILED', message: 'Created resource violates acceptance criteria', retryable: false, details: {} },
  });
  check(required.revision.compensation?.inputHash !== null, 'compensation plan is content-addressed');
  await service.beginCompensation({
    operationId: compensateOperation, expectedRevision: 4, transitionKey: 'comp:begin', recordedAt: times[22],
  });
  const compensated = await service.completeCompensation({
    operationId: compensateOperation, expectedRevision: 5, transitionKey: 'comp:complete',
    recordedAt: times[23], result: { deleted: true, resourceId: 'external-77' },
  });
  check(compensated.revision.state === 'compensated' && compensated.revision.effectKnowledge === 'compensated', 'compensation produces explicit terminal outcome');
  check((await service.get(compensateOperation))?.terminal, 'compensated operation is terminal');

  const nonRetryable = await service.claim({
    ...claimInput,
    idempotencyKey: 'validation-failure',
    resourceUri: 'provider://example/resource/invalid',
    input: { invalid: true },
    correlationId: 'corr-fail',
    recordedAt: '2026-08-28T13:00:00.000Z',
  });
  const failed = await service.failWithoutEffect({
    operationId: nonRetryable.revision.operationId,
    expectedRevision: 1,
    transitionKey: 'validation:fail',
    recordedAt: '2026-08-28T13:01:00.000Z',
    error: { code: 'INPUT_REJECTED', message: 'Input failed provider-independent validation', retryable: false, details: {} },
  });
  check(failed.revision.state === 'failed' && (await service.get(failed.revision.operationId))?.terminal, 'non-retryable pre-effect failure is terminal');

  console.log(`Authority side-effect contract: ${assertions} assertions passed`);
}

class TestFencingAuthority implements AuthorityFencingValidator {
  private readonly current = new Map<string, number>();

  set(resourceUri: string, token: number): void {
    this.current.set(resourceUri, token);
  }

  async assertCurrent(resourceUri: string, fencingToken: number): Promise<void> {
    const current = this.current.get(resourceUri);
    if (current !== fencingToken) {
      throw new Error(`STALE_FENCING_TOKEN resource=${resourceUri} expected=${String(current)} actual=${fencingToken}`);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
