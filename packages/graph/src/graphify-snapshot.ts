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

type JsonValidationFrame =
  | { phase: 'visit'; value: unknown; path: string; depth: number }
  | { phase: 'leave'; value: object };

const GRAPHIFY_MAX_JSON_DEPTH = 128;

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
  const stack: JsonValidationFrame[] = [{ phase: 'visit', value, path, depth: 0 }];

  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.phase === 'leave') {
      active.delete(frame.value);
      continue;
    }

    const current = frame.value;
    if (frame.depth > GRAPHIFY_MAX_JSON_DEPTH) {
      errors.push(`${frame.path} exceeds maximum JSON depth ${GRAPHIFY_MAX_JSON_DEPTH}`);
      continue;
    }
    if (current === null || typeof current === 'string' || typeof current === 'boolean') continue;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) errors.push(`${frame.path} contains a non-finite number`);
      continue;
    }
    if (typeof current === 'undefined' || typeof current === 'function' || typeof current === 'symbol' || typeof current === 'bigint') {
      errors.push(`${frame.path} contains a non-JSON value of type ${typeof current}`);
      continue;
    }
    if (typeof current !== 'object') continue;

    if (active.has(current)) {
      errors.push(`${frame.path} contains a circular reference`);
      continue;
    }
    if (!Array.isArray(current) && !isPlainObject(current)) {
      errors.push(`${frame.path} contains a non-plain JSON object`);
      continue;
    }

    const descriptors = Object.getOwnPropertyDescriptors(current);
    active.add(current);
    stack.push({ phase: 'leave', value: current });

    if (Array.isArray(current)) {
      let ownIndexCount = 0;
      for (const key of Reflect.ownKeys(descriptors)) {
        if (typeof key === 'symbol') {
          errors.push(`${frame.path} contains a symbol-keyed property`);
          continue;
        }
        if (key === 'length') continue;

        const descriptor = descriptors[key]!;
        if (!('value' in descriptor)) {
          errors.push(`${frame.path}.${key} uses an accessor property`);
          continue;
        }

        const index = Number(key);
        const isArrayIndex = /^(0|[1-9]\d*)$/.test(key)
          && Number.isSafeInteger(index)
          && index >= 0
          && index < current.length
          && String(index) === key;
        if (!isArrayIndex) {
          errors.push(`${frame.path}.${key} is not a canonical JSON array index`);
          continue;
        }

        ownIndexCount += 1;
        if (!descriptor.enumerable) {
          errors.push(`${frame.path}[${key}] is non-enumerable and not canonical JSON`);
          continue;
        }
        stack.push({
          phase: 'visit',
          value: descriptor.value,
          path: `${frame.path}[${key}]`,
          depth: frame.depth + 1,
        });
      }
      if (ownIndexCount !== current.length) errors.push(`${frame.path} contains a sparse array`);
      continue;
    }

    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key === 'symbol') {
        errors.push(`${frame.path} contains a symbol-keyed property`);
        continue;
      }
      const descriptor = descriptors[key]!;
      if (!('value' in descriptor)) {
        errors.push(`${frame.path}.${key} uses an accessor property`);
        continue;
      }
      if (!descriptor.enumerable) {
        errors.push(`${frame.path}.${key} is non-enumerable and not canonical JSON`);
        continue;
      }
      stack.push({
        phase: 'visit',
        value: descriptor.value,
        path: `${frame.path}.${key}`,
        depth: frame.depth + 1,
      });
    }
  }
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
