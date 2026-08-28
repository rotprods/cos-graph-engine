import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '../../packages/runtime/src/postgres-event-log';

interface StoredRow extends Record<string, unknown> {
  revision_id: string;
  statement_id: string;
  operation_key: string;
  operation_hash: string;
  revision: number;
  project_id: string;
  identity_key: string;
  subject_text: string;
  predicate_text: string;
  object_text: string;
  confidence: number;
  epistemic_type: string;
  sensitivity: string;
  base_status: string;
  valid_from: string;
  valid_until: string | null;
  observed_at: string;
  system_from: string;
  provenance: unknown;
  source_ref: string;
  metadata: unknown;
  supersedes_revision_id: string | null;
  content_hash: string;
}

export class FakeAuthorityKnowledgePostgres implements PostgresExecutor {
  private rows: StoredRow[] = [];
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
    const normalized = sql.replace(/\s+/g, ' ').trim();
    this.statements.push(normalized);

    if (normalized.startsWith('CREATE SCHEMA') || normalized.includes('CREATE TABLE IF NOT EXISTS cos_knowledge.authority_revisions')) {
      return result<Row>([]);
    }
    if (normalized.startsWith('SELECT pg_advisory_xact_lock')) {
      return result<Row>([{ locked: true }] as unknown as Row[]);
    }

    if (normalized.startsWith('INSERT INTO cos_knowledge.authority_revisions')) {
      const row = rowFromParams(params);
      if (this.rows.some(item => item.revision_id === row.revision_id)) throw new Error(`duplicate revision_id ${row.revision_id}`);
      if (this.rows.some(item => item.operation_key === row.operation_key)) throw new Error(`duplicate operation_key ${row.operation_key}`);
      if (this.rows.some(item => item.statement_id === row.statement_id && item.revision === row.revision)) {
        throw new Error(`duplicate statement revision ${row.statement_id}/${row.revision}`);
      }
      this.rows.push(structuredClone(row));
      return result<Row>([structuredClone(row)] as unknown as Row[]);
    }

    if (normalized.includes('WHERE operation_key=$1')) {
      const key = String(params[0]);
      return result<Row>(this.rows.filter(row => row.operation_key === key).map(row => structuredClone(row)) as unknown as Row[]);
    }

    if (normalized.includes('WHERE statement_id=$1') && normalized.includes('ORDER BY revision DESC')) {
      const statementId = String(params[0]);
      const rows = this.rows
        .filter(row => row.statement_id === statementId)
        .sort((a, b) => b.revision - a.revision || b.system_from.localeCompare(a.system_from));
      return result<Row>(rows.slice(0, 1).map(row => structuredClone(row)) as unknown as Row[]);
    }

    if (normalized.includes('WHERE statement_id=$1') && normalized.includes('ORDER BY revision ASC')) {
      const statementId = String(params[0]);
      const rows = this.rows
        .filter(row => row.statement_id === statementId)
        .sort((a, b) => a.revision - b.revision || a.system_from.localeCompare(b.system_from));
      return result<Row>(rows.map(row => structuredClone(row)) as unknown as Row[]);
    }

    if (normalized.includes('WHERE project_id=$1')) {
      const projectId = String(params[0]);
      const rows = this.rows
        .filter(row => row.project_id === projectId)
        .sort((a, b) => a.system_from.localeCompare(b.system_from)
          || a.statement_id.localeCompare(b.statement_id)
          || a.revision - b.revision
          || a.revision_id.localeCompare(b.revision_id));
      return result<Row>(rows.map(row => structuredClone(row)) as unknown as Row[]);
    }

    throw new Error(`FakeAuthorityKnowledgePostgres does not implement SQL: ${normalized}`);
  }

  snapshot(): StoredRow[] {
    return structuredClone(this.rows);
  }
}

function rowFromParams(params: unknown[]): StoredRow {
  if (params.length !== 23) throw new Error(`Expected 23 knowledge insert params, received ${params.length}`);
  return {
    revision_id: String(params[0]),
    statement_id: String(params[1]),
    operation_key: String(params[2]),
    operation_hash: String(params[3]),
    revision: Number(params[4]),
    project_id: String(params[5]),
    identity_key: String(params[6]),
    subject_text: String(params[7]),
    predicate_text: String(params[8]),
    object_text: String(params[9]),
    confidence: Number(params[10]),
    epistemic_type: String(params[11]),
    sensitivity: String(params[12]),
    base_status: String(params[13]),
    valid_from: String(params[14]),
    valid_until: params[15] == null ? null : String(params[15]),
    observed_at: String(params[16]),
    system_from: String(params[17]),
    provenance: JSON.parse(String(params[18])),
    source_ref: String(params[19]),
    metadata: JSON.parse(String(params[20])),
    supersedes_revision_id: params[21] == null ? null : String(params[21]),
    content_hash: String(params[22]),
  };
}

function result<Row>(rows: Row[]): PostgresQueryResult<Row> {
  return { rows, rowCount: rows.length };
}
