import {
  failContent,
  hashAudienceDerivationManifest,
  validateAudienceAdmission,
  validateAudienceState,
  type AudienceAdmissionInput,
  type AudienceDerivationManifest,
  type AudienceFactBasisSelection,
  type AudienceStateStage,
  type AudienceStateView,
  type JsonValue,
  type ValidatedAudienceAdmission,
} from "../../domain/content/index.js";
import {
  hashProviderContext,
} from "../../domain/content/pre-provider-manifest-core.js";
import { isolateProviderJsonContext } from "./content-generation-context-builder.js";
import type {
  AudienceCommitAuthority,
  AudienceGovernanceRefreshEvidence,
  AudienceStatePersistenceService,
} from "../../persistence/relational/services/audience-state-persistence-service.js";
import {
  assertPinnedGenerationConfig,
  type M4GenerationPinResolver,
} from "../../persistence/relational/services/content-runtime-run-config-resolver.js";
import type { PinnedGenerationConfig } from "./content-generation-context-builder.js";
import type {
  TrustedPreProviderResolver,
} from "../../persistence/relational/services/trusted-pre-provider-resolver.js";
import type {
  ClaimContentStageExecutionParams,
  ClaimContentStageExecutionResult,
} from "../../persistence/relational/services/content-stage-execution-repository.js";

export type AudienceStateProposal = Omit<
  AudienceStateView,
  "audience_state_id" | "task_revision_id" | "state_stage" | "created_at"
>;

export interface AudienceProposalEnvelope {
  readonly proposal: AudienceStateProposal;
  /** Provider-selected references only; all authority is re-resolved from the trusted manifest. */
  readonly basis_selections: readonly AudienceFactBasisSelection[];
}

export interface AudienceDerivationRequest {
  readonly authority: AudienceCommitAuthority;
  readonly request_identity: string;
  readonly task_revision_id: string;
  readonly target_stage: AudienceStateStage;
  readonly previous_audience_state_id?: string;
}

export interface ResolvedAudienceDerivationInput {
  readonly previous_state?: AudienceStateView;
  readonly provider_context: JsonValue;
  readonly material_governance_dependencies_changed: boolean;
  readonly governance_refresh?: Omit<AudienceGovernanceRefreshEvidence, "audience_state_id">;
}

export interface AudienceDerivationInputResolver {
  resolveAuthorizedInputs(
    request: AudienceDerivationRequest,
  ): Promise<ResolvedAudienceDerivationInput>;
}

export interface AudienceProposalProvider {
  generateAudienceProposal(
    context: unknown,
    pins: PinnedGenerationConfig,
  ): Promise<AudienceProposalEnvelope>;
}

export interface AudienceIdentityFactory {
  nextAudienceStateId(): string;
  now(): Date;
}

export interface AudienceStageClaimPort {
  claimStageExecution(
    params: ClaimContentStageExecutionParams,
  ): Promise<ClaimContentStageExecutionResult>;
}

const PROPOSAL_FIELDS = [
  "context",
  "knowledge_state",
  "problem_state",
  "solution_state",
  "product_state",
  "brand_state",
  "intent_state",
  "desired_outcome",
  "objections",
  "decision_criteria",
  "prior_exposure",
  "origin",
  "uncertainty",
] as const;

function assertProviderEnvelope(envelope: AudienceProposalEnvelope): void {
  if (
    !envelope ||
    Object.keys(envelope).some((key) => !["proposal", "basis_selections"].includes(key)) ||
    !Array.isArray(envelope.basis_selections) ||
    !envelope.proposal
  ) {
    failContent(
      "AUDIENCE_PROVENANCE_INVALID",
      "Audience provider returned unauthorized authority fields",
    );
  }
  const keys = Object.keys(envelope.proposal);
  if (
    keys.length !== PROPOSAL_FIELDS.length ||
    PROPOSAL_FIELDS.some((field) => !keys.includes(field)) ||
    keys.some((key) => !PROPOSAL_FIELDS.includes(key as (typeof PROPOSAL_FIELDS)[number]))
  ) {
    failContent(
      "AUDIENCE_PROVENANCE_INVALID",
      "Audience provider proposal does not match frozen fields",
    );
  }
}

export class DeriveAudienceState {
  constructor(
    private readonly resolver: AudienceDerivationInputResolver,
    private readonly provider: AudienceProposalProvider,
    private readonly persistence: AudienceStatePersistenceService,
    private readonly identity: AudienceIdentityFactory,
    private readonly generationPins: M4GenerationPinResolver,
    private readonly trustedResolver: TrustedPreProviderResolver,
    private readonly claimPort: AudienceStageClaimPort,
  ) {
    if (!this.claimPort) {
      failContent(
        "AUDIENCE_PROVENANCE_INVALID",
        "StageExecution claim authority (claimPort) is mandatory for Audience derivation",
      );
    }
  }

  async execute(request: AudienceDerivationRequest): Promise<AudienceStateView> {
    if (!this.claimPort) {
      failContent(
        "AUDIENCE_PROVENANCE_INVALID",
        "StageExecution claim authority (claimPort) is mandatory for Audience derivation",
      );
    }

    const resolved = await this.resolver.resolveAuthorizedInputs(request);
    const previous = resolved.previous_state;
    if (request.previous_audience_state_id !== previous?.audience_state_id) {
      throw new Error("Audience derivation did not resolve the exact requested previous state");
    }

    // Isolate & normalize provider generation context and compute its deterministic hash
    const providerContext = isolateProviderJsonContext(resolved.provider_context ?? {});
    const providerContextHash = hashProviderContext(providerContext);

    // 1. Trusted canonical resolution
    const trusted = await this.trustedResolver.resolveCanonicalInputs({
      tenant_id: request.authority.tenant_id,
      workspace_id: request.authority.workspace_id,
      run_id: request.authority.run_id,
      decision_cycle_id: request.authority.decision_cycle_id,
      run_config_id: request.authority.run_config_id,
      task_revision_id: request.task_revision_id,
      provider_context_hash: providerContextHash,
    });

    const authoritativeCanonicalInputHash = trusted.canonicalInputHash;

    // Reject forged / mismatched caller canonical hash
    if (
      request.authority.canonical_input_hash &&
      request.authority.canonical_input_hash !== authoritativeCanonicalInputHash
    ) {
      failContent(
        "AUDIENCE_PROVENANCE_INVALID",
        `Caller-provided canonical_input_hash '${request.authority.canonical_input_hash}' mismatches trusted core '${authoritativeCanonicalInputHash}'`,
      );
    }

    // Verify generation pins before claim if generationPins resolver is provided
    if (this.generationPins) {
      const claimedPins = await this.generationPins.resolve(request.authority);
      assertPinnedGenerationConfig(claimedPins, trusted.runConfig);
    }

    // Verify role-binding exact tuple membership against RunConfig schema ref set
    const schemaRefs = trusted.preProviderCore.schema_revision_refs ?? [];
    const binding = trusted.schemaBinding;
    const isMember = schemaRefs.some(
      (ref) =>
        ref.entity_type === binding.schema_entity_type &&
        ref.stable_id === binding.schema_stable_id &&
        ref.revision_id === binding.schema_revision_id,
    );
    if (!isMember) {
      failContent(
        "AUDIENCE_PROVENANCE_INVALID",
        `Audience schema role binding (${binding.schema_entity_type}, ${binding.schema_stable_id}, ${binding.schema_revision_id}) is not an exact member of RunConfig.schema_revision_refs`,
      );
    }

    // 2. Atomic StageExecution claim with exact hash BEFORE provider invocation
    const claimResult = await this.claimPort.claimStageExecution({
      tenantId: request.authority.tenant_id,
      workspaceId: request.authority.workspace_id,
      runId: request.authority.run_id,
      decisionCycleId: request.authority.decision_cycle_id,
      stageExecutionId: request.authority.stage_execution_id,
      stageName: request.authority.stage_name,
      idempotencyKey: request.authority.idempotency_key,
      canonicalInputHash: authoritativeCanonicalInputHash,
      leaseOwner: request.authority.lease_owner,
      cycleEpoch: request.authority.cycle_epoch,
    });
    if (!claimResult.claimed) {
      failContent(
        "AUDIENCE_PROVENANCE_INVALID",
        claimResult.reason ?? "StageExecution claim rejected",
      );
    }
    const effectiveFencingToken = claimResult.fencingToken;

    // 3. Provider work (only reached by winning claimant, uses exact already-trusted RunConfig pins)
    const envelope = await this.provider.generateAudienceProposal(
      providerContext,
      trusted.runConfig,
    );
    assertProviderEnvelope(envelope);

    const state: AudienceStateView = {
      ...envelope.proposal,
      audience_state_id: this.identity.nextAudienceStateId(),
      task_revision_id: request.task_revision_id,
      state_stage: request.target_stage,
      created_at: this.identity.now(),
    };
    validateAudienceState(state, {
      expected_task_revision_id: request.task_revision_id,
      expected_stage: request.target_stage,
      ...(previous ? { previous_state: previous } : {}),
    });

    // 4. Construct derivation manifest and validate admission
    const manifestWithoutHash = {
      tenant_id: trusted.preProviderCore.tenant_id,
      workspace_id: trusted.preProviderCore.workspace_id ?? "",
      run_config_id: trusted.preProviderCore.run_config_id,
      task_id: trusted.preProviderCore.task_id,
      task_revision_id: trusted.preProviderCore.task_revision_id,
      audience_knowledge_cutoff_time: trusted.trustedCutoff,
      audience_valid_time: trusted.trustedCutoff,
      canonical_input_hash: authoritativeCanonicalInputHash,
      derivation_manifest_hash: "",
      audience_schema_ref: trusted.preProviderCore.audience_schema_ref,
      audience_schema_payload_hash: trusted.preProviderCore.audience_schema_payload_hash,
      audience_schema_role_binding: trusted.schemaBinding,
      eligible_task_audience_context: trusted.eligibleTaskAudienceContext,
      eligible_epistemic_refs: trusted.eligibleEpistemicRefs,
      fact_admissions: [],
      provider_context_hash: providerContextHash,
    };
    const derivationManifest: AudienceDerivationManifest = {
      ...manifestWithoutHash,
      derivation_manifest_hash: hashAudienceDerivationManifest(manifestWithoutHash),
    };

    let audienceAdmission: ValidatedAudienceAdmission | undefined;
    if (state.state_stage === "FINAL_FOR_DECISION") {
      const admissionInput: AudienceAdmissionInput = {
        audience: state,
        manifest: derivationManifest,
        schema_role_bindings: [trusted.schemaBinding],
        schema: trusted.schemaPayload,
        task_market: trusted.task.market,
        task_jurisdiction: trusted.task.jurisdiction,
        task_audience_context: trusted.task.audience_context,
        basis_selections: envelope.basis_selections,
        propositions: trusted.propositions,
        epistemic_states: trusted.epistemicStates,
      };
      const admissionExpectation = {
        tenant_id: request.authority.tenant_id,
        workspace_id: request.authority.workspace_id,
        run_config_id: request.authority.run_config_id,
        task_revision_id: request.task_revision_id,
        canonical_input_hash: authoritativeCanonicalInputHash,
      };
      audienceAdmission = validateAudienceAdmission(admissionInput, admissionExpectation);
    } else if (envelope.basis_selections.length > 0) {
      failContent(
        "AUDIENCE_PROVENANCE_INVALID",
        "Non-final provider output cannot claim canonical fact basis",
      );
    }

    const admittedAuthority = audienceAdmission ?? {
      manifest: derivationManifest,
      schema_role_binding: trusted.schemaBinding,
      fact_basis_links: [],
      admission_evidence: [],
      audience_admission_hash: "",
    };

    const persistenceAdmission = {
      derivation_authority: {
        audience_knowledge_cutoff_time: new Date(
          admittedAuthority.manifest.audience_knowledge_cutoff_time,
        ).toISOString(),
        derivation_manifest: {
          ...admittedAuthority.manifest,
          ...(admittedAuthority.audience_admission_hash
            ? { audience_admission_hash: admittedAuthority.audience_admission_hash }
            : {}),
        },
        derivation_manifest_hash: admittedAuthority.manifest.derivation_manifest_hash,
        schema_binding: admittedAuthority.schema_role_binding,
        ...(admittedAuthority.audience_admission_hash
          ? { audience_admission_hash: admittedAuthority.audience_admission_hash }
          : {}),
      },
      audience_admission_hash: admittedAuthority.audience_admission_hash || undefined,
      admission_evidence: admittedAuthority.admission_evidence,
      fact_basis_links: admittedAuthority.fact_basis_links.map((link) => {
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
    };

    const commitAuthority: AudienceCommitAuthority = {
      ...request.authority,
      canonical_input_hash: authoritativeCanonicalInputHash,
      fencing_token: effectiveFencingToken,
    };

    const commitRequest = {
      authority: commitAuthority,
      request_identity: request.request_identity,
      state,
      generation_config: trusted.runConfig,
      ...(previous ? { previous_state: previous } : {}),
      material_governance_dependencies_changed:
        resolved.material_governance_dependencies_changed,
      ...(resolved.governance_refresh
        ? {
            governance_refresh: {
              ...resolved.governance_refresh,
              audience_state_id: state.audience_state_id,
            },
          }
        : {}),
      ...persistenceAdmission,
    };

    return this.persistence.commit(commitRequest);
  }
}
