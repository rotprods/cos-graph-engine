const assert = require('node:assert/strict');

async function loadSandbox() {
  const module = await import('../packages/execution/src/sandbox.ts');
  const CodeSandbox = module.CodeSandbox ?? module.default?.CodeSandbox;
  assert.equal(typeof CodeSandbox, 'function', 'CodeSandbox export unavailable');
  return CodeSandbox;
}

async function main() {
  const CodeSandbox = await loadSandbox();
  const checks = [];

  async function check(name, fn) {
    await fn();
    checks.push({ name, status: 'PASS' });
    process.stdout.write(`PASS ${name}\n`);
  }

  await check('instrumented deterministic execution', async () => {
    const sandbox = new CodeSandbox({ timeout: 2000, maxCpu: 2000, maxMemory: 64, maxOutput: 4096 });
    const result = await sandbox.execute("console.log('coverage'); 6 * 7");
    assert.equal(result.exitCode, 0, JSON.stringify(result));
    assert.match(result.stdout, /coverage/);
    assert.match(result.stdout, /42/);
  });

  await check('instrumented code-generation denial', async () => {
    const sandbox = new CodeSandbox({ timeout: 2000, maxCpu: 2000, maxMemory: 64 });
    const direct = await sandbox.execute("Function('return 7')()");
    assert.notEqual(direct.exitCode, 0, 'Function constructor unexpectedly executed');
    const escape = await sandbox.execute("(() => { try { return this.constructor.constructor('return process')().version } catch (error) { return 'blocked:' + error.name } })()");
    assert.equal(escape.exitCode, 0, JSON.stringify(escape));
    assert.match(escape.stdout, /blocked:/);
  });

  await check('instrumented dynamic-import denial', async () => {
    const sandbox = new CodeSandbox({ timeout: 2000, maxCpu: 2000, maxMemory: 64 });
    const result = await sandbox.execute("import('node:fs').then(() => 'imported', error => 'blocked:' + error.code)");
    assert.equal(result.exitCode, 0, JSON.stringify(result));
    assert.match(result.stdout, /blocked:/);
  });

  await check('instrumented output bounding', async () => {
    const maxOutput = 1024;
    const sandbox = new CodeSandbox({ timeout: 2500, maxCpu: 2500, maxMemory: 64, maxOutput });
    const result = await sandbox.execute("for (let i=0;i<3000;i++) console.log('💥')");
    assert.notEqual(result.exitCode, 0);
    assert.ok(Buffer.byteLength(result.stdout ?? '', 'utf8') <= maxOutput);
    assert.ok(Buffer.byteLength(result.stderr ?? '', 'utf8') <= maxOutput);
    assert.match(JSON.stringify(result), /SANDBOX_OUTPUT_LIMIT/);
  });

  await check('instrumented capability denial', async () => {
    for (const config of [
      { filesystemAccess: true },
      { networkAccess: true },
      { allowedModules: ['node:fs'] },
    ]) {
      const sandbox = new CodeSandbox(config);
      const result = await sandbox.execute("'must-not-run'");
      assert.notEqual(result.exitCode, 0);
      assert.match(JSON.stringify(result), /POLICY|CAPABILITY|DENIED|unsupported/i);
    }
  });

  await check('instrumented config copy/update/validation', async () => {
    const sandbox = new CodeSandbox({ maxOutput: 1024, timeout: 2000, allowedModules: [] });
    const leaked = sandbox.getConfig();
    leaked.allowedModules.push('node:fs');
    assert.deepEqual(sandbox.getConfig().allowedModules, []);
    sandbox.updateConfig({ maxOutput: 2048, timeout: 2200 });
    assert.equal(sandbox.getConfig().maxOutput, 2048);
    assert.equal(sandbox.getConfig().timeout, 2200);
    assert.throws(() => new CodeSandbox({ allowedModules: ['node:fs', 42] }), TypeError);
    assert.throws(() => new CodeSandbox({ maxMemory: 8 }), RangeError);
  });

  await check('instrumented framing remains unambiguous', async () => {
    const marker = '__COS_SANDBOX_RESULT__';
    const sandbox = new CodeSandbox({ timeout: 2000, maxCpu: 2000, maxMemory: 64 });
    const result = await sandbox.execute(`console.log('${marker}'); '${marker}'`);
    assert.equal(result.exitCode, 0, JSON.stringify(result));
    assert.equal(result.error, null, JSON.stringify(result));
    assert.match(result.stdout, /__COS_SANDBOX_RESULT__/);
  });

  await check('instrumented unsupported language denial', async () => {
    const sandbox = new CodeSandbox({ timeout: 2000, maxCpu: 2000, maxMemory: 64 });
    const result = await sandbox.execute('print(1)', 'python');
    assert.notEqual(result.exitCode, 0);
  });

  await check('instrumented unavailable runtime fails closed', async () => {
    const previousPath = process.env.PATH;
    try {
      process.env.PATH = '/cgev11-intentionally-missing-docker';
      const sandbox = new CodeSandbox({ timeout: 1000, maxCpu: 1000, maxMemory: 64 });
      const result = await sandbox.execute('7');
      assert.notEqual(result.exitCode, 0);
      assert.equal(result.error?.code, 'SANDBOX_RUNTIME_UNAVAILABLE');
    } finally {
      process.env.PATH = previousPath;
    }
  });

  process.stdout.write(`${JSON.stringify({
    suite: 'sandbox-coverage-integration',
    purpose: 'coverage-only instrumentation with relaxed wall-clock budgets; strict timing/security semantics remain owned by test-sandbox-security-w1d5.cjs outside c8',
    node: process.version,
    checks,
    result: 'PASS',
  }, null, 2)}\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
