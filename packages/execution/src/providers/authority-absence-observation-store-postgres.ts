import { canonicalHash128, canonicalSerialize, sha256Hex } from '@cos/core';
import type { PostgresExecutor, PostgresTransaction } from '@cos/runtime';
import {
  AUTHORITY_ABSENCE_HASH_ALGORITHM,
  type AuthorityAbsenceObservation,
  type AuthorityAbsenceObservationStore,
  type AuthorityReadOnlyProvider,
} from './authority-provider-inspection-shared';

interface AbsenceObservationRow {
  observation_id: string;
  provider: AuthorityReadOnlyProvider;
  target_key: string;
  operation_id: string;
  provider_idempotency_key: string;
  operation_content_hash: string;
  observed_at: string | Date;
  provider_revision: unknown;
  evidence: Record<string, unknown>;
  evidence_hash_algorithm: string;
  evidence_hash: string;
  content_hash_algorithm: string;
  content_hash: string;
  inserted_at: string | Date;
}

export const AUTHORITY_ABSENCE_OBSERVATION_POSTGRES_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_execution;

CREATE TABLE IF NOT EXISTS cos_execution.authority_absence_observations (
  observation_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('github','google_drive')),
  target_key TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  provider_idempotency_key TEXT NOT NULL,
  operation_content_hash TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  provider_revision JSONB,
  evidence JSONB NOT NULL,
  evidence_hash_algorithm TEXT NOT NULL CHECK (evidence_hash_algorithm='sha256'),
  evidence_hash TEXT NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  content_hash_algorithm TEXT NOT NULL CHECK (content_hash_algorithm='sha256'),
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, target_key, operation_id, provider_idempotency_key, operation_content_hash, observed_at)
);

CREATE INDEX IF NOT EXISTS cos_authority_absence_lookup_idx
  ON cos_execution.authority_absence_observations(
    provider, target_key, operation_id, provider_idempotency_key,
    operation_content_hash, observed_at ASC
  );
`;

/**
 * Append-only PostgreSQL/Supabase persistence for repeated absence evidence.
 *
 * There is deliberately no update/delete API. The DB insertion timestamp is
 * operational metadata only; semantic identity and integrity are reconstructed
 * entirely from AuthorityAbsenceObservation fields.
 */
export class AuthorityAbsenceObservationPostgresStore implements AuthorityAbsenceObservationStore {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(AUTHORITY_ABSENCE_OBSERVATION_POSTGRES_DDL);
  }

  async append(raw: AuthorityAbsenceObservation): Promise<void> {
    const observation = await verifyObservation(raw);
    await this.db.transaction(async tx => {
      await tx.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [observation.observationId],
      );

      const inserted = await tx.query<AbsenceObservationRow>(`
        INSERT INTO cos_execution.authority_absence_observations (
          observation_id, provider, target_key, operation_id,
          provider_idempotency_key, operation_content_hash, observed_at,
          provider_revision, evidence, evidence_hash_algorithm, evidence_hash,
          content_hash_algorithm, content_hash
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7::timestamptz,$8::jsonb,$9::jsonb,$10,$11,$12,$13
        )
        ON CONFLICT DO NOTHING
        RETURNING *
      `, toParams(observation));

      if (inserted.rowCount === 1) return;
      const existing = await selectById(tx, observation.observationId);
      if (!existing) {
        throw new Error(`ABSENCE_OBSERVATION_APPEND_CONFLICT id=${observation.observationId}`);
      }
      const verified = await rowToObservation(existing);
      if (verified.contentHash !== observation.contentHash) {
        throw new Error(`ABSENCE_OBSERVATION_CONFLICT id=${observation.observationId}`);
      }
    });
  }

  async list(input: {
    provider: AuthorityReadOnlyProvider;
    targetKey: string;
    operationId: string;
    providerIdempotencyKey: string;
    operationContentHash: string;
  }): Promise<AuthorityAbsenceObservation[]> {
    const provider = assertProvider(input.provider);
    const targetKey = nonEmpty(input.targetKey, 'targetKey');
    const operationId = nonEmpty(input.operationId, 'operationId');
    const providerIdempotencyKey = nonEmpty(input.providerIdempotencyKey, 'providerIdempotencyKey');
    const operationContentHash = nonEmpty(input.operationContentHash, 'operationContentHash');
    const result = await this.db.query<AbsenceObservationRow>(`
      SELECT * FROM cos_execution.authority_absence_observations
      WHERE provider=$1 AND target_key=$2 AND operation_id=$3
        AND provider_idempotency_key=$4 AND operation_content_hash=$5
      ORDER BY observed_at ASC, observation_id ASC
    `, [provider, targetKey, operationId, providerIdempotencyKey, operationContentHash]);

    const observations: AuthorityAbsenceObservation[] = [];
    for (const row of result.rows) observations.push(await rowToObservation(row));
    return observations;
  }
}

async function selectById(
  db: Pick<PostgresTransaction, 'query'>,
  observationId: string,
): Promise<AbsenceObservationRow | null> {
  const result = await db.query<AbsenceObservationRow>(`
    SELECT * FROM cos_execution.authority_absence_observations
    WHERE observation_id=$1
  `, [observationId]);
  return result.rowCount ? result.rows[0] : null;
}

function toParams(observation: AuthorityAbsenceObservation): unknown[] {
  return [
    observation.observationId,
    observation.provider,
    observation.targetKey,
    observation.operationId,
    observation.providerIdempotencyKey,
    observation.operationContentHash,
    observation.observedAt,
    JSON.stringify(observation.providerRevision),
    JSON.stringify(observation.evidence),
    observation.evidenceHashAlgorithm,
    observation.evidenceHash,
    observation.contentHashAlgorithm,
    observation.contentHash,
  ];
}

async function rowToObservation(row: AbsenceObservationRow): Promise<AuthorityAbsenceObservation> {
  return verifyObservation({
    observationId: row.observation_id,
    provider: assertProvider(row.provider),
    targetKey: row.target_key,
    operationId: row.operation_id,
    providerIdempotencyKey: row.provider_idempotency_key,
    operationContentHash: row.operation_content_hash,
    observedAt: toIso(row.observed_at, 'observed_at'),
    providerRevision: normalizeJsonValue(row.provider_revision),
    evidence: canonicalClone(row.evidence, 'absence row evidence'),
    evidenceHashAlgorithm: assertSha256Algorithm(row.evidence_hash_algorithm, 'evidence_hash_algorithm'),
    evidenceHash: row.evidence_hash,
    contentHashAlgorithm: assertSha256Algorithm(row.content_hash_algorithm, 'content_hash_algorithm'),
    contentHash: row.content_hash,
  });
}

/** Rebuild and verify every semantic byte; never trust DB hash columns alone. */
async function verifyObservation(raw: AuthorityAbsenceObservation): Promise<AuthorityAbsenceObservation> {
  const value = canonicalClone(raw, 'absence observation');
  const provider = assertProvider(value.provider);
  const targetKey = nonEmpty(value.targetKey, 'targetKey');
  const operationId = nonEmpty(value.operationId, 'operationId');
  const providerIdempotencyKey = nonEmpty(value.providerIdempotencyKey, 'providerIdempotencyKey');
  const operationContentHash = nonEmpty(value.operationContentHash, 'operationContentHash');
  const observedAt = toIso(value.observedAt, 'observedAt');
  const providerRevision = normalizeJsonValue(value.providerRevision);
  const evidence = canonicalClone(value.evidence, 'absence evidence');
  const evidenceHashAlgorithm = assertSha256Algorithm(value.evidenceHashAlgorithm, 'evidenceHashAlgorithm');
  const contentHashAlgorithm = assertSha256Algorithm(value.contentHashAlgorithm, 'contentHashAlgorithm');
  assertSha256(value.evidenceHash, 'evidenceHash');
  assertSha256(value.contentHash, 'contentHash');

  const expectedEvidenceHash = await sha256Hex(evidence);
  if (value.evidenceHash !== expectedEvidenceHash) {
    throw new Error(
      `ABSENCE_OBSERVATION_EVIDENCE_HASH_MISMATCH expected=${expectedEvidenceHash} actual=${value.evidenceHash}`,
    );
  }

  const identity = {
    provider,
    targetKey,
    operationId,
    providerIdempotencyKey,
    operationContentHash,
    observedAt,
  };
  const expectedId = `absence_${canonicalHash128(identity)}`;
  if (value.observationId !== expectedId) {
    throw new Error(`ABSENCE_OBSERVATION_ID_MISMATCH expected=${expectedId} actual=${value.observationId}`);
  }

  const content = {
    ...identity,
    providerRevision,
    evidence,
    evidenceHashAlgorithm,
    evidenceHash: expectedEvidenceHash,
    contentHashAlgorithm,
  };
  const expectedContentHash = await sha256Hex(content);
  if (value.contentHash !== expectedContentHash) {
    throw new Error(
      `ABSENCE_OBSERVATION_HASH_MISMATCH expected=${expectedContentHash} actual=${value.contentHash}`,
    );
  }

  return {
    observationId: expectedId,
    ...content,
    contentHash: expectedContentHash,
  };
}

function assertProvider(value: string): AuthorityReadOnlyProvider {
  if (value !== 'github' && value !== 'google_drive') {
    throw new Error(`ABSENCE_OBSERVATION_PROVIDER_INVALID provider=${value}`);
  }
  return value;
}

function assertSha256Algorithm(
  value: string,
  label: string,
): typeof AUTHORITY_ABSENCE_HASH_ALGORITHM {
  if (value !== AUTHORITY_ABSENCE_HASH_ALGORITHM) {
    throw new Error(`${label} must be ${AUTHORITY_ABSENCE_HASH_ALGORITHM}`);
  }
  return AUTHORITY_ABSENCE_HASH_ALGORITHM;
}

function assertSha256(value: string, label: string): void {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`${label} must be 64 lowercase hex SHA-256`);
}

function normalizeJsonValue(value: unknown): string | number | null {
  if (value === null) return null;
  if (typeof value === 'string') return nonEmpty(value, 'providerRevision');
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  throw new Error('providerRevision must be null, non-empty string or non-negative safe integer');
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${message(error)}`);
  }
}

function toIso(value: string | Date, label: string): string {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${String(value)}`);
  return new Date(parsed).toISOString();
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
