import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '../../packages/runtime/src/postgres-event-log';
import type { AuthorityLeaseRevisionRow } from '../../packages/execution/src/authority-lease-store-postgres';

/** Strict SQL fixture for AuthorityLeasePostgresStore. */
export class FakeAuthorityLeasePostgres implements PostgresExecutor {
  private rows: AuthorityLeaseRevisionRow[] = [];
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

  snapshotRows(): AuthorityLeaseRevisionRow[] {
    return structuredClone(this.rows);
  }

  corruptRevision(
    revisionId: string,
    mutate: (row: AuthorityLeaseRevisionRow) => void,
  ): void {
    const row = this.rows.find(candidate => candidate.revision_id === revisionId);
    if (!row) throw new Error(`Fake authority lease revision not found: ${revisionId}`);
    mutate(row);
  }

  private async queryInternal<Row>(
    sql: string,
    params: unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    const statement = normalizeSql(sql);
    this.statements.push(statement);

    if (statement.startsWith('create schema')
      || statement.includes('create table if not exists cos_execution.authority_lease_revisions')) {
      return result<Row>([]);
    }
    if (statement.startsWith('select pg_advisory_xact_lock')) {
      return result<Row>([{ locked: true } as Row]);
    }

    if (statement.startsWith('insert into cos_execution.authority_lease_revisions')) {
      return this.insert<Row>(params);
    }

    if (statement.includes('from cos_execution.authority_lease_revisions')
      && statement.includes('where resource_uri=$1 and operation_key=$2')) {
      const resourceUri = String(params[0]);
      const operationKey = String(params[1]);
      return result<Row>(this.rows
        .filter(row => row.resource_uri === resourceUri && row.operation_key === operationKey)
        .map(row => structuredClone(row) as Row));
    }

    if (statement.includes('from cos_execution.authority_lease_revisions')
      && statement.includes('where revision_id=$1')) {
      const revisionId = String(params[0]);
      return result<Row>(this.rows
        .filter(row => row.revision_id === revisionId)
        .map(row => structuredClone(row) as Row));
    }

    if (statement.includes('from cos_execution.authority_lease_revisions')
      && statement.includes('where resource_uri=$1')
      && statement.includes('order by resource_revision desc')
      && statement.includes('limit 1')) {
      const resourceUri = String(params[0]);
      const sorted = this.rows
        .filter(row => row.resource_uri === resourceUri)
        .sort((left, right) => Number(right.resource_revision) - Number(left.resource_revision));
      return result<Row>(sorted.slice(0, 1).map(row => structuredClone(row) as Row));
    }

    if (statement.includes('from cos_execution.authority_lease_revisions')
      && statement.includes('where resource_uri=$1')
      && statement.includes('order by resource_revision asc')) {
      const resourceUri = String(params[0]);
      const sorted = this.rows
        .filter(row => row.resource_uri === resourceUri)
        .sort((left, right) => Number(left.resource_revision) - Number(right.resource_revision)
          || String(left.recorded_at).localeCompare(String(right.recorded_at))
          || left.revision_id.localeCompare(right.revision_id));
      return result<Row>(sorted.map(row => structuredClone(row) as Row));
    }

    throw new Error(`FAKE_AUTHORITY_LEASE_POSTGRES_UNSUPPORTED_SQL: ${statement}`);
  }

  private insert<Row>(params: unknown[]): PostgresQueryResult<Row> {
    if (params.length !== 16) {
      throw new Error(`FAKE_AUTHORITY_LEASE_PARAM_COUNT=${params.length}`);
    }
    const row: AuthorityLeaseRevisionRow = {
      revision_id: String(params[0]),
      resource_uri: String(params[1]),
      resource_revision: safeInteger(params[2], 'resource_revision', 1),
      lease_id: String(params[3]),
      lease_revision: safeInteger(params[4], 'lease_revision', 1),
      operation_key: String(params[5]),
      operation_hash: String(params[6]),
      owner_id: String(params[7]),
      state: String(params[8]) as AuthorityLeaseRevisionRow['state'],
      fencing_token: safeInteger(params[9], 'fencing_token', 1),
      acquired_at: toIso(params[10], 'acquired_at'),
      expires_at: toIso(params[11], 'expires_at'),
      recorded_at: toIso(params[12], 'recorded_at'),
      previous_revision_id: nullableString(params[13]),
      metadata: parseJson(params[14], 'metadata') as Record<string, unknown>,
      content_hash: String(params[15]),
    };

    const conflict = this.rows.some(existing =>
      existing.revision_id === row.revision_id
      || (existing.resource_uri === row.resource_uri
        && Number(existing.resource_revision) === Number(row.resource_revision))
      || (existing.resource_uri === row.resource_uri
        && existing.operation_key === row.operation_key));
    if (conflict) return result<Row>([]);
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

function parseJson(value: unknown, label: string): unknown {
  if (typeof value !== 'string') throw new Error(`${label} must be serialized JSON`);
  return JSON.parse(value);
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function safeInteger(value: unknown, label: string, minimum: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`Invalid ${label}: ${String(value)}`);
  }
  return parsed;
}

function toIso(value: unknown, label: string): string {
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${String(value)}`);
  return new Date(parsed).toISOString();
}
