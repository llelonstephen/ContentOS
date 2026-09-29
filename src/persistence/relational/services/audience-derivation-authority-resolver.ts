import { createHash } from 'node:crypto';
import { RegistryValidationError } from '../../../domain/services/registry-validator.js';
import type { ObjectStore } from '../../objects/object-store-interface.js';
import { getDefaultObjectStore } from '../../objects/default-object-store.js';
import type { ContentRuntimeCommitAuthority } from './content-runtime-authority.js';
import type { AudienceSemanticProjectionSchema } from '../../../domain/content/audience-admission-types.js';

export const AUDIENCE_SCHEMA_ROLE = 'CONTENT_INTELLIGENCE_AUDIENCE' as const;

export interface AudienceSchemaBindingAuthority {
  readonly run_config_id: string;
  readonly role: typeof AUDIENCE_SCHEMA_ROLE;
  readonly schema_entity_type: 'SchemaDefinition';
  readonly schema_stable_id: string;
  readonly schema_revision_id: string;
  readonly schema_object_id: string;
  readonly schema_object_key: string;
  readonly schema_payload_hash: string;
  readonly schema_payload_schema_revision_id: string;
}

export interface CapturedAudienceDerivationAuthority {
  readonly audience_knowledge_cutoff_time: string;
  readonly schema_binding: AudienceSchemaBindingAuthority;
}

export interface ResolvedAudienceSchemaPayload {
  readonly authority: AudienceSchemaBindingAuthority;
  readonly payload: AudienceSemanticProjectionSchema;
}

export interface AudienceReplayAuthority {
  readonly audience_state_id: string;
  readonly run_config_id: string;
  readonly audience_knowledge_cutoff_time: string;
  readonly derivation_manifest: Readonly<Record<string, unknown>>;
  readonly derivation_manifest_hash: string;
  readonly canonical_input_hash: string;
  readonly schema_binding: AudienceSchemaBindingAuthority;
  readonly fact_basis_links: readonly Readonly<Record<string, unknown>>[];
}

type AudienceAuthorityScope = Pick<ContentRuntimeCommitAuthority,
  'tenant_id' | 'workspace_id' | 'run_config_id'>;

function invalidBinding(message: string): never {
  throw new RegistryValidationError('AUDIENCE_SCHEMA_ROLE_BINDING_INVALID', message);
}

export async function resolveAudienceSchemaBindingAuthority(
  sqlTx: any,
  scope: AudienceAuthorityScope,
): Promise<AudienceSchemaBindingAuthority> {
  const rows = await sqlTx`
    SELECT binding.run_config_id, binding.role,
      binding.schema_entity_type, binding.schema_stable_id, binding.schema_revision_id,
      payload.object_id AS schema_object_id, object.object_key AS schema_object_key,
      payload.payload_hash AS schema_payload_hash,
      payload.payload_schema_revision_id AS schema_payload_schema_revision_id,
      revision.payload_hash AS revision_payload_hash,
      object.content_hash AS object_content_hash, object.state AS object_state
    FROM run_config_schema_role_bindings binding
    JOIN run_configs config ON config.run_config_id = binding.run_config_id
    JOIN run_config_schema_revisions member
      ON member.run_config_id = binding.run_config_id
      AND member.entity_type = binding.schema_entity_type
      AND member.stable_id = binding.schema_stable_id
      AND member.revision_id = binding.schema_revision_id
    JOIN registered_control_plane_revisions revision
      ON revision.entity_type = member.entity_type
      AND revision.stable_id = member.stable_id
      AND revision.revision_id = member.revision_id
    JOIN registered_control_plane_revision_payloads payload
      ON payload.entity_type = revision.entity_type
      AND payload.stable_id = revision.stable_id
      AND payload.revision_id = revision.revision_id
    JOIN object_registry object
      ON object.object_id = payload.object_id AND object.tenant_id = payload.tenant_id
    WHERE binding.run_config_id = ${scope.run_config_id}
      AND binding.role = ${AUDIENCE_SCHEMA_ROLE}
      AND binding.schema_entity_type = 'SchemaDefinition'
      AND config.tenant_id = ${scope.tenant_id}
      AND config.workspace_id IS NOT DISTINCT FROM ${scope.workspace_id || null}
      AND revision.tenant_id = config.tenant_id
      AND revision.workspace_id IS NOT DISTINCT FROM config.workspace_id
      AND payload.tenant_id = config.tenant_id
      AND payload.workspace_id IS NOT DISTINCT FROM config.workspace_id
  `;
  if (rows.length !== 1) {
    invalidBinding('Exactly one exact Audience SchemaDefinition role binding must resolve.');
  }
  const row = rows[0];
  if (row.object_state !== 'AVAILABLE' || !row.schema_object_id || !row.schema_object_key) {
    invalidBinding('Audience SchemaDefinition immutable payload is unavailable.');
  }
  if (row.schema_payload_hash !== row.revision_payload_hash ||
      row.schema_payload_hash !== row.object_content_hash) {
    invalidBinding('Audience SchemaDefinition payload hash binding is inconsistent.');
  }
  return {
    run_config_id: String(row.run_config_id),
    role: AUDIENCE_SCHEMA_ROLE,
    schema_entity_type: 'SchemaDefinition',
    schema_stable_id: String(row.schema_stable_id),
    schema_revision_id: String(row.schema_revision_id),
    schema_object_id: String(row.schema_object_id),
    schema_object_key: String(row.schema_object_key),
    schema_payload_hash: String(row.schema_payload_hash),
    schema_payload_schema_revision_id: String(row.schema_payload_schema_revision_id),
  };
}

export async function loadAudienceSchemaPayload(
  authority: AudienceSchemaBindingAuthority,
  objectStore: ObjectStore = getDefaultObjectStore(),
): Promise<ResolvedAudienceSchemaPayload> {
  const bytes = await objectStore.get(authority.schema_object_key);
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== authority.schema_payload_hash) {
    invalidBinding('Audience SchemaDefinition object bytes fail exact payload-hash verification.');
  }
  try {
    const root = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
    const payload = (root.audience_semantic_projection ?? root) as Partial<AudienceSemanticProjectionSchema>;
    if (!payload || payload.path_encoding !== 'JSON_POINTER_V1' ||
        payload.scalar_serialization !== 'CANONICAL_JSON_SCALAR_V1' ||
        !Array.isArray(payload.classification_rules) || !Array.isArray(payload.projection_rules)) {
      invalidBinding('Audience SchemaDefinition lacks a valid audience_semantic_projection section.');
    }
    return {
      authority,
      payload: {
        ...payload,
        schema_ref: {
          entity_type: authority.schema_entity_type,
          stable_id: authority.schema_stable_id,
          revision_id: authority.schema_revision_id,
        },
        payload_hash: authority.schema_payload_hash,
      } as AudienceSemanticProjectionSchema,
    };
  } catch {
    invalidBinding('Audience SchemaDefinition payload is not valid JSON.');
  }
}

/** Loads only the immutable authority recorded for one historical AudienceState. */
export async function loadAudienceReplayAuthority(
  sqlTx: any,
  scope: Pick<ContentRuntimeCommitAuthority, 'tenant_id' | 'workspace_id'>,
  audienceStateId: string,
): Promise<AudienceReplayAuthority> {
  const [row] = await sqlTx`
    SELECT authority.audience_state_id, authority.run_config_id,
      authority.audience_knowledge_cutoff_time, authority.derivation_manifest,
      authority.derivation_manifest_hash, authority.canonical_input_hash,
      authority.schema_role AS role, authority.schema_entity_type,
      authority.schema_stable_id, authority.schema_revision_id,
      authority.schema_object_id, object.object_key AS schema_object_key,
      authority.schema_payload_hash,
      payload.payload_schema_revision_id AS schema_payload_schema_revision_id
    FROM audience_derivation_authorities authority
    JOIN registered_control_plane_revision_payloads payload
      ON payload.entity_type = authority.schema_entity_type
      AND payload.stable_id = authority.schema_stable_id
      AND payload.revision_id = authority.schema_revision_id
      AND payload.object_id = authority.schema_object_id
      AND payload.payload_hash = authority.schema_payload_hash
    JOIN object_registry object ON object.object_id = authority.schema_object_id
    WHERE authority.audience_state_id = ${audienceStateId}
      AND authority.tenant_id = ${scope.tenant_id}
      AND authority.workspace_id IS NOT DISTINCT FROM ${scope.workspace_id || null}
  `;
  if (!row) invalidBinding('Historical Audience authority does not resolve in the exact scope.');
  const links = await sqlTx`
    SELECT audience_field, fact_path, fact_value_hash, basis_kind,
      task_id, task_revision_id, task_audience_context_path,
      task_audience_context_value_hash, proposition_id, epistemic_state_id, ordinal
    FROM audience_fact_basis_links
    WHERE audience_state_id = ${audienceStateId}
      AND tenant_id = ${scope.tenant_id}
      AND workspace_id IS NOT DISTINCT FROM ${scope.workspace_id}
    ORDER BY ordinal, audience_field, fact_path
  `;
  return {
    audience_state_id: String(row.audience_state_id),
    run_config_id: String(row.run_config_id),
    audience_knowledge_cutoff_time: new Date(row.audience_knowledge_cutoff_time).toISOString(),
    derivation_manifest: typeof row.derivation_manifest === 'string'
      ? JSON.parse(row.derivation_manifest) as Record<string, unknown>
      : row.derivation_manifest as Record<string, unknown>,
    derivation_manifest_hash: String(row.derivation_manifest_hash),
    canonical_input_hash: String(row.canonical_input_hash),
    schema_binding: {
      run_config_id: String(row.run_config_id), role: AUDIENCE_SCHEMA_ROLE,
      schema_entity_type: 'SchemaDefinition', schema_stable_id: String(row.schema_stable_id),
      schema_revision_id: String(row.schema_revision_id),
      schema_object_id: String(row.schema_object_id), schema_object_key: String(row.schema_object_key),
      schema_payload_hash: String(row.schema_payload_hash),
      schema_payload_schema_revision_id: String(row.schema_payload_schema_revision_id),
    },
    fact_basis_links: links,
  };
}

export async function assertAudienceSchemaBindingUnchanged(
  sqlTx: any,
  scope: AudienceAuthorityScope,
  expected: AudienceSchemaBindingAuthority,
): Promise<void> {
  const current = await resolveAudienceSchemaBindingAuthority(sqlTx, scope);
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new RegistryValidationError(
      'AUDIENCE_DERIVATION_AUTHORITY_STALE',
      'Audience schema role binding or immutable payload authority changed before commit.',
    );
  }
}

export class PostgresAudienceDerivationAuthorityResolver {
  constructor(
    private readonly sql: any,
    private readonly objectStore: ObjectStore = getDefaultObjectStore(),
  ) {}

  async capture(scope: AudienceAuthorityScope): Promise<{
    captured: CapturedAudienceDerivationAuthority;
    schemaPayload: AudienceSemanticProjectionSchema;
  }> {
    const captured = await this.sql.begin(
      'isolation level repeatable read',
      async (sqlTx: any) => {
        const [clock] = await sqlTx`SELECT transaction_timestamp() AS cutoff`;
        const schema_binding = await resolveAudienceSchemaBindingAuthority(sqlTx, scope);
        return {
          audience_knowledge_cutoff_time: new Date(clock.cutoff).toISOString(),
          schema_binding,
        };
      },
    );
    const resolved = await loadAudienceSchemaPayload(captured.schema_binding, this.objectStore);
    return { captured, schemaPayload: resolved.payload };
  }
}
