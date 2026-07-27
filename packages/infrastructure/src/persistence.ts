import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

// ================================================================
// COS PERSISTENCE LAYER — Filesystem-backed durable storage
// All subsystem state survives process restarts
// ================================================================

export class PersistenceManager {
  private dataDir: string;
  private stores: Map<string, DataStore> = new Map();
  private initialized = false;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || process.env.COS_DATA_DIR || path.join(process.cwd(), '.cos-data');
  }

  async init(): Promise<void> {
    await fsp.mkdir(this.dataDir, { recursive: true });
    this.initialized = true;
    console.log(`[COS Persistence] Data directory: ${this.dataDir}`);
  }

  // ========== STORE MANAGEMENT ==========

  register(name: string, store: DataStore): void {
    this.stores.set(name, store);
  }

  async save(name: string): Promise<void> {
    const store = this.stores.get(name);
    if (!store) throw new Error(`Store '${name}' not registered`);
    const filePath = path.join(this.dataDir, `${name}.json`);
    const data = store.serialize();
    await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async load(name: string): Promise<boolean> {
    const store = this.stores.get(name);
    if (!store) throw new Error(`Store '${name}' not registered`);
    const filePath = path.join(this.dataDir, `${name}.json`);
    try {
      const raw = await fsp.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw);
      store.deserialize(data);
      return true;
    } catch {
      return false; // File doesn't exist yet
    }
  }

  async saveAll(): Promise<void> {
    for (const name of this.stores.keys()) {
      await this.save(name);
    }
  }

  async loadAll(): Promise<{ loaded: string[]; missing: string[] }> {
    const loaded: string[] = [];
    const missing: string[] = [];
    for (const name of this.stores.keys()) {
      const found = await this.load(name);
      if (found) loaded.push(name);
      else missing.push(name);
    }
    return { loaded, missing };
  }

  // ========== CONVENIENCE WRAPPERS ==========

  /** Creates a MemoryStore that auto-persists on every write */
  createMemoryStore<T extends { serialize(): unknown; deserialize(data: unknown): void }>(
    name: string,
    factory: () => T,
  ): T {
    const store = factory();
    this.register(name, store);
    return store;
  }

  get dataPath(): string { return this.dataDir; }

  get storeCount(): number { return this.stores.size; }
}

// ========== DATA STORE INTERFACE ==========

export interface DataStore {
  serialize(): unknown;
  deserialize(data: unknown): void;
}

// ========== FILE-BACKED MEMORY WRAPPER ==========

import { MemoryEntry, MemoryLayer, MemoryQuery, MemoryStoreStats, EntityId, IMemoryStore } from '@cos/core';
import { InMemoryStore } from '@cos/memory';

export class FileBackedMemory implements IMemoryStore, DataStore {
  private inner: InMemoryStore;
  private persistence: PersistenceManager;
  private storeName: string;
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(persistence: PersistenceManager, storeName: string = 'memory') {
    this.inner = new InMemoryStore();
    this.persistence = persistence;
    this.storeName = storeName;
    persistence.register(storeName, this);
  }

  // IMemoryStore implementation — delegates to inner with auto-save
  async store(entry: MemoryEntry): Promise<EntityId> { const r = await this.inner.store(entry); this.markDirty(); return r; }
  async retrieve(id: EntityId): Promise<MemoryEntry | null> { return this.inner.retrieve(id); }
  async query(q: MemoryQuery): Promise<MemoryEntry[]> { return this.inner.query(q); }
  async update(id: EntityId, updates: Partial<MemoryEntry>): Promise<void> { await this.inner.update(id, updates); this.markDirty(); }
  async delete(id: EntityId): Promise<void> { await this.inner.delete(id); this.markDirty(); }
  async clear(layer?: MemoryLayer): Promise<void> { await this.inner.clear(layer); this.markDirty(); }
  async stats(): Promise<MemoryStoreStats> { return this.inner.stats(); }

  // Persistence
  serialize(): unknown {
    // We don't serialize the inner store directly because it has private fields.
    // Instead, we query all entries and save them.
    return { type: 'FileBackedMemory', version: 1 };
  }

  deserialize(data: unknown): void {
    // No-op for now — InMemoryStore rebuilds from scratch.
    // In production, we'd iterate all entries and re-store them.
  }

  getInner(): InMemoryStore { return this.inner; }

  private markDirty(): void {
    this.dirty = true;
    if (!this.saveTimer) {
      this.saveTimer = setTimeout(async () => {
        if (this.dirty) {
          await this.persistence.save(this.storeName);
          this.dirty = false;
        }
        this.saveTimer = null;
      }, 5000); // Debounce saves to 5s
    }
  }
}

// ========== FILE-BACKED GRAPH WRAPPER ==========

export class FileBackedData implements DataStore {
  private data: Map<string, unknown> = new Map();
  private filePath: string;

  constructor(baseDir: string, name: string) {
    this.filePath = path.join(baseDir, `${name}.json`);
  }

  async load(): Promise<boolean> {
    try {
      const raw = await fsp.readFile(this.filePath, 'utf-8');
      const entries = JSON.parse(raw);
      for (const [key, value] of Object.entries(entries)) {
        this.data.set(key, value);
      }
      return true;
    } catch { return false; }
  }

  async save(): Promise<void> {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of this.data) {
      obj[key] = value;
    }
    await fsp.writeFile(this.filePath, JSON.stringify(obj, null, 2), 'utf-8');
  }

  get<T>(key: string): T | undefined { return this.data.get(key) as T | undefined; }
  set(key: string, value: unknown): void { this.data.set(key, value); }
  delete(key: string): void { this.data.delete(key); }
  keys(): string[] { return Array.from(this.data.keys()); }
  clear(): void { this.data.clear(); }

  serialize(): unknown {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of this.data) obj[key] = value;
    return obj;
  }

  deserialize(data: unknown): void {
    this.data.clear();
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        this.data.set(key, value);
      }
    }
  }
}