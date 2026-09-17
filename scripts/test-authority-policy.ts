import assert from 'node:assert/strict';
import {
  AuthorityPolicyEngine,
  InMemoryAuthorityApprovalStore,
  type AuthorityPolicyRequest,
  type AuthorityPolicyRuleInput,
} from '../packages/execution/src/authority-policy';
import { canonicalHash128 } from '../packages/core/src';

const T0 = '2026-08-28T19:00:00.000Z';
const T1 = '2026-08-28T20:00:00.000Z';
const T2 = '2026-08-28T21:00:00.000Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const rules: AuthorityPolicyRuleInput[] = [
    {
      id: 'allow-builders-internal-tools',
      effect: 'allow',
      priority: 100,
      actions: ['operation.claim', 'operation.prepare', 'operation.execute', 'operation.commit'],
      capabilities: ['provider.resource.update', 'provider.resource.read'],
      resourcePrefixes: ['provider://example/'],
      projectIds: ['COS_GRAPH_ENGINE'],
      anyRoles: ['builder'],
      maxSensitivity: 'internal',
      validFrom: T0,
      reason: 'builders may operate internal project resources',
      provenance: [{ source: 'github://rotprods/cos-graph-engine/pull/46' }],
    },
    {
      id: 'deny-destructive-delete',
      effect: 'deny',
      priority: 1,
      actions: ['operation.commit'],
      capabilities: ['provider.resource.delete'],
      resourcePrefixes: ['provider://example/'],
      projectIds: ['COS_GRAPH_ENGINE'],
      principalIds: ['*'],
      anyRoles: ['*'],
      maxSensitivity: 'restricted',
      validFrom: T0,
      reason: 'destructive deletion is denied in the base runtime',
      provenance: [{ source: 'security://phase05/destructive-policy' }],
    },
    {
      id: 'release-requires-approval',
      effect: 'require_approval',
      priority: 200,
      actions: ['operation.commit'],
      capabilities: ['github.release.publish'],
      resourcePrefixes: ['github://rotprods/repository/cos-graph-engine/release/'],
      projectIds: ['COS_GRAPH_ENGINE'],
      anyRoles: ['release_manager'],
      maxSensitivity: 'internal',
      validFrom: T0,
      reason: 'release publication requires a scoped approval grant',
      provenance: [{ source: 'security://phase05/release-approval' }],
    },
    {
      id: 'broad-release-allow-does-not-bypass-approval',
      effect: 'allow',
      priority: 10,
      actions: ['operation.commit'],
      capabilities: ['github.release.publish'],
      resourcePrefixes: ['github://rotprods/'],
      projectIds: ['COS_GRAPH_ENGINE'],
      anyRoles: ['release_manager'],
      maxSensitivity: 'internal',
      validFrom: T0,
      reason: 'broad release manager allow',
      provenance: [{ source: 'security://phase05/release-role' }],
    },
  ];

  const approvals = new InMemoryAuthorityApprovalStore();
  const engine = new AuthorityPolicyEngine(rules, approvals);
  rules[0]!.actions.push('mutated-after-construction');
  check(!engine.listRules()[0]!.actions.includes('mutated-after-construction'), 'rule inputs are detached at engine construction');

  const principal = {
    id: 'agent://builder/roberto',
    roles: ['builder'],
    projectIds: ['COS_GRAPH_ENGINE'],
    sensitivityClearance: 'internal' as const,
    attributes: { humanOwner: true },
  };
  const baseRequest: AuthorityPolicyRequest = {
    principal,
    action: 'operation.commit',
    capability: 'provider.resource.update',
    resourceUri: 'provider://example/resource/42',
    projectId: 'COS_GRAPH_ENGINE',
    sensitivity: 'internal',
    operationHash: canonicalHash128({ operation: 42 }),
    at: T1,
    context: { phase: 5 },
  };

  const allowed = await engine.evaluate(baseRequest);
  check(allowed.allowed && allowed.effect === 'allow', 'matching role/project/capability rule allows request');
  check(allowed.matchedRuleIds.includes('allow-builders-internal-tools'), 'decision records matched rule ID');
  const allowedAgain = await engine.evaluate(structuredClone(baseRequest));
  check(allowedAgain.decisionHash === allowed.decisionHash, 'same request produces deterministic decision hash');
  check(allowedAgain.decisionId === allowed.decisionId, 'same request produces deterministic decision identity');

  const unknown = await engine.evaluate({
    ...baseRequest,
    action: 'operation.unknown',
  });
  check(!unknown.allowed && unknown.reason.includes('default deny'), 'unknown action fails closed');

  const crossProject = await engine.evaluate({
    ...baseRequest,
    projectId: 'OTHER_PROJECT',
  });
  check(!crossProject.allowed && crossProject.reason.includes('project scope'), 'cross-project request fails before rule matching');

  const restricted = await engine.evaluate({
    ...baseRequest,
    sensitivity: 'restricted',
  });
  check(!restricted.allowed && restricted.reason.includes('clearance'), 'insufficient sensitivity clearance fails closed');

  const destructive = await engine.evaluate({
    ...baseRequest,
    capability: 'provider.resource.delete',
  });
  check(!destructive.allowed && destructive.effect === 'deny', 'explicit deny blocks destructive capability');
  await assert.rejects(
    () => engine.requireAllowed({ ...baseRequest, capability: 'provider.resource.delete' }),
    /POLICY_DENIED/,
  );
  assertions += 1;

  const releasePrincipal = {
    ...principal,
    roles: ['release_manager'],
  };
  const releaseRequest: AuthorityPolicyRequest = {
    principal: releasePrincipal,
    action: 'operation.commit',
    capability: 'github.release.publish',
    resourceUri: 'github://rotprods/repository/cos-graph-engine/release/v2.1.0',
    projectId: 'COS_GRAPH_ENGINE',
    sensitivity: 'internal',
    operationHash: canonicalHash128({ tag: 'v2.1.0', notesHash: 'abc' }),
    at: T1,
    context: { phase: 5 },
  };

  const approvalRequired = await engine.evaluate(releaseRequest);
  check(!approvalRequired.allowed && approvalRequired.requiresApproval, 'require_approval dominates broad allow');
  await assert.rejects(() => engine.requireAllowed(releaseRequest), /POLICY_APPROVAL_REQUIRED/);
  assertions += 1;

  const grant = await engine.grant({
    grantKey: 'release-v2.1.0-approval',
    principalId: releasePrincipal.id,
    approverId: 'human://roberto-gil-ortega',
    action: releaseRequest.action,
    capability: releaseRequest.capability,
    resourceUri: releaseRequest.resourceUri,
    projectId: releaseRequest.projectId,
    operationHash: releaseRequest.operationHash,
    grantedAt: T0,
    expiresAt: T2,
    provenance: [{ source: 'approval://human/release-v2.1.0' }],
    metadata: { channel: 'explicit-owner-approval' },
  });
  check(grant.appended, 'approval grant is appended');
  const grantRetry = await engine.grant({
    grantKey: 'release-v2.1.0-approval',
    principalId: releasePrincipal.id,
    approverId: 'human://roberto-gil-ortega',
    action: releaseRequest.action,
    capability: releaseRequest.capability,
    resourceUri: releaseRequest.resourceUri,
    projectId: releaseRequest.projectId,
    operationHash: releaseRequest.operationHash,
    grantedAt: T0,
    expiresAt: T2,
    provenance: [{ source: 'approval://human/release-v2.1.0' }],
    metadata: { channel: 'explicit-owner-approval' },
  });
  check(!grantRetry.appended && grantRetry.grant.grantId === grant.grant.grantId, 'approval grant retry converges');

  const approved = await engine.requireAllowed(releaseRequest);
  check(approved.allowed && approved.approvalGrantId === grant.grant.grantId, 'exact operation-scoped approval enables request');

  const differentOperation = await engine.evaluate({
    ...releaseRequest,
    operationHash: canonicalHash128({ tag: 'v2.1.1', notesHash: 'different' }),
  });
  check(differentOperation.requiresApproval && !differentOperation.allowed, 'approval cannot authorize another operation hash');

  const expiredGrant = await engine.evaluate({
    ...releaseRequest,
    at: T2,
  });
  check(expiredGrant.requiresApproval && !expiredGrant.allowed, 'approval expiry is exclusive and fail closed');

  const grantList = await approvals.list();
  grantList[0]!.metadata.channel = 'tampered';
  check((await approvals.list())[0]!.metadata.channel === 'explicit-owner-approval', 'approval reads are detached');

  assert.throws(() => new AuthorityPolicyEngine([{
    effect: 'allow',
    priority: 1,
    actions: ['operation.commit'],
    projectIds: ['COS_GRAPH_ENGINE'],
    resourcePrefixes: ['not-a-uri-prefix'],
    validFrom: T0,
    reason: 'invalid resource prefix',
    provenance: [{ source: 'test://invalid-rule' }],
  }]), /resource prefix must be canonical URI prefix/);
  assertions += 1;

  console.log(`Authority policy contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
