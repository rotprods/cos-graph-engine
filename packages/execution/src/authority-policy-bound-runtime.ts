import { canonicalHash128 } from '@cos/core';
import type {
  AuthoritySideEffectAppendResult,
  AuthoritySideEffectClaimInput,
  AuthoritySideEffectView,
} from './authority-side-effect';
import type {
  BeginAuthorityOperationInput,
  CommitAuthorityOperationInput,
  PrepareAuthorityOperationInput,
} from './authority-execution-runtime';
import { AuthorityExecutionRuntime } from './authority-execution-runtime';
import type {
  AuthorityPolicyDecision,
  AuthorityPrincipal,
  AuthoritySensitivity,
} from './authority-policy';
import { AuthorityPolicyEngine } from './authority-policy';

export interface AuthorityExecutionPolicyContext {
  principal: AuthorityPrincipal;
  sensitivity: AuthoritySensitivity;
}

export interface PolicyAuthorizedResult<T> {
  result: T;
  policy: AuthorityPolicyDecision;
}

/**
 * Policy-enforced facade for the live side-effect path.
 *
 * Authorization runs before every operation mutation. The resource/project/
 * capability/operation hash used for evaluation are read from the canonical
 * operation record after claim, never trusted from a later caller request.
 */
export class PolicyBoundAuthorityExecutionRuntime {
  constructor(
    private readonly runtime: AuthorityExecutionRuntime,
    private readonly policy: AuthorityPolicyEngine,
  ) {}

  async claimOperation(
    input: AuthoritySideEffectClaimInput,
    context: AuthorityExecutionPolicyContext,
  ): Promise<PolicyAuthorizedResult<AuthoritySideEffectAppendResult>> {
    if (context.principal.id !== input.principalId) {
      throw new Error(
        `POLICY_PRINCIPAL_MISMATCH expected=${input.principalId} actual=${context.principal.id}`,
      );
    }
    const operationHash = logicalOperationHash(input);
    const decision = await this.policy.requireAllowed({
      principal: context.principal,
      action: 'operation.claim',
      capability: input.capability,
      resourceUri: input.resourceUri,
      projectId: input.projectId,
      sensitivity: context.sensitivity,
      operationHash,
      at: input.recordedAt,
      context: {
        agentRunId: input.agentRunId ?? 'none',
        idempotencyKey: input.idempotencyKey,
      },
    });
    const result = await this.runtime.claimOperation({
      ...input,
      metadata: {
        ...input.metadata,
        policyDecisionId: decision.decisionId,
        policyDecisionHash: decision.decisionHash,
      },
    });
    if (result.revision.logicalHash !== operationHash) {
      throw new Error(
        `POLICY_OPERATION_HASH_DIVERGENCE expected=${operationHash} actual=${result.revision.logicalHash}`,
      );
    }
    return { result, policy: decision };
  }

  async prepareOperation(
    input: PrepareAuthorityOperationInput,
    context: AuthorityExecutionPolicyContext,
  ): Promise<PolicyAuthorizedResult<AuthoritySideEffectAppendResult>> {
    return this.authorizeExisting(
      input.operationId,
      'operation.prepare',
      input.recordedAt,
      context,
      decision => this.runtime.prepareOperation({
        ...input,
        metadata: withDecision(input.metadata, decision),
      }),
    );
  }

  async beginOperation(
    input: BeginAuthorityOperationInput,
    context: AuthorityExecutionPolicyContext,
  ): Promise<PolicyAuthorizedResult<AuthoritySideEffectAppendResult>> {
    return this.authorizeExisting(
      input.operationId,
      'operation.execute',
      input.recordedAt,
      context,
      decision => this.runtime.beginOperation({
        ...input,
        metadata: withDecision(input.metadata, decision),
      }),
    );
  }

  async commitOperation(
    input: CommitAuthorityOperationInput,
    context: AuthorityExecutionPolicyContext,
  ): Promise<PolicyAuthorizedResult<AuthoritySideEffectAppendResult>> {
    return this.authorizeExisting(
      input.operationId,
      'operation.commit',
      input.recordedAt,
      context,
      decision => this.runtime.commitOperation({
        ...input,
        metadata: withDecision(input.metadata, decision),
      }),
    );
  }

  private async authorizeExisting<T>(
    operationId: string,
    action: string,
    at: string,
    context: AuthorityExecutionPolicyContext,
    execute: (decision: AuthorityPolicyDecision) => Promise<T>,
  ): Promise<PolicyAuthorizedResult<T>> {
    const operation = await this.requireOperation(operationId, at);
    if (operation.principalId !== context.principal.id) {
      throw new Error(
        `POLICY_PRINCIPAL_MISMATCH expected=${operation.principalId} actual=${context.principal.id}`,
      );
    }
    const decision = await this.policy.requireAllowed({
      principal: context.principal,
      action,
      capability: operation.capability,
      resourceUri: operation.resourceUri,
      projectId: operation.projectId,
      sensitivity: context.sensitivity,
      operationHash: operation.logicalHash,
      at,
      context: {
        operationId: operation.operationId,
        operationRevision: operation.revision,
        attempt: operation.attempt,
      },
    });
    return { result: await execute(decision), policy: decision };
  }

  private async requireOperation(
    operationId: string,
    at: string,
  ): Promise<AuthoritySideEffectView> {
    const operation = await this.runtime.getOperation(operationId, at);
    if (!operation) throw new Error(`SIDE_EFFECT_OPERATION_NOT_FOUND id=${operationId}`);
    return operation;
  }
}

function logicalOperationHash(input: AuthoritySideEffectClaimInput): string {
  return canonicalHash128({
    projectId: input.projectId.normalize('NFC').trim(),
    principalId: input.principalId.normalize('NFC').trim(),
    agentRunId: input.agentRunId?.normalize('NFC').trim() || null,
    capability: input.capability.normalize('NFC').trim(),
    resourceUri: input.resourceUri.normalize('NFC').trim(),
    input: input.input,
  });
}

function withDecision(
  metadata: Record<string, unknown> | undefined,
  decision: AuthorityPolicyDecision,
): Record<string, unknown> {
  return {
    ...metadata,
    policyDecisionId: decision.decisionId,
    policyDecisionHash: decision.decisionHash,
  };
}
