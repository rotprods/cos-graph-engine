import assert from 'node:assert/strict';
import { canonicalHash128, sha256Hex } from '../packages/core/src';
import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '../packages/runtime/src/postgres-event-log';
import type { AuthorityProviderInspectionRequest } from '../packages/execution/src/authority-provider-reconciliation';
import {
  AuthorityRepeatedAbsenceGate,
  type AuthorityAbsenceObservation,
} from '../packages/execution/src/providers/authority-provider-inspection-shared';
import {
  AUTHORITY_ABSENCE_OBSERVATION_POSTGRES_DDL,
  AuthorityAbsenceObservationPostgresStore,
} from '../packages/execution/src/providers/authority-absence-observation-store-postgres';

const BASE = Date.parse('2026-09-01T01:00:00.000Z');
const at = (ms: number): string => new Date(BASE + ms).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  check(!/\bUPDATE\b|\bDELETE\s+FROM\b/i.test(AUTHORITY_ABSENCE_OBSERVATION_POSTGRES_DDL), 'DDL contains no history mutation statement');

  const db = new FakePostgresExecutor();
  const store = new AuthorityAbsenceObservationPostgresStore(db);
  await store.ensureSchema();
  check(db.schemaCalls === 1, 'schema creation is explicit and idempotent-facing');

  const first = await makeObservation(at(0), { requestId: 'read-1' }, 'rev-1');
  await store.append(first);
  await store.append(structuredClone(first));
  check(db.rows.size === 1, 'identical append is idempotent');

  await Promise.all([
    store.append(structuredClone(first)),
    store.append(structuredClone(first)),
  ]);
  check(db.rows.size === 1, 'concurrent identical retry converges to one row');

  const listed = await store.list(scope());
  check(listed.length === 1 && listed[0].contentHash === first.contentHash, 'list returns verified persisted observation');
  listed[0].evidence.requestId = 'caller-mutation';
  const listedAgain = await store.list(scope());
  check(listedAgain[0].evidence.requestId === 'read-1', 'caller mutation cannot rewrite persisted evidence');

  const conflict = await makeObservation(at(0), { requestId: 'different-read' }, 'rev-other');
  check(conflict.observationId === first.observationId, 'semantic identity excludes provider evidence content');
  check(conflict.contentHash !== first.contentHash, 'different evidence has different cryptographic content hash');
  await assert.rejects(() => store.append(conflict), /ABSENCE_OBSERVATION_CONFLICT/);
  assertions += 1;
  check(db.rows.size === 1, 'conflicting retry cannot overwrite history');

  const restarted = new AuthorityAbsenceObservationPostgresStore(db);
  const afterRestart = await restarted.list(scope());
  check(afterRestart.length === 1 && afterRestart[0].observationId === first.observationId, 'new store instance reconstructs durable observation');

  const gateBefore = new AuthorityRepeatedAbsenceGate(restarted);
  const firstProof = await gateBefore.observe({
    provider: 'github', targetKey: 'github://rotprods/cos-graph-engine/reconciliation/restart',
    minimumConsistencyWindowMs: 5_000, request: request(at(10_000)), providerRevision: 'rev-a',
    evidence: { requestId: 'absence-before-restart' },
  });
  check(firstProof.proven === false, 'one persisted absence before restart is insufficient');

  const storeAfterProcessRestart = new AuthorityAbsenceObservationPostgresStore(db);
  const gateAfter = new AuthorityRepeatedAbsenceGate(storeAfterProcessRestart);
  const secondProof = await gateAfter.observe({
    provider: 'github', targetKey: 'github://rotprods/cos-graph-engine/reconciliation/restart',
    minimumConsistencyWindowMs: 5_000, request: request(at(16_000)), providerRevision: 'rev-b',
    evidence: { requestId: 'absence-after-restart' },
  });
  check(secondProof.proven === true, 'repeated absence proof survives store/process restart');
  check(
    secondProof.evidence.absenceProofHashAlgorithm === 'sha256'
      && typeof secondProof.evidence.absenceProofHash === 'string',
    'restart proof remains SHA-256 integrity-bound',
  );

  const anyRow = [...db.rows.values()][0];
  if (!anyRow) throw new Error('expected persisted row');
  const originalEvidence = structuredClone(anyRow.evidence);
  anyRow.evidence = { ...anyRow.evidence, requestId: 'tampered-at-rest' };
  await assert.rejects(() => store.list(scope()), /ABSENCE_OBSERVATION_EVIDENCE_HASH_MISMATCH/);
  assertions += 1;
  anyRow.evidence = originalEvidence;

  const originalHash = anyRow.content_hash;
  anyRow.content_hash = '0'.repeat(64);
  await assert.rejects(() => store.list(scope()), /ABSENCE_OBSERVATION_HASH_MISMATCH/);
  assertions += 1;
  anyRow.content_hash = originalHash;

  console.log(`Authority Postgres absence-store contract: ${assertions} assertions passed`);
}

function scope() {
  return {
    provider: 'github' as const,
    targetKey: 'github://rotprods/cos-graph-engine/reconciliation/test',
    operationId: 'operation-1',
    providerIdempotencyKey: 'attempt-1',
    operationContentHash: 'content-1',
  };
}

function request(inspectedAt: string): AuthorityProviderInspectionRequest {
  return {
    operationId: 'operation-restart', projectId: 'COS_GRAPH_ENGINE', capability: 'authority_http_write',
    resourceUri: 'resource://github/issues/39', providerIdempotencyKey: 'attempt-restart', fencingToken: 11,
    inspectedAt,
    target: {
      kind: 'http', canonicalUrl: 'https://api.github.com/repos/rotprods/cos-graph-engine/issues/39',
      hostname: 'api.github.com', method: 'PATCH', targetDecisionHash: 'decision-restart',
    },
    input: { providerIdempotencyKey: 'attempt-restart' },
    operationContentHash: 'content-restart',
  };
}

async function makeObservation(
  observedAt: string,
  evidence: Record<string, unknown>,
  providerRevision: string,
): Promise<AuthorityAbsenceObservation> {
  const identity = {
    provider: 'github' as const,
    targetKey: 'github://rotprods/cos-graph-engine/reconciliation/test',
    operationId: 'operation-1',
    providerIdempotencyKey: 'attempt-1',
    operationContentHash: 'content-1',
    observedAt,
  };
  const evidenceHash = await sha256Hex(evidence);
  const content = {
    ...identity,
    providerRevision,
    evidence,
    evidenceHashAlgorithm: 'sha256' as const,
    evidenceHash,
    contentHashAlgorithm: 'sha256' as const,
  };
  return {
    observationId: `absence_${canonicalHash128(identity)}`,
    ...content,
    contentHash: await sha256Hex(content),
  };
}

interface FakeRow {
  observation_id: string;
  provider: 'github' | 'google_drive';
  target_key: string;
  operation_id: string;
  provider_idempotency_key: string;
  operation_content_hash: string;
  observed_at: string;
  provider_revision: unknown;
  evidence: Record<string, unknown>;
  evidence_hash_algorithm: string;
  evidence_hash: string;
  content_hash_algorithm: string;
  content_hash: string;
  inserted_at: string;
}

class FakePostgresExecutor implements PostgresExecutor {
  readonly rows = new Map<string, FakeRow>();
  schemaCalls = 0;

  async transaction<T>(fn: (tx: PostgresTransaction) => Promise<T>): Promise<T> {
    return fn({ query: this.query.bind(this) });
  }

  async query<Row = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('CREATE SCHEMA')) {
      this.schemaCalls += 1;
      return result<Row>([]);
    }
    if (normalized.startsWith('SELECT pg_advisory_xact_lock')) return result<Row>([]);

    if (normalized.startsWith('INSERT INTO cos_execution.authority_absence_observations')) {
      const row = rowFromParams(params);
      const existingSemantic = [...this.rows.values()].find(candidate =>
        candidate.provider === row.provider
        && candidate.target_key === row.target_key
        && candidate.operation_id === row.operation_id
        && candidate.provider_idempotency_key === row.provider_idempotency_key
        && candidate.operation_content_hash === row.operation_content_hash
        && candidate.observed_at === row.observed_at,
      );
      if (this.rows.has(row.observation_id) || existingSemantic) return result<Row>([]);
      this.rows.set(row.observation_id, row);
      return result<Row>([structuredClone(row) as Row]);
    }

    if (normalized.includes('WHERE observation_id=$1')) {
      const row = this.rows.get(String(params[0]));
      return result<Row>(row ? [structuredClone(row) as Row] : []);
    }

    if (normalized.includes('WHERE provider=$1 AND target_key=$2 AND operation_id=$3')) {
      const [provider, targetKey, operationId, providerKey, contentHash] = params.map(String);
      const rows = [...this.rows.values()]
        .filter(row => row.provider === provider)
        .filter(row => row.target_key === targetKey)
        .filter(row => row.operation_id === operationId)
        .filter(row => row.provider_idempotency_key === providerKey)
        .filter(row => row.operation_content_hash === contentHash)
        .sort((a, b) => a.observed_at.localeCompare(b.observed_at) || a.observation_id.localeCompare(b.observation_id));
      return result<Row>(rows.map(row => structuredClone(row) as Row));
    }

    throw new Error(`FAKE_POSTGRES_SQL_UNSUPPORTED ${normalized}`);
  }
}

function rowFromParams(params: unknown[]): FakeRow {
  return {
    observation_id: String(params[0]),
    provider: String(params[1]) as FakeRow['provider'],
    target_key: String(params[2]),
    operation_id: String(params[3]),
    provider_idempotency_key: String(params[4]),
    operation_content_hash: String(params[5]),
    observed_at: String(params[6]),
    provider_revision: JSON.parse(String(params[7])),
    evidence: JSON.parse(String(params[8])) as Record<string, unknown>,
    evidence_hash_algorithm: String(params[9]),
    evidence_hash: String(params[10]),
    content_hash_algorithm: String(params[11]),
    content_hash: String(params[12]),
    inserted_at: '2026-09-01T01:00:00.000Z',
  };
}

function result<Row>(rows: Row[]): PostgresQueryResult<Row> {
  return { rows, rowCount: rows.length };
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
