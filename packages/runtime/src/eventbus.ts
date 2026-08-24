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

export type EventDeliveryFailureObserver = (
  failure: Readonly<EventDeliveryFailure>,
) => void;

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
  private readonly failureObservers = new Set<EventDeliveryFailureObserver>();
  private readonly maxHistory: number;
  private readonly eventLog: IEventLog;

  constructor(maxHistory: number = 10000, eventLog: IEventLog = new InMemoryEventLog()) {
    if (!Number.isInteger(maxHistory) || maxHistory < 1 || maxHistory > 1_000_000) {
      throw new Error('EventBus maxHistory must be an integer in [1,1000000]');
    }
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
    const normalizedType = type.trim();
    if (!normalizedType) throw new Error('Subscription type must not be empty');
    const id = generateId() as SubscriptionId;
    const subscription: Subscription = {
      id,
      type: normalizedType,
      handler,
      options: { ...options },
    };

    if (!this.subscriptions.has(normalizedType)) this.subscriptions.set(normalizedType, []);
    this.subscriptions.get(normalizedType)!.push(subscription);
    return id;
  }

  async unsubscribe(id: SubscriptionId): Promise<void> {
    for (const [type, subscriptions] of this.subscriptions) {
      const index = subscriptions.findIndex(subscription => subscription.id === id);
      if (index === -1) continue;
      subscriptions.splice(index, 1);
      if (subscriptions.length === 0) this.subscriptions.delete(type);
      return;
    }
  }

  onDeliveryFailure(observer: EventDeliveryFailureObserver): () => void {
    this.failureObservers.add(observer);
    return () => this.failureObservers.delete(observer);
  }

  async getHistory(type?: string, limit: number = 100): Promise<CogEvent[]> {
    const boundedLimit = Math.max(0, Math.min(this.maxHistory, limit));
    const events = type ? this.history.filter(event => event.type === type) : this.history;
    return events.slice(-boundedLimit).map(event => structuredClone(event));
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
    return this.deliveryFailures
      .slice(-Math.max(0, Math.min(this.maxHistory, limit)))
      .map(cloneFailure);
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
    for (const subscriptions of this.subscriptions.values()) count += subscriptions.length;
    return count;
  }

  get eventCount(): number {
    return this.history.length;
  }

  private async dispatch(fullEvent: CogEvent): Promise<void> {
    const subscribers = this.subscriptions.get(fullEvent.type) || [];
    const wildcardSubscribers = this.subscriptions.get('*') || [];
    const allSubscribers = [...subscribers, ...wildcardSubscribers]
      .sort((a, b) =>
        (b.options.priority || 0) - (a.options.priority || 0)
        || String(a.id).localeCompare(String(b.id)),
      );

    const toRemove: SubscriptionId[] = [];

    for (const subscription of allSubscribers) {
      try {
        if (subscription.options.filter && !subscription.options.filter(fullEvent)) continue;
        await subscription.handler(structuredClone(fullEvent));
        if (subscription.options.once) toRemove.push(subscription.id);
      } catch (error) {
        this.recordDeliveryFailure({
          eventId: fullEvent.id,
          subscriptionId: subscription.id,
          eventType: fullEvent.type,
          error,
          recordedAt: new Date().toISOString(),
        });
      }
    }

    for (const id of toRemove) await this.unsubscribe(id);
  }

  private recordDeliveryFailure(failure: EventDeliveryFailure): void {
    const stored = cloneFailure(failure);
    this.deliveryFailures.push(stored);
    if (this.deliveryFailures.length > this.maxHistory) {
      this.deliveryFailures = this.deliveryFailures.slice(-this.maxHistory);
    }

    for (const observer of Array.from(this.failureObservers)) {
      try {
        observer(Object.freeze(cloneFailure(stored)));
      } catch (observerError) {
        // Observability/resilience observers are never allowed to alter delivery
        // semantics. Their own failures remain diagnostic only.
        console.error('[EventBus] Delivery-failure observer failed:', observerError);
      }
    }
    console.error(
      `[EventBus] Error in subscriber ${String(failure.subscriptionId)} for event ${failure.eventType}:`,
      failure.error,
    );
  }
}

function cloneFailure(failure: EventDeliveryFailure): EventDeliveryFailure {
  return {
    ...failure,
    error: failure.error instanceof Error
      ? {
          name: failure.error.name,
          message: failure.error.message,
          stack: failure.error.stack,
        }
      : structuredCloneSafe(failure.error),
  };
}

function structuredCloneSafe(value: unknown): unknown {
  try {
    return structuredClone(value);
  } catch {
    return String(value);
  }
}