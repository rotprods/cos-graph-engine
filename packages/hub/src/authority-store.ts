import {
  CANONICAL_JSON_WIRE_VERSION,
  canonicalizeJsonValue,
  sha256Hex,
} from '@cos/core';
import type { IEventLog, PostgresExecutor } from '@cos/runtime';
import {
  AuthorityHub,
  type AuthorityHubReplayReport,
  type AuthorityHubSnapshot,
} from './authority-hub';

export interface AuthorityHubSnapshotEnvelope {
  id: string;
  schemaVersion: 1;
  /** Canonical JSON wire contract used for hashing and persistence. */
  serializationVersion: typeof CANONICAL_JSON_WIRE_VERSION;
  createdAt: string;
  /** Hydrated runtime snapshot. Persistence/integrity always use its canonical wire form. */
  snapshot: AuthorityHubSnapshot;
  semanticHash: string;
  integrityAlgorithm: 'sha256';
  integrityHash: string;
  metadata: Record<string, unknown>;
}

export interface AuthorityHubSnapshotManifest {
  id: string;
  schemaVersion: 1;
  serializationVersion: typeof CANONICAL_JSON_WIRE_VERSION;
  createdAt: string;
  eventSequence: number;
  semanticHash: string;
  integrityAlgorithm: 'sha256';
  integrityHash: string;
  repositoryCount: number;
  metadata: Record<string, unknown>;
}

export interface IAuthorityHubSnapshotStore {
  save(envelope: AuthorityHubSnapshotEnvelope): Promise<void>;
  get(id: string): Promise<AuthorityHubSnapshotEnvelope | null>;
  latest(): Promise<AuthorityHubSnapshotEnvelope | null>;
  list(): Promise<AuthorityHubSnapshotManifest[]>;
}

export class InMemoryAuthorityHubSnapshotStore implements IAuthorityHubSnapshotStore {
  private readonly snapshots = new Map<string, AuthorityHubSnapshotEnvelope>();

  async save(envelope: AuthorityHubSnapshotEnvelope): Promise<void> {
    await assertAuthorityHubEnvelopeIntegrity(envelope);
    const existing = this.snapshots.get(envelope.id);
    if (existing) {
      if (existing.integrityHash !== envelope.integrityHash) {
        throw new Error(`AUTHORITY_HUB_SNAPSHOT_ID_COLLISION id=${envelope.id}`);
      }
      return;
    }
    this.snapshots.set(envelope.id, cloneEnvelope(envelope));
  }

  async get(id: string): Promise<AuthorityHubSnapshotEnvelope | null> {
    const envelope = this.snapshots.get(id);
    if (!envelope) return null;
    await assertAuthorityHubEnvelopeIntegrity(envelope);
    return cloneEnvelope(envelope);
  }

  async latest(): Promise<AuthorityHubSnapshotEnvelope | null> {
    const envelope = Array.from(this.snapshots.values())
      .sort((left, right) =>
        right.snapshot.eventCursor.sequence - left.snapshot.eventCursor.sequence
        || right.createdAt.localeCompare(left.createdAt)
        || left.id.localeCompare(right.id))[0];
    if (!envelope) return null;
    await assertAuthorityHubEnvelopeIntegrity(envelope);
    return cloneEnvelope(envelope);
  }

  async list(): Promise<AuthorityHubSnapshotManifest[]> {
    return Array.from(this.snapshots.values())
      .sort((left, right) =>
        left.snapshot.eventCursor.sequence - right.snapshot.eventCursor.sequence
        || left.createdAt.localeCompare(right.createdAt)
        || left.id.localeCompare(right.id))
      .map(manifestFromEnvelope);
  }
}

interface AuthorityHubSnapshotRow {
  id: string;
  schema_version: number | string;
  serialization_version: number | string;
  created_at: string | Date;
  event_sequence: number | string;
  semantic_hash: string;
  integrity_algorithm: string;
  integrity_hash: string;
  repository_count: number | string;
  snapshot: unknown;
  metadata: unknown;
}

export const POSTGRES_AUTHORITY_HUB_SNAPSHOT_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_hub;

CREATE TABLE IF NOT EXISTS cos_hub.authority_snapshots (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  serialization_version INTEGER NOT NULL CHECK (serialization_version = 1),
  created_at TIMESTAMPTZ NOT NULL,
  event_sequence BIGINT NOT NULL CHECK (event_sequence >= 0),
  semantic_hash TEXT NOT NULL,
  integrity_algorithm TEXT NOT NULL CHECK (integrity_algorithm = 'sha256'),
  integrity_hash TEXT NOT NULL UNIQUE,
  repository_count INTEGER NOT NULL CHECK (repository_count >= 0),
  snapshot JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS cos_authority_hub_snapshots_cursor_idx
  ON cos_hub.authority_snapshots(event_sequence DESC, created_at DESC, id ASC);
`;

/** Driver-neutral Postgres/Supabase authority snapshot adapter. */
export class PostgresAuthorityHubSnapshotStore implements IAuthorityHubSnapshotStore {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(POSTGRES_AUTHORITY_HUB_SNAPSHOT_DDL);
  }

  async save(envelope: AuthorityHubSnapshotEnvelope): Promise<void> {
    await assertAuthorityHubEnvelopeIntegrity(envelope);
    const wireSnapshot = canonicalHubSnapshotWire(envelope.snapshot);
    const wireMetadata = canonicalObject(envelope.metadata, 'snapshot metadata');
    const result = await this.db.query<AuthorityHubSnapshotRow>(`
      INSERT INTO cos_hub.authority_snapshots (
        id, schema_version, serialization_version, created_at, event_sequence,
        semantic_hash, integrity_algorithm, integrity_hash, repository_count,
        snapshot, metadata
      ) VALUES ($1,1,$2,$3::timestamptz,$4,$5,'sha256',$6,$7,$8::jsonb,$9::jsonb)
      ON CONFLICT(id) DO NOTHING
      RETURNING *
    `, [
      envelope.id,
      envelope.serializationVersion,
      envelope.createdAt,
      envelope.snapshot.eventCursor.sequence,
      envelope.semanticHash,
      envelope.integrityHash,
      envelope.snapshot.repositories.length,
      JSON.stringify(wireSnapshot),
      JSON.stringify(wireMetadata),
    ]);
    if (result.rowCount === 1) return;
    const existing = await this.get(envelope.id);
    if (!existing || existing.integrityHash !== envelope.integrityHash) {
      throw new Error(`AUTHORITY_HUB_SNAPSHOT_ID_COLLISION id=${envelope.id}`);
    }
  }

  async get(id: string): Promise<AuthorityHubSnapshotEnvelope | null> {
    const result = await this.db.query<AuthorityHubSnapshotRow>(
      'SELECT * FROM cos_hub.authority_snapshots WHERE id=$1',
      [id],
    );
    if (!result.rowCount) return null;
    const envelope = rowToEnvelope(result.rows[0]);
    await assertAuthorityHubEnvelopeIntegrity(envelope);
    return envelope;
  }

  async latest(): Promise<AuthorityHubSnapshotEnvelope | null> {
    const result = await this.db.query<AuthorityHubSnapshotRow>(`
      SELECT * FROM cos_hub.authority_snapshots
      ORDER BY event_sequence DESC, created_at DESC, id ASC
      LIMIT 1
    `);
    if (!result.rowCount) return null;
    const envelope = rowToEnvelope(result.rows[0]);
    await assertAuthorityHubEnvelopeIntegrity(envelope);
    return envelope;
  }

  async list(): Promise<AuthorityHubSnapshotManifest[]> {
    const result = await this.db.query<AuthorityHubSnapshotRow>(`
      SELECT id, schema_version, serialization_version, created_at, event_sequence,
             semantic_hash, integrity_algorithm, integrity_hash, repository_count,
             '{}'::jsonb AS snapshot, metadata
      FROM cos_hub.authority_snapshots
      ORDER BY event_sequence ASC, created_at ASC, id ASC
    `);
    return result.rows.map(row => {
      const serializationVersion = Number(row.serialization_version);
      if (serializationVersion !== CANONICAL_JSON_WIRE_VERSION) {
        throw new Error(`Unsupported authority Hub row serialization ${row.serialization_version}`);
      }
      return {
        id: row.id,
        schemaVersion: Number(row.schema_version) as 1,
        serializationVersion: CANONICAL_JSON_WIRE_VERSION,
        createdAt: toIso(row.created_at),
        eventSequence: safeNonNegativeInteger(row.event_sequence, 'event sequence'),
        semanticHash: row.semantic_hash,
        integrityAlgorithm: 'sha256' as const,
        integrityHash: row.integrity_hash,
        repositoryCount: safeNonNegativeInteger(row.repository_count, 'repository count'),
        metadata: canonicalObject(row.metadata ?? {}, 'snapshot metadata'),
      };
    });
  }
}

export interface AuthorityHubSnapshotCreateRequest {
  id: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityHubRecoveryReport {
  snapshotId: string;
  snapshotCursor: number;
  finalCursor: number;
  snapshotSemanticHash: string;
  finalSemanticHash: string;
  postSnapshotEvents: number;
  exactSnapshotStateRecreated: boolean;
  replay: AuthorityHubReplayReport;
}

/**
 * Snapshot/recovery coordinator for the repository-runtime projection only.
 *
 * The AGENTIC registry, memory and knowledge projections are separate authority
 * domains with their own recovery contracts. This coordinator never claims to
 * restore those external domains implicitly.
 */
export class AuthorityHubSnapshotManager {
  constructor(
    private readonly store: IAuthorityHubSnapshotStore,
    private readonly eventLog: IEventLog,
  ) {}

  async create(hub: AuthorityHub, request: AuthorityHubSnapshotCreateRequest): Promise<AuthorityHubSnapshotEnvelope> {
    const id = nonEmpty(request.id, 'snapshot id');
    const createdAt = canonicalTime(request.createdAt, 'snapshot createdAt');
    const metadata = canonicalObject(request.metadata ?? {}, 'snapshot metadata');
    const snapshot = await hub.snapshot(createdAt);
    const integrityPayload = authorityHubIntegrityPayload({
      id,
      schemaVersion: 1,
      serializationVersion: CANONICAL_JSON_WIRE_VERSION,
      createdAt,
      snapshot,
      semanticHash: snapshot.stateHash,
      metadata,
    });
    const envelope: AuthorityHubSnapshotEnvelope = {
      id,
      schemaVersion: 1,
      serializationVersion: CANONICAL_JSON_WIRE_VERSION,
      createdAt,
      snapshot: hydrateAuthorityHubSnapshot(canonicalHubSnapshotWire(snapshot)),
      semanticHash: snapshot.stateHash,
      integrityAlgorithm: 'sha256',
      integrityHash: await sha256Hex(integrityPayload),
      metadata,
    };
    await this.store.save(envelope);
    return cloneEnvelope(envelope);
  }

  async loadVerified(id?: string): Promise<AuthorityHubSnapshotEnvelope | null> {
    const envelope = id ? await this.store.get(id) : await this.store.latest();
    if (!envelope) return null;
    await assertAuthorityHubEnvelopeIntegrity(envelope);
    return envelope;
  }

  async restoreLatest(): Promise<{ hub: AuthorityHub; report: AuthorityHubRecoveryReport }> {
    const envelope = await this.loadVerified();
    if (!envelope) throw new Error('AUTHORITY_HUB_SNAPSHOT_NOT_FOUND');
    const latestCursor = await this.eventLog.latestCursor();
    if (latestCursor.sequence < envelope.snapshot.eventCursor.sequence) {
      throw new Error(
        `AUTHORITY_HUB_EVENT_LOG_BEHIND_SNAPSHOT log=${latestCursor.sequence} snapshot=${envelope.snapshot.eventCursor.sequence}`,
      );
    }

    const hub = new AuthorityHub(this.eventLog);
    hub.restoreSnapshot(hydrateAuthorityHubSnapshot(canonicalHubSnapshotWire(envelope.snapshot)));
    const replay = await hub.replayFrom(envelope.snapshot.eventCursor);
    const finalCursor = await this.eventLog.latestCursor();
    const finalSemanticHash = hub.projectionHash();
    const postSnapshotEvents = finalCursor.sequence - envelope.snapshot.eventCursor.sequence;
    const exactSnapshotStateRecreated = postSnapshotEvents === 0
      && finalSemanticHash === envelope.semanticHash;
    if (postSnapshotEvents === 0 && !exactSnapshotStateRecreated) {
      throw new Error(
        `AUTHORITY_HUB_RESTORE_DIVERGENCE expected=${envelope.semanticHash} actual=${finalSemanticHash}`,
      );
    }

    return {
      hub,
      report: {
        snapshotId: envelope.id,
        snapshotCursor: envelope.snapshot.eventCursor.sequence,
        finalCursor: finalCursor.sequence,
        snapshotSemanticHash: envelope.semanticHash,
        finalSemanticHash,
        postSnapshotEvents,
        exactSnapshotStateRecreated,
        replay,
      },
    };
  }
}

export async function assertAuthorityHubEnvelopeIntegrity(envelope: AuthorityHubSnapshotEnvelope): Promise<void> {
  if (envelope.schemaVersion !== 1) throw new Error(`Unsupported authority Hub envelope schema ${envelope.schemaVersion}`);
  if (envelope.serializationVersion !== CANONICAL_JSON_WIRE_VERSION) {
    throw new Error(`Unsupported authority Hub serialization version ${String(envelope.serializationVersion)}`);
  }
  if (envelope.integrityAlgorithm !== 'sha256') {
    throw new Error(`Unsupported authority Hub integrity algorithm ${envelope.integrityAlgorithm}`);
  }
  if (envelope.semanticHash !== envelope.snapshot.stateHash) {
    throw new Error(`AUTHORITY_HUB_SNAPSHOT_SEMANTIC_HASH_MISMATCH id=${envelope.id}`);
  }
  canonicalTime(envelope.createdAt, 'snapshot createdAt');
  const metadata = canonicalObject(envelope.metadata, 'snapshot metadata');
  const actual = await sha256Hex(authorityHubIntegrityPayload({
    id: envelope.id,
    schemaVersion: envelope.schemaVersion,
    serializationVersion: envelope.serializationVersion,
    createdAt: envelope.createdAt,
    snapshot: envelope.snapshot,
    semanticHash: envelope.semanticHash,
    metadata,
  }));
  if (actual !== envelope.integrityHash) {
    throw new Error(`AUTHORITY_HUB_SNAPSHOT_INTEGRITY_FAILURE id=${envelope.id}`);
  }
}

function authorityHubIntegrityPayload(input: {
  id: string;
  schemaVersion: 1;
  serializationVersion: typeof CANONICAL_JSON_WIRE_VERSION;
  createdAt: string;
  snapshot: AuthorityHubSnapshot;
  semanticHash: string;
  metadata: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    id: input.id,
    schemaVersion: input.schemaVersion,
    serializationVersion: input.serializationVersion,
    createdAt: canonicalTime(input.createdAt, 'snapshot createdAt'),
    snapshot: canonicalHubSnapshotWire(input.snapshot),
    semanticHash: nonEmpty(input.semanticHash, 'snapshot semanticHash'),
    metadata: canonicalObject(input.metadata, 'snapshot metadata'),
  };
}

/** Canonical JSON form actually hashed and persisted. */
export function canonicalHubSnapshotWire(snapshot: AuthorityHubSnapshot): Record<string, unknown> {
  const value = canonicalizeJsonValue(snapshot);
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('Authority Hub snapshot must canonicalize to an object');
  }
  return value as Record<string, unknown>;
}

/**
 * Rehydrates runtime-only optional fields that JSONB legitimately omits.
 * This preserves the Hub's existing internal semantic hash while persistence is
 * migrated to the canonical wire contract. No new semantic information is added.
 */
export function hydrateAuthorityHubSnapshot(value: unknown): AuthorityHubSnapshot {
  const canonical = canonicalizeJsonValue(value);
  if (!canonical || Array.isArray(canonical) || typeof canonical !== 'object') {
    throw new Error('Authority Hub snapshot wire value must be an object');
  }
  const snapshot = structuredClone(canonical) as unknown as AuthorityHubSnapshot;
  if (snapshot.schemaVersion !== 1) throw new Error(`Unsupported Authority Hub snapshot schema ${String(snapshot.schemaVersion)}`);
  if (!snapshot.eventCursor || !Number.isSafeInteger(snapshot.eventCursor.sequence) || snapshot.eventCursor.sequence < 0) {
    throw new Error('Authority Hub snapshot contains invalid event cursor');
  }
  if (!Array.isArray(snapshot.repositories)) throw new Error('Authority Hub snapshot repositories must be an array');
  if (!snapshot.stateHash || typeof snapshot.stateHash !== 'string') throw new Error('Authority Hub snapshot stateHash is required');
  canonicalTime(snapshot.recordedAt, 'Hub snapshot recordedAt');
  for (const repository of snapshot.repositories) {
    if (!repository || typeof repository !== 'object') throw new Error('Authority Hub snapshot contains invalid repository');
    if (!Object.prototype.hasOwnProperty.call(repository, 'projectId')) {
      repository.projectId = undefined;
    }
  }
  return snapshot;
}

function rowToEnvelope(row: AuthorityHubSnapshotRow): AuthorityHubSnapshotEnvelope {
  if (Number(row.schema_version) !== 1) throw new Error(`Unsupported authority Hub row schema ${row.schema_version}`);
  if (Number(row.serialization_version) !== CANONICAL_JSON_WIRE_VERSION) {
    throw new Error(`Unsupported authority Hub row serialization ${row.serialization_version}`);
  }
  if (row.integrity_algorithm !== 'sha256') throw new Error(`Unsupported authority Hub row integrity ${row.integrity_algorithm}`);
  const snapshot = hydrateAuthorityHubSnapshot(row.snapshot);
  if (snapshot.eventCursor.sequence !== safeNonNegativeInteger(row.event_sequence, 'event sequence')) {
    throw new Error(`AUTHORITY_HUB_SNAPSHOT_CURSOR_ROW_MISMATCH id=${row.id}`);
  }
  if (snapshot.repositories.length !== safeNonNegativeInteger(row.repository_count, 'repository count')) {
    throw new Error(`AUTHORITY_HUB_SNAPSHOT_COUNT_ROW_MISMATCH id=${row.id}`);
  }
  return {
    id: row.id,
    schemaVersion: 1,
    serializationVersion: CANONICAL_JSON_WIRE_VERSION,
    createdAt: toIso(row.created_at),
    snapshot,
    semanticHash: row.semantic_hash,
    integrityAlgorithm: 'sha256',
    integrityHash: row.integrity_hash,
    metadata: canonicalObject(row.metadata ?? {}, 'snapshot metadata'),
  };
}

function manifestFromEnvelope(envelope: AuthorityHubSnapshotEnvelope): AuthorityHubSnapshotManifest {
  return {
    id: envelope.id,
    schemaVersion: envelope.schemaVersion,
    serializationVersion: envelope.serializationVersion,
    createdAt: envelope.createdAt,
    eventSequence: envelope.snapshot.eventCursor.sequence,
    semanticHash: envelope.semanticHash,
    integrityAlgorithm: envelope.integrityAlgorithm,
    integrityHash: envelope.integrityHash,
    repositoryCount: envelope.snapshot.repositories.length,
    metadata: canonicalObject(envelope.metadata, 'snapshot metadata'),
  };
}

function cloneEnvelope(envelope: AuthorityHubSnapshotEnvelope): AuthorityHubSnapshotEnvelope {
  return {
    ...envelope,
    snapshot: hydrateAuthorityHubSnapshot(canonicalHubSnapshotWire(envelope.snapshot)),
    metadata: canonicalObject(envelope.metadata, 'snapshot metadata'),
  };
}

function canonicalObject(value: unknown, label: string): Record<string, unknown> {
  const canonical = canonicalizeJsonValue(value);
  if (!canonical || Array.isArray(canonical) || typeof canonical !== 'object') {
    throw new Error(`${label} must be a canonical JSON object`);
  }
  return structuredClone(canonical) as Record<string, unknown>;
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function toIso(value: string | Date): string {
  const result = value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  if (!Number.isFinite(Date.parse(result))) throw new Error(`Invalid snapshot timestamp ${String(value)}`);
  return result;
}

function safeNonNegativeInteger(value: number | string, label: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`Invalid ${label}: ${String(value)}`);
  return number;
}
