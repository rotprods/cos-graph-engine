'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const root = join(__dirname, '..');
const entry = './packages/memory/src/memory-manager.ts';
let failed = 0;
const results = [];
function child(name, code, timeout = 10000) {
  const run = spawnSync(process.execPath, ['--import', 'tsx', '-e', code], { cwd: root, encoding: 'utf8', timeout, maxBuffer: 2 * 1024 * 1024 });
  const passed = !run.error && run.status === 0;
  results.push({ name, passed, status: run.status, signal: run.signal, error: run.error?.code, stdout: run.stdout, stderr: run.stderr });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) { failed++; console.error(run.error?.message || run.stderr || run.stdout); }
  return run;
}
child('memory store allows natural process exit', `
  const { InMemoryStore } = require('${entry}');
  new InMemoryStore();
  console.log('constructed');
`);
child('memory integrity, copy safety and timer disposal', `
  const assert = require('node:assert/strict');
  const handles = [];
  const originalInterval = global.setInterval;
  global.setInterval = (...args) => { const timer = originalInterval(...args); handles.push(timer); return timer; };
  const { InMemoryStore, MemoryManager } = require('${entry}');
  const store = new InMemoryStore();
  const memory = new MemoryManager(store);
  let failures = 0;
  async function test(name, fn) { try { await fn(); console.log('PASS ' + name); } catch (error) { failures++; console.error('FAIL ' + name + ': ' + error.message); } }
  (async () => {
    try {
      await test('housekeeping timer is unreferenced', async () => assert.equal(handles[0].hasRef(), false));
      await test('explicit null TTL is preserved', async () => { const id = await memory.store('permanent', 'working', { ttl: null }); assert.equal((await memory.retrieve(id)).ttl, null); });
      await test('update reconciles layer index', async () => { const id = await memory.store('moved', 'working'); await memory.update(id, { layer: 'long_term' }); await memory.clear('working'); assert.equal((await memory.retrieve(id))?.content, 'moved'); });
      await test('replacement store reconciles layer index', async () => { const id = await memory.store('replace', 'cache'); const stored = await memory.retrieve(id); await store.store({ ...stored, layer: 'semantic' }); await memory.clear('cache'); assert.equal((await memory.retrieve(id))?.layer, 'semantic'); });
      await test('consolidation survives clearing source layer', async () => { const id = await memory.store('consolidate', 'short_term', { importance: 0.9 }); await memory.consolidate(0.7); await memory.clear('short_term'); assert.equal((await memory.retrieve(id))?.layer, 'long_term'); });
      await test('crossLink preserves existing serialized links', async () => { const a = await memory.store('a', 'semantic'); const b = await memory.store('b', 'semantic'); const c = await memory.store('c', 'semantic'); await memory.crossLink(a, b, 'references'); await memory.crossLink(a, c, 'references'); const links = JSON.parse((await memory.retrieve(a)).metadata.links); assert.deepEqual(links.map(link => link.target), [b, c]); });
      await test('crossLink deduplicates identical relation', async () => { const a = await memory.store('dedupe-a', 'semantic'); const b = await memory.store('dedupe-b', 'semantic'); await memory.crossLink(a, b, 'references'); await memory.crossLink(a, b, 'references'); const links = JSON.parse((await memory.retrieve(a)).metadata.links); assert.equal(links.filter(link => link.target === b && link.relation === 'references').length, 1); });
      await test('query excludes expired entries before next sweep', async () => { const id = await memory.store('expired', 'cache', { ttl: 1 }); await memory.update(id, { createdAt: '2000-01-01T00:00:00.000Z' }); assert.equal((await memory.query({ layer: 'cache' })).some(entry => entry.id === id), false); });
      await test('update cannot change indexed entry identity', async () => { const id = await memory.store('identity', 'semantic'); await assert.rejects(memory.update(id, { id: 'different-id' }), /identity|id|immutable/i); assert.equal((await memory.retrieve(id)).id, id); });
      await test('store detaches nested caller content and metadata', async () => { const content = { nested: { value: 1 } }; const metadata = { nested: { flag: true } }; const id = await memory.store(content, 'semantic', { metadata, tags: ['original'] }); content.nested.value = 99; metadata.nested.flag = false; const observed = await memory.retrieve(id); assert.equal(observed.content.nested.value, 1); assert.equal(observed.metadata.nested.flag, true); assert.deepEqual(observed.tags, ['original']); });
      await test('retrieve returns deep-detached snapshot', async () => { const id = await memory.store({ nested: { value: 2 } }, 'semantic', { metadata: { nested: { flag: true } }, tags: ['safe'] }); const first = await memory.retrieve(id); first.content.nested.value = 500; first.metadata.nested.flag = false; first.tags.push('corrupt'); const second = await memory.retrieve(id); assert.equal(second.content.nested.value, 2); assert.equal(second.metadata.nested.flag, true); assert.deepEqual(second.tags, ['safe']); });
      await test('query returns deep-detached snapshots', async () => { const id = await memory.store({ value: 3 }, 'semantic', { tags: ['query-safe'] }); const [row] = await memory.query({ tags: ['query-safe'] }); row.content.value = 700; row.tags.length = 0; row.layer = 'cache'; const observed = await memory.retrieve(id); assert.equal(observed.content.value, 3); assert.equal(observed.layer, 'semantic'); assert.deepEqual(observed.tags, ['query-safe']); });
      await test('update detaches nested patch input', async () => { const id = await memory.store({ value: 1 }, 'semantic'); const patch = { content: { nested: { value: 4 } }, metadata: { nested: { flag: true } } }; await memory.update(id, patch); patch.content.nested.value = 900; patch.metadata.nested.flag = false; const observed = await memory.retrieve(id); assert.equal(observed.content.nested.value, 4); assert.equal(observed.metadata.nested.flag, true); });
      await test('access telemetry does not mutate prior returned snapshot', async () => { const id = await memory.store('telemetry', 'semantic'); const first = await memory.retrieve(id); const firstCount = first.accessCount; const firstAccessed = first.lastAccessed; const second = await memory.retrieve(id); assert.equal(first.accessCount, firstCount); assert.equal(first.lastAccessed, firstAccessed); assert.equal(second.accessCount, firstCount + 1); });
      await test('dispose is idempotent and preserves stored data', async () => { const id = await memory.store('survives-disposal', 'semantic'); assert.equal(typeof store.dispose, 'function'); store.dispose(); store.dispose(); assert.equal((await memory.retrieve(id)).content, 'survives-disposal'); });
    } finally { global.setInterval = originalInterval; for (const handle of handles) clearInterval(handle); }
    process.exitCode = failures ? 1 : 0;
  })().catch(error => { console.error(error); process.exitCode = 1; });
`);
console.log(JSON.stringify({ suite: 'memory-regressions', results }, null, 2));
process.exitCode = failed ? 1 : 0;
