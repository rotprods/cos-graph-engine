const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');

const ROOT = process.cwd();
const LOADER = ['--import', 'tsx'];
const DEFAULT_OUTER_TIMEOUT_MS = 2500;

function runNode(source, { timeout = DEFAULT_OUTER_TIMEOUT_MS, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...LOADER, '-e', source], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, timeout);
    timer.unref?.();
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('close', code => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, killed });
    });
  });
}

function sandboxLoader(modulePath) {
  return `
    const __sandboxModule = await import(${JSON.stringify(modulePath)});
    const CodeSandbox = __sandboxModule.CodeSandbox ?? __sandboxModule.default?.CodeSandbox;
    if (typeof CodeSandbox !== 'function') {
      throw new Error('CodeSandbox export unavailable: ' + Object.keys(__sandboxModule).join(','));
    }
  `;
}

function jsonFromStdout(result) {
  const line = result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  assert.ok(line, `missing JSON receipt; stderr=${result.stderr}`);
  return JSON.parse(line);
}

async function main() {
  const checks = [];
  const failures = [];

  async function check(name, fn) {
    try {
      await fn();
      checks.push({ name, status: 'PASS' });
      process.stdout.write(`PASS ${name}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ name, message });
      checks.push({ name, status: 'FAIL' });
      process.stdout.write(`FAIL ${name}: ${message}\n`);
    }
  }

  await check('direct and public sandbox exports are constructible', async () => {
    for (const modulePath of ['./packages/execution/src/sandbox.ts', './packages/execution/src/tool-runtime.ts']) {
      const result = await runNode(`${sandboxLoader(modulePath)}
        const sandbox = new CodeSandbox({ timeout: 500, maxCpu: 500, maxMemory: 64 });
        process.stdout.write(JSON.stringify({ ok: typeof sandbox.execute === 'function' }));`);
      assert.equal(result.killed, false);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(jsonFromStdout(result).ok, true);
    }
  });

  await check('deterministic JavaScript executes inside pinned container boundary', async () => {
    const result = await runNode(`${sandboxLoader('./packages/execution/src/sandbox.ts')}
      const sandbox = new CodeSandbox({ timeout: 500, maxCpu: 500, maxMemory: 64, maxOutput: 4096 });
      const receipt = await sandbox.execute("console.log('hello'); 21 * 2");
      process.stdout.write(JSON.stringify(receipt));`);
    assert.equal(result.killed, false);
    assert.equal(result.code, 0, result.stderr);
    const receipt = jsonFromStdout(result);
    assert.equal(receipt.exitCode, 0, JSON.stringify(receipt));
    assert.match(receipt.stdout, /hello/);
    assert.match(receipt.stdout, /42/);
  });

  await check('host process and inherited secret authority are absent', async () => {
    const result = await runNode(`${sandboxLoader('./packages/execution/src/sandbox.ts')}
      const sandbox = new CodeSandbox({ timeout: 500, maxCpu: 500, maxMemory: 64 });
      const receipt = await sandbox.execute("({ processType: typeof process, secret: typeof process === 'undefined' ? null : process.env.COS_W1D5_SECRET })");
      process.stdout.write(JSON.stringify(receipt));`, { env: { COS_W1D5_SECRET: 'MUST_NOT_LEAK' } });
    const receipt = jsonFromStdout(result);
    assert.equal(receipt.exitCode, 0, JSON.stringify(receipt));
    assert.match(receipt.stdout, /undefined/);
    assert.doesNotMatch(receipt.stdout, /MUST_NOT_LEAK/);
  });

  await check('string code generation and constructor escape remain blocked', async () => {
    const result = await runNode(`${sandboxLoader('./packages/execution/src/sandbox.ts')}
      const sandbox = new CodeSandbox({ timeout: 600, maxCpu: 600, maxMemory: 64 });
      const direct = await sandbox.execute("Function('return 7')()");
      const constructorEscape = await sandbox.execute("(() => { try { return this.constructor.constructor('return process')().version } catch (error) { return 'blocked:' + error.name } })()");
      process.stdout.write(JSON.stringify({ direct, constructorEscape }));`);
    const receipt = jsonFromStdout(result);
    assert.notEqual(receipt.direct.exitCode, 0, 'Function constructor unexpectedly executed');
    assert.equal(receipt.constructorEscape.exitCode, 0, JSON.stringify(receipt.constructorEscape));
    assert.match(receipt.constructorEscape.stdout, /blocked:/);
    assert.doesNotMatch(receipt.constructorEscape.stdout, /v\d+\.\d+\.\d+/);
  });

  await check('dynamic import remains unavailable to untrusted code', async () => {
    const result = await runNode(`${sandboxLoader('./packages/execution/src/sandbox.ts')}
      const sandbox = new CodeSandbox({ timeout: 600, maxCpu: 600, maxMemory: 64 });
      const receipt = await sandbox.execute("import('node:fs').then(() => 'imported', error => 'blocked:' + error.code)");
      process.stdout.write(JSON.stringify(receipt));`);
    const receipt = jsonFromStdout(result);
    assert.equal(receipt.exitCode, 0, JSON.stringify(receipt));
    assert.match(receipt.stdout, /blocked:/);
    assert.doesNotMatch(receipt.stdout, /imported/);
  });

  await check('synchronous and asynchronous hangs are hard-terminated', async () => {
    for (const source of ['while (true) {}', 'new Promise(() => {})']) {
      const result = await runNode(`${sandboxLoader('./packages/execution/src/sandbox.ts')}
        const sandbox = new CodeSandbox({ timeout: 150, maxCpu: 150, maxMemory: 64 });
        const receipt = await sandbox.execute(${JSON.stringify(source)});
        process.stdout.write(JSON.stringify(receipt));`, { timeout: 1800 });
      assert.equal(result.killed, false, 'outer harness had to kill host process');
      assert.equal(result.code, 0, result.stderr);
      assert.notEqual(jsonFromStdout(result).exitCode, 0, 'runaway execution reported success');
    }
  });

  await check('multibyte output flood is byte-bounded and fails closed', async () => {
    const maxOutput = 1024;
    const result = await runNode(`${sandboxLoader('./packages/execution/src/sandbox.ts')}
      const sandbox = new CodeSandbox({ timeout: 800, maxCpu: 800, maxMemory: 64, maxOutput: ${maxOutput} });
      const receipt = await sandbox.execute("for (let i=0;i<3000;i++) console.log('💥')");
      process.stdout.write(JSON.stringify(receipt));`);
    const receipt = jsonFromStdout(result);
    assert.notEqual(receipt.exitCode, 0);
    assert.ok(Buffer.byteLength(receipt.stdout ?? '', 'utf8') <= maxOutput);
    assert.ok(Buffer.byteLength(receipt.stderr ?? '', 'utf8') <= maxOutput);
    assert.match(JSON.stringify(receipt), /SANDBOX_OUTPUT_LIMIT/);
  });

  await check('filesystem network and module grants fail closed', async () => {
    for (const config of [
      { filesystemAccess: true },
      { networkAccess: true },
      { allowedModules: ['node:fs'] },
    ]) {
      const result = await runNode(`${sandboxLoader('./packages/execution/src/sandbox.ts')}
        const sandbox = new CodeSandbox(${JSON.stringify(config)});
        const receipt = await sandbox.execute("'must-not-run'");
        process.stdout.write(JSON.stringify(receipt));`);
      const receipt = jsonFromStdout(result);
      assert.notEqual(receipt.exitCode, 0);
      assert.match(JSON.stringify(receipt), /POLICY|CAPABILITY|DENIED|unsupported/i);
    }
  });

  await check('config API remains defensive and validates malformed policy', async () => {
    const result = await runNode(`${sandboxLoader('./packages/execution/src/sandbox.ts')}
      const sandbox = new CodeSandbox({ maxOutput: 1024, timeout: 500, allowedModules: [] });
      const leaked = sandbox.getConfig(); leaked.allowedModules.push('node:fs');
      const before = sandbox.getConfig();
      sandbox.updateConfig({ maxOutput: 2048, timeout: 750 });
      let malformed = null;
      try { new CodeSandbox({ allowedModules: ['node:fs', 42] }); } catch (error) { malformed = { name: error.name, message: error.message }; }
      process.stdout.write(JSON.stringify({ before, after: sandbox.getConfig(), malformed }));`);
    const receipt = jsonFromStdout(result);
    assert.deepEqual(receipt.before.allowedModules, []);
    assert.equal(receipt.after.maxOutput, 2048);
    assert.equal(receipt.after.timeout, 750);
    assert.equal(receipt.malformed.name, 'TypeError');
  });

  await check('protocol marker-looking output cannot desynchronize framing', async () => {
    const marker = '__COS_SANDBOX_RESULT__';
    const result = await runNode(`${sandboxLoader('./packages/execution/src/sandbox.ts')}
      const sandbox = new CodeSandbox({ timeout: 500, maxCpu: 500, maxMemory: 64 });
      const receipt = await sandbox.execute("console.log('${marker}'); '${marker}'");
      process.stdout.write(JSON.stringify(receipt));`);
    const receipt = jsonFromStdout(result);
    assert.equal(receipt.exitCode, 0, JSON.stringify(receipt));
    assert.equal(receipt.error, null, JSON.stringify(receipt));
    assert.match(receipt.stdout, /__COS_SANDBOX_RESULT__/);
  });

  await check('missing Docker runtime fails closed without host fallback', async () => {
    const result = await runNode(`${sandboxLoader('./packages/execution/src/sandbox.ts')}
      globalThis.__w1d5Sentinel = 'clean';
      const sandbox = new CodeSandbox({ timeout: 300, maxCpu: 300, maxMemory: 64 });
      const receipt = await sandbox.execute("globalThis.__w1d5Sentinel = 'pwned'; 7");
      process.stdout.write(JSON.stringify({ receipt, sentinel: globalThis.__w1d5Sentinel }));`, {
      env: { PATH: '/cos-w1d5-intentionally-missing-runtime' },
    });
    const value = jsonFromStdout(result);
    assert.equal(value.sentinel, 'clean');
    assert.notEqual(value.receipt.exitCode, 0);
    assert.equal(value.receipt.error?.code, 'SANDBOX_RUNTIME_UNAVAILABLE');
  });

  const receipt = { suite: 'sandbox-security-w1d5-compat', node: process.version, checks, failed: failures.length };
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (failures.length) {
    process.stderr.write(`${JSON.stringify({ failures }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
