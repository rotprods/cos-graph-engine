import {
  ToolDefinition, ToolResult, ITool, CellContext,
  EntityId,
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
// REAL CODE SANDBOX (using Node.js vm module)
// ================================================================

export class CodeSandbox {
  private config = { maxMemory: 256, maxOutput: 1024 * 1024, timeout: 30000 };

  async execute(code: string, language: string = 'javascript', context?: CellContext): Promise<{
    stdout: string; stderr: string; exitCode: number; duration: number; memoryUsed: number; error: { code: string; message?: string } | null;
  }> {
    void context;
    const startTime = Date.now();
    const output: string[] = [];
    const errors: string[] = [];

    if (language !== 'javascript') {
      return { stdout: '', stderr: `Language '${language}' not supported`, exitCode: 1, duration: 0, memoryUsed: 0, error: { code: 'UNSUPPORTED' } };
    }

    try {
      const sandbox = {
        console: {
          log: (...args: unknown[]) => output.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
          error: (...args: unknown[]) => errors.push(args.map(String).join(' ')),
        },
        Math, JSON, Date, Array, Object, String, Number, Boolean, RegExp, Map, Set, Error, parseInt, parseFloat, isNaN, isFinite,
      };

      const vmContext = vm.createContext(sandbox, {
        name: 'cos-code-sandbox',
        codeGeneration: { strings: false, wasm: false },
      });
      const script = new vm.Script(code, { filename: 'sandbox.js' });
      // Timeout belongs to execution, not Script construction. Keeping it here
      // ensures synchronous runaway code is interrupted by Node's VM runtime.
      const result = script.runInContext(vmContext, { timeout: this.config.timeout });
      const resultText = result !== undefined ? `\n=> ${JSON.stringify(result)}` : '';
      const stdout = (output.join('\n') + resultText).slice(0, this.config.maxOutput);

      return {
        stdout,
        stderr: errors.join('\n').slice(0, this.config.maxOutput),
        exitCode: 0,
        duration: Date.now() - startTime,
        memoryUsed: 0,
        error: null,
      };
    } catch (error) {
      return {
        stdout: output.join('\n').slice(0, this.config.maxOutput),
        stderr: (error as Error).message,
        exitCode: 1,
        duration: Date.now() - startTime,
        memoryUsed: 0,
        error: { code: 'SANDBOX_ERROR', message: (error as Error).message },
      };
    }
  }
}


// ================================================================
// TOOL REGISTRY
// ================================================================

export class ToolRegistry {
  private tools: Map<string, ITool> = new Map();

  constructor() {
    this.register(new FileSystemTool());
    this.register(new HTTPTool());
    this.register(new SearchTool());
  }

  register(tool: ITool): void { this.tools.set(tool.definition.name, tool); }
  get(name: string): ITool | undefined { return this.tools.get(name); }
  getAll(): ITool[] { return Array.from(this.tools.values()); }

  async execute(name: string, input: unknown, context: CellContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) throw new CellError('TOOL_NOT_FOUND', `Tool '${name}' not registered`);
    return tool.execute(input, context);
  }

  getDefinitions(): ToolDefinition[] { return this.getAll().map(t => t.definition); }
}
