import {
  CONTENT_CANONICAL_SERIALIZATION_VERSION,
  hashCanonicalInput,
  type AudienceStateView,
  type CanonicalInputManifest,
  type ExactEntityRef,
  type ExactRevisionRef,
  type GateGovernanceState,
  type GateKnowledgeGap,
  type GatePropositionState,
  type JsonValue,
  type StrategyGateInput,
  type StrategyHypothesisView,
} from '../../../domain/content/index.js';

export interface StrategyGateResolutionRequest {
  readonly tenant_id: string;
  readonly workspace_id: string;
  readonly run_id: string;
  readonly decision_cycle_id: string;
  readonly task_revision_id: string;
  readonly audience_state_id: string;
  readonly strategy_id: string;
  readonly run_config_id: string;
  readonly gate_config_revision: string;
  readonly expected_input_hash?: string;
  readonly additional_knowledge_gaps?: readonly GateKnowledgeGap[];
  readonly additional_proposition_states?: readonly GatePropositionState[];
  readonly additional_governance?: readonly GateGovernanceState[];
}

export interface CanonicalGateSource {
  readonly audience?: AudienceStateView;
  readonly strategy?: StrategyHypothesisView;
  readonly terminal_knowledge_gaps?: readonly GateKnowledgeGap[];
  readonly proposition_states?: readonly GatePropositionState[];
  readonly pre_generation_final_governance?: readonly GateGovernanceState[];
  readonly pinned_entity_refs: readonly ExactEntityRef[];
  readonly pinned_revision_refs: readonly ExactRevisionRef[];
}

/** Adapter resolves only exact authorized IDs at the pinned decision boundary. */
export interface CanonicalStrategyGateSourcePort {
  loadCanonicalGateSource(
    request: StrategyGateResolutionRequest,
  ): Promise<CanonicalGateSource>;
}

export interface ResolvedStrategyGateInput {
  readonly request: StrategyGateResolutionRequest;
  readonly gate_input: StrategyGateInput;
  readonly manifest: CanonicalInputManifest;
  readonly input_hash: string;
  readonly pinned_entity_refs: readonly ExactEntityRef[];
  readonly pinned_revision_refs: readonly ExactRevisionRef[];
}

function validateCanonicalSet<T>(
  canonical: readonly T[] | undefined,
  keyOf: (value: T) => string,
): readonly T[] | undefined {
  if (!canonical) return undefined;
  const identities = new Set(canonical.map(keyOf));
  if (identities.size !== canonical.length) {
    throw new Error('Canonical gate input contains duplicate identities');
  }
  return canonical;
}

function asJson(value: unknown): JsonValue {
  return value as JsonValue;
}

export class ContentStrategyGateInputResolver {
  constructor(private readonly sourcePort: CanonicalStrategyGateSourcePort) {}

  async resolve(
    request: StrategyGateResolutionRequest,
  ): Promise<ResolvedStrategyGateInput> {
    if (
      request.additional_knowledge_gaps?.length ||
      request.additional_proposition_states?.length ||
      request.additional_governance?.length
    ) {
      throw new Error('Caller-supplied Strategy Gate facts are forbidden; resolve canonical state');
    }
    const source = await this.sourcePort.loadCanonicalGateSource(request);
    if (source.audience && source.audience.audience_state_id !== request.audience_state_id) {
      throw new Error('Canonical gate resolver returned a different AudienceState');
    }
    if (source.strategy && source.strategy.strategy_id !== request.strategy_id) {
      throw new Error('Canonical gate resolver returned a different StrategyHypothesis');
    }
    if (
      source.pre_generation_final_governance?.some(
        (assessment) => assessment.applicability_stage !== 'PRE_GENERATION_FINAL',
      )
    ) {
      throw new Error('Strategy Gate governance must be PRE_GENERATION_FINAL');
    }

    const gaps = validateCanonicalSet(
      source.terminal_knowledge_gaps,
      (gap) => gap.knowledge_gap_id,
    );
    const required = new Set(source.strategy?.required_proposition_ids ?? []);
    const canonicalPropositions = source.proposition_states?.map((state) =>
      required.has(state.proposition_id)
        ? { ...state, used_as_factual_proof: true }
        : state,
    );
    const propositions = validateCanonicalSet(
      canonicalPropositions,
      (state) => state.proposition_id,
    );
    const canonicalGovernance = source.pre_generation_final_governance?.some(
      (assessment) => !assessment.resolved && assessment.non_overridable,
    )
      ? undefined
      : source.pre_generation_final_governance;
    const governance = validateCanonicalSet(
      canonicalGovernance,
      (assessment) => assessment.assessment_id,
    );
    const gateInput: StrategyGateInput = {
      task_revision_id: request.task_revision_id,
      ...(source.audience ? { audience: source.audience } : {}),
      ...(source.strategy ? { strategy: source.strategy } : {}),
      ...(gaps ? { knowledge_gaps: gaps } : {}),
      ...(propositions ? { proposition_states: propositions } : {}),
      ...(governance ? { governance } : {}),
      gate_config_revision: request.gate_config_revision,
    };
    const manifest: CanonicalInputManifest = {
      serialization_version: CONTENT_CANONICAL_SERIALIZATION_VERSION,
      fields: [
        { name: 'tenant_id', kind: 'VALUE', value: request.tenant_id },
        { name: 'workspace_id', kind: 'VALUE', value: request.workspace_id },
        { name: 'run_id', kind: 'VALUE', value: request.run_id },
        { name: 'decision_cycle_id', kind: 'VALUE', value: request.decision_cycle_id },
        { name: 'task_revision_id', kind: 'VALUE', value: request.task_revision_id },
        { name: 'audience', kind: 'VALUE', value: asJson(source.audience ?? null) },
        { name: 'strategy', kind: 'VALUE', value: asJson(source.strategy ?? null) },
        { name: 'knowledge_gaps_complete', kind: 'VALUE', value: gaps !== undefined },
        { name: 'knowledge_gaps', kind: 'SEMANTIC_SET', value: asJson(gaps ?? []) as readonly JsonValue[] },
        { name: 'proposition_states_complete', kind: 'VALUE', value: propositions !== undefined },
        { name: 'proposition_states', kind: 'SEMANTIC_SET', value: asJson(propositions ?? []) as readonly JsonValue[] },
        { name: 'governance_complete', kind: 'VALUE', value: governance !== undefined },
        { name: 'governance', kind: 'SEMANTIC_SET', value: asJson(governance ?? []) as readonly JsonValue[] },
        { name: 'pinned_entity_refs', kind: 'SEMANTIC_SET', value: asJson(source.pinned_entity_refs) as readonly JsonValue[] },
        { name: 'pinned_revision_refs', kind: 'SEMANTIC_SET', value: asJson(source.pinned_revision_refs) as readonly JsonValue[] },
        { name: 'run_config_id', kind: 'VALUE', value: request.run_config_id },
        { name: 'gate_config_revision', kind: 'VALUE', value: request.gate_config_revision },
      ],
    };
    const inputHash = hashCanonicalInput(manifest);
    if (request.expected_input_hash && request.expected_input_hash !== inputHash) {
      throw new Error('Resolved Strategy Gate input hash does not match StageExecution');
    }
    return {
      request,
      gate_input: gateInput,
      manifest,
      input_hash: inputHash,
      pinned_entity_refs: source.pinned_entity_refs,
      pinned_revision_refs: source.pinned_revision_refs,
    };
  }
}
