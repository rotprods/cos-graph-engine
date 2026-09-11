const assert = require('node:assert/strict');
const http = require('node:http');

async function main() {
  const { HTTPTool } = await import('../packages/execution/src/tool-runtime.ts');
  const context = { traceId: 'w1d3-http-egress' };

  function expectFailure(result, code) {
    assert.equal(result.success, false, `expected ${code} to fail closed`);
    assert.equal(result.error?.code, code, `expected ${code}, got ${result.error?.code}`);
  }

  let loopbackHits = 0;
  const server = http.createServer((_req, res) => {
    loopbackHits += 1;
    res.statusCode = 200;
    res.end('loopback reached');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const unbound = new HTTPTool();
    const result = await unbound.execute({ method: 'GET', url: `http://127.0.0.1:${port}/metadata` }, context);
    expectFailure(result, 'HTTP_EGRESS_UNBOUND');
    assert.equal(loopbackHits, 0, 'unbound HTTPTool must not emit a loopback request');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  const allow = async () => ({ allowed: true, policyRef: 'policy:test-public-egress' });
  const deniedAddressMatrix = [
    { address: '0.0.0.0', family: 4, label: 'unspecified-v4' },
    { address: '10.0.0.7', family: 4, label: 'rfc1918-10' },
    { address: '100.64.0.1', family: 4, label: 'cgnat' },
    { address: '127.0.0.1', family: 4, label: 'loopback-v4' },
    { address: '169.254.169.254', family: 4, label: 'linklocal-metadata-v4' },
    { address: '172.16.0.1', family: 4, label: 'rfc1918-172' },
    { address: '192.168.0.1', family: 4, label: 'rfc1918-192' },
    { address: '198.18.0.1', family: 4, label: 'benchmark-v4' },
    { address: '224.0.0.1', family: 4, label: 'multicast-v4' },
    { address: '240.0.0.1', family: 4, label: 'reserved-v4' },
    { address: '::', family: 6, label: 'unspecified-v6' },
    { address: '::1', family: 6, label: 'loopback-v6' },
    { address: 'fc00::1', family: 6, label: 'ula-fc' },
    { address: 'fd12::1', family: 6, label: 'ula-fd' },
    { address: 'fe80::1', family: 6, label: 'linklocal-v6' },
    { address: 'ff02::1', family: 6, label: 'multicast-v6' },
    { address: '2001:db8::1', family: 6, label: 'documentation-v6' },
    { address: '::ffff:127.0.0.1', family: 6, label: 'mapped-loopback-v4' },
    { address: '::ffff:169.254.169.254', family: 6, label: 'mapped-metadata-v4' },
  ];

  for (const entry of deniedAddressMatrix) {
    let transportCalls = 0;
    const tool = new HTTPTool({
      resolve: async () => [{ address: entry.address, family: entry.family }],
      authorize: allow,
      transport: async () => {
        transportCalls += 1;
        return { statusCode: 200, headers: {}, body: 'should-not-run' };
      },
    });
    const result = await tool.execute({ method: 'GET', url: `https://${entry.label}.test/` }, context);
    expectFailure(result, 'HTTP_EGRESS_DENIED');
    assert.equal(transportCalls, 0, `${entry.label} must deny before transport`);
  }

  let deniedTransportCalls = 0;
  const denied = new HTTPTool({
    resolve: async () => [{ address: '93.184.216.34', family: 4 }],
    authorize: async () => ({ allowed: false, policyRef: 'policy:deny' }),
    transport: async () => {
      deniedTransportCalls += 1;
      return { statusCode: 200, headers: {}, body: '' };
    },
  });
  expectFailure(await denied.execute({ method: 'GET', url: 'https://public.test/' }, context), 'HTTP_EGRESS_DENIED');
  assert.equal(deniedTransportCalls, 0);

  const authFailure = new HTTPTool({
    resolve: async () => [{ address: '93.184.216.34', family: 4 }],
    authorize: async () => { throw new Error('policy backend unavailable'); },
    transport: async () => {
      deniedTransportCalls += 1;
      return { statusCode: 200, headers: {}, body: '' };
    },
  });
  expectFailure(await authFailure.execute({ method: 'GET', url: 'https://public.test/' }, context), 'HTTP_EGRESS_AUTHORIZATION_FAILED');
  assert.equal(deniedTransportCalls, 0);

  let pinnedRequest;
  const publicTool = new HTTPTool({
    resolve: async hostname => {
      assert.equal(hostname, 'public.test');
      return [{ address: '93.184.216.34', family: 4 }];
    },
    authorize: allow,
    transport: async request => {
      pinnedRequest = request;
      return { statusCode: 200, headers: { 'content-type': 'text/plain' }, body: 'public-ok' };
    },
  });
  const publicResult = await publicTool.execute({ method: 'GET', url: 'https://public.test/path' }, context);
  assert.equal(publicResult.success, true);
  assert.equal(publicResult.output.body, 'public-ok');
  assert.equal(pinnedRequest.hostname, 'public.test');
  assert.equal(pinnedRequest.address, '93.184.216.34');
  assert.equal(pinnedRequest.family, 4);

  let redirectTransportCalls = 0;
  const redirectTool = new HTTPTool({
    resolve: async hostname => hostname === 'public.test'
      ? [{ address: '93.184.216.34', family: 4 }]
      : [{ address: '127.0.0.1', family: 4 }],
    authorize: allow,
    transport: async request => {
      redirectTransportCalls += 1;
      if (request.hostname === 'public.test') return { statusCode: 302, headers: { location: 'http://internal.test/admin' }, body: '' };
      throw new Error('redirect target transport must never execute');
    },
  });
  expectFailure(await redirectTool.execute({ method: 'GET', url: 'https://public.test/start' }, context), 'HTTP_EGRESS_DENIED');
  assert.equal(redirectTransportCalls, 1);

  let credentialResolveCalls = 0;
  const credentialTool = new HTTPTool({
    resolve: async () => { credentialResolveCalls += 1; return [{ address: '93.184.216.34', family: 4 }]; },
    authorize: allow,
    transport: async () => ({ statusCode: 200, headers: {}, body: '' }),
  });
  expectFailure(await credentialTool.execute({ method: 'GET', url: 'https://user:pass@public.test/' }, context), 'HTTP_EGRESS_DENIED');
  assert.equal(credentialResolveCalls, 0);

  let mixedTransportCalls = 0;
  const mixedTool = new HTTPTool({
    resolve: async () => [{ address: '93.184.216.34', family: 4 }, { address: '169.254.169.254', family: 4 }],
    authorize: allow,
    transport: async () => { mixedTransportCalls += 1; return { statusCode: 200, headers: {}, body: '' }; },
  });
  expectFailure(await mixedTool.execute({ method: 'GET', url: 'https://mixed.test/' }, context), 'HTTP_EGRESS_DENIED');
  assert.equal(mixedTransportCalls, 0);

  let budgetRequest;
  const budgetTool = new HTTPTool({
    resolve: async () => [{ address: '93.184.216.34', family: 4 }],
    authorize: allow,
    maxResponseBytes: 32,
    maxTimeoutMs: 500,
    transport: async request => { budgetRequest = request; return { statusCode: 200, headers: {}, body: 'x'.repeat(33) }; },
  });
  expectFailure(await budgetTool.execute({ method: 'GET', url: 'https://public.test/', timeout: 50000 }, context), 'HTTP_RESPONSE_TOO_LARGE');
  assert.equal(budgetRequest.timeout, 500);
  assert.equal(budgetRequest.maxResponseBytes, 32);

  console.log(`W1D.3 HTTP egress contract PASS — ${deniedAddressMatrix.length} special-address classes + policy/pinning/redirect/budget invariants`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
