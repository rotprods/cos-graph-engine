import {
  canonicalIdentity,
  stableHash128,
  type CanonicalIdentityInput,
} from '@cos/core';

export type AgenticResourceType =
  | 'portfolio'
  | 'program'
  | 'project'
  | 'workstream'
  | 'chat'
  | 'session'
  | 'agent_run'
  | 'task'
  | 'decision'
  | 'artifact'
  | 'memory'
  | 'source'
  | 'repository'
  | 'commit'
  | 'pull_request'
  | 'checkpoint'
  | 'risk'
  | 'release_gate';

export type AgenticRelationType =
  | 'contains'
  | 'belongs_to'
  | 'advances'
  | 'references'
  | 'derived_from'
  | 'supersedes'
  | 'contradicts'
  | 'depends_on'
  | 'blocks'
  | 'produced'
  | 'created_by'
  | 'executed_by'
  | 'uses'
  | 'provenance_of'
  | 'evidence_for'
  | 'continues'
  | 'version_of'
  | 'current_state_of'
  | 'governed_by';

export type AgenticSensitivity = 'public' | 'internal' | 'private' | 'restricted';

const SENSITIVITY_ORDER: Record<AgenticSensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

export interface AgenticResourceInput {
  identity: CanonicalIdentityInput;
  type: AgenticResourceType;
  title: string;
  projectId?: string;
  status?: string;
  sensitivity?: AgenticSensitivity;
  provenanceRef: string;
  validFrom?: string;
  validUntil?: string | null;
  observedAt?: string;
  recordedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AgenticResource {
  id: string;
  canonicalUri: string;
  type: AgenticResourceType;
  title: string;
  projectId?: string;
  status: string;
  sensitivity: AgenticSensitivity;
  provenanceRef: string;
  validFrom?: string;
  validUntil?: string | null;
  observedAt?: string;
  recordedAt: string;
  metadata: Record<string, unknown>;
}

export interface AgenticRelationInput {
  type: AgenticRelationType;
  from: string;
  to: string;
  projectId?: string;
  confidence?: number;
  sensitivity?: AgenticSensitivity;
  provenanceRef: string;
  validFrom?: string;
  validUntil?: string | null;
  recordedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AgenticRelation {
  id: string;
  type: AgenticRelationType;
  from: string;
  to: string;
  projectId?: string;
  confidence: number;
  sensitivity: AgenticSensitivity;
  provenanceRef: string;
  validFrom?: string;
  validUntil?: string | null;
  recordedAt: string;
  metadata: Record<string, unknown>;
}

export interface AgenticGraphScope {
  projectId?: string;
  maxSensitivity?: AgenticSensitivity;
  asOf?: string;
}

export interface AgenticNeighborhood {
  resources: AgenticResource[];
  relations: AgenticRelation[];
}

/**
 * Compact authority projection for AGENTIC_SYSTEMS_OS resources.
 *
 * It stores identifiers, topology, provenance and compact metadata — not raw
 * conversation bodies. Raw/cold content remains in Drive/provider exports and
 * is referenced by provenance/source pointers.
 */
export class AgenticResourceRegistry {
  private readonly resources = new Map<string, AgenticResource>();
  private readonly uriToId = new Map<string, string>();
  private readonly relations = new Map<string, AgenticRelation>();
  private readonly byProject = new Map<string, Set<string>>();
  private readonly byType = new Map<AgenticResourceType, Set<string>>();
  private readonly outgoing = new Map<string, Set<string>>();
  private readonly incoming = new Map<string, Set<string>>();

  addResource(input: AgenticResourceInput): AgenticResource {
    const title = input.title.trim();
    const provenanceRef = input.provenanceRef.trim();
    if (!title) throw new Error('Agentic resource title must not be empty');
    if (!provenanceRef) throw new Error('Agentic resource provenanceRef must not be empty');
    validateTemporal(input.validFrom, input.validUntil, input.observedAt, input.recordedAt);

    const identity = canonicalIdentity(input.identity, resourcePrefix(input.type));
    const existing = this.resources.get(identity.id);
    if (existing) {
      if (existing.canonicalUri !== identity.uri || existing.type !== input.type) {
        throw new Error(`Agentic identity collision for ${identity.id}`);
      }
      return cloneResource(existing);
    }
    if (this.uriToId.has(identity.uri)) {
      throw new Error(`Canonical URI already registered: ${identity.uri}`);
    }

    const resource: AgenticResource = {
      id: identity.id,
      canonicalUri: identity.uri,
      type: input.type,
      title,
      projectId: input.projectId,
      status: input.status || 'active',
      sensitivity: input.sensitivity || 'internal',
      provenanceRef,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      observedAt: input.observedAt,
      recordedAt: input.recordedAt || new Date().toISOString(),
      metadata: structuredClone(input.metadata || {}),
    };

    this.resources.set(resource.id, resource);
    this.uriToId.set(resource.canonicalUri, resource.id);
    indexAdd(this.byType, resource.type, resource.id);
    if (resource.projectId) indexAdd(this.byProject, resource.projectId, resource.id);
    return cloneResource(resource);
  }

  getResource(idOrUri: string): AgenticResource | null {
    const id = this.resources.has(idOrUri) ? idOrUri : this.uriToId.get(idOrUri);
    const resource = id ? this.resources.get(id) : undefined;
    return resource ? cloneResource(resource) : null;
  }

  addRelation(input: AgenticRelationInput): AgenticRelation {
    const from = this.resources.get(input.from);
    const to = this.resources.get(input.to);
    if (!from) throw new Error(`Relation source ${input.from} does not exist`);
    if (!to) throw new Error(`Relation target ${input.to} does not exist`);
    if (!input.provenanceRef.trim()) throw new Error('Agentic relation provenanceRef must not be empty');
    const confidence = input.confidence ?? 1;
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('Relation confidence must be in [0,1]');
    validateTemporal(input.validFrom, input.validUntil, undefined, input.recordedAt);

    const id = `arel_${stableHash128({
      type: input.type,
      from: input.from,
      to: input.to,
      projectId: input.projectId || null,
      validFrom: input.validFrom || null,
      provenanceRef: input.provenanceRef,
    })}`;
    const existing = this.relations.get(id);
    if (existing) return cloneRelation(existing);

    const relation: AgenticRelation = {
      id,
      type: input.type,
      from: input.from,
      to: input.to,
      projectId: input.projectId,
      confidence,
      sensitivity: input.sensitivity || maxSensitivity(from.sensitivity, to.sensitivity),
      provenanceRef: input.provenanceRef.trim(),
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      recordedAt: input.recordedAt || new Date().toISOString(),
      metadata: structuredClone(input.metadata || {}),
    };
    this.relations.set(id, relation);
    indexAdd(this.outgoing, relation.from, id);
    indexAdd(this.incoming, relation.to, id);
    return cloneRelation(relation);
  }

  listResources(scope: AgenticGraphScope = {}): AgenticResource[] {
    const max = SENSITIVITY_ORDER[scope.maxSensitivity || 'internal'];
    const asOf = parseAsOf(scope.asOf);
    const candidates = scope.projectId
      ? Array.from(this.byProject.get(scope.projectId) || [], id => this.resources.get(id)!).filter(Boolean)
      : Array.from(this.resources.values());
    return candidates
      .filter(resource => SENSITIVITY_ORDER[resource.sensitivity] <= max && temporalVisible(resource, asOf))
      .map(cloneResource)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  listRelations(scope: AgenticGraphScope = {}): AgenticRelation[] {
    const max = SENSITIVITY_ORDER[scope.maxSensitivity || 'internal'];
    const asOf = parseAsOf(scope.asOf);
    return Array.from(this.relations.values())
      .filter(relation => (!scope.projectId || relation.projectId === scope.projectId)
        && SENSITIVITY_ORDER[relation.sensitivity] <= max
        && temporalVisible(relation, asOf))
      .map(cloneRelation)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  neighborhood(
    startId: string,
    depth = 1,
    scope: AgenticGraphScope = {},
    relationTypes?: AgenticRelationType[],
  ): AgenticNeighborhood {
    if (!Number.isInteger(depth) || depth < 0 || depth > 5) throw new Error('Neighborhood depth must be in [0,5]');
    const start = this.resources.get(startId);
    if (!start) throw new Error(`Resource ${startId} not found`);

    const visibleResources = new Map(this.listResources(scope).map(resource => [resource.id, resource]));
    if (!visibleResources.has(startId)) return { resources: [], relations: [] };
    const visibleRelations = new Map(this.listRelations(scope).map(relation => [relation.id, relation]));
    const allowedTypes = relationTypes ? new Set(relationTypes) : null;

    const seenResources = new Set<string>([startId]);
    const seenRelations = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    let head = 0;

    while (head < queue.length) {
      const current = queue[head++];
      if (current.depth >= depth) continue;
      const edgeIds = new Set([
        ...(this.outgoing.get(current.id) || []),
        ...(this.incoming.get(current.id) || []),
      ]);
      for (const relationId of edgeIds) {
        const relation = visibleRelations.get(relationId);
        if (!relation || (allowedTypes && !allowedTypes.has(relation.type))) continue;
        const neighbor = relation.from === current.id ? relation.to : relation.from;
        if (!visibleResources.has(neighbor)) continue;
        seenRelations.add(relationId);
        if (!seenResources.has(neighbor)) {
          seenResources.add(neighbor);
          queue.push({ id: neighbor, depth: current.depth + 1 });
        }
      }
    }

    return {
      resources: Array.from(seenResources, id => cloneResource(visibleResources.get(id)!)).sort((a, b) => a.id.localeCompare(b.id)),
      relations: Array.from(seenRelations, id => cloneRelation(visibleRelations.get(id)!)).sort((a, b) => a.id.localeCompare(b.id)),
    };
  }

  /** Deterministic compact projection hash for replay comparison, not cryptographic integrity. */
  projectionHash(scope: AgenticGraphScope = {}): string {
    return stableHash128({ resources: this.listResources(scope), relations: this.listRelations(scope) });
  }
}

function resourcePrefix(type: AgenticResourceType): string {
  return `a${type.replace(/[^a-z0-9]/g, '').slice(0, 5)}`;
}

function indexAdd<K>(index: Map<K, Set<string>>, key: K, value: string): void {
  let bucket = index.get(key);
  if (!bucket) {
    bucket = new Set<string>();
    index.set(key, bucket);
  }
  bucket.add(value);
}

function validateTemporal(validFrom?: string, validUntil?: string | null, observedAt?: string, recordedAt?: string): void {
  for (const [name, value] of [['validFrom', validFrom], ['validUntil', validUntil], ['observedAt', observedAt], ['recordedAt', recordedAt]] as const) {
    if (value !== undefined && value !== null && !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ${name}: ${value}`);
  }
  if (validFrom && validUntil && Date.parse(validUntil) <= Date.parse(validFrom)) {
    throw new Error('validUntil must be after validFrom');
  }
}

function parseAsOf(value?: string): number {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid asOf '${value}'`);
  return parsed;
}

function temporalVisible(value: { validFrom?: string; validUntil?: string | null }, asOf: number): boolean {
  if (value.validFrom && Date.parse(value.validFrom) > asOf) return false;
  if (value.validUntil && Date.parse(value.validUntil) <= asOf) return false;
  return true;
}

function maxSensitivity(a: AgenticSensitivity, b: AgenticSensitivity): AgenticSensitivity {
  return SENSITIVITY_ORDER[a] >= SENSITIVITY_ORDER[b] ? a : b;
}

function cloneResource(resource: AgenticResource): AgenticResource {
  return { ...resource, metadata: structuredClone(resource.metadata) };
}

function cloneRelation(relation: AgenticRelation): AgenticRelation {
  return { ...relation, metadata: structuredClone(relation.metadata) };
}
