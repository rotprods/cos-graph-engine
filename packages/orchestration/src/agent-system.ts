import {
  EntityId, CellContext, CellOutput, CogCellDefinition, CogCellState,
  ICogCell, Health, Cost, Latency, CogError, MemoryLayer,
} from '@cos/core';
import { generateId, CellError, BaseCell } from '@cos/core';

export interface AgentDefinition {
  id: EntityId;
  name: string;
  purpose: string;
  cells: EntityId[];
  policies: EntityId[];
  maxConcurrency: number;
  timeout: number;
  metadata: Record<string, unknown>;
}

export interface AgentExecution {
  id: EntityId;
  agentId: EntityId;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: unknown;
  output: CellOutput | null;
  startedAt: string;
  completedAt?: string;
  cellResults: Map<EntityId, CellOutput>;
}

export class AgentSystem {
  private agents: Map<EntityId, AgentDefinition> = new Map();
  private executions: Map<EntityId, AgentExecution> = new Map();
  private cellRegistry: Map<EntityId, ICogCell> = new Map();

  registerCell(cell: ICogCell): void {
    this.cellRegistry.set(cell.definition.id, cell);
  }

  async defineAgent(
    name: string,
    purpose: string,
    cellIds: EntityId[],
    options: { policies?: EntityId[]; maxConcurrency?: number; timeout?: number } = {},
  ): Promise<EntityId> {
    // Validate all cells exist
    for (const cellId of cellIds) {
      if (!this.cellRegistry.has(cellId)) {
        throw new CellError('CELL_NOT_FOUND', `Cell ${cellId} not found in registry`);
      }
    }

    const id = generateId();
    const agent: AgentDefinition = {
      id,
      name,
      purpose,
      cells: cellIds,
      policies: options.policies || [],
      maxConcurrency: options.maxConcurrency || 1,
      timeout: options.timeout || 60000,
      metadata: {},
    };

    this.agents.set(id, agent);
    return id;
  }

  async executeAgent(agentId: EntityId, input: unknown, context: CellContext): Promise<AgentExecution> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new CellError('AGENT_NOT_FOUND', `Agent ${agentId} not found`);

    const executionId = generateId();
    const execution: AgentExecution = {
      id: executionId,
      agentId,
      status: 'pending',
      input,
      output: null,
      startedAt: new Date().toISOString(),
      cellResults: new Map(),
    };

    this.executions.set(executionId, execution);
    execution.status = 'running';

    // Execute cells in order, respecting concurrency
    const results: CellOutput[] = [];
    for (const cellId of agent.cells) {
      const cell = this.cellRegistry.get(cellId);
      if (!cell) {
        execution.status = 'failed';
        return execution;
      }
      const output = await cell.process(input, context);
      results.push(output);
      execution.cellResults.set(cellId, output);
    }

    execution.status = 'completed';
    execution.completedAt = new Date().toISOString();
    execution.output = results[results.length - 1] || null;

    return execution;
  }

  async getAgent(id: EntityId): Promise<AgentDefinition | null> {
    return this.agents.get(id) || null;
  }

  async getExecution(id: EntityId): Promise<AgentExecution | null> {
    return this.executions.get(id) || null;
  }

  getRegisteredCells(): ICogCell[] {
    return Array.from(this.cellRegistry.values());
  }

  get agentCount(): number { return this.agents.size; }
  get executionCount(): number { return this.executions.size; }
}