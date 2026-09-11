const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');

const ROOT = process.cwd();
const LOADER = ['--import', 'tsx'];
const DEFAULT_OUTER_TIMEOUT_MS = 3000;

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

async function main() {
  const failures = [];
  const checks = [];

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

  await check('multibyte UTF-8 flood is byte-bounded and fails closed', async () => {
    const maxOutput = 1024;
    const result = await runNode(`
      const { CodeSandbox } = await import('./packages/execution/src/sandbox.ts');
      const sandbox = new CodeSandbox({ timeout: 800, maxCpu: 800, maxOutput: ${maxOutput}, maxMemory: 64 });
      const receipt = await sandbox.execute("for (let i = 0; i < 2000; i++) console.log('💥')");
      process.stdout.write(JSON.stringify(receipt));
    `);
    assert.equal(result.killed, false, 'outer harness killed multibyte flood');
    assert.equal(result.code, 0, result.stderr);
    const receipt = jsonFromStdout(result);
    assert.notEqual(receipt.exitCode, 0, 'multibyte flood silently succeeded');
    assert.ok(Buffer.byteLength(receipt.stdout ?? '', 'utf8') <= maxOutput, 'stdout exceeded byte limit');
    assert.ok(Buffer.byteLength(receipt.stderr ?? '', 'utf8') <= maxOutput, 'stderr exceeded byte limit');
    assert.match(JSON.stringify(receipt), /SANDBOX_OUTPUT_LIMIT/);
  });

  await check('constructor and dynamic-import escape paths remain denied', async () => {
    const result = await runNode(`
      const { CodeSandbox } = await import('./packages/execution/src/sandbox.ts');
      const sandbox = new CodeSandbox({ timeout: 800, maxCpu: 800, maxMemory: 64 });
      const constructorEscape = await sandbox.execute("(() => { try { return this.constructor.constructor('return process')().version } catch (error) { return 'blocked:' + error.name } })()");
      const dynamicImport = await sandbox.execute("import('node:fs').then(() => 'imported', (error) => 'blocked:' + error.code)");
      process.stdout.write(JSON.stringify({ constructorEscape, dynamicImport }));
    `);
    assert.equal(result.killed, false, 'escape-path case hung');
    assert.equal(result.code, 0, result.stderr);
    const receipt = jsonFromStdout(result);
    assert.equal(receipt.constructorEscape.exitCode, 0, JSON.stringify(receipt.constructorEscape));
    assert.match(receipt.constructorEscape.stdout, /blocked:/);
    assert.doesNotMatch(receipt.constructorEscape.stdout, /v\d+\.\d+\.\d+/);
    assert.equal(receipt.dynamicImport.exitCode, 0, JSON.stringify(receipt.dynamicImport));
    assert.match(receipt.dynamicImport.stdout, /blocked:/);
    assert.doesNotMatch(receipt.dynamicImport.stdout, /imported/);
  });

  await check('CodeSandbox config API is defensive and updateable', async () => {
    const result = await runNode(`
      const { CodeSandbox } = await import('./packages/execution/src/sandbox.ts');
      const sandbox = new CodeSandbox({ maxOutput: 1024, timeout: 500, allowedModules: [] });
      const leaked = sandbox.getConfig();
      leaked.allowedModules.push('node:fs');
      const before = sandbox.getConfig();
      sandbox.updateConfig({ maxOutput: 2048, timeout: 750 });
      const after = sandbox.getConfig();
      process.stdout.write(JSON.stringify({ before, after }));
    `);
    assert.equal(result.killed, false, 'config API case hung');
    assert.equal(result.code, 0, result.stderr);
    const receipt = jsonFromStdout(result);
    assert.deepEqual(receipt.before.allowedModules, [], 'getConfig leaked mutable policy state');
    assert.equal(receipt.before.maxOutput, 1024);
    assert.equal(receipt.after.maxOutput, 2048);
    assert.equal(receipt.after.timeout, 750);
  });

  await check('ToolRegistry compatibility surface remains executable after sandbox deduplication', async () => {
    const result = await runNode(`
      const { ToolRegistry } = await import('./packages/execution/src/tool-runtime.ts');
      const registry = new ToolRegistry();
      const fsTool = registry.get('filesystem');
      const all = registry.getAll().map((tool) => tool.definition.name);
      const definitions = registry.getDefinitions().map((definition) => definition.name);
      const receipt = await registry.execute('filesystem', { operation: 'exists', path: './__w1c_nonexistent_probe__' }, {});
      process.stdout.write(JSON.stringify({ fsTool: fsTool?.definition.name, all, definitions, receipt }));
    `);
    assert.equal(result.killed, false, 'ToolRegistry compatibility case hung');
    assert.equal(result.code, 0, result.stderr);
    const receipt = jsonFromStdout(result);
    assert.equal(receipt.fsTool, 'filesystem');
    assert.ok(receipt.all.includes('filesystem'));
    assert.ok(receipt.definitions.includes('filesystem'));
    assert.equal(receipt.receipt.success, true);
    assert.equal(receipt.receipt.output.exists, false);
  });

  const receipt = { suite: 'sandbox-security-w1c-hardening', checks, failed: failures.length };
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
