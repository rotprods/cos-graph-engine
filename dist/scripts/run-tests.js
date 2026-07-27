"use strict";
// COS Test Runner — Executes all test suites
Object.defineProperty(exports, "__esModule", { value: true });
const core_test_1 = require("../tests/core.test");
const runtime_test_1 = require("../tests/runtime.test");
const memory_test_1 = require("../tests/memory.test");
const graph_test_1 = require("../tests/graph.test");
const integration_test_1 = require("../tests/integration.test");
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║           COS TEST SUITE                                 ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    let totalPassed = 0;
    let totalFailed = 0;
    // Run all test suites
    const suites = [
        { name: 'Core', run: core_test_1.runCoreTests },
        { name: 'Runtime', run: runtime_test_1.runRuntimeTests },
        { name: 'Memory', run: memory_test_1.runMemoryTests },
        { name: 'Graph', run: graph_test_1.runGraphTests },
        { name: 'Integration', run: integration_test_1.runIntegrationTests },
    ];
    for (const suite of suites) {
        try {
            const result = await suite.run();
            totalPassed += result.passed;
            totalFailed += result.failed;
        }
        catch (error) {
            console.log(`\n  ❌ Suite "${suite.name}" crashed: ${error.message}`);
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
    }
    else {
        console.log(`  ❌ ${totalFailed} test(s) failed`);
    }
    console.log('');
    process.exit(totalFailed > 0 ? 1 : 0);
}
main();
//# sourceMappingURL=run-tests.js.map