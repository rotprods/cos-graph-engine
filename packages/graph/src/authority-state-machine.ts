import {
  generateId,
  stableHash128,
  type EntityId,
  type Timestamp,
} from '@cos/core';
import type {
  StateConfig,
  StateContext,
  StateId,
  StateMachineDefinition,
  StateTransition,
} from './level2-state';

export interface AuthorityStateMachineOptions {
  /** Durable callers should supply a canonical ID; generated IDs are ephemeral. */
  machineId?: EntityId;
  initialRevision?: number;
  maxFailures?: number;
  /** Immutable source revision for callback/definition code. */
  definitionRevision?: string;
  /** Injectable clock for deterministic tests and replay. */
  clock?: () => Timestamp;
}

export interface AuthorityTransitionOptions {
  expectedState?: StateId;
  expectedRevision?: number;
  /** Replay should pass the timestamp recorded in the source event. */
  occurredAt?: Timestamp;
}

export interface AuthorityDataMutationOptions {
  expectedRevision?: number;
  occurredAt?: Timestamp;
}

export interface AuthorityTransitionReceipt {
  event: string;
  from: StateId;
  to: StateId;
  previousRevision: number;
  revision: number;
  applied: boolean;
  stateHash: string;
  error?: string;
}

export interface AuthorityStateSnapshot {
  schemaVersion: 1;
  machineId: EntityId;
  name: string;
  definitionRevision: string;
  definitionHash: string;
  state: StateId;
  revision: number;
  context: StateContext;
  stateHash: string;
}

export interface AuthorityStateFailure {
  operation: 'transition' | 'guard' | 'callback' | 'listener' | 'timeout' | 'data';
  event?: string;
  state: StateId;
  revision: number;
  occurredAt: Timestamp;
  error: string;
}

/**
 * Canonical authority state-machine path.
 *
 * The legacy `StateMachine` remains available for backwards compatibility and
 * builder-style tests. This class owns authority semantics:
 *
 * - one serialized mutation queue for transitions and data changes;
 * - expected-state and expected-revision fencing inside that queue;
 * - callbacks execute against a staged copy, never canonical state;
 * - canonical state is committed only after exit/action/entry all succeed;
 * - copy-safe reads and JSON-like canonical context data;
 * - deterministic snapshots and restore verification;
 * - timer generation fencing;
 * - listener/observer failure cannot change the protected transition outcome.
 *
 * Callback code must not perform external side effects. Such effects belong in
 * the durable operation-ledger/capability path because no in-memory state machine
 * can roll back an external filesystem, network or provider mutation.
 */
export class AuthorityStateMachine {
  private readonly definition: StateMachineDefinition;
  private readonly definitionRevision: string;
  private readonly definitionHashValue: string;
  private readonly clock: () => Timestamp;
  private readonly maxFailures: number;
  private context: StateContext;
  private revision: number;
  private operationTail: Promise<void> = Promise.resolve();
  private pendingOperations = 0;
  private listeners = new Set<(receipt: Readonly<AuthorityTransitionReceipt>) => void>();
  private failures: AuthorityStateFailure[] = [];
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private timerGeneration = 0;
  private disposed = false;

  constructor(
    name: string,
    states: StateConfig[],
    transitions: StateTransition[],
    initial?: StateId,
    options: AuthorityStateMachineOptions = {},
  ) {
    const machineId = options.machineId ?? generateId();
    const definitionRevision = (options.definitionRevision ?? 'unversioned').trim();
    if (!definitionRevision) throw new Error('definitionRevision must not be empty');
    const initialRevision = options.initialRevision ?? 0;
    if (!Number.isSafeInteger(initialRevision) || initialRevision < 0) {
      throw new Error('initialRevision must be a non-negative safe integer');
    }
    const maxFailures = options.maxFailures ?? 1000;
    if (!Number.isSafeInteger(maxFailures) || maxFailures < 1 || maxFailures > 100_000) {
      throw new Error('maxFailures must be a safe integer in [1,100000]');
    }

    this.definition = {
      id: machineId,
      name: name.trim(),
      states: states.map(cloneState),
      transitions: transitions.map(cloneTransition),
      initial: initial || states.find(state => state.type === 'initial')?.id || states[0]?.id || '',
    };
    assertDefinition(this.definition);
    this.definitionRevision = definitionRevision;
    this.definitionHashValue = definitionHash(this.definition, definitionRevision);
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.maxFailures = maxFailures;
    this.revision = initialRevision;
    const startedAt = canonicalTime(this.clock(), 'clock');
    this.context = {
      machineId,
      currentState: this.definition.initial,
      previousState: null,
      history: [],
      data: {},
      errors: [],
      startedAt,
      transitions: 0,
    };
    this.scheduleTimeout();
  }

  get id(): EntityId { return this.definition.id; }
  get name(): string { return this.definition.name; }
  get state(): StateId { return this.context.currentState; }
  get currentRevision(): number { return this.revision; }
  get definitionHash(): string { return this.definitionHashValue; }
  get contextData(): StateContext { return cloneContext(this.context); }
  get states(): StateConfig[] { return this.definition.states.map(cloneState); }
  get transitions(): StateTransition[] { return this.definition.transitions.map(cloneTransition); }

  async send(
    event: string,
    payload?: Record<string, unknown>,
    options: AuthorityTransitionOptions = {},
  ): Promise<boolean> {
    return (await this.transition(event, payload, options)).applied;
  }

  transition(
    event: string,
    payload?: Record<string, unknown>,
    options: AuthorityTransitionOptions = {},
  ): Promise<AuthorityTransitionReceipt> {
    const normalizedEvent = event.trim();
    if (!normalizedEvent) return Promise.reject(new Error('State event must not be empty'));
    return this.enqueue(() => this.transitionLocked(normalizedEvent, payload, options));
  }

  patchData(
    patch: Record<string, unknown>,
    options: AuthorityDataMutationOptions = {},
  ): Promise<AuthorityStateSnapshot> {
    return this.enqueue(() => this.mutateDataLocked('patch', patch, options));
  }

  replaceData(
    data: Record<string, unknown>,
    options: AuthorityDataMutationOptions = {},
  ): Promise<AuthorityStateSnapshot> {
    return this.enqueue(() => this.mutateDataLocked('replace', data, options));
  }

  can(event: string): boolean {
    const normalized = event.trim();
    return this.definition.transitions.some(
      transition => transition.from === this.state && transition.event === normalized,
    );
  }

  getAvailableEvents(): string[] {
    return this.definition.transitions
      .filter(transition => transition.from === this.state)
      .map(transition => transition.event)
      .sort((a, b) => a.localeCompare(b));
  }

  isInFinalState(): boolean {
    return this.definition.states.find(state => state.id === this.state)?.type === 'final';
  }

  onChange(listener: (receipt: Readonly<AuthorityTransitionReceipt>) => void): () => void {
    this.assertActive();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getFailureLog(limit = 100): AuthorityStateFailure[] {
    if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('failure-log limit must be a non-negative safe integer');
    return this.failures.slice(-Math.min(limit, this.maxFailures)).map(failure => ({ ...failure }));
  }

  snapshot(): AuthorityStateSnapshot {
    const context = cloneContext(this.context);
    const base = {
      schemaVersion: 1 as const,
      machineId: this.id,
      name: this.name,
      definitionRevision: this.definitionRevision,
      definitionHash: this.definitionHashValue,
      state: this.state,
      revision: this.revision,
      context,
    };
    return { ...base, stateHash: stableHash128(base) };
  }

  toDefinition(): StateMachineDefinition {
    return {
      id: this.definition.id,
      name: this.definition.name,
      states: this.definition.states.map(cloneState),
      transitions: this.definition.transitions.map(cloneTransition),
      initial: this.definition.initial,
    };
  }

  validate(): string[] {
    const errors: string[] = [];
    try { assertDefinition(this.definition); } catch (error) { errors.push(errorMessage(error)); }
    try { validateContext(this.context, this.definition, this.revision); } catch (error) { errors.push(errorMessage(error)); }
    if (definitionHash(this.definition, this.definitionRevision) !== this.definitionHashValue) {
      errors.push('Authority state-machine definition hash drifted');
    }
    if (this.snapshot().stateHash !== this.snapshot().stateHash) {
      errors.push('Authority state-machine snapshot is non-deterministic');
    }
    return errors.sort();
  }

  metrics(): {
    stateCount: number;
    transitionCount: number;
    uniqueEvents: number;
    finalStates: number;
    historyLength: number;
    totalTransitions: number;
    revision: number;
    failureCount: number;
    pendingOperations: number;
    disposed: boolean;
  } {
    return {
      stateCount: this.definition.states.length,
      transitionCount: this.definition.transitions.length,
      uniqueEvents: new Set(this.definition.transitions.map(transition => transition.event)).size,
      finalStates: this.definition.states.filter(state => state.type === 'final').length,
      historyLength: this.context.history.length,
      totalTransitions: this.context.transitions,
      revision: this.revision,
      failureCount: this.failures.length,
      pendingOperations: this.pendingOperations,
      disposed: this.disposed,
    };
  }

  toMermaid(): string {
    let output = `stateDiagram-v2\n  title: "${escapeMermaid(this.name)}"\n`;
    for (const state of this.definition.states) {
      if (state.type === 'initial') output += `  [*] --> ${state.id}\n`;
      if (state.type === 'final') output += `  ${state.id} --> [*]\n`;
    }
    for (const transition of this.definition.transitions) {
      output += `  ${transition.from} --> ${transition.to}: ${escapeMermaid(transition.event)}\n`;
    }
    return output;
  }

  visualize(): string {
    return [
      `Authority FSM: ${this.name}`,
      `id=${String(this.id)}`,
      `state=${this.state}`,
      `revision=${this.revision}`,
      `definition=${this.definitionHashValue}`,
      `history=${this.context.history.length}`,
      `pending=${this.pendingOperations}`,
      `failures=${this.failures.length}`,
      `events=${this.getAvailableEvents().join(',') || 'none'}`,
    ].join('\n');
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.timerGeneration += 1;
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
    this.listeners.clear();
  }

  static restore(
    name: string,
    states: StateConfig[],
    transitions: StateTransition[],
    snapshot: AuthorityStateSnapshot,
    options: Omit<AuthorityStateMachineOptions, 'machineId' | 'initialRevision' | 'definitionRevision'> & {
      definitionRevision?: string;
    } = {},
  ): AuthorityStateMachine {
    if (snapshot.schemaVersion !== 1) throw new Error(`Unsupported authority state snapshot schema: ${snapshot.schemaVersion}`);
    const machine = new AuthorityStateMachine(name, states, transitions, snapshot.context.currentState, {
      ...options,
      machineId: snapshot.machineId,
      initialRevision: snapshot.revision,
      definitionRevision: options.definitionRevision ?? snapshot.definitionRevision,
    });
    if (machine.definitionHash !== snapshot.definitionHash) {
      machine.dispose();
      throw new Error(`STATE_DEFINITION_HASH_MISMATCH expected=${snapshot.definitionHash} actual=${machine.definitionHash}`);
    }
    const base = { ...snapshot } as Record<string, unknown>;
    delete base.stateHash;
    const expectedHash = stableHash128(base);
    if (expectedHash !== snapshot.stateHash) {
      machine.dispose();
      throw new Error(`STATE_SNAPSHOT_INTEGRITY_MISMATCH expected=${snapshot.stateHash} actual=${expectedHash}`);
    }
    validateContext(snapshot.context, machine.definition, snapshot.revision);
    machine.clearTimeout();
    machine.context = cloneContext(snapshot.context);
    machine.revision = snapshot.revision;
    machine.scheduleTimeout();
    return machine;
  }

  private enqueue<T>(operation: () => Promise<T> | T): Promise<T> {
    this.assertActive();
    this.pendingOperations += 1;
    const result = this.operationTail.then(operation);
    this.operationTail = result.then(() => undefined, () => undefined);
    return result.finally(() => { this.pendingOperations -= 1; });
  }

  private async transitionLocked(
    event: string,
    payload: Record<string, unknown> | undefined,
    options: AuthorityTransitionOptions,
  ): Promise<AuthorityTransitionReceipt> {
    this.assertActive();
    assertExpectedState(options.expectedState, this.state);
    assertExpectedRevision(options.expectedRevision, this.revision);
    const occurredAt = canonicalTime(options.occurredAt ?? this.clock(), 'transition occurredAt');
    if (payload !== undefined) assertCanonicalJson(payload, 'transition payload');

    const from = this.state;
    const previousRevision = this.revision;
    const transition = this.definition.transitions.find(
      candidate => candidate.from === from && candidate.event === event,
    );
    if (!transition) {
      const error = `TRANSITION_NOT_FOUND event=${event} state=${from}`;
      this.recordFailure('transition', error, occurredAt, event);
      return this.receipt(event, from, from, previousRevision, false, error);
    }

    const guardContext = cloneContext(this.context);
    try {
      if (transition.guard && !transition.guard(guardContext)) {
        const error = `TRANSITION_GUARD_REJECTED event=${event} state=${from}`;
        this.recordFailure('guard', error, occurredAt, event);
        return this.receipt(event, from, from, previousRevision, false, error);
      }
    } catch (error) {
      const message = `TRANSITION_GUARD_FAILED event=${event} state=${from}: ${errorMessage(error)}`;
      this.recordFailure('guard', message, occurredAt, event);
      return this.receipt(event, from, from, previousRevision, false, message);
    }

    this.timerGeneration += 1;
    this.clearTimeout();
    const staged = cloneContext(this.context);
    try {
      const fromConfig = this.definition.states.find(state => state.id === from);
      if (fromConfig?.exit) await fromConfig.exit(staged);

      staged.previousState = from;
      staged.currentState = transition.to;
      staged.history.push({ from, to: transition.to, event, timestamp: occurredAt });
      staged.transitions += 1;
      if (payload !== undefined) staged.data = { ...staged.data, ...structuredClone(payload) };

      if (transition.action) await transition.action(staged);
      const toConfig = this.definition.states.find(state => state.id === transition.to);
      if (toConfig?.entry) await toConfig.entry(staged);

      validateStagedTransition(this.context, staged, transition, event, occurredAt);
      assertCanonicalJson(staged.data, 'state context data');
      const committed = cloneContext(staged);
      this.context = committed;
      this.revision += 1;
      this.scheduleTimeout();
      const receipt = this.receipt(event, from, transition.to, previousRevision, true);
      for (const listener of Array.from(this.listeners)) {
        try { listener(Object.freeze({ ...receipt })); }
        catch (error) {
          this.recordFailure(
            'listener',
            `STATE_LISTENER_FAILED event=${event}: ${errorMessage(error)}`,
            occurredAt,
            event,
          );
        }
      }
      return receipt;
    } catch (error) {
      const message = `TRANSITION_CALLBACK_FAILED event=${event} ${from}->${transition.to}: ${errorMessage(error)}`;
      this.recordFailure('callback', message, occurredAt, event);
      this.scheduleTimeout();
      return this.receipt(event, from, from, previousRevision, false, message);
    }
  }

  private mutateDataLocked(
    mode: 'patch' | 'replace',
    value: Record<string, unknown>,
    options: AuthorityDataMutationOptions,
  ): AuthorityStateSnapshot {
    this.assertActive();
    assertExpectedRevision(options.expectedRevision, this.revision);
    const occurredAt = canonicalTime(options.occurredAt ?? this.clock(), 'data mutation occurredAt');
    try {
      assertCanonicalJson(value, 'state data mutation');
      const nextData = mode === 'replace'
        ? structuredClone(value)
        : { ...structuredClone(this.context.data), ...structuredClone(value) };
      assertCanonicalJson(nextData, 'next state data');
      const nextContext = cloneContext(this.context);
      nextContext.data = nextData;
      this.context = nextContext;
      this.revision += 1;
      return this.snapshot();
    } catch (error) {
      this.recordFailure('data', `STATE_DATA_${mode.toUpperCase()}_FAILED: ${errorMessage(error)}`, occurredAt);
      throw error;
    }
  }

  private receipt(
    event: string,
    from: StateId,
    to: StateId,
    previousRevision: number,
    applied: boolean,
    error?: string,
  ): AuthorityTransitionReceipt {
    return {
      event,
      from,
      to,
      previousRevision,
      revision: this.revision,
      applied,
      stateHash: this.snapshot().stateHash,
      error,
    };
  }

  private recordFailure(
    operation: AuthorityStateFailure['operation'],
    error: string,
    occurredAt: Timestamp,
    event?: string,
  ): void {
    this.failures.push({
      operation,
      event,
      state: this.state,
      revision: this.revision,
      occurredAt,
      error,
    });
    if (this.failures.length > this.maxFailures) this.failures = this.failures.slice(-this.maxFailures);
  }

  private scheduleTimeout(): void {
    if (this.disposed) return;
    const state = this.definition.states.find(candidate => candidate.id === this.state);
    if (!state?.timeout) return;
    const generation = this.timerGeneration;
    const expectedState = this.state;
    const expectedRevision = this.revision;
    this.timeout = setTimeout(() => {
      if (this.disposed || generation !== this.timerGeneration) return;
      void this.transition('timeout', undefined, {
        expectedState,
        expectedRevision,
        occurredAt: this.clock(),
      }).catch(error => {
        this.recordFailure('timeout', `STATE_TIMEOUT_FAILED: ${errorMessage(error)}`, canonicalTime(this.clock(), 'clock'), 'timeout');
      });
    }, state.timeout * 1000);
    (this.timeout as unknown as { unref?: () => void }).unref?.();
  }

  private clearTimeout(): void {
    if (!this.timeout) return;
    globalThis.clearTimeout(this.timeout);
    this.timeout = null;
  }

  private assertActive(): void {
    if (this.disposed) throw new Error(`AuthorityStateMachine ${String(this.id)} is disposed`);
  }
}

function assertDefinition(definition: StateMachineDefinition): void {
  if (!definition.name.trim()) throw new Error('Authority state-machine name must not be empty');
  if (definition.states.length === 0) throw new Error('Authority state-machine requires at least one state');
  if (!definition.initial.trim()) throw new Error('Authority state-machine requires an initial state');

  const stateIds = new Set<StateId>();
  for (const state of definition.states) {
    if (!state.id.trim()) throw new Error('Authority state id must not be empty');
    if (!state.label.trim()) throw new Error(`Authority state ${state.id} label must not be empty`);
    if (stateIds.has(state.id)) throw new Error(`Duplicate authority state id: ${state.id}`);
    stateIds.add(state.id);
    if (state.timeout !== undefined && (!Number.isFinite(state.timeout) || state.timeout <= 0)) {
      throw new Error(`Authority state ${state.id} timeout must be > 0 seconds`);
    }
  }
  if (!stateIds.has(definition.initial)) throw new Error(`Authority initial state does not exist: ${definition.initial}`);

  const transitionIds = new Set<string>();
  const dispatchKeys = new Set<string>();
  for (const transition of definition.transitions) {
    if (!stateIds.has(transition.from)) throw new Error(`Dangling authority transition from: ${transition.from}`);
    if (!stateIds.has(transition.to)) throw new Error(`Dangling authority transition to: ${transition.to}`);
    if (!transition.event.trim()) throw new Error('Authority transition event must not be empty');
    if (transition.id) {
      if (transitionIds.has(transition.id)) throw new Error(`Duplicate authority transition id: ${transition.id}`);
      transitionIds.add(transition.id);
    }
    const dispatchKey = `${transition.from}\u0000${transition.event}`;
    if (dispatchKeys.has(dispatchKey)) {
      throw new Error(`Ambiguous authority transition from=${transition.from} event=${transition.event}`);
    }
    dispatchKeys.add(dispatchKey);
  }
}

function validateContext(context: StateContext, definition: StateMachineDefinition, revision: number): void {
  if (context.machineId !== definition.id) throw new Error('State context machineId does not match definition');
  if (!definition.states.some(state => state.id === context.currentState)) {
    throw new Error(`State context references unknown state: ${context.currentState}`);
  }
  if (context.previousState !== null && !definition.states.some(state => state.id === context.previousState)) {
    throw new Error(`State context references unknown previous state: ${context.previousState}`);
  }
  if (!Number.isSafeInteger(context.transitions) || context.transitions < 0) {
    throw new Error('State context transitions must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(revision) || revision < context.transitions) {
    throw new Error(`State revision ${revision} cannot be lower than transition count ${context.transitions}`);
  }
  canonicalTime(context.startedAt, 'state startedAt');
  for (const item of context.history) {
    if (!definition.states.some(state => state.id === item.from)) throw new Error(`History references unknown from state: ${item.from}`);
    if (!definition.states.some(state => state.id === item.to)) throw new Error(`History references unknown to state: ${item.to}`);
    if (!item.event.trim()) throw new Error('History event must not be empty');
    canonicalTime(item.timestamp, 'history timestamp');
  }
  if (context.history.length !== context.transitions) {
    throw new Error(`History length ${context.history.length} differs from transition count ${context.transitions}`);
  }
  assertCanonicalJson(context.data, 'state context data');
  if (!Array.isArray(context.errors) || context.errors.some(error => typeof error !== 'string')) {
    throw new Error('State context errors must be an array of strings');
  }
}

function validateStagedTransition(
  previous: StateContext,
  staged: StateContext,
  transition: StateTransition,
  event: string,
  occurredAt: Timestamp,
): void {
  if (staged.machineId !== previous.machineId) throw new Error('Callback mutated protected machineId');
  if (staged.startedAt !== previous.startedAt) throw new Error('Callback mutated protected startedAt');
  if (staged.previousState !== previous.currentState) throw new Error('Callback mutated protected previousState');
  if (staged.currentState !== transition.to) throw new Error('Callback mutated protected currentState');
  if (staged.transitions !== previous.transitions + 1) throw new Error('Callback mutated protected transition counter');
  if (staged.history.length !== previous.history.length + 1) throw new Error('Callback mutated protected history length');
  const last = staged.history[staged.history.length - 1];
  if (!last
    || last.from !== previous.currentState
    || last.to !== transition.to
    || last.event !== event
    || last.timestamp !== occurredAt) {
    throw new Error('Callback mutated protected transition-history entry');
  }
}

function definitionHash(definition: StateMachineDefinition, revision: string): string {
  return stableHash128({
    id: String(definition.id),
    name: definition.name,
    initial: definition.initial,
    revision,
    states: definition.states
      .map(state => ({
        id: state.id,
        label: state.label,
        type: state.type || 'normal',
        timeout: state.timeout ?? null,
        hasEntry: Boolean(state.entry),
        hasExit: Boolean(state.exit),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    transitions: definition.transitions
      .map(transition => ({
        id: transition.id || null,
        from: transition.from,
        to: transition.to,
        event: transition.event,
        label: transition.label || null,
        hasGuard: Boolean(transition.guard),
        hasAction: Boolean(transition.action),
      }))
      .sort((a, b) =>
        a.from.localeCompare(b.from)
        || a.event.localeCompare(b.event)
        || a.to.localeCompare(b.to)
        || String(a.id).localeCompare(String(b.id)),
      ),
  });
}

function assertExpectedState(expected: StateId | undefined, current: StateId): void {
  if (expected !== undefined && expected !== current) {
    throw new Error(`STALE_STATE expected=${expected} current=${current}`);
  }
}

function assertExpectedRevision(expected: number | undefined, current: number): void {
  if (expected === undefined) return;
  if (!Number.isSafeInteger(expected) || expected < 0) {
    throw new Error('expectedRevision must be a non-negative safe integer');
  }
  if (expected !== current) {
    throw new Error(`STALE_STATE_REVISION expected=${expected} current=${current}`);
  }
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
    seen.delete(value);
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

function cloneState(state: StateConfig): StateConfig { return { ...state }; }
function cloneTransition(transition: StateTransition): StateTransition { return { ...transition }; }
function cloneContext(context: StateContext): StateContext {
  return {
    ...context,
    history: context.history.map(item => ({ ...item })),
    data: structuredClone(context.data),
    errors: [...context.errors],
  };
}
function canonicalTime(value: Timestamp, label: string): Timestamp {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function escapeMermaid(value: string): string { return value.replace(/"/g, '\\"').replace(/\n/g, ' '); }
