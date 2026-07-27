// COS Test Runner — Executes all test suites

import { runCoreTests } from '../tests/core.test';
import { runRuntimeTests } from '../tests/runtime.test';
import { runMemoryTests } from '../tests/memory.test';
import { runGraphTests } from '../tests/graph.test';
import { runIntegrationTests } from '../tests/integration.test';

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