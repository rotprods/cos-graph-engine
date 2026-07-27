import {
  ICogCell, CogCellDefinition, CellLifecycle, CellContext, CellOutput, CellInspection,
  Health, HealthStatus, CogEvent, EntityId, Timestamp,
} from '@cos/core';
import { CellError, generateId } from '@cos/core';
import { EventBus } from './eventbus';
import { Scheduler, TaskProcessor } from './scheduler';
import { StateManager } from './state';

export class CellHost {
  public readonly eventBus: EventBus;
  public readonly scheduler: Scheduler;
  public readonly state: StateManager;

  private cells: Map<EntityId, ICogCell> = new Map();
  private cellTypes: Map<string, EntityId[]> = new Map();
  private started = false;

  constructor() {
    this.eventBus = new EventBus();
    this.state = new StateManager();
    this.scheduler = new Scheduler(this.executeTask.bind(this), {
      maxConcurrency: 4,
      pollingInterval: 50,
    });
  }

  // Register a cell with the host
  async register(cell: ICogCell): Promise<void> {
    if (this.cells.has(cell.definition.id)) {
      throw new CellError('CELL_EXISTS', `Cell ${cell.definition.id} already registered`);
    }

    this.cells.set(cell.definition.id, cell);
    const type = cell.definition.type;
    if (!this.cellTypes.has(type)) this.cellTypes.set(type, []);
    this.cellTypes.get(type)!.push(cell.definition.id);

    // Initialize the cell
    await cell.init();

    // Publish registration event
    await this.eventBus.publish({
      type: 'cell.registered',
      source: cell.definition.id,
      payload: { cellId: cell.definition.id, type: cell.definition.type },
      severity: 'info',
      metadata: {},
    });

    // Store initial state
    this.state.set(cell.definition.id, {
      lifecycle: cell.state.lifecycle,
      health: cell.state.health,
    });
  }

  // Start all cells and the scheduler
  async start(): Promise<void> {
    if (this.started) return;

    // Start all registered cells
    for (const [id, cell] of this.cells) {
      await cell.start();
      this.state.update(id, { lifecycle: cell.state.lifecycle });
    }

    this.scheduler.start();
    this.started = true;

    await this.eventBus.publish({
      type: 'host.started',
      source: 'host' as EntityId,
      payload: { cellCount: this.cells.size },
      severity: 'info',
      metadata: {},
    });
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.scheduler.stop();

    for (const [id, cell] of this.cells) {
      await cell.shutdown();
      this.state.update(id, { lifecycle: cell.state.lifecycle });
    }

    this.started = false;

    await this.eventBus.publish({
      type: 'host.shutdown',
      source: 'host' as EntityId,
      payload: {},
      severity: 'info',
      metadata: {},
    });
  }

  // Get a registered cell
  getCell(id: EntityId): ICogCell | undefined {
    return this.cells.get(id);
  }

  // Find cells by type
  getCellsByType(type: string): ICogCell[] {
    const ids = this.cellTypes.get(type) || [];
    return ids.map(id => this.cells.get(id)).filter(Boolean) as ICogCell[];
  }

  // Get all registered cells
  getAllCells(): ICogCell[] {
    return Array.from(this.cells.values());
  }

  // Get cells by policy
  getCellsByPolicy(policyId: EntityId): ICogCell[] {
    return Array.from(this.cells.values()).filter(
      cell => cell.definition.policies.includes(policyId),
    );
  }

  // Get cells by dependency
  getDependents(cellId: EntityId): ICogCell[] {
    return Array.from(this.cells.values()).filter(
      cell => cell.definition.dependencies.includes(cellId),
    );
  }

  // Get health of all cells
  async getSystemHealth(): Promise<Record<EntityId, Health>> {
    const result: Record<EntityId, Health> = {};
    for (const [id, cell] of this.cells) {
      result[id] = await cell.getHealth();
    }
    return result;
  }

  // Inspect a specific cell
  async inspectCell(id: EntityId): Promise<CellInspection | null> {
    const cell = this.cells.get(id);
    if (!cell) return null;
    return cell.inspect();
  }

  // Execute a task through the scheduler
  private executeTask: TaskProcessor = async (task) => {
    const cell = this.cells.get(task.target);
    if (!cell) {
      throw new CellError('CELL_NOT_FOUND', `Target cell ${task.target} not found`);
    }

    return cell.process(task.input, task.context);
  };
}