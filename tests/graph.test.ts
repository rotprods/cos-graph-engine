// COS 3-Level Graph Engine — Test Suite
// Tests: Visual (L0), Execution (L1), State (L2)

import { VisualGraphEngine, ExecutionGraphEngine, StateMachineRegistry, StateMachine, StateConfig, StateTransition } from '../packages/graph/src/index.ts';
import { EntityId } from '../packages/core/src/index.ts';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.log(`  ❌ ${msg}`); }
}

// ============ LEVEL 0: VISUAL GRAPH ============

async function testVisualGraph() {
  const engine = new VisualGraphEngine();

  // Create graph from edges
  const graph = engine.createFromEdges('Test Graph', [
    { from: 'A', to: 'B', label: 'edge1' },
    { from: 'B', to: 'C' },
    { from: 'A', to: 'D' },
  ]);
  assert(graph.nodes.length === 4, 'createFromEdges creates correct nodes (A,B,C,D)');
  assert(graph.edges.length === 3, 'createFromEdges creates correct edges');
  assert(graph.title === 'Test Graph', 'createFromEdges sets title');

  // Mermaid renderer
  const mermaid = engine.render('mermaid');
  assert(mermaid.includes('graph TB'), 'Mermaid renderer outputs graph TB');
  assert(mermaid.includes('A'), 'Mermaid renderer includes node A');
  assert(mermaid.includes('-->'), 'Mermaid renderer includes edges');
  assert(mermaid.includes('|edge1|'), 'Mermaid renderer includes edge labels');

  // Graphviz renderer
  const graphviz = engine.render('graphviz');
  assert(graphviz.includes('digraph'), 'Graphviz renderer outputs digraph');
  assert(graphviz.includes('rankdir'), 'Graphviz renderer includes rankdir');
  assert(graphviz.includes('->'), 'Graphviz renderer includes edges');

  // ASCII renderer
  const ascii = engine.render('ascii');
  assert(ascii.includes('Test Graph'), 'ASCII renderer includes title');
  assert(ascii.includes('├──') || ascii.includes('└──'), 'ASCII renderer has tree structure');

  // JSON export
  const json = engine.render('json');
  const parsed = JSON.parse(json);
  assert(parsed.nodeCount === 4, 'JSON export has correct nodeCount');
  assert(parsed.edgeCount === 3, 'JSON export has correct edgeCount');
  assert(parsed.type === 'visual_graph', 'JSON export has correct type');
}

// ============ LEVEL 1: EXECUTION GRAPH ============

async function testExecutionGraph() {
  const engine = new ExecutionGraphEngine();

  // Sequential pipeline
  const seqId = await engine.createGraph('Sequential', [
    { id: 's1', name: 'Step 1', type: 'function', fn: async (i) => ({ ...i as any, step: 1 }) },
    { id: 's2', name: 'Step 2', type: 'function', fn: async (i) => ({ ...i as any, step: 2 }) },
    { id: 's3', name: 'Step 3', type: 'function', fn: async (i) => ({ ...i as any, step: 3 }) },
  ], [
    { source: 's1', target: 's2' },
    { source: 's2', target: 's3' },
  ]);
  assert(seqId.length > 0, 'createGraph returns valid ID');

  const seqResults = await engine.executeGraph(seqId, { start: true });
  assert(seqResults.size === 3, 'Sequential executes all 3 nodes');
  assert(Array.from(seqResults.values()).every(r => r.status === 'completed'), 'Sequential: all completed');
  assert(seqResults.get('s3')?.output && (seqResults.get('s3')!.output as any).step === 3, 'Sequential: data flows through pipeline');

  // Parallel execution
  const parId = await engine.createGraph('Parallel', [
    { id: 'root', name: 'Root', type: 'function', fn: async (i) => ({ ...i as any, root: true }) },
    { id: 'brA', name: 'Branch A', type: 'function', fn: async (i) => ({ ...i as any, branch: 'A' }) },
    { id: 'brB', name: 'Branch B', type: 'function', fn: async (i) => ({ ...i as any, branch: 'B' }) },
    { id: 'merge', name: 'Merge', type: 'function', fn: async (i) => ({ ...i as any, merged: true }) },
  ], [
    { source: 'root', target: 'brA' },
    { source: 'root', target: 'brB' },
    { source: 'brA', target: 'merge' },
    { source: 'brB', target: 'merge' },
  ], { maxConcurrency: 4 });
  const parResults = await engine.executeGraph(parId, { x: 1 });
  assert(parResults.size === 4, 'Parallel executes all 4 nodes');
  assert(Array.from(parResults.values()).filter(r => r.status === 'completed').length === 4, 'Parallel: all completed');

  // Sleep node
  const sleepId = await engine.createGraph('Sleep', [
    { id: 'sleep1', name: 'Sleep 10ms', type: 'sleep', config: { ms: 10 } },
  ], []);
  const sleepResults = await engine.executeGraph(sleepId, {});
  assert(sleepResults.get('sleep1')?.status === 'completed', 'Sleep node completes');
  assert((sleepResults.get('sleep1')?.output as any)?.slept === 10, 'Sleep node outputs correct ms');

  // Empty graph
  const emptyId = await engine.createGraph('Empty', [], []);
  const emptyResults = await engine.executeGraph(emptyId, {});
  assert(emptyResults.size === 0, 'Empty graph executes with no nodes');

  // Get graph
  const graph = engine.getGraph(seqId);
  assert(graph !== undefined, 'getGraph returns created graph');
  assert(graph!.name === 'Sequential', 'getGraph returns correct graph');

  // Get results
  const storedResults = engine.getResults(seqId);
  assert(storedResults !== undefined, 'getResults returns stored results');
  assert(storedResults!.size === 3, 'getResults returns correct results');
}

// ============ LEVEL 2: STATE GRAPH ============

async function testStateGraph() {
  const registry = new StateMachineRegistry();

  // Cognitive Lifecycle FSM
  const lifecycle = registry.createCognitiveLifecycle();
  assert(lifecycle.state === 'created', 'Lifecycle starts in created state');
  assert(lifecycle.isInFinalState() === false, 'Lifecycle is not final initially');

  await lifecycle.send('init');
  assert(lifecycle.state === 'initializing', 'Lifecycle transitions to initializing');

  await lifecycle.send('ready');
  assert(lifecycle.state === 'ready', 'Lifecycle transitions to ready');

  await lifecycle.send('start');
  assert(lifecycle.state === 'running', 'Lifecycle transitions to running');

  // Available events
  const events = lifecycle.getAvailableEvents();
  assert(events.includes('pause'), 'Running state has pause event');
  assert(events.includes('shutdown'), 'Running state has shutdown event');

  // Pause and resume
  await lifecycle.send('pause');
  assert(lifecycle.state === 'paused', 'Lifecycle transitions to paused');

  await lifecycle.send('resume');
  assert(lifecycle.state === 'running', 'Lifecycle resumes to running');

  // Shutdown
  await lifecycle.send('shutdown');
  assert(lifecycle.state === 'terminated', 'Lifecycle transitions to terminated');
  assert(lifecycle.isInFinalState() === true, 'Lifecycle is final after shutdown');

  // Invalid transition (should be blocked)
  const invalid = await lifecycle.send('start');
  assert(invalid === false, 'Invalid transition is blocked');

  // Can check
  assert(lifecycle.can('start') === false, 'can returns false for invalid transition');
  assert(lifecycle.can('nonexistent') === false, 'can returns false for nonexistent event');

  // Autonomous Goal FSM
  const goal = registry.createAutonomousGoalFSM();
  assert(goal.state === 'created', 'Goal FSM starts in created');

  await goal.send('start');
  assert(goal.state === 'planning', 'Goal FSM transitions to planning');

  await goal.send('plan_ready');
  assert(goal.state === 'executing', 'Goal FSM transitions to executing');

  await goal.send('step_complete');
  assert(goal.state === 'observing', 'Goal FSM transitions to observing');

  await goal.send('all_done');
  assert(goal.state === 'completed', 'Goal FSM transitions to completed');
  assert(goal.isInFinalState() === true, 'Goal FSM is final');

  // Custom FSM
  const custom = registry.create('Custom FSM', [
    { id: 'idle', label: 'Idle', type: 'initial' },
    { id: 'busy', label: 'Busy' },
    { id: 'done', label: 'Done', type: 'final' },
  ], [
    { from: 'idle', to: 'busy', event: 'start' },
    { from: 'busy', to: 'done', event: 'finish' },
  ]);
  assert(custom.state === 'idle', 'Custom FSM starts in idle');
  await custom.send('start');
  assert(custom.state === 'busy', 'Custom FSM transitions to busy');
  await custom.send('finish');
  assert(custom.state === 'done', 'Custom FSM transitions to done');

  // FSM with guard
  let guardPassed = false;
  const guarded = registry.create('Guarded', [
    { id: 'locked', label: 'Locked', type: 'initial' },
    { id: 'open', label: 'Open' },
  ], [
    { from: 'locked', to: 'open', event: 'unlock', guard: (ctx) => ctx.data.key === 'correct' },
  ]);
  await guarded.send('unlock');
  assert(guarded.state === 'locked', 'Guard blocks transition with wrong key');
  guarded.contextData.data.key = 'correct';
  await guarded.send('unlock');
  assert(guarded.state === 'open', 'Guard allows transition with correct key');

  // FSM with entry/exit actions
  let entryCount = 0;
  let exitCount = 0;
  const actionFsm = registry.create('Actions', [
    { id: 'start', label: 'Start', type: 'initial' },
    { id: 'middle', label: 'Middle', entry: async () => { entryCount++; } },
    { id: 'end', label: 'End', type: 'final', exit: async () => { exitCount++; } },
  ], [
    { from: 'start', to: 'middle', event: 'go' },
    { from: 'middle', to: 'end', event: 'finish' },
  ]);
  await actionFsm.send('go');
  assert(entryCount === 1, 'Entry action fires when entering state');
  await actionFsm.send('finish');
  assert(exitCount === 0, 'Exit action fires when leaving state');

  // FSM visualization
  const viz = lifecycle.visualize();
  assert(viz.includes('FSM:'), 'Visualization includes FSM header');
  assert(viz.includes('terminated'), 'Visualization includes current state');
  assert(viz.includes('Transitions:'), 'Visualization includes transitions section');

  // Registry
  const allMachines = registry.getAll();
  assert(allMachines.length >= 3, 'Registry contains all created FSMs');
}

// ============ RUNNER ============

async function runGraphTests() {
  console.log('\n📊 Graph Engine Tests');
  console.log('─────────────────────');

  console.log('\n📍 Level 0: Visual Graph');
  await testVisualGraph();

  console.log('\n📍 Level 1: Execution Graph');
  await testExecutionGraph();

  console.log('\n📍 Level 2: State Graph');
  await testStateGraph();

  console.log(`\n  ────────────────────`);
  console.log(`  ${passed}/${passed + failed} passed, ${failed} failed\n`);
  return { passed, failed };
}

export { runGraphTests };

// Run directly
if (require.main === module) {
  runGraphTests().then(r => process.exit(r.failed > 0 ? 1 : 0));
}