'use strict';
// CGEV11: behavioral regressions, including natural process exit (no forced exit).
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const root = join(__dirname, '..');
const entry = './packages/memory/src/memory-manager.ts';
let failed = 0;
const results = [];

function child(name, code, timeout = 10000) {
  const run = spawnSync(process.execPath, ['--import', 'tsx', '-e', code], {
    cwd: root, encoding: 'utf8', timeout, maxBuffer: 1024 * 1024,
  });
  const passed = !run.error && run.status === 0;
  results.push({ name, passed, status: run.status, signal: run.signal,
    error: run.error?.code, stdout: run.stdout, stderr: run.stderr });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) { failed++; console.error(run.error?.message || run.stderr || run.stdout); }
  return run;
}

child('memory store allows natural process exit', `
  const { InMemoryStore } = require('${entry}');
  new InMemoryStore();
  console.log('constructed');
`);

child('memory integrity and timer disposal', `
  const assert = require('node:assert/strict');
  const handles = [];
  const originalInterval = global.setInterval;
  global.setInterval = (...args) => {
    const timer = originalInterval(...args); handles.push(timer); return timer;
  };
  const { InMemoryStore, MemoryManager } = require('${entry}');
  const store = new InMemoryStore();
  const memory = new MemoryManager(store);
  let failures = 0;
  async function test(name, fn) {
    try { await fn(); console.log('PASS ' + name); }
    catch (error) { failures++; console.error('FAIL ' + name + ': ' + error.message); }
  }
  (async () => {
    try {
      await test('housekeeping timer is unreferenced', async () => {
        assert.equal(handles[0].hasRef(), false);
      });
      await test('explicit null TTL is preserved', async () => {
        const id = await memory.store('permanent', 'working', { ttl: null });
        assert.equal((await memory.retrieve(id)).ttl, null);
      });
      await test('update reconciles layer index', async () => {
        const id = await memory.store('moved', 'working');
        await memory.update(id, { layer: 'long_term' });
        await memory.clear('working');
        assert.equal((await memory.retrieve(id))?.content, 'moved');
      });
      await test('replacement store reconciles layer index', async () => {
        const id = await memory.store('replace', 'cache');
        const entry = await memory.retrieve(id);
        await store.store({ ...entry, layer: 'semantic' });
        await memory.clear('cache');
        assert.equal((await memory.retrieve(id))?.layer, 'semantic');
      });
      await test('consolidation survives clearing source layer', async () => {
        const id = await memory.store('consolidate', 'short_term', { importance: 0.9 });
        await memory.consolidate(0.7);
        await memory.clear('short_term');
        assert.equal((await memory.retrieve(id))?.layer, 'long_term');
      });
      await test('crossLink preserves existing serialized links', async () => {
        const a = await memory.store('a', 'semantic');
        const b = await memory.store('b', 'semantic');
        const c = await memory.store('c', 'semantic');
        await memory.crossLink(a, b, 'references');
        await memory.crossLink(a, c, 'references');
        const links = JSON.parse((await memory.retrieve(a)).metadata.links);
        assert.deepEqual(links.map(link => link.target), [b, c]);
      });
      await test('query excludes expired entries before next sweep', async () => {
        const id = await memory.store('expired', 'cache', { ttl: 1 });
        await memory.update(id, { createdAt: '2000-01-01T00:00:00.000Z' });
        assert.equal((await memory.query({ layer: 'cache' })).some(entry => entry.id === id), false);
      });
      await test('update cannot change indexed entry identity', async () => {
        const id = await memory.store('identity', 'semantic');
        await assert.rejects(memory.update(id, { id: 'different-id' }), /identity|id|immutable/i);
        assert.equal((await memory.retrieve(id)).id, id);
      });
      await test('dispose is idempotent and preserves stored data', async () => {
        const id = await memory.store('survives-disposal', 'semantic');
        assert.equal(typeof store.dispose, 'function');
        store.dispose(); store.dispose();
        assert.equal((await memory.retrieve(id)).content, 'survives-disposal');
      });
    } finally {
      // Test-owned cleanup works even against the historical leaking implementation.
      global.setInterval = originalInterval;
      for (const handle of handles) clearInterval(handle);
    }
    process.exitCode = failures ? 1 : 0;
  })().catch(error => { console.error(error); process.exitCode = 1; });
`);

console.log(JSON.stringify({ suite: 'memory-regressions', results }, null, 2));
process.exitCode = failed ? 1 : 0;
