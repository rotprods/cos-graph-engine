import {
  ToolDefinition, ToolResult, ITool, CellContext, EntityId,
} from '@cos/core';
import { generateId, CellError } from '@cos/core';
import * as fsp from 'fs/promises';
import * as https from 'https';
import * as http from 'http';
import * as vm from 'vm';
import * as path from 'path';

// ================================================================
// REAL TOOL IMPLEMENTATIONS
// Using Node.js built-in modules: fs, http/https, vm
// ================================================================

export class FileSystemTool implements ITool {
  readonly definition: ToolDefinition = {
    id: 'tool:fs' as EntityId,
    name: 'filesystem',
    description: 'Read, write, and manage files on the local filesystem',
    version: { major: 2, minor: 1, patch: 0 },
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
    const startTime = Date.now();
    try {
      if (!input || typeof input !== 'object') throw new Error('Filesystem input must be an object');
      if (typeof input.path !== 'string' || input.path.trim().length === 0) throw new Error('Filesystem path must not be empty');
      const targetPath = path.resolve(input.path);
      const stat = await fsp.stat(targetPath).catch(() => null);

      switch (input.operation) {
        case 'read': {
          if (!stat) throw new Error(`File not found: ${input.path}`);
          if (!stat.isFile()) throw new Error(`Not a file: ${input.path}`);
          const content = await fsp.readFile(targetPath, 'utf-8');
          return this.ok({ path: input.path, size: content.length, content: content.substring(0, 100000), truncated: content.length > 100000 }, startTime);
        }
        case 'write': {
          if (input.content === undefined) throw new Error('Content required for write');
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
          const files = entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
          }));
          return this.ok({ path: input.path, files, count: files.length }, startTime);
        }
        case 'exists': {
          return this.ok({
            path: input.path,
            exists: stat !== null,
            isDirectory: stat?.isDirectory() || false,
            isFile: stat?.isFile() || false,
          }, startTime);
        }
        case 'mkdtemp': {
          await fsp.mkdir(targetPath, { recursive: true });
          const dir = await fsp.mkdtemp(path.join(targetPath, 'cos-'));
          return this.ok({ path: dir, created: true }, startTime);
        }
        default:
          throw new Error(`Unknown operation: ${input.operation}`);
      }
    } catch (error) {
      return this.failure('FS_ERROR', error, startTime);
    }
  }

  private ok(output: unknown, startTime: number): ToolResult {
    return {
      success: true,
      output,
      cost: { ...this.definition.cost },
      latency: Date.now() - startTime,
      metadata: {},
    };
  }

  private failure(code: string, error: unknown, startTime: number): ToolResult {
    return {
      success: false,
      output: null,
      cost: { ...this.definition.cost },
      latency: Date.now() - startTime,
      error: {
        id: generateId(),
        code,
        message: error instanceof Error ? error.message : String(error),
        severity: 'error',
        timestamp: new Date().toISOString(),
      },
      metadata: {},
    };
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
    version: { major: 2, minor: 1, patch: 0 },
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

  async execute(
    input: {
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    },
    context: CellContext,
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      if (!input || typeof input !== 'object') throw new Error('HTTP input must be an object');
      const method = String(input.method || '').toUpperCase();
      if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        throw new Error(`Unsupported HTTP method: ${input.method}`);
      }
      const url = new URL(input.url);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`Unsupported HTTP protocol: ${url.protocol}`);
      }
      const timeout = input.timeout ?? 10000;
      if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 30000) {
        throw new Error('HTTP timeout must be in (0,30000] ms');
      }
      if (input.body !== undefined && Buffer.byteLength(input.body, 'utf8') > 1_000_000) {
        throw new Error('HTTP request body exceeds 1 MB');
      }

      const mod = url.protocol === 'https:' ? https : http;
      const result = await new Promise<{
        statusCode: number;
        headers: Record<string, string | string[] | undefined>;
        body: string;
        truncated: boolean;
      }>((resolve, reject) => {
        let settled = false;
        const req = mod.request(url, {
          method,
          headers: {
            ...input.headers,
            'Content-Type': input.headers?.['Content-Type'] || 'application/json',
          },
          timeout,
        }, response => {
          let data = '';
          let truncated = false;
          response.on('data', (chunk: Buffer) => {
            if (truncated) return;
            data += chunk.toString();
            if (data.length > 500000) {
              truncated = true;
              data = data.substring(0, 500000);
            }
          });
          response.on('end', () => {
            if (settled) return;
            settled = true;
            resolve({
              statusCode: response.statusCode || 0,
              headers: response.headers,
              body: data.substring(0, 100000),
              truncated: truncated || data.length > 100000,
            });
          });
        });
        req.on('error', error => {
          if (settled) return;
          settled = true;
          reject(error);
        });
        req.on('timeout', () => {
          if (settled) return;
          settled = true;
          req.destroy();
          reject(new Error('Request timeout'));
        });
        if (input.body !== undefined) req.write(input.body);
        req.end();
      });

      return {
        success: true,
        output: {
          statusCode: result.statusCode,
          body: result.body,
          headers: result.headers,
          size: result.body.length,
          truncated: result.truncated,
        },
        cost: { ...this.definition.cost },
        latency: Date.now() - startTime,
        metadata: { method, url: input.url, statusCode: result.statusCode },
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        cost: { ...this.definition.cost },
        latency: Date.now() - startTime,
        error: {
          id: generateId(),
          code: 'HTTP_ERROR',
          message: error instanceof Error ? error.message : String(error),
          severity: 'error',
          timestamp: new Date().toISOString(),
        },
        metadata: {},
      };
    }
  }
}

// ================================================================
// SEARCH TOOL
// ================================================================

export type SearchSource = 'knowledge' | 'memory' | 'files' | 'all';

export interface SearchHit {
  type: string;
  path: string;
  content: string;
  score: number;
  source?: Exclude<SearchSource, 'all'>;
}

export type SearchAdapter = (
  query: string,
  limit: number,
  context: CellContext,
) => Promise<SearchHit[]>;

/**
 * Search capability with explicit adapter availability.
 *
 * The previous implementation claimed knowledge/memory/all support while only
 * scanning files and encoded exceptions inside a success result. This version
 * fails closed when a requested corpus is not configured and never returns
 * `success=true` with embedded error evidence.
 */
export class SearchTool implements ITool {
  readonly definition: ToolDefinition = {
    id: 'tool:search' as EntityId,
    name: 'search',
    description: 'Search configured knowledge, memory, and filesystem corpora',
    version: { major: 2, minor: 1, patch: 0 },
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

  constructor(
    private readonly adapters: Partial<Record<'knowledge' | 'memory', SearchAdapter>> = {},
    private readonly filesystemRoots: string[] = ['.'],
  ) {}

  async execute(
    input: { query: string; source?: SearchSource; limit?: number },
    context: CellContext,
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      if (!input || typeof input !== 'object') throw new Error('Search input must be an object');
      const query = typeof input.query === 'string' ? input.query.trim() : '';
      if (!query) throw new Error('Search query must not be empty');
      if (query.length > 2000) throw new Error('Search query exceeds 2000 characters');
      const source: SearchSource = input.source || 'files';
      if (!['knowledge', 'memory', 'files', 'all'].includes(source)) {
        throw new Error(`Unknown search source: ${String(source)}`);
      }
      const limit = input.limit ?? 10;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new Error('Search limit must be an integer in [1,100]');
      }

      const requested: Array<Exclude<SearchSource, 'all'>> = source === 'all'
        ? ['knowledge', 'memory', 'files']
        : [source];
      const unavailable = requested.filter(item => item !== 'files' && !this.adapters[item]);
      if (unavailable.length > 0) {
        throw new Error(`SEARCH_SOURCE_UNAVAILABLE sources=${unavailable.join(',')}`);
      }

      const results: SearchHit[] = [];
      for (const requestedSource of requested) {
        if (requestedSource === 'files') {
          for (const root of this.filesystemRoots) {
            await this.searchDir(path.resolve(root), query.toLowerCase(), results, 2);
          }
          continue;
        }
        const adapter = this.adapters[requestedSource];
        if (!adapter) throw new Error(`SEARCH_SOURCE_UNAVAILABLE source=${requestedSource}`);
        const hits = await adapter(query, limit, context);
        results.push(...hits.map(hit => ({ ...hit, source: requestedSource })));
      }

      results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
      const topResults = results.slice(0, limit);
      return {
        success: true,
        output: {
          results: topResults,
          total: results.length,
          query,
          searchedSources: requested,
        },
        cost: { ...this.definition.cost },
        latency: Date.now() - startTime,
        metadata: {
          source,
          resultCount: results.length,
          searchedSources: requested.join(','),
        },
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        cost: { ...this.definition.cost },
        latency: Date.now() - startTime,
        error: {
          id: generateId(),
          code: 'SEARCH_ERROR',
          message: error instanceof Error ? error.message : String(error),
          severity: 'error',
          timestamp: new Date().toISOString(),
        },
        metadata: {},
      };
    }
  }

  private async searchDir(
    dirPath: string,
    query: string,
    results: SearchHit[],
    depth: number,
  ): Promise<void> {
    if (depth <= 0) return;
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        try {
          await this.searchDir(fullPath, query, results, depth - 1);
        } catch {
          // A nested unreadable path is skipped; the requested root itself is
          // not swallowed and still fails the operation above.
        }
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        try {
          const content = await fsp.readFile(fullPath, 'utf-8');
          const lower = content.toLowerCase();
          const index = lower.indexOf(query);
          if (index !== -1) {
            const score = Math.min(1, (query.length / Math.max(1, content.length)) * 1000);
            results.push({
              type: 'file',
              source: 'files',
              path: fullPath,
              content: content.substring(Math.max(0, index - 100), index + query.length + 100),
              score,
            });
          }
        } catch {
          // Individual unreadable files do not invalidate the whole corpus.
        }
      }
    }
  }
}

// ================================================================
// CODE EVALUATION UTILITY
// ================================================================

/**
 * `node:vm` is an isolation convenience, not a security boundary. Authority
 * deployments must run untrusted code in an OS/container sandbox with resource
 * and network controls. This utility is intentionally not registered as a tool.
 */
export class CodeSandbox {
  private config = { maxMemory: 256, maxOutput: 1024 * 1024, timeout: 30000 };

  async execute(code: string, language: string = 'javascript', context?: CellContext): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    duration: number;
    memoryUsed: number;
    error: unknown;
  }> {
    const startTime = Date.now();
    const output: string[] = [];
    const errors: string[] = [];

    if (language !== 'javascript') {
      return {
        stdout: '',
        stderr: `Language '${language}' not supported`,
        exitCode: 1,
        duration: 0,
        memoryUsed: 0,
        error: { code: 'UNSUPPORTED' },
      };
    }

    try {
      const sandbox = {
        console: {
          log: (...args: unknown[]) => output.push(args.map(value =>
            typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
          ).join(' ')),
          error: (...args: unknown[]) => errors.push(args.map(String).join(' ')),
        },
        setTimeout,
        clearTimeout,
        Math,
        JSON,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Map,
        Set,
        Promise,
        Error,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
      };

      const vmContext = vm.createContext(sandbox);
      const script = new vm.Script(code);
      const result = script.runInContext(vmContext, { timeout: this.config.timeout });

      return {
        stdout: output.join('\n') + (result !== undefined ? `\n=> ${JSON.stringify(result)}` : ''),
        stderr: errors.join('\n'),
        exitCode: 0,
        duration: Date.now() - startTime,
        memoryUsed: 0,
        error: null,
      };
    } catch (error) {
      return {
        stdout: output.join('\n'),
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        duration: Date.now() - startTime,
        memoryUsed: 0,
        error: {
          code: 'SANDBOX_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}

// ================================================================
// TOOL REGISTRY
// ================================================================

export interface RegisterToolOptions {
  replace?: boolean;
}

export class ToolRegistry {
  private tools: Map<string, ITool> = new Map();

  constructor() {
    this.register(new FileSystemTool());
    this.register(new HTTPTool());
    this.register(new SearchTool());
  }

  register(tool: ITool, options: RegisterToolOptions = {}): void {
    const name = tool.definition.name.trim();
    if (!name) throw new Error('Tool name must not be empty');
    const existing = this.tools.get(name);
    if (existing && !options.replace) {
      throw new Error(`TOOL_ALREADY_REGISTERED name=${name}`);
    }
    this.tools.set(name, tool);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  getAll(): ITool[] {
    return Array.from(this.tools.values());
  }

  async execute(name: string, input: unknown, context: CellContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) throw new CellError('TOOL_NOT_FOUND', `Tool '${name}' not registered`);
    return tool.execute(input, context);
  }

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map(tool => ({
      ...tool.definition,
      version: { ...tool.definition.version },
      permissions: [...tool.definition.permissions],
      cost: {
        ...tool.definition.cost,
        tokens: tool.definition.cost.tokens ? { ...tool.definition.cost.tokens } : undefined,
      },
      rateLimit: { ...tool.definition.rateLimit },
      retryConfig: { ...tool.definition.retryConfig },
    }));
  }
}
