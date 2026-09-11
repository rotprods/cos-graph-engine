'use strict';

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');

const {
  PersistenceManager,
  PersistenceError,
  FileBackedMemory,
} = require('../packages/infrastructure/src/persistence.ts');
const { MemoryManager } = require('../packages/memory/src/memory-manager.ts');

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
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cos-w1b-matrix-'));
  try {
    return await fn(dir);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

async function dispose(store) {
  if (!store) return;
  try { await store.dispose(); } catch { /* cleanup cannot hide the assertion */ }
}

async function validSnapshot(dir) {
  const persistence = new PersistenceManager(dir);
  await persistence.init();
  const store = new FileBackedMemory(persistence, 'seed');
  const memory = new MemoryManager(store);
  try {
    await memory.store(
      { nested: { answer: 42 }, list: [true, false, null, 'ok'] },
      'semantic',
      { ttl: null, tags: ['matrix'], metadata: { origin: 'w1b' } },
    );
    return structuredClone(store.serialize());
  } finally {
    await dispose(store);
  }
}

function clone(snapshot) {
  return structuredClone(snapshot);
}

async function rejectSnapshot(persistence, index, snapshot) {
  const store = new FileBackedMemory(persistence, `matrix-${index}`);
  try {
    await assert.rejects(
      () => store.deserialize(snapshot),
      error => error instanceof Error && /snapshot|invalid|unsupported|required|must|non-|cycle|duplicate/i.test(error.message),
    );
  } finally {
    await dispose(store);
  }
}

(async () => {
  await test('schema matrix rejects malformed but JSON-like authority shapes', async () => {
    await withTempDir(async dir => {
      const persistence = new PersistenceManager(dir);
      await persistence.init();
      const valid = await validSnapshot(path.join(dir, 'seed-source'));
      const cases = [];

      cases.push(null);
      cases.push([]);

      {
        const value = clone(valid);
        value.extra = true;
        cases.push(value);
      }
      {
        const value = clone(valid);
        delete value.entries;
        cases.push(value);
      }
      {
        const value = clone(valid);
        value.type = 'OtherMemory';
        cases.push(value);
      }
      {
        const value = clone(valid);
        value.version = 2;
        cases.push(value);
      }
      {
        const value = clone(valid);
        value.entries = {};
        cases.push(value);
      }
      {
        const value = clone(valid);
        value.entries = [null];
        cases.push(value);
      }

      const entryMutations = [
        entry => { entry.id = ''; },
        entry => { entry.id = 7; },
        entry => { entry.layer = 'not-a-layer'; },
        entry => { entry.importance = 'high'; },
        entry => { entry.ttl = 'forever'; },
        entry => { entry.version = null; },
        entry => { entry.version.major = -1; },
        entry => { entry.version.extra = 1; },
        entry => { entry.createdAt = 'not-a-date'; },
        entry => { entry.lastAccessed = 12; },
        entry => { entry.accessCount = -1; },
        entry => { entry.consolidated = 'false'; },
        entry => { entry.compressed = 0; },
        entry => { entry.tags = [1]; },
        entry => { entry.source = 1; },
        entry => { entry.representations = []; },
        entry => { entry.metadata = []; },
      ];
      for (const mutate of entryMutations) {
        const value = clone(valid);
        mutate(value.entries[0]);
        cases.push(value);
      }

      for (let index = 0; index < cases.length; index++) {
        await rejectSnapshot(persistence, index, cases[index]);
      }
    });
  });

  await test('JSON safety matrix rejects values JSON.stringify would erase or rewrite', async () => {
    await withTempDir(async dir => {
      const persistence = new PersistenceManager(dir);
      await persistence.init();
      const valid = await validSnapshot(path.join(dir, 'seed-source'));
      const cases = [];

      {
        const value = clone(valid);
        value.entries[0].content = Number.NaN;
        cases.push(value);
      }
      {
        const value = clone(valid);
        value.entries[0].content = undefined;
        cases.push(value);
      }
      {
        const value = clone(valid);
        value.entries[0].content = () => 'nope';
        cases.push(value);
      }
      {
        const value = clone(valid);
        value.entries[0].content = Symbol('nope');
        cases.push(value);
      }
      {
        const value = clone(valid);
        value.entries[0].content = new Array(2);
        cases.push(value);
      }
      {
        const value = clone(valid);
        const extended = [1];
        extended.extra = 2;
        value.entries[0].content = extended;
        cases.push(value);
      }
      {
        const value = clone(valid);
        value.entries[0].content = new Date('2026-09-10T00:00:00.000Z');
        cases.push(value);
      }
      {
        const value = clone(valid);
        const object = { safe: true };
        object[Symbol('hidden')] = true;
        value.entries[0].content = object;
        cases.push(value);
      }
      {
        const value = clone(valid);
        const object = { safe: true };
        Object.defineProperty(object, 'hidden', { value: true, enumerable: false });
        value.entries[0].content = object;
        cases.push(value);
      }
      {
        let getterCalls = 0;
        const value = clone(valid);
        const object = {};
        Object.defineProperty(object, 'danger', {
          enumerable: true,
          get() { getterCalls += 1; return 'nope'; },
        });
        value.entries[0].content = object;
        cases.push(value);
        await rejectSnapshot(persistence, 100, value);
        assert.equal(getterCalls, 0, 'validator must inspect descriptors without invoking getters');
        cases.pop();
      }

      for (let index = 0; index < cases.length; index++) {
        await rejectSnapshot(persistence, 110 + index, cases[index]);
      }
    });
  });

  await test('PersistenceManager error taxonomy is explicit across registration, lifecycle, serialization, read and schema failures', async () => {
    await withTempDir(async dir => {
      const dummy = { serialize: () => ({}), deserialize: () => {} };
      const beforeInit = new PersistenceManager(dir);
      beforeInit.register('dummy', dummy);

      assert.throws(() => beforeInit.register('../escape', dummy), /Invalid persistence store name/);
      await assert.rejects(() => beforeInit.save('missing'), /not registered/);
      await assert.rejects(() => beforeInit.load('missing'), /not registered/);
      await assert.rejects(() => beforeInit.save('dummy'), /init\(\).*save/i);
      await assert.rejects(() => beforeInit.load('dummy'), /init\(\).*load/i);

      await beforeInit.init();
      assert.equal(beforeInit.storeCount, 1);
      assert.equal(beforeInit.dataPath, dir);

      beforeInit.register('undefined-snapshot', { serialize: () => undefined, deserialize: () => {} });
      await assert.rejects(
        () => beforeInit.save('undefined-snapshot'),
        error => error instanceof PersistenceError && error.code === 'PERSISTENCE_SERIALIZE_FAILED',
      );

      const cyclic = {};
      cyclic.self = cyclic;
      beforeInit.register('cyclic-snapshot', { serialize: () => cyclic, deserialize: () => {} });
      await assert.rejects(
        () => beforeInit.save('cyclic-snapshot'),
        error => error instanceof PersistenceError && error.code === 'PERSISTENCE_SERIALIZE_FAILED',
      );

      beforeInit.register('schema-wrap', {
        serialize: () => ({}),
        deserialize: () => { throw new Error('W1B_SCHEMA_GENERIC'); },
      });
      await fsp.writeFile(path.join(dir, 'schema-wrap.json'), '{}', 'utf8');
      await assert.rejects(
        () => beforeInit.load('schema-wrap'),
        error => error instanceof PersistenceError && error.code === 'PERSISTENCE_SCHEMA_INVALID',
      );

      const sentinel = new PersistenceError('PERSISTENCE_DIRTY_LOAD', 'W1B_SENTINEL');
      beforeInit.register('schema-sentinel', {
        serialize: () => ({}),
        deserialize: () => { throw sentinel; },
      });
      await fsp.writeFile(path.join(dir, 'schema-sentinel.json'), '{}', 'utf8');
      await assert.rejects(() => beforeInit.load('schema-sentinel'), error => error === sentinel);

      beforeInit.register('read-failure', dummy);
      await fsp.mkdir(path.join(dir, 'read-failure.json'));
      await assert.rejects(
        () => beforeInit.load('read-failure'),
        error => error instanceof PersistenceError && error.code === 'PERSISTENCE_READ_FAILED',
      );

      const factoryStore = beforeInit.createMemoryStore('factory-store', () => ({
        serialize: () => ({ ok: true }),
        deserialize: async () => {},
      }));
      assert.ok(factoryStore);
      assert.equal(beforeInit.storeCount, 7);
    });
  });

  await test('FileBackedMemory refuses dirty loads, rejects mutation after disposal and coalesces concurrent flush calls', async () => {
    await withTempDir(async dir => {
      const persistence = new PersistenceManager(dir);
      await persistence.init();
      const store = new FileBackedMemory(persistence);
      const memory = new MemoryManager(store);
      try {
        await memory.store('dirty-authority', 'semantic', { ttl: null, tags: ['matrix-lifecycle'] });
        const snapshot = store.serialize();
        await assert.rejects(
          () => store.deserialize(snapshot),
          error => error instanceof PersistenceError && error.code === 'PERSISTENCE_DIRTY_LOAD',
        );
        await Promise.all([store.flush(), store.flush(), store.flush()]);
        await store.dispose();
        await assert.rejects(() => memory.store('after-dispose', 'semantic'), /disposed/);
      } finally {
        await dispose(store);
      }
    });
  });

  console.log(JSON.stringify({ suite: 'durable-memory-w1b-schema-matrix', failures, results }, null, 2));
  process.exitCode = failures === 0 ? 0 : 1;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
