import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  COS_GRAPH_DURABILITY_CONFORMANCE_VERSION,
  COS_GRAPH_DURABILITY_PROFILE_M2D,
  GRAPH_DURABILITY_M2D_LAWS,
  GraphDurabilityConformanceError,
  GraphDurabilityConformanceFactory,
  GraphDurabilityDriver,
  GraphPersistenceCommit,
  GraphPersistenceCompaction,
  GraphPersistenceCompactionResult,
  GraphPersistenceCompareAndSwapResult,
  SQLiteGraphDurabilityDriver,
  runGraphDurabilityConformance,
} from '../packages/graph/src/framework';

function safeScope(scope: string): string {
  return scope.replace(/[^A-Za-z0-9._-]/g, '_');
}

class SQLiteTckFactory implements GraphDurabilityConformanceFactory {
  readonly backendId = 'cos.graph.sqlite.node-sqlite';

  constructor(private readonly directory: string) {
    mkdirSync(directory, { recursive: true });
  }

  open(scope: string): GraphDurabilityDriver {
    return new SQLiteGraphDurabilityDriver(this.path(scope));
  }

  destroy(scope: string): void {
    const path = this.path(scope);
    rmSync(path, { force: true });
    rmSync(`${path}-wal`, { force: true });
    rmSync(`${path}-shm`, { force: true });
  }

  protected path(scope: string): string {
    return join(this.directory, `${safeScope(scope)}.sqlite`);
  }
}

class LyingCasDriver implements GraphDurabilityDriver {
  constructor(private readonly delegate: GraphDurabilityDriver) {}

  load(graphId: string): unknown | null | Promise<unknown | null> {
    return this.delegate.load(graphId);
  }

  async compareAndSwap(commit: GraphPersistenceCommit): Promise<GraphPersistenceCompareAndSwapResult> {
    const result = await this.delegate.compareAndSwap(commit);
    if (result.status === 'conflict') {
      // Deliberately violates the storage CAS law: it claims a stale write won.
      return { status: 'committed', storageVersion: commit.expectedStorageVersion + 1 };
    }
    return result;
  }

  async compact(compaction: GraphPersistenceCompaction): Promise<GraphPersistenceCompactionResult> {
    if (!this.delegate.compact) throw new Error('delegate lacks compaction');
    return this.delegate.compact(compaction);
  }

  close(): void | Promise<void> {
    return this.delegate.close?.();
  }
}

class LyingCasFactory extends SQLiteTckFactory {
  override readonly backendId = 'cos.test.sqlite-lying-cas';

  override open(scope: string): GraphDurabilityDriver {
    return new LyingCasDriver(super.open(scope));
  }
}

async function main(): Promise<void> {
  const directory = join(tmpdir(), `cos-graph-tck-${process.pid}`);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });

  try {
    const sqlite = new SQLiteTckFactory(join(directory, 'sqlite'));
    const report = await runGraphDurabilityConformance(sqlite, { namespace: 'sqlite-m2d-certification' });
    assert.equal(report.schema, COS_GRAPH_DURABILITY_CONFORMANCE_VERSION);
    assert.equal(report.profile, COS_GRAPH_DURABILITY_PROFILE_M2D);
    assert.equal(report.backendId, 'cos.graph.sqlite.node-sqlite');
    assert.equal(report.certified, true);
    assert.deepEqual(report.laws, GRAPH_DURABILITY_M2D_LAWS);
    assert.match(report.certificationHash, /^[a-f0-9]{64}$/);

    // The report is reproducible: same backend/profile/namespace/law set produces
    // the same certification digest after the TCK rebuilds fresh scopes.
    const repeated = await runGraphDurabilityConformance(sqlite, { namespace: 'sqlite-m2d-certification' });
    assert.equal(repeated.certificationHash, report.certificationHash);

    // Prove the TCK is not ceremonial by wrapping the real backend with a driver
    // that lies about stale CAS conflicts. Certification must stop on that law.
    const lying = new LyingCasFactory(join(directory, 'lying-cas'));
    await assert.rejects(
      () => runGraphDurabilityConformance(lying, { namespace: 'anti-cheat' }),
      (error: unknown) => {
        assert.ok(error instanceof GraphDurabilityConformanceError);
        assert.equal(error.code, 'CONFORMANCE_LAW_FAILED');
        assert.equal(error.backendId, 'cos.test.sqlite-lying-cas');
        assert.equal(error.law, 'stale-storage-cas');
        return true;
      },
    );

    console.log(`COS Graph Framework M2E: SQLite durability TCK certified ${report.certificationHash}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

void main();
