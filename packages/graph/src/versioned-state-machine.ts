import { stableHash128 } from '@cos/core';
import {
  StateMachine,
  type StateConfig,
  type StateContext,
  type StateId,
  type StateTransition,
} from './level2-state';

export interface StateDispatchOptions {
  expectedState?: StateId;
  expectedRevision?: number;
}

export interface StateDispatchReceipt {
  event: string;
  previousState: StateId;
  state: StateId;
  previousRevision: number;
  revision: number;
  applied: boolean;
  stateHash: string;
}

export interface StateDispatchFailure {
  event: string;
  expectedState?: StateId;
  expectedRevision?: number;
  actualState: StateId;
  actualRevision: number;
  occurredAt: string;
  error: string;
  /** True when the legacy machine mutated state before an async callback failed. */
  partialCommit: boolean;
}

export class PartialStateTransitionError extends Error {
  constructor(
    readonly event: string,
    readonly previousState: StateId,
    readonly actualState: StateId,
    readonly revision: number,
    readonly originalError: unknown,
  ) {
    super(
      `PARTIAL_TRANSITION_COMMIT event=${event} previous=${previousState} actual=${actualState} revision=${revision}: ${
        originalError instanceof Error ? originalError.message : String(originalError)
      }`,
    );
    this.name = 'PartialStateTransitionError';
  }
}

/**
 * Serializes asynchronous state transitions and adds expected-state/revision
 * fencing without changing the legacy StateMachine implementation.
 *
 * A legacy transition callback can fail after the machine has already changed
 * state. That condition cannot be rolled back generically because callback side
 * effects are opaque. Instead, this wrapper detects the partial commit, advances
 * the revision fence and throws an explicit PartialStateTransitionError. A stale
 * writer can therefore never commit against the pre-failure revision.
 */
export class VersionedStateMachine {
  private readonly machine: StateMachine;
  private revision = 0;
  private dispatchTail: Promise<void> = Promise.resolve();
  private failures: StateDispatchFailure[] = [];
  private readonly maxFailures: number;

  constructor(
    name: string,
    states: StateConfig[] = [],
    transitions: StateTransition[] = [],
    initial?: StateId,
    options: { initialRevision?: number; maxFailures?: number } = {},
  ) {
    const initialRevision = options.initialRevision ?? 0;
    if (!Number.isSafeInteger(initialRevision) || initialRevision < 0) {
      throw new Error('initialRevision must be a non-negative safe integer');
    }
    this.machine = new StateMachine(name, states, transitions, initial);
    this.revision = initialRevision;
    this.maxFailures = Math.max(1, options.maxFailures ?? 1000);
  }

  get id() { return this.machine.id; }
  get state(): StateId { return this.machine.state; }
  get currentRevision(): number { return this.revision; }
  get contextData(): StateContext { return structuredClone(this.machine.contextData); }
  get states(): StateConfig[] { return this.machine.states.map(state => ({ ...state })); }
  get transitions(): StateTransition[] { return this.machine.transitions.map(transition => ({ ...transition })); }

  send(
    event: string,
    payload?: Record<string, unknown>,
    options: StateDispatchOptions = {},
  ): Promise<StateDispatchReceipt> {
    const operation = this.dispatchTail.then(() => this.dispatch(event, payload, options));
    this.dispatchTail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  can(event: string): boolean { return this.machine.can(event); }
  getAvailableEvents(): string[] { return [...this.machine.getAvailableEvents()]; }
  isInFinalState(): boolean { return this.machine.isInFinalState(); }
  validate(): string[] { return this.machine.validate(); }
  visualize(): string { return this.machine.visualize(); }
  toMermaid(): string { return this.machine.toMermaid(); }

  onChange(listener: (from: StateId, to: StateId, event: string) => void): void {
    this.machine.onChange(listener);
  }

  getFailureLog(limit = 100): StateDispatchFailure[] {
    return this.failures.slice(-Math.max(0, limit)).map(failure => ({ ...failure }));
  }

  snapshot(): {
    state: StateId;
    revision: number;
    context: StateContext;
    stateHash: string;
  } {
    const context = this.contextData;
    return {
      state: this.state,
      revision: this.revision,
      context,
      stateHash: stableHash128({ state: this.state, revision: this.revision, context }),
    };
  }

  private async dispatch(
    event: string,
    payload: Record<string, unknown> | undefined,
    options: StateDispatchOptions,
  ): Promise<StateDispatchReceipt> {
    const normalizedEvent = event.trim();
    if (!normalizedEvent) throw new Error('State event must not be empty');
    if (options.expectedRevision !== undefined
      && (!Number.isSafeInteger(options.expectedRevision) || options.expectedRevision < 0)) {
      throw new Error('expectedRevision must be a non-negative safe integer');
    }

    const previousState = this.state;
    const previousRevision = this.revision;
    const previousContext = this.contextData;
    try {
      if (options.expectedState !== undefined && options.expectedState !== previousState) {
        throw new Error(`STALE_STATE expected=${options.expectedState} current=${previousState}`);
      }
      if (options.expectedRevision !== undefined && options.expectedRevision !== previousRevision) {
        throw new Error(`STALE_STATE_REVISION expected=${options.expectedRevision} current=${previousRevision}`);
      }

      const applied = await this.machine.send(normalizedEvent, payload);
      if (!applied) {
        const failure = `TRANSITION_REJECTED event=${normalizedEvent} state=${previousState}`;
        this.recordFailure(normalizedEvent, options, failure, false);
        return {
          event: normalizedEvent,
          previousState,
          state: this.state,
          previousRevision,
          revision: this.revision,
          applied: false,
          stateHash: this.snapshot().stateHash,
        };
      }

      this.revision += 1;
      return {
        event: normalizedEvent,
        previousState,
        state: this.state,
        previousRevision,
        revision: this.revision,
        applied: true,
        stateHash: this.snapshot().stateHash,
      };
    } catch (error) {
      const currentContext = this.contextData;
      const partialCommit = this.state !== previousState
        || currentContext.transitions !== previousContext.transitions
        || currentContext.history.length !== previousContext.history.length;

      if (partialCommit) {
        this.revision += 1;
        const partialError = new PartialStateTransitionError(
          normalizedEvent,
          previousState,
          this.state,
          this.revision,
          error,
        );
        this.recordFailure(normalizedEvent, options, partialError.message, true);
        throw partialError;
      }

      const message = error instanceof Error ? error.message : String(error);
      this.recordFailure(normalizedEvent, options, message, false);
      throw error;
    }
  }

  private recordFailure(
    event: string,
    options: StateDispatchOptions,
    error: string,
    partialCommit: boolean,
  ): void {
    this.failures.push({
      event,
      expectedState: options.expectedState,
      expectedRevision: options.expectedRevision,
      actualState: this.state,
      actualRevision: this.revision,
      occurredAt: new Date().toISOString(),
      error,
      partialCommit,
    });
    if (this.failures.length > this.maxFailures) {
      this.failures = this.failures.slice(-this.maxFailures);
    }
  }
}
