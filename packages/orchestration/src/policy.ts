import {
  EntityId, CellContext, PolicyRule, PolicyCondition,
  PolicyDecision, IPolicyEngine, Permission,
} from '@cos/core';
import { generateId } from '@cos/core';

export class PolicyEngine implements IPolicyEngine {
  private rules: Map<EntityId, PolicyRule> = new Map();

  async evaluate(action: string, resource: string, context: CellContext): Promise<PolicyDecision> {
    const matchedRules: PolicyRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check action match
      const actionMatch = rule.actions.includes(action) || rule.actions.includes('*');
      if (!actionMatch) continue;

      // Check resource match
      const resourceMatch = rule.resources.includes(resource) || rule.resources.includes('*');
      if (!resourceMatch) continue;

      // Check conditions
      const conditionsMet = this.evaluateConditions(rule.conditions, context);
      if (!conditionsMet) continue;

      matchedRules.push(rule);
    }

    // Default: deny if no rules matched
    if (matchedRules.length === 0) {
      return {
        allowed: false,
        requiresApproval: false,
        matchedRules: [],
        reason: `No policy matched action '${action}' on resource '${resource}'`,
      };
    }

    // Highest priority rule wins
    matchedRules.sort((a, b) => b.priority - a.priority);
    const topRule = matchedRules[0];

    return {
      allowed: topRule.effect === 'allow',
      requiresApproval: topRule.effect === 'require_approval',
      matchedRules: [topRule],
      reason: `${topRule.effect.toUpperCase()}: ${topRule.name} (priority ${topRule.priority})`,
    };
  }

  async addRule(rule: PolicyRule): Promise<EntityId> {
    const id = rule.id || generateId();
    this.rules.set(id, { ...rule, id });
    return id;
  }

  async removeRule(id: EntityId): Promise<void> {
    this.rules.delete(id);
  }

  async getRules(): Promise<PolicyRule[]> {
    return Array.from(this.rules.values());
  }

  private evaluateConditions(conditions: PolicyCondition[], context: CellContext): boolean {
    for (const condition of conditions) {
      const contextValue = this.getContextValue(condition.field, context);
      if (!this.evaluateCondition(condition, contextValue)) return false;
    }
    return true;
  }

  private getContextValue(field: string, context: CellContext): unknown {
    switch (field) {
      case 'traceId': return context.traceId;
      case 'userId': return context.userId;
      case 'sessionId': return context.sessionId;
      default: return undefined;
    }
  }

  private evaluateCondition(condition: PolicyCondition, value: unknown): boolean {
    switch (condition.operator) {
      case 'eq': return value === condition.value;
      case 'neq': return value !== condition.value;
      case 'in': return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in': return Array.isArray(condition.value) && !condition.value.includes(value);
      default: return true;
    }
  }
}