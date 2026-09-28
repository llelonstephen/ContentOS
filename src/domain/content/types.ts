export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type TimestampInput = string | Date;

export interface ExactEntityRef {
  readonly entity_type: string;
  readonly entity_id: string;
}

export interface ExactRevisionRef {
  readonly entity_type: string;
  readonly stable_id: string;
  readonly revision_id: string;
}

export const AUDIENCE_STATE_STAGES = [
  'PROVISIONAL',
  'REFINED',
  'FINAL_FOR_DECISION',
] as const;
export type AudienceStateStage = (typeof AUDIENCE_STATE_STAGES)[number];

export interface AudienceOriginRef {
  readonly kind: string;
  readonly reference_id: string;
  readonly detail?: string;
}

export interface AudienceUncertainty {
  readonly kind: string;
  readonly description: string;
  readonly blocking?: boolean;
}

/** Read-only view of the frozen AudienceState contract, not a persistence schema. */
export interface AudienceStateView {
  readonly audience_state_id: string;
  readonly task_revision_id: string;
  readonly state_stage: AudienceStateStage;
  readonly context: JsonValue;
  readonly knowledge_state: JsonValue;
  readonly problem_state: JsonValue;
  readonly solution_state: JsonValue;
  readonly product_state: JsonValue;
  readonly brand_state: JsonValue;
  readonly intent_state: JsonValue;
  readonly desired_outcome: JsonValue;
  readonly objections: readonly JsonValue[];
  readonly decision_criteria: readonly JsonValue[];
  readonly prior_exposure: JsonValue;
  readonly origin: readonly AudienceOriginRef[];
  readonly uncertainty: readonly AudienceUncertainty[];
  readonly created_at: TimestampInput;
}

/** Read-only view of the frozen StrategyHypothesis contract. */
export interface StrategyHypothesisView {
  readonly strategy_id: string;
  readonly task_revision_id: string;
  readonly audience_state_id: string;
  readonly core_message: string;
  readonly behavioral_objective: string;
  readonly persuasion_mechanism: string;
  readonly proof_strategy: string;
  readonly required_proposition_ids: readonly string[];
  readonly assumptions: readonly string[];
  readonly unknowns: readonly string[];
  readonly failure_modes: readonly string[];
  readonly risk_hypotheses: readonly string[];
  readonly created_at: TimestampInput;
}

/** Read-only view of the frozen ContentUnit contract. */
export interface ContentUnitView {
  readonly unit_id: string;
  readonly position: number;
  readonly purpose: string;
  readonly audience_state_before: JsonValue;
  readonly audience_question: string;
  readonly information_to_deliver: JsonValue;
  readonly proposition_ids: readonly string[];
  readonly copy_goal: string;
  readonly visual_goal: string;
  readonly audio_goal: string;
  readonly payoff: string;
  readonly transition: string;
  readonly audience_state_after: JsonValue;
  readonly created_at: TimestampInput;
}

/** Read-only view of the frozen ContentArchitecture contract. */
export interface ContentArchitectureView {
  readonly architecture_id: string;
  readonly supersedes_architecture_id?: string | null;
  readonly task_revision_id: string;
  readonly strategy_id: string;
  /** Ordered, never a semantic set. */
  readonly unit_ids: readonly string[];
  readonly created_at: TimestampInput;
}

/** Read-only view of the frozen ContentCandidate contract. */
export interface ContentCandidateView {
  readonly candidate_id: string;
  readonly task_revision_id: string;
  readonly strategy_id: string;
  readonly architecture_id: string;
  readonly content_payload: JsonValue;
  readonly run_config_id: string;
  readonly parent_candidate_id?: string | null;
  readonly created_at: TimestampInput;
}
