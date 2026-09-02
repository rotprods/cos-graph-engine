export type ExternalFramework = 'langchain' | 'langgraph' | 'crewai' | 'openai-agents' | 'mcp';

export interface COSExternalTaskDefinition {
  id: string;
  name: string;
  dependsOn: string[];
  assignedActor?: string;
  metadata?: Record<string, unknown>;
}

export interface COSExternalWorkflowDefinition {
  id: string;
  name: string;
  framework: ExternalFramework;
  actors: Array<{ id: string; name: string; role?: string }>;
  tasks: COSExternalTaskDefinition[];
  importedAt: string;
  sourceMetadata: Record<string, unknown>;
}

export interface COSContextPack {
  query?: string;
  taskId?: string;
  evidenceIds: string[];
  facts: Array<{ id: string; text: string; truthClass: string }>;
  unresolvedGaps: string[];
  toolCapabilities: string[];
  sensitivity: 'PUBLIC' | 'INTERNAL' | 'RESTRICTED_FINANCIAL';
}

export interface ExternalRunEnvelope {
  runId: string;
  framework: ExternalFramework;
  workflowId?: string;
  actorId?: string;
  startedAt?: string;
  completedAt?: string;
  output: unknown;
  trace?: unknown;
  metadata?: Record<string, unknown>;
}

export interface RuntimeObservation {
  observationId: string;
  framework: ExternalFramework;
  runId: string;
  observedAt: string;
  payload: unknown;
  trace?: unknown;
  canonicalTruth: false;
  requiresValidation: true;
  sourceClass: 'EXTERNAL_RUNTIME_OBSERVATION';
}

export interface ExternalAgentRuntimeAdapter {
  readonly framework: ExternalFramework;
  importDefinition(input: unknown): COSExternalWorkflowDefinition;
  exportContext(context: COSContextPack): Record<string, unknown>;
  ingestRunResult(run: ExternalRunEnvelope): RuntimeObservation;
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('External framework definition must be an object.');
  }
  return input as Record<string, unknown>;
}

function toArray(input: unknown): unknown[] {
  return Array.isArray(input) ? input : [];
}

function valueString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function normalizeActors(record: Record<string, unknown>): Array<{ id: string; name: string; role?: string }> {
  const source = toArray(record.agents ?? record.actors ?? record.crew);
  return source.map((item, index) => {
    const actor = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
    return {
      id: valueString(actor.id, `external-actor-${index + 1}`),
      name: valueString(actor.name ?? actor.label, `External Actor ${index + 1}`),
      role: typeof actor.role === 'string' ? actor.role : undefined,
    };
  });
}

function normalizeTasks(record: Record<string, unknown>): COSExternalTaskDefinition[] {
  const source = toArray(record.tasks ?? record.nodes ?? record.steps);
  return source.map((item, index) => {
    const task = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
    const dependsRaw = task.dependsOn ?? task.dependencies ?? task.after;
    const dependsOn = Array.isArray(dependsRaw)
      ? dependsRaw.map(v => String(v))
      : typeof dependsRaw === 'string' && dependsRaw
        ? [dependsRaw]
        : [];
    return {
      id: valueString(task.id, `external-task-${index + 1}`),
      name: valueString(task.name ?? task.label ?? task.description, `External Task ${index + 1}`),
      dependsOn,
      assignedActor: typeof (task.actor ?? task.agent ?? task.assignee) === 'string'
        ? String(task.actor ?? task.agent ?? task.assignee)
        : undefined,
      metadata: { ...task },
    };
  });
}

/**
 * Dependency-free interoperability adapter.
 *
 * It deliberately treats external framework output as an observation only.
 * External memory, task status or model output cannot become canonical COS truth
 * without downstream evidence/policy validation.
 */
export class GenericExternalRuntimeAdapter implements ExternalAgentRuntimeAdapter {
  readonly framework: ExternalFramework;

  constructor(framework: ExternalFramework) {
    this.framework = framework;
  }

  importDefinition(input: unknown): COSExternalWorkflowDefinition {
    const record = asRecord(input);
    const id = valueString(record.id, `${this.framework}-workflow`);
    const name = valueString(record.name ?? record.title, `${this.framework} workflow`);
    return {
      id,
      name,
      framework: this.framework,
      actors: normalizeActors(record),
      tasks: normalizeTasks(record),
      importedAt: new Date().toISOString(),
      sourceMetadata: { ...record },
    };
  }

  exportContext(context: COSContextPack): Record<string, unknown> {
    return {
      cosContextVersion: '1',
      framework: this.framework,
      query: context.query,
      taskId: context.taskId,
      evidenceIds: [...context.evidenceIds],
      facts: context.facts.map(f => ({ ...f })),
      unresolvedGaps: [...context.unresolvedGaps],
      toolCapabilities: [...context.toolCapabilities],
      sensitivity: context.sensitivity,
      policy: {
        canonicalStateOwner: 'COS',
        externalOutputClass: 'OBSERVATION_ONLY',
        legalTruthMutationAllowed: false,
      },
    };
  }

  ingestRunResult(run: ExternalRunEnvelope): RuntimeObservation {
    if (run.framework !== this.framework) {
      throw new Error(`Adapter ${this.framework} cannot ingest ${run.framework} run ${run.runId}`);
    }
    return {
      observationId: `${this.framework}:${run.runId}:observation`,
      framework: this.framework,
      runId: run.runId,
      observedAt: new Date().toISOString(),
      payload: structuredClone(run.output),
      trace: structuredClone(run.trace),
      canonicalTruth: false,
      requiresValidation: true,
      sourceClass: 'EXTERNAL_RUNTIME_OBSERVATION',
    };
  }
}

export class LangChainAdapter extends GenericExternalRuntimeAdapter {
  constructor() { super('langchain'); }
}

export class LangGraphAdapter extends GenericExternalRuntimeAdapter {
  constructor() { super('langgraph'); }
}

export class CrewAIAdapter extends GenericExternalRuntimeAdapter {
  constructor() { super('crewai'); }
}

export class OpenAIAgentsAdapter extends GenericExternalRuntimeAdapter {
  constructor() { super('openai-agents'); }
}

export class MCPRuntimeAdapter extends GenericExternalRuntimeAdapter {
  constructor() { super('mcp'); }
}
