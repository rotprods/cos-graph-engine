import { sha256Hex } from '@cos/core';
import type { PostgresExecutor } from '@cos/runtime';
import { CosHub, type HubSnapshot } from './hub';

export interface StoredHubSnapshot {
  snapshot: HubSnapshot;
  integrityAlgorithm: 'sha-256';
  integrityHash: string;
}

export interface HubSnapshotManifest {
  stateHash: string;
  integrityHash: string;
  schemaVersion: number;
  recordedAt: string;
  eventCursor: number;
  repositoryCount: number;
}

export interface IHubSnapshotStore {
  save(snapshot: HubSnapshot): Promise<StoredHubSnapshot>;
  get(stateHash: string): Promise<StoredHubSnapshot | null>;
  latest(): Promise<StoredHubSnapshot | null>;
  list(): Promise<HubSnapshotManifest[]>;
}

export class InMemoryHubSnapshotStore implements IHubSnapshotStore {
  private readonly snapshots = new Map<string, StoredHubSnapshot>();
  private readonly order: string[] = [];

  async save(snapshot: HubSnapshot): Promise<StoredHubSnapshot> {
    const stored = await sealSnapshot(snapshot);
    const existing = this.snapshots.get(snapshot.stateHash);
    if (existing) {
      if (existing.integrityHash !== stored.integrityHash) {
        throw new Error(`HUB_SNAPSHOT_STATE_HASH_COLLISION stateHash=${snapshot.stateHash}`);
      }
      return cloneStored(existing);
    }
    this.snapshots.set(snapshot.stateHash, cloneStored(stored));
    this.order.push(snapshot.stateHash);
    return cloneStored(stored);
  }

  async get(stateHash: string): Promise<StoredHubSnapshot | null> {
    const stored = this.snapshots.get(stateHash);
    return stored ? cloneStored(stored) : null;
  }

  async latest(): Promise<StoredHubSnapshot | null> {
    const stateHash = this.order[this.order.length - 1];
    return stateHash ? this.get(stateHash) : null;
  }

  async list(): Promise<HubSnapshotManifest[]> {
    return this.order.map(stateHash => manifest(this.snapshots.get(stateHash)!));
  }
}

interface HubSnapshotRow {
  state_hash: string;
  integrity_hash: string;
  integrity_algorithm: string;
  schema_version: number | string;
  recorded_at: string | Date;
  event_cursor: number | string;
  repository_count: number | string;
  snapshot: HubSnapshot;
}

export const POSTGRES_HUB_SNAPSHOT_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_hub;

CREATE TABLE IF NOT EXISTS cos_hub.snapshots (
  state_hash TEXT PRIMARY KEY,
  integrity_hash TEXT NOT NULL UNIQUE,
  integrity_algorithm TEXT NOT NULL CHECK (integrity_algorithm = 'sha-256'),
  schema_version INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  event_cursor BIGINT NOT NULL CHECK (event_cursor >= 0),
  repository_count INTEGER NOT NULL CHECK (repository_count >= 0),
  snapshot JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS cos_hub_snapshots_recorded_idx
  ON cos_hub.snapshots(recorded_at DESC, state_hash ASC);
`;

/** Driver-neutral Postgres/Supabase snapshot adapter. */
export class PostgresHubSnapshotStore implements IHubSnapshotStore {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(POSTGRES_HUB_SNAPSHOT_DDL);
  }

  async save(snapshot: HubSnapshot): Promise<StoredHubSnapshot> {
    const stored = await sealSnapshot(snapshot);
    const result = await this.db.query<HubSnapshotRow>(`
      INSERT INTO cos_hub.snapshots (
        state_hash, integrity_hash, integrity_algorithm, schema_version,
        recorded_at, event_cursor, repository_count, snapshot
      ) VALUES ($1,$2,'sha-256',$3,$4::timestamptz,$5,$6,$7::jsonb)
      ON CONFLICT (state_hash) DO NOTHING
      RETURNING *
    `, [
      snapshot.stateHash,
      stored.integrityHash,
      snapshot.schemaVersion,
      snapshot.recordedAt,
      snapshot.eventCursor.sequence,
      snapshot.repositories.length,
      JSON.stringify(snapshot),
    ]);

    if (result.rowCount === 1) return rowToStored(result.rows[0]);
    const existing = await this.get(snapshot.stateHash);
    if (!existing) throw new Error(`HUB_SNAPSHOT_INSERT_LOST stateHash=${snapshot.stateHash}`);
    if (existing.integrityHash !== stored.integrityHash) {
      throw new Error(`HUB_SNAPSHOT_STATE_HASH_COLLISION stateHash=${snapshot.stateHash}`);
    }
    return existing;
  }

  async get(stateHash: string): Promise<StoredHubSnapshot | null> {
    const result = await this.db.query<HubSnapshotRow>(
      'SELECT * FROM cos_hub.snapshots WHERE state_hash=$1',
      [stateHash],
    );
    if (!result.rowCount) return null;
    const stored = rowToStored(result.rows[0]);
    await assertSnapshotIntegrity(stored);
    return stored;
  }

  async latest(): Promise<StoredHubSnapshot | null> {
    const result = await this.db.query<HubSnapshotRow>(`
      SELECT * FROM cos_hub.snapshots
      ORDER BY recorded_at DESC, state_hash ASC
      LIMIT 1
    `);
    if (!result.rowCount) return null;
    const stored = rowToStored(result.rows[0]);
    await assertSnapshotIntegrity(stored);
    return stored;
  }

  async list(): Promise<HubSnapshotManifest[]> {
    const result = await this.db.query<HubSnapshotRow>(`
      SELECT state_hash, integrity_hash, integrity_algorithm, schema_version,
             recorded_at, event_cursor, repository_count, '{}'::jsonb AS snapshot
      FROM cos_hub.snapshots
      ORDER BY recorded_at ASC, state_hash ASC
    `);
    return result.rows.map(row => ({
      stateHash: row.state_hash,
      integrityHash: row.integrity_hash,
      schemaVersion: Number(row.schema_version),
      recordedAt: toIso(row.recorded_at),
      eventCursor: Number(row.event_cursor),
      repositoryCount: Number(row.repository_count),
    }));
  }
}

export interface HubRecoveryReport {
  restoredStateHash: string;
  verifiedIntegrityHash: string;
  repositoryCount: number;
  dimensionRelationCount: number;
  replayCursor: number;
  warnings: string[];
}

/**
 * Restores a fresh CosHub from a sealed snapshot and its canonical event log.
 * Agent/workflow IDs are retained as snapshot evidence; their full definitions
 * require their own projectors and are therefore reported as warnings.
 */
export class HubRecoveryCoordinator {
  constructor(private readonly store: IHubSnapshotStore) {}

  async restoreLatest(hub: CosHub): Promise<HubRecoveryReport> {
    if (hub.listRepositories().length > 0) {
      throw new Error('HUB_RESTORE_REQUIRES_EMPTY_PROJECTION');
    }
    const stored = await this.store.latest();
    if (!stored) throw new Error('HUB_SNAPSHOT_NOT_FOUND');
    await assertSnapshotIntegrity(stored);

    for (const repository of stored.snapshot.repositories) {
      const restored = hub.registerRepository(
        repository.owner,
        repository.name,
        repository.metadata,
      );
      if (restored.id !== repository.id || restored.canonicalUri !== repository.canonicalUri) {
        throw new Error(`HUB_IDENTITY_RESTORE_MISMATCH repository=${repository.fullName}`);
      }
    }

    let dimensionRelationCount = 0;
    for (const raw of stored.snapshot.graph.relations) {
      if (!raw || typeof raw !== 'object') continue;
      const relation = raw as Record<string, unknown>;
      if (relation.type !== 'in_dimension') continue;
      if (typeof relation.source !== 'string' || typeof relation.target !== 'string') continue;
      const repository = hub.getRepository(relation.source);
      if (!repository) continue;
      hub.attachDimension(
        repository.id,
        relation.target,
        typeof relation.confidence === 'number' ? relation.confidence : 1,
      );
      dimensionRelationCount += 1;
    }

    await hub.replayRepoStates();
    const restoredSnapshot = await hub.snapshot();
    if (restoredSnapshot.stateHash !== stored.snapshot.stateHash) {
      throw new Error(
        `HUB_RESTORE_STATE_DIVERGED expected=${stored.snapshot.stateHash} current=${restoredSnapshot.stateHash}`,
      );
    }

    const warnings: string[] = [];
    if (stored.snapshot.agentIds.length > 0) {
      warnings.push(`${stored.snapshot.agentIds.length} agent IDs require the agent projector for definition restore`);
    }
    if (stored.snapshot.workflowIds.length > 0) {
      warnings.push(`${stored.snapshot.workflowIds.length} workflow IDs require the workflow projector for definition restore`);
    }

    return {
      restoredStateHash: restoredSnapshot.stateHash,
      verifiedIntegrityHash: stored.integrityHash,
      repositoryCount: restoredSnapshot.repositories.length,
      dimensionRelationCount,
      replayCursor: restoredSnapshot.eventCursor.sequence,
      warnings,
    };
  }
}

async function sealSnapshot(snapshot: HubSnapshot): Promise<StoredHubSnapshot> {
  if (snapshot.schemaVersion !== 2) {
    throw new Error(`Unsupported Hub snapshot schema ${snapshot.schemaVersion}`);
  }
  const integrityHash = await sha256Hex(snapshot);
  return {
    snapshot: structuredClone(snapshot),
    integrityAlgorithm: 'sha-256',
    integrityHash,
  };
}

async function assertSnapshotIntegrity(stored: StoredHubSnapshot): Promise<void> {
  if (stored.integrityAlgorithm !== 'sha-256') {
    throw new Error(`Unsupported Hub snapshot integrity algorithm ${stored.integrityAlgorithm}`);
  }
  const actual = await sha256Hex(stored.snapshot);
  if (actual !== stored.integrityHash) {
    throw new Error(`HUB_SNAPSHOT_INTEGRITY_FAILED expected=${stored.integrityHash} actual=${actual}`);
  }
}

function cloneStored(stored: StoredHubSnapshot): StoredHubSnapshot {
  return {
    snapshot: structuredClone(stored.snapshot),
    integrityAlgorithm: stored.integrityAlgorithm,
    integrityHash: stored.integrityHash,
  };
}

function manifest(stored: StoredHubSnapshot): HubSnapshotManifest {
  return {
    stateHash: stored.snapshot.stateHash,
    integrityHash: stored.integrityHash,
    schemaVersion: stored.snapshot.schemaVersion,
    recordedAt: stored.snapshot.recordedAt,
    eventCursor: stored.snapshot.eventCursor.sequence,
    repositoryCount: stored.snapshot.repositories.length,
  };
}

function rowToStored(row: HubSnapshotRow): StoredHubSnapshot {
  if (row.integrity_algorithm !== 'sha-256') {
    throw new Error(`Unsupported Hub snapshot integrity algorithm ${row.integrity_algorithm}`);
  }
  const snapshot = structuredClone(row.snapshot);
  if (snapshot.stateHash !== row.state_hash) {
    throw new Error(`HUB_SNAPSHOT_ROW_MISMATCH stateHash=${row.state_hash}`);
  }
  return {
    snapshot,
    integrityAlgorithm: 'sha-256',
    integrityHash: row.integrity_hash,
  };
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}