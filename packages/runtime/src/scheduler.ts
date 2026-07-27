import {
  Task, TaskStatus, CellOutput, CogError, CellContext,
  IScheduler, SchedulerStats, EntityId, Cost,
} from '@cos/core';
import { generateId, CellError } from '@cos/core';

interface QueuedTask extends Task {
  resolve?: (result: CellOutput) => void;
  reject?: (error: CogError) => void;
}

export type TaskProcessor = (task: Task) => Promise<CellOutput>;

export class Scheduler implements IScheduler {
  private queue: QueuedTask[] = [];
  private running: Map<EntityId, QueuedTask> = new Map();
  private completed: QueuedTask[] = [];
  private failed: QueuedTask[] = [];
  private cancelled: Set<EntityId> = new Set();

  private processor: TaskProcessor;
  private maxConcurrency: number;
  private pollingInterval: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private totalWaitTime = 0;
  private totalExecutionTime = 0;
  private taskCount = 0;

  constructor(
    processor: TaskProcessor,
    options: { maxConcurrency?: number; pollingInterval?: number } = {},
  ) {
    this.processor = processor;
    this.maxConcurrency = options.maxConcurrency || 4;
    this.pollingInterval = options.pollingInterval || 100;
  }

  async enqueue(
    task: Omit<Task, 'id' | 'status' | 'scheduledAt' | 'retryCount' | 'cost'>,
  ): Promise<EntityId> {
    const queued: QueuedTask = {
      ...task,
      id: generateId(),
      status: 'queued',
      scheduledAt: new Date().toISOString(),
      retryCount: 0,
      cost: task.context.budget || { units: 'credits', amount: 0 },
    } as QueuedTask;

    this.queue.push(queued);
    this.queue.sort((a, b) => b.priority - a.priority);

    return queued.id;
  }

  async dequeue(options?: { types?: string[]; limit?: number }): Promise<Task[]> {
    const limit = options?.limit || 1;
    const types = options?.types;
    const result: Task[] = [];

    const remaining: QueuedTask[] = [];
    for (const task of this.queue) {
      if (result.length >= limit) {
        remaining.push(task);
        continue;
      }
      if (types && !types.includes(task.type)) {
        remaining.push(task);
        continue;
      }
      if (this.cancelled.has(task.id)) {
        this.cancelled.delete(task.id);
        task.status = 'cancelled';
        this.completed.push(task);
        continue;
      }
      task.status = 'running';
      task.startedAt = new Date().toISOString();
      this.running.set(task.id, task);
      result.push(task);
    }
    this.queue = remaining;

    return result;
  }

  async complete(id: EntityId, result: CellOutput): Promise<void> {
    const task = this.running.get(id);
    if (!task) throw new CellError('TASK_NOT_FOUND', `Task ${id} not found in running set`);

    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.result = result;
    this.totalWaitTime += (new Date(task.completedAt).getTime() - new Date(task.scheduledAt).getTime());
    this.totalExecutionTime += (new Date(task.completedAt).getTime() - new Date(task.startedAt!).getTime());
    this.taskCount++;

    this.completed.push(task);
    this.running.delete(id);

    if (task.resolve) task.resolve(result);
  }

  async fail(id: EntityId, error: CogError): Promise<void> {
    const task = this.running.get(id);
    if (!task) throw new CellError('TASK_NOT_FOUND', `Task ${id} not found in running set`);

    task.retryCount++;
    if (task.retryCount < task.maxRetries) {
      // Re-enqueue for retry
      task.status = 'queued';
      task.scheduledAt = new Date().toISOString();
      this.queue.push(task);
      this.running.delete(id);
      return;
    }

    task.status = 'failed';
    task.error = error;
    this.failed.push(task);
    this.running.delete(id);

    if (task.reject) task.reject(error);
  }

  async cancel(id: EntityId): Promise<void> {
    this.cancelled.add(id);
    // Remove from queue if present
    this.queue = this.queue.filter(t => t.id !== id);
    // If running, mark for cancellation
    const task = this.running.get(id);
    if (task) {
      task.status = 'cancelled';
      this.running.delete(id);
    }
  }

  async getStatus(id: EntityId): Promise<TaskStatus> {
    if (this.running.has(id)) return 'running';
    if (this.queue.find(t => t.id === id)) return 'queued';
    if (this.completed.find(t => t.id === id)) return 'completed';
    if (this.failed.find(t => t.id === id)) return 'failed';
    return 'cancelled';
  }

  async getQueueLength(): Promise<number> {
    return this.queue.length;
  }

  async stats(): Promise<SchedulerStats> {
    return {
      queued: this.queue.length,
      running: this.running.size,
      completed: this.completed.length + this.failed.filter(t => t.status === 'cancelled').length,
      failed: this.failed.filter(t => t.status === 'failed').length,
      cancelled: this.cancelled.size,
      avgWaitTime: this.taskCount > 0 ? this.totalWaitTime / this.taskCount : 0,
      avgExecutionTime: this.taskCount > 0 ? this.totalExecutionTime / this.taskCount : 0,
    };
  }

  // Start polling loop
  start(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(async () => {
      if (this.running.size >= this.maxConcurrency) return;
      const available = this.maxConcurrency - this.running.size;
      const tasks = await this.dequeue({ limit: available });
      for (const task of tasks) {
        this.processor(task)
          .then(result => this.complete(task.id, result))
          .catch(error => this.fail(task.id, error));
      }
    }, this.pollingInterval);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}