const assert = require('node:assert/strict');

async function main() {
  const { SearchTool } = await import('../packages/execution/src/tool-runtime.ts');
  const context = { traceId: 'w1d4-search-tool' };

  function expectFailure(result, code) {
    assert.equal(result.success, false, `expected ${code} to fail closed`);
    assert.equal(result.error?.code, code, `expected ${code}, got ${result.error?.code}`);
  }

  // 1. File search without an authority-scoped provider must never fall back to host CWD.
  const unbound = new SearchTool();
  const unboundResult = await unbound.execute({ query: 'needle', source: 'files' }, context);
  expectFailure(unboundResult, 'SEARCH_AUTHORITY_UNBOUND');

  // 2. Provider failures (permission/symlink/read failures) propagate as real failures.
  let failingCalls = 0;
  const failingProvider = {
    id: 'files:failing',
    source: 'files',
    authority: { root: 'workspace:test', allowedExtensions: ['.ts'] },
    async search() {
      failingCalls += 1;
      const error = new Error('permission denied');
      error.code = 'EACCES';
      throw error;
    },
  };
  const failing = new SearchTool({ providers: [failingProvider] });
  const failingResult = await failing.execute({ query: 'needle', source: 'files' }, context);
  expectFailure(failingResult, 'SEARCH_PROVIDER_ERROR');
  assert.equal(failingCalls, 1);

  // 3. Scope comes from provider authority and provider-returned paths must remain relative/beneath it.
  const escapeProvider = {
    id: 'files:escape',
    source: 'files',
    authority: { root: 'workspace:test', allowedExtensions: ['.ts'] },
    async search() {
      return [{ type: 'file', path: '../outside.ts', content: 'needle', score: 1 }];
    },
  };
  const escape = new SearchTool({ providers: [escapeProvider] });
  const escapeResult = await escape.execute({ query: 'needle', source: 'files' }, context);
  expectFailure(escapeResult, 'SEARCH_SCOPE_VIOLATION');

  const absoluteProvider = {
    ...escapeProvider,
    id: 'files:absolute',
    async search() {
      return [{ type: 'file', path: '/etc/passwd.ts', content: 'needle', score: 1 }];
    },
  };
  const absolute = new SearchTool({ providers: [absoluteProvider] });
  const absoluteResult = await absolute.execute({ query: 'needle', source: 'files' }, context);
  expectFailure(absoluteResult, 'SEARCH_SCOPE_VIOLATION');

  // 4. File classes, result count and snippet size are tool-level hard limits, not caller/provider promises.
  let boundedRequest;
  const boundedProvider = {
    id: 'files:bounded',
    source: 'files',
    authority: { root: 'workspace:test', allowedExtensions: ['.ts'] },
    async search(request) {
      boundedRequest = request;
      return [
        { type: 'file', path: 'src/a.ts', content: `needle ${'a'.repeat(200)}`, score: 1 },
        { type: 'file', path: 'src/b.ts', content: `needle ${'b'.repeat(200)}`, score: 0.9 },
        { type: 'file', path: 'src/c.ts', content: `needle ${'c'.repeat(200)}`, score: 0.8 },
      ];
    },
  };
  const bounded = new SearchTool({ providers: [boundedProvider], maxResults: 2, maxSnippetChars: 80 });
  const boundedResult = await bounded.execute({ query: 'needle', source: 'files', limit: 1000 }, context);
  assert.equal(boundedResult.success, true);
  assert.equal(boundedRequest.limit, 2, 'provider request must be clamped before traversal/work');
  assert.equal(boundedResult.output.results.length, 2);
  assert.ok(boundedResult.output.results.every(result => result.content.length <= 80));
  assert.equal(boundedResult.metadata.authority, 'workspace:test');

  const extensionProvider = {
    ...boundedProvider,
    id: 'files:extension',
    async search() {
      return [{ type: 'file', path: 'secrets.env', content: 'needle', score: 1 }];
    },
  };
  const extension = new SearchTool({ providers: [extensionProvider] });
  const extensionResult = await extension.execute({ query: 'needle', source: 'files' }, context);
  expectFailure(extensionResult, 'SEARCH_SCOPE_VIOLATION');

  // 5. Query/resource bounds are validated before a provider can perform work.
  let oversizedCalls = 0;
  const neverCalledProvider = {
    ...boundedProvider,
    id: 'files:never-called',
    async search() {
      oversizedCalls += 1;
      return [];
    },
  };
  const boundedInput = new SearchTool({ providers: [neverCalledProvider], maxQueryChars: 64 });
  const oversizedResult = await boundedInput.execute({ query: 'x'.repeat(65), source: 'files' }, context);
  expectFailure(oversizedResult, 'SEARCH_INPUT_INVALID');
  assert.equal(oversizedCalls, 0, 'invalid input must fail before provider authority is exercised');

  console.log('W1D.4 SearchTool authority/error/bounds contract: 8/8 PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
