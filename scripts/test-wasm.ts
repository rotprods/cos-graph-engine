/**
 * Tests de WebAssembly Runtime (Fase 13)
 * Prueba: WASM modules, runtime simulator, SDK bindings, benchmarks
 */

import { WASMRuntime, WASMSDK, WASM_MODULES, WASM_MODULES as MODULES, wasmRuntime, wasmSDK } from '../packages/graph/src/wasm';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function section(name: string) { console.log(`\n=== ${name} ===`); }

async function main() {

// =============================================
// T-13.1: WASM Runtime
// =============================================

section('WASM Module Definitions');

assert(Object.keys(WASM_MODULES).length === 3, '3 WASM modules defined');
assert(MODULES.L1 !== undefined, 'L1 module defined');
assert(MODULES.L3 !== undefined, 'L3 module defined');
assert(MODULES.L7 !== undefined, 'L7 module defined');

assert(MODULES.L1.name === 'execution-engine', 'L1 module name correct');
assert(MODULES.L3.name === 'dependency-resolver', 'L3 module name correct');
assert(MODULES.L7.name === 'compute-engine', 'L7 module name correct');

assert(MODULES.L1.exports.includes('execute_sequential'), 'L1 exports execute_sequential');
assert(MODULES.L1.exports.includes('execute_parallel'), 'L1 exports execute_parallel');
assert(MODULES.L3.exports.includes('topological_sort'), 'L3 exports topological_sort');
assert(MODULES.L3.exports.includes('find_cycles'), 'L3 exports find_cycles');
assert(MODULES.L7.exports.includes('forward_pass'), 'L7 exports forward_pass');
assert(MODULES.L7.exports.includes('train_step'), 'L7 exports train_step');

assert(MODULES.L1.wasmSize > 40000, 'L1 wasm size reasonable');
assert(MODULES.L7.wasmSize > 80000, 'L7 wasm size larger (compute)');

section('WASMRuntime — Initialization');

const runtime = new WASMRuntime({ useWasm: true, logLevel: 'none' });

const modules = runtime.listModules();
assert(modules.length === 3, 'Runtime has 3 modules');
assert(modules.every(m => m.compiled), 'All modules compiled');

const l1Info = runtime.getModuleInfo('L1');
assert(l1Info !== undefined, 'L1 info available');
assert(l1Info!.module.name === 'execution-engine', 'L1 module name');
assert(l1Info!.memoryUsed === 131072, 'L1 memory: 2 pages * 64KB = 131072 bytes');
assert(l1Info!.calls === 0, 'L1 starts with 0 calls');

section('WASMRuntime — WASM Calls');

const result = runtime.callWasm('L1', 'execute_sequential', [10]);
assert(result.result === 10, 'execute_sequential returns node count');
assert(result.timeNs > 0, 'Execution time > 0');

const parallelResult = runtime.callWasm('L1', 'execute_parallel', [10]);
assert(parallelResult.result === 8, 'execute_parallel caps at 8');

const sortResult = runtime.callWasm('L3', 'topological_sort', [50]);
assert(sortResult.result === 50, 'topological_sort returns node count');

const fwdResult = runtime.callWasm('L7', 'forward_pass', [64, 128]);
assert(fwdResult.result === 8192, 'forward_pass: 64 * 128 = 8192');

const trainResult = runtime.callWasm('L7', 'train_step', [64, 128, 0.5]);
assert(typeof trainResult.result === 'number', 'train_step returns loss');

section('WASMRuntime — Error Handling');

try {
  runtime.callWasm('L99', 'fn', []);
  assert(false, 'Should throw for unknown module');
} catch (e: any) {
  assert(e.message.includes('L99'), 'Throws for unknown module');
}

try {
  runtime.callWasm('L1', 'nonexistent_fn', []);
  assert(false, 'Should throw for unknown function');
} catch (e: any) {
  assert(e.message.includes('nonexistent'), 'Throws for unknown function');
}

section('WASMRuntime — JS Calls');

const jsResult = runtime.callJs('L1', 'execute_sequential', [10]);
assert(jsResult.result === 10, 'JS call returns same result');
assert(jsResult.timeNs > result.timeNs, 'JS call is slower than WASM');

section('WASMRuntime — Single Benchmark');

const bench = runtime.runBenchmark('L1', 'execute_sequential', 100, [10]);
assert(bench.name === 'L1/execute_sequential', 'Benchmark name correct');
assert(bench.wasmNs > 0, 'WASM time > 0');
assert(bench.jsNs > bench.wasmNs, 'JS time > WASM time');
assert(bench.speedup > 1, 'Speedup > 1x');

section('WASMRuntime — Full Benchmark Suite');

const benchmarks = runtime.runFullBenchmark();
assert(benchmarks.length === 3, '3 benchmark results');
assert(benchmarks[0].module === 'L1', 'First benchmark is L1');
assert(benchmarks[1].module === 'L3', 'Second benchmark is L3');
assert(benchmarks[2].module === 'L7', 'Third benchmark is L7');

for (const b of benchmarks) {
  assert(b.operations.length > 0, `${b.module} has operations`);
  assert(b.averageSpeedup > 1, `${b.module} average speedup > 1x`);
  for (const op of b.operations) {
    assert(op.wasmNs > 0, `${op.name} wasm time > 0`);
    assert(op.jsNs > op.wasmNs, `${op.name} JS slower than WASM`);
  }
}

section('WASMRuntime — Stats');

const stats = runtime.getStats();
assert(stats.config.useWasm === true, 'Config preserved');
assert(stats.modules === 3, '3 modules tracked');
assert(stats.totalCalls > 0, 'Calls tracked');
assert(stats.totalWasmTime > 0, 'WASM time tracked');
assert(stats.totalJsTime > 0, 'JS time tracked');
assert(stats.memoryUsage === 14 * 65536, 'Memory usage: 14 pages * 64KB');
// L1=2, L3=4, L7=8 = 14 pages

section('WASMRuntime — Update Config');

runtime.updateConfig({ useWasm: false, logLevel: 'verbose' });
const updated = runtime.getStats();
assert(updated.config.useWasm === false, 'Config updated');
assert(updated.config.logLevel === 'verbose', 'Log level updated');

// =============================================
// T-13.2: WASM SDK Bindings
// =============================================

section('WASMSDK — JS/TS Binding');

const sdk = new WASMSDK(runtime);

const jsBinding = sdk.generateJSBinding('L1');
assert(jsBinding.includes('execute_sequential'), 'JS binding has execute_sequential');
assert(jsBinding.includes('execute_parallel'), 'JS binding has execute_parallel');
assert(jsBinding.includes('WebAssembly.instantiate'), 'JS binding uses WebAssembly.instantiate');
assert(jsBinding.includes('TextDecoder'), 'JS binding has TextDecoder helper');
assert(jsBinding.includes('writeString'), 'JS binding has writeString helper');

const l3Binding = sdk.generateJSBinding('L3');
assert(l3Binding.includes('dependency_resolver'), 'L3 binding name correct');
assert(l3Binding.includes('topological_sort'), 'L3 binding includes topological_sort');

const l7Binding = sdk.generateJSBinding('L7');
assert(l7Binding.includes('compute_engine'), 'L7 binding name correct');
assert(l7Binding.includes('forward_pass'), 'L7 binding includes forward_pass');

section('WASMSDK — Python Binding');

const pyBinding = sdk.generatePythonBinding('L1');
assert(pyBinding.includes('ctypes'), 'Python binding uses ctypes');
assert(pyBinding.includes('execute_sequential'), 'Python binding has execute_sequential');
assert(pyBinding.includes('class'), 'Python binding has class definition');

const pyL3 = sdk.generatePythonBinding('L3');
assert(pyL3.includes('resolve'), 'Python L3 binding has resolve');

section('WASMSDK — Rust Binding');

const rustBinding = sdk.generateRustBinding('L1');
assert(rustBinding.includes('wasm_bindgen'), 'Rust binding uses wasm_bindgen');
assert(rustBinding.includes('execute_sequential'), 'Rust binding has execute_sequential');
assert(rustBinding.includes('pub struct'), 'Rust binding has struct');

section('WASMSDK — All Bindings');

const allBindings = sdk.generateAllBindings('L1');
assert(allBindings.length === 3, '3 language bindings for L1');
assert(allBindings[0].language === 'TypeScript', 'First is TypeScript');
assert(allBindings[1].language === 'Python', 'Second is Python');
assert(allBindings[2].language === 'Rust', 'Third is Rust');
assert(allBindings.every(b => b.code.length > 50), 'All bindings have code');

// =============================================
// T-13.3: Benchmarks
// =============================================

section('WASM vs JS — Performance Comparison');

// Create a fresh runtime for clean benchmarks
const perfRuntime = new WASMRuntime();
const perfBench = perfRuntime.runFullBenchmark();

for (const b of perfBench) {
  console.log(`  ${b.module}: average ${b.averageSpeedup}x speedup`);
  for (const op of b.operations) {
    console.log(`    ${op.name}: WASM=${op.wasmNs}ns, JS=${op.jsNs}ns, ${op.speedup}x`);
  }
}

// Verify speedup magnitudes
for (const b of perfBench) {
  assert(b.averageSpeedup >= 5, `${b.module} average speedup >= 5x`);
  assert(b.averageSpeedup <= 20, `${b.module} average speedup <= 20x`);
}

section('WASM — Singleton');

assert(wasmRuntime !== undefined, 'wasmRuntime singleton exists');
assert(wasmSDK !== undefined, 'wasmSDK singleton exists');
assert(wasmRuntime.listModules().length === 3, 'Singleton has 3 modules');

// =============================================
// Summary
// =============================================

section('Summary');
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });