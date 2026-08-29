import assert from 'node:assert/strict';
import {
  InMemoryAuthorityCapabilitySignalStoreV2,
  buildAuthorityCapabilitySignalV2,
} from '../packages/execution/src/authority-phase05-clean';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const store = new InMemoryAuthorityCapabilitySignalStoreV2();
  const first = buildAuthorityCapabilitySignalV2({
    type: 'capability_completed', outcome: 'succeeded', nearMiss: false,
    projectId: 'COS_GRAPH_ENGINE', principalId: 'principal://roberto',
    capability: 'authority_http_write', resourceUri: 'https://api.example.com/orders/42',
    operationId: 'operation://42', correlationId: 'corr-42', causationId: null,
    occurredAt: '2026-08-29T18:00:00.000Z', errorCode: null,
    details: { operationState: 'committed', resultHash: 'result-hash' },
  });
  check(store.append(first).appended && store.size() === 1, 'first v2 signal appends');
  check(!store.append(structuredClone(first)).appended && store.size() === 1, 'identical v2 retry is idempotent');

  const nearMiss = buildAuthorityCapabilitySignalV2({
    type: 'provider_outcome_uncertain', outcome: 'uncertain', nearMiss: true,
    projectId: 'COS_GRAPH_ENGINE', principalId: 'principal://roberto',
    capability: 'authority_http_write', resourceUri: 'https://api.example.com/orders/43',
    operationId: 'operation://43', correlationId: 'corr-43', causationId: null,
    occurredAt: '2026-08-29T18:01:00.000Z', errorCode: 'PROVIDER_OUTCOME_UNKNOWN',
    details: { effectKnowledge: 'unknown' },
  });
  store.append(nearMiss);
  check(store.query({ nearMiss: true })[0]?.signalId === nearMiss.signalId, 'near-miss query returns uncertain signal');
  check(store.query({ operationId: 'operation://42' })[0]?.signalId === first.signalId, 'operation query is deterministic');

  const leaked = store.get(first.signalId)!;
  leaked.details.operationState = 'tampered';
  check(store.get(first.signalId)?.details.operationState === 'committed', 'v2 store reads are detached');

  const tampered = structuredClone(first);
  tampered.details.resultHash = 'tampered';
  assert.throws(() => store.append(tampered), /SIGNAL_ID_MISMATCH|SIGNAL_HASH_MISMATCH/);
  assertions += 1;
  assert.throws(() => store.query({ from: '2026-08-30T00:00:00.000Z', to: '2026-08-29T00:00:00.000Z' }), /cannot precede/);
  assertions += 1;

  console.log(`Authority capability signal store V2 contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
