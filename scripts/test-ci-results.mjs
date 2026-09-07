import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { REQUIRED_CI_JOBS, verifyCiResults } from './verify-ci-results.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER = 'abcdef0123456789abcdef0123456789abcdef01';
const cli = fileURLToPath(new URL('./verify-ci-results.mjs', import.meta.url));
const expectedJobs = [
  'ci-contract', 'lint', 'test-graph-csr', 'test-graph-pruning',
  'test-graph-benchmark', 'test-wasm', 'test-observability',
  'test-visualization', 'test-core', 'benchmark', 'coverage',
  'docker', 'full-regression',
];
const green = () => Object.fromEntries(expectedJobs.map((id) => [id, {
  result: 'success', outputs: { tested_sha: SHA, completed: 'true' },
}]));

function run(raw, sha = SHA) {
  const result = spawnSync(process.execPath, [cli], {
    env: { COS_CI_RESULTS: raw, GITHUB_SHA: sha },
    encoding: 'utf8', timeout: 5000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  return result;
}

test('required manifest retains the reviewed baseline and calibration job', () => {
  assert.deepEqual(REQUIRED_CI_JOBS, expectedJobs);
  assert.equal(new Set(REQUIRED_CI_JOBS).size, expectedJobs.length);
  assert.ok(Object.isFrozen(REQUIRED_CI_JOBS));
});

test('all exact-SHA successful jobs yield a scoped immutable report', () => {
  const input = green();
  const original = JSON.stringify(input);
  const report = verifyCiResults(input, SHA);
  assert.equal(report.result, 'PASS');
  assert.equal(report.checkedJobs, 13);
  assert.equal(report.candidateSha, SHA);
  assert.equal(report.productionCertified, false);
  assert.ok(Object.isFrozen(report));
  assert.equal(JSON.stringify(input), original);
});

for (const id of expectedJobs) {
  test(`omitting required job ${id} fails closed`, () => {
    const input = green();
    delete input[id];
    assert.throws(() => verifyCiResults(input, SHA), /manifest mismatch/);
  });
}

for (const result of ['failure', 'skipped', 'cancelled', 'neutral', 'timed_out',
  'action_required', 'in_progress', '', null, true]) {
  test(`non-success result ${JSON.stringify(result)} is rejected for every job`, () => {
    for (const id of expectedJobs) {
      const input = green();
      input[id].result = result;
      assert.throws(() => verifyCiResults(input, SHA));
    }
  });
}

test('unexpected dependency cannot substitute for an expected one', () => {
  const input = green();
  delete input.docker;
  input['docker-fake'] = { result: 'success', outputs: { tested_sha: SHA, completed: 'true' } };
  assert.throws(() => verifyCiResults(input, SHA), /manifest mismatch/);
});

test('additional dependencies require an explicit reviewed manifest change', () => {
  const input = green();
  input.extra = { result: 'success', outputs: { tested_sha: SHA, completed: 'true' } };
  assert.throws(() => verifyCiResults(input, SHA));
});

test('stale checkout is rejected in every required job', () => {
  for (const id of expectedJobs) {
    const input = green();
    input[id].outputs.tested_sha = OTHER;
    assert.throws(() => verifyCiResults(input, SHA), /SHA mismatch/);
  }
});

test('missing or non-string completion receipts fail closed', () => {
  for (const id of expectedJobs) {
    for (const marker of [undefined, null, true, 'false', 'TRUE', '']) {
      const input = green();
      input[id].outputs.completed = marker;
      assert.throws(() => verifyCiResults(input, SHA), /completion receipt/);
    }
  }
});

test('missing outputs and malformed jobs fail closed', () => {
  for (const entry of [null, [], 'success', {}, { result: 'success' }]) {
    const input = green();
    input.lint = entry;
    assert.throws(() => verifyCiResults(input, SHA));
  }
});

test('empty, non-record and inherited needs are rejected', () => {
  for (const input of [{}, [], null, true, 'success', Object.create(green())]) {
    assert.throws(() => verifyCiResults(input, SHA));
  }
});

test('accessors are rejected without executing them', () => {
  let called = false;
  const input = green();
  Object.defineProperty(input, 'lint', { enumerable: true, get() { called = true; return {}; } });
  assert.throws(() => verifyCiResults(input, SHA));
  assert.equal(called, false);
});

test('null-prototype provider records are accepted without mutation', () => {
  assert.equal(verifyCiResults(Object.assign(Object.create(null), green()), SHA).result, 'PASS');
});

test('symbols and non-enumerable hidden entries are rejected', () => {
  const input = green();
  input[Symbol('hidden')] = {};
  assert.throws(() => verifyCiResults(input, SHA));
  const other = green();
  Object.defineProperty(other, 'hidden', { value: {} });
  assert.throws(() => verifyCiResults(other, SHA));
});

test('invalid expected SHA never yields a PASS', () => {
  for (const value of [undefined, null, '', 'main', SHA.slice(0, 7), SHA.toUpperCase(), ` ${SHA}`]) {
    assert.throws(() => verifyCiResults(green(), value));
  }
});

test('CLI succeeds only for complete exact-SHA evidence', () => {
  const result = run(JSON.stringify(green()));
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).checkedJobs, 13);
  assert.equal(result.stderr, '');
});

test('CLI turns real failure, skipped and missing evidence into non-zero exits', () => {
  for (const state of ['failure', 'skipped', 'cancelled']) {
    const input = green();
    input['test-wasm'].result = state;
    assert.equal(run(JSON.stringify(input)).status, 1);
  }
  const input = green();
  delete input.docker;
  assert.equal(run(JSON.stringify(input)).status, 1);
});

test('CLI rejects malformed JSON, empty input, oversize and stale SHA', () => {
  for (const raw of ['', '{}', '{bad', 'null', '[]']) {
    assert.equal(run(raw).status, 1);
  }
  assert.equal(run(JSON.stringify(green()), OTHER).status, 1);
});

test('CLI logs never echo raw malformed provider content', () => {
  const secret = 'SYNTHETIC_PRIVATE_PAYLOAD';
  const result = run(`{"private":"${secret}"`);
  assert.equal(result.status, 1);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(secret));
});

test('oversize input is rejected in-process without OS environment truncation', async () => {
  const { main } = await import('./verify-ci-results.mjs');
  assert.equal(main({ COS_CI_RESULTS: 'x'.repeat(262145), GITHUB_SHA: SHA }), 1);
});
