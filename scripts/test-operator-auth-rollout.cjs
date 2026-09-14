'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = process.cwd();
const CLI = path.join(ROOT, 'packages/deployment/src/cli.ts');
const STRONG_SECRET = 'fixture-only-strong-jwt-secret-20260912-at-least-32-bytes';
const API_TOKEN = 'fixture-operator-api-token';
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

function runCli(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', CLI, ...args], {
      cwd: ROOT,
      env: {
        ...process.env,
        COS_API_TOKEN: '',
        COS_API_TOKEN_FILE: '',
        COS_JWT_SECRET: '',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('close', code => resolve({ code, stdout, stderr }));
  });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise(resolve => server.close(() => resolve()));
}

function inlineScript(html) {
  const match = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/i);
  assert.ok(match, 'nonce-bound inline operator script missing');
  return match[1];
}

(async () => {
  const requests = [];
  let acceptedToken = API_TOKEN;
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const authorization = req.headers.authorization || '';
      requests.push({ method: req.method, url: req.url, authorization, raw });
      res.setHeader('Content-Type', 'application/json');

      if (req.url === '/health') {
        res.writeHead(200);
        res.end(JSON.stringify({ system: { status: 'healthy', metrics: { cells: 1, tools: 1, memory: 0 } } }));
        return;
      }
      if (!authorization) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized or insufficient permissions' }));
        return;
      }
      if (authorization !== `Bearer ${acceptedToken}`) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden fixture' }));
        return;
      }
      if (req.url === '/process' && req.method === 'POST') {
        res.writeHead(200);
        res.end(JSON.stringify({ result: { ok: true }, confidence: 1, latency: 1 }));
        return;
      }
      if (req.url === '/auth/token' && req.method === 'POST') {
        res.writeHead(200);
        res.end(JSON.stringify({ token: 'fixture-minted-token' }));
        return;
      }
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    });
  });

  const address = await listen(server);
  const apiUrl = `http://127.0.0.1:${address.port}`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cos-operator-auth-'));

  try {
    await test('public CLI status works without credentials', async () => {
      const result = await runCli(['status'], { COS_API_URL: apiUrl });
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, /healthy/);
    });

    await test('protected CLI call fails clearly without credentials', async () => {
      const before = requests.length;
      const result = await runCli(['process', 'hello'], { COS_API_URL: apiUrl });
      assert.equal(result.code, 1);
      assert.match(result.stderr, /Authentication required or expired/i);
      const request = requests.slice(before).find(item => item.url === '/process');
      assert.ok(request);
      assert.equal(request.authorization, '');
    });

    await test('COS_API_TOKEN is sent only as bearer Authorization header', async () => {
      const before = requests.length;
      const result = await runCli(['process', 'hello'], { COS_API_URL: apiUrl, COS_API_TOKEN: API_TOKEN });
      assert.equal(result.code, 0, result.stderr);
      const request = requests.slice(before).find(item => item.url === '/process');
      assert.equal(request.authorization, `Bearer ${API_TOKEN}`);
      assert.ok(!request.url.includes(API_TOKEN));
      assert.ok(!request.raw.includes(API_TOKEN));
      assert.ok(!result.stdout.includes(API_TOKEN));
      assert.ok(!result.stderr.includes(API_TOKEN));
    });

    const { readOperatorToken, writeOperatorToken } = await import('../packages/deployment/src/operator-auth.ts');

    await test('owner-only token file is accepted and group/world-readable file is rejected', async () => {
      const tokenFile = path.join(tempDir, 'operator.jwt');
      writeOperatorToken(API_TOKEN, tokenFile);
      if (process.platform !== 'win32') assert.equal(fs.statSync(tokenFile).mode & 0o077, 0);
      assert.equal(readOperatorToken({ COS_API_TOKEN_FILE: tokenFile }), API_TOKEN);
      const result = await runCli(['process', 'file-auth'], { COS_API_URL: apiUrl, COS_API_TOKEN_FILE: tokenFile });
      assert.equal(result.code, 0, result.stderr);
      if (process.platform !== 'win32') {
        fs.chmodSync(tokenFile, 0o644);
        const rejected = await runCli(['process', 'unsafe-file'], { COS_API_URL: apiUrl, COS_API_TOKEN_FILE: tokenFile });
        assert.equal(rejected.code, 1);
        assert.match(rejected.stderr, /chmod 600|group\/world accessible/i);
        fs.chmodSync(tokenFile, 0o600);
      }
    });

    const bootstrapFile = path.join(tempDir, 'bootstrap-admin.jwt');
    await test('fresh admin bootstrap is local-only, strong-key bound and non-logging', async () => {
      const result = await runCli(['bootstrap-admin', 'fixture-admin', '--output', bootstrapFile], {
        COS_API_URL: 'http://127.0.0.1:1',
        COS_JWT_SECRET: STRONG_SECRET,
      });
      assert.equal(result.code, 0, result.stderr);
      assert.ok(fs.existsSync(bootstrapFile));
      if (process.platform !== 'win32') assert.equal(fs.statSync(bootstrapFile).mode & 0o077, 0);
      const token = fs.readFileSync(bootstrapFile, 'utf8').trim();
      assert.equal(token.split('.').length, 3);
      assert.ok(!result.stdout.includes(token));
      assert.ok(!result.stderr.includes(token));
      assert.ok(!result.stdout.includes(STRONG_SECRET));
      assert.ok(!result.stderr.includes(STRONG_SECRET));

      const { AuthMiddleware } = await import('../packages/api/src/auth.ts');
      const { Configuration } = await import('../packages/infrastructure/src/config.ts');
      const config = new Configuration(); config.loadPresets(); config.setRuntime('auth.jwtSecret', STRONG_SECRET);
      const identity = await new AuthMiddleware(config).authenticate(`Bearer ${token}`);
      assert.equal(identity.role, 'admin');
      assert.ok(identity.permissions.includes('admin'));
      acceptedToken = token;
    });

    await test('bootstrap rejects missing or weak signing key', async () => {
      const output = path.join(tempDir, 'weak.jwt');
      const result = await runCli(['bootstrap-admin', 'fixture-admin', '--output', output], { COS_JWT_SECRET: 'weak' });
      assert.equal(result.code, 1);
      assert.match(result.stderr, /strong signing key|at least 32 bytes|secret|key/i);
      assert.equal(fs.existsSync(output), false);
    });

    await test('remote token mint requires existing admin bearer and writes token without printing it', async () => {
      const mintedFile = path.join(tempDir, 'minted.jwt');
      const adminToken = fs.readFileSync(bootstrapFile, 'utf8').trim();
      const before = requests.length;
      const result = await runCli(['token', 'fixture-user', 'user', '--output', mintedFile], {
        COS_API_URL: apiUrl,
        COS_API_TOKEN: adminToken,
      });
      assert.equal(result.code, 0, result.stderr);
      const request = requests.slice(before).find(item => item.url === '/auth/token');
      assert.equal(request.authorization, `Bearer ${adminToken}`);
      assert.equal(fs.readFileSync(mintedFile, 'utf8').trim(), 'fixture-minted-token');
      assert.ok(!result.stdout.includes('fixture-minted-token'));
      assert.ok(!result.stderr.includes('fixture-minted-token'));
    });

    await test('logout deletes explicit local credential file', async () => {
      assert.ok(fs.existsSync(bootstrapFile));
      const result = await runCli(['logout', '--file', bootstrapFile]);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(fs.existsSync(bootstrapFile), false);
    });

    await test('browser operator pages use memory-only bearer auth and nonce-bound safe rendering', async () => {
      const { createOperatorActionPage, createOperatorDashboardPage } = await import('../packages/api/src/operator-ui.ts');
      const first = createOperatorDashboardPage();
      const second = createOperatorDashboardPage();
      const chat = createOperatorActionPage('COS Chat', '/chat', 'message');
      for (const page of [first, chat]) {
        assert.match(page.html, /type="password"/);
        assert.match(page.html, /Authorization/);
        assert.match(page.html, /Bearer/);
        assert.match(page.html, /textContent/);
        assert.match(page.html, /nonce="[^"]+"/);
        const script = inlineScript(page.html);
        assert.doesNotMatch(script, /localStorage\.|sessionStorage\.|document\.cookie\s*=|URLSearchParams[^\n]*(token|credential)|location\.(search|href)[^\n]*(token|credential)/i);
      }
      assert.notEqual(first.nonce, second.nonce);
      assert.ok(!fs.existsSync(path.join(ROOT, 'packages/api/src/chat.html')));
      assert.ok(!fs.existsSync(path.join(ROOT, 'packages/api/src/research.html')));
      assert.ok(!fs.existsSync(path.join(ROOT, 'packages/api/src/dashboard.html')));
      const httpSource = fs.readFileSync(path.join(ROOT, 'packages/api/src/http-server.ts'), 'utf8');
      assert.match(httpSource, /script-src 'nonce-\$\{scriptNonce\}'/);
      assert.match(httpSource, /connect-src 'self'/);
    });

    await test('credential parser rejects line-break injection', async () => {
      assert.throws(() => readOperatorToken({ COS_API_TOKEN: 'safe\nInjected: yes' }), /line break/i);
    });
  } finally {
    await close(server);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  process.stdout.write(`${JSON.stringify({ suite: 'operator-auth-rollout', passed, failed }, null, 2)}\n`);
  process.exitCode = failed ? 1 : 0;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
