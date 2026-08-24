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
}

/**
 * Serializes asynchronous state transitions and adds expected-state/revision
 * fencing without changing the legacy StateMachine implementation.
 *
 * It is the authority path for multi-writer state projection. The wrapped
 * machine still owns guards/actions/entry/exit semantics; this wrapper ensures
 * only one transition evaluates/commits at a time.
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
    // The queue must continue after a rejected transition; callers still receive
    // the original rejection through `operation`.
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
        this.recordFailure(normalizedEvent, options, failure);
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
      const message = error instanceof Error ? error.message : String(error);
      this.recordFailure(normalizedEvent, options, message);
      throw error;
    }
  }

  private recordFailure(event: string, options: StateDispatchOptions, error: string): void {
    this.failures.push({
      event,
      expectedState: options.expectedState,
      expectedRevision: options.expectedRevision,
      actualState: this.state,
      actualRevision: this.revision,
      occurredAt: new Date().toISOString(),
      error,
    });
    if (this.failures.length > this.maxFailures) {
      this.failures = this.failures.slice(-this.maxFailures);
    }
  }
}
