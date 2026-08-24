import type { CellContext, Permission, ToolDefinition, ToolResult } from '@cos/core';
import { stableHash128 } from '@cos/core';
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

/**
 * Resolves named capabilities into real ToolRegistry execution while keeping
 * authorization separate from the execution package. This avoids a circular
 * dependency on orchestration/PolicyEngine and makes enforcement injectable.
 */
export class CapabilityRouter {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly authorize?: CapabilityAuthorizationHook,
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
