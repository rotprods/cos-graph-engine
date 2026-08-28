import assert from 'node:assert/strict';
import { AuthorityKnowledgeGateway, PostgresAuthorityKnowledgeStore } from '../packages/knowledge/src';
import { FakeAuthorityKnowledgePostgres } from './fixtures/fake-authority-knowledge-postgres';

const T0 = '2026-08-01T10:00:00.000Z';
const T1 = '2026-08-05T10:00:00.000Z';
const T2 = '2026-08-10T10:00:00.000Z';
const T3 = '2026-08-15T10:00:00.000Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const db = new FakeAuthorityKnowledgePostgres();
  const store = new PostgresAuthorityKnowledgeStore(db);
  await store.ensureSchema();
  const gateway = new AuthorityKnowledgeGateway(store);

  const created = await gateway.create({
    projectId: 'COS_GRAPH_ENGINE', identityKey: 'postgres-parity',
    subject: 'EventLog', predicate: 'persistence', object: 'append-only', confidence: 1,
    validFrom: T0, observedAt: T1, recordedAt: T1,
    provenance: [{ source: 'test://postgres-knowledge' }], source: 'test://postgres-knowledge',
    idempotencyKey: 'pg-kn-1',
  });
  check(created.appended && created.revision.revision === 1, 'Postgres adapter appends revision 1');

  const corrected = await gateway.revise({
    statementId: created.revision.statementId,
    expectedRevision: 1,
    recordedAt: T3,
    idempotencyKey: 'pg-kn-2',
    changes: { object: 'append-only-authority', validFrom: T2, observedAt: T3 },
  });
  check(corrected.appended && corrected.revision.revision === 2, 'Postgres adapter appends immutable revision 2');

  const before = await gateway.query({
    projectId: 'COS_GRAPH_ENGINE', asOf: T2, knownAt: T2, maxSensitivity: 'internal',
  });
  check(before[0]?.object === 'append-only', 'Postgres knownAt before correction returns historical revision');
  const after = await gateway.query({
    projectId: 'COS_GRAPH_ENGINE', asOf: T2, knownAt: T3, maxSensitivity: 'internal',
  });
  check(after[0]?.object === 'append-only-authority', 'Postgres knownAt after correction returns corrected revision');

  const retry = await gateway.revise({
    statementId: created.revision.statementId,
    expectedRevision: 1,
    recordedAt: T3,
    idempotencyKey: 'pg-kn-2',
    changes: { object: 'append-only-authority', validFrom: T2, observedAt: T3 },
  });
  check(!retry.appended && retry.revision.revisionId === corrected.revision.revisionId, 'Postgres late retry converges to historical operation');

  await assert.rejects(() => gateway.revise({
    statementId: created.revision.statementId,
    expectedRevision: 1,
    recordedAt: '2026-08-16T10:00:00.000Z',
    idempotencyKey: 'pg-kn-stale',
    changes: { object: 'stale-writer' },
  }), /STALE_KNOWLEDGE_REVISION/);
  assertions += 1;

  const rows = db.snapshot();
  check(rows.length === 2, 'Postgres fake contains exactly two immutable rows');
  check(rows[0].content_hash !== rows[1].content_hash, 'each system revision has independent content hash');
  check(rows[0].valid_until === null, 'later correction did not mutate prior valid-time row');
  check(
    !db.statements.some(sql => /^UPDATE\b|^DELETE\b|^TRUNCATE\b/i.test(sql)),
    'authority knowledge adapter never updates or deletes historical rows',
  );
  check(
    db.statements.some(sql => sql.includes('pg_advisory_xact_lock')),
    'Postgres writer serializes statement mutations with transaction advisory lock',
  );

  const leaked = await store.getHistory(created.revision.statementId);
  leaked[0].metadata.tampered = true;
  const pristine = await store.getHistory(created.revision.statementId);
  check(pristine[0].metadata.tampered === undefined, 'Postgres adapter reads are detached');

  console.log(`Authority knowledge Postgres contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
