import { createHash } from 'node:crypto';

export const COS_GRAPH_DOCUMENT_VERSION = 'cos.graph/document/v1alpha1' as const;

export type GraphPrimitive = string | number | boolean | null;
export type GraphValue = GraphPrimitive | readonly GraphValue[] | GraphProperties;
export interface GraphProperties {
  readonly [key: string]: GraphValue;
}

export interface CanonicalGraphNode {
  readonly id: string;
  readonly type?: string;
  readonly labels: readonly string[];
  readonly properties: GraphProperties;
}

export interface CanonicalGraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type?: string;
  readonly directed: boolean;
  readonly properties: GraphProperties;
}

export interface CanonicalGraphDocument {
  readonly schema: typeof COS_GRAPH_DOCUMENT_VERSION;
  readonly graphId: string;
  readonly revision: number;
  readonly nodes: readonly CanonicalGraphNode[];
  readonly edges: readonly CanonicalGraphEdge[];
  readonly metadata: GraphProperties;
}

export interface GraphNodeInput {
  readonly id: string;
  readonly type?: string;
  readonly labels?: readonly string[];
  readonly properties?: Readonly<Record<string, unknown>>;
}

export interface GraphEdgeInput {
  readonly id?: string;
  readonly identityKey?: string;
  readonly source: string;
  readonly target: string;
  readonly type?: string;
  readonly directed?: boolean;
  readonly properties?: Readonly<Record<string, unknown>>;
}

export interface GraphDocumentInput {
  readonly graphId: string;
  readonly revision?: number;
  readonly nodes?: readonly GraphNodeInput[];
  readonly edges?: readonly GraphEdgeInput[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface GraphModelLimits {
  readonly maxNodes: number;
  readonly maxEdges: number;
  readonly maxPropertyDepth: number;
  readonly maxIdLength: number;
}

export const DEFAULT_GRAPH_MODEL_LIMITS: GraphModelLimits = Object.freeze({
  maxNodes: 1_000_000,
  maxEdges: 5_000_000,
  maxPropertyDepth: 64,
  maxIdLength: 1024,
});

function compareCanonicalText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export type GraphModelErrorCode =
  | 'INVALID_GRAPH_ID'
  | 'INVALID_REVISION'
  | 'INVALID_NODE'
  | 'INVALID_EDGE'
  | 'DUPLICATE_NODE_ID'
  | 'DUPLICATE_EDGE_ID'
  | 'DANGLING_EDGE'
  | 'GRAPH_LIMIT_EXCEEDED'
  | 'INVALID_GRAPH_VALUE';

export class GraphModelError extends Error {
  readonly code: GraphModelErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: GraphModelErrorCode, message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = 'GraphModelError';
    this.code = code;
    this.details = details;
  }
}

function assertIdentifier(value: string, field: string, limits: GraphModelLimits): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > limits.maxIdLength) {
    throw new GraphModelError(
      field === 'graphId' ? 'INVALID_GRAPH_ID' : field.startsWith('node') ? 'INVALID_NODE' : 'INVALID_EDGE',
      `${field} must be a non-empty string up to ${limits.maxIdLength} characters`,
      { field, valueLength: typeof value === 'string' ? value.length : undefined },
    );
  }
  return value;
}

function normalizeValue(value: unknown, depth: number, limits: GraphModelLimits, seen: WeakSet<object>): GraphValue {
  if (depth > limits.maxPropertyDepth) {
    throw new GraphModelError('GRAPH_LIMIT_EXCEEDED', 'Graph property nesting exceeds configured maximum', {
      maxPropertyDepth: limits.maxPropertyDepth,
    });
  }

  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new GraphModelError('INVALID_GRAPH_VALUE', 'Graph numbers must be finite', { value });
    }
    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) throw new GraphModelError('INVALID_GRAPH_VALUE', 'Cyclic graph values are not supported');
    seen.add(value);
    const normalized = value.map((entry) => normalizeValue(entry, depth + 1, limits, seen));
    seen.delete(value);
    return Object.freeze(normalized);
  }

  if (typeof value !== 'object') {
    throw new GraphModelError('INVALID_GRAPH_VALUE', 'Graph values must be JSON-like data', {
      receivedType: typeof value,
    });
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) throw new GraphModelError('INVALID_GRAPH_VALUE', 'Cyclic graph values are not supported');

  const prototype = Object.getPrototypeOf(objectValue);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new GraphModelError('INVALID_GRAPH_VALUE', 'Graph objects must be plain objects', {
      constructorName: (prototype as { constructor?: { name?: string } } | null)?.constructor?.name,
    });
  }

  seen.add(objectValue);
  const descriptors = Object.getOwnPropertyDescriptors(objectValue);
  const normalized = Object.create(null) as Record<string, GraphValue>;

  for (const key of Object.keys(descriptors).sort()) {
    const descriptor = descriptors[key];
    if (!descriptor || !('value' in descriptor)) {
      throw new GraphModelError('INVALID_GRAPH_VALUE', 'Accessors are not permitted in graph values', { key });
    }
    Object.defineProperty(normalized, key, {
      value: normalizeValue(descriptor.value, depth + 1, limits, seen),
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }

  seen.delete(objectValue);
  return Object.freeze(normalized);
}

export function normalizeGraphProperties(
  value: Readonly<Record<string, unknown>> | undefined,
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): GraphProperties {
  if (value === undefined) return Object.freeze(Object.create(null) as Record<string, GraphValue>);
  const normalized = normalizeValue(value, 0, limits, new WeakSet<object>());
  if (normalized === null || Array.isArray(normalized) || typeof normalized !== 'object') {
    throw new GraphModelError('INVALID_GRAPH_VALUE', 'Graph properties must be an object');
  }
  return normalized as GraphProperties;
}

function normalizeLabels(labels: readonly string[] | undefined, limits: GraphModelLimits): readonly string[] {
  if (!labels) return Object.freeze([]);
  const deduped = new Set<string>();
  for (const label of labels) {
    if (typeof label !== 'string' || label.length === 0 || label.length > limits.maxIdLength) {
      throw new GraphModelError('INVALID_NODE', 'Node labels must be non-empty bounded strings', { label });
    }
    deduped.add(label);
  }
  return Object.freeze(Array.from(deduped).sort(compareCanonicalText));
}

export function normalizeGraphNode(
  input: GraphNodeInput,
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): CanonicalGraphNode {
  const id = assertIdentifier(input.id, 'nodeId', limits);
  const type = input.type === undefined ? undefined : assertIdentifier(input.type, 'nodeType', limits);
  return Object.freeze({
    id,
    ...(type !== undefined ? { type } : {}),
    labels: normalizeLabels(input.labels, limits),
    properties: normalizeGraphProperties(input.properties, limits),
  });
}

function encodeCanonical(value: GraphValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(encodeCanonical).join(',')}]`;

  const objectValue = value as GraphProperties;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${encodeCanonical(objectValue[key])}`)
    .join(',')}}`;
}

export function canonicalGraphSerialize(value: unknown, limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS): string {
  const normalized = normalizeValue(value, 0, limits, new WeakSet<object>());
  return encodeCanonical(normalized);
}

export function canonicalGraphHash(value: unknown, limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS): string {
  return createHash('sha256').update(canonicalGraphSerialize(value, limits)).digest('hex');
}

export function deriveGraphEdgeId(
  input: GraphEdgeInput,
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): string {
  if (input.id !== undefined) return assertIdentifier(input.id, 'edgeId', limits);

  const identityPayload = {
    source: input.source,
    target: input.target,
    type: input.type ?? null,
    directed: input.directed ?? true,
    identityKey: input.identityKey ?? null,
  };
  return `e_${canonicalGraphHash(identityPayload, limits).slice(0, 32)}`;
}

export function normalizeGraphEdge(
  input: GraphEdgeInput,
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): CanonicalGraphEdge {
  const source = assertIdentifier(input.source, 'nodeId', limits);
  const target = assertIdentifier(input.target, 'nodeId', limits);
  const type = input.type === undefined ? undefined : assertIdentifier(input.type, 'edgeType', limits);
  return Object.freeze({
    id: deriveGraphEdgeId(input, limits),
    source,
    target,
    ...(type !== undefined ? { type } : {}),
    directed: input.directed ?? true,
    properties: normalizeGraphProperties(input.properties, limits),
  });
}

export function createGraphDocument(
  input: GraphDocumentInput,
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): CanonicalGraphDocument {
  const graphId = assertIdentifier(input.graphId, 'graphId', limits);
  const revision = input.revision ?? 0;
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new GraphModelError('INVALID_REVISION', 'Graph revision must be a non-negative safe integer', { revision });
  }

  const nodeInputs = input.nodes ?? [];
  const edgeInputs = input.edges ?? [];
  if (nodeInputs.length > limits.maxNodes || edgeInputs.length > limits.maxEdges) {
    throw new GraphModelError('GRAPH_LIMIT_EXCEEDED', 'Graph exceeds configured node or edge limits', {
      nodeCount: nodeInputs.length,
      edgeCount: edgeInputs.length,
      maxNodes: limits.maxNodes,
      maxEdges: limits.maxEdges,
    });
  }

  const nodes = nodeInputs.map((node) => normalizeGraphNode(node, limits)).sort((left, right) => compareCanonicalText(left.id, right.id));
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) throw new GraphModelError('DUPLICATE_NODE_ID', `Duplicate node id ${node.id}`, { nodeId: node.id });
    nodeIds.add(node.id);
  }

  const edges = edgeInputs.map((edge) => normalizeGraphEdge(edge, limits)).sort((left, right) => compareCanonicalText(left.id, right.id));
  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) throw new GraphModelError('DUPLICATE_EDGE_ID', `Duplicate edge id ${edge.id}`, { edgeId: edge.id });
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new GraphModelError('DANGLING_EDGE', `Edge ${edge.id} references a missing endpoint`, {
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
      });
    }
  }

  return Object.freeze({
    schema: COS_GRAPH_DOCUMENT_VERSION,
    graphId,
    revision,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    metadata: normalizeGraphProperties(input.metadata, limits),
  });
}

export function parseGraphDocument(
  value: unknown,
  limits: GraphModelLimits = DEFAULT_GRAPH_MODEL_LIMITS,
): CanonicalGraphDocument {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new GraphModelError('INVALID_GRAPH_VALUE', 'Graph document must be an object');
  }
  const record = value as Record<string, unknown>;
  if (record.schema !== COS_GRAPH_DOCUMENT_VERSION) {
    throw new GraphModelError('INVALID_GRAPH_VALUE', 'Unsupported graph document schema', { schema: record.schema });
  }
  if (!Array.isArray(record.nodes) || !Array.isArray(record.edges)) {
    throw new GraphModelError('INVALID_GRAPH_VALUE', 'Graph document nodes and edges must be arrays');
  }

  if (typeof record.graphId !== 'string') {
    throw new GraphModelError('INVALID_GRAPH_ID', 'Graph document graphId must be a string');
  }
  if (record.metadata !== undefined && (typeof record.metadata !== 'object' || record.metadata === null || Array.isArray(record.metadata))) {
    throw new GraphModelError('INVALID_GRAPH_VALUE', 'Graph document metadata must be an object');
  }

  return createGraphDocument({
    graphId: record.graphId,
    revision: typeof record.revision === 'number' ? record.revision : Number.NaN,
    nodes: record.nodes as readonly GraphNodeInput[],
    edges: record.edges as readonly GraphEdgeInput[],
    ...(record.metadata !== undefined ? { metadata: record.metadata as Readonly<Record<string, unknown>> } : {}),
  }, limits);
}

export function graphDocumentHash(document: CanonicalGraphDocument): string {
  return canonicalGraphHash(document);
}
