import assert from 'node:assert/strict';
import {
  AuthoritySideEffectRuntime,
} from '../packages/execution/src/authority-side-effect-runtime';
import {
  InMemoryAuthorityFencingValidator,
} from '../packages/execution/src/authority-side-effect-coordinator';
import {
  AuthoritySideEffectPostgresStore,
} from '../packages/execution/src/authority-side-effect-store-postgres';
import {
  FakeAuthoritySideEffectStorePostgres,
} from './fixtures/fake-authority-side-effect-store-postgres';

const T0 = '2026-08-28T14:00:00.000Z';
const T1 = '2026-08-28T14:01:00.000Z';
const T2 = '2026-08-28T14:02:00.000Z';
const T3 = '2026-08-28T14:03:00.000Z';
const T4 = '2026-08-28T14:04:00.000Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const db = new FakeAuthoritySideEffectStorePostgres();
  const store = new AuthoritySideEffectPostgresStore(db);
  await store.ensureSchema();
  const fencing = new InMemoryAuthorityFencingValidator();
  const runtime = new AuthoritySideEffectRuntime(store, fencing);

  const claimInput = {
    projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: 'postgres-side-effect-1',
    principalId: 'agent://phase05/postgres-test',
    agentRunId: 'run://phase05/postgres-test',
    capability: 'provider.resource.create',
    resourceUri: 'provider://example/resource/postgres-1',
    input: { name: 'postgres-backed-resource', count: 1 },
    correlationId: 'corr-postgres-side-effect-1',
    provenance: [{ source: 'github://rotprods/cos-graph-engine/pull/46' }],
    metadata: { adapter: 'postgres', phase: 5 },
    recordedAt: T0,
  };

  const claimed = await runtime.claim(claimInput);
  check(claimed.appended && claimed.revision.revision === 1, 'Postgres ledger appends initial claim');
  const operationId = claimed.revision.operationId;

  const duplicateClaim = await new AuthoritySideEffectRuntime(store, fencing).claim({
    ...claimInput,
    recordedAt: T1,
  });
  check(!duplicateClaim.appended && duplicateClaim.revision.operationId === operationId, 'process-restart claim resolves accepted operation');

  await assert.rejects(() => runtime.claim({
    ...claimInput,
    input: { name: 'conflicting-resource', count: 2 },
    recordedAt: T1,
  }), /SIDE_EFFECT_IDEMPOTENCY_CONFLICT/);
  assertions += 1;

  const prepared = await runtime.prepare({
    operationId,
    expectedRevision: 1,
    transitionKey: 'postgres-side-effect-1:prepare',
    recordedAt: T1,
    fencingToken: 900,
    providerIdempotencyKey: 'provider-postgres-side-effect-1',
  });
  check(prepared.revision.revision === 2 && prepared.revision.state === 'prepared', 'Postgres ledger appends prepared revision');
  fencing.setCurrent(claimInput.resourceUri, 900);

  const executing = await runtime.beginExecution({
    operationId,
    expectedRevision: 2,
    transitionKey: 'postgres-side-effect-1:execute',
    recordedAt: T2,
  });
  check(executing.revision.revision === 3 && executing.revision.state === 'executing', 'Postgres ledger appends execution revision');

  const committed = await runtime.commit({
    operationId,
    expectedRevision: 3,
    transitionKey: 'postgres-side-effect-1:commit',
    recordedAt: T3,
    result: { providerId: 'external-900', created: true },
  });
  check(committed.revision.revision === 4 && committed.revision.state === 'committed', 'Postgres ledger appends terminal commit');

  const restarted = new AuthoritySideEffectRuntime(
    new AuthoritySideEffectPostgresStore(db),
    fencing,
  );
  const current = await restarted.get(operationId);
  check(current?.state === 'committed' && current.resultHash === committed.revision.resultHash, 'fresh runtime reconstructs terminal result from Postgres');

  const history = await restarted.history(operationId);
  check(history.length === 4, 'Postgres history preserves all four immutable revisions');
  check(history[0].systemUntil === T1 && history[3].systemUntil === null, 'Postgres systemUntil derives from successor rows');
  check(history.map(item => item.revision).join(',') === '1,2,3,4', 'Postgres revision ordering is deterministic');

  const leaked = await store.getHistory(operationId);
  (leaked[0].input as { name: string }).name = 'tampered';
  const pristine = await store.getHistory(operationId);
  check((pristine[0].input as { name: string }).name === 'postgres-backed-resource', 'Postgres reads are detached from stored rows');

  await assert.rejects(() => runtime.prepare({
    operationId,
    expectedRevision: 1,
    transitionKey: 'postgres-side-effect-1:stale-prepare',
    recordedAt: T4,
    fencingToken: 901,
    providerIdempotencyKey: 'stale-provider-key',
  }), /SIDE_EFFECT_INVALID_TRANSITION|SIDE_EFFECT_TERMINAL|STALE_SIDE_EFFECT_REVISION/);
  assertions += 1;

  check(db.snapshotOperations().length === 1, 'Postgres ledger stores one logical operation claim');
  check(db.snapshotRevisions().length === 4, 'Postgres ledger stores one immutable row per accepted transition');
  check(
    !db.statements.some(statement => /^update\b|^delete\b|^truncate\b/i.test(statement)),
    'authority side-effect adapter never updates or deletes accepted history',
  );
  check(
    db.statements.some(statement => statement.includes('pg_advisory_xact_lock')),
    'Postgres writer serializes claim/revision appends with transaction advisory lock',
  );
  check(
    db.statements.some(statement => statement.includes('on conflict do nothing')),
    'Postgres conflict handling is non-aborting before deterministic classification',
  );

  const corruptedDb = new FakeAuthoritySideEffectStorePostgres();
  const corruptedStore = new AuthoritySideEffectPostgresStore(corruptedDb);
  const corruptedRuntime = new AuthoritySideEffectRuntime(corruptedStore, new InMemoryAuthorityFencingValidator());
  const corruptClaim = await corruptedRuntime.claim({
    ...claimInput,
    idempotencyKey: 'postgres-corruption-test',
    resourceUri: 'provider://example/resource/corrupt',
    correlationId: 'corr-corrupt',
    recordedAt: T0,
  });
  corruptedDb.corruptRevision(corruptClaim.revision.revisionId, row => {
    row.content_hash = '0'.repeat(32);
  });
  await assert.rejects(
    () => corruptedStore.getCurrent(corruptClaim.revision.operationId),
    /SIDE_EFFECT_CONTENT_HASH_MISMATCH/,
  );
  assertions += 1;

  console.log(`Authority side-effect Postgres contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
