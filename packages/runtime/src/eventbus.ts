import {
  CogEvent, EventHandler, IEventBus, SubscribeOptions,
  SubscriptionId, EntityId,
} from '@cos/core';
import { generateId, generateTraceId, generateSpanId } from '@cos/core';
import {
  DurableEvent, EventLogCursor, IEventLog, InMemoryEventLog,
} from './event-log';

interface Subscription {
  id: SubscriptionId;
  type: string;
  handler: EventHandler;
  options: SubscribeOptions;
}

export interface EventDeliveryFailure {
  eventId: EntityId;
  subscriptionId: SubscriptionId;
  eventType: string;
  error: unknown;
  recordedAt: string;
}

/**
 * Event delivery layer backed by an append-only event log.
 *
 * `history` remains a bounded diagnostic view for backwards compatibility.
 * Accepted events themselves live in `eventLog`, where producer idempotency and
 * replay cursors are enforced independently from subscriber delivery.
 */
export class EventBus implements IEventBus {
  private subscriptions: Map<string, Subscription[]> = new Map();
  private history: CogEvent[] = [];
  private deliveryFailures: EventDeliveryFailure[] = [];
  private readonly maxHistory: number;
  private readonly eventLog: IEventLog;

  constructor(maxHistory: number = 10000, eventLog: IEventLog = new InMemoryEventLog()) {
    this.maxHistory = maxHistory;
    this.eventLog = eventLog;
  }

  async publish(
    event: Omit<CogEvent, 'id' | 'timestamp' | 'traceId' | 'spanId'>,
  ): Promise<EntityId> {
    const id = generateId();
    const traceId = generateTraceId();
    const timestamp = new Date().toISOString();
    const metadata = event.metadata || {};

    const idempotencyKey = typeof metadata.idempotencyKey === 'string' && metadata.idempotencyKey.trim()
      ? metadata.idempotencyKey.trim()
      : `event:${String(id)}`;
    const correlationId = typeof metadata.correlationId === 'string' && metadata.correlationId.trim()
      ? metadata.correlationId.trim()
      : traceId;
    const causationId = typeof metadata.causationId === 'string' && metadata.causationId.trim()
      ? metadata.causationId as EntityId
      : undefined;

    const fullEvent: CogEvent = {
      ...event,
      id,
      timestamp,
      traceId,
      spanId: generateSpanId(),
    };

    // Canonical acceptance happens before delivery. Duplicate producer retries
    // resolve to the already accepted event and are not delivered twice.
    const append = await this.eventLog.append({
      ...fullEvent,
      idempotencyKey,
      correlationId,
      causationId,
      recordedAt: timestamp,
    });
    if (!append.appended) return append.event.id;

    this.history.push(append.event);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    await this.dispatch(append.event);
    return append.event.id;
  }

  async subscribe(
    type: string,
    handler: EventHandler,
    options: SubscribeOptions = {},
  ): Promise<SubscriptionId> {
    const id = generateId() as SubscriptionId;
    const sub: Subscription = { id, type, handler, options };

    if (!this.subscriptions.has(type)) this.subscriptions.set(type, []);
    this.subscriptions.get(type)!.push(sub);
    return id;
  }

  async unsubscribe(id: SubscriptionId): Promise<void> {
    for (const [type, subs] of this.subscriptions) {
      const idx = subs.findIndex(s => s.id === id);
      if (idx !== -1) {
        subs.splice(idx, 1);
        if (subs.length === 0) this.subscriptions.delete(type);
        return;
      }
    }
  }

  async getHistory(type?: string, limit: number = 100): Promise<CogEvent[]> {
    let events = this.history;
    if (type) events = events.filter(e => e.type === type);
    return events.slice(-Math.max(0, limit));
  }

  /**
   * Deterministic replay for rebuilding projections. Unlike live delivery,
   * replay is fail-closed: a handler error stops the cursor from advancing.
   */
  async replay(
    handler: (event: DurableEvent) => Promise<void> | void,
    cursor: EventLogCursor = { sequence: 0 },
    limit: number = 1000,
  ): Promise<EventLogCursor> {
    const events = await this.eventLog.readFrom(cursor, limit);
    let lastSequence = cursor.sequence;
    for (const event of events) {
      await handler(event);
      lastSequence = event.sequence;
    }
    return { sequence: lastSequence };
  }

  async latestCursor(): Promise<EventLogCursor> {
    return this.eventLog.latestCursor();
  }

  getDeliveryFailures(limit = 100): EventDeliveryFailure[] {
    return this.deliveryFailures.slice(-Math.max(0, limit));
  }

  getEventLog(): IEventLog {
    return this.eventLog;
  }

  async clear(): Promise<void> {
    this.subscriptions.clear();
    this.history = [];
    this.deliveryFailures = [];
    await this.eventLog.clear();
  }

  get subscriberCount(): number {
    let count = 0;
    for (const subs of this.subscriptions.values()) count += subs.length;
    return count;
  }

  get eventCount(): number {
    return this.history.length;
  }

  private async dispatch(fullEvent: CogEvent): Promise<void> {
    const subscribers = this.subscriptions.get(fullEvent.type) || [];
    const wildcardSubscribers = this.subscriptions.get('*') || [];
    const allSubscribers = [...subscribers, ...wildcardSubscribers]
      .sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));

    const toRemove: SubscriptionId[] = [];

    for (const sub of allSubscribers) {
      try {
        if (sub.options.filter && !sub.options.filter(fullEvent)) continue;
        await sub.handler(fullEvent);
        if (sub.options.once) toRemove.push(sub.id);
      } catch (error) {
        this.deliveryFailures.push({
          eventId: fullEvent.id,
          subscriptionId: sub.id,
          eventType: fullEvent.type,
          error,
          recordedAt: new Date().toISOString(),
        });
        if (this.deliveryFailures.length > this.maxHistory) {
          this.deliveryFailures = this.deliveryFailures.slice(-this.maxHistory);
        }
        console.error(`[EventBus] Error in subscriber ${sub.id} for event ${fullEvent.type}:`, error);
      }
    }

    for (const id of toRemove) await this.unsubscribe(id);
  }
}
