import { strict as assert } from 'node:assert';
import {
  FISCAL_FINANCIAL_20D_PROFILE,
  validateFiscalFinancial20DProfile,
} from '../packages/graph/src/profiles/fiscal-financial';

const errors = validateFiscalFinancial20DProfile();
assert.deepEqual(errors, [], `Profile validation failed: ${errors.join('; ')}`);
assert.equal(FISCAL_FINANCIAL_20D_PROFILE.length, 20, 'Profile must contain 20 dimensions');
assert.deepEqual(
  FISCAL_FINANCIAL_20D_PROFILE.map(d => d.level),
  Array.from({ length: 20 }, (_, i) => i),
  'Profile levels must be exactly L0-L19 in order',
);

for (const dimension of FISCAL_FINANCIAL_20D_PROFILE) {
  assert.ok(dimension.kernelName.length > 0, `L${dimension.level} missing kernelName`);
  assert.ok(dimension.domainProjection.length > 0, `L${dimension.level} missing domainProjection`);
  if (dimension.status === 'REQUIRED') {
    assert.ok(dimension.invariants.length > 0, `L${dimension.level} must define invariants`);
  }
}

const l2 = FISCAL_FINANCIAL_20D_PROFILE[2];
assert.ok(l2.invariants.some(v => v.includes('TEMPLATE != PREPARED != FILED != LIQUIDATED != PAID')));

const l11 = FISCAL_FINANCIAL_20D_PROFILE[11];
assert.equal(l11.domainProjection, 'Authority-Aware Fiscal GraphRAG');

const l13 = FISCAL_FINANCIAL_20D_PROFILE[13];
assert.ok(l13.invariants.some(v => v.includes('human/legal approval gates')));

console.log('Fiscal/Financial 20D profile: PASS');
