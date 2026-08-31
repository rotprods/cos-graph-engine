import assert from 'node:assert/strict';
import type { AuthorityProviderInspectionRequest } from '../packages/execution/src/authority-provider-reconciliation';
import {
  AuthorityRepeatedAbsenceGate,
  InMemoryAuthorityAbsenceObservationStore,
  classifyAuthorityProviderRead,
} from '../packages/execution/src/providers/authority-provider-inspection-shared';

const BASE = Date.parse('2026-09-01T00:00:00.000Z');
const at = (ms: number): string => new Date(BASE + ms).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const applied = await classifyAuthorityProviderRead({
    request: request(at(0)),
    target: target(),
    observation: observation({
      candidates: [candidate({ operationContentHash: 'content-1' })],
    }),
    absenceGate: new AuthorityRepeatedAbsenceGate(new InMemoryAuthorityAbsenceObservationStore()),
  });
  check(applied.status === 'applied', 'one fully bound candidate is applied');

  const missingHash = await classifyAuthorityProviderRead({
    request: request(at(0)), target: target(),
    observation: observation({ candidates: [candidate({ operationContentHash: undefined })] }),
    absenceGate: new AuthorityRepeatedAbsenceGate(new InMemoryAuthorityAbsenceObservationStore()),
  });
  check(missingHash.status === 'unknown', 'candidate without operation content hash is never applied');
  if (missingHash.status === 'unknown') check(missingHash.reason.includes('lacks operation content hash'), 'missing hash reason is explicit');

  const mismatch = await classifyAuthorityProviderRead({
    request: request(at(0)), target: target(),
    observation: observation({ candidates: [candidate({ operationContentHash: 'other-content' })] }),
    absenceGate: new AuthorityRepeatedAbsenceGate(new InMemoryAuthorityAbsenceObservationStore()),
  });
  check(mismatch.status === 'unknown', 'content mismatch remains unknown');

  const duplicate = await classifyAuthorityProviderRead({
    request: request(at(0)), target: target(),
    observation: observation({
      candidates: [
        candidate({ providerResourceId: 'resource-1', operationContentHash: 'content-1' }),
        candidate({ providerResourceId: 'resource-2', operationContentHash: 'content-1' }),
      ],
    }),
    absenceGate: new AuthorityRepeatedAbsenceGate(new InMemoryAuthorityAbsenceObservationStore()),
  });
  check(duplicate.status === 'unknown', 'multiple exact candidates fail closed');

  const foreign = await classifyAuthorityProviderRead({
    request: request(at(0)), target: target(),
    observation: observation({
      candidates: [candidate({ operationId: 'operation-other', operationContentHash: 'content-other' })],
    }),
    absenceGate: new AuthorityRepeatedAbsenceGate(new InMemoryAuthorityAbsenceObservationStore()),
  });
  check(foreign.status === 'unknown', 'existing mismatched provider resource is not absence');

  const partial = await classifyAuthorityProviderRead({
    request: request(at(0)), target: target(),
    observation: observation({
      partial: {
        error: { code: 'PARTIAL', message: 'half applied', retryable: false },
        compensationCapability: 'authority_compensate',
        compensationInput: { providerRevision: 4 },
        evidence: { source: 'provider-partial' },
      },
    }),
    absenceGate: new AuthorityRepeatedAbsenceGate(new InMemoryAuthorityAbsenceObservationStore()),
  });
  check(partial.status === 'partial', 'explicit partial application remains partial');

  const nonAuthority = await classifyAuthorityProviderRead({
    request: request(at(0)), target: target(),
    observation: observation({ authoritativeAbsence: false }),
    absenceGate: new AuthorityRepeatedAbsenceGate(new InMemoryAuthorityAbsenceObservationStore()),
  });
  check(nonAuthority.status === 'unknown', 'non-authoritative empty read cannot prove absence');

  const store = new InMemoryAuthorityAbsenceObservationStore();
  const gate = new AuthorityRepeatedAbsenceGate(store);
  const first = await classifyAuthorityProviderRead({
    request: request(at(0)), target: target(), observation: observation({ providerRevision: 'rev-1' }), absenceGate: gate,
  });
  check(first.status === 'unknown', 'one authoritative absence is insufficient');
  if (first.status === 'unknown') {
    const absence = first.evidence.absence as Record<string, unknown>;
    check(absence.absenceProofHashAlgorithm === 'sha256', 'absence proof declares SHA-256');
    check(typeof absence.absenceProofHash === 'string' && /^[0-9a-f]{64}$/.test(absence.absenceProofHash), 'absence proof hash is 64-hex SHA-256');
  }

  const tooSoon = await classifyAuthorityProviderRead({
    request: request(at(2_000)), target: target(), observation: observation({ providerRevision: 'rev-2' }), absenceGate: gate,
  });
  check(tooSoon.status === 'unknown', 'two absence reads inside the consistency window remain unknown');

  const proven = await classifyAuthorityProviderRead({
    request: request(at(6_000)), target: target(), observation: observation({ providerRevision: 'rev-3' }), absenceGate: gate,
  });
  check(proven.status === 'not_applied', 'separated repeated authoritative absence can prove not_applied');
  if (proven.status === 'not_applied') {
    const absence = proven.evidence.absence as Record<string, unknown>;
    check(absence.proven === true, 'not_applied carries explicit proven absence');
    check(absence.observationCount === 3, 'absence proof records every independent observation');
  }

  const conflictStore = new InMemoryAuthorityAbsenceObservationStore();
  const conflictGate = new AuthorityRepeatedAbsenceGate(conflictStore);
  await conflictGate.observe({
    provider: 'github', targetKey: 'github://rotprods/cos-graph-engine/test', minimumConsistencyWindowMs: 5_000,
    request: request(at(0)), providerRevision: 'rev-a', evidence: { read: 'a' },
  });
  await assert.rejects(
    () => conflictGate.observe({
      provider: 'github', targetKey: 'github://rotprods/cos-graph-engine/test', minimumConsistencyWindowMs: 5_000,
      request: request(at(0)), providerRevision: 'rev-b', evidence: { read: 'b' },
    }),
    /ABSENCE_OBSERVATION_CONFLICT/,
  );
  assertions += 1;

  console.log(`Authority provider inspection shared contract: ${assertions} assertions passed`);
}

function request(inspectedAt: string): AuthorityProviderInspectionRequest {
  return {
    operationId: 'operation-1', projectId: 'COS_GRAPH_ENGINE', capability: 'authority_http_write',
    resourceUri: 'resource://github/issues/39', providerIdempotencyKey: 'attempt-1', fencingToken: 7,
    inspectedAt,
    target: {
      kind: 'http', canonicalUrl: 'https://api.github.com/repos/rotprods/cos-graph-engine/issues/39',
      hostname: 'api.github.com', method: 'PATCH', targetDecisionHash: 'decision-1',
    },
    input: { providerIdempotencyKey: 'attempt-1' },
    operationContentHash: 'content-1',
  };
}

function target() {
  return {
    provider: 'github' as const,
    targetKey: 'github://rotprods/cos-graph-engine/reconciliation/test',
    minimumConsistencyWindowMs: 5_000,
    descriptor: { repository: 'rotprods/cos-graph-engine' },
  };
}

function candidate(overrides: Partial<{
  providerResourceId: string;
  operationId: string;
  providerIdempotencyKey: string;
  operationContentHash: string | undefined;
}> = {}) {
  return {
    providerResourceId: overrides.providerResourceId ?? 'resource-1',
    operationId: overrides.operationId ?? 'operation-1',
    providerIdempotencyKey: overrides.providerIdempotencyKey ?? 'attempt-1',
    ...(overrides.operationContentHash === undefined ? {} : { operationContentHash: overrides.operationContentHash }),
    result: { applied: true },
    evidence: { source: 'provider-resource' },
  };
}

function observation(overrides: Partial<{
  authoritativeAbsence: boolean;
  providerRevision: string | number | null;
  candidates: ReturnType<typeof candidate>[];
  partial: {
    error: { code: string; message: string; retryable: boolean };
    compensationCapability: string;
    compensationInput: unknown;
    evidence: Record<string, unknown>;
  };
}> = {}) {
  return {
    authoritativeAbsence: overrides.authoritativeAbsence ?? true,
    providerRevision: overrides.providerRevision ?? 'rev-0',
    candidates: overrides.candidates ?? [],
    evidence: { requestId: 'read-1' },
    ...(overrides.partial === undefined ? {} : { partial: overrides.partial }),
  };
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
