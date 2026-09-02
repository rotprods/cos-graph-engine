import {
  CogEvent, EventHandler, IEventBus, SubscribeOptions,
  SubscriptionId, EntityId,
} from '@cos/core';
import { generateId, generateTraceId, generateSpanId } from '@cos/core';

interface Subscription {
  id: SubscriptionId;
  type: string;
  handler: EventHandler;
  options: SubscribeOptions;
}

type PublishEventInput = Omit<CogEvent, 'id' | 'timestamp' | 'traceId' | 'spanId'> & {
  traceId?: string;
};

function generateSubscriptionId(): SubscriptionId {
  return `subscription:${generateId()}` as SubscriptionId;
}

export class EventBus implements IEventBus {
  private subscriptions: Map<string, Subscription[]> = new Map();
  private history: CogEvent[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 10000) {
    this.maxHistory = maxHistory;
  }

  async publish(event: PublishEventInput): Promise<EntityId> {
    const { traceId, ...eventWithoutTrace } = event;
    const fullEvent: CogEvent = {
      ...eventWithoutTrace,
      id: generateId(),
      timestamp: new Date().toISOString(),
      traceId: traceId ?? generateTraceId(),
      spanId: generateSpanId(),
    };

    this.history.push(fullEvent);
    if (this.history.length > this.maxHistory) this.history = this.history.slice(-this.maxHistory);

    const subscribers = this.subscriptions.get(event.type) || [];
    const wildcardSubscribers = this.subscriptions.get('*') || [];
    const allSubscribers = [...subscribers, ...wildcardSubscribers];
    allSubscribers.sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));

    const toRemove: SubscriptionId[] = [];
    for (const sub of allSubscribers) {
      try {
        if (sub.options.filter && !sub.options.filter(fullEvent)) continue;
        await sub.handler(fullEvent);
        if (sub.options.once) toRemove.push(sub.id);
      } catch (error) {
        console.error(`[EventBus] Error in subscriber ${sub.id} for event ${event.type}:`, error);
      }
    }

    for (const id of toRemove) await this.unsubscribe(id);
    return fullEvent.id;
  }

  async subscribe(
    type: string,
    handler: EventHandler,
    options: SubscribeOptions = {},
  ): Promise<SubscriptionId> {
    const id = generateSubscriptionId();
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
    return events.slice(-limit);
  }

  async clear(): Promise<void> {
    this.subscriptions.clear();
    this.history = [];
  }

  get subscriberCount(): number {
    let count = 0;
    for (const subs of this.subscriptions.values()) count += subs.length;
    return count;
  }

  get eventCount(): number {
    return this.history.length;
  }
}
