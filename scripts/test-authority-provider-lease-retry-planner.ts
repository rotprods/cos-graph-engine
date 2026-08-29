import assert from 'node:assert/strict';
import {
  AuthorityLeaseRetryPlanner,
  AuthorityLeaseService,
  InMemoryAuthorityLeaseStore,
} from '../packages/execution/src/authority-phase05-current';

const BASE = Date.parse('2026-08-29T13:00:00.000Z');
const at = (seconds: number): string => new Date(BASE + seconds * 1000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const store = new InMemoryAuthorityLeaseStore();
  const leases = new AuthorityLeaseService(store);
  const initial = await leases.acquire({
    resourceUri: 'resource://retry-planner',
    ownerId: 'worker://initial',
    operationKey: 'initial-lease',
    at: at(0),
    ttlMs: 5_000,
    metadata: {},
  });
  check(initial.revision.fencingToken === 1, 'initial lease owns fencing token 1');

  const activePlanner = new AuthorityLeaseRetryPlanner(leases, {
    ownerId: 'worker://retry',
    ttlMs: 10_000,
  });
  await assert.rejects(() => activePlanner.planRetry({
    operationId: 'operation://retry-planner',
    projectId: 'COS_GRAPH_ENGINE',
    capability: 'authority_http_write',
    resourceUri: 'resource://retry-planner',
    previousFencingToken: 1,
    previousProviderIdempotencyKey: 'provider-attempt-1',
    inspectedAt: at(2),
    inspectionEvidence: { authoritativeAbsence: true },
  }), /LEASE_|active/i);
  assertions += 1;
  check((await store.getHistory('resource://retry-planner')).length === 1, 'planner never releases or supersedes an active lease implicitly');

  const request = {
    operationId: 'operation://retry-planner',
    projectId: 'COS_GRAPH_ENGINE',
    capability: 'authority_http_write',
    resourceUri: 'resource://retry-planner',
    previousFencingToken: 1,
    previousProviderIdempotencyKey: 'provider-attempt-1',
    inspectedAt: at(6),
    inspectionEvidence: { authoritativeAbsence: true, providerRevision: 4 },
  };
  const planned = await activePlanner.planRetry(request);
  check(planned.nextFencingToken === 2, 'expired lease reacquisition produces a strictly newer fencing token');
  check(planned.nextProviderIdempotencyKey !== 'provider-attempt-1', 'provider attempt key rotates');
  check(planned.evidence.leaseId !== undefined && planned.evidence.leaseContentHash !== undefined, 'retry evidence identifies the acquired lease revision');

  const duplicate = await activePlanner.planRetry(request);
  check(duplicate.nextFencingToken === planned.nextFencingToken, 'same logical retry plan converges to the same lease token');
  check(duplicate.nextProviderIdempotencyKey === planned.nextProviderIdempotencyKey, 'same logical retry plan converges to the same provider key');
  check((await store.getHistory('resource://retry-planner')).length === 2, 'duplicate planning does not append another lease revision');

  const badFactory = new AuthorityLeaseRetryPlanner(leases, {
    ownerId: 'worker://bad-key',
    ttlMs: 10_000,
    providerKeyFactory: input => input.previousProviderIdempotencyKey,
  });
  await assert.rejects(() => badFactory.planRetry({
    ...request,
    operationId: 'operation://bad-provider-key',
    previousFencingToken: 2,
    previousProviderIdempotencyKey: planned.nextProviderIdempotencyKey,
    inspectedAt: at(20),
  }), /PROVIDER_RETRY_IDEMPOTENCY_KEY_MUST_ROTATE/);
  assertions += 1;

  console.log(`Authority provider lease retry planner contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
