import { COSServer } from './server';
import { PersistenceManager, FileBackedData, FileBackedMemory } from '@cos/infrastructure';
import { MemoryManager } from '@cos/memory';
import * as path from 'path';

// ================================================================
// PERSISTENT COSServer — Durable memory authority + derived snapshots
// ================================================================

export class PersistentCOSSERVER {
  public readonly server: COSServer;
  public readonly persistence: PersistenceManager;
  public readonly memoryStore: FileBackedMemory;
  public readonly stores: Record<string, FileBackedData> = {};
  private initialized = false;
  private shutdownPromise: Promise<void> | null = null;

  constructor(dataDir?: string) {
    this.persistence = new PersistenceManager(dataDir || path.join(process.cwd(), '.cos-data'));
    this.memoryStore = new FileBackedMemory(this.persistence, 'memory');
    const memory = new MemoryManager(this.memoryStore);
    this.server = new COSServer(undefined, { memory });
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    await this.persistence.init();

    // Non-memory stores are derived/supporting state. Canonical memory is the
    // FileBackedMemory instance injected into COSServer above.
    if (!this.stores.knowledge) this.stores.knowledge = new FileBackedData(this.persistence.dataPath, 'knowledge');
    if (!this.stores.learning) this.stores.learning = new FileBackedData(this.persistence.dataPath, 'learning');
    if (!this.stores.config) this.stores.config = new FileBackedData(this.persistence.dataPath, 'config');
    if (!this.stores.metrics) this.stores.metrics = new FileBackedData(this.persistence.dataPath, 'metrics');

    for (const [name, store] of Object.entries(this.stores)) {
      this.persistence.register(name, store);
    }

    // Corrupt/schema-invalid memory throws here; only ENOENT is reported as
    // missing by PersistenceManager.load().
    const { loaded, missing } = await this.persistence.loadAll();
    console.log(`[COS Persist] Loaded: ${loaded.join(', ') || 'none'} | New: ${missing.join(', ') || 'none'}`);

    this.initialized = true;
  }

  async saveNow(): Promise<void> {
    // FileBackedMemory persists actual MemoryEntry authority, not derived
    // counters. Remaining stores below are explicitly supporting snapshots.
    await this.memoryStore.flush();
    if (!this.initialized) return;

    const kgStats = await this.server.knowledge.stats();
    this.stores.knowledge.set('stats', kgStats);
    this.stores.knowledge.set('statements', kgStats.nodeCount);

    const learnStats = this.server.learning.stats;
    this.stores.learning.set('stats', learnStats);
    this.stores.learning.set('examples', learnStats.totalExamples);

    for (const name of Object.keys(this.stores)) {
      await this.persistence.save(name);
    }
  }

  async shutdown(): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;
    this.shutdownPromise = this.shutdownOnce();
    return this.shutdownPromise;
  }

  private async shutdownOnce(): Promise<void> {
    const errors: unknown[] = [];

    // Stop producers before the final durability flush so no runtime mutation
    // can race behind the shutdown checkpoint.
    try {
      await this.server.shutdown();
    } catch (error) {
      errors.push(error);
    }

    try {
      await this.saveNow();
    } catch (error) {
      errors.push(error);
    }

    try {
      await this.memoryStore.dispose();
    } catch (error) {
      errors.push(error);
    }

    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Persistent COS shutdown failed');

    console.log('[COS Persist] Durable state flushed. Server shut down.');
  }
}
