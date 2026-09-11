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

  function expectConstructorCode(fn, code) {
    assert.throws(fn, error => error?.code === code, `expected constructor to throw ${code}`);
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

    // 7. Defensive filesystem branch matrix: malformed authority, paths and resource limits fail closed.
    expectConstructorCode(() => new FileSystemTool({ root: workspace, maxReadBytes: 0 }), 'FS_CONFIG_INVALID');
    expectConstructorCode(() => new FileSystemTool({ root: workspace, maxWriteBytes: 10_000_001 }), 'FS_CONFIG_INVALID');
    expectConstructorCode(() => new FileSystemTool({ root: workspace, maxListEntries: 1.5 }), 'FS_CONFIG_INVALID');

    const rootFile = path.join(fixture, 'root-file');
    await fs.writeFile(rootFile, 'not-a-directory', 'utf8');
    expectFailure(await new FileSystemTool({ root: rootFile }).execute({ operation: 'exists', path: 'x' }, context), 'FS_ERROR');

    const rootLink = path.join(fixture, 'root-link');
    await fs.symlink(workspace, rootLink, 'dir');
    expectFailure(await new FileSystemTool({ root: rootLink }).execute({ operation: 'exists', path: 'x' }, context), 'FS_SCOPE_VIOLATION');

    const invalidFsPaths = [
      '',
      'nul\0byte',
      'nested\\windows.txt',
      '/absolute.txt',
      'C:/drive.txt',
      'file:///tmp/uri.txt',
      'nested//empty.txt',
      '%2e%2e/outside.txt',
      '%252e%252e/outside.txt',
      '%ZZ/bad.txt',
    ];
    for (const candidate of invalidFsPaths) {
      expectFailure(await filesystem.execute({ operation: 'exists', path: candidate }, context), 'FS_SCOPE_VIOLATION');
    }
    expectFailure(await filesystem.execute({ operation: 'exists', path: 42 }, context), 'FS_SCOPE_VIOLATION');

    await fs.mkdir(path.join(workspace, 'defensive-dir'), { recursive: true });
    expectFailure(await filesystem.execute({ operation: 'read', path: 'defensive-dir' }, context), 'FS_ERROR');
    expectFailure(await filesystem.execute({ operation: 'write', path: 'defensive-dir' }, context), 'FS_ERROR');
    expectFailure(await filesystem.execute({ operation: 'write', path: 'missing-content.txt' }, context), 'FS_ERROR');
    expectFailure(await filesystem.execute({ operation: 'list', path: 'allowed.txt' }, context), 'FS_ERROR');
    expectFailure(await filesystem.execute({ operation: 'unknown', path: 'allowed.txt' }, context), 'FS_ERROR');

    await fs.writeFile(path.join(workspace, 'component-file'), 'component', 'utf8');
    expectFailure(await filesystem.execute({ operation: 'exists', path: 'component-file/child' }, context), 'FS_ERROR');
    const missingExists = await filesystem.execute({ operation: 'exists', path: 'definitely-missing.txt' }, context);
    assert.equal(missingExists.success, true);
    assert.equal(missingExists.output.exists, false);

    await fs.writeFile(path.join(workspace, 'large-read.txt'), '0123456789', 'utf8');
    expectFailure(await new FileSystemTool({ root: workspace, maxReadBytes: 8 }).execute({ operation: 'read', path: 'large-read.txt' }, context), 'FS_ERROR');
    expectFailure(await new FileSystemTool({ root: workspace, maxWriteBytes: 8 }).execute({ operation: 'write', path: 'large-write.txt', content: '123456789' }, context), 'FS_ERROR');
    await fs.mkdir(path.join(workspace, 'crowded'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'crowded', 'a'), 'a');
    await fs.writeFile(path.join(workspace, 'crowded', 'b'), 'b');
    expectFailure(await new FileSystemTool({ root: workspace, maxListEntries: 1 }).execute({ operation: 'list', path: 'crowded' }, context), 'FS_ERROR');

    // 8. Defensive HTTP matrix: malformed inputs, dependency failures and redirect edge cases stay fail-closed.
    const publicAddress = [{ address: '93.184.216.34', family: 4 }];
    const allowEgress = async () => ({ allowed: true });
    const okTransport = async request => ({ statusCode: 200, headers: {}, body: request.body ?? 'ok' });
    const httpOptions = overrides => ({
      resolve: async () => publicAddress,
      authorize: allowEgress,
      transport: okTransport,
      ...overrides,
    });

    expectConstructorCode(() => new HTTPTool({ ...httpOptions(), maxResponseBytes: 0 }), 'HTTP_CONFIG_INVALID');
    expectConstructorCode(() => new HTTPTool({ ...httpOptions(), maxTimeoutMs: 120001 }), 'HTTP_CONFIG_INVALID');
    expectConstructorCode(() => new HTTPTool({ ...httpOptions(), maxRedirects: -1 }), 'HTTP_CONFIG_INVALID');

    expectFailure(await new HTTPTool(httpOptions()).execute({ method: 'TRACE', url: 'https://public.test/' }, context), 'HTTP_INPUT_INVALID');
    expectFailure(await new HTTPTool(httpOptions()).execute({ method: 'GET', url: 'https://public.test/', timeout: 0 }, context), 'HTTP_INPUT_INVALID');
    expectFailure(await new HTTPTool(httpOptions()).execute({ method: 'GET', url: 'not a url' }, context), 'HTTP_INPUT_INVALID');
    expectFailure(await new HTTPTool(httpOptions()).execute({ method: 'GET', url: 'ftp://public.test/' }, context), 'HTTP_EGRESS_DENIED');
    expectFailure(await new HTTPTool(httpOptions()).execute({ method: 'GET', url: 'https://public.test/' }, { traceId: 'bad-context', bad: () => {} }), 'HTTP_INPUT_INVALID');

    let literalResolverCalls = 0;
    let literalRequest;
    const literalIPv4 = new HTTPTool(httpOptions({
      resolve: async () => { literalResolverCalls += 1; return publicAddress; },
      transport: async request => { literalRequest = request; return { statusCode: 200, headers: {}, body: 'literal-v4' }; },
    }));
    const literalIPv4Result = await literalIPv4.execute({ method: 'GET', url: 'https://93.184.216.34/' }, context);
    assert.equal(literalIPv4Result.success, true);
    assert.equal(literalResolverCalls, 0, 'IP literals must not re-resolve DNS');
    assert.equal(literalRequest.address, '93.184.216.34');

    let literalIPv6Request;
    const literalIPv6 = new HTTPTool(httpOptions({
      resolve: async () => { throw new Error('IPv6 literal must not re-resolve'); },
      transport: async request => { literalIPv6Request = request; return { statusCode: 200, headers: {}, body: 'literal-v6' }; },
    }));
    const literalIPv6Result = await literalIPv6.execute({ method: 'GET', url: 'https://[2606:4700:4700::1111]/' }, context);
    assert.equal(literalIPv6Result.success, true);
    assert.equal(literalIPv6Request.family, 6);

    expectFailure(await new HTTPTool(httpOptions({ resolve: async () => { throw new Error('dns-down'); } })).execute({ method: 'GET', url: 'https://public.test/' }, context), 'HTTP_EGRESS_RESOLUTION_FAILED');
    expectFailure(await new HTTPTool(httpOptions({ resolve: async () => [] })).execute({ method: 'GET', url: 'https://public.test/' }, context), 'HTTP_EGRESS_DENIED');
    expectFailure(await new HTTPTool(httpOptions({ resolve: async () => [{ address: '93.184.216.34', family: 6 }] })).execute({ method: 'GET', url: 'https://public.test/' }, context), 'HTTP_EGRESS_DENIED');
    expectFailure(await new HTTPTool(httpOptions({ resolve: async () => [{ address: '93.184.216.34', family: 5 }] })).execute({ method: 'GET', url: 'https://public.test/' }, context), 'HTTP_EGRESS_DENIED');
    expectFailure(await new HTTPTool(httpOptions({ authorize: async () => ({ allowed: false }) })).execute({ method: 'GET', url: 'https://public.test/' }, context), 'HTTP_EGRESS_DENIED');
    expectFailure(await new HTTPTool(httpOptions({ authorize: async () => { throw 'policy-down'; } })).execute({ method: 'GET', url: 'https://public.test/' }, context), 'HTTP_EGRESS_AUTHORIZATION_FAILED');
    expectFailure(await new HTTPTool(httpOptions({ transport: async () => { throw new Error('transport-down'); } })).execute({ method: 'GET', url: 'https://public.test/' }, context), 'HTTP_TRANSPORT_ERROR');
    expectFailure(await new HTTPTool(httpOptions({ transport: async () => ({ statusCode: 99, headers: {}, body: 'bad' }) })).execute({ method: 'GET', url: 'https://public.test/' }, context), 'HTTP_TRANSPORT_ERROR');

    let portRequest;
    const explicitPortResult = await new HTTPTool(httpOptions({
      transport: async request => { portRequest = request; return { statusCode: 200, headers: {}, body: 'port-ok' }; },
    })).execute({ method: 'POST', url: 'https://public.test:8443/path', body: 'payload', headers: { 'X-Test': 'ok', 'Bad\nHeader': 'drop' } }, context);
    assert.equal(explicitPortResult.success, true);
    assert.equal(portRequest.port, 8443);
    assert.equal(portRequest.body, 'payload');
    assert.equal(portRequest.headers['Bad\nHeader'], undefined);

    let httpPortRequest;
    const httpPortResult = await new HTTPTool(httpOptions({
      transport: async request => { httpPortRequest = request; return { statusCode: 200, headers: {}, body: 'http-ok' }; },
    })).execute({ method: 'PATCH', url: 'http://public.test/' }, context);
    assert.equal(httpPortResult.success, true);
    assert.equal(httpPortRequest.port, 80);

    let redirectArrayCalls = 0;
    const arrayRedirectTool = new HTTPTool(httpOptions({
      transport: async request => {
        redirectArrayCalls += 1;
        return redirectArrayCalls === 1
          ? { statusCode: 302, headers: { Location: ['https://public.test/final'] }, body: '' }
          : { statusCode: 200, headers: {}, body: 'redirect-ok' };
      },
    }));
    assert.equal((await arrayRedirectTool.execute({ method: 'GET', url: 'https://public.test/start' }, context)).success, true);
    assert.equal(redirectArrayCalls, 2);

    expectFailure(await new HTTPTool({ ...httpOptions(), maxRedirects: 0, transport: async () => ({ statusCode: 302, headers: { location: 'https://public.test/next' }, body: '' }) }).execute({ method: 'GET', url: 'https://public.test/start' }, context), 'HTTP_REDIRECT_LIMIT');
    expectFailure(await new HTTPTool(httpOptions({ transport: async () => ({ statusCode: 302, headers: { location: 'http://[' }, body: '' }) })).execute({ method: 'GET', url: 'https://public.test/start' }, context), 'HTTP_EGRESS_DENIED');

    const extendedDeniedAddresses = [
      '192.0.0.1',
      '192.0.2.1',
      '192.88.99.1',
      '198.51.100.1',
      '203.0.113.1',
      '100::1',
      '2001:2::1',
      '2001:10::1',
      '2001:20::1',
      '2001::1',
      '2002::1',
      '64:ff9b::1',
    ];
    for (const address of extendedDeniedAddresses) {
      const family = address.includes(':') ? 6 : 4;
      expectFailure(await new HTTPTool(httpOptions({ resolve: async () => [{ address, family }] })).execute({ method: 'GET', url: 'https://special.test/' }, context), 'HTTP_EGRESS_DENIED');
    }

    // 9. Defensive Search matrix: malformed providers/results/configuration cannot expand authority.
    expectConstructorCode(() => new SearchTool({ maxResults: 0 }), 'SEARCH_CONFIG_INVALID');
    expectConstructorCode(() => new SearchTool({ maxSnippetChars: 10001 }), 'SEARCH_CONFIG_INVALID');
    expectConstructorCode(() => new SearchTool({ maxQueryChars: 1.5 }), 'SEARCH_CONFIG_INVALID');

    expectFailure(await search.execute({ query: 42, source: 'files' }, context), 'SEARCH_INPUT_INVALID');
    expectFailure(await search.execute({ query: 'needle', source: 'bogus' }, context), 'SEARCH_INPUT_INVALID');
    expectFailure(await search.execute({ query: 'needle', source: 'files', limit: 0 }, context), 'SEARCH_INPUT_INVALID');
    expectFailure(await search.execute({ query: 'needle', source: 'files' }, { traceId: 'bad-search-context', bad: () => {} }), 'SEARCH_INPUT_INVALID');

    const missingAuthorityProvider = { id: 'files:no-authority', source: 'files', async search() { return []; } };
    expectFailure(await new SearchTool({ providers: [missingAuthorityProvider] }).execute({ query: 'needle', source: 'files' }, context), 'SEARCH_AUTHORITY_UNBOUND');
    const emptyIdProvider = { ...provider, id: '   ' };
    expectFailure(await new SearchTool({ providers: [emptyIdProvider] }).execute({ query: 'needle', source: 'files' }, context), 'SEARCH_AUTHORITY_UNBOUND');
    const emptyClassProvider = { ...provider, id: 'files:no-classes', authority: { root: 'workspace:e2e', allowedExtensions: [] } };
    expectFailure(await new SearchTool({ providers: [emptyClassProvider] }).execute({ query: 'needle', source: 'files' }, context), 'SEARCH_AUTHORITY_UNBOUND');

    const nonArrayProvider = { ...provider, id: 'files:non-array', async search() { return { nope: true }; } };
    expectFailure(await new SearchTool({ providers: [nonArrayProvider] }).execute({ query: 'needle', source: 'files' }, context), 'SEARCH_PROVIDER_ERROR');
    const invalidMatchProvider = { ...provider, id: 'files:bad-match', async search() { return [{ type: 'file', path: 'src/a.ts', content: 42, score: 1 }]; } };
    expectFailure(await new SearchTool({ providers: [invalidMatchProvider] }).execute({ query: 'needle', source: 'files' }, context), 'SEARCH_SCOPE_VIOLATION');
    const nonFileProvider = { ...provider, id: 'files:non-file', async search() { return [{ type: 'memory', path: 'src/a.ts', content: 'needle', score: 1 }]; } };
    expectFailure(await new SearchTool({ providers: [nonFileProvider] }).execute({ query: 'needle', source: 'files' }, context), 'SEARCH_SCOPE_VIOLATION');
    const noExtensionProvider = { ...provider, id: 'files:no-extension', async search() { return [{ type: 'file', path: 'README', content: 'needle', score: 1 }]; } };
    expectFailure(await new SearchTool({ providers: [noExtensionProvider] }).execute({ query: 'needle', source: 'files' }, context), 'SEARCH_SCOPE_VIOLATION');

    const normalizedExtensionProvider = {
      id: 'files:normalized-extension',
      source: 'files',
      authority: { root: 'workspace:e2e', allowedExtensions: ['ts'] },
      async search() { return [{ type: 'file', path: 'src/normalized.ts', content: 'needle', score: 1 }]; },
    };
    assert.equal((await new SearchTool({ providers: [normalizedExtensionProvider] }).execute({ query: 'needle', source: 'files' }, context)).success, true);

    const knowledgeProvider = {
      id: 'knowledge:e2e',
      source: 'knowledge',
      async search() { return [{ type: 'knowledge', path: 'entity/1', content: 'needle', score: 1 }]; },
    };
    const knowledgeSearch = new SearchTool({ providers: [knowledgeProvider] });
    assert.equal((await knowledgeSearch.execute({ query: 'needle', source: 'knowledge' }, context)).success, true);
    assert.equal((await knowledgeSearch.execute({ query: 'needle' }, context)).success, true);

    // 10. Registry defensive/provenance branches remain fail-closed and deterministic.
    assert.equal(allowed.get('filesystem'), filesystem);
    assert.equal(allowed.get('missing'), undefined);
    assert.equal(allowed.getDefinitions().length, 3);

    const noReasonDeny = new ToolRegistry({
      registerBuiltins: false,
      authorize: async () => ({ allowed: false }),
    });
    noReasonDeny.register(search);
    await expectThrowCode(noReasonDeny.execute('search', { query: 'needle', source: 'files' }, context), 'TOOL_CAPABILITY_DENIED');

    const cloneFailureRegistry = new ToolRegistry({
      registerBuiltins: false,
      authorize: async () => ({ allowed: true }),
    });
    cloneFailureRegistry.register(search);
    await expectThrowCode(cloneFailureRegistry.execute('search', { query: 'needle', source: 'files', uncloneable: () => {} }, context), 'TOOL_CAPABILITY_INPUT_INVALID');

    const nonErrorAuthFailure = new ToolRegistry({
      registerBuiltins: false,
      authorize: async () => { throw 'policy-string-failure'; },
    });
    nonErrorAuthFailure.register(search);
    await expectThrowCode(nonErrorAuthFailure.execute('search', { query: 'needle', source: 'files' }, context), 'TOOL_CAPABILITY_AUTHORIZATION_FAILED');

    const normalizedPolicyRegistry = new ToolRegistry({
      registerBuiltins: false,
      authorize: async () => ({ allowed: true, policyRefs: ['z-policy', ' ', 'a-policy', 'z-policy'] }),
    });
    normalizedPolicyRegistry.register(search);
    const normalizedPolicyResult = await normalizedPolicyRegistry.execute('search', { query: 'needle', source: 'files' }, context);
    assert.deepEqual(authorizationReceipt(normalizedPolicyResult).policyRefs, ['a-policy', 'z-policy']);

    console.log('W1D.5 cross-tool capability E2E PASS — registry deny dominance, zero effects, composed allow provenance, fail-closed inner results and defensive branch matrix');
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
