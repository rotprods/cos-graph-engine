// COS Graph Engine — L7 Computational Graph Test
// Verifies: forward values, backward gradients, expression, MLP

import { ComputationalGraph } from '../packages/graph/src/level7-compute';

let p = 0, f = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { p++; console.log(`  ✅ ${msg}`); }
  else { f++; console.log(`  ❌ ${msg}`); }
}

async function main() {
  console.log('🧮 L7 Computational Graph Test\n');

  // ============ TEST 1: Empty Graph ============
  const empty = new ComputationalGraph();
  const emptyForward = empty.forward({});
  assert(typeof emptyForward === 'number', 'Empty: forward returns number');
  const emptyGrads = empty.backward();
  assert(emptyGrads.size >= 0, 'Empty: backward returns map');

  // ============ TEST 2: buildExpression ============
  // z = (x * y) + (w * v) = 2*3 + 4*5 = 6 + 20 = 26
  const expr = new ComputationalGraph();
  expr.buildExpression();
  assert(expr.nodes.length === 7, 'Expression: 7 nodes (x, y, w, v, t1, t2, z)');
  assert(expr.edges.length === 6, 'Expression: 6 edges');

  const z = expr.forward({});
  assert(z === 26, `Expression: z = 2*3 + 4*5 = 26 (got ${z})`);

  // Verify intermediate values
  assert(expr['values'].get('x') === 2, 'Expression: x = 2');
  assert(expr['values'].get('y') === 3, 'Expression: y = 3');
  assert(expr['values'].get('w') === 4, 'Expression: w = 4');
  assert(expr['values'].get('v') === 5, 'Expression: v = 5');
  assert(expr['values'].get('t1') === 6, 'Expression: t1 = x*y = 6');
  assert(expr['values'].get('t2') === 20, 'Expression: t2 = w*v = 20');
  assert(expr['values'].get('z') === 26, 'Expression: z = t1 + t2 = 26');

  // Backward: analytical gradients of z = x*y + w*v
  // dz/dx = y = 3, dz/dy = x = 2
  // dz/dw = v = 5, dz/dv = w = 4
  const grads = expr.backward();
  assert(grads.get('z') === 1, 'Expression: dz/dz = 1');
  assert(grads.get('x') === 3, `Expression: dz/dx = y = 3 (got ${grads.get('x')})`);
  assert(grads.get('y') === 2, `Expression: dz/dy = x = 2 (got ${grads.get('y')})`);
  assert(grads.get('w') === 5, `Expression: dz/dw = v = 5 (got ${grads.get('w')})`);
  assert(grads.get('v') === 4, `Expression: dz/dv = w = 4 (got ${grads.get('v')})`);
  assert(grads.get('t1') === 1, 'Expression: dz/dt1 = 1');
  assert(grads.get('t2') === 1, 'Expression: dz/dt2 = 1');

  // ============ TEST 3: buildMLP ============
  // Structure: x → matmul(w1) + b1 → relu → matmul(w2) → logit0 → cross_entropy
  //                                                            logit1 ↗
  // x=1, w1=0.5, b1=0.1, w2=0.3, logit1=0.05
  // fc1 = x * w1 = 0.5
  // h1 = fc1 + b1 = 0.6
  // r1 = relu(0.6) = 0.6
  // fc2 = r1 * w2 = 0.18
  // logit0 = fc2 = 0.18 (add with 1 input = identity)
  // loss = cross_entropy([0.18, 0.05]) = -log(exp(0.18)/(exp(0.18)+exp(0.05)))
  const mlp = new ComputationalGraph();
  mlp.buildMLP();
  assert(mlp.nodes.length === 11, 'MLP: 11 nodes (x, w1, b1, w2, logit1, fc1, h1, r1, fc2, logit0, loss)');
  assert(mlp.edges.length === 10, 'MLP: 10 edges');

  const forwardInput = { x: 1 };
  const loss = mlp.forward(forwardInput);
  assert(typeof loss === 'number' && loss > 0, `MLP: forward returns positive loss (got ${loss})`);

  // Verify leaf values
  assert(mlp['values'].get('x') === 1, 'MLP: x = 1');
  assert(mlp['values'].get('w1') === 0.5, 'MLP: w1 = 0.5');
  assert(mlp['values'].get('b1') === 0.1, 'MLP: b1 = 0.1');
  assert(mlp['values'].get('w2') === 0.3, 'MLP: w2 = 0.3');
  assert(mlp['values'].get('logit1') === 0.05, 'MLP: logit1 = 0.05');

  // Verify intermediate values
  assert(mlp['values'].get('fc1') === 0.5, 'MLP: fc1 = x * w1 = 0.5');
  assert(mlp['values'].get('h1') === 0.6, 'MLP: h1 = fc1 + b1 = 0.6');
  assert(mlp['values'].get('r1') === 0.6, 'MLP: r1 = relu(0.6) = 0.6');
  assert(mlp['values'].get('fc2') === 0.18, 'MLP: fc2 = r1 * w2 = 0.18');
  assert(mlp['values'].get('logit0') === 0.18, 'MLP: logit0 = fc2 = 0.18');

  // Cross_entropy([0.18, 0.05]) = -log(softmax[0])
  // softmax[0] = exp(0.18) / (exp(0.18) + exp(0.05))
  const expectedLoss = -Math.log(Math.exp(0.18) / (Math.exp(0.18) + Math.exp(0.05)));
  assert(Math.abs(loss - expectedLoss) < 1e-10, `MLP: loss = ${expectedLoss.toFixed(4)} (got ${loss})`);

  // Backward: verify gradients are non-zero (2 logits → meaningful gradient flow)
  const mlpGrads = mlp.backward();
  assert(mlpGrads.size > 0, 'MLP: backward computes gradients');
  assert(mlpGrads.get('loss') === 1.0, 'MLP: d(loss)/d(loss) = 1');
  // With 2 logits, both logit0 and logit1 have non-zero gradients
  assert(mlpGrads.get('logit0') !== undefined && Math.abs(mlpGrads.get('logit0')!) > 0,
    `MLP: logit0 has non-zero gradient (got ${mlpGrads.get('logit0')})`);
  assert(mlpGrads.get('logit1') !== undefined && Math.abs(mlpGrads.get('logit1')!) > 0,
    `MLP: logit1 has non-zero gradient (got ${mlpGrads.get('logit1')})`);
  // Parameters should have non-zero gradients
  assert(mlpGrads.get('w1') !== undefined && Math.abs(mlpGrads.get('w1')!) > 0,
    `MLP: w1 has non-zero gradient (got ${mlpGrads.get('w1')})`);
  assert(mlpGrads.get('w2') !== undefined && Math.abs(mlpGrads.get('w2')!) > 0,
    `MLP: w2 has non-zero gradient (got ${mlpGrads.get('w2')})`);

  // ============ TEST 4: Mermaid ============
  const mermaid = mlp.toMermaid();
  assert(mermaid.includes('graph TD'), 'MLP: Mermaid output starts with graph TD');
  assert(mermaid.includes('fc1'), 'MLP: Mermaid includes fc1');
  assert(mermaid.includes('loss'), 'MLP: Mermaid includes loss');
  assert(mermaid.includes('-->'), 'MLP: Mermaid includes edges');

  // ============ TEST 5: paramCount ============
  assert(mlp.paramCount() === 4, 'MLP: 4 trainable params (w1, b1, w2, logit1)');

  // ============ TEST 6: Topological Sort ============
  const order = mlp.topologicalSort();
  assert(order.length === 11, 'MLP: topological sort returns all 11 nodes');
  // Leaves before operations
  const xIdx = order.indexOf('x');
  const w1Idx = order.indexOf('w1');
  const b1Idx = order.indexOf('b1');
  const w2Idx = order.indexOf('w2');
  const logit1Idx = order.indexOf('logit1');
  const fc1Idx = order.indexOf('fc1');
  const h1Idx = order.indexOf('h1');
  const r1Idx = order.indexOf('r1');
  const fc2Idx = order.indexOf('fc2');
  const logit0Idx = order.indexOf('logit0');
  const lossIdx = order.indexOf('loss');
  assert(xIdx < fc1Idx, 'TSort: x before fc1');
  assert(w1Idx < fc1Idx, 'TSort: w1 before fc1');
  assert(fc1Idx < h1Idx, 'TSort: fc1 before h1');
  assert(b1Idx < h1Idx, 'TSort: b1 before h1');
  assert(h1Idx < r1Idx, 'TSort: h1 before r1');
  assert(r1Idx < fc2Idx, 'TSort: r1 before fc2');
  assert(w2Idx < fc2Idx, 'TSort: w2 before fc2');
  assert(fc2Idx < logit0Idx, 'TSort: fc2 before logit0');
  assert(logit0Idx < lossIdx, 'TSort: logit0 before loss');
  assert(logit1Idx < lossIdx, 'TSort: logit1 before loss (leaf)');

  // ============ TEST 7: Serialization (toJSON/fromJSON) ============
  const json = mlp.toJSON();
  assert(json.nodes.length === 11, 'Serialization: toJSON preserves 11 nodes');
  assert(json.edges.length === 10, 'Serialization: toJSON preserves 10 edges');
  const restored = ComputationalGraph.fromJSON(json);
  assert(restored.nodes.length === 11, 'Serialization: fromJSON restores 11 nodes');
  assert(restored.edges.length === 10, 'Serialization: fromJSON restores 10 edges');
  // Forward pass on restored graph should match
  const restoredLoss = restored.forward({ x: 1 });
  assert(Math.abs(restoredLoss - loss) < 1e-10, 'Serialization: restored graph produces same loss');

  // ============ TEST 8: backward() no longer takes lossValue param ============
  // Verify the new signature: backward() without arguments
  const mlp2 = new ComputationalGraph();
  mlp2.buildMLP();
  mlp2.forward({ x: 1 });
  const grads2 = mlp2.backward();
  assert(grads2.get('loss') === 1.0, 'Backward: seed is always 1.0 (lossValue removed)');

  console.log(`\n${p + f} tests, ${p} passed, ${f} failed`);
  if (f === 0) console.log('\n✅✅✅ L7 COMPUTATIONAL GRAPH VERIFIED');
  process.exit(f > 0 ? 1 : 0);
}
main();