/**
 * ContentOS — Schema Index
 *
 * Central export point for all Drizzle schema tables.
 * New milestones add their schemas here.
 */

// M0: Infrastructure schemas
export { outboxEvents, consumerReceipts } from './outbox-schema.js';
export { idempotencyRecords } from './idempotency-schema.js';
