import * as fsp from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  MemoryEntry, MemoryLayer, MemoryQuery, MemoryStoreStats, EntityId, IMemoryStore,
} from '@cos/core';
import { InMemoryStore } from '@cos/memory';

// ================================================================
// COS PERSISTENCE LAYER — Filesystem-backed durable storage
// All subsystem state survives process restarts
// ================================================================

export type PersistenceErrorCode =
  | 'PERSISTENCE_READ_FAILED'
  | 'PERSISTENCE_PARSE_FAILED'
  | 'PERSISTENCE_SCHEMA_INVALID'
  | 'PERSISTENCE_SERIALIZE_FAILED'
  | 'PERSISTENCE_WRITE_FAILED'
  | 'PERSISTENCE_DIRTY_LOAD';

export class PersistenceError extends Error {
  constructor(
    public readonly code: PersistenceErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'PersistenceError';
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errnoCode(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object' || !('code' in error)) return undefined;
  const code = Reflect.get(error, 'code');
  return typeof code === 'string' ? code : undefined;
}

function storeFileName(name: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error(`Invalid persistence store name '${name}'`);
  }
  return `${name}.json`;
}

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
    storeFileName(name);
    this.stores.set(name, store);
  }

  async save(name: string): Promise<void> {
    const store = this.stores.get(name);
    if (!store) throw new Error(`Store '${name}' not registered`);
    if (!this.initialized) throw new Error('PersistenceManager.init() must complete before save()');

    const filePath = path.join(this.dataDir, storeFileName(name));
    let payload: string;
    try {
      const serialized = JSON.stringify(store.serialize(), null, 2);
      if (serialized === undefined) {
        throw new Error('Top-level snapshot is not JSON serializable');
      }
      payload = serialized;
    } catch (error) {
      throw new PersistenceError(
        'PERSISTENCE_SERIALIZE_FAILED',
        `Failed to serialize persistence store '${name}': ${errorMessage(error)}`,
        error,
      );
    }

    const tempPath = path.join(
      this.dataDir,
      `.${name}.${process.pid}.${randomUUID()}.tmp`,
    );

    try {
      // Same-directory temp + rename prevents a failed write from partially
      // replacing the prior authority file. We fsync the temp file before the
      // rename. A directory fsync is intentionally not claimed here; that is
      // the remaining power-loss durability boundary for this JSON backend.
      await fsp.writeFile(tempPath, payload, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      const handle = await fsp.open(tempPath, 'r+');
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fsp.rename(tempPath, filePath);
    } catch (error) {
      let cleanupError: unknown;
      try {
        await fsp.unlink(tempPath);
      } catch (candidate) {
        if (errnoCode(candidate) !== 'ENOENT') cleanupError = candidate;
      }
      const cause = cleanupError === undefined
        ? error
        : new AggregateError([error, cleanupError], 'Persistence temp-file cleanup also failed');
      throw new PersistenceError(
        'PERSISTENCE_WRITE_FAILED',
        `Failed to atomically persist store '${name}': ${errorMessage(error)}`,
        cause,
      );
    }
  }

  async load(name: string): Promise<boolean> {
    const store = this.stores.get(name);
    if (!store) throw new Error(`Store '${name}' not registered`);
    if (!this.initialized) throw new Error('PersistenceManager.init() must complete before load()');

    const filePath = path.join(this.dataDir, storeFileName(name));
    let raw: string;
    try {
      raw = await fsp.readFile(filePath, 'utf8');
    } catch (error) {
      if (errnoCode(error) === 'ENOENT') return false;
      throw new PersistenceError(
        'PERSISTENCE_READ_FAILED',
        `Failed to read persistence store '${name}': ${errorMessage(error)}`,
        error,
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(raw) as unknown;
    } catch (error) {
      throw new PersistenceError(
        'PERSISTENCE_PARSE_FAILED',
        `Corrupt JSON in persistence store '${name}': ${errorMessage(error)}`,
        error,
      );
    }

    try {
      await store.deserialize(data);
    } catch (error) {
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError(
        'PERSISTENCE_SCHEMA_INVALID',
        `Invalid snapshot for persistence store '${name}': ${errorMessage(error)}`,
        error,
      );
    }
    return true;
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

  /** Creates a MemoryStore registered with this persistence authority. */
  createMemoryStore<T extends { serialize(): unknown; deserialize(data: unknown): void | Promise<void> }>(
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
  deserialize(data: unknown): void | Promise<void>;
}

// ========== FILE-BACKED MEMORY WRAPPER ==========

interface FileBackedMemorySnapshotV1 {
  type: 'FileBackedMemory';
  version: 1;
  entries: MemoryEntry[];
}

const MEMORY_LAYERS = new Set<string>([
  'working', 'short_term', 'long_term', 'semantic',
  'procedural', 'episodic', 'temporal', 'spatial',
  'vector', 'knowledge_graph', 'cache', 'reflection',
]);

const MEMORY_ENTRY_KEYS = new Set([
  'id', 'layer', 'content', 'representations', 'importance', 'ttl', 'version',
  'createdAt', 'lastAccessed', 'accessCount', 'consolidated', 'compressed',
  'tags', 'source', 'metadata',
]);

function plainRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  return value as Record<string, unknown>;
}

function assertJsonValue(value: unknown, location: string, stack: Set<object> = new Set()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${location} contains a non-finite number`);
    return;
  }
  if (typeof value !== 'object') {
    throw new Error(`${location} contains a non-JSON ${typeof value} value`);
  }
  if (stack.has(value)) throw new Error(`${location} contains a cycle`);
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new Error(`${location} contains symbol properties`);
  }

  stack.add(value);
  try {
    if (Array.isArray(value)) {
      const keys = Object.keys(value);
      if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
        throw new Error(`${location} contains a sparse or extended array`);
      }
      for (let index = 0; index < value.length; index++) {
        assertJsonValue(value[index], `${location}[${index}]`, stack);
      }
      return;
    }

    if (plainRecord(value) === null) {
      throw new Error(`${location} contains a non-plain object`);
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!descriptor.enumerable || !('value' in descriptor)) {
        throw new Error(`${location}.${key} contains an accessor or hidden property`);
      }
      assertJsonValue(descriptor.value, `${location}.${key}`, stack);
    }
  } finally {
    stack.delete(value);
  }
}

function assertExactKeys(
  record: Record<string, unknown>,
  expected: ReadonlySet<string>,
  location: string,
): void {
  for (const key of Object.keys(record)) {
    if (!expected.has(key)) throw new Error(`${location} contains unsupported key '${key}'`);
  }
  for (const key of expected) {
    if (!(key in record)) throw new Error(`${location} is missing required key '${key}'`);
  }
}

function assertVersion(value: unknown, location: string): void {
  const record = plainRecord(value);
  if (!record) throw new Error(`${location} must be an object`);
  assertExactKeys(record, new Set(['major', 'minor', 'patch']), location);
  for (const key of ['major', 'minor', 'patch'] as const) {
    const part = record[key];
    if (!Number.isInteger(part) || (part as number) < 0) {
      throw new Error(`${location}.${key} must be a non-negative integer`);
    }
  }
}

function assertTimestamp(value: unknown, location: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${location} must be a valid timestamp`);
  }
}

function assertMemoryEntry(value: unknown, index: number): asserts value is MemoryEntry {
  const location = `snapshot.entries[${index}]`;
  const record = plainRecord(value);
  if (!record) throw new Error(`${location} must be an object`);
  assertExactKeys(record, MEMORY_ENTRY_KEYS, location);

  if (typeof record.id !== 'string' || record.id.length === 0) throw new Error(`${location}.id must be non-empty`);
  if (typeof record.layer !== 'string' || !MEMORY_LAYERS.has(record.layer)) throw new Error(`${location}.layer is invalid`);
  if (typeof record.importance !== 'number' || !Number.isFinite(record.importance)) throw new Error(`${location}.importance is invalid`);
  if (record.ttl !== null && (typeof record.ttl !== 'number' || !Number.isFinite(record.ttl))) throw new Error(`${location}.ttl is invalid`);
  assertVersion(record.version, `${location}.version`);
  assertTimestamp(record.createdAt, `${location}.createdAt`);
  assertTimestamp(record.lastAccessed, `${location}.lastAccessed`);
  if (typeof record.accessCount !== 'number' || !Number.isInteger(record.accessCount) || record.accessCount < 0) throw new Error(`${location}.accessCount is invalid`);
  if (typeof record.consolidated !== 'boolean') throw new Error(`${location}.consolidated is invalid`);
  if (typeof record.compressed !== 'boolean') throw new Error(`${location}.compressed is invalid`);
  if (!Array.isArray(record.tags) || !record.tags.every(tag => typeof tag === 'string')) throw new Error(`${location}.tags is invalid`);
  if (typeof record.source !== 'string') throw new Error(`${location}.source is invalid`);
  if (plainRecord(record.representations) === null) throw new Error(`${location}.representations must be an object`);
  if (plainRecord(record.metadata) === null) throw new Error(`${location}.metadata must be an object`);
}

function parseMemorySnapshot(data: unknown): FileBackedMemorySnapshotV1 {
  assertJsonValue(data, 'snapshot');
  const record = plainRecord(data);
  if (!record) throw new Error('snapshot must be an object');
  assertExactKeys(record, new Set(['type', 'version', 'entries']), 'snapshot');
  if (record.type !== 'FileBackedMemory') throw new Error('snapshot.type must be FileBackedMemory');
  if (record.version !== 1) throw new Error(`Unsupported FileBackedMemory snapshot version '${String(record.version)}'`);
  if (!Array.isArray(record.entries)) throw new Error('snapshot.entries must be an array');

  const ids = new Set<string>();
  for (let index = 0; index < record.entries.length; index++) {
    const entry = record.entries[index];
    assertMemoryEntry(entry, index);
    if (ids.has(entry.id)) throw new Error(`snapshot contains duplicate memory id '${entry.id}'`);
    ids.add(entry.id);
  }

  return {
    type: 'FileBackedMemory',
    version: 1,
    entries: record.entries as MemoryEntry[],
  };
}

export class FileBackedMemory implements IMemoryStore, DataStore {
  private inner: InMemoryStore;
  private persistence: PersistenceManager;
  private storeName: string;
  private dirty = false;
  private mutationGeneration = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private flushPromise: Promise<void> | null = null;
  private disposePromise: Promise<void> | null = null;
  private disposed = false;

  constructor(persistence: PersistenceManager, storeName: string = 'memory') {
    this.inner = new InMemoryStore();
    this.persistence = persistence;
    this.storeName = storeName;
    persistence.register(storeName, this);
  }

  // IMemoryStore implementation — delegates to inner with durable dirty tracking
  async store(entry: MemoryEntry): Promise<EntityId> {
    this.assertOpen();
    const result = await this.inner.store(entry);
    this.markDirty();
    return result;
  }

  async retrieve(id: EntityId): Promise<MemoryEntry | null> { return this.inner.retrieve(id); }
  async query(q: MemoryQuery): Promise<MemoryEntry[]> { return this.inner.query(q); }

  async update(id: EntityId, updates: Partial<MemoryEntry>): Promise<void> {
    this.assertOpen();
    await this.inner.update(id, updates);
    this.markDirty();
  }

  async delete(id: EntityId): Promise<void> {
    this.assertOpen();
    await this.inner.delete(id);
    this.markDirty();
  }

  async clear(layer?: MemoryLayer): Promise<void> {
    this.assertOpen();
    await this.inner.clear(layer);
    this.markDirty();
  }

  async stats(): Promise<MemoryStoreStats> { return this.inner.stats(); }

  serialize(): unknown {
    return parseMemorySnapshot({
      type: 'FileBackedMemory',
      version: 1,
      entries: this.inner.exportSnapshot(),
    });
  }

  async deserialize(data: unknown): Promise<void> {
    if (this.dirty) {
      throw new PersistenceError(
        'PERSISTENCE_DIRTY_LOAD',
        `Refusing to load '${this.storeName}' over unsaved memory mutations`,
      );
    }
    const snapshot = parseMemorySnapshot(data);
    const candidate = new InMemoryStore();
    try {
      for (const entry of snapshot.entries) {
        await candidate.store(entry);
      }
    } catch (error) {
      candidate.dispose();
      throw new PersistenceError(
        'PERSISTENCE_SCHEMA_INVALID',
        `Failed to reconstruct memory snapshot '${this.storeName}': ${errorMessage(error)}`,
        error,
      );
    }

    this.cancelSaveTimer();
    const previous = this.inner;
    this.inner = candidate;
    previous.dispose();
    this.dirty = false;
    this.mutationGeneration = 0;
  }

  /** Persist all mutations observed before this call returns. */
  async flush(): Promise<void> {
    this.cancelSaveTimer();

    if (this.flushPromise) {
      await this.flushPromise;
      if (this.dirty) return this.flush();
      return;
    }
    if (!this.dirty) return;

    const operation = (async () => {
      while (this.dirty) {
        const generation = this.mutationGeneration;
        await this.persistence.save(this.storeName);
        if (this.mutationGeneration === generation) this.dirty = false;
      }
    })();
    this.flushPromise = operation;
    try {
      await operation;
    } finally {
      if (this.flushPromise === operation) this.flushPromise = null;
    }
  }

  /** Flush durable state and stop housekeeping. Idempotent. */
  async dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise;
    this.disposed = true;
    this.cancelSaveTimer();
    this.disposePromise = (async () => {
      try {
        await this.flush();
      } finally {
        this.inner.dispose();
      }
    })();
    return this.disposePromise;
  }

  getInner(): InMemoryStore { return this.inner; }

  private assertOpen(): void {
    if (this.disposed) throw new Error(`FileBackedMemory '${this.storeName}' is disposed`);
  }

  private cancelSaveTimer(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  private markDirty(): void {
    this.dirty = true;
    this.mutationGeneration++;
    if (this.saveTimer !== null) return;

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush().catch(error => {
        // Preserve dirty=true for explicit retry/shutdown while preventing an
        // unhandled rejection from a background autosave.
        console.error(`[COS Persistence] Autosave failed for '${this.storeName}': ${errorMessage(error)}`);
      });
    }, 5000);
    this.saveTimer.unref();
  }
}

// ========== FILE-BACKED GRAPH WRAPPER ==========

export class FileBackedData implements DataStore {
  private data: Map<string, unknown> = new Map();
  private filePath: string;

  constructor(baseDir: string, name: string) {
    this.filePath = path.join(baseDir, storeFileName(name));
  }

  async load(): Promise<boolean> {
    try {
      const raw = await fsp.readFile(this.filePath, 'utf8');
      const entries = JSON.parse(raw) as unknown;
      this.deserialize(entries);
      return true;
    } catch (error) {
      if (errnoCode(error) === 'ENOENT') return false;
      throw error;
    }
  }

  async save(): Promise<void> {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of this.data) obj[key] = value;
    await fsp.writeFile(this.filePath, JSON.stringify(obj, null, 2), 'utf8');
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
