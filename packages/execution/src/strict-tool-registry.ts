import type { CellContext, ToolResult } from '@cos/core';
import { ToolRegistry } from './tool-runtime';

export interface ToolResultInvariantViolation {
  code: string;
  detail: string;
}

/**
 * Authority-grade wrapper over legacy ToolRegistry.
 *
 * Tool implementations are untrusted components from the runtime's point of
 * view. A tool is not allowed to self-certify a malformed/contradictory result
 * as success. This layer turns structural contradictions into hard failures.
 */
export class StrictToolRegistry extends ToolRegistry {
  has(name: string): boolean {
    return this.get(name) !== undefined;
  }

  async execute(name: string, input: unknown, context: CellContext): Promise<ToolResult> {
    const result = await super.execute(name, input, context);
    const violations = this.validateResult(name, result);
    if (violations.length > 0) {
      throw new Error(
        `TOOL_RESULT_INVARIANT name=${name}: ${violations.map(v => `${v.code}:${v.detail}`).join('; ')}`,
      );
    }
    return result;
  }

  validateResult(name: string, result: ToolResult): ToolResultInvariantViolation[] {
    const violations: ToolResultInvariantViolation[] = [];

    if (!Number.isFinite(result.latency) || result.latency < 0) {
      violations.push({ code: 'INVALID_LATENCY', detail: String(result.latency) });
    }
    if (!result.cost || !Number.isFinite(result.cost.amount) || result.cost.amount < 0) {
      violations.push({ code: 'INVALID_COST', detail: String(result.cost?.amount) });
    }
    if (!result.metadata || typeof result.metadata !== 'object') {
      violations.push({ code: 'INVALID_METADATA', detail: 'metadata must be an object' });
    }

    if (result.success) {
      if (result.error) {
        violations.push({ code: 'SUCCESS_WITH_ERROR', detail: result.error.message });
      }
      // Some legacy adapters encoded an exception inside output while returning
      // success=true. Treat an own `error` field as contradictory evidence.
      if (result.output && typeof result.output === 'object' && !Array.isArray(result.output)) {
        const output = result.output as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(output, 'error') && output.error !== null && output.error !== undefined && output.error !== '') {
          violations.push({ code: 'SUCCESS_OUTPUT_CONTAINS_ERROR', detail: String(output.error) });
        }
      }
    } else if (!result.error) {
      violations.push({ code: 'FAILURE_WITHOUT_ERROR', detail: 'success=false requires structured error' });
    }

    return violations;
  }
}
