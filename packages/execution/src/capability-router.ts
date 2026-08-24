import type { CellContext, Permission, ToolDefinition, ToolResult } from '@cos/core';
import { stableHash128 } from '@cos/core';
import * as path from 'path';
import * as net from 'net';
import { ToolRegistry } from './tool-runtime';

export interface CapabilityAuthorizationRequest {
  capability: string;
  permissions: Permission[];
  context: CellContext;
  inputHash: string;
  sideEffecting: boolean;
}

export type CapabilityAuthorizationHook = (
  request: CapabilityAuthorizationRequest,
) => Promise<{ allowed: boolean; requiresApproval?: boolean; reason?: string }>;

export interface CapabilityGuardRequest {
  capability: string;
  definition: ToolDefinition;
  input: unknown;
  context: CellContext;
  sideEffecting: boolean;
}

export type CapabilityInputGuard = (
  request: CapabilityGuardRequest,
) => Promise<{ allowed: boolean; reason?: string }> | { allowed: boolean; reason?: string };

export interface CapabilityExecutionOptions {
  idempotencyKey?: string;
  fencingVersion?: number;
}

export interface CapabilityExecutionReceipt {
  capability: string;
  definition: ToolDefinition;
  result: ToolResult;
  inputHash: string;
  sideEffecting: boolean;
  idempotencyKey?: string;
  fencingVersion?: number;
}

export interface DefaultCapabilityGuardOptions {
  filesystemRoots?: string[];
  /** Host names explicitly allowed even when otherwise blocked. */
  allowedHttpHosts?: string[];
  maxInputBytes?: number;
}

/**
 * Conservative guard for built-in filesystem/HTTP tools.
 *
 * This is defense-in-depth, not a replacement for OS/container egress and FS
 * isolation. DNS rebinding cannot be solved solely at URL-parse time; production
 * authority should combine this guard with network namespace/egress controls.
 */
export function createDefaultCapabilityGuard(
  options: DefaultCapabilityGuardOptions = {},
): CapabilityInputGuard {
  const roots = (options.filesystemRoots || [process.cwd()]).map(root => path.resolve(root));
  const allowedHosts = new Set((options.allowedHttpHosts || []).map(host => host.toLowerCase()));
  const maxInputBytes = options.maxInputBytes ?? 1_000_000;
  if (!Number.isInteger(maxInputBytes) || maxInputBytes < 1 || maxInputBytes > 100_000_000) {
    throw new Error('maxInputBytes must be an integer in [1,100000000]');
  }

  return request => {
    let encoded: string;
    try {
      encoded = JSON.stringify(request.input);
    } catch {
      return { allowed: false, reason: 'input is not serializable' };
    }
    if (Buffer.byteLength(encoded, 'utf8') > maxInputBytes) {
      return { allowed: false, reason: `input exceeds ${maxInputBytes} byte safety limit` };
    }

    if (request.capability === 'filesystem') {
      const input = request.input as { path?: unknown };
      if (typeof input?.path !== 'string' || !input.path.trim() || input.path.includes('\0')) {
        return { allowed: false, reason: 'filesystem path is missing or invalid' };
      }
      const resolved = path.resolve(input.path);
      const withinRoot = roots.some(root => resolved === root || resolved.startsWith(`${root}${path.sep}`));
      if (!withinRoot) return { allowed: false, reason: `filesystem path '${resolved}' escapes configured roots` };
    }

    if (request.capability === 'http_client') {
      const input = request.input as { url?: unknown };
      if (typeof input?.url !== 'string') return { allowed: false, reason: 'HTTP URL is required' };
      let url: URL;
      try { url = new URL(input.url); } catch { return { allowed: false, reason: 'invalid HTTP URL' }; }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { allowed: false, reason: `protocol '${url.protocol}' is not allowed` };
      }
      const host = url.hostname.toLowerCase();
      if (!allowedHosts.has(host) && isObviouslyPrivateHost(host)) {
        return { allowed: false, reason: `HTTP host '${host}' is loopback/private/local` };
      }
      if (url.username || url.password) return { allowed: false, reason: 'credentials in URL are not allowed' };
    }

    return { allowed: true };
  };
}

function isObviouslyPrivateHost(host: string): boolean {
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '::1' || host === '[::1]') return true;
  if (net.isIP(host) === 4) {
    const [a, b] = host.split('.').map(Number);
    return a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || a === 0;
  }
  if (net.isIP(host) === 6) {
    const normalized = host.toLowerCase();
    return normalized === '::1'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe80:');
  }
  return false;
}

/**
 * Resolves named capabilities into real ToolRegistry execution while keeping
 * authorization separate from execution. Safety guard runs before policy/tool
 * execution so dangerous inputs never become side effects first and evidence
 * later.
 */
export class CapabilityRouter {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly authorize?: CapabilityAuthorizationHook,
    private readonly guard?: CapabilityInputGuard,
  ) {}

  list(): ToolDefinition[] {
    return this.registry.getDefinitions().map(definition => ({ ...definition }));
  }

  resolve(name: string): ToolDefinition {
    const tool = this.registry.get(name);
    if (!tool) throw new Error(`CAPABILITY_NOT_FOUND name=${name}`);
    return { ...tool.definition };
  }

  async execute(
    name: string,
    input: unknown,
    context: CellContext,
    options: CapabilityExecutionOptions = {},
  ): Promise<CapabilityExecutionReceipt> {
    const definition = this.resolve(name);
    const permissions = [...definition.permissions];
    const sideEffecting = permissions.some(permission => permission === 'write' || permission === 'execute' || permission === 'admin');
    const inputHash = stableHash128(input);

    if (sideEffecting && !options.idempotencyKey) {
      throw new Error(`CAPABILITY_IDEMPOTENCY_REQUIRED name=${name}`);
    }
    if (sideEffecting && (!Number.isInteger(options.fencingVersion) || (options.fencingVersion || 0) < 1)) {
      throw new Error(`CAPABILITY_FENCING_REQUIRED name=${name}`);
    }

    if (this.guard) {
      const safety = await this.guard({ capability: name, definition, input, context, sideEffecting });
      if (!safety.allowed) throw new Error(`CAPABILITY_INPUT_REJECTED name=${name}: ${safety.reason || 'unsafe input'}`);
    }

    if (this.authorize) {
      const decision = await this.authorize({
        capability: name,
        permissions,
        context,
        inputHash,
        sideEffecting,
      });
      if (decision.requiresApproval) {
        throw new Error(`CAPABILITY_APPROVAL_REQUIRED name=${name}: ${decision.reason || 'approval required'}`);
      }
      if (!decision.allowed) {
        throw new Error(`CAPABILITY_DENIED name=${name}: ${decision.reason || 'denied'}`);
      }
    }

    const result = await this.registry.execute(name, input, context);
    if (!result.success) {
      throw new Error(`CAPABILITY_EXECUTION_FAILED name=${name}: ${result.error?.message || 'tool returned success=false'}`);
    }

    return {
      capability: name,
      definition,
      result,
      inputHash,
      sideEffecting,
      idempotencyKey: options.idempotencyKey,
      fencingVersion: options.fencingVersion,
    };
  }
}
