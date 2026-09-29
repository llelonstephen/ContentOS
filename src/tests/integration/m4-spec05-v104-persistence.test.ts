import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  AUDIENCE_SCHEMA_ROLE,
  loadAudienceReplayAuthority,
  loadAudienceSchemaPayload,
  resolveAudienceSchemaBindingAuthority,
} from '../../persistence/relational/services/audience-derivation-authority-resolver.js';
import {
  requireAudienceDerivationAuthority,
  type AudienceStateCommitRequest,
} from '../../persistence/relational/services/audience-state-persistence-service.js';

const bytes = Buffer.from(JSON.stringify({ audience_semantic_projection: {
  path_encoding: 'JSON_POINTER_V1', scalar_serialization: 'CANONICAL_JSON_SCALAR_V1',
  classification_rules: [], projection_rules: [],
} }));
const payloadHash = createHash('sha256').update(bytes).digest('hex');
const bindingRow = {
  run_config_id: 'config-1', role: AUDIENCE_SCHEMA_ROLE,
  schema_entity_type: 'SchemaDefinition', schema_stable_id: 'audience-schema',
  schema_revision_id: 'audience-schema-v4', schema_object_id: 'schema-object-v4',
  schema_object_key: `objects/${payloadHash}`, schema_payload_hash: payloadHash,
  schema_payload_schema_revision_id: 'schema-meta-v1',
  revision_payload_hash: payloadHash, object_content_hash: payloadHash,
  object_state: 'AVAILABLE',
};
const scope = {
  tenant_id: 'tenant-1', workspace_id: 'workspace-1', run_config_id: 'config-1',
};

describe('SPEC05 v1.0.4 persistence authority', () => {
  it('resolves the Audience schema only through exact role and membership joins', async () => {
    let query = '';
    const sql = async (strings: TemplateStringsArray): Promise<any[]> => {
      query = strings.join('?').replace(/\s+/g, ' ');
      return [bindingRow];
    };
    const resolved = await resolveAudienceSchemaBindingAuthority(sql, scope);
    expect(resolved).toMatchObject({
      run_config_id: 'config-1', role: AUDIENCE_SCHEMA_ROLE,
      schema_entity_type: 'SchemaDefinition', schema_revision_id: 'audience-schema-v4',
    });
    expect(query).toContain('JOIN run_config_schema_revisions member');
    expect(query).toContain('JOIN registered_control_plane_revision_payloads payload');
    expect(query).not.toMatch(/CURRENT|LATEST|ACTIVE|runtime_parameters/i);
  });

  it('fails closed for a missing role binding or inconsistent payload hash', async () => {
    await expect(resolveAudienceSchemaBindingAuthority(async () => [], scope))
      .rejects.toMatchObject({ code: 'AUDIENCE_SCHEMA_ROLE_BINDING_INVALID' });
    await expect(resolveAudienceSchemaBindingAuthority(
      async () => [{ ...bindingRow, object_content_hash: 'wrong' }], scope,
    )).rejects.toMatchObject({ code: 'AUDIENCE_SCHEMA_ROLE_BINDING_INVALID' });
  });

  it('loads and independently hashes the exact immutable schema payload', async () => {
    const authority = await resolveAudienceSchemaBindingAuthority(async () => [bindingRow], scope);
    const resolved = await loadAudienceSchemaPayload(authority, {
      async get(reference: string) {
        expect(reference).toBe(`objects/${payloadHash}`);
        return bytes;
      },
    } as any);
    expect(resolved.payload).toMatchObject({
      path_encoding: 'JSON_POINTER_V1', scalar_serialization: 'CANONICAL_JSON_SCALAR_V1',
      schema_ref: { entity_type: 'SchemaDefinition', stable_id: 'audience-schema',
        revision_id: 'audience-schema-v4' },
    });
    await expect(loadAudienceSchemaPayload(authority, {
      async get() { return Buffer.from('tampered'); },
    } as any)).rejects.toMatchObject({ code: 'AUDIENCE_SCHEMA_ROLE_BINDING_INVALID' });
  });

  it('replays only exact recorded authority and basis without current/latest selection', async () => {
    const queries: string[] = [];
    let call = 0;
    const sql = async (strings: TemplateStringsArray): Promise<any[]> => {
      queries.push(strings.join('?').replace(/\s+/g, ' '));
      call += 1;
      return call === 1 ? [{
        audience_state_id: 'aud-1', run_config_id: 'config-1',
        audience_knowledge_cutoff_time: '2026-09-29T00:00:00.000Z',
        derivation_manifest: JSON.stringify({ exact: true }), derivation_manifest_hash: 'manifest',
        canonical_input_hash: 'input', role: AUDIENCE_SCHEMA_ROLE,
        schema_entity_type: 'SchemaDefinition', schema_stable_id: 'audience-schema',
        schema_revision_id: 'audience-schema-v4', schema_object_id: 'schema-object-v4',
        schema_object_key: `objects/${payloadHash}`, schema_payload_hash: payloadHash,
        schema_payload_schema_revision_id: 'schema-meta-v1',
      }] : [{ audience_field: 'intent_state', fact_path: '/segment', ordinal: 0 }];
    };
    const replay = await loadAudienceReplayAuthority(sql, scope, 'aud-1');
    expect(replay.schema_binding.schema_revision_id).toBe('audience-schema-v4');
    expect(replay.fact_basis_links).toHaveLength(1);
    expect(queries.join('\n')).not.toMatch(/CURRENT|LATEST|ACTIVE|runtime_parameters/i);
  });

  it('requires cutoff, manifest, role-bound schema, and unique typed fact bases', () => {
    const request = {
      authority: { run_config_id: 'config-1' },
      generation_config: { schema_revision_id: 'audience-schema-v4' },
      derivation_authority: {
        audience_knowledge_cutoff_time: '2026-09-29T00:00:00.000Z',
        derivation_manifest: { taskRevisionId: 'task-rev-1', projectionRuleIds: ['aud-1'] },
        derivation_manifest_hash: 'manifest-hash',
        schema_binding: {
          run_config_id: 'config-1', role: AUDIENCE_SCHEMA_ROLE,
          schema_entity_type: 'SchemaDefinition', schema_stable_id: 'audience-schema',
          schema_revision_id: 'audience-schema-v4', schema_object_id: 'schema-object-v4',
          schema_object_key: `objects/${payloadHash}`, schema_payload_hash: payloadHash,
          schema_payload_schema_revision_id: 'schema-meta-v1',
        },
      },
      fact_basis_links: [{
        audience_field: 'knowledge_state', fact_path: '/industry', fact_value_hash: 'fact-hash',
        basis_kind: 'TASK_AUDIENCE_CONTEXT', task_id: 'task-1',
        task_revision_id: 'task-rev-1', task_audience_context_path: '/industry',
        task_audience_context_value_hash: 'fact-hash', ordinal: 0,
      }],
    } as unknown as AudienceStateCommitRequest;
    expect(requireAudienceDerivationAuthority(request).factBasisLinks).toHaveLength(1);
    expect(() => requireAudienceDerivationAuthority({
      ...request, fact_basis_links: [...request.fact_basis_links!, ...request.fact_basis_links!],
    })).toThrow(/identity must be unique/);
    expect(() => requireAudienceDerivationAuthority({
      ...request, derivation_authority: undefined,
    })).toThrow(/v1.0.4 derivation authority/);
  });

  it('defines idempotent normalized migration without a canonical entity registry entry', () => {
    const migration = readFileSync(path.resolve(
      process.cwd(),
      'src/persistence/relational/migrations/0009_spec05_v104_audience_authority.sql',
    ), 'utf8');
    expect(migration).toContain('run_config_schema_role_bindings');
    expect(migration).toContain('audience_fact_basis_links');
    expect(migration).toContain('audience_derivation_authorities');
    expect(migration).toContain('fk_run_config_schema_role_member');
    expect(migration).toContain('trg_run_config_audience_role_complete');
    expect(migration).toContain('trg_audience_derivation_authority_complete');
    expect(migration).not.toMatch(/INSERT INTO\s+public\.immutable_entity_registry/i);
    expect(migration).not.toMatch(/CURRENT|LATEST|ACTIVE/);
  });
});
