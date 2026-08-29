import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '../../packages/runtime/src/postgres-event-log';
import type {
  AuthorityAgentRunRevisionRow,
} from '../../packages/execution/src/authority-agent-run-store-postgres';

interface AgentRunRow extends Record<string, unknown> {
  run_id: string;
  project_id: string;
  principal_id: string;
  agent_id: string;
  creation_operation_key: string;
  creation_operation_hash: string;
  immutable_hash: string;
  created_at: string;
}

/**
 * Deterministic, transaction-aware fixture implementing only the SQL emitted by
 * AuthorityAgentRunPostgresStore. Unknown SQL fails closed.
 */
export class FakeAuthorityAgentRunPostgres implements PostgresExecutor {
  private runs: AgentRunRow[] = [];
  private revisions: AuthorityAgentRunRevisionRow[] = [];
  readonly statements: string[] = [];

  async transaction<T>(fn: (tx: PostgresTransaction) => Promise<T>): Promise<T> {
    const beforeRuns = structuredClone(this.runs);
    const beforeRevisions = structuredClone(this.revisions);
    try {
      return await fn({ query: (sql, params) => this.queryInternal(sql, params) });
    } catch (error) {
      this.runs = beforeRuns;
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

  snapshotRuns(): AgentRunRow[] { return structuredClone(this.runs); }
  snapshotRevisions(): AuthorityAgentRunRevisionRow[] { return structuredClone(this.revisions); }

  corruptRevision(
    revisionId: string,
    mutate: (row: AuthorityAgentRunRevisionRow) => void,
  ): void {
    const row = this.revisions.find(item => item.revision_id === revisionId);
    if (!row) throw new Error(`Fake agent-run revision not found: ${revisionId}`);
    mutate(row);
  }

  private async queryInternal<Row>(
    sql: string,
    params: unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    const statement = normalizeSql(sql);
    this.statements.push(statement);

    if (statement.startsWith('create schema')
      || statement.includes('create table if not exists cos_execution.authority_agent_runs')) {
      return result<Row>([]);
    }
    if (statement.startsWith('select pg_advisory_xact_lock')) {
      return result<Row>([{ locked: true } as Row]);
    }

    if (statement.startsWith('insert into cos_execution.authority_agent_runs')) {
      if (params.length !== 8) throw new Error(`FAKE_AGENT_RUN_INSERT_PARAMS=${params.length}`);
      const row: AgentRunRow = {
        run_id: String(params[0]),
        project_id: String(params[1]),
        principal_id: String(params[2]),
        agent_id: String(params[3]),
        creation_operation_key: String(params[4]),
        creation_operation_hash: String(params[5]),
        immutable_hash: String(params[6]),
        created_at: toIso(params[7], 'run created_at'),
      };
      const conflict = this.runs.some(item =>
        item.run_id === row.run_id
        || (item.project_id === row.project_id
          && item.creation_operation_key === row.creation_operation_key));
      if (conflict) return result<Row>([]);
      this.runs.push(structuredClone(row));
      return result<Row>([structuredClone(row) as Row]);
    }

    if (statement.includes('from cos_execution.authority_agent_runs')
      && statement.includes('where run_id=$1')) {
      const runId = String(params[0]);
      return result<Row>(this.runs
        .filter(row => row.run_id === runId)
        .map(row => structuredClone(row) as Row));
    }

    if (statement.includes('from cos_execution.authority_agent_runs')
      && statement.includes('where project_id=$1 and creation_operation_key=$2')) {
      const projectId = String(params[0]);
      const operationKey = String(params[1]);
      return result<Row>(this.runs
        .filter(row => row.project_id === projectId
          && row.creation_operation_key === operationKey)
        .map(row => structuredClone(row) as Row));
    }

    if (statement.startsWith('insert into cos_execution.authority_agent_run_revisions')) {
      const row = revisionFromParams(params);
      const conflict = this.revisions.some(item =>
        item.revision_id === row.revision_id
        || (item.run_id === row.run_id && Number(item.revision) === Number(row.revision))
        || (item.project_id === row.project_id && item.operation_key === row.operation_key));
      if (conflict) return result<Row>([]);
      if (!this.runs.some(run => run.run_id === row.run_id)) {
        throw new Error(`fake foreign-key violation run=${row.run_id}`);
      }
      this.revisions.push(structuredClone(row));
      return result<Row>([structuredClone(row) as unknown as Row]);
    }

    if (statement.includes('from cos_execution.authority_agent_run_revisions')
      && statement.includes('where run_id=$1')
      && statement.includes('order by revision desc')) {
      const runId = String(params[0]);
      const rows = this.revisions
        .filter(row => row.run_id === runId)
        .sort((a, b) => Number(b.revision) - Number(a.revision)
          || String(b.recorded_at).localeCompare(String(a.recorded_at)));
      return result<Row>(rows.slice(0, 1).map(row => structuredClone(row) as unknown as Row));
    }

    if (statement.includes('from cos_execution.authority_agent_run_revisions')
      && statement.includes('where run_id=$1')
      && statement.includes('order by revision asc')) {
      const runId = String(params[0]);
      const rows = this.revisions
        .filter(row => row.run_id === runId)
        .sort((a, b) => Number(a.revision) - Number(b.revision)
          || String(a.recorded_at).localeCompare(String(b.recorded_at))
          || a.revision_id.localeCompare(b.revision_id));
      return result<Row>(rows.map(row => structuredClone(row) as unknown as Row));
    }

    if (statement.includes('from cos_execution.authority_agent_run_revisions')
      && statement.includes('where project_id=$1 and operation_key=$2')) {
      const projectId = String(params[0]);
      const operationKey = String(params[1]);
      return result<Row>(this.revisions
        .filter(row => row.project_id === projectId && row.operation_key === operationKey)
        .map(row => structuredClone(row) as unknown as Row));
    }

    if (statement.includes('from cos_execution.authority_agent_run_revisions')
      && statement.includes('where revision_id=$1')) {
      const revisionId = String(params[0]);
      return result<Row>(this.revisions
        .filter(row => row.revision_id === revisionId)
        .map(row => structuredClone(row) as unknown as Row));
    }

    throw new Error(`FAKE_AGENT_RUN_POSTGRES_UNSUPPORTED_SQL: ${statement}`);
  }
}

function revisionFromParams(params: unknown[]): AuthorityAgentRunRevisionRow {
  if (params.length !== 22) throw new Error(`FAKE_AGENT_RUN_REVISION_PARAMS=${params.length}`);
  return {
    revision_id: String(params[0]),
    run_id: String(params[1]),
    project_id: String(params[2]),
    operation_key: String(params[3]),
    operation_hash: String(params[4]),
    revision: Number(params[5]),
    previous_revision_id: params[6] == null ? null : String(params[6]),
    state: String(params[7]) as AuthorityAgentRunRevisionRow['state'],
    principal_id: String(params[8]),
    agent_id: String(params[9]),
    goal_value: parseJson(params[10]),
    acceptance_criteria: parseJson(params[11]),
    plan_value: parseJson(params[12]),
    step_results: parseJson(params[13]),
    criterion_results: parseJson(params[14]),
    terminal_reason: params[15] == null ? null : String(params[15]),
    correlation_id: String(params[16]),
    causation_id: params[17] == null ? null : String(params[17]),
    created_at: toIso(params[18], 'revision created_at'),
    recorded_at: toIso(params[19], 'revision recorded_at'),
    metadata: parseJson(params[20]),
    content_hash: String(params[21]),
  } as AuthorityAgentRunRevisionRow;
}

function parseJson(value: unknown): any {
  return typeof value === 'string' ? JSON.parse(value) : structuredClone(value);
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function toIso(value: unknown, label: string): string {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${String(value)}`);
  return new Date(parsed).toISOString();
}

function result<Row>(rows: Row[]): PostgresQueryResult<Row> {
  return { rows, rowCount: rows.length };
}
