import {
  ToolDefinition, ToolResult, ITool, CellContext,
  EntityId,
} from '@cos/core';
import { generateId, CellError } from '@cos/core';
import * as fsp from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { isIP } from 'net';

// ================================================================
// ROOT-CONFINED FILESYSTEM TOOL
// ================================================================

export interface FileSystemToolOptions {
  root?: string;
  maxReadBytes?: number;
  maxWriteBytes?: number;
  maxListEntries?: number;
}

interface ResolvedFileTarget {
  absolutePath: string;
  relativePath: string;
  exists: boolean;
  isDirectory: boolean;
  isFile: boolean;
}

class FileSystemBoundaryError extends Error {
  constructor(readonly code: 'FS_SCOPE_VIOLATION' | 'FS_ERROR', message: string) {
    super(message);
    this.name = 'FileSystemBoundaryError';
  }
}

export class FileSystemTool implements ITool {
  readonly definition: ToolDefinition = {
    id: 'tool:fs' as EntityId,
    name: 'filesystem',
    description: 'Read, write, and manage files inside an explicitly bound workspace root',
    version: { major: 3, minor: 0, patch: 0 },
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['read', 'write', 'delete', 'list', 'exists', 'mkdtemp'] },
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['operation', 'path'],
    },
    outputSchema: { type: 'object' },
    permissions: ['read', 'write'],
    cost: { units: 'credits', amount: 0.01 },
    timeout: 30000,
    rateLimit: { maxPerMinute: 60, maxPerHour: 1000 },
    retryConfig: { maxRetries: 0, backoffMs: 0 },
  };

  private readonly configuredRoot?: string;
  private readonly maxReadBytes: number;
  private readonly maxWriteBytes: number;
  private readonly maxListEntries: number;
  private canonicalRootPromise?: Promise<string>;

  constructor(options: FileSystemToolOptions = {}) {
    this.configuredRoot = options.root;
    this.maxReadBytes = positiveFsBound(options.maxReadBytes, 100_000, 10_000_000, 'maxReadBytes');
    this.maxWriteBytes = positiveFsBound(options.maxWriteBytes, 1_000_000, 10_000_000, 'maxWriteBytes');
    this.maxListEntries = positiveFsBound(options.maxListEntries, 10_000, 100_000, 'maxListEntries');
  }

  async execute(input: { operation: string; path: string; content?: string }, context: CellContext): Promise<ToolResult> {
    void context;
    const startTime = Date.now();
    if (!this.configuredRoot) {
      return this.fail('FS_AUTHORITY_UNBOUND', 'Filesystem authority requires an explicit workspace root', startTime);
    }

    let relativePath: string;
    let root: string;
    try {
      relativePath = normalizeFsRelativePath(input.path);
      root = await this.canonicalRoot();
    } catch (error) {
      return this.boundaryFailure(error, startTime);
    }

    try {
      switch (input.operation) {
        case 'read': {
          const target = await this.resolveExisting(root, relativePath);
          if (!target.exists || !target.isFile) {
            throw new FileSystemBoundaryError('FS_ERROR', `File not found: ${relativePath}`);
          }
          const handle = await fsp.open(
            target.absolutePath,
            fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
          ).catch(error => {
            throw boundaryFromNodeError(error, relativePath);
          });
          try {
            const stat = await handle.stat();
            if (!stat.isFile()) throw new FileSystemBoundaryError('FS_ERROR', `Not a file: ${relativePath}`);
            if (stat.size > this.maxReadBytes) {
              throw new FileSystemBoundaryError('FS_ERROR', `File exceeds ${this.maxReadBytes} byte read limit`);
            }
            const content = await handle.readFile({ encoding: 'utf8' });
            return this.ok({ path: relativePath, size: Buffer.byteLength(content, 'utf8'), content }, startTime);
          } finally {
            await handle.close();
          }
        }
        case 'write': {
          if (typeof input.content !== 'string') {
            throw new FileSystemBoundaryError('FS_ERROR', 'Content required for write');
          }
          const contentBytes = Buffer.byteLength(input.content, 'utf8');
          if (contentBytes > this.maxWriteBytes) {
            throw new FileSystemBoundaryError('FS_ERROR', `Write exceeds ${this.maxWriteBytes} byte limit`);
          }
          const segments = splitFsRelativePath(relativePath);
          const fileName = segments.at(-1);
          if (!fileName) throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', 'A file path is required');
          const parentSegments = segments.slice(0, -1);
          const parent = await this.ensureDirectoryChain(root, parentSegments);
          await assertCanonicalParent(root, parent);

          const targetPath = path.join(parent, fileName);
          const existing = await safeLstat(targetPath);
          if (existing?.isSymbolicLink()) throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', `Symlink target denied: ${relativePath}`);
          if (existing?.isDirectory()) throw new FileSystemBoundaryError('FS_ERROR', `Cannot overwrite directory: ${relativePath}`);

          const tempPath = path.join(parent, `.cos-write-${randomUUID()}`);
          let tempExists = false;
          try {
            const handle = await fsp.open(
              tempPath,
              fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW,
              0o600,
            );
            tempExists = true;
            try {
              await handle.writeFile(input.content, { encoding: 'utf8' });
              await handle.sync();
            } finally {
              await handle.close();
            }
            await assertCanonicalParent(root, parent);
            const preRename = await safeLstat(targetPath);
            if (preRename?.isSymbolicLink()) throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', `Symlink target denied: ${relativePath}`);
            await fsp.rename(tempPath, targetPath);
            tempExists = false;
            await assertCanonicalParent(root, parent);
            const postWrite = await safeLstat(targetPath);
            if (!postWrite || postWrite.isSymbolicLink() || !postWrite.isFile()) {
              throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', `Write target changed unexpectedly: ${relativePath}`);
            }
          } finally {
            if (tempExists) await fsp.rm(tempPath, { force: true }).catch(() => undefined);
          }
          return this.ok({ path: relativePath, size: contentBytes, written: true }, startTime);
        }
        case 'delete': {
          const target = await this.resolveExisting(root, relativePath);
          if (!target.exists) throw new FileSystemBoundaryError('FS_ERROR', `File not found: ${relativePath}`);
          await this.revalidateNoSymlinks(root, relativePath);
          const finalStat = await safeLstat(target.absolutePath);
          if (!finalStat) throw new FileSystemBoundaryError('FS_ERROR', `File not found: ${relativePath}`);
          if (finalStat.isSymbolicLink()) throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', `Symlink delete denied: ${relativePath}`);
          await fsp.rm(target.absolutePath, { recursive: finalStat.isDirectory(), force: false });
          return this.ok({ path: relativePath, deleted: true }, startTime);
        }
        case 'list': {
          const target = await this.resolveExisting(root, relativePath);
          if (!target.exists || !target.isDirectory) throw new FileSystemBoundaryError('FS_ERROR', `Not a directory: ${relativePath}`);
          await this.revalidateNoSymlinks(root, relativePath);
          const entries = await fsp.readdir(target.absolutePath, { withFileTypes: true });
          if (entries.length > this.maxListEntries) {
            throw new FileSystemBoundaryError('FS_ERROR', `Directory exceeds ${this.maxListEntries} entry limit`);
          }
          const files = entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            isSymbolicLink: entry.isSymbolicLink(),
          }));
          return this.ok({ path: relativePath, files, count: files.length }, startTime);
        }
        case 'exists': {
          const target = await this.resolveExisting(root, relativePath, true);
          return this.ok({
            path: relativePath,
            exists: target.exists,
            isDirectory: target.isDirectory,
            isFile: target.isFile,
          }, startTime);
        }
        case 'mkdtemp': {
          const directory = await this.ensureDirectoryChain(root, splitFsRelativePath(relativePath));
          await assertCanonicalParent(root, directory);
          const created = await fsp.mkdtemp(path.join(directory, 'cos-'));
          const createdReal = await fsp.realpath(created);
          assertContainedPath(root, createdReal);
          const outputPath = toPortableRelative(root, createdReal);
          return this.ok({ path: outputPath, created: true }, startTime);
        }
        default:
          throw new FileSystemBoundaryError('FS_ERROR', `Unknown operation: ${input.operation}`);
      }
    } catch (error) {
      return this.boundaryFailure(error, startTime);
    }
  }

  private async canonicalRoot(): Promise<string> {
    if (!this.configuredRoot) throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', 'Filesystem root is not configured');
    if (!this.canonicalRootPromise) {
      this.canonicalRootPromise = (async () => {
        const configured = path.resolve(this.configuredRoot!);
        const stat = await fsp.lstat(configured).catch(error => {
          throw boundaryFromNodeError(error, configured);
        });
        if (stat.isSymbolicLink()) throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', 'Configured filesystem root must not be a symlink');
        if (!stat.isDirectory()) throw new FileSystemBoundaryError('FS_ERROR', 'Configured filesystem root is not a directory');
        const real = await fsp.realpath(configured);
        const realStat = await fsp.lstat(real);
        if (realStat.isSymbolicLink() || !realStat.isDirectory()) {
          throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', 'Configured filesystem root is not a stable directory');
        }
        return real;
      })();
    }
    return this.canonicalRootPromise;
  }

  private async resolveExisting(root: string, relativePath: string, allowMissing = false): Promise<ResolvedFileTarget> {
    const segments = splitFsRelativePath(relativePath);
    let current = root;
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]!;
      const candidate = path.join(current, segment);
      const stat = await safeLstat(candidate);
      if (!stat) {
        if (allowMissing) {
          return { absolutePath: candidate, relativePath, exists: false, isDirectory: false, isFile: false };
        }
        throw new FileSystemBoundaryError('FS_ERROR', `Path not found: ${relativePath}`);
      }
      if (stat.isSymbolicLink()) throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', `Symlink traversal denied: ${relativePath}`);
      if (index < segments.length - 1 && !stat.isDirectory()) {
        throw new FileSystemBoundaryError('FS_ERROR', `Non-directory path component: ${segment}`);
      }
      const real = await fsp.realpath(candidate);
      assertContainedPath(root, real);
      current = real;
    }
    const finalStat = await fsp.lstat(current);
    return {
      absolutePath: current,
      relativePath,
      exists: true,
      isDirectory: finalStat.isDirectory(),
      isFile: finalStat.isFile(),
    };
  }

  private async ensureDirectoryChain(root: string, segments: string[]): Promise<string> {
    let current = root;
    for (const segment of segments) {
      const candidate = path.join(current, segment);
      let stat = await safeLstat(candidate);
      if (!stat) {
        await fsp.mkdir(candidate, { mode: 0o700 });
        stat = await fsp.lstat(candidate);
      }
      if (stat.isSymbolicLink()) throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', `Symlink directory denied: ${segment}`);
      if (!stat.isDirectory()) throw new FileSystemBoundaryError('FS_ERROR', `Path component is not a directory: ${segment}`);
      const real = await fsp.realpath(candidate);
      assertContainedPath(root, real);
      current = real;
    }
    return current;
  }

  private async revalidateNoSymlinks(root: string, relativePath: string): Promise<void> {
    const segments = splitFsRelativePath(relativePath);
    let current = root;
    for (const segment of segments) {
      const candidate = path.join(current, segment);
      const stat = await safeLstat(candidate);
      if (!stat) throw new FileSystemBoundaryError('FS_ERROR', `Path not found: ${relativePath}`);
      if (stat.isSymbolicLink()) throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', `Symlink traversal denied: ${relativePath}`);
      const real = await fsp.realpath(candidate);
      assertContainedPath(root, real);
      current = real;
    }
  }

  private boundaryFailure(error: unknown, startTime: number): ToolResult {
    if (error instanceof FileSystemBoundaryError) return this.fail(error.code, error.message, startTime);
    return this.fail('FS_ERROR', errorMessage(error), startTime);
  }

  private fail(code: string, message: string, startTime: number): ToolResult {
    return {
      success: false,
      output: null,
      cost: this.definition.cost,
      latency: Date.now() - startTime,
      error: { id: generateId(), code, message, severity: 'error' as const, timestamp: new Date().toISOString() },
      metadata: {},
    };
  }

  private ok(output: unknown, startTime: number): ToolResult {
    return { success: true, output, cost: this.definition.cost, latency: Date.now() - startTime, metadata: {} };
  }
}

async function safeLstat(targetPath: string): Promise<Awaited<ReturnType<typeof fsp.lstat>> | null> {
  try {
    return await fsp.lstat(targetPath);
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) return null;
    throw error;
  }
}

function normalizeFsRelativePath(input: string): string {
  if (typeof input !== 'string') throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', 'Filesystem path must be a string');
  const value = input.normalize('NFC');
  if (!value || value.includes('\0')) throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', 'Filesystem path is empty or contains NUL');
  if (value.includes('\\')) throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', 'Backslash path syntax is not authorized');
  if (path.posix.isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.startsWith('//') || value.toLowerCase().startsWith('file:')) {
    throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', 'Absolute filesystem paths are not authorized');
  }
  const rawSegments = value.split('/');
  if (rawSegments.some(segment => segment.length === 0)) throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', 'Empty path segments are not authorized');
  for (const segment of rawSegments) {
    const decoded = repeatedlyDecodeFsSegment(segment);
    if (decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\') || decoded.includes('\0')) {
      throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', 'Filesystem traversal syntax is not authorized');
    }
  }
  const normalized = path.posix.normalize(rawSegments.join('/'));
  if (normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', 'Filesystem path escapes the workspace root');
  }
  return normalized;
}

function repeatedlyDecodeFsSegment(value: string): string {
  let current = value;
  for (let index = 0; index < 3; index += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', 'Filesystem path encoding is invalid');
    }
    if (decoded === current) return decoded;
    current = decoded;
  }
  return current;
}

function splitFsRelativePath(relativePath: string): string[] {
  return relativePath.split('/');
}

function assertContainedPath(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) return;
  throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', 'Filesystem target escapes the configured workspace root');
}

async function assertCanonicalParent(root: string, parent: string): Promise<void> {
  const real = await fsp.realpath(parent);
  assertContainedPath(root, real);
  const stat = await fsp.lstat(parent);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new FileSystemBoundaryError('FS_SCOPE_VIOLATION', 'Filesystem parent is not a stable directory');
  }
}

function toPortableRelative(root: string, candidate: string): string {
  assertContainedPath(root, candidate);
  const relative = path.relative(root, candidate);
  return relative.split(path.sep).join('/');
}

function boundaryFromNodeError(error: unknown, relativePath: string): FileSystemBoundaryError {
  if (isNodeErrorCode(error, 'ELOOP')) {
    return new FileSystemBoundaryError('FS_SCOPE_VIOLATION', `Symlink traversal denied: ${relativePath}`);
  }
  return new FileSystemBoundaryError('FS_ERROR', errorMessage(error));
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

function positiveFsBound(value: number | undefined, fallback: number, maximum: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new CellError('FS_CONFIG_INVALID', `${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

// ================================================================
// AUTHORITY-SCOPED HTTP EGRESS TOOL
// ================================================================

export interface HTTPResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface HTTPEgressAuthorizationRequest {
  url: string;
  method: string;
  hostname: string;
  addresses: HTTPResolvedAddress[];
  redirectFrom?: string;
  context: CellContext;
}

export interface HTTPEgressAuthorizationDecision {
  allowed: boolean;
  policyRef?: string;
  reason?: string;
}

export type HTTPResolver = (hostname: string) => Promise<HTTPResolvedAddress[]>;
export type HTTPEgressAuthorizationHook = (
  request: HTTPEgressAuthorizationRequest,
) => HTTPEgressAuthorizationDecision | Promise<HTTPEgressAuthorizationDecision>;

export interface HTTPPinnedTransportRequest {
  url: string;
  protocol: 'http:' | 'https:';
  hostname: string;
  port: number;
  address: string;
  family: 4 | 6;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeout: number;
  maxResponseBytes: number;
}

export interface HTTPPinnedTransportResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export type HTTPPinnedTransport = (
  request: HTTPPinnedTransportRequest,
) => Promise<HTTPPinnedTransportResponse>;

export interface HTTPToolOptions {
  resolve?: HTTPResolver;
  authorize?: HTTPEgressAuthorizationHook;
  transport?: HTTPPinnedTransport;
  maxResponseBytes?: number;
  maxTimeoutMs?: number;
  maxRedirects?: number;
}

export class HTTPTool implements ITool {
  readonly definition: ToolDefinition = {
    id: 'tool:http' as EntityId,
    name: 'http_client',
    description: 'Make policy-authorized, DNS-pinned HTTP requests',
    version: { major: 3, minor: 0, patch: 0 },
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
        url: { type: 'string' },
        headers: { type: 'object' },
        body: { type: 'string' },
        timeout: { type: 'number' },
      },
      required: ['method', 'url'],
    },
    outputSchema: { type: 'object' },
    permissions: ['execute'],
    cost: { units: 'credits', amount: 0.05 },
    timeout: 15000,
    rateLimit: { maxPerMinute: 30, maxPerHour: 500 },
    retryConfig: { maxRetries: 0, backoffMs: 0 },
  };

  private readonly resolveHost?: HTTPResolver;
  private readonly authorizeEgress?: HTTPEgressAuthorizationHook;
  private readonly transport?: HTTPPinnedTransport;
  private readonly maxResponseBytes: number;
  private readonly maxTimeoutMs: number;
  private readonly maxRedirects: number;

  constructor(options: HTTPToolOptions = {}) {
    this.resolveHost = options.resolve;
    this.authorizeEgress = options.authorize;
    this.transport = options.transport;
    this.maxResponseBytes = positiveBoundedOption(options.maxResponseBytes, 100_000, 1_000_000, 'maxResponseBytes');
    this.maxTimeoutMs = positiveBoundedOption(options.maxTimeoutMs, 10_000, 120_000, 'maxTimeoutMs');
    this.maxRedirects = nonNegativeBoundedOption(options.maxRedirects, 3, 10, 'maxRedirects');
  }

  async execute(input: { method: string; url: string; headers?: Record<string, string>; body?: string; timeout?: number }, context: CellContext): Promise<ToolResult> {
    const startTime = Date.now();
    if (!this.resolveHost || !this.authorizeEgress || !this.transport) {
      return this.fail('HTTP_EGRESS_UNBOUND', 'HTTP egress requires explicit resolver, authorization policy, and pinned transport', startTime);
    }

    const method = normalizeHTTPMethod(input.method);
    if (!method) return this.fail('HTTP_INPUT_INVALID', `Unsupported HTTP method '${input.method}'`, startTime);
    if (input.timeout !== undefined && (!Number.isFinite(input.timeout) || input.timeout <= 0)) {
      return this.fail('HTTP_INPUT_INVALID', 'HTTP timeout must be a positive finite number', startTime);
    }

    const timeout = Math.min(input.timeout ?? this.maxTimeoutMs, this.maxTimeoutMs);
    let currentURL: URL;
    try {
      currentURL = new URL(input.url);
    } catch {
      return this.fail('HTTP_INPUT_INVALID', 'HTTP URL is invalid', startTime);
    }

    let requestContext: CellContext;
    try {
      requestContext = structuredClone(context);
    } catch (error) {
      return this.fail('HTTP_INPUT_INVALID', `HTTP context could not be safely snapshotted: ${errorMessage(error)}`, startTime);
    }

    let headers = normalizeHTTPHeaders(input.headers);
    let redirectFrom: string | undefined;
    let redirects = 0;
    let lastPolicyRef = '';
    let lastPinnedAddress = '';

    for (;;) {
      const parsed = validateOutboundURL(currentURL);
      if (parsed) return this.fail('HTTP_EGRESS_DENIED', parsed, startTime, { redirects });

      const hostname = normalizeURLHostname(currentURL.hostname);
      let addresses: HTTPResolvedAddress[];
      try {
        const literalFamily = isIP(hostname);
        addresses = literalFamily === 4 || literalFamily === 6
          ? [{ address: hostname, family: literalFamily }]
          : await this.resolveHost(hostname);
      } catch (error) {
        return this.fail('HTTP_EGRESS_RESOLUTION_FAILED', `DNS resolution failed closed: ${errorMessage(error)}`, startTime, { redirects });
      }

      const normalizedAddresses = normalizeResolvedAddresses(addresses);
      if (normalizedAddresses.length === 0) {
        return this.fail('HTTP_EGRESS_DENIED', `No valid address was resolved for '${hostname}'`, startTime, { redirects });
      }
      if (normalizedAddresses.some(address => !isPublicEgressAddress(address.address))) {
        return this.fail('HTTP_EGRESS_DENIED', `Resolved address set for '${hostname}' contains non-public space`, startTime, { redirects });
      }

      let decision: HTTPEgressAuthorizationDecision;
      try {
        decision = await this.authorizeEgress({
          url: currentURL.toString(),
          method,
          hostname,
          addresses: structuredClone(normalizedAddresses),
          redirectFrom,
          context: structuredClone(requestContext),
        });
      } catch (error) {
        return this.fail(
          'HTTP_EGRESS_AUTHORIZATION_FAILED',
          `HTTP egress authorization failed closed: ${errorMessage(error)}`,
          startTime,
          { redirects },
        );
      }
      if (!decision || decision.allowed !== true) {
        return this.fail(
          'HTTP_EGRESS_DENIED',
          decision?.reason?.trim() || `HTTP egress policy denied '${hostname}'`,
          startTime,
          { redirects },
        );
      }

      const pinned = choosePinnedAddress(normalizedAddresses);
      lastPinnedAddress = pinned.address;
      lastPolicyRef = decision.policyRef?.trim() || '';

      let response: HTTPPinnedTransportResponse;
      try {
        response = await this.transport({
          url: currentURL.toString(),
          protocol: currentURL.protocol as 'http:' | 'https:',
          hostname,
          port: currentURL.port ? Number(currentURL.port) : currentURL.protocol === 'https:' ? 443 : 80,
          address: pinned.address,
          family: pinned.family,
          method,
          headers,
          ...(input.body === undefined ? {} : { body: input.body }),
          timeout,
          maxResponseBytes: this.maxResponseBytes,
        });
      } catch (error) {
        return this.fail('HTTP_TRANSPORT_ERROR', `Pinned HTTP transport failed: ${errorMessage(error)}`, startTime, {
          redirects,
          pinnedAddress: pinned.address,
          policyRef: lastPolicyRef,
        });
      }

      if (!Number.isInteger(response.statusCode) || response.statusCode < 100 || response.statusCode > 599 || typeof response.body !== 'string') {
        return this.fail('HTTP_TRANSPORT_ERROR', 'Pinned HTTP transport returned an invalid response', startTime, {
          redirects,
          pinnedAddress: pinned.address,
          policyRef: lastPolicyRef,
        });
      }
      if (Buffer.byteLength(response.body, 'utf8') > this.maxResponseBytes) {
        return this.fail('HTTP_RESPONSE_TOO_LARGE', `HTTP response exceeded ${this.maxResponseBytes} bytes`, startTime, {
          redirects,
          pinnedAddress: pinned.address,
          policyRef: lastPolicyRef,
        });
      }

      const location = getHTTPHeader(response.headers, 'location');
      if (response.statusCode >= 300 && response.statusCode < 400 && location) {
        if (redirects >= this.maxRedirects) {
          return this.fail('HTTP_REDIRECT_LIMIT', `HTTP redirect limit ${this.maxRedirects} exceeded`, startTime, {
            redirects,
            pinnedAddress: pinned.address,
            policyRef: lastPolicyRef,
          });
        }
        const previousURL = currentURL;
        try {
          currentURL = new URL(location, currentURL);
        } catch {
          return this.fail('HTTP_EGRESS_DENIED', 'HTTP redirect location is invalid', startTime, { redirects });
        }
        redirectFrom = previousURL.toString();
        redirects += 1;
        if (previousURL.origin !== currentURL.origin) headers = stripSensitiveRedirectHeaders(headers);
        continue;
      }

      return {
        success: true,
        output: {
          statusCode: response.statusCode,
          body: response.body,
          headers: response.headers,
          size: Buffer.byteLength(response.body, 'utf8'),
          url: currentURL.toString(),
        },
        cost: this.definition.cost,
        latency: Date.now() - startTime,
        metadata: {
          method,
          url: currentURL.toString(),
          statusCode: response.statusCode,
          pinnedAddress: lastPinnedAddress,
          policyRef: lastPolicyRef,
          redirects,
        },
      };
    }
  }

  private fail(
    code: string,
    message: string,
    startTime: number,
    metadata: Record<string, string | number | boolean> = {},
  ): ToolResult {
    return {
      success: false,
      output: null,
      cost: this.definition.cost,
      latency: Date.now() - startTime,
      error: { id: generateId(), code, message, severity: 'error' as const, timestamp: new Date().toISOString() },
      metadata,
    };
  }
}

function normalizeHTTPMethod(method: string): string | null {
  const normalized = method.toUpperCase();
  return normalized === 'GET' || normalized === 'POST' || normalized === 'PUT' || normalized === 'DELETE' || normalized === 'PATCH'
    ? normalized
    : null;
}

function normalizeHTTPHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers ?? {})) {
    const normalizedName = name.trim();
    if (!normalizedName || /[\r\n]/.test(normalizedName) || /[\r\n]/.test(value)) continue;
    result[normalizedName] = value;
  }
  if (!Object.keys(result).some(name => name.toLowerCase() === 'content-type')) result['Content-Type'] = 'application/json';
  return result;
}

function validateOutboundURL(url: URL): string | null {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return `Protocol '${url.protocol}' is not authorized for HTTP egress`;
  if (url.username || url.password) return 'Credentials embedded in URLs are not authorized';
  if (!url.hostname) return 'HTTP egress URL has no hostname';
  return null;
}

function normalizeURLHostname(hostname: string): string {
  const lower = hostname.toLowerCase();
  return lower.startsWith('[') && lower.endsWith(']') ? lower.slice(1, -1) : lower;
}

function normalizeResolvedAddresses(addresses: HTTPResolvedAddress[]): HTTPResolvedAddress[] {
  if (!Array.isArray(addresses)) return [];
  const unique = new Map<string, HTTPResolvedAddress>();
  for (const entry of addresses) {
    if (!entry || (entry.family !== 4 && entry.family !== 6)) continue;
    const address = normalizeURLHostname(String(entry.address).trim());
    if (isIP(address) !== entry.family) continue;
    unique.set(`${entry.family}:${address}`, { address, family: entry.family });
  }
  return Array.from(unique.values()).sort((a, b) => a.family - b.family || a.address.localeCompare(b.address));
}

function choosePinnedAddress(addresses: HTTPResolvedAddress[]): HTTPResolvedAddress {
  const first = addresses[0];
  if (!first) throw new CellError('HTTP_EGRESS_DENIED', 'No authorized address is available to pin');
  return first;
}

function isPublicEgressAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIPv4(address);
  if (family === 6) return isPublicIPv6(address);
  return false;
}

function isPublicIPv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === undefined || b === undefined || c === undefined) return false;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicIPv6(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower.includes('%')) return false;
  if (lower === '::' || lower === '::1') return false;
  const embeddedIPv4 = lower.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  if (embeddedIPv4) return false;
  const firstToken = lower.split(':')[0] || '0';
  const first = Number.parseInt(firstToken, 16);
  if (!Number.isFinite(first)) return false;
  if ((first & 0xfe00) === 0xfc00) return false;
  if ((first & 0xffc0) === 0xfe80) return false;
  if ((first & 0xff00) === 0xff00) return false;
  if (lower.startsWith('100::') || lower.startsWith('100:0:0:0:')) return false;
  if (lower.startsWith('2001:db8:') || lower === '2001:db8::') return false;
  if (lower.startsWith('2001:2:')) return false;
  if (lower.startsWith('2001:10:') || lower.startsWith('2001:20:')) return false;
  if (lower.startsWith('2001:0:') || lower.startsWith('2001::')) return false;
  if (lower.startsWith('2002:')) return false;
  if (lower.startsWith('64:ff9b:') || lower.startsWith('64:ff9b::')) return false;
  return true;
}

function getHTTPHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target) continue;
    if (Array.isArray(value)) return value[0];
    return value;
  }
  return undefined;
}

function stripSensitiveRedirectHeaders(headers: Record<string, string>): Record<string, string> {
  const blocked = new Set(['authorization', 'cookie', 'proxy-authorization']);
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !blocked.has(name.toLowerCase())));
}

function positiveBoundedOption(value: number | undefined, fallback: number, maximum: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new CellError('HTTP_CONFIG_INVALID', `${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function nonNegativeBoundedOption(value: number | undefined, fallback: number, maximum: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new CellError('HTTP_CONFIG_INVALID', `${name} must be an integer between 0 and ${maximum}`);
  }
  return value;
}

// ================================================================
// AUTHORITY-SCOPED SEARCH TOOL
// ================================================================

export type SearchSource = 'knowledge' | 'memory' | 'files';

export interface SearchProviderAuthority {
  root: string;
  allowedExtensions: string[];
}

export interface SearchProviderMatch {
  type: string;
  path: string;
  content: string;
  score: number;
}

export interface SearchProviderRequest {
  query: string;
  limit: number;
  maxSnippetChars: number;
  context: CellContext;
}

export interface SearchProvider {
  id: string;
  source: SearchSource;
  authority?: SearchProviderAuthority;
  search(request: SearchProviderRequest): Promise<SearchProviderMatch[]>;
}

export interface SearchToolOptions {
  providers?: SearchProvider[];
  maxResults?: number;
  maxSnippetChars?: number;
  maxQueryChars?: number;
}

export class SearchTool implements ITool {
  readonly definition: ToolDefinition = {
    id: 'tool:search' as EntityId,
    name: 'search',
    description: 'Search authority-scoped knowledge, memory, and file providers',
    version: { major: 3, minor: 0, patch: 0 },
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        source: { type: 'string', enum: ['knowledge', 'memory', 'files', 'all'] },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
    outputSchema: { type: 'object' },
    permissions: ['read'],
    cost: { units: 'credits', amount: 0.02 },
    timeout: 10000,
    rateLimit: { maxPerMinute: 60, maxPerHour: 1000 },
    retryConfig: { maxRetries: 2, backoffMs: 500 },
  };

  private readonly providers: SearchProvider[];
  private readonly maxResults: number;
  private readonly maxSnippetChars: number;
  private readonly maxQueryChars: number;

  constructor(options: SearchToolOptions = {}) {
    this.providers = [...(options.providers ?? [])];
    this.maxResults = boundedPositiveInteger(options.maxResults, 10, 100);
    this.maxSnippetChars = boundedPositiveInteger(options.maxSnippetChars, 512, 10000);
    this.maxQueryChars = boundedPositiveInteger(options.maxQueryChars, 4096, 32768);
  }

  async execute(input: { query: string; source?: string; limit?: number }, context: CellContext): Promise<ToolResult> {
    const startTime = Date.now();
    const query = typeof input.query === 'string' ? input.query.trim() : '';
    if (!query || query.length > this.maxQueryChars) {
      return this.fail('SEARCH_INPUT_INVALID', `Query must contain 1-${this.maxQueryChars} characters`, startTime, input.source);
    }

    const source = normalizeSearchSource(input.source);
    if (!source) {
      return this.fail('SEARCH_INPUT_INVALID', `Unsupported search source '${String(input.source)}'`, startTime, input.source);
    }

    if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) {
      return this.fail('SEARCH_INPUT_INVALID', 'Search limit must be a positive integer', startTime, source);
    }
    const requestedLimit = input.limit ?? this.maxResults;
    const limit = Math.min(requestedLimit, this.maxResults);
    const selectedProviders = source === 'all'
      ? [...this.providers]
      : this.providers.filter(provider => provider.source === source);

    if (selectedProviders.length === 0) {
      return this.fail('SEARCH_AUTHORITY_UNBOUND', `No authority-scoped provider is bound for '${source}'`, startTime, source);
    }

    let providerContext: CellContext;
    try {
      providerContext = structuredClone(context);
    } catch (error) {
      return this.fail('SEARCH_INPUT_INVALID', `Search context could not be safely snapshotted: ${errorMessage(error)}`, startTime, source);
    }

    const results: SearchProviderMatch[] = [];
    const authorityRoots: string[] = [];
    const providerIds: string[] = [];

    for (const provider of selectedProviders) {
      const authorityCheck = validateSearchProviderAuthority(provider);
      if (authorityCheck) {
        return this.fail('SEARCH_AUTHORITY_UNBOUND', authorityCheck, startTime, source);
      }

      let matches: SearchProviderMatch[];
      try {
        matches = await provider.search({
          query,
          limit,
          maxSnippetChars: this.maxSnippetChars,
          context: structuredClone(providerContext),
        });
      } catch (error) {
        return this.fail(
          'SEARCH_PROVIDER_ERROR',
          `Search provider '${provider.id}' failed closed: ${errorMessage(error)}`,
          startTime,
          source,
        );
      }

      if (!Array.isArray(matches)) {
        return this.fail('SEARCH_PROVIDER_ERROR', `Search provider '${provider.id}' returned a non-array result`, startTime, source);
      }

      for (const match of matches.slice(0, limit)) {
        const violation = validateSearchMatch(provider, match);
        if (violation) {
          return this.fail('SEARCH_SCOPE_VIOLATION', violation, startTime, source);
        }
        results.push({
          type: match.type,
          path: normalizeRelativeProviderPath(match.path),
          content: match.content.slice(0, this.maxSnippetChars),
          score: match.score,
        });
        if (results.length >= limit) break;
      }

      providerIds.push(provider.id);
      if (provider.authority?.root) authorityRoots.push(provider.authority.root);
      if (results.length >= limit) break;
    }

    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, limit);
    const uniqueRoots = Array.from(new Set(authorityRoots)).sort();

    return {
      success: true,
      output: { results: topResults, total: topResults.length, query: input.query },
      cost: this.definition.cost,
      latency: Date.now() - startTime,
      metadata: {
        source,
        resultCount: topResults.length,
        providers: providerIds.join(','),
        authority: uniqueRoots.join(','),
      },
    };
  }

  private fail(code: string, message: string, startTime: number, source?: string): ToolResult {
    return {
      success: false,
      output: null,
      cost: this.definition.cost,
      latency: Date.now() - startTime,
      error: {
        id: generateId(),
        code,
        message,
        severity: 'error' as const,
        timestamp: new Date().toISOString(),
      },
      metadata: { source: source ?? 'all' },
    };
  }
}

function normalizeSearchSource(source: string | undefined): SearchSource | 'all' | null {
  if (source === undefined || source === 'all') return 'all';
  if (source === 'files' || source === 'knowledge' || source === 'memory') return source;
  return null;
}

function boundedPositiveInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new CellError('SEARCH_CONFIG_INVALID', `Search bound must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function validateSearchProviderAuthority(provider: SearchProvider): string | null {
  if (!provider.id.trim()) return 'Search provider id is required';
  if (provider.source !== 'files') return null;
  const authority = provider.authority;
  if (!authority?.root?.trim()) return `File search provider '${provider.id}' has no bound authority root`;
  if (!Array.isArray(authority.allowedExtensions) || authority.allowedExtensions.length === 0) {
    return `File search provider '${provider.id}' has no allowed file classes`;
  }
  return null;
}

function validateSearchMatch(provider: SearchProvider, match: SearchProviderMatch): string | null {
  if (!match || typeof match.path !== 'string' || typeof match.content !== 'string' || !Number.isFinite(match.score)) {
    return `Search provider '${provider.id}' returned an invalid match`;
  }

  const normalizedPath = normalizeRelativeProviderPath(match.path);
  if (!normalizedPath || normalizedPath === '..' || normalizedPath.startsWith('../') || normalizedPath.startsWith('/') || match.path.includes('\0')) {
    return `Search provider '${provider.id}' returned an out-of-scope path`;
  }

  if (provider.source === 'files') {
    if (match.type !== 'file') return `File search provider '${provider.id}' returned non-file content`;
    const allowed = new Set((provider.authority?.allowedExtensions ?? []).map(normalizeExtension));
    const extension = path.posix.extname(normalizedPath).toLowerCase();
    if (!allowed.has(extension)) {
      return `Search provider '${provider.id}' returned disallowed file class '${extension || '<none>'}'`;
    }
  }

  return null;
}

function normalizeRelativeProviderPath(input: string): string {
  const portable = input.replace(/\\/g, '/');
  if (path.posix.isAbsolute(portable)) return portable;
  return path.posix.normalize(portable);
}

function normalizeExtension(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

// ================================================================
// CANONICAL CODE SANDBOX
// ================================================================

export { CodeSandbox, W1C_SANDBOX_IMAGE } from './sandbox';
export type { SandboxConfig, CodeExecutionResult } from './sandbox';

// ================================================================
// TOOL REGISTRY
// ================================================================

export interface ToolAuthorizationRequest {
  name: string;
  definition: ToolDefinition;
  input: unknown;
  context: CellContext;
  permissions: ToolDefinition['permissions'];
  sideEffecting: boolean;
}

export interface ToolAuthorizationDecision {
  allowed: boolean;
  reason?: string;
  policyRefs?: string[];
}

export type ToolAuthorizationHook = (
  request: ToolAuthorizationRequest,
) => ToolAuthorizationDecision | Promise<ToolAuthorizationDecision>;

export interface ToolRegistryOptions {
  registerBuiltins?: boolean;
  authorize?: ToolAuthorizationHook;
}

export interface ToolAuthorizationReceipt {
  schemaVersion: 1;
  capability: string;
  toolId: EntityId;
  toolVersion: ToolDefinition['version'];
  traceId: string;
  permissions: ToolDefinition['permissions'];
  sideEffecting: boolean;
  decision: 'allow';
  reason: string | null;
  policyRefs: string[];
}

export class ToolRegistry {
  private tools: Map<string, ITool> = new Map();
  private readonly authorize?: ToolAuthorizationHook;

  constructor(options: ToolRegistryOptions = {}) {
    this.authorize = options.authorize;
    if (options.registerBuiltins ?? true) {
      this.register(new FileSystemTool());
      this.register(new HTTPTool());
      this.register(new SearchTool());
    }
  }

  register(tool: ITool): void { this.tools.set(tool.definition.name, tool); }
  get(name: string): ITool | undefined { return this.tools.get(name); }
  getAll(): ITool[] { return Array.from(this.tools.values()); }

  async execute(name: string, input: unknown, context: CellContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) throw new CellError('TOOL_NOT_FOUND', `Tool '${name}' not registered`);
    if (!this.authorize) {
      throw new CellError(
        'TOOL_CAPABILITY_DENIED',
        `Tool '${name}' has no bound authorization policy`,
      );
    }

    let boundInput: unknown;
    let boundContext: CellContext;
    let definition: ToolDefinition;
    try {
      boundInput = structuredClone(input);
      boundContext = structuredClone(context);
      definition = structuredClone(tool.definition);
    } catch (error) {
      throw new CellError(
        'TOOL_CAPABILITY_INPUT_INVALID',
        `Tool '${name}' authorization input could not be safely snapshotted: ${errorMessage(error)}`,
      );
    }

    const permissions = [...definition.permissions];
    const sideEffecting = permissions.some(permission =>
      permission === 'write' || permission === 'execute' || permission === 'admin');

    let decision: ToolAuthorizationDecision;
    try {
      decision = await this.authorize({
        name,
        definition,
        input: boundInput,
        context: boundContext,
        permissions,
        sideEffecting,
      });
    } catch (error) {
      throw new CellError(
        'TOOL_CAPABILITY_AUTHORIZATION_FAILED',
        `Tool '${name}' authorization failed closed: ${errorMessage(error)}`,
      );
    }

    if (!decision || decision.allowed !== true) {
      const reason = decision?.reason?.trim() || 'authorization denied';
      throw new CellError('TOOL_CAPABILITY_DENIED', `Tool '${name}' denied: ${reason}`);
    }

    const policyRefs = normalizePolicyRefs(decision.policyRefs);
    const receipt: ToolAuthorizationReceipt = {
      schemaVersion: 1,
      capability: name,
      toolId: definition.id,
      toolVersion: structuredClone(definition.version),
      traceId: boundContext.traceId,
      permissions: [...permissions],
      sideEffecting,
      decision: 'allow',
      reason: decision.reason?.trim() || null,
      policyRefs,
    };

    const result = await tool.execute(boundInput, boundContext);
    return {
      ...result,
      metadata: {
        ...result.metadata,
        authorization: JSON.stringify(receipt),
      },
    };
  }

  getDefinitions(): ToolDefinition[] { return this.getAll().map(t => t.definition); }
}

function normalizePolicyRefs(input: string[] | undefined): string[] {
  if (!input) return [];
  const refs = input.map(value => value.trim()).filter(Boolean);
  return Array.from(new Set(refs)).sort();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
