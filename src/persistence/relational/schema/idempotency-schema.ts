/**
 * ContentOS — Drizzle Schema: API Idempotency Record
 *
 * Implements SPEC01 §95, SPEC02 §19:
 *   - command_scope
 *   - idempotency_key
 *   - request_hash
 *   - response_ref?
 *   - status
 *   - created_at
 *   - completed_at?
 *   - PRIMARY KEY(command_scope, idempotency_key)
 *   - Same scope+key with different request_hash -> IDEMPOTENCY_CONFLICT
 */
import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { ContentOSError, RetryCategory } from '../../../domain/shared/types.js';

/**
 * Mandatory command scopes per SPEC02 §19:
 *   - StartRun
 *   - SubmitReview
 *   - CreatePublishedArtifact
 *   - IngestMeasurement
 */
export const MANDATORY_COMMAND_SCOPES = [
  'StartRun',
  'SubmitReview',
  'CreatePublishedArtifact',
  'IngestMeasurement',
] as const;

export type MandatoryCommandScope = (typeof MANDATORY_COMMAND_SCOPES)[number];

/**
 * APIIdempotencyRecord (SPEC02 §19)
 */
export const apiIdempotencyRecords = pgTable(
  'api_idempotency_records',
  {
    command_scope: text('command_scope').notNull(),
    idempotency_key: text('idempotency_key').notNull(),
    request_hash: text('request_hash').notNull(),
    response_ref: text('response_ref'),
    status: text('status').notNull(), // 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.command_scope, table.idempotency_key] }),
  ],
);

// Backward-compatible alias
export const idempotencyRecords = apiIdempotencyRecords;

export type ApiIdempotencyRecord = typeof apiIdempotencyRecords.$inferSelect;
export type NewApiIdempotencyRecord = typeof apiIdempotencyRecords.$inferInsert;

/**
 * Evaluates idempotency contract per SPEC02 §19.
 * If the record exists for (command_scope, idempotency_key):
 *   - Same request_hash: returns existing record (replayable)
 *   - Different request_hash: throws IDEMPOTENCY_CONFLICT ContentOSError
 */
export function validateIdempotencyRecord(
  existing: ApiIdempotencyRecord | null | undefined,
  incoming: { command_scope: string; idempotency_key: string; request_hash: string },
): { isReplay: boolean; existingRecord?: ApiIdempotencyRecord } {
  if (!existing) {
    return { isReplay: false };
  }

  if (existing.request_hash !== incoming.request_hash) {
    throw new ContentOSError({
      error_code: 'IDEMPOTENCY_CONFLICT',
      message: `Idempotency key '${incoming.idempotency_key}' in scope '${incoming.command_scope}' was previously used with a different request hash (expected '${existing.request_hash}', received '${incoming.request_hash}')`,
      category: RetryCategory.DOMAIN_INVARIANT_FAILED,
    });
  }

  return { isReplay: true, existingRecord: existing };
}
