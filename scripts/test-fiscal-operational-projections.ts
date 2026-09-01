import { strict as assert } from 'node:assert';
import {
  FiscalCallTraceProjection,
  buildFiscalDecisionCFG,
  buildFiscalDataFlow,
  computeFiscalMoney,
  FiscalEmbeddingIndex,
  FiscalMemoryProjection,
} from '../packages/graph/src/profiles/fiscal-operational-projections';
import {
  FiscalProviderNetwork,
  FiscalCounterpartyProjection,
  createFiscalRegulatoryProjection,
  createFiscalAtomicFinancialProjection,
} from '../packages/graph/src/profiles/fiscal-domain-projections';

// L4 — call trace
const calls = new FiscalCallTraceProjection();
calls.record({
  callId: 'call-1', actorId: 'evidence-collector', actorName: 'Evidence Collector',
  toolId: 'gmail', toolName: 'Gmail', operation: 'email_search', durationMs: 120,
  outcome: 'SUCCESS', evidenceIds: ['email:1'], schemaHash: 'schema-v1', sensitivity: 'RESTRICTED_FINANCIAL',
});
assert.deepEqual(calls.validate(), []);
assert.equal(calls.snapshot().observations.length, 1);
assert.equal(calls.getObservation('call-1')?.evidenceIds?.[0], 'email:1');
assert.throws(() => calls.record({
  callId: 'call-1', actorId: 'a', actorName: 'A', toolId: 't', toolName: 'T', operation: 'read',
  durationMs: 1, outcome: 'SUCCESS',
}), /Duplicate fiscal call observation/);

// L5 — explicit guards
for (const kind of ['filed-status', 'payment-status', 'invoice-validity', 'foreign-service-vat', 'historical-regularization'] as const) {
  const cfg = buildFiscalDecisionCFG(kind);
  assert.deepEqual(cfg.builder.validate(cfg.graphId), []);
  assert.ok(cfg.graph.blocks.some(b => b.type === 'condition'));
  assert.ok(cfg.graph.edges.length >= 5);
}

// L6 — evidence lineage. Latencies are explicit because critical-path analysis must never invent timing.
const dataFlow = buildFiscalDataFlow([
  { id: 'pdf', name: 'Invoice PDF', type: 'source', evidenceIds: ['pdf:1'], artifactType: 'invoice', latencyMs: 1 },
  { id: 'parse', name: 'Parse Invoice', type: 'parse', transformVersion: '1', latencyMs: 2 },
  { id: 'normalize', name: 'Normalize Invoice', type: 'normalize', transformVersion: '1', latencyMs: 3 },
  { id: 'calc', name: 'VAT Calculation', type: 'calculate', transformVersion: '1', latencyMs: 4 },
  { id: 'return', name: 'Modelo 303 Working Projection', type: 'projection', latencyMs: 1 },
], [
  { source: 'pdf', target: 'parse', dataType: 'pdf', relation: 'PARSED_INTO' },
  { source: 'parse', target: 'normalize', dataType: 'invoice-json', relation: 'NORMALIZED_INTO' },
  { source: 'normalize', target: 'calc', dataType: 'fiscal-fact', relation: 'CALCULATED_INTO' },
  { source: 'calc', target: 'return', dataType: 'working-tax-result', relation: 'PROJECTED_AS' },
]);
assert.deepEqual(dataFlow.validate(), []);
assert.deepEqual(dataFlow.criticalPath().map(n => n.id), ['pdf', 'parse', 'normalize', 'calc', 'return']);
assert.equal(dataFlow.totalLatency(), 11);
assert.equal(dataFlow.edges[0].partitionKey, 'PARSED_INTO');

// L7 — integer-cent deterministic computation
const invoice = computeFiscalMoney('invoice-total', { base: 50000, vat: 10500, withholding: 3500 });
assert.equal(invoice.outputCents, 57000);
const pnl = computeFiscalMoney('realized-pnl', { proceeds: 399638, basis: 835716 });
assert.equal(pnl.outputCents, -436078);
const debt = computeFiscalMoney('debt-total', { principal: 28911, surcharge: 5782, interest: 312 });
assert.equal(debt.outputCents, 35005);
const gap = computeFiscalMoney('reconciliation-gap', { expected: 360000, observed: 348000 });
assert.equal(gap.outputCents, 12000);
assert.throws(() => computeFiscalMoney('invoice-total', { base: 12.5 }), /integer cents/);

// L10 — derived embedding index
const embeddings = new FiscalEmbeddingIndex();
embeddings.add({ id: 'emb-1', label: 'Modelo 100 filing receipt', vector: [1, 0], evidenceId: 'receipt-1', fiscalType: 'EvidenceArtifact', authorityRank: '1' });
embeddings.add({ id: 'emb-2', label: 'Invoice', vector: [0, 1], evidenceId: 'invoice-1', fiscalType: 'Invoice', authorityRank: '3' });
assert.equal(embeddings.nearest([1, 0], 1)[0].node.id, 'emb-1');
embeddings.rebuildKNN(1);
assert.deepEqual(embeddings.graph.validate(), []);

// L12 — durable checkpoints
const memory = new FiscalMemoryProjection();
memory.addCheckpoint({ checkpointId: 'CP-1', sessionId: 'S-1', content: 'Initial recovery state', evidenceIds: [], taskDelta: ['REC-1'], riskDelta: [], nextFrontier: ['Authority Truth'], manifestHash: 'h1' });
memory.addCheckpoint({ checkpointId: 'CP-2', sessionId: 'S-2', content: 'Authority truth arrived', evidenceIds: ['aeat:1'], taskDelta: ['REC-1:DONE'], riskDelta: ['R1:CLOSED'], nextFrontier: ['Close 2025'], manifestHash: 'h2' });
assert.deepEqual(memory.validate(), []);
assert.equal(memory.graph.getEdges().length, 1);
assert.equal(memory.getCheckpoint('CP-2')?.metadata?.manifestHash, 'h2');
assert.throws(() => memory.addCheckpoint({ checkpointId: 'CP-2', sessionId: 'S-3', content: 'dup', evidenceIds: [], taskDelta: [], riskDelta: [], nextFrontier: [] }), /Duplicate checkpoint/);

// L16 — provider topology and SPOF
const providers = new FiscalProviderNetwork();
providers.addProvider({ id: 'drive', name: 'Google Drive /FISCAL', kind: 'storage', health: 'HEALTHY', canonical: true });
providers.addProvider({ id: 'local', name: 'Local Fiscal DB', kind: 'database', health: 'HEALTHY' });
providers.addProvider({ id: 'agent', name: 'Fiscal Runtime', kind: 'runtime', health: 'HEALTHY' });
providers.addLink({ source: 'agent', target: 'drive', relation: 'READS_FROM' });
providers.addLink({ source: 'agent', target: 'local', relation: 'WRITES_TO' });
assert.deepEqual(providers.validate(), []);
assert.equal(providers.singlePointsOfFailure().some(n => n.id === 'drive'), true);
providers.addLink({ source: 'drive', target: 'local', relation: 'FALLBACK_TO' });
assert.equal(providers.singlePointsOfFailure().some(n => n.id === 'drive'), false);

// L17 — counterparty topology with sidecar semantics
const counterparties = new FiscalCounterpartyProjection();
counterparties.addNode({ id: 'owner', name: 'Owner', kind: 'person', verified: true, jurisdiction: 'ES' });
counterparties.addNode({ id: 'aeat', name: 'AEAT', kind: 'authority', verified: true, jurisdiction: 'ES' });
counterparties.addNode({ id: 'client', name: 'Client Legal Entity', kind: 'client', verified: true, jurisdiction: 'ES' });
counterparties.addLink({ source: 'aeat', target: 'owner', relation: 'REGULATES' });
counterparties.addLink({ source: 'client', target: 'owner', relation: 'CLIENT_OF' });
assert.deepEqual(counterparties.validate(), []);
assert.equal(counterparties.snapshot().links[0].relation, 'REGULATES');

// L18 — explicit domain semantic adapter, no fake protein/gene coercion
const regulatory = createFiscalRegulatoryProjection();
regulatory.addNode({ id: 'jurisdiction:es', type: 'Jurisdiction', name: 'Spain' });
regulatory.addNode({ id: 'rule:303', type: 'TaxRule', name: 'VAT periodic filing rule' });
regulatory.addNode({ id: 'obligation:303:q3', type: 'TaxObligation', name: 'Modelo 303 Q3' });
regulatory.addEdge({ id: 'reg-e1', source: 'rule:303', target: 'jurisdiction:es', relation: 'APPLIES_IN' });
regulatory.addEdge({ id: 'reg-e2', source: 'rule:303', target: 'obligation:303:q3', relation: 'GOVERNS' });
assert.equal(regulatory.kernelLevel, 18);
assert.equal(regulatory.projectionMode, 'DOMAIN_SEMANTIC_ADAPTER');
assert.deepEqual(regulatory.validate(), []);
assert.equal(regulatory.toJSON().nodes.some(n => n.type === 'TaxRule'), true);

// L19 — atomic financial object projection
const atomic = createFiscalAtomicFinancialProjection();
atomic.addNode({ id: 'invoice:1', type: 'Invoice', name: 'Invoice 1' });
atomic.addNode({ id: 'line:1', type: 'InvoiceLine', name: 'Service line' });
atomic.addNode({ id: 'payment:1', type: 'Payment', name: 'Payment' });
atomic.addEdge({ id: 'atom-e1', source: 'invoice:1', target: 'line:1', relation: 'CONTAINS' });
atomic.addEdge({ id: 'atom-e2', source: 'invoice:1', target: 'payment:1', relation: 'SETTLED_BY' });
assert.equal(atomic.kernelLevel, 19);
assert.equal(atomic.projectionMode, 'DOMAIN_SEMANTIC_ADAPTER');
assert.deepEqual(atomic.validate(), []);

console.log('Fiscal operational/domain projections L4-L7/L10/L12/L16-L19: PASS');
