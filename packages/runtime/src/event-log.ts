import { stableHash128, type CogEvent, type EntityId, type Timestamp } from '@cos/core';

export interface DurableEvent extends CogEvent {
  sequence: number;
  idempotencyKey: string;
  correlationId: string;
  causationId?: EntityId;
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
  appended: boolean;
}

export interface EventLogCursor { sequence: number; }

export interface IEventLog {
  append(event: AppendEventInput): Promise<AppendResult>;
  get(eventId: EntityId): Promise<DurableEvent | null>;
  getByIdempotencyKey(key: string): Promise<DurableEvent | null>;
  readFrom(cursor?: EventLogCursor, limit?: number): Promise<DurableEvent[]>;
  latestCursor(): Promise<EventLogCursor>;
  clear(): Promise<void>;
}

/**
 * Reference adapter implementing the same semantic guarantees expected from a
 * durable adapter: append-only order, payload-bound idempotency and copy-safe
 * reads. Bounded diagnostic history belongs in EventBus, never here.
 */
export class InMemoryEventLog implements IEventLog {
  private events: DurableEvent[] = [];
  private byId = new Map<EntityId, DurableEvent>();
  private byIdempotencyKey = new Map<string, DurableEvent>();
  private semanticHashByKey = new Map<string, string>();
  private nextSequence = 1;

  async append(input: AppendEventInput): Promise<AppendResult> {
    const key = input.idempotencyKey.trim();
    if (!key) throw new Error('Event idempotencyKey must not be empty');
    const correlationId = input.correlationId?.trim() || input.traceId;
    if (!correlationId) throw new Error('Event correlationId must not be empty');

    const semanticHash = eventSemanticHash({ ...input, idempotencyKey: key, correlationId });
    const duplicate = this.byIdempotencyKey.get(key);
    if (duplicate) {
      const acceptedHash = this.semanticHashByKey.get(key);
      if (acceptedHash !== semanticHash) {
        throw new Error(`IDEMPOTENCY_CONFLICT key=${key} expectedPayload=${acceptedHash} actualPayload=${semanticHash}`);
      }
      return { event: cloneEvent(duplicate), appended: false };
    }

    if (this.byId.has(input.id)) {
      throw new Error(`Event ID collision: ${String(input.id)} already exists with a different idempotency key`);
    }

    const event: DurableEvent = {
      ...cloneCogEvent(input),
      idempotencyKey: key,
      correlationId,
      causationId: input.causationId,
      recordedAt: canonicalTime(input.recordedAt || new Date().toISOString(), 'recordedAt'),
      timestamp: canonicalTime(input.timestamp, 'timestamp'),
      sequence: this.nextSequence++,
    };

    this.events.push(event);
    this.byId.set(event.id, event);
    this.byIdempotencyKey.set(key, event);
    this.semanticHashByKey.set(key, semanticHash);
    return { event: cloneEvent(event), appended: true };
  }

  async get(eventId: EntityId): Promise<DurableEvent | null> {
    const event = this.byId.get(eventId);
    return event ? cloneEvent(event) : null;
  }

  async getByIdempotencyKey(key: string): Promise<DurableEvent | null> {
    const event = this.byIdempotencyKey.get(key.trim());
    return event ? cloneEvent(event) : null;
  }

  async readFrom(cursor: EventLogCursor = { sequence: 0 }, limit = 1000): Promise<DurableEvent[]> {
    if (!Number.isSafeInteger(cursor.sequence) || cursor.sequence < 0) {
      throw new Error(`Invalid event-log cursor: ${cursor.sequence}`);
    }
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 1_000_000) {
      throw new Error(`Invalid event-log limit: ${limit}`);
    }
    return this.events
      .filter(event => event.sequence > cursor.sequence)
      .slice(0, limit)
      .map(cloneEvent);
  }

  async latestCursor(): Promise<EventLogCursor> {
    return { sequence: this.events.length === 0 ? 0 : this.events[this.events.length - 1].sequence };
  }

  async clear(): Promise<void> {
    this.events = [];
    this.byId.clear();
    this.byIdempotencyKey.clear();
    this.semanticHashByKey.clear();
    this.nextSequence = 1;
  }
}

function eventSemanticHash(input: AppendEventInput): string {
  return stableHash128({
    type: input.type,
    source: String(input.source),
    target: input.target ? String(input.target) : null,
    payload: input.payload,
    metadata: input.metadata,
    severity: input.severity,
    correlationId: input.correlationId || input.traceId,
    causationId: input.causationId ? String(input.causationId) : null,
  });
}

function cloneCogEvent(input: CogEvent): CogEvent {
  return {
    ...input,
    payload: structuredClone(input.payload),
    metadata: structuredClone(input.metadata),
  };
}

function cloneEvent(event: DurableEvent): DurableEvent {
  return {
    ...event,
    payload: structuredClone(event.payload),
    metadata: structuredClone(event.metadata),
  };
}

function canonicalTime(value: string, name: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid event ${name}: ${value}`);
  return new Date(parsed).toISOString();
}
