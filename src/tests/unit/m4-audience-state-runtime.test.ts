import { describe, expect, it } from 'vitest';
import { DeriveAudienceState } from '../../application/content-intelligence/derive-audience-state.js';
import { hashAudienceDerivationManifest, type AudienceStateView } from '../../domain/content/index.js';
import {
  AudienceStatePersistenceService,
  type AudienceStateAtomicCommitPort,
} from '../../persistence/relational/services/audience-state-persistence-service.js';

const previous: AudienceStateView = {
  audience_state_id: 'aud-refined', task_revision_id: 'task-1', state_stage: 'REFINED',
  context: {}, knowledge_state: {}, problem_state: {}, solution_state: {}, product_state: {},
  brand_state: {}, intent_state: {}, desired_outcome: {}, objections: [], decision_criteria: [],
  prior_exposure: {}, origin: [{ kind: 'PROPOSITION', reference_id: 'prop-1' }],
  uncertainty: [{ kind: 'UNKNOWN', description: 'Sparse evidence' }],
  created_at: '2026-09-28T00:00:00Z',
};

const authority = {
  tenant_id: 'tenant-1', workspace_id: 'workspace-1', run_id: 'run-1',
  decision_cycle_id: 'cycle-1', stage_execution_id: 'stage-1', fencing_token: 2,
  lease_owner: 'worker-1', cycle_epoch: 1, stage_name: 'AUDIENCE_FINALIZE' as const,
  idempotency_key: 'audience-request-1', run_config_id: 'config-1',
  canonical_input_hash: 'hash-1',
};
const pins = { prompt_revision_id: 'prompt-1', model_revision_id: 'model-1',
  schema_revision_id: 'schema-1', tool_revision_ids: ['tool-1'] };
const manifest = {
  tenant_id: 'tenant-1', workspace_id: 'workspace-1', run_config_id: 'config-1',
  task_id: 'task-stable-1', task_revision_id: 'task-1',
  audience_knowledge_cutoff_time: '2026-09-28T00:30:00.000Z', canonical_input_hash: 'hash-1',
  derivation_manifest_hash: '',
  audience_schema_ref: { entity_type: 'SchemaDefinition', stable_id: 'audience-schema',
    revision_id: 'schema-1' },
  audience_schema_payload_hash: 'schema-hash-1',
  eligible_task_audience_context: [], eligible_epistemic_refs: [],
};
const admissionAuthority = {
  manifest: { ...manifest, derivation_manifest_hash: hashAudienceDerivationManifest(manifest) },
  schema_role_bindings: [{
    run_config_id: 'config-1', role: 'CONTENT_INTELLIGENCE_AUDIENCE' as const,
    schema_entity_type: 'SchemaDefinition' as const, schema_stable_id: 'audience-schema',
    schema_revision_id: 'schema-1', schema_object_id: 'schema-object-1',
    schema_object_key: 'schemas/audience-v1.json', schema_payload_hash: 'schema-hash-1',
    schema_payload_schema_revision_id: 'meta-schema-v1',
  }],
  schema: {
    schema_ref: { entity_type: 'SchemaDefinition', stable_id: 'audience-schema',
      revision_id: 'schema-1' },
    payload_hash: 'schema-hash-1', path_encoding: 'JSON_POINTER_V1' as const,
    scalar_serialization: 'CANONICAL_JSON_SCALAR_V1' as const,
    classification_rules: [], projection_rules: [],
  },
  task_market: 'VN', task_jurisdiction: 'VN', task_audience_context: {},
  propositions: [], epistemic_states: [],
};

describe('M4 audience runtime', () => {
  it('generates before atomic commit and binds governance refresh to the new final state', async () => {
    const order: string[] = [];
    const port: AudienceStateAtomicCommitPort = {
      async commitAudienceState(request) {
        order.push('commit');
        expect(request.governance_refresh?.audience_state_id).toBe('aud-final');
        return request.state;
      },
    };
    const service = new DeriveAudienceState(
      { async resolveAuthorizedInputs() {
        order.push('resolve');
        return {
          previous_state: previous,
          provider_context: { exact: true },
          admission_authority: admissionAuthority,
          material_governance_dependencies_changed: true,
          governance_refresh: {
            governance_snapshot_id: 'gov-refresh-1', dependency_fingerprint: 'deps-2',
          },
        };
      } },
      { async generateAudienceProposal() {
        order.push('provider');
        const { audience_state_id: _id, task_revision_id: _task, state_stage: _stage,
          created_at: _created, ...proposal } = previous;
        return { proposal, basis_selections: [] };
      } },
      new AudienceStatePersistenceService(port),
      { nextAudienceStateId: () => 'aud-final', now: () => new Date('2026-09-28T01:00:00Z') },
      { async resolve() { order.push('pins'); return pins; } },
    );

    const state = await service.execute({
      authority, request_identity: 'audience-request-1', task_revision_id: 'task-1',
      target_stage: 'FINAL_FOR_DECISION', previous_audience_state_id: 'aud-refined',
    });
    expect(state.audience_state_id).toBe('aud-final');
    expect(order).toEqual(['resolve', 'pins', 'provider', 'commit']);
  });

  it('rejects final admission when changed governance dependencies lack refresh evidence', async () => {
    const persistence = new AudienceStatePersistenceService({
      async commitAudienceState(request) { return request.state; },
    });
    await expect(persistence.commit({
      authority, request_identity: 'audience-request-2', previous_state: previous,
      material_governance_dependencies_changed: true,
      generation_config: pins,
      state: { ...previous, audience_state_id: 'aud-final', state_stage: 'FINAL_FOR_DECISION' },
    })).rejects.toThrow(/refresh evidence/);
  });

  it('rejects refinement that reuses the previous immutable identity', async () => {
    const persistence = new AudienceStatePersistenceService({
      async commitAudienceState(request) { return request.state; },
    });
    await expect(persistence.commit({
      authority, request_identity: 'audience-request-3', previous_state: previous,
      material_governance_dependencies_changed: false,
      generation_config: pins,
      state: { ...previous, state_stage: 'FINAL_FOR_DECISION' },
    })).rejects.toThrow(/new immutable ID/);
  });
});
