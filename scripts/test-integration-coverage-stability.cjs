const assert = require('node:assert/strict');

async function main() {
  const { EvaluationSystem } = await import('../packages/cognition/src/evaluation.ts');
  const { SelfImprovementSystem } = await import('../packages/cognition/src/self-improvement.ts');

  const evaluation = new EvaluationSystem();
  evaluation.reflectionEngine = {
    async reason() {
      return [{ confidence: 0.2 }];
    },
  };

  const weak = await evaluation.evaluate(
    'integration-coverage-low-confidence',
    { output: 'deliberately weak' },
    ['accuracy'],
    { traceId: 'w3.1-coverage-evaluation-low' },
  );
  assert.equal(weak.overallScore, 0.2);
  assert.equal(weak.weaknesses.length, 1);
  assert.equal(weak.strengths.length, 0);
  assert.ok(weak.suggestions.some(value => value.startsWith('Address:')));

  const emptyCriteria = await evaluation.evaluate(
    'integration-coverage-empty-criteria',
    null,
    [],
    { traceId: 'w3.1-coverage-evaluation-empty' },
  );
  assert.equal(emptyCriteria.overallScore, 0.5);
  assert.equal((await evaluation.getResult('missing-integration-id')), null);
  assert.ok((await evaluation.getHistory(2)).length >= 2);

  let patterns = [];
  const learning = {
    async getPatterns() {
      return patterns;
    },
  };

  const selfImprovement = new SelfImprovementSystem(
    evaluation,
    learning,
    {},
    { minExamplesForPatterns: 1 },
  );

  const base = {
    id: 'eval-integration',
    subject: 'integration',
    scores: { accuracy: 0.5 },
    strengths: [],
    suggestions: [],
    confidence: 0.5,
    timestamp: new Date(0).toISOString(),
    metadata: {},
  };

  selfImprovement.evaluationHistory = [
    { ...base, id: 'eval-a', overallScore: 0.9, weaknesses: ['accuracy: regression'] },
    { ...base, id: 'eval-b', overallScore: 0.8, weaknesses: ['accuracy: regression'] },
    { ...base, id: 'eval-c', overallScore: 0.2, weaknesses: ['accuracy: regression'] },
    { ...base, id: 'eval-d', overallScore: 0.1, weaknesses: ['accuracy: regression'] },
  ];

  const declining = await selfImprovement.runMetaCognition(true);
  assert.equal(declining.totalEvaluations, 4);
  assert.equal(declining.scoreTrend, 'declining');
  assert.ok(declining.suggestions.some(value => value.startsWith('Performance declining')));
  assert.ok(declining.suggestions.some(value => value.includes('Weakness "accuracy"')));
  assert.ok(declining.suggestions.some(value => value.startsWith('No learning patterns yet')));
  assert.ok(declining.recommendedActions.some(action => action.type === 'adjust_reasoning'));
  assert.ok(declining.recommendedActions.some(action => action.type === 'retrain_patterns'));

  patterns = [{ pattern: 'accuracy-quality', confidence: 0.9, examples: 12 }];
  const withPatterns = await selfImprovement.runMetaCognition(true);
  assert.equal(withPatterns.topPatterns.length, 1);
  assert.ok(withPatterns.suggestions.some(value => value.includes('patterns active')));

  const recommendation = await selfImprovement.recommendEngine({ task: 'integration' });
  assert.ok(['chain_of_thought', 'tree_of_thoughts', 'reflection'].includes(recommendation.engine));
  assert.ok(recommendation.confidence >= 0.5);

  process.stdout.write(`${JSON.stringify({
    suite: 'integration-coverage-stability',
    evaluationWeakness: weak.weaknesses[0],
    emptyCriteriaScore: emptyCriteria.overallScore,
    trend: declining.scoreTrend,
    recommendedActions: declining.recommendedActions.map(action => action.type),
    activePatterns: withPatterns.topPatterns.length,
    result: 'PASS',
  }, null, 2)}\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
