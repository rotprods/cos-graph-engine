const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

async function main() {
  const {
    FileSystemTool,
    HTTPTool,
    SearchTool,
    ToolRegistry,
  } = await import('../packages/execution/src/tool-runtime.ts');

  const context = { traceId: 'w1d5-cross-tool-e2e' };

  function expectFailure(result, code) {
    assert.equal(result.success, false, `expected ${code} to fail closed`);
    assert.equal(result.error?.code, code, `expected ${code}, got ${result.error?.code}`);
  }

  async function expectThrowCode(promise, code) {
    let caught;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, `expected thrown ${code}`);
    assert.equal(caught.code, code, `expected ${code}, got ${caught.code || caught.message}`);
  }

  function authorizationReceipt(result) {
    assert.equal(typeof result.metadata.authorization, 'string', 'authorization receipt must be serialized metadata');
    return JSON.parse(result.metadata.authorization);
  }

  // Composition precondition: every built-in surface is zero-authority by default.
  const defaultFs = await new FileSystemTool().execute({ operation: 'exists', path: 'probe.txt' }, context);
  expectFailure(defaultFs, 'FS_AUTHORITY_UNBOUND');
  const defaultHttp = await new HTTPTool().execute({ method: 'GET', url: 'https://public.test/' }, context);
  expectFailure(defaultHttp, 'HTTP_EGRESS_UNBOUND');
  const defaultSearch = await new SearchTool().execute({ query: 'needle', source: 'files' }, context);
  expectFailure(defaultSearch, 'SEARCH_AUTHORITY_UNBOUND');

  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'cos-w1d5-'));
  const workspace = path.join(fixture, 'workspace');
  await fs.mkdir(workspace, { recursive: true });

  let resolveCalls = 0;
  let egressPolicyCalls = 0;
  let transportCalls = 0;
  let searchCalls = 0;

  const filesystem = new FileSystemTool({ root: workspace });
  const httpTool = new HTTPTool({
    resolve: async hostname => {
      resolveCalls += 1;
      assert.equal(hostname, 'public.test');
      return [{ address: '93.184.216.34', family: 4 }];
    },
    authorize: async request => {
      egressPolicyCalls += 1;
      assert.equal(request.hostname, 'public.test');
      return { allowed: true, policyRef: 'policy:egress-public' };
    },
    transport: async request => {
      transportCalls += 1;
      assert.equal(request.address, '93.184.216.34');
      return { statusCode: 200, headers: { 'content-type': 'text/plain' }, body: 'network-ok' };
    },
  });
  const provider = {
    id: 'files:e2e',
    source: 'files',
    authority: { root: 'workspace:e2e', allowedExtensions: ['.ts'] },
    async search(request) {
      searchCalls += 1;
      assert.equal(request.query, 'needle');
      return [{ type: 'file', path: 'src/example.ts', content: 'needle', score: 1 }];
    },
  };
  const search = new SearchTool({ providers: [provider] });

  try {
    // 1. Registry denial dominates inner capabilities and produces zero privileged effects.
    const denied = new ToolRegistry({
      registerBuiltins: false,
      authorize: async () => ({ allowed: false, reason: 'outer-deny', policyRefs: ['policy:outer-deny'] }),
    });
    denied.register(filesystem);
    denied.register(httpTool);
    denied.register(search);

    await expectThrowCode(
      denied.execute('filesystem', { operation: 'write', path: 'denied.txt', content: 'must-not-exist' }, context),
      'TOOL_CAPABILITY_DENIED',
    );
    await assert.rejects(fs.stat(path.join(workspace, 'denied.txt')), error => error.code === 'ENOENT');

    await expectThrowCode(
      denied.execute('http_client', { method: 'GET', url: 'https://public.test/' }, context),
      'TOOL_CAPABILITY_DENIED',
    );
    assert.equal(resolveCalls, 0, 'registry denial must happen before DNS');
    assert.equal(egressPolicyCalls, 0, 'registry denial must happen before egress policy');
    assert.equal(transportCalls, 0, 'registry denial must happen before transport');

    await expectThrowCode(
      denied.execute('search', { query: 'needle', source: 'files' }, context),
      'TOOL_CAPABILITY_DENIED',
    );
    assert.equal(searchCalls, 0, 'registry denial must happen before search provider work');

    // 2. Authorization infrastructure failure also produces zero filesystem effects.
    const authFailure = new ToolRegistry({
      registerBuiltins: false,
      authorize: async () => { throw new Error('policy backend unavailable'); },
    });
    authFailure.register(filesystem);
    await expectThrowCode(
      authFailure.execute('filesystem', { operation: 'write', path: 'auth-failure.txt', content: 'must-not-exist' }, context),
      'TOOL_CAPABILITY_AUTHORIZATION_FAILED',
    );
    await assert.rejects(fs.stat(path.join(workspace, 'auth-failure.txt')), error => error.code === 'ENOENT');

    // 3. Explicit outer allow composes with each inner authority and preserves provenance.
    let outerAllowCalls = 0;
    const allowed = new ToolRegistry({
      registerBuiltins: false,
      authorize: async request => {
        outerAllowCalls += 1;
        return { allowed: true, reason: `allow:${request.name}`, policyRefs: ['policy:outer-allow'] };
      },
    });
    allowed.register(filesystem);
    allowed.register(httpTool);
    allowed.register(search);

    const fsAllowed = await allowed.execute(
      'filesystem',
      { operation: 'write', path: 'allowed.txt', content: 'allowed' },
      context,
    );
    assert.equal(fsAllowed.success, true);
    assert.equal(await fs.readFile(path.join(workspace, 'allowed.txt'), 'utf8'), 'allowed');
    const fsReceipt = authorizationReceipt(fsAllowed);
    assert.equal(fsReceipt.capability, 'filesystem');
    assert.deepEqual(fsReceipt.policyRefs, ['policy:outer-allow']);
    assert.equal(fsReceipt.traceId, context.traceId);

    const httpAllowed = await allowed.execute('http_client', { method: 'GET', url: 'https://public.test/' }, context);
    assert.equal(httpAllowed.success, true);
    assert.equal(httpAllowed.output.body, 'network-ok');
    assert.equal(resolveCalls, 1);
    assert.equal(egressPolicyCalls, 1);
    assert.equal(transportCalls, 1);
    const httpReceipt = authorizationReceipt(httpAllowed);
    assert.equal(httpReceipt.capability, 'http_client');
    assert.deepEqual(httpReceipt.permissions, ['execute']);

    const searchAllowed = await allowed.execute('search', { query: 'needle', source: 'files' }, context);
    assert.equal(searchAllowed.success, true);
    assert.equal(searchCalls, 1);
    const searchReceipt = authorizationReceipt(searchAllowed);
    assert.equal(searchReceipt.capability, 'search');
    assert.deepEqual(searchReceipt.permissions, ['read']);
    assert.equal(outerAllowCalls, 3);

    // 4. Inner fail-closed results remain failures after an outer allow; registry adds provenance but never rewrites success.
    const failingSearch = new SearchTool({
      providers: [{
        ...provider,
        id: 'files:failing-e2e',
        async search() { throw new Error('provider denied read'); },
      }],
    });
    const failureRegistry = new ToolRegistry({
      registerBuiltins: false,
      authorize: async () => ({ allowed: true, policyRefs: ['policy:outer-allow'] }),
    });
    failureRegistry.register(failingSearch);
    const failedSearch = await failureRegistry.execute('search', { query: 'needle', source: 'files' }, context);
    expectFailure(failedSearch, 'SEARCH_PROVIDER_ERROR');
    assert.equal(authorizationReceipt(failedSearch).decision, 'allow');

    // 5. Inner scope denial remains failure and cannot mutate outside the workspace.
    const scopeFailure = await allowed.execute(
      'filesystem',
      { operation: 'write', path: '../outside.txt', content: 'must-not-exist' },
      context,
    );
    expectFailure(scopeFailure, 'FS_SCOPE_VIOLATION');
    await assert.rejects(fs.stat(path.join(fixture, 'outside.txt')), error => error.code === 'ENOENT');
    assert.equal(authorizationReceipt(scopeFailure).capability, 'filesystem');

    // 6. Unknown tools fail before policy evaluation and before any side-effect surface is consulted.
    let unknownAuthCalls = 0;
    const unknownRegistry = new ToolRegistry({
      registerBuiltins: false,
      authorize: async () => {
        unknownAuthCalls += 1;
        return { allowed: true };
      },
    });
    await expectThrowCode(unknownRegistry.execute('not_registered', {}, context), 'TOOL_NOT_FOUND');
    assert.equal(unknownAuthCalls, 0);

    console.log('W1D.5 cross-tool capability E2E PASS — registry deny dominance, zero effects, composed allow provenance and fail-closed inner results');
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
