import type { EntityId } from '@cos/core';
import type {
  AppendEventInput,
  AppendResult,
  DurableEvent,
  EventLogCursor,
  IEventLog,
} from './event-log';
import {
  assertCursor,
  assertLimit,
  assertSameLogicalEvent,
  cloneDurableEvent,
  normalizeAppendEventInput,
} from './event-log';

export interface PostgresQueryResult<Row> {
  rows: Row[];
  rowCount: number;
}

export interface PostgresTransaction {
  query<Row = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PostgresQueryResult<Row>>;
}

export interface PostgresExecutor {
  transaction<T>(fn: (tx: PostgresTransaction) => Promise<T>): Promise<T>;
  query<Row = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PostgresQueryResult<Row>>;
}

export interface EventRow {
  sequence: string | number;
  event_id: string;
  event_type: string;
  source_id: string;
  target_id: string | null;
  payload: unknown;
  metadata: Record<string, string | number | boolean | null>;
  severity: DurableEvent['severity'];
  occurred_at: string | Date;
  recorded_at: string | Date;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  idempotency_key: string;
  correlation_id: string;
  causation_id: string | null;
}

export const POSTGRES_EVENT_LOG_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_runtime;

CREATE TABLE IF NOT EXISTS cos_runtime.event_log (
  sequence BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT,
  payload JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  correlation_id TEXT NOT NULL,
  causation_id TEXT
);

CREATE INDEX IF NOT EXISTS cos_event_log_type_sequence_idx
  ON cos_runtime.event_log(event_type, sequence);
CREATE INDEX IF NOT EXISTS cos_event_log_source_sequence_idx
  ON cos_runtime.event_log(source_id, sequence);
CREATE INDEX IF NOT EXISTS cos_event_log_correlation_idx
  ON cos_runtime.event_log(correlation_id, sequence);
`;

/**
 * Postgres/Supabase adapter implementing exactly the shared IEventLog logical
 * retry contract from event-log.ts. Database sequence assignment is authoritative;
 * producer event IDs describe delivery attempts and are not part of idempotency
 * equality once a key already exists.
 */
export class PostgresEventLog implements IEventLog {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(POSTGRES_EVENT_LOG_DDL);
  }

  async append(raw: AppendEventInput): Promise<AppendResult> {
    const input = normalizeAppendEventInput(raw);

    return this.db.transaction(async tx => {
      const inserted = await tx.query<EventRow>(`
        INSERT INTO cos_runtime.event_log (
          event_id, event_type, source_id, target_id, payload, metadata,
          severity, occurred_at, recorded_at, trace_id, span_id, parent_span_id,
          idempotency_key, correlation_id, causation_id
        ) VALUES (
          $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::timestamptz,
          COALESCE($9::timestamptz, now()),$10,$11,$12,$13,$14,$15
        )
        ON CONFLICT DO NOTHING
        RETURNING *
      `, [
        String(input.id),
        input.type,
        String(input.source),
        input.target === undefined ? null : String(input.target),
        JSON.stringify(input.payload),
        JSON.stringify(input.metadata),
        input.severity,
        input.timestamp,
        input.recordedAt ?? null,
        input.traceId,
        input.spanId,
        input.parentSpanId ?? null,
        input.idempotencyKey,
        input.correlationId,
        input.causationId === undefined ? null : String(input.causationId),
      ]);

      if (inserted.rowCount === 1) {
        return { event: rowToEvent(inserted.rows[0]), appended: true };
      }

      // Prefer idempotency-key resolution. A retry is allowed to carry a fresh
      // producer event ID and trace/span IDs when its logical event is identical.
      const byKey = await tx.query<EventRow>(
        'SELECT * FROM cos_runtime.event_log WHERE idempotency_key = $1 FOR SHARE',
        [input.idempotencyKey],
      );
      if (byKey.rowCount === 1) {
        const existing = rowToEvent(byKey.rows[0]);
        assertSameLogicalEvent(existing, input);
        return { event: cloneDurableEvent(existing), appended: false };
      }

      // If the key was absent, the conflict can only be a producer event ID (or
      // DB corruption/race). Reusing one accepted event ID for another logical
      // key is always rejected.
      const byId = await tx.query<EventRow>(
        'SELECT * FROM cos_runtime.event_log WHERE event_id = $1 FOR SHARE',
        [String(input.id)],
      );
      if (byId.rowCount === 1) {
        throw new Error(`EVENT_ID_COLLISION id=${String(input.id)}`);
      }

      throw new Error(`EVENT_LOG_CONCURRENCY_INVARIANT key=${input.idempotencyKey}`);
    });
  }

  async get(eventId: EntityId): Promise<DurableEvent | null> {
    const result = await this.db.query<EventRow>(
      'SELECT * FROM cos_runtime.event_log WHERE event_id = $1',
      [String(eventId)],
    );
    return result.rowCount ? rowToEvent(result.rows[0]) : null;
  }

  async getByIdempotencyKey(key: string): Promise<DurableEvent | null> {
    const normalized = key.normalize('NFC').trim();
    if (!normalized) throw new Error('Event idempotencyKey must not be empty');
    const result = await this.db.query<EventRow>(
      'SELECT * FROM cos_runtime.event_log WHERE idempotency_key = $1',
      [normalized],
    );
    return result.rowCount ? rowToEvent(result.rows[0]) : null;
  }

  async readFrom(cursor: EventLogCursor = { sequence: 0 }, limit = 1000): Promise<DurableEvent[]> {
    assertCursor(cursor);
    assertLimit(limit);
    const result = await this.db.query<EventRow>(`
      SELECT * FROM cos_runtime.event_log
      WHERE sequence > $1
      ORDER BY sequence ASC
      LIMIT $2
    `, [cursor.sequence, limit]);
    return result.rows.map(rowToEvent);
  }

  async latestCursor(): Promise<EventLogCursor> {
    const result = await this.db.query<{ sequence: string | number | null }>(
      'SELECT MAX(sequence) AS sequence FROM cos_runtime.event_log',
    );
    const sequence = Number(result.rows[0]?.sequence ?? 0);
    if (!Number.isSafeInteger(sequence) || sequence < 0) {
      throw new Error(`EVENT_LOG_CORRUPT latestSequence=${String(result.rows[0]?.sequence)}`);
    }
    return { sequence };
  }

  /** Destructive; only for isolated test/recovery databases under policy. */
  async clear(): Promise<void> {
    await this.db.transaction(async tx => {
      await tx.query('TRUNCATE TABLE cos_runtime.event_log RESTART IDENTITY');
      return undefined;
    });
  }
}

export function rowToEvent(row: EventRow): DurableEvent {
  const sequence = Number(row.sequence);
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error(`EVENT_LOG_CORRUPT sequence=${String(row.sequence)}`);
  }
  const occurredAt = toIso(row.occurred_at, 'occurred_at');
  const recordedAt = toIso(row.recorded_at, 'recorded_at');
  const event: DurableEvent = {
    id: row.event_id as EntityId,
    type: row.event_type,
    source: row.source_id as EntityId,
    ...(row.target_id === null ? {} : { target: row.target_id as EntityId }),
    payload: structuredClone(row.payload),
    metadata: structuredClone(row.metadata ?? {}),
    severity: row.severity,
    timestamp: occurredAt,
    traceId: row.trace_id,
    spanId: row.span_id,
    ...(row.parent_span_id === null ? {} : { parentSpanId: row.parent_span_id }),
    sequence,
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    ...(row.causation_id === null ? {} : { causationId: row.causation_id as EntityId }),
    recordedAt,
  };
  // Shared normalization validates strict payload/metadata semantics and common
  // timestamp/string constraints; cloneDurableEvent then detaches returned data.
  normalizeAppendEventInput(event);
  return cloneDurableEvent(event);
}

function toIso(value: string | Date, label: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`EVENT_LOG_CORRUPT ${label}=${String(value)}`);
  return date.toISOString();
}
