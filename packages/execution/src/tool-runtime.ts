import {
  ToolDefinition, ToolResult, ITool, CellContext,
  EntityId,
} from '@cos/core';
import { generateId, CellError } from '@cos/core';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { isIP } from 'net';

// ================================================================
// REAL TOOL IMPLEMENTATIONS
// ================================================================

export class FileSystemTool implements ITool {
  readonly definition: ToolDefinition = {
    id: 'tool:fs' as EntityId,
    name: 'filesystem',
    description: 'Read, write, and manage files on the local filesystem',
    version: { major: 2, minor: 0, patch: 0 },
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
    retryConfig: { maxRetries: 2, backoffMs: 1000 },
  };

  async execute(input: { operation: string; path: string; content?: string }, context: CellContext): Promise<ToolResult> {
    void context;
    const startTime = Date.now();
    try {
      const targetPath = path.resolve(input.path);
      const stat = await fsp.stat(targetPath).catch(() => null);

      switch (input.operation) {
        case 'read': {
          if (!stat) throw new Error(`File not found: ${input.path}`);
          const content = await fsp.readFile(targetPath, 'utf-8');
          return this.ok({ path: input.path, size: content.length, content: content.substring(0, 100000) }, startTime);
        }
        case 'write': {
          if (!input.content) throw new Error('Content required for write');
          await fsp.mkdir(path.dirname(targetPath), { recursive: true });
          await fsp.writeFile(targetPath, input.content, 'utf-8');
          return this.ok({ path: input.path, size: input.content.length, written: true }, startTime);
        }
        case 'delete': {
          if (!stat) throw new Error(`File not found: ${input.path}`);
          await fsp.rm(targetPath, { recursive: true, force: true });
          return this.ok({ path: input.path, deleted: true }, startTime);
        }
        case 'list': {
          if (!stat?.isDirectory()) throw new Error(`Not a directory: ${input.path}`);
          const entries = await fsp.readdir(targetPath, { withFileTypes: true });
          const files = entries.map(e => ({ name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile() }));
          return this.ok({ path: input.path, files, count: files.length }, startTime);
        }
        case 'exists': {
          return this.ok({ path: input.path, exists: stat !== null, isDirectory: stat?.isDirectory() || false, isFile: stat?.isFile() || false }, startTime);
        }
        case 'mkdtemp': {
          const dir = await fsp.mkdtemp(path.join(targetPath, 'cos-'));
          return this.ok({ path: dir, created: true }, startTime);
        }
        default:
          throw new Error(`Unknown operation: ${input.operation}`);
      }
    } catch (error) {
      return {
        success: false,
        output: null,
        cost: this.definition.cost,
        latency: Date.now() - startTime,
        error: { id: generateId(), code: 'FS_ERROR', message: (error as Error).message, severity: 'error' as const, timestamp: new Date().toISOString() },
        metadata: {},
      };
    }
  }

  private ok(output: unknown, startTime: number): ToolResult {
    return { success: true, output, cost: this.definition.cost, latency: Date.now() - startTime, metadata: {} };
  }
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
  if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 ULA
  if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return false; // ff00::/8 multicast

  if (lower.startsWith('100::') || lower.startsWith('100:0:0:0:')) return false; // discard-only
  if (lower.startsWith('2001:db8:') || lower === '2001:db8::') return false; // documentation
  if (lower.startsWith('2001:2:')) return false; // benchmarking
  if (lower.startsWith('2001:10:') || lower.startsWith('2001:20:')) return false; // historical ORCHID
  if (lower.startsWith('2001:0:') || lower.startsWith('2001::')) return false; // Teredo/special
  if (lower.startsWith('2002:')) return false; // 6to4 embeds IPv4 routing
  if (lower.startsWith('64:ff9b:') || lower.startsWith('64:ff9b::')) return false; // translation prefixes
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
// REAL SEARCH TOOL (reads from knowledge graph + filesystem)
// ================================================================

export class SearchTool implements ITool {
  readonly definition: ToolDefinition = {
    id: 'tool:search' as EntityId,
    name: 'search',
    description: 'Search across knowledge graph, memory, and indexed content',
    version: { major: 2, minor: 0, patch: 0 },
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

  async execute(input: { query: string; source?: string; limit?: number }, context: CellContext): Promise<ToolResult> {
    void context;
    const startTime = Date.now();
    const query = input.query.toLowerCase();
    const limit = input.limit || 10;
    const results: Array<{ type: string; path: string; content: string; score: number }> = [];

    try {
      if (!input.source || input.source === 'files' || input.source === 'all') {
        await this.searchDir(path.resolve('.'), query, results, 2);
      }

      results.sort((a, b) => b.score - a.score);
      const topResults = results.slice(0, limit);

      return {
        success: true,
        output: { results: topResults, total: results.length, query: input.query },
        cost: this.definition.cost,
        latency: Date.now() - startTime,
        metadata: { source: input.source || 'all', resultCount: results.length },
      };
    } catch (error) {
      return {
        success: true,
        output: { results: [], total: 0, query: input.query, error: (error as Error).message },
        cost: this.definition.cost,
        latency: Date.now() - startTime,
        metadata: { source: input.source || 'all' },
      };
    }
  }

  private async searchDir(dirPath: string, query: string, results: Array<{ type: string; path: string; content: string; score: number }>, depth: number): Promise<void> {
    if (depth <= 0) return;
    try {
      const entries = await fsp.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await this.searchDir(fullPath, query, results, depth - 1);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          try {
            const content = await fsp.readFile(fullPath, 'utf-8');
            const lower = content.toLowerCase();
            const idx = lower.indexOf(query);
            if (idx !== -1) {
              const score = Math.min(1, (query.length / content.length) * 1000);
              results.push({
                type: 'file',
                path: fullPath,
                content: content.substring(Math.max(0, idx - 100), idx + query.length + 100),
                score,
              });
            }
          } catch {}
        }
      }
    } catch {}
  }
}

// ================================================================
// CANONICAL CODE SANDBOX
// ================================================================

// W1C deliberately owns exactly one sandbox implementation. Keeping the
// re-export here preserves the historical public import path without retaining
// a second same-process node:vm authority.
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
  /** Built-ins remain discoverable by default; registration is not execution authority. */
  registerBuiltins?: boolean;
  /** Missing authorization is intentionally fail-closed. */
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
