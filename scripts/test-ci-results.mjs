import assert from 'node:assert/strict';
import test from 'node:test';
import { REQUIRED_CI_JOBS, verifyCiResults } from './verify-ci-results.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER = 'abcdef0123456789abcdef0123456789abcdef01';
const green = () => Object.fromEntries(REQUIRED_CI_JOBS.map((id) => [id, {
  result: 'success', outputs: { tested_sha: SHA, completed: 'true' },
}]));

test('exact successful manifest passes', () => {
  const report = verifyCiResults(green(), SHA);
  assert.equal(report.result, 'PASS');
  assert.equal(report.checkedJobs, REQUIRED_CI_JOBS.length);
  assert.equal(report.productionCertified, false);
  assert.ok(Object.isFrozen(report));
});

for (const id of REQUIRED_CI_JOBS) {
  test(`missing ${id} fails closed`, () => {
    const input = green(); delete input[id];
    assert.throws(() => verifyCiResults(input, SHA));
  });
  test(`failed ${id} fails closed`, () => {
    const input = green(); input[id].result = 'failure';
    assert.throws(() => verifyCiResults(input, SHA));
  });
  test(`skipped ${id} fails closed`, () => {
    const input = green(); input[id].result = 'skipped';
    assert.throws(() => verifyCiResults(input, SHA));
  });
  test(`stale ${id} fails closed`, () => {
    const input = green(); input[id].outputs.tested_sha = OTHER;
    assert.throws(() => verifyCiResults(input, SHA));
  });
  test(`missing receipt ${id} fails closed`, () => {
    const input = green(); delete input[id].outputs.completed;
    assert.throws(() => verifyCiResults(input, SHA));
  });
}

test('extra job fails closed until reviewed into the manifest', () => {
  const input = green(); input.extra = { result: 'success', outputs: { tested_sha: SHA, completed: 'true' } };
  assert.throws(() => verifyCiResults(input, SHA));
});

test('invalid expected SHA fails closed', () => {
  for (const sha of ['', 'main', SHA.slice(0, 7), SHA.toUpperCase()]) {
    assert.throws(() => verifyCiResults(green(), sha));
  }
});
