import type { EntityId } from '@cos/core';
import type {
  AppendEventInput,
  AppendResult,
  DurableEvent,
  EventLogCursor,
  IEventLog,
} from './event-log';

export interface PostgresQueryResult<Row> {
  rows: Row[];
  rowCount: number;
}

export interface PostgresTransaction {
  query<Row = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PostgresQueryResult<Row>>;
}

/**
 * Driver-neutral transaction port. pg, Supabase server-side Postgres clients,
 * postgres.js adapters, etc. can implement this without leaking a dependency
 * into @cos/runtime.
 */
export interface PostgresExecutor {
  transaction<T>(fn: (tx: PostgresTransaction) => Promise<T>): Promise<T>;
  query<Row = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PostgresQueryResult<Row>>;
}

interface EventRow {
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
 * Authority-grade durable event log for Postgres/Supabase.
 *
 * The DB owns sequence assignment. Producer retry de-duplication is performed
 * with INSERT .. ON CONFLICT(idempotency_key) DO NOTHING followed by a semantic
 * equality check, so concurrent duplicate deliveries converge to one event.
 */
export class PostgresEventLog implements IEventLog {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(POSTGRES_EVENT_LOG_DDL);
  }

  async append(input: AppendEventInput): Promise<AppendResult> {
    const key = input.idempotencyKey.trim();
    if (!key) throw new Error('Event idempotencyKey must not be empty');
    if (!input.correlationId.trim()) throw new Error('Event correlationId must not be empty');

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
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING *
      `, [
        String(input.id),
        input.type,
        String(input.source),
        input.target ? String(input.target) : null,
        JSON.stringify(input.payload),
        JSON.stringify(input.metadata || {}),
        input.severity,
        input.timestamp,
        input.recordedAt || null,
        input.traceId,
        input.spanId,
        input.parentSpanId || null,
        key,
        input.correlationId,
        input.causationId ? String(input.causationId) : null,
      ]);

      if (inserted.rowCount === 1) {
        return { event: this.rowToEvent(inserted.rows[0]), appended: true };
      }

      const duplicate = await tx.query<EventRow>(
        'SELECT * FROM cos_runtime.event_log WHERE idempotency_key = $1 FOR SHARE',
        [key],
      );
      if (duplicate.rowCount !== 1) {
        throw new Error(`EVENT_LOG_CONCURRENCY_INVARIANT key=${key}`);
      }
      const existing = this.rowToEvent(duplicate.rows[0]);
      this.assertSameLogicalEvent(existing, input);
      return { event: existing, appended: false };
    });
  }

  async get(eventId: EntityId): Promise<DurableEvent | null> {
    const result = await this.db.query<EventRow>(
      'SELECT * FROM cos_runtime.event_log WHERE event_id = $1',
      [String(eventId)],
    );
    return result.rowCount ? this.rowToEvent(result.rows[0]) : null;
  }

  async getByIdempotencyKey(key: string): Promise<DurableEvent | null> {
    const result = await this.db.query<EventRow>(
      'SELECT * FROM cos_runtime.event_log WHERE idempotency_key = $1',
      [key],
    );
    return result.rowCount ? this.rowToEvent(result.rows[0]) : null;
  }

  async readFrom(cursor: EventLogCursor = { sequence: 0 }, limit = 1000): Promise<DurableEvent[]> {
    if (!Number.isInteger(cursor.sequence) || cursor.sequence < 0) throw new Error(`Invalid event-log cursor: ${cursor.sequence}`);
    if (!Number.isInteger(limit) || limit < 0 || limit > 100_000) throw new Error(`Invalid event-log limit: ${limit}`);
    const result = await this.db.query<EventRow>(`
      SELECT * FROM cos_runtime.event_log
      WHERE sequence > $1
      ORDER BY sequence ASC
      LIMIT $2
    `, [cursor.sequence, limit]);
    return result.rows.map(row => this.rowToEvent(row));
  }

  async latestCursor(): Promise<EventLogCursor> {
    const result = await this.db.query<{ sequence: string | number | null }>(
      'SELECT MAX(sequence) AS sequence FROM cos_runtime.event_log',
    );
    return { sequence: Number(result.rows[0]?.sequence || 0) };
  }

  /**
   * Destructive by definition. Production callers should protect this method
   * behind a P5/destructive policy; it exists to satisfy the IEventLog contract
   * for isolated test/recovery databases.
   */
  async clear(): Promise<void> {
    await this.db.transaction(async tx => {
      await tx.query('TRUNCATE TABLE cos_runtime.event_log RESTART IDENTITY');
      return undefined;
    });
  }

  private rowToEvent(row: EventRow): DurableEvent {
    const sequence = Number(row.sequence);
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error(`EVENT_LOG_CORRUPT sequence=${String(row.sequence)}`);
    const toIso = (value: string | Date) => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
    return {
      id: row.event_id as EntityId,
      type: row.event_type,
      source: row.source_id as EntityId,
      target: row.target_id ? row.target_id as EntityId : undefined,
      payload: structuredClone(row.payload),
      metadata: structuredClone(row.metadata || {}),
      severity: row.severity,
      timestamp: toIso(row.occurred_at),
      traceId: row.trace_id,
      spanId: row.span_id,
      parentSpanId: row.parent_span_id || undefined,
      sequence,
      idempotencyKey: row.idempotency_key,
      correlationId: row.correlation_id,
      causationId: row.causation_id ? row.causation_id as EntityId : undefined,
      recordedAt: toIso(row.recorded_at),
    };
  }

  private assertSameLogicalEvent(existing: DurableEvent, input: AppendEventInput): void {
    const equal =
      existing.id === input.id
      && existing.type === input.type
      && existing.source === input.source
      && existing.target === input.target
      && existing.correlationId === input.correlationId
      && JSON.stringify(existing.payload) === JSON.stringify(input.payload);
    if (!equal) throw new Error(`IDEMPOTENCY_KEY_CONFLICT key=${input.idempotencyKey}`);
  }
}
