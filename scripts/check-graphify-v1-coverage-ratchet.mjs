import { readFileSync, writeFileSync } from 'node:fs';

const parent = Object.freeze({
  statements: 81.01,
  branches: 79.46,
  functions: 85.03,
  lines: 81.01,
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
    throw new Error(`${metric} coverage regressed against W1C exact parent: ${pct}% < ${parent[metric]}%`);
  }
}

const receipt = {
  suite: 'graphify-snapshot-v1-coverage-ratchet',
  exactParentSha: 'f85fe66bce8079c0e3ec481bbeb3a88bf2c8184c',
  exactParentCoverage: parent,
  measured,
  delta,
};

const encoded = `${JSON.stringify(receipt, null, 2)}\n`;
writeFileSync('graphify-v1-coverage-ratchet.json', encoded);
process.stdout.write(encoded);
