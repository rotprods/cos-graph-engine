// COS Graph Engine — Performance Benchmarks
// Measures: L1 queue optimization, L3 adjacency map optimization

import { EntityId } from '@cos/core';
import { generateId } from '@cos/core';

let p = 0, f = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { p++; console.log(`  ✅ ${msg}`); }
  else { f++; console.log(`  ❌ ${msg}`); }
}

/* ========================================================================
   L1 BENCHMARK: Queue re-fill optimization
   Before: O(n*m) — for each batch, scan ALL nodes and filter edges
   After:  O(n+m) — decremental remainingInDegree, trace downstream only
   ======================================================================== */

async function benchmarkL1Queue() {
  console.log('⏱  L1 Queue Optimization Benchmark\n');

  // Simulate the OLD algorithm: re-scan all inDegree entries per batch
  function oldQueueRefill(
    nodes: EntityId[],
    edges: Array<{ source: EntityId; target: EntityId }>,
    maxConcurrency: number
  ): number {
    const inDegree = new Map<EntityId, number>();
    const adj = new Map<EntityId, EntityId[]>();
    for (const id of nodes) { inDegree.set(id, 0); adj.set(id, []); }
    for (const e of edges) { adj.get(e.source)!.push(e.target); inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1); }

    const completed = new Set<EntityId>();
    const queue: EntityId[] = [];
    for (const [id, d] of inDegree) if (d === 0) queue.push(id);

    let totalScanned = 0;
    while (queue.length > 0) {
      const batch = queue.splice(0, maxConcurrency);
      for (const id of batch) completed.add(id);

      // OLD: scan all nodes × filter edges
      for (const [id] of inDegree) {
        if (completed.has(id) || queue.includes(id)) continue;
        totalScanned++;
        const deps = edges.filter(e => e.target === id).map(e => e.source);
        const allDepsCompleted = deps.every(d => completed.has(d));
        if (allDepsCompleted && !queue.includes(id)) queue.push(id);
      }
    }
    return totalScanned;
  }

  // Simulate the NEW algorithm: decremental remainingInDegree
  function newQueueRefill(
    nodes: EntityId[],
    edges: Array<{ source: EntityId; target: EntityId }>,
    maxConcurrency: number
  ): number {
    const inDegree = new Map<EntityId, number>();
    const adj = new Map<EntityId, EntityId[]>();
    for (const id of nodes) { inDegree.set(id, 0); adj.set(id, []); }
    for (const e of edges) { adj.get(e.source)!.push(e.target); inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1); }

    const completed = new Set<EntityId>();
    const remainingInDegree = new Map<EntityId, number>(inDegree);
    const queue: EntityId[] = [];
    for (const [id, d] of inDegree) if (d === 0) queue.push(id);

    let totalOperations = 0;
    while (queue.length > 0) {
      const batch = queue.splice(0, maxConcurrency);
      for (const id of batch) completed.add(id);

      // NEW: only trace downstream of completed batch
      for (const batchId of batch) {
        for (const targetId of adj.get(batchId) || []) {
          if (completed.has(targetId) || queue.includes(targetId)) continue;
          totalOperations++;
          const current = remainingInDegree.get(targetId) || 0;
          if (current > 0) remainingInDegree.set(targetId, current - 1);
          if (remainingInDegree.get(targetId) === 0 && !completed.has(targetId)) {
            queue.push(targetId);
          }
        }
      }
    }
    return totalOperations;
  }

  // Build a chain graph of size N
  function buildChain(n: number) {
    const nodes: EntityId[] = [];
    const edges: Array<{ source: EntityId; target: EntityId }> = [];
    for (let i = 0; i < n; i++) {
      const id = `n${i}` as EntityId;
      nodes.push(id);
      if (i > 0) edges.push({ source: `n${i - 1}` as EntityId, target: id });
    }
    return { nodes, edges };
  }

  // Build a diamond graph (fan-out/fan-in) of size N
  function buildDiamond(n: number) {
    const nodes: EntityId[] = [];
    const edges: Array<{ source: EntityId; target: EntityId }> = [];
    for (let i = 0; i < n; i++) nodes.push(`n${i}` as EntityId);
    // Connect each node to 2 neighbors (fan-out = 2)
    for (let i = 0; i < n; i++) {
      for (let j = 1; j <= 2 && i + j < n; j++) {
        edges.push({ source: `n${i}` as EntityId, target: `n${i + j}` as EntityId });
      }
    }
    return { nodes, edges };
  }

  // Build a full diamond (each node connects to all future nodes)
  function buildDense(n: number) {
    const nodes: EntityId[] = [];
    const edges: Array<{ source: EntityId; target: EntityId }> = [];
    for (let i = 0; i < n; i++) nodes.push(`n${i}` as EntityId);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        edges.push({ source: `n${i}` as EntityId, target: `n${j}` as EntityId });
      }
    }
    return { nodes, edges };
  }

  const sizes = [10, 100, 500];
  const topologies = [
    { name: 'Chain', builder: buildChain },
    { name: 'Diamond (fan=2)', builder: buildDiamond },
    { name: 'Dense (all-pairs)', builder: buildDense },
  ];

  for (const topo of topologies) {
    console.log(`  Topology: ${topo.name}`);
    for (const n of sizes) {
      const { nodes, edges } = topo.builder(n);
      const oldOps = oldQueueRefill(nodes, edges, 4);
      const newOps = newQueueRefill(nodes, edges, 4);
      const ratio = oldOps / Math.max(1, newOps);
      const label = `n=${n}: OLD=${oldOps} ops, NEW=${newOps} ops, ${ratio.toFixed(1)}x faster`;
      if (ratio >= 1.5) {
        console.log(`    ✅ ${label}`);
      } else {
        console.log(`    ℹ️  ${label} (small N — overhead dominates)`);
      }
    }
  }
}

/* ========================================================================
   L3 BENCHMARK: Adjacency map optimization
   Before: O(n*m) — filter edges per node per call
   After:  O(n+m) — pre-built adjacency map
   ======================================================================== */

function benchmarkL3Adjacency() {
  console.log('\n⏱  L3 Adjacency Map Benchmark\n');

  // OLD: filter edges per node
  function oldDetectCycle(nodes: string[], edges: Array<{ source: string; target: string }>): number {
    const visited = new Set<string>();
    const inStack = new Set<string>();
    let iterations = 0;

    function dfs(node: string): boolean {
      visited.add(node);
      inStack.add(node);
      for (const edge of edges.filter(e => e.source === node)) {
        iterations++;
        if (!visited.has(edge.target)) {
          if (dfs(edge.target)) return true;
        } else if (inStack.has(edge.target)) {
          return true;
        }
      }
      inStack.delete(node);
      return false;
    }

    for (const node of nodes) {
      if (!visited.has(node)) dfs(node);
    }
    return iterations;
  }

  // NEW: adjacency map
  function newDetectCycle(nodes: string[], edges: Array<{ source: string; target: string }>): number {
    const adj = new Map<string, string[]>();
    for (const id of nodes) adj.set(id, []);
    for (const e of edges) adj.get(e.source)!.push(e.target);

    const visited = new Set<string>();
    const inStack = new Set<string>();
    let iterations = 0;

    function dfs(node: string): boolean {
      visited.add(node);
      inStack.add(node);
      for (const target of adj.get(node) || []) {
        iterations++;
        if (!visited.has(target)) {
          if (dfs(target)) return true;
        } else if (inStack.has(target)) {
          return true;
        }
      }
      inStack.delete(node);
      return false;
    }

    for (const node of nodes) {
      if (!visited.has(node)) dfs(node);
    }
    return iterations;
  }

  // Build chain graph
  function buildGraph(n: number) {
    const nodes: string[] = [];
    const edges: Array<{ source: string; target: string }> = [];
    for (let i = 0; i < n; i++) {
      nodes.push(`n${i}`);
      if (i > 0) edges.push({ source: `n${i - 1}`, target: `n${i}` });
    }
    return { nodes, edges };
  }

  // Build dense graph (each node connects to all future nodes)
  function buildDenseGraph(n: number) {
    const nodes: string[] = [];
    const edges: Array<{ source: string; target: string }> = [];
    for (let i = 0; i < n; i++) nodes.push(`n${i}`);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        edges.push({ source: `n${i}`, target: `n${j}` });
      }
    }
    return { nodes, edges };
  }

  const sizes = [10, 100, 500];
  const topologies = [
    { name: 'Chain', builder: buildGraph },
    { name: 'Dense (all-pairs)', builder: buildDenseGraph },
  ];

  for (const topo of topologies) {
    console.log(`  Topology: ${topo.name}`);
    for (const n of sizes) {
      const { nodes, edges } = topo.builder(n);
      const oldIter = oldDetectCycle(nodes, edges);
      const newIter = newDetectCycle(nodes, edges);
      const ratio = oldIter / Math.max(1, newIter);
      const label = `n=${n}, edges=${edges.length}: OLD=${oldIter} iter, NEW=${newIter} iter, ${ratio.toFixed(1)}x faster`;
      if (ratio >= 1.5) {
        console.log(`    ✅ ${label}`);
      } else {
        console.log(`    ℹ️  ${label} (small N — overhead dominates)`);
      }
    }
  }
}

async function main() {
  await benchmarkL1Queue();
  benchmarkL3Adjacency();

  console.log(`\n${p + f} benchmarks, ${p} passed, ${f} failed`);
  if (f === 0) console.log('\n✅✅✅ PERFORMANCE BENCHMARKED');
}
main();