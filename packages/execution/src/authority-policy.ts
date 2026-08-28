import {
  canonicalHash128,
  canonicalIdentity,
  canonicalSerialize,
  type ProvenanceRef,
} from '@cos/core';

export type AuthoritySensitivity = 'public' | 'internal' | 'private' | 'restricted';
export type AuthorityPolicyEffect = 'allow' | 'deny' | 'require_approval';

const SENSITIVITY_ORDER: Record<AuthoritySensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

export interface AuthorityPrincipal {
  id: string;
  roles: string[];
  projectIds: string[];
  sensitivityClearance: AuthoritySensitivity;
  attributes: Record<string, string | number | boolean | null>;
}

export interface AuthorityPolicyRequest {
  principal: AuthorityPrincipal;
  action: string;
  capability: string;
  resourceUri: string;
  projectId: string;
  sensitivity: AuthoritySensitivity;
  operationHash: string;
  at: string;
  context?: Record<string, string | number | boolean | null>;
}

export interface AuthorityPolicyRule {
  id: string;
  version: number;
  effect: AuthorityPolicyEffect;
  priority: number;
  actions: string[];
  capabilities: string[];
  resourcePrefixes: string[];
  projectIds: string[];
  principalIds: string[];
  anyRoles: string[];
  maxSensitivity: AuthoritySensitivity;
  validFrom: string;
  validUntil: string | null;
  reason: string;
  provenance: ProvenanceRef[];
  metadata: Record<string, unknown>;
  contentHash: string;
}

export interface AuthorityPolicyRuleInput {
  id?: string;
  version?: number;
  effect: AuthorityPolicyEffect;
  priority: number;
  actions: string[];
  capabilities?: string[];
  resourcePrefixes?: string[];
  projectIds: string[];
  principalIds?: string[];
  anyRoles?: string[];
  maxSensitivity?: AuthoritySensitivity;
  validFrom: string;
  validUntil?: string | null;
  reason: string;
  provenance: ProvenanceRef[];
  metadata?: Record<string, unknown>;
}

export interface AuthorityApprovalGrant {
  grantId: string;
  grantKey: string;
  principalId: string;
  approverId: string;
  action: string;
  capability: string;
  resourceUri: string;
  projectId: string;
  operationHash: string;
  grantedAt: string;
  expiresAt: string;
  provenance: ProvenanceRef[];
  metadata: Record<string, unknown>;
  contentHash: string;
}

export interface AuthorityApprovalGrantInput {
  grantKey: string;
  principalId: string;
  approverId: string;
  action: string;
  capability: string;
  resourceUri: string;
  projectId: string;
  operationHash: string;
  grantedAt: string;
  expiresAt: string;
  provenance: ProvenanceRef[];
  metadata?: Record<string, unknown>;
}

export interface AuthorityPolicyDecision {
  decisionId: string;
  requestHash: string;
  effect: AuthorityPolicyEffect;
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
  matchedRuleIds: string[];
  approvalGrantId: string | null;
  decidedAt: string;
  decisionHash: string;
}

export interface IAuthorityApprovalStore {
  append(grant: AuthorityApprovalGrant): Promise<{ grant: AuthorityApprovalGrant; appended: boolean }>;
  findFor(request: AuthorityPolicyRequest): Promise<AuthorityApprovalGrant | null>;
  list(): Promise<AuthorityApprovalGrant[]>;
}

/** Payload-bound append-only reference approval store. */
export class InMemoryAuthorityApprovalStore implements IAuthorityApprovalStore {
  private readonly byId = new Map<string, AuthorityApprovalGrant>();
  private readonly byKey = new Map<string, AuthorityApprovalGrant>();

  async append(raw: AuthorityApprovalGrant): Promise<{ grant: AuthorityApprovalGrant; appended: boolean }> {
    const grant = cloneAndVerifyGrant(raw);
    const duplicate = this.byKey.get(grant.grantKey);
    if (duplicate) {
      if (duplicate.contentHash !== grant.contentHash) {
        throw new Error(`POLICY_APPROVAL_KEY_CONFLICT key=${grant.grantKey}`);
      }
      return { grant: structuredClone(duplicate), appended: false };
    }
    const collision = this.byId.get(grant.grantId);
    if (collision) {
      if (collision.contentHash !== grant.contentHash) {
        throw new Error(`POLICY_APPROVAL_ID_COLLISION id=${grant.grantId}`);
      }
      return { grant: structuredClone(collision), appended: false };
    }
    this.byId.set(grant.grantId, grant);
    this.byKey.set(grant.grantKey, grant);
    return { grant: structuredClone(grant), appended: true };
  }

  async findFor(request: AuthorityPolicyRequest): Promise<AuthorityApprovalGrant | null> {
    const normalized = normalizeRequest(request);
    const candidates = Array.from(this.byId.values())
      .filter(grant => grant.principalId === normalized.principal.id)
      .filter(grant => grant.action === normalized.action)
      .filter(grant => grant.capability === normalized.capability)
      .filter(grant => grant.resourceUri === normalized.resourceUri)
      .filter(grant => grant.projectId === normalized.projectId)
      .filter(grant => grant.operationHash === normalized.operationHash)
      .filter(grant => Date.parse(grant.grantedAt) <= Date.parse(normalized.at))
      .filter(grant => Date.parse(normalized.at) < Date.parse(grant.expiresAt))
      .sort((left, right) => right.grantedAt.localeCompare(left.grantedAt)
        || left.grantId.localeCompare(right.grantId));
    return candidates[0] ? structuredClone(candidates[0]) : null;
  }

  async list(): Promise<AuthorityApprovalGrant[]> {
    return Array.from(this.byId.values())
      .map(grant => structuredClone(grant))
      .sort((left, right) => left.grantedAt.localeCompare(right.grantedAt)
        || left.grantId.localeCompare(right.grantId));
  }
}

/**
 * Deterministic, fail-closed authority policy engine.
 *
 * Rules use typed constraints instead of arbitrary field/operator evaluation.
 * Explicit deny dominates require_approval, which dominates allow. No matching
 * rule means deny. Clearance and project scope are hard preconditions.
 */
export class AuthorityPolicyEngine {
  private readonly rules: AuthorityPolicyRule[];

  constructor(
    rules: AuthorityPolicyRuleInput[],
    private readonly approvals: IAuthorityApprovalStore = new InMemoryAuthorityApprovalStore(),
  ) {
    this.rules = rules.map(sealRule)
      .sort((left, right) => right.priority - left.priority
        || effectRank(right.effect) - effectRank(left.effect)
        || left.id.localeCompare(right.id));
    const ids = new Set<string>();
    for (const rule of this.rules) {
      if (ids.has(rule.id)) throw new Error(`POLICY_RULE_ID_DUPLICATE id=${rule.id}`);
      ids.add(rule.id);
    }
  }

  listRules(): AuthorityPolicyRule[] {
    return this.rules.map(rule => structuredClone(rule));
  }

  async grant(input: AuthorityApprovalGrantInput) {
    return this.approvals.append(sealGrant(input));
  }

  async evaluate(raw: AuthorityPolicyRequest): Promise<AuthorityPolicyDecision> {
    const request = normalizeRequest(raw);
    const requestHash = canonicalHash128(request);

    if (!request.principal.projectIds.includes(request.projectId)) {
      return decision(request, requestHash, 'deny', 'principal lacks project scope', [], null);
    }
    if (SENSITIVITY_ORDER[request.sensitivity]
      > SENSITIVITY_ORDER[request.principal.sensitivityClearance]) {
      return decision(request, requestHash, 'deny', 'principal clearance is below resource sensitivity', [], null);
    }

    const matched = this.rules.filter(rule => matches(rule, request));
    if (matched.length === 0) {
      return decision(request, requestHash, 'deny', 'default deny: no matching authority rule', [], null);
    }

    const denied = matched.filter(rule => rule.effect === 'deny');
    if (denied.length > 0) {
      return decision(
        request,
        requestHash,
        'deny',
        denied[0].reason,
        matched.map(rule => rule.id),
        null,
      );
    }

    const approvalRules = matched.filter(rule => rule.effect === 'require_approval');
    if (approvalRules.length > 0) {
      const grant = await this.approvals.findFor(request);
      if (!grant) {
        return decision(
          request,
          requestHash,
          'require_approval',
          approvalRules[0].reason,
          matched.map(rule => rule.id),
          null,
        );
      }
      return decision(
        request,
        requestHash,
        'allow',
        `approved by ${grant.approverId}`,
        matched.map(rule => rule.id),
        grant.grantId,
      );
    }

    const allowed = matched.filter(rule => rule.effect === 'allow');
    if (allowed.length === 0) {
      return decision(request, requestHash, 'deny', 'default deny: no allowing rule', matched.map(rule => rule.id), null);
    }
    return decision(
      request,
      requestHash,
      'allow',
      allowed[0].reason,
      matched.map(rule => rule.id),
      null,
    );
  }

  async requireAllowed(request: AuthorityPolicyRequest): Promise<AuthorityPolicyDecision> {
    const result = await this.evaluate(request);
    if (!result.allowed) {
      const code = result.requiresApproval ? 'POLICY_APPROVAL_REQUIRED' : 'POLICY_DENIED';
      throw new Error(`${code} decision=${result.decisionId} reason=${result.reason}`);
    }
    return result;
  }
}

function sealRule(input: AuthorityPolicyRuleInput): AuthorityPolicyRule {
  const normalized = {
    id: input.id
      ? nonEmpty(input.id, 'rule id')
      : String(canonicalIdentity({
          scheme: 'agentic',
          authority: 'cos-policy',
          resourceType: 'policy-rule',
          resourceId: `${input.effect}:${input.priority}:${input.reason}`,
        }, 'pol').id),
    version: positiveInteger(input.version ?? 1, 'rule version'),
    effect: input.effect,
    priority: safeInteger(input.priority, 'rule priority'),
    actions: normalizePatterns(input.actions, 'rule actions'),
    capabilities: normalizePatterns(input.capabilities ?? ['*'], 'rule capabilities'),
    resourcePrefixes: normalizePrefixes(input.resourcePrefixes ?? ['*']),
    projectIds: normalizePatterns(input.projectIds, 'rule projectIds'),
    principalIds: normalizePatterns(input.principalIds ?? ['*'], 'rule principalIds'),
    anyRoles: normalizePatterns(input.anyRoles ?? ['*'], 'rule anyRoles'),
    maxSensitivity: input.maxSensitivity ?? 'restricted',
    validFrom: canonicalTime(input.validFrom, 'rule validFrom'),
    validUntil: input.validUntil == null ? null : canonicalTime(input.validUntil, 'rule validUntil'),
    reason: nonEmpty(input.reason, 'rule reason'),
    provenance: normalizeProvenance(input.provenance),
    metadata: canonicalClone(input.metadata ?? {}, 'rule metadata') as Record<string, unknown>,
  };
  if (normalized.validUntil !== null
    && Date.parse(normalized.validUntil) <= Date.parse(normalized.validFrom)) {
    throw new Error('rule validUntil must be after validFrom');
  }
  return { ...normalized, contentHash: canonicalHash128(normalized) };
}

function sealGrant(input: AuthorityApprovalGrantInput): AuthorityApprovalGrant {
  const normalized = {
    grantKey: nonEmpty(input.grantKey, 'grantKey'),
    principalId: nonEmpty(input.principalId, 'grant principalId'),
    approverId: nonEmpty(input.approverId, 'grant approverId'),
    action: nonEmpty(input.action, 'grant action'),
    capability: nonEmpty(input.capability, 'grant capability'),
    resourceUri: nonEmpty(input.resourceUri, 'grant resourceUri'),
    projectId: nonEmpty(input.projectId, 'grant projectId'),
    operationHash: nonEmpty(input.operationHash, 'grant operationHash'),
    grantedAt: canonicalTime(input.grantedAt, 'grant grantedAt'),
    expiresAt: canonicalTime(input.expiresAt, 'grant expiresAt'),
    provenance: normalizeProvenance(input.provenance),
    metadata: canonicalClone(input.metadata ?? {}, 'grant metadata') as Record<string, unknown>,
  };
  if (Date.parse(normalized.expiresAt) <= Date.parse(normalized.grantedAt)) {
    throw new Error('grant expiresAt must be after grantedAt');
  }
  const grantId = String(canonicalIdentity({
    scheme: 'agentic',
    authority: 'cos-policy',
    resourceType: 'approval-grant',
    resourceId: normalized.grantKey,
  }, 'grant').id);
  return { grantId, ...normalized, contentHash: canonicalHash128({ grantId, ...normalized }) };
}

function cloneAndVerifyGrant(raw: AuthorityApprovalGrant): AuthorityApprovalGrant {
  const grant = structuredClone(raw);
  canonicalSerialize(grant);
  const { contentHash: _ignored, ...payload } = grant;
  if (canonicalHash128(payload) !== grant.contentHash) {
    throw new Error(`POLICY_APPROVAL_HASH_MISMATCH id=${grant.grantId}`);
  }
  return grant;
}

function normalizeRequest(input: AuthorityPolicyRequest): AuthorityPolicyRequest {
  const principal = normalizePrincipal(input.principal);
  const normalized: AuthorityPolicyRequest = {
    principal,
    action: nonEmpty(input.action, 'policy action'),
    capability: nonEmpty(input.capability, 'policy capability'),
    resourceUri: nonEmpty(input.resourceUri, 'policy resourceUri'),
    projectId: nonEmpty(input.projectId, 'policy projectId'),
    sensitivity: input.sensitivity,
    operationHash: nonEmpty(input.operationHash, 'policy operationHash'),
    at: canonicalTime(input.at, 'policy at'),
    context: canonicalClone(input.context ?? {}, 'policy context') as Record<string, string | number | boolean | null>,
  };
  canonicalSerialize(normalized);
  return normalized;
}

function normalizePrincipal(principal: AuthorityPrincipal): AuthorityPrincipal {
  return {
    id: nonEmpty(principal.id, 'principal id'),
    roles: normalizePatterns(principal.roles, 'principal roles').filter(value => value !== '*'),
    projectIds: normalizePatterns(principal.projectIds, 'principal projectIds').filter(value => value !== '*'),
    sensitivityClearance: principal.sensitivityClearance,
    attributes: canonicalClone(principal.attributes ?? {}, 'principal attributes') as Record<string, string | number | boolean | null>,
  };
}

function matches(rule: AuthorityPolicyRule, request: AuthorityPolicyRequest): boolean {
  const at = Date.parse(request.at);
  if (at < Date.parse(rule.validFrom)) return false;
  if (rule.validUntil !== null && at >= Date.parse(rule.validUntil)) return false;
  if (!patternMatch(rule.actions, request.action)) return false;
  if (!patternMatch(rule.capabilities, request.capability)) return false;
  if (!patternMatch(rule.projectIds, request.projectId)) return false;
  if (!patternMatch(rule.principalIds, request.principal.id)) return false;
  if (!resourceMatch(rule.resourcePrefixes, request.resourceUri)) return false;
  if (SENSITIVITY_ORDER[request.sensitivity] > SENSITIVITY_ORDER[rule.maxSensitivity]) return false;
  if (!rule.anyRoles.includes('*')
    && !request.principal.roles.some(role => rule.anyRoles.includes(role))) return false;
  return true;
}

function decision(
  request: AuthorityPolicyRequest,
  requestHash: string,
  effect: AuthorityPolicyEffect,
  reason: string,
  matchedRuleIds: string[],
  approvalGrantId: string | null,
): AuthorityPolicyDecision {
  const payload = {
    requestHash,
    effect,
    allowed: effect === 'allow',
    requiresApproval: effect === 'require_approval',
    reason,
    matchedRuleIds: [...matchedRuleIds].sort(),
    approvalGrantId,
    decidedAt: request.at,
  };
  const decisionHash = canonicalHash128(payload);
  const decisionId = String(canonicalIdentity({
    scheme: 'agentic',
    authority: 'cos-policy',
    resourceType: 'policy-decision',
    resourceId: `${requestHash}:${decisionHash}`,
  }, 'dec').id);
  return { decisionId, ...payload, decisionHash };
}

function patternMatch(patterns: string[], value: string): boolean {
  return patterns.includes('*') || patterns.includes(value);
}

function resourceMatch(prefixes: string[], resourceUri: string): boolean {
  return prefixes.includes('*') || prefixes.some(prefix => resourceUri.startsWith(prefix));
}

function effectRank(effect: AuthorityPolicyEffect): number {
  return effect === 'deny' ? 3 : effect === 'require_approval' ? 2 : 1;
}

function normalizePatterns(values: string[], label: string): string[] {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${label} must not be empty`);
  return Array.from(new Set(values.map(value => nonEmpty(value, label)))).sort();
}

function normalizePrefixes(values: string[]): string[] {
  return normalizePatterns(values, 'rule resourcePrefixes').map(prefix => {
    if (prefix !== '*' && !prefix.includes('://')) {
      throw new Error(`resource prefix must be canonical URI prefix or *: ${prefix}`);
    }
    return prefix;
  });
}

function normalizeProvenance(provenance: ProvenanceRef[]): ProvenanceRef[] {
  if (!Array.isArray(provenance) || provenance.length === 0) {
    throw new Error('policy provenance requires at least one source');
  }
  return provenance.map((entry, index) => ({
    source: nonEmpty(entry.source, `provenance[${index}].source`),
    ...(entry.revision === undefined ? {} : { revision: nonEmpty(entry.revision, `provenance[${index}].revision`) }),
    ...(entry.actor === undefined ? {} : { actor: nonEmpty(entry.actor, `provenance[${index}].actor`) }),
    ...(entry.locator === undefined ? {} : { locator: nonEmpty(entry.locator, `provenance[${index}].locator`) }),
  }));
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${message(error)}`);
  }
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

function safeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`);
  return value;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive safe integer`);
  return value;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
