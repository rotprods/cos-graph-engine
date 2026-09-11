import {
  ToolDefinition, ToolResult, ITool, CellContext,
  EntityId,
} from '@cos/core';
import { generateId, CellError } from '@cos/core';
import * as fsp from 'fs/promises';
import * as https from 'https';
import * as http from 'http';
import * as path from 'path';

// ================================================================
// REAL TOOL IMPLEMENTATIONS
// Using Node.js built-in modules: fs, http/https
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
// REAL HTTP TOOL
// ================================================================

export class HTTPTool implements ITool {
  readonly definition: ToolDefinition = {
    id: 'tool:http' as EntityId,
    name: 'http_client',
    description: 'Make real HTTP requests to external APIs and services',
    version: { major: 2, minor: 0, patch: 0 },
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
    retryConfig: { maxRetries: 2, backoffMs: 2000 },
  };

  async execute(input: { method: string; url: string; headers?: Record<string, string>; body?: string; timeout?: number }, context: CellContext): Promise<ToolResult> {
    void context;
    const startTime = Date.now();
    const timeout = input.timeout || 10000;

    try {
      const url = new URL(input.url);
      const mod = url.protocol === 'https:' ? https : http;

      const result = await new Promise<{ statusCode: number; headers: Record<string, string>; body: string }>((resolve, reject) => {
        const req = mod.request(url, {
          method: input.method,
          headers: { ...input.headers, 'Content-Type': input.headers?.['Content-Type'] || 'application/json' },
          timeout,
        }, (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); if (data.length > 500000) req.destroy(); });
          res.on('end', () => resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers as Record<string, string>,
            body: data.substring(0, 100000),
          }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        if (input.body) req.write(input.body);
        req.end();
      });

      return {
        success: true,
        output: {
          statusCode: result.statusCode,
          body: result.body,
          headers: result.headers,
          size: result.body.length,
        },
        cost: this.definition.cost,
        latency: Date.now() - startTime,
        metadata: { method: input.method, url: input.url, statusCode: result.statusCode },
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        cost: this.definition.cost,
        latency: Date.now() - startTime,
        error: { id: generateId(), code: 'HTTP_ERROR', message: (error as Error).message, severity: 'error' as const, timestamp: new Date().toISOString() },
        metadata: {},
      };
    }
  }
}

// ================================================================
// AUTHORITY-SCOPED SEARCH TOOL
// ================================================================

export type SearchSource = 'knowledge' | 'memory' | 'files';

export interface SearchProviderAuthority {
  /** Opaque authority scope identifier; path traversal is never inferred from host CWD. */
  root: string;
  /** File-backed providers must declare the file classes they are authorized to return. */
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
