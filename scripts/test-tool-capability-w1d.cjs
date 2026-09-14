const assert = require('node:assert/strict');

async function main() {
  const { ToolRegistry } = await import('../packages/execution/src/tool-runtime.ts');

  const context = { traceId: 'w1d-capability-gate' };
  let effects = 0;
  const probe = {
    definition: {
      id: 'tool:w1d_probe',
      name: 'w1d_probe',
      description: 'W1D authorization boundary probe',
      version: { major: 1, minor: 0, patch: 0 },
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      permissions: ['read'],
      cost: { units: 'credits', amount: 0 },
      timeout: 1000,
      rateLimit: { maxPerMinute: 60, maxPerHour: 1000 },
      retryConfig: { maxRetries: 0, backoffMs: 0 },
    },
    async execute(input) {
      effects += 1;
      return {
        success: true,
        output: { echoed: input },
        cost: { units: 'credits', amount: 0 },
        latency: 0,
        metadata: { probe: true },
      };
    },
  };

  async function expectCode(promise, code) {
    let caught;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, `expected rejection with ${code}`);
    assert.equal(caught.code, code, `expected ${code}, got ${caught.code || caught.message}`);
  }

  // Invariant 1: no policy binding is never ambient allow.
  effects = 0;
  const unbound = new ToolRegistry({ registerBuiltins: false });
  unbound.register(probe);
  await expectCode(unbound.execute('w1d_probe', { case: 'unbound' }, context), 'TOOL_CAPABILITY_DENIED');
  assert.equal(effects, 0, 'unbound denial must happen before tool.execute');

  // Invariant 2: explicit deny happens before privileged execution.
  effects = 0;
  let denyRequest;
  const denied = new ToolRegistry({
    registerBuiltins: false,
    authorize: async request => {
      denyRequest = request;
      return { allowed: false, reason: 'test-deny' };
    },
  });
  denied.register(probe);
  await expectCode(denied.execute('w1d_probe', { case: 'deny' }, context), 'TOOL_CAPABILITY_DENIED');
  assert.equal(effects, 0, 'policy denial must produce zero tool effects');
  assert.equal(denyRequest.name, 'w1d_probe');
  assert.deepEqual(denyRequest.permissions, ['read']);
  assert.equal(denyRequest.sideEffecting, false);
  assert.equal(denyRequest.context.traceId, context.traceId);

  // Invariant 3: authorization infrastructure failure fails closed.
  effects = 0;
  const authFailure = new ToolRegistry({
    registerBuiltins: false,
    authorize: async () => { throw new Error('policy backend unavailable'); },
  });
  authFailure.register(probe);
  await expectCode(
    authFailure.execute('w1d_probe', { case: 'auth-failure' }, context),
    'TOOL_CAPABILITY_AUTHORIZATION_FAILED',
  );
  assert.equal(effects, 0, 'authorization failure must produce zero tool effects');

  // Invariant 4: explicit allow executes exactly once and cannot alter definition-derived permissions.
  effects = 0;
  let allowRequest;
  const allowed = new ToolRegistry({
    registerBuiltins: false,
    authorize: request => {
      allowRequest = request;
      return { allowed: true, reason: 'test-allow' };
    },
  });
  allowed.register(probe);
  const result = await allowed.execute('w1d_probe', { permissions: ['admin'], case: 'allow' }, context);
  assert.equal(result.success, true);
  assert.equal(effects, 1, 'allowed execution must happen exactly once');
  assert.deepEqual(allowRequest.permissions, ['read'], 'permissions must come from tool definition, not caller input');

  // Invariant 5: side-effect classification is derived from registered permissions.
  let sideEffects = 0;
  const writeProbe = {
    ...probe,
    definition: { ...probe.definition, id: 'tool:w1d_write_probe', name: 'w1d_write_probe', permissions: ['write'] },
    async execute(input) {
      sideEffects += 1;
      return { success: true, output: input, cost: { units: 'credits', amount: 0 }, latency: 0, metadata: {} };
    },
  };
  let writeRequest;
  const writeDenied = new ToolRegistry({
    registerBuiltins: false,
    authorize: request => {
      writeRequest = request;
      return { allowed: false, reason: 'write-denied' };
    },
  });
  writeDenied.register(writeProbe);
  await expectCode(writeDenied.execute('w1d_write_probe', {}, context), 'TOOL_CAPABILITY_DENIED');
  assert.equal(writeRequest.sideEffecting, true);
  assert.equal(sideEffects, 0);

  console.log('W1D ToolRegistry capability gate: 5/5 PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
