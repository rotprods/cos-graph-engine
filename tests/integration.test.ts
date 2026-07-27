// COS Test Suite — Integration Tests
// Tests: full system end-to-end

import { COSServer } from '../packages/api/src/index.ts';
import { BaseCell, EntityId, CellContext } from '../packages/core/src/index.ts';

let passed = 0, failed = 0;
function assert(c: boolean, m: string) { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.log(`  ❌ ${m}`); } }

async function testFullSystem() {
  const server = new COSServer({ port: 0, logLevel: 'silent' });

  // 1. Register a cell
  const cell = new (class extends BaseCell {
    constructor() {
      super({
        id: 'cos:int:test' as EntityId, name: 'integration-test', purpose: 'Integration test',
        version: { major: 1, minor: 0, patch: 0 }, owner: 'cos', type: 'cognitive',
        policies: [], dependencies: [],
        memory: { layers: ['working', 'short_term'], capacity: 256 },
        tools: ['filesystem'], reasoningEngines: ['chain_of_thought'],
        executionEngine: 'default', permissions: { '*': ['read', 'write', 'execute'] },
        config: {}, documentation: '',
      });
    }
    protected async onProcess(input: any, ctx: any) {
      return { result: { echo: input }, representations: {}, cost: { units: 'credits', amount: 0.1 },
        confidence: 0.9, memoryUpdates: [], events: [], errors: [], metadata: { traceId: ctx.traceId } };
    }
  })();
  await server.cellHost.register(cell);
  assert(true, 'COSSERVER.cellHost.register works');

  // 2. Process through cell
  const output = await server.process({ input: 'integration test', target: cell.definition.id, context: { traceId: 'int-1' } });
  assert(output.result !== undefined, 'COSSERVER.process returns result');
  assert(output.confidence > 0, 'COSSERVER.process returns confidence');
  assert(output.errors.length === 0, 'COSSERVER.process returns no errors');
  assert(output.latency >= 0, 'COSSERVER.process tracks latency');

  // 3. Reasoning
  const reasoning = await server.process({ input: { problem: 'test', steps: 2 }, reasoning: 'chain_of_thought', context: { traceId: 'int-2' } });
  assert(reasoning.result !== undefined, 'COSSERVER.process with reasoning works');

  // 4. Memory
  const memId = await server.memory.store('integration data', 'semantic', { tags: ['int'], importance: 0.9 });
  const memBack = await server.memory.retrieve(memId);
  assert(memBack !== null, 'COSSERVER.memory.store/retrieve works');
  assert(memBack!.content === 'integration data', 'COSSERVER.memory preserves content');

  // 5. Knowledge Graph
  await server.knowledge.addStatement({ subject: 'COS', predicate: 'tested', object: 'true', confidence: 1, source: 'int' as EntityId, metadata: {}, embedding: undefined });
  const kg = await server.knowledge.query('COS');
  assert(kg.length >= 1, 'COSSERVER.knowledge works');

  // 6. Embeddings
  const vec = server.embeddings.textToEmbedding('test');
  await server.embeddings.store('int-concept' as EntityId, vec, 'concept');
  const search = await server.embeddings.search(vec, { limit: 5 });
  assert(search.length >= 1, 'COSSERVER.embeddings works');

  // 7. Ontology
  await server.ontology.defineClass('TestClass', 'test', null, []);
  assert(server.ontology.classCount >= 1, 'COSSERVER.ontology works');

  // 8. Policy
  await server.policies.addRule({ id: 'pol:int' as EntityId, name: 'int-allow', description: '', effect: 'allow', actions: ['*'], resources: ['*'], conditions: [], priority: 0, enabled: true });
  const decision = await server.policies.evaluate('read', 'memory', { traceId: 'int-3' });
  assert(decision.allowed, 'COSSERVER.policies evaluate works');

  // 9. Self-Improvement
  for (let i = 0; i < 3; i++) await server.selfImprovement.recordOutput({ q: 'int-' + i }, { r: 'res-' + i });
  const report = await server.selfImprovement.runMetaCognition(true);
  assert(report.totalEvaluations >= 1, 'COSSERVER.selfImprovement works');
  assert(report.scoreTrend !== undefined, 'COSSERVER.selfImprovement returns trend');

  // 10. LLM
  const llmResponse = await server.llm.get().generate({ messages: [{ role: 'user', content: 'test' }] });
  assert(llmResponse.content.length > 0, 'COSSERVER.llm works');
  assert(llmResponse.usage.totalTokens > 0, 'COSSERVER.llm tracks usage');

  // 11. Autonomous Loop
  const goal = await server.createGoal('Integration test goal', { traceId: 'int-4' });
  assert(goal.plan.length >= 1, 'COSSERVER.autonomousLoop creates plan');
  await server.executeGoal(goal.id);
  const completed = await server.getCompletedGoals();
  assert(completed.length >= 1, 'COSSERVER.autonomousLoop executes goal');

  // 12. Health
  const health = await server.getHealth();
  assert(health.system !== undefined, 'COSSERVER.getHealth returns system health');
  assert(health.system!.metrics !== undefined, 'COSSERVER.getHealth returns metrics');

  // 13. Stats
  const stats = await server.getStats();
  assert(stats.runtime !== undefined, 'COSSERVER.getStats returns runtime stats');
  assert(stats.memory !== undefined, 'COSSERVER.getStats returns memory stats');
  assert(stats.reasoning >= 5, 'COSSERVER.getStats returns reasoning count');
  assert(stats.tools >= 3, 'COSSERVER.getStats returns tool count');
}

export async function runIntegrationTests() {
  console.log('\n🔗 Integration Tests');
  console.log('────────────────────');
  await testFullSystem();
  console.log(`  ────────────────────`);
  console.log(`  ${passed}/${passed + failed} passed, ${failed} failed\n`);
  return { passed, failed };
}