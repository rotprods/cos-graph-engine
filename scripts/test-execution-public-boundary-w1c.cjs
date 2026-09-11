'use strict';
const assert = require('node:assert/strict');
const { CodeSandbox } = require('../packages/execution/src/sandbox.ts');
const { ToolRegistry, FileSystemTool } = require('../packages/execution/src/tool-runtime.ts');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

(async () => {
  await test('sandbox getConfig returns a detached capability snapshot', () => {
    const sandbox = new CodeSandbox({ maxMemory: 64, allowedModules: [] });
    const first = sandbox.getConfig();
    first.allowedModules.push('node:fs');
    const second = sandbox.getConfig();
    assert.equal(second.maxMemory, 64);
    assert.deepEqual(second.allowedModules, []);
  });

  await test('sandbox updateConfig revalidates and atomically replaces accepted values', () => {
    const sandbox = new CodeSandbox({ maxMemory: 64, maxOutput: 4096 });
    sandbox.updateConfig({ maxMemory: 128, maxOutput: 8192 });
    const config = sandbox.getConfig();
    assert.equal(config.maxMemory, 128);
    assert.equal(config.maxOutput, 8192);
    assert.throws(() => sandbox.updateConfig({ maxMemory: 8 }), /maxMemory/i);
    assert.equal(sandbox.getConfig().maxMemory, 128, 'invalid update changed live config');
  });

  await test('tool registry exposes canonical built-in definitions without executing them', () => {
    const registry = new ToolRegistry();
    assert.equal(registry.get('filesystem')?.definition.name, 'filesystem');
    const names = registry.getDefinitions().map(definition => definition.name).sort();
    assert.deepEqual(names, ['filesystem', 'http_client', 'search']);
  });

  await test('tool registry rejects unknown tools before dispatch', async () => {
    const registry = new ToolRegistry();
    await assert.rejects(
      registry.execute('definitely-not-a-tool', {}, { traceId: 'w1c-public-boundary' }),
      error => error && error.code === 'TOOL_NOT_FOUND',
    );
  });

  await test('filesystem exists probe is read-only and returns through canonical success envelope', async () => {
    const tool = new FileSystemTool();
    const target = `/tmp/cos-w1c-public-boundary-${process.pid}-does-not-exist`;
    const result = await tool.execute(
      { operation: 'exists', path: target },
      { traceId: 'w1c-public-boundary' },
    );
    assert.equal(result.success, true);
    assert.equal(result.output.exists, false);
    assert.equal(result.output.isDirectory, false);
    assert.equal(result.output.isFile, false);
  });

  console.log(JSON.stringify({ suite: 'execution-public-boundary-w1c', passed, failed }));
  process.exitCode = failed ? 1 : 0;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
