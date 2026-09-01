import { GQLEngine, type GQLNode } from '../graphql';
import type {
  FiscalAuthorityRank,
  FiscalKnowledgeLink,
  FiscalKnowledgeNode,
  FiscalKnowledgeNodeType,
  FiscalTruthClass,
} from './fiscal-knowledge';

export const FISCAL_GRAPHQL_SCHEMA_EXTENSION = `
# Fiscal / Financial domain read extension
# Mutations that promote legal truth remain policy-gated outside this read gateway.

extend type Query {
  fiscalNode(id: ID!): FiscalNode
  fiscalSearch(filter: FiscalNodeFilter): [FiscalNode!]!
  fiscalObligations(taxYear: Int, period: String, state: String): [FiscalNode!]!
  fiscalEvidence(nodeId: ID!): [FiscalNode!]!
  fiscalBlockers(nodeId: ID!): [FiscalNode!]!
}

type FiscalNode {
  id: ID!
  name: String
  fiscalType: String!
  truthClass: String
  authorityRank: String
  taxYear: Int
  period: String
  validFrom: String
  validTo: String
  sensitivity: String
  metadata: JSON
}

input FiscalNodeFilter {
  fiscalType: String
  truthClass: String
  authorityRank: String
  taxYear: Int
  period: String
  validAt: String
  sensitivity: String
}
`;

export interface FiscalNodeFilter {
  fiscalType?: FiscalKnowledgeNodeType;
  truthClass?: FiscalTruthClass;
  authorityRank?: FiscalAuthorityRank;
  taxYear?: number;
  period?: string;
  validAt?: string;
  sensitivity?: 'PUBLIC' | 'INTERNAL' | 'RESTRICTED_FINANCIAL';
}

export interface FiscalReadNode {
  id: string;
  name?: string;
  fiscalType?: string;
  truthClass?: string;
  authorityRank?: string;
  taxYear?: number;
  period?: string;
  validFrom?: string;
  validTo?: string;
  sensitivity?: string;
  metadata: Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value);
}

function asNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isValidAt(metadata: Record<string, unknown>, validAt?: string): boolean {
  if (!validAt) return true;
  const from = asString(metadata.validFrom);
  const to = asString(metadata.validTo);
  if (from && validAt < from) return false;
  if (to && validAt > to) return false;
  return true;
}

function toFiscalReadNode(node: GQLNode): FiscalReadNode {
  const metadata = { ...(node.metadata ?? {}) };
  return {
    id: node.id,
    name: node.label,
    fiscalType: asString(metadata.fiscalType),
    truthClass: asString(metadata.truthClass),
    authorityRank: asString(metadata.authorityRank),
    taxYear: asNumber(metadata.taxYear),
    period: asString(metadata.period),
    validFrom: asString(metadata.validFrom),
    validTo: asString(metadata.validTo),
    sensitivity: asString(metadata.sensitivity),
    metadata,
  };
}

/**
 * Read-only fiscal GraphQL gateway built on COS GQLEngine.
 *
 * It intentionally does not expose raw GQLEngine mutations. Legal-truth promotion
 * belongs behind fiscal policy/event gates, not generic GraphQL mutations.
 */
export class FiscalGraphQLGateway {
  private readonly core = new GQLEngine();
  private readonly graphId: string;

  constructor(
    nodes: readonly FiscalKnowledgeNode[],
    links: readonly FiscalKnowledgeLink[],
    graphId = 'fiscal-knowledge',
  ) {
    this.graphId = graphId;
    this.load(nodes, links);
  }

  getSchema(): string {
    return `${this.core.getSchema()}\n${FISCAL_GRAPHQL_SCHEMA_EXTENSION}`;
  }

  getNode(id: string): FiscalReadNode | undefined {
    const node = this.core.getNode(8, id);
    return node ? toFiscalReadNode(node) : undefined;
  }

  search(filter: FiscalNodeFilter = {}): FiscalReadNode[] {
    const graph = this.core.getGraph(8, this.graphId);
    if (!graph) return [];

    return graph.nodes
      .map(toFiscalReadNode)
      .filter(node => {
        if (filter.fiscalType && node.fiscalType !== filter.fiscalType) return false;
        if (filter.truthClass && node.truthClass !== filter.truthClass) return false;
        if (filter.authorityRank && node.authorityRank !== filter.authorityRank) return false;
        if (filter.taxYear !== undefined && node.taxYear !== filter.taxYear) return false;
        if (filter.period && node.period !== filter.period) return false;
        if (filter.sensitivity && node.sensitivity !== filter.sensitivity) return false;
        if (!isValidAt(node.metadata, filter.validAt)) return false;
        return true;
      });
  }

  obligations(filter: { taxYear?: number; period?: string; state?: string } = {}): FiscalReadNode[] {
    return this.search({ fiscalType: 'TaxObligation', taxYear: filter.taxYear, period: filter.period })
      .filter(node => !filter.state || String(node.metadata.state ?? '') === filter.state);
  }

  evidenceFor(nodeId: string): FiscalReadNode[] {
    return this.neighboursByRelation(nodeId, 'EVIDENCED_BY');
  }

  blockers(nodeId: string): FiscalReadNode[] {
    return this.neighboursByRelation(nodeId, 'BLOCKED_BY');
  }

  execute(operation: string, variables: Record<string, unknown> = {}): Record<string, unknown> {
    switch (operation.trim()) {
      case 'fiscalNode':
        return { fiscalNode: this.getNode(String(variables.id ?? '')) ?? null };
      case 'fiscalSearch':
        return { fiscalSearch: this.search((variables.filter ?? {}) as FiscalNodeFilter) };
      case 'fiscalObligations':
        return {
          fiscalObligations: this.obligations({
            taxYear: asNumber(variables.taxYear),
            period: asString(variables.period),
            state: asString(variables.state),
          }),
        };
      case 'fiscalEvidence':
        return { fiscalEvidence: this.evidenceFor(String(variables.nodeId ?? '')) };
      case 'fiscalBlockers':
        return { fiscalBlockers: this.blockers(String(variables.nodeId ?? '')) };
      case 'health':
      case 'levels':
      case 'graphStats':
      case 'graph':
      case 'node':
      case 'search':
      case 'graphs':
        return this.core.execute(operation, variables);
      default:
        throw new Error(`Unsupported read-only fiscal GraphQL operation: ${operation}`);
    }
  }

  private load(nodes: readonly FiscalKnowledgeNode[], links: readonly FiscalKnowledgeLink[]): void {
    for (const node of nodes) {
      const result = this.core.addNode(8, this.graphId, {
        id: node.id,
        label: node.name,
        type: node.type,
        metadata: {
          fiscalType: node.type,
          truthClass: node.truthClass,
          authorityRank: node.authorityRank,
          taxYear: node.taxYear,
          period: node.period,
          eventTime: node.eventTime,
          observedAt: node.observedAt,
          validFrom: node.validFrom,
          validTo: node.validTo,
          sourceIds: node.sourceIds,
          sensitivity: node.sensitivity,
          ...node.properties,
        },
      });
      if (!result.success) throw new Error(result.error ?? `Unable to load fiscal node ${node.id}`);
    }

    for (const link of links) {
      const result = this.core.addEdge(8, this.graphId, {
        source: link.source,
        target: link.target,
        label: link.relation,
        weight: link.confidence,
      });
      if (!result.success) throw new Error(result.error ?? `Unable to load fiscal link ${link.source}->${link.target}`);
    }
  }

  private neighboursByRelation(nodeId: string, relation: string): FiscalReadNode[] {
    const graph = this.core.getGraph(8, this.graphId);
    if (!graph) return [];
    const ids = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.label !== relation) continue;
      if (edge.source === nodeId) ids.add(edge.target);
      if (edge.target === nodeId) ids.add(edge.source);
    }
    return [...ids]
      .map(id => this.core.getNode(8, id))
      .filter((node): node is GQLNode => Boolean(node))
      .map(toFiscalReadNode);
  }
}
