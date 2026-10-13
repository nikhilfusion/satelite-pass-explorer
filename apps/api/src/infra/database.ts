import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { type DuckDBConnection, DuckDBInstance, type DuckDBValue } from '@duckdb/node-api';

export type SqlParams = Record<string, DuckDBValue>;

export interface OpenOptions {
  /** `:memory:` for tests. */
  path: string;
  readOnly?: boolean;
}

/**
 * Thin façade over DuckDB's Node "Neo" client.
 *
 * - One shared `DuckDBInstance` (the database), one short-lived connection per call:
 *   connections are cheap and this makes concurrent HTTP requests safe without a pool.
 * - Always uses prepared statements with named parameters for user-supplied values.
 */
export class Database {
  private constructor(private readonly instance: DuckDBInstance) {}

  static async open({ path, readOnly = false }: OpenOptions): Promise<Database> {
    if (path !== ':memory:' && !readOnly) mkdirSync(dirname(path), { recursive: true });
    const instance = await DuckDBInstance.create(
      path,
      readOnly ? { access_mode: 'READ_ONLY' } : {},
    );
    return new Database(instance);
  }

  /** Runs a query and returns plain JS rows (BIGINT -> bigint, LIST -> array, DOUBLE -> number). */
  async all<T extends Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T[]> {
    return this.withConnection(async (conn) => {
      const reader = await conn.runAndReadAll(sql, params);
      return reader.getRowObjectsJS() as unknown as T[];
    });
  }

  /** Executes one or more statements, ignoring any result. */
  async exec(sql: string): Promise<void> {
    await this.withConnection(async (conn) => {
      await conn.run(sql);
    });
  }

  /** Gives the caller a raw connection (used by bulk ingest for the appender API). */
  async withConnection<T>(fn: (conn: DuckDBConnection) => Promise<T>): Promise<T> {
    const conn = await this.instance.connect();
    try {
      return await fn(conn);
    } finally {
      conn.closeSync();
    }
  }

  close(): void {
    this.instance.closeSync();
  }
}

/** DuckDB returns BIGINT as `bigint`; the domain works with plain numbers. */
export function num(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  throw new TypeError(`Expected a numeric DuckDB value, got ${typeof value}`);
}
