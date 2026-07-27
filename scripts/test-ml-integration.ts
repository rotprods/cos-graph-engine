/**
 * Tests de ML Integration (Fase 15, T-15.1)
 * Prueba: EmbeddingClassifier, GraphRAGNeuralReRanker, MLPipeline
 */

import { EmbeddingGraph } from '../packages/graph/src/level10-embedding';
import { GraphRAGEngine } from '../packages/graph/src/level11-graphrag';
import { EmbeddingClassifier, GraphRAGNeuralReRanker, MLPipeline } from '../packages/graph/src/ml-integration';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function section(name: string) { console.log(`\n=== ${name} ===`); }

async function main() {

// =============================================
// EmbeddingClassifier
// =============================================

section('EmbeddingClassifier — Construction');

const classifier = new EmbeddingClassifier(['cat', 'dog']);
assert(classifier !== undefined, 'Classifier can be constructed');
assert(typeof classifier.classify === 'function', 'Classifier has classify method');
assert(typeof classifier.trainStep === 'function', 'Classifier has trainStep method');

section('EmbeddingClassifier — Vector Classification');

const result = classifier.classifyVector([0.5, 0.3, 0.8, 0.1], 'test');
assert(result.classId >= 0, 'Classification returns valid classId');
assert(result.classId <= 1, 'Classification classId in range');
assert(result.confidence >= 0, 'Confidence is non-negative');
assert(result.confidence <= 1, 'Confidence <= 1');
assert(result.probabilities.length === 2, 'Two probabilities (2 classes)');
assert(result.probabilities.reduce((a, b) => a + b, 0) > 0.99, 'Probabilities sum to ~1');
assert(result.loss >= 0, 'Loss is non-negative');
assert(result.loss < 100, 'Loss is reasonable');

section('EmbeddingClassifier — Different Inputs');

const resultHigh = classifier.classifyVector([0.9, 0.9, 0.9, 0.9], 'high');
assert(resultHigh.confidence > 0, 'High input has confidence');

const resultLow = classifier.classifyVector([0.1, 0.1, 0.1, 0.1], 'low');
assert(resultLow.confidence > 0, 'Low input has confidence');

section('EmbeddingClassifier — Integration with L10 EmbeddingGraph');

const embed = new EmbeddingGraph();
embed.addNode({ id: 'v1', label: 'Vec1', vector: [0.8, 0.7, 0.9, 0.6] });
embed.addNode({ id: 'v2', label: 'Vec2', vector: [0.2, 0.3, 0.1, 0.4] });
embed.addNode({ id: 'v3', label: 'Vec3', vector: [0.5, 0.5, 0.5, 0.5] });

const classResult1 = classifier.classify(embed, 'v1');
assert(classResult1.classId >= 0, 'Classify via graph returns classId');
assert(classResult1.confidence > 0, 'Classify via graph has confidence');

const classResult2 = classifier.classify(embed, 'v2');
assert(classResult2.classId >= 0, 'Classify v2 returns classId');

section('EmbeddingClassifier — classifyAll');

const allResults = classifier.classifyAll(embed);
assert(allResults.length === 3, 'classifyAll returns 3 results');
assert(allResults[0].confidence > 0, 'First result has confidence');
assert(allResults[1].confidence > 0, 'Second result has confidence');
assert(allResults[2].confidence > 0, 'Third result has confidence');

section('EmbeddingClassifier — trainStep');

const trainResult = classifier.trainStep([0.6, 0.4, 0.7, 0.3], 0);
assert(trainResult.loss >= 0, 'Train step returns loss');
assert(trainResult.loss < 100, 'Train step loss is reasonable');
assert(typeof trainResult.gradients === 'object', 'Train step returns gradients object');
assert(Object.keys(trainResult.gradients).length > 0, 'Train step has gradients');

section('EmbeddingClassifier — Error Handling');

try {
  classifier.classify(embed, 'nonexistent');
  assert(false, 'Should throw on missing node');
} catch (e: any) {
  assert(e.message.includes('not found'), 'Throws with descriptive message');
}

// =============================================
// GraphRAGNeuralReRanker
// =============================================

section('GraphRAGNeuralReRanker — Construction');

const reRanker = new GraphRAGNeuralReRanker(0.5);
assert(reRanker !== undefined, 'ReRanker can be constructed');
assert(typeof reRanker.reRank === 'function', 'ReRanker has reRank method');

section('GraphRAGNeuralReRanker — Re-rank Results');

const rag = new GraphRAGEngine();
rag.buildDemo();

const queryEmbedding = [0.15, 0.25, 0.2];
const reRanked = reRanker.reRank(rag, queryEmbedding, ['cos', 'memory']);

assert(reRanked.length >= 1, 'Re-rank returns at least 1 chunk');
assert(reRanked.length <= 3, 'Re-rank returns at most 3 chunks');
assert(reRanked[0].originalScore !== undefined, 'First result has originalScore');
assert(reRanked[0].neuralScore !== undefined, 'First result has neuralScore');
assert(reRanked[0].combinedScore !== undefined, 'First result has combinedScore');
assert(reRanked[0].chunk !== undefined, 'First result has chunk');

// Scores should be sorted descending
for (let i = 1; i < reRanked.length; i++) {
  assert(reRanked[i - 1].combinedScore >= reRanked[i].combinedScore - 1e-10, 'Results sorted by combinedScore descending');
}

section('GraphRAGNeuralReRanker — answerWithReRank');

const answer = await reRanker.answerWithReRank(rag, 'What is COS?', queryEmbedding, ['cos']);
assert(answer.chunks.length >= 1, 'Answer has chunks');
assert(answer.reRanked.length >= 1, 'Answer has reRanked');
assert(answer.entities.length >= 1, 'Answer has entities');
assert(answer.confidence >= 0, 'Answer has confidence');
assert(answer.trace.length >= 2, 'Answer has trace with re-rank step');
assert(answer.trace.some(t => t.includes('Neural re-rank')), 'Trace mentions neural re-rank');

// =============================================
// MLPipeline
// =============================================

section('MLPipeline — Construction');

const pipeline = new MLPipeline(['relevant', 'irrelevant']);
assert(pipeline !== undefined, 'Pipeline can be constructed');
assert(typeof pipeline.run === 'function', 'Pipeline has run method');

section('MLPipeline — End-to-end Run');

const pipelineResult = await pipeline.run(embed, rag, 'Test query', queryEmbedding, ['cos']);
assert(pipelineResult.classifications.length === 3, 'Pipeline returns 3 classifications');
assert(pipelineResult.reRanked.length >= 1, 'Pipeline returns re-ranked results');
assert(pipelineResult.totalLoss >= 0, 'Pipeline total loss is non-negative');
assert(pipelineResult.pipelineLatency >= 0, 'Pipeline latency recorded');
assert(pipelineResult.pipelineLatency < 30000, 'Pipeline completes in reasonable time');

// =============================================
// Summary
// =============================================

section('Summary');
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });