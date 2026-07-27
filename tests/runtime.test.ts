// COS Test Suite — Runtime Package
// Tests: EventBus, Scheduler, StateManager, CellHost

import { EventBus, StateManager, CellHost, Scheduler } from '../packages/runtime/src/index.ts';
import { BaseCell, EntityId, CellContext, CogEvent } from '../packages/core/src/index.ts';

let passed = 0, failed = 0;
function assert(c: boolean, m: string) { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.log(`  ❌ ${m}`); } }

async function testEventBus() {
  const bus = new EventBus();
  assert(bus.subscriberCount === 0, 'EventBus starts with 0 subscribers');

  let received: CogEvent | null = null;
  const subId = await bus.subscribe('test.event', async (e) => { received = e; });
  assert(bus.subscriberCount === 1, 'EventBus subscribe increases count');

  await bus.publish({ type: 'test.event', source: 'test' as EntityId, payload: { msg: 'hello' }, severity: 'info', metadata: {} });
  assert(received !== null, 'EventBus delivers event to subscriber');
  assert(received!.type === 'test.event', 'EventBus preserves event type');
  assert((received!.payload as any).msg === 'hello', 'EventBus preserves event payload');

  await bus.unsubscribe(subId);
  assert(bus.subscriberCount === 0, 'EventBus unsubscribe decreases count');

  // Wildcard test
  let wildcardReceived = false;
  await bus.subscribe('*', async (e) => { if (e.type === 'wildcard.test') wildcardReceived = true; });
  await bus.publish({ type: 'wildcard.test', source: 'test' as EntityId, payload: {}, severity: 'info', metadata: {} });
  assert(wildcardReceived, 'EventBus wildcard * receives all events');

  // History test
  const history = await bus.getHistory('test.event');
  assert(history.length > 0, 'EventBus stores history');
}

async function testStateManager() {
  const state = new StateManager();
  assert(state.size === 0, 'StateManager starts empty');

  state.set('entity:1' as EntityId, { name: 'test', count: 42 });
  assert(state.size === 1, 'StateManager.set stores state');
  assert(state.get('entity:1')?.count === 42, 'StateManager.get retrieves state');

  state.update('entity:1' as EntityId, { count: 43 });
  assert(state.get('entity:1')?.count === 43, 'StateManager.update modifies state');
  assert(state.get('entity:1')?.name === 'test', 'StateManager.update preserves other fields');

  state.set('entity:2' as EntityId, { value: true });
  assert(state.size === 2, 'StateManager stores multiple entities');

  state.delete('entity:2' as EntityId);
  assert(state.size === 1, 'StateManager.delete removes entity');
  assert(state.get('entity:2') === undefined, 'StateManager.delete clears value');

  const history = state.getHistory('entity:1' as EntityId);
  assert(history.length > 0, 'StateManager maintains history');
}

async function testScheduler() {
  const executed: string[] = [];
  const scheduler = new Scheduler(async (task) => {
    executed.push(task.id);
    return { id: task.id, result: 'ok', representations: {}, cost: { units: 'credits', amount: 0 }, latency: 0, confidence: 1, memoryUpdates: [], events: [], errors: [], metadata: {} };
  }, { maxConcurrency: 2, pollingInterval: 50 });

  const id1 = await scheduler.enqueue({ type: 'test', priority: 1, target: 'cell:1' as EntityId, input: {}, context: { traceId: 't1' }, dependencies: [], maxRetries: 1, timeout: 5000, policies: [] });
  const id2 = await scheduler.enqueue({ type: 'test', priority: 2, target: 'cell:2' as EntityId, input: {}, context: { traceId: 't2' }, dependencies: [], maxRetries: 1, timeout: 5000, policies: [] });

  assert(id1 !== id2, 'Scheduler generates unique task IDs');

  const stats = await scheduler.stats();
  assert(stats.queued === 2, 'Scheduler queues tasks');

  scheduler.start();
  await new Promise(r => setTimeout(r, 200));
  scheduler.stop();

  const finalStats = await scheduler.stats();
  assert(finalStats.completed + finalStats.failed === 2, 'Scheduler processes all tasks');
}

export async function runRuntimeTests() {
  console.log('\n⚡ Runtime Package Tests');
  console.log('────────────────────────');
  await testEventBus();
  await testStateManager();
  await testScheduler();
  console.log(`  ────────────────────`);
  console.log(`  ${passed}/${passed + failed} passed, ${failed} failed\n`);
  return { passed, failed };
}