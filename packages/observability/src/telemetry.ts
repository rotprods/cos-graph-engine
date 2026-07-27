import { TelemetryEvent, MetricSample, ITelemetry, CogError, EntityId, Timestamp } from '@cos/core';

export class TelemetrySystem implements ITelemetry {
  private events: TelemetryEvent[] = [];
  private metrics: MetricSample[] = [];
  private maxEvents: number;
  private maxMetrics: number;
  private counters: Map<string, number> = new Map();

  constructor(maxEvents = 100000, maxMetrics = 100000) {
    this.maxEvents = maxEvents;
    this.maxMetrics = maxMetrics;
  }

  async recordEvent(event: TelemetryEvent): Promise<void> {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  async recordMetric(sample: MetricSample): Promise<void> {
    this.metrics.push(sample);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Update counter
    const key = `${sample.name}:${JSON.stringify(sample.tags)}`;
    this.counters.set(key, (this.counters.get(key) || 0) + sample.value);
  }

  async queryEvents(filter: Partial<TelemetryEvent>): Promise<TelemetryEvent[]> {
    let results = this.events;
    if (filter.type) results = results.filter(e => e.type === filter.type);
    if (filter.source) results = results.filter(e => e.source === filter.source);
    if (filter.status) results = results.filter(e => e.status === filter.status);
    return results.slice(-100);
  }

  async queryMetrics(name: string, timeRange: { from: Timestamp; to: Timestamp }): Promise<MetricSample[]> {
    return this.metrics.filter(
      m => m.name === name && m.timestamp >= timeRange.from && m.timestamp <= timeRange.to,
    ).slice(-100);
  }

  async export(): Promise<{
    events: TelemetryEvent[];
    metrics: MetricSample[];
    counters: Record<string, number>;
  }> {
    return {
      events: this.events.slice(-1000),
      metrics: this.metrics.slice(-1000),
      counters: Object.fromEntries(this.counters),
    };
  }

  get eventCount(): number { return this.events.length; }
  get metricCount(): number { return this.metrics.length; }
}