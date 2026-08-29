import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '../../packages/runtime/src/postgres-event-log';
import type { AuthorityRepairRevisionRow } from '../../packages/execution/src/authority-repair-store-postgres';

export class FakeAuthorityRepairPostgres implements PostgresExecutor {
  private rows: AuthorityRepairRevisionRow[] = [];
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

  snapshot(): AuthorityRepairRevisionRow[] {
    return structuredClone(this.rows);
  }

  corrupt(revisionId: string, mutate: (row: AuthorityRepairRevisionRow) => void): void {
    const row = this.rows.find(item => item.revision_id === revisionId);
    if (!row) throw new Error(`Fake repair row not found: ${revisionId}`);
    mutate(row);
  }

  private async queryInternal<Row>(
    sql: string,
    params: unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    this.statements.push(normalized);

    if (normalized.startsWith('CREATE SCHEMA')
      || normalized.includes('CREATE TABLE IF NOT EXISTS cos_execution.authority_repair_revisions')) {
      return result<Row>([]);
    }
    if (normalized.startsWith('SELECT pg_advisory_xact_lock')) {
      return result<Row>([{ locked: true } as Row]);
    }

    if (normalized.startsWith('INSERT INTO cos_execution.authority_repair_revisions')) {
      if (params.length !== 24) {
        throw new Error(`Expected 24 repair insert params, received ${params.length}`);
      }
      const revisionId = String(params[0]);
      const operationKey = String(params[2]);
      const repairId = String(params[1]);
      const revision = Number(params[3]);
      if (this.rows.some(row => row.revision_id === revisionId
        || row.operation_key === operationKey
        || (row.repair_id === repairId && Number(row.revision) === revision))) {
        throw new Error('fake repair unique constraint violation');
      }
      const row: AuthorityRepairRevisionRow = {
        revision_id: revisionId,
        repair_id: repairId,
        operation_key: operationKey,
        revision,
        project_id: String(params[4]),
        operation_id: params[5] == null ? null : String(params[5]),
        correlation_id: params[6] == null ? null : String(params[6]),
        repair_kind: String(params[7]),
        dedupe_key: String(params[8]),
        repair_state: String(params[9]),
        payload: JSON.parse(String(params[10])) as Record<string, unknown>,
        sensitivity: String(params[11]),
        attempts: Number(params[12]),
        max_attempts: Number(params[13]),
        next_attempt_at: String(params[14]),
        lease_owner_id: params[15] == null ? null : String(params[15]),
        lease_expires_at: params[16] == null ? null : String(params[16]),
        fencing_token: Number(params[17]),
        error_value: params[18] == null ? null : JSON.parse(String(params[18])) as Record<string, unknown>,
        resolution: params[19] == null ? null : JSON.parse(String(params[19])) as Record<string, unknown>,
        provenance: JSON.parse(String(params[20])) as unknown[],
        recorded_at: String(params[21]),
        previous_revision_id: params[22] == null ? null : String(params[22]),
        content_hash: String(params[23]),
      };
      this.rows.push(structuredClone(row));
      return result<Row>([structuredClone(row) as Row]);
    }

    if (normalized.includes('WHERE operation_key=$1')) {
      const operationKey = String(params[0]);
      return result<Row>(this.rows
        .filter(row => row.operation_key === operationKey)
        .map(row => structuredClone(row) as Row));
    }

    if (normalized.includes('WHERE repair_id=$1')
      && normalized.includes('ORDER BY revision DESC')) {
      const repairId = String(params[0]);
      const rows = this.rows
        .filter(row => row.repair_id === repairId)
        .sort((left, right) => Number(right.revision) - Number(left.revision));
      return result<Row>(rows.slice(0, 1).map(row => structuredClone(row) as Row));
    }

    if (normalized.includes('WHERE project_id=$1 AND dedupe_key=$2')) {
      const projectId = String(params[0]);
      const dedupeKey = String(params[1]);
      const rows = this.rows
        .filter(row => row.project_id === projectId && row.dedupe_key === dedupeKey)
        .sort((left, right) => Number(right.revision) - Number(left.revision));
      return result<Row>(rows.slice(0, 1).map(row => structuredClone(row) as Row));
    }

    if (normalized.includes('WHERE repair_id=$1')
      && normalized.includes('ORDER BY revision ASC')) {
      const repairId = String(params[0]);
      const rows = this.rows
        .filter(row => row.repair_id === repairId)
        .sort((left, right) => Number(left.revision) - Number(right.revision));
      return result<Row>(rows.map(row => structuredClone(row) as Row));
    }

    if (normalized.includes('WHERE project_id=$1')
      && normalized.includes('ORDER BY recorded_at ASC')) {
      const projectId = String(params[0]);
      const rows = this.rows
        .filter(row => row.project_id === projectId)
        .sort((left, right) => String(left.recorded_at).localeCompare(String(right.recorded_at))
          || left.repair_id.localeCompare(right.repair_id)
          || Number(left.revision) - Number(right.revision));
      return result<Row>(rows.map(row => structuredClone(row) as Row));
    }

    throw new Error(`FakeAuthorityRepairPostgres does not implement SQL: ${normalized}`);
  }
}

function result<Row>(rows: Row[]): PostgresQueryResult<Row> {
  return { rows, rowCount: rows.length };
}
