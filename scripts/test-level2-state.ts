// W13 authority tests for L2 StateMachine
import { StateMachine, StateMachineRegistry } from '../packages/graph/src/level2-state';

let p = 0, f = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { p++; console.log(`  ✅ ${msg}`); }
  else { f++; console.error(`  ❌ ${msg}`); }
}

async function expectReject(fn: () => unknown | Promise<unknown>, msg: string) {
  try { await fn(); assert(false, msg); }
  catch { assert(true, msg); }
}

async function main() {
  await expectReject(
    () => new StateMachine('Invalid', [], [], ''),
    'L2: invalid empty definition fails closed at construction',
  );

  const sm = new StateMachine('Mutable Definition', [
    { id: 'idle', label: 'Idle', type: 'initial' },
    { id: 'running', label: 'Running' },
    { id: 'done', label: 'Done', type: 'final' },
  ], [
    { from: 'idle', to: 'running', event: 'start' },
    { from: 'running', to: 'done', event: 'finish' },
  ], 'idle');
  assert(sm.states.length === 3, 'L2: constructor stores valid states');
  assert(sm.transitions.length === 2, 'L2: constructor stores valid transitions');
  assert(sm.id.length > 0, 'L2: machine has identity');

  sm.addState({ id: 'temp', label: 'Temp' });
  assert(sm.states.some(s => s.id === 'temp'), 'L2: addState works');
  await expectReject(() => sm.addState({ id: 'temp', label: 'Duplicate' }), 'L2: duplicate state rejected');
  sm.removeState('temp');
  assert(!sm.states.some(s => s.id === 'temp'), 'L2: removeState works');
  await expectReject(() => sm.removeState('idle'), 'L2: cannot remove current/initial state');

  const skip = sm.addTransition({ from: 'idle', to: 'done', event: 'skip' });
  assert(sm.transitions.some(t => t.id === skip), 'L2: addTransition returns indexed id');
  await expectReject(
    () => sm.addTransition({ from: 'idle', to: 'done', event: 'skip' }),
    'L2: ambiguous same-state/event dispatch rejected',
  );
  sm.removeTransition(skip);
  assert(!sm.transitions.some(t => t.id === skip), 'L2: removeTransition works');

  const guarded = new StateMachine('Guarded', [
    { id: 'locked', label: 'Locked', type: 'initial' },
    { id: 'open', label: 'Open' },
  ], [
    { from: 'locked', to: 'open', event: 'unlock', guard: ctx => ctx.data.key === 'correct' },
  ]);
  assert(!(await guarded.send('unlock')), 'L2: guard blocks when data missing');
  await guarded.patchData({ key: 'correct' });
  assert(guarded.contextData.data.key === 'correct', 'L2: patchData mutates context explicitly');
  const leaked = guarded.contextData;
  leaked.data.key = 'tampered';
  assert(guarded.contextData.data.key === 'correct', 'L2: contextData is copy-safe');
  assert(await guarded.send('unlock'), 'L2: guard accepts patched data');
  assert(guarded.state === 'open', 'L2: guarded transition applied');

  const serial = new StateMachine('Serialized', [
    { id: 'a', label: 'A', type: 'initial' },
    { id: 'b', label: 'B' },
  ], [{ from: 'a', to: 'b', event: 'go', guard: ctx => ctx.data.ready === true }]);
  const patchPromise = serial.patchData({ ready: true });
  const transitionPromise = serial.send('go');
  await Promise.all([patchPromise, transitionPromise]);
  assert(serial.state === 'b', 'L2: patchData and transition share one serialization queue');

  const rollback = new StateMachine('Rollback', [
    { id: 'a', label: 'A', type: 'initial' },
    { id: 'b', label: 'B', entry: async () => { throw new Error('entry failed'); } },
  ], [{ from: 'a', to: 'b', event: 'go' }]);
  const applied = await rollback.send('go');
  assert(!applied, 'L2: failing callback rejects transition');
  assert(rollback.state === 'a', 'L2: failing callback rolls back state');
  assert(rollback.contextData.history.length === 0, 'L2: rollback restores history');
  assert(rollback.contextData.errors.some(e => e.includes('rolled back')), 'L2: rollback records evidence');

  let listenerCalls = 0;
  const listenerFsm = new StateMachine('Listener', [
    { id: 'a', label: 'A', type: 'initial' },
    { id: 'b', label: 'B' },
  ], [{ from: 'a', to: 'b', event: 'go' }]);
  const unsubscribe = listenerFsm.onChange(() => { listenerCalls++; });
  await listenerFsm.send('go');
  unsubscribe();
  assert(listenerCalls === 1, 'L2: listener fires once and can unsubscribe');

  const saved = listenerFsm.toJSON();
  const restored = StateMachine.fromJSON(saved);
  assert(restored.id === listenerFsm.id, 'L2: serialization preserves machine identity');
  assert(restored.states.length === listenerFsm.states.length, 'L2: serialization preserves states');
  assert(restored.transitions.length === listenerFsm.transitions.length, 'L2: serialization preserves transitions');
  assert(restored.validate().length === 0, 'L2: restored definition validates');

  const registry = new StateMachineRegistry();
  const lifecycle = registry.createCognitiveLifecycle();
  for (const event of ['init', 'ready', 'start', 'pause', 'resume', 'shutdown']) {
    assert(await lifecycle.send(event), `L2: lifecycle transition ${event}`);
  }
  assert(lifecycle.isInFinalState(), 'L2: lifecycle reaches final state');
  registry.clear();

  const timeout = new StateMachine('Timeout', [
    { id: 'waiting', label: 'Waiting', type: 'initial', timeout: 0.01 },
    { id: 'timedout', label: 'Timed Out' },
  ], [{ from: 'waiting', to: 'timedout', event: 'timeout' }]);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert(timeout.state === 'timedout', 'L2: timeout transition executes automatically');
  timeout.dispose();
  await expectReject(() => timeout.send('timeout'), 'L2: disposed machine rejects further mutation');

  console.log(`\n📊 L2 authority: ${p} passed, ${f} failed`);
  process.exit(f > 0 ? 1 : 0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
