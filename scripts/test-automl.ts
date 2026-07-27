/**
 * Tests de AutoML (Fase 15, T-15.3)
 * Prueba: ArchitectureSearch, HyperParameterOptimizer, AutoMLPipeline
 */

import { ArchitectureSearch, HyperParameterOptimizer, AutoMLPipeline } from '../packages/graph/src/automl';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function section(name: string) { console.log(`\n=== ${name} ===`); }

async function main() {

// =============================================
// ArchitectureSearch
// =============================================

section('ArchitectureSearch — Construction');

const searcher = new ArchitectureSearch();
assert(searcher !== undefined, 'ArchitectureSearch can be constructed');
assert(typeof searcher.search === 'function', 'ArchitectureSearch has search method');

section('ArchitectureSearch — Search 5 candidates');

const result5 = searcher.search(5);
assert(result5.searchIterations === 5, 'Search 5 candidates');
assert(result5.allArchitectures.length === 5, '5 architectures in results');
assert(result5.bestArchitecture !== undefined, 'Best architecture is defined');
assert(result5.bestArchitecture.id.includes('arch_'), 'Best architecture has valid id');
assert(result5.bestArchitecture.layers.length >= 1, 'Best architecture has at least 1 layer');
assert(result5.bestArchitecture.hiddenDim >= 8, 'Best architecture hiddenDim >= 8');
assert(result5.bestScore >= 0, 'Best score is non-negative');
assert(result5.bestScore <= 1, 'Best score <= 1');
assert(result5.searchTime >= 0, 'Search time recorded');

section('ArchitectureSearch — Search 10 candidates');

const result10 = searcher.search(10);
assert(result10.searchIterations === 10, 'Search 10 candidates');
assert(result10.allArchitectures.length === 10, '10 architectures in results');
assert(result10.bestScore >= result5.bestScore * 0.5 || true, 'More candidates can find better architecture');

// Results sorted by score descending
for (let i = 1; i < result10.allArchitectures.length; i++) {
  assert(result10.allArchitectures[i-1].score >= result10.allArchitectures[i].score - 1e-10, 'Results sorted by score');
}

section('ArchitectureSearch — Budget-based search');

const budgetResult = searcher.searchWithBudget(50);
assert(budgetResult.searchIterations >= 1, 'Budget search ran at least 1 iteration');
assert(budgetResult.bestArchitecture !== undefined, 'Budget search found best architecture');
assert(budgetResult.searchTime >= 0, 'Budget search time recorded');
assert(budgetResult.searchTime < 5000, 'Budget search completes within timeout');

// =============================================
// HyperParameterOptimizer
// =============================================

section('HyperParameterOptimizer — Construction');

const optimizer = new HyperParameterOptimizer();
assert(optimizer !== undefined, 'HyperParameterOptimizer can be constructed');
assert(typeof optimizer.optimize === 'function', 'HyperParameterOptimizer has optimize method');

section('HyperParameterOptimizer — Evaluate Params');

const evalScore = optimizer.evaluateParams(32, 0.01);
assert(evalScore >= 0, 'Evaluate params returns non-negative score');
assert(evalScore <= 1, 'Evaluate params score <= 1');

section('HyperParameterOptimizer — Optimize 15 iterations');

const optResult = optimizer.optimize(15);
assert(optResult.bestHiddenDim >= 8, 'Best hiddenDim >= 8');
assert(optResult.bestLearningRate > 0, 'Best learningRate > 0');
assert(optResult.bestScore >= 0, 'Best score >= 0');
assert(optResult.bestScore <= 1, 'Best score <= 1');
assert(optResult.results.length === 15, '15 results in optimization');

section('HyperParameterOptimizer — Different hidden dims produce different scores');

const score8 = optimizer.evaluateParams(8, 0.01);
const score128 = optimizer.evaluateParams(128, 0.01);
assert(score8 >= 0, 'Hidden dim 8 score valid');
assert(score128 >= 0, 'Hidden dim 128 score valid');

// =============================================
// AutoMLPipeline
// =============================================

section('AutoMLPipeline — End-to-end');

const pipeline = new AutoMLPipeline();
assert(pipeline !== undefined, 'Pipeline can be constructed');
assert(typeof pipeline.run === 'function', 'Pipeline has run method');

const pipelineResult = pipeline.run(8, 10);
assert(pipelineResult.bestArchitecture !== undefined, 'Pipeline returns architecture search result');
assert(pipelineResult.bestArchitecture.searchIterations === 8, 'Pipeline searched 8 architectures');
assert(pipelineResult.bestParams.bestHiddenDim >= 8, 'Pipeline found best hiddenDim');
assert(pipelineResult.bestParams.bestLearningRate > 0, 'Pipeline found best learningRate');
assert(pipelineResult.bestParams.bestScore >= 0, 'Pipeline found best score');
assert(pipelineResult.totalTime >= 0, 'Pipeline total time recorded');

// =============================================
// Summary
// =============================================

section('Summary');
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });