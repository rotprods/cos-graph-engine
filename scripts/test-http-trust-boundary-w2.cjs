'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PassThrough, Readable } = require('node:stream');
const { AuthMiddleware } = require('../packages/api/src/auth.ts');
const { HttpApiServer } = require('../packages/api/src/http-server.ts');
const { Configuration } = require('../packages/infrastructure/src/config.ts');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    failed += 1;
    process.stderr.write(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}

function createBoundary(config) {
  const server = Object.create(HttpApiServer.prototype);
  server.config = config;
  return server;
}

function rawRequest(chunks, headers = {}) {
  const req = Readable.from(chunks.map(chunk => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  req.headers = headers;
  return req;
}

(async () => {
  const config = new Configuration();
  config.loadPresets();
  const server = createBoundary(config);

  await test('browser API boundary is same-origin by default and keeps defensive response headers', async () => {
    const headers = new Map();
    const response = {
      setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    };
    server.setSecurityHeaders(response);
    assert.equal(headers.has('access-control-allow-origin'), false);
    assert.equal(headers.has('access-control-allow-methods'), false);
    assert.equal(headers.has('access-control-allow-headers'), false);
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.equal(headers.get('referrer-policy'), 'no-referrer');
    assert.equal(headers.get('x-frame-options'), 'DENY');
    assert.equal(headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');

    const source = fs.readFileSync(path.join(process.cwd(), 'packages/api/src/http-server.ts'), 'utf8');
    assert.doesNotMatch(source, /Access-Control-Allow-Origin/i);
  });

  await test('default request body boundary is 1 MiB', async () => {
    assert.equal(server.maxBodyBytes(), 1024 * 1024);
  });

  await test('configured body boundary can tighten below default', async () => {
    config.setRuntime('server.maxBodyBytes', 64);
    try { assert.equal(server.maxBodyBytes(), 64); }
    finally { config.setRuntime('server.maxBodyBytes', 1024 * 1024); }
  });

  await test('runtime configuration cannot raise body cap above 8 MiB hard ceiling', async () => {
    config.setRuntime('server.maxBodyBytes', 64 * 1024 * 1024);
    try { assert.equal(server.maxBodyBytes(), 8 * 1024 * 1024); }
    finally { config.setRuntime('server.maxBodyBytes', 1024 * 1024); }
  });

  for (const [name, value] of [
    ['non-numeric Content-Length', 'NaN'],
    ['negative Content-Length', '-1'],
    ['fractional Content-Length', '1.5'],
    ['unsafe integer Content-Length', String(Number.MAX_SAFE_INTEGER + 1)],
  ]) {
    await test(`${name} is rejected before buffering`, async () => {
      await assert.rejects(server.readBody(rawRequest([], { 'content-length': value })), error => error && error.status === 400);
    });
  }

  await test('declared body above effective limit returns 413 before buffering', async () => {
    config.setRuntime('server.maxBodyBytes', 128);
    try {
      await assert.rejects(server.readBody(rawRequest([], { 'content-length': '129' })), error => error && error.status === 413);
    } finally {
      config.setRuntime('server.maxBodyBytes', 1024 * 1024);
    }
  });

  await test('streamed body above effective limit returns 413 without trusting Content-Length', async () => {
    config.setRuntime('server.maxBodyBytes', 32);
    try {
      const payload = JSON.stringify({ payload: 'x'.repeat(128) });
      await assert.rejects(server.readBody(rawRequest([payload])), error => error && error.status === 413);
    } finally {
      config.setRuntime('server.maxBodyBytes', 1024 * 1024);
    }
  });

  for (const [name, payload] of [
    ['array JSON', '[1,2,3]'],
    ['string JSON', '"value"'],
    ['number JSON', '42'],
    ['null JSON', 'null'],
  ]) {
    await test(`${name} is rejected because request body must be an object`, async () => {
      await assert.rejects(server.readBody(rawRequest([payload])), error => error && error.status === 400);
    });
  }

  await test('request stream abort fails closed with 400', async () => {
    const req = new PassThrough(); req.headers = {};
    const promise = server.readBody(req);
    req.emit('aborted');
    await assert.rejects(promise, error => error && error.status === 400 && /aborted/i.test(error.message));
  });

  await test('request stream error fails closed with 400', async () => {
    const req = new PassThrough(); req.headers = {};
    const promise = server.readBody(req);
    req.emit('error', new Error('fixture stream failure'));
    await assert.rejects(promise, error => error && error.status === 400 && /read failed/i.test(error.message));
  });

  await test('API keys remain non-admin and cannot reach admin-only surfaces', async () => {
    const authConfig = new Configuration(); authConfig.loadPresets();
    authConfig.setRuntime('auth.jwtSecret', 'fixture-only-strong-jwt-secret-20260912-at-least-32-bytes');
    authConfig.setRuntime('auth.apiKeys', ['fixture-api-key']);
    const auth = new AuthMiddleware(authConfig);
    const identity = await auth.authenticate('Bearer fixture-api-key');
    assert.equal(identity.tokenType, 'api_key');
    assert.equal(identity.role, 'user');
    assert.equal(identity.permissions.includes('admin'), false);
    assert.equal(auth.authorize(identity, 'GET', '/config'), false);
    assert.equal(auth.authorize(identity, 'POST', '/auth/token'), false);
  });

  await test('authority documentation explicitly denies unsupported multi-tenant and targeted-revocation claims', async () => {
    const doc = fs.readFileSync(path.join(process.cwd(), 'docs/security/W2_HTTP_OPERATOR_AUTHORITY.md'), 'utf8');
    assert.match(doc, /single-operator\s*\/\s*single-authority-domain/i);
    assert.match(doc, /multi-tenant.*not certified|not certified.*multi-tenant/is);
    assert.match(doc, /no per-token.*revocation|no per-token `jti` denylist/i);
    assert.match(doc, /signing-key rotation/i);
    assert.match(doc, /production exposure remains \*\*UNKNOWN\*\*/i);
    assert.match(doc, /same-origin/i);
    assert.match(doc, /wildcard.*CORS|CORS.*wildcard/is);
  });

  process.stdout.write(`${JSON.stringify({ suite: 'http-trust-boundary-w2', passed, failed }, null, 2)}\n`);
  process.exitCode = failed ? 1 : 0;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
