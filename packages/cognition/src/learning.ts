import { EntityId, CellContext, Confidence } from '@cos/core';
import { generateId } from '@cos/core';
import { EvaluationResult } from './evaluation';

export interface LearningExample {
  id: EntityId;
  input: unknown;
  output: unknown;
  expectedOutput?: unknown;
  confidence: Confidence;
  timestamp: string;
  feedback?: { score: number; notes: string };
  applied: boolean;
}

export class LearningSystem {
  private examples: Map<EntityId, LearningExample> = new Map();
  private patterns: Map<string, { pattern: string; confidence: number; examples: number }> = new Map();

  async recordExample(
    input: unknown,
    output: unknown,
    expectedOutput?: unknown,
    confidence: Confidence = 0.5,
  ): Promise<EntityId> {
    const id = generateId();
    const example: LearningExample = {
      id, input, output, expectedOutput,
      confidence, timestamp: new Date().toISOString(),
      applied: false,
    };

    this.examples.set(id, example);
    return id;
  }

  async addFeedback(exampleId: EntityId, score: number, notes: string): Promise<void> {
    const example = this.examples.get(exampleId);
    if (!example) return;

    example.feedback = { score, notes };
    example.applied = true;

    // Extract pattern
    const inputStr = JSON.stringify(example.input);
    const pattern = this.extractPattern(inputStr, notes);
    if (pattern) {
      const existing = this.patterns.get(pattern) || { pattern, confidence: 0, examples: 0 };
      existing.confidence = (existing.confidence * existing.examples + score) / (existing.examples + 1);
      existing.examples += 1;
      this.patterns.set(pattern, existing);
    }
  }

  async getPatterns(threshold: number = 0.5): Promise<Array<{ pattern: string; confidence: number; examples: number }>> {
    return Array.from(this.patterns.values())
      .filter(p => p.confidence >= threshold)
      .sort((a, b) => b.confidence - a.confidence);
  }

  async getRecentExamples(limit: number = 10): Promise<LearningExample[]> {
    return Array.from(this.examples.values())
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  async applyFeedbackToEvaluation(evalResult: EvaluationResult): Promise<string[]> {
    const improvements: string[] = [];

    // Extract improvement patterns from evaluation
    for (const weakness of evalResult.weaknesses) {
      const pattern = `improve:${weakness.split(':')[0]}`;
      improvements.push(pattern);
    }

    return improvements;
  }

  get stats() {
    return {
      totalExamples: this.examples.size,
      totalPatterns: this.patterns.size,
      appliedExamples: Array.from(this.examples.values()).filter(e => e.applied).length,
    };
  }

  private extractPattern(input: string, feedback: string): string | null {
    // Simple pattern extraction - in production this would use NLP
    if (feedback.length < 10) return null;
    const words = feedback.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    if (words.length === 0) return null;
    return `pattern:${words.slice(0, 3).join('_')}`;
  }
}