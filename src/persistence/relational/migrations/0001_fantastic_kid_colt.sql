CREATE TABLE "canonical_object_reference_sources" (
	"source_name" text PRIMARY KEY NOT NULL,
	"source_table" text NOT NULL,
	"object_id_column" text NOT NULL,
	"owner_scope_columns" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "immutable_entity_registry" (
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"payload_state" text DEFAULT 'AVAILABLE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "immutable_entity_registry_entity_type_entity_id_pk" PRIMARY KEY("entity_type","entity_id"),
	CONSTRAINT "uq_imm_entity_tenant_triple" UNIQUE("tenant_id","entity_type","entity_id"),
	CONSTRAINT "ck_imm_payload_state" CHECK ("immutable_entity_registry"."payload_state" IN ('AVAILABLE', 'REDACTED', 'DELETED'))
);
--> statement-breakpoint
CREATE TABLE "object_references" (
	"owner_entity_type" text NOT NULL,
	"owner_entity_id" text NOT NULL,
	"field_name" text NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"object_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "object_references_owner_entity_type_owner_entity_id_field_name_pk" PRIMARY KEY("owner_entity_type","owner_entity_id","field_name")
);
--> statement-breakpoint
CREATE TABLE "object_registry" (
	"object_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"content_hash" text NOT NULL,
	"object_key" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"media_type" text NOT NULL,
	"state" text DEFAULT 'AVAILABLE' NOT NULL,
	"gc_claim_token" text,
	"gc_claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uq_object_registry_tenant_id" UNIQUE("tenant_id","object_id"),
	CONSTRAINT "ck_object_registry_state" CHECK ("object_registry"."state" IN ('AVAILABLE', 'GC_CLAIMED', 'DELETED'))
);
--> statement-breakpoint
CREATE TABLE "revision_registry" (
	"entity_type" text NOT NULL,
	"stable_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"payload_state" text DEFAULT 'AVAILABLE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "revision_registry_entity_type_revision_id_pk" PRIMARY KEY("entity_type","revision_id"),
	CONSTRAINT "uq_revision_registry_triple" UNIQUE("entity_type","stable_id","revision_id"),
	CONSTRAINT "uq_revision_registry_tenant_triple" UNIQUE("tenant_id","entity_type","stable_id","revision_id"),
	CONSTRAINT "ck_rev_payload_state" CHECK ("revision_registry"."payload_state" IN ('AVAILABLE', 'REDACTED', 'DELETED'))
);
--> statement-breakpoint
CREATE TABLE "attribution_model_revisions" (
	"attribution_model_id" text NOT NULL,
	"attribution_model_revision_id" text PRIMARY KEY NOT NULL,
	"supersedes_attribution_model_revision_id" text,
	"model_type" text NOT NULL,
	"eligible_touchpoints" text NOT NULL,
	"lookback_window" text NOT NULL,
	"credit_assignment" text NOT NULL,
	"assumptions" text NOT NULL,
	"limitations" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text
);
--> statement-breakpoint
CREATE TABLE "channel_profile_revisions" (
	"channel_profile_id" text NOT NULL,
	"channel_profile_revision_id" text PRIMARY KEY NOT NULL,
	"supersedes_channel_profile_revision_id" text,
	"identity" text NOT NULL,
	"platform_if_applicable" text NOT NULL,
	"supported_formats" text NOT NULL,
	"distribution_capabilities" text NOT NULL,
	"technical_capabilities" text NOT NULL,
	"content_capabilities" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text
);
--> statement-breakpoint
CREATE TABLE "content_program_revisions" (
	"program_id" text NOT NULL,
	"program_revision_id" text PRIMARY KEY NOT NULL,
	"supersedes_program_revision_id" text,
	"business_objective" text NOT NULL,
	"brand_objective" text NOT NULL,
	"outcome_model_id" text,
	"target_audiences" text NOT NULL,
	"markets" text NOT NULL,
	"message_hierarchy" text NOT NULL,
	"content_pillars" text NOT NULL,
	"channel_roles" text NOT NULL,
	"budget_context" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"scheduled_expiration" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	CONSTRAINT "ck_content_program_expiration" CHECK ("content_program_revisions"."scheduled_expiration" IS NULL OR "content_program_revisions"."scheduled_expiration" > "content_program_revisions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "control_plane_activations" (
	"activation_id" text PRIMARY KEY NOT NULL,
	"deployment_scope" text NOT NULL,
	"component_type" text NOT NULL,
	"stable_id" text NOT NULL,
	"active_revision_id" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_activation_effective_range" CHECK ("control_plane_activations"."effective_until" IS NULL OR "control_plane_activations"."effective_until" > "control_plane_activations"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "decision_policy_revisions" (
	"policy_id" text NOT NULL,
	"policy_revision_id" text PRIMARY KEY NOT NULL,
	"supersedes_policy_revision_id" text,
	"conditions" text NOT NULL,
	"required_inputs" text NOT NULL,
	"action" text NOT NULL,
	"priority_class" text NOT NULL,
	"scope" text NOT NULL,
	"override_allowed" boolean NOT NULL,
	"override_authority_requirements" text,
	"override_scope_constraints" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text
);
--> statement-breakpoint
CREATE TABLE "eval_contract_revisions" (
	"eval_contract_id" text NOT NULL,
	"eval_contract_revision_id" text PRIMARY KEY NOT NULL,
	"supersedes_eval_contract_revision_id" text,
	"component" text NOT NULL,
	"capability" text NOT NULL,
	"required_dimensions" text NOT NULL,
	"hard_gates" text NOT NULL,
	"release_impact" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text
);
--> statement-breakpoint
CREATE TABLE "guidance_revisions" (
	"guidance_id" text NOT NULL,
	"guidance_revision_id" text PRIMARY KEY NOT NULL,
	"supersedes_guidance_revision_id" text,
	"guidance_type" text NOT NULL,
	"recommendation" text NOT NULL,
	"scope" text NOT NULL,
	"limitations" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"scheduled_expiration" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	CONSTRAINT "ck_guidance_expiration" CHECK ("guidance_revisions"."scheduled_expiration" IS NULL OR "guidance_revisions"."scheduled_expiration" > "guidance_revisions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "metric_definition_revisions" (
	"metric_id" text NOT NULL,
	"metric_revision_id" text PRIMARY KEY NOT NULL,
	"supersedes_metric_revision_id" text,
	"metric_name" text NOT NULL,
	"layer" text NOT NULL,
	"definition" text NOT NULL,
	"numerator" text NOT NULL,
	"denominator" text NOT NULL,
	"window" text NOT NULL,
	"attribution_model_revision_id" text,
	"effective_from" timestamp with time zone NOT NULL,
	"scheduled_expiration" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	CONSTRAINT "ck_metric_definition_expiration" CHECK ("metric_definition_revisions"."scheduled_expiration" IS NULL OR "metric_definition_revisions"."scheduled_expiration" > "metric_definition_revisions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "normative_rule_revisions" (
	"rule_id" text NOT NULL,
	"rule_revision_id" text PRIMARY KEY NOT NULL,
	"supersedes_rule_revision_id" text,
	"rule_type" text NOT NULL,
	"statement" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"scope" text NOT NULL,
	"applicability_conditions" text NOT NULL,
	"enforcement_level" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"known_from" timestamp with time zone NOT NULL,
	"scheduled_expiration" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	CONSTRAINT "ck_normative_rule_expiration" CHECK ("normative_rule_revisions"."scheduled_expiration" IS NULL OR "normative_rule_revisions"."scheduled_expiration" > "normative_rule_revisions"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "outcome_edges" (
	"edge_id" text PRIMARY KEY NOT NULL,
	"from_node" text NOT NULL,
	"to_node" text NOT NULL,
	"relationship_type" text NOT NULL,
	"assumptions" text NOT NULL,
	"known_confounders" text NOT NULL,
	"time_lag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text
);
--> statement-breakpoint
CREATE TABLE "outcome_models" (
	"outcome_model_id" text PRIMARY KEY NOT NULL,
	"business_outcomes" text NOT NULL,
	"behavioral_outcomes" text NOT NULL,
	"time_horizons" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text
);
--> statement-breakpoint
CREATE TABLE "registered_control_plane_revision_payloads" (
	"entity_type" text NOT NULL,
	"stable_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"object_id" text NOT NULL,
	"payload_hash" text NOT NULL,
	"payload_schema_revision_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registered_control_plane_revision_payloads_entity_type_revision_id_pk" PRIMARY KEY("entity_type","revision_id")
);
--> statement-breakpoint
CREATE TABLE "registered_control_plane_revisions" (
	"entity_type" text NOT NULL,
	"stable_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"supersedes_revision_id" text,
	"payload_hash" text NOT NULL,
	"payload_schema_revision_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	CONSTRAINT "registered_control_plane_revisions_entity_type_revision_id_pk" PRIMARY KEY("entity_type","revision_id"),
	CONSTRAINT "ck_cplane_entity_type" CHECK ("registered_control_plane_revisions"."entity_type" IN ('PromptConfig', 'ModelConfig', 'ToolConfig', 'RetrieverConfig', 'EvaluatorConfig', 'SchemaDefinition'))
);
--> statement-breakpoint
CREATE TABLE "run_configs" (
	"run_config_id" text PRIMARY KEY NOT NULL,
	"runtime_parameters" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text
);
--> statement-breakpoint
CREATE TABLE "task_contract_revisions" (
	"task_id" text NOT NULL,
	"task_revision_id" text PRIMARY KEY NOT NULL,
	"supersedes_task_revision_id" text,
	"program_revision_id" text,
	"standalone_task" boolean NOT NULL,
	"objective" text NOT NULL,
	"channel" text NOT NULL,
	"format" text NOT NULL,
	"language" text NOT NULL,
	"market" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"brand_id" text NOT NULL,
	"product_id" text NOT NULL,
	"audience_context" text NOT NULL,
	"success_metric_revision_id" text NOT NULL,
	"constraints" text NOT NULL,
	"risk_context" text NOT NULL,
	"compute_budget" text NOT NULL,
	"intended_publication_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	CONSTRAINT "ck_task_contract_standalone_program" CHECK (("task_contract_revisions"."standalone_task" = TRUE AND "task_contract_revisions"."program_revision_id" IS NULL) OR ("task_contract_revisions"."standalone_task" = FALSE AND "task_contract_revisions"."program_revision_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "epistemic_state_versions" (
	"epistemic_state_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"supersedes_epistemic_state_id" text,
	"proposition_id" text NOT NULL,
	"support_status" text NOT NULL,
	"causal_status" text NOT NULL,
	"uncertainty" text NOT NULL,
	"derivation_method" text NOT NULL,
	"derivation_entity_type" text NOT NULL,
	"derivation_stable_id" text NOT NULL,
	"derivation_revision_id" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until_if_known" timestamp with time zone,
	"known_from" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_assessments" (
	"assessment_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"supersedes_assessment_id" text,
	"link_id" text NOT NULL,
	"compatibility_status" text NOT NULL,
	"relationship" text NOT NULL,
	"assessor" text NOT NULL,
	"assessment_method" text NOT NULL,
	"authority" text NOT NULL,
	"methodological_quality" text NOT NULL,
	"directness" text NOT NULL,
	"applicability" text NOT NULL,
	"population_match" text NOT NULL,
	"context_match" text NOT NULL,
	"freshness" text NOT NULL,
	"independence" text NOT NULL,
	"precision" text NOT NULL,
	"limitations" text NOT NULL,
	"uncertainty" text NOT NULL,
	"assessed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_evidence_compat_status" CHECK ("evidence_assessments"."compatibility_status" IN ('COMPATIBLE', 'COMPATIBLE_WITH_LIMITS', 'INCOMPATIBLE', 'UNCERTAIN')),
	CONSTRAINT "ck_evidence_relationship" CHECK ("evidence_assessments"."relationship" IN ('SUPPORTS', 'PARTIALLY_SUPPORTS', 'QUALIFIES', 'CONTRADICTS', 'DOES_NOT_ADDRESS'))
);
--> statement-breakpoint
CREATE TABLE "evidence_items" (
	"evidence_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"origin_type" text NOT NULL,
	"origin_id" text NOT NULL,
	"locator" text,
	"statement" text NOT NULL,
	"statement_type" text NOT NULL,
	"assertion_method" text NOT NULL,
	"evidence_domain" text NOT NULL,
	"study_design" text NOT NULL,
	"causal_identification" text NOT NULL,
	"mechanism_support" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until_if_known" timestamp with time zone,
	"limitations" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_evidence_item_origin_type" CHECK ("evidence_items"."origin_type" IN ('SOURCE_ARTIFACT', 'PERFORMANCE_OBSERVATION')),
	CONSTRAINT "ck_evidence_item_domain" CHECK ("evidence_items"."evidence_domain" IN ('PRODUCT_DOCUMENTATION', 'FIRST_PARTY_OBSERVATION', 'CUSTOMER_REPORT', 'EXPERT_SOURCE', 'ACADEMIC_STUDY', 'REGULATORY_SOURCE', 'PLATFORM_POLICY', 'PLATFORM_ANALYTICS', 'OBSERVATIONAL_PERFORMANCE', 'RANDOMIZED_EXPERIMENT', 'QUASI_EXPERIMENT', 'MARKET_DATA'))
);
--> statement-breakpoint
CREATE TABLE "evidence_proposition_links" (
	"link_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"evidence_id" text NOT NULL,
	"proposition_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_gaps" (
	"gap_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"supersedes_gap_id" text,
	"task_revision_id" text NOT NULL,
	"question" text NOT NULL,
	"decision_relevance" text NOT NULL,
	"blocking" boolean NOT NULL,
	"researchable" boolean NOT NULL,
	"user_resolvable" boolean NOT NULL,
	"assumption_allowed" boolean NOT NULL,
	"risk_if_wrong" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_knowledge_gap_status" CHECK ("knowledge_gaps"."status" IN ('OPEN', 'RESOLVED_BY_RESEARCH', 'RESOLVED_BY_USER', 'EXPLICIT_ASSUMPTION', 'UNRESOLVED_NON_BLOCKING', 'BLOCKING'))
);
--> statement-breakpoint
CREATE TABLE "propositions" (
	"proposition_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"proposition_type" text NOT NULL,
	"canonical_meaning" text NOT NULL,
	"subject" text NOT NULL,
	"predicate" text NOT NULL,
	"object" text NOT NULL,
	"qualifiers" text NOT NULL,
	"conditions" text NOT NULL,
	"population_scope" text NOT NULL,
	"jurisdiction_scope" text NOT NULL,
	"supersedes_proposition_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_proposition_type" CHECK ("propositions"."proposition_type" IN ('FACTUAL', 'CAUSAL', 'PREDICTIVE', 'STRATEGIC', 'PERFORMANCE', 'AUDIENCE', 'MEASUREMENT', 'DEFINITIONAL'))
);
--> statement-breakpoint
CREATE TABLE "research_traces" (
	"research_trace_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"gap_id" text NOT NULL,
	"research_question" text NOT NULL,
	"queries" text NOT NULL,
	"sources_searched" text NOT NULL,
	"retrieval_entity_type" text NOT NULL,
	"retrieval_stable_id" text NOT NULL,
	"retrieval_revision_id" text NOT NULL,
	"coverage_limitations" text NOT NULL,
	"outcome" text NOT NULL,
	"stop_reason" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ck_research_trace_outcome" CHECK ("research_traces"."outcome" IN ('FOUND_RELEVANT_EVIDENCE', 'NO_EVIDENCE_FOUND', 'SEARCH_INCOMPLETE', 'SEARCH_FAILED'))
);
--> statement-breakpoint
CREATE TABLE "source_artifacts" (
	"source_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"source_type" text NOT NULL,
	"publisher" text NOT NULL,
	"author" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"source_version" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"content_hash" text NOT NULL,
	"snapshot_reference" text NOT NULL,
	"rights_policy_id" text NOT NULL,
	"data_scope" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_source_artifact_data_scope" CHECK ("source_artifacts"."data_scope" IN ('TENANT_PRIVATE', 'WORKSPACE_SHARED', 'AUTHORIZED_AGGREGATE', 'GLOBAL_PUBLIC'))
);
--> statement-breakpoint
CREATE TABLE "applicability_assessments" (
	"assessment_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"subject_type" text NOT NULL,
	"subject_revision_id" text NOT NULL,
	"task_revision_id" text NOT NULL,
	"assessment_stage" text NOT NULL,
	"result" text NOT NULL,
	"applicability_strength" text,
	"scope_matches" text NOT NULL,
	"reason_codes" text NOT NULL,
	"assessor" text NOT NULL,
	"uncertainty" text NOT NULL,
	"review_required" boolean NOT NULL,
	"dependency_fingerprint" text NOT NULL,
	"target_valid_time" timestamp with time zone NOT NULL,
	"knowledge_cutoff_time" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_applicability_subject_type" CHECK ("applicability_assessments"."subject_type" IN ('GUIDANCE', 'NORMATIVE_RULE')),
	CONSTRAINT "ck_applicability_stage" CHECK ("applicability_assessments"."assessment_stage" IN ('PRE_GENERATION_PROVISIONAL', 'PRE_GENERATION_FINAL', 'CONTENT_LEVEL')),
	CONSTRAINT "ck_applicability_result" CHECK ("applicability_assessments"."result" IN ('APPLICABLE', 'PARTIALLY_APPLICABLE', 'NOT_APPLICABLE', 'UNCERTAIN'))
);
--> statement-breakpoint
CREATE TABLE "assertion_proposition_links" (
	"link_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"assertion_id" text NOT NULL,
	"proposition_id" text NOT NULL,
	"relation" text NOT NULL,
	"mapping_uncertainty" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_assertion_prop_relation" CHECK ("assertion_proposition_links"."relation" IN ('EQUIVALENT', 'NARROWER', 'BROADER', 'CONJUNCT', 'IMPLIES', 'CONTRADICTS'))
);
--> statement-breakpoint
CREATE TABLE "assertion_validation_results" (
	"result_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"assertion_id" text NOT NULL,
	"status" text NOT NULL,
	"reason_codes" text NOT NULL,
	"required_qualification" text,
	"evaluator_revision_ref_entity_type" text NOT NULL,
	"evaluator_revision_ref_stable_id" text NOT NULL,
	"evaluator_revision_ref_revision_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_assertion_validation_status" CHECK ("assertion_validation_results"."status" IN ('SUPPORTED', 'SUPPORTED_WITH_QUALIFICATION', 'OVERCLAIM', 'UNSUPPORTED', 'CONTRADICTORY'))
);
--> statement-breakpoint
CREATE TABLE "audience_states" (
	"audience_state_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"task_revision_id" text NOT NULL,
	"state_stage" text NOT NULL,
	"context" text NOT NULL,
	"knowledge_state" text NOT NULL,
	"problem_state" text NOT NULL,
	"solution_state" text NOT NULL,
	"product_state" text NOT NULL,
	"brand_state" text NOT NULL,
	"intent_state" text NOT NULL,
	"desired_outcome" text NOT NULL,
	"objections" text NOT NULL,
	"decision_criteria" text NOT NULL,
	"prior_exposure" text NOT NULL,
	"origin" text NOT NULL,
	"uncertainty" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_audience_state_stage" CHECK ("audience_states"."state_stage" IN ('PROVISIONAL', 'REFINED', 'FINAL_FOR_DECISION'))
);
--> statement-breakpoint
CREATE TABLE "composite_impression_assessments" (
	"assessment_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"candidate_id" text NOT NULL,
	"likely_interpretations" text NOT NULL,
	"misleading_risks" text NOT NULL,
	"required_disclosures" text NOT NULL,
	"status" text NOT NULL,
	"evaluator_revision_ref_entity_type" text NOT NULL,
	"evaluator_revision_ref_stable_id" text NOT NULL,
	"evaluator_revision_ref_revision_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_composite_assessment_status" CHECK ("composite_impression_assessments"."status" IN ('STABLE', 'STABLE_WITH_REQUIREMENTS', 'INVALID', 'REVIEW_REQUIRED'))
);
--> statement-breakpoint
CREATE TABLE "content_architectures" (
	"architecture_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"supersedes_architecture_id" text,
	"task_revision_id" text NOT NULL,
	"strategy_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_assertions" (
	"assertion_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"artifact_ref_type" text NOT NULL,
	"artifact_ref_id" text NOT NULL,
	"modality" text NOT NULL,
	"explicitness" text NOT NULL,
	"interpretation" text NOT NULL,
	"materiality" text NOT NULL,
	"source_elements" text NOT NULL,
	"wording_strength" text NOT NULL,
	"conditions" text NOT NULL,
	"audience_interpretation_context" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_candidates" (
	"candidate_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"task_revision_id" text NOT NULL,
	"strategy_id" text NOT NULL,
	"architecture_id" text NOT NULL,
	"content_payload" text NOT NULL,
	"run_config_id" text NOT NULL,
	"parent_candidate_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_units" (
	"unit_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"position" integer NOT NULL,
	"purpose" text NOT NULL,
	"audience_state_before" text NOT NULL,
	"audience_question" text NOT NULL,
	"information_to_deliver" text NOT NULL,
	"copy_goal" text NOT NULL,
	"visual_goal" text NOT NULL,
	"audio_goal" text NOT NULL,
	"payoff" text NOT NULL,
	"transition" text NOT NULL,
	"audience_state_after" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qualitative_evaluations" (
	"evaluation_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"candidate_id" text NOT NULL,
	"eval_contract_revision_id" text NOT NULL,
	"dimension_results" text NOT NULL,
	"hard_gate_results" text NOT NULL,
	"overall_state" text,
	"evaluator_revision_ref_entity_type" text NOT NULL,
	"evaluator_revision_ref_stable_id" text NOT NULL,
	"evaluator_revision_ref_revision_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rights_checks" (
	"rights_check_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"subject_entity_type" text NOT NULL,
	"subject_entity_id" text NOT NULL,
	"rights_policy_id" text NOT NULL,
	"intended_use" text NOT NULL,
	"status" text NOT NULL,
	"required_attributions" text NOT NULL,
	"reason_codes" text NOT NULL,
	"target_use_time" text NOT NULL,
	"knowledge_cutoff_time" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_rights_check_status" CHECK ("rights_checks"."status" IN ('ALLOWED', 'ALLOWED_WITH_REQUIREMENTS', 'REVIEW_REQUIRED', 'BLOCKED'))
);
--> statement-breakpoint
CREATE TABLE "rights_policies" (
	"rights_policy_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"copyright_status" text NOT NULL,
	"license" text NOT NULL,
	"analysis_use" boolean NOT NULL,
	"generation_use" boolean NOT NULL,
	"quotation_use" boolean NOT NULL,
	"transformation_permission" boolean NOT NULL,
	"redistribution_permission" boolean NOT NULL,
	"commercial_use_permission" boolean NOT NULL,
	"attribution_requirements" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"scheduled_expiration" timestamp with time zone,
	"supersedes_rights_policy_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_rights_policy_expiration" CHECK ("rights_policies"."scheduled_expiration" IS NULL OR "rights_policies"."scheduled_expiration" > "rights_policies"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "risk_assessments" (
	"risk_assessment_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"subject_entity_type" text NOT NULL,
	"subject_entity_id" text NOT NULL,
	"harm_type" text NOT NULL,
	"severity" text NOT NULL,
	"likelihood" text NOT NULL,
	"exposure" text NOT NULL,
	"reversibility" text NOT NULL,
	"regulatory_materiality" text NOT NULL,
	"business_impact" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_hypotheses" (
	"strategy_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"task_revision_id" text NOT NULL,
	"audience_state_id" text NOT NULL,
	"core_message" text NOT NULL,
	"behavioral_objective" text NOT NULL,
	"persuasion_mechanism" text NOT NULL,
	"proof_strategy" text NOT NULL,
	"assumptions" text NOT NULL,
	"unknowns" text NOT NULL,
	"failure_modes" text NOT NULL,
	"risk_hypotheses" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uncertainty_assessments" (
	"uncertainty_assessment_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"dimensions" text NOT NULL,
	"assessment_method" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baseline_knowledge_snapshots" (
	"baseline_snapshot_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"as_of" timestamp with time zone NOT NULL,
	"knowledge_manifest_id" text NOT NULL,
	"program_revision_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_records" (
	"decision_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"decision_type" text NOT NULL,
	"task_revision_id" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"reason_codes" text NOT NULL,
	"selected_action" text NOT NULL,
	"selected_candidate_id" text,
	"release_status" text NOT NULL,
	"human_review_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_decision_record_release_status" CHECK ("decision_records"."release_status" IN ('READY', 'READY_WITH_WARNINGS', 'HUMAN_REVIEW_REQUIRED', 'BLOCKED'))
);
--> statement-breakpoint
CREATE TABLE "decision_snapshots" (
	"snapshot_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"baseline_knowledge_snapshot_id" text NOT NULL,
	"run_knowledge_delta_id" text NOT NULL,
	"governance_snapshot_id" text NOT NULL,
	"run_config_id" text NOT NULL,
	"task_revision_id" text NOT NULL,
	"audience_state_id" text NOT NULL,
	"uncertainty_assessment_id" text,
	"frozen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "final_content_packages" (
	"package_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"task_revision_id" text NOT NULL,
	"decision_id" text NOT NULL,
	"decision_snapshot_id" text NOT NULL,
	"selected_candidate_id" text NOT NULL,
	"strategy_id" text NOT NULL,
	"architecture_id" text NOT NULL,
	"audience_state_id" text NOT NULL,
	"warnings" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_snapshots" (
	"governance_snapshot_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"as_of" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "human_review_records" (
	"review_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"task_revision_id" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"review_mode" text NOT NULL,
	"reviewer_role" text NOT NULL,
	"qualification" text NOT NULL,
	"review_scope" text NOT NULL,
	"review_decision" text NOT NULL,
	"reason_codes" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_human_review_mode" CHECK ("human_review_records"."review_mode" IN ('ADJUDICATION_ONLY', 'NEW_INFORMATION_INTRODUCED'))
);
--> statement-breakpoint
CREATE TABLE "knowledge_manifests" (
	"knowledge_manifest_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_conflict_resolutions" (
	"resolution_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"snapshot_id" text NOT NULL,
	"conflict_key" text NOT NULL,
	"resolution_type" text NOT NULL,
	"override_id" text,
	"reason_codes" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_policy_conflict_resolution_type" CHECK ("policy_conflict_resolutions"."resolution_type" IN ('HARD_DENY_OVERRIDES', 'HARD_REQUIREMENT_OVERRIDES', 'MORE_SPECIFIC_SCOPE', 'EXPLICIT_PRIORITY', 'AUTHORIZED_OVERRIDE', 'ESCALATE'))
);
--> statement-breakpoint
CREATE TABLE "policy_overrides" (
	"override_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"snapshot_id" text NOT NULL,
	"authorized_by" text NOT NULL,
	"authority_basis" text NOT NULL,
	"reason_codes" text NOT NULL,
	"scope" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_results" (
	"policy_result_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"snapshot_id" text NOT NULL,
	"policy_revision_id" text NOT NULL,
	"triggered" boolean NOT NULL,
	"action" text NOT NULL,
	"reason_code" text NOT NULL,
	"input_uncertainty" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_knowledge_deltas" (
	"delta_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"run_correlation_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_proposals" (
	"proposal_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"proposal_type" text NOT NULL,
	"target_entity_type" text,
	"target_stable_id" text,
	"target_revision_id" text,
	"proposed_change" text NOT NULL,
	"uncertainty" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_artifacts" (
	"execution_artifact_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"candidate_id" text NOT NULL,
	"actual_content" text NOT NULL,
	"content_hash" text NOT NULL,
	"production_changes" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurement_states" (
	"measurement_state_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"supersedes_measurement_state_id" text,
	"data_maturity" text NOT NULL,
	"is_final" boolean NOT NULL,
	"late_event_window" text NOT NULL,
	"missingness" text NOT NULL,
	"known_incidents" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_observations" (
	"observation_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"publication_state" text NOT NULL,
	"metric_revision_id" text NOT NULL,
	"value" text NOT NULL,
	"measurement_window_start" timestamp with time zone NOT NULL,
	"measurement_window_end" timestamp with time zone NOT NULL,
	"population_or_denominator" text NOT NULL,
	"measurement_state_id" text NOT NULL,
	"source_reference" text NOT NULL,
	"supersedes_observation_id" text,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_perf_observation_pub_state" CHECK ("performance_observations"."publication_state" IN ('SINGLE_ARTIFACT', 'MIXED_PUBLICATION_STATE', 'UNRESOLVED_PUBLICATION_STATE')),
	CONSTRAINT "ck_perf_observation_window" CHECK ("performance_observations"."measurement_window_end" > "performance_observations"."measurement_window_start")
);
--> statement-breakpoint
CREATE TABLE "publication_lineages" (
	"publication_lineage_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"channel" text NOT NULL,
	"destination" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_artifacts" (
	"published_artifact_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"publication_lineage_id" text NOT NULL,
	"origin" text NOT NULL,
	"execution_artifact_id" text,
	"source_candidate_id" text,
	"actual_content" text NOT NULL,
	"published_hash" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"supersedes_published_artifact_id" text,
	"platform_metadata" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_published_artifact_origin" CHECK ("published_artifacts"."origin" IN ('CONTENTOS_EXECUTION', 'MANUAL_EXTERNAL'))
);
--> statement-breakpoint
CREATE TABLE "replayability_statuses" (
	"decision_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"status" text NOT NULL,
	"reason_codes" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_replayability_status_value" CHECK ("replayability_statuses"."status" IN ('FULL', 'PARTIAL_REDACTED', 'UNAVAILABLE_DUE_TO_RETENTION', 'INVALIDATED_BY_DELETION'))
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"audit_event_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"event_type" text NOT NULL,
	"principal_ref" text NOT NULL,
	"resource_ref" text,
	"run_id" text,
	"snapshot_id" text,
	"decision_id" text,
	"reason_codes" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_cycle_bindings" (
	"decision_cycle_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"decision_snapshot_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_cycles" (
	"decision_cycle_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"run_id" text NOT NULL,
	"cycle_number" integer NOT NULL,
	"parent_cycle_id" text,
	"reason" text NOT NULL,
	"status" text NOT NULL,
	"fencing_epoch" integer DEFAULT 0 NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"freeze_started_at" timestamp with time zone,
	"frozen_at" timestamp with time zone,
	"superseded_by_cycle_id" text
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"run_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"run_correlation_key" text NOT NULL,
	"task_revision_id" text NOT NULL,
	"initialization_cutoff" timestamp with time zone NOT NULL,
	"initial_run_config_id" text NOT NULL,
	"initial_baseline_snapshot_id" text NOT NULL,
	"status" text NOT NULL,
	"current_decision_cycle_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_execution_output_refs" (
	"stage_execution_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"ref_kind" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"stable_id" text,
	"revision_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stage_execution_output_refs_stage_execution_id_ordinal_pk" PRIMARY KEY("stage_execution_id","ordinal")
);
--> statement-breakpoint
CREATE TABLE "stage_executions" (
	"stage_execution_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"idempotency_key" text NOT NULL,
	"run_id" text NOT NULL,
	"decision_cycle_id" text NOT NULL,
	"stage_name" text NOT NULL,
	"status" text NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"fencing_token" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"canonical_input_hash" text NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assertion_validation_links" (
	"result_id" text NOT NULL,
	"link_id" text NOT NULL,
	CONSTRAINT "assertion_validation_links_result_id_link_id_pk" PRIMARY KEY("result_id","link_id")
);
--> statement-breakpoint
CREATE TABLE "baseline_channel_profiles" (
	"baseline_snapshot_id" text NOT NULL,
	"channel_profile_revision_id" text NOT NULL,
	CONSTRAINT "baseline_channel_profiles_baseline_snapshot_id_channel_profile_revision_id_pk" PRIMARY KEY("baseline_snapshot_id","channel_profile_revision_id")
);
--> statement-breakpoint
CREATE TABLE "channel_profile_guidance_revisions" (
	"channel_profile_revision_id" text NOT NULL,
	"guidance_revision_id" text NOT NULL,
	CONSTRAINT "pk_channel_profile_guidance_revisions" PRIMARY KEY("channel_profile_revision_id","guidance_revision_id")
);
--> statement-breakpoint
CREATE TABLE "channel_profile_metric_revisions" (
	"channel_profile_revision_id" text NOT NULL,
	"metric_revision_id" text NOT NULL,
	CONSTRAINT "channel_profile_metric_revisions_channel_profile_revision_id_metric_revision_id_pk" PRIMARY KEY("channel_profile_revision_id","metric_revision_id")
);
--> statement-breakpoint
CREATE TABLE "channel_profile_rule_revisions" (
	"channel_profile_revision_id" text NOT NULL,
	"rule_revision_id" text NOT NULL,
	CONSTRAINT "channel_profile_rule_revisions_channel_profile_revision_id_rule_revision_id_pk" PRIMARY KEY("channel_profile_revision_id","rule_revision_id")
);
--> statement-breakpoint
CREATE TABLE "composite_implied_assertions" (
	"assessment_id" text NOT NULL,
	"assertion_id" text NOT NULL,
	CONSTRAINT "composite_implied_assertions_assessment_id_assertion_id_pk" PRIMARY KEY("assessment_id","assertion_id")
);
--> statement-breakpoint
CREATE TABLE "composite_input_assertions" (
	"assessment_id" text NOT NULL,
	"assertion_id" text NOT NULL,
	CONSTRAINT "composite_input_assertions_assessment_id_assertion_id_pk" PRIMARY KEY("assessment_id","assertion_id")
);
--> statement-breakpoint
CREATE TABLE "content_architecture_units" (
	"architecture_id" text NOT NULL,
	"unit_id" text NOT NULL,
	CONSTRAINT "content_architecture_units_architecture_id_unit_id_pk" PRIMARY KEY("architecture_id","unit_id")
);
--> statement-breakpoint
CREATE TABLE "content_program_guardrail_metrics" (
	"program_revision_id" text NOT NULL,
	"metric_revision_id" text NOT NULL,
	CONSTRAINT "content_program_guardrail_metrics_program_revision_id_metric_revision_id_pk" PRIMARY KEY("program_revision_id","metric_revision_id")
);
--> statement-breakpoint
CREATE TABLE "content_program_success_metrics" (
	"program_revision_id" text NOT NULL,
	"metric_revision_id" text NOT NULL,
	CONSTRAINT "content_program_success_metrics_program_revision_id_metric_revision_id_pk" PRIMARY KEY("program_revision_id","metric_revision_id")
);
--> statement-breakpoint
CREATE TABLE "content_unit_propositions" (
	"unit_id" text NOT NULL,
	"proposition_id" text NOT NULL,
	CONSTRAINT "content_unit_propositions_unit_id_proposition_id_pk" PRIMARY KEY("unit_id","proposition_id")
);
--> statement-breakpoint
CREATE TABLE "decision_conflict_resolutions" (
	"decision_id" text NOT NULL,
	"resolution_id" text NOT NULL,
	CONSTRAINT "decision_conflict_resolutions_decision_id_resolution_id_pk" PRIMARY KEY("decision_id","resolution_id")
);
--> statement-breakpoint
CREATE TABLE "decision_policy_results" (
	"decision_id" text NOT NULL,
	"policy_result_id" text NOT NULL,
	CONSTRAINT "decision_policy_results_decision_id_policy_result_id_pk" PRIMARY KEY("decision_id","policy_result_id")
);
--> statement-breakpoint
CREATE TABLE "decision_snapshot_applicability_assessments" (
	"snapshot_id" text NOT NULL,
	"assessment_id" text NOT NULL,
	CONSTRAINT "decision_snapshot_applicability_assessments_snapshot_id_assessment_id_pk" PRIMARY KEY("snapshot_id","assessment_id")
);
--> statement-breakpoint
CREATE TABLE "decision_snapshot_architectures" (
	"snapshot_id" text NOT NULL,
	"architecture_id" text NOT NULL,
	CONSTRAINT "decision_snapshot_architectures_snapshot_id_architecture_id_pk" PRIMARY KEY("snapshot_id","architecture_id")
);
--> statement-breakpoint
CREATE TABLE "decision_snapshot_assertion_validation_results" (
	"snapshot_id" text NOT NULL,
	"result_id" text NOT NULL,
	CONSTRAINT "decision_snapshot_assertion_validation_results_snapshot_id_result_id_pk" PRIMARY KEY("snapshot_id","result_id")
);
--> statement-breakpoint
CREATE TABLE "decision_snapshot_assertions" (
	"snapshot_id" text NOT NULL,
	"assertion_id" text NOT NULL,
	CONSTRAINT "decision_snapshot_assertions_snapshot_id_assertion_id_pk" PRIMARY KEY("snapshot_id","assertion_id")
);
--> statement-breakpoint
CREATE TABLE "decision_snapshot_candidates" (
	"snapshot_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	CONSTRAINT "decision_snapshot_candidates_snapshot_id_candidate_id_pk" PRIMARY KEY("snapshot_id","candidate_id")
);
--> statement-breakpoint
CREATE TABLE "decision_snapshot_composite_assessments" (
	"snapshot_id" text NOT NULL,
	"assessment_id" text NOT NULL,
	CONSTRAINT "decision_snapshot_composite_assessments_snapshot_id_assessment_id_pk" PRIMARY KEY("snapshot_id","assessment_id")
);
--> statement-breakpoint
CREATE TABLE "decision_snapshot_knowledge_gaps" (
	"snapshot_id" text NOT NULL,
	"gap_id" text NOT NULL,
	CONSTRAINT "decision_snapshot_knowledge_gaps_snapshot_id_gap_id_pk" PRIMARY KEY("snapshot_id","gap_id")
);
--> statement-breakpoint
CREATE TABLE "decision_snapshot_qualitative_evaluations" (
	"snapshot_id" text NOT NULL,
	"evaluation_id" text NOT NULL,
	CONSTRAINT "decision_snapshot_qualitative_evaluations_snapshot_id_evaluation_id_pk" PRIMARY KEY("snapshot_id","evaluation_id")
);
--> statement-breakpoint
CREATE TABLE "decision_snapshot_research_traces" (
	"snapshot_id" text NOT NULL,
	"research_trace_id" text NOT NULL,
	CONSTRAINT "decision_snapshot_research_traces_snapshot_id_research_trace_id_pk" PRIMARY KEY("snapshot_id","research_trace_id")
);
--> statement-breakpoint
CREATE TABLE "decision_snapshot_rights_checks" (
	"snapshot_id" text NOT NULL,
	"rights_check_id" text NOT NULL,
	CONSTRAINT "decision_snapshot_rights_checks_snapshot_id_rights_check_id_pk" PRIMARY KEY("snapshot_id","rights_check_id")
);
--> statement-breakpoint
CREATE TABLE "decision_snapshot_risk_assessments" (
	"snapshot_id" text NOT NULL,
	"risk_assessment_id" text NOT NULL,
	CONSTRAINT "decision_snapshot_risk_assessments_snapshot_id_risk_assessment_id_pk" PRIMARY KEY("snapshot_id","risk_assessment_id")
);
--> statement-breakpoint
CREATE TABLE "decision_snapshot_strategies" (
	"snapshot_id" text NOT NULL,
	"strategy_id" text NOT NULL,
	CONSTRAINT "decision_snapshot_strategies_snapshot_id_strategy_id_pk" PRIMARY KEY("snapshot_id","strategy_id")
);
--> statement-breakpoint
CREATE TABLE "epistemic_state_assessments" (
	"epistemic_state_id" text NOT NULL,
	"assessment_id" text NOT NULL,
	CONSTRAINT "epistemic_state_assessments_epistemic_state_id_assessment_id_pk" PRIMARY KEY("epistemic_state_id","assessment_id")
);
--> statement-breakpoint
CREATE TABLE "governance_snapshot_attributions" (
	"governance_snapshot_id" text NOT NULL,
	"attribution_model_revision_id" text NOT NULL,
	CONSTRAINT "governance_snapshot_attributions_governance_snapshot_id_attribution_model_revision_id_pk" PRIMARY KEY("governance_snapshot_id","attribution_model_revision_id")
);
--> statement-breakpoint
CREATE TABLE "governance_snapshot_guidance" (
	"governance_snapshot_id" text NOT NULL,
	"guidance_revision_id" text NOT NULL,
	CONSTRAINT "governance_snapshot_guidance_governance_snapshot_id_guidance_revision_id_pk" PRIMARY KEY("governance_snapshot_id","guidance_revision_id")
);
--> statement-breakpoint
CREATE TABLE "governance_snapshot_metrics" (
	"governance_snapshot_id" text NOT NULL,
	"metric_revision_id" text NOT NULL,
	CONSTRAINT "governance_snapshot_metrics_governance_snapshot_id_metric_revision_id_pk" PRIMARY KEY("governance_snapshot_id","metric_revision_id")
);
--> statement-breakpoint
CREATE TABLE "governance_snapshot_policies" (
	"governance_snapshot_id" text NOT NULL,
	"policy_revision_id" text NOT NULL,
	CONSTRAINT "governance_snapshot_policies_governance_snapshot_id_policy_revision_id_pk" PRIMARY KEY("governance_snapshot_id","policy_revision_id")
);
--> statement-breakpoint
CREATE TABLE "governance_snapshot_rights" (
	"governance_snapshot_id" text NOT NULL,
	"rights_policy_id" text NOT NULL,
	CONSTRAINT "governance_snapshot_rights_governance_snapshot_id_rights_policy_id_pk" PRIMARY KEY("governance_snapshot_id","rights_policy_id")
);
--> statement-breakpoint
CREATE TABLE "governance_snapshot_rules" (
	"governance_snapshot_id" text NOT NULL,
	"rule_revision_id" text NOT NULL,
	CONSTRAINT "governance_snapshot_rules_governance_snapshot_id_rule_revision_id_pk" PRIMARY KEY("governance_snapshot_id","rule_revision_id")
);
--> statement-breakpoint
CREATE TABLE "guidance_supporting_propositions" (
	"guidance_revision_id" text NOT NULL,
	"proposition_id" text NOT NULL,
	CONSTRAINT "guidance_supporting_propositions_guidance_revision_id_proposition_id_pk" PRIMARY KEY("guidance_revision_id","proposition_id")
);
--> statement-breakpoint
CREATE TABLE "human_review_policy_results" (
	"review_id" text NOT NULL,
	"policy_result_id" text NOT NULL,
	CONSTRAINT "human_review_policy_results_review_id_policy_result_id_pk" PRIMARY KEY("review_id","policy_result_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_manifest_epistemic_states" (
	"knowledge_manifest_id" text NOT NULL,
	"epistemic_state_id" text NOT NULL,
	CONSTRAINT "knowledge_manifest_epistemic_states_knowledge_manifest_id_epistemic_state_id_pk" PRIMARY KEY("knowledge_manifest_id","epistemic_state_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_manifest_evidence" (
	"knowledge_manifest_id" text NOT NULL,
	"evidence_id" text NOT NULL,
	CONSTRAINT "knowledge_manifest_evidence_knowledge_manifest_id_evidence_id_pk" PRIMARY KEY("knowledge_manifest_id","evidence_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_manifest_propositions" (
	"knowledge_manifest_id" text NOT NULL,
	"proposition_id" text NOT NULL,
	CONSTRAINT "knowledge_manifest_propositions_knowledge_manifest_id_proposition_id_pk" PRIMARY KEY("knowledge_manifest_id","proposition_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_manifest_sources" (
	"knowledge_manifest_id" text NOT NULL,
	"source_id" text NOT NULL,
	CONSTRAINT "knowledge_manifest_sources_knowledge_manifest_id_source_id_pk" PRIMARY KEY("knowledge_manifest_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "normative_rule_sources" (
	"rule_revision_id" text NOT NULL,
	"source_id" text NOT NULL,
	CONSTRAINT "normative_rule_sources_rule_revision_id_source_id_pk" PRIMARY KEY("rule_revision_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "outcome_edge_propositions" (
	"edge_id" text NOT NULL,
	"proposition_id" text NOT NULL,
	CONSTRAINT "outcome_edge_propositions_edge_id_proposition_id_pk" PRIMARY KEY("edge_id","proposition_id")
);
--> statement-breakpoint
CREATE TABLE "outcome_model_content_metrics" (
	"outcome_model_id" text NOT NULL,
	"metric_revision_id" text NOT NULL,
	CONSTRAINT "outcome_model_content_metrics_outcome_model_id_metric_revision_id_pk" PRIMARY KEY("outcome_model_id","metric_revision_id")
);
--> statement-breakpoint
CREATE TABLE "outcome_model_diagnostic_metrics" (
	"outcome_model_id" text NOT NULL,
	"metric_revision_id" text NOT NULL,
	CONSTRAINT "outcome_model_diagnostic_metrics_outcome_model_id_metric_revision_id_pk" PRIMARY KEY("outcome_model_id","metric_revision_id")
);
--> statement-breakpoint
CREATE TABLE "outcome_model_edges" (
	"outcome_model_id" text NOT NULL,
	"edge_id" text NOT NULL,
	CONSTRAINT "outcome_model_edges_outcome_model_id_edge_id_pk" PRIMARY KEY("outcome_model_id","edge_id")
);
--> statement-breakpoint
CREATE TABLE "outcome_model_guardrail_metrics" (
	"outcome_model_id" text NOT NULL,
	"metric_revision_id" text NOT NULL,
	CONSTRAINT "outcome_model_guardrail_metrics_outcome_model_id_metric_revision_id_pk" PRIMARY KEY("outcome_model_id","metric_revision_id")
);
--> statement-breakpoint
CREATE TABLE "outcome_model_metrics" (
	"outcome_model_id" text NOT NULL,
	"metric_revision_id" text NOT NULL,
	"metric_role" text NOT NULL,
	CONSTRAINT "outcome_model_metrics_outcome_model_id_metric_revision_id_pk" PRIMARY KEY("outcome_model_id","metric_revision_id")
);
--> statement-breakpoint
CREATE TABLE "package_alternative_candidates" (
	"package_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	CONSTRAINT "package_alternative_candidates_package_id_candidate_id_pk" PRIMARY KEY("package_id","candidate_id")
);
--> statement-breakpoint
CREATE TABLE "package_assertions" (
	"package_id" text NOT NULL,
	"assertion_id" text NOT NULL,
	CONSTRAINT "package_assertions_package_id_assertion_id_pk" PRIMARY KEY("package_id","assertion_id")
);
--> statement-breakpoint
CREATE TABLE "package_propositions" (
	"package_id" text NOT NULL,
	"proposition_id" text NOT NULL,
	CONSTRAINT "package_propositions_package_id_proposition_id_pk" PRIMARY KEY("package_id","proposition_id")
);
--> statement-breakpoint
CREATE TABLE "package_rights" (
	"package_id" text NOT NULL,
	"rights_check_id" text NOT NULL,
	CONSTRAINT "package_rights_package_id_rights_check_id_pk" PRIMARY KEY("package_id","rights_check_id")
);
--> statement-breakpoint
CREATE TABLE "package_risks" (
	"package_id" text NOT NULL,
	"risk_assessment_id" text NOT NULL,
	CONSTRAINT "package_risks_package_id_risk_assessment_id_pk" PRIMARY KEY("package_id","risk_assessment_id")
);
--> statement-breakpoint
CREATE TABLE "performance_observation_artifacts" (
	"observation_id" text NOT NULL,
	"published_artifact_id" text NOT NULL,
	CONSTRAINT "performance_observation_artifacts_observation_id_published_artifact_id_pk" PRIMARY KEY("observation_id","published_artifact_id")
);
--> statement-breakpoint
CREATE TABLE "policy_conflict_results" (
	"resolution_id" text NOT NULL,
	"policy_result_id" text NOT NULL,
	CONSTRAINT "policy_conflict_results_resolution_id_policy_result_id_pk" PRIMARY KEY("resolution_id","policy_result_id")
);
--> statement-breakpoint
CREATE TABLE "policy_override_results" (
	"override_id" text NOT NULL,
	"policy_result_id" text NOT NULL,
	CONSTRAINT "policy_override_results_override_id_policy_result_id_pk" PRIMARY KEY("override_id","policy_result_id")
);
--> statement-breakpoint
CREATE TABLE "replayability_missing_refs" (
	"decision_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"ref_kind" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"stable_id" text,
	"revision_id" text,
	CONSTRAINT "replayability_missing_refs_decision_id_ordinal_pk" PRIMARY KEY("decision_id","ordinal")
);
--> statement-breakpoint
CREATE TABLE "research_trace_evidence" (
	"research_trace_id" text NOT NULL,
	"evidence_id" text NOT NULL,
	CONSTRAINT "research_trace_evidence_research_trace_id_evidence_id_pk" PRIMARY KEY("research_trace_id","evidence_id")
);
--> statement-breakpoint
CREATE TABLE "run_config_evaluator_revisions" (
	"run_config_id" text NOT NULL,
	"revision_id" text NOT NULL,
	CONSTRAINT "run_config_evaluator_revisions_run_config_id_revision_id_pk" PRIMARY KEY("run_config_id","revision_id")
);
--> statement-breakpoint
CREATE TABLE "run_config_model_revisions" (
	"run_config_id" text NOT NULL,
	"revision_id" text NOT NULL,
	CONSTRAINT "run_config_model_revisions_run_config_id_revision_id_pk" PRIMARY KEY("run_config_id","revision_id")
);
--> statement-breakpoint
CREATE TABLE "run_config_prompt_revisions" (
	"run_config_id" text NOT NULL,
	"revision_id" text NOT NULL,
	CONSTRAINT "run_config_prompt_revisions_run_config_id_revision_id_pk" PRIMARY KEY("run_config_id","revision_id")
);
--> statement-breakpoint
CREATE TABLE "run_config_retriever_revisions" (
	"run_config_id" text NOT NULL,
	"revision_id" text NOT NULL,
	CONSTRAINT "run_config_retriever_revisions_run_config_id_revision_id_pk" PRIMARY KEY("run_config_id","revision_id")
);
--> statement-breakpoint
CREATE TABLE "run_config_schema_revisions" (
	"run_config_id" text NOT NULL,
	"revision_id" text NOT NULL,
	CONSTRAINT "run_config_schema_revisions_run_config_id_revision_id_pk" PRIMARY KEY("run_config_id","revision_id")
);
--> statement-breakpoint
CREATE TABLE "run_config_tool_revisions" (
	"run_config_id" text NOT NULL,
	"revision_id" text NOT NULL,
	CONSTRAINT "run_config_tool_revisions_run_config_id_revision_id_pk" PRIMARY KEY("run_config_id","revision_id")
);
--> statement-breakpoint
CREATE TABLE "run_delta_epistemic_states" (
	"delta_id" text NOT NULL,
	"epistemic_state_id" text NOT NULL,
	CONSTRAINT "run_delta_epistemic_states_delta_id_epistemic_state_id_pk" PRIMARY KEY("delta_id","epistemic_state_id")
);
--> statement-breakpoint
CREATE TABLE "run_delta_evidence" (
	"delta_id" text NOT NULL,
	"evidence_id" text NOT NULL,
	CONSTRAINT "run_delta_evidence_delta_id_evidence_id_pk" PRIMARY KEY("delta_id","evidence_id")
);
--> statement-breakpoint
CREATE TABLE "run_delta_evidence_assessments" (
	"delta_id" text NOT NULL,
	"assessment_id" text NOT NULL,
	CONSTRAINT "run_delta_evidence_assessments_delta_id_assessment_id_pk" PRIMARY KEY("delta_id","assessment_id")
);
--> statement-breakpoint
CREATE TABLE "run_delta_evidence_proposition_links" (
	"delta_id" text NOT NULL,
	"link_id" text NOT NULL,
	CONSTRAINT "run_delta_evidence_proposition_links_delta_id_link_id_pk" PRIMARY KEY("delta_id","link_id")
);
--> statement-breakpoint
CREATE TABLE "run_delta_knowledge_gaps" (
	"delta_id" text NOT NULL,
	"gap_id" text NOT NULL,
	CONSTRAINT "run_delta_knowledge_gaps_delta_id_gap_id_pk" PRIMARY KEY("delta_id","gap_id")
);
--> statement-breakpoint
CREATE TABLE "run_delta_propositions" (
	"delta_id" text NOT NULL,
	"proposition_id" text NOT NULL,
	CONSTRAINT "run_delta_propositions_delta_id_proposition_id_pk" PRIMARY KEY("delta_id","proposition_id")
);
--> statement-breakpoint
CREATE TABLE "run_delta_research_traces" (
	"delta_id" text NOT NULL,
	"research_trace_id" text NOT NULL,
	CONSTRAINT "run_delta_research_traces_delta_id_research_trace_id_pk" PRIMARY KEY("delta_id","research_trace_id")
);
--> statement-breakpoint
CREATE TABLE "run_delta_sources" (
	"delta_id" text NOT NULL,
	"source_id" text NOT NULL,
	CONSTRAINT "run_delta_sources_delta_id_source_id_pk" PRIMARY KEY("delta_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "strategy_required_propositions" (
	"strategy_id" text NOT NULL,
	"proposition_id" text NOT NULL,
	CONSTRAINT "strategy_required_propositions_strategy_id_proposition_id_pk" PRIMARY KEY("strategy_id","proposition_id")
);
--> statement-breakpoint
CREATE TABLE "task_guardrail_metrics" (
	"task_revision_id" text NOT NULL,
	"metric_revision_id" text NOT NULL,
	CONSTRAINT "task_guardrail_metrics_task_revision_id_metric_revision_id_pk" PRIMARY KEY("task_revision_id","metric_revision_id")
);
--> statement-breakpoint
CREATE TABLE "task_secondary_metrics" (
	"task_revision_id" text NOT NULL,
	"metric_revision_id" text NOT NULL,
	CONSTRAINT "task_secondary_metrics_task_revision_id_metric_revision_id_pk" PRIMARY KEY("task_revision_id","metric_revision_id")
);
--> statement-breakpoint
CREATE TABLE "deleted_revision_tombstones" (
	"entity_type" text NOT NULL,
	"stable_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"deletion_reason_code" text NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_retained" boolean DEFAULT false NOT NULL,
	CONSTRAINT "deleted_revision_tombstones_entity_type_revision_id_pk" PRIMARY KEY("entity_type","revision_id")
);
--> statement-breakpoint
CREATE TABLE "deleted_target_tombstones" (
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"deletion_reason_code" text NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_retained" boolean DEFAULT false NOT NULL,
	CONSTRAINT "deleted_target_tombstones_entity_type_entity_id_pk" PRIMARY KEY("entity_type","entity_id"),
	CONSTRAINT "ck_tombstone_payload_false" CHECK ("payload_retained" = false)
);
--> statement-breakpoint
ALTER TABLE "object_references" ADD CONSTRAINT "object_references_tenant_id_object_id_object_registry_tenant_id_object_id_fk" FOREIGN KEY ("tenant_id","object_id") REFERENCES "public"."object_registry"("tenant_id","object_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_references" ADD CONSTRAINT "object_references_tenant_id_owner_entity_type_owner_entity_id_immutable_entity_registry_tenant_id_entity_type_entity_id_fk" FOREIGN KEY ("tenant_id","owner_entity_type","owner_entity_id") REFERENCES "public"."immutable_entity_registry"("tenant_id","entity_type","entity_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_plane_activations" ADD CONSTRAINT "control_plane_activations_component_type_stable_id_active_revision_id_revision_registry_entity_type_stable_id_revision_id_fk" FOREIGN KEY ("component_type","stable_id","active_revision_id") REFERENCES "public"."revision_registry"("entity_type","stable_id","revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registered_control_plane_revision_payloads" ADD CONSTRAINT "registered_control_plane_revision_payloads_tenant_id_entity_type_stable_id_revision_id_revision_registry_tenant_id_entity_type_stable_id_revision_id_fk" FOREIGN KEY ("tenant_id","entity_type","stable_id","revision_id") REFERENCES "public"."revision_registry"("tenant_id","entity_type","stable_id","revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registered_control_plane_revision_payloads" ADD CONSTRAINT "registered_control_plane_revision_payloads_tenant_id_object_id_object_registry_tenant_id_object_id_fk" FOREIGN KEY ("tenant_id","object_id") REFERENCES "public"."object_registry"("tenant_id","object_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_contract_revisions" ADD CONSTRAINT "task_contract_revisions_program_revision_id_content_program_revisions_program_revision_id_fk" FOREIGN KEY ("program_revision_id") REFERENCES "public"."content_program_revisions"("program_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_contract_revisions" ADD CONSTRAINT "task_contract_revisions_success_metric_revision_id_metric_definition_revisions_metric_revision_id_fk" FOREIGN KEY ("success_metric_revision_id") REFERENCES "public"."metric_definition_revisions"("metric_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epistemic_state_versions" ADD CONSTRAINT "epistemic_state_versions_proposition_id_propositions_proposition_id_fk" FOREIGN KEY ("proposition_id") REFERENCES "public"."propositions"("proposition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_assessments" ADD CONSTRAINT "evidence_assessments_link_id_evidence_proposition_links_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."evidence_proposition_links"("link_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_proposition_links" ADD CONSTRAINT "evidence_proposition_links_evidence_id_evidence_items_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_items"("evidence_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_proposition_links" ADD CONSTRAINT "evidence_proposition_links_proposition_id_propositions_proposition_id_fk" FOREIGN KEY ("proposition_id") REFERENCES "public"."propositions"("proposition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD CONSTRAINT "knowledge_gaps_task_revision_id_task_contract_revisions_task_revision_id_fk" FOREIGN KEY ("task_revision_id") REFERENCES "public"."task_contract_revisions"("task_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_traces" ADD CONSTRAINT "research_traces_gap_id_knowledge_gaps_gap_id_fk" FOREIGN KEY ("gap_id") REFERENCES "public"."knowledge_gaps"("gap_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_artifacts" ADD CONSTRAINT "source_artifacts_snapshot_reference_object_registry_object_id_fk" FOREIGN KEY ("snapshot_reference") REFERENCES "public"."object_registry"("object_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_artifacts" ADD CONSTRAINT "source_artifacts_rights_policy_id_rights_policies_rights_policy_id_fk" FOREIGN KEY ("rights_policy_id") REFERENCES "public"."rights_policies"("rights_policy_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicability_assessments" ADD CONSTRAINT "applicability_assessments_task_revision_id_task_contract_revisions_task_revision_id_fk" FOREIGN KEY ("task_revision_id") REFERENCES "public"."task_contract_revisions"("task_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertion_proposition_links" ADD CONSTRAINT "assertion_proposition_links_assertion_id_content_assertions_assertion_id_fk" FOREIGN KEY ("assertion_id") REFERENCES "public"."content_assertions"("assertion_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertion_proposition_links" ADD CONSTRAINT "assertion_proposition_links_proposition_id_propositions_proposition_id_fk" FOREIGN KEY ("proposition_id") REFERENCES "public"."propositions"("proposition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertion_validation_results" ADD CONSTRAINT "assertion_validation_results_assertion_id_content_assertions_assertion_id_fk" FOREIGN KEY ("assertion_id") REFERENCES "public"."content_assertions"("assertion_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_states" ADD CONSTRAINT "audience_states_task_revision_id_task_contract_revisions_task_revision_id_fk" FOREIGN KEY ("task_revision_id") REFERENCES "public"."task_contract_revisions"("task_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composite_impression_assessments" ADD CONSTRAINT "composite_impression_assessments_candidate_id_content_candidates_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."content_candidates"("candidate_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_architectures" ADD CONSTRAINT "content_architectures_task_revision_id_task_contract_revisions_task_revision_id_fk" FOREIGN KEY ("task_revision_id") REFERENCES "public"."task_contract_revisions"("task_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_architectures" ADD CONSTRAINT "content_architectures_strategy_id_strategy_hypotheses_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategy_hypotheses"("strategy_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_candidates" ADD CONSTRAINT "content_candidates_task_revision_id_task_contract_revisions_task_revision_id_fk" FOREIGN KEY ("task_revision_id") REFERENCES "public"."task_contract_revisions"("task_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_candidates" ADD CONSTRAINT "content_candidates_strategy_id_strategy_hypotheses_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategy_hypotheses"("strategy_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_candidates" ADD CONSTRAINT "content_candidates_architecture_id_content_architectures_architecture_id_fk" FOREIGN KEY ("architecture_id") REFERENCES "public"."content_architectures"("architecture_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_candidates" ADD CONSTRAINT "content_candidates_run_config_id_run_configs_run_config_id_fk" FOREIGN KEY ("run_config_id") REFERENCES "public"."run_configs"("run_config_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualitative_evaluations" ADD CONSTRAINT "qualitative_evaluations_candidate_id_content_candidates_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."content_candidates"("candidate_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualitative_evaluations" ADD CONSTRAINT "qualitative_evaluations_eval_contract_revision_id_eval_contract_revisions_eval_contract_revision_id_fk" FOREIGN KEY ("eval_contract_revision_id") REFERENCES "public"."eval_contract_revisions"("eval_contract_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rights_checks" ADD CONSTRAINT "rights_checks_rights_policy_id_rights_policies_rights_policy_id_fk" FOREIGN KEY ("rights_policy_id") REFERENCES "public"."rights_policies"("rights_policy_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_hypotheses" ADD CONSTRAINT "strategy_hypotheses_task_revision_id_task_contract_revisions_task_revision_id_fk" FOREIGN KEY ("task_revision_id") REFERENCES "public"."task_contract_revisions"("task_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_hypotheses" ADD CONSTRAINT "strategy_hypotheses_audience_state_id_audience_states_audience_state_id_fk" FOREIGN KEY ("audience_state_id") REFERENCES "public"."audience_states"("audience_state_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseline_knowledge_snapshots" ADD CONSTRAINT "baseline_knowledge_snapshots_knowledge_manifest_id_knowledge_manifests_knowledge_manifest_id_fk" FOREIGN KEY ("knowledge_manifest_id") REFERENCES "public"."knowledge_manifests"("knowledge_manifest_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseline_knowledge_snapshots" ADD CONSTRAINT "baseline_knowledge_snapshots_program_revision_id_content_program_revisions_program_revision_id_fk" FOREIGN KEY ("program_revision_id") REFERENCES "public"."content_program_revisions"("program_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_task_revision_id_task_contract_revisions_task_revision_id_fk" FOREIGN KEY ("task_revision_id") REFERENCES "public"."task_contract_revisions"("task_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_selected_candidate_id_content_candidates_candidate_id_fk" FOREIGN KEY ("selected_candidate_id") REFERENCES "public"."content_candidates"("candidate_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_human_review_id_human_review_records_review_id_fk" FOREIGN KEY ("human_review_id") REFERENCES "public"."human_review_records"("review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshots" ADD CONSTRAINT "decision_snapshots_baseline_knowledge_snapshot_id_baseline_knowledge_snapshots_baseline_snapshot_id_fk" FOREIGN KEY ("baseline_knowledge_snapshot_id") REFERENCES "public"."baseline_knowledge_snapshots"("baseline_snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshots" ADD CONSTRAINT "decision_snapshots_run_knowledge_delta_id_run_knowledge_deltas_delta_id_fk" FOREIGN KEY ("run_knowledge_delta_id") REFERENCES "public"."run_knowledge_deltas"("delta_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshots" ADD CONSTRAINT "decision_snapshots_governance_snapshot_id_governance_snapshots_governance_snapshot_id_fk" FOREIGN KEY ("governance_snapshot_id") REFERENCES "public"."governance_snapshots"("governance_snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshots" ADD CONSTRAINT "decision_snapshots_run_config_id_run_configs_run_config_id_fk" FOREIGN KEY ("run_config_id") REFERENCES "public"."run_configs"("run_config_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshots" ADD CONSTRAINT "decision_snapshots_task_revision_id_task_contract_revisions_task_revision_id_fk" FOREIGN KEY ("task_revision_id") REFERENCES "public"."task_contract_revisions"("task_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshots" ADD CONSTRAINT "decision_snapshots_audience_state_id_audience_states_audience_state_id_fk" FOREIGN KEY ("audience_state_id") REFERENCES "public"."audience_states"("audience_state_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshots" ADD CONSTRAINT "decision_snapshots_uncertainty_assessment_id_uncertainty_assessments_uncertainty_assessment_id_fk" FOREIGN KEY ("uncertainty_assessment_id") REFERENCES "public"."uncertainty_assessments"("uncertainty_assessment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_content_packages" ADD CONSTRAINT "final_content_packages_task_revision_id_task_contract_revisions_task_revision_id_fk" FOREIGN KEY ("task_revision_id") REFERENCES "public"."task_contract_revisions"("task_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_content_packages" ADD CONSTRAINT "final_content_packages_decision_id_decision_records_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decision_records"("decision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_content_packages" ADD CONSTRAINT "final_content_packages_decision_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("decision_snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_content_packages" ADD CONSTRAINT "final_content_packages_selected_candidate_id_content_candidates_candidate_id_fk" FOREIGN KEY ("selected_candidate_id") REFERENCES "public"."content_candidates"("candidate_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_content_packages" ADD CONSTRAINT "final_content_packages_strategy_id_strategy_hypotheses_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategy_hypotheses"("strategy_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_content_packages" ADD CONSTRAINT "final_content_packages_architecture_id_content_architectures_architecture_id_fk" FOREIGN KEY ("architecture_id") REFERENCES "public"."content_architectures"("architecture_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_content_packages" ADD CONSTRAINT "final_content_packages_audience_state_id_audience_states_audience_state_id_fk" FOREIGN KEY ("audience_state_id") REFERENCES "public"."audience_states"("audience_state_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_review_records" ADD CONSTRAINT "human_review_records_task_revision_id_task_contract_revisions_task_revision_id_fk" FOREIGN KEY ("task_revision_id") REFERENCES "public"."task_contract_revisions"("task_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_review_records" ADD CONSTRAINT "human_review_records_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_conflict_resolutions" ADD CONSTRAINT "policy_conflict_resolutions_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_conflict_resolutions" ADD CONSTRAINT "policy_conflict_resolutions_override_id_policy_overrides_override_id_fk" FOREIGN KEY ("override_id") REFERENCES "public"."policy_overrides"("override_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_overrides" ADD CONSTRAINT "policy_overrides_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_results" ADD CONSTRAINT "policy_results_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_results" ADD CONSTRAINT "policy_results_policy_revision_id_decision_policy_revisions_policy_revision_id_fk" FOREIGN KEY ("policy_revision_id") REFERENCES "public"."decision_policy_revisions"("policy_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_artifacts" ADD CONSTRAINT "execution_artifacts_candidate_id_content_candidates_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."content_candidates"("candidate_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_observations" ADD CONSTRAINT "performance_observations_metric_revision_id_metric_definition_revisions_metric_revision_id_fk" FOREIGN KEY ("metric_revision_id") REFERENCES "public"."metric_definition_revisions"("metric_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_observations" ADD CONSTRAINT "performance_observations_measurement_state_id_measurement_states_measurement_state_id_fk" FOREIGN KEY ("measurement_state_id") REFERENCES "public"."measurement_states"("measurement_state_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_artifacts" ADD CONSTRAINT "published_artifacts_publication_lineage_id_publication_lineages_publication_lineage_id_fk" FOREIGN KEY ("publication_lineage_id") REFERENCES "public"."publication_lineages"("publication_lineage_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_artifacts" ADD CONSTRAINT "published_artifacts_execution_artifact_id_execution_artifacts_execution_artifact_id_fk" FOREIGN KEY ("execution_artifact_id") REFERENCES "public"."execution_artifacts"("execution_artifact_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_artifacts" ADD CONSTRAINT "published_artifacts_source_candidate_id_content_candidates_candidate_id_fk" FOREIGN KEY ("source_candidate_id") REFERENCES "public"."content_candidates"("candidate_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replayability_statuses" ADD CONSTRAINT "replayability_statuses_decision_id_decision_records_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decision_records"("decision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_cycle_bindings" ADD CONSTRAINT "decision_cycle_bindings_decision_cycle_id_decision_cycles_decision_cycle_id_fk" FOREIGN KEY ("decision_cycle_id") REFERENCES "public"."decision_cycles"("decision_cycle_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_cycle_bindings" ADD CONSTRAINT "decision_cycle_bindings_decision_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("decision_snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_cycles" ADD CONSTRAINT "decision_cycles_run_id_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("run_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_task_revision_id_task_contract_revisions_task_revision_id_fk" FOREIGN KEY ("task_revision_id") REFERENCES "public"."task_contract_revisions"("task_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_initial_run_config_id_run_configs_run_config_id_fk" FOREIGN KEY ("initial_run_config_id") REFERENCES "public"."run_configs"("run_config_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_initial_baseline_snapshot_id_baseline_knowledge_snapshots_baseline_snapshot_id_fk" FOREIGN KEY ("initial_baseline_snapshot_id") REFERENCES "public"."baseline_knowledge_snapshots"("baseline_snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_execution_output_refs" ADD CONSTRAINT "stage_execution_output_refs_stage_execution_id_stage_executions_stage_execution_id_fk" FOREIGN KEY ("stage_execution_id") REFERENCES "public"."stage_executions"("stage_execution_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_executions" ADD CONSTRAINT "stage_executions_run_id_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("run_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_executions" ADD CONSTRAINT "stage_executions_decision_cycle_id_decision_cycles_decision_cycle_id_fk" FOREIGN KEY ("decision_cycle_id") REFERENCES "public"."decision_cycles"("decision_cycle_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertion_validation_links" ADD CONSTRAINT "assertion_validation_links_result_id_assertion_validation_results_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."assertion_validation_results"("result_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertion_validation_links" ADD CONSTRAINT "assertion_validation_links_link_id_assertion_proposition_links_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."assertion_proposition_links"("link_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseline_channel_profiles" ADD CONSTRAINT "baseline_channel_profiles_baseline_snapshot_id_baseline_knowledge_snapshots_baseline_snapshot_id_fk" FOREIGN KEY ("baseline_snapshot_id") REFERENCES "public"."baseline_knowledge_snapshots"("baseline_snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseline_channel_profiles" ADD CONSTRAINT "baseline_channel_profiles_channel_profile_revision_id_channel_profile_revisions_channel_profile_revision_id_fk" FOREIGN KEY ("channel_profile_revision_id") REFERENCES "public"."channel_profile_revisions"("channel_profile_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_profile_guidance_revisions" ADD CONSTRAINT "channel_profile_guidance_revisions_channel_profile_revision_id_channel_profile_revisions_channel_profile_revision_id_fk" FOREIGN KEY ("channel_profile_revision_id") REFERENCES "public"."channel_profile_revisions"("channel_profile_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_profile_guidance_revisions" ADD CONSTRAINT "channel_profile_guidance_revisions_guidance_revision_id_guidance_revisions_guidance_revision_id_fk" FOREIGN KEY ("guidance_revision_id") REFERENCES "public"."guidance_revisions"("guidance_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_profile_metric_revisions" ADD CONSTRAINT "channel_profile_metric_revisions_channel_profile_revision_id_channel_profile_revisions_channel_profile_revision_id_fk" FOREIGN KEY ("channel_profile_revision_id") REFERENCES "public"."channel_profile_revisions"("channel_profile_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_profile_metric_revisions" ADD CONSTRAINT "channel_profile_metric_revisions_metric_revision_id_metric_definition_revisions_metric_revision_id_fk" FOREIGN KEY ("metric_revision_id") REFERENCES "public"."metric_definition_revisions"("metric_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_profile_rule_revisions" ADD CONSTRAINT "channel_profile_rule_revisions_channel_profile_revision_id_channel_profile_revisions_channel_profile_revision_id_fk" FOREIGN KEY ("channel_profile_revision_id") REFERENCES "public"."channel_profile_revisions"("channel_profile_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_profile_rule_revisions" ADD CONSTRAINT "channel_profile_rule_revisions_rule_revision_id_normative_rule_revisions_rule_revision_id_fk" FOREIGN KEY ("rule_revision_id") REFERENCES "public"."normative_rule_revisions"("rule_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composite_implied_assertions" ADD CONSTRAINT "composite_implied_assertions_assessment_id_composite_impression_assessments_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."composite_impression_assessments"("assessment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composite_implied_assertions" ADD CONSTRAINT "composite_implied_assertions_assertion_id_content_assertions_assertion_id_fk" FOREIGN KEY ("assertion_id") REFERENCES "public"."content_assertions"("assertion_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composite_input_assertions" ADD CONSTRAINT "composite_input_assertions_assessment_id_composite_impression_assessments_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."composite_impression_assessments"("assessment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composite_input_assertions" ADD CONSTRAINT "composite_input_assertions_assertion_id_content_assertions_assertion_id_fk" FOREIGN KEY ("assertion_id") REFERENCES "public"."content_assertions"("assertion_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_architecture_units" ADD CONSTRAINT "content_architecture_units_architecture_id_content_architectures_architecture_id_fk" FOREIGN KEY ("architecture_id") REFERENCES "public"."content_architectures"("architecture_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_architecture_units" ADD CONSTRAINT "content_architecture_units_unit_id_content_units_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."content_units"("unit_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_program_guardrail_metrics" ADD CONSTRAINT "content_program_guardrail_metrics_program_revision_id_content_program_revisions_program_revision_id_fk" FOREIGN KEY ("program_revision_id") REFERENCES "public"."content_program_revisions"("program_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_program_guardrail_metrics" ADD CONSTRAINT "content_program_guardrail_metrics_metric_revision_id_metric_definition_revisions_metric_revision_id_fk" FOREIGN KEY ("metric_revision_id") REFERENCES "public"."metric_definition_revisions"("metric_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_program_success_metrics" ADD CONSTRAINT "content_program_success_metrics_program_revision_id_content_program_revisions_program_revision_id_fk" FOREIGN KEY ("program_revision_id") REFERENCES "public"."content_program_revisions"("program_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_program_success_metrics" ADD CONSTRAINT "content_program_success_metrics_metric_revision_id_metric_definition_revisions_metric_revision_id_fk" FOREIGN KEY ("metric_revision_id") REFERENCES "public"."metric_definition_revisions"("metric_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_unit_propositions" ADD CONSTRAINT "content_unit_propositions_unit_id_content_units_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."content_units"("unit_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_unit_propositions" ADD CONSTRAINT "content_unit_propositions_proposition_id_propositions_proposition_id_fk" FOREIGN KEY ("proposition_id") REFERENCES "public"."propositions"("proposition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_conflict_resolutions" ADD CONSTRAINT "decision_conflict_resolutions_decision_id_decision_records_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decision_records"("decision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_conflict_resolutions" ADD CONSTRAINT "decision_conflict_resolutions_resolution_id_policy_conflict_resolutions_resolution_id_fk" FOREIGN KEY ("resolution_id") REFERENCES "public"."policy_conflict_resolutions"("resolution_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_policy_results" ADD CONSTRAINT "decision_policy_results_decision_id_decision_records_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decision_records"("decision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_policy_results" ADD CONSTRAINT "decision_policy_results_policy_result_id_policy_results_policy_result_id_fk" FOREIGN KEY ("policy_result_id") REFERENCES "public"."policy_results"("policy_result_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_applicability_assessments" ADD CONSTRAINT "decision_snapshot_applicability_assessments_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_applicability_assessments" ADD CONSTRAINT "decision_snapshot_applicability_assessments_assessment_id_applicability_assessments_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."applicability_assessments"("assessment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_architectures" ADD CONSTRAINT "decision_snapshot_architectures_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_architectures" ADD CONSTRAINT "decision_snapshot_architectures_architecture_id_content_architectures_architecture_id_fk" FOREIGN KEY ("architecture_id") REFERENCES "public"."content_architectures"("architecture_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_assertion_validation_results" ADD CONSTRAINT "decision_snapshot_assertion_validation_results_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_assertion_validation_results" ADD CONSTRAINT "decision_snapshot_assertion_validation_results_result_id_assertion_validation_results_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."assertion_validation_results"("result_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_assertions" ADD CONSTRAINT "decision_snapshot_assertions_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_assertions" ADD CONSTRAINT "decision_snapshot_assertions_assertion_id_content_assertions_assertion_id_fk" FOREIGN KEY ("assertion_id") REFERENCES "public"."content_assertions"("assertion_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_candidates" ADD CONSTRAINT "decision_snapshot_candidates_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_candidates" ADD CONSTRAINT "decision_snapshot_candidates_candidate_id_content_candidates_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."content_candidates"("candidate_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_composite_assessments" ADD CONSTRAINT "decision_snapshot_composite_assessments_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_composite_assessments" ADD CONSTRAINT "decision_snapshot_composite_assessments_assessment_id_composite_impression_assessments_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."composite_impression_assessments"("assessment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_knowledge_gaps" ADD CONSTRAINT "decision_snapshot_knowledge_gaps_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_knowledge_gaps" ADD CONSTRAINT "decision_snapshot_knowledge_gaps_gap_id_knowledge_gaps_gap_id_fk" FOREIGN KEY ("gap_id") REFERENCES "public"."knowledge_gaps"("gap_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_qualitative_evaluations" ADD CONSTRAINT "decision_snapshot_qualitative_evaluations_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_qualitative_evaluations" ADD CONSTRAINT "decision_snapshot_qualitative_evaluations_evaluation_id_qualitative_evaluations_evaluation_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."qualitative_evaluations"("evaluation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_research_traces" ADD CONSTRAINT "decision_snapshot_research_traces_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_research_traces" ADD CONSTRAINT "decision_snapshot_research_traces_research_trace_id_research_traces_research_trace_id_fk" FOREIGN KEY ("research_trace_id") REFERENCES "public"."research_traces"("research_trace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_rights_checks" ADD CONSTRAINT "decision_snapshot_rights_checks_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_rights_checks" ADD CONSTRAINT "decision_snapshot_rights_checks_rights_check_id_rights_checks_rights_check_id_fk" FOREIGN KEY ("rights_check_id") REFERENCES "public"."rights_checks"("rights_check_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_risk_assessments" ADD CONSTRAINT "decision_snapshot_risk_assessments_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_risk_assessments" ADD CONSTRAINT "decision_snapshot_risk_assessments_risk_assessment_id_risk_assessments_risk_assessment_id_fk" FOREIGN KEY ("risk_assessment_id") REFERENCES "public"."risk_assessments"("risk_assessment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_strategies" ADD CONSTRAINT "decision_snapshot_strategies_snapshot_id_decision_snapshots_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."decision_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshot_strategies" ADD CONSTRAINT "decision_snapshot_strategies_strategy_id_strategy_hypotheses_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategy_hypotheses"("strategy_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epistemic_state_assessments" ADD CONSTRAINT "epistemic_state_assessments_epistemic_state_id_epistemic_state_versions_epistemic_state_id_fk" FOREIGN KEY ("epistemic_state_id") REFERENCES "public"."epistemic_state_versions"("epistemic_state_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epistemic_state_assessments" ADD CONSTRAINT "epistemic_state_assessments_assessment_id_evidence_assessments_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."evidence_assessments"("assessment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_snapshot_attributions" ADD CONSTRAINT "governance_snapshot_attributions_governance_snapshot_id_governance_snapshots_governance_snapshot_id_fk" FOREIGN KEY ("governance_snapshot_id") REFERENCES "public"."governance_snapshots"("governance_snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_snapshot_attributions" ADD CONSTRAINT "governance_snapshot_attributions_attribution_model_revision_id_attribution_model_revisions_attribution_model_revision_id_fk" FOREIGN KEY ("attribution_model_revision_id") REFERENCES "public"."attribution_model_revisions"("attribution_model_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_snapshot_guidance" ADD CONSTRAINT "governance_snapshot_guidance_governance_snapshot_id_governance_snapshots_governance_snapshot_id_fk" FOREIGN KEY ("governance_snapshot_id") REFERENCES "public"."governance_snapshots"("governance_snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_snapshot_guidance" ADD CONSTRAINT "governance_snapshot_guidance_guidance_revision_id_guidance_revisions_guidance_revision_id_fk" FOREIGN KEY ("guidance_revision_id") REFERENCES "public"."guidance_revisions"("guidance_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_snapshot_metrics" ADD CONSTRAINT "governance_snapshot_metrics_governance_snapshot_id_governance_snapshots_governance_snapshot_id_fk" FOREIGN KEY ("governance_snapshot_id") REFERENCES "public"."governance_snapshots"("governance_snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_snapshot_metrics" ADD CONSTRAINT "governance_snapshot_metrics_metric_revision_id_metric_definition_revisions_metric_revision_id_fk" FOREIGN KEY ("metric_revision_id") REFERENCES "public"."metric_definition_revisions"("metric_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_snapshot_policies" ADD CONSTRAINT "governance_snapshot_policies_governance_snapshot_id_governance_snapshots_governance_snapshot_id_fk" FOREIGN KEY ("governance_snapshot_id") REFERENCES "public"."governance_snapshots"("governance_snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_snapshot_policies" ADD CONSTRAINT "governance_snapshot_policies_policy_revision_id_decision_policy_revisions_policy_revision_id_fk" FOREIGN KEY ("policy_revision_id") REFERENCES "public"."decision_policy_revisions"("policy_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_snapshot_rights" ADD CONSTRAINT "governance_snapshot_rights_governance_snapshot_id_governance_snapshots_governance_snapshot_id_fk" FOREIGN KEY ("governance_snapshot_id") REFERENCES "public"."governance_snapshots"("governance_snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_snapshot_rights" ADD CONSTRAINT "governance_snapshot_rights_rights_policy_id_rights_policies_rights_policy_id_fk" FOREIGN KEY ("rights_policy_id") REFERENCES "public"."rights_policies"("rights_policy_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_snapshot_rules" ADD CONSTRAINT "governance_snapshot_rules_governance_snapshot_id_governance_snapshots_governance_snapshot_id_fk" FOREIGN KEY ("governance_snapshot_id") REFERENCES "public"."governance_snapshots"("governance_snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_snapshot_rules" ADD CONSTRAINT "governance_snapshot_rules_rule_revision_id_normative_rule_revisions_rule_revision_id_fk" FOREIGN KEY ("rule_revision_id") REFERENCES "public"."normative_rule_revisions"("rule_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guidance_supporting_propositions" ADD CONSTRAINT "guidance_supporting_propositions_guidance_revision_id_guidance_revisions_guidance_revision_id_fk" FOREIGN KEY ("guidance_revision_id") REFERENCES "public"."guidance_revisions"("guidance_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guidance_supporting_propositions" ADD CONSTRAINT "guidance_supporting_propositions_proposition_id_propositions_proposition_id_fk" FOREIGN KEY ("proposition_id") REFERENCES "public"."propositions"("proposition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_review_policy_results" ADD CONSTRAINT "human_review_policy_results_review_id_human_review_records_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."human_review_records"("review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_review_policy_results" ADD CONSTRAINT "human_review_policy_results_policy_result_id_policy_results_policy_result_id_fk" FOREIGN KEY ("policy_result_id") REFERENCES "public"."policy_results"("policy_result_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_manifest_epistemic_states" ADD CONSTRAINT "knowledge_manifest_epistemic_states_knowledge_manifest_id_knowledge_manifests_knowledge_manifest_id_fk" FOREIGN KEY ("knowledge_manifest_id") REFERENCES "public"."knowledge_manifests"("knowledge_manifest_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_manifest_epistemic_states" ADD CONSTRAINT "knowledge_manifest_epistemic_states_epistemic_state_id_epistemic_state_versions_epistemic_state_id_fk" FOREIGN KEY ("epistemic_state_id") REFERENCES "public"."epistemic_state_versions"("epistemic_state_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_manifest_evidence" ADD CONSTRAINT "knowledge_manifest_evidence_knowledge_manifest_id_knowledge_manifests_knowledge_manifest_id_fk" FOREIGN KEY ("knowledge_manifest_id") REFERENCES "public"."knowledge_manifests"("knowledge_manifest_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_manifest_evidence" ADD CONSTRAINT "knowledge_manifest_evidence_evidence_id_evidence_items_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_items"("evidence_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_manifest_propositions" ADD CONSTRAINT "knowledge_manifest_propositions_knowledge_manifest_id_knowledge_manifests_knowledge_manifest_id_fk" FOREIGN KEY ("knowledge_manifest_id") REFERENCES "public"."knowledge_manifests"("knowledge_manifest_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_manifest_propositions" ADD CONSTRAINT "knowledge_manifest_propositions_proposition_id_propositions_proposition_id_fk" FOREIGN KEY ("proposition_id") REFERENCES "public"."propositions"("proposition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_manifest_sources" ADD CONSTRAINT "knowledge_manifest_sources_knowledge_manifest_id_knowledge_manifests_knowledge_manifest_id_fk" FOREIGN KEY ("knowledge_manifest_id") REFERENCES "public"."knowledge_manifests"("knowledge_manifest_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_manifest_sources" ADD CONSTRAINT "knowledge_manifest_sources_source_id_source_artifacts_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source_artifacts"("source_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normative_rule_sources" ADD CONSTRAINT "normative_rule_sources_rule_revision_id_normative_rule_revisions_rule_revision_id_fk" FOREIGN KEY ("rule_revision_id") REFERENCES "public"."normative_rule_revisions"("rule_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normative_rule_sources" ADD CONSTRAINT "normative_rule_sources_source_id_source_artifacts_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source_artifacts"("source_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_edge_propositions" ADD CONSTRAINT "outcome_edge_propositions_edge_id_outcome_edges_edge_id_fk" FOREIGN KEY ("edge_id") REFERENCES "public"."outcome_edges"("edge_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_edge_propositions" ADD CONSTRAINT "outcome_edge_propositions_proposition_id_propositions_proposition_id_fk" FOREIGN KEY ("proposition_id") REFERENCES "public"."propositions"("proposition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_model_content_metrics" ADD CONSTRAINT "outcome_model_content_metrics_outcome_model_id_outcome_models_outcome_model_id_fk" FOREIGN KEY ("outcome_model_id") REFERENCES "public"."outcome_models"("outcome_model_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_model_content_metrics" ADD CONSTRAINT "outcome_model_content_metrics_metric_revision_id_metric_definition_revisions_metric_revision_id_fk" FOREIGN KEY ("metric_revision_id") REFERENCES "public"."metric_definition_revisions"("metric_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_model_diagnostic_metrics" ADD CONSTRAINT "outcome_model_diagnostic_metrics_outcome_model_id_outcome_models_outcome_model_id_fk" FOREIGN KEY ("outcome_model_id") REFERENCES "public"."outcome_models"("outcome_model_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_model_diagnostic_metrics" ADD CONSTRAINT "outcome_model_diagnostic_metrics_metric_revision_id_metric_definition_revisions_metric_revision_id_fk" FOREIGN KEY ("metric_revision_id") REFERENCES "public"."metric_definition_revisions"("metric_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_model_edges" ADD CONSTRAINT "outcome_model_edges_outcome_model_id_outcome_models_outcome_model_id_fk" FOREIGN KEY ("outcome_model_id") REFERENCES "public"."outcome_models"("outcome_model_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_model_edges" ADD CONSTRAINT "outcome_model_edges_edge_id_outcome_edges_edge_id_fk" FOREIGN KEY ("edge_id") REFERENCES "public"."outcome_edges"("edge_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_model_guardrail_metrics" ADD CONSTRAINT "outcome_model_guardrail_metrics_outcome_model_id_outcome_models_outcome_model_id_fk" FOREIGN KEY ("outcome_model_id") REFERENCES "public"."outcome_models"("outcome_model_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_model_guardrail_metrics" ADD CONSTRAINT "outcome_model_guardrail_metrics_metric_revision_id_metric_definition_revisions_metric_revision_id_fk" FOREIGN KEY ("metric_revision_id") REFERENCES "public"."metric_definition_revisions"("metric_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_model_metrics" ADD CONSTRAINT "outcome_model_metrics_outcome_model_id_outcome_models_outcome_model_id_fk" FOREIGN KEY ("outcome_model_id") REFERENCES "public"."outcome_models"("outcome_model_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_model_metrics" ADD CONSTRAINT "outcome_model_metrics_metric_revision_id_metric_definition_revisions_metric_revision_id_fk" FOREIGN KEY ("metric_revision_id") REFERENCES "public"."metric_definition_revisions"("metric_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_alternative_candidates" ADD CONSTRAINT "package_alternative_candidates_package_id_final_content_packages_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."final_content_packages"("package_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_alternative_candidates" ADD CONSTRAINT "package_alternative_candidates_candidate_id_content_candidates_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."content_candidates"("candidate_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_assertions" ADD CONSTRAINT "package_assertions_package_id_final_content_packages_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."final_content_packages"("package_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_assertions" ADD CONSTRAINT "package_assertions_assertion_id_content_assertions_assertion_id_fk" FOREIGN KEY ("assertion_id") REFERENCES "public"."content_assertions"("assertion_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_propositions" ADD CONSTRAINT "package_propositions_package_id_final_content_packages_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."final_content_packages"("package_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_propositions" ADD CONSTRAINT "package_propositions_proposition_id_propositions_proposition_id_fk" FOREIGN KEY ("proposition_id") REFERENCES "public"."propositions"("proposition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_rights" ADD CONSTRAINT "package_rights_package_id_final_content_packages_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."final_content_packages"("package_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_rights" ADD CONSTRAINT "package_rights_rights_check_id_rights_checks_rights_check_id_fk" FOREIGN KEY ("rights_check_id") REFERENCES "public"."rights_checks"("rights_check_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_risks" ADD CONSTRAINT "package_risks_package_id_final_content_packages_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."final_content_packages"("package_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_risks" ADD CONSTRAINT "package_risks_risk_assessment_id_risk_assessments_risk_assessment_id_fk" FOREIGN KEY ("risk_assessment_id") REFERENCES "public"."risk_assessments"("risk_assessment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_observation_artifacts" ADD CONSTRAINT "performance_observation_artifacts_observation_id_performance_observations_observation_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."performance_observations"("observation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_observation_artifacts" ADD CONSTRAINT "performance_observation_artifacts_published_artifact_id_published_artifacts_published_artifact_id_fk" FOREIGN KEY ("published_artifact_id") REFERENCES "public"."published_artifacts"("published_artifact_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_conflict_results" ADD CONSTRAINT "policy_conflict_results_resolution_id_policy_conflict_resolutions_resolution_id_fk" FOREIGN KEY ("resolution_id") REFERENCES "public"."policy_conflict_resolutions"("resolution_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_conflict_results" ADD CONSTRAINT "policy_conflict_results_policy_result_id_policy_results_policy_result_id_fk" FOREIGN KEY ("policy_result_id") REFERENCES "public"."policy_results"("policy_result_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_override_results" ADD CONSTRAINT "policy_override_results_override_id_policy_overrides_override_id_fk" FOREIGN KEY ("override_id") REFERENCES "public"."policy_overrides"("override_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_override_results" ADD CONSTRAINT "policy_override_results_policy_result_id_policy_results_policy_result_id_fk" FOREIGN KEY ("policy_result_id") REFERENCES "public"."policy_results"("policy_result_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replayability_missing_refs" ADD CONSTRAINT "replayability_missing_refs_decision_id_replayability_statuses_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."replayability_statuses"("decision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_trace_evidence" ADD CONSTRAINT "research_trace_evidence_research_trace_id_research_traces_research_trace_id_fk" FOREIGN KEY ("research_trace_id") REFERENCES "public"."research_traces"("research_trace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_trace_evidence" ADD CONSTRAINT "research_trace_evidence_evidence_id_evidence_items_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_items"("evidence_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_config_evaluator_revisions" ADD CONSTRAINT "run_config_evaluator_revisions_run_config_id_run_configs_run_config_id_fk" FOREIGN KEY ("run_config_id") REFERENCES "public"."run_configs"("run_config_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_config_model_revisions" ADD CONSTRAINT "run_config_model_revisions_run_config_id_run_configs_run_config_id_fk" FOREIGN KEY ("run_config_id") REFERENCES "public"."run_configs"("run_config_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_config_prompt_revisions" ADD CONSTRAINT "run_config_prompt_revisions_run_config_id_run_configs_run_config_id_fk" FOREIGN KEY ("run_config_id") REFERENCES "public"."run_configs"("run_config_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_config_retriever_revisions" ADD CONSTRAINT "run_config_retriever_revisions_run_config_id_run_configs_run_config_id_fk" FOREIGN KEY ("run_config_id") REFERENCES "public"."run_configs"("run_config_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_config_schema_revisions" ADD CONSTRAINT "run_config_schema_revisions_run_config_id_run_configs_run_config_id_fk" FOREIGN KEY ("run_config_id") REFERENCES "public"."run_configs"("run_config_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_config_tool_revisions" ADD CONSTRAINT "run_config_tool_revisions_run_config_id_run_configs_run_config_id_fk" FOREIGN KEY ("run_config_id") REFERENCES "public"."run_configs"("run_config_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_epistemic_states" ADD CONSTRAINT "run_delta_epistemic_states_delta_id_run_knowledge_deltas_delta_id_fk" FOREIGN KEY ("delta_id") REFERENCES "public"."run_knowledge_deltas"("delta_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_epistemic_states" ADD CONSTRAINT "run_delta_epistemic_states_epistemic_state_id_epistemic_state_versions_epistemic_state_id_fk" FOREIGN KEY ("epistemic_state_id") REFERENCES "public"."epistemic_state_versions"("epistemic_state_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_evidence" ADD CONSTRAINT "run_delta_evidence_delta_id_run_knowledge_deltas_delta_id_fk" FOREIGN KEY ("delta_id") REFERENCES "public"."run_knowledge_deltas"("delta_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_evidence" ADD CONSTRAINT "run_delta_evidence_evidence_id_evidence_items_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_items"("evidence_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_evidence_assessments" ADD CONSTRAINT "run_delta_evidence_assessments_delta_id_run_knowledge_deltas_delta_id_fk" FOREIGN KEY ("delta_id") REFERENCES "public"."run_knowledge_deltas"("delta_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_evidence_assessments" ADD CONSTRAINT "run_delta_evidence_assessments_assessment_id_evidence_assessments_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."evidence_assessments"("assessment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_evidence_proposition_links" ADD CONSTRAINT "run_delta_evidence_proposition_links_delta_id_run_knowledge_deltas_delta_id_fk" FOREIGN KEY ("delta_id") REFERENCES "public"."run_knowledge_deltas"("delta_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_evidence_proposition_links" ADD CONSTRAINT "run_delta_evidence_proposition_links_link_id_evidence_proposition_links_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."evidence_proposition_links"("link_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_knowledge_gaps" ADD CONSTRAINT "run_delta_knowledge_gaps_delta_id_run_knowledge_deltas_delta_id_fk" FOREIGN KEY ("delta_id") REFERENCES "public"."run_knowledge_deltas"("delta_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_knowledge_gaps" ADD CONSTRAINT "run_delta_knowledge_gaps_gap_id_knowledge_gaps_gap_id_fk" FOREIGN KEY ("gap_id") REFERENCES "public"."knowledge_gaps"("gap_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_propositions" ADD CONSTRAINT "run_delta_propositions_delta_id_run_knowledge_deltas_delta_id_fk" FOREIGN KEY ("delta_id") REFERENCES "public"."run_knowledge_deltas"("delta_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_propositions" ADD CONSTRAINT "run_delta_propositions_proposition_id_propositions_proposition_id_fk" FOREIGN KEY ("proposition_id") REFERENCES "public"."propositions"("proposition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_research_traces" ADD CONSTRAINT "run_delta_research_traces_delta_id_run_knowledge_deltas_delta_id_fk" FOREIGN KEY ("delta_id") REFERENCES "public"."run_knowledge_deltas"("delta_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_research_traces" ADD CONSTRAINT "run_delta_research_traces_research_trace_id_research_traces_research_trace_id_fk" FOREIGN KEY ("research_trace_id") REFERENCES "public"."research_traces"("research_trace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_sources" ADD CONSTRAINT "run_delta_sources_delta_id_run_knowledge_deltas_delta_id_fk" FOREIGN KEY ("delta_id") REFERENCES "public"."run_knowledge_deltas"("delta_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_delta_sources" ADD CONSTRAINT "run_delta_sources_source_id_source_artifacts_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source_artifacts"("source_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_required_propositions" ADD CONSTRAINT "strategy_required_propositions_strategy_id_strategy_hypotheses_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategy_hypotheses"("strategy_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_required_propositions" ADD CONSTRAINT "strategy_required_propositions_proposition_id_propositions_proposition_id_fk" FOREIGN KEY ("proposition_id") REFERENCES "public"."propositions"("proposition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_guardrail_metrics" ADD CONSTRAINT "task_guardrail_metrics_task_revision_id_task_contract_revisions_task_revision_id_fk" FOREIGN KEY ("task_revision_id") REFERENCES "public"."task_contract_revisions"("task_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_guardrail_metrics" ADD CONSTRAINT "task_guardrail_metrics_metric_revision_id_metric_definition_revisions_metric_revision_id_fk" FOREIGN KEY ("metric_revision_id") REFERENCES "public"."metric_definition_revisions"("metric_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_secondary_metrics" ADD CONSTRAINT "task_secondary_metrics_task_revision_id_task_contract_revisions_task_revision_id_fk" FOREIGN KEY ("task_revision_id") REFERENCES "public"."task_contract_revisions"("task_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_secondary_metrics" ADD CONSTRAINT "task_secondary_metrics_metric_revision_id_metric_definition_revisions_metric_revision_id_fk" FOREIGN KEY ("metric_revision_id") REFERENCES "public"."metric_definition_revisions"("metric_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_obj_ref_source_table_column" ON "canonical_object_reference_sources" USING btree ("source_table","object_id_column");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_object_registry_tenant_hash" ON "object_registry" USING btree ("tenant_id","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_object_registry_tenant_key" ON "object_registry" USING btree ("tenant_id","object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_attrib_rev_stable" ON "attribution_model_revisions" USING btree ("attribution_model_id","attribution_model_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_channel_profile_rev_stable" ON "channel_profile_revisions" USING btree ("channel_profile_id","channel_profile_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_prog_rev_stable" ON "content_program_revisions" USING btree ("program_id","program_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_activation_interval_start" ON "control_plane_activations" USING btree ("deployment_scope","component_type","stable_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_decision_policy_rev_stable" ON "decision_policy_revisions" USING btree ("policy_id","policy_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_eval_contract_rev_stable" ON "eval_contract_revisions" USING btree ("eval_contract_id","eval_contract_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_guidance_rev_stable" ON "guidance_revisions" USING btree ("guidance_id","guidance_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_metric_rev_stable" ON "metric_definition_revisions" USING btree ("metric_id","metric_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rule_rev_stable" ON "normative_rule_revisions" USING btree ("rule_id","rule_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cplane_payload_triple" ON "registered_control_plane_revision_payloads" USING btree ("entity_type","stable_id","revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cplane_rev_triple" ON "registered_control_plane_revisions" USING btree ("entity_type","stable_id","revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_task_rev_stable" ON "task_contract_revisions" USING btree ("task_id","task_revision_id");--> statement-breakpoint
CREATE INDEX "idx_epistemic_state_prop" ON "epistemic_state_versions" USING btree ("proposition_id");--> statement-breakpoint
CREATE INDEX "idx_epistemic_state_tenant" ON "epistemic_state_versions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_epistemic_state_predecessor" ON "epistemic_state_versions" USING btree ("supersedes_epistemic_state_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_assessment_tenant" ON "evidence_assessments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_assessment_link" ON "evidence_assessments" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_assessment_supersedes" ON "evidence_assessments" USING btree ("supersedes_assessment_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_item_tenant" ON "evidence_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_item_origin" ON "evidence_items" USING btree ("origin_type","origin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evidence_proposition_link" ON "evidence_proposition_links" USING btree ("evidence_id","proposition_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_prop_link_prop" ON "evidence_proposition_links" USING btree ("proposition_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_gap_tenant" ON "knowledge_gaps" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_gap_task" ON "knowledge_gaps" USING btree ("task_revision_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_gap_supersedes" ON "knowledge_gaps" USING btree ("supersedes_gap_id");--> statement-breakpoint
CREATE INDEX "idx_proposition_tenant" ON "propositions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_proposition_supersedes" ON "propositions" USING btree ("supersedes_proposition_id");--> statement-breakpoint
CREATE INDEX "idx_research_trace_tenant" ON "research_traces" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_research_trace_gap" ON "research_traces" USING btree ("gap_id");--> statement-breakpoint
CREATE INDEX "idx_source_artifact_tenant" ON "source_artifacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_source_artifact_snapshot_ref" ON "source_artifacts" USING btree ("snapshot_reference");--> statement-breakpoint
CREATE INDEX "idx_applicability_assessment_tenant" ON "applicability_assessments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_applicability_assessment_task" ON "applicability_assessments" USING btree ("task_revision_id");--> statement-breakpoint
CREATE INDEX "idx_assertion_prop_link_tenant" ON "assertion_proposition_links" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_assertion_prop_link_pair" ON "assertion_proposition_links" USING btree ("assertion_id","proposition_id");--> statement-breakpoint
CREATE INDEX "idx_assertion_val_result_tenant" ON "assertion_validation_results" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_assertion_val_result_assertion" ON "assertion_validation_results" USING btree ("assertion_id");--> statement-breakpoint
CREATE INDEX "idx_audience_state_tenant" ON "audience_states" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audience_state_task" ON "audience_states" USING btree ("task_revision_id");--> statement-breakpoint
CREATE INDEX "idx_composite_assessment_tenant" ON "composite_impression_assessments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_composite_assessment_candidate" ON "composite_impression_assessments" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "idx_content_arch_tenant" ON "content_architectures" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_content_arch_task" ON "content_architectures" USING btree ("task_revision_id");--> statement-breakpoint
CREATE INDEX "idx_content_arch_strategy" ON "content_architectures" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "idx_content_assertion_tenant" ON "content_assertions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_content_assertion_artifact" ON "content_assertions" USING btree ("artifact_ref_type","artifact_ref_id");--> statement-breakpoint
CREATE INDEX "idx_content_candidate_tenant" ON "content_candidates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_content_candidate_task" ON "content_candidates" USING btree ("task_revision_id");--> statement-breakpoint
CREATE INDEX "idx_content_candidate_run_cfg" ON "content_candidates" USING btree ("run_config_id");--> statement-breakpoint
CREATE INDEX "idx_content_unit_tenant" ON "content_units" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_qual_eval_tenant" ON "qualitative_evaluations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_qual_eval_candidate" ON "qualitative_evaluations" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "idx_qual_eval_contract" ON "qualitative_evaluations" USING btree ("eval_contract_revision_id");--> statement-breakpoint
CREATE INDEX "idx_rights_check_tenant" ON "rights_checks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_rights_check_subject" ON "rights_checks" USING btree ("subject_entity_type","subject_entity_id");--> statement-breakpoint
CREATE INDEX "idx_rights_check_policy" ON "rights_checks" USING btree ("rights_policy_id");--> statement-breakpoint
CREATE INDEX "idx_rights_policy_tenant" ON "rights_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_risk_assessment_tenant" ON "risk_assessments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_risk_assessment_subject" ON "risk_assessments" USING btree ("subject_entity_type","subject_entity_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_hypothesis_tenant" ON "strategy_hypotheses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_hypothesis_task" ON "strategy_hypotheses" USING btree ("task_revision_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_hypothesis_audience" ON "strategy_hypotheses" USING btree ("audience_state_id");--> statement-breakpoint
CREATE INDEX "idx_uncertainty_assessment_tenant" ON "uncertainty_assessments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_baseline_snapshot_tenant" ON "baseline_knowledge_snapshots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_baseline_snapshot_manifest" ON "baseline_knowledge_snapshots" USING btree ("knowledge_manifest_id");--> statement-breakpoint
CREATE INDEX "idx_decision_record_tenant" ON "decision_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_decision_record_snapshot" ON "decision_records" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_decision_record_task" ON "decision_records" USING btree ("task_revision_id");--> statement-breakpoint
CREATE INDEX "idx_decision_record_candidate" ON "decision_records" USING btree ("selected_candidate_id");--> statement-breakpoint
CREATE INDEX "idx_decision_snapshot_tenant" ON "decision_snapshots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_decision_snapshot_baseline" ON "decision_snapshots" USING btree ("baseline_knowledge_snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_decision_snapshot_delta" ON "decision_snapshots" USING btree ("run_knowledge_delta_id");--> statement-breakpoint
CREATE INDEX "idx_decision_snapshot_gov" ON "decision_snapshots" USING btree ("governance_snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_decision_snapshot_task" ON "decision_snapshots" USING btree ("task_revision_id");--> statement-breakpoint
CREATE INDEX "idx_content_package_tenant" ON "final_content_packages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_content_package_decision" ON "final_content_packages" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "idx_content_package_snapshot" ON "final_content_packages" USING btree ("decision_snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_content_package_candidate" ON "final_content_packages" USING btree ("selected_candidate_id");--> statement-breakpoint
CREATE INDEX "idx_gov_snapshot_tenant" ON "governance_snapshots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_human_review_tenant" ON "human_review_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_human_review_snapshot" ON "human_review_records" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_human_review_task" ON "human_review_records" USING btree ("task_revision_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_manifest_tenant" ON "knowledge_manifests" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_policy_conflict_res_snapshot_key" ON "policy_conflict_resolutions" USING btree ("snapshot_id","conflict_key");--> statement-breakpoint
CREATE INDEX "idx_policy_conflict_tenant" ON "policy_conflict_resolutions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_policy_conflict_snapshot" ON "policy_conflict_resolutions" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_policy_override_tenant" ON "policy_overrides" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_policy_override_snapshot" ON "policy_overrides" USING btree ("snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_policy_result_snapshot_policy" ON "policy_results" USING btree ("snapshot_id","policy_revision_id");--> statement-breakpoint
CREATE INDEX "idx_policy_result_tenant" ON "policy_results" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_policy_result_snapshot" ON "policy_results" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_run_knowledge_delta_tenant" ON "run_knowledge_deltas" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_run_knowledge_delta_key" ON "run_knowledge_deltas" USING btree ("run_correlation_key");--> statement-breakpoint
CREATE INDEX "idx_change_proposal_tenant" ON "change_proposals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_exec_artifact_tenant" ON "execution_artifacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_exec_artifact_candidate" ON "execution_artifacts" USING btree ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_measurement_state_supersedes" ON "measurement_states" USING btree ("supersedes_measurement_state_id");--> statement-breakpoint
CREATE INDEX "idx_measurement_state_tenant" ON "measurement_states" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_perf_observation_supersedes" ON "performance_observations" USING btree ("supersedes_observation_id");--> statement-breakpoint
CREATE INDEX "idx_perf_observation_tenant" ON "performance_observations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_perf_observation_metric" ON "performance_observations" USING btree ("metric_revision_id");--> statement-breakpoint
CREATE INDEX "idx_perf_observation_state" ON "performance_observations" USING btree ("measurement_state_id");--> statement-breakpoint
CREATE INDEX "idx_pub_lineage_tenant" ON "publication_lineages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_pub_lineage_channel_dest" ON "publication_lineages" USING btree ("channel","destination");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_published_artifact_supersedes" ON "published_artifacts" USING btree ("supersedes_published_artifact_id");--> statement-breakpoint
CREATE INDEX "idx_published_artifact_tenant" ON "published_artifacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_published_artifact_lineage" ON "published_artifacts" USING btree ("publication_lineage_id");--> statement-breakpoint
CREATE INDEX "idx_published_artifact_effective" ON "published_artifacts" USING btree ("effective_from");--> statement-breakpoint
CREATE INDEX "idx_replayability_status_tenant" ON "replayability_statuses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_event_tenant" ON "audit_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_event_type" ON "audit_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cycle_binding_snapshot" ON "decision_cycle_bindings" USING btree ("decision_snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_cycle_binding_tenant" ON "decision_cycle_bindings" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cycle_run_number" ON "decision_cycles" USING btree ("run_id","cycle_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cycle_parent" ON "decision_cycles" USING btree ("parent_cycle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cycle_superseded" ON "decision_cycles" USING btree ("superseded_by_cycle_id");--> statement-breakpoint
CREATE INDEX "idx_cycle_tenant" ON "decision_cycles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_cycle_run_status" ON "decision_cycles" USING btree ("run_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_run_correlation_key" ON "runs" USING btree ("run_correlation_key");--> statement-breakpoint
CREATE INDEX "idx_run_tenant" ON "runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_run_status" ON "runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_stage_exec_idempotency_key" ON "stage_executions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_stage_exec_tenant" ON "stage_executions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_stage_exec_run_cycle" ON "stage_executions" USING btree ("run_id","decision_cycle_id");--> statement-breakpoint
CREATE INDEX "idx_deleted_rev_triple" ON "deleted_revision_tombstones" USING btree ("entity_type","stable_id","revision_id");--> statement-breakpoint
CREATE INDEX "idx_deleted_rev_tenant" ON "deleted_revision_tombstones" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_deleted_target_tenant" ON "deleted_target_tombstones" USING btree ("tenant_id");
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'contentos_privileged_deleter') THEN
    CREATE ROLE contentos_privileged_deleter NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'contentos_app_role') THEN
    CREATE ROLE contentos_app_role NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO contentos_app_role, contentos_privileged_deleter;--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO contentos_app_role, contentos_privileged_deleter;--> statement-breakpoint
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO contentos_app_role, contentos_privileged_deleter;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO contentos_app_role, contentos_privileged_deleter;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO contentos_app_role, contentos_privileged_deleter;--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_immutable_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('contentos.privileged_deletion', true) = 'on' THEN
    IF pg_has_role(CURRENT_USER, 'contentos_privileged_deleter', 'MEMBER') THEN
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RAISE EXCEPTION 'PRIVILEGED_ROLE_REQUIRED: Role % is not authorized for privileged deletion', CURRENT_USER
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RAISE EXCEPTION 'MUTATION_FORBIDDEN: Immutable table % cannot be modified by UPDATE or DELETE', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_immutable_immutable_entity_registry
BEFORE UPDATE OR DELETE ON "immutable_entity_registry"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_revision_registry
BEFORE UPDATE OR DELETE ON "revision_registry"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_registered_control_plane_revisions
BEFORE UPDATE OR DELETE ON "registered_control_plane_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_registered_control_plane_revision_payloads
BEFORE UPDATE OR DELETE ON "registered_control_plane_revision_payloads"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_content_program_revisions
BEFORE UPDATE OR DELETE ON "content_program_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_outcome_models
BEFORE UPDATE OR DELETE ON "outcome_models"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_outcome_edges
BEFORE UPDATE OR DELETE ON "outcome_edges"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_attribution_model_revisions
BEFORE UPDATE OR DELETE ON "attribution_model_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_metric_definition_revisions
BEFORE UPDATE OR DELETE ON "metric_definition_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_eval_contract_revisions
BEFORE UPDATE OR DELETE ON "eval_contract_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_channel_profile_revisions
BEFORE UPDATE OR DELETE ON "channel_profile_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_task_contract_revisions
BEFORE UPDATE OR DELETE ON "task_contract_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_configs
BEFORE UPDATE OR DELETE ON "run_configs"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_guidance_revisions
BEFORE UPDATE OR DELETE ON "guidance_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_normative_rule_revisions
BEFORE UPDATE OR DELETE ON "normative_rule_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_policy_revisions
BEFORE UPDATE OR DELETE ON "decision_policy_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_audience_states
BEFORE UPDATE OR DELETE ON "audience_states"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_applicability_assessments
BEFORE UPDATE OR DELETE ON "applicability_assessments"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_strategy_hypotheses
BEFORE UPDATE OR DELETE ON "strategy_hypotheses"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_content_architectures
BEFORE UPDATE OR DELETE ON "content_architectures"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_content_units
BEFORE UPDATE OR DELETE ON "content_units"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_content_candidates
BEFORE UPDATE OR DELETE ON "content_candidates"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_content_assertions
BEFORE UPDATE OR DELETE ON "content_assertions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_assertion_proposition_links
BEFORE UPDATE OR DELETE ON "assertion_proposition_links"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_assertion_validation_results
BEFORE UPDATE OR DELETE ON "assertion_validation_results"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_composite_impression_assessments
BEFORE UPDATE OR DELETE ON "composite_impression_assessments"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_qualitative_evaluations
BEFORE UPDATE OR DELETE ON "qualitative_evaluations"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_risk_assessments
BEFORE UPDATE OR DELETE ON "risk_assessments"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_uncertainty_assessments
BEFORE UPDATE OR DELETE ON "uncertainty_assessments"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_rights_policies
BEFORE UPDATE OR DELETE ON "rights_policies"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_rights_checks
BEFORE UPDATE OR DELETE ON "rights_checks"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_knowledge_manifests
BEFORE UPDATE OR DELETE ON "knowledge_manifests"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_baseline_knowledge_snapshots
BEFORE UPDATE OR DELETE ON "baseline_knowledge_snapshots"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_knowledge_deltas
BEFORE UPDATE OR DELETE ON "run_knowledge_deltas"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_governance_snapshots
BEFORE UPDATE OR DELETE ON "governance_snapshots"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_snapshots
BEFORE UPDATE OR DELETE ON "decision_snapshots"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_policy_results
BEFORE UPDATE OR DELETE ON "policy_results"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_policy_overrides
BEFORE UPDATE OR DELETE ON "policy_overrides"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_policy_conflict_resolutions
BEFORE UPDATE OR DELETE ON "policy_conflict_resolutions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_human_review_records
BEFORE UPDATE OR DELETE ON "human_review_records"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_records
BEFORE UPDATE OR DELETE ON "decision_records"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_final_content_packages
BEFORE UPDATE OR DELETE ON "final_content_packages"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_publication_lineages
BEFORE UPDATE OR DELETE ON "publication_lineages"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_execution_artifacts
BEFORE UPDATE OR DELETE ON "execution_artifacts"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_published_artifacts
BEFORE UPDATE OR DELETE ON "published_artifacts"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_measurement_states
BEFORE UPDATE OR DELETE ON "measurement_states"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_performance_observations
BEFORE UPDATE OR DELETE ON "performance_observations"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_change_proposals
BEFORE UPDATE OR DELETE ON "change_proposals"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_deleted_target_tombstones
BEFORE UPDATE OR DELETE ON "deleted_target_tombstones"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_deleted_revision_tombstones
BEFORE UPDATE OR DELETE ON "deleted_revision_tombstones"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_content_program_success_metrics
BEFORE UPDATE OR DELETE ON "content_program_success_metrics"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_content_program_guardrail_metrics
BEFORE UPDATE OR DELETE ON "content_program_guardrail_metrics"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_outcome_model_metrics
BEFORE UPDATE OR DELETE ON "outcome_model_metrics"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_outcome_model_edges
BEFORE UPDATE OR DELETE ON "outcome_model_edges"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_task_secondary_metrics
BEFORE UPDATE OR DELETE ON "task_secondary_metrics"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_task_guardrail_metrics
BEFORE UPDATE OR DELETE ON "task_guardrail_metrics"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_research_trace_evidence
BEFORE UPDATE OR DELETE ON "research_trace_evidence"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_epistemic_state_assessments
BEFORE UPDATE OR DELETE ON "epistemic_state_assessments"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_strategy_required_propositions
BEFORE UPDATE OR DELETE ON "strategy_required_propositions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_content_architecture_units
BEFORE UPDATE OR DELETE ON "content_architecture_units"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_content_unit_propositions
BEFORE UPDATE OR DELETE ON "content_unit_propositions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_assertion_validation_links
BEFORE UPDATE OR DELETE ON "assertion_validation_links"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_composite_input_assertions
BEFORE UPDATE OR DELETE ON "composite_input_assertions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_composite_implied_assertions
BEFORE UPDATE OR DELETE ON "composite_implied_assertions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_knowledge_manifest_sources
BEFORE UPDATE OR DELETE ON "knowledge_manifest_sources"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_knowledge_manifest_evidence
BEFORE UPDATE OR DELETE ON "knowledge_manifest_evidence"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_knowledge_manifest_propositions
BEFORE UPDATE OR DELETE ON "knowledge_manifest_propositions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_knowledge_manifest_epistemic_states
BEFORE UPDATE OR DELETE ON "knowledge_manifest_epistemic_states"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_delta_sources
BEFORE UPDATE OR DELETE ON "run_delta_sources"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_delta_evidence
BEFORE UPDATE OR DELETE ON "run_delta_evidence"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_delta_propositions
BEFORE UPDATE OR DELETE ON "run_delta_propositions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_delta_evidence_proposition_links
BEFORE UPDATE OR DELETE ON "run_delta_evidence_proposition_links"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_delta_evidence_assessments
BEFORE UPDATE OR DELETE ON "run_delta_evidence_assessments"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_delta_epistemic_states
BEFORE UPDATE OR DELETE ON "run_delta_epistemic_states"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_delta_knowledge_gaps
BEFORE UPDATE OR DELETE ON "run_delta_knowledge_gaps"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_delta_research_traces
BEFORE UPDATE OR DELETE ON "run_delta_research_traces"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_governance_snapshot_guidance
BEFORE UPDATE OR DELETE ON "governance_snapshot_guidance"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_governance_snapshot_rules
BEFORE UPDATE OR DELETE ON "governance_snapshot_rules"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_governance_snapshot_policies
BEFORE UPDATE OR DELETE ON "governance_snapshot_policies"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_governance_snapshot_metrics
BEFORE UPDATE OR DELETE ON "governance_snapshot_metrics"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_governance_snapshot_attributions
BEFORE UPDATE OR DELETE ON "governance_snapshot_attributions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_governance_snapshot_rights
BEFORE UPDATE OR DELETE ON "governance_snapshot_rights"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_snapshot_candidates
BEFORE UPDATE OR DELETE ON "decision_snapshot_candidates"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_snapshot_strategies
BEFORE UPDATE OR DELETE ON "decision_snapshot_strategies"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_snapshot_architectures
BEFORE UPDATE OR DELETE ON "decision_snapshot_architectures"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_snapshot_knowledge_gaps
BEFORE UPDATE OR DELETE ON "decision_snapshot_knowledge_gaps"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_snapshot_research_traces
BEFORE UPDATE OR DELETE ON "decision_snapshot_research_traces"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_snapshot_assertions
BEFORE UPDATE OR DELETE ON "decision_snapshot_assertions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_snapshot_assertion_validation_results
BEFORE UPDATE OR DELETE ON "decision_snapshot_assertion_validation_results"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_snapshot_composite_assessments
BEFORE UPDATE OR DELETE ON "decision_snapshot_composite_assessments"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_snapshot_qualitative_evaluations
BEFORE UPDATE OR DELETE ON "decision_snapshot_qualitative_evaluations"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_snapshot_applicability_assessments
BEFORE UPDATE OR DELETE ON "decision_snapshot_applicability_assessments"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_snapshot_risk_assessments
BEFORE UPDATE OR DELETE ON "decision_snapshot_risk_assessments"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_snapshot_rights_checks
BEFORE UPDATE OR DELETE ON "decision_snapshot_rights_checks"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_policy_override_results
BEFORE UPDATE OR DELETE ON "policy_override_results"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_policy_conflict_results
BEFORE UPDATE OR DELETE ON "policy_conflict_results"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_human_review_policy_results
BEFORE UPDATE OR DELETE ON "human_review_policy_results"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_policy_results
BEFORE UPDATE OR DELETE ON "decision_policy_results"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_decision_conflict_resolutions
BEFORE UPDATE OR DELETE ON "decision_conflict_resolutions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_package_alternative_candidates
BEFORE UPDATE OR DELETE ON "package_alternative_candidates"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_package_assertions
BEFORE UPDATE OR DELETE ON "package_assertions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_package_propositions
BEFORE UPDATE OR DELETE ON "package_propositions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_package_risks
BEFORE UPDATE OR DELETE ON "package_risks"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_package_rights
BEFORE UPDATE OR DELETE ON "package_rights"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_performance_observation_artifacts
BEFORE UPDATE OR DELETE ON "performance_observation_artifacts"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_channel_profile_rule_revisions
BEFORE UPDATE OR DELETE ON "channel_profile_rule_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_channel_profile_guidance_revisions
BEFORE UPDATE OR DELETE ON "channel_profile_guidance_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_channel_profile_metric_revisions
BEFORE UPDATE OR DELETE ON "channel_profile_metric_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_baseline_channel_profiles
BEFORE UPDATE OR DELETE ON "baseline_channel_profiles"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_guidance_supporting_propositions
BEFORE UPDATE OR DELETE ON "guidance_supporting_propositions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_normative_rule_sources
BEFORE UPDATE OR DELETE ON "normative_rule_sources"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_config_prompt_revisions
BEFORE UPDATE OR DELETE ON "run_config_prompt_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_config_model_revisions
BEFORE UPDATE OR DELETE ON "run_config_model_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_config_tool_revisions
BEFORE UPDATE OR DELETE ON "run_config_tool_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_config_schema_revisions
BEFORE UPDATE OR DELETE ON "run_config_schema_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_config_retriever_revisions
BEFORE UPDATE OR DELETE ON "run_config_retriever_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_run_config_evaluator_revisions
BEFORE UPDATE OR DELETE ON "run_config_evaluator_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_outcome_model_content_metrics
BEFORE UPDATE OR DELETE ON "outcome_model_content_metrics"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_outcome_model_diagnostic_metrics
BEFORE UPDATE OR DELETE ON "outcome_model_diagnostic_metrics"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_outcome_model_guardrail_metrics
BEFORE UPDATE OR DELETE ON "outcome_model_guardrail_metrics"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_outcome_edge_propositions
BEFORE UPDATE OR DELETE ON "outcome_edge_propositions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_immutable_replayability_missing_refs
BEFORE UPDATE OR DELETE ON "replayability_missing_refs"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_typed_revision_registry()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type text;
  v_stable_id text;
  v_revision_id text;
  v_reg_count int;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'content_program_revisions' THEN
      v_entity_type := 'ContentProgramRevision';
      v_stable_id := NEW.program_id;
      v_revision_id := NEW.program_revision_id;
    WHEN 'metric_definition_revisions' THEN
      v_entity_type := 'MetricDefinitionRevision';
      v_stable_id := NEW.metric_id;
      v_revision_id := NEW.metric_revision_id;
    WHEN 'task_contract_revisions' THEN
      v_entity_type := 'TaskContractRevision';
      v_stable_id := NEW.task_id;
      v_revision_id := NEW.task_revision_id;
    WHEN 'eval_contract_revisions' THEN
      v_entity_type := 'EvalContractRevision';
      v_stable_id := NEW.eval_contract_id;
      v_revision_id := NEW.eval_contract_revision_id;
    WHEN 'channel_profile_revisions' THEN
      v_entity_type := 'ChannelProfileRevision';
      v_stable_id := NEW.channel_profile_id;
      v_revision_id := NEW.channel_profile_revision_id;
    WHEN 'attribution_model_revisions' THEN
      v_entity_type := 'AttributionModelRevision';
      v_stable_id := NEW.attribution_model_id;
      v_revision_id := NEW.attribution_model_revision_id;
    WHEN 'guidance_revisions' THEN
      v_entity_type := 'GuidanceRevision';
      v_stable_id := NEW.guidance_id;
      v_revision_id := NEW.guidance_revision_id;
    WHEN 'normative_rule_revisions' THEN
      v_entity_type := 'NormativeRuleRevision';
      v_stable_id := NEW.rule_id;
      v_revision_id := NEW.rule_revision_id;
    WHEN 'decision_policy_revisions' THEN
      v_entity_type := 'DecisionPolicyRevision';
      v_stable_id := NEW.policy_id;
      v_revision_id := NEW.policy_revision_id;
    WHEN 'registered_control_plane_revisions' THEN
      v_entity_type := NEW.entity_type;
      v_stable_id := NEW.stable_id;
      v_revision_id := NEW.revision_id;
    ELSE
      RETURN NEW;
  END CASE;

  SELECT count(*) INTO v_reg_count
  FROM revision_registry
  WHERE entity_type = v_entity_type
    AND stable_id = v_stable_id
    AND revision_id = v_revision_id
    AND tenant_id = NEW.tenant_id;

  IF v_reg_count = 0 THEN
    RAISE EXCEPTION 'REGISTRY_IDENTITY_REQUIRED: Cannot insert into % without matching revision_registry entry (entity_type=%, stable_id=%, revision_id=%, tenant_id=%)',
      TG_TABLE_NAME, v_entity_type, v_stable_id, v_revision_id, NEW.tenant_id
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_registry_content_program_revisions
BEFORE INSERT ON "content_program_revisions"
FOR EACH ROW EXECUTE FUNCTION enforce_typed_revision_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_metric_definition_revisions
BEFORE INSERT ON "metric_definition_revisions"
FOR EACH ROW EXECUTE FUNCTION enforce_typed_revision_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_task_contract_revisions
BEFORE INSERT ON "task_contract_revisions"
FOR EACH ROW EXECUTE FUNCTION enforce_typed_revision_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_eval_contract_revisions
BEFORE INSERT ON "eval_contract_revisions"
FOR EACH ROW EXECUTE FUNCTION enforce_typed_revision_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_channel_profile_revisions
BEFORE INSERT ON "channel_profile_revisions"
FOR EACH ROW EXECUTE FUNCTION enforce_typed_revision_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_attribution_model_revisions
BEFORE INSERT ON "attribution_model_revisions"
FOR EACH ROW EXECUTE FUNCTION enforce_typed_revision_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_guidance_revisions
BEFORE INSERT ON "guidance_revisions"
FOR EACH ROW EXECUTE FUNCTION enforce_typed_revision_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_normative_rule_revisions
BEFORE INSERT ON "normative_rule_revisions"
FOR EACH ROW EXECUTE FUNCTION enforce_typed_revision_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_decision_policy_revisions
BEFORE INSERT ON "decision_policy_revisions"
FOR EACH ROW EXECUTE FUNCTION enforce_typed_revision_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_registered_control_plane_revisions
BEFORE INSERT ON "registered_control_plane_revisions"
FOR EACH ROW EXECUTE FUNCTION enforce_typed_revision_registry();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_immutable_entity_registry()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type text;
  v_entity_id text;
  v_reg_count int;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'rights_policies' THEN
      v_entity_type := 'RightsPolicy';
      v_entity_id := NEW.rights_policy_id;
    WHEN 'audience_states' THEN
      v_entity_type := 'AudienceState';
      v_entity_id := NEW.audience_state_id;
    WHEN 'knowledge_manifests' THEN
      v_entity_type := 'KnowledgeManifest';
      v_entity_id := NEW.knowledge_manifest_id;
    WHEN 'baseline_knowledge_snapshots' THEN
      v_entity_type := 'BaselineKnowledgeSnapshot';
      v_entity_id := NEW.baseline_snapshot_id;
    WHEN 'run_knowledge_deltas' THEN
      v_entity_type := 'RunKnowledgeDelta';
      v_entity_id := NEW.delta_id;
    WHEN 'governance_snapshots' THEN
      v_entity_type := 'GovernanceSnapshot';
      v_entity_id := NEW.governance_snapshot_id;
    WHEN 'decision_snapshots' THEN
      v_entity_type := 'DecisionSnapshot';
      v_entity_id := NEW.snapshot_id;
    WHEN 'policy_results' THEN
      v_entity_type := 'PolicyResult';
      v_entity_id := NEW.policy_result_id;
    WHEN 'policy_overrides' THEN
      v_entity_type := 'PolicyOverride';
      v_entity_id := NEW.override_id;
    WHEN 'policy_conflict_resolutions' THEN
      v_entity_type := 'PolicyConflictResolution';
      v_entity_id := NEW.resolution_id;
    WHEN 'human_review_records' THEN
      v_entity_type := 'HumanReviewRecord';
      v_entity_id := NEW.review_id;
    WHEN 'decision_records' THEN
      v_entity_type := 'DecisionRecord';
      v_entity_id := NEW.decision_id;
    WHEN 'final_content_packages' THEN
      v_entity_type := 'FinalContentPackage';
      v_entity_id := NEW.package_id;
    WHEN 'publication_lineages' THEN
      v_entity_type := 'PublicationLineage';
      v_entity_id := NEW.publication_lineage_id;
    WHEN 'execution_artifacts' THEN
      v_entity_type := 'ExecutionArtifact';
      v_entity_id := NEW.execution_artifact_id;
    WHEN 'published_artifacts' THEN
      v_entity_type := 'PublishedArtifact';
      v_entity_id := NEW.published_artifact_id;
    WHEN 'performance_observations' THEN
      v_entity_type := 'PerformanceObservation';
      v_entity_id := NEW.observation_id;
    WHEN 'measurement_states' THEN
      v_entity_type := 'MeasurementState';
      v_entity_id := NEW.measurement_state_id;
    WHEN 'change_proposals' THEN
      v_entity_type := 'ChangeProposal';
      v_entity_id := NEW.proposal_id;
    WHEN 'run_configs' THEN
      v_entity_type := 'RunConfig';
      v_entity_id := NEW.run_config_id;
    WHEN 'source_artifacts' THEN
      v_entity_type := 'SourceArtifact';
      v_entity_id := NEW.source_id;
    WHEN 'evidence_items' THEN
      v_entity_type := 'EvidenceItem';
      v_entity_id := NEW.evidence_id;
    WHEN 'propositions' THEN
      v_entity_type := 'Proposition';
      v_entity_id := NEW.proposition_id;
    WHEN 'evidence_assessments' THEN
      v_entity_type := 'EvidenceAssessment';
      v_entity_id := NEW.assessment_id;
    WHEN 'epistemic_state_versions' THEN
      v_entity_type := 'EpistemicStateVersion';
      v_entity_id := NEW.epistemic_state_id;
    WHEN 'knowledge_gaps' THEN
      v_entity_type := 'KnowledgeGap';
      v_entity_id := NEW.gap_id;
    WHEN 'research_traces' THEN
      v_entity_type := 'ResearchTrace';
      v_entity_id := NEW.research_trace_id;
    WHEN 'content_candidates' THEN
      v_entity_type := 'ContentCandidate';
      v_entity_id := NEW.candidate_id;
    WHEN 'strategy_hypotheses' THEN
      v_entity_type := 'StrategyHypothesis';
      v_entity_id := NEW.strategy_id;
    ELSE
      RETURN NEW;
  END CASE;

  SELECT count(*) INTO v_reg_count
  FROM immutable_entity_registry
  WHERE entity_type = v_entity_type
    AND entity_id = v_entity_id
    AND tenant_id = NEW.tenant_id;

  IF v_reg_count = 0 THEN
    RAISE EXCEPTION 'REGISTRY_IDENTITY_REQUIRED: Cannot insert into % without matching immutable_entity_registry entry (entity_type=%, entity_id=%, tenant_id=%)',
      TG_TABLE_NAME, v_entity_type, v_entity_id, NEW.tenant_id
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_registry_rights_policies
BEFORE INSERT ON "rights_policies"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_audience_states
BEFORE INSERT ON "audience_states"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_knowledge_manifests
BEFORE INSERT ON "knowledge_manifests"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_baseline_knowledge_snapshots
BEFORE INSERT ON "baseline_knowledge_snapshots"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_run_knowledge_deltas
BEFORE INSERT ON "run_knowledge_deltas"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_governance_snapshots
BEFORE INSERT ON "governance_snapshots"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_decision_snapshots
BEFORE INSERT ON "decision_snapshots"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_policy_results
BEFORE INSERT ON "policy_results"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_policy_overrides
BEFORE INSERT ON "policy_overrides"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_policy_conflict_resolutions
BEFORE INSERT ON "policy_conflict_resolutions"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_human_review_records
BEFORE INSERT ON "human_review_records"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_decision_records
BEFORE INSERT ON "decision_records"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_final_content_packages
BEFORE INSERT ON "final_content_packages"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_publication_lineages
BEFORE INSERT ON "publication_lineages"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_execution_artifacts
BEFORE INSERT ON "execution_artifacts"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_published_artifacts
BEFORE INSERT ON "published_artifacts"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_performance_observations
BEFORE INSERT ON "performance_observations"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_measurement_states
BEFORE INSERT ON "measurement_states"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_change_proposals
BEFORE INSERT ON "change_proposals"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_run_configs
BEFORE INSERT ON "run_configs"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_source_artifacts
BEFORE INSERT ON "source_artifacts"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_evidence_items
BEFORE INSERT ON "evidence_items"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_propositions
BEFORE INSERT ON "propositions"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_evidence_assessments
BEFORE INSERT ON "evidence_assessments"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_epistemic_state_versions
BEFORE INSERT ON "epistemic_state_versions"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_knowledge_gaps
BEFORE INSERT ON "knowledge_gaps"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_research_traces
BEFORE INSERT ON "research_traces"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_content_candidates
BEFORE INSERT ON "content_candidates"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE TRIGGER trg_registry_strategy_hypotheses
BEFORE INSERT ON "strategy_hypotheses"
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_entity_registry();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_payload_workspace_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_rev_workspace text;
  v_obj_workspace text;
BEGIN
  SELECT workspace_id INTO v_rev_workspace
  FROM revision_registry
  WHERE entity_type = NEW.entity_type
    AND stable_id = NEW.stable_id
    AND revision_id = NEW.revision_id
    AND tenant_id = NEW.tenant_id;

  SELECT workspace_id INTO v_obj_workspace
  FROM object_registry
  WHERE object_id = NEW.object_id
    AND tenant_id = NEW.tenant_id;

  IF (NEW.workspace_id IS NOT NULL OR v_rev_workspace IS NOT NULL OR v_obj_workspace IS NOT NULL) THEN
    IF COALESCE(NEW.workspace_id, '') <> COALESCE(v_rev_workspace, '') OR
       COALESCE(NEW.workspace_id, '') <> COALESCE(v_obj_workspace, '') THEN
      RAISE EXCEPTION 'CROSS_WORKSPACE_PAYLOAD_MISMATCH: Payload workspace (%), revision workspace (%), and object workspace (%) must match when workspace scope exists',
        NEW.workspace_id, v_rev_workspace, v_obj_workspace
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_payload_workspace_integrity
BEFORE INSERT OR UPDATE ON "registered_control_plane_revision_payloads"
FOR EACH ROW EXECUTE FUNCTION enforce_payload_workspace_integrity();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_object_reference_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_tenant text;
  v_obj_tenant text;
  v_owner_workspace text;
  v_obj_workspace text;
BEGIN
  SELECT tenant_id, workspace_id INTO v_owner_tenant, v_owner_workspace
  FROM immutable_entity_registry
  WHERE entity_type = NEW.owner_entity_type
    AND entity_id = NEW.owner_entity_id;

  SELECT tenant_id, workspace_id INTO v_obj_tenant, v_obj_workspace
  FROM object_registry
  WHERE object_id = NEW.object_id;

  IF v_owner_tenant IS NULL OR v_obj_tenant IS NULL THEN
    RAISE EXCEPTION 'OBJECT_REFERENCE_TARGET_NOT_FOUND: Owner entity or target object not found in registries'
      USING ERRCODE = '23503';
  END IF;

  IF v_owner_tenant <> v_obj_tenant OR NEW.tenant_id <> v_owner_tenant THEN
    RAISE EXCEPTION 'CROSS_TENANT_OBJECT_REFERENCE: Reference tenant (%), owner tenant (%), and object tenant (%) must all match',
      NEW.tenant_id, v_owner_tenant, v_obj_tenant
      USING ERRCODE = '23503';
  END IF;

  IF (NEW.workspace_id IS NOT NULL OR v_owner_workspace IS NOT NULL OR v_obj_workspace IS NOT NULL) THEN
    IF COALESCE(NEW.workspace_id, '') <> COALESCE(v_owner_workspace, '') OR
       COALESCE(NEW.workspace_id, '') <> COALESCE(v_obj_workspace, '') THEN
      RAISE EXCEPTION 'CROSS_WORKSPACE_OBJECT_REFERENCE: Reference workspace (%), owner workspace (%), and object workspace (%) must match when workspace scope exists',
        NEW.workspace_id, v_owner_workspace, v_obj_workspace
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_object_reference_integrity
BEFORE INSERT OR UPDATE ON "object_references"
FOR EACH ROW EXECUTE FUNCTION enforce_object_reference_integrity();
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'contentos_control_plane_user') THEN
    CREATE ROLE contentos_control_plane_user WITH LOGIN PASSWORD 'control_plane_secret';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'contentos_runtime_user') THEN
    CREATE ROLE contentos_runtime_user WITH LOGIN PASSWORD 'runtime_secret';
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO contentos_runtime_user, contentos_control_plane_user;
--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO contentos_control_plane_user;
--> statement-breakpoint
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO contentos_control_plane_user;
--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO contentos_runtime_user;
--> statement-breakpoint
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO contentos_runtime_user;
--> statement-breakpoint
REVOKE INSERT ON control_plane_activations FROM contentos_runtime_user;

