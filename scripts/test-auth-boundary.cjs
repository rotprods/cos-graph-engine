'use strict';
// Isolated defensive tests. Keys below are public test fixtures, never deployment credentials.
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { AuthMiddleware } = require('../packages/api/src/auth.ts');
const { HttpApiServer } = require('../packages/api/src/http-server.ts');
const { Configuration } = require('../packages/infrastructure/src/config.ts');
const key = 'public-test-fixture-key-do-not-use-in-production-20260907';
const config = new Configuration(); config.loadPresets();
config.setRuntime('auth.jwtSecret', key);
config.setRuntime('auth.apiKeys', ['public-test-api-key']);
const auth = new AuthMiddleware(config);
const now = Math.floor(Date.now() / 1000);
const claims = { sub: 'fixture-user', role: 'user', permissions: ['read'], iat: now, exp: now + 3600, iss: 'cos', aud: 'cos-api' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function signed(payload = claims, header = { alg: 'HS256', typ: 'JWT' }, secret = key) {
  const data = encode(header) + '.' + encode(payload);
  return data + '.' + createHmac('sha256', secret).update(data).digest('base64url');
}
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
}
async function rejected(token) {
  const identity = await auth.authenticate('Bearer ' + token);
  assert.equal(identity.tokenType, 'none');
  assert.deepEqual(identity.permissions, []);
}
async function request(method, path, token, body = {}) {
  const server = Object.create(HttpApiServer.prototype);
  let reads = 0, effects = 0;
  server.auth = auth; server.config = config;
  server.cosServer = {
    getHealth: async () => ({ status: 'ok' }), getStats: async () => { effects++; return {}; },
    memory: { retrieve: async () => { effects++; return {}; }, stats: async () => { effects++; return {}; }, query: async () => { effects++; return []; } },
    knowledge: { query: async () => { effects++; return []; }, stats: async () => { effects++; return {}; } },
    cellHost: { getAllCells: () => { effects++; return []; }, inspectCell: async () => { effects++; return {}; } },
    selfImprovement: { runMetaCognition: async () => { effects++; return {}; } },
    createGoal: async () => { effects++; return {}; }, getActiveGoals: async () => { effects++; return []; },
    executeGoal: async () => { effects++; return {}; }, executeNextStep: async () => { effects++; return {}; },
  };
  server.readBody = async () => { reads++; return body; };
  let status = 0, output = '';
  const response = { setHeader() {}, writeHead(code) { status = code; }, end(data) { output = data || ''; } };
  await server.handleRequest({ method, url: path, headers: token ? { authorization: 'Bearer ' + token } : {} }, response);
  return { status, output, reads, effects };
}
(async () => {
  await test('independently signed HS256 token accepted', async () => assert.equal((await auth.authenticate('Bearer ' + signed())).userId, claims.sub));
  await test('generated signature matches HMAC-SHA256', async () => {
    const token = auth.generateToken('fixture-admin', 'admin');
    const [header, payload, signature] = token.split('.');
    assert.equal(signature, createHmac('sha256', key).update(header + '.' + payload).digest('base64url'));
    assert.ok(!Buffer.from(signature, 'base64url').toString().includes(key));
  });
  for (const [name, token] of [
    ['forged signature rejected', signed().replace(/\.[^.]+$/, '.Zm9yZ2Vk')],
    ['wrong signing key rejected', signed(claims, undefined, key + '-wrong')],
    ['alg none rejected', signed(claims, { alg: 'none', typ: 'JWT' })],
    ['expired token rejected', signed({ ...claims, iat: now - 20, exp: now - 1 })],
    ['missing expiry rejected', signed({ ...claims, exp: undefined })],
    ['future activation rejected', signed({ ...claims, nbf: now + 3600 })],
    ['foreign audience rejected', signed({ ...claims, aud: 'other-service' })],
    ['foreign issuer rejected', signed({ ...claims, iss: 'other-issuer' })],
    ['user cannot claim admin capability', signed({ ...claims, permissions: ['read', 'admin'] })],
    ['unknown role rejected', signed({ ...claims, role: 'root' })],
    ['string permissions rejected', signed({ ...claims, permissions: 'admin' })],
    ['malformed token rejected', 'not-a-token'],
  ]) await test(name, () => rejected(token));
  await test('anonymous has no privileged permissions', async () => assert.deepEqual((await auth.authenticate()).permissions, []));
  await test('placeholder signing key cannot issue tokens', async () => {
    const defaults = new Configuration(); defaults.loadPresets();
    assert.throws(() => new AuthMiddleware(defaults).generateToken('admin', 'admin'), /secret|key|config/i);
  });
  await test('expiry is rechecked after previous successful authentication', async () => {
    const originalNow = Date.now;
    const token = signed({ ...claims, exp: now + 2 });
    try {
      assert.equal((await auth.authenticate('Bearer ' + token)).tokenType, 'jwt');
      Date.now = () => (now + 3) * 1000;
      await rejected(token);
    } finally { Date.now = originalNow; }
  });
  await test('secret rotation invalidates a previously accepted token', async () => {
    const token = signed(); await auth.authenticate('Bearer ' + token);
    config.setRuntime('auth.jwtSecret', key + '-rotated');
    try { await rejected(token); } finally { config.setRuntime('auth.jwtSecret', key); }
  });
  for (const [method, path] of [
    ['GET', '/config'], ['POST', '/auth/token'], ['GET', '/memory/fixture'],
    ['GET', '/knowledge/fixture'], ['GET', '/stats'], ['GET', '/cells'],
    ['GET', '/goals'], ['POST', '/goals'], ['POST', '/goals/fixture'],
    ['POST', '/chat'], ['POST', '/research'], ['GET', '/self-improve'],
  ]) await test('anonymous denied before body/effects: ' + method + ' ' + path, async () => {
    const result = await request(method, path, undefined, { userId: 'intruder', role: 'admin', description: 'fixture' });
    assert.equal(result.status, 401); assert.equal(result.reads, 0); assert.equal(result.effects, 0);
  });
  await test('reader cannot execute a goal', async () => {
    const result = await request('POST', '/goals/fixture', signed());
    assert.equal(result.status, 403); assert.equal(result.effects, 0);
  });
  await test('normal user cannot mint admin tokens', async () => {
    const result = await request('POST', '/auth/token', signed(), { role: 'admin' });
    assert.equal(result.status, 403);
  });
  await test('admin can mint a valid token', async () => {
    const admin = auth.generateToken('operator', 'admin');
    const result = await request('POST', '/auth/token', admin, { userId: 'new-user', role: 'user' });
    assert.equal(result.status, 200);
    const issued = JSON.parse(result.output).token;
    assert.equal((await auth.authenticate('Bearer ' + issued)).userId, 'new-user');
  });
  await test('admin config response redacts credentials', async () => {
    const result = await request('GET', '/config', auth.generateToken('operator', 'admin'));
    assert.equal(result.status, 200);
    assert.ok(!result.output.includes(key)); assert.ok(!result.output.includes('public-test-api-key'));
  });
  await test('public health remains accessible', async () => assert.equal((await request('GET', '/health')).status, 200));
  console.log(JSON.stringify({ suite: 'auth-boundary', passed, failed }));
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
