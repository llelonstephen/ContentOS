/**
 * ContentOS — Schema Index
 *
 * Central export point for all Drizzle schema tables.
 */

// M0: Infrastructure schemas
export { outboxEvents, consumerReceipts } from './outbox-schema.js';
export { apiIdempotencyRecords, idempotencyRecords } from './idempotency-schema.js';

// M1: Registries & Objects
export * from './registries.js';

// M1: Control Plane & Tasks
export * from './control-plane.js';

// M1: Epistemic & Research
export * from './epistemic.js';

// M1: Content, Validation, Risk & Rights
export * from './content.js';

// M1: Governance, Snapshots & Decisions
export * from './governance-snapshots.js';

// M1: Publication, Measurement & Learning
export * from './publication-measurement.js';

// M1: Operational Persistence (Run, DecisionCycle, StageExecution, etc.)
export * from './operational.js';

// M1: Canonical Reference-Set Tables
export * from './reference-sets.js';

// M1: Deletion Tombstones
export * from './tombstones.js';
