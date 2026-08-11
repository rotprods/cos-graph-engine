// COS Test Runner — Executes all test suites
// Core suites (tests/*) + nivel-level orphaned scripts wired into the default run.

import { execSync } from 'child_process';
import { runCoreTests } from '../tests/core.test';
import { runRuntimeTests } from '../tests/runtime.test';
import { runMemoryTests } from '../tests/memory.test';
import { runGraphTests } from '../tests/graph.test';
import { runIntegrationTests } from '../tests/integration.test';

// Scripts de nivel huérfanos que pasan y ahora se ejecutan en `npm test`.
// (test-levels-6-11 y test-levels-8-11 quedan fuera: requieren los fixes de PR #12.)
const ORPHAN_SCRIPTS = [
  'test-level0-visual',
  'test-level2-state',
  'test-level4-call',
  'test-level5-cfg',
  'test-level6-dataflow',
  'test-query',
  'test-graphql',
  'test-convert',
  'test-security',
  'test-streaming',
  // test-smb-integration excluido: cuelga el proceso (handles SMB abiertos, fix pendiente)
  'test-plugin',
  'test-playground',
  'test-i18n',
  'test-gcn',
  'test-automl',
  'test-ml-integration',
  'test-persistence',
];

function runOrphanScripts(): { passed: number; failed: number; lines: string[] } {
  let passed = 0;
  let failed = 0;
  const lines: string[] = [];
  for (const s of ORPHAN_SCRIPTS) {
    try {
      execSync(`npx tsx scripts/${s}.ts`, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
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

  // Run all test suites
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

  // Nivel-level orphaned scripts (wired)
  console.log('');
  console.log('  ── Nivel scripts (orphaned, wired) ──');
  const orphan = runOrphanScripts();
  for (const line of orphan.lines) console.log(line);
  totalPassed += orphan.passed;
  totalFailed += orphan.failed;

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Total: ${totalPassed + totalFailed} tests`);
  console.log(`  Passed: ${totalPassed}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log('');

  if (totalFailed === 0) {
    console.log('  ✅✅✅ ALL TESTS PASSED');
  } else {
    console.log(`  ❌ ${totalFailed} test(s) failed`);
  }
  console.log('');

  process.exit(totalFailed > 0 ? 1 : 0);
}

main();