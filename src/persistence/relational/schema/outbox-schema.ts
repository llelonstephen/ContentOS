/**
 * ContentOS — Drizzle Schema: Outbox Events
 *
 * Implements SPEC01 §76-81, SPEC02 §19:
 *   - Transactional outbox pattern
 *   - OutboxEvent entity
 *   - ConsumerReceipt deduplication
 *   - At-least-once delivery
 *   - PRIMARY KEY(consumer_name, event_id)
 *   - FK(event_id) → OutboxEvent(event_id)
 */
import { pgTable, text, timestamp, uuid, primaryKey } from 'drizzle-orm/pg-core';

/**
 * OutboxEvent (SPEC01 §77, SPEC02 §19)
 *
 * Domain state + outbox event committed atomically.
 * Never publish event before domain commit (SPEC01 §76).
 * event_id is globally unique.
 */
export const outboxEvents = pgTable('outbox_events', {
  event_id: uuid('event_id').primaryKey().defaultRandom(),
  aggregate_type: text('aggregate_type').notNull(),
  aggregate_id: text('aggregate_id').notNull(),
  event_type: text('event_type').notNull(),
  payload: text('payload').notNull(), // JSON serialized
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  published_at: timestamp('published_at', { withTimezone: true }),
});

/**
 * ConsumerReceipt (SPEC01 §79, SPEC02 §19)
 *
 * Deduplication for event consumers.
 * PRIMARY KEY(consumer_name, event_id) prevents double-processing.
 * FK(event_id) → OutboxEvent(event_id).
 */
export const consumerReceipts = pgTable(
  'consumer_receipts',
  {
    consumer_name: text('consumer_name').notNull(),
    event_id: uuid('event_id')
      .notNull()
      .references(() => outboxEvents.event_id),
    processed_at: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.consumer_name, table.event_id] }),
  ],
);
