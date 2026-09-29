import {
  CONTENT_CANONICAL_SERIALIZATION_VERSION,
  hashCanonicalInput,
  type CanonicalField,
} from "./canonical-input-serialization.js";
import { materializeAudienceFactBasisAdmissions } from './audience-basis-admission.js';
import { hashAudienceDerivationManifest } from './audience-derivation-manifest.js';
import { collectAudienceFactLeaves } from './audience-fact-path.js';
import { validateAudienceSemanticProjectionSchema } from './audience-semantic-projection.js';
import { validateAudienceState } from './audience-state-validator.js';
import { failContent } from './content-error-codes.js';
import {
  AUDIENCE_FACTUAL_FIELDS,
  type AudienceFactualField,
  type JsonValue,
} from './types.js';
import type {
  AudienceAdmissionExpectation,
  AudienceAdmissionInput,
  AudienceFactLeaf,
  AudienceAdmissionEvidence,
  AudienceSchemaRoleBinding,
  ValidatedAudienceAdmission,
} from './audience-admission-types.js';

function sameSchemaRef(
  left: { readonly entity_type: string; readonly stable_id: string; readonly revision_id: string },
  right: { readonly entity_type: string; readonly stable_id: string; readonly revision_id: string },
): boolean {
  return left.entity_type === right.entity_type &&
    left.stable_id === right.stable_id &&
    left.revision_id === right.revision_id;
}

function validateRoleBinding(
  input: Pick<AudienceAdmissionInput, 'schema_role_bindings' | 'schema'>,
  expected: AudienceAdmissionExpectation,
): AudienceSchemaRoleBinding {
  if (input.schema_role_bindings.length !== 1) {
    failContent(
      'AUDIENCE_SCHEMA_ROLE_BINDING_INVALID',
      'Audience admission requires exactly one CONTENT_INTELLIGENCE_AUDIENCE role binding',
    );
  }
  const binding = input.schema_role_bindings[0]!;
  const schemaRef = input.schema.schema_ref;
  if (
    binding.role !== 'CONTENT_INTELLIGENCE_AUDIENCE' ||
    binding.run_config_id !== expected.run_config_id ||
    binding.schema_entity_type !== 'SchemaDefinition' ||
    binding.schema_stable_id !== schemaRef.stable_id ||
    binding.schema_revision_id !== schemaRef.revision_id ||
    !binding.schema_object_id || !binding.schema_object_key ||
    !binding.schema_payload_schema_revision_id ||
    binding.schema_payload_hash !== input.schema.payload_hash
  ) {
    failContent('AUDIENCE_SCHEMA_ROLE_BINDING_INVALID', 'Audience schema role binding is not exact');
  }
  return binding;
}

function validateManifest(
  input: Pick<AudienceAdmissionInput, 'manifest' | 'schema'>,
  expected: AudienceAdmissionExpectation,
): void {
  const manifest = input.manifest;
  const cutoff = new Date(manifest.audience_knowledge_cutoff_time);
  if (
    manifest.tenant_id !== expected.tenant_id ||
    manifest.workspace_id !== expected.workspace_id ||
    manifest.run_config_id !== expected.run_config_id ||
    manifest.task_revision_id !== expected.task_revision_id ||
    manifest.canonical_input_hash !== expected.canonical_input_hash ||
    !Number.isFinite(cutoff.getTime()) || cutoff.toISOString() !== manifest.audience_knowledge_cutoff_time ||
    manifest.derivation_manifest_hash !== hashAudienceDerivationManifest(manifest) ||
    manifest.audience_schema_payload_hash !== input.schema.payload_hash ||
    !sameSchemaRef(manifest.audience_schema_ref, input.schema.schema_ref)
  ) {
    failContent('AUDIENCE_PROVENANCE_INVALID', 'Audience derivation manifest identity is not exact');
  }
}

function exactCoverageKey(field: AudienceFactualField, path: string): string {
  return `${field}:${path}`;
}

function validateFactCoverage(
  input: AudienceAdmissionInput,
  admittedLinks: ValidatedAudienceAdmission['fact_basis_links'],
): void {
  const leaves = collectAudienceFactLeaves(input.audience, input.schema.classification_rules);
  const factualKeys = new Set(
    leaves.filter(({ classification }) => classification === 'FACTUAL_ASSERTION')
      .map(({ audience_field, fact_path }) => exactCoverageKey(audience_field, fact_path)),
  );
  const uncertainKeys = new Set<string>();
  for (const item of input.audience.uncertainty) {
    const fields = [item.audience_field, item.fact_path, item.status];
    const hasAny = fields.some((value) => value !== undefined);
    const hasAll = fields.every((value) => value !== undefined);
    if (!hasAny) continue;
    if (
      !hasAll || item.status !== 'UNRESOLVED' ||
      !AUDIENCE_FACTUAL_FIELDS.includes(item.audience_field as AudienceFactualField)
    ) {
      failContent('AUDIENCE_UNCERTAINTY_COVERAGE_INVALID', 'Uncertainty coverage is incomplete');
    }
    const key = exactCoverageKey(item.audience_field!, item.fact_path!);
    if (!factualKeys.has(key) || uncertainKeys.has(key)) {
      failContent('AUDIENCE_UNCERTAINTY_COVERAGE_INVALID', `Invalid uncertainty coverage '${key}'`);
    }
    uncertainKeys.add(key);
  }

  const linkedKeys = new Set(admittedLinks.map(
    ({ audience_field, fact_path }) => exactCoverageKey(audience_field, fact_path),
  ));
  for (const key of factualKeys) {
    const coveredByBasis = linkedKeys.has(key);
    const coveredByUncertainty = uncertainKeys.has(key);
    if (coveredByBasis === coveredByUncertainty) {
      failContent(
        'AUDIENCE_FACT_UNGROUNDED',
        `Audience factual leaf '${key}' requires exactly one basis or unresolved-uncertainty path`,
      );
    }
  }
}

export function computeAudienceAdmissionHash(
  input: AudienceAdmissionInput,
  binding: AudienceSchemaRoleBinding,
  leaves: readonly AudienceFactLeaf[],
  links: ValidatedAudienceAdmission["fact_basis_links"],
  evidence?: readonly AudienceAdmissionEvidence[],
): string {
  let effectiveEvidence = evidence;
  if (!effectiveEvidence && input.schema && input.propositions && input.epistemic_states && input.basis_selections) {
    try {
      effectiveEvidence = materializeAudienceFactBasisAdmissions(input, leaves).evidence;
    } catch {
      effectiveEvidence = undefined;
    }
  }
  const proposalContent = {
    context: input.audience.context,
    knowledge_state: input.audience.knowledge_state,
    problem_state: input.audience.problem_state,
    solution_state: input.audience.solution_state,
    product_state: input.audience.product_state,
    brand_state: input.audience.brand_state,
    intent_state: input.audience.intent_state,
    desired_outcome: input.audience.desired_outcome,
    objections: input.audience.objections,
    decision_criteria: input.audience.decision_criteria,
    prior_exposure: input.audience.prior_exposure,
    origin: input.audience.origin,
    uncertainty: input.audience.uncertainty,
  };

  const fields: CanonicalField[] = [
    { name: "canonical_input_hash", kind: "VALUE", value: input.manifest.canonical_input_hash },
    { name: "tenant_id", kind: "VALUE", value: input.manifest.tenant_id },
    { name: "workspace_id", kind: "VALUE", value: input.manifest.workspace_id ?? null },
    { name: "task_revision_id", kind: "VALUE", value: input.manifest.task_revision_id },
    {
      name: "audience_knowledge_cutoff_time",
      kind: "TIMESTAMP",
      value: input.manifest.audience_knowledge_cutoff_time,
    },
    {
      name: "audience_schema_ref",
      kind: "VALUE",
      value: {
        entity_type: input.schema.schema_ref.entity_type,
        stable_id: input.schema.schema_ref.stable_id,
        revision_id: input.schema.schema_ref.revision_id,
      },
    },
    {
      name: "audience_schema_payload_hash",
      kind: "VALUE",
      value: input.schema.payload_hash,
    },
    {
      name: "audience_schema_role_binding",
      kind: "VALUE",
      value: {
        run_config_id: binding.run_config_id,
        role: binding.role,
        schema_entity_type: binding.schema_entity_type,
        schema_stable_id: binding.schema_stable_id,
        schema_revision_id: binding.schema_revision_id,
        schema_object_id: binding.schema_object_id,
        schema_object_key: binding.schema_object_key,
        schema_payload_hash: binding.schema_payload_hash,
        schema_payload_schema_revision_id: binding.schema_payload_schema_revision_id,
      },
    },
    {
      name: "normalized_audience_content",
      kind: "VALUE",
      value: proposalContent as unknown as JsonValue,
    },
    {
      name: "factual_leaves",
      kind: "SEMANTIC_SET",
      value: leaves.map((leaf) => ({
        audience_field: leaf.audience_field,
        fact_path: leaf.fact_path,
        fact_value_hash: leaf.fact_value_hash,
        classification: leaf.classification,
      })),
    },
    {
      name: "fact_basis_links",
      kind: "SEMANTIC_SET",
      value: links.map((link) => {
        const common = {
          audience_field: link.audience_field,
          fact_path: link.fact_path,
          fact_value_hash: link.fact_value_hash,
          ordinal: link.ordinal,
        };
        return link.basis_kind === "TASK_AUDIENCE_CONTEXT"
          ? {
              ...common,
              basis_kind: link.basis_kind,
              task_id: link.task_id,
              task_revision_id: link.task_revision_id,
              task_audience_context_path: link.task_audience_context_path,
              task_audience_context_value_hash: link.task_audience_context_value_hash,
            }
          : {
              ...common,
              basis_kind: link.basis_kind,
              proposition_id: link.proposition_id,
              epistemic_state_id: link.epistemic_state_id,
            };
      }),
    },
    {
      name: "semantic_admission_evidence",
      kind: "SEMANTIC_SET",
      value: (effectiveEvidence ?? []).map((ev) => {
        if (ev.basis_kind === "AUDIENCE_EPISTEMIC_STATE") {
          return {
            basis_kind: ev.basis_kind,
            audience_field: ev.audience_field,
            fact_path: ev.fact_path,
            fact_value_hash: ev.fact_value_hash,
            ordinal: ev.ordinal,
            proposition_id: ev.proposition_id,
            epistemic_state_id: ev.epistemic_state_id,
            selected_projection_rule_id: ev.selected_projection_rule_id,
            projection_inputs: ev.projection_inputs,
            projection_input_hash: ev.projection_input_hash,
            projected_identity: {
              propositionType: ev.projected_identity.propositionType,
              canonicalMeaning: ev.projected_identity.canonicalMeaning,
              subject: ev.projected_identity.subject,
              predicate: ev.projected_identity.predicate,
              object: ev.projected_identity.object,
              qualifiers: ev.projected_identity.qualifiers,
              conditions: ev.projected_identity.conditions,
              populationScope: ev.projected_identity.populationScope,
              jurisdictionScope: ev.projected_identity.jurisdictionScope,
            },
            semantic_equivalence_outcome: ev.semantic_equivalence_outcome,
            compared_proposition_id: ev.compared_proposition_id,
          };
        }
        return {
          basis_kind: ev.basis_kind,
          audience_field: ev.audience_field,
          fact_path: ev.fact_path,
          fact_value_hash: ev.fact_value_hash,
          ordinal: ev.ordinal,
          task_id: ev.task_id,
          task_revision_id: ev.task_revision_id,
          task_audience_context_path: ev.task_audience_context_path,
          task_audience_context_value_hash: ev.task_audience_context_value_hash,
        };
      }),
    },
  ];

  return hashCanonicalInput({
    serialization_version: CONTENT_CANONICAL_SERIALIZATION_VERSION,
    fields,
  });
}

export function validateAudienceAdmission(
  input: AudienceAdmissionInput,
  expected: AudienceAdmissionExpectation,
): ValidatedAudienceAdmission {
  validateAudienceState(input.audience, {
    expected_task_revision_id: expected.task_revision_id,
    expected_stage: 'FINAL_FOR_DECISION',
  });
  const binding = validateAudienceAdmissionAuthority(input, expected);
  const leaves = collectAudienceFactLeaves(input.audience, input.schema.classification_rules);
  const { links, evidence } = materializeAudienceFactBasisAdmissions(input, leaves);
  validateFactCoverage(input, links);
  const audience_admission_hash = computeAudienceAdmissionHash(input, binding, leaves, links, evidence);
  return {
    manifest: input.manifest,
    schema_role_binding: binding,
    schema_ref: input.schema.schema_ref,
    schema_payload_hash: input.schema.payload_hash,
    fact_basis_links: links,
    admission_evidence: evidence,
    audience_admission_hash,
  };
}

export function validateAudienceAdmissionAuthority(
  input: Pick<AudienceAdmissionInput, 'manifest' | 'schema_role_bindings' | 'schema'>,
  expected: AudienceAdmissionExpectation,
): AudienceSchemaRoleBinding {
  validateAudienceSemanticProjectionSchema(input.schema);
  validateManifest(input, expected);
  return validateRoleBinding(input, expected);
}
