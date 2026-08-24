import { sha256Hex, stableHash128, type IntegrityHashAlgorithm } from '@cos/core';
import type { DurableEvent, EventLogCursor, IEventLog } from './event-log';

export interface SnapshotManifest {
  snapshotId: string;
  schemaVersion: string;
  createdAt: string;
  cursor: EventLogCursor;
  stateHash: string;
  /** Missing means pre-hardening fnv128 compatibility snapshot. */
  hashAlgorithm?: IntegrityHashAlgorithm;
  metadata: Record<string, string | number | boolean | null>;
}

export interface StoredSnapshot<S> {
  manifest: SnapshotManifest;
  state: S;
}

export interface ISnapshotStore<S> {
  save(snapshot: StoredSnapshot<S>): Promise<void>;
  get(snapshotId: string): Promise<StoredSnapshot<S> | null>;
  latest(): Promise<StoredSnapshot<S> | null>;
  list(): Promise<SnapshotManifest[]>;
  clear(): Promise<void>;
}

export interface ProjectionAdapter<S> {
  exportState(): Promise<S>;
  importState(state: S): Promise<void>;
  reset(): Promise<void>;
  applyEvent(event: DurableEvent): Promise<void>;
}

export interface RecoveryReport {
  snapshotId: string | null;
  snapshotCursor: EventLogCursor;
  replayedEvents: number;
  finalCursor: EventLogCursor;
  expectedSnapshotHash: string | null;
  restoredSnapshotHash: string | null;
  finalStateHash: string;
  hashAlgorithm: IntegrityHashAlgorithm;
}

export class InMemorySnapshotStore<S> implements ISnapshotStore<S> {
  private snapshots = new Map<string, StoredSnapshot<S>>();
  private order: string[] = [];

  async save(snapshot: StoredSnapshot<S>): Promise<void> {
    if (this.snapshots.has(snapshot.manifest.snapshotId)) {
      throw new Error(`Snapshot ${snapshot.manifest.snapshotId} already exists`);
    }
    // Clone to prevent caller mutation after the integrity hash was computed.
    const copy = structuredClone(snapshot);
    this.snapshots.set(snapshot.manifest.snapshotId, copy);
    this.order.push(snapshot.manifest.snapshotId);
  }

  async get(snapshotId: string): Promise<StoredSnapshot<S> | null> {
    const snapshot = this.snapshots.get(snapshotId);
    return snapshot ? structuredClone(snapshot) : null;
  }

  async latest(): Promise<StoredSnapshot<S> | null> {
    const id = this.order[this.order.length - 1];
    const snapshot = id ? this.snapshots.get(id) : null;
    return snapshot ? structuredClone(snapshot) : null;
  }

  async list(): Promise<SnapshotManifest[]> {
    return this.order
      .map(id => structuredClone(this.snapshots.get(id)!.manifest))
      .sort((a, b) => a.cursor.sequence - b.cursor.sequence);
  }

  async clear(): Promise<void> {
    this.snapshots.clear();
    this.order = [];
  }
}

/**
 * Coordinates deterministic snapshot creation and disaster-recovery replay.
 * New snapshots use SHA-256 for integrity. Legacy manifests without an
 * algorithm remain readable with fnv128 during the convergence window.
 */
export class RecoveryCoordinator<S> {
  constructor(
    private readonly eventLog: IEventLog,
    private readonly snapshotStore: ISnapshotStore<S>,
    private readonly projection: ProjectionAdapter<S>,
    private readonly schemaVersion = '1',
  ) {}

  async createSnapshot(
    snapshotId: string,
    metadata: SnapshotManifest['metadata'] = {},
  ): Promise<StoredSnapshot<S>> {
    const id = snapshotId.trim();
    if (!id) throw new Error('snapshotId must not be empty');

    const state = await this.projection.exportState();
    const cursor = await this.eventLog.latestCursor();
    const snapshot: StoredSnapshot<S> = {
      manifest: {
        snapshotId: id,
        schemaVersion: this.schemaVersion,
        createdAt: new Date().toISOString(),
        cursor,
        stateHash: await sha256Hex(state),
        hashAlgorithm: 'sha256',
        metadata: { ...metadata },
      },
      state: structuredClone(state),
    };

    await this.snapshotStore.save(snapshot);
    return structuredClone(snapshot);
  }

  async restoreLatestAndReplay(batchSize = 1000): Promise<RecoveryReport> {
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new Error(`batchSize must be a positive integer; received ${batchSize}`);
    }

    await this.projection.reset();
    const snapshot = await this.snapshotStore.latest();
    let cursor: EventLogCursor = { sequence: 0 };
    let restoredSnapshotHash: string | null = null;
    let reportAlgorithm: IntegrityHashAlgorithm = 'sha256';

    if (snapshot) {
      if (snapshot.manifest.schemaVersion !== this.schemaVersion) {
        throw new Error(
          `Snapshot schema mismatch: expected ${this.schemaVersion}, received ${snapshot.manifest.schemaVersion}`,
        );
      }

      const algorithm = snapshot.manifest.hashAlgorithm || 'fnv128-legacy';
      reportAlgorithm = algorithm;
      const storedHash = await this.hash(snapshot.state, algorithm);
      if (storedHash !== snapshot.manifest.stateHash) {
        throw new Error(
          `Snapshot integrity failure for ${snapshot.manifest.snapshotId}: ${storedHash} != ${snapshot.manifest.stateHash}`,
        );
      }

      await this.projection.importState(structuredClone(snapshot.state));
      const roundTripState = await this.projection.exportState();
      restoredSnapshotHash = await this.hash(roundTripState, algorithm);
      if (restoredSnapshotHash !== snapshot.manifest.stateHash) {
        throw new Error(
          `Projection restore mismatch for ${snapshot.manifest.snapshotId}: ${restoredSnapshotHash} != ${snapshot.manifest.stateHash}`,
        );
      }
      cursor = { ...snapshot.manifest.cursor };
    }

    let replayedEvents = 0;
    while (true) {
      const events = await this.eventLog.readFrom(cursor, batchSize);
      if (events.length === 0) break;

      for (const event of events) {
        if (event.sequence <= cursor.sequence) {
          throw new Error(`Event-log replay ordering violation: ${event.sequence} <= ${cursor.sequence}`);
        }
        await this.projection.applyEvent(event);
        cursor = { sequence: event.sequence };
        replayedEvents += 1;
      }

      if (events.length < batchSize) break;
    }

    const finalState = await this.projection.exportState();
    return {
      snapshotId: snapshot?.manifest.snapshotId || null,
      snapshotCursor: snapshot?.manifest.cursor ? { ...snapshot.manifest.cursor } : { sequence: 0 },
      replayedEvents,
      finalCursor: cursor,
      expectedSnapshotHash: snapshot?.manifest.stateHash || null,
      restoredSnapshotHash,
      // Final state always reports current authority algorithm even when the
      // base snapshot was legacy, making migration visible in recovery evidence.
      finalStateHash: await sha256Hex(finalState),
      hashAlgorithm: snapshot ? reportAlgorithm : 'sha256',
    };
  }

  private async hash(state: S, algorithm: IntegrityHashAlgorithm): Promise<string> {
    if (algorithm === 'sha256') return sha256Hex(state);
    if (algorithm === 'fnv128-legacy') return stableHash128(state);
    throw new Error(`Unsupported snapshot hash algorithm: ${String(algorithm)}`);
  }
}
