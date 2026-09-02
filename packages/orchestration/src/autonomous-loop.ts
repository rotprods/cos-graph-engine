import { EntityId, CellContext, CellOutput, Cost, Confidence, Timestamp } from '@cos/core';
import { generateId } from '@cos/core';
import { CellHost } from '@cos/runtime';
import { MemoryManager } from '@cos/memory';
import { PlanningEngine, EvaluationSystem, SelfImprovementSystem } from '@cos/cognition';

// ================================================================
// AUTONOMOUS EXECUTION LOOP
// Goal → Plan → Execute → Observe → Adapt → Complete
// ================================================================

export interface AutonomousGoal {
  id: EntityId;
  description: string;
  status: 'created' | 'planning' | 'executing' | 'observing' | 'adapting' | 'completed' | 'failed';
  plan: AutonomousStep[];
  currentStepIndex: number;
  results: Map<number, AutonomousStepResult>;
  evaluation: { score: number; attempts: number; maxAttempts: number };
  context: CellContext;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  summary?: string;
  confidence: Confidence;
  metadata: Record<string, unknown>;
}

export interface AutonomousStep {
  id: EntityId;
  description: string;
  type: 'reason' | 'tool' | 'memory' | 'knowledge' | 'evaluate' | 'subgoal';
  target?: string;        // cell ID or tool name
  input?: unknown;
  expectedOutput?: string;
  maxRetries: number;
  retryCount: number;
}

export interface AutonomousStepResult {
  stepId: EntityId;
  success: boolean;
  output: unknown;
  confidence: number;
  duration: number;
  error?: string;
  timestamp: Timestamp;
}

export class AutonomousLoop {
  private goals: Map<EntityId, AutonomousGoal> = new Map();
  private cellHost: CellHost;
  private memory: MemoryManager;
  private planning: PlanningEngine;
  private evaluation: EvaluationSystem;
  private selfImprovement: SelfImprovementSystem;

  constructor(
    cellHost: CellHost,
    memory: MemoryManager,
    planning: PlanningEngine,
    evaluation: EvaluationSystem,
    selfImprovement: SelfImprovementSystem,
  ) {
    this.cellHost = cellHost;
    this.memory = memory;
    this.planning = planning;
    this.evaluation = evaluation;
    this.selfImprovement = selfImprovement;
  }

  // ========== CREATE A GOAL ==========

  async createGoal(
    description: string,
    context?: Partial<CellContext>,
  ): Promise<AutonomousGoal> {
    const ctx: CellContext = { traceId: `goal-${Date.now()}`, ...context };
    const id = generateId();

    // Create plan using the planning engine
    const plan = await this.planning.createPlan(description, ctx);

    const goal: AutonomousGoal = {
      id,
      description,
      status: 'created',
      plan: plan.steps.map(s => ({
        id: s.id,
        description: s.description.substring(0, 200),
        type: 'reason',
        maxRetries: 2,
        retryCount: 0,
      })),
      currentStepIndex: 0,
      results: new Map(),
      evaluation: { score: 0, attempts: 0, maxAttempts: 3 },
      context: ctx,
      createdAt: new Date().toISOString(),
      confidence: plan.confidence,
      metadata: {},
    };

    this.goals.set(id, goal);

    // Store goal in memory
    await this.memory.store(
      { type: 'goal', description, planSteps: goal.plan.length },
      'working',
      { tags: ['goal', 'autonomous'], importance: 0.9, source: id },
    );

    return goal;
  }

  // ========== EXECUTE A SINGLE STEP ==========

  async executeNextStep(goalId: EntityId): Promise<AutonomousStepResult | null> {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal ${goalId} not found`);
    if (goal.status === 'completed' || goal.status === 'failed') return null;

    const step = goal.plan[goal.currentStepIndex];
    if (!step) {
      goal.status = 'completed';
      goal.completedAt = new Date().toISOString();
      await this.generateSummary(goal);
      return null;
    }

    goal.status = 'executing';
    const startTime = Date.now();

    try {
      let output: unknown;
      let success = true;

      // Execute based on step type
      switch (step.type) {
        case 'reason': {
          // Use the first available cell for reasoning
          const cells = this.cellHost.getAllCells();
          if (cells.length > 0) {
            const result = await cells[0].process(
              { problem: step.description, steps: 3 },
              goal.context,
            );
            output = result.result;
          }
          break;
        }
        case 'tool': {
          // Tool execution would go through the tool registry
          output = `Tool execution: ${step.target} — ${step.description}`;
          break;
        }
        case 'memory': {
          output = await this.memory.query({ tags: [step.description], limit: 5 });
          break;
        }
        case 'evaluate': {
          const evalResult = await this.evaluation.evaluate(
            `Step ${goal.currentStepIndex + 1}`,
            step.input || step.description,
            ['accuracy', 'completeness'],
          );
          output = evalResult;
          break;
        }
        default:
          output = `Step ${goal.currentStepIndex + 1}: ${step.description}`;
      }

      const result: AutonomousStepResult = {
        stepId: step.id,
        success,
        output,
        confidence: 0.8,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      goal.results.set(goal.currentStepIndex, result);
      goal.currentStepIndex++;
      goal.status = 'observing';

      // Store result in memory
      await this.memory.store(
        { goalId, stepIndex: goal.currentStepIndex - 1, output },
        'episodic',
        { tags: ['step-result', goal.description.substring(0, 20)], importance: 0.6 },
      );

      return result;
    } catch (error) {
      step.retryCount++;
      const result: AutonomousStepResult = {
        stepId: step.id,
        success: false,
        output: null,
        confidence: 0,
        duration: Date.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };

      goal.results.set(goal.currentStepIndex, result);
      return result;
    }
  }

  // ========== RUN FULL GOAL ==========

  async executeGoal(goalId: EntityId): Promise<AutonomousGoal> {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal ${goalId} not found`);

    goal.status = 'executing';

    while (goal.currentStepIndex < goal.plan.length) {
      const result = await this.executeNextStep(goalId);

      // Evaluate progress periodically
      if (goal.currentStepIndex % 2 === 0 && goal.currentStepIndex > 0) {
        await this.evaluateProgress(goalId);
      }

      if (result?.success) {
        // A successful step proves the current plan is making progress, so
        // reset the consecutive adaptation budget for the next failure streak.
        goal.evaluation.attempts = 0;
        continue;
      }

      // Failed steps stay at the same index until their retry budget is
      // exhausted. Only then do we adapt the remaining plan. This prevents a
      // failed step from being silently skipped and the goal from being
      // reported as completed.
      if (result && !result.success) {
        const failedStep = goal.plan[goal.currentStepIndex];
        if (failedStep && failedStep.retryCount >= failedStep.maxRetries) {
          goal.evaluation.attempts++;

          if (goal.evaluation.attempts >= goal.evaluation.maxAttempts) {
            goal.status = 'failed';
            break;
          }

          goal.status = 'adapting';
          await this.adaptPlan(goalId);
        }
      }
    }

    // Final evaluation
    if (goal.status !== 'failed') {
      goal.status = 'completed';
      goal.completedAt = new Date().toISOString();
      await this.generateSummary(goal);
    }

    // Feed into self-improvement
    await this.selfImprovement.recordOutput(
      { goal: goal.description, steps: goal.plan.length },
      { result: goal.status, summary: goal.summary },
    );

    return goal;
  }

  // ========== EVALUATE PROGRESS ==========

  async evaluateProgress(goalId: EntityId): Promise<number> {
    const goal = this.goals.get(goalId);
    if (!goal) return 0;

    const completedSteps = Array.from(goal.results.values()).filter(r => r.success).length;
    const totalSteps = goal.plan.length;
    const progress = totalSteps > 0 ? completedSteps / totalSteps : 0;

    // Update confidence based on progress
    goal.confidence = Math.min(0.9, 0.3 + progress * 0.6);

    await this.memory.store(
      { goalId, progress, completedSteps, totalSteps, confidence: goal.confidence },
      'working',
      { tags: ['progress', goal.description.substring(0, 20)], importance: 0.7 },
    );

    return progress;
  }

  // ========== ADAPT PLAN ==========

  async adaptPlan(goalId: EntityId): Promise<void> {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    // Re-plan: create a new plan for the remaining work
    const remainingSteps = goal.plan.slice(goal.currentStepIndex);
    const newPlan = await this.planning.createPlan(
      `Continue: ${goal.description}. Remaining: ${remainingSteps.map(s => s.description).join('; ')}`,
      goal.context,
    );

    // Replace remaining steps with new plan
    goal.plan = [
      ...goal.plan.slice(0, goal.currentStepIndex),
      ...newPlan.steps.map(s => ({
        id: s.id,
        description: s.description.substring(0, 200),
        type: 'reason' as const,
        maxRetries: 3,
        retryCount: 0,
      })),
    ];

    await this.memory.store(
      { goalId, adapted: true, newStepCount: newPlan.steps.length },
      'reflection',
      { tags: ['adaptation', goal.description.substring(0, 20)], importance: 0.8 },
    );
  }

  // ========== QUERIES ==========

  async getGoal(id: EntityId): Promise<AutonomousGoal | null> {
    return this.goals.get(id) || null;
  }

  async getActiveGoals(): Promise<AutonomousGoal[]> {
    return Array.from(this.goals.values()).filter(
      g => g.status !== 'completed' && g.status !== 'failed',
    );
  }

  async getCompletedGoals(limit: number = 10): Promise<AutonomousGoal[]> {
    return Array.from(this.goals.values())
      .filter(g => g.status === 'completed')
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
      .slice(0, limit);
  }

  private async generateSummary(goal: AutonomousGoal): Promise<void> {
    const completedSteps = Array.from(goal.results.values()).filter(r => r.success).length;
    const totalSteps = goal.plan.length;
    const totalDuration = Array.from(goal.results.values()).reduce((s, r) => s + r.duration, 0);

    goal.summary = `Goal "${goal.description}" completed: ${completedSteps}/${totalSteps} steps in ${(totalDuration / 1000).toFixed(1)}s. Confidence: ${(goal.confidence * 100).toFixed(0)}%.`;
    goal.metadata = {
      completedSteps,
      totalSteps,
      totalDuration,
      averageStepDuration: totalSteps > 0 ? totalDuration / totalSteps : 0,
    };
  }

  get stats() {
    return {
      totalGoals: this.goals.size,
      active: Array.from(this.goals.values()).filter(g => g.status === 'executing').length,
      completed: Array.from(this.goals.values()).filter(g => g.status === 'completed').length,
      failed: Array.from(this.goals.values()).filter(g => g.status === 'failed').length,
    };
  }
}