// ================================================================
// LEVEL 2: STATE GRAPH — Transaction-safe finite state machines
// ================================================================

import { EntityId, Timestamp } from '@cos/core';
import { generateId } from '@cos/core';

export type StateId = string;

export interface StateTransition {
  id?: string;
  from: StateId;
  to: StateId;
  event: string;
  guard?: (context: StateContext) => boolean;
  action?: (context: StateContext) => Promise<void> | void;
  label?: string;
}

export interface StateConfig {
  id: StateId;
  label: string;
  entry?: (context: StateContext) => Promise<void> | void;
  exit?: (context: StateContext) => Promise<void> | void;
  type?: 'initial' | 'normal' | 'final' | 'error';
  timeout?: number;
}

export interface StateContext {
  machineId: EntityId;
  currentState: StateId;
  previousState: StateId | null;
  history: Array<{ from: StateId; to: StateId; event: string; timestamp: Timestamp }>;
  data: Record<string, unknown>;
  errors: string[];
  startedAt: Timestamp;
  transitions: number;
}

export interface StateMachineDefinition {
  id: EntityId;
  name: string;
  states: StateConfig[];
  transitions: StateTransition[];
  initial: StateId;
}

export interface TransitionResult {
  applied: boolean;
  from: StateId;
  to: StateId;
  event: string;
  error?: string;
}

/**
 * Serialized, internally transactional state machine.
 *
 * `send()` and explicit context-data mutations are queued per machine.
 * Exit/action/entry callbacks execute inside one transition boundary; if one
 * throws, the machine restores its prior internal state/history/counters.
 * External side effects inside callbacks cannot be rolled back and must use
 * idempotency/compensation separately.
 */
export class StateMachine {
  private definition: StateMachineDefinition;
  private context: StateContext;
  private listeners: Array<(from: StateId, to: StateId, event: string) => void> = [];
  private timeouts: Map<StateId, ReturnType<typeof setTimeout>> = new Map();
  private adj: Map<StateId, StateTransition[]> = new Map();
  private transitionTail: Promise<void> = Promise.resolve();
  private timerGeneration = 0;
  private disposed = false;

  constructor(
    name: string,
    states: StateConfig[] = [],
    transitions: StateTransition[] = [],
    initial?: StateId,
  ) {
    const id = generateId();
    this.definition = {
      id,
      name: name.trim(),
      states: states.map(cloneState),
      transitions: transitions.map(cloneTransition),
      initial: initial || states.find(state => state.type === 'initial')?.id || states[0]?.id || '',
    };
    this.assertDefinition(this.definition);
    this.context = {
      machineId: id,
      currentState: this.definition.initial,
      previousState: null,
      history: [],
      data: {},
      errors: [],
      startedAt: new Date().toISOString(),
      transitions: 0,
    };
    this.buildAdjacency();
    this.scheduleTimeoutForCurrentState();
  }

  private buildAdjacency(): void {
    this.adj.clear();
    for (const state of this.definition.states) this.adj.set(state.id, []);
    for (const transition of this.definition.transitions) {
      this.adj.get(transition.from)?.push(transition);
    }
    for (const bucket of this.adj.values()) {
      bucket.sort((a, b) =>
        a.event.localeCompare(b.event)
        || String(a.id || '').localeCompare(String(b.id || '')),
      );
    }
  }

  addState(config: StateConfig): StateId {
    this.assertMutable();
    const state = cloneState(config);
    if (!state.id.trim()) throw new Error('State id must not be empty');
    if (this.definition.states.some(existing => existing.id === state.id)) {
      throw new Error(`State ${state.id} already exists`);
    }
    if (state.timeout !== undefined && (!Number.isFinite(state.timeout) || state.timeout <= 0)) {
      throw new Error(`State ${state.id} timeout must be > 0 seconds`);
    }
    this.definition.states.push(state);
    this.buildAdjacency();
    return state.id;
  }

  removeState(stateId: StateId): void {
    this.assertMutable();
    if (stateId === this.context.currentState) throw new Error(`Cannot remove current state ${stateId}`);
    if (stateId === this.definition.initial) throw new Error(`Cannot remove initial state ${stateId}`);
    const index = this.definition.states.findIndex(state => state.id === stateId);
    if (index === -1) throw new Error(`State ${stateId} not found`);
    this.clearStateTimeout(stateId);
    this.definition.states.splice(index, 1);
    this.definition.transitions = this.definition.transitions.filter(
      transition => transition.from !== stateId && transition.to !== stateId,
    );
    this.buildAdjacency();
  }

  addTransition(transition: StateTransition): string {
    this.assertMutable();
    if (!this.definition.states.some(state => state.id === transition.from)) {
      throw new Error(`From state ${transition.from} not found`);
    }
    if (!this.definition.states.some(state => state.id === transition.to)) {
      throw new Error(`To state ${transition.to} not found`);
    }
    if (!transition.event.trim()) throw new Error('Transition event must not be empty');
    const id = transition.id || generateId();
    if (this.definition.transitions.some(existing => existing.id === id)) {
      throw new Error(`Transition ${id} already exists`);
    }
    if (this.definition.transitions.some(existing =>
      existing.from === transition.from
      && existing.event === transition.event,
    )) {
      throw new Error(`Ambiguous transition from=${transition.from} event=${transition.event}`);
    }
    this.definition.transitions.push(cloneTransition({ ...transition, id }));
    this.buildAdjacency();
    return id;
  }

  removeTransition(transitionId: string): void {
    this.assertMutable();
    const index = this.definition.transitions.findIndex(transition => transition.id === transitionId);
    if (index === -1) throw new Error(`Transition ${transitionId} not found`);
    this.definition.transitions.splice(index, 1);
    this.buildAdjacency();
  }

  get id(): EntityId { return this.definition.id; }
  get state(): StateId { return this.context.currentState; }
  get contextData(): StateContext { return cloneContext(this.context); }
  get states(): StateConfig[] { return this.definition.states.map(cloneState); }
  get transitions(): StateTransition[] { return this.definition.transitions.map(cloneTransition); }

  /**
   * Explicit, serialized context-data mutation. This replaces the old pattern
   * of mutating `contextData.data` through a leaked canonical reference.
   */
  patchData(patch: Record<string, unknown>): Promise<void> {
    this.assertMutable();
    const clonedPatch = structuredClone(patch);
    const operation = this.transitionTail.then(() => {
      this.assertMutable();
      this.context.data = { ...this.context.data, ...clonedPatch };
    });
    this.transitionTail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  /** Replace all context data under the same serialized mutation boundary. */
  replaceData(data: Record<string, unknown>): Promise<void> {
    this.assertMutable();
    const clonedData = structuredClone(data);
    const operation = this.transitionTail.then(() => {
      this.assertMutable();
      this.context.data = clonedData;
    });
    this.transitionTail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async send(event: string, payload?: Record<string, unknown>): Promise<boolean> {
    const result = await this.transition(event, payload);
    return result.applied;
  }

  transition(event: string, payload?: Record<string, unknown>): Promise<TransitionResult> {
    const normalizedEvent = event.trim();
    if (!normalizedEvent) return Promise.reject(new Error('State event must not be empty'));
    if (this.disposed) return Promise.reject(new Error(`StateMachine ${String(this.id)} is disposed`));

    let resolveResult!: (value: TransitionResult) => void;
    let rejectResult!: (reason: unknown) => void;
    const result = new Promise<TransitionResult>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    const operation = this.transitionTail.then(async () => {
      try {
        resolveResult(await this.transitionLocked(normalizedEvent, payload));
      } catch (error) {
        rejectResult(error);
      }
    });
    this.transitionTail = operation.then(() => undefined, () => undefined);
    return result;
  }

  private async transitionLocked(
    event: string,
    payload?: Record<string, unknown>,
  ): Promise<TransitionResult> {
    const from = this.context.currentState;
    const transition = (this.adj.get(from) || []).find(candidate => candidate.event === event);
    if (!transition) {
      const error = `No transition for event "${event}" from state "${from}"`;
      this.context.errors.push(error);
      return { applied: false, from, to: from, event, error };
    }

    let guardAllowed = false;
    try {
      guardAllowed = transition.guard ? Boolean(transition.guard(cloneContext(this.context))) : true;
    } catch (error) {
      const message = `Guard failed for event "${event}" from "${from}": ${errorMessage(error)}`;
      this.context.errors.push(message);
      return { applied: false, from, to: from, event, error: message };
    }
    if (!guardAllowed) {
      const error = `Guard blocked transition "${event}" from "${from}"`;
      this.context.errors.push(error);
      return { applied: false, from, to: from, event, error };
    }

    const previousContext = cloneContext(this.context);
    const generationBefore = this.timerGeneration;
    this.timerGeneration += 1;
    this.clearStateTimeout(from);

    try {
      const currentStateConfig = this.definition.states.find(state => state.id === from);
      if (currentStateConfig?.exit) await currentStateConfig.exit(this.context);

      this.context.previousState = from;
      this.context.currentState = transition.to;
      this.context.history.push({
        from,
        to: transition.to,
        event,
        timestamp: new Date().toISOString(),
      });
      this.context.transitions += 1;
      if (payload) this.context.data = { ...this.context.data, ...structuredClone(payload) };

      if (transition.action) await transition.action(this.context);
      const nextStateConfig = this.definition.states.find(state => state.id === transition.to);
      if (nextStateConfig?.entry) await nextStateConfig.entry(this.context);

      this.scheduleTimeoutForCurrentState();
      for (const listener of [...this.listeners]) {
        try {
          listener(from, transition.to, event);
        } catch (error) {
          this.context.errors.push(
            `Transition listener failed ${from}->${transition.to} on "${event}": ${errorMessage(error)}`,
          );
        }
      }
      return { applied: true, from, to: transition.to, event };
    } catch (error) {
      this.clearAllTimeouts();
      this.context = previousContext;
      this.timerGeneration = generationBefore + 1;
      const message = `Transition "${event}" ${from}->${transition.to} rolled back: ${errorMessage(error)}`;
      this.context.errors.push(message);
      this.scheduleTimeoutForCurrentState();
      return { applied: false, from, to: from, event, error: message };
    }
  }

  can(event: string): boolean {
    return (this.adj.get(this.context.currentState) || []).some(transition => transition.event === event);
  }

  getAvailableEvents(): string[] {
    return (this.adj.get(this.context.currentState) || []).map(transition => transition.event);
  }

  isInFinalState(): boolean {
    return this.definition.states.find(state => state.id === this.context.currentState)?.type === 'final';
  }

  onChange(listener: (from: StateId, to: StateId, event: string) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  visualize(): string {
    let result = `╔════════════════════════════════════════════════╗\n`;
    result += `║  FSM: ${this.definition.name.padEnd(41)}║\n`;
    result += `╚════════════════════════════════════════════════╝\n\n`;
    result += `  Current State: ${this.context.currentState}\n`;
    result += `  Transitions: ${this.context.transitions}\n`;
    result += `  History: ${this.context.history.length} events\n`;
    result += `  Errors: ${this.context.errors.length}\n`;
    result += `  Available events: ${this.getAvailableEvents().join(', ') || 'none'}\n\n`;
    result += `  States:\n`;
    for (const state of this.definition.states) {
      const marker = state.id === this.context.currentState ? '→' : ' ';
      const typeIcon = state.type === 'initial' ? '●' : state.type === 'final' ? '◉' : '○';
      result += `  ${marker} ${typeIcon} ${state.label} (${state.id})\n`;
    }
    result += `\n  Transitions:\n`;
    for (const transition of this.definition.transitions) {
      result += `    ${transition.from} ──[${transition.event}]──→ ${transition.to}\n`;
    }
    return result;
  }

  validate(): string[] {
    const errors: string[] = [];
    try {
      this.assertDefinition(this.definition);
    } catch (error) {
      errors.push(errorMessage(error));
    }
    if (!this.definition.states.some(state => state.id === this.context.currentState)) {
      errors.push(`Current state does not exist: ${this.context.currentState}`);
    }
    return errors;
  }

  metrics() {
    const events = [...new Set(this.definition.transitions.map(transition => transition.event))];
    return {
      stateCount: this.definition.states.length,
      transitionCount: this.definition.transitions.length,
      uniqueEvents: events.length,
      finalStates: this.definition.states.filter(state => state.type === 'final').length,
      historyLength: this.context.history.length,
      totalTransitions: this.context.transitions,
      errorCount: this.context.errors.length,
    };
  }

  toJSON(): StateMachineDefinition {
    return {
      id: this.definition.id,
      name: this.definition.name,
      states: this.definition.states.map(cloneState),
      transitions: this.definition.transitions.map(cloneTransition),
      initial: this.definition.initial,
    };
  }

  static fromJSON(data: StateMachineDefinition): StateMachine {
    const machine = new StateMachine(data.name, data.states, data.transitions, data.initial);
    machine.definition = {
      id: data.id,
      name: data.name,
      states: data.states.map(cloneState),
      transitions: data.transitions.map(cloneTransition),
      initial: data.initial,
    };
    machine.context.machineId = data.id;
    machine.buildAdjacency();
    machine.clearAllTimeouts();
    machine.scheduleTimeoutForCurrentState();
    return machine;
  }

  toMermaid(): string {
    let mermaid = `stateDiagram-v2\n  title: "${this.definition.name}"\n`;
    for (const state of this.definition.states) {
      if (state.type === 'initial') mermaid += `  [*] --> ${state.id}\n`;
      if (state.type === 'final') mermaid += `  ${state.id} --> [*]\n`;
    }
    for (const transition of this.definition.transitions) {
      mermaid += `  ${transition.from} --> ${transition.to}: ${transition.event}\n`;
    }
    return mermaid;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.timerGeneration += 1;
    this.clearAllTimeouts();
    this.listeners = [];
  }

  private scheduleTimeoutForCurrentState(): void {
    const stateId = this.context.currentState;
    const state = this.definition.states.find(candidate => candidate.id === stateId);
    if (!state?.timeout || this.disposed) return;
    const generation = this.timerGeneration;
    const timeout = setTimeout(() => {
      if (this.disposed || generation !== this.timerGeneration || this.context.currentState !== stateId) return;
      void this.send('timeout').catch(error => {
        this.context.errors.push(`Timeout transition failed for ${stateId}: ${errorMessage(error)}`);
      });
    }, state.timeout * 1000);
    (timeout as unknown as { unref?: () => void }).unref?.();
    this.timeouts.set(stateId, timeout);
  }

  private clearStateTimeout(stateId: StateId): void {
    const timeout = this.timeouts.get(stateId);
    if (!timeout) return;
    clearTimeout(timeout);
    this.timeouts.delete(stateId);
  }

  private clearAllTimeouts(): void {
    for (const timeout of this.timeouts.values()) clearTimeout(timeout);
    this.timeouts.clear();
  }

  private assertDefinition(definition: StateMachineDefinition): void {
    if (!definition.name.trim()) throw new Error('State machine name must not be empty');
    if (definition.states.length === 0) throw new Error('No states defined');
    if (!definition.initial) throw new Error('No initial state defined');
    const ids = new Set<StateId>();
    for (const state of definition.states) {
      if (!state.id.trim()) throw new Error('State id must not be empty');
      if (ids.has(state.id)) throw new Error(`Duplicate state id: ${state.id}`);
      ids.add(state.id);
      if (state.timeout !== undefined && (!Number.isFinite(state.timeout) || state.timeout <= 0)) {
        throw new Error(`State ${state.id} timeout must be > 0 seconds`);
      }
    }
    if (!ids.has(definition.initial)) throw new Error(`Initial state does not exist: ${definition.initial}`);
    const transitionIds = new Set<string>();
    const dispatchKeys = new Set<string>();
    for (const transition of definition.transitions) {
      if (!ids.has(transition.from)) throw new Error(`Dangling transition from: ${transition.from}`);
      if (!ids.has(transition.to)) throw new Error(`Dangling transition to: ${transition.to}`);
      if (!transition.event.trim()) throw new Error('Transition event must not be empty');
      if (transition.id) {
        if (transitionIds.has(transition.id)) throw new Error(`Duplicate transition id: ${transition.id}`);
        transitionIds.add(transition.id);
      }
      const dispatchKey = `${transition.from}\u0000${transition.event}`;
      if (dispatchKeys.has(dispatchKey)) {
        throw new Error(`Ambiguous transition from=${transition.from} event=${transition.event}`);
      }
      dispatchKeys.add(dispatchKey);
    }
  }

  private assertMutable(): void {
    if (this.disposed) throw new Error(`StateMachine ${String(this.id)} is disposed`);
  }
}

export class StateMachineRegistry {
  private machines: Map<EntityId, StateMachine> = new Map();

  create(name: string, states: StateConfig[], transitions: StateTransition[], initial?: StateId): StateMachine {
    const machine = new StateMachine(name, states, transitions, initial);
    if (this.machines.has(machine.id)) throw new Error(`State machine ${String(machine.id)} already exists`);
    this.machines.set(machine.id, machine);
    return machine;
  }

  get(id: EntityId): StateMachine | undefined { return this.machines.get(id); }
  getAll(): StateMachine[] { return Array.from(this.machines.values()); }

  remove(id: EntityId): void {
    const machine = this.machines.get(id);
    machine?.dispose();
    this.machines.delete(id);
  }

  clear(): void {
    for (const machine of this.machines.values()) machine.dispose();
    this.machines.clear();
  }

  createCognitiveLifecycle(): StateMachine {
    return this.create('CognitiveCell Lifecycle', [
      { id: 'created', label: 'Created', type: 'initial' },
      { id: 'initializing', label: 'Initializing' },
      { id: 'ready', label: 'Ready' },
      { id: 'running', label: 'Running' },
      { id: 'paused', label: 'Paused' },
      { id: 'error', label: 'Error', type: 'error' },
      { id: 'terminated', label: 'Terminated', type: 'final' },
    ], [
      { from: 'created', to: 'initializing', event: 'init' },
      { from: 'initializing', to: 'ready', event: 'ready' },
      { from: 'initializing', to: 'error', event: 'fail' },
      { from: 'ready', to: 'running', event: 'start' },
      { from: 'running', to: 'paused', event: 'pause' },
      { from: 'paused', to: 'running', event: 'resume' },
      { from: 'running', to: 'error', event: 'fail' },
      { from: 'running', to: 'terminated', event: 'shutdown' },
      { from: 'paused', to: 'terminated', event: 'shutdown' },
      { from: 'error', to: 'terminated', event: 'shutdown' },
      { from: 'error', to: 'ready', event: 'recover' },
    ]);
  }

  createAutonomousGoalFSM(): StateMachine {
    return this.create('Autonomous Goal', [
      { id: 'created', label: 'Created', type: 'initial' },
      { id: 'planning', label: 'Planning' },
      { id: 'executing', label: 'Executing' },
      { id: 'observing', label: 'Observing' },
      { id: 'adapting', label: 'Adapting' },
      { id: 'completed', label: 'Completed', type: 'final' },
      { id: 'failed', label: 'Failed', type: 'error' },
    ], [
      { from: 'created', to: 'planning', event: 'start' },
      { from: 'planning', to: 'executing', event: 'plan_ready' },
      { from: 'planning', to: 'failed', event: 'plan_failed' },
      { from: 'executing', to: 'observing', event: 'step_complete' },
      { from: 'executing', to: 'failed', event: 'step_failed' },
      { from: 'observing', to: 'executing', event: 'continue' },
      { from: 'observing', to: 'adapting', event: 'needs_adapt' },
      { from: 'observing', to: 'completed', event: 'all_done' },
      { from: 'adapting', to: 'planning', event: 'replan' },
      { from: 'adapting', to: 'failed', event: 'cannot_adapt' },
    ]);
  }
}

function cloneState(state: StateConfig): StateConfig {
  return { ...state };
}

function cloneTransition(transition: StateTransition): StateTransition {
  return { ...transition };
}

function cloneContext(context: StateContext): StateContext {
  return {
    ...context,
    history: context.history.map(item => ({ ...item })),
    data: structuredClone(context.data),
    errors: [...context.errors],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}