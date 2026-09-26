/**
 * M0 Integration Test — Live Infrastructure Verification
 *
 * Validates Defect 3:
 * - Real PostgreSQL connection & migration execution
 * - Post-migration schema and constraints verification (PK & FK constraints)
 * - Real Redis connection
 * - Minimal BullMQ durable queue enqueue/consume roundtrip
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import postgres from 'postgres';
import { Redis } from 'ioredis';
import { Queue, Worker, type Job } from 'bullmq';

// Prioritize DATABASE_URL_TEST, then fallback to DATABASE_URL or localhost test DB
const DB_URL =
  process.env['DATABASE_URL_TEST'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://localhost:5432/contentos_test';
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

/**
 * Safety guard: verifies target database is explicitly a test database
 * to prevent destructive DROP statements against production or non-test databases.
 */
export function assertTestDatabase(url: string): void {
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();
  if (!dbName.includes('test')) {
    throw new Error(
      `SAFETY GUARD BLOCKED EXECUTION: Refusing to run destructive migration tests against non-test database '${dbName}'. Database name must explicitly contain 'test'.`,
    );
  }
}

describe('M0 Integration: Live Infrastructure Verification', () => {
  let sql: ReturnType<typeof postgres>;
  let redis: Redis;

  beforeAll(async () => {
    // Enforce safety guard before any database interaction
    assertTestDatabase(DB_URL);
    sql = postgres(DB_URL, { max: 5 });
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  });

  afterAll(async () => {
    if (sql) await sql.end();
    if (redis) await redis.quit();
  });

  describe('PostgreSQL Migration & Constraints Verification', () => {
    it('should connect to PostgreSQL server', async () => {
      const result = await sql`SELECT 1 as connected`;
      expect(result[0]?.['connected']).toBe(1);
    });

    it('should apply the generated migration cleanly', async () => {
      // Drop existing tables to ensure clean slate migration
      await sql`DROP TABLE IF EXISTS consumer_receipts CASCADE`;
      await sql`DROP TABLE IF EXISTS api_idempotency_records CASCADE`;
      await sql`DROP TABLE IF EXISTS outbox_events CASCADE`;

      const migrationPath = path.resolve(
        import.meta.dirname,
        '../../persistence/relational/migrations/0000_chemical_iron_man.sql',
      );
      const migrationSql = await fs.readFile(migrationPath, 'utf-8');

      // Execute statements split by drizzle breakpoint
      const statements = migrationSql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);

      for (const stmt of statements) {
        await sql.unsafe(stmt);
      }

      // Verify all 3 tables exist in information_schema
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('outbox_events', 'consumer_receipts', 'api_idempotency_records')
      `;
      const tableNames = tables.map((r) => r['table_name']);
      expect(tableNames).toContain('outbox_events');
      expect(tableNames).toContain('consumer_receipts');
      expect(tableNames).toContain('api_idempotency_records');
    });

    it('should enforce PRIMARY KEY(command_scope, idempotency_key) on api_idempotency_records', async () => {
      // Insert first record
      await sql`
        INSERT INTO api_idempotency_records (
          command_scope, idempotency_key, request_hash, status
        ) VALUES (
          'StartRun', 'test-key-01', 'hash-initial', 'STARTED'
        )
      `;

      // Duplicate in same command_scope must fail PK constraint
      await expect(sql`
        INSERT INTO api_idempotency_records (
          command_scope, idempotency_key, request_hash, status
        ) VALUES (
          'StartRun', 'test-key-01', 'hash-different', 'STARTED'
        )
      `).rejects.toThrow();

      // Same idempotency_key in a DIFFERENT command_scope must succeed (composite PK)
      const diffScopeResult = await sql`
        INSERT INTO api_idempotency_records (
          command_scope, idempotency_key, request_hash, status
        ) VALUES (
          'SubmitReview', 'test-key-01', 'hash-other', 'STARTED'
        ) RETURNING command_scope, idempotency_key
      `;
      expect(diffScopeResult[0]?.['command_scope']).toBe('SubmitReview');
    });

    it('should enforce PRIMARY KEY(consumer_name, event_id) and FK on consumer_receipts', async () => {
      // 1. Foreign key violation when outbox_event does not exist
      const fakeEventId = '00000000-0000-0000-0000-000000000001';
      await expect(sql`
        INSERT INTO consumer_receipts (consumer_name, event_id)
        VALUES ('WorkerA', ${fakeEventId})
      `).rejects.toThrow();

      // 2. Insert valid outbox_event
      const eventRows = await sql`
        INSERT INTO outbox_events (
          aggregate_type, aggregate_id, event_type, payload
        ) VALUES (
          'Run', 'run-100', 'RunStarted', '{"run_id":"run-100"}'
        ) RETURNING event_id
      `;
      const validEventId = eventRows[0]!['event_id'] as string;
      expect(validEventId).toBeTruthy();

      // 3. Valid consumer receipt insert succeeds
      await sql`
        INSERT INTO consumer_receipts (consumer_name, event_id)
        VALUES ('WorkerA', ${validEventId})
      `;

      // 4. Duplicate (consumer_name, event_id) fails PK constraint
      await expect(sql`
        INSERT INTO consumer_receipts (consumer_name, event_id)
        VALUES ('WorkerA', ${validEventId})
      `).rejects.toThrow();

      // 5. Different consumer_name for same event_id succeeds
      const workerB = await sql`
        INSERT INTO consumer_receipts (consumer_name, event_id)
        VALUES ('WorkerB', ${validEventId})
        RETURNING consumer_name
      `;
      expect(workerB[0]?.['consumer_name']).toBe('WorkerB');
    });
  });

  describe('Redis & BullMQ Durable Queue Roundtrip', () => {
    it('should connect to Redis server and respond to PING', async () => {
      const pong = await redis.ping();
      expect(pong).toBe('PONG');
    });

    it('should perform a minimal BullMQ enqueue/consume roundtrip', async () => {
      const queueName = `m0-roundtrip-${Date.now()}`;
      const queue = new Queue<{ message: string; timestamp: number }>(queueName, {
        connection: redis,
      });

      let processedMessage: string | null = null;
      let processCompletePromiseResolve: () => void;
      const processCompletePromise = new Promise<void>((resolve) => {
        processCompletePromiseResolve = resolve;
      });

      const worker = new Worker<{ message: string; timestamp: number }>(
        queueName,
        async (job: Job<{ message: string; timestamp: number }>) => {
          processedMessage = job.data.message;
          processCompletePromiseResolve();
        },
        { connection: redis },
      );

      // Enqueue job
      const testPayload = {
        message: 'SPEC01 durable workflow enqueue/consume test',
        timestamp: Date.now(),
      };
      await queue.add('test-job', testPayload);

      // Await worker processing with timeout
      await Promise.race([
        processCompletePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('BullMQ job processing timed out')), 5000),
        ),
      ]);

      expect(processedMessage).toBe(testPayload.message);

      // Clean up queue and worker
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
    });
  });

  describe('Non-Test Database Protection Guard', () => {
    it('should reject non-test database URL to protect production data', () => {
      expect(() => {
        assertTestDatabase('postgresql://user:pass@localhost:5432/contentos_production');
      }).toThrow('SAFETY GUARD BLOCKED EXECUTION');

      expect(() => {
        assertTestDatabase('postgresql://user:pass@localhost:5432/contentos');
      }).toThrow('SAFETY GUARD BLOCKED EXECUTION');

      expect(() => {
        assertTestDatabase('postgresql://user:pass@localhost:5432/contentos_test');
      }).not.toThrow();
    });
  });
});

