import assert from 'node:assert/strict';
import { AuthoritySideEffectRuntime } from '../packages/execution/src/authority-side-effect-runtime';
import { AuthoritySideEffectPostgresStore } from '../packages/execution/src/authority-side-effect-store-postgres';
import { FakeAuthoritySideEffectPostgres } from './fixtures/fake-authority-side-effect-postgres';

const BASE = Date.parse('2026-09-17T12:00:00.000Z');
const at = (seconds: number): string => new Date(BASE + seconds * 1000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const db = new FakeAuthoritySideEffectPostgres();
  const store = new AuthoritySideEffectPostgresStore(db);
  await store.ensureSchema();
  let currentToken = 7;
  const runtime = new AuthoritySideEffectRuntime(store, {
    async assertCurrent(resourceUri: string, fencingToken: number): Promise<void> {
      if (resourceUri !== 'provider://example/resource/postgres-side-effect') {
        throw new Error(`UNEXPECTED_RESOURCE ${resourceUri}`);
      }
      if (fencingToken !== currentToken) {
        throw new Error(`STALE_FENCING_TOKEN expected=${currentToken} actual=${fencingToken}`);
      }
    },
  });

  const claimInput = {
    projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: 'postgres-side-effect-v1',
    principalId: 'agent://rot149/postgres-side-effect',
    agentRunId: null,
    capability: 'provider.resource.update',
    resourceUri: 'provider://example/resource/postgres-side-effect',
    input: { desiredState: 'LIVE', generation: 1 },
    correlationId: 'corr-postgres-side-effect-v1',
    causationId: null,
    provenance: [{ source: 'test://rot149/postgres-side-effect' }],
    metadata: { slice: 'ROT-149' },
    recordedAt: at(0),
  };

  const claimed = await runtime.claim(claimInput);
  check(claimed.appended && claimed.revision.revision === 1, 'Postgres store appends initial claim');
  const duplicate = await runtime.claim(structuredClone(claimInput));
  check(!duplicate.appended && duplicate.revision.revisionId === claimed.revision.revisionId, 'identical idempotent claim converges after store reconstruction');

  await assert.rejects(() => runtime.claim({
    ...claimInput,
    input: { desiredState: 'DIFFERENT', generation: 2 },
    recordedAt: at(1),
  }), /SIDE_EFFECT_IDEMPOTENCY_CONFLICT/);
  assertions += 1;

  const prepared = await runtime.prepare({
    operationId: claimed.revision.operationId,
    expectedRevision: 1,
    transitionKey: 'postgres-side-effect:prepare',
    recordedAt: at(2),
    fencingToken: 7,
    providerIdempotencyKey: 'provider-postgres-side-effect-v1',
    metadata: { phase: 'prepare' },
  });
  check(prepared.appended && prepared.revision.state === 'prepared', 'active fence prepares provider attempt');
  const preparedRetry = await runtime.prepare({
    operationId: claimed.revision.operationId,
    expectedRevision: 1,
    transitionKey: 'postgres-side-effect:prepare',
    recordedAt: at(2),
    fencingToken: 7,
    providerIdempotencyKey: 'provider-postgres-side-effect-v1',
    metadata: { phase: 'prepare' },
  });
  check(!preparedRetry.appended && preparedRetry.revision.revisionId === prepared.revision.revisionId, 'duplicate transition key converges');

  const begun = await runtime.beginExecution({
    operationId: claimed.revision.operationId,
    expectedRevision: 2,
    transitionKey: 'postgres-side-effect:begin',
    recordedAt: at(3),
    metadata: { phase: 'execute' },
  });
  check(begun.revision.state === 'executing', 'Postgres ledger records execution start');

  const unknown = await runtime.markProviderOutcomeUnknown({
    operationId: claimed.revision.operationId,
    expectedRevision: 3,
    transitionKey: 'postgres-side-effect:unknown',
    recordedAt: at(4),
    metadata: { crashWindow: true },
    reason: {
      code: 'PROVIDER_OUTCOME_UNKNOWN',
      message: 'transport ended after request transmission',
      retryable: true,
      details: { bytesWritten: true },
    },
  });
  check(unknown.revision.state === 'reconciliation_required' && unknown.revision.effectKnowledge === 'unknown', 'crash window is persisted as unknown, never guessed');

  currentToken = 8;
  await assert.rejects(() => runtime.commit({
    operationId: claimed.revision.operationId,
    expectedRevision: 4,
    transitionKey: 'postgres-side-effect:stale-commit',
    recordedAt: at(5),
    result: { state: 'LIVE' },
    metadata: {},
  }), /STALE_FENCING_TOKEN/);
  assertions += 1;
  check((await runtime.get(claimed.revision.operationId))?.state === 'reconciliation_required', 'stale owner cannot mutate crash-window truth');

  const history = await runtime.history(claimed.revision.operationId);
  check(history.length === 4, 'Postgres side-effect history remains append-only');
  check(history.map(item => item.revision).join(',') === '1,2,3,4', 'Postgres side-effect revisions reconstruct deterministically');
  history[0]!.metadata.slice = 'tampered';
  check((await runtime.history(claimed.revision.operationId))[0]!.metadata.slice === 'ROT-149', 'Postgres history reads are detached');

  check(db.snapshotRevisions().length === 4, 'fixture contains one immutable row per accepted transition');
  check(!db.statements.some(statement => /^(update|delete|truncate)\b/i.test(statement)), 'candidate store never updates or deletes accepted authority revisions');
  check(db.statements.some(statement => statement.includes('pg_advisory_xact_lock')), 'candidate writer serializes idempotency writers with advisory transaction lock');
  check(db.statements.some(statement => statement.includes('on conflict do nothing')), 'candidate classifies conflicts without aborted-transaction recovery');

  const tail = db.snapshotRevisions().at(-1);
  if (!tail) throw new Error('missing tail revision');
  db.corruptRevision(tail.revision_id, row => { row.content_hash = '0'.repeat(32); });
  await assert.rejects(() => store.getCurrent(claimed.revision.operationId), /SIDE_EFFECT_CONTENT_HASH_MISMATCH/);
  assertions += 1;

  console.log(`ROT-149 side-effect Postgres contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
