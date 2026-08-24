import {
  canonicalIdentity,
  IdentityRegistry,
  stableHash128,
  type EntityId,
} from '@cos/core';
import {
  KnowledgeGraphEngine,
  VersionedStateMachine,
  PartialStateTransitionError,
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

export type RepoTransitionDisposition = 'applied' | 'rejected' | 'partial_commit';

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

export interface RepoTransitionOutcomePayload {
  commandEventId: string;
  repoId: string;
  event: RepoEvent;
  previousState: RepoState;
  previousRevision: number;
  state: RepoState;
  revision: number;
  stateHash: string;
  disposition: RepoTransitionDisposition;
  error?: string;
}

export interface RepoEventResult extends RepoTransitionOutcomePayload {
  eventId: EntityId;
  outcomeEventId: EntityId;
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

export interface HubReplayReport {
  commands: number;
  outcomes: number;
  applied: number;
  rejected: number;
  partialCommits: number;
  finalCursor: EventLogCursor;
  stateHash: string;
}

/**
 * Canonical graph control plane for repositories/projects represented in COS.
 *
 * Each observed repository command and its projection outcome are separate
 * durable events. Replay consumes explicit outcomes, never guesses whether a
 * stale/rejected command should have changed state. A duplicate command without
 * an outcome is treated as an incomplete transaction and fails closed.
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

  registerRepository(owner: string, name: string, metadata: Record<string, unknown> = {}): HubRepository {
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
    const idempotencyKey = context.idempotencyKey.trim();
    const correlationId = context.correlationId.trim();
    const sourceRef = context.sourceRef.trim();
    if (!idempotencyKey) throw new Error('Repo event requires idempotencyKey');
    if (!correlationId) throw new Error('Repo event requires correlationId');
    if (!sourceRef) throw new Error('Repo event requires sourceRef');

    const machine = this.states.get(repo.id)!;
    const previousState = machine.state as RepoState;
    const previousRevision = machine.currentRevision;
    const occurredAt = context.occurredAt || new Date().toISOString();
    if (!Number.isFinite(Date.parse(occurredAt))) throw new Error(`Invalid occurredAt '${occurredAt}'`);

    const eventIdentity = canonicalIdentity({
      scheme: 'agentic', authority: 'cos-hub', resourceType: 'repo-event', resourceId: idempotencyKey,
    }, 'evt');
    const accepted = await this.eventLog.append({
      id: eventIdentity.id as EntityId,
      type: `hub.repo.command.${event}`,
      source: repo.id as EntityId,
      payload: {
        repoId: repo.id,
        canonicalUri: repo.canonicalUri,
        event,
        previousState,
        previousRevision,
        sourceRef,
      },
      metadata: { actor: context.actor || null, sourceRef, ...(context.metadata || {}) },
      severity: event === 'build_failed' || event === 'deployment_failed' ? 'error' : 'info',
      timestamp: occurredAt,
      traceId: correlationId,
      spanId: `hub_${stableHash128({ key: idempotencyKey, repo: repo.id }).slice(0, 16)}`,
      idempotencyKey,
      correlationId,
    });

    const outcomeKey = `${idempotencyKey}:outcome`;
    if (!accepted.appended) {
      const existingOutcome = await this.eventLog.getByIdempotencyKey(outcomeKey);
      if (!existingOutcome) {
        throw new Error(`HUB_INCOMPLETE_COMMAND_OUTCOME command=${String(accepted.event.id)}`);
      }
      return this.resultFromOutcome(existingOutcome, true);
    }

    try {
      const receipt = await machine.send(event, undefined, { expectedState: previousState, expectedRevision: previousRevision });
      const disposition: RepoTransitionDisposition = receipt.applied ? 'applied' : 'rejected';
      const outcome = await this.appendOutcome(
        accepted.event,
        context,
        {
          commandEventId: String(accepted.event.id),
          repoId: repo.id,
          event,
          previousState,
          previousRevision,
          state: receipt.state as RepoState,
          revision: receipt.revision,
          stateHash: receipt.stateHash,
          disposition,
        },
      );
      if (receipt.applied) this.commitRepoProjection(repo.id, receipt.state as RepoState, receipt.revision);
      this.emitPatch(outcome, receipt.applied ? 'repo_state' : 'transition_rejected', outcome.payload as Record<string, unknown>);
      return this.resultFromOutcome(outcome, false);
    } catch (error) {
      const snapshot = machine.snapshot();
      const partialCommit = error instanceof PartialStateTransitionError;
      if (partialCommit) this.commitRepoProjection(repo.id, snapshot.state as RepoState, snapshot.revision);
      const outcome = await this.appendOutcome(
        accepted.event,
        context,
        {
          commandEventId: String(accepted.event.id),
          repoId: repo.id,
          event,
          previousState,
          previousRevision,
          state: snapshot.state as RepoState,
          revision: snapshot.revision,
          stateHash: snapshot.stateHash,
          disposition: partialCommit ? 'partial_commit' : 'rejected',
          error: error instanceof Error ? error.message : String(error),
        },
      );
      this.emitPatch(outcome, partialCommit ? 'transition_partial_commit' : 'transition_rejected', outcome.payload as Record<string, unknown>);
      throw error;
    }
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
      this.kg.addRelation({ id: relationId, source: repo.id, target: dim, type: 'in_dimension', confidence });
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
    return { ...core, recordedAt: new Date().toISOString(), stateHash: stableHash128(core) };
  }

  async replayRepoStates(): Promise<HubReplayReport> {
    for (const repo of this.repos.values()) {
      this.states.set(repo.id, createRepoMachine(repo.fullName));
      repo.state = 'PENDING';
      repo.stateRevision = 0;
    }

    const events: DurableEvent[] = [];
    let cursor: EventLogCursor = { sequence: 0 };
    while (true) {
      const batch = await this.eventLog.readFrom(cursor, 1000);
      if (!batch.length) break;
      events.push(...batch);
      cursor = { sequence: batch[batch.length - 1].sequence };
    }

    const commands = events.filter(event => event.type.startsWith('hub.repo.command.'));
    const outcomes = events.filter(event => event.type === 'hub.repo.transition_outcome');
    const outcomeCommandIds = new Set(outcomes.map(event => String((event.payload as RepoTransitionOutcomePayload).commandEventId)));
    const missing = commands.filter(event => !outcomeCommandIds.has(String(event.id)));
    if (missing.length) {
      throw new Error(`HUB_REPLAY_MISSING_OUTCOME count=${missing.length} first=${String(missing[0].id)}`);
    }

    let applied = 0;
    let rejected = 0;
    let partialCommits = 0;
    for (const outcome of outcomes.sort((a, b) => a.sequence - b.sequence)) {
      const payload = outcome.payload as RepoTransitionOutcomePayload;
      const machine = this.states.get(payload.repoId);
      const repo = this.repos.get(payload.repoId);
      if (!machine || !repo) throw new Error(`HUB_REPLAY_UNKNOWN_REPOSITORY id=${payload.repoId}`);

      if (payload.disposition === 'applied') {
        const receipt = await machine.send(payload.event, undefined, {
          expectedState: payload.previousState,
          expectedRevision: payload.previousRevision,
        });
        if (!receipt.applied) throw new Error(`HUB_REPLAY_APPLIED_EVENT_REJECTED command=${payload.commandEventId}`);
        assertOutcomeMatches(payload, receipt.state as RepoState, receipt.revision, receipt.stateHash);
        applied += 1;
      } else if (payload.disposition === 'partial_commit') {
        let partial: unknown;
        try {
          await machine.send(payload.event, undefined, {
            expectedState: payload.previousState,
            expectedRevision: payload.previousRevision,
          });
        } catch (error) {
          partial = error;
        }
        if (!(partial instanceof PartialStateTransitionError)) {
          throw new Error(`HUB_REPLAY_PARTIAL_COMMIT_NOT_REPRODUCED command=${payload.commandEventId}`);
        }
        const snapshot = machine.snapshot();
        assertOutcomeMatches(payload, snapshot.state as RepoState, snapshot.revision, snapshot.stateHash);
        partialCommits += 1;
      } else {
        const snapshot = machine.snapshot();
        assertOutcomeMatches(payload, snapshot.state as RepoState, snapshot.revision, snapshot.stateHash);
        rejected += 1;
      }

      const snapshot = machine.snapshot();
      repo.state = snapshot.state as RepoState;
      repo.stateRevision = snapshot.revision;
    }

    const finalSnapshot = await this.snapshot();
    return {
      commands: commands.length,
      outcomes: outcomes.length,
      applied,
      rejected,
      partialCommits,
      finalCursor: cursor,
      stateHash: finalSnapshot.stateHash,
    };
  }

  private async appendOutcome(
    command: DurableEvent,
    context: RepoEventContext,
    payload: RepoTransitionOutcomePayload,
  ): Promise<DurableEvent> {
    const outcomeKey = `${context.idempotencyKey.trim()}:outcome`;
    const identity = canonicalIdentity({
      scheme: 'agentic', authority: 'cos-hub', resourceType: 'repo-transition-outcome', resourceId: outcomeKey,
    }, 'evt');
    const result = await this.eventLog.append({
      id: identity.id as EntityId,
      type: 'hub.repo.transition_outcome',
      source: payload.repoId as EntityId,
      payload,
      metadata: {
        sourceRef: context.sourceRef,
        commandEventId: payload.commandEventId,
        disposition: payload.disposition,
      },
      severity: payload.disposition === 'applied' ? 'info' : 'warn',
      timestamp: new Date().toISOString(),
      traceId: context.correlationId,
      spanId: `hubout_${stableHash128({ commandEventId: payload.commandEventId }).slice(0, 16)}`,
      parentSpanId: command.spanId,
      idempotencyKey: outcomeKey,
      correlationId: context.correlationId,
      causationId: command.id,
    });
    return result.event;
  }

  private resultFromOutcome(outcome: DurableEvent, duplicate: boolean): RepoEventResult {
    if (outcome.type !== 'hub.repo.transition_outcome') {
      throw new Error(`Expected transition outcome event, received ${outcome.type}`);
    }
    const payload = outcome.payload as RepoTransitionOutcomePayload;
    return {
      ...payload,
      eventId: payload.commandEventId as EntityId,
      outcomeEventId: outcome.id,
      duplicate,
      applied: payload.disposition === 'applied',
    };
  }

  private commitRepoProjection(repoId: string, state: RepoState, revision: number): void {
    const repo = this.repos.get(repoId);
    if (!repo) throw new Error(`Unknown repository projection ${repoId}`);
    repo.state = state;
    repo.stateRevision = revision;
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

function assertOutcomeMatches(
  payload: RepoTransitionOutcomePayload,
  state: RepoState,
  revision: number,
  stateHash: string,
): void {
  if (state !== payload.state || revision !== payload.revision || stateHash !== payload.stateHash) {
    throw new Error(
      `HUB_REPLAY_DIVERGENCE command=${payload.commandEventId} expected=${payload.state}/${payload.revision}/${payload.stateHash} actual=${state}/${revision}/${stateHash}`,
    );
  }
}
