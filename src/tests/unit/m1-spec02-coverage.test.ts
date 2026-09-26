/**
 * M1 Static Field-Coverage Regression Suite
 *
 * Mechanically asserts that every canonical SPEC02 domain entity, required field,
 * optional field, normalized link table, and frozen enum vocabulary is present in the Drizzle schema.
 * Prevents canonical fields from silently disappearing or being renamed.
 */
import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import * as registriesSchema from '../../persistence/relational/schema/registries.js';
import * as controlPlaneSchema from '../../persistence/relational/schema/control-plane.js';
import * as contentSchema from '../../persistence/relational/schema/content.js';
import * as epistemicSchema from '../../persistence/relational/schema/epistemic.js';
import * as governanceSchema from '../../persistence/relational/schema/governance-snapshots.js';
import * as publicationSchema from '../../persistence/relational/schema/publication-measurement.js';
import * as referenceSetsSchema from '../../persistence/relational/schema/reference-sets.js';

import * as operationalSchema from '../../persistence/relational/schema/operational.js';

describe('M1 Static SPEC02 Canonical Coverage Regression', () => {
  describe('TaskContractRevision Schema Fidelity', () => {
    const cols = getTableColumns(controlPlaneSchema.taskContractRevisions);

    it('must have exact required canonical fields', () => {
      const requiredFields = [
        'task_id',
        'task_revision_id',
        'standalone_task',
        'objective',
        'channel',
        'format',
        'language',
        'market',
        'jurisdiction',
        'brand_id',
        'product_id',
        'audience_context',
        'success_metric_revision_id',
        'constraints',
        'risk_context',
        'compute_budget',
        'tenant_id',
        'created_at',
      ];
      for (const field of requiredFields) {
        expect(cols, `Expected required field '${field}' on taskContractRevisions`).toHaveProperty(field);
      }
    });

    it('must have optional fields program_revision_id, supersedes_task_revision_id, intended_publication_time', () => {
      expect(cols).toHaveProperty('program_revision_id');
      expect(cols).toHaveProperty('supersedes_task_revision_id');
      expect(cols).toHaveProperty('intended_publication_time');
      expect(cols).toHaveProperty('workspace_id');
    });

    it('must NOT contain invented non-canonical fields (task_name, primary_metric_revision_id, target_audience, content_format)', () => {
      expect(cols).not.toHaveProperty('task_name');
      expect(cols).not.toHaveProperty('primary_metric_revision_id');
      expect(cols).not.toHaveProperty('target_audience');
      expect(cols).not.toHaveProperty('content_format');
    });
  });

  describe('ChannelProfileRevision & Normalized Reference Sets Schema Fidelity', () => {
    const cpCols = getTableColumns(controlPlaneSchema.channelProfileRevisions);

    it('must have exact ChannelProfileRevision fields', () => {
      const expectedFields = [
        'channel_profile_id',
        'channel_profile_revision_id',
        'supersedes_channel_profile_revision_id',
        'identity',
        'platform_if_applicable',
        'supported_formats',
        'distribution_capabilities',
        'technical_capabilities',
        'content_capabilities',
        'created_at',
        'tenant_id',
      ];
      for (const field of expectedFields) {
        expect(cpCols, `Expected field '${field}' on channelProfileRevisions`).toHaveProperty(field);
      }
    });

    it('must have normalized link tables for ChannelProfileRevision', () => {
      const ruleCols = getTableColumns(referenceSetsSchema.channelProfileRuleRevisions);
      expect(ruleCols).toHaveProperty('channel_profile_revision_id');
      expect(ruleCols).toHaveProperty('rule_revision_id');

      const guidanceCols = getTableColumns(referenceSetsSchema.channelProfileGuidanceRevisions);
      expect(guidanceCols).toHaveProperty('channel_profile_revision_id');
      expect(guidanceCols).toHaveProperty('guidance_revision_id');

      const metricCols = getTableColumns(referenceSetsSchema.channelProfileMetricRevisions);
      expect(metricCols).toHaveProperty('channel_profile_revision_id');
      expect(metricCols).toHaveProperty('metric_revision_id');

      const baselineCpCols = getTableColumns(referenceSetsSchema.baselineChannelProfiles);
      expect(baselineCpCols).toHaveProperty('baseline_snapshot_id');
      expect(baselineCpCols).toHaveProperty('channel_profile_revision_id');
    });
  });

  describe('EvalContractRevision & RunConfig Schema Fidelity', () => {
    it('must have exact EvalContractRevision fields without invented fields', () => {
      const evalCols = getTableColumns(controlPlaneSchema.evalContractRevisions);
      const expected = [
        'eval_contract_id',
        'eval_contract_revision_id',
        'supersedes_eval_contract_revision_id',
        'component',
        'capability',
        'required_dimensions',
        'hard_gates',
        'release_impact',
        'created_at',
        'tenant_id',
      ];
      for (const field of expected) {
        expect(evalCols, `Expected field '${field}' on evalContractRevisions`).toHaveProperty(field);
      }
      expect(evalCols).not.toHaveProperty('contract_name');
      expect(evalCols).not.toHaveProperty('target_artifact_type');
      expect(evalCols).not.toHaveProperty('rubric_definition');
    });

    it('must have exact RunConfig fields and normalized configuration link tables', () => {
      const rcCols = getTableColumns(controlPlaneSchema.runConfigs);
      expect(rcCols).toHaveProperty('run_config_id');
      expect(rcCols).toHaveProperty('runtime_parameters');
      expect(rcCols).toHaveProperty('created_at');
      expect(rcCols).toHaveProperty('tenant_id');

      // Normalized link tables
      expect(getTableColumns(referenceSetsSchema.runConfigPromptRevisions)).toHaveProperty('run_config_id');
      expect(getTableColumns(referenceSetsSchema.runConfigModelRevisions)).toHaveProperty('run_config_id');
      expect(getTableColumns(referenceSetsSchema.runConfigToolRevisions)).toHaveProperty('run_config_id');
      expect(getTableColumns(referenceSetsSchema.runConfigSchemaRevisions)).toHaveProperty('run_config_id');
      expect(getTableColumns(referenceSetsSchema.runConfigRetrieverRevisions)).toHaveProperty('run_config_id');
      expect(getTableColumns(referenceSetsSchema.runConfigEvaluatorRevisions)).toHaveProperty('run_config_id');
    });
  });

  describe('Registries & Control Plane Generic Payloads Schema Fidelity', () => {
    it('RevisionRegistry must have entity_type, stable_id, revision_id, tenant_id, payload_state', () => {
      const cols = getTableColumns(registriesSchema.revisionRegistry);
      expect(cols).toHaveProperty('entity_type');
      expect(cols).toHaveProperty('stable_id');
      expect(cols).toHaveProperty('revision_id');
      expect(cols).toHaveProperty('tenant_id');
      expect(cols).toHaveProperty('payload_state');
    });

    it('ImmutableEntityRegistry must have entity_type, entity_id, tenant_id, payload_state', () => {
      const cols = getTableColumns(registriesSchema.immutableEntityRegistry);
      expect(cols).toHaveProperty('entity_type');
      expect(cols).toHaveProperty('entity_id');
      expect(cols).toHaveProperty('tenant_id');
      expect(cols).toHaveProperty('payload_state');
    });

    it('RegisteredControlPlaneRevision must have exact fields: payload_hash, payload_schema_revision_id', () => {
      const cols = getTableColumns(controlPlaneSchema.registeredControlPlaneRevisions);
      expect(cols).toHaveProperty('entity_type');
      expect(cols).toHaveProperty('stable_id');
      expect(cols).toHaveProperty('revision_id');
      expect(cols).toHaveProperty('payload_hash');
      expect(cols).toHaveProperty('payload_schema_revision_id');
      expect(cols).toHaveProperty('tenant_id');
      expect(cols).not.toHaveProperty('description');
    });

    it('RegisteredControlPlaneRevisionPayload must have entity_type, stable_id, revision_id, tenant_id, object_id, payload_hash, payload_schema_revision_id', () => {
      const cols = getTableColumns(controlPlaneSchema.registeredControlPlaneRevisionPayloads);
      expect(cols).toHaveProperty('entity_type');
      expect(cols).toHaveProperty('stable_id');
      expect(cols).toHaveProperty('revision_id');
      expect(cols).toHaveProperty('tenant_id');
      expect(cols).toHaveProperty('object_id');
      expect(cols).toHaveProperty('payload_hash');
      expect(cols).toHaveProperty('payload_schema_revision_id');
    });
  });

  describe('ReplayabilityStatus & RightsPolicy Schema Fidelity', () => {
    it('ReplayabilityStatus must have exact fields: decision_id, tenant_id, status, reason_codes, updated_at', () => {
      const cols = getTableColumns(publicationSchema.replayabilityStatuses);
      expect(cols).toHaveProperty('decision_id');
      expect(cols).toHaveProperty('tenant_id');
      expect(cols).toHaveProperty('status');
      expect(cols).toHaveProperty('reason_codes');
      expect(cols).toHaveProperty('updated_at');
      expect(getTableColumns(referenceSetsSchema.replayabilityMissingRefs)).toHaveProperty('decision_id');
    });

    it('RightsPolicy must exist as an independent canonical table with exact SPEC02 fields', () => {
      const cols = getTableColumns(contentSchema.rightsPolicies);
      expect(cols).toHaveProperty('rights_policy_id');
      expect(cols).toHaveProperty('copyright_status');
      expect(cols).toHaveProperty('license');
      expect(cols).toHaveProperty('analysis_use');
      expect(cols).toHaveProperty('generation_use');
      expect(cols).toHaveProperty('quotation_use');
      expect(cols).toHaveProperty('transformation_permission');
      expect(cols).toHaveProperty('redistribution_permission');
      expect(cols).toHaveProperty('commercial_use_permission');
      expect(cols).toHaveProperty('attribution_requirements');
      expect(cols).toHaveProperty('effective_from');
      expect(cols).toHaveProperty('tenant_id');
      expect(cols).toHaveProperty('created_at');
    });
  });

  describe('DecisionCycle & Snapshots Schema Fidelity', () => {
    it('DecisionCycle must enforce run_id, cycle_number, parent_cycle_id, status, reason', () => {
      const cols = getTableColumns(operationalSchema.decisionCycles);
      expect(cols).toHaveProperty('decision_cycle_id');
      expect(cols).toHaveProperty('run_id');
      expect(cols).toHaveProperty('cycle_number');
      expect(cols).toHaveProperty('parent_cycle_id');
      expect(cols).toHaveProperty('status');
      expect(cols).toHaveProperty('reason');
    });

    it('DecisionSnapshot must enforce relational freeze pointers', () => {
      const cols = getTableColumns(governanceSchema.decisionSnapshots);
      expect(cols).toHaveProperty('snapshot_id');
      expect(cols).toHaveProperty('baseline_knowledge_snapshot_id');
      expect(cols).toHaveProperty('run_knowledge_delta_id');
      expect(cols).toHaveProperty('governance_snapshot_id');
      expect(cols).toHaveProperty('run_config_id');
      expect(cols).toHaveProperty('task_revision_id');
      expect(cols).toHaveProperty('audience_state_id');
      expect(cols).toHaveProperty('frozen_at');
    });

    it('FinalContentPackage must NOT contain release_status (release_status belongs exclusively to DecisionRecord)', () => {
      const fcpCols = getTableColumns(governanceSchema.finalContentPackages);
      expect(fcpCols).not.toHaveProperty('release_status');
      expect(fcpCols).toHaveProperty('decision_id');
      expect(fcpCols).toHaveProperty('selected_candidate_id');
      expect(fcpCols).toHaveProperty('decision_snapshot_id');
      expect(fcpCols).toHaveProperty('created_at');

      const drCols = getTableColumns(governanceSchema.decisionRecords);
      expect(drCols).toHaveProperty('release_status');
      expect(drCols).toHaveProperty('selected_action');
      expect(drCols).toHaveProperty('selected_candidate_id');
    });
  });
});
