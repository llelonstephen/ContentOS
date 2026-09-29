import {
  failContent,
  validateAudienceAdmission,
  validateAudienceAdmissionAuthority,
  validateAudienceState,
  type AudienceAdmissionInput,
  type AudienceFactBasisSelection,
  type AudienceStateStage,
  type AudienceStateView,
  type JsonValue,
  type ValidatedAudienceAdmission,
} from '../../domain/content/index.js';
import { isolateProviderJsonContext } from './content-generation-context-builder.js';
import type {
  AudienceCommitAuthority,
  AudienceGovernanceRefreshEvidence,
  AudienceStatePersistenceService,
} from '../../persistence/relational/services/audience-state-persistence-service.js';
import type { M4GenerationPinResolver } from '../../persistence/relational/services/content-runtime-run-config-resolver.js';
import type { PinnedGenerationConfig } from './content-generation-context-builder.js';

export type AudienceStateProposal = Omit<
  AudienceStateView,
  'audience_state_id' | 'task_revision_id' | 'state_stage' | 'created_at'
>;

export interface AudienceProposalEnvelope {
  readonly proposal: AudienceStateProposal;
  /** Provider-selected references only; all authority is re-resolved from the trusted manifest. */
  readonly basis_selections: readonly AudienceFactBasisSelection[];
}

export type ResolvedAudienceAdmissionAuthority = Omit<
  AudienceAdmissionInput,
  'audience' | 'basis_selections'
>;

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
  readonly governance_refresh?: Omit<AudienceGovernanceRefreshEvidence, 'audience_state_id'>;
  readonly admission_authority?: ResolvedAudienceAdmissionAuthority;
}

export interface AudienceDerivationInputResolver {
  resolveAuthorizedInputs(
    request: AudienceDerivationRequest,
  ): Promise<ResolvedAudienceDerivationInput>;
}

export interface AudienceProposalProvider {
  generateAudienceProposal(context: unknown, pins: PinnedGenerationConfig): Promise<AudienceProposalEnvelope>;
}

export interface AudienceIdentityFactory {
  nextAudienceStateId(): string;
  now(): Date;
}

const PROPOSAL_FIELDS = [
  'context', 'knowledge_state', 'problem_state', 'solution_state', 'product_state',
  'brand_state', 'intent_state', 'desired_outcome', 'objections', 'decision_criteria',
  'prior_exposure', 'origin', 'uncertainty',
] as const;

function assertProviderEnvelope(envelope: AudienceProposalEnvelope): void {
  if (
    !envelope || Object.keys(envelope).some((key) => !['proposal', 'basis_selections'].includes(key)) ||
    !Array.isArray(envelope.basis_selections) || !envelope.proposal
  ) {
    failContent('AUDIENCE_PROVENANCE_INVALID', 'Audience provider returned unauthorized authority fields');
  }
  const keys = Object.keys(envelope.proposal);
  if (
    keys.length !== PROPOSAL_FIELDS.length ||
    PROPOSAL_FIELDS.some((field) => !keys.includes(field)) ||
    keys.some((key) => !PROPOSAL_FIELDS.includes(key as (typeof PROPOSAL_FIELDS)[number]))
  ) {
    failContent('AUDIENCE_PROVENANCE_INVALID', 'Audience provider proposal does not match frozen fields');
  }
}

export class DeriveAudienceState {
  constructor(
    private readonly resolver: AudienceDerivationInputResolver,
    private readonly provider: AudienceProposalProvider,
    private readonly persistence: AudienceStatePersistenceService,
    private readonly identity: AudienceIdentityFactory,
    private readonly generationPins: M4GenerationPinResolver,
  ) {}

  async execute(request: AudienceDerivationRequest): Promise<AudienceStateView> {
    const resolved = await this.resolver.resolveAuthorizedInputs(request);
    const previous = resolved.previous_state;
    if (request.previous_audience_state_id !== previous?.audience_state_id) {
      throw new Error('Audience derivation did not resolve the exact requested previous state');
    }

    // Provider work deliberately completes before the atomic persistence call.
    const genericPins = await this.generationPins.resolve(request.authority);
    const admissionExpectation = {
      tenant_id: request.authority.tenant_id,
      workspace_id: request.authority.workspace_id,
      run_config_id: request.authority.run_config_id,
      task_revision_id: request.task_revision_id,
      canonical_input_hash: request.authority.canonical_input_hash,
    };
    if (!resolved.admission_authority) {
      failContent('AUDIENCE_PROVENANCE_INVALID', 'Audience derivation requires trusted admission authority');
    }
    const binding = validateAudienceAdmissionAuthority(
      resolved.admission_authority,
      admissionExpectation,
    );
    // Prompt/model/tools remain RunConfig-pinned. The Audience schema pin comes
    // solely from the normalized role binding, never runtime_parameters.
    const pins: PinnedGenerationConfig = {
      ...genericPins,
      schema_revision_id: binding.schema_revision_id,
    };
    const envelope = await this.provider.generateAudienceProposal(
      isolateProviderJsonContext(resolved.provider_context), pins,
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

    let audienceAdmission: ValidatedAudienceAdmission | undefined;
    if (state.state_stage === 'FINAL_FOR_DECISION') {
      audienceAdmission = validateAudienceAdmission({
        ...resolved.admission_authority!,
        audience: state,
        basis_selections: envelope.basis_selections,
      }, admissionExpectation);
    } else if (envelope.basis_selections.length > 0) {
      failContent('AUDIENCE_PROVENANCE_INVALID', 'Non-final provider output cannot claim canonical fact basis');
    }

    const admittedAuthority = audienceAdmission ?? {
      manifest: resolved.admission_authority.manifest,
      schema_role_binding: binding,
      fact_basis_links: [],
    };
    const persistenceAdmission = {
      derivation_authority: {
        audience_knowledge_cutoff_time: new Date(
          admittedAuthority.manifest.audience_knowledge_cutoff_time,
        ).toISOString(),
        derivation_manifest: { ...admittedAuthority.manifest },
        derivation_manifest_hash: admittedAuthority.manifest.derivation_manifest_hash,
        schema_binding: admittedAuthority.schema_role_binding,
      },
      fact_basis_links: admittedAuthority.fact_basis_links.map((link) => {
        const common = {
          audience_field: link.audience_field,
          fact_path: link.fact_path,
          fact_value_hash: link.fact_value_hash,
          ordinal: link.ordinal,
        };
        return link.basis_kind === 'TASK_AUDIENCE_CONTEXT'
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

    const commitRequest = {
      authority: request.authority,
      request_identity: request.request_identity,
      state,
      generation_config: pins,
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
