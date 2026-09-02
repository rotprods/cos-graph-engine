import {
  KnowledgeStatement, EntityId,
  GraphPath, GraphStats, IPropertyGraph,
} from '@cos/core';
import { generateId } from '@cos/core';
import { PropertyGraph } from './property-graph';

export class KnowledgeGraph {
  private graph: IPropertyGraph;
  private statements: Map<EntityId, KnowledgeStatement> = new Map();

  constructor(graph?: IPropertyGraph) {
    this.graph = graph || new PropertyGraph();
  }

  async addStatement(statement: Omit<KnowledgeStatement, 'id' | 'timestamp'>): Promise<EntityId> {
    const id = generateId();
    const stored: KnowledgeStatement = {
      ...statement,
      id,
      timestamp: new Date().toISOString(),
    };

    this.statements.set(id, stored);
    const subjectId = await this.ensureNode(statement.subject, 'concept');
    const objectId = await this.ensureNode(statement.object, 'concept');

    await this.graph.addEdge({
      id: generateId(),
      source: subjectId,
      target: objectId,
      type: 'knowledge',
      label: statement.predicate,
      weight: statement.confidence,
      properties: { statementId: id, source: statement.source },
      directed: true,
      confidence: statement.confidence,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return id;
  }

  async query(subject?: string, predicate?: string, object?: string): Promise<KnowledgeStatement[]> {
    let results = Array.from(this.statements.values());
    if (subject) results = results.filter(s => s.subject.toLowerCase().includes(subject.toLowerCase()));
    if (predicate) results = results.filter(s => s.predicate.toLowerCase().includes(predicate.toLowerCase()));
    if (object) results = results.filter(s => s.object.toLowerCase().includes(object.toLowerCase()));
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  async getRelated(subject: string, depth: number = 1): Promise<GraphPath[]> {
    const subjectNodes = await this.graph.queryNodes({ label: subject, limit: 1 });
    if (subjectNodes.length === 0) return [];
    return this.graph.traverse(subjectNodes[0].id, ['knowledge', 'related_to', 'belongs_to'], depth);
  }

  async deleteStatement(id: EntityId): Promise<void> {
    this.statements.delete(id);
  }

  async stats(): Promise<GraphStats> {
    return this.graph.stats();
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
