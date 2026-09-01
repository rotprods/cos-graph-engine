import { strict as assert } from 'node:assert';
import {
  projectFiscalKnowledge,
  type FiscalKnowledgeLink,
  type FiscalKnowledgeNode,
} from '../packages/graph/src/profiles/fiscal-knowledge';
import { FiscalGraphQLGateway } from '../packages/graph/src/profiles/fiscal-graphql';

const nodes: FiscalKnowledgeNode[] = [
  {
    id: 'obligation:303:2026Q2',
    name: 'Modelo 303 2T 2026',
    type: 'TaxObligation',
    truthClass: 'BLOCKED',
    authorityRank: '7_HYPOTHESIS',
    taxYear: 2026,
    period: 'Q2',
    validFrom: '2026-04-01T00:00:00Z',
    sourceIds: ['search:gmail:q2'],
    sensitivity: 'RESTRICTED_FINANCIAL',
    properties: { state: 'UNKNOWN', model: '303' },
  },
  {
    id: 'evidence:template:303q2',
    name: 'Adviser spreadsheet template',
    type: 'EvidenceArtifact',
    truthClass: 'CONFIRMED',
    authorityRank: '4_SIGNED_PROFESSIONAL_MEMO',
    taxYear: 2026,
    period: 'Q2',
    sensitivity: 'RESTRICTED_FINANCIAL',
    properties: { evidenceClass: 'TEMPLATE_NOT_FILING' },
  },
  {
    id: 'task:obtain-303q2',
    name: 'Obtain actual filed 303 Q2 receipt',
    type: 'Task',
    truthClass: 'CONFIRMED',
    taxYear: 2026,
    period: 'Q2',
    sensitivity: 'INTERNAL',
    properties: { state: 'BLOCKED_EXTERNAL', priority: 'P0' },
  },
  {
    id: 'obligation:100:2025',
    name: 'Modelo 100 2025',
    type: 'TaxObligation',
    truthClass: 'BLOCKED',
    taxYear: 2025,
    period: 'FY',
    validFrom: '2025-01-01T00:00:00Z',
    validTo: '2026-12-31T23:59:59Z',
    sensitivity: 'RESTRICTED_FINANCIAL',
    properties: { state: 'UNKNOWN', model: '100' },
  },
];

const links: FiscalKnowledgeLink[] = [
  {
    source: 'obligation:303:2026Q2',
    target: 'evidence:template:303q2',
    relation: 'EVIDENCED_BY',
    confidence: 1,
    sourceId: 'search:gmail:q2',
  },
  {
    source: 'obligation:303:2026Q2',
    target: 'task:obtain-303q2',
    relation: 'BLOCKED_BY',
    confidence: 1,
  },
];

const projection = projectFiscalKnowledge(nodes, links);
assert.deepEqual(projection.knowledge.validate(), []);
assert.deepEqual(projection.semantic.validate(), []);
assert.equal(projection.knowledge.entities.length, 4);
assert.equal(projection.knowledge.relations.length, 2);
assert.equal(
  projection.knowledge.relations.find(r => r.source === 'obligation:303:2026Q2')?.properties?.fiscalRelation,
  'EVIDENCED_BY',
);
assert.ok(projection.semantic.getNode('fiscal:type:TaxObligation'));

const gql = new FiscalGraphQLGateway(nodes, links);
assert.ok(gql.getSchema().includes('fiscalObligations'));

const q2 = gql.obligations({ taxYear: 2026, period: 'Q2' });
assert.equal(q2.length, 1);
assert.equal(q2[0].id, 'obligation:303:2026Q2');

const evidence = gql.evidenceFor('obligation:303:2026Q2');
assert.deepEqual(evidence.map(e => e.id), ['evidence:template:303q2']);

const blockers = gql.blockers('obligation:303:2026Q2');
assert.deepEqual(blockers.map(b => b.id), ['task:obtain-303q2']);

const valid2025 = gql.search({ fiscalType: 'TaxObligation', validAt: '2025-06-01T00:00:00Z' });
assert.equal(valid2025.some(n => n.id === 'obligation:100:2025'), true);
assert.equal(valid2025.some(n => n.id === 'obligation:303:2026Q2'), false);

const result = gql.execute('fiscalObligations', { taxYear: 2026, period: 'Q2' });
assert.equal((result.fiscalObligations as unknown[]).length, 1);
assert.throws(() => gql.execute('addNode', { level: 8 }), /Unsupported read-only fiscal GraphQL operation/);

assert.throws(
  () => projectFiscalKnowledge(nodes, [{ source: 'missing', target: nodes[0].id, relation: 'RELATED_TO' }]),
  /Unknown fiscal relation source/,
);

console.log('Fiscal knowledge + GraphQL read gateway: PASS');
