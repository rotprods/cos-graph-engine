'use strict';
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Configuration } = require('../packages/infrastructure/src/config.ts');
const { AuthMiddleware } = require('../packages/api/src/auth.ts');
const values = {
  COS_JWT_SECRET: 'public-config-test-fixture-never-use-in-production-20260907',
  COS_API_KEYS: 'fixture-api-a, fixture-api-b', COS_PORT: '9012', COS_SERVER_PORT: '7777',
  COS_HOST: '127.0.0.1', COS_SELF_IMPROVEMENT: 'false', COS_VECTOR_DIM: '256',
  COS_MEMORY_MAX: '2048', COS_EVAL_FREQ: '7', COS_META_COG_INTERVAL: '90',
  COS_CUSTOM_SETTING: 'custom-value',
};
const original = new Map(Object.keys(values).map(key => [key, process.env[key]]));
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
}
(async () => {
  const folder = mkdtempSync(join(tmpdir(), 'cos-config-regression-'));
  try {
    Object.assign(process.env, values);
    const config = new Configuration(); config.loadPresets();
    for (const [key, expected] of [
      ['server.port', 9012], ['server.host', '127.0.0.1'],
      ['auth.jwtSecret', values.COS_JWT_SECRET], ['auth.apiKeys', ['fixture-api-a', 'fixture-api-b']],
      ['selfImprovement.enabled', false], ['storage.vector.dimension', 256],
      ['storage.memory.maxEntries', 2048], ['selfImprovement.evalFrequency', 7],
      ['selfImprovement.metaCogInterval', 90], ['custom.setting', 'custom-value'],
    ]) await test('canonical environment binding: ' + key, () => assert.deepEqual(config.get(key), expected));
    await test('bound keys record environment provenance', () => assert.equal(config.snapshot()['auth.jwtSecret'].source, 'env'));
    await test('explicit binding does not create a parallel secret key', () => assert.equal(Object.hasOwn(config.getAll(), 'jwt.secret'), false));
    await test('declared binding wins over generic name independent of env ordering', () => {
      delete process.env.COS_SERVER_PORT; process.env.COS_SERVER_PORT = '7777';
      const reversed = new Configuration(); reversed.loadPresets();
      assert.equal(reversed.get('server.port'), 9012);
    });
    await test('file then runtime retain higher precedence than environment', () => {
      const path = join(folder, 'config.json'); writeFileSync(path, JSON.stringify({ 'server.port': 9020 }));
      config.loadFromFile(path); assert.equal(config.get('server.port'), 9020);
      config.setRuntime('server.port', 9030); config.loadFromEnv();
      assert.equal(config.get('server.port'), 9030);
    });
    await test('environment signing key reaches actual JWT issuer and verifier', async () => {
      const auth = new AuthMiddleware(config); const token = auth.generateToken('fixture', 'admin');
      assert.equal((await auth.authenticate('Bearer ' + token)).userId, 'fixture');
      assert.equal((await auth.authenticate('Bearer fixture-api-a')).tokenType, 'api_key');
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  console.log(JSON.stringify({ suite: 'config-bindings', passed, failed }));
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
