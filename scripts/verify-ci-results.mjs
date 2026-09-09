import { pathToFileURL } from 'node:url';

export const REQUIRED_CI_JOBS = Object.freeze([
  'contract', 'quality-core', 'specialized', 'performance', 'coverage', 'docker',
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
      throw new TypeError(`${label} must contain enumerable data properties only`);
    }
  }
  return value;
}

export function verifyCiResults(value, expectedSha) {
  if (typeof expectedSha !== 'string' || !/^[a-f0-9]{40}$/.test(expectedSha)) {
    throw new TypeError('expectedSha must be an exact lowercase Git SHA');
  }
  const results = record(value, 'needs');
  const actual = Object.keys(results).sort();
  const expected = [...REQUIRED_CI_JOBS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error('CI manifest mismatch');
  }
  for (const id of REQUIRED_CI_JOBS) {
    const job = record(results[id], `needs.${id}`);
    if (job.result !== 'success') throw new Error(`Required job ${id} did not succeed`);
    const outputs = record(job.outputs, `needs.${id}.outputs`);
    if (outputs.tested_sha !== expectedSha) throw new Error(`Required job ${id} tested a stale SHA`);
    if (outputs.completed !== 'true') throw new Error(`Required job ${id} lacks completion receipt`);
  }
  return Object.freeze({
    schema: 'cos.main-convergence/ci-receipt/v1',
    candidateSha: expectedSha,
    checkedJobs: REQUIRED_CI_JOBS.length,
    result: 'PASS',
    productionCertified: false,
  });
}

export function main(env = process.env) {
  try {
    const raw = env.COS_CI_RESULTS;
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 262144) throw new Error('invalid input');
    process.stdout.write(`${JSON.stringify(verifyCiResults(JSON.parse(raw), env.GITHUB_SHA))}\n`);
    return 0;
  } catch {
    process.stderr.write('COS convergence gate FAILED: missing, stale or unsuccessful required evidence.\n');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
