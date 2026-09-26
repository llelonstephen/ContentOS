/**
 * ContentOS — Database Connection
 *
 * PostgreSQL connection using drizzle-orm + postgres.js driver.
 * Supports REPEATABLE READ isolation per SPEC01 §20.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

let _sql: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Get the postgres.js client instance.
 * Creates one on first call. Reuses on subsequent calls.
 */
export function getSql(connectionString?: string): ReturnType<typeof postgres> {
  if (_sql) return _sql;

  const url = connectionString ?? process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }

  _sql = postgres(url, {
    max: 20,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return _sql;
}

/**
 * Get the drizzle ORM instance.
 */
export function getDb(connectionString?: string): ReturnType<typeof drizzle> {
  if (_db) return _db;
  _db = drizzle(getSql(connectionString));
  return _db;
}

/**
 * Close the database connection.
 */
export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
    _db = null;
  }
}

/**
 * Reset connection state (for testing).
 */
export function resetDbConnection(): void {
  _sql = null;
  _db = null;
}
