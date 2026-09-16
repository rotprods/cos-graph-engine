export interface PostgresQueryResult<Row> {
  rows: Row[];
  rowCount: number;
}

export interface PostgresTransaction {
  query<Row = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<PostgresQueryResult<Row>>;
}

/**
 * Driver-neutral injected SQL boundary used by candidate Postgres/Supabase
 * stores. This contract owns no pool, DSN, credentials, retries or provider
 * configuration. Transaction policy and retry decisions remain explicit in
 * the caller/adapter.
 */
export interface PostgresExecutor {
  transaction<T>(fn: (tx: PostgresTransaction) => Promise<T>): Promise<T>;
  query<Row = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<PostgresQueryResult<Row>>;
}
