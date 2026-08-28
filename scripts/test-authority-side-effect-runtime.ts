import assert from 'node:assert/strict';
import {
  InMemoryAuthoritySideEffectStore,
} from '../packages/execution/src/authority-side-effect';
import {
  AuthoritySideEffectRuntime,
} from '../packages/execution/src/authority-side-effect-runtime';
import {
  InMemoryAuthorityFencingValidator,
} from '../packages/execution/src/authority-side-effect-coordinator';

const at = (minute: number): string =>
  new Date(Date.parse('2026-08-28T12:00:00.000Z') + minute * 60_000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const store = new InMemoryAuthoritySideEffectStore();
  const fencing = new InMemoryAuthorityFencingValidator();
  const runtime = new AuthoritySideEffectRuntime(store, fencing);

  const claim = {
    projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: 'release-v2.1.0',
    principalId: 'agent://release-orchestrator',
    agentRunId: 'agent-run://phase05/normal',
    capability: 'github.release.publish',
    resourceUri: 'github://rotprods/repository/cos-graph-engine/release/v2.1.0',
    input: { tag: 'v2.1.0', notesHash: 'abc123' },
    correlationId: 'corr-release-v2.1.0',
    provenance: [{ source: 'github://rotprods/cos-graph-engine/pull/46' }],
    metadata: { phase: '05' },
    recordedAt: at(0),
  };

  const claims = await Promise.all([
    runtime.claim(claim),
    runtime.claim({ ...claim, recordedAt: at(1) }),
  ]);
  check(claims.filter(result => result.appended).length === 1, 'concurrent claims converge to one accepted operation');
  const operationId = claims[0].revision.operationId;
  check(claims.every(result => result.revision.operationId === operationId), 'concurrent callers resolve one operation ID');

  await assert.rejects(() => runtime.claim({
    ...claim,
    input: { tag: 'v2.1.1', notesHash: 'different' },
    recordedAt: at(2),
  }), /SIDE_EFFECT_IDEMPOTENCY_CONFLICT/);
  assertions += 1;

  const leaked = claims[0].revision.input as { tag: string };
  leaked.tag = 'caller-mutated';
  const pristine = await runtime.get(operationId);
  check((pristine?.input as { tag: string }).tag === 'v2.1.0', 'claim result cannot mutate canonical input');

  await runtime.prepare({
    operationId,
    expectedRevision: 1,
    transitionKey: 'release-v2.1.0:prepare:1',
    recordedAt: at(2),
    fencingToken: 100,
    providerIdempotencyKey: 'github-release-v2.1.0-attempt-1',
  });
  fencing.setCurrent(claim.resourceUri, 100);
  await runtime.beginExecution({
    operationId,
    expectedRevision: 2,
    transitionKey: 'release-v2.1.0:execute:1',
    recordedAt: at(3),
  });
  const committed = await runtime.commit({
    operationId,
    expectedRevision: 3,
    transitionKey: 'release-v2.1.0:commit:1',
    recordedAt: at(4),
    result: { releaseId: 42, tag: 'v2.1.0' },
  });
  check(committed.revision.state === 'committed', 'normal provider effect reaches committed');
  check(committed.revision.effectKnowledge === 'applied', 'commit records applied knowledge');

  const restarted = new AuthoritySideEffectRuntime(store, fencing);
  const afterRestart = await restarted.claim({ ...claim, recordedAt: at(5) });
  check(!afterRestart.appended && afterRestart.revision.state === 'committed', 'restart retry returns accepted terminal outcome');
  check(afterRestart.revision.resultHash === committed.revision.resultHash, 'restart retry returns identical result evidence');

  const history = await restarted.history(operationId);
  check(history.length === 4, 'normal path retains every immutable revision');
  check(history[0].systemUntil === at(2) && history[3].systemUntil === null, 'systemUntil is derived from successor revisions');
  history[0].metadata.phase = 'tampered';
  check((await restarted.history(operationId))[0].metadata.phase === '05', 'history views are detached');

  // Unknown crash, provider proves effect did not happen, then a new fenced attempt succeeds.
  const retryClaim = await runtime.claim({
    ...claim,
    idempotencyKey: 'release-v2.2.0',
    resourceUri: 'github://rotprods/repository/cos-graph-engine/release/v2.2.0',
    input: { tag: 'v2.2.0' },
    correlationId: 'corr-release-v2.2.0',
    recordedAt: at(6),
  });
  const retryOperation = retryClaim.revision.operationId;
  await runtime.prepare({
    operationId: retryOperation,
    expectedRevision: 1,
    transitionKey: 'release-v2.2.0:prepare:1',
    recordedAt: at(7),
    fencingToken: 200,
    providerIdempotencyKey: 'github-release-v2.2.0-attempt-1',
  });
  const retryResource = 'github://rotprods/repository/cos-graph-engine/release/v2.2.0';
  fencing.setCurrent(retryResource, 200);
  await runtime.beginExecution({
    operationId: retryOperation,
    expectedRevision: 2,
    transitionKey: 'release-v2.2.0:execute:1',
    recordedAt: at(8),
  });
  const recovered = await runtime.recoverInterrupted({
    operationId: retryOperation,
    transitionKeyPrefix: 'release-v2.2.0:recovery:1',
    interruptedAt: at(9),
    reconciledAt: at(10),
    reconciler: {
      async inspect() {
        return {
          status: 'not_applied' as const,
          nextFencingToken: 201,
          nextProviderIdempotencyKey: 'github-release-v2.2.0-attempt-2',
          evidence: { providerLookup: 'not_found' },
        };
      },
    },
  });
  check(recovered.disposition === 'prepared_for_retry', 'provider not-applied evidence prepares retry instead of replaying blindly');
  check(recovered.operation.attempt === 2 && recovered.operation.fencingToken === 201, 'retry receives new monotonic fencing token');
  fencing.setCurrent(retryResource, 201);
  await runtime.beginExecution({
    operationId: retryOperation,
    expectedRevision: recovered.operation.revision,
    transitionKey: 'release-v2.2.0:execute:2',
    recordedAt: at(11),
  });
  const retryCommit = await runtime.commit({
    operationId: retryOperation,
    expectedRevision: recovered.operation.revision + 1,
    transitionKey: 'release-v2.2.0:commit:2',
    recordedAt: at(12),
    result: { releaseId: 43, tag: 'v2.2.0' },
  });
  check(retryCommit.revision.state === 'committed' && retryCommit.revision.attempt === 2, 'reconciled retry commits once on second attempt');

  // Provider proves the effect happened despite worker interruption.
  const appliedClaim = await runtime.claim({
    ...claim,
    idempotencyKey: 'release-v2.3.0',
    resourceUri: 'github://rotprods/repository/cos-graph-engine/release/v2.3.0',
    input: { tag: 'v2.3.0' },
    correlationId: 'corr-release-v2.3.0',
    recordedAt: at(13),
  });
  const appliedOperation = appliedClaim.revision.operationId;
  await runtime.prepare({
    operationId: appliedOperation,
    expectedRevision: 1,
    transitionKey: 'release-v2.3.0:prepare',
    recordedAt: at(14),
    fencingToken: 300,
    providerIdempotencyKey: 'github-release-v2.3.0-attempt-1',
  });
  const appliedResource = 'github://rotprods/repository/cos-graph-engine/release/v2.3.0';
  fencing.setCurrent(appliedResource, 300);
  await runtime.beginExecution({
    operationId: appliedOperation,
    expectedRevision: 2,
    transitionKey: 'release-v2.3.0:execute',
    recordedAt: at(15),
  });
  const observedApplied = await runtime.recoverInterrupted({
    operationId: appliedOperation,
    transitionKeyPrefix: 'release-v2.3.0:recovery',
    interruptedAt: at(16),
    reconciledAt: at(17),
    reconciler: {
      async inspect() {
        return {
          status: 'applied' as const,
          result: { releaseId: 44, tag: 'v2.3.0', recovered: true },
          evidence: { providerLookup: 'found', providerId: 44 },
        };
      },
    },
  });
  check(observedApplied.disposition === 'committed', 'provider-applied reconciliation commits observed outcome without re-execution');
  check(observedApplied.operation.resultHash !== null, 'reconciled applied result is content-hashed');

  // Partial provider application requires a compensation plan and explicit terminal compensation.
  const partialClaim = await runtime.claim({
    ...claim,
    idempotencyKey: 'provider-partial-resource',
    capability: 'provider.resource.create',
    resourceUri: 'provider://example/resource/partial',
    input: { name: 'partial-resource' },
    correlationId: 'corr-partial-resource',
    recordedAt: at(18),
  });
  const partialOperation = partialClaim.revision.operationId;
  await runtime.prepare({
    operationId: partialOperation,
    expectedRevision: 1,
    transitionKey: 'partial:prepare',
    recordedAt: at(19),
    fencingToken: 400,
    providerIdempotencyKey: 'partial-attempt-1',
  });
  fencing.setCurrent('provider://example/resource/partial', 400);
  await runtime.beginExecution({
    operationId: partialOperation,
    expectedRevision: 2,
    transitionKey: 'partial:execute',
    recordedAt: at(20),
  });
  const partial = await runtime.recoverInterrupted({
    operationId: partialOperation,
    transitionKeyPrefix: 'partial:recovery',
    interruptedAt: at(21),
    reconciledAt: at(22),
    reconciler: {
      async inspect() {
        return {
          status: 'partial' as const,
          error: {
            code: 'PARTIAL_PROVIDER_APPLICATION',
            message: 'Provider created a resource but failed final configuration',
            retryable: false,
            details: { resourceId: 'external-77' },
          },
          compensationCapability: 'provider.resource.delete',
          compensationResourceUri: 'provider://example/resource/external-77',
          compensationInput: { resourceId: 'external-77' },
          evidence: { providerLookup: 'partial', resourceId: 'external-77' },
        };
      },
    },
  });
  check(partial.disposition === 'compensation_required', 'partial application cannot be classified as success');
  check(partial.operation.compensation?.inputHash !== null, 'partial recovery records a content-addressed compensation plan');
  await runtime.beginCompensation({
    operationId: partialOperation,
    expectedRevision: partial.operation.revision,
    transitionKey: 'partial:compensation:begin',
    recordedAt: at(23),
  });
  const compensated = await runtime.completeCompensation({
    operationId: partialOperation,
    expectedRevision: partial.operation.revision + 1,
    transitionKey: 'partial:compensation:complete',
    recordedAt: at(24),
    result: { deleted: true, resourceId: 'external-77' },
  });
  check(compensated.revision.state === 'compensated', 'compensation creates explicit terminal outcome');
  check((await runtime.get(partialOperation))?.terminal, 'compensated operation is terminal');

  // A stale worker cannot commit after a newer fencing token owns the resource.
  const staleClaim = await runtime.claim({
    ...claim,
    idempotencyKey: 'stale-worker',
    resourceUri: 'provider://example/resource/stale',
    input: { name: 'stale' },
    correlationId: 'corr-stale-worker',
    recordedAt: at(25),
  });
  const staleOperation = staleClaim.revision.operationId;
  await runtime.prepare({
    operationId: staleOperation,
    expectedRevision: 1,
    transitionKey: 'stale:prepare',
    recordedAt: at(26),
    fencingToken: 500,
    providerIdempotencyKey: 'stale-attempt-1',
  });
  fencing.setCurrent('provider://example/resource/stale', 500);
  await runtime.beginExecution({
    operationId: staleOperation,
    expectedRevision: 2,
    transitionKey: 'stale:execute',
    recordedAt: at(27),
  });
  fencing.setCurrent('provider://example/resource/stale', 501);
  await assert.rejects(() => runtime.commit({
    operationId: staleOperation,
    expectedRevision: 3,
    transitionKey: 'stale:commit',
    recordedAt: at(28),
    result: { shouldNotCommit: true },
  }), /STALE_FENCING_TOKEN/);
  assertions += 1;
  check((await runtime.get(staleOperation))?.state === 'executing', 'rejected stale commit does not mutate accepted state');

  await assert.rejects(() => runtime.recoverInterrupted({
    operationId: staleOperation,
    transitionKeyPrefix: 'stale:bad-time',
    interruptedAt: at(30),
    reconciledAt: at(30),
    reconciler: { async inspect() { return { status: 'not_applied' as const, nextFencingToken: 502, nextProviderIdempotencyKey: 'x', evidence: {} }; } },
  }), /reconciledAt must be strictly later/);
  assertions += 1;

  console.log(`Authority side-effect runtime contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
