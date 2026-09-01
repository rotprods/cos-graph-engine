export type COSLevel = 0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19;

export type DimensionStatus = 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';

export interface FiscalFinancialDimension {
  level: COSLevel;
  kernelName: string;
  domainProjection: string;
  status: DimensionStatus;
  purpose: string;
  primaryInputs: string[];
  canonicalOutputs: string[];
  invariants: string[];
}

/**
 * Domain profile for evidence-bound fiscal / financial intelligence systems.
 *
 * IMPORTANT:
 * - This does not redefine the COS kernel semantics.
 * - L17-L19 are domain projections over the generic graph substrate.
 * - If a project does not need a dimension it MUST be explicitly marked NOT_APPLICABLE.
 * - No chat memory is authoritative; durable evidence/event state is required.
 */
export const FISCAL_FINANCIAL_20D_PROFILE: readonly FiscalFinancialDimension[] = [
  {
    level: 0,
    kernelName: 'Visual Graph',
    domainProjection: 'Executive / Evidence Visualization',
    status: 'REQUIRED',
    purpose: 'Render evidence, obligations, workflows, risks and graph traversals for humans.',
    primaryInputs: ['L1 execution', 'L3 dependencies', 'L8 knowledge', 'L18 obligations'],
    canonicalOutputs: ['Mermaid', 'Graphviz', 'dashboards', 'control-plane views'],
    invariants: ['visuals are projections, never source-of-truth']
  },
  {
    level: 1,
    kernelName: 'Execution Graph',
    domainProjection: 'Fiscal Recovery / Close Execution DAG',
    status: 'REQUIRED',
    purpose: 'Compile recovery, close, filing, review and remediation work into an executable DAG.',
    primaryInputs: ['tasks', 'deadlines', 'hard gates', 'owners'],
    canonicalOutputs: ['execution frontier', 'critical path', 'blocked/ready tasks'],
    invariants: ['no task DONE without evidence-backed DoD']
  },
  {
    level: 2,
    kernelName: 'State Machine',
    domainProjection: 'Evidence / Filing / Payment State',
    status: 'REQUIRED',
    purpose: 'Enforce explicit lifecycle states for evidence and tax obligations.',
    primaryInputs: ['artifacts', 'authority responses', 'payments'],
    canonicalOutputs: ['state transitions', 'audit trail'],
    invariants: ['TEMPLATE != PREPARED != FILED != LIQUIDATED != PAID']
  },
  {
    level: 3,
    kernelName: 'Dependency Graph',
    domainProjection: 'Hard-Gate Dependency Graph',
    status: 'REQUIRED',
    purpose: 'Represent blockers and prerequisite evidence between tax years, models and actions.',
    primaryInputs: ['hard gates', 'missing evidence', 'regulatory prerequisites'],
    canonicalOutputs: ['impact analysis', 'blocked_by relations', 'topological order'],
    invariants: ['cycles are errors unless explicitly modelled as reconciliation loops']
  },
  {
    level: 4,
    kernelName: 'Call Graph',
    domainProjection: 'Agent / Tool / API Call Trace',
    status: 'REQUIRED',
    purpose: 'Trace agent, connector, API and computation calls with source, cost, latency and result.',
    primaryInputs: ['agent actions', 'tool calls', 'API operations'],
    canonicalOutputs: ['call trace', 'flame graph', 'failure lineage'],
    invariants: ['every material mutation has caller and evidence context']
  },
  {
    level: 5,
    kernelName: 'Control Flow Graph',
    domainProjection: 'Tax Decision / Remediation CFG',
    status: 'REQUIRED',
    purpose: 'Model legal/operational decision branches such as filed-vs-unfiled, paid-vs-open and rectify-vs-no-action.',
    primaryInputs: ['rules', 'facts', 'states'],
    canonicalOutputs: ['decision paths', 'guards', 'unreachable-state checks'],
    invariants: ['no legal conclusion without a satisfied guard']
  },
  {
    level: 6,
    kernelName: 'DataFlow Graph',
    domainProjection: 'Evidence-to-Ledger-to-Return Lineage',
    status: 'REQUIRED',
    purpose: 'Track how invoices, statements and filings become normalized facts, calculations and reports.',
    primaryInputs: ['documents', 'bank rows', 'broker rows', 'emails'],
    canonicalOutputs: ['data lineage', 'transform graph', 'provenance path'],
    invariants: ['no derived number without upstream source lineage']
  },
  {
    level: 7,
    kernelName: 'Compute Graph',
    domainProjection: 'Deterministic Fiscal / Financial Calculation Graph',
    status: 'REQUIRED',
    purpose: 'Represent VAT, withholding, FIFO, cash-flow, debt, reconciliation and risk calculations.',
    primaryInputs: ['normalized facts', 'rules', 'tax lots'],
    canonicalOutputs: ['calculation nodes', 'intermediate values', 'final working results'],
    invariants: ['deterministic calculations separated from agent reasoning', 'working result != filed truth']
  },
  {
    level: 8,
    kernelName: 'Knowledge Graph',
    domainProjection: 'Evidence-Bound Fiscal Knowledge Graph',
    status: 'REQUIRED',
    purpose: 'Store entities, facts, claims, evidence, obligations and provenance as typed relationships.',
    primaryInputs: ['evidence', 'authority artifacts', 'normalized facts'],
    canonicalOutputs: ['entities', 'claims', 'evidence edges', 'confidence/authority metadata'],
    invariants: ['source precedence is explicit', 'facts and hypotheses are distinct node classes']
  },
  {
    level: 9,
    kernelName: 'Semantic Graph',
    domainProjection: 'Fiscal Ontology / Taxonomy / Lexicon',
    status: 'REQUIRED',
    purpose: 'Normalize terminology across invoices, models, advisers, banks and laws.',
    primaryInputs: ['ontology', 'lexicon', 'entity aliases'],
    canonicalOutputs: ['canonical concepts', 'synonyms', 'type hierarchy'],
    invariants: ['same term with different legal meaning remains disambiguated']
  },
  {
    level: 10,
    kernelName: 'Embedding Graph',
    domainProjection: 'Semantic Evidence Retrieval Index',
    status: 'REQUIRED',
    purpose: 'Support semantic retrieval over emails, PDFs, filings and notes without replacing primary evidence.',
    primaryInputs: ['document chunks', 'entity references'],
    canonicalOutputs: ['embeddings', 'nearest-neighbour links'],
    invariants: ['embedding similarity never promotes a fact to confirmed']
  },
  {
    level: 11,
    kernelName: 'GraphRAG',
    domainProjection: 'Authority-Aware Fiscal GraphRAG',
    status: 'REQUIRED',
    purpose: 'Retrieve evidence using vector search + graph traversal + authority/temporal/provenance re-ranking.',
    primaryInputs: ['L8 knowledge', 'L9 semantics', 'L10 embeddings', 'query context'],
    canonicalOutputs: ['context pack', 'evidence trace', 'retrieval confidence'],
    invariants: ['answer must carry evidence path', 'retrieval confidence != truth confidence']
  },
  {
    level: 12,
    kernelName: 'Memory Graph',
    domainProjection: 'Durable Project / Session / Decision Memory',
    status: 'REQUIRED',
    purpose: 'Persist checkpoints, decisions, incidents, unresolved questions and session handoffs.',
    primaryInputs: ['events', 'checkpoints', 'decisions'],
    canonicalOutputs: ['memory nodes', 'session links', 'recovery context'],
    invariants: ['chat memory is never canonical', 'durable memory is replayable']
  },
  {
    level: 13,
    kernelName: 'Agent Graph',
    domainProjection: 'Fiscal Recovery Multi-Agent Organization',
    status: 'REQUIRED',
    purpose: 'Model researcher, evidence collector, reconciler, tax analyst, reviewer and human approval roles.',
    primaryInputs: ['agent registry', 'capabilities', 'assignments'],
    canonicalOutputs: ['delegation graph', 'approval graph', 'responsibility map'],
    invariants: ['human/legal approval gates remain explicit', 'agent recommendation != filing authorization']
  },
  {
    level: 14,
    kernelName: 'Tool Graph',
    domainProjection: 'Connector / Capability / Policy Graph',
    status: 'REQUIRED',
    purpose: 'Route Gmail, Drive, GitHub, web, local DB and future AEAT/TGSS tools through capability/policy gates.',
    primaryInputs: ['tool registry', 'schemas', 'permissions', 'failure state'],
    canonicalOutputs: ['tool routing', 'fallback paths', 'capability graph'],
    invariants: ['tool availability is runtime state', 'writes require explicit policy']
  },
  {
    level: 15,
    kernelName: 'Workflow Graph',
    domainProjection: 'Fiscal Ingestion / Reconciliation / Filing Workflow',
    status: 'REQUIRED',
    purpose: 'Orchestrate repeatable evidence ingestion, invoice close, authority truth, QA and handoff workflows.',
    primaryInputs: ['workflow definitions', 'states', 'tools'],
    canonicalOutputs: ['workflow runs', 'retries', 'compensation paths'],
    invariants: ['workflows are idempotent', 'failed steps remain observable']
  },
  {
    level: 16,
    kernelName: 'Network Graph',
    domainProjection: 'Financial / Infrastructure / Provider Network',
    status: 'REQUIRED',
    purpose: 'Represent banks, brokers, exchanges, Drive/GitHub/local storage and service dependencies.',
    primaryInputs: ['provider inventory', 'infrastructure topology'],
    canonicalOutputs: ['provider graph', 'concentration risk', 'single-point-of-failure analysis'],
    invariants: ['execution substrate is not source-of-truth by itself']
  },
  {
    level: 17,
    kernelName: 'Social Graph',
    domainProjection: 'Counterparty / Institution / Adviser Graph',
    status: 'REQUIRED',
    purpose: 'Project people/institutions: clients, suppliers, advisers, AEAT, TGSS, banks and counterparties.',
    primaryInputs: ['counterparties', 'institutions', 'roles'],
    canonicalOutputs: ['counterparty network', 'responsibility/relationship edges'],
    invariants: ['legal entity identity and human identity stay distinct']
  },
  {
    level: 18,
    kernelName: 'Biological Graph',
    domainProjection: 'Regulatory / Obligation Graph',
    status: 'REQUIRED',
    purpose: 'Domain projection for laws, models, deadlines, obligations, jurisdiction and compliance dependencies.',
    primaryInputs: ['official rules', 'tax models', 'deadlines'],
    canonicalOutputs: ['obligation graph', 'jurisdiction graph', 'rule applicability edges'],
    invariants: ['official current law is versioned and temporally scoped']
  },
  {
    level: 19,
    kernelName: 'Molecular Graph',
    domainProjection: 'Financial Instrument / Invoice / Tax-Lot Graph',
    status: 'REQUIRED',
    purpose: 'Domain projection for atomic financial objects and their composition: invoices, payments, debts, assets, tax lots and returns.',
    primaryInputs: ['instruments', 'invoice lines', 'tax lots', 'payments'],
    canonicalOutputs: ['atomic financial object graph', 'composition/decomposition edges'],
    invariants: ['transfers are not disposals unless rule/fact says so', 'invoice/payment/filing remain distinct']
  }
] as const;

export function validateFiscalFinancial20DProfile(
  profile: readonly FiscalFinancialDimension[] = FISCAL_FINANCIAL_20D_PROFILE
): string[] {
  const errors: string[] = [];
  const levels = new Set<number>();

  for (const d of profile) {
    if (levels.has(d.level)) errors.push(`Duplicate level L${d.level}`);
    levels.add(d.level);
    if (!d.kernelName) errors.push(`L${d.level}: missing kernelName`);
    if (!d.domainProjection) errors.push(`L${d.level}: missing domainProjection`);
    if (d.status === 'REQUIRED' && d.invariants.length === 0) {
      errors.push(`L${d.level}: required dimension has no invariants`);
    }
  }

  for (let level = 0; level < 20; level++) {
    if (!levels.has(level)) errors.push(`Missing level L${level}`);
  }

  return errors;
}
