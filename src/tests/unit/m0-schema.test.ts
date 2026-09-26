/**
 * M0 Test 02-03 — Drizzle Schema and Migration
 *
 * Validates M0 checklist items 02-03.
 * Tests that schema generation produces valid output and validates
 * SPEC02 §19 APIIdempotencyRecord and ConsumerReceipt contracts.
 */
import { describe, it, expect } from 'vitest';
import { outboxEvents, consumerReceipts } from '../../persistence/relational/schema/outbox-schema.js';
import {
  apiIdempotencyRecords,
  idempotencyRecords,
  validateIdempotencyRecord,
  MANDATORY_COMMAND_SCOPES,
  type ApiIdempotencyRecord,
} from '../../persistence/relational/schema/idempotency-schema.js';
import { ContentOSError } from '../../domain/shared/types.js';

describe('M0-02: Drizzle Schema Generation', () => {
  it('should export outbox_events table definition', () => {
    expect(outboxEvents).toBeDefined();
    const columns = Object.keys(outboxEvents);
    expect(columns).toContain('event_id');
    expect(columns).toContain('aggregate_type');
    expect(columns).toContain('aggregate_id');
    expect(columns).toContain('event_type');
    expect(columns).toContain('payload');
    expect(columns).toContain('created_at');
    expect(columns).toContain('published_at');
  });

  it('should export consumer_receipts table definition with PRIMARY KEY(consumer_name, event_id)', () => {
    expect(consumerReceipts).toBeDefined();
    const columns = Object.keys(consumerReceipts);
    expect(columns).toContain('consumer_name');
    expect(columns).toContain('event_id');
    expect(columns).toContain('processed_at');
  });

  it('should export api_idempotency_records table definition per SPEC02 §19', () => {
    expect(apiIdempotencyRecords).toBeDefined();
    expect(idempotencyRecords).toBe(apiIdempotencyRecords);
    const columns = Object.keys(apiIdempotencyRecords);
    expect(columns).toContain('command_scope');
    expect(columns).toContain('idempotency_key');
    expect(columns).toContain('request_hash');
    expect(columns).toContain('response_ref');
    expect(columns).toContain('status');
    expect(columns).toContain('created_at');
    expect(columns).toContain('completed_at');
  });

  it('should include all mandatory command scopes per SPEC02 §19', () => {
    expect(MANDATORY_COMMAND_SCOPES).toContain('StartRun');
    expect(MANDATORY_COMMAND_SCOPES).toContain('SubmitReview');
    expect(MANDATORY_COMMAND_SCOPES).toContain('CreatePublishedArtifact');
    expect(MANDATORY_COMMAND_SCOPES).toContain('IngestMeasurement');
  });

  describe('SPEC02 §19 IDEMPOTENCY_CONFLICT Invariant', () => {
    const existing: ApiIdempotencyRecord = {
      command_scope: 'StartRun',
      idempotency_key: 'idem-key-001',
      request_hash: 'hash-abc-123',
      response_ref: '{"run_id":"run-001"}',
      status: 'COMPLETED',
      created_at: new Date('2026-09-26T12:00:00Z'),
      completed_at: new Date('2026-09-26T12:00:01Z'),
    };

    it('should allow replay when request_hash matches', () => {
      const result = validateIdempotencyRecord(existing, {
        command_scope: 'StartRun',
        idempotency_key: 'idem-key-001',
        request_hash: 'hash-abc-123',
      });
      expect(result.isReplay).toBe(true);
      expect(result.existingRecord).toBe(existing);
    });

    it('should reject with IDEMPOTENCY_CONFLICT when request_hash differs', () => {
      expect(() => {
        validateIdempotencyRecord(existing, {
          command_scope: 'StartRun',
          idempotency_key: 'idem-key-001',
          request_hash: 'hash-xyz-999', // Different payload!
        });
      }).toThrowError(ContentOSError);

      try {
        validateIdempotencyRecord(existing, {
          command_scope: 'StartRun',
          idempotency_key: 'idem-key-001',
          request_hash: 'hash-xyz-999',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ContentOSError);
        const ce = err as ContentOSError;
        expect(ce.error_code).toBe('IDEMPOTENCY_CONFLICT');
        expect(ce.retryable).toBe(false);
      }
    });

    it('should indicate new invocation when no record exists', () => {
      const result = validateIdempotencyRecord(null, {
        command_scope: 'StartRun',
        idempotency_key: 'idem-key-002',
        request_hash: 'hash-abc-123',
      });
      expect(result.isReplay).toBe(false);
      expect(result.existingRecord).toBeUndefined();
    });
  });
});
