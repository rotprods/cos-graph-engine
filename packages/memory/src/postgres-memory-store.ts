import type {
  EntityId,
  IMemoryStore,
  MemoryEntry,
  MemoryLayer,
  MemoryQuery,
  MemoryStoreStats,
  Timestamp,
} from '@cos/core';
import type { PostgresExecutor, PostgresTransaction } from '@cos/runtime';

interface MemoryRow {
  id: string;
  layer: MemoryLayer;
  content: unknown;
  representations: MemoryEntry['representations'];
  importance: number | string;
  ttl: number | string | null;
  version: MemoryEntry['version'];
  revision: number | string;
  created_at: string | Date;
  last_accessed: string | Date;
  access_count: number | string;
  consolidated: boolean;
  compressed: boolean;
  tags: string[];
  source_id: string;
  metadata: MemoryEntry['metadata'];
}

export const POSTGRES_MEMORY_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_memory;

CREATE TABLE IF NOT EXISTS cos_memory.entries (
  id TEXT PRIMARY KEY,
  layer TEXT NOT NULL,
  content JSONB NOT NULL,
  representations JSONB NOT NULL DEFAULT '{}'::jsonb,
  importance DOUBLE PRECISION NOT NULL CHECK (importance >= 0 AND importance <= 1),
  ttl DOUBLE PRECISION,
  version JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TIMESTAMPTZ NOT NULL,
  last_accessed TIMESTAMPTZ NOT NULL,
  access_count BIGINT NOT NULL DEFAULT 0 CHECK (access_count >= 0),
  consolidated BOOLEAN NOT NULL DEFAULT false,
  compressed BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  source_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT cos_memory_ttl_valid CHECK (ttl IS NULL OR ttl >= 0)
);

CREATE INDEX IF NOT EXISTS cos_memory_layer_importance_idx
  ON cos_memory.entries(layer, importance DESC);
CREATE INDEX IF NOT EXISTS cos_memory_created_idx
  ON cos_memory.entries(created_at);
CREATE INDEX IF NOT EXISTS cos_memory_last_accessed_idx
  ON cos_memory.entries(last_accessed);
CREATE INDEX IF NOT EXISTS cos_memory_tags_gin_idx
  ON cos_memory.entries USING GIN(tags);
CREATE INDEX IF NOT EXISTS cos_memory_metadata_gin_idx
  ON cos_memory.entries USING GIN(metadata);
`;

export interface VersionedMemoryEntry {
  entry: MemoryEntry;
  revision: number;
}

/** Extended authority API used by concurrent writers. */
export interface IVersionedMemoryStore extends IMemoryStore {
  retrieveVersioned(id: EntityId): Promise<VersionedMemoryEntry | null>;
  updateVersioned(id: EntityId, expectedRevision: number, updates: Partial<MemoryEntry>): Promise<number>;
  purgeExpired(now?: string): Promise<number>;
}

/**
 * Durable memory store for Postgres/Supabase.
 *
 * It preserves the IMemoryStore contract while adding an explicit `revision`
 * CAS path for authority-grade concurrent mutation. Normal `update()` is kept
 * for compatibility but internally locks the row and advances revision.
 */
export class PostgresMemoryStore implements IVersionedMemoryStore {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(POSTGRES_MEMORY_DDL);
  }

  async store(entry: MemoryEntry): Promise<EntityId> {
    this.assertEntry(entry);
    await this.db.query(`
      INSERT INTO cos_memory.entries (
        id, layer, content, representations, importance, ttl, version, revision,
        created_at, last_accessed, access_count, consolidated, compressed, tags,
        source_id, metadata
      ) VALUES (
        $1,$2,$3::jsonb,$4::jsonb,$5,$6,$7::jsonb,1,$8::timestamptz,$9::timestamptz,
        $10,$11,$12,$13::text[],$14,$15::jsonb
      )
    `, [
      String(entry.id), entry.layer, JSON.stringify(entry.content), JSON.stringify(entry.representations || {}),
      entry.importance, entry.ttl, JSON.stringify(entry.version), entry.createdAt, entry.lastAccessed,
      entry.accessCount, entry.consolidated, entry.compressed, entry.tags, String(entry.source),
      JSON.stringify(entry.metadata || {}),
    ]);
    return entry.id;
  }

  async retrieve(id: EntityId): Promise<MemoryEntry | null> {
    const versioned = await this.retrieveVersioned(id);
    return versioned?.entry || null;
  }

  async retrieveVersioned(id: EntityId): Promise<VersionedMemoryEntry | null> {
    return this.db.transaction(async tx => {
      const result = await tx.query<MemoryRow>(
        'SELECT * FROM cos_memory.entries WHERE id = $1 FOR UPDATE',
        [String(id)],
      );
      if (!result.rowCount) return null;
      const row = result.rows[0];
      if (this.isExpiredRow(row, Date.now())) {
        await tx.query('DELETE FROM cos_memory.entries WHERE id = $1', [String(id)]);
        return null;
      }

      const accessed = await tx.query<MemoryRow>(`
        UPDATE cos_memory.entries
        SET last_accessed = now(), access_count = access_count + 1
        WHERE id = $1
        RETURNING *
      `, [String(id)]);
      const fresh = accessed.rows[0];
      return { entry: this.rowToEntry(fresh), revision: Number(fresh.revision) };
    });
  }

  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    const where: string[] = [
      '(ttl IS NULL OR ttl <= 0 OR created_at + (ttl * interval \'1 second\') > now())',
    ];
    const params: unknown[] = [];
    const param = (value: unknown) => { params.push(value); return `$${params.length}`; };

    if (query.layer) where.push(`layer = ${param(query.layer)}`);
    if (query.tags?.length) where.push(`tags && ${param(query.tags)}::text[]`);
    if (query.importance?.min !== undefined) where.push(`importance >= ${param(query.importance.min)}`);
    if (query.importance?.max !== undefined) where.push(`importance <= ${param(query.importance.max)}`);
    if (query.timeRange?.from) where.push(`created_at >= ${param(query.timeRange.from)}::timestamptz`);
    if (query.timeRange?.to) where.push(`created_at <= ${param(query.timeRange.to)}::timestamptz`);
    if (query.content) where.push(`content::text ILIKE ${param(`%${escapeLike(query.content)}%`)} ESCAPE '\\'`);

    const sortColumns: Record<NonNullable<MemoryQuery['sortBy']>, string> = {
      createdAt: 'created_at',
      lastAccessed: 'last_accessed',
      accessCount: 'access_count',
      importance: 'importance',
    };
    const sort = query.sortBy ? sortColumns[query.sortBy] : 'created_at';
    const direction = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const limit = query.limit === undefined ? 1000 : Math.max(0, Math.min(100_000, query.limit));
    const offset = Math.max(0, query.offset || 0);
    params.push(limit, offset);

    const result = await this.db.query<MemoryRow>(`
      SELECT * FROM cos_memory.entries
      WHERE ${where.join(' AND ')}
      ORDER BY ${sort} ${direction}, id ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    if (result.rows.length === 0) return [];
    const ids = result.rows.map(row => row.id);
    // Access accounting is deliberately best-effort metadata, not canonical
    // semantic state; one statement updates all returned rows atomically enough
    // for operational statistics without serializing read queries.
    await this.db.query(`
      UPDATE cos_memory.entries
      SET last_accessed = now(), access_count = access_count + 1
      WHERE id = ANY($1::text[])
    `, [ids]);
    const now = new Date().toISOString();
    return result.rows.map(row => {
      const entry = this.rowToEntry(row);
      entry.lastAccessed = now;
      entry.accessCount += 1;
      return entry;
    });
  }

  async update(id: EntityId, updates: Partial<MemoryEntry>): Promise<void> {
    await this.db.transaction(async tx => {
      const current = await tx.query<MemoryRow>('SELECT * FROM cos_memory.entries WHERE id = $1 FOR UPDATE', [String(id)]);
      if (!current.rowCount) throw new Error(`Memory entry ${String(id)} not found`);
      await this.updateLocked(tx, current.rows[0], updates, undefined);
      return undefined;
    });
  }

  async updateVersioned(id: EntityId, expectedRevision: number, updates: Partial<MemoryEntry>): Promise<number> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new Error('expectedRevision must be a positive safe integer');
    return this.db.transaction(async tx => {
      const current = await tx.query<MemoryRow>('SELECT * FROM cos_memory.entries WHERE id = $1 FOR UPDATE', [String(id)]);
      if (!current.rowCount) throw new Error(`Memory entry ${String(id)} not found`);
      return this.updateLocked(tx, current.rows[0], updates, expectedRevision);
    });
  }

  async delete(id: EntityId): Promise<void> {
    await this.db.query('DELETE FROM cos_memory.entries WHERE id = $1', [String(id)]);
  }

  async clear(layer?: MemoryLayer): Promise<void> {
    if (layer) {
      await this.db.query('DELETE FROM cos_memory.entries WHERE layer = $1', [layer]);
      return;
    }
    await this.db.query('TRUNCATE TABLE cos_memory.entries');
  }

  async purgeExpired(now = new Date().toISOString()): Promise<number> {
    if (!Number.isFinite(Date.parse(now))) throw new Error(`Invalid purge timestamp '${now}'`);
    const result = await this.db.query<{ id: string }>(`
      DELETE FROM cos_memory.entries
      WHERE ttl IS NOT NULL AND ttl > 0
        AND created_at + (ttl * interval '1 second') <= $1::timestamptz
      RETURNING id
    `, [now]);
    return result.rowCount;
  }

  async stats(): Promise<MemoryStoreStats> {
    const aggregate = await this.db.query<{
      total: string | number;
      total_bytes: string | number;
      oldest: string | Date | null;
      newest: string | Date | null;
    }>(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(pg_column_size(e)),0) AS total_bytes,
        MIN(created_at) AS oldest,
        MAX(created_at) AS newest
      FROM cos_memory.entries e
      WHERE ttl IS NULL OR ttl <= 0 OR created_at + (ttl * interval '1 second') > now()
    `);
    const layers = await this.db.query<{ layer: MemoryLayer; count: string | number }>(`
      SELECT layer, COUNT(*) AS count
      FROM cos_memory.entries
      WHERE ttl IS NULL OR ttl <= 0 OR created_at + (ttl * interval '1 second') > now()
      GROUP BY layer
    `);
    const byLayer = emptyLayerStats();
    for (const row of layers.rows) byLayer[row.layer] = Number(row.count);
    const row = aggregate.rows[0];
    const toIso = (value: string | Date | null): Timestamp | null => value ? (value instanceof Date ? value.toISOString() : new Date(value).toISOString()) : null;
    return {
      totalEntries: Number(row?.total || 0),
      byLayer,
      totalSizeBytes: Number(row?.total_bytes || 0),
      oldestEntry: toIso(row?.oldest || null),
      newestEntry: toIso(row?.newest || null),
    };
  }

  private async updateLocked(
    tx: PostgresTransaction,
    row: MemoryRow,
    updates: Partial<MemoryEntry>,
    expectedRevision?: number,
  ): Promise<number> {
    if (updates.id !== undefined && String(updates.id) !== row.id) throw new Error('Memory identity is immutable');
    if (updates.createdAt !== undefined && new Date(updates.createdAt).toISOString() !== new Date(row.created_at).toISOString()) {
      throw new Error('Memory createdAt is immutable');
    }
    const currentRevision = Number(row.revision);
    if (expectedRevision !== undefined && currentRevision !== expectedRevision) {
      throw new Error(`STALE_MEMORY_REVISION expected=${expectedRevision} current=${currentRevision}`);
    }

    const current = this.rowToEntry(row);
    const next: MemoryEntry = {
      ...current,
      ...updates,
      id: current.id,
      createdAt: current.createdAt,
      tags: updates.tags ? [...updates.tags] : [...current.tags],
      representations: updates.representations ? { ...updates.representations } : { ...current.representations },
      metadata: updates.metadata ? { ...updates.metadata } : { ...current.metadata },
      lastAccessed: new Date().toISOString(),
      version: {
        ...current.version,
        ...(updates.version || {}),
        patch: Math.max(current.version.patch + 1, updates.version?.patch ?? 0),
      },
    };
    this.assertEntry(next);
    const nextRevision = currentRevision + 1;

    const result = await tx.query<{ revision: string | number }>(`
      UPDATE cos_memory.entries SET
        layer=$2, content=$3::jsonb, representations=$4::jsonb, importance=$5,
        ttl=$6, version=$7::jsonb, revision=$8, last_accessed=$9::timestamptz,
        access_count=$10, consolidated=$11, compressed=$12, tags=$13::text[],
        source_id=$14, metadata=$15::jsonb
      WHERE id=$1 AND revision=$16
      RETURNING revision
    `, [
      row.id, next.layer, JSON.stringify(next.content), JSON.stringify(next.representations),
      next.importance, next.ttl, JSON.stringify(next.version), nextRevision, next.lastAccessed,
      next.accessCount, next.consolidated, next.compressed, next.tags, String(next.source),
      JSON.stringify(next.metadata), currentRevision,
    ]);
    if (result.rowCount !== 1) throw new Error(`STALE_MEMORY_REVISION current=${currentRevision}`);
    return Number(result.rows[0].revision);
  }

  private rowToEntry(row: MemoryRow): MemoryEntry {
    const toIso = (value: string | Date) => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
    const entry: MemoryEntry = {
      id: row.id as EntityId,
      layer: row.layer,
      content: structuredClone(row.content),
      representations: structuredClone(row.representations || {}),
      importance: Number(row.importance),
      ttl: row.ttl === null ? null : Number(row.ttl),
      version: structuredClone(row.version),
      createdAt: toIso(row.created_at),
      lastAccessed: toIso(row.last_accessed),
      accessCount: Number(row.access_count),
      consolidated: Boolean(row.consolidated),
      compressed: Boolean(row.compressed),
      tags: [...(row.tags || [])],
      source: row.source_id as EntityId,
      metadata: structuredClone(row.metadata || {}),
    };
    this.assertEntry(entry);
    return entry;
  }

  private assertEntry(entry: MemoryEntry): void {
    if (!ALL_MEMORY_LAYERS.has(entry.layer)) throw new Error(`Unknown memory layer: ${entry.layer}`);
    if (!Number.isFinite(entry.importance) || entry.importance < 0 || entry.importance > 1) throw new Error('Memory importance must be in [0,1]');
    if (entry.ttl !== null && (!Number.isFinite(entry.ttl) || entry.ttl < 0)) throw new Error('Memory TTL must be null or >= 0');
    if (!Number.isSafeInteger(entry.accessCount) || entry.accessCount < 0) throw new Error('Memory accessCount must be a non-negative safe integer');
    if (!Number.isFinite(Date.parse(entry.createdAt)) || !Number.isFinite(Date.parse(entry.lastAccessed))) throw new Error('Memory timestamps must be valid ISO timestamps');
  }

  private isExpiredRow(row: MemoryRow, nowMs: number): boolean {
    const ttl = row.ttl === null ? null : Number(row.ttl);
    if (ttl === null || ttl <= 0) return false;
    return nowMs - Date.parse(row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at) >= ttl * 1000;
  }
}

const ALL_MEMORY_LAYERS = new Set<MemoryLayer>([
  'working', 'short_term', 'long_term', 'semantic', 'procedural', 'episodic',
  'temporal', 'spatial', 'vector', 'knowledge_graph', 'cache', 'reflection',
]);

function emptyLayerStats(): Record<MemoryLayer, number> {
  return Object.fromEntries(Array.from(ALL_MEMORY_LAYERS, layer => [layer, 0])) as Record<MemoryLayer, number>;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, match => `\\${match}`);
}
