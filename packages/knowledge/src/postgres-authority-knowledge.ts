import { canonicalHash128, type EpistemicType, type ProvenanceRef } from '@cos/core';
import type { PostgresExecutor, PostgresTransaction } from '@cos/runtime';
import type {
  AuthorityKnowledgeAppendResult,
  AuthorityKnowledgeRevision,
  AuthorityKnowledgeSensitivity,
  IAuthorityKnowledgeRevisionStore,
} from './authority-knowledge';

interface KnowledgeRevisionRow {
  revision_id: string;
  statement_id: string;
  operation_key: string;
  operation_hash: string;
  revision: string | number;
  project_id: string;
  identity_key: string;
  subject_text: string;
  predicate_text: string;
  object_text: string;
  confidence: string | number;
  epistemic_type: string;
  sensitivity: string;
  base_status: 'active' | 'retracted';
  valid_from: string | Date;
  valid_until: string | Date | null;
  observed_at: string | Date;
  system_from: string | Date;
  provenance: ProvenanceRef[];
  source_ref: string;
  metadata: Record<string, string | number | boolean | null>;
  supersedes_revision_id: string | null;
  content_hash: string;
}

export const POSTGRES_AUTHORITY_KNOWLEDGE_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_knowledge;

CREATE TABLE IF NOT EXISTS cos_knowledge.authority_revisions (
  revision_id TEXT PRIMARY KEY,
  statement_id TEXT NOT NULL,
  operation_key TEXT NOT NULL UNIQUE,
  operation_hash TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  project_id TEXT NOT NULL,
  identity_key TEXT NOT NULL,
  subject_text TEXT NOT NULL,
  predicate_text TEXT NOT NULL,
  object_text TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  epistemic_type TEXT NOT NULL,
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('public','internal','private','restricted')),
  base_status TEXT NOT NULL CHECK (base_status IN ('active','retracted')),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  observed_at TIMESTAMPTZ NOT NULL,
  system_from TIMESTAMPTZ NOT NULL,
  provenance JSONB NOT NULL,
  source_ref TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  supersedes_revision_id TEXT,
  content_hash TEXT NOT NULL,
  CONSTRAINT cos_knowledge_valid_interval CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT cos_knowledge_statement_revision_unique UNIQUE(statement_id, revision),
  CONSTRAINT cos_knowledge_parent_fk FOREIGN KEY (supersedes_revision_id)
    REFERENCES cos_knowledge.authority_revisions(revision_id)
);

CREATE INDEX IF NOT EXISTS cos_knowledge_project_system_idx
  ON cos_knowledge.authority_revisions(project_id, system_from, statement_id, revision);
CREATE INDEX IF NOT EXISTS cos_knowledge_statement_system_idx
  ON cos_knowledge.authority_revisions(statement_id, system_from, revision);
CREATE INDEX IF NOT EXISTS cos_knowledge_valid_idx
  ON cos_knowledge.authority_revisions(project_id, valid_from, valid_until);
`;

/**
 * Append-only Postgres/Supabase adapter.
 *
 * A transaction-scoped advisory lock serializes writers for one statement ID.
 * Historical rows are never updated; systemUntil is derived by the Gateway.
 */
export class PostgresAuthorityKnowledgeStore implements IAuthorityKnowledgeRevisionStore {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(POSTGRES_AUTHORITY_KNOWLEDGE_DDL);
  }

  async appendRevision(
    revision: AuthorityKnowledgeRevision,
    expectedCurrentRevision: number,
  ): Promise<AuthorityKnowledgeAppendResult> {
    validateRevision(revision);
    return this.db.transaction(async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [revision.statementId]);

      const duplicate = await this.byOperation(tx, revision.operationKey);
      if (duplicate) {
        if (duplicate.operationHash !== revision.operationHash || duplicate.contentHash !== revision.contentHash) {
          throw new Error(`KNOWLEDGE_IDEMPOTENCY_CONFLICT key=${revision.operationKey}`);
        }
        return { revision: duplicate, appended: false };
      }

      const currentResult = await tx.query<KnowledgeRevisionRow>(`
        SELECT * FROM cos_knowledge.authority_revisions
        WHERE statement_id=$1
        ORDER BY revision DESC
        LIMIT 1
        FOR SHARE
      `, [revision.statementId]);
      const current = currentResult.rowCount ? rowToRevision(currentResult.rows[0]) : null;
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== expectedCurrentRevision) {
        throw new Error(`STALE_KNOWLEDGE_REVISION expected=${expectedCurrentRevision} current=${currentRevision}`);
      }
      if (revision.revision !== currentRevision + 1) {
        throw new Error(`KNOWLEDGE_REVISION_SEQUENCE expected=${currentRevision + 1} incoming=${revision.revision}`);
      }
      if (current) {
        if (revision.supersedesRevisionId !== current.revisionId) {
          throw new Error(`KNOWLEDGE_REVISION_PARENT_MISMATCH statement=${revision.statementId}`);
        }
        if (revision.systemFrom <= current.systemFrom) {
          throw new Error(`KNOWLEDGE_SYSTEM_TIME_NOT_MONOTONIC statement=${revision.statementId}`);
        }
      } else if (revision.supersedesRevisionId !== null) {
        throw new Error(`KNOWLEDGE_INITIAL_REVISION_HAS_PARENT statement=${revision.statementId}`);
      }

      const result = await tx.query<KnowledgeRevisionRow>(`
        INSERT INTO cos_knowledge.authority_revisions (
          revision_id, statement_id, operation_key, operation_hash, revision,
          project_id, identity_key, subject_text, predicate_text, object_text,
          confidence, epistemic_type, sensitivity, base_status,
          valid_from, valid_until, observed_at, system_from,
          provenance, source_ref, metadata, supersedes_revision_id, content_hash
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
          $15::timestamptz,$16::timestamptz,$17::timestamptz,$18::timestamptz,
          $19::jsonb,$20,$21::jsonb,$22,$23
        )
        RETURNING *
      `, [
        revision.revisionId,
        revision.statementId,
        revision.operationKey,
        revision.operationHash,
        revision.revision,
        revision.projectId,
        revision.identityKey,
        revision.subject,
        revision.predicate,
        revision.object,
        revision.confidence,
        revision.epistemicType,
        revision.sensitivity,
        revision.baseStatus,
        revision.validFrom,
        revision.validUntil,
        revision.observedAt,
        revision.systemFrom,
        JSON.stringify(revision.provenance),
        revision.source,
        JSON.stringify(revision.metadata),
        revision.supersedesRevisionId,
        revision.contentHash,
      ]);
      if (result.rowCount !== 1) throw new Error('KNOWLEDGE_INSERT_INVARIANT');
      return { revision: rowToRevision(result.rows[0]), appended: true };
    });
  }

  async getByOperation(operationKey: string): Promise<AuthorityKnowledgeRevision | null> {
    const result = await this.db.query<KnowledgeRevisionRow>(
      'SELECT * FROM cos_knowledge.authority_revisions WHERE operation_key=$1',
      [operationKey.trim()],
    );
    return result.rowCount ? rowToRevision(result.rows[0]) : null;
  }

  async getCurrent(statementId: string): Promise<AuthorityKnowledgeRevision | null> {
    const result = await this.db.query<KnowledgeRevisionRow>(`
      SELECT * FROM cos_knowledge.authority_revisions
      WHERE statement_id=$1 ORDER BY revision DESC LIMIT 1
    `, [statementId.trim()]);
    return result.rowCount ? rowToRevision(result.rows[0]) : null;
  }

  async getHistory(statementId: string): Promise<AuthorityKnowledgeRevision[]> {
    const result = await this.db.query<KnowledgeRevisionRow>(`
      SELECT * FROM cos_knowledge.authority_revisions
      WHERE statement_id=$1 ORDER BY revision ASC, system_from ASC, revision_id ASC
    `, [statementId.trim()]);
    return result.rows.map(rowToRevision);
  }

  async listProjectRevisions(projectId: string): Promise<AuthorityKnowledgeRevision[]> {
    const result = await this.db.query<KnowledgeRevisionRow>(`
      SELECT * FROM cos_knowledge.authority_revisions
      WHERE project_id=$1 ORDER BY system_from ASC, statement_id ASC, revision ASC, revision_id ASC
    `, [projectId.trim()]);
    return result.rows.map(rowToRevision);
  }

  private async byOperation(tx: PostgresTransaction, operationKey: string): Promise<AuthorityKnowledgeRevision | null> {
    const result = await tx.query<KnowledgeRevisionRow>(
      'SELECT * FROM cos_knowledge.authority_revisions WHERE operation_key=$1 FOR SHARE',
      [operationKey],
    );
    return result.rowCount ? rowToRevision(result.rows[0]) : null;
  }
}

function rowToRevision(row: KnowledgeRevisionRow): AuthorityKnowledgeRevision {
  const revision: AuthorityKnowledgeRevision = {
    revisionId: row.revision_id,
    statementId: row.statement_id,
    operationKey: row.operation_key,
    operationHash: row.operation_hash,
    revision: Number(row.revision),
    projectId: row.project_id,
    identityKey: row.identity_key,
    subject: row.subject_text,
    predicate: row.predicate_text,
    object: row.object_text,
    confidence: Number(row.confidence),
    epistemicType: row.epistemic_type as EpistemicType,
    sensitivity: row.sensitivity as AuthorityKnowledgeSensitivity,
    baseStatus: row.base_status,
    validFrom: toIso(row.valid_from),
    validUntil: row.valid_until === null ? null : toIso(row.valid_until),
    observedAt: toIso(row.observed_at),
    systemFrom: toIso(row.system_from),
    provenance: structuredClone(row.provenance ?? []),
    source: row.source_ref,
    metadata: structuredClone(row.metadata ?? {}),
    supersedesRevisionId: row.supersedes_revision_id,
    contentHash: row.content_hash,
  };
  validateRevision(revision);
  return revision;
}

function validateRevision(revision: AuthorityKnowledgeRevision): void {
  if (!Number.isSafeInteger(revision.revision) || revision.revision < 1) throw new Error('KNOWLEDGE_CORRUPT_REVISION');
  if (!Number.isFinite(revision.confidence) || revision.confidence < 0 || revision.confidence > 1) {
    throw new Error('KNOWLEDGE_CORRUPT_CONFIDENCE');
  }
  if (revision.validUntil !== null && revision.validUntil <= revision.validFrom) throw new Error('KNOWLEDGE_CORRUPT_VALID_INTERVAL');
  if (revision.systemFrom < revision.observedAt) throw new Error('KNOWLEDGE_CORRUPT_SYSTEM_TIME');
  const { contentHash, ...base } = revision;
  if (canonicalHash128(base) !== contentHash) throw new Error(`KNOWLEDGE_CONTENT_HASH_MISMATCH revision=${revision.revisionId}`);
}

function toIso(value: string | Date): string {
  const iso = value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  if (!Number.isFinite(Date.parse(iso))) throw new Error(`Invalid knowledge timestamp ${String(value)}`);
  return iso;
}
