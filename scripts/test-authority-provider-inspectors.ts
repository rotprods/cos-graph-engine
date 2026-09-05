import assert from 'node:assert/strict';
import type { AuthorityProviderInspectionRequest } from '../packages/execution/src/authority-provider-reconciliation';
import {
  AuthorityGitHubReconciliationInspector,
  type AuthorityGitHubReadRequest,
  type AuthorityGitHubReconciliationReadClient,
} from '../packages/execution/src/providers/authority-github-reconciliation-inspector';
import {
  AuthorityDriveReconciliationInspector,
  type AuthorityDriveReadRequest,
  type AuthorityDriveReconciliationReadClient,
} from '../packages/execution/src/providers/authority-drive-reconciliation-inspector';
import { InMemoryAuthorityAbsenceObservationStore } from '../packages/execution/src/providers/authority-provider-inspection-shared';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const githubClient = new GitHubClient();
  const github = new AuthorityGitHubReconciliationInspector({
    client: githubClient,
    absenceStore: new InMemoryAuthorityAbsenceObservationStore(),
    minimumConsistencyWindowMs: 5_000,
  });
  const githubApplied = await github.inspect(githubRequest('2026-09-01T00:00:00.000Z'));
  check(githubApplied.status === 'applied', 'GitHub exact marker is classified applied');
  check(githubClient.requests.length === 1, 'GitHub client performs one read');
  check(githubClient.requests[0].owner === 'rotprods' && githubClient.requests[0].repository === 'cos-graph-engine', 'GitHub repository identity is canonicalized');
  check(githubClient.requests[0].targetKey.startsWith('github://rotprods/cos-graph-engine/reconciliation/'), 'GitHub target key is provider-scoped');

  await assert.rejects(
    () => github.inspect({
      ...githubRequest('2026-09-01T00:00:00.000Z'),
      target: { ...githubRequest('2026-09-01T00:00:00.000Z').target, hostname: 'evil.example' } as never,
    }),
    /GITHUB_RECONCILIATION_HOST_NOT_ALLOWED/,
  );
  assertions += 1;

  await assert.rejects(
    () => github.inspect({
      ...githubRequest('2026-09-01T00:00:00.000Z'),
      target: {
        kind: 'http', canonicalUrl: 'https://evil.example/repos/rotprods/cos-graph-engine/issues/39',
        hostname: 'api.github.com', method: 'PATCH', targetDecisionHash: 'decision-gh',
      },
    }),
    /GITHUB_RECONCILIATION_HOST_MISMATCH/,
  );
  assertions += 1;

  const absenceClient = new GitHubAbsenceClient();
  const githubAbsence = new AuthorityGitHubReconciliationInspector({
    client: absenceClient,
    absenceStore: new InMemoryAuthorityAbsenceObservationStore(),
    minimumConsistencyWindowMs: 5_000,
  });
  const firstAbsence = await githubAbsence.inspect(githubRequest('2026-09-01T00:00:00.000Z'));
  check(firstAbsence.status === 'unknown', 'first GitHub absence is unknown');
  const secondAbsence = await githubAbsence.inspect(githubRequest('2026-09-01T00:00:06.000Z'));
  check(secondAbsence.status === 'not_applied', 'second separated GitHub authoritative absence proves not_applied');
  if (secondAbsence.status === 'not_applied') {
    const absence = secondAbsence.evidence.absence as Record<string, unknown>;
    check(absence.absenceProofHashAlgorithm === 'sha256', 'GitHub absence proof is SHA-256');
  }

  const driveClient = new DriveClient();
  const drive = new AuthorityDriveReconciliationInspector({
    client: driveClient,
    absenceStore: new InMemoryAuthorityAbsenceObservationStore(),
    minimumConsistencyWindowMs: 10_000,
  });
  const driveApplied = await drive.inspect(driveRequest('2026-09-01T00:01:00.000Z'));
  check(driveApplied.status === 'applied', 'Drive exact marker is classified applied');
  check(driveClient.requests.length === 1, 'Drive client performs one read');
  check(driveClient.requests[0].providerResourceId === 'file-123', 'Drive file ID is parsed from canonical API URL');
  check(driveClient.requests[0].targetKey.startsWith('drive://reconciliation/'), 'Drive target key is provider-scoped');

  await assert.rejects(
    () => drive.inspect({
      ...driveRequest('2026-09-01T00:01:00.000Z'),
      target: {
        kind: 'http', canonicalUrl: 'https://drive.evil.example/drive/v3/files/file-123',
        hostname: 'drive.evil.example', method: 'PATCH', targetDecisionHash: 'decision-drive',
      },
    }),
    /DRIVE_RECONCILIATION_HOST_NOT_ALLOWED/,
  );
  assertions += 1;

  await assert.rejects(
    () => drive.inspect({
      ...driveRequest('2026-09-01T00:01:00.000Z'),
      target: {
        kind: 'filesystem', canonicalTargetUri: 'file:///tmp/x', operation: 'write',
        targetDecisionHash: 'decision-drive', handleHash: 'handle-1',
      },
    }),
    /DRIVE_RECONCILIATION_TARGET_KIND_INVALID/,
  );
  assertions += 1;

  check(!('write' in githubClient) && !('write' in driveClient), 'injected provider clients expose no mutation method');

  console.log(`Authority GitHub/Drive inspector contract: ${assertions} assertions passed`);
}

function githubRequest(inspectedAt: string): AuthorityProviderInspectionRequest {
  return {
    operationId: 'operation-github-1', projectId: 'COS_GRAPH_ENGINE', capability: 'authority_http_write',
    resourceUri: 'resource://github/issues/39', providerIdempotencyKey: 'github-attempt-1', fencingToken: 9,
    inspectedAt,
    target: {
      kind: 'http', canonicalUrl: 'https://api.github.com/repos/RotProds/COS-Graph-Engine/issues/39',
      hostname: 'api.github.com', method: 'PATCH', targetDecisionHash: 'decision-gh',
    },
    input: { providerIdempotencyKey: 'github-attempt-1' },
    operationContentHash: 'github-content-1',
  };
}

function driveRequest(inspectedAt: string): AuthorityProviderInspectionRequest {
  return {
    operationId: 'operation-drive-1', projectId: 'COS_GRAPH_ENGINE', capability: 'authority_http_write',
    resourceUri: 'drive://google/file/file-123', providerIdempotencyKey: 'drive-attempt-1', fencingToken: 4,
    inspectedAt,
    target: {
      kind: 'http', canonicalUrl: 'https://www.googleapis.com/drive/v3/files/file-123',
      hostname: 'www.googleapis.com', method: 'PATCH', targetDecisionHash: 'decision-drive',
    },
    input: { providerIdempotencyKey: 'drive-attempt-1' },
    operationContentHash: 'drive-content-1',
  };
}

class GitHubClient implements AuthorityGitHubReconciliationReadClient {
  readonly requests: AuthorityGitHubReadRequest[] = [];
  async read(request: AuthorityGitHubReadRequest) {
    this.requests.push(structuredClone(request));
    return {
      authoritativeAbsence: false,
      providerRevision: 'etag-42',
      candidates: [{
        providerResourceId: 'issue-39', operationId: request.operation.operationId,
        providerIdempotencyKey: request.operation.providerIdempotencyKey,
        operationContentHash: request.operation.operationContentHash,
        result: { issue: 39 }, evidence: { source: 'github-api-read' },
      }],
      evidence: { requestId: 'gh-read-1' },
    };
  }
}

class GitHubAbsenceClient implements AuthorityGitHubReconciliationReadClient {
  private count = 0;
  async read(_request: AuthorityGitHubReadRequest) {
    this.count += 1;
    return {
      authoritativeAbsence: true,
      providerRevision: `etag-absence-${this.count}`,
      candidates: [],
      evidence: { requestId: `gh-absence-${this.count}` },
    };
  }
}

class DriveClient implements AuthorityDriveReconciliationReadClient {
  readonly requests: AuthorityDriveReadRequest[] = [];
  async read(request: AuthorityDriveReadRequest) {
    this.requests.push(structuredClone(request));
    return {
      authoritativeAbsence: false,
      providerRevision: 'drive-rev-5',
      candidates: [{
        providerResourceId: request.providerResourceId ?? 'file-123', operationId: request.operation.operationId,
        providerIdempotencyKey: request.operation.providerIdempotencyKey,
        operationContentHash: request.operation.operationContentHash,
        result: { fileId: 'file-123' }, evidence: { source: 'drive-api-read' },
      }],
      evidence: { requestId: 'drive-read-1' },
    };
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
