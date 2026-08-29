import assert from 'node:assert/strict';
import {
  AuthorityCapabilitySignalPostgresStoreV2,
  buildAuthorityCapabilitySignalV2,
} from '../packages/execution/src/authority-phase05-evidence-v2-postgres';
import { FakeAuthorityCapabilitySignalPostgres } from './fixtures/fake-authority-capability-signal-postgres';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const db = new FakeAuthorityCapabilitySignalPostgres();
  const store = new AuthorityCapabilitySignalPostgresStoreV2(db);
  await store.ensureSchema();

  const accepted = buildAuthorityCapabilitySignalV2({
    type: 'capability_completed', outcome: 'succeeded', nearMiss: false,
    projectId: 'COS_GRAPH_ENGINE', principalId: 'principal://roberto',
    capability: 'authority_http_write', resourceUri: 'https://api.example.com/orders/42',
    operationId: 'operation://42', correlationId: 'corr-42', causationId: null,
    occurredAt: '2026-08-29T19:00:00.000Z', errorCode: null,
    details: { operationState: 'committed', resultHash: 'result-hash' },
  });
  check((await store.append(accepted)).appended, 'Postgres signal store appends first signal');
  check(!(await store.append(structuredClone(accepted))).appended, 'identical signal retry converges');

  const nearMiss = buildAuthorityCapabilitySignalV2({
    type: 'provider_outcome_uncertain', outcome: 'uncertain', nearMiss: true,
    projectId: 'COS_GRAPH_ENGINE', principalId: 'principal://roberto',
    capability: 'authority_http_write', resourceUri: 'https://api.example.com/orders/43',
    operationId: 'operation://43', correlationId: 'corr-43', causationId: null,
    occurredAt: '2026-08-29T19:01:00.000Z', errorCode: 'PROVIDER_OUTCOME_UNKNOWN',
    details: { effectKnowledge: 'unknown' },
  });
  await store.append(nearMiss);
  check(db.snapshot().length === 2, 'Postgres fake contains two immutable signal rows');
  check((await store.get(accepted.signalId))?.contentHash === accepted.contentHash, 'get reconstructs and verifies signal identity/hash');
  check((await store.listProject('COS_GRAPH_ENGINE', { nearMiss: true }))[0]?.signalId === nearMiss.signalId, 'project query filters near misses');

  const leaked = await store.get(accepted.signalId);
  leaked!.details.operationState = 'tampered';
  check((await store.get(accepted.signalId))?.details.operationState === 'committed', 'Postgres reads are detached');

  check(
    !db.statements.some(sql => /^UPDATE\b|^DELETE\b|^TRUNCATE\b/i.test(sql)),
    'capability signal authority store never updates or deletes history',
  );

  db.corrupt(accepted.signalId, row => { row.content_hash = 'tampered'; });
  await assert.rejects(() => store.get(accepted.signalId), /ROW_HASH_MISMATCH/);
  assertions += 1;

  console.log(`Authority capability signal Postgres contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
