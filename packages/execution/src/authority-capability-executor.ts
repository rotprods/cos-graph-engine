import {
  canonicalizeJsonValue,
  type CellContext,
  type ToolDefinition,
} from '@cos/core';
import {
  CapabilityRouter,
  type CapabilityExecutionReceipt,
} from './capability-router';
import {
  SideEffectCoordinator,
  type SideEffectExecutionReceipt,
  type SideEffectOperationRevision,
} from './side-effect-ledger';

export interface AuthorityCapabilityExecutionInput {
  capability: string;
  input: unknown;
  context: CellContext;
  principalId: string;
  projectId: string;
  resource: string;
  operationKey?: string;
  sourceRef: string;
  recordedAt: string;
  fencingVersion?: number;
  metadata?: Record<string, unknown>;
}

export interface AuthorityCapabilityExecutionReceipt {
  capability: string;
  definition: ToolDefinition;
  sideEffecting: boolean;
  capabilityReceipt: CapabilityExecutionReceipt | null;
  operation: SideEffectOperationRevision | null;
  providerInvoked: boolean;
  reusedTerminalResult: boolean;
}

/**
 * Authority execution facade.
 *
 * Read-only capabilities may use the router directly. Every write/execute/admin
 * capability is forced through SideEffectCoordinator before the real tool call.
 * This class does not yet prove resource-bound fencing; Phase 05.2 adds the
 * commit-boundary fence validator. Until then, the supplied fencing version is
 * durable evidence, not authority by itself.
 */
export class AuthorityCapabilityExecutor {
  constructor(
    private readonly router: CapabilityRouter,
    private readonly sideEffects: SideEffectCoordinator,
  ) {}

  async execute(
    request: AuthorityCapabilityExecutionInput,
  ): Promise<AuthorityCapabilityExecutionReceipt> {
    const capability = nonEmpty(request.capability, 'capability');
    const definition = this.router.resolve(capability);
    const sideEffecting = definition.permissions.some(permission =>
      permission === 'write' || permission === 'execute' || permission === 'admin');

    if (!sideEffecting) {
      const capabilityReceipt = await this.router.execute(
        capability,
        request.input,
        request.context,
      );
      return {
        capability,
        definition,
        sideEffecting: false,
        capabilityReceipt,
        operation: null,
        providerInvoked: true,
        reusedTerminalResult: false,
      };
    }

    const operationKey = nonEmpty(request.operationKey ?? '', 'operationKey');
    const fencingVersion = positiveSafeInteger(request.fencingVersion, 'fencingVersion');
    let capabilityReceipt: CapabilityExecutionReceipt | null = null;

    const execution = await this.sideEffects.execute({
      principalId: nonEmpty(request.principalId, 'principalId'),
      projectId: nonEmpty(request.projectId, 'projectId'),
      resource: nonEmpty(request.resource, 'resource'),
      action: `capability:${capability}`,
      operationKey,
      request: canonicalizeJsonValue({
        capability,
        input: request.input,
        context: request.context,
      }),
      sourceRef: nonEmpty(request.sourceRef, 'sourceRef'),
      recordedAt: canonicalTime(request.recordedAt, 'recordedAt'),
      fencingVersion,
      metadata: request.metadata,
    }, async operation => {
      try {
        capabilityReceipt = await this.router.execute(
          capability,
          request.input,
          request.context,
          { idempotencyKey: operationKey, fencingVersion },
        );
        return {
          disposition: 'succeeded' as const,
          providerReference: authorityToolReference(capability, operation),
          result: capabilityReceipt,
          metadata: {
            capability,
            inputHash: capabilityReceipt.inputHash,
            sideEffecting: true,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isPreEffectFailure(message)) {
          return {
            disposition: 'failed' as const,
            error: {
              code: errorCode(message),
              message,
              retryable: false,
            },
            metadata: { capability, preEffectFailure: true },
          };
        }
        return {
          disposition: 'uncertain' as const,
          reason: message,
          metadata: {
            capability,
            providerExecutionMayHaveStarted: true,
          },
        };
      }
    });

    return receiptFromExecution(capability, definition, execution, capabilityReceipt);
  }
}

function receiptFromExecution(
  capability: string,
  definition: ToolDefinition,
  execution: SideEffectExecutionReceipt,
  capabilityReceipt: CapabilityExecutionReceipt | null,
): AuthorityCapabilityExecutionReceipt {
  return {
    capability,
    definition,
    sideEffecting: true,
    capabilityReceipt,
    operation: execution.operation,
    providerInvoked: execution.providerInvoked,
    reusedTerminalResult: execution.reusedTerminalResult,
  };
}

function authorityToolReference(
  capability: string,
  operation: SideEffectOperationRevision,
): string {
  return `agentic://cos-execution/tool/${encodeURIComponent(capability)}/${encodeURIComponent(operation.operationId)}`;
}

function isPreEffectFailure(message: string): boolean {
  return [
    'CAPABILITY_INPUT_REJECTED',
    'CAPABILITY_APPROVAL_REQUIRED',
    'CAPABILITY_DENIED',
    'CAPABILITY_NOT_FOUND',
    'CAPABILITY_IDEMPOTENCY_REQUIRED',
    'CAPABILITY_FENCING_REQUIRED',
  ].some(code => message.startsWith(code));
}

function errorCode(message: string): string {
  const match = /^[A-Z0-9_]+/.exec(message);
  return match?.[0] ?? 'CAPABILITY_PRE_EFFECT_FAILURE';
}

function positiveSafeInteger(value: number | undefined, label: string): number {
  if (!Number.isSafeInteger(value) || (value ?? 0) < 1) {
    throw new Error(`AUTHORITY_CAPABILITY_${label.toUpperCase()}_REQUIRED`);
  }
  return value as number;
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
