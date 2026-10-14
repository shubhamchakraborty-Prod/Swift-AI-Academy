/**
 * Database adapter. One tiny interface (query / tx) over two drivers:
 *   - DATABASE_URL set   -> real Postgres through `pg` (production)
 *   - otherwise          -> PGlite, an embedded Postgres stored in .data/pglite (local development, tests in memory)
 * schema.sql runs on start and is idempotent (create ... if not exists). Add new tables there.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  kind: 'pglite' | 'postgres';
}

const SCHEMA = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8');

/**
 * Postgres when DATABASE_URL is set; otherwise embedded Postgres (PGlite) in a local data
 * directory, or in memory when dataDir is 'memory' (tests).
 */
export async function openDb(opts: { databaseUrl?: string; dataDir?: string }): Promise<Db> {
  if (opts.databaseUrl) {
    const pg = (await import('pg')).default;
    pg.types.setTypeParser(1700, (v: string) => Number(v)); // numeric -> number
    const pool = new pg.Pool({ connectionString: opts.databaseUrl });
    await pool.query(SCHEMA);
    return {
      kind: 'postgres',
      query: async (sql, params) => (await pool.query(sql, params as unknown[])).rows,
      tx: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query('begin');
          const out = await fn({ query: async (sql, params) => (await client.query(sql, params as unknown[])).rows });
          await client.query('commit');
          return out;
        } catch (e) {
          await client.query('rollback');
          throw e;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = opts.dataDir ?? '.data/pglite';
  if (dir !== 'memory') mkdirSync(dir, { recursive: true });
  const db = dir === 'memory' ? new PGlite() : new PGlite(dir);
  await db.exec(SCHEMA);
  // PGlite runs one statement at a time; a simple promise chain keeps transactions from interleaving.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => undefined);
    return run;
  };
  return {
    kind: 'pglite',
    query: (sql, params) => serial(async () => (await db.query(sql, params as unknown[])).rows as never),
    tx: (fn) => serial(() => db.transaction((t) => fn({ query: async (sql, params) => (await t.query(sql, params as unknown[])).rows as never }))),
    close: () => db.close(),
  };
}
