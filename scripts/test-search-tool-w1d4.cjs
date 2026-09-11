const assert = require('node:assert/strict');

async function main() {
  const { SearchTool } = await import('../packages/execution/src/tool-runtime.ts');
  const context = { traceId: 'w1d4-search-tool' };

  function expectFailure(result, code) {
    assert.equal(result.success, false, `expected ${code} to fail closed`);
    assert.equal(result.error?.code, code, `expected ${code}, got ${result.error?.code}`);
  }

  const unbound = new SearchTool();
  expectFailure(await unbound.execute({ query: 'needle', source: 'files' }, context), 'SEARCH_AUTHORITY_UNBOUND');

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
  expectFailure(await failing.execute({ query: 'needle', source: 'files' }, context), 'SEARCH_PROVIDER_ERROR');
  assert.equal(failingCalls, 1);

  const escapeProvider = {
    id: 'files:escape',
    source: 'files',
    authority: { root: 'workspace:test', allowedExtensions: ['.ts'] },
    async search() { return [{ type: 'file', path: '../outside.ts', content: 'needle', score: 1 }]; },
  };
  expectFailure(await new SearchTool({ providers: [escapeProvider] }).execute({ query: 'needle', source: 'files' }, context), 'SEARCH_SCOPE_VIOLATION');

  const absoluteProvider = {
    ...escapeProvider,
    id: 'files:absolute',
    async search() { return [{ type: 'file', path: '/etc/passwd.ts', content: 'needle', score: 1 }]; },
  };
  expectFailure(await new SearchTool({ providers: [absoluteProvider] }).execute({ query: 'needle', source: 'files' }, context), 'SEARCH_SCOPE_VIOLATION');

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
  assert.equal(boundedRequest.limit, 2);
  assert.equal(boundedResult.output.results.length, 2);
  assert.ok(boundedResult.output.results.every(result => result.content.length <= 80));
  assert.equal(boundedResult.metadata.authority, 'workspace:test');

  const extensionProvider = {
    ...boundedProvider,
    id: 'files:extension',
    async search() { return [{ type: 'file', path: 'secrets.env', content: 'needle', score: 1 }]; },
  };
  expectFailure(await new SearchTool({ providers: [extensionProvider] }).execute({ query: 'needle', source: 'files' }, context), 'SEARCH_SCOPE_VIOLATION');

  let oversizedCalls = 0;
  const neverCalledProvider = {
    ...boundedProvider,
    id: 'files:never-called',
    async search() { oversizedCalls += 1; return []; },
  };
  const boundedInput = new SearchTool({ providers: [neverCalledProvider], maxQueryChars: 64 });
  expectFailure(await boundedInput.execute({ query: 'x'.repeat(65), source: 'files' }, context), 'SEARCH_INPUT_INVALID');
  assert.equal(oversizedCalls, 0);

  console.log('W1D.4 SearchTool authority/error/bounds contract: 8/8 PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
