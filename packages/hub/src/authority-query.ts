import { stableHash128 } from '@cos/core';
import {
  AuthorityAgenticRegistry,
  type AuthorityAgenticNeighborhood,
  type AuthorityAgenticRelation,
  type AuthorityAgenticResource,
} from './authority-agentic-registry';
import type {
  AgenticRelationType,
  AgenticResourceType,
  AgenticSensitivity,
} from './agentic-registry';

export interface AuthorityProjectQueryOptions {
  asOf: string;
  knownAt: string;
  maxSensitivity?: AgenticSensitivity;
  includeGlobal?: boolean;
}

export interface AuthorityProjectRuntimeView {
  projectId: string;
  asOf: string;
  knownAt: string;
  maxSensitivity: AgenticSensitivity;
  includeGlobal: boolean;
  projectionVersion: number;
  projectionHash: string;
  project: AuthorityAgenticResource | null;
  workstreams: AuthorityAgenticResource[];
  tasks: AuthorityAgenticResource[];
  decisions: AuthorityAgenticResource[];
  artifacts: AuthorityAgenticResource[];
  memories: AuthorityAgenticResource[];
  chats: AuthorityAgenticResource[];
  sessions: AuthorityAgenticResource[];
  agentRuns: AuthorityAgenticResource[];
  risks: AuthorityAgenticResource[];
  gates: AuthorityAgenticResource[];
  checkpoints: AuthorityAgenticResource[];
  repositories: AuthorityAgenticResource[];
  openLoops: AuthorityAgenticResource[];
  relations: AuthorityAgenticRelation[];
}

export interface AuthorityBlastRadiusView {
  startId: string;
  asOf: string;
  knownAt: string;
  resources: AuthorityAgenticResource[];
  relations: AuthorityAgenticRelation[];
  affectedProjects: string[];
  affectedTasks: string[];
  affectedArtifacts: string[];
  affectedRisks: string[];
  projectionHash: string;
}

/**
 * Query façade over `AuthorityAgenticRegistry`.
 *
 * Authority queries require both domain-valid time (`asOf`) and system-knowledge
 * time (`knownAt`). No wall clock is synthesized inside this service.
 */
export class AuthorityHubQueryService {
  constructor(private readonly registry: AuthorityAgenticRegistry) {}

  projectRuntime(projectId: string, options: AuthorityProjectQueryOptions): AuthorityProjectRuntimeView {
    const project = nonEmpty(projectId, 'projectId');
    const asOf = canonicalTime(options.asOf, 'asOf');
    const knownAt = canonicalTime(options.knownAt, 'knownAt');
    const maxSensitivity = options.maxSensitivity ?? 'internal';
    const includeGlobal = options.includeGlobal ?? false;
    const scope = { projectId: project, asOf, knownAt, maxSensitivity, includeGlobal };
    const resources = this.registry.listResources(scope);
    const relations = this.registry.listRelations(scope);
    const byType = (type: AgenticResourceType): AuthorityAgenticResource[] =>
      resources.filter(resource => resource.type === type);
    const openLoops = resources.filter(isOpenLoop).sort(compareResourcePriority);

    return {
      projectId: project,
      asOf,
      knownAt,
      maxSensitivity,
      includeGlobal,
      projectionVersion: this.registry.projectionVersion,
      projectionHash: this.registry.projectionHash(scope),
      project: byType('project')[0] ?? null,
      workstreams: byType('workstream'),
      tasks: byType('task'),
      decisions: byType('decision'),
      artifacts: byType('artifact'),
      memories: byType('memory'),
      chats: byType('chat'),
      sessions: byType('session'),
      agentRuns: byType('agent_run'),
      risks: byType('risk'),
      gates: byType('release_gate'),
      checkpoints: byType('checkpoint'),
      repositories: byType('repository'),
      openLoops,
      relations,
    };
  }

  openLoops(projectId: string, options: AuthorityProjectQueryOptions): AuthorityAgenticResource[] {
    return this.projectRuntime(projectId, options).openLoops;
  }

  neighborhood(
    startIdOrUri: string,
    options: AuthorityProjectQueryOptions & {
      projectId?: string;
      depth?: number;
      relationTypes?: AgenticRelationType[];
    },
  ): AuthorityAgenticNeighborhood {
    const depth = options.depth ?? 2;
    return this.registry.neighborhood(
      nonEmpty(startIdOrUri, 'startIdOrUri'),
      depth,
      {
        projectId: options.projectId,
        includeGlobal: options.includeGlobal ?? false,
        maxSensitivity: options.maxSensitivity ?? 'internal',
        asOf: canonicalTime(options.asOf, 'asOf'),
        knownAt: canonicalTime(options.knownAt, 'knownAt'),
      },
      options.relationTypes,
    );
  }

  blastRadius(
    startIdOrUri: string,
    options: AuthorityProjectQueryOptions & { projectId?: string; depth?: number },
  ): AuthorityBlastRadiusView {
    const asOf = canonicalTime(options.asOf, 'asOf');
    const knownAt = canonicalTime(options.knownAt, 'knownAt');
    const graph = this.neighborhood(startIdOrUri, {
      ...options,
      asOf,
      knownAt,
      depth: options.depth ?? 4,
      relationTypes: [
        'depends_on', 'blocks', 'derived_from', 'produced', 'uses',
        'supersedes', 'contradicts', 'current_state_of', 'governed_by',
      ],
    });
    const affectedProjects = Array.from(new Set(
      graph.resources.map(resource => resource.projectId).filter((id): id is string => Boolean(id)),
    )).sort();
    const affectedTasks = graph.resources.filter(resource => resource.type === 'task').map(resource => resource.id).sort();
    const affectedArtifacts = graph.resources.filter(resource => resource.type === 'artifact').map(resource => resource.id).sort();
    const affectedRisks = graph.resources.filter(resource => resource.type === 'risk').map(resource => resource.id).sort();
    return {
      startId: nonEmpty(startIdOrUri, 'startIdOrUri'),
      asOf,
      knownAt,
      resources: graph.resources,
      relations: graph.relations,
      affectedProjects,
      affectedTasks,
      affectedArtifacts,
      affectedRisks,
      projectionHash: stableHash128({
        startId: startIdOrUri,
        asOf,
        knownAt,
        resources: graph.resources,
        relations: graph.relations,
      }),
    };
  }

  provenancePath(
    startIdOrUri: string,
    options: AuthorityProjectQueryOptions & { projectId?: string; depth?: number },
  ): AuthorityAgenticNeighborhood {
    return this.neighborhood(startIdOrUri, {
      ...options,
      depth: options.depth ?? 5,
      relationTypes: [
        'references', 'derived_from', 'provenance_of', 'evidence_for',
        'created_by', 'produced', 'version_of', 'supersedes',
      ],
    });
  }
}

function isOpenLoop(resource: AuthorityAgenticResource): boolean {
  const status = resource.status.toLowerCase();
  if (resource.type === 'task') return !['done', 'completed', 'closed', 'cancelled', 'rejected'].includes(status);
  if (resource.type === 'risk') return !['mitigated', 'resolved', 'accepted', 'closed'].includes(status);
  if (resource.type === 'release_gate') return !['pass', 'passed', 'complete', 'completed', 'waived'].includes(status);
  if (resource.type === 'checkpoint') return ['blocked', 'failed', 'pending', 'degraded'].includes(status);
  return false;
}

function compareResourcePriority(left: AuthorityAgenticResource, right: AuthorityAgenticResource): number {
  return priority(right) - priority(left) || left.id.localeCompare(right.id);
}

function priority(resource: AuthorityAgenticResource): number {
  const value = resource.metadata.priority;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.toUpperCase();
    if (normalized === 'P0') return 100;
    if (normalized === 'P1') return 80;
    if (normalized === 'P2') return 60;
    if (normalized === 'P3') return 40;
  }
  return resource.type === 'release_gate' ? 90 : resource.type === 'risk' ? 70 : 50;
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}
