import { sha256Hex, stableHash128 } from '@cos/core';
import type { EventLogCursor, IEventLog, PostgresExecutor } from '@cos/runtime';
import { CosHub, type HubSnapshot } from './hub';

export interface HubSnapshotEnvelope {
  id: string;
  schemaVersion: 1;
  createdAt: string;
  eventCursor: EventLogCursor;
  snapshot: HubSnapshot;
  semanticHash: string;
  integrityAlgorithm: 'sha256';
  integrityHash: string;
  metadata: Record<string, unknown>;
}

export interface IHubSnapshotStore {
  save(snapshot: HubSnapshotEnvelope): Promise<void>;
  get(id: string): Promise<HubSnapshotEnvelope | null>;
  latest(): Promise<HubSnapshotEnvelope | null>;
  list(): Promise<Array<Omit<HubSnapshotEnvelope, 'snapshot'>>>;
}

export class InMemoryHubSnapshotStore implements IHubSnapshotStore {
  private snapshots = new Map<string, HubSnapshotEnvelope>();

  async save(envelope: HubSnapshotEnvelope): Promise<void> {
    const existing = this.snapshots.get(envelope.id);
    if (existing) {
      if (existing.integrityHash !== envelope.integrityHash) {
        throw new Error(`Hub snapshot ID collision: ${envelope.id}`);
      }
      return;
    }
    this.snapshots.set(envelope.id, cloneEnvelope(envelope));
  }

  async get(id: string): Promise<HubSnapshotEnvelope | null> {
    const snapshot = this.snapshots.get(id);
    return snapshot ? cloneEnvelope(snapshot) : null;
  }

  async latest(): Promise<HubSnapshotEnvelope | null> {
    const latest = Array.from(this.snapshots.values())
      .sort((a, b) => b.eventCursor.sequence - a.eventCursor.sequence || b.createdAt.localeCompare(a.createdAt))[0];
    return latest ? cloneEnvelope(latest) : null;
  }

  async list(): Promise<Array<Omit<HubSnapshotEnvelope, 'snapshot'>>> {
    return Array.from(this.snapshots.values())
      .sort((a, b) => a.eventCursor.sequence - b.eventCursor.sequence || a.createdAt.localeCompare(b.createdAt))
      .map(({ snapshot: _snapshot, ...manifest }) => structuredClone(manifest));
  }
}

interface HubSnapshotRow {
  id: string;
  schema_version: number | string;
  created_at: string | Date;
  event_sequence: number | string;
  snapshot: HubSnapshot;
  semantic_hash: string;
  integrity_algorithm: 'sha256';
  integrity_hash: string;
  metadata: Record<string, unknown>;
}

export const POSTGRES_HUB_SNAPSHOT_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_hub;

CREATE TABLE IF NOT EXISTS cos_hub.snapshots (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  event_sequence BIGINT NOT NULL CHECK (event_sequence >= 0),
  snapshot JSONB NOT NULL,
  semantic_hash TEXT NOT NULL,
  integrity_algorithm TEXT NOT NULL CHECK (integrity_algorithm = 'sha256'),
  integrity_hash TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS cos_hub_snapshots_cursor_idx
  ON cos_hub.snapshots(event_sequence DESC, created_at DESC);
`;

export class PostgresHubSnapshotStore implements IHubSnapshotStore {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(POSTGRES_HUB_SNAPSHOT_DDL);
  }

  async save(envelope: HubSnapshotEnvelope): Promise<void> {
    const result = await this.db.query<HubSnapshotRow>(`
      INSERT INTO cos_hub.snapshots (
        id, schema_version, created_at, event_sequence, snapshot,
        semantic_hash, integrity_algorithm, integrity_hash, metadata
      ) VALUES ($1,$2,$3::timestamptz,$4,$5::jsonb,$6,$7,$8,$9::jsonb)
      ON CONFLICT(id) DO NOTHING
      RETURNING *
    `, [
      envelope.id,
      envelope.schemaVersion,
      envelope.createdAt,
      envelope.eventCursor.sequence,
      JSON.stringify(envelope.snapshot),
      envelope.semanticHash,
      envelope.integrityAlgorithm,
      envelope.integrityHash,
      JSON.stringify(envelope.metadata),
    ]);
    if (result.rowCount === 1) return;

    const existing = await this.get(envelope.id);
    if (!existing || existing.integrityHash !== envelope.integrityHash) {
      throw new Error(`Hub snapshot ID collision: ${envelope.id}`);
    }
  }

  async get(id: string): Promise<HubSnapshotEnvelope | null> {
    const result = await this.db.query<HubSnapshotRow>('SELECT * FROM cos_hub.snapshots WHERE id=$1', [id]);
    return result.rowCount ? rowToEnvelope(result.rows[0]) : null;
  }

  async latest(): Promise<HubSnapshotEnvelope | null> {
    const result = await this.db.query<HubSnapshotRow>(`
      SELECT * FROM cos_hub.snapshots
      ORDER BY event_sequence DESC, created_at DESC
      LIMIT 1
    `);
    return result.rowCount ? rowToEnvelope(result.rows[0]) : null;
  }

  async list(): Promise<Array<Omit<HubSnapshotEnvelope, 'snapshot'>>> {
    const result = await this.db.query<Omit<HubSnapshotRow, 'snapshot'>>(`
      SELECT id, schema_version, created_at, event_sequence,
             semantic_hash, integrity_algorithm, integrity_hash, metadata
      FROM cos_hub.snapshots
      ORDER BY event_sequence ASC, created_at ASC
    `);
    return result.rows.map(row => ({
      id: row.id,
      schemaVersion: Number(row.schema_version) as 1,
      createdAt: toIso(row.created_at),
      eventCursor: { sequence: Number(row.event_sequence) },
      semanticHash: row.semantic_hash,
      integrityAlgorithm: row.integrity_algorithm,
      integrityHash: row.integrity_hash,
      metadata: structuredClone(row.metadata || {}),
    }));
  }
}

export interface HubRestoreOptions {
  allowUnrestorableAgentWorkflowIds?: boolean;
}

export interface HubRestoreReport {
  snapshotId: string;
  snapshotCursor: EventLogCursor;
  finalCursor: EventLogCursor;
  snapshotSemanticHash: string;
  finalSemanticHash: string;
  postSnapshotEvents: number;
  exactSnapshotStateRecreated: boolean;
  warnings: string[];
}

/**
 * Coordinates portable Hub snapshots and empty-process recovery.
 *
 * Repository topology is seeded from the snapshot, while repository state is
 * rebuilt from the canonical event log. This intentionally favors correctness
 * over optimized cursor-only restore until every non-repository projection has
 * a complete import contract.
 */
export class HubSnapshotManager {
  constructor(
    private readonly store: IHubSnapshotStore,
    private readonly eventLog: IEventLog,
  ) {}

  async create(
    hub: CosHub,
    snapshotId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<HubSnapshotEnvelope> {
    const id = snapshotId.trim();
    if (!id) throw new Error('Hub snapshotId must not be empty');
    const snapshot = await hub.snapshot();
    const semanticHash = hubSemanticHash(snapshot);
    const createdAt = new Date().toISOString();
    const integrityPayload = {
      id,
      schemaVersion: 1,
      createdAt,
      eventCursor: snapshot.eventCursor,
      snapshot,
      semanticHash,
      metadata,
    };
    const envelope: HubSnapshotEnvelope = {
      ...integrityPayload,
      integrityAlgorithm: 'sha256',
      integrityHash: await sha256Hex(integrityPayload),
      metadata: structuredClone(metadata),
    };
    await this.store.save(envelope);
    return cloneEnvelope(envelope);
  }

  async loadVerified(id?: string): Promise<HubSnapshotEnvelope | null> {
    const envelope = id ? await this.store.get(id) : await this.store.latest();
    if (!envelope) return null;
    await assertEnvelopeIntegrity(envelope);
    return envelope;
  }

  async restoreLatest(options: HubRestoreOptions = {}): Promise<{
    hub: CosHub;
    report: HubRestoreReport;
  }> {
    const envelope = await this.loadVerified();
    if (!envelope) throw new Error('No Hub snapshot is available for restore');
    const warnings: string[] = [];
    if ((envelope.snapshot.agentIds.length || envelope.snapshot.workflowIds.length)
      && !options.allowUnrestorableAgentWorkflowIds) {
      throw new Error(
        'Hub snapshot contains agent/workflow IDs but their definitions are not yet importable; refusing partial restore',
      );
    }
    if (envelope.snapshot.agentIds.length || envelope.snapshot.workflowIds.length) {
      warnings.push('Agent/workflow IDs were not restored because definition snapshots are not yet available');
    }

    const hub = new CosHub(this.eventLog);
    for (const repository of envelope.snapshot.repositories) {
      hub.registerRepository(repository.owner, repository.name, repository.metadata);
    }
    for (const relation of envelope.snapshot.graph.relations as Array<Record<string, unknown>>) {
      const source = typeof relation.source === 'string' ? relation.source : null;
      const target = typeof relation.target === 'string' ? relation.target : null;
      if (!source || !target || !/^L\d+$/.test(target)) continue;
      const repository = hub.getRepository(source);
      if (!repository) continue;
      const confidence = typeof relation.confidence === 'number' ? relation.confidence : 1;
      hub.attachDimension(repository.id, target, confidence);
    }

    await hub.replayRepoStates();
    const finalSnapshot = await hub.snapshot();
    const finalCursor = await this.eventLog.latestCursor();
    const finalSemanticHash = hubSemanticHash(finalSnapshot);
    const postSnapshotEvents = Math.max(0, finalCursor.sequence - envelope.eventCursor.sequence);
    const exactSnapshotStateRecreated = postSnapshotEvents === 0
      && finalSemanticHash === envelope.semanticHash;
    if (postSnapshotEvents === 0 && !exactSnapshotStateRecreated) {
      throw new Error(
        `HUB_RESTORE_DIVERGENCE expected=${envelope.semanticHash} actual=${finalSemanticHash}`,
      );
    }

    return {
      hub,
      report: {
        snapshotId: envelope.id,
        snapshotCursor: envelope.eventCursor,
        finalCursor,
        snapshotSemanticHash: envelope.semanticHash,
        finalSemanticHash,
        postSnapshotEvents,
        exactSnapshotStateRecreated,
        warnings,
      },
    };
  }
}

export async function assertEnvelopeIntegrity(envelope: HubSnapshotEnvelope): Promise<void> {
  if (envelope.schemaVersion !== 1) throw new Error(`Unsupported Hub snapshot schema ${envelope.schemaVersion}`);
  const payload = {
    id: envelope.id,
    schemaVersion: envelope.schemaVersion,
    createdAt: envelope.createdAt,
    eventCursor: envelope.eventCursor,
    snapshot: envelope.snapshot,
    semanticHash: envelope.semanticHash,
    metadata: envelope.metadata,
  };
  const calculated = await sha256Hex(payload);
  if (calculated !== envelope.integrityHash) {
    throw new Error(`HUB_SNAPSHOT_INTEGRITY_FAILURE id=${envelope.id}`);
  }
  const semantic = hubSemanticHash(envelope.snapshot);
  if (semantic !== envelope.semanticHash) {
    throw new Error(`HUB_SNAPSHOT_SEMANTIC_HASH_FAILURE id=${envelope.id}`);
  }
}

export function hubSemanticHash(snapshot: HubSnapshot): string {
  return stableHash128({
    schemaVersion: snapshot.schemaVersion,
    eventCursor: snapshot.eventCursor,
    repositories: snapshot.repositories
      .map(repository => ({ ...repository, metadata: structuredClone(repository.metadata) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    graph: {
      entities: [...snapshot.graph.entities].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      relations: [...snapshot.graph.relations].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    },
    agentIds: [...snapshot.agentIds].sort(),
    workflowIds: [...snapshot.workflowIds].sort(),
  });
}

function rowToEnvelope(row: HubSnapshotRow): HubSnapshotEnvelope {
  return {
    id: row.id,
    schemaVersion: Number(row.schema_version) as 1,
    createdAt: toIso(row.created_at),
    eventCursor: { sequence: Number(row.event_sequence) },
    snapshot: structuredClone(row.snapshot),
    semanticHash: row.semantic_hash,
    integrityAlgorithm: row.integrity_algorithm,
    integrityHash: row.integrity_hash,
    metadata: structuredClone(row.metadata || {}),
  };
}

function cloneEnvelope(envelope: HubSnapshotEnvelope): HubSnapshotEnvelope {
  return {
    ...envelope,
    eventCursor: { ...envelope.eventCursor },
    snapshot: structuredClone(envelope.snapshot),
    metadata: structuredClone(envelope.metadata),
  };
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
