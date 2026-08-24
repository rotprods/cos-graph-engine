import { EntityId, stableHash128 } from '@cos/core';
import { ResilienceRegistry, type ResilienceNodeType } from './resilience';

export type OperationalSafetySignalType =
  | 'stale_write_rejected'
  | 'lease_conflict'
  | 'lease_expired_before_commit'
  | 'idempotency_conflict'
  | 'policy_denied'
  | 'policy_requires_approval'
  | 'subscriber_delivery_failed'
  | 'snapshot_integrity_failed'
  | 'replay_diverged'
  | 'scope_access_rejected'
  | 'context_stale_rejected';

export interface OperationalSafetySignal {
  type: OperationalSafetySignalType;
  projectId?: string;
  resource?: string;
  actor?: string;
  sourceRef: string;
  occurredAt: string;
  detail: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ResilienceObserverOptions {
  /**
   * Repeated equal signals within this time window collapse into one near-miss
   * node with an incremented occurrence count instead of flooding the graph.
   */
  dedupeWindowMs?: number;
}

interface ObservedSignalState {
  nodeId: EntityId;
  lastObservedAtMs: number;
  count: number;
}

/**
 * Turns operational rejects and degraded behavior into first-class learning
 * evidence. A safety mechanism firing successfully is still valuable evidence:
 * it is a near miss, not "nothing happened".
 */
export class ResilienceObserver {
  private readonly dedupeWindowMs: number;
  private readonly recent = new Map<string, ObservedSignalState>();

  constructor(
    private readonly registry: ResilienceRegistry,
    options: ResilienceObserverOptions = {},
  ) {
    this.dedupeWindowMs = options.dedupeWindowMs ?? 5 * 60_000;
    if (!Number.isFinite(this.dedupeWindowMs) || this.dedupeWindowMs < 0) {
      throw new Error('dedupeWindowMs must be >= 0');
    }
  }

  observe(signal: OperationalSafetySignal): EntityId {
    if (!signal.sourceRef.trim()) throw new Error('Operational safety signal requires sourceRef');
    if (!signal.detail.trim()) throw new Error('Operational safety signal requires detail');
    const occurredAtMs = Date.parse(signal.occurredAt);
    if (!Number.isFinite(occurredAtMs)) throw new Error(`Invalid occurredAt '${signal.occurredAt}'`);

    const fingerprint = stableHash128({
      type: signal.type,
      projectId: signal.projectId || null,
      resource: signal.resource || null,
      detail: signal.detail,
    });
    const previous = this.recent.get(fingerprint);

    if (previous && occurredAtMs - previous.lastObservedAtMs <= this.dedupeWindowMs) {
      previous.lastObservedAtMs = Math.max(previous.lastObservedAtMs, occurredAtMs);
      previous.count += 1;
      return previous.nodeId;
    }

    const profile = this.profile(signal.type);
    const nodeId = this.registry.addNode({
      type: 'near_miss',
      title: profile.title,
      description: signal.detail,
      projectId: signal.projectId,
      severity: profile.severity,
      likelihood: profile.likelihood,
      detectability: profile.detectability,
      status: 'observed',
      sourceRef: signal.sourceRef,
      createdAt: signal.occurredAt,
      metadata: {
        signalType: signal.type,
        resource: signal.resource || null,
        actor: signal.actor || null,
        occurrenceCount: 1,
        fingerprint,
        ...(signal.metadata || {}),
      },
    });

    this.recent.set(fingerprint, {
      nodeId,
      lastObservedAtMs: occurredAtMs,
      count: 1,
    });
    return nodeId;
  }

  /**
   * Links a near miss to a modeled failure mode/incident/change when the caller
   * has resolved that relationship. Observation itself never invents causality.
   */
  linkEvidence(
    nearMissId: EntityId,
    targetId: EntityId,
    relation: 'near_miss_of' | 'contributes_to' | 'precedes',
    sourceRef: string,
    confidence: number,
  ): EntityId {
    const node = this.registry.getNode(nearMissId);
    if (!node || node.type !== 'near_miss') throw new Error(`Node ${String(nearMissId)} is not a near miss`);
    return this.registry.addRelation({
      type: relation,
      from: nearMissId,
      to: targetId,
      confidence,
      sourceRef,
    });
  }

  private profile(type: OperationalSafetySignalType): {
    title: string;
    severity: number;
    likelihood: number;
    detectability: number;
    relatedType: ResilienceNodeType;
  } {
    switch (type) {
      case 'replay_diverged':
      case 'snapshot_integrity_failed':
        return { title: type, severity: 0.95, likelihood: 0.35, detectability: 0.95, relatedType: 'failure_mode' };
      case 'scope_access_rejected':
      case 'policy_denied':
        return { title: type, severity: 0.8, likelihood: 0.5, detectability: 0.98, relatedType: 'defense' };
      case 'lease_expired_before_commit':
      case 'stale_write_rejected':
      case 'idempotency_conflict':
        return { title: type, severity: 0.75, likelihood: 0.45, detectability: 0.95, relatedType: 'latent_condition' };
      case 'subscriber_delivery_failed':
      case 'context_stale_rejected':
      case 'lease_conflict':
      case 'policy_requires_approval':
      default:
        return { title: type, severity: 0.55, likelihood: 0.5, detectability: 0.9, relatedType: 'degraded_state' };
    }
  }
}
