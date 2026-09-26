/**
 * ContentOS — Deletion Tombstones Schema
 *
 * Implements SPEC02 §31:
 *   - DeletedTargetTombstone
 *   - DeletedRevisionTombstone
 *
 * Out-of-band non-sensitive deletion metadata consulted only after canonical resolution fails.
 * Must NOT serve as substitute FK targets or satisfy normal resolution.
 */
import {
  pgTable,
  text,
  timestamp,
  boolean,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';

export const deletedTargetTombstones = pgTable(
  'deleted_target_tombstones',
  {
    entity_type: text('entity_type').notNull(),
    entity_id: text('entity_id').notNull(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    deletion_reason_code: text('deletion_reason_code').notNull(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }).notNull().defaultNow(),
    payload_retained: boolean('payload_retained').notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.entity_type, table.entity_id] }),
    index('idx_deleted_target_tenant').on(table.tenant_id),
  ],
);

export const deletedRevisionTombstones = pgTable(
  'deleted_revision_tombstones',
  {
    entity_type: text('entity_type').notNull(),
    stable_id: text('stable_id').notNull(),
    revision_id: text('revision_id').notNull(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    deletion_reason_code: text('deletion_reason_code').notNull(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }).notNull().defaultNow(),
    payload_retained: boolean('payload_retained').notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.entity_type, table.revision_id] }),
    index('idx_deleted_rev_triple').on(table.entity_type, table.stable_id, table.revision_id),
    index('idx_deleted_rev_tenant').on(table.tenant_id),
  ],
);
