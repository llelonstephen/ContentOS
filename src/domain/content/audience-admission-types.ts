import type { PropositionSemanticIdentity } from '../knowledge/types.js';
import type {
  AudienceFactualField,
  AudienceStateView,
  ExactRevisionRef,
  JsonPrimitive,
  JsonValue,
  TimestampInput,
} from './types.js';

export type AudiencePathClassification = 'FACTUAL_ASSERTION' | 'STRUCTURAL_NON_FACTUAL';

export interface AudienceFactLeaf {
  readonly audience_field: AudienceFactualField;
  readonly fact_path: string;
  readonly value: JsonPrimitive;
  readonly fact_value_hash: string;
  readonly classification: AudiencePathClassification;
}

export interface AudiencePathClassificationRule {
  readonly audience_field: AudienceFactualField;
  readonly fact_path_selector: string;
  readonly classification: 'STRUCTURAL_NON_FACTUAL';
}

export type AudienceProjectionOperand =
  | 'FACT_VALUE_CANONICAL'
  | 'AUDIENCE_FIELD'
  | 'FACT_PATH'
  | 'TASK_MARKET'
  | 'TASK_JURISDICTION';

export type AudienceProjectionTemplatePart =
  | { readonly type: 'CONST'; readonly value: string }
  | { readonly type: 'OPERAND'; readonly operand: AudienceProjectionOperand }
  | { readonly type: 'TASK_AUDIENCE_CONTEXT'; readonly path: string };

export type AudienceProjectionTemplate = readonly AudienceProjectionTemplatePart[];

export interface AudienceSemanticProjectionRule {
  readonly rule_id: string;
  readonly audience_field: AudienceFactualField;
  readonly fact_path_selector: string;
  readonly classification: 'FACTUAL_ASSERTION';
  readonly proposition_type: 'AUDIENCE';
  readonly canonical_meaning_template: AudienceProjectionTemplate;
  readonly subject_template: AudienceProjectionTemplate;
  readonly predicate_template: AudienceProjectionTemplate;
  readonly object_template: AudienceProjectionTemplate;
  readonly qualifiers_template: AudienceProjectionTemplate;
  readonly conditions_template: AudienceProjectionTemplate;
  readonly population_scope_template: AudienceProjectionTemplate;
  readonly jurisdiction_scope_template: AudienceProjectionTemplate;
  readonly required_input_refs: readonly string[];
}

export interface AudienceSemanticProjectionSchema {
  readonly schema_ref: ExactRevisionRef;
  readonly payload_hash: string;
  readonly path_encoding: 'JSON_POINTER_V1';
  readonly scalar_serialization: 'CANONICAL_JSON_SCALAR_V1';
  readonly classification_rules: readonly AudiencePathClassificationRule[];
  readonly projection_rules: readonly AudienceSemanticProjectionRule[];
}

export interface AudienceSchemaRoleBinding {
  readonly run_config_id: string;
  readonly role: 'CONTENT_INTELLIGENCE_AUDIENCE';
  readonly schema_entity_type: 'SchemaDefinition';
  readonly schema_stable_id: string;
  readonly schema_revision_id: string;
  readonly schema_object_id: string;
  readonly schema_object_key: string;
  readonly schema_payload_hash: string;
  readonly schema_payload_schema_revision_id: string;
}

export interface AudienceManifestTaskContextValue {
  readonly path: string;
  readonly value_hash: string;
}

export interface AudienceManifestEpistemicRef {
  readonly proposition_id: string;
  readonly epistemic_state_id: string;
}

interface AudienceManifestFactCommon {
  readonly audience_field: AudienceFactualField;
  readonly fact_path: string;
  readonly fact_value_hash: string;
  readonly ordinal: number;
}

export type AudienceManifestFactAdmission = AudienceManifestFactCommon & (
  | {
      readonly basis_kind: 'TASK_AUDIENCE_CONTEXT';
      readonly task_id: string;
      readonly task_revision_id: string;
      readonly task_audience_context_path: string;
      readonly task_audience_context_value_hash: string;
    }
  | {
      readonly basis_kind: 'AUDIENCE_EPISTEMIC_STATE';
      readonly proposition_id: string;
      readonly proposition_type: 'AUDIENCE';
      readonly proposition_tenant_id: string;
      readonly proposition_workspace_id: string;
      readonly proposition_identity: PropositionSemanticIdentity;
      readonly epistemic_state_id: string;
      readonly epistemic_tenant_id: string;
      readonly epistemic_workspace_id: string;
      readonly support_status: string;
      readonly known_from: string;
      readonly valid_from: string;
      readonly valid_until?: string | null;
      readonly projection_rule_id: string;
      readonly projection_input_refs: readonly string[];
      readonly projection_input_hash: string;
      readonly projected_identity: PropositionSemanticIdentity;
      readonly semantic_outcome: 'REUSE_EXISTING';
      readonly compared_proposition_id: string;
    }
);

export interface AudienceDerivationManifest {
  readonly tenant_id: string;
  readonly workspace_id: string;
  readonly run_config_id: string;
  readonly task_id: string;
  readonly task_revision_id: string;
  readonly audience_knowledge_cutoff_time: string;
  readonly audience_valid_time: string;
  readonly canonical_input_hash: string;
  readonly derivation_manifest_hash: string;
  readonly audience_schema_ref: ExactRevisionRef;
  readonly audience_schema_payload_hash: string;
  readonly audience_schema_role_binding: AudienceSchemaRoleBinding;
  readonly eligible_task_audience_context: readonly AudienceManifestTaskContextValue[];
  readonly eligible_epistemic_refs: readonly AudienceManifestEpistemicRef[];
  readonly fact_admissions: readonly AudienceManifestFactAdmission[];
  readonly audience_admission_hash?: string;
}

export type AudienceFactBasisSelection = {
  readonly audience_field: AudienceFactualField;
  readonly fact_path: string;
  readonly ordinal: number;
} & (
  | {
      readonly basis_kind: 'TASK_AUDIENCE_CONTEXT';
      readonly task_audience_context_path: string;
    }
  | {
      readonly basis_kind: 'AUDIENCE_EPISTEMIC_STATE';
      readonly proposition_id: string;
      readonly epistemic_state_id: string;
    }
);

export type AudienceFactBasisLink = {
  readonly tenant_id: string;
  readonly workspace_id: string;
  readonly audience_state_id: string;
  readonly audience_field: AudienceFactualField;
  readonly fact_path: string;
  readonly fact_value_hash: string;
  readonly ordinal: number;
} & (
  | {
      readonly basis_kind: 'TASK_AUDIENCE_CONTEXT';
      readonly task_id: string;
      readonly task_revision_id: string;
      readonly task_audience_context_path: string;
      readonly task_audience_context_value_hash: string;
    }
  | {
      readonly basis_kind: 'AUDIENCE_EPISTEMIC_STATE';
      readonly proposition_id: string;
      readonly epistemic_state_id: string;
    }
);

export interface AudiencePropositionInput {
  scope_authorized?: boolean;
  readonly proposition_id: string;
  readonly proposition_type: 'AUDIENCE';
  readonly semantic_identity: PropositionSemanticIdentity;
  readonly tenant_id: string;
  readonly workspace_id: string;
}

export interface AudienceEpistemicStateInput {
  scope_authorized?: boolean;
  valid_at_cutoff?: boolean;
  readonly epistemic_state_id: string;
  readonly proposition_id: string;
  readonly support_status: string;
  readonly known_from: TimestampInput;
  readonly valid_from: TimestampInput;
  readonly valid_until?: TimestampInput | null;
  readonly tenant_id: string;
  readonly workspace_id: string;
}

export interface AudienceAdmissionInput {
  readonly audience: AudienceStateView;
  readonly manifest: AudienceDerivationManifest;
  readonly schema_role_bindings: readonly AudienceSchemaRoleBinding[];
  readonly schema: AudienceSemanticProjectionSchema;
  readonly task_market: string;
  readonly task_jurisdiction: string;
  readonly task_audience_context: JsonValue;
  readonly basis_selections: readonly AudienceFactBasisSelection[];
  readonly propositions: readonly AudiencePropositionInput[];
  readonly epistemic_states: readonly AudienceEpistemicStateInput[];
}

export interface AudienceAdmissionExpectation {
  readonly tenant_id: string;
  readonly workspace_id: string;
  readonly run_config_id: string;
  readonly task_revision_id: string;
  readonly canonical_input_hash: string;
}

export interface AudienceSemanticAdmissionEvidence {
  readonly basis_kind: 'AUDIENCE_EPISTEMIC_STATE';
  readonly audience_field: AudienceFactualField;
  readonly fact_path: string;
  readonly fact_value_hash: string;
  readonly ordinal: number;
  readonly proposition_id: string;
  readonly epistemic_state_id: string;
  readonly selected_projection_rule_id: string;
  readonly projection_inputs: Readonly<Record<string, string>>;
  readonly projection_input_hash: string;
  readonly projected_identity: PropositionSemanticIdentity;
  readonly semantic_equivalence_outcome: 'REUSE_EXISTING';
  readonly compared_proposition_id: string;
}

export interface AudienceTaskBasisAdmissionEvidence {
  readonly basis_kind: 'TASK_AUDIENCE_CONTEXT';
  readonly audience_field: AudienceFactualField;
  readonly fact_path: string;
  readonly fact_value_hash: string;
  readonly ordinal: number;
  readonly task_id: string;
  readonly task_revision_id: string;
  readonly task_audience_context_path: string;
  readonly task_audience_context_value_hash: string;
}

export type AudienceAdmissionEvidence =
  | AudienceSemanticAdmissionEvidence
  | AudienceTaskBasisAdmissionEvidence;

export interface ValidatedAudienceAdmission {
  readonly manifest: AudienceDerivationManifest;
  readonly schema_role_binding: AudienceSchemaRoleBinding;
  readonly schema_ref: ExactRevisionRef;
  readonly schema_payload_hash: string;
  readonly fact_basis_links: readonly AudienceFactBasisLink[];
  readonly admission_evidence: readonly AudienceAdmissionEvidence[];
  readonly audience_admission_hash: string;
}
