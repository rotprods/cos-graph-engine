import assert from 'node:assert/strict';
import {
  InMemoryIdempotencyRegistry,
  VersionedStore,
} from '../packages/runtime/src';

function main(): void {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const original = {
    nested: { status: 'initial', values: [1, 2] },
    flags: { safe: true },
  };
  const store = new VersionedStore(original, 4);
  const initial = store.read();

  // Constructor input is detached.
  original.nested.status = 'mutated-after-construction';
  original.nested.values.push(999);
  check(store.read().value.nested.status === 'initial', 'constructor input cannot mutate canonical state');
  check(store.read().value.nested.values.length === 2, 'constructor nested arrays are detached');

  // read() is detached recursively.
  const leakedRead = store.read();
  leakedRead.value.nested.status = 'mutated-read';
  leakedRead.value.flags.safe = false;
  leakedRead.value.nested.values[0] = 777;
  const afterReadMutation = store.read();
  check(afterReadMutation.value.nested.status === 'initial', 'read object mutation cannot alter canonical state');
  check(afterReadMutation.value.flags.safe === true, 'nested read mutation cannot alter canonical state');
  check(afterReadMutation.value.nested.values[0] === 1, 'nested array mutation cannot alter canonical state');
  check(afterReadMutation.version === 4, 'mutation bypass does not alter version');
  check(afterReadMutation.contentHash === initial.contentHash, 'mutation bypass does not alter hash or value');

  const next = { nested: { status: 'next', values: [3, 4] }, flags: { safe: true } };
  const swap = store.compareHashAndSwap(4, initial.contentHash, next);
  check(swap.previous.version === 4 && swap.current.version === 5, 'successful CAS advances version exactly once');
  check(swap.current.value.nested.status === 'next', 'CAS stores next value');

  // CAS input and returned receipt are detached from canonical state.
  next.nested.status = 'mutated-after-cas';
  swap.current.value.nested.status = 'mutated-receipt';
  swap.current.value.nested.values.push(555);
  const current = store.read();
  check(current.value.nested.status === 'next', 'CAS input/result cannot mutate stored state');
  check(current.value.nested.values.length === 2, 'CAS result arrays are detached');
  check(current.version === 5, 'receipt mutation cannot alter version');
  check(current.contentHash === stableHash(current), 'stored content hash still matches observable canonical value');

  assert.throws(
    () => store.compareAndSwap(4, { nested: { status: 'stale', values: [] }, flags: { safe: true } }),
    /STALE_VERSION/,
  );
  assertions += 1;
  assert.throws(
    () => store.compareHashAndSwap(5, 'wrong-hash', next),
    /STALE_CONTENT/,
  );
  assertions += 1;

  // structuredClone boundary rejects uncloneable authority values.
  assert.throws(
    () => new VersionedStore({ fn: () => 1 }),
    /structured-cloneable/,
  );
  assertions += 1;

  const idempotency = new InMemoryIdempotencyRegistry();
  const payload = { operation: 'write', nested: { key: 'value' } };
  const claim = idempotency.claim('op-1', payload, 'worker-a', 1_000);
  payload.nested.key = 'changed-after-claim';
  check(claim.fresh, 'first idempotency claim is fresh');

  const result = { ok: true, nested: { receipt: 'canonical' } };
  const completed = idempotency.complete('op-1', 'worker-a', result, 2_000);
  result.nested.receipt = 'changed-after-complete';
  completed.result!.nested.receipt = 'changed-receipt';
  const reread = idempotency.get<typeof result>('op-1')!;
  check(reread.result?.nested.receipt === 'canonical', 'idempotency completed result is detached');

  reread.result!.nested.receipt = 'changed-reread';
  check(idempotency.get<typeof result>('op-1')?.result?.nested.receipt === 'canonical', 'idempotency get() returns detached record');

  assert.throws(
    () => idempotency.claim('op-1', { operation: 'different' }, 'worker-b', 3_000),
    /IDEMPOTENCY_CONFLICT/,
  );
  assertions += 1;

  console.log(`Authority concurrency copy-safety contract: ${assertions} assertions passed`);
}

function stableHash<T>(value: { value: T; contentHash: string }): string {
  // Importing the public stable hash here would couple this test to implementation
  // details. A fresh VersionedStore over the visible value provides the same
  // deterministic contract through the public API.
  return new VersionedStore(value.value).read().contentHash;
}

main();
