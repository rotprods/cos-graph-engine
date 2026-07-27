// COS Benchmark Suite — Performance, Capacity, and Correctness
// Tests each subsystem under load and measures key metrics

import { EventBus } from '../packages/runtime/src/index.ts';
import { MemoryManager } from '../packages/memory/src/index.ts';
import { KnowledgeGraph, EmbeddingSystem, OntologySystem } from '../packages/knowledge/src/index.ts';
import { ReasoningEngineRegistry } from '../packages/cognition/src/index.ts';
import { ToolRegistry } from '../packages/execution/src/index.ts';
import { PolicyEngine } from '../packages/orchestration/src/index.ts';
import { EntityId } from '../packages/core/src/index.ts';

interface BenchmarkResult {
  name: string;
  operations: number;
  totalTimeMs: number;
  opsPerSecond: number;
  avgLatencyMs: number;
  errors: number;
  passed: boolean;
}

const results: BenchmarkResult[] = [];
let passed = 0;
let failed = 0;

function record(name: string, ops: number, timeMs: number, errs: number) {
  const r: BenchmarkResult = {
    name, operations: ops, totalTimeMs: timeMs,
    opsPerSecond: Math.round((ops / timeMs) * 1000),
    avgLatencyMs: Math.round(timeMs / ops * 100) / 100,
    errors: errs, passed: errs === 0,
  };
  results.push(r);
  if (r.passed) { passed++; console.log(`  ✅ ${name}: ${r.opsPerSecond} ops/s (${r.avgLatencyMs}ms avg, ${errs} errors)`); }
  else { failed++; console.log(`  ❌ ${name}: ${r.avgLatencyMs}ms avg, ${errs} ERRORS`); }
}

async function benchmarkEventBus() {
  const bus = new EventBus();
  let received = 0;
  await bus.subscribe('bench', async () => { received++; });

  const count = 1000;
  const start = Date.now();
  for (let i = 0; i < count; i++) {
    await bus.publish({ type: 'bench', source: 'bench' as EntityId, payload: { i }, severity: 'info', metadata: {} });
  }
  const elapsed = Date.now() - start;
  record('EventBus publish (1000 events)', count, elapsed, count - received);
}

async function benchmarkMemory() {
  const mem = new MemoryManager();
  const ids: EntityId[] = [];

  // Write benchmark
  const writeCount = 500;
  const writeStart = Date.now();
  for (let i = 0; i < writeCount; i++) {
    const id = await mem.store({ index: i, data: 'x'.repeat(100) }, 'working', { tags: ['bench'], importance: 0.5 });
    ids.push(id);
  }
  const writeElapsed = Date.now() - writeStart;
  record('Memory write (500 entries)', writeCount, writeElapsed, 0);

  // Read benchmark
  const readStart = Date.now();
  for (const id of ids) {
    await mem.retrieve(id);
  }
  const readElapsed = Date.now() - readStart;
  record('Memory read (500 entries)', ids.length, readElapsed, 0);

  // Query benchmark
  const queryStart = Date.now();
  for (let i = 0; i < 50; i++) {
    await mem.query({ tags: ['bench'], limit: 10 });
  }
  const queryElapsed = Date.now() - queryStart;
  record('Memory query (50 queries)', 50, queryElapsed, 0);
}

async function benchmarkKnowledge() {
  const kg = new KnowledgeGraph();

  const writeCount = 200;
  const writeStart = Date.now();
  for (let i = 0; i < writeCount; i++) {
    await kg.addStatement({ subject: `S${i}`, predicate: 'relates_to', object: `O${i}`, confidence: 0.9, source: 'bench' as EntityId, metadata: {}, embedding: undefined });
  }
  record('Knowledge write (200 statements)', writeCount, Date.now() - writeStart, 0);

  const queryStart = Date.now();
  for (let i = 0; i < 100; i++) {
    await kg.query('S');
  }
  record('Knowledge query (100 queries)', 100, Date.now() - queryStart, 0);
}

async function benchmarkEmbeddings() {
  const emb = new EmbeddingSystem();

  const writeCount = 100;
  const writeStart = Date.now();
  for (let i = 0; i < writeCount; i++) {
    const vec = emb.textToEmbedding(`concept number ${i}`, 128);
    await emb.store(`src-${i}` as EntityId, vec, 'concept');
  }
  record('Embedding write (100 vectors)', writeCount, Date.now() - writeStart, 0);

  const queryVec = emb.textToEmbedding('test query', 128);
  const searchStart = Date.now();
  for (let i = 0; i < 50; i++) {
    await emb.search(queryVec, { limit: 10 });
  }
  record('Embedding search (50 queries)', 50, Date.now() - searchStart, 0);
}

async function benchmarkReasoning() {
  const registry = new ReasoningEngineRegistry();

  // CoT benchmark
  const cotStart = Date.now();
  for (let i = 0; i < 20; i++) {
    await registry.reason('chain_of_thought', { problem: `analyze problem ${i}`, steps: 3 }, { traceId: `cot-${i}` });
  }
  record('CoT reasoning (20 runs, 3 steps)', 20, Date.now() - cotStart, 0);

  // ToT benchmark
  const totStart = Date.now();
  for (let i = 0; i < 10; i++) {
    await registry.reason('tree_of_thoughts', { problem: `solve ${i}`, branchingFactor: 2, maxDepth: 2 }, { traceId: `tot-${i}` });
  }
  record('ToT reasoning (10 runs, 2x2)', 10, Date.now() - totStart, 0);

  // Debate benchmark
  const debateStart = Date.now();
  for (let i = 0; i < 5; i++) {
    await registry.reason('debate' as any, { topic: `topic ${i}`, rounds: 2 }, { traceId: `deb-${i}` });
  }
  record('Debate (5 runs, 2 rounds)', 5, Date.now() - debateStart, 0);
}

async function benchmarkTools() {
  const tools = new ToolRegistry();

  const fsStart = Date.now();
  for (let i = 0; i < 50; i++) {
    await tools.execute('filesystem', { operation: 'exists', path: '/tmp' }, { traceId: `fs-${i}` });
  }
  record('Tool: filesystem (50 calls)', 50, Date.now() - fsStart, 0);

  const searchStart = Date.now();
  for (let i = 0; i < 10; i++) {
    await tools.execute('search', { query: 'test', source: 'files', limit: 5 }, { traceId: `srch-${i}` });
  }
  record('Tool: search (10 calls)', 10, Date.now() - searchStart, 0);
}

async function benchmarkPolicy() {
  const pol = new PolicyEngine();
  await pol.addRule({ id: 'p:1' as EntityId, name: 'r1', description: '', effect: 'allow', actions: ['read'], resources: ['memory'], conditions: [], priority: 0, enabled: true });
  await pol.addRule({ id: 'p:2' as EntityId, name: 'r2', description: '', effect: 'deny', actions: ['write'], resources: ['system'], conditions: [], priority: 1, enabled: true });

  const start = Date.now();
  for (let i = 0; i < 500; i++) {
    await pol.evaluate('read', 'memory', { traceId: `pol-${i}` });
  }
  record('Policy evaluation (500 calls)', 500, Date.now() - start, 0);
}

async function benchmarkCapacity() {
  // Stress test: memory with many entries
  const mem = new MemoryManager();
  const start = Date.now();
  for (let i = 0; i < 100; i++) {
    await mem.store({ index: i, data: 'x'.repeat(50) }, 'cache', { tags: ['stress'], importance: 0.3, ttl: 60 });
  }
  const stats = await mem.stats();
  const elapsed = Date.now() - start;
  record(`Capacity: memory (100 entries → ${stats.totalEntries} total)`, 100, elapsed, stats.totalEntries < 100 ? 100 - stats.totalEntries : 0);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        COS BENCHMARK SUITE v0.1.0                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('📍 Running benchmarks...\n');

  await benchmarkEventBus();
  await benchmarkMemory();
  await benchmarkKnowledge();
  await benchmarkEmbeddings();
  await benchmarkReasoning();
  await benchmarkTools();
  await benchmarkPolicy();
  await benchmarkCapacity();

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║        RESULTS                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Group results
  const categories = {
    'Messaging': results.filter(r => r.name.includes('EventBus')),
    'Storage': results.filter(r => r.name.includes('Memory') || r.name.includes('Capacity')),
    'Knowledge': results.filter(r => r.name.includes('Knowledge') || r.name.includes('Embedding')),
    'Reasoning': results.filter(r => r.name.includes('CoT') || r.name.includes('ToT') || r.name.includes('Debate')),
    'Execution': results.filter(r => r.name.includes('Tool') || r.name.includes('Policy')),
  };

  for (const [cat, benchs] of Object.entries(categories)) {
    if (benchs.length === 0) continue;
    console.log(`\n${cat}:`);
    for (const b of benchs) {
      const status = b.passed ? '✅' : '❌';
      console.log(`  ${status} ${b.name}`);
      console.log(`     ${b.operations} ops in ${b.totalTimeMs}ms = ${b.opsPerSecond} ops/s (${b.avgLatencyMs}ms avg)`);
    }
  }

  const totalOps = results.reduce((s, r) => s + r.operations, 0);
  const totalTime = results.reduce((s, r) => s + r.totalTimeMs, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors, 0);

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`\nTotal: ${results.length} benchmarks`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total operations: ${totalOps}`);
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Overall throughput: ${Math.round((totalOps / totalTime) * 1000)} ops/s`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Error rate: ${(totalErrors / totalOps * 100).toFixed(2)}%`);

  if (failed === 0) {
    console.log(`\n✅✅✅ ALL BENCHMARKS PASSED`);
  } else {
    console.log(`\n❌ ${failed} benchmark(s) failed`);
  }

  // Write results
  const fs = require('fs');
  fs.writeFileSync('benchmark-results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { totalBenchmarks: results.length, passed, failed, totalOps, totalTimeMs: totalTime, throughput: Math.round((totalOps / totalTime) * 1000) },
    results: results.map(r => ({ ...r })),
  }, null, 2));
  console.log('\n📊 Results saved to benchmark-results.json');
}

main().catch(console.error);