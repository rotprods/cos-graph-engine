import { readFileSync, writeFileSync } from 'node:fs';

const parent = Object.freeze({
  statements: 78.22,
  branches: 78.93,
  functions: 84.99,
  lines: 78.22,
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
    throw new Error(`${metric} coverage regressed against W1B exact parent: ${pct}% < ${parent[metric]}%`);
  }
}

const receipt = {
  suite: 'sandbox-security-w1c-coverage-ratchet',
  exactParentSha: '08c90d11d850f7c4f0c95702a4d0a541a1cf5e02',
  exactParentCoverage: parent,
  measured,
  delta,
};

const encoded = `${JSON.stringify(receipt, null, 2)}\n`;
writeFileSync('w1c-coverage-ratchet.json', encoded);
process.stdout.write(encoded);
