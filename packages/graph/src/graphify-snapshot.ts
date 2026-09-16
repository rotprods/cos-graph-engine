export * from './graphify-snapshot-v1-internal';

import {
  GRAPHIFY_SNAPSHOT_SCHEMA_V1,
  GraphifyValidationError,
  projectGraphifySnapshot as donorProjectGraphifySnapshot,
  validateGraphifySnapshot as donorValidateGraphifySnapshot,
  type GraphifyProjection,
  type GraphifyProvenanceRecord,
  type GraphifySnapshotV1,
} from './graphify-snapshot-v1-internal';

type JsonObject = Record<string, unknown>;

function isPlainObject(value: object): value is JsonObject {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateJsonValueHardened(
  value: unknown,
  path: string,
  active: WeakSet<object>,
  errors: string[],
): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) errors.push(`${path} contains a non-finite number`);
    return;
  }
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    errors.push(`${path} contains a non-JSON value of type ${typeof value}`);
    return;
  }
  if (typeof value !== 'object') return;

  if (active.has(value)) {
    errors.push(`${path} contains a circular reference`);
    return;
  }
  if (!Array.isArray(value) && !isPlainObject(value)) {
    errors.push(`${path} contains a non-plain JSON object`);
    return;
  }

  active.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      validateJsonValueHardened(value[index], `${path}[${index}]`, active, errors);
    }
  } else {
    for (const [key, child] of Object.entries(value)) {
      validateJsonValueHardened(child, `${path}.${key}`, active, errors);
    }
  }
  active.delete(value);
}

function canonicalJsonValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (typeof value === 'object' && value !== null && isPlainObject(value)) {
    const result = Object.create(null) as JsonObject;
    for (const key of Object.keys(value).sort()) result[key] = canonicalJsonValue(value[key]);
    return result;
  }
  throw new TypeError(`Cannot canonicalize non-JSON value of type ${typeof value}`);
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalJsonValue(value));
}

function createProvenanceTable(): Record<string, GraphifyProvenanceRecord> {
  return Object.create(null) as Record<string, GraphifyProvenanceRecord>;
}

function rebuildProvenance(snapshot: GraphifySnapshotV1): GraphifyProjection['provenance'] {
  const provenance: GraphifyProjection['provenance'] = {
    nodes: createProvenanceTable(),
    edges: createProvenanceTable(),
    semanticNodes: createProvenanceTable(),
    semanticEdges: createProvenanceTable(),
    chunks: createProvenanceTable(),
  };

  for (const node of snapshot.nodes) {
    provenance.nodes[node.id] = { authority: node.authority, evidenceIds: [...(node.evidenceIds ?? [])] };
  }
  for (const edge of snapshot.edges) {
    provenance.edges[edge.id] = {
      authority: edge.authority,
      evidenceIds: [...(edge.evidenceIds ?? [])],
      originalType: edge.type,
    };
  }
  for (const node of snapshot.semantic?.nodes ?? []) {
    provenance.semanticNodes[node.id] = {
      authority: node.authority,
      evidenceIds: [...(node.evidenceIds ?? [])],
      sourceNodeIds: [...(node.sourceNodeIds ?? [])],
    };
  }
  for (const edge of snapshot.semantic?.edges ?? []) {
    provenance.semanticEdges[edge.id] = {
      authority: edge.authority,
      evidenceIds: [...(edge.evidenceIds ?? [])],
      originalType: edge.relation,
    };
  }
  for (const chunk of snapshot.chunks ?? []) {
    provenance.chunks[chunk.id] = {
      authority: chunk.authority ?? 'semantic_overlay',
      evidenceIds: [...(chunk.evidenceIds ?? [])],
      sourceNodeIds: [...chunk.entityIds],
    };
  }
  return provenance;
}

export function validateGraphifySnapshot(snapshot: GraphifySnapshotV1): string[] {
  const structuralErrors: string[] = [];
  validateJsonValueHardened(snapshot, '$', new WeakSet<object>(), structuralErrors);
  if (structuralErrors.length) return Array.from(new Set(structuralErrors));
  return Array.from(new Set(donorValidateGraphifySnapshot(snapshot)));
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
  return JSON.stringify(canonicalJsonValue(copy));
}

export function projectGraphifySnapshot(snapshot: GraphifySnapshotV1): GraphifyProjection {
  const errors = validateGraphifySnapshot(snapshot);
  if (errors.length) throw new GraphifyValidationError(errors);

  const projection = donorProjectGraphifySnapshot(snapshot);
  projection.provenance = rebuildProvenance(snapshot);

  for (const node of snapshot.nodes) {
    const entity = projection.knowledge.getEntity(node.id);
    if (entity?.properties) {
      entity.properties.metadata = stableJson(node.metadata ?? {});
      entity.properties.evidenceIds = stableJson(node.evidenceIds ?? []);
    }
  }
  for (const edge of snapshot.edges) {
    const relation = projection.knowledge.getRelation(edge.id);
    if (relation?.properties) {
      relation.properties.metadata = stableJson(edge.metadata ?? {});
      relation.properties.evidenceIds = stableJson(edge.evidenceIds ?? []);
    }
  }

  return projection;
}

export { GRAPHIFY_SNAPSHOT_SCHEMA_V1 };
