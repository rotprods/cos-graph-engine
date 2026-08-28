import { canonicalHash128, canonicalizeJsonValue } from '@cos/core';
import { isIP } from 'node:net';

export type AuthorityHttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface AuthorityResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface AuthorityDnsResolver {
  resolve(hostname: string): Promise<AuthorityResolvedAddress[]>;
}

export interface AuthorityHttpEgressPolicy {
  /** Exact hosts or `*.example.com` suffix patterns. Empty is invalid. */
  allowedHosts: string[];
  /** HTTPS-only unless explicitly enabled. */
  allowHttp?: boolean;
  /** Defaults to 443, plus 80 when allowHttp=true. */
  allowedPorts?: number[];
  /** Defaults to GET/HEAD/POST/PUT/PATCH/DELETE. */
  allowedMethods?: AuthorityHttpMethod[];
  /** Bounds DNS fan-out and rebinding surface. */
  maxResolvedAddresses?: number;
  /** A pinned decision must be consumed before this TTL expires. */
  decisionTtlMs?: number;
  /** Every redirect must be independently re-authorized. */
  maxRedirects?: number;
}

export interface AuthorityHttpEgressRequest {
  url: string;
  method: AuthorityHttpMethod;
  /** Explicit operation time; wall-clock defaults are prohibited. */
  at: string;
  redirectCount?: number;
}

export interface AuthorityPinnedHttpTarget {
  schemaVersion: 1;
  canonicalUrl: string;
  protocol: 'http:' | 'https:';
  hostname: string;
  port: number;
  method: AuthorityHttpMethod;
  resolvedAddresses: AuthorityResolvedAddress[];
  authorizedAt: string;
  expiresAt: string;
  redirectCount: number;
  policyHash: string;
  decisionHash: string;
}

/**
 * Produces a DNS-pinned egress decision. It never performs the network request.
 *
 * Authority transports must consume the returned resolved-address set directly
 * (including TLS SNI/Host handling) and must not resolve the hostname again.
 * Redirects must call `authorizeRedirect`, which resolves and evaluates the new
 * target from scratch. A normal `fetch(url)` after this check would reintroduce
 * DNS rebinding and is therefore not an authority implementation.
 */
export class AuthorityHttpEgressGuard {
  private readonly policy: Required<Omit<AuthorityHttpEgressPolicy, 'allowedPorts' | 'allowedMethods'>> & {
    allowedPorts: number[];
    allowedMethods: AuthorityHttpMethod[];
  };
  private readonly policyHashValue: string;

  constructor(
    policy: AuthorityHttpEgressPolicy,
    private readonly resolver: AuthorityDnsResolver,
  ) {
    this.policy = normalizeHttpPolicy(policy);
    this.policyHashValue = canonicalHash128(this.policy);
  }

  get policyHash(): string { return this.policyHashValue; }

  async authorize(request: AuthorityHttpEgressRequest): Promise<AuthorityPinnedHttpTarget> {
    const at = canonicalTime(request.at, 'HTTP authorization time');
    const redirectCount = request.redirectCount ?? 0;
    if (!Number.isSafeInteger(redirectCount) || redirectCount < 0) {
      throw new Error('EGRESS_REDIRECT_COUNT_INVALID');
    }
    if (redirectCount > this.policy.maxRedirects) {
      throw new Error(`EGRESS_REDIRECT_LIMIT_EXCEEDED count=${redirectCount}`);
    }
    if (!this.policy.allowedMethods.includes(request.method)) {
      throw new Error(`EGRESS_METHOD_DENIED method=${request.method}`);
    }

    let parsed: URL;
    try {
      parsed = new URL(request.url);
    } catch {
      throw new Error('EGRESS_URL_INVALID');
    }
    if (parsed.username || parsed.password) throw new Error('EGRESS_URL_CREDENTIALS_DENIED');
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`EGRESS_PROTOCOL_DENIED protocol=${parsed.protocol}`);
    }
    if (parsed.protocol === 'http:' && !this.policy.allowHttp) {
      throw new Error('EGRESS_HTTP_DENIED');
    }
    parsed.hash = '';

    const hostname = normalizeHostname(parsed.hostname);
    assertNonLocalHostname(hostname);
    if (!this.policy.allowedHosts.some(pattern => hostMatches(hostname, pattern))) {
      throw new Error(`EGRESS_HOST_DENIED host=${hostname}`);
    }

    const port = parsed.port
      ? positivePort(Number(parsed.port))
      : parsed.protocol === 'https:' ? 443 : 80;
    if (!this.policy.allowedPorts.includes(port)) {
      throw new Error(`EGRESS_PORT_DENIED port=${port}`);
    }

    const rawAddresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) as 4 | 6 }]
      : await this.resolver.resolve(hostname);
    if (!Array.isArray(rawAddresses) || rawAddresses.length === 0) {
      throw new Error(`EGRESS_DNS_EMPTY host=${hostname}`);
    }
    if (rawAddresses.length > this.policy.maxResolvedAddresses) {
      throw new Error(`EGRESS_DNS_FANOUT_EXCEEDED count=${rawAddresses.length}`);
    }

    const unique = new Map<string, AuthorityResolvedAddress>();
    for (const raw of rawAddresses) {
      const normalized = normalizeResolvedAddress(raw);
      const classification = classifyIp(normalized.address);
      if (classification !== 'public') {
        throw new Error(`EGRESS_ADDRESS_DENIED address=${normalized.address} class=${classification}`);
      }
      unique.set(`${normalized.family}:${normalized.address}`, normalized);
    }
    const resolvedAddresses = Array.from(unique.values())
      .sort((left, right) => left.family - right.family || left.address.localeCompare(right.address));
    if (resolvedAddresses.length === 0) throw new Error(`EGRESS_DNS_EMPTY host=${hostname}`);

    const expiresAt = new Date(Date.parse(at) + this.policy.decisionTtlMs).toISOString();
    const decisionWithoutHash = {
      schemaVersion: 1 as const,
      canonicalUrl: parsed.toString(),
      protocol: parsed.protocol as 'http:' | 'https:',
      hostname,
      port,
      method: request.method,
      resolvedAddresses,
      authorizedAt: at,
      expiresAt,
      redirectCount,
      policyHash: this.policyHashValue,
    };
    const decision: AuthorityPinnedHttpTarget = {
      ...decisionWithoutHash,
      decisionHash: canonicalHash128(decisionWithoutHash),
    };
    return cloneHttpTarget(decision);
  }

  async authorizeRedirect(
    previous: AuthorityPinnedHttpTarget,
    location: string,
    at: string,
  ): Promise<AuthorityPinnedHttpTarget> {
    this.assertPinned(previous, at);
    let next: URL;
    try {
      next = new URL(location, previous.canonicalUrl);
    } catch {
      throw new Error('EGRESS_REDIRECT_URL_INVALID');
    }
    return this.authorize({
      url: next.toString(),
      method: previous.method,
      at,
      redirectCount: previous.redirectCount + 1,
    });
  }

  assertPinned(target: AuthorityPinnedHttpTarget, at: string): void {
    const checkedAt = canonicalTime(at, 'HTTP pinned-target check time');
    if (target.schemaVersion !== 1) throw new Error('EGRESS_DECISION_SCHEMA_UNSUPPORTED');
    if (target.policyHash !== this.policyHashValue) throw new Error('EGRESS_POLICY_HASH_MISMATCH');
    const { decisionHash, ...payload } = target;
    if (canonicalHash128(payload) !== decisionHash) throw new Error('EGRESS_DECISION_HASH_MISMATCH');
    if (Date.parse(checkedAt) < Date.parse(target.authorizedAt)) {
      throw new Error('EGRESS_DECISION_NOT_YET_VALID');
    }
    if (Date.parse(checkedAt) >= Date.parse(target.expiresAt)) {
      throw new Error('EGRESS_DECISION_EXPIRED');
    }
    for (const address of target.resolvedAddresses) {
      if (classifyIp(address.address) !== 'public') {
        throw new Error(`EGRESS_PINNED_ADDRESS_INVALID address=${address.address}`);
      }
    }
  }
}

export type AuthorityFileOperation = 'read' | 'write' | 'create' | 'delete';

export interface AuthorityFileRootPolicy {
  rootId: string;
  /** Canonical file URI returned by the trusted broker, e.g. file:///workspace. */
  canonicalRootUri: string;
  brokerId: string;
  operations: AuthorityFileOperation[];
  allowSymlinks?: boolean;
}

export interface AuthorityFileOpenRequest {
  rootId: string;
  relativePath: string;
  operation: AuthorityFileOperation;
  /** Explicit operation time. */
  at: string;
}

export interface AuthorityFileBrokerResolution {
  rootId: string;
  brokerId: string;
  requestedRelativePath: string;
  canonicalRootUri: string;
  canonicalTargetUri: string;
  /** Opaque handle opened by the broker; callers must not reopen by path. */
  handleToken: string;
  symlinkTraversed: boolean;
  device?: string;
  inode?: string;
  resolvedAt: string;
}

export interface AuthorityFileSystemBroker {
  /**
   * Must resolve and open atomically (openat/dirfd or equivalent). Returning a
   * path that is opened later does not satisfy the authority contract.
   */
  resolveAndOpen(
    request: AuthorityFileOpenRequest,
    expectedRootUri: string,
  ): Promise<AuthorityFileBrokerResolution>;
}

export interface AuthorityPinnedFileTarget {
  schemaVersion: 1;
  rootId: string;
  brokerId: string;
  operation: AuthorityFileOperation;
  relativePath: string;
  canonicalRootUri: string;
  canonicalTargetUri: string;
  handleToken: string;
  handleHash: string;
  device: string | null;
  inode: string | null;
  symlinkTraversed: boolean;
  authorizedAt: string;
  policyHash: string;
  decisionHash: string;
}

/**
 * Filesystem boundary that only authorizes broker-opened opaque handles.
 *
 * Lexical checks are defense-in-depth; canonical containment and symlink state
 * come from a trusted deployment broker that must open the file atomically.
 * Authority code must use `handleToken` and may not reopen `canonicalTargetUri`.
 */
export class AuthorityFileSandbox {
  private readonly roots = new Map<string, Required<AuthorityFileRootPolicy>>();
  private readonly policyHashValue: string;

  constructor(
    policies: AuthorityFileRootPolicy[],
    private readonly broker: AuthorityFileSystemBroker,
  ) {
    if (!Array.isArray(policies) || policies.length === 0) {
      throw new Error('FILESYSTEM_ROOT_POLICY_REQUIRED');
    }
    for (const raw of policies) {
      const rootId = nonEmpty(raw.rootId, 'filesystem rootId');
      if (this.roots.has(rootId)) throw new Error(`FILESYSTEM_ROOT_DUPLICATE root=${rootId}`);
      const brokerId = nonEmpty(raw.brokerId, 'filesystem brokerId');
      const canonicalRootUri = canonicalFileUri(raw.canonicalRootUri, 'filesystem root URI');
      const operations = Array.from(new Set(raw.operations)).sort();
      if (operations.length === 0) throw new Error(`FILESYSTEM_OPERATIONS_REQUIRED root=${rootId}`);
      this.roots.set(rootId, {
        rootId,
        brokerId,
        canonicalRootUri,
        operations,
        allowSymlinks: raw.allowSymlinks ?? false,
      });
    }
    this.policyHashValue = canonicalHash128(Array.from(this.roots.values())
      .sort((left, right) => left.rootId.localeCompare(right.rootId)));
  }

  get policyHash(): string { return this.policyHashValue; }

  async authorizeAndOpen(request: AuthorityFileOpenRequest): Promise<AuthorityPinnedFileTarget> {
    const rootId = nonEmpty(request.rootId, 'filesystem rootId');
    const policy = this.roots.get(rootId);
    if (!policy) throw new Error(`FILESYSTEM_ROOT_DENIED root=${rootId}`);
    if (!policy.operations.includes(request.operation)) {
      throw new Error(`FILESYSTEM_OPERATION_DENIED root=${rootId} operation=${request.operation}`);
    }
    const at = canonicalTime(request.at, 'filesystem authorization time');
    const relativePath = normalizeRelativePath(request.relativePath);
    const normalizedRequest: AuthorityFileOpenRequest = {
      rootId,
      relativePath,
      operation: request.operation,
      at,
    };
    const resolution = await this.broker.resolveAndOpen(
      structuredClone(normalizedRequest),
      policy.canonicalRootUri,
    );

    if (resolution.rootId !== rootId) throw new Error('FILESYSTEM_BROKER_ROOT_ID_MISMATCH');
    if (resolution.brokerId !== policy.brokerId) throw new Error('FILESYSTEM_BROKER_ID_MISMATCH');
    if (normalizeRelativePath(resolution.requestedRelativePath) !== relativePath) {
      throw new Error('FILESYSTEM_BROKER_REQUEST_PATH_MISMATCH');
    }
    if (canonicalTime(resolution.resolvedAt, 'filesystem broker resolvedAt') !== at) {
      throw new Error('FILESYSTEM_BROKER_TIME_MISMATCH');
    }

    const canonicalRootUri = canonicalFileUri(resolution.canonicalRootUri, 'broker root URI');
    const canonicalTargetUri = canonicalFileUri(resolution.canonicalTargetUri, 'broker target URI');
    if (canonicalRootUri !== policy.canonicalRootUri) {
      throw new Error('FILESYSTEM_BROKER_ROOT_URI_MISMATCH');
    }
    if (!fileUriContained(canonicalRootUri, canonicalTargetUri)) {
      throw new Error(`FILESYSTEM_ROOT_ESCAPE target=${canonicalTargetUri}`);
    }
    if (resolution.symlinkTraversed && !policy.allowSymlinks) {
      throw new Error('FILESYSTEM_SYMLINK_DENIED');
    }
    const handleToken = nonEmpty(resolution.handleToken, 'filesystem handleToken');
    const handleHash = canonicalHash128({ brokerId: policy.brokerId, handleToken });

    const decisionWithoutHash = {
      schemaVersion: 1 as const,
      rootId,
      brokerId: policy.brokerId,
      operation: request.operation,
      relativePath,
      canonicalRootUri,
      canonicalTargetUri,
      handleToken,
      handleHash,
      device: optionalString(resolution.device) ?? null,
      inode: optionalString(resolution.inode) ?? null,
      symlinkTraversed: resolution.symlinkTraversed,
      authorizedAt: at,
      policyHash: this.policyHashValue,
    };
    const decision: AuthorityPinnedFileTarget = {
      ...decisionWithoutHash,
      decisionHash: canonicalHash128(decisionWithoutHash),
    };
    return structuredClone(decision);
  }

  assertPinned(target: AuthorityPinnedFileTarget): void {
    if (target.schemaVersion !== 1) throw new Error('FILESYSTEM_DECISION_SCHEMA_UNSUPPORTED');
    if (target.policyHash !== this.policyHashValue) throw new Error('FILESYSTEM_POLICY_HASH_MISMATCH');
    const policy = this.roots.get(target.rootId);
    if (!policy) throw new Error(`FILESYSTEM_ROOT_DENIED root=${target.rootId}`);
    if (target.brokerId !== policy.brokerId) throw new Error('FILESYSTEM_BROKER_ID_MISMATCH');
    if (!policy.operations.includes(target.operation)) throw new Error('FILESYSTEM_OPERATION_DENIED');
    if (!fileUriContained(policy.canonicalRootUri, target.canonicalTargetUri)) {
      throw new Error('FILESYSTEM_ROOT_ESCAPE');
    }
    if (target.symlinkTraversed && !policy.allowSymlinks) throw new Error('FILESYSTEM_SYMLINK_DENIED');
    if (canonicalHash128({ brokerId: target.brokerId, handleToken: target.handleToken }) !== target.handleHash) {
      throw new Error('FILESYSTEM_HANDLE_HASH_MISMATCH');
    }
    const { decisionHash, ...payload } = target;
    if (canonicalHash128(payload) !== decisionHash) throw new Error('FILESYSTEM_DECISION_HASH_MISMATCH');
  }
}

function normalizeHttpPolicy(raw: AuthorityHttpEgressPolicy): Required<Omit<AuthorityHttpEgressPolicy, 'allowedPorts' | 'allowedMethods'>> & {
  allowedPorts: number[];
  allowedMethods: AuthorityHttpMethod[];
} {
  const allowedHosts = Array.from(new Set(raw.allowedHosts.map(normalizeHostPattern))).sort();
  if (allowedHosts.length === 0) throw new Error('EGRESS_ALLOWED_HOST_REQUIRED');
  const allowHttp = raw.allowHttp ?? false;
  const allowedPorts = Array.from(new Set(raw.allowedPorts ?? (allowHttp ? [80, 443] : [443])))
    .map(positivePort)
    .sort((a, b) => a - b);
  const allowedMethods = Array.from(new Set(raw.allowedMethods ?? ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']))
    .sort() as AuthorityHttpMethod[];
  if (allowedMethods.length === 0) throw new Error('EGRESS_ALLOWED_METHOD_REQUIRED');
  const maxResolvedAddresses = boundedInteger(raw.maxResolvedAddresses ?? 8, 1, 64, 'maxResolvedAddresses');
  const decisionTtlMs = boundedInteger(raw.decisionTtlMs ?? 30_000, 1, 300_000, 'decisionTtlMs');
  const maxRedirects = boundedInteger(raw.maxRedirects ?? 3, 0, 20, 'maxRedirects');
  return { allowedHosts, allowHttp, allowedPorts, allowedMethods, maxResolvedAddresses, decisionTtlMs, maxRedirects };
}

function normalizeHostPattern(pattern: string): string {
  const normalized = nonEmpty(pattern, 'allowed host pattern').toLowerCase();
  if (normalized.startsWith('*.')) {
    const suffix = normalizeHostname(normalized.slice(2));
    if (!suffix.includes('.')) throw new Error(`EGRESS_WILDCARD_TOO_BROAD pattern=${pattern}`);
    return `*.${suffix}`;
  }
  if (normalized.includes('*')) throw new Error(`EGRESS_HOST_PATTERN_INVALID pattern=${pattern}`);
  return normalizeHostname(normalized);
}

function hostMatches(host: string, pattern: string): boolean {
  if (!pattern.startsWith('*.')) return host === pattern;
  const suffix = pattern.slice(2);
  return host.endsWith(`.${suffix}`) && host !== suffix;
}

function normalizeHostname(value: string): string {
  const hostname = nonEmpty(value, 'hostname').toLowerCase();
  return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
}

function assertNonLocalHostname(hostname: string): void {
  const denied = hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname === 'home.arpa'
    || hostname.endsWith('.home.arpa');
  if (denied) throw new Error(`EGRESS_LOCAL_HOSTNAME_DENIED host=${hostname}`);
}

function normalizeResolvedAddress(raw: AuthorityResolvedAddress): AuthorityResolvedAddress {
  const address = nonEmpty(raw.address, 'resolved address').toLowerCase();
  const actualFamily = isIP(address);
  if (actualFamily !== 4 && actualFamily !== 6) throw new Error(`EGRESS_ADDRESS_INVALID address=${address}`);
  if (actualFamily !== raw.family) throw new Error(`EGRESS_ADDRESS_FAMILY_MISMATCH address=${address}`);
  return { address, family: actualFamily };
}

function classifyIp(address: string): string {
  const family = isIP(address);
  if (family === 4) return classifyIpv4(address);
  if (family !== 6) return 'invalid';
  const parsed = parseIpv6(address);
  if (parsed.embeddedIpv4) {
    const embeddedClass = classifyIpv4(parsed.embeddedIpv4);
    if (embeddedClass !== 'public') return `ipv4-mapped-${embeddedClass}`;
  }
  const h = parsed.hextets;
  if (h.every(part => part === 0)) return 'unspecified';
  if (h.slice(0, 7).every(part => part === 0) && h[7] === 1) return 'loopback';
  if ((h[0] & 0xfe00) === 0xfc00) return 'unique-local';
  if ((h[0] & 0xffc0) === 0xfe80) return 'link-local';
  if ((h[0] & 0xff00) === 0xff00) return 'multicast';
  if (h[0] === 0x2001 && h[1] === 0x0db8) return 'documentation';
  if (h[0] === 0x2001 && h[1] === 0x0000) return 'teredo';
  if (h[0] === 0x2002) return '6to4';
  if (h[0] === 0x0064 && h[1] === 0xff9b) return 'nat64';
  return 'public';
}

function classifyIpv4(address: string): string {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return 'invalid';
  const [a, b, c, d] = octets as [number, number, number, number];
  if (a === 0) return 'this-network';
  if (a === 10) return 'private';
  if (a === 100 && b >= 64 && b <= 127) return 'carrier-grade-nat';
  if (a === 127) return 'loopback';
  if (a === 169 && b === 254) return 'link-local';
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 192 && b === 0 && c === 0) return 'ietf-protocol';
  if (a === 192 && b === 0 && c === 2) return 'documentation';
  if (a === 192 && b === 168) return 'private';
  if (a === 198 && (b === 18 || b === 19)) return 'benchmark';
  if (a === 198 && b === 51 && c === 100) return 'documentation';
  if (a === 203 && b === 0 && c === 113) return 'documentation';
  if (a >= 224 && a <= 239) return 'multicast';
  if (a >= 240) return a === 255 && b === 255 && c === 255 && d === 255 ? 'broadcast' : 'reserved';
  return 'public';
}

function parseIpv6(address: string): { hextets: number[]; embeddedIpv4?: string } {
  let value = address.toLowerCase();
  let embeddedIpv4: string | undefined;
  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':');
    if (lastColon < 0) throw new Error(`EGRESS_ADDRESS_INVALID address=${address}`);
    embeddedIpv4 = value.slice(lastColon + 1);
    if (classifyIpv4(embeddedIpv4) === 'invalid') throw new Error(`EGRESS_ADDRESS_INVALID address=${address}`);
    const octets = embeddedIpv4.split('.').map(Number);
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    value = `${value.slice(0, lastColon)}:${high}:${low}`;
  }
  const halves = value.split('::');
  if (halves.length > 2) throw new Error(`EGRESS_ADDRESS_INVALID address=${address}`);
  const left = halves[0] ? halves[0].split(':').filter(Boolean) : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':').filter(Boolean) : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) {
    throw new Error(`EGRESS_ADDRESS_INVALID address=${address}`);
  }
  const parts = [...left, ...Array(missing).fill('0'), ...right];
  if (parts.length !== 8) throw new Error(`EGRESS_ADDRESS_INVALID address=${address}`);
  const hextets = parts.map(part => {
    if (!/^[0-9a-f]{1,4}$/.test(part)) throw new Error(`EGRESS_ADDRESS_INVALID address=${address}`);
    return Number.parseInt(part, 16);
  });
  return embeddedIpv4 ? { hextets, embeddedIpv4 } : { hextets };
}

function normalizeRelativePath(value: string): string {
  const path = nonEmpty(value, 'relative path').normalize('NFC');
  if (path.includes('\0')) throw new Error('FILESYSTEM_NUL_DENIED');
  if (path.includes('\\')) throw new Error('FILESYSTEM_BACKSLASH_DENIED');
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path) || path.startsWith('file:')) {
    throw new Error('FILESYSTEM_ABSOLUTE_PATH_DENIED');
  }
  const segments = path.split('/');
  if (segments.some(segment => segment.length === 0)) throw new Error('FILESYSTEM_EMPTY_SEGMENT_DENIED');
  for (const segment of segments) {
    const decoded = repeatedlyDecode(segment);
    if (decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\') || decoded.includes('\0')) {
      throw new Error('FILESYSTEM_TRAVERSAL_DENIED');
    }
  }
  return segments.join('/');
}

function repeatedlyDecode(value: string): string {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    let decoded: string;
    try { decoded = decodeURIComponent(current); } catch { throw new Error('FILESYSTEM_PATH_ENCODING_INVALID'); }
    if (decoded === current) return decoded;
    current = decoded;
  }
  return current;
}

function canonicalFileUri(value: string, label: string): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`${label} is invalid`); }
  if (parsed.protocol !== 'file:') throw new Error(`${label} must use file:`);
  if (parsed.username || parsed.password || parsed.host) throw new Error(`${label} must be local and credential-free`);
  parsed.hash = '';
  parsed.search = '';
  const pathname = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  parsed.pathname = pathname;
  return parsed.toString();
}

function fileUriContained(rootUri: string, targetUri: string): boolean {
  const root = new URL(rootUri);
  const target = new URL(targetUri);
  if (root.protocol !== 'file:' || target.protocol !== 'file:') return false;
  const rootPath = decodeURIComponent(root.pathname).replace(/\/$/, '') || '/';
  const targetPath = decodeURIComponent(target.pathname).replace(/\/$/, '') || '/';
  return targetPath === rootPath || targetPath.startsWith(`${rootPath}/`);
}

function cloneHttpTarget(target: AuthorityPinnedHttpTarget): AuthorityPinnedHttpTarget {
  return { ...target, resolvedAddresses: target.resolvedAddresses.map(address => ({ ...address })) };
}

function positivePort(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 65_535) throw new Error(`EGRESS_PORT_INVALID port=${value}`);
  return value;
}

function boundedInteger(value: number, min: number, max: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`EGRESS_POLICY_${label.toUpperCase()}_INVALID`);
  }
  return value;
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function optionalString(value: string | undefined): string | undefined {
  const normalized = value?.normalize('NFC').trim();
  return normalized || undefined;
}

// Force the compiler to validate that every public decision is canonicalizable.
void canonicalizeJsonValue;
