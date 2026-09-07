import { pathToFileURL } from 'node:url';

/** A job conclusion alone is insufficient: skipped jobs and stale checkouts fail. */
export const REQUIRED_CI_JOBS = Object.freeze([
  'ci-contract', 'lint', 'test-graph-csr', 'test-graph-pruning',
  'test-graph-benchmark', 'test-wasm', 'test-observability',
  'test-visualization', 'test-core', 'benchmark', 'coverage',
  'docker', 'full-regression',
]);

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain record`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain record`);
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor?.enumerable || !('value' in descriptor)) {
      throw new TypeError(`${label} must contain only enumerable data properties`);
    }
  }
  return value;
}

/** Validate GitHub's direct needs results; this does not authenticate a runner. */
export function verifyCiResults(value, expectedSha) {
  if (typeof expectedSha !== 'string' || !/^[a-f0-9]{40}$/.test(expectedSha)) {
    throw new TypeError('expectedSha must be an exact lowercase Git commit SHA');
  }
  const results = record(value, 'needs');
  const actual = Object.keys(results).sort();
  const expected = [...REQUIRED_CI_JOBS].sort();
  if (actual.length !== expected.length || actual.some((key, i) => key !== expected[i])) {
    throw new Error('CI job manifest mismatch: missing or unexpected direct dependency');
  }
  for (const id of REQUIRED_CI_JOBS) {
    const job = record(results[id], `needs.${id}`);
    if (job.result !== 'success') {
      throw new Error(`CI gate rejected ${id}: mandatory job did not succeed`);
    }
    const outputs = record(job.outputs, `needs.${id}.outputs`);
    if (outputs.tested_sha !== expectedSha) {
      throw new Error(`CI gate rejected ${id}: checkout SHA mismatch`);
    }
    if (outputs.completed !== 'true') {
      throw new Error(`CI gate rejected ${id}: completion receipt missing`);
    }
  }
  return Object.freeze({
    schema: 'cos.ci/aggregate-check/v1alpha1',
    candidateSha: expectedSha,
    checkedJobs: REQUIRED_CI_JOBS.length,
    result: 'PASS',
    scope: 'configured-ci-jobs-only',
    productionCertified: false,
  });
}

export function main(env = process.env) {
  try {
    const raw = env.COS_CI_RESULTS;
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 262144) {
      throw new Error('COS_CI_RESULTS must contain a bounded non-empty JSON object');
    }
    const report = verifyCiResults(JSON.parse(raw), env.GITHUB_SHA);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return 0;
  } catch {
    // Provider payloads and outputs may contain sensitive data. Never echo them.
    process.stderr.write('COS CI gate FAILED: invalid, missing, stale or unsuccessful required evidence.\n');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
