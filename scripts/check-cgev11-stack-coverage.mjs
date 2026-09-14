import { readFileSync, writeFileSync } from 'node:fs';

const floor = Object.freeze({
  statements: 80.05,
  branches: 80.05,
  functions: 85.80,
  lines: 80.05,
});

const qualifiedW1dSha = '5a0b4b2a0b97794ac8cf7feb7ca9ed26bde15c25';
const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
if (!summary.total) throw new Error('coverage/coverage-summary.json has no total record');

const measured = {};
const delta = {};
for (const metric of Object.keys(floor)) {
  const pct = summary.total[metric]?.pct;
  if (typeof pct !== 'number' || !Number.isFinite(pct)) {
    throw new Error(`Missing finite ${metric} coverage percentage`);
  }
  measured[metric] = pct;
  delta[metric] = Number((pct - floor[metric]).toFixed(2));
  if (pct + 0.01 < floor[metric]) {
    throw new Error(`${metric} coverage regressed against final W1D: ${pct}% < ${floor[metric]}%`);
  }
}

const receipt = {
  schema: 'cgev11.stack-integration/coverage-ratchet/v1',
  qualifiedW1dSha,
  floor,
  measured,
  delta,
};

const encoded = `${JSON.stringify(receipt, null, 2)}\n`;
writeFileSync('cgev11-stack-coverage.json', encoded);
process.stdout.write(encoded);
