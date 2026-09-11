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
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('close', code => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, killed });
    });
  });
}

function exportLoader(modulePath, exportName) {
  return `
    const __integrationModule = await import(${JSON.stringify(modulePath)});
    const ${exportName} = __integrationModule.${exportName} ?? __integrationModule.default?.${exportName};
    if (typeof ${exportName} !== 'function') {
      throw new Error(${JSON.stringify(exportName)} + ' export unavailable: ' + Object.keys(__integrationModule).join(','));
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
      checks.push({ name, status: 'FAIL' });
      failures.push({ name, message });
      process.stdout.write(`FAIL ${name}: ${message}\n`);
    }
  }

  await check('W1C host global isolation is preserved', async () => {
    const result = await runNode(`${exportLoader('./packages/execution/src/sandbox.ts', 'CodeSandbox')}
      globalThis.__cgev11Sentinel = 'clean';
      const sandbox = new CodeSandbox({ timeout: 500, maxCpu: 500, maxMemory: 64 });
      const receipt = await sandbox.execute("globalThis.__cgev11Sentinel = 'pwned'; 'done'");
      process.stdout.write(JSON.stringify({ receipt, sentinel: globalThis.__cgev11Sentinel }));`);
    assert.equal(result.killed, false);
    assert.equal(result.code, 0, result.stderr);
    const value = jsonFromStdout(result);
    assert.equal(value.sentinel, 'clean');
    assert.equal(value.receipt.exitCode, 0, JSON.stringify(value.receipt));
  });

  await check('W1C host prototype isolation is preserved', async () => {
    const result = await runNode(`${exportLoader('./packages/execution/src/sandbox.ts', 'CodeSandbox')}
      delete Object.prototype.__cgev11Polluted;
      const sandbox = new CodeSandbox({ timeout: 500, maxCpu: 500, maxMemory: 64 });
      const receipt = await sandbox.execute("Object.prototype.__cgev11Polluted = 'yes'; 'done'");
      process.stdout.write(JSON.stringify({ receipt, polluted: Object.prototype.__cgev11Polluted ?? null }));`);
    const value = jsonFromStdout(result);
    assert.equal(value.polluted, null);
    assert.equal(value.receipt.exitCode, 0, JSON.stringify(value.receipt));
  });

  await check('W1C host console identity survives sandbox exceptions', async () => {
    const result = await runNode(`${exportLoader('./packages/execution/src/sandbox.ts', 'CodeSandbox')}
      const before = console.log;
      const sandbox = new CodeSandbox({ timeout: 500, maxCpu: 500, maxMemory: 64 });
      const receipt = await sandbox.execute("console.log('captured'); throw new Error('boom')");
      process.stdout.write(JSON.stringify({ receipt, restored: console.log === before }));`);
    const value = jsonFromStdout(result);
    assert.equal(value.restored, true);
    assert.notEqual(value.receipt.exitCode, 0);
  });

  await check('W1C numeric resource validation remains fail-fast', async () => {
    const result = await runNode(`${exportLoader('./packages/execution/src/sandbox.ts', 'CodeSandbox')}
      let receipt;
      try { new CodeSandbox({ maxMemory: 8 }); receipt = { threw: false }; }
      catch (error) { receipt = { threw: true, name: error.name, message: error.message }; }
      process.stdout.write(JSON.stringify(receipt));`);
    const value = jsonFromStdout(result);
    assert.equal(value.threw, true, JSON.stringify(value));
    assert.equal(value.name, 'RangeError');
    assert.match(value.message, /maxMemory/i);
  });

  await check('W1C malformed module capability validation remains fail-fast', async () => {
    const result = await runNode(`${exportLoader('./packages/execution/src/sandbox.ts', 'CodeSandbox')}
      let receipt;
      try { new CodeSandbox({ allowedModules: ['node:fs', 42] }); receipt = { threw: false }; }
      catch (error) { receipt = { threw: true, name: error.name, message: error.message }; }
      process.stdout.write(JSON.stringify(receipt));`);
    const value = jsonFromStdout(result);
    assert.equal(value.threw, true, JSON.stringify(value));
    assert.equal(value.name, 'TypeError');
    assert.match(value.message, /allowedModules/i);
  });

  await check('W1C unsupported language remains fail-closed', async () => {
    const result = await runNode(`${exportLoader('./packages/execution/src/sandbox.ts', 'CodeSandbox')}
      const sandbox = new CodeSandbox({ timeout: 500, maxCpu: 500, maxMemory: 64 });
      const receipt = await sandbox.execute('print(1)', 'python');
      process.stdout.write(JSON.stringify(receipt));`);
    const receipt = jsonFromStdout(result);
    assert.notEqual(receipt.exitCode, 0, JSON.stringify(receipt));
  });

  await check('W1C public execution export retains hardened sandbox semantics', async () => {
    const result = await runNode(`${exportLoader('./packages/execution/src/tool-runtime.ts', 'CodeSandbox')}
      const sandbox = new CodeSandbox({ timeout: 500, maxCpu: 500, maxMemory: 64 });
      const receipt = await sandbox.execute("({ processType: typeof process })");
      process.stdout.write(JSON.stringify(receipt));`);
    const receipt = jsonFromStdout(result);
    assert.equal(receipt.exitCode, 0, JSON.stringify(receipt));
    assert.match(receipt.stdout, /undefined/);
  });

  await check('W1C ToolRegistry API remains present while W1D default-deny dominates', async () => {
    const result = await runNode(`${exportLoader('./packages/execution/src/tool-runtime.ts', 'ToolRegistry')}
      const registry = new ToolRegistry();
      const fsTool = registry.get('filesystem');
      const all = registry.getAll().map(tool => tool.definition.name);
      const definitions = registry.getDefinitions().map(definition => definition.name);
      let denial = null;
      try { await registry.execute('filesystem', { operation: 'exists', path: '__integration_probe__' }, { traceId: 'w3.1' }); }
      catch (error) { denial = { code: error.code, name: error.name, message: error.message }; }
      process.stdout.write(JSON.stringify({ fsTool: fsTool?.definition.name, all, definitions, denial }));`);
    const value = jsonFromStdout(result);
    assert.equal(value.fsTool, 'filesystem');
    assert.ok(value.all.includes('filesystem'));
    assert.ok(value.definitions.includes('filesystem'));
    assert.equal(value.denial?.code, 'TOOL_CAPABILITY_DENIED', JSON.stringify(value.denial));
  });

  const receipt = {
    suite: 'sandbox-security-integration-carry-forward',
    node: process.version,
    semantics: 'W1C missing/superseded checks carried forward through portable module resolution; W1D authority wins on ToolRegistry',
    checks,
    failed: failures.length,
  };
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
