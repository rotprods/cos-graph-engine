import {
  canonicalIdentity,
  IdentityRegistry,
  stableHash128,
  type EntityId,
} from '@cos/core';
import {
  KnowledgeGraphEngine,
  VersionedStateMachine,
  AgentGraphEngine,
  WorkflowGraphEngine,
  GraphStream,
  type GraphPatch,
} from '@cos/graph';
import {
  InMemoryEventLog,
  type DurableEvent,
  type EventLogCursor,
  type IEventLog,
} from '@cos/runtime';

export type RepoState = 'PENDING' | 'DEV' | 'LIVE' | 'BLOCKED' | 'DEAD';
export type RepoEvent =
  | 'init'
  | 'change'
  | 'build_failed'
  | 'build_recovered'
  | 'deployment_started'
  | 'deployment_succeeded'
  | 'deployment_failed'
  | 'archive';

const REPO_STATES: RepoState[] = ['PENDING', 'DEV', 'LIVE', 'BLOCKED', 'DEAD'];
const REPO_TRANSITIONS: Array<{ from: RepoState; to: RepoState; event: RepoEvent }> = [
  { from: 'PENDING', to: 'DEV', event: 'init' },
  { from: 'DEV', to: 'DEV', event: 'change' },
  { from: 'LIVE', to: 'DEV', event: 'change' },
  { from: 'DEV', to: 'BLOCKED', event: 'build_failed' },
  { from: 'LIVE', to: 'BLOCKED', event: 'build_failed' },
  { from: 'BLOCKED', to: 'DEV', event: 'build_recovered' },
  { from: 'DEV', to: 'DEV', event: 'deployment_started' },
  { from: 'LIVE', to: 'LIVE', event: 'deployment_started' },
  { from: 'DEV', to: 'LIVE', event: 'deployment_succeeded' },
  { from: 'LIVE', to: 'LIVE', event: 'deployment_succeeded' },
  { from: 'DEV', to: 'BLOCKED', event: 'deployment_failed' },
  { from: 'LIVE', to: 'BLOCKED', event: 'deployment_failed' },
  { from: 'BLOCKED', to: 'BLOCKED', event: 'deployment_failed' },
  { from: 'DEV', to: 'DEAD', event: 'archive' },
  { from: 'LIVE', to: 'DEAD', event: 'archive' },
  { from: 'BLOCKED', to: 'DEAD', event: 'archive' },
];

export interface HubRepository {
  id: string;
  canonicalUri: string;
  owner: string;
  name: string;
  fullName: string;
  state: RepoState;
  stateRevision: number;
  metadata: Record<string, unknown>;
}

export interface RepoEventContext {
  idempotencyKey: string;
  correlationId: string;
  sourceRef: string;
  occurredAt?: string;
  actor?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface RepoEventResult {
  repoId: string;
  event: RepoEvent;
  previousState: RepoState;
  state: RepoState;
  previousRevision: number;
  revision: number;
  stateHash: string;
  eventId: EntityId;
  duplicate: boolean;
  applied: boolean;
}

export interface HubSnapshot {
  schemaVersion: 3;
  recordedAt: string;
  eventCursor: EventLogCursor;
  repositories: HubRepository[];
  graph: { entities: unknown[]; relations: unknown[] };
  agentIds: string[];
  workflowIds: string[];
  stateHash: string;
}

/**
 * Canonical graph control plane for repositories/projects represented in COS.
 *
 * Durable event log is the accepted history. Versioned state machines, KG and
 * realtime patches are projections and can be rebuilt. Repository display names
 * never act as canonical identity. Concurrent transitions serialize and use an
 * expected-state/revision fence so stale writers become explicit near misses.
 */
export class CosHub {
  readonly kg = new KnowledgeGraphEngine();
  readonly agents = new AgentGraphEngine();
  readonly workflows = new WorkflowGraphEngine();
  readonly stream = new GraphStream();
  readonly identities = new IdentityRegistry();

  private readonly states = new Map<string, VersionedStateMachine>();
  private readonly repos = new Map<string, HubRepository>();
  private readonly repoByFullName = new Map<string, string>();

  constructor(readonly eventLog: IEventLog = new InMemoryEventLog()) {}

  registerRepository(
    owner: string,
    name: string,
    metadata: Record<string, unknown> = {},
  ): HubRepository {
    const normalizedOwner = owner.trim().toLowerCase();
    const normalizedName = name.trim();
    if (!normalizedOwner || !normalizedName) throw new Error('Repository owner/name must not be empty');
    const fullName = `${normalizedOwner}/${normalizedName}`;
    const identity = this.identities.register({
      scheme: 'github',
      authority: normalizedOwner,
      resourceType: 'repository',
      resourceId: normalizedName,
    }, 'repo');

    const existing = this.repos.get(identity.id);
    if (existing) {
      if (existing.fullName !== fullName) throw new Error(`Repository identity collision ${identity.id}`);
      return this.cloneRepo(existing);
    }

    const machine = createRepoMachine(fullName);
    const repo: HubRepository = {
      id: identity.id,
      canonicalUri: identity.uri,
      owner: normalizedOwner,
      name: normalizedName,
      fullName,
      state: 'PENDING',
      stateRevision: machine.currentRevision,
      metadata: structuredClone(metadata),
    };
    this.repos.set(repo.id, repo);
    this.repoByFullName.set(fullName.toLowerCase(), repo.id);
    this.states.set(repo.id, machine);

    if (!this.kg.getEntity(repo.id)) {
      this.kg.addEntity({
        id: repo.id,
        name: repo.fullName,
        type: 'repository',
        description: typeof metadata.description === 'string' ? metadata.description : '',
        aliases: [repo.canonicalUri],
      });
    }

    const legacyAliases = [
      `R-${normalizedName}`,
      `R-${fullName}`,
      typeof metadata.url === 'string' ? metadata.url : null,
    ].filter((value): value is string => Boolean(value));
    for (const alias of legacyAliases) {
      try { this.identities.addAlias(alias, repo.canonicalUri); } catch { /* explicit migration surfaces alias conflicts */ }
    }

    return this.cloneRepo(repo);
  }

  getRepository(value: string): HubRepository | null {
    const byFullName = this.repoByFullName.get(value.trim().toLowerCase());
    if (byFullName) return this.cloneRepo(this.repos.get(byFullName)!);
    const identity = this.identities.resolve(value);
    if (!identity) return null;
    const repo = this.repos.get(identity.id);
    return repo ? this.cloneRepo(repo) : null;
  }

  listRepositories(): HubRepository[] {
    return Array.from(this.repos.values(), repo => this.cloneRepo(repo))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async applyRepoEvent(repoRef: string, event: RepoEvent, context: RepoEventContext): Promise<RepoEventResult> {
    const repo = this.getRepository(repoRef);
    if (!repo) throw new Error(`Unknown repository '${repoRef}'`);
    if (!context.idempotencyKey.trim()) throw new Error('Repo event requires idempotencyKey');
    if (!context.correlationId.trim()) throw new Error('Repo event requires correlationId');
    if (!context.sourceRef.trim()) throw new Error('Repo event requires sourceRef');

    const machine = this.states.get(repo.id)!;
    const previousState = machine.state as RepoState;
    const previousRevision = machine.currentRevision;
    const occurredAt = context.occurredAt || new Date().toISOString();
    if (!Number.isFinite(Date.parse(occurredAt))) throw new Error(`Invalid occurredAt '${occurredAt}'`);

    const eventIdentity = canonicalIdentity({
      scheme: 'agentic',
      authority: 'cos-hub',
      resourceType: 'repo-event',
      resourceId: context.idempotencyKey,
    }, 'evt');

    const accepted = await this.eventLog.append({
      id: eventIdentity.id as EntityId,
      type: `hub.repo.${event}`,
      source: repo.id as EntityId,
      payload: {
        repoId: repo.id,
        canonicalUri: repo.canonicalUri,
        event,
        previousState,
        previousRevision,
        sourceRef: context.sourceRef,
      },
      metadata: {
        actor: context.actor || null,
        sourceRef: context.sourceRef,
        ...(context.metadata || {}),
      },
      severity: event === 'build_failed' || event === 'deployment_failed' ? 'error' : 'info',
      timestamp: occurredAt,
      traceId: context.correlationId,
      spanId: `hub_${stableHash128({ key: context.idempotencyKey, repo: repo.id }).slice(0, 16)}`,
      idempotencyKey: context.idempotencyKey,
      correlationId: context.correlationId,
    });

    if (!accepted.appended) {
      const current = machine.snapshot();
      return {
        repoId: repo.id,
        event,
        previousState,
        state: current.state as RepoState,
        previousRevision,
        revision: current.revision,
        stateHash: current.stateHash,
        eventId: accepted.event.id,
        duplicate: true,
        applied: false,
      };
    }

    let receipt;
    try {
      receipt = await machine.send(event, undefined, {
        expectedState: previousState,
        expectedRevision: previousRevision,
      });
    } catch (error) {
      const current = machine.snapshot();
      this.emitPatch(accepted.event, 'transition_rejected', {
        repoId: repo.id,
        event,
        previousState,
        previousRevision,
        currentState: current.state,
        currentRevision: current.revision,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    if (!receipt.applied) {
      this.emitPatch(accepted.event, 'transition_rejected', {
        repoId: repo.id,
        event,
        previousState,
        previousRevision,
        currentState: receipt.state,
        currentRevision: receipt.revision,
      });
      return {
        repoId: repo.id,
        event,
        previousState,
        state: receipt.state as RepoState,
        previousRevision,
        revision: receipt.revision,
        stateHash: receipt.stateHash,
        eventId: accepted.event.id,
        duplicate: false,
        applied: false,
      };
    }

    const canonical = this.repos.get(repo.id)!;
    canonical.state = receipt.state as RepoState;
    canonical.stateRevision = receipt.revision;
    this.emitPatch(accepted.event, 'repo_state', {
      repoId: repo.id,
      event,
      previousState,
      state: canonical.state,
      previousRevision,
      revision: canonical.stateRevision,
      stateHash: receipt.stateHash,
    });
    return {
      repoId: repo.id,
      event,
      previousState,
      state: canonical.state,
      previousRevision,
      revision: canonical.stateRevision,
      stateHash: receipt.stateHash,
      eventId: accepted.event.id,
      duplicate: false,
      applied: true,
    };
  }

  attachDimension(repoRef: string, dimension: string, confidence = 1): string {
    const repo = this.getRepository(repoRef);
    if (!repo) throw new Error(`Unknown repository '${repoRef}'`);
    const dim = dimension.trim().toUpperCase();
    if (!/^L\d+$/.test(dim)) throw new Error(`Invalid COS dimension '${dimension}'`);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('confidence must be in [0,1]');

    if (!this.kg.getEntity(dim)) this.kg.addEntity({ id: dim, name: dim, type: 'dimension' });
    const relationId = `rel_${stableHash128({ repo: repo.id, dimension: dim })}`;
    if (!this.kg.getRelation(relationId)) {
      this.kg.addRelation({
        id: relationId,
        source: repo.id,
        target: dim,
        type: 'in_dimension',
        confidence,
      });
    }
    return relationId;
  }

  reposInDimension(dimension: string): HubRepository[] {
    const dim = dimension.trim().toUpperCase();
    return this.listRepositories().filter(repo =>
      this.kg.relations.some(relation => relation.source === repo.id && relation.target === dim),
    );
  }

  repoCountByState(): Record<RepoState, number> {
    const out: Record<RepoState, number> = { PENDING: 0, DEV: 0, LIVE: 0, BLOCKED: 0, DEAD: 0 };
    for (const repo of this.repos.values()) out[repo.state] += 1;
    return out;
  }

  async snapshot(): Promise<HubSnapshot> {
    const eventCursor = await this.eventLog.latestCursor();
    const repositories = this.listRepositories();
    const graph = {
      entities: this.kg.entities.map(entity => structuredClone(entity)),
      relations: this.kg.relations.map(relation => structuredClone(relation)),
    };
    const core = {
      schemaVersion: 3 as const,
      eventCursor,
      repositories,
      graph,
      agentIds: this.agents.getNodes().map(node => String((node as { id: string }).id)).sort(),
      workflowIds: this.workflows.getNodes().map(node => String((node as { id: string }).id)).sort(),
    };
    return {
      ...core,
      recordedAt: new Date().toISOString(),
      stateHash: stableHash128(core),
    };
  }

  async replayRepoStates(): Promise<void> {
    for (const repo of this.repos.values()) {
      const machine = createRepoMachine(repo.fullName);
      this.states.set(repo.id, machine);
      repo.state = 'PENDING';
      repo.stateRevision = 0;
    }

    let cursor: EventLogCursor = { sequence: 0 };
    while (true) {
      const events = await this.eventLog.readFrom(cursor, 1000);
      if (!events.length) break;
      for (const event of events) {
        if (!event.type.startsWith('hub.repo.')) continue;
        const payload = event.payload as { repoId?: string; event?: RepoEvent };
        if (!payload.repoId || !payload.event) continue;
        const machine = this.states.get(payload.repoId);
        if (!machine) continue;
        const receipt = await machine.send(payload.event);
        if (receipt.applied) {
          const repo = this.repos.get(payload.repoId)!;
          repo.state = receipt.state as RepoState;
          repo.stateRevision = receipt.revision;
        }
      }
      cursor = { sequence: events[events.length - 1].sequence };
    }
  }

  private emitPatch(event: DurableEvent, type: string, data: Record<string, unknown>): void {
    const patch: GraphPatch = {
      id: `patch_${stableHash128({ eventId: String(event.id), type })}`,
      type: type as GraphPatch['type'],
      level: 8,
      graphId: 'cos-agentic-hub',
      data,
      timestamp: Date.parse(event.recordedAt),
    };
    this.stream.sendPatch(patch);
  }

  private cloneRepo(repo: HubRepository): HubRepository {
    return { ...repo, metadata: structuredClone(repo.metadata) };
  }
}

function createRepoMachine(name: string): VersionedStateMachine {
  return new VersionedStateMachine(
    name,
    REPO_STATES.map(state => ({ id: state, label: state })),
    REPO_TRANSITIONS,
    'PENDING',
  );
}
