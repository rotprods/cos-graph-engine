// COS Graph Engine — L1 Diamond Pattern Test
// Verifies: multi-source convergence, edge routing fix

import { ExecutionGraphEngine } from '../packages/graph/src/index';

let p = 0, f = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { p++; console.log(`  ✅ ${msg}`); }
  else { f++; console.log(`  ❌ ${msg}`); }
}

async function main() {
  console.log('💎 L1 Diamond Pattern Test\n');

  const engine = new ExecutionGraphEngine();

  // Diamond pattern: A → C, A → D, B → C, B → D
  // A and B are roots, C and D need both A and B to complete
  const diamondId = await engine.createGraph('Diamond', [
    { id: 'A', name: 'Source A', type: 'function', fn: async (i) => ({ ...i as any, from: 'A', val: 1 }) },
    { id: 'B', name: 'Source B', type: 'function', fn: async (i) => ({ ...i as any, from: 'B', val: 2 }) },
    { id: 'C', name: 'Merge C', type: 'function', fn: async (i) => ({ ...i as any, merged: 'C' }) },
    { id: 'D', name: 'Merge D', type: 'function', fn: async (i) => ({ ...i as any, merged: 'D' }) },
  ], [
    { source: 'A', target: 'C' },
    { source: 'A', target: 'D' },
    { source: 'B', target: 'C' },
    { source: 'B', target: 'D' },
  ], { maxConcurrency: 4 });

  assert(diamondId.length > 0, 'Diamond: createGraph returns valid ID');

  const results = await engine.executeGraph(diamondId, { seed: 0 });
  assert(results.size === 4, 'Diamond: all 4 nodes executed');

  const allCompleted = Array.from(results.values()).every(r => r.status === 'completed');
  assert(allCompleted, 'Diamond: all nodes completed (no failures, no skips)');

  // A and B must have completed
  assert(results.get('A')?.status === 'completed', 'Diamond: A completed');
  assert(results.get('B')?.status === 'completed', 'Diamond: B completed');
  assert(results.get('C')?.status === 'completed', 'Diamond: C completed');
  assert(results.get('D')?.status === 'completed', 'Diamond: D completed');

  // A and B must have been executed before C and D (deps satisfied)
  const aTime = results.get('A')!.startedAt || '';
  const bTime = results.get('B')!.startedAt || '';
  const cTime = results.get('C')!.startedAt || '';
  const dTime = results.get('D')!.startedAt || '';
  assert(aTime <= cTime, 'Diamond: A runs before C');
  assert(aTime <= dTime, 'Diamond: A runs before D');
  assert(bTime <= cTime, 'Diamond: B runs before C');
  assert(bTime <= dTime, 'Diamond: B runs before D');

  // Verified: edge routing fix works for multi-source convergence

  // Chain pattern: 3 nodes in sequence
  const chainId = await engine.createGraph('Chain', [
    { id: 's1', name: 'Step 1', type: 'function', fn: async (i) => ({ ...i as any, step: 1 }) },
    { id: 's2', name: 'Step 2', type: 'function', fn: async (i) => ({ ...i as any, step: 2 }) },
    { id: 's3', name: 'Step 3', type: 'function', fn: async (i) => ({ ...i as any, step: 3 }) },
  ], [
    { source: 's1', target: 's2' },
    { source: 's2', target: 's3' },
  ]);
  const chainResults = await engine.executeGraph(chainId, { start: true });
  assert(chainResults.size === 3, 'Chain: 3 nodes executed');
  assert(Array.from(chainResults.values()).every(r => r.status === 'completed'), 'Chain: all completed');
  assert((chainResults.get('s3')?.output as any)?.step === 3, 'Chain: data flows through pipeline');

  // Empty graph
  const emptyId = await engine.createGraph('Empty', [], []);
  const emptyResults = await engine.executeGraph(emptyId, {});
  assert(emptyResults.size === 0, 'Empty: executes with 0 nodes');

  // Single node
  const singleId = await engine.createGraph('Single', [
    { id: 'only', name: 'Only Node', type: 'function', fn: async (i) => ({ ...i as any, done: true }) },
  ], []);
  const singleResults = await engine.executeGraph(singleId, { x: 1 });
  assert(singleResults.size === 1, 'Single: 1 node executed');
  assert(singleResults.get('only')?.status === 'completed', 'Single: completed');
  assert((singleResults.get('only')?.output as any)?.done, 'Single: function executed');

  // Disconnected graph (two independent subgraphs)
  const discId = await engine.createGraph('Disconnected', [
    { id: 'a', name: 'A', type: 'function', fn: async (i) => ({ ...i as any, letter: 'A' }) },
    { id: 'b', name: 'B', type: 'function', fn: async (i) => ({ ...i as any, letter: 'B' }) },
    { id: 'c', name: 'C', type: 'function', fn: async (i) => ({ ...i as any, letter: 'C' }) },
  ], [
    { source: 'a', target: 'b' },
    // c is disconnected
  ]);
  const discResults = await engine.executeGraph(discId, {});
  assert(discResults.size === 3, 'Disconnected: all 3 nodes executed');
  assert(discResults.get('a')?.status === 'completed', 'Disconnected: A completed');
  assert(discResults.get('b')?.status === 'completed', 'Disconnected: B completed');
  assert(discResults.get('c')?.status === 'completed', 'Disconnected: C completed (disconnected root)');

  console.log(`\n${p + f} tests, ${p} passed, ${f} failed`);
  if (f === 0) console.log('\n✅✅✅ L1 DIAMOND PATTERN VERIFIED');
  process.exit(f > 0 ? 1 : 0);
}
main();