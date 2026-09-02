import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  COS_GRAPH_CHECKPOINT_CONFORMANCE_VERSION,
  COS_GRAPH_CHECKPOINT_PROFILE_M2C,
  GRAPH_CHECKPOINT_M2C_LAWS,
  GraphCheckpointCompareAndSwapResult,
  GraphCheckpointConformanceError,
  GraphCheckpointConformanceFactory,
  GraphCheckpointDriver,
  GraphWorkflowCheckpoint,
  SQLiteGraphCheckpointDriver,
  runGraphCheckpointConformance,
} from '../packages/graph/src/framework';

function safeScope(scope: string): string {
  return scope.replace(/[^A-Za-z0-9._-]/g, '_');
}

class SQLiteCheckpointTckFactory implements GraphCheckpointConformanceFactory {
  readonly backendId: string = 'cos.graph.checkpoint.sqlite.node-sqlite';

  constructor(private readonly directory: string) {
    mkdirSync(directory, { recursive: true });
  }

  open(scope: string): GraphCheckpointDriver {
    return new SQLiteGraphCheckpointDriver(this.path(scope));
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

class LyingCheckpointCasDriver implements GraphCheckpointDriver {
  constructor(private readonly delegate: GraphCheckpointDriver) {}

  load(runId: string): unknown | null | Promise<unknown | null> {
    return this.delegate.load(runId);
  }

  async compareAndSwap(
    expectedRevision: number,
    checkpoint: GraphWorkflowCheckpoint,
  ): Promise<GraphCheckpointCompareAndSwapResult> {
    const result = await this.delegate.compareAndSwap(expectedRevision, checkpoint);
    if (result.status === 'conflict') {
      return { status: 'committed', revision: checkpoint.revision };
    }
    return result;
  }

  close(): void | Promise<void> {
    return this.delegate.close?.();
  }
}

class LyingCheckpointCasFactory extends SQLiteCheckpointTckFactory {
  override readonly backendId: string = 'cos.test.checkpoint.sqlite-lying-cas';

  override open(scope: string): GraphCheckpointDriver {
    return new LyingCheckpointCasDriver(super.open(scope));
  }
}

async function main(): Promise<void> {
  const directory = join(tmpdir(), `cos-graph-checkpoint-tck-${process.pid}`);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });

  try {
    const sqlite = new SQLiteCheckpointTckFactory(join(directory, 'sqlite'));
    const report = await runGraphCheckpointConformance(sqlite, {
      namespace: 'sqlite-checkpoint-m2c-certification',
    });
    assert.equal(report.schema, COS_GRAPH_CHECKPOINT_CONFORMANCE_VERSION);
    assert.equal(report.profile, COS_GRAPH_CHECKPOINT_PROFILE_M2C);
    assert.equal(report.backendId, 'cos.graph.checkpoint.sqlite.node-sqlite');
    assert.equal(report.certified, true);
    assert.deepEqual(report.laws, GRAPH_CHECKPOINT_M2C_LAWS);
    assert.match(report.certificationHash, /^[a-f0-9]{64}$/);

    const repeated = await runGraphCheckpointConformance(sqlite, {
      namespace: 'sqlite-checkpoint-m2c-certification',
    });
    assert.equal(repeated.certificationHash, report.certificationHash);

    const lying = new LyingCheckpointCasFactory(join(directory, 'lying-cas'));
    await assert.rejects(
      () => runGraphCheckpointConformance(lying, { namespace: 'anti-cheat' }),
      (error: unknown) => {
        assert.ok(error instanceof GraphCheckpointConformanceError);
        assert.equal(error.code, 'CHECKPOINT_CONFORMANCE_LAW_FAILED');
        assert.equal(error.backendId, 'cos.test.checkpoint.sqlite-lying-cas');
        assert.equal(error.law, 'stale-checkpoint-cas');
        return true;
      },
    );

    console.log(`COS Graph Framework M2F: SQLite checkpoint TCK certified ${report.certificationHash}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

void main();
