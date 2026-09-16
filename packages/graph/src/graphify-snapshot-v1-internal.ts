import {
  KnowledgeGraphEngine,
  type KGEntity,
  type KGRelation,
  type EntityType,
  type RelationType,
} from './level8-knowledge';
import {
  SemanticGraph,
  type SemanticNode,
  type SemanticEdge,
  type SemanticRelation,
} from './level9-semantic';
import {
  EmbeddingGraph,
  type EmbeddingNode,
} from './level10-embedding';
import {
  GraphRAGEngine,
  type Chunk,
  type GraphRAGConfig,
} from './level11-graphrag';

export const GRAPHIFY_SNAPSHOT_SCHEMA_V1 = 'graphify.snapshot.v1' as const;

export type GraphifyAuthority =
  | 'source_ref'
  | 'content_hash'
  | 'deterministic_topology'
  | 'semantic_overlay'
  | 'llm_inference';

export type GraphifyNodeKind =
  | 'file'
  | 'directory'
  | 'git'
  | 'artifact'
  | 'runtime'
  | 'model'
  | 'checkpoint'
  | 'concept'
  | 'unknown';

export interface GraphifyEvidence {
  id: string;
  authority: GraphifyAuthority;
  ref: string;
  sha256?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphifyNode {
  id: string;
  label: string;
  kind: GraphifyNodeKind;
  authority: GraphifyAuthority;
  path?: string;
  sourceRef?: string;
  sha256?: string;
  size?: number;
  evidenceIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface GraphifyEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  authority: GraphifyAuthority;
  confidence?: number;
  evidenceIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface GraphifySemanticNode {
  id: string;
  concept: string;
  type?: SemanticNode['type'];
  definition?: string;
  examples?: string[];
  embedding?: number[];
  sourceNodeIds?: string[];
  authority: GraphifyAuthority;
  evidenceIds?: string[];
}

export interface GraphifySemanticEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  strength: number;
  authority: GraphifyAuthority;
  evidenceIds?: string[];
}

export interface GraphifyChunk {
  id: string;
  text: string;
  source: string;
  embedding: number[];
  entityIds: string[];
  authority?: GraphifyAuthority;
  evidenceIds?: string[];
}

export interface GraphifySnapshotV1 {
  schemaVersion: typeof GRAPHIFY_SNAPSHOT_SCHEMA_V1;
  generatedAt: string;
  sourceRoot: string;
  producer?: {
    name: string;
    version?: string;
    metadata?: Record<string, unknown>;
  };
  evidence: GraphifyEvidence[];
  nodes: GraphifyNode[];
  edges: GraphifyEdge[];
  semantic?: {
    nodes: GraphifySemanticNode[];
    edges: GraphifySemanticEdge[];
  };
  chunks?: GraphifyChunk[];
}

export interface GraphifyProvenanceRecord {
  authority: GraphifyAuthority;
  evidenceIds: string[];
  originalType?: string;
  sourceNodeIds?: string[];
}

export interface GraphifyProjection {
  knowledge: KnowledgeGraphEngine;
  semantic: SemanticGraph;
  embeddings: EmbeddingGraph;
  graphrag: GraphRAGEngine;
  provenance: {
    nodes: Record<string, GraphifyProvenanceRecord>;
    edges: Record<string, GraphifyProvenanceRecord>;
    semanticNodes: Record<string, GraphifyProvenanceRecord>;
    semanticEdges: Record<string, GraphifyProvenanceRecord>;
    chunks: Record<string, GraphifyProvenanceRecord>;
  };
  diagnostics: string[];
}

const AUTHORITIES = new Set<GraphifyAuthority>([
  'source_ref',
  'content_hash',
  'deterministic_topology',
  'semantic_overlay',
  'llm_inference',
]);

const SEMANTIC_RELATIONS = new Set<SemanticRelation>([
  'is_a',
  'has_property',
  'related_to',
  'part_of',
  'opposite_of',
  'causes',
  'requires',
  'similar',
  'dissimilar',
]);

const KG_RELATIONS = new Set<RelationType>([
  'created',
  'uses',
  'part_of',
  'subclass_of',
  'located_in',
  'produced_by',
  'has',
  'related_to',
]);

const DEFAULT_RAG_CONFIG: GraphRAGConfig = {
  topK: 5,
  walkDepth: 2,
  similarityWeight: 0.6,
};

export class GraphifyValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid Graphify Snapshot V1:\n${errors.map(error => `- ${error}`).join('\n')}`);
    this.name = 'GraphifyValidationError';
    this.errors = [...errors];
  }
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function isFiniteVector(vector: number[]): boolean {
  return vector.length > 0 && vector.every(value => Number.isFinite(value));
}

function duplicateIds<T extends { id: string }>(values: T[], label: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (!value.id) errors.push(`${label} has an empty ID`);
    if (seen.has(value.id)) errors.push(`Duplicate ${label} ID: ${value.id}`);
    seen.add(value.id);
  }
}

function validateEvidenceRefs(
  owner: string,
  evidenceIds: string[] | undefined,
  knownEvidence: Set<string>,
  errors: string[],
): void {
  for (const evidenceId of evidenceIds ?? []) {
    if (!knownEvidence.has(evidenceId)) errors.push(`${owner} references unknown evidence ${evidenceId}`);
  }
}

function validateVectorDimensions(
  entries: Array<{ id: string; embedding?: number[] }>,
  label: string,
  errors: string[],
): void {
  let expected: number | null = null;
  for (const entry of entries) {
    if (!entry.embedding) continue;
    if (!isFiniteVector(entry.embedding)) {
      errors.push(`${label} ${entry.id} embedding must contain one or more finite numbers`);
      continue;
    }
    if (expected === null) expected = entry.embedding.length;
    if (entry.embedding.length !== expected) {
      errors.push(`${label} ${entry.id} embedding dimension ${entry.embedding.length} does not match ${expected}`);
    }
  }
}

function validateJsonValue(value: unknown, path: string, seen: WeakSet<object>, errors: string[]): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) errors.push(`${path} contains a non-finite number`);
    return;
  }
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    errors.push(`${path} contains a non-JSON value of type ${typeof value}`);
    return;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) validateJsonValue(value[index], `${path}[${index}]`, seen, errors);
    return;
  }
  if (typeof value === 'object') {
    if (seen.has(value)) {
      errors.push(`${path} contains a circular reference`);
      return;
    }
    seen.add(value);
    for (const [key, child] of Object.entries(value)) validateJsonValue(child, `${path}.${key}`, seen, errors);
    seen.delete(value);
  }
}

export function validateGraphifySnapshot(snapshot: GraphifySnapshotV1): string[] {
  const errors: string[] = [];

  if (snapshot.schemaVersion !== GRAPHIFY_SNAPSHOT_SCHEMA_V1) {
    errors.push(`Unsupported schemaVersion: ${String(snapshot.schemaVersion)}`);
  }
  if (!snapshot.sourceRoot || typeof snapshot.sourceRoot !== 'string') errors.push('sourceRoot must be a non-empty string');
  if (!snapshot.generatedAt || !Number.isFinite(Date.parse(snapshot.generatedAt))) errors.push('generatedAt must be a valid timestamp');

  duplicateIds(snapshot.evidence, 'evidence', errors);
  duplicateIds(snapshot.nodes, 'node', errors);
  duplicateIds(snapshot.edges, 'edge', errors);
  duplicateIds(snapshot.semantic?.nodes ?? [], 'semantic node', errors);
  duplicateIds(snapshot.semantic?.edges ?? [], 'semantic edge', errors);
  duplicateIds(snapshot.chunks ?? [], 'chunk', errors);

  const evidenceIds = new Set(snapshot.evidence.map(evidence => evidence.id));
  const nodeIds = new Set(snapshot.nodes.map(node => node.id));
  const semanticNodeIds = new Set((snapshot.semantic?.nodes ?? []).map(node => node.id));

  for (const evidence of snapshot.evidence) {
    if (!AUTHORITIES.has(evidence.authority)) errors.push(`Evidence ${evidence.id} has invalid authority ${String(evidence.authority)}`);
    if (!evidence.ref) errors.push(`Evidence ${evidence.id} ref must be non-empty`);
    if (evidence.sha256 && !isSha256(evidence.sha256)) errors.push(`Evidence ${evidence.id} has malformed SHA-256`);
  }

  for (const node of snapshot.nodes) {
    if (!node.label) errors.push(`Node ${node.id} label must be non-empty`);
    if (!AUTHORITIES.has(node.authority)) errors.push(`Node ${node.id} has invalid authority ${String(node.authority)}`);
    if (node.sha256 && !isSha256(node.sha256)) errors.push(`Node ${node.id} has malformed SHA-256`);
    if (node.size !== undefined && (!Number.isSafeInteger(node.size) || node.size < 0)) errors.push(`Node ${node.id} size must be a non-negative safe integer`);
    validateEvidenceRefs(`Node ${node.id}`, node.evidenceIds, evidenceIds, errors);
  }

  for (const edge of snapshot.edges) {
    if (!nodeIds.has(edge.source)) errors.push(`Edge ${edge.id} references unknown source ${edge.source}`);
    if (!nodeIds.has(edge.target)) errors.push(`Edge ${edge.id} references unknown target ${edge.target}`);
    if (!edge.type) errors.push(`Edge ${edge.id} type must be non-empty`);
    if (!AUTHORITIES.has(edge.authority)) errors.push(`Edge ${edge.id} has invalid authority ${String(edge.authority)}`);
    if (edge.confidence !== undefined && (!Number.isFinite(edge.confidence) || edge.confidence < 0 || edge.confidence > 1)) {
      errors.push(`Edge ${edge.id} confidence must be between 0 and 1`);
    }
    validateEvidenceRefs(`Edge ${edge.id}`, edge.evidenceIds, evidenceIds, errors);
  }

  const semanticNodes = snapshot.semantic?.nodes ?? [];
  const semanticEdges = snapshot.semantic?.edges ?? [];
  validateVectorDimensions(semanticNodes, 'Semantic node', errors);

  for (const node of semanticNodes) {
    if (!node.concept) errors.push(`Semantic node ${node.id} concept must be non-empty`);
    if (!AUTHORITIES.has(node.authority)) errors.push(`Semantic node ${node.id} has invalid authority ${String(node.authority)}`);
    for (const sourceNodeId of node.sourceNodeIds ?? []) {
      if (!nodeIds.has(sourceNodeId)) errors.push(`Semantic node ${node.id} references unknown source node ${sourceNodeId}`);
    }
    validateEvidenceRefs(`Semantic node ${node.id}`, node.evidenceIds, evidenceIds, errors);
  }

  for (const edge of semanticEdges) {
    if (!semanticNodeIds.has(edge.source)) errors.push(`Semantic edge ${edge.id} references unknown source ${edge.source}`);
    if (!semanticNodeIds.has(edge.target)) errors.push(`Semantic edge ${edge.id} references unknown target ${edge.target}`);
    if (!edge.relation) errors.push(`Semantic edge ${edge.id} relation must be non-empty`);
    if (!Number.isFinite(edge.strength) || edge.strength < 0 || edge.strength > 1) {
      errors.push(`Semantic edge ${edge.id} strength must be between 0 and 1`);
    }
    if (!AUTHORITIES.has(edge.authority)) errors.push(`Semantic edge ${edge.id} has invalid authority ${String(edge.authority)}`);
    validateEvidenceRefs(`Semantic edge ${edge.id}`, edge.evidenceIds, evidenceIds, errors);
  }

  const chunks = snapshot.chunks ?? [];
  validateVectorDimensions(chunks, 'Chunk', errors);
  for (const chunk of chunks) {
    if (!chunk.text) errors.push(`Chunk ${chunk.id} text must be non-empty`);
    if (!chunk.source) errors.push(`Chunk ${chunk.id} source must be non-empty`);
    if (!isFiniteVector(chunk.embedding)) errors.push(`Chunk ${chunk.id} embedding must contain one or more finite numbers`);
    for (const entityId of chunk.entityIds) {
      if (!nodeIds.has(entityId)) errors.push(`Chunk ${chunk.id} references unknown entity ${entityId}`);
    }
    if (chunk.authority && !AUTHORITIES.has(chunk.authority)) errors.push(`Chunk ${chunk.id} has invalid authority ${String(chunk.authority)}`);
    validateEvidenceRefs(`Chunk ${chunk.id}`, chunk.evidenceIds, evidenceIds, errors);
  }

  validateJsonValue(snapshot, '$', new WeakSet<object>(), errors);
  return Array.from(new Set(errors));
}

function mapEntityType(kind: GraphifyNodeKind): EntityType {
  switch (kind) {
    case 'model': return 'tech';
    case 'artifact': return 'product';
    case 'checkpoint': return 'event';
    case 'directory':
    case 'git':
    case 'runtime': return 'system';
    case 'file':
    case 'concept':
    case 'unknown': return 'concept';
  }
}

function mapRelationType(type: string): RelationType {
  if (KG_RELATIONS.has(type as RelationType)) return type as RelationType;
  switch (type) {
    case 'contains': return 'has';
    case 'depends_on': return 'uses';
    case 'generated_by':
    case 'derived_from': return 'produced_by';
    case 'member_of': return 'part_of';
    default: return 'related_to';
  }
}

function mapSemanticRelation(relation: string): SemanticRelation {
  return SEMANTIC_RELATIONS.has(relation as SemanticRelation) ? relation as SemanticRelation : 'related_to';
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function toStringProperties(entries: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) continue;
    if (typeof value === 'string') result[key] = value;
    else if (typeof value === 'number' || typeof value === 'boolean') result[key] = String(value);
    else result[key] = stableJson(value);
  }
  return result;
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) result[key] = canonicalValue(record[key]);
    return result;
  }
  throw new TypeError(`Cannot canonicalize non-JSON value of type ${typeof value}`);
}

export function canonicalizeGraphifySnapshot(snapshot: GraphifySnapshotV1): string {
  const errors = validateGraphifySnapshot(snapshot);
  if (errors.length) throw new GraphifyValidationError(errors);

  const copy = structuredClone(snapshot);
  copy.evidence.sort((a, b) => a.id.localeCompare(b.id));
  copy.nodes.sort((a, b) => a.id.localeCompare(b.id));
  copy.edges.sort((a, b) => a.id.localeCompare(b.id));
  copy.semantic?.nodes.sort((a, b) => a.id.localeCompare(b.id));
  copy.semantic?.edges.sort((a, b) => a.id.localeCompare(b.id));
  copy.chunks?.sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(canonicalValue(copy));
}

export function projectGraphifySnapshot(snapshot: GraphifySnapshotV1): GraphifyProjection {
  const errors = validateGraphifySnapshot(snapshot);
  if (errors.length) throw new GraphifyValidationError(errors);

  const provenance: GraphifyProjection['provenance'] = {
    nodes: {},
    edges: {},
    semanticNodes: {},
    semanticEdges: {},
    chunks: {},
  };

  const entities: KGEntity[] = snapshot.nodes.map(node => {
    provenance.nodes[node.id] = {
      authority: node.authority,
      evidenceIds: [...(node.evidenceIds ?? [])],
    };
    return {
      id: node.id,
      name: node.label,
      type: mapEntityType(node.kind),
      description: node.path ?? node.sourceRef,
      properties: toStringProperties({
        kind: node.kind,
        authority: node.authority,
        path: node.path,
        sourceRef: node.sourceRef,
        sha256: node.sha256,
        size: node.size,
        evidenceIds: node.evidenceIds ?? [],
        metadata: node.metadata ?? {},
      }),
    };
  });

  const relations: KGRelation[] = snapshot.edges.map(edge => {
    provenance.edges[edge.id] = {
      authority: edge.authority,
      evidenceIds: [...(edge.evidenceIds ?? [])],
      originalType: edge.type,
    };
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: mapRelationType(edge.type),
      confidence: edge.confidence,
      properties: toStringProperties({
        graphifyRelation: edge.type,
        authority: edge.authority,
        evidenceIds: edge.evidenceIds ?? [],
        metadata: edge.metadata ?? {},
      }),
    };
  });

  const knowledge = KnowledgeGraphEngine.fromJSON({ entities, relations });

  const semanticNodes: SemanticNode[] = (snapshot.semantic?.nodes ?? []).map(node => {
    provenance.semanticNodes[node.id] = {
      authority: node.authority,
      evidenceIds: [...(node.evidenceIds ?? [])],
      sourceNodeIds: [...(node.sourceNodeIds ?? [])],
    };
    return {
      id: node.id,
      concept: node.concept,
      name: node.concept,
      type: node.type ?? 'entity',
      definition: node.definition,
      examples: node.examples ? [...node.examples] : undefined,
      embedding: node.embedding ? [...node.embedding] : undefined,
      concepts: node.sourceNodeIds ? [...node.sourceNodeIds] : [],
    };
  });

  const semanticEdges: SemanticEdge[] = (snapshot.semantic?.edges ?? []).map(edge => {
    provenance.semanticEdges[edge.id] = {
      authority: edge.authority,
      evidenceIds: [...(edge.evidenceIds ?? [])],
      originalType: edge.relation,
    };
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      relation: mapSemanticRelation(edge.relation),
      strength: edge.strength,
    };
  });

  const semantic = SemanticGraph.fromJSON({ nodes: semanticNodes, edges: semanticEdges });

  const embeddingNodes: EmbeddingNode[] = (snapshot.semantic?.nodes ?? [])
    .filter(node => node.embedding !== undefined)
    .map(node => ({
      id: node.id,
      label: node.concept,
      vector: [...node.embedding!],
      source: node.sourceNodeIds?.[0] ?? node.id,
      embedding: [...node.embedding!],
      metadata: {
        authority: node.authority,
        evidenceIds: [...(node.evidenceIds ?? [])],
        sourceNodeIds: [...(node.sourceNodeIds ?? [])],
      },
    }));

  const embeddings = EmbeddingGraph.fromJSON({ nodes: embeddingNodes, edges: [] });

  const chunks: Chunk[] = (snapshot.chunks ?? []).map(chunk => {
    provenance.chunks[chunk.id] = {
      authority: chunk.authority ?? 'semantic_overlay',
      evidenceIds: [...(chunk.evidenceIds ?? [])],
      sourceNodeIds: [...chunk.entityIds],
    };
    return {
      id: chunk.id,
      text: chunk.text,
      source: chunk.source,
      embedding: [...chunk.embedding],
      entities: [...chunk.entityIds],
    };
  });

  const graphrag = GraphRAGEngine.fromJSON({
    chunks,
    entities: snapshot.nodes.map(node => ({ id: node.id, name: node.label, type: node.kind })),
    relations: snapshot.edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target, type: edge.type })),
    config: DEFAULT_RAG_CONFIG,
  });

  const diagnostics = [
    ...knowledge.validate().map(error => `L8: ${error}`),
    ...semantic.validate().map(error => `L9: ${error}`),
    ...embeddings.validate().map(error => `L10: ${error}`),
    ...graphrag.validate().map(error => `L11: ${error}`),
  ];

  return { knowledge, semantic, embeddings, graphrag, provenance, diagnostics };
}
