#!/usr/bin/env npx tsx
"use strict";
/**
 * WASM Integration Test — COS Graph Engine v2.1
 *
 * Prueba la compilacion, carga y ejecucion de los modulos WASM.
 * Compara resultados con el fallback JS para asegurar consistencia.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const loader_1 = require("../packages/wasm/src/loader");
let passed = 0;
let failed = 0;
const errors = [];
function assert(cond, msg) {
    if (cond) {
        passed++;
    }
    else {
        failed++;
        errors.push(msg);
        console.log(`  FAIL: ${msg}`);
    }
}
function section(name) {
    console.log(`\n=== ${name} ===`);
}
// =============================================
// Test 1: WASM compilation
// =============================================
section('WASM Compilation');
{
    const wasmPath = path.resolve(__dirname, '../packages/wasm/build/optimized.wasm');
    assert(fs.existsSync(wasmPath), 'WASM file exists');
    const buffer = fs.readFileSync(wasmPath);
    assert(buffer.byteLength > 0, 'WASM buffer non-empty');
    let module;
    try {
        module = new WebAssembly.Module(buffer);
        assert(true, 'WASM module compiles');
    }
    catch (e) {
        assert(false, `WASM module compilation: ${e}`);
    }
}
// =============================================
// Test 2: WASM exports
// =============================================
section('WASM Exports');
{
    const wasmPath = path.resolve(__dirname, '../packages/wasm/build/optimized.wasm');
    const buffer = fs.readFileSync(wasmPath);
    const module = new WebAssembly.Module(buffer);
    const exports = WebAssembly.Module.exports(module);
    const exportNames = exports.map(e => e.name);
    assert(exportNames.includes('bfs'), 'Export: bfs');
    assert(exportNames.includes('setOutputBuffer'), 'Export: setOutputBuffer');
    assert(exportNames.includes('pageRank'), 'Export: pageRank');
    assert(exportNames.includes('shortestPath'), 'Export: shortestPath');
    assert(exportNames.includes('betweenness'), 'Export: betweenness');
}
// =============================================
// Test 3: JS Fallback — BFS chain 100
// =============================================
section('JS Fallback — BFS');
{
    const js = (0, loader_1.createJSFallback)();
    const n = 100;
    const indptr = new Int32Array(n + 1);
    const indices = new Int32Array(n - 1);
    for (let i = 0; i < n; i++)
        indptr[i] = i;
    indptr[n] = n - 1;
    for (let i = 0; i < n - 1; i++)
        indices[i] = i + 1;
    const result = js.bfs(indptr, indices, 0);
    assert(result.length === n, `JS BFS chain: visited ${result.length} nodes`);
    assert(result[0] === 0, 'JS BFS chain: first node is 0');
    assert(result[n - 1] === n - 1, `JS BFS chain: last node is ${n - 1}`);
}
// =============================================
// Test 4: JS Fallback — shortestPath
// =============================================
section('JS Fallback — Shortest Path');
{
    const js = (0, loader_1.createJSFallback)();
    const n = 100;
    const indptr = new Int32Array(n + 1);
    const indices = new Int32Array(n - 1);
    for (let i = 0; i < n; i++)
        indptr[i] = i;
    indptr[n] = n - 1;
    for (let i = 0; i < n - 1; i++)
        indices[i] = i + 1;
    const result = js.shortestPath(indptr, indices, 0, 50);
    assert(result[0] === 1, 'JS shortestPath: path found');
    assert(result[1] === 50, `JS shortestPath: distance = ${result[1]}`);
}
// =============================================
// Test 5: JS Fallback — no path
// =============================================
section('JS Fallback — No Path');
{
    const js = (0, loader_1.createJSFallback)();
    const n = 5;
    const indptr = new Int32Array([0, 1, 2, 3, 3, 3]);
    const indices = new Int32Array([1, 2, 3]); // 0→1, 1→2, 2→3 only
    const result = js.shortestPath(indptr, indices, 0, 4);
    assert(result[0] === 0, 'JS shortestPath: no path found');
    assert(result[1] === -1, 'JS shortestPath: distance = -1');
}
// =============================================
// Test 6: WASM — BFS chain 100 vs JS
// =============================================
section('WASM BFS vs JS Fallback');
{
    const wasmPath = path.resolve(__dirname, '../packages/wasm/build/optimized.wasm');
    const buffer = fs.readFileSync(wasmPath);
    const wasm = (0, loader_1.createWASMModule)(buffer);
    const js = (0, loader_1.createJSFallback)();
    const n = 100;
    const indptr = new Int32Array(n + 1);
    const indices = new Int32Array(n - 1);
    for (let i = 0; i < n; i++)
        indptr[i] = i;
    indptr[n] = n - 1;
    for (let i = 0; i < n - 1; i++)
        indices[i] = i + 1;
    const wasmResult = wasm.bfs(indptr, indices, 0);
    const jsResult = js.bfs(indptr, indices, 0);
    assert(wasmResult.length === jsResult.length, 'WASM BFS: same length as JS');
    for (let i = 0; i < Math.min(wasmResult.length, jsResult.length); i++) {
        if (wasmResult[i] !== jsResult[i]) {
            assert(false, `WASM BFS: mismatch at index ${i}: WASM=${wasmResult[i]} JS=${jsResult[i]}`);
            break;
        }
    }
    if (wasmResult.length === jsResult.length) {
        assert(true, 'WASM BFS: all values match JS');
    }
}
// =============================================
// Test 7: WASM — PageRank
// =============================================
section('WASM PageRank vs JS Fallback');
{
    const wasmPath = path.resolve(__dirname, '../packages/wasm/build/optimized.wasm');
    const buffer = fs.readFileSync(wasmPath);
    const wasm = (0, loader_1.createWASMModule)(buffer);
    const js = (0, loader_1.createJSFallback)();
    const n = 10;
    const indptr = new Int32Array(n + 1);
    const indices = new Int32Array(n - 1);
    for (let i = 0; i < n; i++)
        indptr[i] = i;
    indptr[n] = n - 1;
    for (let i = 0; i < n - 1; i++)
        indices[i] = i + 1;
    const wasmResult = wasm.pageRank(indptr, indices, 0.85, 20);
    const jsResult = js.pageRank(indptr, indices, 0.85, 20);
    assert(wasmResult.length === jsResult.length, 'WASM PageRank: same length as JS');
    let match = true;
    for (let i = 0; i < wasmResult.length; i++) {
        if (Math.abs(wasmResult[i] - jsResult[i]) > 0.01) {
            match = false;
            break;
        }
    }
    assert(match, 'WASM PageRank: values match JS within 0.01');
}
// =============================================
// Test 8: WASM — Shortest Path
// =============================================
section('WASM Shortest Path vs JS Fallback');
{
    const wasmPath = path.resolve(__dirname, '../packages/wasm/build/optimized.wasm');
    const buffer = fs.readFileSync(wasmPath);
    const wasm = (0, loader_1.createWASMModule)(buffer);
    const js = (0, loader_1.createJSFallback)();
    const n = 100;
    const indptr = new Int32Array(n + 1);
    const indices = new Int32Array(n - 1);
    for (let i = 0; i < n; i++)
        indptr[i] = i;
    indptr[n] = n - 1;
    for (let i = 0; i < n - 1; i++)
        indices[i] = i + 1;
    const wasmResult = wasm.shortestPath(indptr, indices, 0, 50);
    const jsResult = js.shortestPath(indptr, indices, 0, 50);
    assert(wasmResult[0] === jsResult[0], 'WASM shortestPath: found flag matches');
    assert(wasmResult[1] === jsResult[1], `WASM shortestPath: distance matches (WASM=${wasmResult[1]} JS=${jsResult[1]})`);
}
// =============================================
// Test 9: WASM — Betweenness Centrality
// =============================================
section('WASM Betweenness vs JS Fallback');
{
    const wasmPath = path.resolve(__dirname, '../packages/wasm/build/optimized.wasm');
    const buffer = fs.readFileSync(wasmPath);
    const wasm = (0, loader_1.createWASMModule)(buffer);
    const js = (0, loader_1.createJSFallback)();
    // Chain graph: betweenness should be 0 for all nodes (no shortest paths go through any node)
    const n = 20;
    const indptr = new Int32Array(n + 1);
    const indices = new Int32Array(n - 1);
    for (let i = 0; i < n; i++)
        indptr[i] = i;
    indptr[n] = n - 1;
    for (let i = 0; i < n - 1; i++)
        indices[i] = i + 1;
    const wasmResult = wasm.betweenness(indptr, indices);
    const jsResult = js.betweenness(indptr, indices);
    assert(wasmResult.length === jsResult.length, 'WASM betweenness: same length as JS');
    let match = true;
    for (let i = 0; i < wasmResult.length; i++) {
        if (Math.abs(wasmResult[i] - jsResult[i]) > 0.01) {
            match = false;
            break;
        }
    }
    assert(match, 'WASM betweenness: values match JS within 0.01');
}
// =============================================
// Summary
// =============================================
console.log(`\n=== Summary ===`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (errors.length > 0) {
    console.log('\nErrors:');
    for (const err of errors)
        console.log(`  - ${err}`);
}
process.exit(failed > 0 ? 1 : 0);
//# sourceMappingURL=test-wasm.js.map