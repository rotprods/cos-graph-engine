import assert from 'node:assert/strict';
import {
  AuthorityRepairService,
  AuthorityRepairWorker,
  InMemoryAuthorityRepairStore,
  type AuthorityRepairHandler,
  type AuthorityRepairHandlerContext,
} from '../packages/execution/src/authority-repair-ledger';

const BASE = Date.parse('2026-08-29T20:00:00.000Z');
const at = (seconds: number): string => new Date(BASE + seconds * 1000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const store = new InMemoryAuthorityRepairStore();
  const service = new AuthorityRepairService(store);
  const enqueued = await service.enqueue({
    projectId: 'COS_GRAPH_ENGINE',
    operationId: 'operation://42',
    correlationId: 'corr-42',
    kind: 'agent_evidence_append',
    dedupeKey: 'agent-evidence:run-1:step-1',
    payload: { runId: 'run-1', stepId: 'step-1' },
    sensitivity: 'private',
    maxAttempts: 3,
    nextAttemptAt: at(0),
    idempotencyKey: 'repair-enqueue-1',
    provenance: [{ source: 'test://repair-ledger' }],
    recordedAt: at(0),
  });
  check(enqueued.appended && enqueued.revision.state === 'pending', 'initial repair is append-only pending revision');

  const duplicate = await service.enqueue({
    projectId: 'COS_GRAPH_ENGINE', operationId: 'operation://42', correlationId: 'corr-42',
    kind: 'agent_evidence_append', dedupeKey: 'agent-evidence:run-1:step-1',
    payload: { runId: 'run-1', stepId: 'step-1' }, sensitivity: 'private', maxAttempts: 3,
    nextAttemptAt: at(0), idempotencyKey: 'different-transport-key',
    provenance: [{ source: 'test://repair-ledger' }], recordedAt: at(0),
  });
  check(!duplicate.appended && duplicate.revision.repairId === enqueued.revision.repairId, 'same repair dedupe/payload converges');

  await assert.rejects(() => service.enqueue({
    projectId: 'COS_GRAPH_ENGINE', operationId: 'operation://42', correlationId: 'corr-42',
    kind: 'agent_evidence_append', dedupeKey: 'agent-evidence:run-1:step-1',
    payload: { runId: 'run-1', stepId: 'different' }, sensitivity: 'private', maxAttempts: 3,
    nextAttemptAt: at(0), idempotencyKey: 'repair-conflict',
    provenance: [{ source: 'test://repair-ledger' }], recordedAt: at(0),
  }), /REPAIR_DEDUPE_PAYLOAD_CONFLICT/);
  assertions += 1;

  const claimA = await service.claim({
    repairId: enqueued.revision.repairId, expectedRevision: 1,
    ownerId: 'worker://a', at: at(1), ttlMs: 2_000, idempotencyKey: 'repair-claim-a',
  });
  check(claimA.revision.state === 'leased' && claimA.revision.fencingToken === 1, 'first worker receives fencing token 1');

  await assert.rejects(() => service.resolve({
    repairId: enqueued.revision.repairId, expectedRevision: 2,
    ownerId: 'worker://b', fencingToken: 1, at: at(2),
    resolution: { ok: true }, idempotencyKey: 'wrong-owner-resolve',
  }), /STALE_REPAIR_OWNER/);
  assertions += 1;

  const readyAfterExpiry = await service.listReady('COS_GRAPH_ENGINE', at(4));
  check(readyAfterExpiry.length === 1 && readyAfterExpiry[0]?.effectiveState === 'pending', 'expired lease becomes ready without mutating history');
  const claimB = await service.claim({
    repairId: enqueued.revision.repairId, expectedRevision: 2,
    ownerId: 'worker://b', at: at(4), ttlMs: 5_000, idempotencyKey: 'repair-claim-b',
  });
  check(claimB.revision.fencingToken === 2, 'reacquisition increments repair fencing token');

  await assert.rejects(() => service.resolve({
    repairId: enqueued.revision.repairId, expectedRevision: 3,
    ownerId: 'worker://a', fencingToken: 1, at: at(5),
    resolution: { stale: true }, idempotencyKey: 'stale-resolve',
  }), /STALE_REPAIR_OWNER|STALE_REPAIR_FENCING_TOKEN/);
  assertions += 1;

  const failed = await service.fail({
    repairId: enqueued.revision.repairId, expectedRevision: 3,
    ownerId: 'worker://b', fencingToken: 2, at: at(5), retryAt: at(8),
    error: { code: 'TEMPORARY', message: 'downstream unavailable', retryable: true, details: {} },
    idempotencyKey: 'repair-fail-b',
  });
  check(failed.revision.state === 'pending' && failed.revision.attempts === 2, 'retryable handler failure returns repair to pending');
  check((await service.listReady('COS_GRAPH_ENGINE', at(7))).length === 0, 'repair is not ready before retryAt');

  const handler = new SuccessHandler();
  const worker = new AuthorityRepairWorker(service, [handler], {
    ownerId: 'worker://final', leaseTtlMs: 10_000, retryDelayMs: 1_000,
  });
  const report = await worker.runProject('COS_GRAPH_ENGINE', at(8));
  check(report.claimed === 1 && report.resolved === 1, 'worker claims and resolves ready repair');
  const resolved = await service.get(enqueued.revision.repairId, at(9));
  check(resolved?.state === 'resolved' && resolved.resolution?.handled === true, 'repair ends with append-only resolution evidence');
  check((await service.history(enqueued.revision.repairId)).length === 6, 'all enqueue/claim/fail/reclaim/resolve revisions remain historical');

  const history = await service.history(enqueued.revision.repairId);
  history[0]!.payload.runId = 'tampered';
  check((await service.history(enqueued.revision.repairId))[0]?.payload.runId === 'run-1', 'repair history reads are detached');

  const abandon = await service.enqueue({
    projectId: 'COS_GRAPH_ENGINE', kind: 'telemetry_delivery',
    dedupeKey: 'telemetry:one', payload: { signalId: 'signal-1' },
    maxAttempts: 1, nextAttemptAt: at(10), idempotencyKey: 'repair-enqueue-abandon',
    provenance: [{ source: 'test://repair-ledger' }], recordedAt: at(10),
  });
  const abandonClaim = await service.claim({
    repairId: abandon.revision.repairId, expectedRevision: 1,
    ownerId: 'worker://abandon', at: at(11), ttlMs: 5_000, idempotencyKey: 'repair-claim-abandon',
  });
  const abandoned = await service.fail({
    repairId: abandon.revision.repairId, expectedRevision: abandonClaim.revision.revision,
    ownerId: 'worker://abandon', fencingToken: abandonClaim.revision.fencingToken,
    at: at(12), retryAt: at(13),
    error: { code: 'PERMANENT', message: 'unsupported destination', retryable: false, details: {} },
    idempotencyKey: 'repair-fail-abandon',
  });
  check(abandoned.revision.state === 'abandoned', 'max-attempt repair becomes explicit abandoned evidence');

  console.log(`Authority repair ledger contract: ${assertions} assertions passed`);
}

class SuccessHandler implements AuthorityRepairHandler {
  readonly kind = 'agent_evidence_append' as const;
  async handle(context: AuthorityRepairHandlerContext): Promise<Record<string, unknown>> {
    return {
      handled: true,
      repairId: context.repair.repairId,
      fencingToken: context.fencingToken,
    };
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
