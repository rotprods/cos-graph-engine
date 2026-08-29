import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '../../packages/runtime/src/postgres-event-log';
import type { AuthorityCapabilitySignalRowV2 } from '../../packages/execution/src/authority-capability-signal-store-postgres';

export class FakeAuthorityCapabilitySignalPostgres implements PostgresExecutor {
  private rows: AuthorityCapabilitySignalRowV2[] = [];
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

  snapshot(): AuthorityCapabilitySignalRowV2[] {
    return structuredClone(this.rows);
  }

  corrupt(signalId: string, mutate: (row: AuthorityCapabilitySignalRowV2) => void): void {
    const row = this.rows.find(item => item.signal_id === signalId);
    if (!row) throw new Error(`Fake capability signal row not found: ${signalId}`);
    mutate(row);
  }

  private async queryInternal<Row>(
    sql: string,
    params: unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    this.statements.push(normalized);

    if (normalized.startsWith('CREATE SCHEMA')
      || normalized.includes('CREATE TABLE IF NOT EXISTS cos_observability.capability_signals_v2')) {
      return result<Row>([]);
    }

    if (normalized.startsWith('INSERT INTO cos_observability.capability_signals_v2')) {
      if (params.length !== 15) {
        throw new Error(`Expected 15 capability-signal insert params, received ${params.length}`);
      }
      const signalId = String(params[0]);
      if (this.rows.some(row => row.signal_id === signalId)) return result<Row>([]);
      const row: AuthorityCapabilitySignalRowV2 = {
        signal_id: signalId,
        schema_version: 2,
        content_hash: String(params[1]),
        signal_type: String(params[2]),
        outcome: String(params[3]),
        near_miss: Boolean(params[4]),
        project_id: String(params[5]),
        principal_id: String(params[6]),
        capability: String(params[7]),
        resource_uri: String(params[8]),
        operation_id: params[9] == null ? null : String(params[9]),
        correlation_id: params[10] == null ? null : String(params[10]),
        causation_id: params[11] == null ? null : String(params[11]),
        occurred_at: String(params[12]),
        error_code: params[13] == null ? null : String(params[13]),
        details: JSON.parse(String(params[14])) as Record<string, unknown>,
      };
      this.rows.push(structuredClone(row));
      return result<Row>([structuredClone(row) as Row]);
    }

    if (normalized.includes('WHERE signal_id=$1')) {
      const signalId = String(params[0]);
      return result<Row>(this.rows
        .filter(row => row.signal_id === signalId)
        .map(row => structuredClone(row) as Row));
    }

    if (normalized.includes('WHERE project_id=$1')
      && normalized.includes('ORDER BY occurred_at ASC, signal_id ASC')) {
      const projectId = String(params[0]);
      const from = params[1] == null ? null : Date.parse(String(params[1]));
      const to = params[2] == null ? null : Date.parse(String(params[2]));
      const nearMiss = params[3] == null ? null : Boolean(params[3]);
      const limit = Number(params[4]);
      const rows = this.rows
        .filter(row => row.project_id === projectId)
        .filter(row => from === null || Date.parse(String(row.occurred_at)) >= from)
        .filter(row => to === null || Date.parse(String(row.occurred_at)) <= to)
        .filter(row => nearMiss === null || row.near_miss === nearMiss)
        .sort((left, right) => String(left.occurred_at).localeCompare(String(right.occurred_at))
          || left.signal_id.localeCompare(right.signal_id))
        .slice(0, limit)
        .map(row => structuredClone(row) as Row);
      return result<Row>(rows);
    }

    throw new Error(`FakeAuthorityCapabilitySignalPostgres does not implement SQL: ${normalized}`);
  }
}

function result<Row>(rows: Row[]): PostgresQueryResult<Row> {
  return { rows, rowCount: rows.length };
}
