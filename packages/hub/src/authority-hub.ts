import {
  CANONICAL_JSON_WIRE_VERSION,
  canonicalHash128,
  canonicalIdentity,
  canonicalizeJsonValue,
  type EntityId,
} from '@cos/core';
import {
  AuthorityStateMachine,
  type AuthorityStateSnapshot,
} from '@cos/graph';
import {
  InMemoryEventLog,
  type DurableEvent,
  type EventLogCursor,
  type IEventLog,
} from '@cos/runtime';
import type { RepoEvent, RepoState } from './hub';

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
const REPO_EVENTS = new Set<RepoEvent>(REPO_TRANSITIONS.map(transition => transition.event));

const REPO_MACHINE_DEFINITION_REVISION = 'cos-hub/repository-state/v1';
const REGISTRATION_EVENT = 'hub.authority.repo.registered';
const COMMAND_PREFIX = 'hub.authority.repo.command.';
const OUTCOME_EVENT = 'hub.authority.repo.transition_outcome';
const RESERVED_COMMAND_METADATA = new Set(['logicalHash', 'sourceRef', 'actor']);

export interface AuthorityHubRepository {
  id: string;
  canonicalUri: string;
  owner: string;
  name: string;
  fullName: string;
  projectId?: string;
  state: RepoState;
  stateRevision: number;
  stateHash: string;
  registeredAt: string;
  metadata: Record<string, unknown>;
}

export interface AuthorityRepositoryRegistration {
  owner: string;
  name: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
  correlationId: string;
  sourceRef: string;
  occurredAt: string;
  recordedAt: string;
  actor?: string;
}

export interface AuthorityRepoCommandContext {
  idempotencyKey: string;
  correlationId: string;
  sourceRef: string;
  occurredAt: string;
  recordedAt: string;
  expectedState: RepoState;
  expectedRevision: number;
  actor?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export type AuthorityRepoDisposition = 'applied' | 'rejected';

export interface AuthorityRepoTransitionOutcomePayload {
  commandEventId: string;
  commandLogicalHash: string;
  repoId: string;
  event: RepoEvent;
  expectedState: RepoState;
  expectedRevision: number;
  before: AuthorityStateSnapshot;
  after: AuthorityStateSnapshot;
  disposition: AuthorityRepoDisposition;
  error?: string;
}

export interface AuthorityRepoEventResult {
  repoId: string;
  event: RepoEvent;
  commandEventId: EntityId;
  outcomeEventId: EntityId;
  duplicate: boolean;
  applied: boolean;
  disposition: AuthorityRepoDisposition;
  previousState: RepoState;
  previousRevision: number;
  state: RepoState;
  revision: number;
  stateHash: string;
  error?: string;
}

export interface AuthorityHubSnapshotRepository {
  id: string;
  canonicalUri: string;
  owner: string;
  name: string;
  fullName: string;
  projectId?: string;
  registeredAt: string;
  metadata: Record<string, unknown>;
  stateSnapshot: AuthorityStateSnapshot;
}

export interface AuthorityHubSnapshot {
  schemaVersion: 1;
  recordedAt: string;
  eventCursor: EventLogCursor;
  repositories: AuthorityHubSnapshotRepository[];
  /** Semantic projection hash. Cursor and snapshot creation time are excluded. */
  stateHash: string;
}

export interface AuthorityHubReplayReport {
  registrations: number;
  commands: number;
  outcomes: number;
  applied: number;
  rejected: number;
  finalCursor: EventLogCursor;
  stateHash: string;
}

/**
 * Outcome-sourced authority repository runtime.
 *
 * Legacy `CosHub` remains shadow/compatibility until migration evidence exists.
 * Authority logical hashes are computed from the canonical JSON wire domain,
 * never raw TypeScript optional-property shape. `recordedAt` is evidence of log
 * acceptance, not part of producer retry identity.
 */
export class AuthorityHub {
  private readonly repos = new Map<string, AuthorityHubRepository>();
  private readonly repoByFullName = new Map<string, string>();
  private readonly repoByUri = new Map<string, string>();
  private readonly states = new Map<string, AuthorityStateMachine>();
  private readonly repoOperationTails = new Map<string, Promise<void>>();

  constructor(readonly eventLog: IEventLog = new InMemoryEventLog()) {}

  async registerRepository(input: AuthorityRepositoryRegistration): Promise<AuthorityHubRepository> {
    const normalized = normalizeRegistration(input);
    const identity = repositoryIdentity(normalized.owner, normalized.name);
    return this.enqueueRepo(identity.id, async () => {
      const payload = {
        repoId: identity.id,
        canonicalUri: identity.uri,
        owner: normalized.owner,
        name: normalized.name,
        fullName: `${normalized.owner}/${normalized.name}`,
        projectId: normalized.projectId ?? null,
        registeredAt: normalized.occurredAt,
        metadata: normalized.metadata,
        sourceRef: normalized.sourceRef,
      };
      const logicalHash = registrationLogicalHash(payload, normalized.actor, normalized.occurredAt);
      const eventIdentity = canonicalIdentity({
        scheme: 'agentic',
        authority: 'cos-hub',
        resourceType: 'repo-registration',
        resourceId: normalized.idempotencyKey,
      }, 'evt');
      const append = await this.eventLog.append({
        id: eventIdentity.id as EntityId,
        type: REGISTRATION_EVENT,
        source: identity.id as EntityId,
        payload,
        metadata: {
          logicalHash,
          sourceRef: normalized.sourceRef,
          actor: normalized.actor ?? null,
        },
        severity: 'info',
        timestamp: normalized.occurredAt,
        traceId: normalized.correlationId,
        spanId: `hubreg_${logicalHash.slice(0, 16)}`,
        idempotencyKey: normalized.idempotencyKey,
        correlationId: normalized.correlationId,
        recordedAt: normalized.recordedAt,
      });
      assertRegistrationEventIntegrity(append.event);
      assertEventLogicalHash(append.event, logicalHash, 'HUB_REGISTRATION_IDEMPOTENCY_CONFLICT');
      return cloneRepository(this.materializeRegistration(append.event));
    });
  }

  getRepository(reference: string): AuthorityHubRepository | null {
    const normalized = reference.trim();
    if (!normalized) return null;
    const direct = this.repos.get(normalized);
    if (direct) return cloneRepository(direct);
    const byFullName = this.repoByFullName.get(normalized.toLowerCase());
    if (byFullName) return cloneRepository(this.repos.get(byFullName)!);
    const byUri = this.repoByUri.get(normalized);
    return byUri ? cloneRepository(this.repos.get(byUri)!) : null;
  }

  listRepositories(): AuthorityHubRepository[] {
    return Array.from(this.repos.values(), cloneRepository)
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  }

  async applyRepoEvent(
    repoReference: string,
    event: RepoEvent,
    context: AuthorityRepoCommandContext,
  ): Promise<AuthorityRepoEventResult> {
    assertRepoEvent(event);
    const initial = this.getRepository(repoReference);
    if (!initial) throw new Error(`Unknown authority repository '${repoReference}'`);
    const normalized = normalizeCommandContext(context);

    return this.enqueueRepo(initial.id, async () => {
      const repo = this.repos.get(initial.id);
      const machine = this.states.get(initial.id);
      if (!repo || !machine) throw new Error(`Authority repository projection missing: ${initial.id}`);

      const commandPayload = {
        repoId: repo.id,
        canonicalUri: repo.canonicalUri,
        event,
        expectedState: normalized.expectedState,
        expectedRevision: normalized.expectedRevision,
        sourceRef: normalized.sourceRef,
      };
      const commandLogicalHash = commandLogicalHashFor(
        event,
        commandPayload,
        normalized.actor,
        normalized.metadata,
        normalized.occurredAt,
      );
      const commandIdentity = canonicalIdentity({
        scheme: 'agentic',
        authority: 'cos-hub',
        resourceType: 'repo-command',
        resourceId: normalized.idempotencyKey,
      }, 'evt');
      const commandAppend = await this.eventLog.append({
        id: commandIdentity.id as EntityId,
        type: `${COMMAND_PREFIX}${event}`,
        source: repo.id as EntityId,
        payload: commandPayload,
        metadata: {
          ...normalized.metadata,
          logicalHash: commandLogicalHash,
          sourceRef: normalized.sourceRef,
          actor: normalized.actor ?? null,
        },
        severity: event === 'build_failed' || event === 'deployment_failed' ? 'error' : 'info',
        timestamp: normalized.occurredAt,
        traceId: normalized.correlationId,
        spanId: `hubcmd_${commandLogicalHash.slice(0, 16)}`,
        idempotencyKey: normalized.idempotencyKey,
        correlationId: normalized.correlationId,
        recordedAt: normalized.recordedAt,
      });
      const actualCommandHash = assertCommandEventIntegrity(commandAppend.event);
      if (actualCommandHash !== commandLogicalHash) {
        throw new Error(`HUB_COMMAND_IDEMPOTENCY_CONFLICT expected=${commandLogicalHash} actual=${actualCommandHash}`);
      }

      const outcomeKey = `${normalized.idempotencyKey}:outcome`;
      if (!commandAppend.appended) {
        const existingOutcome = await this.eventLog.getByIdempotencyKey(outcomeKey);
        if (!existingOutcome) {
          throw new Error(`HUB_INCOMPLETE_COMMAND_OUTCOME command=${String(commandAppend.event.id)}`);
        }
        return this.resultFromOutcome(existingOutcome, true, commandLogicalHash);
      }

      const before = machine.snapshot();
      let after = before;
      let disposition: AuthorityRepoDisposition = 'rejected';
      let error: string | undefined;

      if (before.state !== normalized.expectedState || before.revision !== normalized.expectedRevision) {
        error = `STALE_HUB_REPOSITORY expected=${normalized.expectedState}/${normalized.expectedRevision} current=${before.state}/${before.revision}`;
      } else {
        try {
          const receipt = await machine.transition(event, undefined, {
            expectedState: normalized.expectedState,
            expectedRevision: normalized.expectedRevision,
            occurredAt: normalized.occurredAt,
          });
          after = machine.snapshot();
          disposition = receipt.applied ? 'applied' : 'rejected';
          error = receipt.error;
        } catch (cause) {
          after = machine.snapshot();
          disposition = 'rejected';
          error = errorMessage(cause);
        }
      }

      const payload: AuthorityRepoTransitionOutcomePayload = {
        commandEventId: String(commandAppend.event.id),
        commandLogicalHash,
        repoId: repo.id,
        event,
        expectedState: normalized.expectedState,
        expectedRevision: normalized.expectedRevision,
        before,
        after,
        disposition,
        ...(error === undefined ? {} : { error }),
      };

      let outcome: DurableEvent;
      try {
        outcome = await this.appendOutcome(commandAppend.event, outcomeKey, normalized, payload);
      } catch (cause) {
        if (after.stateHash !== before.stateHash) this.replaceMachineFromSnapshot(repo, before);
        throw cause;
      }

      this.commitRepositoryState(repo.id, after);
      return this.resultFromOutcome(outcome, false, commandLogicalHash);
    });
  }

  /** Replays registrations and recorded outcomes without executing transition logic. */
  async replayFrom(cursor: EventLogCursor = { sequence: 0 }): Promise<AuthorityHubReplayReport> {
    assertCursor(cursor);
    if (cursor.sequence === 0) this.resetProjection();

    let currentCursor = { ...cursor };
    let registrations = 0;
    let commands = 0;
    let outcomes = 0;
    let applied = 0;
    let rejected = 0;
    const pendingCommands = new Map<string, DurableEvent>();

    while (true) {
      const batch = await this.eventLog.readFrom(currentCursor, 1000);
      if (!batch.length) break;
      for (const durable of batch) {
        if (durable.type === REGISTRATION_EVENT) {
          assertRegistrationEventIntegrity(durable);
          this.materializeRegistration(durable);
          registrations += 1;
        } else if (durable.type.startsWith(COMMAND_PREFIX)) {
          assertCommandEventIntegrity(durable);
          pendingCommands.set(String(durable.id), durable);
          commands += 1;
        } else if (durable.type === OUTCOME_EVENT) {
          const payload = assertOutcomeEventIntegrity(durable);
          const command = pendingCommands.get(payload.commandEventId)
            ?? await this.eventLog.get(payload.commandEventId as EntityId);
          if (!command) throw new Error(`HUB_REPLAY_MISSING_COMMAND id=${payload.commandEventId}`);
          assertCommandOutcomeLink(command, durable, payload);
          this.applyRecordedOutcome(payload);
          pendingCommands.delete(payload.commandEventId);
          outcomes += 1;
          if (payload.disposition === 'applied') applied += 1;
          else rejected += 1;
        }
      }
      const last = batch.at(-1);
      if (!last) break;
      currentCursor = { sequence: last.sequence };
    }

    if (pendingCommands.size > 0) {
      const first = pendingCommands.keys().next().value as string;
      throw new Error(`HUB_REPLAY_MISSING_OUTCOME count=${pendingCommands.size} first=${first}`);
    }

    return {
      registrations,
      commands,
      outcomes,
      applied,
      rejected,
      finalCursor: currentCursor,
      stateHash: this.projectionHash(),
    };
  }

  async snapshot(recordedAt: string): Promise<AuthorityHubSnapshot> {
    const timestamp = canonicalTime(recordedAt, 'Hub snapshot recordedAt');
    const eventCursor = await this.eventLog.latestCursor();
    await this.assertNoIncompleteCommandsThrough(eventCursor);
    const repositories = this.snapshotRepositories();
    return {
      schemaVersion: 1,
      recordedAt: timestamp,
      eventCursor,
      repositories,
      stateHash: semanticHubHash(repositories),
    };
  }

  restoreSnapshot(snapshot: AuthorityHubSnapshot): void {
    if (this.repos.size > 0) throw new Error('HUB_RESTORE_REQUIRES_EMPTY_PROJECTION');
    if (snapshot.schemaVersion !== 1) throw new Error(`Unsupported AuthorityHub snapshot schema ${snapshot.schemaVersion}`);
    canonicalTime(snapshot.recordedAt, 'Hub snapshot recordedAt');
    assertCursor(snapshot.eventCursor);
    const repositories = snapshot.repositories.map(cloneSnapshotRepository).sort((a, b) => a.id.localeCompare(b.id));
    const expectedHash = semanticHubHash(repositories);
    if (expectedHash !== snapshot.stateHash) {
      throw new Error(`HUB_SNAPSHOT_STATE_HASH_MISMATCH expected=${snapshot.stateHash} actual=${expectedHash}`);
    }

    for (const definition of repositories) {
      assertRepositoryDefinition(definition);
      const repo = this.materializeRepositoryDefinition(definition);
      this.replaceMachineFromSnapshot(repo, definition.stateSnapshot);
    }
    const restoredHash = this.projectionHash();
    if (restoredHash !== snapshot.stateHash) {
      throw new Error(`HUB_SNAPSHOT_RESTORE_DIVERGENCE expected=${snapshot.stateHash} actual=${restoredHash}`);
    }
  }

  projectionHash(): string {
    return semanticHubHash(this.snapshotRepositories());
  }

  private async appendOutcome(
    command: DurableEvent,
    outcomeKey: string,
    context: ReturnType<typeof normalizeCommandContext>,
    payload: AuthorityRepoTransitionOutcomePayload,
  ): Promise<DurableEvent> {
    validateOutcomeSemantics(payload);
    const logicalHash = outcomeLogicalHash(payload);
    const identity = canonicalIdentity({
      scheme: 'agentic',
      authority: 'cos-hub',
      resourceType: 'repo-transition-outcome',
      resourceId: outcomeKey,
    }, 'evt');
    const result = await this.eventLog.append({
      id: identity.id as EntityId,
      type: OUTCOME_EVENT,
      source: payload.repoId as EntityId,
      payload,
      metadata: {
        logicalHash,
        sourceRef: context.sourceRef,
        commandEventId: payload.commandEventId,
        disposition: payload.disposition,
      },
      severity: payload.disposition === 'applied' ? 'info' : 'warn',
      timestamp: context.recordedAt,
      traceId: context.correlationId,
      spanId: `hubout_${logicalHash.slice(0, 16)}`,
      parentSpanId: command.spanId,
      idempotencyKey: outcomeKey,
      correlationId: context.correlationId,
      causationId: command.id,
      recordedAt: context.recordedAt,
    });
    const parsed = assertOutcomeEventIntegrity(result.event);
    if (parsed.commandEventId !== payload.commandEventId) {
      throw new Error(`HUB_OUTCOME_IDEMPOTENCY_CONFLICT command=${payload.commandEventId}`);
    }
    return result.event;
  }

  private resultFromOutcome(
    outcome: DurableEvent,
    duplicate: boolean,
    commandLogicalHash: string,
  ): AuthorityRepoEventResult {
    const payload = assertOutcomeEventIntegrity(outcome);
    if (payload.commandLogicalHash !== commandLogicalHash) {
      throw new Error(`HUB_OUTCOME_COMMAND_HASH_CONFLICT command=${payload.commandEventId}`);
    }
    return {
      repoId: payload.repoId,
      event: payload.event,
      commandEventId: payload.commandEventId as EntityId,
      outcomeEventId: outcome.id,
      duplicate,
      applied: payload.disposition === 'applied',
      disposition: payload.disposition,
      previousState: payload.before.state as RepoState,
      previousRevision: payload.before.revision,
      state: payload.after.state as RepoState,
      revision: payload.after.revision,
      stateHash: payload.after.stateHash,
      ...(payload.error === undefined ? {} : { error: payload.error }),
    };
  }

  private applyRecordedOutcome(payload: AuthorityRepoTransitionOutcomePayload): void {
    validateOutcomeSemantics(payload);
    const repo = this.repos.get(payload.repoId);
    const machine = this.states.get(payload.repoId);
    if (!repo || !machine) throw new Error(`HUB_REPLAY_UNKNOWN_REPOSITORY id=${payload.repoId}`);
    const current = machine.snapshot();
    if (current.stateHash !== payload.before.stateHash
      || current.state !== payload.before.state
      || current.revision !== payload.before.revision) {
      throw new Error(
        `HUB_REPLAY_CHAIN_DIVERGENCE repo=${payload.repoId} expected=${payload.before.state}/${payload.before.revision}/${payload.before.stateHash} current=${current.state}/${current.revision}/${current.stateHash}`,
      );
    }
    this.replaceMachineFromSnapshot(repo, payload.after);
  }

  private materializeRegistration(event: DurableEvent): AuthorityHubRepository {
    const payload = parseRegistrationPayload(event.payload);
    const existing = this.repos.get(payload.repoId);
    if (existing) {
      const existingDefinition = repositoryDefinition(existing);
      const eventDefinition = {
        id: payload.repoId,
        canonicalUri: payload.canonicalUri,
        owner: payload.owner,
        name: payload.name,
        fullName: payload.fullName,
        ...(payload.projectId === null ? {} : { projectId: payload.projectId }),
        registeredAt: payload.registeredAt,
        metadata: payload.metadata,
      };
      if (authorityHubCanonicalHash(existingDefinition) !== authorityHubCanonicalHash(eventDefinition)) {
        throw new Error(`HUB_REPOSITORY_DEFINITION_CONFLICT id=${payload.repoId}`);
      }
      return existing;
    }
    const initial = createRepoMachine({
      id: payload.repoId,
      fullName: payload.fullName,
      registeredAt: payload.registeredAt,
    }).snapshot();
    return this.materializeRepositoryDefinition({
      id: payload.repoId,
      canonicalUri: payload.canonicalUri,
      owner: payload.owner,
      name: payload.name,
      fullName: payload.fullName,
      ...(payload.projectId === null ? {} : { projectId: payload.projectId }),
      registeredAt: payload.registeredAt,
      metadata: payload.metadata,
      stateSnapshot: initial,
    });
  }

  private materializeRepositoryDefinition(definition: AuthorityHubSnapshotRepository): AuthorityHubRepository {
    assertRepositoryDefinition(definition);
    const repo: AuthorityHubRepository = {
      id: definition.id,
      canonicalUri: definition.canonicalUri,
      owner: definition.owner,
      name: definition.name,
      fullName: definition.fullName,
      ...(definition.projectId === undefined ? {} : { projectId: definition.projectId }),
      state: definition.stateSnapshot.state as RepoState,
      stateRevision: definition.stateSnapshot.revision,
      stateHash: definition.stateSnapshot.stateHash,
      registeredAt: canonicalTime(definition.registeredAt, 'repository registeredAt'),
      metadata: canonicalObject(definition.metadata, 'repository metadata'),
    };
    this.repos.set(repo.id, repo);
    this.repoByFullName.set(repo.fullName.toLowerCase(), repo.id);
    this.repoByUri.set(repo.canonicalUri, repo.id);
    if (!this.states.has(repo.id)) this.states.set(repo.id, createRepoMachine(repo));
    return repo;
  }

  private replaceMachineFromSnapshot(repo: AuthorityHubRepository, snapshot: AuthorityStateSnapshot): void {
    const expectedMachineId = repositoryMachineIdentity(repo.id).id;
    if (String(snapshot.machineId) !== expectedMachineId) {
      throw new Error(`HUB_STATE_MACHINE_IDENTITY_MISMATCH repo=${repo.id}`);
    }
    const restored = AuthorityStateMachine.restore(
      repo.fullName,
      repoStateDefinitions(),
      REPO_TRANSITIONS,
      snapshot,
      { definitionRevision: REPO_MACHINE_DEFINITION_REVISION },
    );
    this.states.get(repo.id)?.dispose();
    this.states.set(repo.id, restored);
    this.commitRepositoryState(repo.id, snapshot);
  }

  private commitRepositoryState(repoId: string, snapshot: AuthorityStateSnapshot): void {
    const repo = this.repos.get(repoId);
    if (!repo) throw new Error(`Unknown authority repository projection ${repoId}`);
    repo.state = snapshot.state as RepoState;
    repo.stateRevision = snapshot.revision;
    repo.stateHash = snapshot.stateHash;
  }

  private snapshotRepositories(): AuthorityHubSnapshotRepository[] {
    return Array.from(this.repos.values(), repo => {
      const machine = this.states.get(repo.id);
      if (!machine) throw new Error(`Missing state machine for repository ${repo.id}`);
      return {
        id: repo.id,
        canonicalUri: repo.canonicalUri,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        ...(repo.projectId === undefined ? {} : { projectId: repo.projectId }),
        registeredAt: repo.registeredAt,
        metadata: canonicalObject(repo.metadata, 'repository metadata'),
        stateSnapshot: machine.snapshot(),
      };
    }).sort((left, right) => left.id.localeCompare(right.id));
  }

  private async assertNoIncompleteCommandsThrough(cursor: EventLogCursor): Promise<void> {
    const commands = new Map<string, DurableEvent>();
    const outcomes = new Set<string>();
    let readCursor: EventLogCursor = { sequence: 0 };
    while (readCursor.sequence < cursor.sequence) {
      const batch = await this.eventLog.readFrom(readCursor, 1000);
      if (!batch.length) break;
      const bounded = batch.filter(event => event.sequence <= cursor.sequence);
      for (const event of bounded) {
        if (event.type.startsWith(COMMAND_PREFIX)) {
          assertCommandEventIntegrity(event);
          commands.set(String(event.id), event);
        }
        if (event.type === OUTCOME_EVENT) {
          const payload = assertOutcomeEventIntegrity(event);
          const command = commands.get(payload.commandEventId)
            ?? await this.eventLog.get(payload.commandEventId as EntityId);
          if (!command || command.sequence > cursor.sequence) {
            throw new Error(`HUB_SNAPSHOT_OUTCOME_WITHOUT_COMMAND command=${payload.commandEventId}`);
          }
          assertCommandOutcomeLink(command, event, payload);
          outcomes.add(payload.commandEventId);
        }
      }
      const last = bounded.at(-1);
      if (!last) break;
      readCursor = { sequence: last.sequence };
    }
    const missing = Array.from(commands.keys()).filter(command => !outcomes.has(command));
    if (missing.length) throw new Error(`HUB_SNAPSHOT_INCOMPLETE_COMMANDS count=${missing.length} first=${missing[0]}`);
  }

  private resetProjection(): void {
    for (const machine of this.states.values()) machine.dispose();
    this.states.clear();
    this.repos.clear();
    this.repoByFullName.clear();
    this.repoByUri.clear();
    this.repoOperationTails.clear();
  }

  private enqueueRepo<T>(repoId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.repoOperationTails.get(repoId) ?? Promise.resolve();
    const result = previous.then(operation);
    const tail = result.then(() => undefined, () => undefined);
    this.repoOperationTails.set(repoId, tail);
    return result.finally(() => {
      if (this.repoOperationTails.get(repoId) === tail) this.repoOperationTails.delete(repoId);
    });
  }
}

function createRepoMachine(repo: { id: string; fullName: string; registeredAt: string }): AuthorityStateMachine {
  const machineIdentity = repositoryMachineIdentity(repo.id);
  return new AuthorityStateMachine(
    repo.fullName,
    repoStateDefinitions(),
    REPO_TRANSITIONS,
    'PENDING',
    {
      machineId: machineIdentity.id as EntityId,
      definitionRevision: REPO_MACHINE_DEFINITION_REVISION,
      clock: () => repo.registeredAt,
    },
  );
}

function repositoryMachineIdentity(repoId: string): { id: string; uri: string } {
  const identity = canonicalIdentity({
    scheme: 'agentic',
    authority: 'cos-hub',
    resourceType: 'repository-state-machine',
    resourceId: repoId,
  }, 'fsm');
  return { id: String(identity.id), uri: identity.uri };
}

function repoStateDefinitions(): Array<{ id: RepoState; label: RepoState }> {
  return REPO_STATES.map(state => ({ id: state, label: state }));
}

function repositoryIdentity(owner: string, name: string): { id: string; uri: string } {
  const identity = canonicalIdentity({
    scheme: 'github',
    authority: owner.trim().toLowerCase(),
    resourceType: 'repository',
    resourceId: name.trim(),
  }, 'repo');
  return { id: String(identity.id), uri: identity.uri };
}

function normalizeRegistration(input: AuthorityRepositoryRegistration) {
  const owner = nonEmpty(input.owner, 'repository owner').toLowerCase();
  const name = nonEmpty(input.name, 'repository name');
  const projectId = optionalString(input.projectId);
  const metadata = canonicalObject(input.metadata ?? {}, 'repository metadata');
  const occurredAt = canonicalTime(input.occurredAt, 'registration occurredAt');
  const recordedAt = canonicalTime(input.recordedAt, 'registration recordedAt');
  assertRecordedAfterOccurred(occurredAt, recordedAt);
  return {
    owner,
    name,
    projectId,
    metadata,
    idempotencyKey: nonEmpty(input.idempotencyKey, 'registration idempotencyKey'),
    correlationId: nonEmpty(input.correlationId, 'registration correlationId'),
    sourceRef: nonEmpty(input.sourceRef, 'registration sourceRef'),
    occurredAt,
    recordedAt,
    actor: optionalString(input.actor),
  };
}

function normalizeCommandContext(input: AuthorityRepoCommandContext) {
  if (!REPO_STATES.includes(input.expectedState)) throw new Error(`Invalid expected repository state ${input.expectedState}`);
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new Error('expectedRevision must be a non-negative safe integer');
  }
  const occurredAt = canonicalTime(input.occurredAt, 'command occurredAt');
  const recordedAt = canonicalTime(input.recordedAt, 'command recordedAt');
  assertRecordedAfterOccurred(occurredAt, recordedAt);
  const metadata = canonicalScalarMetadata(input.metadata ?? {});
  for (const key of Object.keys(metadata)) {
    if (RESERVED_COMMAND_METADATA.has(key)) throw new Error(`Reserved Hub command metadata key: ${key}`);
  }
  return {
    idempotencyKey: nonEmpty(input.idempotencyKey, 'command idempotencyKey'),
    correlationId: nonEmpty(input.correlationId, 'command correlationId'),
    sourceRef: nonEmpty(input.sourceRef, 'command sourceRef'),
    occurredAt,
    recordedAt,
    expectedState: input.expectedState,
    expectedRevision: input.expectedRevision,
    actor: optionalString(input.actor),
    metadata,
  };
}

function registrationLogicalHash(payload: unknown, actor: string | undefined, occurredAt: string): string {
  return authorityHubCanonicalHash({ type: REGISTRATION_EVENT, payload, actor: actor ?? null, occurredAt });
}

function commandLogicalHashFor(
  event: RepoEvent,
  payload: unknown,
  actor: string | undefined,
  metadata: Record<string, string | number | boolean | null>,
  occurredAt: string,
): string {
  return authorityHubCanonicalHash({
    type: `${COMMAND_PREFIX}${event}`,
    payload,
    actor: actor ?? null,
    metadata,
    occurredAt,
  });
}

function outcomeLogicalHash(payload: AuthorityRepoTransitionOutcomePayload): string {
  return authorityHubCanonicalHash({ type: OUTCOME_EVENT, payload });
}

function assertRegistrationEventIntegrity(event: DurableEvent): void {
  if (event.type !== REGISTRATION_EVENT) throw new Error(`Expected ${REGISTRATION_EVENT}, received ${event.type}`);
  const payload = parseRegistrationPayload(event.payload);
  const actor = typeof event.metadata.actor === 'string' ? event.metadata.actor : undefined;
  const expected = registrationLogicalHash(payload, actor, canonicalTime(event.timestamp, 'registration timestamp'));
  assertEventLogicalHash(event, expected, 'HUB_REGISTRATION_LOGICAL_HASH_MISMATCH');
}

function assertCommandEventIntegrity(event: DurableEvent): string {
  if (!event.type.startsWith(COMMAND_PREFIX)) throw new Error(`Expected Hub command event, received ${event.type}`);
  const eventName = event.type.slice(COMMAND_PREFIX.length) as RepoEvent;
  assertRepoEvent(eventName);
  const payload = parseCommandPayload(event.payload);
  if (payload.event !== eventName) throw new Error(`HUB_COMMAND_TYPE_PAYLOAD_MISMATCH event=${event.type}`);
  const actor = typeof event.metadata.actor === 'string' ? event.metadata.actor : undefined;
  const metadata: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(event.metadata)) {
    if (RESERVED_COMMAND_METADATA.has(key)) continue;
    metadata[key] = value;
  }
  const expected = commandLogicalHashFor(
    eventName,
    payload,
    actor,
    metadata,
    canonicalTime(event.timestamp, 'command timestamp'),
  );
  assertEventLogicalHash(event, expected, 'HUB_COMMAND_LOGICAL_HASH_MISMATCH');
  return expected;
}

function assertOutcomeEventIntegrity(event: DurableEvent): AuthorityRepoTransitionOutcomePayload {
  if (event.type !== OUTCOME_EVENT) throw new Error(`Expected ${OUTCOME_EVENT}, received ${event.type}`);
  const payload = parseOutcomePayload(event.payload);
  validateOutcomeSemantics(payload);
  const expected = outcomeLogicalHash(payload);
  assertEventLogicalHash(event, expected, 'HUB_OUTCOME_LOGICAL_HASH_MISMATCH');
  return payload;
}

function assertCommandOutcomeLink(
  command: DurableEvent,
  outcome: DurableEvent,
  payload: AuthorityRepoTransitionOutcomePayload,
): void {
  const commandHash = assertCommandEventIntegrity(command);
  const commandPayload = parseCommandPayload(command.payload);
  if (payload.commandLogicalHash !== commandHash) throw new Error(`HUB_OUTCOME_COMMAND_HASH_MISMATCH command=${payload.commandEventId}`);
  if (String(command.id) !== payload.commandEventId) throw new Error(`HUB_OUTCOME_COMMAND_ID_MISMATCH command=${payload.commandEventId}`);
  if (outcome.causationId !== command.id) throw new Error(`HUB_OUTCOME_CAUSATION_MISMATCH command=${payload.commandEventId}`);
  if (outcome.sequence <= command.sequence) throw new Error(`HUB_OUTCOME_ORDER_INVALID command=${payload.commandEventId}`);
  if (commandPayload.repoId !== payload.repoId || commandPayload.event !== payload.event) {
    throw new Error(`HUB_OUTCOME_COMMAND_PAYLOAD_MISMATCH command=${payload.commandEventId}`);
  }
}

function parseRegistrationPayload(value: unknown): {
  repoId: string;
  canonicalUri: string;
  owner: string;
  name: string;
  fullName: string;
  projectId: string | null;
  registeredAt: string;
  metadata: Record<string, unknown>;
  sourceRef: string;
} {
  if (!value || typeof value !== 'object') throw new Error('Invalid Hub registration payload');
  const payload = value as Record<string, unknown>;
  const repoId = nonEmpty(String(payload.repoId ?? ''), 'registration repoId');
  const canonicalUri = nonEmpty(String(payload.canonicalUri ?? ''), 'registration canonicalUri');
  const owner = nonEmpty(String(payload.owner ?? ''), 'registration owner').toLowerCase();
  const name = nonEmpty(String(payload.name ?? ''), 'registration name');
  const fullName = nonEmpty(String(payload.fullName ?? ''), 'registration fullName');
  if (fullName !== `${owner}/${name}`) throw new Error(`HUB_REGISTRATION_FULLNAME_MISMATCH ${fullName}`);
  const identity = repositoryIdentity(owner, name);
  if (identity.id !== repoId || identity.uri !== canonicalUri) throw new Error(`HUB_REGISTRATION_IDENTITY_MISMATCH ${fullName}`);
  return {
    repoId,
    canonicalUri,
    owner,
    name,
    fullName,
    projectId: payload.projectId === null || payload.projectId === undefined
      ? null
      : nonEmpty(String(payload.projectId), 'projectId'),
    registeredAt: canonicalTime(String(payload.registeredAt ?? ''), 'registration registeredAt'),
    metadata: canonicalObject(payload.metadata ?? {}, 'registration metadata'),
    sourceRef: nonEmpty(String(payload.sourceRef ?? ''), 'registration sourceRef'),
  };
}

function parseCommandPayload(value: unknown): {
  repoId: string;
  canonicalUri: string;
  event: RepoEvent;
  expectedState: RepoState;
  expectedRevision: number;
  sourceRef: string;
} {
  if (!value || typeof value !== 'object') throw new Error('Invalid Hub command payload');
  const payload = value as Record<string, unknown>;
  const event = String(payload.event ?? '') as RepoEvent;
  assertRepoEvent(event);
  const expectedState = String(payload.expectedState ?? '') as RepoState;
  if (!REPO_STATES.includes(expectedState)) throw new Error(`Invalid Hub command expectedState ${expectedState}`);
  const expectedRevision = Number(payload.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('Invalid Hub command expectedRevision');
  return {
    repoId: nonEmpty(String(payload.repoId ?? ''), 'command repoId'),
    canonicalUri: nonEmpty(String(payload.canonicalUri ?? ''), 'command canonicalUri'),
    event,
    expectedState,
    expectedRevision,
    sourceRef: nonEmpty(String(payload.sourceRef ?? ''), 'command sourceRef'),
  };
}

function parseOutcomePayload(value: unknown): AuthorityRepoTransitionOutcomePayload {
  if (!value || typeof value !== 'object') throw new Error('Invalid Hub transition outcome payload');
  const payload = value as AuthorityRepoTransitionOutcomePayload;
  if (!payload.commandEventId || !payload.commandLogicalHash || !payload.repoId || !payload.event) {
    throw new Error('Incomplete Hub transition outcome payload');
  }
  assertRepoEvent(payload.event);
  if (!REPO_STATES.includes(payload.expectedState)) throw new Error(`Invalid Hub outcome expectedState ${payload.expectedState}`);
  if (!Number.isSafeInteger(payload.expectedRevision) || payload.expectedRevision < 0) throw new Error('Invalid Hub outcome expectedRevision');
  if (payload.disposition !== 'applied' && payload.disposition !== 'rejected') {
    throw new Error(`Invalid Hub outcome disposition ${String(payload.disposition)}`);
  }
  const canonical = canonicalizeJsonValue(payload);
  return structuredClone(canonical) as unknown as AuthorityRepoTransitionOutcomePayload;
}

function validateOutcomeSemantics(payload: AuthorityRepoTransitionOutcomePayload): void {
  if (payload.disposition === 'rejected') {
    if (payload.before.stateHash !== payload.after.stateHash
      || payload.before.revision !== payload.after.revision
      || payload.before.state !== payload.after.state) {
      throw new Error(`HUB_REJECTED_OUTCOME_MUTATED_STATE command=${payload.commandEventId}`);
    }
    return;
  }
  if (payload.before.state !== payload.expectedState || payload.before.revision !== payload.expectedRevision) {
    throw new Error(`HUB_APPLIED_OUTCOME_IGNORED_EXPECTED_STATE command=${payload.commandEventId}`);
  }
  if (payload.after.revision !== payload.before.revision + 1) {
    throw new Error(`HUB_APPLIED_OUTCOME_REVISION_INVALID command=${payload.commandEventId}`);
  }
  const transition = REPO_TRANSITIONS.find(candidate =>
    candidate.from === payload.before.state
    && candidate.event === payload.event
    && candidate.to === payload.after.state);
  if (!transition) throw new Error(`HUB_APPLIED_OUTCOME_TRANSITION_INVALID command=${payload.commandEventId}`);
}

function assertRepositoryDefinition(definition: AuthorityHubSnapshotRepository): void {
  const owner = nonEmpty(definition.owner, 'repository owner').toLowerCase();
  const name = nonEmpty(definition.name, 'repository name');
  const fullName = `${owner}/${name}`;
  if (definition.fullName !== fullName) throw new Error(`HUB_REPOSITORY_FULLNAME_MISMATCH ${definition.fullName}`);
  const identity = repositoryIdentity(owner, name);
  if (identity.id !== definition.id || identity.uri !== definition.canonicalUri) {
    throw new Error(`HUB_REPOSITORY_IDENTITY_MISMATCH ${definition.fullName}`);
  }
  canonicalTime(definition.registeredAt, 'repository registeredAt');
  canonicalObject(definition.metadata, 'repository metadata');
}

function semanticHubHash(repositories: AuthorityHubSnapshotRepository[]): string {
  return authorityHubCanonicalHash({
    schemaVersion: 1,
    repositories: repositories.map(cloneSnapshotRepository).sort((a, b) => a.id.localeCompare(b.id)),
  });
}

function assertEventLogicalHash(event: DurableEvent, expected: string, code: string): void {
  const actual = typeof event.metadata.logicalHash === 'string' ? event.metadata.logicalHash : '';
  if (actual !== expected) throw new Error(`${code} expected=${expected} actual=${actual || 'missing'}`);
}

function repositoryDefinition(repo: AuthorityHubRepository): Record<string, unknown> {
  return {
    id: repo.id,
    canonicalUri: repo.canonicalUri,
    owner: repo.owner,
    name: repo.name,
    fullName: repo.fullName,
    ...(repo.projectId === undefined ? {} : { projectId: repo.projectId }),
    registeredAt: repo.registeredAt,
    metadata: canonicalObject(repo.metadata, 'repository metadata'),
  };
}

function cloneRepository(repo: AuthorityHubRepository): AuthorityHubRepository {
  return {
    id: repo.id,
    canonicalUri: repo.canonicalUri,
    owner: repo.owner,
    name: repo.name,
    fullName: repo.fullName,
    ...(repo.projectId === undefined ? {} : { projectId: repo.projectId }),
    state: repo.state,
    stateRevision: repo.stateRevision,
    stateHash: repo.stateHash,
    registeredAt: repo.registeredAt,
    metadata: canonicalObject(repo.metadata, 'repository metadata'),
  };
}

function cloneSnapshotRepository(repo: AuthorityHubSnapshotRepository): AuthorityHubSnapshotRepository {
  return {
    id: repo.id,
    canonicalUri: repo.canonicalUri,
    owner: repo.owner,
    name: repo.name,
    fullName: repo.fullName,
    ...(repo.projectId === undefined ? {} : { projectId: repo.projectId }),
    registeredAt: repo.registeredAt,
    metadata: canonicalObject(repo.metadata, 'repository metadata'),
    stateSnapshot: structuredClone(repo.stateSnapshot),
  };
}

function authorityHubCanonicalHash(value: unknown): string {
  return canonicalHash128({
    serializationVersion: CANONICAL_JSON_WIRE_VERSION,
    value: canonicalizeJsonValue(value),
  });
}

function canonicalObject(value: unknown, label: string): Record<string, unknown> {
  const canonical = canonicalizeJsonValue(value);
  if (!canonical || Array.isArray(canonical) || typeof canonical !== 'object') {
    throw new Error(`${label} must be a canonical JSON object`);
  }
  return structuredClone(canonical) as Record<string, unknown>;
}

function canonicalScalarMetadata(
  value: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  const canonical = canonicalObject(value, 'Hub command metadata');
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(canonical)) {
    if (item !== null && typeof item === 'object') throw new Error(`Hub command metadata.${key} must be scalar`);
    result[key] = item as string | number | boolean | null;
  }
  return result;
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function assertRecordedAfterOccurred(occurredAt: string, recordedAt: string): void {
  if (Date.parse(recordedAt) < Date.parse(occurredAt)) {
    throw new Error(`recordedAt cannot precede occurredAt (${recordedAt} < ${occurredAt})`);
  }
}

function assertCursor(cursor: EventLogCursor): void {
  if (!Number.isSafeInteger(cursor.sequence) || cursor.sequence < 0) {
    throw new Error(`Invalid event-log cursor ${cursor.sequence}`);
  }
}

function assertRepoEvent(value: RepoEvent): void {
  if (!REPO_EVENTS.has(value)) throw new Error(`Invalid repository event ${String(value)}`);
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function optionalString(value?: string): string | undefined {
  const normalized = value?.normalize('NFC').trim();
  return normalized || undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
