/**
 * ContentOS — Relational Registries Schema
 *
 * Implements SPEC02:
 *   - ImmutableEntityRegistry (§5)
 *   - RevisionRegistry (§6)
 *   - CanonicalObjectReferenceSource (§19, §30)
 *   - ObjectRegistry (§19, §30)
 */
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  primaryKey,
  uniqueIndex,
  foreignKey,
} from 'drizzle-orm/pg-core';

/**
 * ImmutableEntityRegistry (SPEC02 §5)
 *
 * Generic target for ImmutableEntityRef (entity_type, entity_id).
 * Every immutable domain entity registers here in the same transaction.
 */
export const immutableEntityRegistry = pgTable(
  'immutable_entity_registry',
  {
    entity_type: text('entity_type').notNull(),
    entity_id: text('entity_id').notNull(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    payload_state: text('payload_state').notNull().default('AVAILABLE'), // AVAILABLE | REDACTED | DELETED
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.entity_type, table.entity_id] }),
  ],
);

/**
 * RevisionRegistry (SPEC02 §6)
 *
 * Generic identity and lookup registry for RevisionRef (entity_type, stable_id, revision_id).
 * RevisionRegistry MUST NOT duplicate supersedes_revision_id truth.
 */
export const revisionRegistry = pgTable(
  'revision_registry',
  {
    entity_type: text('entity_type').notNull(),
    stable_id: text('stable_id').notNull(),
    revision_id: text('revision_id').notNull(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    payload_state: text('payload_state').notNull().default('AVAILABLE'), // AVAILABLE | REDACTED | DELETED
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.entity_type, table.revision_id] }),
    uniqueIndex('uq_revision_registry_triple').on(
      table.entity_type,
      table.stable_id,
      table.revision_id,
    ),
  ],
);

/**
 * CanonicalObjectReferenceSource (SPEC02 §19, §30)
 *
 * Registry of all canonical tables and columns that FK to ObjectRegistry.
 * Used by GC reachability audit.
 */
export const canonicalObjectReferenceSources = pgTable(
  'canonical_object_reference_sources',
  {
    source_name: text('source_name').primaryKey(),
    source_table: text('source_table').notNull(),
    object_id_column: text('object_id_column').notNull(),
    owner_scope_columns: text('owner_scope_columns').notNull(),
    active: boolean('active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_obj_ref_source_table_column').on(
      table.source_table,
      table.object_id_column,
    ),
  ],
);

/**
 * ObjectRegistry (SPEC02 §19, §30)
 *
 * Tenant-scoped content-addressed immutable object metadata.
 */
export const objectRegistry = pgTable(
  'object_registry',
  {
    object_id: text('object_id').primaryKey(),
    tenant_id: text('tenant_id').notNull(),
    workspace_id: text('workspace_id'),
    content_hash: text('content_hash').notNull(),
    object_key: text('object_key').notNull(),
    size_bytes: integer('size_bytes').notNull(),
    media_type: text('media_type').notNull(),
    state: text('state').notNull().default('AVAILABLE'), // AVAILABLE | GC_CLAIMED | DELETED
    gc_claim_token: text('gc_claim_token'),
    gc_claimed_at: timestamp('gc_claimed_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uq_object_registry_tenant_hash').on(table.tenant_id, table.content_hash),
    uniqueIndex('uq_object_registry_tenant_key').on(table.tenant_id, table.object_key),
  ],
);

/**
 * ObjectReference (SPEC02 §19, §30)
 *
 * Normalized relational object reference from an immutable entity to ObjectRegistry.
 */
export const objectReferences = pgTable(
  'object_references',
  {
    owner_entity_type: text('owner_entity_type').notNull(),
    owner_entity_id: text('owner_entity_id').notNull(),
    field_name: text('field_name').notNull(),
    object_id: text('object_id')
      .notNull()
      .references(() => objectRegistry.object_id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.owner_entity_type, table.owner_entity_id, table.field_name],
    }),
    foreignKey({
      columns: [table.owner_entity_type, table.owner_entity_id],
      foreignColumns: [
        immutableEntityRegistry.entity_type,
        immutableEntityRegistry.entity_id,
      ],
    }),
  ],
);
