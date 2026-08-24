import {
  EntityId, CellContext, PolicyRule, PolicyCondition,
  PolicyDecision, IPolicyEngine,
} from '@cos/core';
import { generateId } from '@cos/core';

export interface PolicyEvaluationAudit {
  id: EntityId;
  timestamp: string;
  action: string;
  resource: string;
  traceId: string;
  principal?: string;
  decision: 'allow' | 'deny' | 'require_approval';
  matchedRuleIds: EntityId[];
  reason: string;
}

export type PolicyDecisionListener = (audit: Readonly<PolicyEvaluationAudit>) => void;

export class PolicyDeniedError extends Error {
  constructor(
    readonly action: string,
    readonly resource: string,
    readonly decision: PolicyDecision,
  ) {
    super(`Policy denied '${action}' on '${resource}': ${decision.reason}`);
    this.name = 'PolicyDeniedError';
  }
}

export class PolicyApprovalRequiredError extends Error {
  constructor(
    readonly action: string,
    readonly resource: string,
    readonly decision: PolicyDecision,
  ) {
    super(`Policy approval required for '${action}' on '${resource}': ${decision.reason}`);
    this.name = 'PolicyApprovalRequiredError';
  }
}

/**
 * Default-deny policy engine.
 *
 * Unknown fields/operators, invalid operand types and unsafe regex patterns all
 * fail closed. Equal-priority conflicts resolve DENY > REQUIRE_APPROVAL > ALLOW,
 * so rule insertion order can never weaken policy.
 */
export class PolicyEngine implements IPolicyEngine {
  private rules: Map<EntityId, PolicyRule> = new Map();
  private audit: PolicyEvaluationAudit[] = [];
  private readonly maxAuditEntries: number;
  private readonly listeners = new Set<PolicyDecisionListener>();

  constructor(maxAuditEntries = 10000) {
    this.maxAuditEntries = Math.max(1, maxAuditEntries);
  }

  async evaluate(action: string, resource: string, context: CellContext): Promise<PolicyDecision> {
    const matchedRules: PolicyRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (!(rule.actions.includes(action) || rule.actions.includes('*'))) continue;
      if (!(rule.resources.includes(resource) || rule.resources.includes('*'))) continue;
      if (!this.evaluateConditions(rule.conditions, context)) continue;
      matchedRules.push(rule);
    }

    let decision: PolicyDecision;
    if (matchedRules.length === 0) {
      decision = {
        allowed: false,
        requiresApproval: false,
        matchedRules: [],
        reason: `DENY: no policy matched action '${action}' on resource '${resource}'`,
      };
    } else {
      const effectRank: Record<PolicyRule['effect'], number> = {
        deny: 3,
        require_approval: 2,
        allow: 1,
      };
      matchedRules.sort((a, b) =>
        b.priority - a.priority || effectRank[b.effect] - effectRank[a.effect] || String(a.id).localeCompare(String(b.id)),
      );
      const topRule = matchedRules[0];
      decision = {
        allowed: topRule.effect === 'allow',
        requiresApproval: topRule.effect === 'require_approval',
        matchedRules: [topRule],
        reason: `${topRule.effect.toUpperCase()}: ${topRule.name} (priority ${topRule.priority})`,
      };
    }

    this.recordAudit(action, resource, context, decision);
    return decision;
  }

  async assertAllowed(action: string, resource: string, context: CellContext): Promise<void> {
    const decision = await this.evaluate(action, resource, context);
    if (decision.requiresApproval) throw new PolicyApprovalRequiredError(action, resource, decision);
    if (!decision.allowed) throw new PolicyDeniedError(action, resource, decision);
  }

  async addRule(rule: PolicyRule): Promise<EntityId> {
    const id = rule.id || generateId();
    if (this.rules.has(id)) throw new Error(`Policy rule ${String(id)} already exists`);
    if (!Number.isFinite(rule.priority)) throw new Error(`Policy rule ${String(id)} has invalid priority`);
    this.rules.set(id, { ...rule, id, actions: [...rule.actions], resources: [...rule.resources], conditions: [...rule.conditions] });
    return id;
  }

  async removeRule(id: EntityId): Promise<void> {
    this.rules.delete(id);
  }

  async getRules(): Promise<PolicyRule[]> {
    return Array.from(this.rules.values()).map(rule => ({
      ...rule,
      actions: [...rule.actions],
      resources: [...rule.resources],
      conditions: [...rule.conditions],
    }));
  }

  getAuditLog(limit = 100): PolicyEvaluationAudit[] {
    return this.audit.slice(-Math.max(0, limit)).map(entry => ({ ...entry, matchedRuleIds: [...entry.matchedRuleIds] }));
  }

  clearAuditLog(): void {
    this.audit = [];
  }

  /**
   * Subscribe to immutable decision evidence. Listeners are observability /
   * resilience hooks only; they cannot alter the decision already computed.
   */
  onDecision(listener: PolicyDecisionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private evaluateConditions(conditions: PolicyCondition[], context: CellContext): boolean {
    for (const condition of conditions) {
      const resolved = this.getContextValue(condition.field, context);
      if (!resolved.found) return false;
      if (!this.evaluateCondition(condition, resolved.value)) return false;
    }
    return true;
  }

  private getContextValue(field: string, context: CellContext): { found: boolean; value: unknown } {
    switch (field) {
      case 'traceId': return { found: true, value: context.traceId };
      case 'userId': return { found: context.userId !== undefined, value: context.userId };
      case 'sessionId': return { found: context.sessionId !== undefined, value: context.sessionId };
      case 'budget.amount': return { found: context.budget !== undefined, value: context.budget?.amount };
      case 'budget.units': return { found: context.budget !== undefined, value: context.budget?.units };
      default: {
        const prefix = 'metadata.';
        if (field.startsWith(prefix) && context.metadata) {
          const key = field.slice(prefix.length);
          if (key && Object.prototype.hasOwnProperty.call(context.metadata, key)) {
            return { found: true, value: context.metadata[key] };
          }
        }
        return { found: false, value: undefined };
      }
    }
  }

  private evaluateCondition(condition: PolicyCondition, value: unknown): boolean {
    switch (condition.operator) {
      case 'eq': return value === condition.value;
      case 'neq': return value !== condition.value;
      case 'gt': return this.numericCompare(value, condition.value, (a, b) => a > b);
      case 'gte': return this.numericCompare(value, condition.value, (a, b) => a >= b);
      case 'lt': return this.numericCompare(value, condition.value, (a, b) => a < b);
      case 'lte': return this.numericCompare(value, condition.value, (a, b) => a <= b);
      case 'in': return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in': return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'contains': {
        if (typeof value === 'string' && typeof condition.value === 'string') return value.includes(condition.value);
        if (Array.isArray(value)) return value.includes(condition.value);
        return false;
      }
      case 'matches': {
        if (typeof value !== 'string' || typeof condition.value !== 'string') return false;
        if (condition.value.length === 0 || condition.value.length > 256) return false;
        try {
          return new RegExp(condition.value).test(value);
        } catch {
          return false;
        }
      }
      default:
        return false;
    }
  }

  private numericCompare(a: unknown, b: unknown, compare: (left: number, right: number) => boolean): boolean {
    return typeof a === 'number' && Number.isFinite(a)
      && typeof b === 'number' && Number.isFinite(b)
      && compare(a, b);
  }

  private recordAudit(action: string, resource: string, context: CellContext, decision: PolicyDecision): void {
    const entry: PolicyEvaluationAudit = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      action,
      resource,
      traceId: context.traceId,
      principal: context.userId,
      decision: decision.requiresApproval ? 'require_approval' : decision.allowed ? 'allow' : 'deny',
      matchedRuleIds: decision.matchedRules.map(rule => rule.id),
      reason: decision.reason,
    };
    this.audit.push(entry);
    if (this.audit.length > this.maxAuditEntries) this.audit = this.audit.slice(-this.maxAuditEntries);

    const immutable = Object.freeze({ ...entry, matchedRuleIds: Object.freeze([...entry.matchedRuleIds]) }) as Readonly<PolicyEvaluationAudit>;
    for (const listener of this.listeners) {
      try {
        listener(immutable);
      } catch {
        // Observability/resilience listeners may never alter authorization or
        // turn a successful policy evaluation into an application failure.
      }
    }
  }
}
