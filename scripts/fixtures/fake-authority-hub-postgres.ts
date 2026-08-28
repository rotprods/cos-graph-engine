import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '../../packages/runtime/src/postgres-event-log';
import type { AuthorityHubSnapshot } from '../../packages/hub/src/authority-hub';

export interface FakeAuthorityHubSnapshotRow extends Record<string, unknown> {
  id: string;
  schema_version: number;
  created_at: string;
  event_sequence: number;
  semantic_hash: string;
  integrity_algorithm: 'sha256';
  integrity_hash: string;
  repository_count: number;
  snapshot: AuthorityHubSnapshot;
  metadata: Record<string, unknown>;
}

/**
 * Driver-neutral Postgres fixture for the authority Hub snapshot adapter.
 *
 * It implements only the SQL emitted by PostgresAuthorityHubSnapshotStore.
 * Unknown SQL fails closed so production-adapter changes cannot silently escape
 * the contract. Transactions use copy-on-write rollback even though the current
 * snapshot adapter does not require a multi-statement transaction.
 */
export class FakeAuthorityHubSnapshotPostgres implements PostgresExecutor {
  private rows: FakeAuthorityHubSnapshotRow[] = [];
  readonly statements: string[] = [];

  async transaction<T>(fn: (tx: PostgresTransaction) => Promise<T>): Promise<T> {
    const before = structuredClone(this.rows);
    try {
      return await fn({ query: (sql, params) => this.queryInternal(sql, params) });
    } catch (error) {
      this.rows = before;
      throw error;
    }
  }

  async query<Row = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    return this.queryInternal<Row>(sql, params);
  }

  snapshotRows(): FakeAuthorityHubSnapshotRow[] {
    return structuredClone(this.rows);
  }

  corruptRow(id: string, mutate: (row: FakeAuthorityHubSnapshotRow) => void): void {
    const row = this.rows.find(candidate => candidate.id === id);
    if (!row) throw new Error(`Fake authority Hub snapshot row not found: ${id}`);
    mutate(row);
  }

  private async queryInternal<Row>(
    sql: string,
    params: unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    const statement = normalizeSql(sql);
    this.statements.push(statement);

    if (statement.startsWith('create schema')
      || statement.includes('create table if not exists cos_hub.authority_snapshots')) {
      return result<Row>([]);
    }

    if (statement.startsWith('insert into cos_hub.authority_snapshots')) {
      return this.insert<Row>(params);
    }

    if (statement.includes('from cos_hub.authority_snapshots where id=$1')) {
      const id = String(params[0]);
      return result<Row>(this.rows
        .filter(row => row.id === id)
        .map(row => structuredClone(row) as Row));
    }

    if (statement.includes('from cos_hub.authority_snapshots')
      && statement.includes('order by event_sequence desc')
      && statement.includes('limit 1')) {
      const sorted = [...this.rows].sort((left, right) =>
        right.event_sequence - left.event_sequence
        || right.created_at.localeCompare(left.created_at)
        || left.id.localeCompare(right.id));
      return result<Row>(sorted.slice(0, 1).map(row => structuredClone(row) as Row));
    }

    if (statement.includes("'{}'::jsonb as snapshot")
      && statement.includes('from cos_hub.authority_snapshots')) {
      const sorted = [...this.rows].sort((left, right) =>
        left.event_sequence - right.event_sequence
        || left.created_at.localeCompare(right.created_at)
        || left.id.localeCompare(right.id));
      return result<Row>(sorted.map(row => ({
        ...structuredClone(row),
        snapshot: {} as AuthorityHubSnapshot,
      }) as Row));
    }

    throw new Error(`FAKE_AUTHORITY_HUB_POSTGRES_UNSUPPORTED_SQL: ${statement}`);
  }

  private insert<Row>(params: unknown[]): PostgresQueryResult<Row> {
    if (params.length !== 8) {
      throw new Error(`FAKE_AUTHORITY_HUB_SNAPSHOT_PARAM_COUNT=${params.length}`);
    }

    const id = String(params[0]);
    const integrityHash = String(params[4]);
    if (this.rows.some(row => row.id === id)) return result<Row>([]);
    if (this.rows.some(row => row.integrity_hash === integrityHash)) {
      throw new Error(`duplicate integrity_hash ${integrityHash}`);
    }

    const row: FakeAuthorityHubSnapshotRow = {
      id,
      schema_version: 1,
      created_at: toIso(params[1], 'created_at'),
      event_sequence: safeInteger(params[2], 'event_sequence'),
      semantic_hash: String(params[3]),
      integrity_algorithm: 'sha256',
      integrity_hash: integrityHash,
      repository_count: safeInteger(params[5], 'repository_count'),
      snapshot: parseJson<AuthorityHubSnapshot>(params[6], 'snapshot'),
      metadata: parseJson<Record<string, unknown>>(params[7], 'metadata'),
    };
    this.rows.push(structuredClone(row));
    return result<Row>([structuredClone(row) as Row]);
  }
}

function result<Row>(rows: Row[]): PostgresQueryResult<Row> {
  return { rows, rowCount: rows.length };
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function parseJson<T>(value: unknown, label: string): T {
  if (typeof value !== 'string') throw new Error(`${label} must be serialized JSON`);
  return JSON.parse(value) as T;
}

function toIso(value: unknown, label: string): string {
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${String(value)}`);
  return new Date(parsed).toISOString();
}

function safeInteger(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid ${label}: ${String(value)}`);
  return parsed;
}
