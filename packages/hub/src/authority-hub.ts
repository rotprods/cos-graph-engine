import {
  canonicalIdentity,
  stableHash128,
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

const REPO_MACHINE_DEFINITION_REVISION = 'cos-hub/repository-state/v1';
const REGISTRATION_EVENT = 'hub.authority.repo.registered';
const COMMAND_PREFIX = 'hub.authority.repo.command.';
const OUTCOME_EVENT = 'hub.authority.repo.transition_outcome';

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
 * Authority repository runtime for COS Hub.
 *
 * This is intentionally additive: legacy `CosHub` remains a shadow/compatibility
 * surface until migration evidence exists. Authority guarantees are:
 *
 * - repository registration is event-sourced with canonical identity;
 * - each command and its accepted/rejected outcome are separate durable events;
 * - the whole command → transition → outcome operation is serialized per repo;
 * - an outcome append failure rolls the in-memory state machine back before the
 *   per-repository operation queue is released;
 * - retries are payload-bound even when an EventLog adapter only deduplicates by key;
 * - replay restores recorded state snapshots/outcomes and never re-runs the
 *   historical transition decision;
 * - snapshot creation refuses a cursor containing commands without outcomes;
 * - all authority timestamps are explicit — no wall clock enters event identity.
 *
 * State callbacks must remain side-effect free. External mutations belong to the
 * durable capability/operation-ledger path, not inside repository state callbacks.
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
      const logicalHash = stableHash128({
        type: REGISTRATION_EVENT,
        payload,
        actor: normalized.actor ?? null,
        occurredAt: normalized.occurredAt,
        recordedAt: normalized.recordedAt,
      });
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
      assertEventLogicalHash(append.event, logicalHash, 'HUB_REGISTRATION_IDEMPOTENCY_CONFLICT');
      const repository = this.materializeRegistration(append.event);
      return cloneRepository(repository);
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
      const commandLogicalHash = stableHash128({
        type: `${COMMAND_PREFIX}${event}`,
        payload: commandPayload,
        actor: normalized.actor ?? null,
        metadata: normalized.metadata,
        occurredAt: normalized.occurredAt,
        recordedAt: normalized.recordedAt,
      });
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
          logicalHash: commandLogicalHash,
          sourceRef: normalized.sourceRef,
          actor: normalized.actor ?? null,
          ...normalized.metadata,
        },
        severity: event === 'build_failed' || event === 'deployment_failed' ? 'error' : 'info',
        timestamp: normalized.occurredAt,
        traceId: normalized.correlationId,
        spanId: `hubcmd_${commandLogicalHash.slice(0, 16)}`,
        idempotencyKey: normalized.idempotencyKey,
        correlationId: normalized.correlationId,
        recordedAt: normalized.recordedAt,
      });
      assertEventLogicalHash(commandAppend.event, commandLogicalHash, 'HUB_COMMAND_IDEMPOTENCY_CONFLICT');

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
        error,
      };

      let outcome: DurableEvent;
      try {
        outcome = await this.appendOutcome(commandAppend.event, outcomeKey, normalized, payload);
      } catch (cause) {
        if (after.stateHash !== before.stateHash) {
          this.replaceMachineFromSnapshot(repo, before);
        }
        throw cause;
      }

      this.commitRepositoryState(repo.id, after);
      return this.resultFromOutcome(outcome, false, commandLogicalHash);
    });
  }

  /**
   * Rebuilds authority repository projection from durable registrations/outcomes.
   * Transition callbacks/guards are never executed during replay.
   */
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
          this.materializeRegistration(durable);
          registrations += 1;
        } else if (durable.type.startsWith(COMMAND_PREFIX)) {
          pendingCommands.set(String(durable.id), durable);
          commands += 1;
        } else if (durable.type === OUTCOME_EVENT) {
          const payload = parseOutcomePayload(durable.payload);
          const command = pendingCommands.get(payload.commandEventId)
            ?? await this.eventLog.get(payload.commandEventId as EntityId);
          if (!command) throw new Error(`HUB_REPLAY_MISSING_COMMAND id=${payload.commandEventId}`);
          assertEventLogicalHash(command, payload.commandLogicalHash, 'HUB_REPLAY_COMMAND_HASH_MISMATCH');
          this.applyRecordedOutcome(payload);
          pendingCommands.delete(payload.commandEventId);
          outcomes += 1;
          if (payload.disposition === 'applied') applied += 1;
          else rejected += 1;
        }
      }
      currentCursor = { sequence: batch[batch.length - 1].sequence };
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
    const base = {
      schemaVersion: 1 as const,
      eventCursor,
      repositories,
    };
    return {
      ...base,
      recordedAt: timestamp,
      stateHash: stableHash128(base),
    };
  }

  restoreSnapshot(snapshot: AuthorityHubSnapshot): void {
    if (this.repos.size > 0) throw new Error('HUB_RESTORE_REQUIRES_EMPTY_PROJECTION');
    if (snapshot.schemaVersion !== 1) throw new Error(`Unsupported AuthorityHub snapshot schema ${snapshot.schemaVersion}`);
    canonicalTime(snapshot.recordedAt, 'Hub snapshot recordedAt');
    assertCursor(snapshot.eventCursor);
    const base = {
      schemaVersion: 1 as const,
      eventCursor: snapshot.eventCursor,
      repositories: snapshot.repositories.map(cloneSnapshotRepository).sort((a, b) => a.id.localeCompare(b.id)),
    };
    const expectedHash = stableHash128(base);
    if (expectedHash !== snapshot.stateHash) {
      throw new Error(`HUB_SNAPSHOT_STATE_HASH_MISMATCH expected=${snapshot.stateHash} actual=${expectedHash}`);
    }

    for (const definition of base.repositories) {
      const identity = repositoryIdentity(definition.owner, definition.name);
      if (identity.id !== definition.id || identity.uri !== definition.canonicalUri) {
        throw new Error(`HUB_SNAPSHOT_IDENTITY_MISMATCH repository=${definition.fullName}`);
      }
      const repo = this.materializeRepositoryDefinition(definition);
      this.replaceMachineFromSnapshot(repo, definition.stateSnapshot);
    }
    if (this.projectionHash() !== snapshot.stateHash) {
      throw new Error(`HUB_SNAPSHOT_RESTORE_DIVERGENCE expected=${snapshot.stateHash} actual=${this.projectionHash()}`);
    }
  }

  projectionHash(): string {
    const repositories = this.snapshotRepositories();
    return stableHash128({
      schemaVersion: 1,
      eventCursor: { sequence: 0 },
      repositories,
    });
  }

  private async appendOutcome(
    command: DurableEvent,
    outcomeKey: string,
    context: ReturnType<typeof normalizeCommandContext>,
    payload: AuthorityRepoTransitionOutcomePayload,
  ): Promise<DurableEvent> {
    validateOutcomeSemantics(payload);
    const logicalHash = stableHash128({ type: OUTCOME_EVENT, payload, recordedAt: context.recordedAt });
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
    assertEventLogicalHash(result.event, logicalHash, 'HUB_OUTCOME_IDEMPOTENCY_CONFLICT');
    return result.event;
  }

  private resultFromOutcome(
    outcome: DurableEvent,
    duplicate: boolean,
    commandLogicalHash: string,
  ): AuthorityRepoEventResult {
    if (outcome.type !== OUTCOME_EVENT) throw new Error(`Expected ${OUTCOME_EVENT}, received ${outcome.type}`);
    const payload = parseOutcomePayload(outcome.payload);
    if (payload.commandLogicalHash !== commandLogicalHash) {
      throw new Error(`HUB_OUTCOME_COMMAND_HASH_CONFLICT command=${payload.commandEventId}`);
    }
    validateOutcomeSemantics(payload);
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
      error: payload.error,
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
    if (event.type !== REGISTRATION_EVENT) throw new Error(`Expected ${REGISTRATION_EVENT}, received ${event.type}`);
    const payload = parseRegistrationPayload(event.payload);
    const existing = this.repos.get(payload.repoId);
    if (existing) {
      if (stableHash128(repositoryDefinition(existing)) !== stableHash128({
        id: payload.repoId,
        canonicalUri: payload.canonicalUri,
        owner: payload.owner,
        name: payload.name,
        fullName: payload.fullName,
        projectId: payload.projectId ?? undefined,
        registeredAt: payload.registeredAt,
        metadata: payload.metadata,
      })) {
        throw new Error(`HUB_REPOSITORY_DEFINITION_CONFLICT id=${payload.repoId}`);
      }
      return existing;
    }
    return this.materializeRepositoryDefinition({
      id: payload.repoId,
      canonicalUri: payload.canonicalUri,
      owner: payload.owner,
      name: payload.name,
      fullName: payload.fullName,
      projectId: payload.projectId ?? undefined,
      registeredAt: payload.registeredAt,
      metadata: payload.metadata,
      stateSnapshot: createRepoMachine({
        id: payload.repoId,
        fullName: payload.fullName,
        registeredAt: payload.registeredAt,
      }).snapshot(),
    });
  }

  private materializeRepositoryDefinition(definition: AuthorityHubSnapshotRepository): AuthorityHubRepository {
    assertCanonicalJson(definition.metadata, 'repository metadata');
    const repo: AuthorityHubRepository = {
      id: definition.id,
      canonicalUri: definition.canonicalUri,
      owner: definition.owner,
      name: definition.name,
      fullName: definition.fullName,
      projectId: definition.projectId,
      state: definition.stateSnapshot.state as RepoState,
      stateRevision: definition.stateSnapshot.revision,
      stateHash: definition.stateSnapshot.stateHash,
      registeredAt: canonicalTime(definition.registeredAt, 'repository registeredAt'),
      metadata: structuredClone(definition.metadata),
    };
    this.repos.set(repo.id, repo);
    this.repoByFullName.set(repo.fullName.toLowerCase(), repo.id);
    this.repoByUri.set(repo.canonicalUri, repo.id);
    if (!this.states.has(repo.id)) {
      this.states.set(repo.id, createRepoMachine(repo));
    }
    return repo;
  }

  private replaceMachineFromSnapshot(repo: AuthorityHubRepository, snapshot: AuthorityStateSnapshot): void {
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
        projectId: repo.projectId,
        registeredAt: repo.registeredAt,
        metadata: structuredClone(repo.metadata),
        stateSnapshot: machine.snapshot(),
      };
    }).sort((left, right) => left.id.localeCompare(right.id));
  }

  private async assertNoIncompleteCommandsThrough(cursor: EventLogCursor): Promise<void> {
    const commands = new Set<string>();
    const outcomes = new Set<string>();
    let readCursor: EventLogCursor = { sequence: 0 };
    while (readCursor.sequence < cursor.sequence) {
      const batch = await this.eventLog.readFrom(readCursor, 1000);
      if (!batch.length) break;
      for (const event of batch) {
        if (event.sequence > cursor.sequence) break;
        if (event.type.startsWith(COMMAND_PREFIX)) commands.add(String(event.id));
        if (event.type === OUTCOME_EVENT) {
          const payload = parseOutcomePayload(event.payload);
          outcomes.add(payload.commandEventId);
        }
      }
      const last = batch.filter(event => event.sequence <= cursor.sequence).at(-1);
      if (!last) break;
      readCursor = { sequence: last.sequence };
    }
    const missing = Array.from(commands).filter(command => !outcomes.has(command));
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
  const machineIdentity = canonicalIdentity({
    scheme: 'agentic',
    authority: 'cos-hub',
    resourceType: 'repository-state-machine',
    resourceId: repo.id,
  }, 'fsm');
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
  const metadata = input.metadata ?? {};
  assertCanonicalJson(metadata, 'repository metadata');
  const occurredAt = canonicalTime(input.occurredAt, 'registration occurredAt');
  const recordedAt = canonicalTime(input.recordedAt, 'registration recordedAt');
  assertRecordedAfterOccurred(occurredAt, recordedAt);
  return {
    owner,
    name,
    projectId,
    metadata: structuredClone(metadata),
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
  return {
    idempotencyKey: nonEmpty(input.idempotencyKey, 'command idempotencyKey'),
    correlationId: nonEmpty(input.correlationId, 'command correlationId'),
    sourceRef: nonEmpty(input.sourceRef, 'command sourceRef'),
    occurredAt,
    recordedAt,
    expectedState: input.expectedState,
    expectedRevision: input.expectedRevision,
    actor: optionalString(input.actor),
    metadata: { ...(input.metadata ?? {}) },
  };
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
  const metadata = payload.metadata && typeof payload.metadata === 'object'
    ? payload.metadata as Record<string, unknown>
    : {};
  assertCanonicalJson(metadata, 'registration metadata');
  return {
    repoId,
    canonicalUri,
    owner,
    name,
    fullName,
    projectId: payload.projectId === null || payload.projectId === undefined ? null : nonEmpty(String(payload.projectId), 'projectId'),
    registeredAt: canonicalTime(String(payload.registeredAt ?? ''), 'registration registeredAt'),
    metadata: structuredClone(metadata),
    sourceRef: nonEmpty(String(payload.sourceRef ?? ''), 'registration sourceRef'),
  };
}

function parseOutcomePayload(value: unknown): AuthorityRepoTransitionOutcomePayload {
  if (!value || typeof value !== 'object') throw new Error('Invalid Hub transition outcome payload');
  const payload = value as AuthorityRepoTransitionOutcomePayload;
  if (!payload.commandEventId || !payload.commandLogicalHash || !payload.repoId || !payload.event) {
    throw new Error('Incomplete Hub transition outcome payload');
  }
  if (payload.disposition !== 'applied' && payload.disposition !== 'rejected') {
    throw new Error(`Invalid Hub outcome disposition ${String(payload.disposition)}`);
  }
  return structuredClone(payload);
}

function validateOutcomeSemantics(payload: AuthorityRepoTransitionOutcomePayload): void {
  if (payload.before.state !== payload.expectedState || payload.before.revision !== payload.expectedRevision) {
    if (payload.disposition === 'applied') {
      throw new Error(`HUB_APPLIED_OUTCOME_IGNORED_EXPECTED_STATE command=${payload.commandEventId}`);
    }
  }
  if (payload.disposition === 'rejected') {
    if (payload.before.stateHash !== payload.after.stateHash
      || payload.before.revision !== payload.after.revision
      || payload.before.state !== payload.after.state) {
      throw new Error(`HUB_REJECTED_OUTCOME_MUTATED_STATE command=${payload.commandEventId}`);
    }
    return;
  }
  if (payload.after.revision !== payload.before.revision + 1) {
    throw new Error(`HUB_APPLIED_OUTCOME_REVISION_INVALID command=${payload.commandEventId}`);
  }
  const transition = REPO_TRANSITIONS.find(candidate =>
    candidate.from === payload.before.state
    && candidate.event === payload.event
    && candidate.to === payload.after.state);
  if (!transition) {
    throw new Error(`HUB_APPLIED_OUTCOME_TRANSITION_INVALID command=${payload.commandEventId}`);
  }
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
    projectId: repo.projectId,
    registeredAt: repo.registeredAt,
    metadata: repo.metadata,
  };
}

function cloneRepository(repo: AuthorityHubRepository): AuthorityHubRepository {
  return { ...repo, metadata: structuredClone(repo.metadata) };
}

function cloneSnapshotRepository(repo: AuthorityHubSnapshotRepository): AuthorityHubSnapshotRepository {
  return {
    ...repo,
    metadata: structuredClone(repo.metadata),
    stateSnapshot: structuredClone(repo.stateSnapshot),
  };
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

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function optionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertCanonicalJson(value: unknown, path: string, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`);
    return;
  }
  if (typeof value !== 'object') throw new Error(`${path} contains unsupported ${typeof value}`);
  if (seen.has(value as object)) throw new Error(`${path} contains a cycle`);
  seen.add(value as object);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertCanonicalJson(item, `${path}[${index}]`, seen));
    seen.delete(value as object);
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${path} contains a non-plain object`);
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    assertCanonicalJson(item, `${path}.${key}`, seen);
  }
  seen.delete(value as object);
}
