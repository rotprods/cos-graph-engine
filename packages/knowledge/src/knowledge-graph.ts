import {
  KnowledgeStatement, EntityId, GraphPath, GraphStats, IPropertyGraph,
  TemporalEnvelope, ProvenanceRef, EpistemicType,
  isCurrent, isValidAt, wasKnownAt, supersedeTemporal,
} from '@cos/core';
import { generateId } from '@cos/core';
import { PropertyGraph } from './property-graph';

export interface AddKnowledgeStatementOptions {
  validFrom?: string;
  observedAt?: string;
  recordedAt?: string;
  epistemicType?: EpistemicType;
  provenance?: ProvenanceRef[];
}

export interface TemporalKnowledgeRecord extends TemporalEnvelope<KnowledgeStatement> {}

/**
 * Knowledge graph with revision-preserving statement semantics.
 *
 * Statements are never physically removed by normal domain operations. A
 * retraction closes their bi-temporal window and retires the projected edge;
 * a correction creates a new revision that explicitly supersedes the previous
 * record. This keeps historical truth, system knowledge and graph projection in
 * sync.
 */
export class KnowledgeGraph {
  private graph: IPropertyGraph;
  private records: Map<EntityId, TemporalKnowledgeRecord> = new Map();
  private statementEdges: Map<EntityId, EntityId> = new Map();

  constructor(graph?: IPropertyGraph) {
    this.graph = graph || new PropertyGraph();
  }

  async addStatement(
    statement: Omit<KnowledgeStatement, 'id' | 'timestamp'>,
    options: AddKnowledgeStatementOptions = {},
  ): Promise<EntityId> {
    const now = new Date().toISOString();
    const id = generateId();
    const recordedAt = options.recordedAt || now;
    const observedAt = options.observedAt || recordedAt;
    const validFrom = options.validFrom || observedAt;

    const stored: KnowledgeStatement = {
      ...statement,
      id,
      timestamp: recordedAt,
    };

    const provenance = options.provenance || [{ source: String(statement.source) }];
    const record: TemporalKnowledgeRecord = {
      id,
      value: stored,
      temporal: {
        validFrom,
        validUntil: null,
        observedAt,
        recordedAt,
        supersededAt: null,
      },
      provenance,
      epistemicType: options.epistemicType || 'observed',
      confidence: statement.confidence,
      supersedes: null,
    };

    await this.persistRecordProjection(record);
    return id;
  }

  /** Current, non-superseded knowledge only. */
  async query(subject?: string, predicate?: string, object?: string): Promise<KnowledgeStatement[]> {
    return this.filterRecords(
      Array.from(this.records.values()).filter(isCurrent),
      subject,
      predicate,
      object,
    );
  }

  /** What was valid in domain time, irrespective of when COS learned it? */
  async queryValidAt(
    at: string,
    subject?: string,
    predicate?: string,
    object?: string,
  ): Promise<KnowledgeStatement[]> {
    return this.filterRecords(
      Array.from(this.records.values()).filter(record => isValidAt(record.temporal, at)),
      subject,
      predicate,
      object,
    );
  }

  /** What had COS recorded by system time T? */
  async queryKnownAt(
    at: string,
    subject?: string,
    predicate?: string,
    object?: string,
  ): Promise<KnowledgeStatement[]> {
    return this.filterRecords(
      Array.from(this.records.values()).filter(record => wasKnownAt(record.temporal, at)),
      subject,
      predicate,
      object,
    );
  }

  async getRecord(id: EntityId): Promise<TemporalKnowledgeRecord | null> {
    return this.records.get(id) || null;
  }

  async getRelated(subject: string, depth: number = 1): Promise<GraphPath[]> {
    const subjectNodes = await this.graph.queryNodes({ label: subject, limit: 1 });
    if (subjectNodes.length === 0) return [];
    return this.graph.traverse(subjectNodes[0].id, ['knowledge', 'related_to', 'belongs_to'], depth);
  }

  /**
   * Retire a statement while preserving the historical revision.
   * The backing graph edge is moved out of the active `knowledge` edge type so
   * normal traversals cannot accidentally return a retracted assertion.
   */
  async retireStatement(id: EntityId, at: string = new Date().toISOString()): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    if (!isCurrent(record)) return;

    const retired: TemporalKnowledgeRecord = {
      ...record,
      temporal: {
        ...record.temporal,
        validUntil: at,
        supersededAt: at,
      },
    };
    this.records.set(id, retired);
    await this.retireProjectedEdge(id, at);
  }

  /**
   * Compatibility method: deletion now means semantic retirement, not physical
   * history destruction.
   */
  async deleteStatement(id: EntityId): Promise<void> {
    await this.retireStatement(id);
  }

  /** Correct an assertion without mutating or erasing the previous evidence. */
  async supersedeStatement(
    id: EntityId,
    replacement: Omit<KnowledgeStatement, 'id' | 'timestamp'>,
    at: string = new Date().toISOString(),
    options: Omit<AddKnowledgeStatementOptions, 'recordedAt'> = {},
  ): Promise<EntityId> {
    const current = this.records.get(id);
    if (!current) throw new Error(`Knowledge statement ${id} not found`);
    if (!isCurrent(current)) throw new Error(`Knowledge statement ${id} is already retired or superseded`);

    const replacementId = generateId();
    const replacementStatement: KnowledgeStatement = {
      ...replacement,
      id: replacementId,
      timestamp: at,
    };

    const provenance = options.provenance || [{ source: String(replacement.source) }];
    const { previous, replacement: next } = supersedeTemporal(
      current,
      replacementId,
      replacementStatement,
      at,
      provenance,
      {
        validFrom: options.validFrom,
        observedAt: options.observedAt,
        epistemicType: options.epistemicType,
        confidence: replacement.confidence,
      },
    );

    this.records.set(id, previous as TemporalKnowledgeRecord);
    await this.retireProjectedEdge(id, at);

    const nextRecord: TemporalKnowledgeRecord = {
      ...(next as TemporalKnowledgeRecord),
      value: replacementStatement,
    };
    await this.persistRecordProjection(nextRecord);
    return replacementId;
  }

  async stats(): Promise<GraphStats> {
    return this.graph.stats();
  }

  private filterRecords(
    records: TemporalKnowledgeRecord[],
    subject?: string,
    predicate?: string,
    object?: string,
  ): KnowledgeStatement[] {
    let results = records.map(record => record.value);
    if (subject) results = results.filter(s => s.subject.toLowerCase().includes(subject.toLowerCase()));
    if (predicate) results = results.filter(s => s.predicate.toLowerCase().includes(predicate.toLowerCase()));
    if (object) results = results.filter(s => s.object.toLowerCase().includes(object.toLowerCase()));
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private async persistRecordProjection(record: TemporalKnowledgeRecord): Promise<void> {
    this.records.set(record.id, record);

    const statement = record.value;
    const subjectId = await this.ensureNode(statement.subject, 'concept');
    const objectId = await this.ensureNode(statement.object, 'concept');
    const edgeId = generateId();

    await this.graph.addEdge({
      id: edgeId,
      source: subjectId,
      target: objectId,
      type: 'knowledge',
      label: statement.predicate,
      weight: statement.confidence,
      properties: {
        statementId: String(record.id),
        source: String(statement.source),
        epistemicType: record.epistemicType,
        validFrom: record.temporal.validFrom,
        status: 'active',
      },
      directed: true,
      confidence: statement.confidence,
      createdAt: record.temporal.recordedAt,
      updatedAt: record.temporal.recordedAt,
    });

    this.statementEdges.set(record.id, edgeId);
  }

  private async retireProjectedEdge(statementId: EntityId, at: string): Promise<void> {
    const edgeId = this.statementEdges.get(statementId);
    if (!edgeId) return;
    const edge = await this.graph.getEdge(edgeId);
    if (!edge) return;

    await this.graph.updateEdge(edgeId, {
      type: 'knowledge_retired',
      properties: {
        ...edge.properties,
        status: 'retired',
        validUntil: at,
      },
      updatedAt: at,
    });
  }

  private async ensureNode(label: string, type: string): Promise<EntityId> {
    const existing = await this.graph.queryNodes({ label, type, limit: 1 });
    if (existing.length > 0) return existing[0].id;

    return this.graph.addNode({
      id: generateId(),
      type,
      label,
      representations: {},
      properties: {},
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: { major: 1, minor: 0, patch: 0 },
    });
  }
}
