import { EntityId, CellContext, Confidence, Cost, Timestamp, ReasoningEngineType } from '@cos/core';
import { generateId } from '@cos/core';
import { ReasoningEngineRegistry } from './reasoning';
import { EvaluationSystem, EvaluationResult } from './evaluation';
import { LearningSystem } from './learning';

// ================================================================
// PHASE 6: SELF-IMPROVEMENT SYSTEM
// Architecture: Evaluation → Learning → Pattern → Reasoning Influence → Meta-Cognition
// ================================================================

export interface SelfImprovementConfig {
  evaluationFrequency: number;
  consolidationThreshold: number;
  metaCognitionInterval: number;
  minExamplesForPatterns: number;
  maxPatternAge: number;
}

export interface PerformanceReport {
  id: EntityId;
  timestamp: Timestamp;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  totalEvaluations: number;
  averageScore: number;
  scoreTrend: 'improving' | 'stable' | 'declining';
  topPatterns: Array<{ pattern: string; confidence: number; examples: number }>;
  weaknesses: string[];
  suggestions: string[];
  recommendedActions: ImprovementAction[];
}

export interface ImprovementAction {
  type: 'adjust_reasoning' | 'change_engine' | 'retrain_patterns' | 'update_config';
  target: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  impact: number;
}

export class SelfImprovementSystem {
  private config: SelfImprovementConfig;
  private evaluationSystem: EvaluationSystem;
  private learningSystem: LearningSystem;
  private reasoningRegistry: ReasoningEngineRegistry;
  private reports: Map<EntityId, PerformanceReport> = new Map();
  private outputHistory: Array<{ input: unknown; output: unknown; timestamp: Timestamp }> = [];
  private evaluationHistory: EvaluationResult[] = [];
  private lastMetaCognition: Timestamp | null = null;
  private metaCognitionTimer: ReturnType<typeof setInterval> | null = null;
  private enginePerformance: Map<ReasoningEngineType, { totalScore: number; count: number }> = new Map();

  constructor(
    evaluationSystem: EvaluationSystem,
    learningSystem: LearningSystem,
    reasoningRegistry: ReasoningEngineRegistry,
    config?: Partial<SelfImprovementConfig>,
  ) {
    this.evaluationSystem = evaluationSystem;
    this.learningSystem = learningSystem;
    this.reasoningRegistry = reasoningRegistry;
    this.config = {
      evaluationFrequency: config?.evaluationFrequency ?? 3,
      consolidationThreshold: config?.consolidationThreshold ?? 0.6,
      metaCognitionInterval: config?.metaCognitionInterval ?? 300,
      minExamplesForPatterns: config?.minExamplesForPatterns ?? 10,
      maxPatternAge: config?.maxPatternAge ?? 86400,
    };
  }

  async recordOutput(input: unknown, output: unknown): Promise<void> {
    this.outputHistory.push({ input, output, timestamp: new Date().toISOString() });
    if (this.outputHistory.length > 1000) this.outputHistory = this.outputHistory.slice(-500);
    if (this.outputHistory.length % this.config.evaluationFrequency === 0) await this.autoEvaluate();
  }

  private async autoEvaluate(): Promise<void> {
    const recent = this.outputHistory.slice(-3);
    for (const entry of recent) {
      const evalResult = await this.evaluationSystem.evaluate(
        'auto-eval',
        entry.output,
        ['accuracy', 'completeness', 'coherence', 'relevance'],
        { traceId: `auto-eval-${Date.now()}` },
      );
      this.evaluationHistory.push(evalResult);
      const exampleId = await this.learningSystem.recordExample(entry.input, entry.output, undefined, evalResult.overallScore);
      const feedbackNotes = [
        ...evalResult.strengths.map(s => `strength:${s}`),
        ...evalResult.weaknesses.map(w => `weakness:${w}`),
      ].join('; ');
      await this.learningSystem.addFeedback(exampleId, evalResult.overallScore, feedbackNotes);
    }
    if (this.evaluationHistory.length > 500) this.evaluationHistory = this.evaluationHistory.slice(-250);
  }

  async recommendEngine(input: unknown): Promise<{
    engine: ReasoningEngineType;
    confidence: Confidence;
    reason: string;
  }> {
    void input;
    const patterns = await this.learningSystem.getPatterns(this.config.consolidationThreshold);
    if (patterns.length < this.config.minExamplesForPatterns) {
      return {
        engine: 'chain_of_thought',
        confidence: 0.5,
        reason: `Default CoT: only ${patterns.length} patterns learned (need ${this.config.minExamplesForPatterns})`,
      };
    }

    const engineScores: Map<ReasoningEngineType, { score: number; reasons: string[] }> = new Map();
    for (const engine of ['chain_of_thought', 'tree_of_thoughts', 'reflection'] as ReasoningEngineType[]) {
      engineScores.set(engine, { score: 0.5, reasons: [] });
    }

    for (const p of patterns) {
      if (p.pattern.includes('accuracy') && p.confidence > 0.7) {
        const current = engineScores.get('chain_of_thought')!;
        current.score += 0.15;
        current.reasons.push(`Pattern "${p.pattern}" (conf:${(p.confidence * 100).toFixed(0)}%) favors CoT`);
      }
      if (p.pattern.includes('complexity') || p.pattern.includes('novelty')) {
        const current = engineScores.get('tree_of_thoughts')!;
        current.score += 0.2;
        current.reasons.push(`Pattern "${p.pattern}" (conf:${(p.confidence * 100).toFixed(0)}%) favors ToT`);
      }
      if (p.pattern.includes('quality') || p.pattern.includes('improve')) {
        const current = engineScores.get('reflection')!;
        current.score += 0.15;
        current.reasons.push(`Pattern "${p.pattern}" (conf:${(p.confidence * 100).toFixed(0)}%) favors Reflection`);
      }
    }

    let bestEngine: ReasoningEngineType = 'chain_of_thought';
    let bestScore = 0;
    let bestReason = '';
    for (const [engine, data] of engineScores) {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestEngine = engine;
        bestReason = data.reasons.join('; ') || `Score: ${(data.score * 100).toFixed(0)}/100`;
      }
    }
    return { engine: bestEngine, confidence: Math.min(bestScore, 0.95), reason: bestReason };
  }

  async runMetaCognition(force: boolean = false): Promise<PerformanceReport> {
    void force;
    const now = new Date().toISOString();
    const periodStart = this.lastMetaCognition || new Date(Date.now() - 86400000).toISOString();
    const periodEnd = now;
    const recentEvals = this.evaluationHistory.slice(-50);
    const totalEvals = recentEvals.length;
    let averageScore = 0;
    const weaknesses = new Map<string, number>();

    for (const evalResult of recentEvals) {
      averageScore += evalResult.overallScore;
      for (const w of evalResult.weaknesses) {
        const key = w.split(':')[0] || w;
        weaknesses.set(key, (weaknesses.get(key) || 0) + 1);
      }
    }
    averageScore = totalEvals > 0 ? averageScore / totalEvals : 0;

    const half = Math.floor(recentEvals.length / 2);
    const firstHalf = recentEvals.slice(0, half);
    const secondHalf = recentEvals.slice(half);
    const firstAvg = firstHalf.reduce((s, e) => s + e.overallScore, 0) / (firstHalf.length || 1);
    const secondAvg = secondHalf.reduce((s, e) => s + e.overallScore, 0) / (secondHalf.length || 1);
    const diff = secondAvg - firstAvg;
    const trend: 'improving' | 'stable' | 'declining' = diff > 0.05 ? 'improving' : diff < -0.05 ? 'declining' : 'stable';

    const patterns = await this.learningSystem.getPatterns(0.5);
    const topPatterns = patterns.slice(0, 5);
    const suggestions: string[] = [];
    const recommendedActions: ImprovementAction[] = [];

    if (trend === 'declining') {
      suggestions.push(`Performance declining (${(diff * 100).toFixed(1)}%). Consider increasing evaluation frequency.`);
      recommendedActions.push({
        type: 'adjust_reasoning',
        target: 'evaluation_frequency',
        reason: `Score declining by ${(Math.abs(diff) * 100).toFixed(0)}%`,
        priority: 'high',
        impact: 0.3,
      });
    }

    const sortedWeaknesses = [...weaknesses.entries()].sort((a, b) => b[1] - a[1]);
    for (const [w, count] of sortedWeaknesses.slice(0, 3)) {
      if (totalEvals > 0 && count > totalEvals * 0.3) {
        suggestions.push(`Weakness "${w}" appears in ${((count / totalEvals) * 100).toFixed(0)}% of evaluations`);
        recommendedActions.push({
          type: 'retrain_patterns',
          target: w,
          reason: `Frequent weakness: ${w}`,
          priority: 'medium',
          impact: 0.4,
        });
      }
    }

    if (patterns.length === 0) {
      suggestions.push('No learning patterns yet. Continue using the system to build pattern database.');
    } else {
      const topPattern = patterns[0];
      suggestions.push(`${patterns.length} patterns active. Top: "${topPattern.pattern}" (conf: ${(topPattern.confidence * 100).toFixed(0)}%)`);
    }

    const report: PerformanceReport = {
      id: generateId(),
      timestamp: now,
      periodStart,
      periodEnd,
      totalEvaluations: totalEvals,
      averageScore,
      scoreTrend: trend,
      topPatterns,
      weaknesses: sortedWeaknesses.slice(0, 5).map(([w]) => w),
      suggestions,
      recommendedActions,
    };
    this.reports.set(report.id, report);
    this.lastMetaCognition = now;
    return report;
  }

  startAutoMetaCognition(): void {
    if (this.metaCognitionTimer) return;
    this.metaCognitionTimer = setInterval(async () => { await this.runMetaCognition(); }, this.config.metaCognitionInterval * 1000);
  }

  stopAutoMetaCognition(): void {
    if (this.metaCognitionTimer) {
      clearInterval(this.metaCognitionTimer);
      this.metaCognitionTimer = null;
    }
  }

  async getLatestReport(): Promise<PerformanceReport | null> {
    const reports = Array.from(this.reports.values());
    if (reports.length === 0) return null;
    return reports.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  }

  async getPerformanceHistory(limit: number = 10): Promise<PerformanceReport[]> {
    return Array.from(this.reports.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
  }

  get stats() {
    return {
      outputsRecorded: this.outputHistory.length,
      evaluationsPerformed: this.evaluationHistory.length,
      reportsGenerated: this.reports.size,
      autoCognitionActive: this.metaCognitionTimer !== null,
      lastMetaCognition: this.lastMetaCognition,
      reasoningEnginesTracked: this.enginePerformance.size,
      reasoningRegistryAvailable: Boolean(this.reasoningRegistry),
    };
  }
}
