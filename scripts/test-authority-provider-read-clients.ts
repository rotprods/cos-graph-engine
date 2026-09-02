import assert from 'node:assert/strict';
import type { AuthorityProviderInspectionRequest } from '../packages/execution/src/authority-provider-reconciliation';
import {
  AuthorityHttpEgressGuard,
  type AuthorityDnsResolver,
} from '../packages/execution/src/authority-isolation';
import type {
  AuthorityPinnedHttpTransport,
  AuthorityPinnedHttpTransportRequest,
} from '../packages/execution/src/authority-provider-tools';
import { AuthorityGuardedPinnedProviderReadTransport } from '../packages/execution/src/providers/authority-provider-read-http-transport';
import { AuthorityGitHubApiReadClient } from '../packages/execution/src/providers/authority-github-api-read-client';
import { AuthorityDriveApiReadClient } from '../packages/execution/src/providers/authority-drive-api-read-client';
import { AuthorityGitHubReconciliationInspector } from '../packages/execution/src/providers/authority-github-reconciliation-inspector';
import { AuthorityDriveReconciliationInspector } from '../packages/execution/src/providers/authority-drive-reconciliation-inspector';
import { InMemoryAuthorityAbsenceObservationStore } from '../packages/execution/src/providers/authority-provider-inspection-shared';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const pinned = new FakePinnedTransport();
  const readTransport = new AuthorityGuardedPinnedProviderReadTransport(
    guard(new PublicResolver()),
    pinned,
    () => ({} as never),
  );

  pinned.enqueue(200, {
    number: 39,
    title: 'Stop-the-line remediation',
    body: 'ordinary provider resource without an implicit COS marker',
  }, {
    etag: '"issue-etag-1"',
    'x-github-request-id': 'github-request-1',
  });
  const githubWithoutExtractor = new AuthorityGitHubApiReadClient({
    transport: readTransport,
    tokenSource: { async getAccessToken() { return 'github-secret-token'; } },
  });
  const rawGitHub = await githubWithoutExtractor.read({
    owner: 'rotprods',
    repository: 'cos-graph-engine',
    targetKey: 'github://rotprods/cos-graph-engine/reconciliation/test',
    operation: githubRequest('2026-09-02T08:20:00.000Z'),
  });
  check(rawGitHub.candidates.length === 0, 'GitHub resource without trusted extractor does not claim applied');
  check(rawGitHub.authoritativeAbsence === false, 'GitHub successful read is not absence evidence');
  check(pinned.requests[0].target.method === 'GET', 'provider reconciliation network method is forced to GET');
  check(pinned.requests[0].target.hostname === 'api.github.com', 'GitHub read consumes fixed allowed host');
  check(pinned.requests[0].target.resolvedAddresses[0]?.address === '140.82.112.5', 'GitHub read consumes pinned DNS address');
  check(
    JSON.stringify(rawGitHub.evidence).includes('github-secret-token') === false,
    'GitHub authorization token is not persisted in evidence',
  );

  pinned.enqueue(200, { number: 39, state: 'open' }, { etag: '"issue-etag-2"' });
  const githubClient = new AuthorityGitHubApiReadClient({
    transport: readTransport,
    tokenSource: { async getAccessToken() { return 'github-secret-token'; } },
    trustedCandidateExtractor: {
      async extract({ request, resource }) {
        const body = resource as { number: number };
        return [{
          providerResourceId: `issue-${body.number}`,
          operationId: request.operation.operationId,
          providerIdempotencyKey: request.operation.providerIdempotencyKey,
          operationContentHash: request.operation.operationContentHash,
          result: { issue: body.number },
          evidence: { source: 'trusted-test-extractor', actor: 'github-app://cos' },
        }];
      },
    },
  });
  const githubInspector = new AuthorityGitHubReconciliationInspector({
    client: githubClient,
    absenceStore: new InMemoryAuthorityAbsenceObservationStore(),
  });
  const githubApplied = await githubInspector.inspect(githubRequest('2026-09-02T08:20:01.000Z'));
  check(githubApplied.status === 'applied', 'trusted GitHub candidate can classify exact applied state');

  pinned.enqueue(404, { message: 'Not Found' }, { 'x-github-request-id': 'github-request-404' });
  const github404 = await githubWithoutExtractor.read({
    owner: 'rotprods',
    repository: 'cos-graph-engine',
    targetKey: 'github://rotprods/cos-graph-engine/reconciliation/test',
    operation: githubRequest('2026-09-02T08:20:02.000Z'),
  });
  check(github404.authoritativeAbsence === false, 'GitHub 404 is non-authoritative by default');
  check(
    github404.evidence.ambiguity === 'NOT_FOUND_NON_AUTHORITATIVE',
    'GitHub 404 keeps permission/not-found ambiguity explicit',
  );

  pinned.enqueue(200, {
    id: 'file-123',
    name: 'Authority checkpoint',
    mimeType: 'application/json',
    modifiedTime: '2026-09-02T08:21:00.000Z',
    version: '9',
    appProperties: {
      cos_operation_id: 'operation-drive-1',
      cos_provider_idempotency_key: 'drive-attempt-1',
      cos_operation_content_hash: 'drive-content-1',
    },
  }, { etag: '"drive-etag-9"' });
  const driveClient = new AuthorityDriveApiReadClient({
    transport: readTransport,
    tokenSource: { async getAccessToken() { return 'drive-secret-token'; } },
  });
  const driveInspector = new AuthorityDriveReconciliationInspector({
    client: driveClient,
    absenceStore: new InMemoryAuthorityAbsenceObservationStore(),
  });
  const driveApplied = await driveInspector.inspect(driveRequest('2026-09-02T08:21:00.000Z'));
  check(driveApplied.status === 'applied', 'Drive app-private exact marker classifies applied');
  check(
    JSON.stringify(driveApplied.evidence).includes('drive-secret-token') === false,
    'Drive authorization token is not persisted in evidence',
  );
  const driveNetwork = pinned.requests.at(-1);
  check(driveNetwork?.target.method === 'GET', 'Drive reconciliation uses GET only');
  check(driveNetwork?.target.hostname === 'www.googleapis.com', 'Drive metadata uses fixed Google API origin');

  pinned.enqueue(200, {
    id: 'file-123',
    name: 'Unmarked resource',
    version: '10',
    appProperties: {},
  }, { etag: '"drive-etag-10"' });
  const driveUnmarked = await driveInspector.inspect(driveRequest('2026-09-02T08:21:01.000Z'));
  check(driveUnmarked.status === 'unknown', 'existing Drive file without COS markers remains unknown');

  pinned.enqueue(404, { error: { code: 404, message: 'File not found' } }, {});
  const drive404 = await driveInspector.inspect(driveRequest('2026-09-02T08:21:02.000Z'));
  check(drive404.status === 'unknown', 'Drive 404 remains unknown instead of proving not_applied');

  await assert.rejects(
    () => githubWithoutExtractor.read({
      owner: 'rotprods',
      repository: 'cos-graph-engine',
      targetKey: 'github://bad-host',
      operation: {
        ...githubRequest('2026-09-02T08:22:00.000Z'),
        target: {
          kind: 'http',
          canonicalUrl: 'https://evil.example/repos/rotprods/cos-graph-engine/issues/39',
          hostname: 'evil.example',
          method: 'PATCH',
          targetDecisionHash: 'decision-evil',
        },
      },
    }),
    /GITHUB_READ_ORIGIN_DENIED/,
  );
  assertions += 1;

  const privateReadTransport = new AuthorityGuardedPinnedProviderReadTransport(
    guard(new PrivateResolver()),
    new FakePinnedTransport(),
    () => ({} as never),
  );
  const privateGitHub = new AuthorityGitHubApiReadClient({ transport: privateReadTransport });
  await assert.rejects(
    () => privateGitHub.read({
      owner: 'rotprods',
      repository: 'cos-graph-engine',
      targetKey: 'github://private-dns',
      operation: githubRequest('2026-09-02T08:22:01.000Z'),
    }),
    /EGRESS_ADDRESS_DENIED/,
  );
  assertions += 1;

  const tamperedTransport = new FakePinnedTransport();
  tamperedTransport.tamperDecisionHash = true;
  tamperedTransport.enqueue(200, { number: 39 }, {});
  const tamperedGitHub = new AuthorityGitHubApiReadClient({
    transport: new AuthorityGuardedPinnedProviderReadTransport(
      guard(new PublicResolver()),
      tamperedTransport,
      () => ({} as never),
    ),
  });
  await assert.rejects(
    () => tamperedGitHub.read({
      owner: 'rotprods', repository: 'cos-graph-engine', targetKey: 'github://tamper',
      operation: githubRequest('2026-09-02T08:22:02.000Z'),
    }),
    /PROVIDER_READ_TARGET_DECISION_MISMATCH/,
  );
  assertions += 1;

  check(!('write' in githubClient) && !('write' in driveClient), 'real provider clients expose no write method');
  console.log(`Authority real provider read-client contract: ${assertions} assertions passed`);
}

function guard(resolver: AuthorityDnsResolver): AuthorityHttpEgressGuard {
  return new AuthorityHttpEgressGuard({
    allowedHosts: ['api.github.com', 'www.googleapis.com'],
    allowedMethods: ['GET'],
    allowedPorts: [443],
    maxResolvedAddresses: 4,
    decisionTtlMs: 60_000,
    maxRedirects: 0,
  }, resolver);
}

function githubRequest(inspectedAt: string): AuthorityProviderInspectionRequest {
  return {
    operationId: 'operation-github-1',
    projectId: 'COS_GRAPH_ENGINE',
    capability: 'authority_http_write',
    resourceUri: 'resource://github/issues/39',
    providerIdempotencyKey: 'github-attempt-1',
    fencingToken: 9,
    inspectedAt,
    target: {
      kind: 'http',
      canonicalUrl: 'https://api.github.com/repos/rotprods/cos-graph-engine/issues/39',
      hostname: 'api.github.com',
      method: 'PATCH',
      targetDecisionHash: 'decision-gh',
    },
    input: { providerIdempotencyKey: 'github-attempt-1' },
    operationContentHash: 'github-content-1',
  };
}

function driveRequest(inspectedAt: string): AuthorityProviderInspectionRequest {
  return {
    operationId: 'operation-drive-1',
    projectId: 'COS_GRAPH_ENGINE',
    capability: 'authority_http_write',
    resourceUri: 'drive://google/file/file-123',
    providerIdempotencyKey: 'drive-attempt-1',
    fencingToken: 4,
    inspectedAt,
    target: {
      kind: 'http',
      canonicalUrl: 'https://www.googleapis.com/drive/v3/files/file-123',
      hostname: 'www.googleapis.com',
      method: 'PATCH',
      targetDecisionHash: 'decision-drive',
    },
    input: { providerIdempotencyKey: 'drive-attempt-1' },
    operationContentHash: 'drive-content-1',
  };
}

class PublicResolver implements AuthorityDnsResolver {
  async resolve(hostname: string) {
    if (hostname === 'api.github.com') return [{ address: '140.82.112.5', family: 4 as const }];
    if (hostname === 'www.googleapis.com') return [{ address: '142.250.74.228', family: 4 as const }];
    return [];
  }
}

class PrivateResolver implements AuthorityDnsResolver {
  async resolve(_hostname: string) {
    return [{ address: '127.0.0.1', family: 4 as const }];
  }
}

class FakePinnedTransport implements AuthorityPinnedHttpTransport {
  readonly requests: AuthorityPinnedHttpTransportRequest[] = [];
  private readonly responses: Array<{
    statusCode: number;
    body: unknown;
    headers: Record<string, string | string[]>;
  }> = [];
  tamperDecisionHash = false;

  enqueue(
    statusCode: number,
    body: unknown,
    headers: Record<string, string | string[]>,
  ): void {
    this.responses.push({ statusCode, body, headers });
  }

  async execute(request: AuthorityPinnedHttpTransportRequest): Promise<unknown> {
    this.requests.push(structuredClone(request));
    const response = this.responses.shift();
    if (!response) throw new Error('FAKE_PINNED_RESPONSE_MISSING');
    return {
      statusCode: response.statusCode,
      headers: response.headers,
      bodyBase64: Buffer.from(JSON.stringify(response.body), 'utf8').toString('base64'),
      contentType: 'application/json',
      location: null,
      connectedAddress: request.target.resolvedAddresses[0]?.address ?? '',
      originalHostname: request.target.hostname,
      method: request.target.method,
      targetDecisionHash: this.tamperDecisionHash
        ? 'tampered-decision-hash'
        : request.target.decisionHash,
    };
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
