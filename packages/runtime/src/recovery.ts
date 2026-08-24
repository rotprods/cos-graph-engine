import { stableHash128 } from '@cos/core';
import type { DurableEvent, EventLogCursor, IEventLog } from './event-log';

export interface SnapshotManifest {
  snapshotId: string;
  schemaVersion: string;
  createdAt: string;
  cursor: EventLogCursor;
  stateHash: string;
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
  /** Export only deterministic, canonical projection state. */
  exportState(): Promise<S>;
  /** Replace current projection state with an exact snapshot. */
  importState(state: S): Promise<void>;
  /** Reset to the empty canonical state before restore/replay. */
  reset(): Promise<void>;
  /** Apply one accepted durable event deterministically. */
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
}

/** Reference in-memory snapshot adapter. Durable stores can implement the same contract. */
export class InMemorySnapshotStore<S> implements ISnapshotStore<S> {
  private snapshots = new Map<string, StoredSnapshot<S>>();
  private order: string[] = [];

  async save(snapshot: StoredSnapshot<S>): Promise<void> {
    if (this.snapshots.has(snapshot.manifest.snapshotId)) {
      throw new Error(`Snapshot ${snapshot.manifest.snapshotId} already exists`);
    }
    this.snapshots.set(snapshot.manifest.snapshotId, snapshot);
    this.order.push(snapshot.manifest.snapshotId);
  }

  async get(snapshotId: string): Promise<StoredSnapshot<S> | null> {
    return this.snapshots.get(snapshotId) || null;
  }

  async latest(): Promise<StoredSnapshot<S> | null> {
    const id = this.order[this.order.length - 1];
    return id ? this.snapshots.get(id) || null : null;
  }

  async list(): Promise<SnapshotManifest[]> {
    return this.order
      .map(id => this.snapshots.get(id)!.manifest)
      .sort((a, b) => a.cursor.sequence - b.cursor.sequence);
  }

  async clear(): Promise<void> {
    this.snapshots.clear();
    this.order = [];
  }
}

/**
 * Coordinates deterministic snapshot creation and disaster-recovery replay.
 *
 * The coordinator does not own persistence technology. Its guarantees are the
 * protocol: snapshot state is hashed, cursor-bound, immutable by ID, and replay
 * always starts strictly after the snapshot cursor.
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
        stateHash: stableHash128(state),
        metadata: { ...metadata },
      },
      state,
    };

    await this.snapshotStore.save(snapshot);
    return snapshot;
  }

  async restoreLatestAndReplay(batchSize = 1000): Promise<RecoveryReport> {
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new Error(`batchSize must be a positive integer; received ${batchSize}`);
    }

    await this.projection.reset();
    const snapshot = await this.snapshotStore.latest();
    let cursor: EventLogCursor = { sequence: 0 };
    let restoredSnapshotHash: string | null = null;

    if (snapshot) {
      if (snapshot.manifest.schemaVersion !== this.schemaVersion) {
        throw new Error(
          `Snapshot schema mismatch: expected ${this.schemaVersion}, received ${snapshot.manifest.schemaVersion}`,
        );
      }

      const storedHash = stableHash128(snapshot.state);
      if (storedHash !== snapshot.manifest.stateHash) {
        throw new Error(
          `Snapshot integrity failure for ${snapshot.manifest.snapshotId}: ${storedHash} != ${snapshot.manifest.stateHash}`,
        );
      }

      await this.projection.importState(snapshot.state);
      const roundTripState = await this.projection.exportState();
      restoredSnapshotHash = stableHash128(roundTripState);
      if (restoredSnapshotHash !== snapshot.manifest.stateHash) {
        throw new Error(
          `Projection restore mismatch for ${snapshot.manifest.snapshotId}: ${restoredSnapshotHash} != ${snapshot.manifest.stateHash}`,
        );
      }
      cursor = snapshot.manifest.cursor;
    }

    let replayedEvents = 0;
    while (true) {
      const events = await this.eventLog.readFrom(cursor, batchSize);
      if (events.length === 0) break;

      for (const event of events) {
        await this.projection.applyEvent(event);
        cursor = { sequence: event.sequence };
        replayedEvents += 1;
      }

      if (events.length < batchSize) break;
    }

    const finalState = await this.projection.exportState();
    return {
      snapshotId: snapshot?.manifest.snapshotId || null,
      snapshotCursor: snapshot?.manifest.cursor || { sequence: 0 },
      replayedEvents,
      finalCursor: cursor,
      expectedSnapshotHash: snapshot?.manifest.stateHash || null,
      restoredSnapshotHash,
      finalStateHash: stableHash128(finalState),
    };
  }
}
