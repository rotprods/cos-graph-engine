import type { CogEvent, EntityId, Timestamp } from '@cos/core';

export interface DurableEvent extends CogEvent {
  /** Strictly increasing position in one event-log partition. */
  sequence: number;
  /** Duplicate-safe producer key. Equal keys resolve to the same accepted event. */
  idempotencyKey: string;
  /** Groups all events belonging to one logical operation/trace. */
  correlationId: string;
  /** Event that directly caused this event, when applicable. */
  causationId?: EntityId;
  /** System time at which the log accepted the event. */
  recordedAt: Timestamp;
}

export interface AppendEventInput extends CogEvent {
  idempotencyKey: string;
  correlationId: string;
  causationId?: EntityId;
  recordedAt?: Timestamp;
}

export interface AppendResult {
  event: DurableEvent;
  /** false means an idempotent duplicate resolved to an existing event. */
  appended: boolean;
}

export interface EventLogCursor {
  sequence: number;
}

export interface IEventLog {
  append(event: AppendEventInput): Promise<AppendResult>;
  get(eventId: EntityId): Promise<DurableEvent | null>;
  getByIdempotencyKey(key: string): Promise<DurableEvent | null>;
  readFrom(cursor?: EventLogCursor, limit?: number): Promise<DurableEvent[]>;
  latestCursor(): Promise<EventLogCursor>;
  clear(): Promise<void>;
}

/**
 * Reference adapter with durable-log semantics inside one process.
 *
 * It intentionally has no retention truncation: bounded UI/debug history belongs
 * to EventBus, while an event log must preserve all accepted events. Postgres,
 * SQLite or another durable adapter can implement the same interface later.
 */
export class InMemoryEventLog implements IEventLog {
  private events: DurableEvent[] = [];
  private byId = new Map<EntityId, DurableEvent>();
  private byIdempotencyKey = new Map<string, DurableEvent>();
  private nextSequence = 1;

  async append(input: AppendEventInput): Promise<AppendResult> {
    const key = input.idempotencyKey.trim();
    if (!key) throw new Error('Event idempotencyKey must not be empty');

    const duplicate = this.byIdempotencyKey.get(key);
    if (duplicate) return { event: duplicate, appended: false };

    if (this.byId.has(input.id)) {
      throw new Error(`Event ID collision: ${String(input.id)} already exists with a different idempotency key`);
    }

    const event: DurableEvent = {
      ...input,
      idempotencyKey: key,
      correlationId: input.correlationId || input.traceId,
      recordedAt: input.recordedAt || new Date().toISOString(),
      sequence: this.nextSequence++,
    };

    this.events.push(event);
    this.byId.set(event.id, event);
    this.byIdempotencyKey.set(key, event);
    return { event, appended: true };
  }

  async get(eventId: EntityId): Promise<DurableEvent | null> {
    return this.byId.get(eventId) || null;
  }

  async getByIdempotencyKey(key: string): Promise<DurableEvent | null> {
    return this.byIdempotencyKey.get(key) || null;
  }

  async readFrom(cursor: EventLogCursor = { sequence: 0 }, limit = 1000): Promise<DurableEvent[]> {
    if (!Number.isInteger(cursor.sequence) || cursor.sequence < 0) {
      throw new Error(`Invalid event-log cursor: ${cursor.sequence}`);
    }
    if (!Number.isInteger(limit) || limit < 0) throw new Error(`Invalid event-log limit: ${limit}`);
    return this.events.filter(event => event.sequence > cursor.sequence).slice(0, limit);
  }

  async latestCursor(): Promise<EventLogCursor> {
    return { sequence: this.events.length === 0 ? 0 : this.events[this.events.length - 1].sequence };
  }

  async clear(): Promise<void> {
    this.events = [];
    this.byId.clear();
    this.byIdempotencyKey.clear();
    this.nextSequence = 1;
  }
}
