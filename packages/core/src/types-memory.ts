// Memory system types — 12 memory layers

import { EntityId, Timestamp, Version, Confidence, Metadata } from './types-core';

/** Available memory layers */
export type MemoryLayer =
  | 'working' | 'short_term' | 'long_term' | 'semantic'
  | 'procedural' | 'episodic' | 'temporal' | 'spatial'
  | 'vector' | 'knowledge_graph' | 'cache' | 'reflection';

/** A single memory entry with metadata */
export interface MemoryEntry {
  id: EntityId;
  layer: MemoryLayer;
  content: unknown;
  representations: Record<string, unknown>;
  importance: number;
  ttl: number | null;
  version: Version;
  createdAt: Timestamp;
  lastAccessed: Timestamp;
  accessCount: number;
  consolidated: boolean;
  compressed: boolean;
  tags: string[];
  source: EntityId;
  metadata: Metadata;
}

/** Memory query parameters */
export interface MemoryQuery {
  layer?: MemoryLayer;
  content?: string;
  embedding?: Float32Array;
  tags?: string[];
  importance?: { min?: number; max?: number };
  timeRange?: { from?: Timestamp; to?: Timestamp };
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'lastAccessed' | 'accessCount' | 'importance';
  sortOrder?: 'asc' | 'desc';
}

/** Memory store interface */
export interface IMemoryStore {
  store(entry: MemoryEntry): Promise<EntityId>;
  retrieve(id: EntityId): Promise<MemoryEntry | null>;
  query(q: MemoryQuery): Promise<MemoryEntry[]>;
  update(id: EntityId, updates: Partial<MemoryEntry>): Promise<void>;
  delete(id: EntityId): Promise<void>;
  clear(layer?: MemoryLayer): Promise<void>;
  stats(): Promise<MemoryStoreStats>;
}

/** Memory store statistics */
export interface MemoryStoreStats {
  totalEntries: number;
  byLayer: Record<MemoryLayer, number>;
  totalSizeBytes: number;
  oldestEntry: Timestamp | null;
  newestEntry: Timestamp | null;
}