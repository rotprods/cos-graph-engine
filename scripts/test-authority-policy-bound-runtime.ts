import assert from 'node:assert/strict';
import { canonicalHash128 } from '../packages/core/src';
import {
  AuthorityExecutionRuntime,
} from '../packages/execution/src/authority-execution-runtime';
import {
  AuthorityLeaseService,
  InMemoryAuthorityLeaseStore,
} from '../packages/execution/src/authority-lease';
import {
  AuthorityPolicyEngine,
} from '../packages/execution/src/authority-policy';
import {
  PolicyBoundAuthorityExecutionRuntime,
} from '../packages/execution/src/authority-policy-bound-runtime';
import {
  InMemoryAuthoritySideEffectStore,
} from '../packages/execution/src/authority-side-effect';

const at = (minute: number): string =>
  new Date(Date.parse('2026-08-28T20:00:00.000Z') + minute * 60_000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const operationStore = new InMemoryAuthoritySideEffectStore();
  const execution = new AuthorityExecutionRuntime(
    operationStore,
    new AuthorityLeaseService(new InMemoryAuthorityLeaseStore()),
  );
  const policy = new AuthorityPolicyEngine([
    {
      id: 'allow-builder-update-lifecycle',
      effect: 'allow',
      priority: 100,
      actions: ['operation.claim', 'operation.prepare', 'operation.execute', 'operation.commit'],
      capabilities: ['provider.resource.update'],
      resourcePrefixes: ['provider://example/'],
      projectIds: ['COS_GRAPH_ENGINE'],
      anyRoles: ['builder'],
      maxSensitivity: 'internal',
      validFrom: at(0),
      reason: 'builder update lifecycle allowed for internal COS resources',
      provenance: [{ source: 'github://rotprods/cos-graph-engine/pull/46' }],
    },
    {
      id: 'allow-delete-until-commit',
      effect: 'allow',
      priority: 100,
      actions: ['operation.claim', 'operation.prepare', 'operation.execute'],
      capabilities: ['provider.resource.delete'],
      resourcePrefixes: ['provider://example/'],
      projectIds: ['COS_GRAPH_ENGINE'],
      anyRoles: ['builder'],
      maxSensitivity: 'internal',
      validFrom: at(0),
      reason: 'delete can be staged but not committed',
      provenance: [{ source: 'security://phase05/delete-staging' }],
    },
    {
      id: 'deny-delete-commit',
      effect: 'deny',
      priority: 1,
      actions: ['operation.commit'],
      capabilities: ['provider.resource.delete'],
      resourcePrefixes: ['provider://example/'],
      projectIds: ['COS_GRAPH_ENGINE'],
      anyRoles: ['*'],
      maxSensitivity: 'restricted',
      validFrom: at(0),
      reason: 'destructive commit denied',
      provenance: [{ source: 'security://phase05/delete-deny' }],
    },
  ]);
  const secured = new PolicyBoundAuthorityExecutionRuntime(execution, policy);
  const principal = {
    id: 'agent://builder/roberto',
    roles: ['builder'],
    projectIds: ['COS_GRAPH_ENGINE'],
    sensitivityClearance: 'internal' as const,
    attributes: { humanOwner: true },
  };
  const policyContext = { principal, sensitivity: 'internal' as const };
  const resourceUri = 'provider://example/resource/policy-bound';

  const lease = await execution.acquireLease({
    resourceUri,
    ownerId: principal.id,
    operationKey: 'policy-bound-lease',
    at: at(0),
    ttlMs: 30 * 60_000,
  });

  const claimInput = {
    projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: 'policy-bound-update',
    principalId: principal.id,
    agentRunId: 'run://phase05/policy-bound/1',
    capability: 'provider.resource.update',
    resourceUri,
    input: { desiredState: 'LIVE' },
    correlationId: 'corr-policy-bound-update',
    provenance: [{ source: 'github://rotprods/cos-graph-engine/pull/46' }],
    recordedAt: at(1),
  };
  const claimed = await secured.claimOperation(claimInput, policyContext);
  check(claimed.policy.allowed, 'claim is authorized before state mutation');
  const operationId = claimed.result.revision.operationId;
  check(
    claimed.result.revision.metadata.policyDecisionId === claimed.policy.decisionId,
    'accepted claim persists policy decision identity',
  );

  const prepared = await secured.prepareOperation({
    operationId,
    expectedOperationRevision: 1,
    transitionKey: 'policy-bound-update:prepare',
    recordedAt: at(2),
    leaseId: lease.revision.leaseId,
    leaseOwnerId: principal.id,
    fencingToken: lease.revision.fencingToken,
    providerIdempotencyKey: 'provider-policy-bound-update',
  }, policyContext);
  check(prepared.policy.allowed && prepared.result.revision.state === 'prepared', 'prepare is policy-gated and lease-gated');

  const executing = await secured.beginOperation({
    operationId,
    expectedOperationRevision: 2,
    transitionKey: 'policy-bound-update:execute',
    recordedAt: at(3),
  }, policyContext);
  check(executing.policy.allowed && executing.result.revision.state === 'executing', 'execution start is independently authorized');

  const committed = await secured.commitOperation({
    operationId,
    expectedOperationRevision: 3,
    transitionKey: 'policy-bound-update:commit',
    recordedAt: at(4),
    result: { state: 'LIVE', version: 1 },
  }, policyContext);
  check(committed.policy.allowed && committed.result.revision.state === 'committed', 'commit is independently authorized');
  check(
    committed.result.revision.metadata.policyDecisionHash === committed.policy.decisionHash,
    'commit revision carries policy evidence hash',
  );

  const history = await operationStore.getHistory(operationId);
  check(history.length === 4, 'policy-bound operation retains complete append-only history');
  check(history.every(revision => typeof revision.metadata.policyDecisionId === 'string'), 'every state mutation carries a policy decision ID');

  await assert.rejects(() => secured.claimOperation({
    ...claimInput,
    idempotencyKey: 'principal-mismatch',
    recordedAt: at(5),
  }, {
    ...policyContext,
    principal: { ...principal, id: 'agent://attacker' },
  }), /POLICY_PRINCIPAL_MISMATCH/);
  assertions += 1;
  check(await operationStore.getByIdempotencyKey('COS_GRAPH_ENGINE', 'principal-mismatch') === null, 'principal mismatch creates no operation state');

  await assert.rejects(() => secured.claimOperation({
    ...claimInput,
    idempotencyKey: 'cross-project-denied',
    projectId: 'OTHER_PROJECT',
    recordedAt: at(6),
  }, policyContext), /POLICY_DENIED/);
  assertions += 1;
  check(await operationStore.getByIdempotencyKey('OTHER_PROJECT', 'cross-project-denied') === null, 'cross-project denial creates no operation state');

  await assert.rejects(() => secured.claimOperation({
    ...claimInput,
    idempotencyKey: 'restricted-denied',
    recordedAt: at(7),
  }, { principal, sensitivity: 'restricted' }), /POLICY_DENIED/);
  assertions += 1;

  // Destructive operation can be staged, but explicit deny blocks commit.
  const deleteResource = 'provider://example/resource/to-delete';
  const deleteLease = await execution.acquireLease({
    resourceUri: deleteResource,
    ownerId: principal.id,
    operationKey: 'delete-lease',
    at: at(8),
    ttlMs: 30 * 60_000,
  });
  const deleteClaimInput = {
    ...claimInput,
    idempotencyKey: 'delete-operation',
    capability: 'provider.resource.delete',
    resourceUri: deleteResource,
    input: { resourceId: 'to-delete' },
    correlationId: 'corr-delete-operation',
    recordedAt: at(9),
  };
  const deleteClaim = await secured.claimOperation(deleteClaimInput, policyContext);
  const deleteOperationId = deleteClaim.result.revision.operationId;
  await secured.prepareOperation({
    operationId: deleteOperationId,
    expectedOperationRevision: 1,
    transitionKey: 'delete:prepare',
    recordedAt: at(10),
    leaseId: deleteLease.revision.leaseId,
    leaseOwnerId: principal.id,
    fencingToken: deleteLease.revision.fencingToken,
    providerIdempotencyKey: 'provider-delete-operation',
  }, policyContext);
  await secured.beginOperation({
    operationId: deleteOperationId,
    expectedOperationRevision: 2,
    transitionKey: 'delete:execute',
    recordedAt: at(11),
  }, policyContext);
  await assert.rejects(() => secured.commitOperation({
    operationId: deleteOperationId,
    expectedOperationRevision: 3,
    transitionKey: 'delete:commit',
    recordedAt: at(12),
    result: { deleted: true },
  }, policyContext), /POLICY_DENIED/);
  assertions += 1;
  check(
    (await execution.getOperation(deleteOperationId, at(12)))?.state === 'executing',
    'denied commit leaves protected operation state unchanged',
  );

  const expectedLogicalHash = canonicalHash128({
    projectId: claimInput.projectId,
    principalId: claimInput.principalId,
    agentRunId: claimInput.agentRunId,
    capability: claimInput.capability,
    resourceUri: claimInput.resourceUri,
    input: claimInput.input,
  });
  check(claimed.result.revision.logicalHash === expectedLogicalHash, 'policy and operation ledger bind the same logical operation hash');

  console.log(`Policy-bound authority runtime contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
