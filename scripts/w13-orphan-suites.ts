import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

interface SuiteSpec {
  file: string;
  timeoutMs?: number;
  history: string;
}

const SUITES: SuiteSpec[] = [
  { file: 'test-level0-visual.ts', history: 'orphan from PR #16' },
  { file: 'test-level2-state.ts', history: 'orphan from PR #16; migrated in W13' },
  { file: 'test-level4-call.ts', history: 'orphan from PR #16' },
  { file: 'test-level5-cfg.ts', history: 'orphan from PR #16' },
  { file: 'test-level6-dataflow.ts', history: 'orphan from PR #16' },
  { file: 'test-query.ts', history: 'orphan from PR #16' },
  { file: 'test-graphql.ts', history: 'orphan from PR #16' },
  { file: 'test-convert.ts', history: 'orphan from PR #16' },
  { file: 'test-security.ts', history: 'orphan from PR #16' },
  { file: 'test-streaming.ts', history: 'orphan from PR #16' },
  { file: 'test-plugin.ts', history: 'orphan from PR #16' },
  { file: 'test-playground.ts', history: 'orphan from PR #16' },
  { file: 'test-i18n.ts', history: 'orphan from PR #16' },
  { file: 'test-gcn.ts', history: 'orphan from PR #16' },
  { file: 'test-automl.ts', history: 'orphan from PR #16' },
  { file: 'test-ml-integration.ts', history: 'orphan from PR #16' },
  { file: 'test-persistence.ts', history: 'orphan from PR #16' },
  { file: 'test-smb-integration.ts', timeoutMs: 45_000, history: 'previously excluded for open handles; W13 requires proof' },
  { file: 'test-levels-6-11.ts', timeoutMs: 90_000, history: 'previously blocked pending cognitive correctness fixes' },
  { file: 'test-levels-8-11.ts', timeoutMs: 90_000, history: 'previously blocked pending cognitive correctness fixes' },
];

let passed = 0;
let failed = 0;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║          W13 ORPHAN / EXCLUDED SUITE GATE               ║');
console.log('╚══════════════════════════════════════════════════════════╝');

for (const suite of SUITES) {
  const path = `scripts/${suite.file}`;
  if (!existsSync(path)) {
    failed += 1;
    console.error(`  ❌ ${suite.file} — missing required suite (${suite.history})`);
    continue;
  }
  try {
    execFileSync('npx', ['--no-install', 'tsx', path], {
      stdio: 'inherit',
      timeout: suite.timeoutMs ?? 60_000,
      env: { ...process.env, CI: 'true' },
    });
    passed += 1;
    console.log(`  ✅ ${suite.file}`);
  } catch (error) {
    failed += 1;
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ ${suite.file} — ${detail}`);
  }
}

console.log(`\nW13 orphan/excluded suites: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
