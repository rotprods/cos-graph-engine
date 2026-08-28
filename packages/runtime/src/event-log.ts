import {
  canonicalHash128,
  canonicalSerialize,
  type CogEvent,
  type EntityId,
  type Metadata,
  type Timestamp,
} from '@cos/core';

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

export interface LogicalEventProjection {
  type: string;
  source: string;
  target: string | null;
  payload: unknown;
  metadata: Metadata;
  severity: CogEvent['severity'];
  occurredAt: string;
  correlationId: string;
  causationId: string | null;
}

/** Shared accepted-event normalization for every IEventLog adapter. */
export function normalizeAppendEventInput(input: AppendEventInput): AppendEventInput {
  const id = nonEmpty(String(input.id), 'Event id') as EntityId;
  const type = nonEmpty(input.type, 'Event type');
  const source = nonEmpty(String(input.source), 'Event source') as EntityId;
  const target = input.target === undefined ? undefined : nonEmpty(String(input.target), 'Event target') as EntityId;
  const idempotencyKey = nonEmpty(input.idempotencyKey, 'Event idempotencyKey');
  const correlationId = nonEmpty(input.correlationId, 'Event correlationId');
  const traceId = nonEmpty(input.traceId, 'Event traceId');
  const spanId = nonEmpty(input.spanId, 'Event spanId');
  const parentSpanId = input.parentSpanId === undefined ? undefined : nonEmpty(input.parentSpanId, 'Event parentSpanId');
  const causationId = input.causationId === undefined ? undefined : nonEmpty(String(input.causationId), 'Event causationId') as EntityId;
  const timestamp = canonicalTime(input.timestamp, 'Event timestamp');
  const recordedAt = input.recordedAt === undefined ? undefined : canonicalTime(input.recordedAt, 'Event recordedAt');
  const payload = canonicalClone(input.payload, 'Event payload');
  const metadata = canonicalClone(input.metadata ?? {}, 'Event metadata') as Metadata;

  const normalized: AppendEventInput = {
    id,
    type,
    source,
    ...(target === undefined ? {} : { target }),
    payload,
    metadata,
    severity: input.severity,
    timestamp,
    traceId,
    spanId,
    ...(parentSpanId === undefined ? {} : { parentSpanId }),
    idempotencyKey,
    correlationId,
    ...(causationId === undefined ? {} : { causationId }),
    ...(recordedAt === undefined ? {} : { recordedAt }),
  };
  canonicalSerialize(logicalEventProjection(normalized));
  return normalized;
}

/**
 * Logical retry equality excludes attempt-local event/trace/span IDs and
 * recordedAt. The first accepted delivery still preserves those values as
 * evidence, while retries bind to domain-semantic content.
 */
export function logicalEventProjection(event: AppendEventInput | DurableEvent): LogicalEventProjection {
  return {
    type: nonEmpty(event.type, 'Event type'),
    source: nonEmpty(String(event.source), 'Event source'),
    target: event.target === undefined ? null : nonEmpty(String(event.target), 'Event target'),
    payload: canonicalClone(event.payload, 'Event payload'),
    metadata: canonicalClone(event.metadata ?? {}, 'Event metadata') as Metadata,
    severity: event.severity,
    occurredAt: canonicalTime(event.timestamp, 'Event timestamp'),
    correlationId: nonEmpty(event.correlationId, 'Event correlationId'),
    causationId: event.causationId === undefined ? null : nonEmpty(String(event.causationId), 'Event causationId'),
  };
}

export function logicalEventHash(event: AppendEventInput | DurableEvent): string {
  return canonicalHash128(logicalEventProjection(event));
}

export function assertSameLogicalEvent(
  existing: DurableEvent,
  incoming: AppendEventInput,
  code = 'IDEMPOTENCY_KEY_CONFLICT',
): void {
  const expected = logicalEventHash(existing);
  const actual = logicalEventHash(incoming);
  if (expected !== actual) {
    throw new Error(`${code} key=${incoming.idempotencyKey} expectedLogical=${expected} actualLogical=${actual}`);
  }
}

export function cloneDurableEvent(event: DurableEvent): DurableEvent {
  canonicalSerialize(eventEvidenceProjection(event));
  return {
    id: event.id,
    type: event.type,
    source: event.source,
    ...(event.target === undefined ? {} : { target: event.target }),
    payload: canonicalClone(event.payload, 'Event payload'),
    metadata: canonicalClone(event.metadata ?? {}, 'Event metadata') as Metadata,
    severity: event.severity,
    timestamp: canonicalTime(event.timestamp, 'Event timestamp'),
    traceId: event.traceId,
    spanId: event.spanId,
    ...(event.parentSpanId === undefined ? {} : { parentSpanId: event.parentSpanId }),
    sequence: event.sequence,
    idempotencyKey: event.idempotencyKey,
    correlationId: event.correlationId,
    ...(event.causationId === undefined ? {} : { causationId: event.causationId }),
    recordedAt: canonicalTime(event.recordedAt, 'Event recordedAt'),
  };
}

export class InMemoryEventLog implements IEventLog {
  private events: DurableEvent[] = [];
  private byId = new Map<EntityId, DurableEvent>();
  private byIdempotencyKey = new Map<string, DurableEvent>();
  private nextSequence = 1;

  async append(raw: AppendEventInput): Promise<AppendResult> {
    const input = normalizeAppendEventInput(raw);
    const duplicate = this.byIdempotencyKey.get(input.idempotencyKey);
    if (duplicate) {
      assertSameLogicalEvent(duplicate, input);
      return { event: cloneDurableEvent(duplicate), appended: false };
    }
    if (this.byId.has(input.id)) throw new Error(`EVENT_ID_COLLISION id=${String(input.id)}`);

    const event = toDurableEvent(input, this.nextSequence++, input.recordedAt ?? new Date().toISOString());
    const stored = cloneDurableEvent(event);
    this.events.push(stored);
    this.byId.set(stored.id, stored);
    this.byIdempotencyKey.set(stored.idempotencyKey, stored);
    return { event: cloneDurableEvent(stored), appended: true };
  }

  async get(eventId: EntityId): Promise<DurableEvent | null> {
    const event = this.byId.get(eventId);
    return event ? cloneDurableEvent(event) : null;
  }

  async getByIdempotencyKey(key: string): Promise<DurableEvent | null> {
    const event = this.byIdempotencyKey.get(nonEmpty(key, 'Event idempotencyKey'));
    return event ? cloneDurableEvent(event) : null;
  }

  async readFrom(cursor: EventLogCursor = { sequence: 0 }, limit = 1000): Promise<DurableEvent[]> {
    assertCursor(cursor);
    assertLimit(limit);
    return this.events.filter(event => event.sequence > cursor.sequence).slice(0, limit).map(cloneDurableEvent);
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

export function assertCursor(cursor: EventLogCursor): void {
  if (!Number.isSafeInteger(cursor.sequence) || cursor.sequence < 0) {
    throw new Error(`Invalid event-log cursor: ${cursor.sequence}`);
  }
}

export function assertLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > 100_000) {
    throw new Error(`Invalid event-log limit: ${limit}`);
  }
}

function toDurableEvent(input: AppendEventInput, sequence: number, recordedAt: string): DurableEvent {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error(`Invalid event-log sequence: ${sequence}`);
  const normalized = normalizeAppendEventInput(input);
  return {
    ...normalized,
    recordedAt: canonicalTime(recordedAt, 'Event recordedAt'),
    sequence,
  } as DurableEvent;
}

function eventEvidenceProjection(event: DurableEvent): Record<string, unknown> {
  return {
    id: String(event.id),
    type: event.type,
    source: String(event.source),
    target: event.target === undefined ? null : String(event.target),
    payload: event.payload,
    metadata: event.metadata ?? {},
    severity: event.severity,
    timestamp: canonicalTime(event.timestamp, 'Event timestamp'),
    traceId: event.traceId,
    spanId: event.spanId,
    parentSpanId: event.parentSpanId ?? null,
    sequence: event.sequence,
    idempotencyKey: event.idempotencyKey,
    correlationId: event.correlationId,
    causationId: event.causationId === undefined ? null : String(event.causationId),
    recordedAt: canonicalTime(event.recordedAt, 'Event recordedAt'),
  };
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${message(error)}`);
  }
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
