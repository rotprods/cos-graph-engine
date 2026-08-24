import { stableHash128, type EntityId } from '../packages/core/src/index';
import {
  InMemoryEventLog,
  InMemorySnapshotStore,
  RecoveryCoordinator,
  type DurableEvent,
  type ProjectionAdapter,
  type StoredSnapshot,
  type ISnapshotStore,
} from '../packages/runtime/src/index';

let passed = 0;
let failed = 0;
function ok(condition: boolean, message: string) {
  if (condition) { passed++; console.log(`  ✅ ${message}`); }
  else { failed++; console.error(`  ❌ ${message}`); }
}
async function rejects(fn: () => unknown | Promise<unknown>, pattern: RegExp, message: string) {
  try { await fn(); ok(false, message); }
  catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    ok(pattern.test(text), `${message} (${text})`);
  }
}

class NumberProjection implements ProjectionAdapter<number[]> {
  state: number[] = [];
  async exportState() { return [...this.state]; }
  async importState(state: number[]) { this.state = [...state]; }
  async reset() { this.state = []; }
  async applyEvent(event: DurableEvent) {
    const payload = event.payload as { value?: number };
    if (typeof payload.value !== 'number') throw new Error('projection event missing numeric value');
    this.state.push(payload.value);
  }
}

class FixedSnapshotStore<S> implements ISnapshotStore<S> {
  constructor(private snapshot: StoredSnapshot<S> | null) {}
  async save(snapshot: StoredSnapshot<S>) { this.snapshot = structuredClone(snapshot); }
  async get(id: string) { return this.snapshot?.manifest.snapshotId === id ? structuredClone(this.snapshot) : null; }
  async latest() { return this.snapshot ? structuredClone(this.snapshot) : null; }
  async list() { return this.snapshot ? [structuredClone(this.snapshot.manifest)] : []; }
  async clear() { this.snapshot = null; }
}

const TIME = '2026-08-24T12:00:00.000Z';
async function append(log: InMemoryEventLog, id: string, key: string, value: number) {
  return log.append({
    id: id as EntityId,
    type: 'projection.append',
    source: 'w13' as EntityId,
    payload: { value },
    metadata: {},
    severity: 'info',
    timestamp: TIME,
    traceId: 'w13-recovery',
    spanId: `span-${id}`,
    idempotencyKey: key,
    correlationId: 'w13-recovery',
    recordedAt: TIME,
  });
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║            W13 REPLAY / RESTORE QUALIFICATION           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const log = new InMemoryEventLog();
  const projection = new NumberProjection();
  const snapshots = new InMemorySnapshotStore<number[]>();
  const coordinator = new RecoveryCoordinator(log, snapshots, projection, 'w13-v1');

  const e1 = await append(log, 'e1', 'k1', 1);
  await projection.applyEvent(e1.event);
  const snapshot = await coordinator.createSnapshot('s1', { purpose: 'w13' });
  ok(snapshot.manifest.cursor.sequence === 1, 'snapshot is cursor-bound to accepted event history');

  const e2 = await append(log, 'e2', 'k2', 2);
  await projection.applyEvent(e2.event);
  const uninterruptedHash = stableHash128(await projection.exportState());
  const report = await coordinator.restoreLatestAndReplay();
  ok(stableHash128(await projection.exportState()) === uninterruptedHash, 'snapshot + replay equals uninterrupted projection');
  ok(report.replayedEvents === 1 && report.finalCursor.sequence === 2, 'replay resumes strictly after snapshot cursor');

  const secondProjection = new NumberProjection();
  const second = new RecoveryCoordinator(log, snapshots, secondProjection, 'w13-v1');
  await second.restoreLatestAndReplay();
  ok(stableHash128(secondProjection.state) === uninterruptedHash, 'independent replay produces deterministic final state');

  const corrupt: StoredSnapshot<number[]> = structuredClone(snapshot);
  corrupt.state = [999];
  const corruptProjection = new NumberProjection();
  const corruptCoordinator = new RecoveryCoordinator(
    log,
    new FixedSnapshotStore(corrupt),
    corruptProjection,
    'w13-v1',
  );
  await rejects(
    () => corruptCoordinator.restoreLatestAndReplay(),
    /Snapshot integrity failure/,
    'corrupted snapshot is rejected before projection import',
  );
  ok(corruptProjection.state.length === 0, 'corrupted snapshot leaves projection empty');

  const wrongSchema: StoredSnapshot<number[]> = structuredClone(snapshot);
  wrongSchema.manifest.schemaVersion = 'wrong-schema';
  const mismatch = new RecoveryCoordinator(
    log,
    new FixedSnapshotStore(wrongSchema),
    new NumberProjection(),
    'w13-v1',
  );
  await rejects(
    () => mismatch.restoreLatestAndReplay(),
    /Snapshot schema mismatch/,
    'schema mismatch fails closed before replay',
  );

  const emptySnapshots = new InMemorySnapshotStore<number[]>();
  const fromZeroProjection = new NumberProjection();
  const fromZero = new RecoveryCoordinator(log, emptySnapshots, fromZeroProjection, 'w13-v1');
  const zeroReport = await fromZero.restoreLatestAndReplay();
  ok(zeroReport.snapshotId === null && zeroReport.replayedEvents === 2, 'empty-state recovery replays full durable history');
  ok(stableHash128(fromZeroProjection.state) === uninterruptedHash, 'empty recovery converges to canonical state');

  console.log(`\nW13 recovery suite: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => { console.error(error); process.exit(1); });
