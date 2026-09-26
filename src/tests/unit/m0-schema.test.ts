/**
 * M0 Test 02-03 — Drizzle Schema and Migration
 *
 * Validates M0 checklist items 02-03.
 * Tests that schema generation produces valid output.
 */
import { describe, it, expect } from 'vitest';
import { outboxEvents, consumerReceipts } from '../../persistence/relational/schema/outbox-schema.js';
import { idempotencyRecords } from '../../persistence/relational/schema/idempotency-schema.js';

describe('M0-02: Drizzle Schema Generation', () => {
  it('should export outbox_events table definition', () => {
    expect(outboxEvents).toBeDefined();
    // Verify the table has expected columns
    const columns = Object.keys(outboxEvents);
    expect(columns).toContain('event_id');
    expect(columns).toContain('aggregate_type');
    expect(columns).toContain('aggregate_id');
    expect(columns).toContain('event_type');
    expect(columns).toContain('payload');
    expect(columns).toContain('created_at');
    expect(columns).toContain('published_at');
  });

  it('should export consumer_receipts table definition', () => {
    expect(consumerReceipts).toBeDefined();
    const columns = Object.keys(consumerReceipts);
    expect(columns).toContain('consumer_name');
    expect(columns).toContain('event_id');
    expect(columns).toContain('processed_at');
  });

  it('should export idempotency_records table definition', () => {
    expect(idempotencyRecords).toBeDefined();
    const columns = Object.keys(idempotencyRecords);
    expect(columns).toContain('idempotency_key');
    expect(columns).toContain('request_hash');
    expect(columns).toContain('response_ref');
    expect(columns).toContain('created_at');
  });
});
