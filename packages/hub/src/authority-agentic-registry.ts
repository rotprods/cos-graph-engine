import {
  canonicalIdentity,
  stableHash128,
  type CanonicalIdentityInput,
} from '@cos/core';
import type {
  AgenticRelationType,
  AgenticResourceType,
  AgenticSensitivity,
} from './agentic-registry';

const SENSITIVITY_ORDER: Record<AgenticSensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

export interface AuthorityAgenticWriteOptions {
  expectedProjectionVersion?: number;
}

export interface AuthorityAgenticReadOptions {
  knownAt?: string;
  maxSensitivity?: AgenticSensitivity;
}

export interface AuthorityAgenticResourceInput {
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
  /** Required source/system time. Never inferred from wall clock. */
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityAgenticResourceUpdate {
  title?: string;
  status?: string;
  sensitivity?: AgenticSensitivity;
  provenanceRef?: string;
  validFrom?: string;
  validUntil?: string | null;
  observedAt?: string;
  /** Required transaction time for the new revision. */
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityAgenticResource {
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
  revision: number;
  systemFrom: string;
  systemUntil: string | null;
  metadata: Record<string, unknown>;
  contentHash: string;
}

export interface AuthorityAgenticRelationInput {
  type: AgenticRelationType;
  from: string;
  to: string;
  /** Distinguishes intentionally parallel otherwise-identical relations. */
  identityKey?: string;
  projectId?: string;
  confidence?: number;
  sensitivity?: AgenticSensitivity;
  provenanceRef: string;
  validFrom?: string;
  validUntil?: string | null;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityAgenticRelationUpdate {
  confidence?: number;
  sensitivity?: AgenticSensitivity;
  validUntil?: string | null;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityAgenticRelation {
  id: string;
  identityKey: string;
  type: AgenticRelationType;
  from: string;
  to: string;
  projectId?: string;
  confidence: number;
  sensitivity: AgenticSensitivity;
  provenanceRef: string;
  validFrom?: string;
  validUntil?: string | null;
  revision: number;
  systemFrom: string;
  systemUntil: string | null;
  metadata: Record<string, unknown>;
  contentHash: string;
}

export interface AuthorityAgenticScope {
  projectId?: string;
  includeGlobal?: boolean;
  maxSensitivity?: AgenticSensitivity;
  /** Domain-valid time. */
  asOf?: string;
  /** Transaction/system-knowledge time. */
  knownAt?: string;
}

export interface AuthorityAgenticNeighborhood {
  resources: AuthorityAgenticResource[];
  relations: AuthorityAgenticRelation[];
}

export interface AuthorityAgenticSnapshot {
  schemaVersion: 1;
  projectionVersion: number;
  resources: AuthorityAgenticResource[];
  relations: AuthorityAgenticRelation[];
  projectionHash: string;
}

interface NormalizedResourceInput {
  identity: CanonicalIdentityInput;
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

/**
 * Append-only revisioned authority projection for AGENTIC_SYSTEMS_OS topology.
 *
 * `AgenticResourceRegistry` remains the legacy/shadow compatibility API. This
 * class is the only authority candidate and enforces:
 *
 * - canonical identity plus immutable resource type/project scope;
 * - explicit source timestamps, never implicit wall-clock writes;
 * - expected object revision and optional whole-projection CAS;
 * - append-only transaction-time revisions (`systemFrom/systemUntil`);
 * - deep-copy JSON-like metadata;
 * - no relation sensitivity below either endpoint;
 * - deterministic parallel relation identity through `identityKey`;
 * - project/sensitivity/valid-time/known-time filtering before traversal;
 * - deterministic full snapshots independent of current wall-clock time.
 */
export class AuthorityAgenticRegistry {
  private projectionVersionValue = 0;
  private readonly currentResources = new Map<string, AuthorityAgenticResource>();
  private readonly resourceHistories = new Map<string, AuthorityAgenticResource[]>();
  private readonly uriToId = new Map<string, string>();
  private readonly currentRelations = new Map<string, AuthorityAgenticRelation>();
  private readonly relationHistories = new Map<string, AuthorityAgenticRelation[]>();
  private readonly byProject = new Map<string, Set<string>>();
  private readonly globalResources = new Set<string>();
  private readonly byType = new Map<AgenticResourceType, Set<string>>();
  private readonly outgoing = new Map<string, Set<string>>();
  private readonly incoming = new Map<string, Set<string>>();

  get projectionVersion(): number { return this.projectionVersionValue; }

  addResource(
    input: AuthorityAgenticResourceInput,
    options: AuthorityAgenticWriteOptions = {},
  ): AuthorityAgenticResource {
    this.assertProjectionVersion(options.expectedProjectionVersion);
    const normalized = normalizeResourceInput(input);
    const identity = canonicalIdentity(normalized.identity, resourcePrefix(normalized.type));
    const existing = this.currentResources.get(identity.id);
    if (existing) {
      if (existing.canonicalUri !== identity.uri || existing.type !== normalized.type) {
        throw new Error(`AGENTIC_IDENTITY_COLLISION id=${identity.id}`);
      }
      const first = this.resourceHistories.get(identity.id)?.[0];
      if (!first || resourceCreateHash(first) !== resourceInputHash(identity.id, identity.uri, normalized)) {
        throw new Error(`AGENTIC_RESOURCE_CREATE_CONFLICT id=${identity.id}`);
      }
      return cloneResource(existing);
    }
    if (this.uriToId.has(identity.uri)) throw new Error(`Canonical URI already registered: ${identity.uri}`);

    const base: Omit<AuthorityAgenticResource, 'contentHash'> = {
      id: identity.id,
      canonicalUri: identity.uri,
      type: normalized.type,
      title: normalized.title,
      projectId: normalized.projectId,
      status: normalized.status,
      sensitivity: normalized.sensitivity,
      provenanceRef: normalized.provenanceRef,
      validFrom: normalized.validFrom,
      validUntil: normalized.validUntil,
      observedAt: normalized.observedAt,
      revision: 1,
      systemFrom: normalized.recordedAt,
      systemUntil: null,
      metadata: cloneJson(normalized.metadata),
    };
    const resource = sealResource(base);
    this.currentResources.set(resource.id, resource);
    this.resourceHistories.set(resource.id, [resource]);
    this.uriToId.set(resource.canonicalUri, resource.id);
    indexAdd(this.byType, resource.type, resource.id);
    if (resource.projectId) indexAdd(this.byProject, resource.projectId, resource.id);
    else this.globalResources.add(resource.id);
    this.projectionVersionValue += 1;
    return cloneResource(resource);
  }

  updateResource(
    idOrUri: string,
    expectedRevision: number,
    update: AuthorityAgenticResourceUpdate,
    options: AuthorityAgenticWriteOptions = {},
  ): AuthorityAgenticResource {
    this.assertProjectionVersion(options.expectedProjectionVersion);
    const current = this.requireCurrentResource(idOrUri);
    assertExpectedRevision('resource', current.id, expectedRevision, current.revision);
    const recordedAt = canonicalTime(update.recordedAt, 'resource recordedAt');
    assertNextSystemTime(current.systemFrom, recordedAt, `resource ${current.id}`);

    const currentBase = withoutResourceHash(current);
    const nextBase: Omit<AuthorityAgenticResource, 'contentHash'> = {
      ...currentBase,
      title: update.title === undefined ? current.title : nonEmpty(update.title, 'resource title'),
      status: update.status === undefined ? current.status : nonEmpty(update.status, 'resource status'),
      sensitivity: update.sensitivity ?? current.sensitivity,
      provenanceRef: update.provenanceRef === undefined
        ? current.provenanceRef
        : nonEmpty(update.provenanceRef, 'resource provenanceRef'),
      validFrom: update.validFrom === undefined
        ? current.validFrom
        : canonicalOptionalTime(update.validFrom, 'resource validFrom'),
      validUntil: Object.prototype.hasOwnProperty.call(update, 'validUntil')
        ? canonicalNullableTime(update.validUntil, 'resource validUntil')
        : current.validUntil,
      observedAt: update.observedAt === undefined
        ? current.observedAt
        : canonicalOptionalTime(update.observedAt, 'resource observedAt'),
      revision: current.revision + 1,
      systemFrom: recordedAt,
      systemUntil: null,
      metadata: update.metadata === undefined ? cloneJson(current.metadata) : canonicalMetadata(update.metadata),
    };
    validateTemporal(nextBase.validFrom, nextBase.validUntil, nextBase.observedAt, nextBase.systemFrom);
    this.assertIncidentRelationSensitivity(current.id, nextBase.sensitivity);

    const next = sealResource(nextBase);
    this.closeResourceRevision(current, recordedAt);
    this.resourceHistories.get(current.id)!.push(next);
    this.currentResources.set(current.id, next);
    this.projectionVersionValue += 1;
    return cloneResource(next);
  }

  getResource(idOrUri: string, options: AuthorityAgenticReadOptions = {}): AuthorityAgenticResource | null {
    const id = this.currentResources.has(idOrUri) ? idOrUri : this.uriToId.get(idOrUri);
    if (!id) return null;
    const revision = options.knownAt
      ? revisionAt(this.resourceHistories.get(id) || [], canonicalInstant(options.knownAt, 'knownAt'))
      : this.currentResources.get(id);
    if (!revision || !isReadable(revision.sensitivity, options.maxSensitivity ?? 'internal')) return null;
    return cloneResource(revision);
  }

  getResourceHistory(idOrUri: string, maxSensitivity: AgenticSensitivity = 'internal'): AuthorityAgenticResource[] {
    const id = this.currentResources.has(idOrUri) ? idOrUri : this.uriToId.get(idOrUri);
    return id
      ? (this.resourceHistories.get(id) || [])
          .filter(resource => isReadable(resource.sensitivity, maxSensitivity))
          .map(cloneResource)
      : [];
  }

  addRelation(
    input: AuthorityAgenticRelationInput,
    options: AuthorityAgenticWriteOptions = {},
  ): AuthorityAgenticRelation {
    this.assertProjectionVersion(options.expectedProjectionVersion);
    const source = this.requireCurrentResource(input.from);
    const target = this.requireCurrentResource(input.to);
    if (source.id === target.id) throw new Error('Authority agentic relation cannot self-reference');

    const recordedAt = canonicalTime(input.recordedAt, 'relation recordedAt');
    const provenanceRef = nonEmpty(input.provenanceRef, 'relation provenanceRef');
    const projectId = deriveRelationProjectId(input.projectId, source.projectId, target.projectId);
    const confidence = input.confidence ?? 1;
    assertUnitInterval(confidence, 'relation confidence');
    const minimumSensitivity = maxSensitivity(source.sensitivity, target.sensitivity);
    const sensitivity = input.sensitivity ?? minimumSensitivity;
    if (SENSITIVITY_ORDER[sensitivity] < SENSITIVITY_ORDER[minimumSensitivity]) {
      throw new Error(`RELATION_SENSITIVITY_DOWNGRADE required=${minimumSensitivity} requested=${sensitivity}`);
    }
    const validFrom = canonicalOptionalTime(input.validFrom, 'relation validFrom');
    const validUntil = canonicalNullableTime(input.validUntil, 'relation validUntil');
    validateTemporal(validFrom, validUntil, undefined, recordedAt);
    const identityKey = nonEmpty(input.identityKey ?? 'default', 'relation identityKey');
    const metadata = canonicalMetadata(input.metadata || {});
    const id = `arel_${stableHash128({
      type: input.type,
      from: source.id,
      to: target.id,
      identityKey,
      projectId: projectId || null,
      validFrom: validFrom || null,
      provenanceRef,
    })}`;

    const existing = this.currentRelations.get(id);
    if (existing) {
      const first = this.relationHistories.get(id)?.[0];
      const incomingHash = relationInputHash({
        id,
        identityKey,
        type: input.type,
        from: source.id,
        to: target.id,
        projectId,
        confidence,
        sensitivity,
        provenanceRef,
        validFrom,
        validUntil,
        systemFrom: recordedAt,
        metadata,
      });
      if (!first || relationCreateHash(first) !== incomingHash) {
        throw new Error(`AGENTIC_RELATION_CREATE_CONFLICT id=${id}`);
      }
      return cloneRelation(existing);
    }

    const base: Omit<AuthorityAgenticRelation, 'contentHash'> = {
      id,
      identityKey,
      type: input.type,
      from: source.id,
      to: target.id,
      projectId,
      confidence,
      sensitivity,
      provenanceRef,
      validFrom,
      validUntil,
      revision: 1,
      systemFrom: recordedAt,
      systemUntil: null,
      metadata,
    };
    const relation = sealRelation(base);
    this.currentRelations.set(id, relation);
    this.relationHistories.set(id, [relation]);
    indexAdd(this.outgoing, relation.from, id);
    indexAdd(this.incoming, relation.to, id);
    this.projectionVersionValue += 1;
    return cloneRelation(relation);
  }

  updateRelation(
    id: string,
    expectedRevision: number,
    update: AuthorityAgenticRelationUpdate,
    options: AuthorityAgenticWriteOptions = {},
  ): AuthorityAgenticRelation {
    this.assertProjectionVersion(options.expectedProjectionVersion);
    const current = this.currentRelations.get(id);
    if (!current) throw new Error(`Authority agentic relation ${id} not found`);
    assertExpectedRevision('relation', id, expectedRevision, current.revision);
    const recordedAt = canonicalTime(update.recordedAt, 'relation recordedAt');
    assertNextSystemTime(current.systemFrom, recordedAt, `relation ${id}`);
    const source = this.currentResources.get(current.from);
    const target = this.currentResources.get(current.to);
    if (!source || !target) throw new Error(`DANGLING_AUTHORITY_RELATION id=${id}`);
    const minimumSensitivity = maxSensitivity(source.sensitivity, target.sensitivity);
    const sensitivity = update.sensitivity ?? current.sensitivity;
    if (SENSITIVITY_ORDER[sensitivity] < SENSITIVITY_ORDER[minimumSensitivity]) {
      throw new Error(`RELATION_SENSITIVITY_DOWNGRADE required=${minimumSensitivity} requested=${sensitivity}`);
    }
    const confidence = update.confidence ?? current.confidence;
    assertUnitInterval(confidence, 'relation confidence');
    const validUntil = Object.prototype.hasOwnProperty.call(update, 'validUntil')
      ? canonicalNullableTime(update.validUntil, 'relation validUntil')
      : current.validUntil;
    validateTemporal(current.validFrom, validUntil, undefined, recordedAt);

    const currentBase = withoutRelationHash(current);
    const nextBase: Omit<AuthorityAgenticRelation, 'contentHash'> = {
      ...currentBase,
      confidence,
      sensitivity,
      validUntil,
      revision: current.revision + 1,
      systemFrom: recordedAt,
      systemUntil: null,
      metadata: update.metadata === undefined ? cloneJson(current.metadata) : canonicalMetadata(update.metadata),
    };
    const next = sealRelation(nextBase);
    this.closeRelationRevision(current, recordedAt);
    this.relationHistories.get(id)!.push(next);
    this.currentRelations.set(id, next);
    this.projectionVersionValue += 1;
    return cloneRelation(next);
  }

  getRelation(id: string, options: AuthorityAgenticReadOptions = {}): AuthorityAgenticRelation | null {
    const revision = options.knownAt
      ? revisionAt(this.relationHistories.get(id) || [], canonicalInstant(options.knownAt, 'knownAt'))
      : this.currentRelations.get(id);
    if (!revision || !isReadable(revision.sensitivity, options.maxSensitivity ?? 'internal')) return null;
    return cloneRelation(revision);
  }

  getRelationHistory(id: string, maxSensitivity: AgenticSensitivity = 'internal'): AuthorityAgenticRelation[] {
    return (this.relationHistories.get(id) || [])
      .filter(relation => isReadable(relation.sensitivity, maxSensitivity))
      .map(cloneRelation);
  }

  listResources(scope: AuthorityAgenticScope = {}): AuthorityAgenticResource[] {
    const asOf = scope.asOf ? canonicalInstant(scope.asOf, 'asOf') : Date.now();
    const knownAt = scope.knownAt ? canonicalInstant(scope.knownAt, 'knownAt') : null;
    const maxSensitivity = scope.maxSensitivity ?? 'internal';
    const ids = scope.projectId
      ? this.projectResourceIds(scope.projectId, scope.includeGlobal ?? false)
      : Array.from(this.currentResources.keys());
    return ids
      .map(id => knownAt === null
        ? this.currentResources.get(id)
        : revisionAt(this.resourceHistories.get(id) || [], knownAt))
      .filter((resource): resource is AuthorityAgenticResource => Boolean(resource))
      .filter(resource => isReadable(resource.sensitivity, maxSensitivity))
      .filter(resource => domainVisible(resource, asOf))
      .map(cloneResource)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  listRelations(scope: AuthorityAgenticScope = {}): AuthorityAgenticRelation[] {
    const asOf = scope.asOf ? canonicalInstant(scope.asOf, 'asOf') : Date.now();
    const knownAt = scope.knownAt ? canonicalInstant(scope.knownAt, 'knownAt') : null;
    const maxSensitivity = scope.maxSensitivity ?? 'internal';
    const visibleResources = new Set(this.listResources(scope).map(resource => resource.id));
    return Array.from(this.currentRelations.keys())
      .map(id => knownAt === null
        ? this.currentRelations.get(id)
        : revisionAt(this.relationHistories.get(id) || [], knownAt))
      .filter((relation): relation is AuthorityAgenticRelation => Boolean(relation))
      .filter(relation => relationScopeMatches(relation, scope))
      .filter(relation => isReadable(relation.sensitivity, maxSensitivity))
      .filter(relation => domainVisible(relation, asOf))
      .filter(relation => visibleResources.has(relation.from) && visibleResources.has(relation.to))
      .map(cloneRelation)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  neighborhood(
    startIdOrUri: string,
    depth = 1,
    scope: AuthorityAgenticScope = {},
    relationTypes?: AgenticRelationType[],
  ): AuthorityAgenticNeighborhood {
    if (!Number.isSafeInteger(depth) || depth < 0 || depth > 5) {
      throw new Error('Authority neighborhood depth must be a safe integer in [0,5]');
    }
    const start = this.resolveResourceForScope(startIdOrUri, scope);
    if (!start) return { resources: [], relations: [] };
    const visibleResources = new Map(this.listResources(scope).map(resource => [resource.id, resource]));
    if (!visibleResources.has(start.id)) return { resources: [], relations: [] };
    const visibleRelations = new Map(this.listRelations(scope).map(relation => [relation.id, relation]));
    const allowed = relationTypes ? new Set(relationTypes) : null;
    const seenResources = new Set<string>([start.id]);
    const seenRelations = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: start.id, depth: 0 }];
    let head = 0;

    while (head < queue.length) {
      const current = queue[head++];
      if (current.depth >= depth) continue;
      const relationIds = new Set([
        ...(this.outgoing.get(current.id) || []),
        ...(this.incoming.get(current.id) || []),
      ]);
      for (const relationId of relationIds) {
        const relation = visibleRelations.get(relationId);
        if (!relation || (allowed && !allowed.has(relation.type))) continue;
        const next = relation.from === current.id ? relation.to : relation.from;
        if (!visibleResources.has(next)) continue;
        seenRelations.add(relation.id);
        if (!seenResources.has(next)) {
          seenResources.add(next);
          queue.push({ id: next, depth: current.depth + 1 });
        }
      }
    }

    return {
      resources: Array.from(seenResources, id => cloneResource(visibleResources.get(id)!))
        .sort((a, b) => a.id.localeCompare(b.id)),
      relations: Array.from(seenRelations, id => cloneRelation(visibleRelations.get(id)!))
        .sort((a, b) => a.id.localeCompare(b.id)),
    };
  }

  /**
   * Full hash is wall-clock independent. Scoped hashes require explicit domain
   * and knowledge timestamps so the same query always hashes the same view.
   */
  projectionHash(scope: AuthorityAgenticScope = {}): string {
    if (Object.keys(scope).length === 0) return this.snapshot().projectionHash;
    if (!scope.asOf || !scope.knownAt) {
      throw new Error('Scoped projectionHash requires explicit asOf and knownAt timestamps');
    }
    return stableHash128({
      projectionVersion: this.projectionVersionValue,
      scope: canonicalScope(scope),
      resources: this.listResources(scope),
      relations: this.listRelations(scope),
    });
  }

  snapshot(): AuthorityAgenticSnapshot {
    const resources = this.fullCurrentResources();
    const relations = this.fullCurrentRelations();
    const base = {
      schemaVersion: 1 as const,
      projectionVersion: this.projectionVersionValue,
      resources,
      relations,
    };
    return { ...base, projectionHash: stableHash128(base) };
  }

  validate(): string[] {
    const errors: string[] = [];
    for (const [id, history] of this.resourceHistories) {
      validateHistory(history, `resource ${id}`, resource => resourceHash(withoutResourceHash(resource)), errors);
      const current = this.currentResources.get(id);
      if (!current || current.systemUntil !== null) errors.push(`Current resource ${id} is missing or closed`);
      if (current && this.uriToId.get(current.canonicalUri) !== id) errors.push(`Resource URI index mismatch: ${id}`);
      if (current && !this.byType.get(current.type)?.has(id)) errors.push(`Resource type index mismatch: ${id}`);
      if (current?.projectId && !this.byProject.get(current.projectId)?.has(id)) errors.push(`Resource project index mismatch: ${id}`);
      if (current && !current.projectId && !this.globalResources.has(id)) errors.push(`Global resource index mismatch: ${id}`);
    }
    for (const [id, history] of this.relationHistories) {
      validateHistory(history, `relation ${id}`, relation => relationHash(withoutRelationHash(relation)), errors);
      const current = this.currentRelations.get(id);
      if (!current || current.systemUntil !== null) errors.push(`Current relation ${id} is missing or closed`);
      if (!current) continue;
      const source = this.currentResources.get(current.from);
      const target = this.currentResources.get(current.to);
      if (!source) errors.push(`Dangling relation source ${id}: ${current.from}`);
      if (!target) errors.push(`Dangling relation target ${id}: ${current.to}`);
      if (!this.outgoing.get(current.from)?.has(id)) errors.push(`Outgoing relation index mismatch: ${id}`);
      if (!this.incoming.get(current.to)?.has(id)) errors.push(`Incoming relation index mismatch: ${id}`);
      if (source && target) {
        const minimum = maxSensitivity(source.sensitivity, target.sensitivity);
        if (SENSITIVITY_ORDER[current.sensitivity] < SENSITIVITY_ORDER[minimum]) {
          errors.push(`Relation sensitivity below endpoint sensitivity: ${id}`);
        }
      }
    }
    return errors.sort();
  }

  private resolveResourceForScope(idOrUri: string, scope: AuthorityAgenticScope): AuthorityAgenticResource | null {
    const id = this.currentResources.has(idOrUri) ? idOrUri : this.uriToId.get(idOrUri);
    if (!id) return null;
    const knownAt = scope.knownAt ? canonicalInstant(scope.knownAt, 'knownAt') : null;
    const resource = knownAt === null
      ? this.currentResources.get(id)
      : revisionAt(this.resourceHistories.get(id) || [], knownAt);
    if (!resource) return null;
    const asOf = scope.asOf ? canonicalInstant(scope.asOf, 'asOf') : Date.now();
    if (!resourceScopeMatches(resource, scope) || !domainVisible(resource, asOf)) return null;
    if (!isReadable(resource.sensitivity, scope.maxSensitivity ?? 'internal')) return null;
    return cloneResource(resource);
  }

  private requireCurrentResource(idOrUri: string): AuthorityAgenticResource {
    const id = this.currentResources.has(idOrUri) ? idOrUri : this.uriToId.get(idOrUri);
    const resource = id ? this.currentResources.get(id) : undefined;
    if (!resource) throw new Error(`Authority agentic resource ${idOrUri} not found`);
    return resource;
  }

  private projectResourceIds(projectId: string, includeGlobal: boolean): string[] {
    const normalized = nonEmpty(projectId, 'scope projectId');
    const ids = new Set(this.byProject.get(normalized) || []);
    if (includeGlobal) for (const id of this.globalResources) ids.add(id);
    return Array.from(ids);
  }

  private fullCurrentResources(): AuthorityAgenticResource[] {
    return Array.from(this.currentResources.values(), cloneResource).sort((a, b) => a.id.localeCompare(b.id));
  }

  private fullCurrentRelations(): AuthorityAgenticRelation[] {
    return Array.from(this.currentRelations.values(), cloneRelation).sort((a, b) => a.id.localeCompare(b.id));
  }

  private closeResourceRevision(current: AuthorityAgenticResource, systemUntil: string): void {
    const history = this.resourceHistories.get(current.id)!;
    const closedBase: Omit<AuthorityAgenticResource, 'contentHash'> = {
      ...withoutResourceHash(current),
      systemUntil,
      metadata: cloneJson(current.metadata),
    };
    history[history.length - 1] = sealResource(closedBase);
  }

  private closeRelationRevision(current: AuthorityAgenticRelation, systemUntil: string): void {
    const history = this.relationHistories.get(current.id)!;
    const closedBase: Omit<AuthorityAgenticRelation, 'contentHash'> = {
      ...withoutRelationHash(current),
      systemUntil,
      metadata: cloneJson(current.metadata),
    };
    history[history.length - 1] = sealRelation(closedBase);
  }

  private assertIncidentRelationSensitivity(resourceId: string, nextSensitivity: AgenticSensitivity): void {
    const relationIds = new Set([
      ...(this.outgoing.get(resourceId) || []),
      ...(this.incoming.get(resourceId) || []),
    ]);
    for (const id of relationIds) {
      const relation = this.currentRelations.get(id);
      if (!relation) continue;
      const otherId = relation.from === resourceId ? relation.to : relation.from;
      const other = this.currentResources.get(otherId);
      if (!other) throw new Error(`DANGLING_AUTHORITY_RELATION id=${id}`);
      const required = maxSensitivity(nextSensitivity, other.sensitivity);
      if (SENSITIVITY_ORDER[relation.sensitivity] < SENSITIVITY_ORDER[required]) {
        throw new Error(`RELATION_RECLASSIFICATION_REQUIRED relation=${id} required=${required}`);
      }
    }
  }

  private assertProjectionVersion(expected?: number): void {
    if (expected === undefined) return;
    if (!Number.isSafeInteger(expected) || expected < 0) {
      throw new Error('expectedProjectionVersion must be a non-negative safe integer');
    }
    if (expected !== this.projectionVersionValue) {
      throw new Error(`STALE_AGENTIC_PROJECTION expected=${expected} current=${this.projectionVersionValue}`);
    }
  }
}

function normalizeResourceInput(input: AuthorityAgenticResourceInput): NormalizedResourceInput {
  const normalized: NormalizedResourceInput = {
    identity: { ...input.identity },
    type: input.type,
    title: nonEmpty(input.title, 'resource title'),
    projectId: normalizeOptionalString(input.projectId),
    status: nonEmpty(input.status ?? 'active', 'resource status'),
    sensitivity: input.sensitivity ?? 'internal',
    provenanceRef: nonEmpty(input.provenanceRef, 'resource provenanceRef'),
    validFrom: canonicalOptionalTime(input.validFrom, 'resource validFrom'),
    validUntil: canonicalNullableTime(input.validUntil, 'resource validUntil'),
    observedAt: canonicalOptionalTime(input.observedAt, 'resource observedAt'),
    recordedAt: canonicalTime(input.recordedAt, 'resource recordedAt'),
    metadata: canonicalMetadata(input.metadata || {}),
  };
  validateTemporal(normalized.validFrom, normalized.validUntil, normalized.observedAt, normalized.recordedAt);
  return normalized;
}

function deriveRelationProjectId(explicit: string | undefined, source?: string, target?: string): string | undefined {
  const normalizedExplicit = normalizeOptionalString(explicit);
  if (source && target && source !== target) {
    throw new Error(`CROSS_PROJECT_RELATION_REQUIRES_GOVERNED_BRIDGE source=${source} target=${target}`);
  }
  const derived = source || target;
  if (normalizedExplicit && derived && normalizedExplicit !== derived) {
    throw new Error(`RELATION_PROJECT_SCOPE_CONFLICT explicit=${normalizedExplicit} endpoint=${derived}`);
  }
  return normalizedExplicit || derived;
}

function revisionAt<T extends { systemFrom: string; systemUntil: string | null }>(history: T[], knownAt: number): T | undefined {
  return history.find(revision => {
    const from = Date.parse(revision.systemFrom);
    const until = revision.systemUntil === null ? Number.POSITIVE_INFINITY : Date.parse(revision.systemUntil);
    return knownAt >= from && knownAt < until;
  });
}

function validateHistory<T extends { revision: number; systemFrom: string; systemUntil: string | null; contentHash: string }>(
  history: T[],
  label: string,
  expectedHash: (revision: T) => string,
  errors: string[],
): void {
  if (history.length === 0) { errors.push(`${label} has no revisions`); return; }
  for (let index = 0; index < history.length; index += 1) {
    const revision = history[index];
    if (revision.revision !== index + 1) errors.push(`${label} revision sequence mismatch at ${index}`);
    if (!Number.isFinite(Date.parse(revision.systemFrom))) errors.push(`${label} has invalid systemFrom at revision ${revision.revision}`);
    if (revision.contentHash !== expectedHash(revision)) errors.push(`${label} content hash mismatch at revision ${revision.revision}`);
    if (index < history.length - 1) {
      const next = history[index + 1];
      if (revision.systemUntil !== next.systemFrom) errors.push(`${label} system-time interval gap/overlap at revision ${revision.revision}`);
    } else if (revision.systemUntil !== null) {
      errors.push(`${label} current revision is closed`);
    }
  }
}

function resourceInputHash(id: string, uri: string, input: NormalizedResourceInput): string {
  return stableHash128({
    id,
    canonicalUri: uri,
    type: input.type,
    title: input.title,
    projectId: input.projectId || null,
    status: input.status,
    sensitivity: input.sensitivity,
    provenanceRef: input.provenanceRef,
    validFrom: input.validFrom || null,
    validUntil: input.validUntil ?? null,
    observedAt: input.observedAt || null,
    systemFrom: input.recordedAt,
    metadata: input.metadata,
  });
}

function resourceCreateHash(resource: AuthorityAgenticResource): string {
  return stableHash128({
    id: resource.id,
    canonicalUri: resource.canonicalUri,
    type: resource.type,
    title: resource.title,
    projectId: resource.projectId || null,
    status: resource.status,
    sensitivity: resource.sensitivity,
    provenanceRef: resource.provenanceRef,
    validFrom: resource.validFrom || null,
    validUntil: resource.validUntil ?? null,
    observedAt: resource.observedAt || null,
    systemFrom: resource.systemFrom,
    metadata: resource.metadata,
  });
}

function relationInputHash(input: {
  id: string;
  identityKey: string;
  type: AgenticRelationType;
  from: string;
  to: string;
  projectId?: string;
  confidence: number;
  sensitivity: AgenticSensitivity;
  provenanceRef: string;
  validFrom?: string;
  validUntil?: string | null;
  systemFrom: string;
  metadata: Record<string, unknown>;
}): string {
  return stableHash128({
    ...input,
    projectId: input.projectId || null,
    validFrom: input.validFrom || null,
    validUntil: input.validUntil ?? null,
  });
}

function relationCreateHash(relation: AuthorityAgenticRelation): string {
  return relationInputHash({
    id: relation.id,
    identityKey: relation.identityKey,
    type: relation.type,
    from: relation.from,
    to: relation.to,
    projectId: relation.projectId,
    confidence: relation.confidence,
    sensitivity: relation.sensitivity,
    provenanceRef: relation.provenanceRef,
    validFrom: relation.validFrom,
    validUntil: relation.validUntil,
    systemFrom: relation.systemFrom,
    metadata: relation.metadata,
  });
}

function sealResource(base: Omit<AuthorityAgenticResource, 'contentHash'>): AuthorityAgenticResource {
  return { ...base, metadata: cloneJson(base.metadata), contentHash: resourceHash(base) };
}
function sealRelation(base: Omit<AuthorityAgenticRelation, 'contentHash'>): AuthorityAgenticRelation {
  return { ...base, metadata: cloneJson(base.metadata), contentHash: relationHash(base) };
}
function resourceHash(resource: Omit<AuthorityAgenticResource, 'contentHash'>): string { return stableHash128(resource); }
function relationHash(relation: Omit<AuthorityAgenticRelation, 'contentHash'>): string { return stableHash128(relation); }
function withoutResourceHash(resource: AuthorityAgenticResource): Omit<AuthorityAgenticResource, 'contentHash'> {
  const { contentHash: _contentHash, ...rest } = resource;
  return { ...rest, metadata: cloneJson(rest.metadata) };
}
function withoutRelationHash(relation: AuthorityAgenticRelation): Omit<AuthorityAgenticRelation, 'contentHash'> {
  const { contentHash: _contentHash, ...rest } = relation;
  return { ...rest, metadata: cloneJson(rest.metadata) };
}

function canonicalScope(scope: AuthorityAgenticScope): Record<string, unknown> {
  return {
    projectId: normalizeOptionalString(scope.projectId) || null,
    includeGlobal: Boolean(scope.includeGlobal),
    maxSensitivity: scope.maxSensitivity ?? 'internal',
    asOf: canonicalTime(scope.asOf!, 'scope asOf'),
    knownAt: canonicalTime(scope.knownAt!, 'scope knownAt'),
  };
}
function resourceScopeMatches(resource: AuthorityAgenticResource, scope: AuthorityAgenticScope): boolean {
  if (!scope.projectId) return true;
  if (resource.projectId === scope.projectId) return true;
  return Boolean(scope.includeGlobal && resource.projectId === undefined);
}
function relationScopeMatches(relation: AuthorityAgenticRelation, scope: AuthorityAgenticScope): boolean {
  if (!scope.projectId) return true;
  if (relation.projectId === scope.projectId) return true;
  return Boolean(scope.includeGlobal && relation.projectId === undefined);
}
function domainVisible(value: { validFrom?: string; validUntil?: string | null }, asOf: number): boolean {
  if (value.validFrom && Date.parse(value.validFrom) > asOf) return false;
  if (value.validUntil && Date.parse(value.validUntil) <= asOf) return false;
  return true;
}
function validateTemporal(validFrom?: string, validUntil?: string | null, observedAt?: string, recordedAt?: string): void {
  if (validFrom && validUntil && Date.parse(validUntil) <= Date.parse(validFrom)) {
    throw new Error('validUntil must be strictly after validFrom');
  }
  if (observedAt && recordedAt && Date.parse(recordedAt) < Date.parse(observedAt)) {
    throw new Error('recordedAt cannot precede observedAt');
  }
}

function canonicalMetadata(value: Record<string, unknown>): Record<string, unknown> {
  assertCanonicalJson(value, 'metadata');
  return cloneJson(value);
}
function cloneJson<T>(value: T): T { return structuredClone(value); }
function cloneResource(resource: AuthorityAgenticResource): AuthorityAgenticResource {
  return { ...resource, metadata: cloneJson(resource.metadata) };
}
function cloneRelation(relation: AuthorityAgenticRelation): AuthorityAgenticRelation {
  return { ...relation, metadata: cloneJson(relation.metadata) };
}
function indexAdd<K>(index: Map<K, Set<string>>, key: K, id: string): void {
  let bucket = index.get(key);
  if (!bucket) { bucket = new Set<string>(); index.set(key, bucket); }
  bucket.add(id);
}
function resourcePrefix(type: AgenticResourceType): string { return `a${type.replace(/[^a-z0-9]/g, '').slice(0, 5)}`; }
function normalizeOptionalString(value?: string): string | undefined { const normalized = value?.trim(); return normalized || undefined; }
function nonEmpty(value: string, label: string): string { const normalized = value.trim(); if (!normalized) throw new Error(`${label} must not be empty`); return normalized; }
function canonicalInstant(value: string, label: string): number { const parsed = Date.parse(value); if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`); return parsed; }
function canonicalTime(value: string, label: string): string { return new Date(canonicalInstant(value, label)).toISOString(); }
function canonicalOptionalTime(value: string | undefined, label: string): string | undefined { return value === undefined ? undefined : canonicalTime(value, label); }
function canonicalNullableTime(value: string | null | undefined, label: string): string | null | undefined {
  if (value === undefined || value === null) return value;
  return canonicalTime(value, label);
}
function assertNextSystemTime(current: string, next: string, label: string): void {
  if (Date.parse(next) <= Date.parse(current)) throw new Error(`${label} recordedAt must be strictly greater than current systemFrom`);
}
function assertUnitInterval(value: number, label: string): void { if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be in [0,1]`); }
function assertExpectedRevision(kind: string, id: string, expected: number, current: number): void {
  if (!Number.isSafeInteger(expected) || expected < 1) throw new Error('expectedRevision must be a positive safe integer');
  if (expected !== current) throw new Error(`STALE_AGENTIC_${kind.toUpperCase()}_REVISION id=${id} expected=${expected} current=${current}`);
}
function maxSensitivity(left: AgenticSensitivity, right: AgenticSensitivity): AgenticSensitivity {
  return SENSITIVITY_ORDER[left] >= SENSITIVITY_ORDER[right] ? left : right;
}
function isReadable(value: AgenticSensitivity, maximum: AgenticSensitivity): boolean {
  return SENSITIVITY_ORDER[value] <= SENSITIVITY_ORDER[maximum];
}

function assertCanonicalJson(value: unknown, path: string, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error(`${path} contains non-finite number`); return; }
  if (typeof value !== 'object') throw new Error(`${path} contains unsupported ${typeof value}`);
  if (seen.has(value as object)) throw new Error(`${path} contains a cycle`);
  seen.add(value as object);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertCanonicalJson(item, `${path}[${index}]`, seen));
    seen.delete(value as object);
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${path} contains a non-plain object`);
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    assertCanonicalJson(item, `${path}.${key}`, seen);
  }
  seen.delete(value as object);
}
