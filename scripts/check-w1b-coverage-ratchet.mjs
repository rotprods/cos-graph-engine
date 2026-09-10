import { readFileSync } from 'node:fs';
import { writeFileSync } from 'node:fs';

const parent = Object.freeze({
  statements: 76.59,
  branches: 78.35,
  functions: 84.75,
  lines: 76.59,
});

const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
if (!summary.total) throw new Error('coverage/coverage-summary.json has no total record');

const measured = {};
const delta = {};
for (const metric of Object.keys(parent)) {
  const pct = summary.total[metric]?.pct;
  if (typeof pct !== 'number' || !Number.isFinite(pct)) {
    throw new Error(`Missing finite ${metric} coverage percentage`);
  }
  measured[metric] = pct;
  delta[metric] = Number((pct - parent[metric]).toFixed(2));
  if (pct + 0.01 < parent[metric]) {
    throw new Error(`${metric} coverage regressed against W1A exact parent: ${pct}% < ${parent[metric]}%`);
  }
}

const receipt = {
  suite: 'durable-memory-w1b-coverage-ratchet',
  exactParentSha: 'd0d63a665a7b89205c76145a4b669a2f12866500',
  exactParentCoverage: parent,
  measured,
  delta,
};

const encoded = `${JSON.stringify(receipt, null, 2)}\n`;
writeFileSync('w1b-coverage-ratchet.json', encoded);
process.stdout.write(encoded);
