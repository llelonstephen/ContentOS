import {
  CONTENT_CANONICAL_SERIALIZATION_VERSION,
  hashCanonicalInput,
  serializeCanonicalInput,
  type CanonicalField,
  type CanonicalInputManifest,
} from "./canonical-input-serialization.js";
import type {
  AudienceManifestEpistemicRef,
  AudienceManifestTaskContextValue,
  AudienceSchemaRoleBinding,
} from "./audience-admission-types.js";
import type { ExactRevisionRef, JsonValue } from "./types.js";

/**
 * Pre-provider derivation manifest core representing the deterministic
 * canonical input state supplied to an audience generation attempt.
 *
 * StageExecution.canonical_input_hash = hash(PRE_PROVIDER_MANIFEST_CORE)
 *
 * In accordance with SPEC05 v1.0.5 §112–§113:
 * - canonical_input_hash is pre-provider only.
 * - PRE_PROVIDER_MANIFEST_CORE is reconstructable, not a canonical entity.
 * - The hash field itself is excluded from its own hash input.
 * - Generated-leaf-specific post-provider admission identity belongs to audience_admission_hash.
 * - All provider-visible material inputs (RunConfig pins, schema membership, runtime parameters, provider context) are fully bound.
 */
export interface PreProviderManifestGenerationConfig {
  readonly prompt_revision_id: string;
  readonly model_revision_id: string;
  readonly schema_revision_id: string;
  readonly tool_revision_ids: readonly string[];
}

export interface PreProviderManifestCore {
  readonly tenant_id: string;
  readonly workspace_id?: string | null;
  readonly run_config_id: string;
  readonly generation_config?: PreProviderManifestGenerationConfig;
  readonly run_config_runtime_parameters_hash?: string;
  readonly prompt_revision_refs?: readonly string[];
  readonly model_config_revision_refs?: readonly string[];
  readonly tool_config_revision_refs?: readonly string[];
  readonly schema_revision_refs?: readonly ExactRevisionRef[];
  readonly retriever_revision_refs?: readonly string[];
  readonly evaluator_revision_refs?: readonly string[];
  readonly task_id: string;
  readonly task_revision_id: string;
  readonly audience_knowledge_cutoff_time: string;
  readonly audience_schema_ref: ExactRevisionRef;
  readonly audience_schema_payload_hash: string;
  readonly audience_schema_role_binding?: AudienceSchemaRoleBinding;
  readonly eligible_task_audience_context: readonly AudienceManifestTaskContextValue[];
  readonly eligible_epistemic_refs: readonly AudienceManifestEpistemicRef[];
  readonly knowledge_gap_refs?: readonly string[];
  readonly research_trace_refs?: readonly string[];
  readonly provider_context_hash?: string;
}

export function hashProviderContext(context: JsonValue): string {
  return hashCanonicalInput({
    serialization_version: CONTENT_CANONICAL_SERIALIZATION_VERSION,
    fields: [
      {
        name: "provider_context",
        kind: "VALUE",
        value: context ?? {},
      },
    ],
  });
}

export function buildPreProviderManifestCanonicalManifest(
  core: PreProviderManifestCore,
): CanonicalInputManifest {
  const fields: CanonicalField[] = [
    { name: "tenant_id", kind: "VALUE", value: core.tenant_id },
    { name: "workspace_id", kind: "VALUE", value: core.workspace_id ?? null },
    { name: "run_config_id", kind: "VALUE", value: core.run_config_id },
  ];

  if (core.generation_config) {
    fields.push({
      name: "generation_config",
      kind: "VALUE",
      value: {
        prompt_revision_id: core.generation_config.prompt_revision_id,
        model_revision_id: core.generation_config.model_revision_id,
        tool_revision_ids: [...core.generation_config.tool_revision_ids],
        schema_revision_id: core.generation_config.schema_revision_id,
      },
    });
  }

  if (core.run_config_runtime_parameters_hash) {
    fields.push({
      name: "run_config_runtime_parameters_hash",
      kind: "VALUE",
      value: core.run_config_runtime_parameters_hash,
    });
  }

  if (core.prompt_revision_refs !== undefined) {
    fields.push({
      name: "prompt_revision_refs",
      kind: "SEMANTIC_SET",
      value: [...core.prompt_revision_refs],
    });
  }

  if (core.model_config_revision_refs !== undefined) {
    fields.push({
      name: "model_config_revision_refs",
      kind: "SEMANTIC_SET",
      value: [...core.model_config_revision_refs],
    });
  }

  if (core.tool_config_revision_refs !== undefined) {
    fields.push({
      name: "tool_config_revision_refs",
      kind: "SEMANTIC_SET",
      value: [...core.tool_config_revision_refs],
    });
  }

  if (core.schema_revision_refs !== undefined) {
    fields.push({
      name: "schema_revision_refs",
      kind: "SEMANTIC_SET",
      value: core.schema_revision_refs.map((r) => ({
        entity_type: r.entity_type,
        stable_id: r.stable_id,
        revision_id: r.revision_id,
      })),
    });
  }

  if (core.retriever_revision_refs !== undefined) {
    fields.push({
      name: "retriever_revision_refs",
      kind: "SEMANTIC_SET",
      value: [...core.retriever_revision_refs],
    });
  }

  if (core.evaluator_revision_refs !== undefined) {
    fields.push({
      name: "evaluator_revision_refs",
      kind: "SEMANTIC_SET",
      value: [...core.evaluator_revision_refs],
    });
  }

  if (core.provider_context_hash) {
    fields.push({
      name: "provider_context_hash",
      kind: "VALUE",
      value: core.provider_context_hash,
    });
  }

  fields.push(
    { name: "task_id", kind: "VALUE", value: core.task_id },
    { name: "task_revision_id", kind: "VALUE", value: core.task_revision_id },
    {
      name: "audience_knowledge_cutoff_time",
      kind: "TIMESTAMP",
      value: core.audience_knowledge_cutoff_time,
    },
    {
      name: "audience_schema_ref",
      kind: "VALUE",
      value: {
        entity_type: core.audience_schema_ref.entity_type,
        stable_id: core.audience_schema_ref.stable_id,
        revision_id: core.audience_schema_ref.revision_id,
      },
    },
    {
      name: "audience_schema_payload_hash",
      kind: "VALUE",
      value: core.audience_schema_payload_hash,
    },
    {
      name: "eligible_task_audience_context",
      kind: "SEMANTIC_SET",
      value: (core.eligible_task_audience_context ?? []).map((item) => ({
        path: item.path,
        value_hash: item.value_hash,
      })),
    },
    {
      name: "eligible_epistemic_refs",
      kind: "SEMANTIC_SET",
      value: (core.eligible_epistemic_refs ?? []).map((item) => ({
        proposition_id: item.proposition_id,
        epistemic_state_id: item.epistemic_state_id,
      })),
    },
  );

  if (core.audience_schema_role_binding) {
    fields.push({
      name: "audience_schema_role_binding",
      kind: "VALUE",
      value: {
        run_config_id: core.audience_schema_role_binding.run_config_id,
        role: core.audience_schema_role_binding.role,
        schema_entity_type: core.audience_schema_role_binding.schema_entity_type,
        schema_stable_id: core.audience_schema_role_binding.schema_stable_id,
        schema_revision_id: core.audience_schema_role_binding.schema_revision_id,
        schema_object_id: core.audience_schema_role_binding.schema_object_id,
        schema_object_key: core.audience_schema_role_binding.schema_object_key,
        schema_payload_hash: core.audience_schema_role_binding.schema_payload_hash,
        schema_payload_schema_revision_id:
          core.audience_schema_role_binding.schema_payload_schema_revision_id,
      },
    });
  }

  if (core.knowledge_gap_refs && core.knowledge_gap_refs.length > 0) {
    fields.push({
      name: "knowledge_gap_refs",
      kind: "SEMANTIC_SET",
      value: [...core.knowledge_gap_refs],
    });
  }

  if (core.research_trace_refs && core.research_trace_refs.length > 0) {
    fields.push({
      name: "research_trace_refs",
      kind: "SEMANTIC_SET",
      value: [...core.research_trace_refs],
    });
  }

  return {
    serialization_version: CONTENT_CANONICAL_SERIALIZATION_VERSION,
    fields,
  };
}

export function serializePreProviderManifestCore(core: PreProviderManifestCore): string {
  return serializeCanonicalInput(buildPreProviderManifestCanonicalManifest(core));
}

export function hashPreProviderManifestCore(core: PreProviderManifestCore): string {
  return hashCanonicalInput(buildPreProviderManifestCanonicalManifest(core));
}
