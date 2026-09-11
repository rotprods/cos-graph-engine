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

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, killed });
    });
  });
}

function jsonFromStdout(result) {
  const line = result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  assert.ok(line, `missing JSON receipt; stderr=${result.stderr}`);
  return JSON.parse(line);
}

const directImport = `const { CodeSandbox } = await import('./packages/execution/src/sandbox.ts');`;
const publicImport = `const { CodeSandbox } = await import('./packages/execution/src/tool-runtime.ts');`;

async function main() {
  const failures = [];
  const checks = [];

  async function check(name, fn) {
    try {
      await fn();
      checks.push({ name, status: 'PASS' });
      process.stdout.write(`PASS ${name}\n`);
    } catch (error) {
      failures.push({ name, message: error instanceof Error ? error.message : String(error) });
      checks.push({ name, status: 'FAIL' });
      process.stdout.write(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  await check('deterministic JavaScript executes in canonical direct sandbox', async () => {
    const r = await runNode(`${directImport}
      const s = new CodeSandbox({ timeout: 500, maxCpu: 500, maxOutput: 4096, maxMemory: 64 });
      const out = await s.execute("console.log('hello'); 21 * 2");
      process.stdout.write(JSON.stringify(out));`);
    assert.equal(r.killed, false, 'execution process was killed');
    assert.equal(r.code, 0, r.stderr);
    const out = jsonFromStdout(r);
    assert.equal(out.exitCode, 0, JSON.stringify(out));
    assert.match(out.stdout, /hello/);
    assert.match(out.stdout, /42/);
  });

  await check('sandbox cannot mutate host global state', async () => {
    const r = await runNode(`${directImport}
      globalThis.__cosW1cSentinel = 'clean';
      const s = new CodeSandbox({ timeout: 500, maxCpu: 500 });
      const out = await s.execute("globalThis.__cosW1cSentinel = 'pwned'; 'done'");
      process.stdout.write(JSON.stringify({ result: out, sentinel: globalThis.__cosW1cSentinel }));`);
    assert.equal(r.killed, false, 'execution process was killed');
    const out = jsonFromStdout(r);
    assert.equal(out.sentinel, 'clean', 'untrusted code mutated host global');
  });

  await check('sandbox cannot pollute host prototypes', async () => {
    const r = await runNode(`${directImport}
      delete Object.prototype.__cosW1cPolluted;
      const s = new CodeSandbox({ timeout: 500, maxCpu: 500 });
      const result = await s.execute("Object.prototype.__cosW1cPolluted = 'yes'; 'done'");
      process.stdout.write(JSON.stringify({ result, polluted: Object.prototype.__cosW1cPolluted ?? null }));`);
    assert.equal(r.killed, false, 'execution process was killed');
    const out = jsonFromStdout(r);
    assert.equal(out.polluted, null, 'untrusted code polluted host Object.prototype');
  });

  await check('host console is restored after sandbox exception', async () => {
    const r = await runNode(`${directImport}
      const before = console.log;
      const s = new CodeSandbox({ timeout: 500, maxCpu: 500 });
      const result = await s.execute("console.log('captured'); throw new Error('boom')");
      process.stdout.write(JSON.stringify({ result, restored: console.log === before }));`);
    assert.equal(r.killed, false, 'execution process was killed');
    const out = jsonFromStdout(r);
    assert.equal(out.restored, true, 'host console.log remained monkey-patched');
  });

  await check('sandbox has no process or inherited secret authority', async () => {
    const r = await runNode(`${directImport}
      const s = new CodeSandbox({ timeout: 500, maxCpu: 500 });
      const result = await s.execute("({ processType: typeof process, secret: typeof process === 'undefined' ? null : process.env.COS_W1C_SECRET })");
      process.stdout.write(JSON.stringify(result));`, { env: { COS_W1C_SECRET: 'W1C_MUST_NOT_LEAK' } });
    assert.equal(r.killed, false, 'execution process was killed');
    const out = jsonFromStdout(r);
    assert.equal(out.exitCode, 0, JSON.stringify(out));
    assert.match(out.stdout, /undefined/);
    assert.doesNotMatch(out.stdout, /W1C_MUST_NOT_LEAK/);
  });

  await check('dynamic string code generation is blocked', async () => {
    const r = await runNode(`${directImport}
      const s = new CodeSandbox({ timeout: 500, maxCpu: 500 });
      const result = await s.execute("Function('return 7')()");
      process.stdout.write(JSON.stringify(result));`);
    assert.equal(r.killed, false, 'execution process was killed');
    const out = jsonFromStdout(r);
    assert.notEqual(out.exitCode, 0, 'Function constructor unexpectedly executed');
  });

  await check('synchronous infinite loop is hard-terminated by sandbox', async () => {
    const r = await runNode(`${directImport}
      const s = new CodeSandbox({ timeout: 150, maxCpu: 150, maxMemory: 64 });
      const result = await s.execute('while (true) {}');
      process.stdout.write(JSON.stringify(result));`, { timeout: 1800 });
    assert.equal(r.killed, false, 'outer harness had to kill the host process; sandbox did not terminate runaway code');
    assert.equal(r.code, 0, r.stderr);
    const out = jsonFromStdout(r);
    assert.notEqual(out.exitCode, 0, 'runaway loop reported success');
  });

  await check('unresolved async execution is hard-terminated', async () => {
    const r = await runNode(`${directImport}
      const s = new CodeSandbox({ timeout: 150, maxCpu: 150, maxMemory: 64 });
      const result = await s.execute('new Promise(() => {})');
      process.stdout.write(JSON.stringify(result));`, { timeout: 1800 });
    assert.equal(r.killed, false, 'outer harness had to kill the host process; sandbox did not terminate async hang');
    assert.equal(r.code, 0, r.stderr);
    const out = jsonFromStdout(r);
    assert.notEqual(out.exitCode, 0, 'async hang reported success');
  });

  await check('output flood is bounded and fails closed', async () => {
    const maxOutput = 1024;
    const r = await runNode(`${directImport}
      const s = new CodeSandbox({ timeout: 500, maxCpu: 500, maxOutput: ${maxOutput}, maxMemory: 64 });
      const result = await s.execute("for (let i=0;i<10000;i++) console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')");
      process.stdout.write(JSON.stringify(result));`);
    assert.equal(r.killed, false, 'execution process was killed by outer harness');
    const out = jsonFromStdout(r);
    assert.ok(Buffer.byteLength(out.stdout ?? '') <= maxOutput, `stdout exceeded limit: ${Buffer.byteLength(out.stdout ?? '')}`);
    assert.notEqual(out.exitCode, 0, 'output flood should terminate/fail closed rather than silently truncate success');
  });

  for (const [name, config] of [
    ['filesystem grant request', { filesystemAccess: true }],
    ['network grant request', { networkAccess: true }],
    ['module grant request', { allowedModules: ['node:fs'] }],
  ]) {
    await check(`${name} fails closed in W1C profile`, async () => {
      const encoded = JSON.stringify(config);
      const r = await runNode(`${directImport}
        const s = new CodeSandbox(${encoded});
        const result = await s.execute("'should-not-run'");
        process.stdout.write(JSON.stringify(result));`);
      assert.equal(r.killed, false, 'execution process was killed');
      const out = jsonFromStdout(r);
      assert.notEqual(out.exitCode, 0, `${name} was silently granted`);
      assert.match(JSON.stringify(out), /POLICY|CAPABILITY|DENIED|unsupported/i);
    });
  }

  await check('unsupported languages fail closed', async () => {
    const r = await runNode(`${directImport}
      const s = new CodeSandbox();
      const result = await s.execute('print(1)', 'python');
      process.stdout.write(JSON.stringify(result));`);
    assert.equal(r.killed, false, 'execution process was killed');
    const out = jsonFromStdout(r);
    assert.notEqual(out.exitCode, 0);
  });

  await check('public execution export uses the same hardened sandbox semantics', async () => {
    const r = await runNode(`${publicImport}
      const s = new CodeSandbox({ timeout: 150, maxCpu: 150, maxMemory: 64 });
      const result = await s.execute("({ processType: typeof process })");
      process.stdout.write(JSON.stringify(result));`);
    assert.equal(r.killed, false, 'execution process was killed');
    const out = jsonFromStdout(r);
    assert.equal(out.exitCode, 0, JSON.stringify(out));
    assert.match(out.stdout, /undefined/);
  });

  const receipt = { suite: 'sandbox-security-w1c', checks, failed: failures.length };
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (failures.length > 0) {
    process.stderr.write(`${JSON.stringify({ failures }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
