import type { ObjectStore } from "../../objects/object-store-interface.js";
import { getDefaultObjectStore } from "../../objects/default-object-store.js";
import { failContent } from "../../../domain/content/content-error-codes.js";
import {
  hashPreProviderManifestCore,
  hashProviderContext,
  type PreProviderManifestCore,
} from "../../../domain/content/pre-provider-manifest-core.js";
import {
  CONTENT_CANONICAL_SERIALIZATION_VERSION,
  hashCanonicalInput,
} from "../../../domain/content/canonical-input-serialization.js";
import {
  hashAudienceScalar,
  type JsonPrimitive,
  type JsonValue,
} from "../../../domain/content/index.js";
import type {
  AudienceEpistemicStateInput,
  AudienceManifestEpistemicRef,
  AudienceManifestTaskContextValue,
  AudiencePropositionInput,
  AudienceSchemaRoleBinding,
  AudienceSemanticProjectionSchema,
} from "../../../domain/content/audience-admission-types.js";
import {
  loadAudienceSchemaPayload,
  resolveAudienceSchemaBindingAuthority,
} from "./audience-derivation-authority-resolver.js";
import {
  resolveCanonicalM4RunConfig,
  type CanonicalM4RunConfig,
} from "./content-runtime-run-config-resolver.js";

export function extractEligibleTaskAudienceContext(
  context: JsonValue,
  basePath: string = "",
): AudienceManifestTaskContextValue[] {
  const result: AudienceManifestTaskContextValue[] = [];
  if (context === null || context === undefined) return result;
  if (Array.isArray(context)) {
    context.forEach((item, idx) => {
      result.push(...extractEligibleTaskAudienceContext(item, `${basePath}/${idx}`));
    });
  } else if (typeof context === "object") {
    const keys = Object.keys(context).sort();
    for (const key of keys) {
      const val = (context as Record<string, JsonValue>)[key];
      const childPath = `${basePath}/${key}`;
      if (val !== null && typeof val === "object") {
        result.push(...extractEligibleTaskAudienceContext(val, childPath));
      } else {
        result.push({
          path: childPath,
          value_hash: hashAudienceScalar(val as JsonPrimitive),
        });
      }
    }
  }
  return result;
}

export interface TrustedPreProviderResolverScope {
  readonly tenant_id: string;
  readonly workspace_id?: string | null;
  readonly run_id: string;
  readonly decision_cycle_id: string;
  readonly run_config_id: string;
  readonly task_revision_id: string;
  readonly provider_context_hash?: string;
  readonly provider_context?: JsonValue;
}

export interface TrustedPreProviderInputs {
  readonly trustedCutoff: string;
  readonly task: {
    readonly task_id: string;
    readonly task_revision_id: string;
    readonly market: string;
    readonly jurisdiction: string;
    readonly brand_id?: string | null;
    readonly product_id?: string | null;
    readonly audience_context: JsonValue;
  };
  readonly runConfig: CanonicalM4RunConfig;
  readonly schemaBinding: AudienceSchemaRoleBinding;
  readonly schemaPayload: AudienceSemanticProjectionSchema;
  readonly eligibleTaskAudienceContext: readonly AudienceManifestTaskContextValue[];
  readonly eligibleEpistemicRefs: readonly AudienceManifestEpistemicRef[];
  readonly propositions: readonly AudiencePropositionInput[];
  readonly epistemicStates: readonly AudienceEpistemicStateInput[];
  readonly knowledgeGapRefs: readonly string[];
  readonly researchTraceRefs: readonly string[];
  readonly preProviderCore: PreProviderManifestCore;
  readonly canonicalInputHash: string;
}

export class TrustedPreProviderResolver {
  constructor(
    private readonly sql?: any,
    private readonly objectStore: ObjectStore = getDefaultObjectStore(),
  ) {}

  async resolveCanonicalInputs(
    scope: TrustedPreProviderResolverScope,
    sqlTx?: any,
  ): Promise<TrustedPreProviderInputs> {
    const execute = async (tx: any): Promise<TrustedPreProviderInputs> => {
      const [clock] = await tx`SELECT transaction_timestamp() AS cutoff`;
      const trustedCutoff = new Date(clock.cutoff).toISOString();

      const [taskRow] = await tx`
        SELECT task_id, task_revision_id, market, jurisdiction, brand_id, product_id,
               audience_context, tenant_id, workspace_id
        FROM task_contract_revisions
        WHERE task_revision_id = ${scope.task_revision_id}
          AND tenant_id = ${scope.tenant_id}
          AND workspace_id IS NOT DISTINCT FROM ${scope.workspace_id || null}
      `;
      if (!taskRow) {
        failContent(
          "AUDIENCE_PROVENANCE_INVALID",
          `TaskContractRevision '${scope.task_revision_id}' not found in scope`,
        );
      }
      const audienceContext =
        (() => {
        if (typeof taskRow.audience_context === "string") {
          try { return JSON.parse(taskRow.audience_context); }
          catch { return taskRow.audience_context; }
        }
        return taskRow.audience_context ?? {};
      })();
      const eligibleTaskAudienceContext = extractEligibleTaskAudienceContext(audienceContext);

      const runConfig = await resolveCanonicalM4RunConfig(tx, {
        tenant_id: scope.tenant_id,
        workspace_id: (scope.workspace_id || null) as any,
        run_id: scope.run_id,
        decision_cycle_id: scope.decision_cycle_id,
        run_config_id: scope.run_config_id,
      });

      const schemaBinding = await resolveAudienceSchemaBindingAuthority(tx, {
        tenant_id: scope.tenant_id,
        workspace_id: (scope.workspace_id || null) as any,
        run_config_id: scope.run_config_id,
      });

      const { payload: schemaPayload } = await loadAudienceSchemaPayload(
        schemaBinding,
        this.objectStore,
      );

      // Verify RunConfig runtime parameters canonical hash
      const [configRow] = await tx`
        SELECT runtime_parameters FROM run_configs
        WHERE run_config_id = ${scope.run_config_id}
          AND tenant_id = ${scope.tenant_id}
          AND workspace_id IS NOT DISTINCT FROM ${scope.workspace_id || null}
      `;
      const runtimeParamsCanonical = typeof configRow?.runtime_parameters === "string"
        ? JSON.parse(configRow.runtime_parameters)
        : (configRow?.runtime_parameters ?? {});
      const runtimeParamsHash = hashCanonicalInput({
        serialization_version: CONTENT_CANONICAL_SERIALIZATION_VERSION,
        fields: [{ name: "runtime_parameters", kind: "VALUE", value: runtimeParamsCanonical }],
      });

      // Verify exact schema membership
      const schemaRefRows = await tx`
        SELECT revision_id FROM run_config_schema_revisions
        WHERE run_config_id = ${scope.run_config_id}
        ORDER BY revision_id ASC
      `;
      const schemaRevisionRefs = schemaRefRows.map((r: any) => String(r.revision_id));
      if (schemaRevisionRefs.length > 0 && !schemaRevisionRefs.includes(schemaBinding.schema_revision_id)) {
        failContent(
          "AUDIENCE_PROVENANCE_INVALID",
          `Audience schema role binding revision '${schemaBinding.schema_revision_id}' is not a member of RunConfig.schema_revision_refs`,
        );
      }
      if (runConfig.schema_revision_id !== schemaBinding.schema_revision_id) {
        failContent(
          "AUDIENCE_PROVENANCE_INVALID",
          `RunConfig schema pin '${runConfig.schema_revision_id}' does not match Audience schema role binding '${schemaBinding.schema_revision_id}'`,
        );
      }

      const providerContextHash =
        scope.provider_context_hash ??
        (scope.provider_context !== undefined
          ? hashProviderContext(scope.provider_context)
          : undefined);

      const propRows = await tx`
        SELECT proposition.proposition_id, proposition.canonical_meaning, proposition.subject,
               proposition.predicate, proposition.object, proposition.qualifiers,
               proposition.conditions, proposition.population_scope, proposition.jurisdiction_scope,
               proposition.tenant_id, proposition.workspace_id,
               state.epistemic_state_id, state.support_status, state.known_from,
               state.valid_from, state.valid_until_if_known
        FROM propositions proposition
        JOIN epistemic_state_versions state ON state.proposition_id = proposition.proposition_id
        WHERE proposition.tenant_id = ${scope.tenant_id}
          AND proposition.workspace_id IS NOT DISTINCT FROM ${scope.workspace_id || null}
          AND proposition.proposition_type = 'AUDIENCE'
          AND state.tenant_id = ${scope.tenant_id}
          AND state.workspace_id IS NOT DISTINCT FROM ${scope.workspace_id || null}
          AND state.support_status = 'SUPPORTED'
          AND state.known_from <= ${trustedCutoff}
          AND state.valid_from <= ${trustedCutoff}
          AND (state.valid_until_if_known IS NULL OR state.valid_until_if_known > ${trustedCutoff})
        ORDER BY proposition.proposition_id ASC, state.known_from DESC, state.created_at DESC
      `;

      const propositions: AudiencePropositionInput[] = [];
      const epistemicStates: AudienceEpistemicStateInput[] = [];
      const eligibleEpistemicRefs: AudienceManifestEpistemicRef[] = [];
      const seenProps = new Set<string>();

      for (const row of propRows) {
        if (seenProps.has(row.proposition_id)) continue;
        seenProps.add(row.proposition_id);

        propositions.push({
          scope_authorized: true,
          proposition_id: String(row.proposition_id),
          proposition_type: "AUDIENCE",
          tenant_id: String(row.tenant_id),
          workspace_id: String(row.workspace_id ?? ""),
          semantic_identity: {
            propositionType: "AUDIENCE",
            canonicalMeaning: String(row.canonical_meaning),
            subject: String(row.subject),
            predicate: String(row.predicate),
            object: String(row.object),
            qualifiers: String(row.qualifiers),
            conditions: String(row.conditions),
            populationScope: String(row.population_scope),
            jurisdictionScope: String(row.jurisdiction_scope),
          },
        });

        epistemicStates.push({
          scope_authorized: true,
          valid_at_cutoff: true,
          epistemic_state_id: String(row.epistemic_state_id),
          proposition_id: String(row.proposition_id),
          support_status: String(row.support_status),
          known_from: new Date(row.known_from).toISOString(),
          valid_from: new Date(row.valid_from).toISOString(),
          valid_until: row.valid_until_if_known
            ? new Date(row.valid_until_if_known).toISOString()
            : null,
          tenant_id: String(row.tenant_id),
          workspace_id: String(row.workspace_id ?? ""),
        });

        eligibleEpistemicRefs.push({
          proposition_id: String(row.proposition_id),
          epistemic_state_id: String(row.epistemic_state_id),
        });
      }

      const gapRows = await tx`
        SELECT gap_id FROM knowledge_gaps
        WHERE task_revision_id = ${scope.task_revision_id}
          AND tenant_id = ${scope.tenant_id}
          AND workspace_id IS NOT DISTINCT FROM ${scope.workspace_id || null}
          AND created_at <= ${trustedCutoff}
        ORDER BY gap_id ASC
      `;
      const knowledgeGapRefs = gapRows.map((r: any) => String(r.gap_id));

      const traceRows = await tx`
        SELECT trace.research_trace_id
        FROM research_traces trace
        JOIN knowledge_gaps gap ON gap.gap_id = trace.gap_id
        WHERE gap.task_revision_id = ${scope.task_revision_id}
          AND trace.tenant_id = ${scope.tenant_id}
          AND trace.workspace_id IS NOT DISTINCT FROM ${scope.workspace_id || null}
          AND trace.completed_at <= ${trustedCutoff}
        ORDER BY trace.research_trace_id ASC
      `;
      const researchTraceRefs = traceRows.map((r: any) => String(r.research_trace_id));

      const preProviderCore: PreProviderManifestCore = {
        tenant_id: scope.tenant_id,
        workspace_id: scope.workspace_id ?? null,
        run_config_id: scope.run_config_id,
        generation_config: runConfig,
        run_config_runtime_parameters_hash: runtimeParamsHash,
        schema_revision_refs: schemaRevisionRefs,
        provider_context_hash: providerContextHash,
        task_id: String(taskRow.task_id),
        task_revision_id: String(taskRow.task_revision_id),
        audience_knowledge_cutoff_time: trustedCutoff,
        audience_schema_ref: {
          entity_type: schemaBinding.schema_entity_type,
          stable_id: schemaBinding.schema_stable_id,
          revision_id: schemaBinding.schema_revision_id,
        },
        audience_schema_payload_hash: schemaBinding.schema_payload_hash,
        audience_schema_role_binding: schemaBinding,
        eligible_task_audience_context: eligibleTaskAudienceContext,
        eligible_epistemic_refs: eligibleEpistemicRefs,
        ...(knowledgeGapRefs.length > 0 ? { knowledge_gap_refs: knowledgeGapRefs } : {}),
        ...(researchTraceRefs.length > 0 ? { research_trace_refs: researchTraceRefs } : {}),
      };
      const canonicalInputHash = hashPreProviderManifestCore(preProviderCore);

      return {
        trustedCutoff,
        task: {
          task_id: String(taskRow.task_id),
          task_revision_id: String(taskRow.task_revision_id),
          market: String(taskRow.market),
          jurisdiction: String(taskRow.jurisdiction),
          brand_id: String(taskRow.brand_id),
          product_id: String(taskRow.product_id),
          audience_context: audienceContext,
        },
        runConfig,
        schemaBinding,
        schemaPayload,
        eligibleTaskAudienceContext,
        eligibleEpistemicRefs,
        propositions,
        epistemicStates,
        knowledgeGapRefs,
        researchTraceRefs,
        preProviderCore,
        canonicalInputHash,
      };
    };

    if (sqlTx) {
      return execute(sqlTx);
    }
    if (!this.sql) {
      throw new Error("TrustedPreProviderResolver requires a SQL database client");
    }
    if (typeof this.sql.begin === "function") {
      return this.sql.begin("isolation level repeatable read", execute);
    }
    return execute(this.sql);
  }
}
