import { readFileSync } from 'node:fs';

const baseline = Object.freeze({
  statements: 73.13,
  branches: 76.81,
  functions: 72.85,
  lines: 73.13,
});

const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
if (!summary.total) throw new Error('coverage/coverage-summary.json has no total record');

const measured = {};
for (const metric of Object.keys(baseline)) {
  const pct = summary.total[metric]?.pct;
  if (typeof pct !== 'number' || !Number.isFinite(pct)) {
    throw new Error(`Missing finite ${metric} coverage percentage`);
  }
  measured[metric] = pct;
  if (pct + 0.01 < baseline[metric]) {
    throw new Error(`${metric} coverage regressed: ${pct}% < ${baseline[metric]}%`);
  }
}

console.log(JSON.stringify({
  suite: 'coverage-orphan-suites-w1',
  priorBaseline: baseline,
  measured,
  delta: Object.fromEntries(Object.keys(baseline).map((metric) => [
    metric,
    Number((measured[metric] - baseline[metric]).toFixed(2)),
  ])),
  target: { statements: 100, branches: 100, functions: 100, lines: 100 },
  certified100: Object.values(measured).every((pct) => pct === 100),
}, null, 2));
