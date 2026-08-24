import type { EntityId } from '@cos/core';
import type {
  AppendEventInput,
  AppendResult,
  DurableEvent,
  EventLogCursor,
  IEventLog,
} from './event-log';

export interface EventLogPersistentState {
  events: DurableEvent[];
  nextSequence: number;
}

/**
 * Minimal transactional persistence port.
 *
 * Implementations may be Postgres, SQLite, IndexedDB, durable object storage,
 * or another backend, but the callback MUST execute atomically with respect to
 * competing writers. This keeps durability technology outside the event
 * semantics while making the transaction boundary explicit and testable.
 */
export interface ITransactionalStateStore<T> {
  read(): Promise<T | null>;
  transact<R>(fn: (current: T | null) => { state: T; result: R }): Promise<R>;
  clear(): Promise<void>;
}

/**
 * Reference transactional store. It serializes async callers through a promise
 * chain so the semantics match a single-row/transactional persistent adapter.
 */
export class InMemoryTransactionalStateStore<T> implements ITransactionalStateStore<T> {
  private state: T | null = null;
  private queue: Promise<void> = Promise.resolve();

  async read(): Promise<T | null> {
    await this.queue;
    return this.clone(this.state);
  }

  async transact<R>(fn: (current: T | null) => { state: T; result: R }): Promise<R> {
    let resolveResult!: (value: R) => void;
    let rejectResult!: (reason?: unknown) => void;
    const resultPromise = new Promise<R>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    this.queue = this.queue.then(() => {
      try {
        const outcome = fn(this.clone(this.state));
        this.state = this.clone(outcome.state);
        resolveResult(outcome.result);
      } catch (error) {
        rejectResult(error);
      }
    });

    await this.queue.catch(() => undefined);
    return resultPromise;
  }

  async clear(): Promise<void> {
    await this.transact(() => ({ state: null as unknown as T, result: undefined }));
    this.state = null;
  }

  private clone(value: T | null): T | null {
    if (value === null) return null;
    return structuredClone(value);
  }
}

/**
 * Durable event-log semantics over any atomic state adapter.
 *
 * Guarantees:
 * - idempotency lookup and append occur in one transaction
 * - event ID collision and idempotency-key conflict fail closed
 * - sequence assignment is monotonic and atomic
 * - equal idempotency keys only deduplicate equal logical events
 * - read APIs return copies so callers cannot mutate canonical history
 */
export class TransactionalEventLog implements IEventLog {
  constructor(private readonly store: ITransactionalStateStore<EventLogPersistentState>) {}

  async append(input: AppendEventInput): Promise<AppendResult> {
    const key = input.idempotencyKey.trim();
    if (!key) throw new Error('Event idempotencyKey must not be empty');

    return this.store.transact(current => {
      const state = this.normalize(current);
      const duplicate = state.events.find(event => event.idempotencyKey === key);
      if (duplicate) {
        this.assertSameLogicalEvent(duplicate, input);
        return { state, result: { event: structuredClone(duplicate), appended: false } };
      }

      const collidingId = state.events.find(event => event.id === input.id);
      if (collidingId) {
        throw new Error(`EVENT_ID_COLLISION id=${String(input.id)}`);
      }

      const event: DurableEvent = {
        ...structuredClone(input),
        idempotencyKey: key,
        correlationId: input.correlationId || input.traceId,
        recordedAt: input.recordedAt || new Date().toISOString(),
        sequence: state.nextSequence,
      };

      const nextState: EventLogPersistentState = {
        events: [...state.events, event],
        nextSequence: state.nextSequence + 1,
      };
      return {
        state: nextState,
        result: { event: structuredClone(event), appended: true },
      };
    });
  }

  async get(eventId: EntityId): Promise<DurableEvent | null> {
    const state = this.normalize(await this.store.read());
    const event = state.events.find(candidate => candidate.id === eventId);
    return event ? structuredClone(event) : null;
  }

  async getByIdempotencyKey(key: string): Promise<DurableEvent | null> {
    const state = this.normalize(await this.store.read());
    const event = state.events.find(candidate => candidate.idempotencyKey === key);
    return event ? structuredClone(event) : null;
  }

  async readFrom(cursor: EventLogCursor = { sequence: 0 }, limit = 1000): Promise<DurableEvent[]> {
    if (!Number.isInteger(cursor.sequence) || cursor.sequence < 0) throw new Error(`Invalid event-log cursor: ${cursor.sequence}`);
    if (!Number.isInteger(limit) || limit < 0 || limit > 100_000) throw new Error(`Invalid event-log limit: ${limit}`);
    const state = this.normalize(await this.store.read());
    return state.events
      .filter(event => event.sequence > cursor.sequence)
      .slice(0, limit)
      .map(event => structuredClone(event));
  }

  async latestCursor(): Promise<EventLogCursor> {
    const state = this.normalize(await this.store.read());
    return { sequence: state.events.length ? state.events[state.events.length - 1].sequence : 0 };
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }

  private normalize(state: EventLogPersistentState | null): EventLogPersistentState {
    if (!state) return { events: [], nextSequence: 1 };
    if (!Number.isInteger(state.nextSequence) || state.nextSequence < 1) throw new Error('EVENT_LOG_CORRUPT nextSequence');
    let previous = 0;
    const ids = new Set<string>();
    const keys = new Set<string>();
    for (const event of state.events) {
      if (!Number.isInteger(event.sequence) || event.sequence <= previous) throw new Error('EVENT_LOG_CORRUPT sequence ordering');
      if (ids.has(String(event.id))) throw new Error(`EVENT_LOG_CORRUPT duplicate id=${String(event.id)}`);
      if (keys.has(event.idempotencyKey)) throw new Error(`EVENT_LOG_CORRUPT duplicate idempotencyKey=${event.idempotencyKey}`);
      previous = event.sequence;
      ids.add(String(event.id));
      keys.add(event.idempotencyKey);
    }
    if (state.nextSequence <= previous) throw new Error('EVENT_LOG_CORRUPT nextSequence is not ahead of tail');
    return structuredClone(state);
  }

  private assertSameLogicalEvent(existing: DurableEvent, input: AppendEventInput): void {
    const equal =
      existing.id === input.id
      && existing.type === input.type
      && existing.source === input.source
      && existing.target === input.target
      && existing.correlationId === (input.correlationId || input.traceId)
      && JSON.stringify(existing.payload) === JSON.stringify(input.payload);
    if (!equal) {
      throw new Error(`IDEMPOTENCY_KEY_CONFLICT key=${input.idempotencyKey}`);
    }
  }
}
