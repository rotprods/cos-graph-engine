import { EntityId, CellContext, Confidence, Timestamp } from '@cos/core';
import { generateId } from '@cos/core';
import { CellHost } from '@cos/runtime';
import { MemoryManager } from '@cos/memory';
import { PlanningEngine, EvaluationSystem, SelfImprovementSystem } from '@cos/cognition';

export type AutonomousGoalStatus =
  | 'created' | 'planning' | 'executing' | 'observing' | 'adapting'
  | 'completed' | 'failed' | 'blocked';

export type AutonomousStepStatus = 'pending' | 'running' | 'accepted' | 'retrying' | 'skipped' | 'failed';

export interface AutonomousExecutionEvent {
  id: EntityId;
  goalId: EntityId;
  stepId?: EntityId;
  type: 'goal_transition' | 'step_started' | 'step_accepted' | 'step_failed' | 'step_retry' | 'plan_adapted';
  timestamp: Timestamp;
  from?: string;
  to?: string;
  detail?: string;
}

export interface AutonomousGoal {
  id: EntityId;
  description: string;
  status: AutonomousGoalStatus;
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
  executionTrace: AutonomousExecutionEvent[];
}

export interface AutonomousStep {
  id: EntityId;
  description: string;
  type: 'reason' | 'tool' | 'memory' | 'knowledge' | 'evaluate' | 'subgoal';
  target?: string;
  input?: unknown;
  expectedOutput?: string;
  /** Required steps may never be silently skipped after retry exhaustion. */
  required: boolean;
  status: AutonomousStepStatus;
  maxRetries: number;
  retryCount: number;
}

export interface AutonomousStepResult {
  stepId: EntityId;
  success: boolean;
  /** Acceptance is distinct from transport/execution success. */
  accepted: boolean;
  output: unknown;
  confidence: number;
  duration: number;
  attempt: number;
  error?: string;
  timestamp: Timestamp;
}

export class AutonomousLoop {
  private goals: Map<EntityId, AutonomousGoal> = new Map();
  private executingGoals = new Set<EntityId>();

  constructor(
    private readonly cellHost: CellHost,
    private readonly memory: MemoryManager,
    private readonly planning: PlanningEngine,
    private readonly evaluation: EvaluationSystem,
    private readonly selfImprovement: SelfImprovementSystem,
  ) {}

  async createGoal(
    description: string,
    context?: Partial<CellContext>,
  ): Promise<AutonomousGoal> {
    const normalized = description.trim();
    if (!normalized) throw new Error('Autonomous goal description must not be empty');

    const ctx: CellContext = { traceId: `goal-${Date.now()}`, ...context };
    const id = generateId();
    const plan = await this.planning.createPlan(normalized, ctx);

    const goal: AutonomousGoal = {
      id,
      description: normalized,
      status: 'created',
      plan: plan.steps.map(s => ({
        id: s.id,
        description: s.description.substring(0, 200),
        type: 'reason',
        required: true,
        status: 'pending',
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
      executionTrace: [],
    };

    this.goals.set(id, goal);
    this.trace(goal, 'goal_transition', undefined, undefined, 'created', 'goal created');

    await this.memory.store(
      { type: 'goal', description: normalized, planSteps: goal.plan.length },
      'working',
      { tags: ['goal', 'autonomous'], importance: 0.9, source: id },
    );

    return goal;
  }

  async executeNextStep(goalId: EntityId): Promise<AutonomousStepResult | null> {
    const goal = this.requireGoal(goalId);
    if (goal.status === 'completed' || goal.status === 'failed' || goal.status === 'blocked') return null;

    const step = goal.plan[goal.currentStepIndex];
    if (!step) {
      await this.completeGoalIfEligible(goal);
      return null;
    }

    this.transition(goal, 'executing');
    step.status = 'running';
    this.trace(goal, 'step_started', step.id, undefined, 'running', step.description);
    const startTime = Date.now();
    const attempt = step.retryCount + 1;

    try {
      const output = await this.executeStep(goal, step);
      const accepted = this.acceptOutput(step, output);
      if (!accepted) throw new Error(`Step output failed acceptance criteria${step.expectedOutput ? `: expected '${step.expectedOutput}'` : ''}`);

      const result: AutonomousStepResult = {
        stepId: step.id,
        success: true,
        accepted: true,
        output,
        confidence: 0.8,
        duration: Date.now() - startTime,
        attempt,
        timestamp: new Date().toISOString(),
      };

      step.status = 'accepted';
      goal.results.set(goal.currentStepIndex, result);
      goal.currentStepIndex += 1;
      this.transition(goal, 'observing');
      this.trace(goal, 'step_accepted', step.id, 'running', 'accepted');

      await this.memory.store(
        { goalId, stepIndex: goal.currentStepIndex - 1, output, accepted: true, attempt },
        'episodic',
        { tags: ['step-result', goal.description.substring(0, 20)], importance: 0.6, source: goalId },
      );

      return result;
    } catch (error) {
      step.retryCount += 1;
      const exhausted = step.retryCount >= step.maxRetries;
      const message = error instanceof Error ? error.message : String(error);
      const result: AutonomousStepResult = {
        stepId: step.id,
        success: false,
        accepted: false,
        output: null,
        confidence: 0,
        duration: Date.now() - startTime,
        attempt,
        error: message,
        timestamp: new Date().toISOString(),
      };
      goal.results.set(goal.currentStepIndex, result);

      if (!exhausted) {
        step.status = 'retrying';
        this.trace(goal, 'step_retry', step.id, 'running', 'retrying', message);
        return result;
      }

      if (step.required) {
        step.status = 'failed';
        this.trace(goal, 'step_failed', step.id, 'running', 'failed', message);
        this.transition(goal, 'failed', `required step exhausted ${step.maxRetries} attempts: ${message}`);
        goal.completedAt = new Date().toISOString();
      } else {
        step.status = 'skipped';
        this.trace(goal, 'step_failed', step.id, 'running', 'skipped', message);
        goal.currentStepIndex += 1;
        this.transition(goal, 'observing');
      }

      return result;
    }
  }

  async executeGoal(goalId: EntityId): Promise<AutonomousGoal> {
    const goal = this.requireGoal(goalId);
    if (this.executingGoals.has(goalId)) throw new Error(`Goal ${String(goalId)} is already executing`);
    if (goal.status === 'completed' || goal.status === 'failed' || goal.status === 'blocked') return goal;

    this.executingGoals.add(goalId);
    try {
      this.transition(goal, 'executing');
      while (goal.currentStepIndex < goal.plan.length && goal.status !== 'failed' && goal.status !== 'blocked') {
        const result = await this.executeNextStep(goalId);

        if (goal.currentStepIndex % 2 === 0 && goal.currentStepIndex > 0) {
          await this.evaluateProgress(goalId);
        }

        if (result && !result.success && goal.status !== 'failed') {
          goal.evaluation.attempts += 1;
          if (goal.evaluation.attempts >= goal.evaluation.maxAttempts) {
            this.transition(goal, 'adapting');
            await this.adaptPlan(goalId);
            goal.evaluation.attempts = 0;
          }
        }
      }

      if (goal.status !== 'failed' && goal.status !== 'blocked') {
        await this.completeGoalIfEligible(goal);
      }

      await this.selfImprovement.recordOutput(
        { goal: goal.description, steps: goal.plan.length },
        { result: goal.status, summary: goal.summary },
      );
      return goal;
    } finally {
      this.executingGoals.delete(goalId);
    }
  }

  async evaluateProgress(goalId: EntityId): Promise<number> {
    const goal = this.goals.get(goalId);
    if (!goal) return 0;

    const acceptedRequired = goal.plan.filter(step => step.required && step.status === 'accepted').length;
    const requiredTotal = goal.plan.filter(step => step.required).length;
    const progress = requiredTotal > 0 ? acceptedRequired / requiredTotal : 1;
    goal.confidence = Math.min(0.95, 0.3 + progress * 0.65);
    goal.evaluation.score = progress;

    await this.memory.store(
      { goalId, progress, acceptedRequired, requiredTotal, confidence: goal.confidence },
      'working',
      { tags: ['progress', goal.description.substring(0, 20)], importance: 0.7, source: goalId },
    );
    return progress;
  }

  async adaptPlan(goalId: EntityId): Promise<void> {
    const goal = this.requireGoal(goalId);
    if (goal.status === 'failed' || goal.status === 'completed') return;

    const remainingSteps = goal.plan.slice(goal.currentStepIndex);
    const newPlan = await this.planning.createPlan(
      `Continue: ${goal.description}. Remaining: ${remainingSteps.map(s => s.description).join('; ')}`,
      goal.context,
    );

    goal.plan = [
      ...goal.plan.slice(0, goal.currentStepIndex),
      ...newPlan.steps.map(s => ({
        id: s.id,
        description: s.description.substring(0, 200),
        type: 'reason' as const,
        required: true,
        status: 'pending' as const,
        maxRetries: 3,
        retryCount: 0,
      })),
    ];

    this.trace(goal, 'plan_adapted', undefined, 'adapting', 'executing', `${newPlan.steps.length} replacement steps`);
    this.transition(goal, 'executing');
    await this.memory.store(
      { goalId, adapted: true, newStepCount: newPlan.steps.length },
      'reflection',
      { tags: ['adaptation', goal.description.substring(0, 20)], importance: 0.8, source: goalId },
    );
  }

  async getGoal(id: EntityId): Promise<AutonomousGoal | null> {
    return this.goals.get(id) || null;
  }

  async getActiveGoals(): Promise<AutonomousGoal[]> {
    return Array.from(this.goals.values()).filter(
      g => g.status !== 'completed' && g.status !== 'failed' && g.status !== 'blocked',
    );
  }

  async getCompletedGoals(limit: number = 10): Promise<AutonomousGoal[]> {
    return Array.from(this.goals.values())
      .filter(g => g.status === 'completed')
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
      .slice(0, limit);
  }

  private async executeStep(goal: AutonomousGoal, step: AutonomousStep): Promise<unknown> {
    switch (step.type) {
      case 'reason': {
        const cells = this.cellHost.getAllCells();
        if (cells.length === 0) throw new Error('No reasoning-capable cell is available');
        const result = await cells[0].process(
          { problem: step.description, steps: 3 },
          goal.context,
        );
        return result.result;
      }
      case 'tool':
        // The previous implementation returned a success-looking string without
        // executing a tool. False success is more dangerous than explicit lack
        // of capability, so the runtime now fails closed until ToolRegistry is
        // injected in the next capability-routing slice.
        throw new Error(`Tool execution is not wired for '${step.target || 'unspecified tool'}'`);
      case 'memory':
        return this.memory.query({ tags: [step.description], limit: 5 });
      case 'evaluate':
        return this.evaluation.evaluate(
          `Step ${goal.currentStepIndex + 1}`,
          step.input || step.description,
          ['accuracy', 'completeness'],
        );
      case 'knowledge':
      case 'subgoal':
        throw new Error(`Step type '${step.type}' has no execution adapter`);
      default:
        throw new Error(`Unsupported autonomous step type: ${(step as AutonomousStep).type}`);
    }
  }

  private acceptOutput(step: AutonomousStep, output: unknown): boolean {
    if (output === undefined) return false;
    if (!step.expectedOutput) return true;
    try {
      const serialized = typeof output === 'string' ? output : JSON.stringify(output);
      return serialized.includes(step.expectedOutput);
    } catch {
      return false;
    }
  }

  private async completeGoalIfEligible(goal: AutonomousGoal): Promise<void> {
    const failedRequired = goal.plan.filter(step => step.required && step.status !== 'accepted');
    if (failedRequired.length > 0) {
      this.transition(goal, 'failed', `${failedRequired.length} required step(s) were not accepted`);
      goal.completedAt = new Date().toISOString();
      await this.generateSummary(goal);
      return;
    }

    this.transition(goal, 'completed');
    goal.completedAt = new Date().toISOString();
    await this.generateSummary(goal);
  }

  private requireGoal(id: EntityId): AutonomousGoal {
    const goal = this.goals.get(id);
    if (!goal) throw new Error(`Goal ${String(id)} not found`);
    return goal;
  }

  private transition(goal: AutonomousGoal, next: AutonomousGoalStatus, detail?: string): void {
    const previous = goal.status;
    if (previous === next) return;
    if (previous === 'completed' || previous === 'failed') {
      throw new Error(`Terminal goal ${String(goal.id)} cannot transition ${previous} -> ${next}`);
    }
    goal.status = next;
    this.trace(goal, 'goal_transition', undefined, previous, next, detail);
  }

  private trace(
    goal: AutonomousGoal,
    type: AutonomousExecutionEvent['type'],
    stepId?: EntityId,
    from?: string,
    to?: string,
    detail?: string,
  ): void {
    goal.executionTrace.push({
      id: generateId(),
      goalId: goal.id,
      stepId,
      type,
      timestamp: new Date().toISOString(),
      from,
      to,
      detail,
    });
  }

  private async generateSummary(goal: AutonomousGoal): Promise<void> {
    const acceptedSteps = goal.plan.filter(step => step.status === 'accepted').length;
    const failedSteps = goal.plan.filter(step => step.status === 'failed').length;
    const totalSteps = goal.plan.length;
    const totalDuration = Array.from(goal.results.values()).reduce((sum, result) => sum + result.duration, 0);

    goal.summary = `Goal "${goal.description}" ${goal.status}: ${acceptedSteps}/${totalSteps} accepted, ${failedSteps} failed, ${(totalDuration / 1000).toFixed(1)}s. Confidence: ${(goal.confidence * 100).toFixed(0)}%.`;
    goal.metadata = {
      acceptedSteps,
      failedSteps,
      totalSteps,
      totalDuration,
      averageStepDuration: totalSteps > 0 ? totalDuration / totalSteps : 0,
      traceEvents: goal.executionTrace.length,
    };
  }

  get stats() {
    return {
      totalGoals: this.goals.size,
      active: Array.from(this.goals.values()).filter(g => g.status === 'executing').length,
      completed: Array.from(this.goals.values()).filter(g => g.status === 'completed').length,
      failed: Array.from(this.goals.values()).filter(g => g.status === 'failed').length,
      blocked: Array.from(this.goals.values()).filter(g => g.status === 'blocked').length,
    };
  }
}
