'use strict';

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');
const { syncBuiltinESMExports } = require('node:module');

const { PersistenceManager, FileBackedMemory } = require('../packages/infrastructure/src/persistence.ts');
const { MemoryManager } = require('../packages/memory/src/memory-manager.ts');
const { PersistentCOSSERVER } = require('../packages/api/src/server-persist.ts');

let failures = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    results.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) });
    console.error(`FAIL ${name}: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  }
}

async function withTempDir(fn) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cos-w1b-adv-'));
  try {
    return await fn(dir);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

async function dispose(store) {
  if (!store) return;
  try { await store.dispose(); } catch { /* test cleanup only */ }
}

async function seededSnapshot(dir) {
  const persistence = new PersistenceManager(dir);
  await persistence.init();
  const store = new FileBackedMemory(persistence, 'seed');
  const memory = new MemoryManager(store);
  try {
    await memory.store(
      { nested: { safe: true } },
      'semantic',
      { ttl: null, tags: ['seed'], metadata: { source: 'adversarial' } },
    );
    return structuredClone(store.serialize());
  } finally {
    await dispose(store);
  }
}

async function rejectSnapshot(persistence, name, snapshot, pattern) {
  const store = new FileBackedMemory(persistence, name);
  try {
    await assert.rejects(() => store.deserialize(snapshot), pattern);
  } finally {
    await dispose(store);
  }
}

(async () => {
  await test('snapshot validation rejects prototype, accessor, cycle and non-JSON payloads without pollution', async () => {
    await withTempDir(async dir => {
      const persistence = new PersistenceManager(dir);
      await persistence.init();
      const valid = await seededSnapshot(path.join(dir, 'seed-source'));

      const prototypeSnapshot = Object.create({ polluted: 'nope' });
      prototypeSnapshot.type = 'FileBackedMemory';
      prototypeSnapshot.version = 1;
      prototypeSnapshot.entries = [];
      await rejectSnapshot(persistence, 'prototype', prototypeSnapshot, /plain|snapshot|invalid/i);
      assert.equal(Object.prototype.polluted, undefined);

      let getterCalls = 0;
      const accessorSnapshot = { type: 'FileBackedMemory', version: 1, entries: [] };
      Object.defineProperty(accessorSnapshot, 'evil', {
        enumerable: true,
        get() { getterCalls += 1; return 'never'; },
      });
      await rejectSnapshot(persistence, 'accessor', accessorSnapshot, /accessor|hidden|snapshot|invalid/i);
      assert.equal(getterCalls, 0, 'snapshot validation must not execute attacker-controlled getters');

      const cyclicSnapshot = { type: 'FileBackedMemory', version: 1, entries: [] };
      cyclicSnapshot.self = cyclicSnapshot;
      await rejectSnapshot(persistence, 'cycle', cyclicSnapshot, /cycle|snapshot|invalid/i);

      const nonJsonSnapshot = structuredClone(valid);
      nonJsonSnapshot.entries[0].content = 1n;
      await rejectSnapshot(persistence, 'non-json', nonJsonSnapshot, /non-JSON|json|snapshot|invalid/i);
      assert.equal(Object.prototype.polluted, undefined);
    });
  });

  await test('duplicate memory ids fail before replacing live store state', async () => {
    await withTempDir(async dir => {
      const valid = await seededSnapshot(path.join(dir, 'seed-source'));
      const duplicate = structuredClone(valid);
      duplicate.entries.push(structuredClone(duplicate.entries[0]));

      const persistence = new PersistenceManager(dir);
      await persistence.init();
      const target = new FileBackedMemory(persistence, 'memory');
      const memory = new MemoryManager(target);
      try {
        const liveId = await memory.store('live-before-invalid-load', 'semantic', { ttl: null, tags: ['live'] });
        await target.flush();
        const file = path.join(dir, 'memory.json');
        await fsp.writeFile(file, JSON.stringify(duplicate), 'utf8');
        await assert.rejects(() => persistence.load('memory'), /duplicate|snapshot|invalid/i);
        assert.ok(await memory.retrieve(liveId), 'failed load must not replace the already-live authority');
      } finally {
        await dispose(target);
      }
    });
  });

  await test('expired entries are not rescued into durable authority', async () => {
    await withTempDir(async dir => {
      const firstPersistence = new PersistenceManager(dir);
      await firstPersistence.init();
      const firstStore = new FileBackedMemory(firstPersistence, 'memory');
      const firstMemory = new MemoryManager(firstStore);
      let secondStore;
      try {
        const id = await firstMemory.store('expired', 'working', { ttl: 1, tags: ['expired'] });
        await firstMemory.update(id, { createdAt: '2000-01-01T00:00:00.000Z', ttl: 1 });
        await firstStore.flush();

        const secondPersistence = new PersistenceManager(dir);
        await secondPersistence.init();
        secondStore = new FileBackedMemory(secondPersistence, 'memory');
        const secondMemory = new MemoryManager(secondStore);
        assert.equal(await secondPersistence.load('memory'), true);
        assert.equal(await secondMemory.retrieve(id), null);
        assert.equal((await secondMemory.query({ tags: ['expired'] })).length, 0);
      } finally {
        await dispose(firstStore);
        await dispose(secondStore);
      }
    });
  });

  await test('rename failure preserves the prior authority and cleans the temp candidate', async () => {
    await withTempDir(async dir => {
      const persistence = new PersistenceManager(dir);
      await persistence.init();
      const store = new FileBackedMemory(persistence, 'memory');
      const memory = new MemoryManager(store);
      const originalRename = fsp.rename;
      try {
        await memory.store('candidate', 'semantic', { ttl: null, tags: ['rename-failure'] });
        const target = path.join(dir, 'memory.json');
        const prior = '{"sentinel":"prior-authority"}\n';
        await fsp.writeFile(target, prior, 'utf8');

        fsp.rename = async () => { throw new Error('W1B_SIMULATED_RENAME_FAILURE'); };
        syncBuiltinESMExports();
        await assert.rejects(() => persistence.save('memory'), /W1B_SIMULATED_RENAME_FAILURE|atomically persist/i);
        assert.equal(await fsp.readFile(target, 'utf8'), prior);

        const leftovers = (await fsp.readdir(dir)).filter(name => name.startsWith('.memory.') && name.endsWith('.tmp'));
        assert.deepEqual(leftovers, []);
      } finally {
        fsp.rename = originalRename;
        syncBuiltinESMExports();
        await dispose(store);
      }
    });
  });

  await test('simulated unwritable directory fails closed without damaging prior authority', async () => {
    await withTempDir(async dir => {
      const persistence = new PersistenceManager(dir);
      await persistence.init();
      const store = new FileBackedMemory(persistence, 'memory');
      const memory = new MemoryManager(store);
      const originalWriteFile = fsp.writeFile;
      try {
        await memory.store('candidate', 'semantic', { ttl: null, tags: ['eacces'] });
        const target = path.join(dir, 'memory.json');
        const prior = '{"sentinel":"prior-authority"}\n';
        await originalWriteFile(target, prior, 'utf8');

        fsp.writeFile = async (file, data, options) => {
          if (String(file).includes('.memory.') && String(file).endsWith('.tmp')) {
            const error = new Error('W1B_SIMULATED_EACCES');
            error.code = 'EACCES';
            throw error;
          }
          return originalWriteFile(file, data, options);
        };
        syncBuiltinESMExports();
        await assert.rejects(() => persistence.save('memory'), /EACCES|atomically persist/i);
        assert.equal(await fsp.readFile(target, 'utf8'), prior);
      } finally {
        fsp.writeFile = originalWriteFile;
        syncBuiltinESMExports();
        await dispose(store);
      }
    });
  });

  await test('flush serializes a mutation that races after the first write but before flush completion', async () => {
    await withTempDir(async dir => {
      const persistence = new PersistenceManager(dir);
      await persistence.init();
      const store = new FileBackedMemory(persistence, 'memory');
      const memory = new MemoryManager(store);
      const originalSave = persistence.save.bind(persistence);
      let signalWritten;
      let releaseFirst;
      const firstWritten = new Promise(resolve => { signalWritten = resolve; });
      const release = new Promise(resolve => { releaseFirst = resolve; });
      let first = true;
      let secondStore;
      try {
        const firstId = await memory.store('before-flush', 'semantic', { ttl: null, tags: ['race'] });
        persistence.save = async name => {
          await originalSave(name);
          if (first) {
            first = false;
            signalWritten();
            await release;
          }
        };

        const flushing = store.flush();
        await firstWritten;
        const lateId = await memory.store('during-flush', 'semantic', { ttl: null, tags: ['race'] });
        releaseFirst();
        await flushing;
        persistence.save = originalSave;

        const secondPersistence = new PersistenceManager(dir);
        await secondPersistence.init();
        secondStore = new FileBackedMemory(secondPersistence, 'memory');
        const secondMemory = new MemoryManager(secondStore);
        assert.equal(await secondPersistence.load('memory'), true);
        assert.ok(await secondMemory.retrieve(firstId));
        assert.ok(await secondMemory.retrieve(lateId), 'late mutation must force another persistence generation');
      } finally {
        persistence.save = originalSave;
        if (releaseFirst) releaseFirst();
        await dispose(store);
        await dispose(secondStore);
      }
    });
  });

  await test('two independent writers never produce partial JSON but remain last-writer-wins without fencing', async () => {
    await withTempDir(async dir => {
      const persistenceA = new PersistenceManager(dir);
      const persistenceB = new PersistenceManager(dir);
      await Promise.all([persistenceA.init(), persistenceB.init()]);
      const storeA = new FileBackedMemory(persistenceA, 'memory');
      const storeB = new FileBackedMemory(persistenceB, 'memory');
      const memoryA = new MemoryManager(storeA);
      const memoryB = new MemoryManager(storeB);
      let storeC;
      try {
        await memoryA.store({ writer: 'A' }, 'semantic', { ttl: null, tags: ['writer-a'] });
        await memoryB.store({ writer: 'B' }, 'semantic', { ttl: null, tags: ['writer-b'] });
        await Promise.all([storeA.flush(), storeB.flush()]);

        const raw = await fsp.readFile(path.join(dir, 'memory.json'), 'utf8');
        assert.doesNotThrow(() => JSON.parse(raw));

        const persistenceC = new PersistenceManager(dir);
        await persistenceC.init();
        storeC = new FileBackedMemory(persistenceC, 'memory');
        const memoryC = new MemoryManager(storeC);
        assert.equal(await persistenceC.load('memory'), true);
        const entries = await memoryC.query({});
        assert.equal(entries.length, 1, 'multi-writer merge/fencing is intentionally not claimed');
        assert.ok(['A', 'B'].includes(entries[0].content.writer));
      } finally {
        await dispose(storeA);
        await dispose(storeB);
        await dispose(storeC);
      }
    });
  });

  await test('concurrent shutdown calls stop runtime once and persist dirty memory before returning', async () => {
    await withTempDir(async dir => {
      const first = new PersistentCOSSERVER(dir);
      let second;
      try {
        await first.init();
        await first.server.start();
        const id = await first.server.memory.store('shutdown-race', 'semantic', { ttl: null, tags: ['shutdown-race'] });
        await Promise.all([first.shutdown(), first.shutdown(), first.shutdown()]);

        second = new PersistentCOSSERVER(dir);
        await second.init();
        const restored = await second.server.memory.retrieve(id);
        assert.equal(restored?.content, 'shutdown-race');
      } finally {
        await dispose(first.memoryStore);
        if (second) await dispose(second.memoryStore);
      }
    });
  });

  console.log(JSON.stringify({ suite: 'durable-memory-w1b-adversarial', failures, results }, null, 2));
  process.exitCode = failures === 0 ? 0 : 1;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
