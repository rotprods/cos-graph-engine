import { EntityId, stableHash128 } from '@cos/core';
import {
  InMemoryIdempotencyRegistry,
  InMemoryLeaseManager,
  type IdempotencyRecord,
  type Lease,
} from '@cos/runtime';
import { AutonomousLoop, type AutonomousGoal } from './autonomous-loop';

export interface ExecuteGoalRequest {
  goalId: EntityId;
  idempotencyKey: string;
  workerId: string;
  leaseTtlMs?: number;
}

export interface GoalExecutionReceipt {
  goalId: EntityId;
  idempotencyKey: string;
  workerId: string;
  lease: Pick<Lease, 'resource' | 'fencingVersion' | 'acquiredAt' | 'expiresAt'>;
  goalStatus: AutonomousGoal['status'];
  resultHash: string;
}

export class GoalExecutionCoordinator {
  constructor(
    private readonly loop: AutonomousLoop,
    private readonly leases = new InMemoryLeaseManager(),
    private readonly idempotency = new InMemoryIdempotencyRegistry(),
  ) {}

  async execute(request: ExecuteGoalRequest): Promise<GoalExecutionReceipt> {
    const workerId = request.workerId.trim();
    const idempotencyKey = request.idempotencyKey.trim();
    if (!workerId) throw new Error('workerId must not be empty');
    if (!idempotencyKey) throw new Error('idempotencyKey must not be empty');

    const logicalPayload = { goalId: String(request.goalId) };
    const claim = this.idempotency.claim<GoalExecutionReceipt>(idempotencyKey, logicalPayload, workerId);
    if (!claim.fresh) {
      if (claim.record.status === 'completed' && claim.record.result) return claim.record.result;
      if (claim.record.status === 'failed') throw new Error(`IDEMPOTENT_EXECUTION_PREVIOUSLY_FAILED key=${idempotencyKey}: ${claim.record.error || 'unknown error'}`);
      throw new Error(`IDEMPOTENT_EXECUTION_IN_PROGRESS key=${idempotencyKey} owner=${claim.record.owner}`);
    }

    const resource = `goal:${String(request.goalId)}`;
    let lease: Lease | null = null;
    let goal: AutonomousGoal | null = null;
    let previousFencing: unknown;
    let previousWorker: unknown;
    try {
      lease = this.leases.acquire(resource, workerId, { ttlMs: request.leaseTtlMs ?? 30_000 });
      goal = await this.loop.getGoal(request.goalId);
      if (!goal) throw new Error(`Goal ${String(request.goalId)} not found`);

      // Propagate the lease fence into capability execution. Side-effecting
      // tool calls are rejected by CapabilityRouter when this metadata is not
      // present, so direct uncoordinated execution cannot accidentally bypass
      // the fencing requirement.
      previousFencing = goal.metadata.executionFencingVersion;
      previousWorker = goal.metadata.executionWorkerId;
      goal.metadata.executionFencingVersion = lease.fencingVersion;
      goal.metadata.executionWorkerId = workerId;

      goal = await this.loop.executeGoal(request.goalId);
      this.leases.assertHeld(resource, lease.token);

      const receipt: GoalExecutionReceipt = {
        goalId: request.goalId,
        idempotencyKey,
        workerId,
        lease: {
          resource: lease.resource,
          fencingVersion: lease.fencingVersion,
          acquiredAt: lease.acquiredAt,
          expiresAt: lease.expiresAt,
        },
        goalStatus: goal.status,
        resultHash: stableHash128({
          goalId: String(goal.id),
          status: goal.status,
          summary: goal.summary || null,
          currentStepIndex: goal.currentStepIndex,
          traceLength: goal.executionTrace.length,
        }),
      };
      this.idempotency.complete(idempotencyKey, workerId, receipt);
      return receipt;
    } catch (error) {
      const record = this.idempotency.get(idempotencyKey);
      if (record?.status === 'in_progress' && record.owner === workerId) this.idempotency.fail(idempotencyKey, workerId, error);
      throw error;
    } finally {
      if (goal) {
        if (previousFencing === undefined) delete goal.metadata.executionFencingVersion;
        else goal.metadata.executionFencingVersion = previousFencing;
        if (previousWorker === undefined) delete goal.metadata.executionWorkerId;
        else goal.metadata.executionWorkerId = previousWorker;
      }
      if (lease) {
        try { this.leases.release(resource, lease.token); } catch { /* stale cleanup never releases a successor lease */ }
      }
    }
  }

  getIdempotencyRecord(key: string): IdempotencyRecord | null {
    return this.idempotency.get(key);
  }
}
