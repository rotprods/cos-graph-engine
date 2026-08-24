import { stableHash128 } from '@cos/core';
import {
  AgenticResourceRegistry,
  type AgenticGraphScope,
  type AgenticNeighborhood,
  type AgenticRelation,
  type AgenticRelationType,
  type AgenticResource,
  type AgenticSensitivity,
} from './agentic-registry';

export interface ProjectRuntimeView {
  projectId: string;
  asOf: string;
  maxSensitivity: AgenticSensitivity;
  project: AgenticResource | null;
  workstreams: AgenticResource[];
  tasks: AgenticResource[];
  decisions: AgenticResource[];
  artifacts: AgenticResource[];
  agents: AgenticResource[];
  risks: AgenticResource[];
  gates: AgenticResource[];
  openLoops: AgenticResource[];
  relations: AgenticRelation[];
  projectionHash: string;
}

export interface BlastRadiusView {
  startId: string;
  resources: AgenticResource[];
  relations: AgenticRelation[];
  affectedProjects: string[];
  affectedTasks: string[];
  affectedArtifacts: string[];
  projectionHash: string;
}

/** Bounded query façade over the canonical AgenticResourceRegistry. */
export class HubQueryService {
  constructor(private readonly registry: AgenticResourceRegistry) {}

  projectRuntime(
    projectId: string,
    options: { asOf?: string; maxSensitivity?: AgenticSensitivity } = {},
  ): ProjectRuntimeView {
    const project = projectId.trim();
    if (!project) throw new Error('projectId must not be empty');
    const asOf = options.asOf || new Date().toISOString();
    if (!Number.isFinite(Date.parse(asOf))) throw new Error(`Invalid asOf '${asOf}'`);
    const maxSensitivity = options.maxSensitivity || 'internal';
    const scope: AgenticGraphScope = { projectId: project, asOf, maxSensitivity };
    const resources = this.registry.listResources(scope);
    const relations = this.registry.listRelations(scope);
    const byType = (type: AgenticResource['type']) => resources.filter(resource => resource.type === type);
    const tasks = byType('task');
    const risks = byType('risk');
    const gates = byType('release_gate');
    const openLoops = resources
      .filter(resource => isOpenLoop(resource))
      .sort(compareResourcePriority);

    return {
      projectId: project,
      asOf,
      maxSensitivity,
      project: byType('project')[0] || null,
      workstreams: byType('workstream'),
      tasks,
      decisions: byType('decision'),
      artifacts: byType('artifact'),
      agents: byType('agent_run'),
      risks,
      gates,
      openLoops,
      relations,
      projectionHash: this.registry.projectionHash(scope),
    };
  }

  openLoops(
    projectId: string,
    options: { asOf?: string; maxSensitivity?: AgenticSensitivity } = {},
  ): AgenticResource[] {
    return this.projectRuntime(projectId, options).openLoops;
  }

  neighborhood(
    startId: string,
    options: {
      depth?: number;
      projectId?: string;
      asOf?: string;
      maxSensitivity?: AgenticSensitivity;
      relationTypes?: AgenticRelationType[];
    } = {},
  ): AgenticNeighborhood {
    return this.registry.neighborhood(
      startId,
      options.depth ?? 2,
      {
        projectId: options.projectId,
        asOf: options.asOf,
        maxSensitivity: options.maxSensitivity,
      },
      options.relationTypes,
    );
  }

  blastRadius(
    startId: string,
    options: {
      depth?: number;
      projectId?: string;
      asOf?: string;
      maxSensitivity?: AgenticSensitivity;
    } = {},
  ): BlastRadiusView {
    const graph = this.neighborhood(startId, {
      ...options,
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
    return {
      startId,
      resources: graph.resources,
      relations: graph.relations,
      affectedProjects,
      affectedTasks,
      affectedArtifacts,
      projectionHash: stableHash128({
        startId,
        resources: graph.resources,
        relations: graph.relations,
      }),
    };
  }

  provenancePath(
    startId: string,
    options: {
      depth?: number;
      projectId?: string;
      asOf?: string;
      maxSensitivity?: AgenticSensitivity;
    } = {},
  ): AgenticNeighborhood {
    return this.neighborhood(startId, {
      ...options,
      depth: options.depth ?? 5,
      relationTypes: [
        'references', 'derived_from', 'provenance_of', 'evidence_for',
        'created_by', 'produced', 'version_of', 'supersedes',
      ],
    });
  }
}

function isOpenLoop(resource: AgenticResource): boolean {
  const status = resource.status.toLowerCase();
  if (resource.type === 'task') {
    return !['done', 'completed', 'closed', 'cancelled', 'rejected'].includes(status);
  }
  if (resource.type === 'risk') {
    return !['mitigated', 'resolved', 'accepted', 'closed'].includes(status);
  }
  if (resource.type === 'release_gate') {
    return !['pass', 'passed', 'complete', 'completed', 'waived'].includes(status);
  }
  if (resource.type === 'checkpoint') {
    return ['blocked', 'failed', 'pending', 'degraded'].includes(status);
  }
  return false;
}

function compareResourcePriority(a: AgenticResource, b: AgenticResource): number {
  const priority = (resource: AgenticResource) => {
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
  };
  return priority(b) - priority(a) || a.id.localeCompare(b.id);
}
