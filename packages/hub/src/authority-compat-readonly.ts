import type {
  AgenticRelation,
  AgenticResource,
} from './agentic-registry';
import type {
  AuthorityAgenticRegistry,
  AuthorityAgenticScope,
} from './authority-agentic-registry';
import type { AuthorityHub } from './authority-hub';
import type { HubRepository } from './hub';

export interface LegacyAgenticReadSnapshot {
  projectionVersion: number;
  projectionHash: string;
  resources: AgenticResource[];
  relations: AgenticRelation[];
}

/**
 * Pure read adapter for callers that still consume legacy AgenticResource shapes.
 * It cannot mutate the authority registry and returns detached data only.
 */
export function authorityAgenticToLegacyReadSnapshot(
  registry: AuthorityAgenticRegistry,
  scope: AuthorityAgenticScope,
): LegacyAgenticReadSnapshot {
  if (!scope.asOf || !scope.knownAt) {
    throw new Error('Legacy authority read snapshot requires explicit asOf and knownAt');
  }
  const resources = registry.listResources(scope).map(resource => ({
    id: resource.id,
    canonicalUri: resource.canonicalUri,
    type: resource.type,
    title: resource.title,
    projectId: resource.projectId,
    status: resource.status,
    sensitivity: resource.sensitivity,
    provenanceRef: resource.provenanceRef,
    validFrom: resource.validFrom,
    validUntil: resource.validUntil,
    observedAt: resource.observedAt,
    recordedAt: resource.systemFrom,
    metadata: structuredClone(resource.metadata),
  }));
  const relations = registry.listRelations(scope).map(relation => ({
    id: relation.id,
    type: relation.type,
    from: relation.from,
    to: relation.to,
    projectId: relation.projectId,
    confidence: relation.confidence,
    sensitivity: relation.sensitivity,
    provenanceRef: relation.provenanceRef,
    validFrom: relation.validFrom,
    validUntil: relation.validUntil,
    recordedAt: relation.systemFrom,
    metadata: structuredClone(relation.metadata),
  }));
  return {
    projectionVersion: registry.projectionVersion,
    projectionHash: registry.projectionHash(scope),
    resources,
    relations,
  };
}

/**
 * Read-only repository compatibility view. State/revision/hash remain owned by
 * AuthorityHub; this function intentionally exposes only the legacy repository
 * shape and no mutation API.
 */
export function authorityHubToLegacyRepositorySnapshot(hub: AuthorityHub): HubRepository[] {
  return hub.listRepositories().map(repository => ({
    id: repository.id,
    canonicalUri: repository.canonicalUri,
    owner: repository.owner,
    name: repository.name,
    fullName: repository.fullName,
    state: repository.state,
    metadata: structuredClone(repository.metadata),
  }));
}
