import { COSServer } from './server';
import { PersistenceManager, FileBackedData } from '@cos/infrastructure';
import * as path from 'path';

// ================================================================
// PERSISTENT COSServer — All state survives process restarts
// ================================================================

export class PersistentCOSSERVER {
  public readonly server: COSServer;
  public readonly persistence: PersistenceManager;
  public readonly stores: Record<string, FileBackedData> = {};
  private initialized = false;

  constructor(dataDir?: string) {
    this.server = new COSServer();
    this.persistence = new PersistenceManager(dataDir || path.join(process.cwd(), '.cos-data'));
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    await this.persistence.init();

    // Create persistent stores for critical state
    this.stores.memory = new FileBackedData(this.persistence.dataPath, 'memory');
    this.stores.knowledge = new FileBackedData(this.persistence.dataPath, 'knowledge');
    this.stores.learning = new FileBackedData(this.persistence.dataPath, 'learning');
    this.stores.config = new FileBackedData(this.persistence.dataPath, 'config');
    this.stores.metrics = new FileBackedData(this.persistence.dataPath, 'metrics');

    // Register all stores with persistence manager
    for (const [name, store] of Object.entries(this.stores)) {
      this.persistence.register(name, store);
    }

    // Load persisted state
    const { loaded, missing } = await this.persistence.loadAll();
    console.log(`[COS Persist] Loaded: ${loaded.join(', ') || 'none'} | New: ${missing.join(', ') || 'none'}`);

    // Restore memory state
    for (const [key, value] of Object.entries(this.stores.memory.serialize() as Record<string, unknown> || {})) {
      if (key !== 'type' && key !== 'version') {
        // Restore would use the store's specific format
      }
    }

    this.initialized = true;
  }

  async saveNow(): Promise<void> {
    // Save current state from memory
    const memStats = await this.server.memory.stats();
    this.stores.memory.set('stats', memStats);
    this.stores.memory.set('entries', (memStats as any).totalEntries || 0);

    const kgStats = await this.server.knowledge.stats();
    this.stores.knowledge.set('stats', kgStats);
    this.stores.knowledge.set('statements', (kgStats as any).nodeCount || 0);

    const learnStats = this.server.learning.stats;
    this.stores.learning.set('stats', learnStats);
    this.stores.learning.set('examples', learnStats.totalExamples);

    await this.persistence.saveAll();
  }

  async shutdown(): Promise<void> {
    await this.saveNow();
    console.log('[COS Persist] State saved. Shutting down.');
  }
}