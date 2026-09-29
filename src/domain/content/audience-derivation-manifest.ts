import {
  CONTENT_CANONICAL_SERIALIZATION_VERSION,
  hashCanonicalInput,
  type CanonicalField,
} from "./canonical-input-serialization.js";
import type { AudienceDerivationManifest } from "./audience-admission-types.js";

/**
 * Hashes trusted manifest material only. The enclosing stage hash and this
 * derived hash are excluded to avoid circular identity.
 */
export function hashAudienceDerivationManifest(
  manifest: AudienceDerivationManifest | Omit<AudienceDerivationManifest, "derivation_manifest_hash">,
): string {
  const fields: CanonicalField[] = [
    { name: "tenant_id", kind: "VALUE", value: manifest.tenant_id },
    { name: "workspace_id", kind: "VALUE", value: manifest.workspace_id },
    { name: "run_config_id", kind: "VALUE", value: manifest.run_config_id },
    { name: "task_id", kind: "VALUE", value: manifest.task_id },
    { name: "task_revision_id", kind: "VALUE", value: manifest.task_revision_id },
    {
      name: "audience_knowledge_cutoff_time",
      kind: "TIMESTAMP",
      value: manifest.audience_knowledge_cutoff_time,
    },
    {
      name: "audience_schema_ref",
      kind: "VALUE",
      value: {
        entity_type: manifest.audience_schema_ref.entity_type,
        stable_id: manifest.audience_schema_ref.stable_id,
        revision_id: manifest.audience_schema_ref.revision_id,
      },
    },
    {
      name: "audience_schema_payload_hash",
      kind: "VALUE",
      value: manifest.audience_schema_payload_hash,
    },
    {
      name: "eligible_task_audience_context",
      kind: "SEMANTIC_SET",
      value: (manifest.eligible_task_audience_context ?? []).map((item) => ({
        path: item.path,
        value_hash: item.value_hash,
      })),
    },
    {
      name: "eligible_epistemic_refs",
      kind: "SEMANTIC_SET",
      value: (manifest.eligible_epistemic_refs ?? []).map((item) => ({
        proposition_id: item.proposition_id,
        epistemic_state_id: item.epistemic_state_id,
      })),
    },
  ];

  if (manifest.audience_schema_role_binding) {
    fields.push({
      name: "audience_schema_role_binding",
      kind: "VALUE",
      value: { ...manifest.audience_schema_role_binding },
    });
  }

  if (manifest.audience_valid_time) {
    fields.push({
      name: "audience_valid_time",
      kind: "TIMESTAMP",
      value: manifest.audience_valid_time,
    });
  }

  if (manifest.fact_admissions && manifest.fact_admissions.length > 0) {
    fields.push({
      name: "fact_admissions",
      kind: "SEMANTIC_SET",
      value: manifest.fact_admissions.map((fact) => ({ ...fact })) as never,
    });
  }

  return hashCanonicalInput({
    serialization_version: CONTENT_CANONICAL_SERIALIZATION_VERSION,
    fields,
  });
}
