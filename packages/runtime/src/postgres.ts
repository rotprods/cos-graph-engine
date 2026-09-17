export interface PostgresQueryResult<Row> {
  rows: Row[];
  rowCount: number;
}

/**
 * Driver-neutral transaction port for injected PostgreSQL/Supabase adapters.
 *
 * This is a capability interface only: it owns no connection pool, credentials,
 * network transport, retry policy, migrations, or production database state.
 */
export interface PostgresTransaction {
  query<Row = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<PostgresQueryResult<Row>>;
}

/**
 * Minimal injected PostgreSQL executor shared by authority persistence adapters.
 * Callers own driver construction and authorization outside this package.
 */
export interface PostgresExecutor {
  transaction<T>(fn: (tx: PostgresTransaction) => Promise<T>): Promise<T>;
  query<Row = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<PostgresQueryResult<Row>>;
}
