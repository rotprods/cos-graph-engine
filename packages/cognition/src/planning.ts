import {
  EntityId, CellContext, Cost, Confidence, Timestamp,
  ReasoningStep, ReasoningEngineType,
} from '@cos/core';
import { generateId } from '@cos/core';
import { ReasoningEngineRegistry } from './reasoning';

export interface PlanStep {
  id: EntityId;
  description: string;
  type: 'action' | 'reasoning' | 'subplan' | 'observation' | 'verification';
  engine?: ReasoningEngineType;
  input?: unknown;
  dependencies: EntityId[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  confidence: Confidence;
  cost: Cost;
  timestamp: Timestamp;
}

export interface Plan {
  id: EntityId;
  goal: string;
  steps: PlanStep[];
  status: 'drafting' | 'executing' | 'completed' | 'failed';
  confidence: Confidence;
  cost: Cost;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  metadata: Record<string, unknown>;
}

export class PlanningEngine {
  private plans: Map<EntityId, Plan> = new Map();
  private registry: ReasoningEngineRegistry;

  constructor(registry: ReasoningEngineRegistry) {
    this.registry = registry;
  }

  async createPlan(goal: string, context: CellContext): Promise<Plan> {
    // Decompose goal into steps using reasoning
    const reasoningSteps = await this.registry.reason('chain_of_thought', {
      problem: `Decompose the following goal into actionable steps: ${goal}`,
      steps: 7,
    }, context);

    const planSteps: PlanStep[] = [];
    const lastStep = reasoningSteps[reasoningSteps.length - 1];
    const totalSteps = reasoningSteps.length;

    // Create plan steps from reasoning
    for (let i = 0; i < totalSteps; i++) {
      const step = reasoningSteps[i];
      const dependencies: EntityId[] = i > 0 ? [planSteps[i - 1].id] : [];

      planSteps.push({
        id: generateId(),
        description: `Step ${i + 1}/${totalSteps}: ${step.output}`,
        type: 'reasoning',
        engine: 'chain_of_thought',
        input: step.input,
        dependencies,
        status: 'pending',
        confidence: step.confidence,
        cost: step.cost,
        timestamp: step.timestamp,
      });
    }

    // Add verification step
    planSteps.push({
      id: generateId(),
      description: `Verify goal: "${goal}"`,
      type: 'verification',
      engine: 'reflection',
      input: { previousOutput: goal, critiqueAspects: ['completeness', 'accuracy'] },
      dependencies: [planSteps[planSteps.length - 1].id],
      status: 'pending',
      confidence: 0.5,
      cost: { units: 'tokens', amount: 0 },
      timestamp: new Date().toISOString(),
    });

    const plan: Plan = {
      id: generateId(),
      goal,
      steps: planSteps,
      status: 'drafting',
      confidence: lastStep?.confidence || 0.5,
      cost: { units: 'credits', amount: 0 },
      createdAt: new Date().toISOString(),
      metadata: {},
    };

    this.plans.set(plan.id, plan);
    return plan;
  }

  async executePlan(planId: EntityId, context: CellContext): Promise<Plan> {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    plan.status = 'executing';

    // Topological sort: execute steps in dependency order
    const executed = new Set<EntityId>();
    let totalCost = 0;
    let totalConfidence = 0;

    while (executed.size < plan.steps.length) {
      let progress = false;

      for (const step of plan.steps) {
        if (executed.has(step.id)) continue;

        // Check dependencies
        const depsMet = step.dependencies.every(d => executed.has(d));
        if (!depsMet) continue;

        step.status = 'running';

        // Execute step
        if (step.engine) {
          try {
            const engine = this.registry.get(step.engine);
            if (engine) {
              const results = await engine.reason(step.input || { problem: step.description }, context);
              const lastResult = results[results.length - 1];
              step.result = lastResult?.output;
              step.confidence = lastResult?.confidence || 0.5;
              step.cost = lastResult?.cost || { units: 'tokens', amount: 0 };
            }
          } catch (error) {
            step.status = 'failed';
            plan.status = 'failed';
            return plan;
          }
        }

        step.status = 'completed';
        step.timestamp = new Date().toISOString();
        executed.add(step.id);
        totalCost += step.cost.amount;
        totalConfidence += step.confidence;
        progress = true;
      }

      if (!progress) break; // deadlock
    }

    plan.status = 'completed';
    plan.completedAt = new Date().toISOString();
    plan.cost = { units: 'credits', amount: totalCost };
    plan.confidence = totalConfidence / plan.steps.length;

    return plan;
  }

  async getPlan(planId: EntityId): Promise<Plan | null> {
    return this.plans.get(planId) || null;
  }

  async getPlansByGoal(goal: string): Promise<Plan[]> {
    return Array.from(this.plans.values()).filter(
      p => p.goal.toLowerCase().includes(goal.toLowerCase()),
    );
  }

  get planCount(): number { return this.plans.size; }
}