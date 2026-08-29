import assert from 'node:assert/strict';
import {
  AuthorityJsonIdempotencyInspector,
  type AuthorityPinnedHttpTarget,
  type AuthorityPinnedHttpTransport,
  type AuthorityPinnedHttpTransportRequest,
  type AuthorityProviderInspectionRequest,
} from '../packages/execution/src/authority-phase05-clean';

const INSPECTED_AT = '2026-08-29T14:00:00.000Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const request = inspectionRequest();
  const appliedTransport = new FakeStatusTransport({
    schemaVersion: 1,
    providerIdempotencyKey: request.providerIdempotencyKey,
    status: 'applied',
    providerRevision: 7,
    result: { providerReference: 'order-42', status: 'accepted' },
    evidence: { source: 'provider-idempotency-index' },
  });
  const applied = await inspector(appliedTransport, 'GET').inspect(request);
  check(applied.status === 'applied', 'applied status maps to provider-applied outcome');
  check(appliedTransport.calls.length === 1, 'inspector performs one read-only status call');
  check(appliedTransport.calls[0]?.target.method === 'GET', 'inspector never invokes the original mutation');
  check(appliedTransport.calls[0]?.providerIdempotencyKey === request.providerIdempotencyKey, 'provider identity reaches status transport');
  check(typeof applied.evidence.evidenceHash === 'string', 'inspection evidence is content hashed');

  const absence = await inspector(new FakeStatusTransport({
    schemaVersion: 1,
    providerIdempotencyKey: request.providerIdempotencyKey,
    status: 'not_applied',
    authoritativeAbsence: true,
    evidence: { providerRevision: 9, lookup: 'not-found' },
  }), 'HEAD').inspect(request);
  check(absence.status === 'not_applied' && absence.authoritativeAbsence, 'authoritative absence is retry-eligible');

  await assert.rejects(() => inspector(new FakeStatusTransport({
    schemaVersion: 1,
    providerIdempotencyKey: request.providerIdempotencyKey,
    status: 'not_applied',
    evidence: {},
  }), 'GET').inspect(request), /AUTHORITATIVE_ABSENCE_REQUIRED/);
  assertions += 1;

  const partial = await inspector(new FakeStatusTransport({
    schemaVersion: 1,
    providerIdempotencyKey: request.providerIdempotencyKey,
    status: 'partial',
    evidence: { primaryCreated: true, indexCreated: false },
    compensation: {
      capability: 'authority_http_compensate',
      resourceUri: 'https://api.example.com/orders/42',
      input: { action: 'delete-primary' },
      error: {
        code: 'PROVIDER_PARTIAL_APPLY',
        message: 'Primary exists but index is missing',
        retryable: false,
        details: { primaryCreated: true },
      },
    },
  }), 'GET').inspect(request);
  check(partial.status === 'partial' && partial.compensationCapability === 'authority_http_compensate', 'partial status requires compensation');

  const unknown = await inspector(new FakeStatusTransport({
    schemaVersion: 1,
    providerIdempotencyKey: request.providerIdempotencyKey,
    status: 'unknown',
    reason: 'provider replication lag',
    evidence: { lagSeconds: 12 },
  }), 'GET').inspect(request);
  check(unknown.status === 'unknown' && unknown.reason.includes('replication'), 'inconclusive provider evidence remains unknown');

  await assert.rejects(() => inspector(appliedTransport, 'POST').inspect(request), /MUST_BE_READ_ONLY/);
  assertions += 1;
  await assert.rejects(() => inspector(new FakeStatusTransport({
    schemaVersion: 1,
    providerIdempotencyKey: 'different-provider-key',
    status: 'applied',
    result: {},
  }), 'GET').inspect(request), /IDEMPOTENCY_MISMATCH/);
  assertions += 1;

  console.log(`Authority JSON idempotency inspector clean contract: ${assertions} assertions passed`);
}

function inspector(transport: AuthorityPinnedHttpTransport, method: 'GET' | 'HEAD' | 'POST') {
  return new AuthorityJsonIdempotencyInspector({
    inspectorId: 'inspector://provider/status-v1',
    inspectorVersion: '1.0.0',
    targetFactory: { createTarget: () => statusTarget(method) },
    transport,
  });
}

function inspectionRequest(): AuthorityProviderInspectionRequest {
  return {
    operationId: 'operation://order-42',
    projectId: 'COS_GRAPH_ENGINE',
    capability: 'authority_http_write',
    resourceUri: 'https://api.example.com/orders/42',
    providerIdempotencyKey: 'provider-order-42-v1',
    fencingToken: 3,
    inspectedAt: INSPECTED_AT,
    target: {
      kind: 'http',
      canonicalUrl: 'https://api.example.com/orders/42',
      hostname: 'api.example.com',
      method: 'POST',
      targetDecisionHash: 'mutation-target-decision',
    },
    input: {},
    operationContentHash: 'operation-content-hash',
  };
}

function statusTarget(method: 'GET' | 'HEAD' | 'POST'): AuthorityPinnedHttpTarget {
  return {
    schemaVersion: 1,
    canonicalUrl: 'https://api.example.com/idempotency/provider-order-42-v1',
    protocol: 'https:',
    hostname: 'api.example.com',
    port: 443,
    method,
    resolvedAddresses: [{ address: '93.184.216.34', family: 4 }],
    authorizedAt: '2026-08-29T13:59:50.000Z',
    expiresAt: '2026-08-29T14:01:50.000Z',
    redirectCount: 0,
    policyHash: 'status-policy-hash',
    decisionHash: 'status-decision-hash',
  };
}

class FakeStatusTransport implements AuthorityPinnedHttpTransport {
  readonly calls: AuthorityPinnedHttpTransportRequest[] = [];
  constructor(private readonly envelope: Record<string, unknown>) {}
  async execute(request: AuthorityPinnedHttpTransportRequest): Promise<unknown> {
    this.calls.push(structuredClone(request));
    return {
      statusCode: 200,
      bodyBase64: Buffer.from(JSON.stringify(this.envelope), 'utf8').toString('base64'),
      headers: { 'content-type': 'application/json' },
    };
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
