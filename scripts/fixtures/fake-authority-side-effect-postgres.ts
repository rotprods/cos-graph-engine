import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '../../packages/runtime/src/postgres-event-log';
import type { SideEffectRevisionRow } from '../../packages/execution/src/postgres-authority-side-effect';

interface OperationRow extends Record<string, unknown> {
  operation_id: string;
  project_id: string;
  idempotency_key: string;
  logical_hash: string;
  created_at: string;
}

/**
 * Transaction-aware fake Postgres executor for Phase 05 side-effect contracts.
 * Only SQL emitted by PostgresAuthoritySideEffectStore is accepted.
 */
export class FakeAuthoritySideEffectPostgres implements PostgresExecutor {
  private operations: OperationRow[] = [];
  private revisions: SideEffectRevisionRow[] = [];
  readonly statements: string[] = [];

  async transaction<T>(fn: (tx: PostgresTransaction) => Promise<T>): Promise<T> {
    const operationsBefore = structuredClone(this.operations);
    const revisionsBefore = structuredClone(this.revisions);
    try {
      return await fn({ query: (sql, params) => this.queryInternal(sql, params) });
    } catch (error) {
      this.operations = operationsBefore;
      this.revisions = revisionsBefore;
      throw error;
    }
  }

  async query<Row = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    return this.queryInternal<Row>(sql, params);
  }

  snapshotOperations(): OperationRow[] {
    return structuredClone(this.operations);
  }

  snapshotRevisions(): SideEffectRevisionRow[] {
    return structuredClone(this.revisions);
  }

  corruptRevision(
    revisionId: string,
    mutate: (row: SideEffectRevisionRow) => void,
  ): void {
    const row = this.revisions.find(candidate => candidate.revision_id === revisionId);
    if (!row) throw new Error(`Fake side-effect revision not found: ${revisionId}`);
    mutate(row);
  }

  private async queryInternal<Row>(
    sql: string,
    params: unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    const statement = normalizeSql(sql);
    this.statements.push(statement);

    if (statement.startsWith('create schema')
      || statement.includes('create table if not exists cos_execution.side_effect_operations')) {
      return result<Row>([]);
    }
    if (statement.startsWith('select pg_advisory_xact_lock')) {
      return result<Row>([{ locked: true } as Row]);
    }

    if (statement.startsWith('insert into cos_execution.side_effect_operations')) {
      return this.insertOperation<Row>(params);
    }

    if (statement.includes('from cos_execution.side_effect_operations')
      && statement.includes('where project_id=$1 and idempotency_key=$2')
      && statement.includes('for update')) {
      const projectId = String(params[0]);
      const key = String(params[1]);
      return result<Row>(this.operations
        .filter(row => row.project_id === projectId && row.idempotency_key === key)
        .map(row => structuredClone(row) as Row));
    }

    if (statement.startsWith('insert into cos_execution.side_effect_revisions')) {
      return this.insertRevision<Row>(params);
    }

    if (statement.includes('from cos_execution.side_effect_revisions')
      && statement.includes('where project_id=$1 and transition_key=$2')) {
      const projectId = String(params[0]);
      const transitionKey = String(params[1]);
      return result<Row>(this.revisions
        .filter(row => row.project_id === projectId && row.transition_key === transitionKey)
        .map(row => structuredClone(row) as Row));
    }

    if (statement.includes('from cos_execution.side_effect_revisions')
      && statement.includes('where operation_id=$1')
      && statement.includes('order by revision desc')
      && statement.includes('limit 1')) {
      const operationId = String(params[0]);
      const sorted = this.revisions
        .filter(row => row.operation_id === operationId)
        .sort((left, right) => Number(right.revision) - Number(left.revision));
      return result<Row>(sorted.slice(0, 1).map(row => structuredClone(row) as Row));
    }

    if (statement.includes('from cos_execution.side_effect_revisions')
      && statement.includes('where operation_id=$1')
      && statement.includes('order by revision asc')) {
      const operationId = String(params[0]);
      const sorted = this.revisions
        .filter(row => row.operation_id === operationId)
        .sort((left, right) => Number(left.revision) - Number(right.revision)
          || String(left.recorded_at).localeCompare(String(right.recorded_at))
          || left.revision_id.localeCompare(right.revision_id));
      return result<Row>(sorted.map(row => structuredClone(row) as Row));
    }

    if (statement.includes('from cos_execution.side_effect_operations o')
      && statement.includes('join lateral')
      && statement.includes('where o.project_id=$1 and o.idempotency_key=$2')) {
      const projectId = String(params[0]);
      const key = String(params[1]);
      const operation = this.operations.find(
        row => row.project_id === projectId && row.idempotency_key === key,
      );
      if (!operation) return result<Row>([]);
      const current = this.revisions
        .filter(row => row.operation_id === operation.operation_id)
        .sort((left, right) => Number(right.revision) - Number(left.revision))[0];
      return result<Row>(current ? [structuredClone(current) as Row] : []);
    }

    throw new Error(`FAKE_SIDE_EFFECT_POSTGRES_UNSUPPORTED_SQL: ${statement}`);
  }

  private insertOperation<Row>(params: unknown[]): PostgresQueryResult<Row> {
    if (params.length !== 5) {
      throw new Error(`FAKE_SIDE_EFFECT_OPERATION_PARAM_COUNT=${params.length}`);
    }
    const row: OperationRow = {
      operation_id: String(params[0]),
      project_id: String(params[1]),
      idempotency_key: String(params[2]),
      logical_hash: String(params[3]),
      created_at: toIso(params[4], 'created_at'),
    };
    const duplicate = this.operations.find(
      current => current.project_id === row.project_id
        && current.idempotency_key === row.idempotency_key,
    );
    if (duplicate) return result<Row>([]);
    if (this.operations.some(current => current.operation_id === row.operation_id)) {
      throw new Error(`duplicate operation_id ${row.operation_id}`);
    }
    this.operations.push(structuredClone(row));
    return result<Row>([structuredClone(row) as Row]);
  }

  private insertRevision<Row>(params: unknown[]): PostgresQueryResult<Row> {
    if (params.length !== 32) {
      throw new Error(`FAKE_SIDE_EFFECT_REVISION_PARAM_COUNT=${params.length}`);
    }
    const row: SideEffectRevisionRow = {
      revision_id: String(params[0]),
      operation_id: String(params[1]),
      project_id: String(params[2]),
      idempotency_key: String(params[3]),
      transition_key: String(params[4]),
      transition_hash: String(params[5]),
      logical_hash: String(params[6]),
      revision: safeInteger(params[7], 'revision', 1),
      previous_revision_id: nullableString(params[8]),
      state: String(params[9]) as SideEffectRevisionRow['state'],
      effect_knowledge: String(params[10]) as SideEffectRevisionRow['effect_knowledge'],
      principal_id: String(params[11]),
      agent_run_id: nullableString(params[12]),
      capability: String(params[13]),
      resource_uri: String(params[14]),
      input_value: parseJson(params[15], 'input_value'),
      input_hash: String(params[16]),
      attempt: safeInteger(params[17], 'attempt', 0),
      fencing_token: params[18] === null ? null : safeInteger(params[18], 'fencing_token', 1),
      provider_idempotency_key: nullableString(params[19]),
      result_value: params[20] === null ? null : parseJson(params[20], 'result_value'),
      result_hash: nullableString(params[21]),
      error_value: params[22] === null ? null : parseJson(params[22], 'error_value'),
      error_hash: nullableString(params[23]),
      compensation_value: params[24] === null ? null : parseJson(params[24], 'compensation_value'),
      correlation_id: String(params[25]),
      causation_id: nullableString(params[26]),
      provenance: parseJson(params[27], 'provenance') as SideEffectRevisionRow['provenance'],
      metadata: parseJson(params[28], 'metadata') as Record<string, unknown>,
      created_at: toIso(params[29], 'created_at'),
      recorded_at: toIso(params[30], 'recorded_at'),
      content_hash: String(params[31]),
    };

    if (this.revisions.some(current => current.revision_id === row.revision_id)) {
      throw new Error(`duplicate revision_id ${row.revision_id}`);
    }
    if (this.revisions.some(current => current.operation_id === row.operation_id
      && Number(current.revision) === Number(row.revision))) {
      throw new Error(`duplicate operation revision ${row.operation_id}/${row.revision}`);
    }
    if (this.revisions.some(current => current.project_id === row.project_id
      && current.transition_key === row.transition_key)) {
      throw new Error(`duplicate transition key ${row.transition_key}`);
    }
    if (!this.operations.some(operation => operation.operation_id === row.operation_id)) {
      throw new Error(`missing operation ${row.operation_id}`);
    }

    this.revisions.push(structuredClone(row));
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
