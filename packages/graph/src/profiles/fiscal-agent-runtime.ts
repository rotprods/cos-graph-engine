import type { EntityId } from '@cos/core';
import { AgentGraphEngine } from '../level13-agent';
import { ToolGraphEngine, type ToolType } from '../level14-tool';
import { WorkflowGraphEngine } from '../level15-workflow';

export type FiscalToolSensitivity = 'PUBLIC' | 'INTERNAL' | 'RESTRICTED_FINANCIAL';
export type FiscalToolAccess = 'READ' | 'WRITE' | 'READ_WRITE';
export type FiscalToolHealth = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
export type FiscalDataAuthorityClass =
  | 'PRIMARY_AUTHORITY'
  | 'PRIMARY_EVIDENCE'
  | 'OPERATIONAL_SYSTEM'
  | 'DERIVED_PROJECTION'
  | 'RESEARCH_ONLY';

const SENSITIVITY_ORDER: Record<FiscalToolSensitivity, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  RESTRICTED_FINANCIAL: 2,
};

export interface FiscalToolDescriptor {
  name: string;
  type: ToolType;
  description: string;
  capabilities: string[];
  access: FiscalToolAccess;
  sensitivity: FiscalToolSensitivity;
  authorityClass: FiscalDataAuthorityClass;
  schemaHash?: string;
  permissionScope?: string;
  health: FiscalToolHealth;
  latencyMs?: number;
  rateLimit?: number;
  costPerCall?: number;
  fallback?: string;
  lastSuccessfulCallAt?: string;
}

export interface FiscalToolRequest {
  capability: string;
  operation: 'READ' | 'WRITE';
  maxSensitivity: FiscalToolSensitivity;
  allowDegraded?: boolean;
  humanWriteApproval?: boolean;
}

export interface FiscalToolDecision {
  allowed: boolean;
  tool?: FiscalToolDescriptor;
  reason: string;
  fallback?: FiscalToolDescriptor;
}

/**
 * Policy wrapper for COS L14 Tool Graph.
 * Native ToolGraph models capabilities/routing; this layer adds fiscal sensitivity,
 * source-authority and write-approval constraints.
 */
export class FiscalToolFabric {
  readonly graph = new ToolGraphEngine('Fiscal / Financial Tool Fabric');
  private readonly descriptors = new Map<string, FiscalToolDescriptor>();
  private readonly nativeIds = new Map<string, EntityId>();

  register(descriptor: FiscalToolDescriptor): EntityId {
    if (this.descriptors.has(descriptor.name)) throw new Error(`Duplicate fiscal tool: ${descriptor.name}`);
    const id = this.graph.addNode({
      name: descriptor.name,
      type: descriptor.type,
      description: descriptor.description,
      requiredCapabilities: [...descriptor.capabilities],
      rateLimit: descriptor.rateLimit ?? 1000,
      latency: descriptor.latencyMs ?? 0,
      costPerCall: descriptor.costPerCall ?? 0,
      enabled: descriptor.health !== 'UNAVAILABLE',
    });
    this.descriptors.set(descriptor.name, structuredClone(descriptor));
    this.nativeIds.set(descriptor.name, id);
    return id;
  }

  addFallback(from: string, to: string, priority = 5): void {
    const source = this.nativeIds.get(from);
    const target = this.nativeIds.get(to);
    if (!source || !target) throw new Error(`Unknown fallback tool: ${from} -> ${to}`);
    this.graph.addEdge(source, target, 'fallback_to', priority);
    const descriptor = this.descriptors.get(from)!;
    descriptor.fallback = to;
  }

  decide(request: FiscalToolRequest): FiscalToolDecision {
    const candidates = [...this.descriptors.values()]
      .filter(tool => tool.capabilities.some(c => c.toLowerCase() === request.capability.toLowerCase()))
      .sort((a, b) => {
        const healthA = a.health === 'HEALTHY' ? 0 : a.health === 'DEGRADED' ? 1 : 2;
        const healthB = b.health === 'HEALTHY' ? 0 : b.health === 'DEGRADED' ? 1 : 2;
        if (healthA !== healthB) return healthA - healthB;
        return (a.latencyMs ?? 0) - (b.latencyMs ?? 0);
      });

    for (const tool of candidates) {
      const reason = this.denialReason(tool, request);
      if (!reason) {
        return { allowed: true, tool: structuredClone(tool), reason: 'Policy and capability checks passed.' };
      }
    }

    const first = candidates[0];
    const fallback = first?.fallback ? this.descriptors.get(first.fallback) : undefined;
    return {
      allowed: false,
      tool: first ? structuredClone(first) : undefined,
      fallback: fallback ? structuredClone(fallback) : undefined,
      reason: first ? this.denialReason(first, request) ?? 'No eligible tool.' : 'No tool provides requested capability.',
    };
  }

  getDescriptor(name: string): FiscalToolDescriptor | undefined {
    const value = this.descriptors.get(name);
    return value ? structuredClone(value) : undefined;
  }

  validate(): string[] {
    const errors = this.graph.validate();
    for (const [name, descriptor] of this.descriptors) {
      if (descriptor.fallback && !this.descriptors.has(descriptor.fallback)) {
        errors.push(`Tool ${name} references unknown fallback ${descriptor.fallback}`);
      }
    }
    return errors;
  }

  private denialReason(tool: FiscalToolDescriptor, request: FiscalToolRequest): string | null {
    if (tool.health === 'UNAVAILABLE') return `${tool.name} is unavailable.`;
    if (tool.health === 'DEGRADED' && !request.allowDegraded) return `${tool.name} is degraded.`;
    if (SENSITIVITY_ORDER[tool.sensitivity] > SENSITIVITY_ORDER[request.maxSensitivity]) {
      return `${tool.name} exceeds allowed sensitivity.`;
    }
    if (request.operation === 'WRITE') {
      if (tool.access === 'READ') return `${tool.name} is read-only.`;
      if (!request.humanWriteApproval) return `Write to ${tool.name} requires explicit human approval.`;
    }
    return null;
  }
}

export interface FiscalAgentRuntime {
  agents: AgentGraphEngine;
  tools: FiscalToolFabric;
  workflows: Map<string, WorkflowGraphEngine>;
  actorIds: Record<string, EntityId>;
}

export function buildFiscalAgentOrganization(): { engine: AgentGraphEngine; actorIds: Record<string, EntityId> } {
  const engine = new AgentGraphEngine('Fiscal Recovery Organization');
  const actorIds: Record<string, EntityId> = {};

  actorIds.missionCommander = engine.addNode({
    name: 'Mission Commander', role: 'coordinator',
    capabilities: ['planning', 'priority', 'hard-gate management'], tools: [], memoryIds: [], confidence: 0.95,
  });
  actorIds.evidenceCollector = engine.addNode({
    name: 'Evidence Collector', role: 'researcher',
    capabilities: ['evidence search', 'provenance', 'document triage'], tools: [], memoryIds: [], confidence: 0.90,
  });
  actorIds.entityResolver = engine.addNode({
    name: 'Entity Resolver', role: 'analyst',
    capabilities: ['identity resolution', 'alias matching', 'counterparty mapping'], tools: [], memoryIds: [], confidence: 0.90,
  });
  actorIds.reconciler = engine.addNode({
    name: 'Accountant Reconciler', role: 'analyst',
    capabilities: ['invoice reconciliation', 'bank matching', 'VAT reconciliation'], tools: [], memoryIds: [], confidence: 0.90,
  });
  actorIds.taxResearcher = engine.addNode({
    name: 'Tax Researcher', role: 'researcher',
    capabilities: ['official tax research', 'rule versioning', 'applicability analysis'], tools: [], memoryIds: [], confidence: 0.88,
  });
  actorIds.cryptoAnalyst = engine.addNode({
    name: 'Crypto Tax-Lot Analyst', role: 'analyst',
    capabilities: ['FIFO', 'tax lots', 'provider reconciliation'], tools: [], memoryIds: [], confidence: 0.88,
  });
  actorIds.qaReviewer = engine.addNode({
    name: 'Independent QA Reviewer', role: 'reviewer',
    capabilities: ['adversarial review', 'evidence audit', 'calculation QA'], tools: [], memoryIds: [], confidence: 0.92,
  });
  actorIds.humanAdviserGate = engine.addNode({
    name: 'Human Tax Adviser Gate', role: 'reviewer',
    capabilities: ['HUMAN_ONLY', 'legal tax review', 'filing review'], tools: [], memoryIds: [], confidence: 1.0,
  });
  actorIds.ownerApprovalGate = engine.addNode({
    name: 'Owner Approval Gate', role: 'reviewer',
    capabilities: ['HUMAN_ONLY', 'final approval', 'external write authorization'], tools: [], memoryIds: [], confidence: 1.0,
  });

  engine.addEdge(actorIds.missionCommander, actorIds.evidenceCollector, 'delegates_to', 9);
  engine.addEdge(actorIds.missionCommander, actorIds.entityResolver, 'delegates_to', 8);
  engine.addEdge(actorIds.missionCommander, actorIds.reconciler, 'delegates_to', 9);
  engine.addEdge(actorIds.missionCommander, actorIds.taxResearcher, 'delegates_to', 8);
  engine.addEdge(actorIds.missionCommander, actorIds.cryptoAnalyst, 'delegates_to', 7);
  engine.addEdge(actorIds.evidenceCollector, actorIds.entityResolver, 'collaborates_with', 8);
  engine.addEdge(actorIds.entityResolver, actorIds.reconciler, 'collaborates_with', 8);
  engine.addEdge(actorIds.taxResearcher, actorIds.reconciler, 'collaborates_with', 7);
  engine.addEdge(actorIds.cryptoAnalyst, actorIds.reconciler, 'collaborates_with', 7);
  engine.addEdge(actorIds.reconciler, actorIds.qaReviewer, 'reviews', 9);
  engine.addEdge(actorIds.taxResearcher, actorIds.qaReviewer, 'reviews', 8);
  engine.addEdge(actorIds.qaReviewer, actorIds.humanAdviserGate, 'reviews', 10);
  engine.addEdge(actorIds.humanAdviserGate, actorIds.ownerApprovalGate, 'approves', 10);

  return { engine, actorIds };
}

export function buildFiscalToolFabric(): FiscalToolFabric {
  const tools = new FiscalToolFabric();
  tools.register({
    name: 'Gmail', type: 'communication', description: 'Historical and current fiscal email evidence',
    capabilities: ['email_search', 'email_read', 'email_draft'], access: 'READ_WRITE',
    sensitivity: 'RESTRICTED_FINANCIAL', authorityClass: 'PRIMARY_EVIDENCE', health: 'HEALTHY', latencyMs: 300,
  });
  tools.register({
    name: 'Google Drive', type: 'storage', description: 'Canonical raw fiscal evidence tree and derived control planes',
    capabilities: ['file_search', 'file_read', 'file_write'], access: 'READ_WRITE',
    sensitivity: 'RESTRICTED_FINANCIAL', authorityClass: 'PRIMARY_EVIDENCE', health: 'HEALTHY', latencyMs: 250,
  });
  tools.register({
    name: 'GitHub', type: 'api', description: 'Code, schemas, checkpoints and integration PRs',
    capabilities: ['git_read', 'git_write', 'ci'], access: 'READ_WRITE',
    sensitivity: 'INTERNAL', authorityClass: 'OPERATIONAL_SYSTEM', health: 'HEALTHY', latencyMs: 220,
  });
  tools.register({
    name: 'Local Fiscal DB', type: 'database', description: 'Local/portable derived fiscal projections',
    capabilities: ['sql_read', 'projection_write'], access: 'READ_WRITE',
    sensitivity: 'RESTRICTED_FINANCIAL', authorityClass: 'DERIVED_PROJECTION', health: 'HEALTHY', latencyMs: 5,
  });
  tools.register({
    name: 'Web Research', type: 'api', description: 'Official-law and external research source discovery',
    capabilities: ['web_search', 'official_rule_research'], access: 'READ',
    sensitivity: 'PUBLIC', authorityClass: 'RESEARCH_ONLY', health: 'HEALTHY', latencyMs: 400,
  });
  tools.register({
    name: 'AEAT Authority Source', type: 'api', description: 'Future direct/authorized authority truth connector',
    capabilities: ['authority_filing_truth', 'authority_debt_truth'], access: 'READ',
    sensitivity: 'RESTRICTED_FINANCIAL', authorityClass: 'PRIMARY_AUTHORITY', health: 'UNAVAILABLE', latencyMs: 0,
  });
  tools.register({
    name: 'TGSS Authority Source', type: 'api', description: 'Future direct/authorized RETA/debt authority connector',
    capabilities: ['authority_reta_truth', 'authority_debt_truth'], access: 'READ',
    sensitivity: 'RESTRICTED_FINANCIAL', authorityClass: 'PRIMARY_AUTHORITY', health: 'UNAVAILABLE', latencyMs: 0,
  });
  return tools;
}

function authorityTruthWorkflow(): WorkflowGraphEngine {
  const wf = new WorkflowGraphEngine('Authority Truth', 'Recover official filing/payment/census truth without guessing.');
  const trigger = wf.addNode({ name: 'Authority evidence requested/arrived', type: 'trigger' });
  const ingest = wf.addNode({ name: 'Ingest authority artifact', type: 'action', service: 'evidence-ingestion', retries: 2 });
  const classify = wf.addNode({ name: 'Classify artifact', type: 'transform', service: 'evidence-classifier' });
  const verify = wf.addNode({ name: 'Verify authority + taxpayer + period', type: 'condition', config: { policy: 'authority-truth' } });
  const append = wf.addNode({ name: 'Append fiscal event', type: 'action', service: 'event-store' });
  const update = wf.addNode({ name: 'Rebuild L1/L2/L3/L8 projections', type: 'action', service: 'cos-projector' });
  const reject = wf.addNode({ name: 'Quarantine / request correction', type: 'notification', service: 'recovery-control' });
  const done = wf.addNode({ name: 'Checkpoint', type: 'end' });
  wf.addEdge(trigger, ingest, 'on_success');
  wf.addEdge(ingest, classify, 'on_success');
  wf.addEdge(classify, verify, 'on_success');
  wf.addEdge(verify, append, 'on_condition_true', 'authority_valid');
  wf.addEdge(verify, reject, 'on_condition_false', 'authority_invalid');
  wf.addEdge(append, update, 'on_success');
  wf.addEdge(update, done, 'on_success');
  wf.addEdge(reject, done, 'on_success');
  return wf;
}

function invoiceCloseWorkflow(): WorkflowGraphEngine {
  const wf = new WorkflowGraphEngine('Invoice Close', 'Evidence-bound invoice capture and quarter assignment.');
  const trigger = wf.addNode({ name: 'Invoice/charge observed', type: 'trigger' });
  const resolve = wf.addNode({ name: 'Resolve supplier/client identity', type: 'action', service: 'identity-registry' });
  const classify = wf.addNode({ name: 'Classify VAT/withholding/business nexus', type: 'action', service: 'fiscal-classifier' });
  const bankMatch = wf.addNode({ name: 'Match bank movement', type: 'action', service: 'reconciler' });
  const qa = wf.addNode({ name: 'Evidence complete?', type: 'condition', config: { requires: ['invoice', 'identity', 'tax-treatment'] } });
  const accept = wf.addNode({ name: 'Assign quarter and append fact events', type: 'action', service: 'event-store' });
  const missing = wf.addNode({ name: 'Open missing-evidence task', type: 'notification', service: 'recovery-control' });
  const done = wf.addNode({ name: 'Checkpoint', type: 'end' });
  wf.addEdge(trigger, resolve, 'on_success');
  wf.addEdge(resolve, classify, 'on_success');
  wf.addEdge(classify, bankMatch, 'on_success');
  wf.addEdge(bankMatch, qa, 'on_success');
  wf.addEdge(qa, accept, 'on_condition_true');
  wf.addEdge(qa, missing, 'on_condition_false');
  wf.addEdge(accept, done, 'on_success');
  wf.addEdge(missing, done, 'on_success');
  return wf;
}

function quarterlyCloseWorkflow(): WorkflowGraphEngine {
  const wf = new WorkflowGraphEngine('Quarterly Close', 'Freeze, reconcile, calculate, review, approve, file and ingest receipt.');
  const trigger = wf.addNode({ name: 'Internal quarter close date', type: 'trigger' });
  const freeze = wf.addNode({ name: 'Freeze period input set', type: 'action', service: 'close-control' });
  const reconcile = wf.addNode({ name: 'Reconcile invoices/bank/expenses', type: 'action', service: 'reconciler' });
  const calculate = wf.addNode({ name: 'Run deterministic fiscal compute graph', type: 'action', service: 'compute-graph' });
  const qa = wf.addNode({ name: 'Independent QA', type: 'condition', service: 'qa-reviewer' });
  const adviser = wf.addNode({ name: 'Human adviser review', type: 'condition', service: 'HUMAN_ONLY' });
  const owner = wf.addNode({ name: 'Owner external-write approval', type: 'condition', service: 'HUMAN_ONLY' });
  const file = wf.addNode({ name: 'External filing action', type: 'action', service: 'authority-filing', retries: 0 });
  const receipt = wf.addNode({ name: 'Ingest filing/payment receipt', type: 'action', service: 'authority-truth' });
  const fix = wf.addNode({ name: 'Return to remediation queue', type: 'notification', service: 'recovery-control' });
  const done = wf.addNode({ name: 'Close quarter checkpoint', type: 'end' });
  wf.addEdge(trigger, freeze, 'on_success');
  wf.addEdge(freeze, reconcile, 'on_success');
  wf.addEdge(reconcile, calculate, 'on_success');
  wf.addEdge(calculate, qa, 'on_success');
  wf.addEdge(qa, adviser, 'on_condition_true');
  wf.addEdge(qa, fix, 'on_condition_false');
  wf.addEdge(adviser, owner, 'on_condition_true');
  wf.addEdge(adviser, fix, 'on_condition_false');
  wf.addEdge(owner, file, 'on_condition_true');
  wf.addEdge(owner, fix, 'on_condition_false');
  wf.addEdge(file, receipt, 'on_success');
  wf.addEdge(file, fix, 'on_failure');
  wf.addEdge(receipt, done, 'on_success');
  wf.addEdge(fix, done, 'on_success');
  return wf;
}

function cryptoFIFOWorkflow(): WorkflowGraphEngine {
  const wf = new WorkflowGraphEngine('Global Crypto FIFO', 'Provider-complete tax-lot calculation workflow.');
  const trigger = wf.addNode({ name: 'Provider inventory changed', type: 'trigger' });
  const inventory = wf.addNode({ name: 'Verify provider/wallet completeness', type: 'condition', service: 'provider-registry' });
  const ingest = wf.addNode({ name: 'Ingest normalized transactions', type: 'action', service: 'crypto-ledger' });
  const classify = wf.addNode({ name: 'Classify transfer vs disposal', type: 'action', service: 'crypto-classifier' });
  const fifo = wf.addNode({ name: 'Run global FIFO compute graph', type: 'action', service: 'compute-graph' });
  const reconcile = wf.addNode({ name: 'Reconcile current balances', type: 'condition', service: 'reconciler' });
  const blocked = wf.addNode({ name: 'Block final tax result', type: 'notification', service: 'recovery-control' });
  const persist = wf.addNode({ name: 'Append tax-lot events/projection', type: 'action', service: 'event-store' });
  const done = wf.addNode({ name: 'Checkpoint', type: 'end' });
  wf.addEdge(trigger, inventory, 'on_success');
  wf.addEdge(inventory, ingest, 'on_condition_true');
  wf.addEdge(inventory, blocked, 'on_condition_false');
  wf.addEdge(ingest, classify, 'on_success');
  wf.addEdge(classify, fifo, 'on_success');
  wf.addEdge(fifo, reconcile, 'on_success');
  wf.addEdge(reconcile, persist, 'on_condition_true');
  wf.addEdge(reconcile, blocked, 'on_condition_false');
  wf.addEdge(persist, done, 'on_success');
  wf.addEdge(blocked, done, 'on_success');
  return wf;
}

export function buildFiscalWorkflowFabric(): Map<string, WorkflowGraphEngine> {
  const workflows = new Map<string, WorkflowGraphEngine>();
  workflows.set('authority-truth', authorityTruthWorkflow());
  workflows.set('invoice-close', invoiceCloseWorkflow());
  workflows.set('quarterly-close', quarterlyCloseWorkflow());
  workflows.set('global-crypto-fifo', cryptoFIFOWorkflow());
  return workflows;
}

export function buildFiscalAgentRuntime(): FiscalAgentRuntime {
  const { engine: agents, actorIds } = buildFiscalAgentOrganization();
  const tools = buildFiscalToolFabric();
  const workflows = buildFiscalWorkflowFabric();

  const errors = [
    ...agents.validate(),
    ...tools.validate(),
    ...[...workflows.values()].flatMap(w => w.validate()),
  ];
  if (errors.length) throw new Error(`Invalid fiscal agent runtime: ${errors.join('; ')}`);

  return { agents, tools, workflows, actorIds };
}
