/**
 * ContentOS — Drizzle Schema: API Idempotency
 *
 * Implements SPEC01 §95:
 *   - Idempotency-Key for externally retried commands
 *   - Same key + different payload → IDEMPOTENCY_CONFLICT
 */
import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * API Idempotency Records (SPEC01 §95)
 *
 * Required for: StartRun, SubmitReview, CreatePublishedArtifact, IngestMeasurement
 */
export const idempotencyRecords = pgTable('idempotency_records', {
  idempotency_key: text('idempotency_key').primaryKey(),
  request_hash: text('request_hash').notNull(),
  response_ref: text('response_ref'), // JSON serialized response reference
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_idempotency_key').on(table.idempotency_key),
]);
