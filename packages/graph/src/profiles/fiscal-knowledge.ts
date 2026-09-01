import { generateId } from '@cos/core';
import {
  KnowledgeGraphEngine,
  type EntityType,
  type KGEntity,
  type KGRelation,
  type RelationType,
} from '../level8-knowledge';
import {
  SemanticGraph,
  type SemanticNode,
  type SemanticEdge,
} from '../level9-semantic';

export type FiscalKnowledgeNodeType =
  | 'EvidenceArtifact'
  | 'EvidencePage'
  | 'Claim'
  | 'Fact'
  | 'Hypothesis'
  | 'Invoice'
  | 'Payment'
  | 'TaxReturn'
  | 'TaxObligation'
  | 'TaxRule'
  | 'TaxLot'
  | 'Asset'
  | 'Account'
  | 'Counterparty'
  | 'Authority'
  | 'Adviser'
  | 'Task'
  | 'Decision'
  | 'Risk'
  | 'Incident'
  | 'Agent'
  | 'Tool'
  | 'WorkflowRun'
  | 'Event';

export type FiscalKnowledgeRelation =
  | 'EVIDENCED_BY'
  | 'DERIVED_FROM'
  | 'CONTRADICTS'
  | 'SUPERSEDES'
  | 'AFFECTS_TAX_YEAR'
  | 'FILED_AS'
  | 'PAID_BY'
  | 'BLOCKED_BY'
  | 'REQUIRES'
  | 'CALCULATED_FROM'
  | 'CONSUMES_LOT'
  | 'OWNED_BY'
  | 'HELD_AT'
  | 'REVIEWED_BY'
  | 'APPROVED_BY'
  | 'EXECUTED_BY'
  | 'CALLED_TOOL'
  | 'PRODUCED_EVENT'
  | 'RELATED_TO';

export type FiscalTruthClass =
  | 'CONFIRMED'
  | 'RECONSTRUCTED'
  | 'PRELIMINARY'
  | 'REVIEW'
  | 'SCENARIO'
  | 'BLOCKED';

export type FiscalAuthorityRank =
  | '1_FILED_OR_OFFICIAL_ASSESSMENT'
  | '2_OFFICIAL_BANK_BROKER_STATEMENT'
  | '3_CONTRACT_INVOICE_RECEIPT'
  | '4_SIGNED_PROFESSIONAL_MEMO'
  | '5_RECONSTRUCTED_LEDGER'
  | '6_USER_REPORTED'
  | '7_HYPOTHESIS';

export interface FiscalKnowledgeNode {
  id: string;
  name: string;
  type: FiscalKnowledgeNodeType;
  aliases?: string[];
  description?: string;
  truthClass?: FiscalTruthClass;
  authorityRank?: FiscalAuthorityRank;
  taxYear?: number;
  period?: string;
  eventTime?: string;
  observedAt?: string;
  validFrom?: string;
  validTo?: string;
  sourceIds?: string[];
  sensitivity?: 'PUBLIC' | 'INTERNAL' | 'RESTRICTED_FINANCIAL';
  properties?: Record<string, string | number | boolean | null | undefined>;
}

export interface FiscalKnowledgeLink {
  id?: string;
  source: string;
  target: string;
  relation: FiscalKnowledgeRelation;
  confidence?: number;
  sourceId?: string;
  eventTime?: string;
  validFrom?: string;
  validTo?: string;
  properties?: Record<string, string | number | boolean | null | undefined>;
}

export interface FiscalKnowledgeProjection {
  knowledge: KnowledgeGraphEngine;
  semantic: SemanticGraph;
}

function toStringProperties(input: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    output[key] = value === null ? 'null' : String(value);
  }
  return output;
}

function mapEntityType(type: FiscalKnowledgeNodeType): EntityType {
  if (type === 'Authority' || type === 'Adviser' || type === 'Counterparty') return 'org';
  if (type === 'Agent') return 'person';
  if (type === 'Account' || type === 'Tool' || type === 'WorkflowRun') return 'system';
  if (type === 'Asset') return 'product';
  if (type === 'Event' || type === 'Incident' || type === 'Payment' || type === 'TaxReturn') return 'event';
  return 'concept';
}

function mapRelationType(relation: FiscalKnowledgeRelation): RelationType {
  switch (relation) {
    case 'OWNED_BY':
    case 'HELD_AT':
    case 'PART_OF' as FiscalKnowledgeRelation:
      return 'part_of';
    case 'EXECUTED_BY':
    case 'REVIEWED_BY':
    case 'APPROVED_BY':
      return 'produced_by';
    case 'CALLED_TOOL':
    case 'REQUIRES':
    case 'CALCULATED_FROM':
    case 'DERIVED_FROM':
      return 'uses';
    case 'EVIDENCED_BY':
    case 'AFFECTS_TAX_YEAR':
    case 'FILED_AS':
    case 'PAID_BY':
    case 'BLOCKED_BY':
    case 'CONSUMES_LOT':
    case 'PRODUCED_EVENT':
    case 'CONTRADICTS':
    case 'SUPERSEDES':
    case 'RELATED_TO':
    default:
      return 'related_to';
  }
}

function nodeProperties(node: FiscalKnowledgeNode): Record<string, string> {
  return toStringProperties({
    fiscalType: node.type,
    truthClass: node.truthClass,
    authorityRank: node.authorityRank,
    taxYear: node.taxYear,
    period: node.period,
    eventTime: node.eventTime,
    observedAt: node.observedAt,
    validFrom: node.validFrom,
    validTo: node.validTo,
    sourceIds: node.sourceIds?.join('|'),
    sensitivity: node.sensitivity,
    ...node.properties,
  });
}

function linkProperties(link: FiscalKnowledgeLink): Record<string, string> {
  return toStringProperties({
    fiscalRelation: link.relation,
    eventTime: link.eventTime,
    validFrom: link.validFrom,
    validTo: link.validTo,
    ...link.properties,
  });
}

export function projectFiscalKnowledge(
  nodes: readonly FiscalKnowledgeNode[],
  links: readonly FiscalKnowledgeLink[],
): FiscalKnowledgeProjection {
  const knowledge = new KnowledgeGraphEngine();
  const semantic = buildFiscalSemanticOntology();

  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) throw new Error(`Duplicate fiscal knowledge node ID: ${node.id}`);
    ids.add(node.id);

    const kgEntity: KGEntity = {
      id: node.id,
      name: node.name,
      type: mapEntityType(node.type),
      aliases: node.aliases,
      description: node.description,
      properties: nodeProperties(node),
    };
    knowledge.addEntity(kgEntity);
  }

  for (const link of links) {
    if (!ids.has(link.source)) throw new Error(`Unknown fiscal relation source: ${link.source}`);
    if (!ids.has(link.target)) throw new Error(`Unknown fiscal relation target: ${link.target}`);

    const relation: KGRelation = {
      id: link.id ?? generateId(),
      source: link.source,
      target: link.target,
      type: mapRelationType(link.relation),
      confidence: link.confidence,
      sourceDoc: link.sourceId,
      properties: linkProperties(link),
    };
    knowledge.addRelation(relation);
  }

  const errors = knowledge.validate();
  if (errors.length) throw new Error(`Invalid fiscal knowledge projection: ${errors.join('; ')}`);

  return { knowledge, semantic };
}

export function buildFiscalSemanticOntology(): SemanticGraph {
  const semantic = new SemanticGraph();

  const classes: Array<{ id: string; concept: string; definition: string }> = [
    { id: 'fiscal:entity', concept: 'Fiscal Entity', definition: 'Root class for fiscal/financial domain entities' },
    { id: 'fiscal:evidence', concept: 'Evidence', definition: 'Primary or derived evidence artifact' },
    { id: 'fiscal:assertion', concept: 'Assertion', definition: 'Claim, fact or hypothesis' },
    { id: 'fiscal:obligation', concept: 'Tax Obligation', definition: 'Legally or operationally required fiscal obligation' },
    { id: 'fiscal:financial-object', concept: 'Financial Object', definition: 'Invoice, payment, asset, debt or tax lot' },
    { id: 'fiscal:actor', concept: 'Actor', definition: 'Person, legal entity, authority, adviser, agent or tool' },
    { id: 'fiscal:governance', concept: 'Governance Object', definition: 'Task, decision, risk, incident or workflow' },
  ];

  for (const c of classes) {
    semantic.addNode({ id: c.id, concept: c.concept, type: 'class', definition: c.definition });
  }

  const types: Array<{ id: string; parent: string; definition: string }> = [
    ['EvidenceArtifact', 'fiscal:evidence', 'Evidence artifact'] as any,
    ['EvidencePage', 'fiscal:evidence', 'Evidence page/chunk'] as any,
    ['Claim', 'fiscal:assertion', 'Unconfirmed assertion'] as any,
    ['Fact', 'fiscal:assertion', 'Evidence-promoted assertion'] as any,
    ['Hypothesis', 'fiscal:assertion', 'Scenario or hypothesis'] as any,
    ['TaxReturn', 'fiscal:obligation', 'Tax return / filed model'] as any,
    ['TaxObligation', 'fiscal:obligation', 'Tax obligation'] as any,
    ['TaxRule', 'fiscal:obligation', 'Tax rule'] as any,
    ['Invoice', 'fiscal:financial-object', 'Invoice'] as any,
    ['Payment', 'fiscal:financial-object', 'Payment'] as any,
    ['TaxLot', 'fiscal:financial-object', 'Tax lot'] as any,
    ['Asset', 'fiscal:financial-object', 'Asset'] as any,
    ['Account', 'fiscal:financial-object', 'Account'] as any,
    ['Counterparty', 'fiscal:actor', 'Counterparty'] as any,
    ['Authority', 'fiscal:actor', 'Tax/social-security authority'] as any,
    ['Adviser', 'fiscal:actor', 'Professional adviser'] as any,
    ['Agent', 'fiscal:actor', 'Runtime agent'] as any,
    ['Tool', 'fiscal:actor', 'Connector/tool'] as any,
    ['Task', 'fiscal:governance', 'Recovery/execution task'] as any,
    ['Decision', 'fiscal:governance', 'Decision'] as any,
    ['Risk', 'fiscal:governance', 'Risk'] as any,
    ['Incident', 'fiscal:governance', 'Incident'] as any,
    ['WorkflowRun', 'fiscal:governance', 'Workflow run'] as any,
    ['Event', 'fiscal:governance', 'Event'] as any,
  ].map(([id, parent, definition]) => ({ id, parent, definition }));

  for (const t of types) {
    semantic.addNode({ id: `fiscal:type:${t.id}`, concept: t.id, type: 'class', definition: t.definition });
    semantic.addEdge({
      id: generateId(),
      source: `fiscal:type:${t.id}`,
      target: t.parent,
      relation: 'is_a',
      strength: 1,
    });
  }

  const rootEdges: SemanticEdge[] = [
    { id: generateId(), source: 'fiscal:evidence', target: 'fiscal:entity', relation: 'is_a', strength: 1 },
    { id: generateId(), source: 'fiscal:assertion', target: 'fiscal:entity', relation: 'is_a', strength: 1 },
    { id: generateId(), source: 'fiscal:obligation', target: 'fiscal:entity', relation: 'is_a', strength: 1 },
    { id: generateId(), source: 'fiscal:financial-object', target: 'fiscal:entity', relation: 'is_a', strength: 1 },
    { id: generateId(), source: 'fiscal:actor', target: 'fiscal:entity', relation: 'is_a', strength: 1 },
    { id: generateId(), source: 'fiscal:governance', target: 'fiscal:entity', relation: 'is_a', strength: 1 },
  ];
  for (const edge of rootEdges) semantic.addEdge(edge);

  const errors = semantic.validate();
  if (errors.length) throw new Error(`Invalid fiscal semantic ontology: ${errors.join('; ')}`);
  return semantic;
}
