import { strict as assert } from 'node:assert';
import {
  FiscalAuthorityGraphRAG,
  fiscalPolicyForIntent,
  type FiscalEvidenceChunk,
} from '../packages/graph/src/profiles/fiscal-graphrag';

function chunk(overrides: Partial<FiscalEvidenceChunk> & Pick<FiscalEvidenceChunk, 'id' | 'text' | 'source'>): FiscalEvidenceChunk {
  return {
    id: overrides.id,
    text: overrides.text,
    source: overrides.source,
    embedding: overrides.embedding ?? [1, 0, 0],
    entities: overrides.entities ?? ['obligation:303:2026Q2'],
    authorityRank: overrides.authorityRank ?? '5_RECONSTRUCTED_LEDGER',
    truthClass: overrides.truthClass ?? 'RECONSTRUCTED',
    evidenceClass: overrides.evidenceClass ?? 'RECONSTRUCTED_LEDGER',
    observedAt: overrides.observedAt ?? '2026-09-01T00:00:00Z',
    eventTime: overrides.eventTime,
    validFrom: overrides.validFrom,
    validTo: overrides.validTo,
    sensitivity: overrides.sensitivity ?? 'RESTRICTED_FINANCIAL',
    provenanceCompleteness: overrides.provenanceCompleteness ?? 1,
    entityResolutionConfidence: overrides.entityResolutionConfidence ?? 1,
    centrality: overrides.centrality ?? 0.5,
    contradictionIds: overrides.contradictionIds,
    evidencePath: overrides.evidencePath ?? [overrides.source, overrides.id],
  };
}

const rag = new FiscalAuthorityGraphRAG({ candidateTopK: 10, finalTopK: 5, walkDepth: 2 });
rag.addEntity('obligation:303:2026Q2', 'Modelo 303 2T 2026', 'TaxObligation');
rag.addEntity('authority:aeat', 'AEAT', 'Authority');
rag.addEntity('adviser:carrillo', 'Adviser', 'Adviser');
rag.addRelation('obligation:303:2026Q2', 'authority:aeat', 'governed_by');

rag.addEvidenceChunk(chunk({
  id: 'template-303',
  text: 'Spreadsheet template for Modelo 303 Q2 2026.',
  source: 'gmail:template',
  authorityRank: '4_SIGNED_PROFESSIONAL_MEMO',
  truthClass: 'CONFIRMED',
  evidenceClass: 'TEMPLATE_NOT_FILING',
}));
rag.addEvidenceChunk(chunk({
  id: 'aeat-filed-303',
  text: 'Official AEAT filing receipt for Modelo 303 Q2 2026.',
  source: 'aeat:receipt',
  authorityRank: '1_FILED_OR_OFFICIAL_ASSESSMENT',
  truthClass: 'CONFIRMED',
  evidenceClass: 'FILED_RETURN_RECEIPT',
}));
rag.addEvidenceChunk(chunk({
  id: 'old-official',
  text: 'Official obligation evidence valid only for 2025.',
  source: 'aeat:old',
  authorityRank: '1_FILED_OR_OFFICIAL_ASSESSMENT',
  truthClass: 'CONFIRMED',
  evidenceClass: 'OFFICIAL',
  validFrom: '2025-01-01T00:00:00Z',
  validTo: '2025-12-31T23:59:59Z',
}));
rag.addEvidenceChunk(chunk({
  id: 'contradiction-note',
  text: 'Adviser note says the Q2 filing was still pending.',
  source: 'adviser:note',
  authorityRank: '4_SIGNED_PROFESSIONAL_MEMO',
  truthClass: 'REVIEW',
  evidenceClass: 'ADVISER_NOTE',
  contradictionIds: ['aeat-filed-303'],
}));

const filed = rag.compile(
  'Was Modelo 303 Q2 2026 filed?',
  [1, 0, 0],
  ['obligation:303:2026Q2'],
  fiscalPolicyForIntent('FILED_STATUS', {
    validAt: '2026-07-20T00:00:00Z',
    observedAt: '2026-09-01T00:00:00Z',
  }),
);

assert.equal(filed.answerable, true);
assert.equal(filed.selected.some(c => c.chunk.id === 'aeat-filed-303'), true);
assert.equal(filed.selected.some(c => c.chunk.id === 'template-303'), false, 'Template must be filtered for FILED_STATUS');
assert.equal(filed.selected.some(c => c.chunk.id === 'old-official'), false, 'Out-of-validity evidence must be filtered');
assert.equal(filed.contradictions.some(c => c.chunk.id === 'contradiction-note'), true);
assert.ok(filed.unresolvedGaps.some(g => g.includes('contradictory')));
assert.ok(filed.evidencePaths.some(path => path.includes('aeat-filed-303')));

const noOfficial = new FiscalAuthorityGraphRAG({ candidateTopK: 5, finalTopK: 5 });
noOfficial.addEntity('obligation', 'Obligation', 'TaxObligation');
noOfficial.addEvidenceChunk(chunk({
  id: 'template-only',
  text: 'Prepared spreadsheet only.',
  source: 'adviser:xlsx',
  entities: ['obligation'],
  authorityRank: '4_SIGNED_PROFESSIONAL_MEMO',
  evidenceClass: 'TEMPLATE_NOT_FILING',
}));
const blocked = noOfficial.compile(
  'Was it filed?',
  [1, 0, 0],
  ['obligation'],
  fiscalPolicyForIntent('FILED_STATUS'),
);
assert.equal(blocked.answerable, false);
assert.ok(blocked.unresolvedGaps.length > 0);

const payment = new FiscalAuthorityGraphRAG({ candidateTopK: 10, finalTopK: 5 });
payment.addEntity('debt:1', 'Tax Debt', 'Debt');
payment.addEvidenceChunk(chunk({
  id: 'payment-letter',
  text: 'Payment instruction / carta de pago.',
  source: 'aeat:letter',
  entities: ['debt:1'],
  authorityRank: '1_FILED_OR_OFFICIAL_ASSESSMENT',
  evidenceClass: 'PAYMENT_LETTER_NOT_PROOF',
}));
payment.addEvidenceChunk(chunk({
  id: 'bank-settlement',
  text: 'Bank settlement entry confirms payment.',
  source: 'bank:statement',
  entities: ['debt:1'],
  authorityRank: '2_OFFICIAL_BANK_BROKER_STATEMENT',
  evidenceClass: 'BANK_PAYMENT_PROOF',
}));
const paid = payment.compile('Was the debt paid?', [1, 0, 0], ['debt:1'], fiscalPolicyForIntent('PAYMENT_STATUS'));
assert.equal(paid.answerable, true);
assert.equal(paid.selected.some(c => c.chunk.id === 'bank-settlement'), true);
assert.equal(paid.selected.some(c => c.chunk.id === 'payment-letter'), false);

const restricted = new FiscalAuthorityGraphRAG({ candidateTopK: 5, finalTopK: 5 });
restricted.addEntity('fact:1', 'Fact', 'Fact');
restricted.addEvidenceChunk(chunk({
  id: 'restricted-chunk',
  text: 'Restricted financial evidence.',
  source: 'private',
  entities: ['fact:1'],
  sensitivity: 'RESTRICTED_FINANCIAL',
}));
const internalView = restricted.compile(
  'fact?', [1, 0, 0], ['fact:1'],
  fiscalPolicyForIntent('GENERAL', { maxSensitivity: 'INTERNAL' }),
);
assert.equal(internalView.selected.length, 0);
assert.equal(internalView.answerable, false);

console.log('Authority-aware fiscal GraphRAG: PASS');
