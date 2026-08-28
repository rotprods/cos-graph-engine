import type {
  EventRow,
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '../../packages/runtime/src/postgres-event-log';

/**
 * Deterministic, transaction-aware PostgresExecutor fixture for EventLog adapter
 * contracts. It implements only SQL forms emitted by PostgresEventLog; unknown
 * SQL fails closed so adapter changes cannot silently escape the fixture.
 */
export class FakeEventLogPostgres implements PostgresExecutor {
  private rows: EventRow[] = [];
  private nextSequence = 1;

  async transaction<T>(fn: (tx: PostgresTransaction) => Promise<T>): Promise<T> {
    const beforeRows = cloneRows(this.rows);
    const beforeSequence = this.nextSequence;
    try {
      return await fn({ query: this.query.bind(this) });
    } catch (error) {
      this.rows = beforeRows;
      this.nextSequence = beforeSequence;
      throw error;
    }
  }

  async query<Row = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<PostgresQueryResult<Row>> {
    const statement = normalizeSql(sql);

    if (statement.startsWith('create schema') || statement.includes('create table if not exists cos_runtime.event_log')) {
      return result<Row>([]);
    }

    if (statement.startsWith('insert into cos_runtime.event_log')) {
      return this.insert<Row>(params);
    }

    if (statement.includes('where idempotency_key = $1')) {
      const key = String(params[0]);
      return result<Row>(this.rows.filter(row => row.idempotency_key === key).map(cloneRow) as unknown as Row[]);
    }

    if (statement.includes('where event_id = $1')) {
      const id = String(params[0]);
      return result<Row>(this.rows.filter(row => row.event_id === id).map(cloneRow) as unknown as Row[]);
    }

    if (statement.includes('where sequence > $1') && statement.includes('order by sequence asc')) {
      const cursor = Number(params[0]);
      const limit = Number(params[1]);
      return result<Row>(this.rows
        .filter(row => Number(row.sequence) > cursor)
        .sort((a, b) => Number(a.sequence) - Number(b.sequence))
        .slice(0, limit)
        .map(cloneRow) as unknown as Row[]);
    }

    if (statement.startsWith('select max(sequence) as sequence from cos_runtime.event_log')) {
      const max = this.rows.length ? Math.max(...this.rows.map(row => Number(row.sequence))) : null;
      return result<Row>([{ sequence: max }] as unknown as Row[]);
    }

    if (statement.startsWith('truncate table cos_runtime.event_log restart identity')) {
      this.rows = [];
      this.nextSequence = 1;
      return result<Row>([]);
    }

    throw new Error(`FAKE_POSTGRES_UNSUPPORTED_SQL: ${statement}`);
  }

  snapshotRows(): EventRow[] {
    return cloneRows(this.rows);
  }

  /** Test-only corruption hook used by Phase 04 negative fixtures. */
  corruptRow(eventId: string, mutate: (row: EventRow) => void): void {
    const row = this.rows.find(candidate => candidate.event_id === eventId);
    if (!row) throw new Error(`Fake event row not found: ${eventId}`);
    mutate(row);
  }

  private insert<Row>(params: unknown[]): PostgresQueryResult<Row> {
    if (params.length !== 15) throw new Error(`FAKE_POSTGRES_EVENT_INSERT_PARAM_COUNT=${params.length}`);
    const eventId = String(params[0]);
    const idempotencyKey = String(params[12]);
    if (this.rows.some(row => row.event_id === eventId || row.idempotency_key === idempotencyKey)) {
      return result<Row>([]);
    }

    const occurredAt = toDate(params[7], 'occurred_at');
    const recordedAt = params[8] === null || params[8] === undefined
      ? new Date(occurredAt.getTime() + 1)
      : toDate(params[8], 'recorded_at');

    const row: EventRow = {
      sequence: this.nextSequence++,
      event_id: eventId,
      event_type: String(params[1]),
      source_id: String(params[2]),
      target_id: params[3] === null ? null : String(params[3]),
      payload: parseJson(params[4], 'payload'),
      metadata: parseJson(params[5], 'metadata') as Record<string, string | number | boolean | null>,
      severity: String(params[6]) as EventRow['severity'],
      occurred_at: occurredAt,
      recorded_at: recordedAt,
      trace_id: String(params[9]),
      span_id: String(params[10]),
      parent_span_id: params[11] === null ? null : String(params[11]),
      idempotency_key: idempotencyKey,
      correlation_id: String(params[13]),
      causation_id: params[14] === null ? null : String(params[14]),
    };
    this.rows.push(row);
    return result<Row>([cloneRow(row)] as unknown as Row[]);
  }
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function parseJson(value: unknown, label: string): unknown {
  if (typeof value !== 'string') throw new Error(`FAKE_POSTGRES_${label.toUpperCase()}_NOT_JSON`);
  return JSON.parse(value);
}

function toDate(value: unknown, label: string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error(`FAKE_POSTGRES_INVALID_${label.toUpperCase()}: ${String(value)}`);
  return date;
}

function cloneRow(row: EventRow): EventRow {
  return {
    ...row,
    payload: structuredClone(row.payload),
    metadata: structuredClone(row.metadata),
    occurred_at: row.occurred_at instanceof Date ? new Date(row.occurred_at.getTime()) : row.occurred_at,
    recorded_at: row.recorded_at instanceof Date ? new Date(row.recorded_at.getTime()) : row.recorded_at,
  };
}

function cloneRows(rows: EventRow[]): EventRow[] {
  return rows.map(cloneRow);
}

function result<Row>(rows: Row[]): PostgresQueryResult<Row> {
  return { rows, rowCount: rows.length };
}
