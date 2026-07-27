import { EntityId, CellContext, Confidence, Cost } from '@cos/core';
import { generateId } from '@cos/core';
import { ReflectionEngine } from './reasoning';

export interface EvaluationResult {
  id: EntityId;
  subject: string;
  scores: Record<string, number>;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  confidence: Confidence;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export class EvaluationSystem {
  private evaluations: Map<EntityId, EvaluationResult> = new Map();
  private reflectionEngine: ReflectionEngine;

  constructor() {
    this.reflectionEngine = new ReflectionEngine();
  }

  async evaluate(
    subject: string,
    input: unknown,
    criteria: string[] = ['accuracy', 'completeness', 'coherence', 'relevance', 'novelty'],
    context?: CellContext,
  ): Promise<EvaluationResult> {
    const ctx = context || { traceId: 'eval' };
    const scores: Record<string, number> = {};
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const suggestions: string[] = [];

    // Use reflection engine for each criterion
    for (const criterion of criteria) {
      const steps = await this.reflectionEngine.reason(
        { previousOutput: JSON.stringify(input), critiqueAspects: [criterion] },
        ctx,
      );

      const lastStep = steps[steps.length - 1];
      const score = lastStep?.confidence || 0.5;

      scores[criterion] = score;

      if (score >= 0.7) strengths.push(`${criterion}: good (${(score * 100).toFixed(0)}/100)`);
      else if (score >= 0.5) strengths.push(`${criterion}: acceptable (${(score * 100).toFixed(0)}/100)`);
      else weaknesses.push(`${criterion}: needs improvement (${(score * 100).toFixed(0)}/100)`);
    }

    // Calculate overall
    const overallScore = criteria.length > 0
      ? Object.values(scores).reduce((a, b) => a + b, 0) / criteria.length
      : 0.5;

    // Generate suggestions
    if (weaknesses.length > 0) {
      suggestions.push(`Address: ${weaknesses.join('; ')}`);
    }
    suggestions.push(`Overall score: ${(overallScore * 100).toFixed(0)}/100`);

    const result: EvaluationResult = {
      id: generateId(),
      subject,
      scores,
      overallScore,
      strengths,
      weaknesses,
      suggestions,
      confidence: overallScore,
      timestamp: new Date().toISOString(),
      metadata: { criteria },
    };

    this.evaluations.set(result.id, result);
    return result;
  }

  async getResult(id: EntityId): Promise<EvaluationResult | null> {
    return this.evaluations.get(id) || null;
  }

  async getHistory(limit: number = 20): Promise<EvaluationResult[]> {
    return Array.from(this.evaluations.values())
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }
}