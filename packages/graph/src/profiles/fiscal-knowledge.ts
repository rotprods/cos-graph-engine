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
  | 'PART_OF'
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
    case 'PART_OF':
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

interface FiscalSemanticTypeDefinition {
  id: FiscalKnowledgeNodeType;
  parent: string;
  definition: string;
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

  const types: FiscalSemanticTypeDefinition[] = [
    { id: 'EvidenceArtifact', parent: 'fiscal:evidence', definition: 'Evidence artifact' },
    { id: 'EvidencePage', parent: 'fiscal:evidence', definition: 'Evidence page/chunk' },
    { id: 'Claim', parent: 'fiscal:assertion', definition: 'Unconfirmed assertion' },
    { id: 'Fact', parent: 'fiscal:assertion', definition: 'Evidence-promoted assertion' },
    { id: 'Hypothesis', parent: 'fiscal:assertion', definition: 'Scenario or hypothesis' },
    { id: 'TaxReturn', parent: 'fiscal:obligation', definition: 'Tax return / filed model' },
    { id: 'TaxObligation', parent: 'fiscal:obligation', definition: 'Tax obligation' },
    { id: 'TaxRule', parent: 'fiscal:obligation', definition: 'Tax rule' },
    { id: 'Invoice', parent: 'fiscal:financial-object', definition: 'Invoice' },
    { id: 'Payment', parent: 'fiscal:financial-object', definition: 'Payment' },
    { id: 'TaxLot', parent: 'fiscal:financial-object', definition: 'Tax lot' },
    { id: 'Asset', parent: 'fiscal:financial-object', definition: 'Asset' },
    { id: 'Account', parent: 'fiscal:financial-object', definition: 'Account' },
    { id: 'Counterparty', parent: 'fiscal:actor', definition: 'Counterparty' },
    { id: 'Authority', parent: 'fiscal:actor', definition: 'Tax/social-security authority' },
    { id: 'Adviser', parent: 'fiscal:actor', definition: 'Professional adviser' },
    { id: 'Agent', parent: 'fiscal:actor', definition: 'Runtime agent' },
    { id: 'Tool', parent: 'fiscal:actor', definition: 'Connector/tool' },
    { id: 'Task', parent: 'fiscal:governance', definition: 'Recovery/execution task' },
    { id: 'Decision', parent: 'fiscal:governance', definition: 'Decision' },
    { id: 'Risk', parent: 'fiscal:governance', definition: 'Risk' },
    { id: 'Incident', parent: 'fiscal:governance', definition: 'Incident' },
    { id: 'WorkflowRun', parent: 'fiscal:governance', definition: 'Workflow run' },
    { id: 'Event', parent: 'fiscal:governance', definition: 'Event' },
  ];

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
