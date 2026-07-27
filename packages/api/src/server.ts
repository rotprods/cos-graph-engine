import { EntityId, CellContext, CellOutput, CogCellDefinition, Health, GraphStats } from '@cos/core';
import { CellHost } from '@cos/runtime';
import { MemoryManager } from '@cos/memory';
import { KnowledgeGraph, EmbeddingSystem, OntologySystem } from '@cos/knowledge';
import { ReasoningEngineRegistry, PlanningEngine, EvaluationSystem, LearningSystem, SelfImprovementSystem, LLMFactory } from '@cos/cognition';
import { ToolRegistry } from '@cos/execution';
import { AgentSystem, WorkflowEngine, PolicyEngine, AutonomousLoop, AutonomousGoal, AutonomousStepResult } from '@cos/orchestration';
import { TelemetrySystem } from '@cos/observability';

export interface COSConfig {
  host: string;
  port: number;
  maxMemory: number;
  logLevel: string;
  plugins: string[];
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
    };

    // Initialize all subsystems
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

  // ========== API Methods ==========

  // Process a cognitive request through the system
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

    // Route through reasoning if specified
    if (request.reasoning) {
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
        metadata: { traceId: context.traceId },
      };
    }

    // Route to a specific cell
    if (request.target) {
      return this.cellHost.getCell(request.target)!.process(request.input, context);
    }

    // Default: return input as-is
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
      metadata: { traceId: context.traceId },
    };
  }

  // System health
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

  // System stats
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
      telemetry: {
        events: this.telemetry.eventCount,
        metrics: this.telemetry.metricCount,
      },
    };
  }

  // Autonomous goal methods
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
}