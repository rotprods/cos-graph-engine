import assert from 'node:assert/strict';
import {
  AuthorityFileSandbox,
  AuthorityHttpEgressGuard,
  type AuthorityDnsResolver,
  type AuthorityFileBrokerResolution,
  type AuthorityFileOpenRequest,
  type AuthorityFileSystemBroker,
  type AuthorityResolvedAddress,
} from '../packages/execution/src/authority-isolation';

const T0 = '2026-08-28T14:00:00.000Z';
const T500 = '2026-08-28T14:00:00.500Z';
const T1000 = '2026-08-28T14:00:01.000Z';
const T1500 = '2026-08-28T14:00:01.500Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const resolver = new FakeResolver({
    'api.example.com': [
      { address: '2606:4700:4700::1111', family: 6 },
      { address: '93.184.216.34', family: 4 },
    ],
    'next.example.net': [{ address: '1.1.1.1', family: 4 }],
    'private.example.net': [{ address: '10.0.0.7', family: 4 }],
    'mixed.example.net': [
      { address: '1.1.1.1', family: 4 },
      { address: '169.254.10.2', family: 4 },
    ],
    'mapped.example.net': [{ address: '::ffff:192.168.1.10', family: 6 }],
    'documentation.example.net': [{ address: '2001:db8::1', family: 6 }],
    'empty.example.net': [],
    'fanout.example.net': [
      { address: '1.1.1.1', family: 4 },
      { address: '8.8.8.8', family: 4 },
      { address: '9.9.9.9', family: 4 },
      { address: '208.67.222.222', family: 4 },
      { address: '208.67.220.220', family: 4 },
    ],
    'family.example.net': [{ address: '1.1.1.1', family: 6 }],
  });
  const http = new AuthorityHttpEgressGuard({
    allowedHosts: ['api.example.com', '*.example.net'],
    allowedPorts: [443],
    allowedMethods: ['GET', 'POST'],
    decisionTtlMs: 1000,
    maxRedirects: 1,
    maxResolvedAddresses: 4,
  }, resolver);

  const first = await http.authorize({
    url: 'https://api.example.com/v1/resource?b=2#a-fragment',
    method: 'GET',
    at: T0,
  });
  check(first.canonicalUrl === 'https://api.example.com/v1/resource?b=2', 'fragment is excluded from the transport target');
  check(first.resolvedAddresses.length === 2, 'all public DNS answers are pinned');
  check(first.resolvedAddresses[0]?.family === 4, 'pinned addresses have deterministic family/address ordering');
  check(first.expiresAt === T1000, 'decision expiry derives from explicit operation time');
  http.assertPinned(first, T500); assertions += 1;
  assert.throws(() => http.assertPinned(first, T1000), /EGRESS_DECISION_EXPIRED/); assertions += 1;

  const secondResolver = new FakeResolver({
    'api.example.com': [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ],
  });
  const secondGuard = new AuthorityHttpEgressGuard({
    allowedHosts: ['*.example.net', 'api.example.com'],
    allowedPorts: [443],
    allowedMethods: ['POST', 'GET'],
    decisionTtlMs: 1000,
    maxRedirects: 1,
    maxResolvedAddresses: 4,
  }, secondResolver);
  const deterministic = await secondGuard.authorize({
    url: 'https://api.example.com/v1/resource?b=2', method: 'GET', at: T0,
  });
  check(deterministic.decisionHash === first.decisionHash, 'policy and DNS ordering do not change the pinned decision');

  first.resolvedAddresses[0]!.address = '10.0.0.1';
  const pristine = await http.authorize({
    url: 'https://api.example.com/v1/resource?b=2', method: 'GET', at: T0,
  });
  check(pristine.resolvedAddresses.every(item => item.address !== '10.0.0.1'), 'caller mutation cannot change resolver or guard state');
  assert.throws(() => http.assertPinned(first, T500), /EGRESS_DECISION_HASH_MISMATCH/); assertions += 1;

  const redirect = await http.authorizeRedirect(pristine, 'https://next.example.net/new', T500);
  check(redirect.hostname === 'next.example.net' && redirect.redirectCount === 1, 'redirect target is independently re-resolved and counted');
  await assert.rejects(
    () => http.authorizeRedirect(redirect, 'https://api.example.com/again', T1500),
    /EGRESS_DECISION_EXPIRED|EGRESS_REDIRECT_LIMIT_EXCEEDED/,
  );
  assertions += 1;
  await assert.rejects(
    () => http.authorizeRedirect(pristine, 'https://evil.invalid/path', T500),
    /EGRESS_HOST_DENIED/,
  );
  assertions += 1;

  await assert.rejects(() => http.authorize({ url: 'http://api.example.com', method: 'GET', at: T0 }), /EGRESS_HTTP_DENIED/); assertions += 1;
  await assert.rejects(() => http.authorize({ url: 'ftp://api.example.com', method: 'GET', at: T0 }), /EGRESS_PROTOCOL_DENIED/); assertions += 1;
  await assert.rejects(() => http.authorize({ url: 'https://user:pass@api.example.com', method: 'GET', at: T0 }), /EGRESS_URL_CREDENTIALS_DENIED/); assertions += 1;
  await assert.rejects(() => http.authorize({ url: 'https://api.example.com:8443', method: 'GET', at: T0 }), /EGRESS_PORT_DENIED/); assertions += 1;
  await assert.rejects(() => http.authorize({ url: 'https://api.example.com', method: 'DELETE', at: T0 }), /EGRESS_METHOD_DENIED/); assertions += 1;
  await assert.rejects(() => http.authorize({ url: 'https://private.example.net', method: 'GET', at: T0 }), /EGRESS_ADDRESS_DENIED.*private/); assertions += 1;
  await assert.rejects(() => http.authorize({ url: 'https://mixed.example.net', method: 'GET', at: T0 }), /EGRESS_ADDRESS_DENIED.*link-local/); assertions += 1;
  await assert.rejects(() => http.authorize({ url: 'https://mapped.example.net', method: 'GET', at: T0 }), /EGRESS_ADDRESS_DENIED.*ipv4-mapped-private/); assertions += 1;
  await assert.rejects(() => http.authorize({ url: 'https://documentation.example.net', method: 'GET', at: T0 }), /EGRESS_ADDRESS_DENIED.*documentation/); assertions += 1;
  await assert.rejects(() => http.authorize({ url: 'https://empty.example.net', method: 'GET', at: T0 }), /EGRESS_DNS_EMPTY/); assertions += 1;
  await assert.rejects(() => http.authorize({ url: 'https://fanout.example.net', method: 'GET', at: T0 }), /EGRESS_DNS_FANOUT_EXCEEDED/); assertions += 1;
  await assert.rejects(() => http.authorize({ url: 'https://family.example.net', method: 'GET', at: T0 }), /EGRESS_ADDRESS_FAMILY_MISMATCH/); assertions += 1;

  const localGuard = new AuthorityHttpEgressGuard({ allowedHosts: ['localhost'] }, resolver);
  await assert.rejects(() => localGuard.authorize({ url: 'https://localhost', method: 'GET', at: T0 }), /EGRESS_LOCAL_HOSTNAME_DENIED/); assertions += 1;
  const literalGuard = new AuthorityHttpEgressGuard({ allowedHosts: ['8.8.8.8', '127.0.0.1'] }, resolver);
  const literal = await literalGuard.authorize({ url: 'https://8.8.8.8/dns-query', method: 'GET', at: T0 });
  check(literal.resolvedAddresses[0]?.address === '8.8.8.8', 'public IP literals are pinned without DNS');
  await assert.rejects(() => literalGuard.authorize({ url: 'https://127.0.0.1', method: 'GET', at: T0 }), /EGRESS_ADDRESS_DENIED.*loopback/); assertions += 1;

  const broker = new FakeFileBroker();
  const files = new AuthorityFileSandbox([{
    rootId: 'workspace',
    canonicalRootUri: 'file:///workspace',
    brokerId: 'broker-v1',
    operations: ['read', 'write', 'create'],
  }], broker);
  const opened = await files.authorizeAndOpen({
    rootId: 'workspace', relativePath: 'packages/core/src/index.ts', operation: 'read', at: T0,
  });
  check(opened.canonicalTargetUri === 'file:///workspace/packages/core/src/index.ts', 'broker-opened target remains inside canonical root');
  check(opened.handleToken === 'handle:packages/core/src/index.ts', 'authority decision returns opaque broker handle');
  files.assertPinned(opened); assertions += 1;

  const openedAgain = await files.authorizeAndOpen({
    rootId: 'workspace', relativePath: 'packages/core/src/index.ts', operation: 'read', at: T0,
  });
  check(openedAgain.decisionHash === opened.decisionHash, 'same broker resolution produces deterministic file decision');
  openedAgain.handleToken = 'tampered';
  assert.throws(() => files.assertPinned(openedAgain), /FILESYSTEM_HANDLE_HASH_MISMATCH|FILESYSTEM_DECISION_HASH_MISMATCH/); assertions += 1;

  await assert.rejects(() => files.authorizeAndOpen({ rootId: 'workspace', relativePath: '../secret', operation: 'read', at: T0 }), /FILESYSTEM_TRAVERSAL_DENIED/); assertions += 1;
  await assert.rejects(() => files.authorizeAndOpen({ rootId: 'workspace', relativePath: '%2e%2e/secret', operation: 'read', at: T0 }), /FILESYSTEM_TRAVERSAL_DENIED/); assertions += 1;
  await assert.rejects(() => files.authorizeAndOpen({ rootId: 'workspace', relativePath: '/etc/passwd', operation: 'read', at: T0 }), /FILESYSTEM_ABSOLUTE_PATH_DENIED/); assertions += 1;
  await assert.rejects(() => files.authorizeAndOpen({ rootId: 'workspace', relativePath: 'a\\b', operation: 'read', at: T0 }), /FILESYSTEM_BACKSLASH_DENIED/); assertions += 1;
  await assert.rejects(() => files.authorizeAndOpen({ rootId: 'workspace', relativePath: 'a//b', operation: 'read', at: T0 }), /FILESYSTEM_EMPTY_SEGMENT_DENIED/); assertions += 1;
  await assert.rejects(() => files.authorizeAndOpen({ rootId: 'workspace', relativePath: 'x', operation: 'delete', at: T0 }), /FILESYSTEM_OPERATION_DENIED/); assertions += 1;

  broker.mode = 'escape';
  await assert.rejects(() => files.authorizeAndOpen({ rootId: 'workspace', relativePath: 'escape', operation: 'read', at: T0 }), /FILESYSTEM_ROOT_ESCAPE/); assertions += 1;
  broker.mode = 'prefix-escape';
  await assert.rejects(() => files.authorizeAndOpen({ rootId: 'workspace', relativePath: 'prefix', operation: 'read', at: T0 }), /FILESYSTEM_ROOT_ESCAPE/); assertions += 1;
  broker.mode = 'symlink';
  await assert.rejects(() => files.authorizeAndOpen({ rootId: 'workspace', relativePath: 'link', operation: 'read', at: T0 }), /FILESYSTEM_SYMLINK_DENIED/); assertions += 1;
  broker.mode = 'wrong-broker';
  await assert.rejects(() => files.authorizeAndOpen({ rootId: 'workspace', relativePath: 'x', operation: 'read', at: T0 }), /FILESYSTEM_BROKER_ID_MISMATCH/); assertions += 1;
  broker.mode = 'wrong-time';
  await assert.rejects(() => files.authorizeAndOpen({ rootId: 'workspace', relativePath: 'x', operation: 'read', at: T0 }), /FILESYSTEM_BROKER_TIME_MISMATCH/); assertions += 1;
  broker.mode = 'empty-handle';
  await assert.rejects(() => files.authorizeAndOpen({ rootId: 'workspace', relativePath: 'x', operation: 'read', at: T0 }), /handleToken must not be empty/); assertions += 1;

  broker.mode = 'symlink';
  const symlinkAllowed = new AuthorityFileSandbox([{
    rootId: 'workspace', canonicalRootUri: 'file:///workspace', brokerId: 'broker-v1', operations: ['read'], allowSymlinks: true,
  }], broker);
  const allowedLink = await symlinkAllowed.authorizeAndOpen({ rootId: 'workspace', relativePath: 'link', operation: 'read', at: T0 });
  check(allowedLink.symlinkTraversed, 'symlinks require explicit root-level opt-in');

  console.log(`Authority isolation contract: ${assertions} assertions passed`);
}

class FakeResolver implements AuthorityDnsResolver {
  constructor(private readonly records: Record<string, AuthorityResolvedAddress[]>) {}
  async resolve(hostname: string): Promise<AuthorityResolvedAddress[]> {
    return structuredClone(this.records[hostname] ?? []);
  }
}

type BrokerMode = 'normal' | 'escape' | 'prefix-escape' | 'symlink' | 'wrong-broker' | 'wrong-time' | 'empty-handle';

class FakeFileBroker implements AuthorityFileSystemBroker {
  mode: BrokerMode = 'normal';

  async resolveAndOpen(
    request: AuthorityFileOpenRequest,
    expectedRootUri: string,
  ): Promise<AuthorityFileBrokerResolution> {
    const target = new URL(request.relativePath, expectedRootUri.endsWith('/') ? expectedRootUri : `${expectedRootUri}/`).toString();
    return {
      rootId: request.rootId,
      brokerId: this.mode === 'wrong-broker' ? 'attacker' : 'broker-v1',
      requestedRelativePath: request.relativePath,
      canonicalRootUri: expectedRootUri,
      canonicalTargetUri: this.mode === 'escape'
        ? 'file:///etc/passwd'
        : this.mode === 'prefix-escape'
          ? 'file:///workspace-escape/file.txt'
          : target,
      handleToken: this.mode === 'empty-handle' ? ' ' : `handle:${request.relativePath}`,
      symlinkTraversed: this.mode === 'symlink',
      device: 'dev-1',
      inode: `inode:${request.relativePath}`,
      resolvedAt: this.mode === 'wrong-time' ? T500 : request.at,
    };
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
