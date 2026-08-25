import assert from 'node:assert/strict';
import { AuthorityStateMachine } from '../packages/graph/src/authority-state-machine';
import type { StateConfig, StateTransition } from '../packages/graph/src/level2-state';

const T0 = '2026-08-25T12:00:00.000Z';
const T1 = '2026-08-25T12:00:01.000Z';
const T2 = '2026-08-25T12:00:02.000Z';

function definition(options: { throwing?: boolean; protectedMutation?: boolean } = {}): {
  states: StateConfig[];
  transitions: StateTransition[];
} {
  return {
    states: [
      { id: 'idle', label: 'Idle', type: 'initial' },
      { id: 'running', label: 'Running' },
      { id: 'done', label: 'Done', type: 'final' },
    ],
    transitions: [
      {
        id: 'start',
        from: 'idle',
        to: 'running',
        event: 'start',
        action: context => {
          context.data.started = true;
          if (options.protectedMutation) context.currentState = 'done';
          if (options.throwing) throw new Error('planned callback failure');
        },
      },
      { id: 'skip', from: 'idle', to: 'done', event: 'skip' },
      { id: 'finish', from: 'running', to: 'done', event: 'finish' },
    ],
  };
}

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const base = definition();
  const machine = new AuthorityStateMachine('Authority Test', base.states, base.transitions, 'idle', {
    definitionRevision: 'test-v1',
    clock: () => T0,
  });

  check(machine.state === 'idle', 'starts in declared initial state');
  check(machine.currentRevision === 0, 'starts at revision zero');
  check(machine.validate().length === 0, 'initial invariants validate');

  const initialHash = machine.snapshot().stateHash;
  const patched = await machine.patchData({ allowed: true }, { expectedRevision: 0, occurredAt: T0 });
  check(patched.revision === 1, 'data mutation increments the same authority revision');
  check(machine.contextData.data.allowed === true, 'patch is committed');

  const leaked = machine.contextData;
  leaked.data.allowed = false;
  check(machine.contextData.data.allowed === true, 'context reads are copy-safe');
  check(machine.snapshot().stateHash !== initialHash, 'state hash changes with canonical data');

  await assert.rejects(
    machine.patchData({ stale: true }, { expectedRevision: 0, occurredAt: T0 }),
    /STALE_STATE_REVISION/,
  );
  assertions += 1;
  check(machine.contextData.data.stale === undefined, 'stale data writer cannot mutate state');

  const transition = await machine.transition('start', { payloadValue: 1 }, {
    expectedState: 'idle',
    expectedRevision: 1,
    occurredAt: T1,
  });
  check(transition.applied, 'valid transition applies');
  check(transition.previousRevision === 1 && transition.revision === 2, 'transition fences and advances revision');
  check(machine.state === 'running', 'transition reaches target state');
  check(machine.contextData.history[0].timestamp === T1, 'source timestamp is preserved');
  check(machine.contextData.data.started === true, 'callback data is committed');
  check(machine.contextData.data.payloadValue === 1, 'payload is committed before action completes');

  const snapshot = machine.snapshot();
  const restored = AuthorityStateMachine.restore(
    'Authority Test',
    base.states,
    base.transitions,
    snapshot,
    { definitionRevision: 'test-v1', clock: () => T2 },
  );
  check(restored.snapshot().stateHash === snapshot.stateHash, 'restore reproduces exact state hash');
  check(restored.currentRevision === machine.currentRevision, 'restore preserves revision');
  check(restored.state === machine.state, 'restore preserves current state');

  const tampered = structuredClone(snapshot);
  tampered.context.data.payloadValue = 999;
  await assert.rejects(
    async () => AuthorityStateMachine.restore(
      'Authority Test',
      base.states,
      base.transitions,
      tampered,
      { definitionRevision: 'test-v1', clock: () => T2 },
    ),
    /STATE_SNAPSHOT_INTEGRITY_MISMATCH/,
  );
  assertions += 1;

  const rollbackDefinition = definition({ throwing: true });
  const rollback = new AuthorityStateMachine(
    'Rollback Test',
    rollbackDefinition.states,
    rollbackDefinition.transitions,
    'idle',
    { definitionRevision: 'rollback-v1', clock: () => T0 },
  );
  const beforeRollback = rollback.snapshot();
  const rejected = await rollback.transition('start', undefined, {
    expectedRevision: 0,
    occurredAt: T1,
  });
  check(!rejected.applied, 'callback failure rejects transition');
  check(rollback.state === 'idle', 'callback failure leaves canonical state unchanged');
  check(rollback.currentRevision === 0, 'callback failure does not advance revision');
  check(rollback.contextData.data.started === undefined, 'staged callback mutation is rolled back');
  check(rollback.snapshot().stateHash === beforeRollback.stateHash, 'rollback restores exact state hash');

  const protectedDefinition = definition({ protectedMutation: true });
  const protectedMachine = new AuthorityStateMachine(
    'Protected Fields Test',
    protectedDefinition.states,
    protectedDefinition.transitions,
    'idle',
    { definitionRevision: 'protected-v1', clock: () => T0 },
  );
  const protectedResult = await protectedMachine.transition('start', undefined, { occurredAt: T1 });
  check(!protectedResult.applied, 'callback cannot mutate protected transition fields');
  check(protectedMachine.state === 'idle', 'protected-field mutation cannot commit');

  const concurrency = new AuthorityStateMachine('Concurrency Test', base.states, base.transitions, 'idle', {
    definitionRevision: 'concurrency-v1',
    clock: () => T0,
  });
  const competing = await Promise.allSettled([
    concurrency.transition('start', undefined, { expectedRevision: 0, occurredAt: T1 }),
    concurrency.transition('skip', undefined, { expectedRevision: 0, occurredAt: T1 }),
  ]);
  check(competing.filter(result => result.status === 'fulfilled').length === 1, 'only one same-revision writer succeeds');
  check(competing.filter(result => result.status === 'rejected').length === 1, 'stale queued writer fails closed');
  check(concurrency.currentRevision === 1, 'contention produces one committed revision');

  const listenerMachine = new AuthorityStateMachine('Listener Test', base.states, base.transitions, 'idle', {
    definitionRevision: 'listener-v1',
    clock: () => T0,
  });
  listenerMachine.onChange(() => { throw new Error('observer unavailable'); });
  const listenerReceipt = await listenerMachine.transition('start', undefined, { occurredAt: T1 });
  check(listenerReceipt.applied, 'listener failure cannot change transition outcome');
  check(listenerMachine.getFailureLog().some(item => item.operation === 'listener'), 'listener failure is retained as evidence');

  const nonCanonical = new AuthorityStateMachine('Canonical Data Test', base.states, base.transitions, 'idle', {
    definitionRevision: 'canonical-data-v1',
    clock: () => T0,
  });
  await assert.rejects(
    nonCanonical.patchData({ date: new Date(T0) as unknown }, { occurredAt: T1 }),
    /non-plain object/,
  );
  assertions += 1;
  check(nonCanonical.currentRevision === 0, 'non-canonical data cannot advance revision');

  machine.dispose();
  restored.dispose();
  rollback.dispose();
  protectedMachine.dispose();
  concurrency.dispose();
  listenerMachine.dispose();
  nonCanonical.dispose();

  console.log(`AuthorityStateMachine: ${assertions} assertions passed`);
}

void main().catch(error => {
  console.error(error);
  process.exit(1);
});
