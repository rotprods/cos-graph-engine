// COS Test Runner — Core suites (tests/*) + nivel scripts + seguridad + validacion + hub.
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { runCoreTests } from '../tests/core.test';
import { runRuntimeTests } from '../tests/runtime.test';
import { runMemoryTests } from '../tests/memory.test';
import { runGraphTests } from '../tests/graph.test';
import { runIntegrationTests } from '../tests/integration.test';

// Scripts cableados en `npm test` (existian pero no corrian, o son nuevos).
const WIRED_SCRIPTS: string[] = [
  // niveles (antes huerfanos)
  'scripts/test-level0-visual.ts',
  'scripts/test-level2-state.ts',
  'scripts/test-level4-call.ts',
  'scripts/test-level5-cfg.ts',
  'scripts/test-level6-dataflow.ts',
  'scripts/test-levels-6-11.ts',
  'scripts/test-levels-8-11.ts',
  // infraestructura del engine (antes huerfanos)
  'scripts/test-query.ts',
  'scripts/test-graphql.ts',
  'scripts/test-convert.ts',
  'scripts/test-security.ts',
  'scripts/test-streaming.ts',
  'scripts/test-smb-integration.ts',
  'scripts/test-plugin.ts',
  'scripts/test-playground.ts',
  'scripts/test-i18n.ts',
  'scripts/test-gcn.ts',
  'scripts/test-automl.ts',
  'scripts/test-ml-integration.ts',
  'scripts/test-persistence.ts',
  // endurecimiento (nuevos)
  'scripts/test-security-hardening.ts',
  'scripts/test-validation-all.ts',
  'scripts/test-xss-hardening.ts',
  // hub (workspace @cos/hub)
  'packages/hub/tests/hub.test.ts',
  'packages/hub/tests/intelligence.test.ts',
  'packages/hub/tests/rag.test.ts',
  'packages/hub/tests/endpoints.test.ts',
];

function runWiredScripts(): { passed: number; failed: number; lines: string[] } {
  let passed = 0;
  let failed = 0;
  const lines: string[] = [];
  // tsx local (declarado en devDependencies) -> sin red; fallback a npx.
  const tsx = existsSync('node_modules/.bin/tsx') ? './node_modules/.bin/tsx' : 'npx tsx';
  for (const s of WIRED_SCRIPTS) {
    try {
      execSync(`${tsx} ${s}`, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
      passed++;
      lines.push(`  ✅ ${s}`);
    } catch (err) {
      failed++;
      const e = err as { stderr?: Buffer; message?: string };
      const detail = e.stderr ? e.stderr.toString().split('\n').slice(-3).join(' ') : e.message || '';
      lines.push(`  ❌ ${s} — ${detail.trim().slice(0, 120)}`);
    }
  }
  return { passed, failed, lines };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           COS TEST SUITE                                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  let totalPassed = 0;
  let totalFailed = 0;

  const suites = [
    { name: 'Core', run: runCoreTests },
    { name: 'Runtime', run: runRuntimeTests },
    { name: 'Memory', run: runMemoryTests },
    { name: 'Graph', run: runGraphTests },
    { name: 'Integration', run: runIntegrationTests },
  ];

  for (const suite of suites) {
    try {
      const result = await suite.run();
      totalPassed += result.passed;
      totalFailed += result.failed;
    } catch (error) {
      console.log(`\n  ❌ Suite "${suite.name}" crashed: ${(error as Error).message}`);
      totalFailed += 1;
    }
  }

  console.log('');
  console.log('  ── Scripts cableados (niveles + seguridad + validacion + hub) ──');
  const wired = runWiredScripts();
  for (const line of wired.lines) console.log(line);
  totalPassed += wired.passed;
  totalFailed += wired.failed;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Total: ${totalPassed + totalFailed} units`);
  console.log(`  Passed: ${totalPassed}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log('');

  if (totalFailed === 0) {
    console.log('  ✅✅✅ ALL TESTS PASSED');
  } else {
    console.log(`  ❌ ${totalFailed} unit(s) failed`);
  }
  console.log('');

  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
