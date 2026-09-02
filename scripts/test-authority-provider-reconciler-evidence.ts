import assert from 'node:assert/strict';
import {
  AuthorityProviderReconciler,
  type AuthorityProviderInspectionPort,
  type AuthorityProviderInspectionRequest,
  type AuthorityProviderRetryPlanner,
} from '../packages/execution/src/authority-provider-reconciliation';
import {
  assertAuthorityProviderEvidenceBinding,
  sealAuthorityProviderEvidence,
  verifyAuthorityProviderEvidence,
} from '../packages/execution/src/authority-provider-evidence-integrity';

const OPERATION = {
  operationId: 'op://cos/provider/reconciler-1',
  projectId: 'COS_GRAPH_ENGINE',
  principalId: 'principal://roberto',
  agentRunId: null,
  capability: 'authority_http_write',
  resourceUri: 'resource://github/issues/39',
  input: {
    target: {
      canonicalUrl: 'https://api.github.com/repos/rotprods/cos-graph-engine/issues/39',
      hostname: 'api.github.com',
      method: 'PATCH',
      decisionHash: 'decision-github-issue-39',
    },
    providerIdempotencyKey: 'provider-attempt-1',
  },
  providerIdempotencyKey: 'provider-attempt-1',
  fencingToken: 7,
  state: 'reconciliation_required',
  effectKnowledge: 'unknown',
  terminal: false,
  contentHash: 'content-hash-operation-1',
  revision: 4,
  recordedAt: '2026-08-31T09:40:00.000Z',
};

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const applied = await new AuthorityProviderReconciler({
    inspectedAt: '2026-08-31T09:41:00.000Z',
    inspection: new AppliedInspector(),
  }).inspect(OPERATION as never);
  check(applied.status === 'applied', 'applied provider outcome is preserved');
  const appliedVerified = await verifyAuthorityProviderEvidence(applied.evidence);
  check(appliedVerified.sealingMode === 'canonical-v2-sha256', 'new applied evidence is SHA-256 v2');
  check(appliedVerified.hashAlgorithm === 'sha256', 'applied evidence declares cryptographic integrity');
  assertFullBinding(appliedVerified.evidence);
  assertions += 1;
  check(
    appliedVerified.evidence.projectId === OPERATION.projectId
      && appliedVerified.evidence.capability === OPERATION.capability
      && appliedVerified.evidence.resourceUri === OPERATION.resourceUri
      && appliedVerified.evidence.operationContentHash === OPERATION.contentHash,
    'evidence contains the complete durable operation binding',
  );

  const retryPlanner = new RetryPlanner();
  const notApplied = await new AuthorityProviderReconciler({
    inspectedAt: '2026-08-31T09:42:00.000Z',
    inspection: new NotAppliedInspector(),
    retryPlanner,
  }).inspect(OPERATION as never);
  check(notApplied.status === 'not_applied', 'authoritative absence produces retry preparation evidence');
  if (notApplied.status !== 'not_applied') throw new Error('unexpected result');
  check(notApplied.nextFencingToken === 8, 'retry fence is monotonic');
  check(notApplied.nextProviderIdempotencyKey === 'provider-attempt-2', 'retry provider key rotates');
  const retryVerified = await verifyAuthorityProviderEvidence(notApplied.evidence);
  check(retryVerified.sealingMode === 'canonical-v2-sha256', 'new retry evidence uses SHA-256 v2');
  check(retryVerified.hashAlgorithm === 'sha256', 'retry evidence remains cryptographic');
  assertFullBinding(retryVerified.evidence);
  assertions += 1;
  check(
    (await sealAuthorityProviderEvidence(retryVerified.evidence)).evidenceHash
      === retryVerified.evidence.evidenceHash,
    'retry evidence resealing is stable',
  );
  check(retryPlanner.requests.length === 1, 'retry planner runs exactly once after authoritative absence');

  const partial = await new AuthorityProviderReconciler({
    inspectedAt: '2026-08-31T09:43:00.000Z',
    inspection: new PartialInspector(),
  }).inspect(OPERATION as never);
  check(partial.status === 'partial', 'partial application remains compensation-required evidence');
  const partialVerified = await verifyAuthorityProviderEvidence(partial.evidence);
  check(partialVerified.sealingMode === 'canonical-v2-sha256', 'partial evidence is SHA-256 v2');
  assertFullBinding(partialVerified.evidence);
  assertions += 1;

  await assert.rejects(
    () => new AuthorityProviderReconciler({
      inspectedAt: '2026-08-31T09:44:00.000Z',
      inspection: new UnknownInspector(),
    }).inspect(OPERATION as never),
    /PROVIDER_RECONCILIATION_INCONCLUSIVE/,
  );
  assertions += 1;

  const tampered = structuredClone(applied.evidence);
  tampered.operationContentHash = 'other-content';
  await assert.rejects(
    () => verifyAuthorityProviderEvidence(tampered),
    /EVIDENCE_HASH_MISMATCH/,
  );
  assertions += 1;

  console.log(`Authority provider reconciler evidence contract: ${assertions} assertions passed`);
}

function assertFullBinding(evidence: Record<string, unknown>): void {
  assertAuthorityProviderEvidenceBinding(evidence, {
    operationId: OPERATION.operationId,
    providerIdempotencyKey: OPERATION.providerIdempotencyKey,
    fencingToken: OPERATION.fencingToken,
    projectId: OPERATION.projectId,
    capability: OPERATION.capability,
    resourceUri: OPERATION.resourceUri,
    operationContentHash: OPERATION.contentHash,
  });
}

class AppliedInspector implements AuthorityProviderInspectionPort {
  readonly inspectorId = 'inspector://github/applied';
  readonly inspectorVersion = '1.0.0';
  async inspect(_request: AuthorityProviderInspectionRequest) {
    return {
      status: 'applied' as const,
      result: { providerRevision: 42 },
      evidence: { source: 'github://issue/39', revision: 42 },
    };
  }
}

class NotAppliedInspector implements AuthorityProviderInspectionPort {
  readonly inspectorId = 'inspector://github/absence';
  readonly inspectorVersion = '1.0.0';
  async inspect(_request: AuthorityProviderInspectionRequest) {
    return {
      status: 'not_applied' as const,
      authoritativeAbsence: true as const,
      evidence: { source: 'github://idempotency/provider-attempt-1', observations: 2 },
    };
  }
}

class PartialInspector implements AuthorityProviderInspectionPort {
  readonly inspectorId = 'inspector://github/partial';
  readonly inspectorVersion = '1.0.0';
  async inspect(_request: AuthorityProviderInspectionRequest) {
    return {
      status: 'partial' as const,
      error: {
        code: 'PROVIDER_PARTIAL',
        message: 'Provider reports partial application',
        retryable: false,
        details: { providerRevision: 41 },
      },
      compensationCapability: 'authority_http_compensate',
      compensationResourceUri: OPERATION.resourceUri,
      compensationInput: { expectedRevision: 41 },
      evidence: { source: 'github://issue/39', revision: 41 },
    };
  }
}

class UnknownInspector implements AuthorityProviderInspectionPort {
  readonly inspectorId = 'inspector://github/unknown';
  readonly inspectorVersion = '1.0.0';
  async inspect(_request: AuthorityProviderInspectionRequest) {
    return {
      status: 'unknown' as const,
      reason: 'provider consistency window not elapsed',
      evidence: { source: 'github://issue/39', observation: 'ambiguous' },
    };
  }
}

class RetryPlanner implements AuthorityProviderRetryPlanner {
  readonly requests: unknown[] = [];
  async planRetry(request: Parameters<AuthorityProviderRetryPlanner['planRetry']>[0]) {
    this.requests.push(structuredClone(request));
    return {
      nextFencingToken: 8,
      nextProviderIdempotencyKey: 'provider-attempt-2',
      evidence: { leaseId: 'lease-2', fencingToken: 8 },
    };
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
