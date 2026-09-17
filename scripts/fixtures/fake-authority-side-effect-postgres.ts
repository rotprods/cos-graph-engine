import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '../../packages/runtime/src/postgres';
import type { AuthoritySideEffectRevisionRow } from '../../packages/execution/src/authority-side-effect-store-postgres';

interface OperationRow extends Record<string, unknown> {
  operation_id: string;
  project_id: string;
  idempotency_key: string;
  logical_hash: string;
  created_at: string;
}

/** Deterministic SQL fixture for AuthoritySideEffectPostgresStore. Unknown SQL fails closed. */
export class FakeAuthoritySideEffectPostgres implements PostgresExecutor {
  private operations: OperationRow[] = [];
  private revisions: AuthoritySideEffectRevisionRow[] = [];
  readonly statements: string[] = [];

  async transaction<T>(fn: (tx: PostgresTransaction) => Promise<T>): Promise<T> {
    const beforeOperations = structuredClone(this.operations);
    const beforeRevisions = structuredClone(this.revisions);
    try {
      return await fn({ query: (sql, params) => this.queryInternal(sql, params) });
    } catch (error) {
      this.operations = beforeOperations;
      this.revisions = beforeRevisions;
      throw error;
    }
  }

  async query<Row = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    return this.queryInternal<Row>(sql, params);
  }

  snapshotRevisions(): AuthoritySideEffectRevisionRow[] {
    return structuredClone(this.revisions);
  }

  corruptRevision(revisionId: string, mutate: (row: AuthoritySideEffectRevisionRow) => void): void {
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
      || statement.includes('create table if not exists cos_execution.authority_side_effect_operations')) {
      return result<Row>([]);
    }
    if (statement.startsWith('select pg_advisory_xact_lock')) {
      return result<Row>([{ locked: true } as Row]);
    }

    if (statement.startsWith('insert into cos_execution.authority_side_effect_operations')) {
      if (params.length !== 5) throw new Error(`FAKE_SIDE_EFFECT_OPERATION_PARAMS=${params.length}`);
      const row: OperationRow = {
        operation_id: String(params[0]),
        project_id: String(params[1]),
        idempotency_key: String(params[2]),
        logical_hash: String(params[3]),
        created_at: toIso(params[4], 'operation created_at'),
      };
      const conflict = this.operations.some(existing =>
        existing.operation_id === row.operation_id
        || (existing.project_id === row.project_id && existing.idempotency_key === row.idempotency_key));
      if (conflict) return result<Row>([]);
      this.operations.push(structuredClone(row));
      return result<Row>([structuredClone(row) as Row]);
    }

    if (statement.includes('from cos_execution.authority_side_effect_operations')
      && statement.includes('where project_id=$1 and idempotency_key=$2')
      && statement.includes('for update')) {
      const projectId = String(params[0]);
      const key = String(params[1]);
      return result<Row>(this.operations
        .filter(row => row.project_id === projectId && row.idempotency_key === key)
        .map(row => structuredClone(row) as Row));
    }

    if (statement.startsWith('insert into cos_execution.authority_side_effect_revisions')) {
      if (params.length !== 32) throw new Error(`FAKE_SIDE_EFFECT_REVISION_PARAMS=${params.length}`);
      const row = revisionFromParams(params);
      const conflict = this.revisions.some(existing =>
        existing.revision_id === row.revision_id
        || (existing.operation_id === row.operation_id && Number(existing.revision) === Number(row.revision))
        || (existing.project_id === row.project_id && existing.transition_key === row.transition_key));
      if (conflict) return result<Row>([]);
      if (!this.operations.some(operation => operation.operation_id === row.operation_id)) {
        throw new Error(`fake foreign-key violation operation=${row.operation_id}`);
      }
      this.revisions.push(structuredClone(row));
      return result<Row>([structuredClone(row) as unknown as Row]);
    }

    if (statement.includes('from cos_execution.authority_side_effect_revisions')
      && statement.includes('where project_id=$1 and transition_key=$2')) {
      const projectId = String(params[0]);
      const transitionKey = String(params[1]);
      return result<Row>(this.revisions
        .filter(row => row.project_id === projectId && row.transition_key === transitionKey)
        .map(row => structuredClone(row) as unknown as Row));
    }

    if (statement.includes('from cos_execution.authority_side_effect_revisions')
      && statement.includes('where revision_id=$1')) {
      const revisionId = String(params[0]);
      return result<Row>(this.revisions
        .filter(row => row.revision_id === revisionId)
        .map(row => structuredClone(row) as unknown as Row));
    }

    if (statement.includes('from cos_execution.authority_side_effect_revisions')
      && statement.includes('where operation_id=$1')
      && statement.includes('order by revision desc')
      && statement.includes('limit 1')) {
      const operationId = String(params[0]);
      const rows = this.revisions
        .filter(row => row.operation_id === operationId)
        .sort((a, b) => Number(b.revision) - Number(a.revision));
      return result<Row>(rows.slice(0, 1).map(row => structuredClone(row) as unknown as Row));
    }

    if (statement.includes('from cos_execution.authority_side_effect_revisions')
      && statement.includes('where operation_id=$1')
      && statement.includes('order by revision asc')) {
      const operationId = String(params[0]);
      const rows = this.revisions
        .filter(row => row.operation_id === operationId)
        .sort((a, b) => Number(a.revision) - Number(b.revision)
          || String(a.recorded_at).localeCompare(String(b.recorded_at))
          || a.revision_id.localeCompare(b.revision_id));
      return result<Row>(rows.map(row => structuredClone(row) as unknown as Row));
    }

    if (statement.includes('from cos_execution.authority_side_effect_operations o')
      && statement.includes('join lateral')
      && statement.includes('where o.project_id=$1 and o.idempotency_key=$2')) {
      const projectId = String(params[0]);
      const key = String(params[1]);
      const operation = this.operations.find(row => row.project_id === projectId && row.idempotency_key === key);
      if (!operation) return result<Row>([]);
      const latest = this.revisions
        .filter(row => row.operation_id === operation.operation_id)
        .sort((a, b) => Number(b.revision) - Number(a.revision))[0];
      return result<Row>(latest ? [structuredClone(latest) as unknown as Row] : []);
    }

    throw new Error(`FAKE_AUTHORITY_SIDE_EFFECT_POSTGRES_UNSUPPORTED_SQL: ${statement}`);
  }
}

function revisionFromParams(params: unknown[]): AuthoritySideEffectRevisionRow {
  return {
    revision_id: String(params[0]),
    operation_id: String(params[1]),
    project_id: String(params[2]),
    idempotency_key: String(params[3]),
    transition_key: String(params[4]),
    transition_hash: String(params[5]),
    logical_hash: String(params[6]),
    revision: safeInteger(params[7], 'revision', 1),
    previous_revision_id: nullableString(params[8]),
    state: String(params[9]) as AuthoritySideEffectRevisionRow['state'],
    effect_knowledge: String(params[10]) as AuthoritySideEffectRevisionRow['effect_knowledge'],
    principal_id: String(params[11]),
    agent_run_id: nullableString(params[12]),
    capability: String(params[13]),
    resource_uri: String(params[14]),
    input_value: parseNullableJson(params[15], false),
    input_hash: String(params[16]),
    attempt: safeInteger(params[17], 'attempt', 0),
    fencing_token: params[18] == null ? null : safeInteger(params[18], 'fencing_token', 1),
    provider_idempotency_key: nullableString(params[19]),
    result_value: parseNullableJson(params[20], true),
    result_hash: nullableString(params[21]),
    error_value: parseNullableJson(params[22], true) as AuthoritySideEffectRevisionRow['error_value'],
    error_hash: nullableString(params[23]),
    compensation_value: parseNullableJson(params[24], true) as AuthoritySideEffectRevisionRow['compensation_value'],
    correlation_id: String(params[25]),
    causation_id: nullableString(params[26]),
    provenance: parseNullableJson(params[27], false) as AuthoritySideEffectRevisionRow['provenance'],
    metadata: parseNullableJson(params[28], false) as Record<string, unknown>,
    created_at: toIso(params[29], 'created_at'),
    recorded_at: toIso(params[30], 'recorded_at'),
    content_hash: String(params[31]),
  };
}

function result<Row>(rows: Row[]): PostgresQueryResult<Row> {
  return { rows, rowCount: rows.length };
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function parseNullableJson(value: unknown, nullable: boolean): unknown {
  if (value == null) {
    if (nullable) return null;
    throw new Error('required JSON value missing');
  }
  if (typeof value !== 'string') throw new Error('fixture JSON value must be serialized');
  return JSON.parse(value);
}

function nullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

function safeInteger(value: unknown, label: string, minimum: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) throw new Error(`Invalid ${label}: ${String(value)}`);
  return parsed;
}

function toIso(value: unknown, label: string): string {
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${String(value)}`);
  return new Date(parsed).toISOString();
}
