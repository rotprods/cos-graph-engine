import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '../../packages/runtime/src/postgres-event-log';
import type { SideEffectRevisionRow } from '../../packages/execution/src/postgres-side-effect-ledger';

/**
 * Deterministic SQL fixture for the exact statements emitted by
 * PostgresSideEffectLedgerStore. Unknown SQL fails closed. Transactions restore
 * rows and statement-local mutations on error, modelling the adapter contract
 * without touching a real Postgres/Supabase project.
 */
export class FakeSideEffectLedgerPostgres implements PostgresExecutor {
  private rows: SideEffectRevisionRow[] = [];
  readonly statements: string[] = [];

  async transaction<T>(fn: (tx: PostgresTransaction) => Promise<T>): Promise<T> {
    const before = cloneRows(this.rows);
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

  snapshotRows(): SideEffectRevisionRow[] {
    return cloneRows(this.rows);
  }

  corruptRevision(revisionId: string, mutate: (row: SideEffectRevisionRow) => void): void {
    const row = this.rows.find(candidate => candidate.revision_id === revisionId);
    if (!row) throw new Error(`Fake side-effect row not found: ${revisionId}`);
    mutate(row);
  }

  private async queryInternal<Row>(
    sql: string,
    params: unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    const statement = normalizeSql(sql);
    this.statements.push(statement);

    if (statement.startsWith('create schema')
      || statement.includes('create table if not exists cos_execution.side_effect_operation_revisions')) {
      return result<Row>([]);
    }

    if (statement.startsWith('select pg_advisory_xact_lock')) {
      return result<Row>([{ locked: true }] as unknown as Row[]);
    }

    if (statement.startsWith('insert into cos_execution.side_effect_operation_revisions')) {
      return this.insert<Row>(params);
    }

    if (statement.includes('where transition_key=$1')) {
      const transitionKey = String(params[0]);
      return result<Row>(this.rows
        .filter(row => row.transition_key === transitionKey)
        .map(cloneRow) as unknown as Row[]);
    }

    if (statement.includes('where operation_id=$1')
      && statement.includes('order by revision desc')) {
      const operationId = String(params[0]);
      const rows = this.rows
        .filter(row => row.operation_id === operationId)
        .sort((left, right) => Number(right.revision) - Number(left.revision));
      return result<Row>(rows.slice(0, 1).map(cloneRow) as unknown as Row[]);
    }

    if (statement.includes('where operation_id=$1')
      && statement.includes('order by revision asc')) {
      const operationId = String(params[0]);
      return result<Row>(this.rows
        .filter(row => row.operation_id === operationId)
        .sort((left, right) => Number(left.revision) - Number(right.revision))
        .map(cloneRow) as unknown as Row[]);
    }

    if (statement.includes('where project_id=$1')) {
      const projectId = String(params[0]);
      return result<Row>(this.rows
        .filter(row => row.project_id === projectId)
        .sort(compareRows)
        .map(cloneRow) as unknown as Row[]);
    }

    throw new Error(`FAKE_SIDE_EFFECT_POSTGRES_UNSUPPORTED_SQL: ${statement}`);
  }

  private insert<Row>(params: unknown[]): PostgresQueryResult<Row> {
    if (params.length !== 24) {
      throw new Error(`FAKE_SIDE_EFFECT_INSERT_PARAM_COUNT=${params.length}`);
    }
    const row = rowFromParams(params);
    if (this.rows.some(candidate => candidate.revision_id === row.revision_id)) {
      throw new Error(`duplicate side-effect revision_id ${row.revision_id}`);
    }
    if (this.rows.some(candidate => candidate.transition_key === row.transition_key)) {
      throw new Error(`duplicate side-effect transition_key ${row.transition_key}`);
    }
    if (this.rows.some(candidate =>
      candidate.operation_id === row.operation_id
      && Number(candidate.revision) === Number(row.revision))) {
      throw new Error(`duplicate side-effect operation revision ${row.operation_id}/${row.revision}`);
    }
    this.rows.push(cloneRow(row));
    return result<Row>([cloneRow(row)] as unknown as Row[]);
  }
}

function rowFromParams(params: unknown[]): SideEffectRevisionRow {
  return {
    schema_version: 1,
    serialization_version: 1,
    revision_id: String(params[0]),
    operation_id: String(params[1]),
    transition_key: String(params[2]),
    transition_intent_hash: String(params[3]),
    operation_key: String(params[4]),
    revision: Number(params[5]),
    state: String(params[6]),
    principal_id: String(params[7]),
    project_id: String(params[8]),
    resource_uri: String(params[9]),
    action_name: String(params[10]),
    request_payload: parseJson(params[11]),
    request_hash: String(params[12]),
    source_ref: String(params[13]),
    system_from: new Date(String(params[14])),
    fencing_version: params[15] === null ? null : Number(params[15]),
    provider_reference: params[16] === null ? null : String(params[16]),
    result_payload: params[17] === null ? null : parseJson(params[17]),
    error_payload: params[18] === null ? null : parseJson(params[18]),
    uncertainty_reason: params[19] === null ? null : String(params[19]),
    compensation_reference: params[20] === null ? null : String(params[20]),
    metadata: parseJson(params[21]),
    previous_revision_id: params[22] === null ? null : String(params[22]),
    content_hash: String(params[23]),
  };
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return structuredClone(value);
  return JSON.parse(value);
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function compareRows(left: SideEffectRevisionRow, right: SideEffectRevisionRow): number {
  return toIso(left.system_from).localeCompare(toIso(right.system_from))
    || left.operation_id.localeCompare(right.operation_id)
    || Number(left.revision) - Number(right.revision)
    || left.revision_id.localeCompare(right.revision_id);
}

function cloneRows(rows: SideEffectRevisionRow[]): SideEffectRevisionRow[] {
  return rows.map(cloneRow);
}

function cloneRow(row: SideEffectRevisionRow): SideEffectRevisionRow {
  return {
    ...structuredClone({
      ...row,
      system_from: toIso(row.system_from),
    }),
    system_from: new Date(toIso(row.system_from)),
  };
}

function toIso(value: string | Date): string {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid fake side-effect timestamp: ${String(value)}`);
  return new Date(parsed).toISOString();
}

function result<Row>(rows: Row[]): PostgresQueryResult<Row> {
  return { rows, rowCount: rows.length };
}
