"use strict";
// T-6.2: 40 Tests for L2 State Machine
// Mutation API, transitions, guards, timeouts, serialization, validation
Object.defineProperty(exports, "__esModule", { value: true });
const level2_state_1 = require("../packages/graph/src/level2-state");
let p = 0, f = 0;
function assert(cond, msg) { if (cond) {
    p++;
}
else {
    f++;
    console.error(`  ❌ ${msg}`);
} }
// === Creation ===
const sm = new level2_state_1.StateMachine('Test FSM', [], [], 'idle');
assert(sm.states.length === 0, 'L2: Empty machine has 0 states');
assert(sm.transitions.length === 0, 'L2: Empty machine has 0 transitions');
assert(sm.id.length > 0, 'L2: Machine has id');
// === Mutation API: addState ===
sm.addState({ id: 'idle', label: 'Idle', type: 'initial' });
sm.addState({ id: 'running', label: 'Running' });
sm.addState({ id: 'done', label: 'Done', type: 'final' });
assert(sm.states.length === 3, 'L2: addState adds states');
// === addState duplicate ===
try {
    sm.addState({ id: 'idle', label: 'Duplicate' });
    assert(false, 'L2: Should reject duplicate state');
}
catch (e) {
    assert(true, 'L2: Rejects duplicate state');
}
// === Mutation API: addTransition ===
const t1 = sm.addTransition({ from: 'idle', to: 'running', event: 'start' });
assert(t1.length > 0, 'L2: addTransition returns id');
const t2 = sm.addTransition({ from: 'running', to: 'done', event: 'finish' });
assert(sm.transitions.length === 2, 'L2: addTransition adds transitions');
// === addTransition dangling ===
try {
    sm.addTransition({ from: 'nonexistent', to: 'running', event: 'bad' });
    assert(false, 'L2: Should reject dangling from');
}
catch (e) {
    assert(true, 'L2: Rejects dangling from state');
}
try {
    sm.addTransition({ from: 'running', to: 'nonexistent', event: 'bad' });
    assert(false, 'L2: Should reject dangling to');
}
catch (e) {
    assert(true, 'L2: Rejects dangling to state');
}
// === Mutation API: removeState ===
sm.addState({ id: 'temp', label: 'Temp' });
sm.removeState('temp');
assert(sm.states.length === 3, 'L2: removeState removes state');
try {
    sm.removeState('nonexistent');
    assert(false, 'L2: Should reject remove nonexistent');
}
catch (e) {
    assert(true, 'L2: Rejects remove nonexistent state');
}
// === Mutation API: removeTransition ===
const t3 = sm.addTransition({ from: 'idle', to: 'done', event: 'skip' });
sm.removeTransition(t3);
assert(sm.transitions.length === 2, 'L2: removeTransition removes transition');
try {
    sm.removeTransition('nonexistent');
    assert(false, 'L2: Should reject remove nonexistent transition');
}
catch (e) {
    assert(true, 'L2: Rejects remove nonexistent transition');
}
// === FSM: send event ===
async function testFSM() {
    const fsm = new level2_state_1.StateMachine('Door', [
        { id: 'closed', label: 'Closed', type: 'initial' },
        { id: 'open', label: 'Open' },
        { id: 'locked', label: 'Locked' },
    ], [
        { from: 'closed', to: 'open', event: 'open' },
        { from: 'open', to: 'closed', event: 'close' },
        { from: 'closed', to: 'locked', event: 'lock' },
        { from: 'locked', to: 'closed', event: 'unlock' },
    ]);
    assert(fsm.state === 'closed', 'L2: Initial state is closed');
    assert(fsm.can('open'), 'L2: can() returns true for valid event');
    assert(fsm.can('lock'), 'L2: can() returns true for lock from closed state');
    assert(!fsm.can('close'), 'L2: can() returns false for invalid event from current state');
    assert(fsm.getAvailableEvents().includes('open'), 'L2: getAvailableEvents works');
    assert(!fsm.isInFinalState(), 'L2: Not in final state');
    await fsm.send('open');
    assert(fsm.state === 'open', 'L2: send transitions to open');
    await fsm.send('close');
    assert(fsm.state === 'closed', 'L2: send transitions back to closed');
    // Unknown event
    await fsm.send('unknown');
    assert(fsm.state === 'closed', 'L2: Unknown event stays in same state');
    assert(fsm.contextData.errors.length > 0, 'L2: Unknown event records error');
    // === Guards ===
    const guarded = new level2_state_1.StateMachine('Guarded', [
        { id: 'start', label: 'Start', type: 'initial' },
        { id: 'end', label: 'End' },
    ], [
        { from: 'start', to: 'end', event: 'go', guard: (ctx) => ctx.data.allowed === true },
    ]);
    await guarded.send('go');
    assert(guarded.state === 'start', 'L2: Guard blocks transition');
    guarded.contextData.data.allowed = true;
    await guarded.send('go');
    assert(guarded.state === 'end', 'L2: Guard allows transition when condition met');
    // === Entry/Exit actions ===
    let entryCalled = false;
    let exitCalled = false;
    const actionFSM = new level2_state_1.StateMachine('Actions', [
        { id: 'a', label: 'A', type: 'initial', exit: async () => { exitCalled = true; } },
        { id: 'b', label: 'B', entry: async () => { entryCalled = true; } },
    ], [
        { from: 'a', to: 'b', event: 'go' },
    ]);
    await actionFSM.send('go');
    assert(exitCalled, 'L2: Exit action called');
    assert(entryCalled, 'L2: Entry action called');
    // === Timeouts ===
    const timeoutFSM = new level2_state_1.StateMachine('Timeout', [
        { id: 'waiting', label: 'Waiting', type: 'initial', timeout: 0.01 },
        { id: 'timedout', label: 'Timed Out' },
    ], [
        { from: 'waiting', to: 'timedout', event: 'timeout' },
    ]);
    await new Promise(r => setTimeout(r, 50));
    await timeoutFSM.send('timeout');
    assert(timeoutFSM.state === 'timedout', 'L2: Timeout transition works');
    // === Validation ===
    const valid = new level2_state_1.StateMachine('Valid', [
        { id: 'a', label: 'A', type: 'initial' },
        { id: 'b', label: 'B' },
    ], [
        { from: 'a', to: 'b', event: 'go' },
    ]);
    assert(valid.validate().length === 0, 'L2: Valid machine validates');
    const invalid = new level2_state_1.StateMachine('Invalid', [], [], '');
    assert(invalid.validate().length >= 1, 'L2: Empty machine fails validation');
    // === Metrics ===
    const mt = valid.metrics();
    assert(mt.stateCount === 2, 'L2: Metrics state count');
    assert(mt.transitionCount === 1, 'L2: Metrics transition count');
    assert(mt.uniqueEvents >= 1, 'L2: Metrics unique events');
    // === Serialization: toJSON ===
    const saved = valid.toJSON();
    assert(saved.name === 'Valid', 'L2: toJSON preserves name');
    assert(saved.states.length === 2, 'L2: toJSON preserves states');
    assert(saved.transitions.length === 1, 'L2: toJSON preserves transitions');
    // === Serialization: fromJSON ===
    const restored = level2_state_1.StateMachine.fromJSON(saved);
    assert(restored.states.length === 2, 'L2: fromJSON restores states');
    assert(restored.transitions.length === 1, 'L2: fromJSON restores transitions');
    assert(restored.state === 'a', 'L2: fromJSON restores initial state');
    // === toMermaid ===
    const mermaid = valid.toMermaid();
    assert(mermaid.includes('stateDiagram-v2'), 'L2: Mermaid is stateDiagram');
    assert(mermaid.includes('a'), 'L2: Mermaid contains state id');
    assert(mermaid.includes('go'), 'L2: Mermaid contains event');
    // === StateMachineRegistry ===
    const reg = new level2_state_1.StateMachineRegistry();
    const m1 = reg.create('M1', [{ id: 's', label: 'S', type: 'initial' }, { id: 'e', label: 'E' }], [{ from: 's', to: 'e', event: 'go' }]);
    assert(reg.get(m1.id) !== undefined, 'L2: Registry get works');
    assert(reg.getAll().length === 1, 'L2: Registry getAll works');
    reg.remove(m1.id);
    assert(reg.getAll().length === 0, 'L2: Registry remove works');
    // === Prebuilt FSMs ===
    const cog = reg.createCognitiveLifecycle();
    assert(cog.states.length === 7, 'L2: Cognitive lifecycle has 7 states');
    assert(cog.transitions.length === 11, 'L2: Cognitive lifecycle has 11 transitions');
    const goal = reg.createAutonomousGoalFSM();
    assert(goal.states.length === 7, 'L2: Autonomous goal has 7 states');
    assert(goal.transitions.length === 10, 'L2: Autonomous goal has 10 transitions');
    // === visualize ===
    const vis = valid.visualize();
    assert(vis.includes('FSM:'), 'L2: Visualize includes FSM header');
    assert(vis.includes('Current State'), 'L2: Visualize shows current state');
    // === onChange listener ===
    let changed = false;
    valid.onChange(() => { changed = true; });
    await valid.send('go');
    assert(changed, 'L2: onChange listener fires');
    // === Final state detection ===
    const finalFSM = new level2_state_1.StateMachine('Final', [
        { id: 's', label: 'S', type: 'initial' },
        { id: 'e', label: 'E', type: 'final' },
    ], [{ from: 's', to: 'e', event: 'go' }]);
    assert(!finalFSM.isInFinalState(), 'L2: Not in final state initially');
    await finalFSM.send('go');
    assert(finalFSM.isInFinalState(), 'L2: In final state after transition');
    // === Summary ===
    console.log(`\n📊 L2: ${p} tests, ${p + f} total, ${f} failed`);
    if (f > 0)
        process.exit(1);
}
testFSM();
//# sourceMappingURL=test-level2-state.js.map