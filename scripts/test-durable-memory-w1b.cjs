'use strict';

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');

const root = path.join(__dirname, '..');
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
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cos-w1b-'));
  try {
    return await fn(dir);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

async function cleanupFileMemory(store) {
  try {
    if (typeof store.dispose === 'function') {
      await store.dispose();
      return;
    }
    if (store.saveTimer) {
      clearTimeout(store.saveTimer);
      store.saveTimer = null;
    }
    store.getInner?.().dispose?.();
  } catch {
    // Cleanup is intentionally best-effort so it cannot hide the assertion that failed.
  }
}

(async () => {
  await test('missing snapshot is the only normal missing case', async () => {
    await withTempDir(async dir => {
      const persistence = new PersistenceManager(dir);
      await persistence.init();
      const store = new FileBackedMemory(persistence, 'memory');
      try {
        assert.equal(await persistence.load('memory'), false);
      } finally {
        await cleanupFileMemory(store);
      }
    });
  });

  await test('restart round-trip restores canonical entries, layers, tags, nested content and TTL', async () => {
    await withTempDir(async dir => {
      const persistence1 = new PersistenceManager(dir);
      await persistence1.init();
      const store1 = new FileBackedMemory(persistence1, 'memory');
      const memory1 = new MemoryManager(store1);
      let store2;
      try {
        const permanentId = await memory1.store(
          { nested: { value: 42 }, list: [1, { deep: true }] },
          'semantic',
          {
            ttl: null,
            tags: ['w1b', 'permanent'],
            importance: 0.91,
            metadata: { source: 'durability-suite', nested: { preserved: true } },
          },
        );
        const expiringId = await memory1.store(
          { kind: 'temporary' },
          'working',
          { ttl: 3600, tags: ['w1b', 'temporary'], importance: 0.73 },
        );

        const accessedOnce = await memory1.retrieve(permanentId);
        const accessedTwice = await memory1.retrieve(permanentId);
        assert.ok(accessedOnce && accessedTwice);
        const savedAccessCount = accessedTwice.accessCount;
        const savedLastAccessed = accessedTwice.lastAccessed;

        await persistence1.save('memory');
        await cleanupFileMemory(store1);

        const persistence2 = new PersistenceManager(dir);
        await persistence2.init();
        store2 = new FileBackedMemory(persistence2, 'memory');
        const memory2 = new MemoryManager(store2);
        assert.equal(await persistence2.load('memory'), true);

        const restoredPermanent = await memory2.retrieve(permanentId);
        assert.ok(restoredPermanent, 'permanent memory must survive restart');
        assert.deepEqual(restoredPermanent.content, { nested: { value: 42 }, list: [1, { deep: true }] });
        assert.equal(restoredPermanent.layer, 'semantic');
        assert.equal(restoredPermanent.ttl, null);
        assert.deepEqual(restoredPermanent.tags, ['w1b', 'permanent']);
        assert.deepEqual(restoredPermanent.metadata, {
          source: 'durability-suite',
          nested: { preserved: true },
        });
        assert.equal(restoredPermanent.accessCount, savedAccessCount + 1);
        assert.ok(restoredPermanent.lastAccessed >= savedLastAccessed);

        const byTag = await memory2.query({ tags: ['w1b'] });
        assert.deepEqual(new Set(byTag.map(entry => entry.id)), new Set([permanentId, expiringId]));
        const restoredExpiring = byTag.find(entry => entry.id === expiringId);
        assert.equal(restoredExpiring?.layer, 'working');
        assert.equal(restoredExpiring?.ttl, 3600);
      } finally {
        await cleanupFileMemory(store1);
        if (store2) await cleanupFileMemory(store2);
      }
    });
  });

  await test('malformed JSON fails closed instead of becoming missing', async () => {
    await withTempDir(async dir => {
      const persistence = new PersistenceManager(dir);
      await persistence.init();
      const store = new FileBackedMemory(persistence, 'memory');
      try {
        await fsp.writeFile(path.join(dir, 'memory.json'), '{"broken":', 'utf8');
        await assert.rejects(
          () => persistence.load('memory'),
          error => error instanceof Error && /json|corrupt|persist|snapshot/i.test(error.message),
        );
      } finally {
        await cleanupFileMemory(store);
      }
    });
  });

  await test('valid JSON with an unknown snapshot schema fails closed', async () => {
    await withTempDir(async dir => {
      const persistence = new PersistenceManager(dir);
      await persistence.init();
      const store = new FileBackedMemory(persistence, 'memory');
      try {
        await fsp.writeFile(
          path.join(dir, 'memory.json'),
          JSON.stringify({ type: 'FileBackedMemory', version: 999, entries: [] }),
          'utf8',
        );
        await assert.rejects(
          () => persistence.load('memory'),
          error => error instanceof Error && /schema|version|invalid|snapshot|persist/i.test(error.message),
        );
      } finally {
        await cleanupFileMemory(store);
      }
    });
  });

  await test('failed write cannot replace a known-good snapshot with partial JSON', async () => {
    await withTempDir(async dir => {
      const persistence = new PersistenceManager(dir);
      await persistence.init();
      const store = new FileBackedMemory(persistence, 'memory');
      const memory = new MemoryManager(store);
      const originalWriteFile = fsp.writeFile;
      try {
        await memory.store('known-good-authority', 'semantic', { ttl: null, tags: ['atomic'] });
        const target = path.join(dir, 'memory.json');
        const knownGood = '{"sentinel":"known-good"}\n';
        await originalWriteFile(target, knownGood, 'utf8');

        let injected = false;
        fsp.writeFile = async (file, data, options) => {
          const fileName = String(file);
          if (!injected && fileName.includes('memory')) {
            injected = true;
            await originalWriteFile(file, '{"partial":', 'utf8');
            throw new Error('W1B_SIMULATED_TORN_WRITE');
          }
          return originalWriteFile(file, data, options);
        };
        syncBuiltinESMExports();

        await assert.rejects(() => persistence.save('memory'), /W1B_SIMULATED_TORN_WRITE/);
        const after = await fsp.readFile(target, 'utf8');
        assert.equal(after, knownGood, 'known-good authority file must remain byte-identical');
      } finally {
        fsp.writeFile = originalWriteFile;
        syncBuiltinESMExports();
        await cleanupFileMemory(store);
      }
    });
  });

  await test('FileBackedMemory exposes deterministic idempotent flush/dispose lifecycle', async () => {
    await withTempDir(async dir => {
      const persistence = new PersistenceManager(dir);
      await persistence.init();
      const store = new FileBackedMemory(persistence, 'memory');
      const memory = new MemoryManager(store);
      try {
        await memory.store('lifecycle', 'working', { tags: ['lifecycle'] });
        assert.equal(typeof store.flush, 'function', 'flush() must be explicit');
        assert.equal(typeof store.dispose, 'function', 'dispose() must be explicit');
        await store.flush();
        await store.flush();
        await store.dispose();
        await store.dispose();
        assert.ok(fs.existsSync(path.join(dir, 'memory.json')));
      } finally {
        await cleanupFileMemory(store);
      }
    });
  });

  await test('dirty autosave timer does not keep a process alive', async () => {
    await withTempDir(async dir => {
      const code = `
        const { PersistenceManager, FileBackedMemory } = require('./packages/infrastructure/src/persistence.ts');
        const { MemoryManager } = require('./packages/memory/src/memory-manager.ts');
        (async () => {
          const persistence = new PersistenceManager(process.env.W1B_TMP_DIR);
          await persistence.init();
          const store = new FileBackedMemory(persistence, 'memory');
          const memory = new MemoryManager(store);
          await memory.store('natural-exit', 'working', { tags: ['natural-exit'] });
          console.log('stored');
        })().catch(error => { console.error(error); process.exitCode = 1; });
      `;
      const run = spawnSync(process.execPath, ['--import', 'tsx', '-e', code], {
        cwd: root,
        env: { ...process.env, W1B_TMP_DIR: dir },
        encoding: 'utf8',
        timeout: 1500,
        maxBuffer: 1024 * 1024,
      });
      assert.equal(run.error?.code, undefined, `child must exit naturally; got ${run.error?.code || run.error?.message || 'unknown error'}`);
      assert.equal(run.status, 0, run.stderr || run.stdout);
    });
  });

  await test('persistent server goal memory survives restart through one injected authority', async () => {
    await withTempDir(async dir => {
      const first = new PersistentCOSSERVER(dir);
      let second;
      try {
        await first.init();
        first.server.planning.createPlan = async goal => ({
          id: 'w1b-plan',
          goal,
          steps: [],
          status: 'drafting',
          confidence: 1,
          cost: { units: 'credits', amount: 0 },
          createdAt: new Date().toISOString(),
          metadata: {},
        });

        assert.equal(first.server.autonomousLoop.memory, first.server.memory, 'AutonomousLoop must share server memory authority');
        await first.server.createGoal('W1B restart authority goal');
        const before = await first.server.memory.query({ tags: ['goal', 'autonomous'] });
        assert.equal(before.some(entry => entry.content?.description === 'W1B restart authority goal'), true);
        await first.saveNow();

        second = new PersistentCOSSERVER(dir);
        await second.init();
        assert.equal(second.server.autonomousLoop.memory, second.server.memory, 'restored server must keep one memory authority');
        const after = await second.server.memory.query({ tags: ['goal', 'autonomous'] });
        assert.equal(
          after.some(entry => entry.content?.description === 'W1B restart authority goal'),
          true,
          'goal-created memory must survive process reconstruction',
        );
      } finally {
        if (first.memoryStore) await cleanupFileMemory(first.memoryStore);
        if (second?.memoryStore) await cleanupFileMemory(second.memoryStore);
      }
    });
  });

  await test('PersistentCOSSERVER shutdown flushes and delegates to COSServer shutdown exactly once', async () => {
    await withTempDir(async dir => {
      const persistent = new PersistentCOSSERVER(dir);
      await persistent.init();
      let shutdownCalls = 0;
      persistent.server.shutdown = async () => { shutdownCalls += 1; };
      await persistent.shutdown();
      await persistent.shutdown();
      assert.equal(shutdownCalls, 1, 'underlying server shutdown must be idempotently delegated');
    });
  });

  console.log(JSON.stringify({ suite: 'durable-memory-w1b-red', failures, results }, null, 2));
  process.exitCode = failures === 0 ? 0 : 1;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
