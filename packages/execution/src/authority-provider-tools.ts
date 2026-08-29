import {
  generateId,
  type CellContext,
  type Cost,
  type EntityId,
  type ITool,
  type Permission,
  type ToolDefinition,
  type ToolResult,
} from '@cos/core';
import {
  AuthorityFileSandbox,
  AuthorityHttpEgressGuard,
  type AuthorityPinnedFileTarget,
  type AuthorityPinnedHttpTarget,
} from './authority-isolation';
import { StrictToolRegistry } from './strict-tool-registry';

export type AuthorityProviderToolMode = 'read' | 'mutation';

/**
 * Tool marker consumed by the canonical capability facade. Side-effecting tools
 * without this preflight contract are rejected before any operation enters the
 * `executing` state.
 */
export interface AuthorityPreflightTool extends ITool {
  readonly authorityProviderTool: true;
  readonly authorityMode: AuthorityProviderToolMode;
  preflight(input: unknown, context: CellContext): Promise<void>;
}

export function isAuthorityPreflightTool(tool: ITool): tool is AuthorityPreflightTool {
  const candidate = tool as Partial<AuthorityPreflightTool>;
  return candidate.authorityProviderTool === true
    && (candidate.authorityMode === 'read' || candidate.authorityMode === 'mutation')
    && typeof candidate.preflight === 'function';
}

export interface AuthorityPinnedHttpToolInput {
  target: AuthorityPinnedHttpTarget;
  evaluatedAt: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** Required for mutation mode and forwarded unchanged to the pinned transport. */
  providerIdempotencyKey?: string;
}

export interface AuthorityPinnedHttpTransportRequest extends AuthorityPinnedHttpToolInput {
  context: CellContext;
}

/**
 * Deployment adapter contract. Implementations must connect to one of the
 * pinned addresses in `target.resolvedAddresses`, preserve target.hostname for
 * TLS SNI and HTTP Host semantics, and must not resolve the hostname again.
 */
export interface AuthorityPinnedHttpTransport {
  execute(request: AuthorityPinnedHttpTransportRequest): Promise<unknown>;
}

export interface AuthorityFileHandleToolInput {
  target: AuthorityPinnedFileTarget;
  /** Provider/tool-specific operation payload. The executor receives no path. */
  payload?: unknown;
  /** Required for mutation mode and forwarded unchanged to the handle executor. */
  providerIdempotencyKey?: string;
}

export interface AuthorityFileHandleExecutionRequest extends AuthorityFileHandleToolInput {
  context: CellContext;
}

/**
 * Trusted handle consumer. Implementations operate on `target.handleToken` and
 * must never reopen `canonicalTargetUri` by path.
 */
export interface AuthorityFileHandleExecutor {
  execute(request: AuthorityFileHandleExecutionRequest): Promise<unknown>;
}

export interface AuthorityProviderToolOptions {
  name: string;
  description: string;
  cost?: Cost;
  timeoutMs?: number;
}

export class AuthorityPinnedHttpTool implements AuthorityPreflightTool {
  readonly authorityProviderTool = true as const;
  readonly definition: ToolDefinition;

  constructor(
    readonly authorityMode: AuthorityProviderToolMode,
    private readonly guard: AuthorityHttpEgressGuard,
    private readonly transport: AuthorityPinnedHttpTransport,
    options: AuthorityProviderToolOptions,
  ) {
    this.definition = definition(
      options,
      authorityMode === 'read' ? ['read'] : ['execute'],
      authorityMode === 'read'
        ? 'Execute an HTTP GET/HEAD using a previously pinned authority target'
        : 'Execute an HTTP mutation using a previously pinned authority target and provider idempotency key',
    );
  }

  async preflight(raw: unknown, _context: CellContext): Promise<void> {
    const input = normalizeHttpInput(raw);
    this.guard.assertPinned(input.target, input.evaluatedAt);
    const readMethod = input.target.method === 'GET' || input.target.method === 'HEAD';
    if (this.authorityMode === 'read' && !readMethod) {
      throw new Error(`AUTHORITY_HTTP_READ_METHOD_DENIED method=${input.target.method}`);
    }
    if (this.authorityMode === 'mutation' && readMethod) {
      throw new Error(`AUTHORITY_HTTP_MUTATION_METHOD_REQUIRED method=${input.target.method}`);
    }
    if (this.authorityMode === 'mutation' && !input.providerIdempotencyKey) {
      throw new Error('AUTHORITY_HTTP_PROVIDER_IDEMPOTENCY_REQUIRED');
    }
  }

  async execute(raw: unknown, context: CellContext): Promise<ToolResult> {
    const started = Date.now();
    try {
      await this.preflight(raw, context);
      const input = normalizeHttpInput(raw);
      const output = await this.transport.execute({
        ...input,
        context: cloneContext(context),
      });
      return successResult(
        output,
        this.definition.cost,
        Date.now() - started,
        {
          authorityMode: 'pinned-http',
          capabilityMode: this.authorityMode,
          targetDecisionHash: input.target.decisionHash,
          providerIdempotencyKey: input.providerIdempotencyKey ?? null,
        },
      );
    } catch (error) {
      return failureResult('AUTHORITY_PINNED_HTTP_FAILED', error, this.definition.cost, Date.now() - started);
    }
  }
}

export class AuthorityFileHandleTool implements AuthorityPreflightTool {
  readonly authorityProviderTool = true as const;
  readonly definition: ToolDefinition;

  constructor(
    readonly authorityMode: AuthorityProviderToolMode,
    private readonly sandbox: AuthorityFileSandbox,
    private readonly executor: AuthorityFileHandleExecutor,
    options: AuthorityProviderToolOptions,
  ) {
    this.definition = definition(
      options,
      authorityMode === 'read' ? ['read'] : ['write'],
      authorityMode === 'read'
        ? 'Read through a trusted broker-opened authority file handle'
        : 'Mutate through a trusted broker-opened authority file handle and provider idempotency key',
    );
  }

  async preflight(raw: unknown, _context: CellContext): Promise<void> {
    const input = normalizeFileInput(raw);
    this.sandbox.assertPinned(input.target);
    const readOperation = input.target.operation === 'read';
    if (this.authorityMode === 'read' && !readOperation) {
      throw new Error(`AUTHORITY_FILE_READ_OPERATION_DENIED operation=${input.target.operation}`);
    }
    if (this.authorityMode === 'mutation' && readOperation) {
      throw new Error('AUTHORITY_FILE_MUTATION_OPERATION_REQUIRED');
    }
    if (this.authorityMode === 'mutation' && !input.providerIdempotencyKey) {
      throw new Error('AUTHORITY_FILE_PROVIDER_IDEMPOTENCY_REQUIRED');
    }
  }

  async execute(raw: unknown, context: CellContext): Promise<ToolResult> {
    const started = Date.now();
    try {
      await this.preflight(raw, context);
      const input = normalizeFileInput(raw);
      const output = await this.executor.execute({
        ...input,
        context: cloneContext(context),
      });
      return successResult(
        output,
        this.definition.cost,
        Date.now() - started,
        {
          authorityMode: 'broker-file-handle',
          capabilityMode: this.authorityMode,
          targetDecisionHash: input.target.decisionHash,
          handleHash: input.target.handleHash,
          providerIdempotencyKey: input.providerIdempotencyKey ?? null,
        },
      );
    } catch (error) {
      return failureResult('AUTHORITY_FILE_HANDLE_FAILED', error, this.definition.cost, Date.now() - started);
    }
  }
}

/**
 * Creates the registry used by the authority facade. Legacy built-ins are
 * removed first so callers cannot route around pinned transports/handles.
 */
export function createAuthorityProviderRegistry(tools: AuthorityPreflightTool[]): StrictToolRegistry {
  if (!Array.isArray(tools) || tools.length === 0) {
    throw new Error('AUTHORITY_PROVIDER_TOOL_REQUIRED');
  }
  const registry = new StrictToolRegistry();
  for (const legacy of ['filesystem', 'http_client', 'search']) registry.unregister(legacy);
  for (const tool of tools) {
    if (!isAuthorityPreflightTool(tool)) throw new Error('AUTHORITY_PREFLIGHT_TOOL_REQUIRED');
    const name = tool.definition.name.trim();
    if (['filesystem', 'http_client', 'search'].includes(name)) {
      throw new Error(`AUTHORITY_LEGACY_TOOL_NAME_DENIED name=${name}`);
    }
    registry.register(tool);
  }
  return registry;
}

function definition(
  options: AuthorityProviderToolOptions,
  permissions: Permission[],
  fallbackDescription: string,
): ToolDefinition {
  const name = nonEmpty(options.name, 'provider tool name');
  const timeout = options.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 300_000) {
    throw new Error('provider tool timeoutMs must be a safe integer in [1,300000]');
  }
  return {
    id: `tool:${name}` as EntityId,
    name,
    description: nonEmpty(options.description || fallbackDescription, 'provider tool description'),
    version: { major: 1, minor: 0, patch: 0 },
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    permissions: [...permissions],
    cost: options.cost ? structuredClone(options.cost) : { units: 'credits', amount: 0 },
    timeout,
    rateLimit: { maxPerMinute: 120, maxPerHour: 5_000 },
    retryConfig: {
      // The authority facade owns retries through provider reconciliation.
      maxRetries: 0,
      backoffMs: 0,
    },
  };
}

function normalizeHttpInput(raw: unknown): AuthorityPinnedHttpToolInput {
  if (!raw || typeof raw !== 'object') throw new Error('authority HTTP input must be an object');
  const input = raw as Partial<AuthorityPinnedHttpToolInput>;
  if (!input.target || typeof input.target !== 'object') throw new Error('authority HTTP target is required');
  const evaluatedAt = canonicalTime(String(input.evaluatedAt ?? ''), 'HTTP evaluatedAt');
  const headers = normalizeHeaders(input.headers ?? {});
  const timeoutMs = input.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) {
    throw new Error('authority HTTP timeoutMs must be in [1,300000]');
  }
  if (input.body !== undefined && typeof input.body !== 'string') {
    throw new Error('authority HTTP body must be a string');
  }
  if (input.body !== undefined && Buffer.byteLength(input.body, 'utf8') > 10_000_000) {
    throw new Error('authority HTTP body exceeds 10 MB');
  }
  const providerIdempotencyKey = optional(input.providerIdempotencyKey);
  return {
    target: structuredClone(input.target),
    evaluatedAt,
    headers,
    ...(input.body === undefined ? {} : { body: input.body }),
    timeoutMs,
    ...(providerIdempotencyKey === undefined ? {} : { providerIdempotencyKey }),
  };
}

function normalizeFileInput(raw: unknown): AuthorityFileHandleToolInput {
  if (!raw || typeof raw !== 'object') throw new Error('authority file input must be an object');
  const input = raw as Partial<AuthorityFileHandleToolInput>;
  if (!input.target || typeof input.target !== 'object') throw new Error('authority file target is required');
  const providerIdempotencyKey = optional(input.providerIdempotencyKey);
  return {
    target: structuredClone(input.target),
    ...(input.payload === undefined ? {} : { payload: structuredClone(input.payload) }),
    ...(providerIdempotencyKey === undefined ? {} : { providerIdempotencyKey }),
  };
}

function normalizeHeaders(input: Record<string, string>): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('authority HTTP headers must be an object');
  }
  const headers: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(input)) {
    const name = nonEmpty(rawName, 'header name').toLowerCase();
    if (name === 'host' || name === ':authority' || name === 'connection') {
      throw new Error(`AUTHORITY_HTTP_RESERVED_HEADER name=${name}`);
    }
    if (typeof rawValue !== 'string' || /[\r\n]/.test(rawValue)) {
      throw new Error(`AUTHORITY_HTTP_HEADER_VALUE_INVALID name=${name}`);
    }
    headers[name] = rawValue;
  }
  return Object.fromEntries(Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)));
}

function successResult(
  output: unknown,
  cost: Cost,
  latency: number,
  metadata: Record<string, string | number | boolean | null>,
): ToolResult {
  return {
    success: true,
    output: structuredClone(output),
    cost: structuredClone(cost),
    latency,
    metadata: { ...metadata },
  };
}

function failureResult(code: string, error: unknown, cost: Cost, latency: number): ToolResult {
  return {
    success: false,
    output: null,
    cost: structuredClone(cost),
    latency,
    error: {
      id: generateId(),
      code,
      message: message(error),
      severity: 'error',
      timestamp: new Date().toISOString(),
      context: {},
    },
    metadata: {},
  };
}

function cloneContext(context: CellContext): CellContext {
  return structuredClone(context);
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function optional(value: string | undefined): string | undefined {
  const normalized = value?.normalize('NFC').trim();
  return normalized || undefined;
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
