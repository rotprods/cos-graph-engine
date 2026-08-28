import { sha256Hex } from '@cos/core';
import type { IEventLog, PostgresExecutor } from '@cos/runtime';
import {
  AuthorityHub,
  type AuthorityHubReplayReport,
  type AuthorityHubSnapshot,
} from './authority-hub';

export interface AuthorityHubSnapshotEnvelope {
  id: string;
  schemaVersion: 1;
  createdAt: string;
  snapshot: AuthorityHubSnapshot;
  semanticHash: string;
  integrityAlgorithm: 'sha256';
  integrityHash: string;
  metadata: Record<string, unknown>;
}

export interface AuthorityHubSnapshotManifest {
  id: string;
  schemaVersion: 1;
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
  created_at: string | Date;
  event_sequence: number | string;
  semantic_hash: string;
  integrity_algorithm: string;
  integrity_hash: string;
  repository_count: number | string;
  snapshot: AuthorityHubSnapshot;
  metadata: Record<string, unknown>;
}

export const POSTGRES_AUTHORITY_HUB_SNAPSHOT_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_hub;

CREATE TABLE IF NOT EXISTS cos_hub.authority_snapshots (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
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
    const result = await this.db.query<AuthorityHubSnapshotRow>(`
      INSERT INTO cos_hub.authority_snapshots (
        id, schema_version, created_at, event_sequence, semantic_hash,
        integrity_algorithm, integrity_hash, repository_count, snapshot, metadata
      ) VALUES ($1,1,$2::timestamptz,$3,$4,'sha256',$5,$6,$7::jsonb,$8::jsonb)
      ON CONFLICT(id) DO NOTHING
      RETURNING *
    `, [
      envelope.id,
      envelope.createdAt,
      envelope.snapshot.eventCursor.sequence,
      envelope.semanticHash,
      envelope.integrityHash,
      envelope.snapshot.repositories.length,
      JSON.stringify(envelope.snapshot),
      JSON.stringify(envelope.metadata),
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
      SELECT id, schema_version, created_at, event_sequence, semantic_hash,
             integrity_algorithm, integrity_hash, repository_count,
             '{}'::jsonb AS snapshot, metadata
      FROM cos_hub.authority_snapshots
      ORDER BY event_sequence ASC, created_at ASC, id ASC
    `);
    return result.rows.map(row => ({
      id: row.id,
      schemaVersion: Number(row.schema_version) as 1,
      createdAt: toIso(row.created_at),
      eventSequence: Number(row.event_sequence),
      semanticHash: row.semantic_hash,
      integrityAlgorithm: 'sha256',
      integrityHash: row.integrity_hash,
      repositoryCount: Number(row.repository_count),
      metadata: structuredClone(row.metadata ?? {}),
    }));
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
 * The AGENTIC registry, memory and other projections are separate authority
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
    const metadata = request.metadata ?? {};
    assertCanonicalJson(metadata, 'snapshot metadata');
    const snapshot = await hub.snapshot(createdAt);
    const integrityPayload = {
      id,
      schemaVersion: 1 as const,
      createdAt,
      snapshot,
      semanticHash: snapshot.stateHash,
      metadata,
    };
    const envelope: AuthorityHubSnapshotEnvelope = {
      ...integrityPayload,
      integrityAlgorithm: 'sha256',
      integrityHash: await sha256Hex(integrityPayload),
      metadata: structuredClone(metadata),
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
    hub.restoreSnapshot(envelope.snapshot);
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
  if (envelope.integrityAlgorithm !== 'sha256') {
    throw new Error(`Unsupported authority Hub integrity algorithm ${envelope.integrityAlgorithm}`);
  }
  if (envelope.semanticHash !== envelope.snapshot.stateHash) {
    throw new Error(`AUTHORITY_HUB_SNAPSHOT_SEMANTIC_HASH_MISMATCH id=${envelope.id}`);
  }
  canonicalTime(envelope.createdAt, 'snapshot createdAt');
  assertCanonicalJson(envelope.metadata, 'snapshot metadata');
  const payload = {
    id: envelope.id,
    schemaVersion: envelope.schemaVersion,
    createdAt: envelope.createdAt,
    snapshot: envelope.snapshot,
    semanticHash: envelope.semanticHash,
    metadata: envelope.metadata,
  };
  const actual = await sha256Hex(payload);
  if (actual !== envelope.integrityHash) {
    throw new Error(`AUTHORITY_HUB_SNAPSHOT_INTEGRITY_FAILURE id=${envelope.id}`);
  }
}

function rowToEnvelope(row: AuthorityHubSnapshotRow): AuthorityHubSnapshotEnvelope {
  if (Number(row.schema_version) !== 1) throw new Error(`Unsupported authority Hub row schema ${row.schema_version}`);
  if (row.integrity_algorithm !== 'sha256') throw new Error(`Unsupported authority Hub row integrity ${row.integrity_algorithm}`);
  const snapshot = structuredClone(row.snapshot);
  if (snapshot.eventCursor.sequence !== Number(row.event_sequence)) {
    throw new Error(`AUTHORITY_HUB_SNAPSHOT_CURSOR_ROW_MISMATCH id=${row.id}`);
  }
  if (snapshot.repositories.length !== Number(row.repository_count)) {
    throw new Error(`AUTHORITY_HUB_SNAPSHOT_COUNT_ROW_MISMATCH id=${row.id}`);
  }
  return {
    id: row.id,
    schemaVersion: 1,
    createdAt: toIso(row.created_at),
    snapshot,
    semanticHash: row.semantic_hash,
    integrityAlgorithm: 'sha256',
    integrityHash: row.integrity_hash,
    metadata: structuredClone(row.metadata ?? {}),
  };
}

function manifestFromEnvelope(envelope: AuthorityHubSnapshotEnvelope): AuthorityHubSnapshotManifest {
  return {
    id: envelope.id,
    schemaVersion: envelope.schemaVersion,
    createdAt: envelope.createdAt,
    eventSequence: envelope.snapshot.eventCursor.sequence,
    semanticHash: envelope.semanticHash,
    integrityAlgorithm: envelope.integrityAlgorithm,
    integrityHash: envelope.integrityHash,
    repositoryCount: envelope.snapshot.repositories.length,
    metadata: structuredClone(envelope.metadata),
  };
}

function cloneEnvelope(envelope: AuthorityHubSnapshotEnvelope): AuthorityHubSnapshotEnvelope {
  return {
    ...envelope,
    snapshot: structuredClone(envelope.snapshot),
    metadata: structuredClone(envelope.metadata),
  };
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function assertCanonicalJson(value: unknown, path: string, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`);
    return;
  }
  if (typeof value !== 'object') throw new Error(`${path} contains unsupported ${typeof value}`);
  if (seen.has(value as object)) throw new Error(`${path} contains a cycle`);
  seen.add(value as object);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertCanonicalJson(item, `${path}[${index}]`, seen));
    seen.delete(value as object);
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${path} contains a non-plain object`);
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    assertCanonicalJson(item, `${path}.${key}`, seen);
  }
  seen.delete(value as object);
}
