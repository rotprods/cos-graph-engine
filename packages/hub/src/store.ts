// Persistencia del hub. Interfaz `Store` + impl JSON (swapvable a SQLite/D1).
import { readFileSync, writeFileSync } from 'fs';

export interface HubSnapshot {
  version: number;
  updatedAt: string;
  graph: { entities: unknown[]; relations: unknown[] };
  repoStates: Record<string, string>;
  agentIds: string[];
  workflowIds: string[];
}

export interface Store {
  save(snapshot: HubSnapshot): void;
  load(): HubSnapshot | null;
}

export class JSONStore implements Store {
  constructor(private readonly file: string) {}
  save(snapshot: HubSnapshot): void {
    writeFileSync(this.file, JSON.stringify(snapshot, null, 2), 'utf8');
  }
  load(): HubSnapshot | null {
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as HubSnapshot;
    } catch {
      return null;
    }
  }
}

export class MemoryStore implements Store {
  private snap: HubSnapshot | null = null;
  save(s: HubSnapshot): void { this.snap = s; }
  load(): HubSnapshot | null { return this.snap; }
}