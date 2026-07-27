// COS Test Suite — Core Package
// Tests: types, errors, BaseCell

import { generateId, CellError, BaseCell, EntityId, CellContext, CellOutput } from '../packages/core/src/index.ts';

let passed = 0, failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.log(`  ❌ ${msg}`); }
}

async function testGenerateId() {
  const id1 = generateId();
  const id2 = generateId();
  assert(id1.startsWith('cos_'), 'generateId starts with cos_');
  assert(id1 !== id2, 'generateId produces unique IDs');
  assert(id1.length > 10, 'generateId produces sufficient length');
}

async function testCellError() {
  const err = new CellError('TEST_CODE', 'test message', 'error', { detail: 'context' });
  assert(err.code === 'TEST_CODE', 'CellError has code');
  assert(err.message === 'test message', 'CellError has message');
  assert(err.severity === 'error', 'CellError has severity');
  assert(err.context !== undefined, 'CellError has context');

  const json = err.toJSON();
  assert(json.code === 'TEST_CODE', 'CellError.toJSON has code');
  assert(json.severity === 'error', 'CellError.toJSON has severity');
}

async function testBaseCell() {
  let processed = false;
  const cell = new (class extends BaseCell {
    constructor() {
      super({
        id: 'cos:test:cell' as EntityId,
        name: 'test-cell',
        purpose: 'Unit test cell',
        version: { major: 1, minor: 0, patch: 0 },
        owner: 'test',
        type: 'cognitive',
        policies: [],
        dependencies: [],
        memory: { layers: ['working'], capacity: 256 },
        tools: [],
        reasoningEngines: [],
        executionEngine: 'default',
        permissions: { '*': ['read', 'write'] },
        config: { debug: false },
        documentation: 'Test cell',
      });
    }
    protected async onProcess(input: unknown, ctx: CellContext) {
      processed = true;
      return {
        result: { echo: input, ts: new Date().toISOString() },
        representations: {},
        cost: { units: 'credits', amount: 0.1 },
        confidence: 0.95,
        memoryUpdates: [],
        events: [],
        errors: [],
        metadata: { traceId: ctx.traceId },
      };
    }
  })();

  assert(cell.definition.name === 'test-cell', 'BaseCell stores definition name');
  assert(cell.definition.type === 'cognitive', 'BaseCell stores definition type');
  assert(cell.state.lifecycle === 'created', 'BaseCell starts in created state');

  await cell.init();
  assert(cell.state.lifecycle === 'ready', 'BaseCell transitions to ready after init');

  await cell.start();
  assert(cell.state.lifecycle === 'running', 'BaseCell transitions to running after start');

  const output = await cell.process({ test: 'data' }, { traceId: 'test-001' });
  assert(processed, 'BaseCell.process calls onProcess');
  assert(output.result !== undefined, 'BaseCell.process returns result');
  assert(output.confidence === 0.95, 'BaseCell.process returns correct confidence');
  assert(output.latency >= 0, 'BaseCell.process tracks latency');
  assert(output.errors.length === 0, 'BaseCell.process returns no errors');
  assert(output.metadata.traceId === 'test-001', 'BaseCell.process passes traceId');

  const health = await cell.getHealth();
  assert(health.status === 'healthy' || health.status === 'degraded', 'BaseCell.getHealth returns valid status');

  const metrics = await cell.getMetrics();
  assert(metrics.totalProcessed === 1, 'BaseCell.getMetrics tracks processed count');

  const cost = await cell.getCost();
  assert(cost.amount >= 0, 'BaseCell.getCost returns amount');

  await cell.shutdown();
  assert(cell.state.lifecycle === 'terminated', 'BaseCell transitions to terminated after shutdown');
}

export async function runCoreTests() {
  console.log('\n📦 Core Package Tests');
  console.log('────────────────────');
  await testGenerateId();
  await testCellError();
  await testBaseCell();
  console.log(`  ────────────────────`);
  console.log(`  ${passed}/${passed + failed} passed, ${failed} failed\n`);
  return { passed, failed };
}