import { EntityId, CellContext, CellOutput, Health } from '@cos/core';
import { CellHost } from '@cos/runtime';
import { MemoryManager } from '@cos/memory';
import { KnowledgeGraph, EmbeddingSystem, OntologySystem } from '@cos/knowledge';
import { ReasoningEngineRegistry, PlanningEngine, EvaluationSystem, LearningSystem, SelfImprovementSystem, LLMFactory } from '@cos/cognition';
import { ToolRegistry } from '@cos/execution';
import { AgentSystem, WorkflowEngine, PolicyEngine, AutonomousLoop, AutonomousGoal, AutonomousStepResult } from '@cos/orchestration';
import { TelemetrySystem } from '@cos/observability';

export type PolicyMode = 'disabled' | 'audit' | 'enforce';

export interface COSConfig {
  host: string;
  port: number;
  maxMemory: number;
  logLevel: string;
  plugins: string[];
  /**
   * `audit` evaluates every protected execution without breaking legacy callers.
   * `enforce` is required before COS may be promoted to authoritative runtime.
   */
  policyMode: PolicyMode;
}

export class COSServer {
  public readonly cellHost: CellHost;
  public readonly memory: MemoryManager;
  public readonly knowledge: KnowledgeGraph;
  public readonly embeddings: EmbeddingSystem;
  public readonly ontology: OntologySystem;
  public readonly reasoning: ReasoningEngineRegistry;
  public readonly planning: PlanningEngine;
  public readonly evaluation: EvaluationSystem;
  public readonly learning: LearningSystem;
  public readonly selfImprovement: SelfImprovementSystem;
  public readonly llm: LLMFactory;
  public readonly autonomousLoop: AutonomousLoop;
  public readonly tools: ToolRegistry;
  public readonly agents: AgentSystem;
  public readonly workflows: WorkflowEngine;
  public readonly policies: PolicyEngine;
  public readonly telemetry: TelemetrySystem;

  public readonly config: COSConfig;
  private started = false;

  constructor(config?: Partial<COSConfig>) {
    this.config = {
      host: config?.host || 'localhost',
      port: config?.port || 8080,
      maxMemory: config?.maxMemory || 1024,
      logLevel: config?.logLevel || 'info',
      plugins: config?.plugins || [],
      policyMode: config?.policyMode || 'audit',
    };

    this.cellHost = new CellHost();
    this.memory = new MemoryManager();
    this.knowledge = new KnowledgeGraph();
    this.embeddings = new EmbeddingSystem();
    this.ontology = new OntologySystem();
    this.reasoning = new ReasoningEngineRegistry();
    this.planning = new PlanningEngine(this.reasoning);
    this.evaluation = new EvaluationSystem();
    this.learning = new LearningSystem();
    this.selfImprovement = new SelfImprovementSystem(this.evaluation, this.learning, this.reasoning);
    this.llm = new LLMFactory();
    this.autonomousLoop = new AutonomousLoop(this.cellHost, this.memory, this.planning, this.evaluation, this.selfImprovement);
    this.tools = new ToolRegistry();
    this.agents = new AgentSystem();
    this.workflows = new WorkflowEngine();
    this.policies = new PolicyEngine();
    this.telemetry = new TelemetrySystem();
  }

  async start(): Promise<void> {
    await this.cellHost.start();
    this.started = true;
    console.log(`[COS] Server started on ${this.config.host}:${this.config.port}`);
  }

  async shutdown(): Promise<void> {
    await this.cellHost.shutdown();
    this.started = false;
    console.log('[COS] Server shut down');
  }

  async process(request: {
    input: unknown;
    target?: EntityId;
    reasoning?: string;
    context?: Partial<CellContext>;
  }): Promise<CellOutput> {
    const context: CellContext = {
      traceId: `cos_${Date.now()}`,
      parentSpanId: undefined,
      ...request.context,
    };

    if (request.reasoning) {
      await this.authorize('reason', `reasoning:${request.reasoning}`, context);
      const steps = await this.reasoning.reason(
        request.reasoning as any,
        { problem: JSON.stringify(request.input) },
        context,
      );
      return {
        id: '' as EntityId,
        result: steps.map(s => s.output).join('\n'),
        representations: {},
        cost: { units: 'credits', amount: 0 },
        latency: 0,
        confidence: steps[steps.length - 1]?.confidence || 0.5,
        memoryUpdates: [],
        events: [],
        errors: [],
        metadata: { traceId: context.traceId, policyMode: this.config.policyMode },
      };
    }

    if (request.target) {
      await this.authorize('process', `cell:${String(request.target)}`, context);
      const cell = this.cellHost.getCell(request.target);
      if (!cell) throw new Error(`Target cell ${String(request.target)} not found`);
      return cell.process(request.input, context);
    }

    await this.authorize('process', 'system:passthrough', context);
    return {
      id: '' as EntityId,
      result: request.input,
      representations: {},
      cost: { units: 'credits', amount: 0 },
      latency: 0,
      confidence: 1.0,
      memoryUpdates: [],
      events: [],
      errors: [],
      metadata: { traceId: context.traceId, policyMode: this.config.policyMode },
    };
  }

  async getHealth(): Promise<Record<string, Health>> {
    const cellHealth = await this.cellHost.getSystemHealth();
    return {
      ...cellHealth,
      system: {
        status: this.started ? 'healthy' : 'degraded',
        lastCheck: new Date().toISOString(),
        message: `COS running on ${this.config.host}:${this.config.port}`,
        metrics: {
          cells: this.cellHost.getAllCells().length,
          events: this.cellHost.eventBus.eventCount,
          memory: (await this.memory.stats()).totalEntries,
          tools: this.tools.getAll().length,
          agents: this.agents.agentCount,
          workflows: this.workflows.workflowCount,
        },
      },
    };
  }

  async getStats(): Promise<Record<string, unknown>> {
    return {
      runtime: {
        subscribers: this.cellHost.eventBus.subscriberCount,
        events: this.cellHost.eventBus.eventCount,
        cells: this.cellHost.getAllCells().length,
        scheduler: await this.cellHost.scheduler.stats(),
      },
      memory: await this.memory.stats(),
      knowledge: await this.knowledge.stats(),
      reasoning: Array.from(this.reasoning.getCapabilities().keys()).length,
      tools: this.tools.getAll().length,
      agents: this.agents.agentCount,
      workflows: this.workflows.workflowCount,
      policy: {
        mode: this.config.policyMode,
        auditEntries: this.policies.getAuditLog(Number.MAX_SAFE_INTEGER).length,
      },
      telemetry: {
        events: this.telemetry.eventCount,
        metrics: this.telemetry.metricCount,
      },
    };
  }

  async createGoal(description: string, context?: Partial<CellContext>): Promise<AutonomousGoal> {
    return this.autonomousLoop.createGoal(description, context);
  }

  async getActiveGoals(): Promise<AutonomousGoal[]> {
    return this.autonomousLoop.getActiveGoals();
  }

  async executeGoal(goalId: EntityId): Promise<AutonomousGoal> {
    return this.autonomousLoop.executeGoal(goalId);
  }

  async executeNextStep(goalId: EntityId): Promise<AutonomousStepResult | null> {
    return this.autonomousLoop.executeNextStep(goalId);
  }

  async getCompletedGoals(): Promise<AutonomousGoal[]> {
    return this.autonomousLoop.getCompletedGoals();
  }

  private async authorize(action: string, resource: string, context: CellContext): Promise<void> {
    if (this.config.policyMode === 'disabled') return;
    if (this.config.policyMode === 'enforce') {
      await this.policies.assertAllowed(action, resource, context);
      return;
    }

    // Audit mode is migration-only: a decision is always computed and recorded,
    // but legacy execution is not blocked. Authority Gate forbids this mode.
    await this.policies.evaluate(action, resource, context);
  }
}
