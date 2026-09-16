import assert from 'node:assert/strict';
import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '../packages/runtime/src/index';

type Row = { key: string; value: string };

class FakePostgresExecutor implements PostgresExecutor {
  private committed = new Map<string, string>();
  readonly calls: Array<{ scope: 'executor' | 'transaction'; sql: string; params: unknown[] }> = [];

  async query<ResultRow = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<PostgresQueryResult<ResultRow>> {
    this.calls.push({ scope: 'executor', sql, params: structuredClone(params) });
    return this.execute<ResultRow>(this.committed, sql, params);
  }

  async transaction<T>(fn: (tx: PostgresTransaction) => Promise<T>): Promise<T> {
    const candidate = new Map(this.committed);
    const tx: PostgresTransaction = {
      query: async <ResultRow = Record<string, unknown>>(
        sql: string,
        params: unknown[] = [],
      ): Promise<PostgresQueryResult<ResultRow>> => {
        this.calls.push({ scope: 'transaction', sql, params: structuredClone(params) });
        return this.execute<ResultRow>(candidate, sql, params);
      },
    };

    const result = await fn(tx);
    this.committed = candidate;
    return result;
  }

  private async execute<ResultRow>(
    store: Map<string, string>,
    sql: string,
    params: unknown[],
  ): Promise<PostgresQueryResult<ResultRow>> {
    switch (sql) {
      case 'UPSERT': {
        const [key, value] = params;
        if (typeof key !== 'string' || typeof value !== 'string') {
          throw new Error('UPSERT requires string key/value');
        }
        store.set(key, value);
        return { rows: [], rowCount: 1 };
      }
      case 'SELECT': {
        const [key] = params;
        if (typeof key !== 'string') throw new Error('SELECT requires string key');
        const value = store.get(key);
        if (value === undefined) return { rows: [], rowCount: 0 };
        return {
          rows: [{ key, value } as ResultRow],
          rowCount: 1,
        };
      }
      default:
        throw new Error(`Unsupported fake SQL: ${sql}`);
    }
  }
}

async function main(): Promise<void> {
  const db = new FakePostgresExecutor();

  const empty = await db.query<Row>('SELECT', ['alpha']);
  assert.equal(empty.rowCount, 0);
  assert.deepEqual(empty.rows, []);

  const committedValue = await db.transaction(async tx => {
    const write = await tx.query('UPSERT', ['alpha', 'one']);
    assert.equal(write.rowCount, 1);
    const inside = await tx.query<Row>('SELECT', ['alpha']);
    assert.equal(inside.rowCount, 1);
    assert.equal(inside.rows[0]?.value, 'one');
    return inside.rows[0]?.value;
  });
  assert.equal(committedValue, 'one');
  assert.equal((await db.query<Row>('SELECT', ['alpha'])).rows[0]?.value, 'one');

  await assert.rejects(
    db.transaction(async tx => {
      await tx.query('UPSERT', ['alpha', 'must-rollback']);
      assert.equal((await tx.query<Row>('SELECT', ['alpha'])).rows[0]?.value, 'must-rollback');
      throw new Error('synthetic rollback');
    }),
    /synthetic rollback/,
  );
  assert.equal(
    (await db.query<Row>('SELECT', ['alpha'])).rows[0]?.value,
    'one',
    'transaction callback failure must not become a committed fake state',
  );

  const executorCalls = db.calls.filter(call => call.scope === 'executor');
  const transactionCalls = db.calls.filter(call => call.scope === 'transaction');
  assert.ok(executorCalls.length >= 3);
  assert.ok(transactionCalls.length >= 4);
  assert.deepEqual(db.calls[0]?.params, ['alpha']);

  process.stdout.write(JSON.stringify({
    suite: 'postgres-executor-contract',
    status: 'PASS',
    driverNeutral: true,
    productionConnections: 0,
    executorQueriesObserved: executorCalls.length,
    transactionQueriesObserved: transactionCalls.length,
    rollbackIsolated: true,
  }, null, 2) + '\n');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});