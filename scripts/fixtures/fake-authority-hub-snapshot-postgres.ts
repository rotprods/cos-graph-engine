import type { PostgresExecutor, PostgresQueryResult, PostgresTransaction } from '../../packages/runtime/src/postgres-event-log';

export interface FakeAuthorityHubSnapshotRow extends Record<string, unknown> {
  id: string;
  schema_version: number;
  serialization_version: number;
  created_at: string;
  event_sequence: number;
  semantic_hash: string;
  integrity_algorithm: string;
  integrity_hash: string;
  repository_count: number;
  snapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export class FakeAuthorityHubSnapshotPostgres implements PostgresExecutor {
  private rows: FakeAuthorityHubSnapshotRow[] = [];
  readonly statements: string[] = [];

  async transaction<T>(fn: (tx: PostgresTransaction) => Promise<T>): Promise<T> {
    const before = structuredClone(this.rows);
    try {
      return await fn({ query: this.query.bind(this) });
    } catch (error) {
      this.rows = before;
      throw error;
    }
  }

  async query<Row = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<PostgresQueryResult<Row>> {
    const statement = normalizeSql(sql);
    this.statements.push(statement);

    if (statement.startsWith('create schema') || statement.includes('create table if not exists cos_hub.authority_snapshots')) {
      return result<Row>([]);
    }

    if (statement.startsWith('insert into cos_hub.authority_snapshots')) {
      if (params.length !== 9) throw new Error(`FAKE_HUB_SNAPSHOT_PARAM_COUNT=${params.length}`);
      const id = String(params[0]);
      if (this.rows.some(row => row.id === id)) return result<Row>([]);
      const row: FakeAuthorityHubSnapshotRow = {
        id,
        schema_version: 1,
        serialization_version: Number(params[1]),
        created_at: new Date(String(params[2])).toISOString(),
        event_sequence: Number(params[3]),
        semantic_hash: String(params[4]),
        integrity_algorithm: 'sha256',
        integrity_hash: String(params[5]),
        repository_count: Number(params[6]),
        // Parse/stringify here deliberately models JSONB loss of JS-only undefined.
        snapshot: JSON.parse(String(params[7])) as Record<string, unknown>,
        metadata: JSON.parse(String(params[8])) as Record<string, unknown>,
      };
      this.rows.push(structuredClone(row));
      return result<Row>([structuredClone(row)] as unknown as Row[]);
    }

    if (statement.includes('where id=$1')) {
      const id = String(params[0]);
      return result<Row>(this.rows.filter(row => row.id === id).map(row => structuredClone(row)) as unknown as Row[]);
    }

    if (statement.includes('order by event_sequence desc') && statement.includes('limit 1')) {
      const rows = [...this.rows].sort(compareDesc);
      return result<Row>(rows.slice(0, 1).map(row => structuredClone(row)) as unknown as Row[]);
    }

    if (statement.includes("'{}'::jsonb as snapshot") && statement.includes('order by event_sequence asc')) {
      const rows = [...this.rows].sort(compareAsc).map(row => ({ ...structuredClone(row), snapshot: {} }));
      return result<Row>(rows as unknown as Row[]);
    }

    throw new Error(`FAKE_HUB_SNAPSHOT_UNSUPPORTED_SQL: ${statement}`);
  }

  snapshotRows(): FakeAuthorityHubSnapshotRow[] {
    return structuredClone(this.rows);
  }

  mutateRow(id: string, mutate: (row: FakeAuthorityHubSnapshotRow) => void): void {
    const row = this.rows.find(candidate => candidate.id === id);
    if (!row) throw new Error(`Hub snapshot row not found: ${id}`);
    mutate(row);
  }
}

function compareAsc(left: FakeAuthorityHubSnapshotRow, right: FakeAuthorityHubSnapshotRow): number {
  return left.event_sequence - right.event_sequence
    || left.created_at.localeCompare(right.created_at)
    || left.id.localeCompare(right.id);
}

function compareDesc(left: FakeAuthorityHubSnapshotRow, right: FakeAuthorityHubSnapshotRow): number {
  return right.event_sequence - left.event_sequence
    || right.created_at.localeCompare(left.created_at)
    || left.id.localeCompare(right.id);
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function result<Row>(rows: Row[]): PostgresQueryResult<Row> {
  return { rows, rowCount: rows.length };
}
