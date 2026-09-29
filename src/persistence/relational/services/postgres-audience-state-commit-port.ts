import {
  CONTENT_CANONICAL_SERIALIZATION_VERSION,
  hashCanonicalInput,
} from "../../../domain/content/canonical-input-serialization.js";
import { resolveCanonicalM4RunConfig } from "./content-runtime-run-config-resolver.js";
import { randomUUID } from "node:crypto";
import type { AudienceStateView } from "../../../domain/content/index.js";
import type {
  AudienceStateAtomicCommitPort,
  AudienceStateCommitRequest,
} from "./audience-state-persistence-service.js";
import { requireAudienceDerivationAuthority } from "./audience-state-persistence-service.js";
import { toStageFencingContext } from "./content-runtime-authority.js";
import { executeContentRuntimeCommit } from "./content-runtime-transaction-context.js";
import {
  loadAudienceSchemaPayload,
  resolveAudienceSchemaBindingAuthority,
} from "./audience-derivation-authority-resolver.js";
import { extractEligibleTaskAudienceContext } from "./trusted-pre-provider-resolver.js";
import {
  hashPreProviderManifestCore,
  type PreProviderManifestCore,
} from "../../../domain/content/pre-provider-manifest-core.js";
import {
  validateAudienceAdmission,
  type AudienceAdmissionInput,
  type AudiencePropositionInput,
  type AudienceEpistemicStateInput,
  type AudienceDerivationManifest,
} from "../../../domain/content/index.js";
import { getDefaultObjectStore } from "../../objects/default-object-store.js";
import type { ObjectStore } from "../../objects/object-store-interface.js";
import { RegistryValidationError } from "../../../domain/services/registry-validator.js";

const encode = (value: unknown): string => JSON.stringify(value);
const decode = <T>(value: string): T => JSON.parse(value) as T;

function toAudience(row: any): AudienceStateView {
  return {
    ...row,
    context: decode(row.context),
    knowledge_state: decode(row.knowledge_state),
    problem_state: decode(row.problem_state),
    solution_state: decode(row.solution_state),
    product_state: decode(row.product_state),
    brand_state: decode(row.brand_state),
    intent_state: decode(row.intent_state),
    desired_outcome: decode(row.desired_outcome),
    objections: decode(row.objections),
    decision_criteria: decode(row.decision_criteria),
    prior_exposure: decode(row.prior_exposure),
    origin: decode(row.origin),
    uncertainty: decode(row.uncertainty),
  };
}

export class PostgresAudienceStateCommitPort implements AudienceStateAtomicCommitPort {
  constructor(
    private readonly sql: any,
    private readonly objectStore: ObjectStore = getDefaultObjectStore(),
  ) {}

  async commitAudienceState(request: AudienceStateCommitRequest): Promise<AudienceStateView> {
    const { authority, state } = request;
    if (state.state_stage === "FINAL_FOR_DECISION" && !request.derivation_authority) {
      throw new RegistryValidationError(
        "AUDIENCE_DERIVATION_AUTHORITY_REQUIRED",
        "FINAL_FOR_DECISION audience state commit requires derivation_authority.",
      );
    }
    const { derivationAuthority, factBasisLinks } = requireAudienceDerivationAuthority(request);
    const binding = derivationAuthority.schema_binding;

    const result = await executeContentRuntimeCommit(
      this.sql,
      {
        tenantId: authority.tenant_id,
        workspaceId: authority.workspace_id,
        runConfigId: authority.run_config_id,
        generationAuthority: { kind: "PROVIDER", generationConfig: request.generation_config },
        fencingContext: toStageFencingContext(authority),
        registryEntries: [
          {
            entityType: "AudienceState",
            entityId: state.audience_state_id,
            tenantId: authority.tenant_id,
            workspaceId: authority.workspace_id,
          },
        ],
        auditEvent: {
          auditEventId: randomUUID(),
          tenantId: authority.tenant_id,
          workspaceId: authority.workspace_id,
          eventType: "M4_AUDIENCE_STATE_COMMITTED",
          principalRef: authority.lease_owner,
          resourceRef: state.audience_state_id,
          runId: authority.run_id,
          reasonCodes: [
            state.state_stage,
            binding.role,
            `FACT_BASIS_COUNT:${factBasisLinks.length}`,
            ...(request.audience_admission_hash
              ? [`AUDIENCE_ADMISSION_HASH:${request.audience_admission_hash}`]
              : []),
          ],
        },
        outboxEvents: [
          {
            aggregateType: "AudienceState",
            aggregateId: state.audience_state_id,
            eventType: "AudienceStateCommitted",
            payload: {
              audienceStateId: state.audience_state_id,
              stage: state.state_stage,
              runConfigId: authority.run_config_id,
              audienceKnowledgeCutoffTime: derivationAuthority.audience_knowledge_cutoff_time,
              derivationManifestHash: derivationAuthority.derivation_manifest_hash,
              canonicalInputHash: authority.canonical_input_hash,
              audienceAdmissionHash:
                request.audience_admission_hash ??
                derivationAuthority.audience_admission_hash ??
                null,
              schemaRole: binding.role,
              schemaRevisionId: binding.schema_revision_id,
              factBasisCount: factBasisLinks.length,
            },
          },
        ],
      },
      async (sqlTx) => {
        // Step 2 & 3: Re-resolve exact RunConfig, Audience role binding, and Schema payload
        const currentBinding = await resolveAudienceSchemaBindingAuthority(sqlTx, {
          tenant_id: authority.tenant_id,
          workspace_id: authority.workspace_id,
          run_config_id: authority.run_config_id,
        });
        if (JSON.stringify(currentBinding) !== JSON.stringify(binding)) {
          throw new RegistryValidationError(
            "AUDIENCE_DERIVATION_AUTHORITY_STALE",
            "Audience schema role binding or immutable payload authority changed before commit.",
          );
        }
        const { payload: schemaPayload } = await loadAudienceSchemaPayload(
          currentBinding,
          this.objectStore,
        );

        const currentRunConfig = await resolveCanonicalM4RunConfig(sqlTx, {
          tenant_id: authority.tenant_id,
          workspace_id: (authority.workspace_id || null) as any,
          run_id: authority.run_id,
          decision_cycle_id: authority.decision_cycle_id,
          run_config_id: authority.run_config_id,
        });
        if (currentRunConfig.schema_revision_id !== currentBinding.schema_revision_id) {
          throw new RegistryValidationError(
            "AUDIENCE_DERIVATION_AUTHORITY_STALE",
            `RunConfig schema pin '${currentRunConfig.schema_revision_id}' does not match Audience schema role binding '${currentBinding.schema_revision_id}'.`,
          );
        }

        const [configRow] = await sqlTx`
          SELECT runtime_parameters FROM run_configs
          WHERE run_config_id = ${authority.run_config_id}
            AND tenant_id = ${authority.tenant_id}
            AND workspace_id IS NOT DISTINCT FROM ${authority.workspace_id || null}
        `;
        const runtimeParamsCanonical = typeof configRow?.runtime_parameters === "string"
          ? JSON.parse(configRow.runtime_parameters)
          : (configRow?.runtime_parameters ?? {});
        const runtimeParamsHash = hashCanonicalInput({
          serialization_version: CONTENT_CANONICAL_SERIALIZATION_VERSION,
          fields: [{ name: "runtime_parameters", kind: "VALUE", value: runtimeParamsCanonical }],
        });

        const promptRevisionRefs = currentRunConfig.prompt_revision_refs ?? [];
        const modelConfigRevisionRefs = currentRunConfig.model_config_revision_refs ?? [];
        const toolConfigRevisionRefs = currentRunConfig.tool_config_revision_refs ?? [];
        const schemaRevisionRefs = currentRunConfig.schema_revision_refs ?? [];
        const retrieverRevisionRefs = currentRunConfig.retriever_revision_refs ?? [];
        const evaluatorRevisionRefs = currentRunConfig.evaluator_revision_refs ?? [];

        const isRoleMember = schemaRevisionRefs.some(
          (ref) =>
            ref.entity_type === currentBinding.schema_entity_type &&
            ref.stable_id === currentBinding.schema_stable_id &&
            ref.revision_id === currentBinding.schema_revision_id,
        );
        if (!isRoleMember) {
          throw new RegistryValidationError(
            "AUDIENCE_DERIVATION_AUTHORITY_STALE",
            `Audience schema role binding (${currentBinding.schema_entity_type}, ${currentBinding.schema_stable_id}, ${currentBinding.schema_revision_id}) is not an exact member of RunConfig.schema_revision_refs`,
          );
        }

        // Step 4: Recover exact cutoff and Task basis
        const cutoff = derivationAuthority.audience_knowledge_cutoff_time;
        const [taskRow] = await sqlTx`
          SELECT task_id, task_revision_id, market, jurisdiction, brand_id, product_id,
                 audience_context, tenant_id, workspace_id
          FROM task_contract_revisions
          WHERE task_revision_id = ${state.task_revision_id}
            AND tenant_id = ${authority.tenant_id}
            AND workspace_id IS NOT DISTINCT FROM ${authority.workspace_id || null}
        `;
        if (!taskRow) {
          throw new RegistryValidationError(
            "TASK_REVISION_NOT_FOUND",
            `Task revision '${state.task_revision_id}' does not exist in scope at commit time`,
          );
        }
        const taskAudienceContext =
          (() => {
        if (typeof taskRow.audience_context === "string") {
          try { return JSON.parse(taskRow.audience_context); }
          catch { return taskRow.audience_context; }
        }
        return taskRow.audience_context ?? {};
      })();
        const eligibleTaskAudienceContext = extractEligibleTaskAudienceContext(taskAudienceContext);

        // Recover eligible epistemic refs valid at cutoff
        const propRows = await sqlTx`
          SELECT proposition.proposition_id, proposition.canonical_meaning, proposition.subject,
                 proposition.predicate, proposition.object, proposition.qualifiers,
                 proposition.conditions, proposition.population_scope, proposition.jurisdiction_scope,
                 proposition.tenant_id, proposition.workspace_id,
                 state.epistemic_state_id, state.support_status, state.known_from,
                 state.valid_from, state.valid_until_if_known
          FROM propositions proposition
          JOIN epistemic_state_versions state ON state.proposition_id = proposition.proposition_id
          WHERE proposition.tenant_id = ${authority.tenant_id}
            AND proposition.workspace_id IS NOT DISTINCT FROM ${authority.workspace_id || null}
            AND proposition.proposition_type = 'AUDIENCE'
            AND state.tenant_id = ${authority.tenant_id}
            AND state.workspace_id IS NOT DISTINCT FROM ${authority.workspace_id || null}
            AND state.support_status = 'SUPPORTED'
            AND state.known_from <= ${cutoff}
            AND state.valid_from <= ${cutoff}
            AND (state.valid_until_if_known IS NULL OR state.valid_until_if_known > ${cutoff})
          ORDER BY proposition.proposition_id ASC, state.known_from DESC, state.created_at DESC
        `;
        const propositions: AudiencePropositionInput[] = [];
        const epistemicStates: AudienceEpistemicStateInput[] = [];
        const eligibleEpistemicRefs: { proposition_id: string; epistemic_state_id: string }[] = [];
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

        const gapRows = await sqlTx`
          SELECT gap_id FROM knowledge_gaps
          WHERE task_revision_id = ${state.task_revision_id}
            AND tenant_id = ${authority.tenant_id}
            AND workspace_id IS NOT DISTINCT FROM ${authority.workspace_id || null}
            AND created_at <= ${cutoff}
          ORDER BY gap_id ASC
        `;
        const knowledgeGapRefs = gapRows.map((r: any) => String(r.gap_id));

        const traceRows = await sqlTx`
          SELECT trace.research_trace_id
          FROM research_traces trace
          JOIN knowledge_gaps gap ON gap.gap_id = trace.gap_id
          WHERE gap.task_revision_id = ${state.task_revision_id}
            AND trace.tenant_id = ${authority.tenant_id}
            AND trace.workspace_id IS NOT DISTINCT FROM ${authority.workspace_id || null}
            AND trace.completed_at <= ${cutoff}
          ORDER BY trace.research_trace_id ASC
        `;
        const researchTraceRefs = traceRows.map((r: any) => String(r.research_trace_id));

        // Step 5: Reconstruct PRE_PROVIDER_MANIFEST_CORE
        const derivationManifestRaw = derivationAuthority?.derivation_manifest as Record<string, unknown> | undefined;
        const providerContextHash = (derivationManifestRaw?.provider_context_hash as string) ?? undefined;

        const reconstructedCore: PreProviderManifestCore = {
          tenant_id: authority.tenant_id,
          workspace_id: authority.workspace_id ?? null,
          run_config_id: authority.run_config_id,
          generation_config: currentRunConfig,
          run_config_runtime_parameters_hash: runtimeParamsHash,
          prompt_revision_refs: promptRevisionRefs,
          model_config_revision_refs: modelConfigRevisionRefs,
          tool_config_revision_refs: toolConfigRevisionRefs,
          schema_revision_refs: schemaRevisionRefs,
          retriever_revision_refs: retrieverRevisionRefs,
          evaluator_revision_refs: evaluatorRevisionRefs,
          provider_context_hash: providerContextHash,
          task_id: String(taskRow.task_id),
          task_revision_id: String(taskRow.task_revision_id),
          audience_knowledge_cutoff_time: cutoff,
          audience_schema_ref: {
            entity_type: currentBinding.schema_entity_type,
            stable_id: currentBinding.schema_stable_id,
            revision_id: currentBinding.schema_revision_id,
          },
          audience_schema_payload_hash: currentBinding.schema_payload_hash,
          audience_schema_role_binding: currentBinding,
          eligible_task_audience_context: eligibleTaskAudienceContext,
          eligible_epistemic_refs: eligibleEpistemicRefs,
          ...(knowledgeGapRefs.length > 0 ? { knowledge_gap_refs: knowledgeGapRefs } : {}),
          ...(researchTraceRefs.length > 0 ? { research_trace_refs: researchTraceRefs } : {}),
        };

        // Step 6 & 7: Recompute canonical_input_hash and require equality with StageExecution
        const recomputedCanonicalInputHash = hashPreProviderManifestCore(reconstructedCore);
        if (recomputedCanonicalInputHash !== authority.canonical_input_hash) {
          throw new RegistryValidationError(
            "CANONICAL_INPUT_HASH_MISMATCH",
            `Commit-time reconstructed canonical_input_hash '${recomputedCanonicalInputHash}' does not match StageExecution '${authority.canonical_input_hash}'.`,
          );
        }

        // Steps 8–19: For FINAL_FOR_DECISION, re-run full admission validation and compare audience_admission_hash
        if (state.state_stage === "FINAL_FOR_DECISION") {
          const expectedAdmissionHash =
            request.audience_admission_hash ?? derivationAuthority?.audience_admission_hash;
          if (
            !expectedAdmissionHash ||
            typeof expectedAdmissionHash !== "string" ||
            expectedAdmissionHash.trim().length === 0
          ) {
            throw new RegistryValidationError(
              "AUDIENCE_ADMISSION_HASH_REQUIRED",
              "Trusted precommit audience_admission_hash is mandatory and cannot be empty for FINAL_FOR_DECISION audience commit.",
            );
          }

          const basisSelections = factBasisLinks.map((link) => {
            return link.basis_kind === "TASK_AUDIENCE_CONTEXT"
              ? {
                  audience_field: link.audience_field as any,
                  fact_path: link.fact_path,
                  ordinal: link.ordinal,
                  basis_kind: "TASK_AUDIENCE_CONTEXT" as const,
                  task_audience_context_path: link.task_audience_context_path,
                }
              : {
                  audience_field: link.audience_field as any,
                  fact_path: link.fact_path,
                  ordinal: link.ordinal,
                  basis_kind: "AUDIENCE_EPISTEMIC_STATE" as const,
                  proposition_id: link.proposition_id,
                  epistemic_state_id: link.epistemic_state_id,
                };
          });

          const manifest = derivationAuthority.derivation_manifest as unknown as AudienceDerivationManifest;
          const admissionInput: AudienceAdmissionInput = {
            audience: state,
            manifest,
            schema_role_bindings: [currentBinding],
            schema: schemaPayload,
            task_market: String(taskRow.market),
            task_jurisdiction: String(taskRow.jurisdiction),
            task_audience_context: taskAudienceContext,
            basis_selections: basisSelections,
            propositions,
            epistemic_states: epistemicStates,
          };
          const admissionExpectation = {
            tenant_id: authority.tenant_id,
            workspace_id: authority.workspace_id,
            run_config_id: authority.run_config_id,
            task_revision_id: state.task_revision_id,
            canonical_input_hash: authority.canonical_input_hash,
          };

          const revalidated = validateAudienceAdmission(admissionInput, admissionExpectation);

          if (revalidated.audience_admission_hash !== expectedAdmissionHash) {
            throw new RegistryValidationError(
              "AUDIENCE_ADMISSION_HASH_MISMATCH",
              `Commit-time recomputed audience_admission_hash '${revalidated.audience_admission_hash}' does not match precommit '${expectedAdmissionHash}'.`,
            );
          }
        }

        await sqlTx`INSERT INTO audience_states (
          audience_state_id, tenant_id, workspace_id, task_revision_id, state_stage,
          context, knowledge_state, problem_state, solution_state, product_state,
          brand_state, intent_state, desired_outcome, objections, decision_criteria,
          prior_exposure, origin, uncertainty, created_at
        ) VALUES (${state.audience_state_id}, ${authority.tenant_id}, ${authority.workspace_id},
          ${state.task_revision_id}, ${state.state_stage}, ${encode(state.context)},
          ${encode(state.knowledge_state)}, ${encode(state.problem_state)},
          ${encode(state.solution_state)}, ${encode(state.product_state)}, ${encode(state.brand_state)},
          ${encode(state.intent_state)}, ${encode(state.desired_outcome)}, ${encode(state.objections)},
          ${encode(state.decision_criteria)}, ${encode(state.prior_exposure)}, ${encode(state.origin)},
          ${encode(state.uncertainty)}, ${new Date(state.created_at)})`;

        await sqlTx`INSERT INTO audience_derivation_authorities (
          audience_state_id, tenant_id, workspace_id, stage_execution_id, run_config_id,
          schema_role, schema_entity_type, schema_stable_id, schema_revision_id,
          schema_object_id, schema_payload_hash, audience_knowledge_cutoff_time,
          derivation_manifest, derivation_manifest_hash, canonical_input_hash, created_at
        ) VALUES (
          ${state.audience_state_id}, ${authority.tenant_id}, ${authority.workspace_id},
          ${authority.stage_execution_id}, ${authority.run_config_id}, ${binding.role},
          ${binding.schema_entity_type}, ${binding.schema_stable_id},
          ${binding.schema_revision_id}, ${binding.schema_object_id},
          ${binding.schema_payload_hash}, ${new Date(derivationAuthority.audience_knowledge_cutoff_time)},
          ${encode(derivationAuthority.derivation_manifest)},
          ${derivationAuthority.derivation_manifest_hash}, ${authority.canonical_input_hash}, now()
        )`;

        for (const link of factBasisLinks) {
          const task = link.basis_kind === "TASK_AUDIENCE_CONTEXT" ? link : null;
          const epistemic = link.basis_kind === "AUDIENCE_EPISTEMIC_STATE" ? link : null;
          await sqlTx`INSERT INTO audience_fact_basis_links (
            audience_state_id, tenant_id, workspace_id, audience_field, fact_path,
            fact_value_hash, basis_kind, task_id, task_revision_id,
            task_audience_context_path, task_audience_context_value_hash,
            proposition_id, epistemic_state_id, ordinal
          ) VALUES (
            ${state.audience_state_id}, ${authority.tenant_id}, ${authority.workspace_id},
            ${link.audience_field}, ${link.fact_path}, ${link.fact_value_hash},
            ${link.basis_kind}, ${task?.task_id ?? null}, ${task?.task_revision_id ?? null},
            ${task?.task_audience_context_path ?? null},
            ${task?.task_audience_context_value_hash ?? null},
            ${epistemic?.proposition_id ?? null}, ${epistemic?.epistemic_state_id ?? null},
            ${link.ordinal}
          )`;
        }

        return {
          value: state,
          outputRefs: [
            {
              ordinal: 0,
              refKind: "IMMUTABLE_ENTITY" as const,
              entityType: "AudienceState",
              entityId: state.audience_state_id,
            },
          ],
        };
      },
    );

    if (!result.replayed) return result.value!;
    const ref = result.outputRefs[0];
    if (!ref || ref.refKind !== "IMMUTABLE_ENTITY") throw new Error("Audience retry output is invalid");
    const [row] = await this.sql`SELECT * FROM audience_states WHERE audience_state_id = ${ref.entityId}`;
    if (!row) throw new Error("Audience retry output no longer resolves");
    return toAudience(row);
  }
}
