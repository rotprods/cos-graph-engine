import { EntityId, CellContext, CellOutput, WorkflowStep } from '@cos/core';
import { generateId, CellError, CogError } from '@cos/core';

export interface WorkflowDefinition {
  id: EntityId;
  name: string;
  description: string;
  steps: WorkflowStep[];
  metadata: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: EntityId;
  workflowId: EntityId;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'awaiting_approval';
  input: unknown;
  output: CellOutput | null;
  stepResults: Map<string, CellOutput>;
  currentStep: string | null;
  errors: CogError[];
  startedAt: string;
  completedAt?: string;
}

type StepHandler = (step: WorkflowStep, input: unknown, context: CellContext) => Promise<CellOutput>;

export class WorkflowEngine {
  private workflows: Map<EntityId, WorkflowDefinition> = new Map();
  private executions: Map<EntityId, WorkflowExecution> = new Map();
  private stepHandlers: Map<string, StepHandler> = new Map();

  registerStepType(type: string, handler: StepHandler): void {
    this.stepHandlers.set(type, handler);
  }

  async define(
    name: string,
    description: string,
    steps: WorkflowStep[],
    metadata: Record<string, unknown> = {},
  ): Promise<EntityId> {
    const id = generateId();
    this.workflows.set(id, { id, name, description, steps, metadata });
    return id;
  }

  async execute(workflowId: EntityId, input: unknown, context: CellContext): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new CellError('WORKFLOW_NOT_FOUND', `Workflow ${workflowId} not found`);

    const executionId = generateId();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'running',
      input,
      output: null,
      stepResults: new Map(),
      currentStep: null,
      errors: [],
      startedAt: new Date().toISOString(),
    };

    this.executions.set(executionId, execution);

    let currentInput = input;
    const completedSteps = new Set<string>();

    while (true) {
      // Find next executable step
      const nextStep = workflow.steps.find(s =>
        !completedSteps.has(s.id) &&
        (!s.onSuccess || completedSteps.has(s.onSuccess)) &&
        (!s.onFailure || execution.errors.length > 0),
      );

      if (!nextStep) break;

      execution.currentStep = nextStep.id;

      try {
        const handler = this.stepHandlers.get(nextStep.type);
        if (!handler) throw new CellError('STEP_HANDLER_NOT_FOUND', `No handler for step type: ${nextStep.type}`);

        const result = await handler(nextStep, currentInput, context);
        execution.stepResults.set(nextStep.id, result);
        completedSteps.add(nextStep.id);
        currentInput = result.result;

        if (nextStep.type === 'human_approval') {
          execution.status = 'awaiting_approval';
          break;
        }
      } catch (error) {
        const err: CogError = {
          id: generateId(),
          code: 'STEP_ERROR',
          message: (error as Error).message,
          severity: 'error',
          timestamp: new Date().toISOString(),
        };
        execution.errors.push(err);

        if (!nextStep.onFailure) {
          execution.status = 'failed';
          break;
        }
      }
    }

    if (execution.status === 'running') {
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      execution.output = execution.stepResults.get(
        Array.from(execution.stepResults.keys()).pop() || '',
      ) || null;
    }

    return execution;
  }

  async getWorkflow(id: EntityId): Promise<WorkflowDefinition | null> {
    return this.workflows.get(id) || null;
  }

  async getExecution(id: EntityId): Promise<WorkflowExecution | null> {
    return this.executions.get(id) || null;
  }

  async approveStep(executionId: EntityId, context: CellContext): Promise<WorkflowExecution> {
    const execution = this.executions.get(executionId);
    if (!execution) throw new CellError('EXECUTION_NOT_FOUND', `Execution ${executionId} not found`);
    if (execution.status !== 'awaiting_approval') throw new CellError('INVALID_STATE', 'Execution is not awaiting approval');

    execution.status = 'running';
    // Continue execution from where it left off
    return this.execute(execution.workflowId, execution.input, context);
  }

  get workflowCount(): number { return this.workflows.size; }
  get executionCount(): number { return this.executions.size; }
}