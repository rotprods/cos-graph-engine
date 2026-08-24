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
  revision: number;
  contentHash: string;
}

export interface AgenticResourceUpdate {
  title?: string;
  status?: string;
  sensitivity?: AgenticSensitivity;
  provenanceRef?: string;
  validFrom?: string;
  validUntil?: string | null;
  observedAt?: string;
  recordedAt?: string;
  metadata?: Record<string, unknown>;
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
  revision: number;
  contentHash: string;
}

export interface AgenticRelationUpdate {
  confidence?: number;
  sensitivity?: AgenticSensitivity;
  provenanceRef?: string;
  validFrom?: string;
  validUntil?: string | null;
  recordedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AgenticGraphScope {
  projectId?: string;
  /** Include records with no projectId as shared/global authority context. */
  includeGlobal?: boolean;
  maxSensitivity?: AgenticSensitivity;
  asOf?: string;
}

export interface AgenticNeighborhood {
  resources: AgenticResource[];
  relations: AgenticRelation[];
}

/**
 * Compact versioned authority projection for AGENTIC_SYSTEMS_OS resources.
 *
 * Canonical identity/type/project scope are immutable. Mutations require an
 * expected revision and update deterministic content hashes. Replaying the same
 * create/relation input is idempotent only when all explicitly supplied fields
 * agree; conflicting reuse fails instead of silently returning stale state.
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
    validateResourceInput(input);
    const identity = canonicalIdentity(input.identity, resourcePrefix(input.type));
    const existing = this.resources.get(identity.id);
    if (existing) {
      if (existing.canonicalUri !== identity.uri || existing.type !== input.type) {
        throw new Error(`Agentic identity collision for ${identity.id}`);
      }
      assertResourceReplayCompatible(existing, input);
      return cloneResource(existing);
    }
    if (this.uriToId.has(identity.uri)) throw new Error(`Canonical URI already registered: ${identity.uri}`);

    const base = {
      id: identity.id,
      canonicalUri: identity.uri,
      type: input.type,
      title: input.title.trim(),
      projectId: normalizeProjectId(input.projectId),
      status: normalizeStatus(input.status || 'active'),
      sensitivity: input.sensitivity || 'internal',
      provenanceRef: input.provenanceRef.trim(),
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      observedAt: input.observedAt,
      recordedAt: input.recordedAt || new Date().toISOString(),
      metadata: structuredClone(input.metadata || {}),
      revision: 1,
    };
    const resource: AgenticResource = { ...base, contentHash: resourceHash(base) };

    this.resources.set(resource.id, resource);
    this.uriToId.set(resource.canonicalUri, resource.id);
    indexAdd(this.byType, resource.type, resource.id);
    if (resource.projectId) indexAdd(this.byProject, resource.projectId, resource.id);
    return cloneResource(resource);
  }

  updateResource(idOrUri: string, expectedRevision: number, updates: AgenticResourceUpdate): AgenticResource {
    const current = this.requireResource(idOrUri);
    assertExpectedRevision('resource', current.id, expectedRevision, current.revision);
    const nextBase = {
      ...current,
      title: updates.title !== undefined ? updates.title.trim() : current.title,
      status: updates.status !== undefined ? normalizeStatus(updates.status) : current.status,
      sensitivity: updates.sensitivity ?? current.sensitivity,
      provenanceRef: updates.provenanceRef !== undefined ? updates.provenanceRef.trim() : current.provenanceRef,
      validFrom: updates.validFrom !== undefined ? updates.validFrom : current.validFrom,
      validUntil: Object.prototype.hasOwnProperty.call(updates, 'validUntil') ? updates.validUntil : current.validUntil,
      observedAt: updates.observedAt !== undefined ? updates.observedAt : current.observedAt,
      recordedAt: updates.recordedAt || new Date().toISOString(),
      metadata: updates.metadata !== undefined ? structuredClone(updates.metadata) : structuredClone(current.metadata),
      revision: current.revision + 1,
    };
    if (!nextBase.title) throw new Error('Agentic resource title must not be empty');
    if (!nextBase.provenanceRef) throw new Error('Agentic resource provenanceRef must not be empty');
    validateTemporal(nextBase.validFrom, nextBase.validUntil, nextBase.observedAt, nextBase.recordedAt);
    const next: AgenticResource = { ...nextBase, contentHash: resourceHash(nextBase) };
    this.resources.set(current.id, next);
    return cloneResource(next);
  }

  getResource(idOrUri: string): AgenticResource | null {
    const id = this.resources.has(idOrUri) ? idOrUri : this.uriToId.get(idOrUri);
    const resource = id ? this.resources.get(id) : undefined;
    return resource ? cloneResource(resource) : null;
  }

  addRelation(input: AgenticRelationInput): AgenticRelation {
    validateRelationInput(input);
    const from = this.resources.get(input.from);
    const to = this.resources.get(input.to);
    if (!from) throw new Error(`Relation source ${input.from} does not exist`);
    if (!to) throw new Error(`Relation target ${input.to} does not exist`);
    const projectId = normalizeProjectId(input.projectId);
    if (projectId && from.projectId && from.projectId !== projectId) throw new Error('Relation project scope conflicts with source');
    if (projectId && to.projectId && to.projectId !== projectId) throw new Error('Relation project scope conflicts with target');

    const id = `arel_${stableHash128({
      type: input.type,
      from: input.from,
      to: input.to,
      projectId: projectId || null,
      validFrom: input.validFrom || null,
      provenanceRef: input.provenanceRef.trim(),
    })}`;
    const existing = this.relations.get(id);
    if (existing) {
      assertRelationReplayCompatible(existing, input);
      return cloneRelation(existing);
    }

    const base = {
      id,
      type: input.type,
      from: input.from,
      to: input.to,
      projectId,
      confidence: input.confidence ?? 1,
      sensitivity: input.sensitivity || maxSensitivity(from.sensitivity, to.sensitivity),
      provenanceRef: input.provenanceRef.trim(),
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      recordedAt: input.recordedAt || new Date().toISOString(),
      metadata: structuredClone(input.metadata || {}),
      revision: 1,
    };
    const relation: AgenticRelation = { ...base, contentHash: relationHash(base) };
    this.relations.set(id, relation);
    indexAdd(this.outgoing, relation.from, id);
    indexAdd(this.incoming, relation.to, id);
    return cloneRelation(relation);
  }

  updateRelation(id: string, expectedRevision: number, updates: AgenticRelationUpdate): AgenticRelation {
    const current = this.relations.get(id);
    if (!current) throw new Error(`Agentic relation ${id} not found`);
    assertExpectedRevision('relation', id, expectedRevision, current.revision);
    const nextBase = {
      ...current,
      confidence: updates.confidence ?? current.confidence,
      sensitivity: updates.sensitivity ?? current.sensitivity,
      provenanceRef: updates.provenanceRef !== undefined ? updates.provenanceRef.trim() : current.provenanceRef,
      validFrom: updates.validFrom !== undefined ? updates.validFrom : current.validFrom,
      validUntil: Object.prototype.hasOwnProperty.call(updates, 'validUntil') ? updates.validUntil : current.validUntil,
      recordedAt: updates.recordedAt || new Date().toISOString(),
      metadata: updates.metadata !== undefined ? structuredClone(updates.metadata) : structuredClone(current.metadata),
      revision: current.revision + 1,
    };
    if (!Number.isFinite(nextBase.confidence) || nextBase.confidence < 0 || nextBase.confidence > 1) {
      throw new Error('Relation confidence must be in [0,1]');
    }
    if (!nextBase.provenanceRef) throw new Error('Agentic relation provenanceRef must not be empty');
    validateTemporal(nextBase.validFrom, nextBase.validUntil, undefined, nextBase.recordedAt);
    const next: AgenticRelation = { ...nextBase, contentHash: relationHash(nextBase) };
    this.relations.set(id, next);
    return cloneRelation(next);
  }

  listResources(scope: AgenticGraphScope = {}): AgenticResource[] {
    const max = SENSITIVITY_ORDER[scope.maxSensitivity || 'internal'];
    const asOf = parseAsOf(scope.asOf);
    const candidates = scope.projectId
      ? this.projectCandidates(scope.projectId, scope.includeGlobal ?? false)
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
      .filter(relation => relationScopeMatches(relation, scope)
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
    if (!this.resources.has(startId)) throw new Error(`Resource ${startId} not found`);
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
      const edgeIds = new Set([...(this.outgoing.get(current.id) || []), ...(this.incoming.get(current.id) || [])]);
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

  projectionHash(scope: AgenticGraphScope = {}): string {
    return stableHash128({ resources: this.listResources(scope), relations: this.listRelations(scope) });
  }

  private requireResource(idOrUri: string): AgenticResource {
    const id = this.resources.has(idOrUri) ? idOrUri : this.uriToId.get(idOrUri);
    const resource = id ? this.resources.get(id) : undefined;
    if (!resource) throw new Error(`Agentic resource ${idOrUri} not found`);
    return resource;
  }

  private projectCandidates(projectId: string, includeGlobal: boolean): AgenticResource[] {
    const ids = new Set(this.byProject.get(projectId) || []);
    if (includeGlobal) {
      for (const resource of this.resources.values()) if (!resource.projectId) ids.add(resource.id);
    }
    return Array.from(ids, id => this.resources.get(id)!).filter(Boolean);
  }
}

function validateResourceInput(input: AgenticResourceInput): void {
  if (!input.title.trim()) throw new Error('Agentic resource title must not be empty');
  if (!input.provenanceRef.trim()) throw new Error('Agentic resource provenanceRef must not be empty');
  validateTemporal(input.validFrom, input.validUntil, input.observedAt, input.recordedAt);
}

function validateRelationInput(input: AgenticRelationInput): void {
  if (!input.provenanceRef.trim()) throw new Error('Agentic relation provenanceRef must not be empty');
  if (input.from === input.to) throw new Error('Agentic relation cannot self-reference');
  const confidence = input.confidence ?? 1;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('Relation confidence must be in [0,1]');
  validateTemporal(input.validFrom, input.validUntil, undefined, input.recordedAt);
}

function assertResourceReplayCompatible(existing: AgenticResource, input: AgenticResourceInput): void {
  const conflicts: string[] = [];
  compareExplicit(conflicts, 'title', existing.title, input.title.trim());
  compareExplicit(conflicts, 'projectId', existing.projectId, normalizeProjectId(input.projectId));
  if (input.status !== undefined) compareExplicit(conflicts, 'status', existing.status, normalizeStatus(input.status));
  if (input.sensitivity !== undefined) compareExplicit(conflicts, 'sensitivity', existing.sensitivity, input.sensitivity);
  compareExplicit(conflicts, 'provenanceRef', existing.provenanceRef, input.provenanceRef.trim());
  if (input.validFrom !== undefined) compareExplicit(conflicts, 'validFrom', existing.validFrom, input.validFrom);
  if (Object.prototype.hasOwnProperty.call(input, 'validUntil')) compareExplicit(conflicts, 'validUntil', existing.validUntil, input.validUntil);
  if (input.observedAt !== undefined) compareExplicit(conflicts, 'observedAt', existing.observedAt, input.observedAt);
  if (input.recordedAt !== undefined) compareExplicit(conflicts, 'recordedAt', existing.recordedAt, input.recordedAt);
  if (input.metadata !== undefined && stableHash128(existing.metadata) !== stableHash128(input.metadata)) conflicts.push('metadata');
  if (conflicts.length) throw new Error(`AGENTIC_RESOURCE_CONFLICT id=${existing.id} fields=${conflicts.join(',')}`);
}

function assertRelationReplayCompatible(existing: AgenticRelation, input: AgenticRelationInput): void {
  const conflicts: string[] = [];
  compareExplicit(conflicts, 'type', existing.type, input.type);
  compareExplicit(conflicts, 'from', existing.from, input.from);
  compareExplicit(conflicts, 'to', existing.to, input.to);
  compareExplicit(conflicts, 'projectId', existing.projectId, normalizeProjectId(input.projectId));
  compareExplicit(conflicts, 'provenanceRef', existing.provenanceRef, input.provenanceRef.trim());
  if (input.confidence !== undefined) compareExplicit(conflicts, 'confidence', existing.confidence, input.confidence);
  if (input.sensitivity !== undefined) compareExplicit(conflicts, 'sensitivity', existing.sensitivity, input.sensitivity);
  if (input.validFrom !== undefined) compareExplicit(conflicts, 'validFrom', existing.validFrom, input.validFrom);
  if (Object.prototype.hasOwnProperty.call(input, 'validUntil')) compareExplicit(conflicts, 'validUntil', existing.validUntil, input.validUntil);
  if (input.recordedAt !== undefined) compareExplicit(conflicts, 'recordedAt', existing.recordedAt, input.recordedAt);
  if (input.metadata !== undefined && stableHash128(existing.metadata) !== stableHash128(input.metadata)) conflicts.push('metadata');
  if (conflicts.length) throw new Error(`AGENTIC_RELATION_CONFLICT id=${existing.id} fields=${conflicts.join(',')}`);
}

function compareExplicit(conflicts: string[], field: string, existing: unknown, incoming: unknown): void {
  if (stableHash128(existing) !== stableHash128(incoming)) conflicts.push(field);
}

function assertExpectedRevision(kind: string, id: string, expected: number, current: number): void {
  if (!Number.isSafeInteger(expected) || expected < 1) throw new Error('expectedRevision must be a positive safe integer');
  if (expected !== current) throw new Error(`STALE_AGENTIC_${kind.toUpperCase()}_REVISION id=${id} expected=${expected} current=${current}`);
}

function relationScopeMatches(relation: AgenticRelation, scope: AgenticGraphScope): boolean {
  if (!scope.projectId) return true;
  if (relation.projectId === scope.projectId) return true;
  return Boolean(scope.includeGlobal && relation.projectId === undefined);
}

function resourcePrefix(type: AgenticResourceType): string {
  return `a${type.replace(/[^a-z0-9]/g, '').slice(0, 5)}`;
}

function indexAdd<K>(index: Map<K, Set<string>>, key: K, value: string): void {
  let bucket = index.get(key);
  if (!bucket) { bucket = new Set<string>(); index.set(key, bucket); }
  bucket.add(value);
}

function validateTemporal(validFrom?: string, validUntil?: string | null, observedAt?: string, recordedAt?: string): void {
  for (const [name, value] of [['validFrom', validFrom], ['validUntil', validUntil], ['observedAt', observedAt], ['recordedAt', recordedAt]] as const) {
    if (value !== undefined && value !== null && !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ${name}: ${value}`);
  }
  if (validFrom && validUntil && Date.parse(validUntil) <= Date.parse(validFrom)) throw new Error('validUntil must be after validFrom');
  if (observedAt && recordedAt && Date.parse(recordedAt) < Date.parse(observedAt)) throw new Error('recordedAt cannot precede observedAt');
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

function normalizeProjectId(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeStatus(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error('Agentic status must not be empty');
  return normalized;
}

function resourceHash(resource: Omit<AgenticResource, 'contentHash'>): string {
  return stableHash128({ ...resource, metadata: resource.metadata });
}

function relationHash(relation: Omit<AgenticRelation, 'contentHash'>): string {
  return stableHash128({ ...relation, metadata: relation.metadata });
}

function cloneResource(resource: AgenticResource): AgenticResource {
  return { ...resource, metadata: structuredClone(resource.metadata) };
}

function cloneRelation(relation: AgenticRelation): AgenticRelation {
  return { ...relation, metadata: structuredClone(relation.metadata) };
}
