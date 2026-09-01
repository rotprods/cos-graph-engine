import { strict as assert } from 'node:assert';
import {
  FiscalEventStore,
  FiscalIdentityRegistry,
} from '../packages/graph/src/profiles/fiscal-events';
import {
  createFiscalLifecycle,
  projectFiscalRecoveryTasks,
  sendFiscalTransition,
} from '../packages/graph/src/profiles/fiscal-recovery-projector';

async function main() {
  const events = new FiscalEventStore();
  events.append({
    eventId: 'ev-1',
    aggregateType: 'evidence',
    aggregateId: 'evidence:model100:2025',
    type: 'EVIDENCE_OBSERVED',
    temporal: { eventTime: '2026-06-30T10:00:00Z', observedAt: '2026-09-01T10:00:00Z' },
    source: { authority: 'OFFICIAL_AUTHORITY', sourceId: 'aeat:model100:2025' },
    certainty: 'CONFIRMED',
    evidenceIds: ['evidence:model100:2025'],
    payload: { model: '100', taxYear: 2025 },
  });
  events.append({
    eventId: 'ev-2',
    aggregateType: 'tax_return',
    aggregateId: 'tax-return:100:2025',
    type: 'STATE_TRANSITIONED',
    temporal: { eventTime: '2026-06-30T10:00:00Z', observedAt: '2026-09-01T10:00:01Z', filedAt: '2026-06-30T10:00:00Z' },
    source: { authority: 'FILED_RETURN', sourceId: 'evidence:model100:2025' },
    certainty: 'CONFIRMED',
    evidenceIds: ['evidence:model100:2025'],
    payload: { from: 'UNKNOWN', to: 'FILED' },
  });
  assert.deepEqual(events.verifyChain(), []);
  const checkpoint = events.checkpointHash();
  assert.equal(checkpoint.length, 64);
  const restored = FiscalEventStore.fromJSON(events.toJSON());
  assert.equal(restored.checkpointHash(), checkpoint);

  const identities = new FiscalIdentityRegistry();
  identities.register({
    canonicalId: 'authority:aeat',
    namespace: 'institution',
    entityType: 'tax_authority',
    aliases: ['AEAT', 'Agencia Tributaria'],
    sourceIds: ['official:aeat'],
    createdAt: '2026-09-01T00:00:00Z',
  });
  assert.equal(identities.resolve('institution', 'aeat')?.canonicalId, 'authority:aeat');
  assert.throws(() => identities.register({
    canonicalId: 'authority:wrong',
    namespace: 'institution',
    entityType: 'tax_authority',
    aliases: ['AEAT'],
    sourceIds: [],
    createdAt: '2026-09-01T00:00:00Z',
  }));

  const projection = await projectFiscalRecoveryTasks([
    {
      id: 'AUTHORITY_TRUTH', name: 'Obtain authority truth', status: 'ACTIVE', priority: 'P0',
      blockedBy: [], evidenceIds: [], definitionOfDone: 'Official authority export ingested',
    },
    {
      id: 'CLOSE_2025', name: 'Close FY2025', status: 'BLOCKED', priority: 'P0',
      blockedBy: ['AUTHORITY_TRUTH'], evidenceIds: [], definitionOfDone: '2025 reconciled and closed',
    },
    {
      id: 'CLOSE_2024', name: 'Close FY2024', status: 'BLOCKED', priority: 'P0',
      blockedBy: ['CLOSE_2025'], evidenceIds: [], definitionOfDone: '2024 reconciled and closed',
    },
  ]);

  assert.equal(projection.execution.nodes.length, 3);
  assert.equal(projection.execution.edges.length, 2);
  assert.deepEqual(
    projection.dependency.order,
    ['AUTHORITY_TRUTH', 'CLOSE_2025', 'CLOSE_2024'],
  );
  assert.equal(projection.dependency.resolver.detectCycle(projection.dependency.graphId), null);

  const filing = createFiscalLifecycle('filing');
  assert.equal(await sendFiscalTransition('filing', filing, 'mark_prepared'), true);
  assert.equal(filing.state, 'PREPARED');
  assert.equal(await sendFiscalTransition('filing', filing, 'mark_filed', {
    authority: 'DERIVED_SUMMARY', evidenceId: 'summary-1', filingReceipt: true,
  }), false, 'Derived summary must not promote PREPARED to FILED');
  assert.equal(filing.state, 'PREPARED');
  assert.equal(await sendFiscalTransition('filing', filing, 'mark_filed', {
    authority: 'FILED_RETURN', evidenceId: 'aeat-receipt-1', filingReceipt: true,
  }), true);
  assert.equal(filing.state, 'FILED');

  const payment = createFiscalLifecycle('payment');
  assert.equal(await sendFiscalTransition('payment', payment, 'confirm_due'), true);
  assert.equal(await sendFiscalTransition('payment', payment, 'instruct_payment'), true);
  assert.equal(await sendFiscalTransition('payment', payment, 'mark_paid', {
    authority: 'OFFICIAL_CORRESPONDENCE', evidenceId: 'payment-letter', paymentProof: true,
  }), false, 'Payment letter alone is insufficient');
  assert.equal(payment.state, 'PAYMENT_INSTRUCTED');
  assert.equal(await sendFiscalTransition('payment', payment, 'mark_paid', {
    authority: 'PRIMARY_FINANCIAL_STATEMENT', evidenceId: 'bank-settlement', paymentProof: true,
  }), true);
  assert.equal(payment.state, 'PAID');

  console.log('Fiscal recovery runtime contracts: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
