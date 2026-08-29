import assert from 'node:assert/strict';
import {
  InMemoryAuthorityCapabilitySignalStore,
  buildAuthorityCapabilitySignal,
} from '../packages/execution/src/authority-phase05-evidence-current';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const store = new InMemoryAuthorityCapabilitySignalStore();
  const first = buildAuthorityCapabilitySignal({
    type: 'capability_completed', outcome: 'succeeded', nearMiss: false,
    projectId: 'COS_GRAPH_ENGINE', principalId: 'principal://roberto',
    capability: 'authority_http_write', resourceUri: 'https://api.example.com/orders/42',
    operationId: 'operation://42', correlationId: 'corr-42', causationId: null,
    occurredAt: '2026-08-29T16:00:00.000Z', errorCode: null,
    details: { operationState: 'committed', resultHash: 'result-hash' },
  });
  const appended = store.append(first);
  check(appended.appended && store.size() === 1, 'first signal is appended');
  const duplicate = store.append(structuredClone(first));
  check(!duplicate.appended && store.size() === 1, 'identical signal retry is idempotent');

  const nearMiss = buildAuthorityCapabilitySignal({
    type: 'provider_outcome_uncertain', outcome: 'uncertain', nearMiss: true,
    projectId: 'COS_GRAPH_ENGINE', principalId: 'principal://roberto',
    capability: 'authority_http_write', resourceUri: 'https://api.example.com/orders/43',
    operationId: 'operation://43', correlationId: 'corr-43', causationId: null,
    occurredAt: '2026-08-29T16:01:00.000Z', errorCode: 'PROVIDER_OUTCOME_UNKNOWN',
    details: { effectKnowledge: 'unknown' },
  });
  store.append(nearMiss);
  check(store.query({ nearMiss: true }).length === 1, 'near-miss query is explicit');
  check(store.query({ operationId: 'operation://42' })[0]?.signalId === first.signalId, 'operation query returns deterministic signal');
  check(store.query({ types: ['capability_completed'], limit: 10 }).length === 1, 'type query filters correctly');

  const leaked = store.get(first.signalId)!;
  leaked.details.operationState = 'tampered';
  check(store.get(first.signalId)?.details.operationState === 'committed', 'stored signal reads are detached');

  const tamperedHash = structuredClone(first);
  tamperedHash.details.resultHash = 'tampered';
  assert.throws(() => store.append(tamperedHash), /SIGNAL_ID_MISMATCH|SIGNAL_HASH_MISMATCH/);
  assertions += 1;

  const tamperedId = structuredClone(first);
  tamperedId.signalId = 'capsig_tampered';
  assert.throws(() => store.append(tamperedId), /SIGNAL_ID_MISMATCH/);
  assertions += 1;

  assert.throws(() => store.query({ from: '2026-08-30T00:00:00.000Z', to: '2026-08-29T00:00:00.000Z' }), /cannot precede/);
  assertions += 1;

  console.log(`Authority capability signal store contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
