import {
  ToolDefinition, ToolResult, ITool, CellContext,
  EntityId,
} from '@cos/core';
import { generateId, CellError } from '@cos/core';
import * as fsp from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { randomUUID } from 'crypto';
import * as https from 'https';
import * as http from 'http';
import * as path from 'path';

// ================================================================
// ROOT-CONFINED FILESYSTEM TOOL
// ================================================================

export interface FileSystemToolOptions {
  /** Explicit workspace root. Missing root means zero filesystem authority. */
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
