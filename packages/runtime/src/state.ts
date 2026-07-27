import { EntityId, Metadata, Timestamp } from '@cos/core';
import { generateId } from '@cos/core';

interface StateSnapshot {
  id: string;
  timestamp: Timestamp;
  data: unknown;
  entityId: EntityId;
  version: number;
}

export class StateManager {
  private states: Map<EntityId, unknown> = new Map();
  private snapshots: StateSnapshot[] = [];
  private versions: Map<EntityId, number> = new Map();
  private maxSnapshots: number;

  constructor(maxSnapshots: number = 100) {
    this.maxSnapshots = maxSnapshots;
  }

  get<T>(id: EntityId): T | undefined {
    return this.states.get(id) as T | undefined;
  }

  set<T>(id: EntityId, state: T): void {
    const version = (this.versions.get(id) || 0) + 1;
    this.versions.set(id, version);

    // Snapshot current state before overwriting
    const current = this.states.get(id);
    if (current !== undefined) {
      this.snapshots.push({
        id: generateId(),
        timestamp: new Date().toISOString(),
        data: current,
        entityId: id,
        version: version - 1,
      });
      if (this.snapshots.length > this.maxSnapshots) {
        this.snapshots = this.snapshots.slice(-this.maxSnapshots);
      }
    }

    this.states.set(id, state);
  }

  update<T extends Record<string, unknown>>(id: EntityId, updates: Partial<T>): void {
    const current = this.states.get(id);
    if (current && typeof current === 'object') {
      this.set(id, { ...(current as any), ...updates });
    } else {
      this.set(id, updates);
    }
  }

  delete(id: EntityId): void {
    this.states.delete(id);
    this.versions.delete(id);
  }

  getHistory(id: EntityId, limit: number = 10): StateSnapshot[] {
    return this.snapshots
      .filter(s => s.entityId === id)
      .slice(-limit);
  }

  getAllTimestamps(): Map<EntityId, Timestamp[]> {
    const result = new Map<EntityId, Timestamp[]>();
    for (const snap of this.snapshots) {
      if (!result.has(snap.entityId)) result.set(snap.entityId, []);
      result.get(snap.entityId)!.push(snap.timestamp);
    }
    return result;
  }

  clear(): void {
    this.states.clear();
    this.snapshots = [];
    this.versions.clear();
  }

  get size(): number {
    return this.states.size;
  }

  get snapshotCount(): number {
    return this.snapshots.length;
  }
}