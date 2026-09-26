# ContentOS Blueprint v2.13.1
## Evidence-Grounded Content Operating System
### Contract-Complete Frozen Architecture

---

# 0. Status

```text
VERSION
ContentOS Blueprint v2.13.1

STATUS
FROZEN
```

v2.13.1 patches v2.13 without changing its functional architecture.

v2.13.1 introduces no new content-intelligence layer.

The following major architectures are unchanged:

```text
Knowledge architecture

Evidence architecture

Epistemic architecture

Audience architecture

Strategy architecture

Creative architecture

Assertion architecture

Validation architecture

Rights architecture

Measurement architecture

Learning architecture
```

v2.13.1 exists only to close:

```text
POLICY CONFLICT / OVERRIDE CONSISTENCY

SNAPSHOT REFERENTIAL CLOSURE

PUBLICATION LINEAGE OWNERSHIP

TEMPORAL CHAIN INTEGRITY

FINAL CONTENT PACKAGE CLOSURE
```

---

# 1. Product Definition

ContentOS connects:

```text
BUSINESS OBJECTIVE
↓
CONTENT PROGRAM
↓
TASK CONTRACT
↓
KNOWLEDGE
↓
AUDIENCE STATE
↓
STRATEGY
↓
CREATIVE
↓
VALIDATION
↓
GOVERNANCE
↓
DECISION
↓
PUBLICATION
↓
MEASUREMENT
↓
LEARNING
↓
FUTURE DECISIONS
↺
```

ContentOS does not guarantee winning content.

It attempts to make:

> The most defensible content decision possible under the evidence, knowledge, governance, rights, risk and uncertainty available at the decision boundary.

---

# 2. Fundamental Separations

```text
PROPOSITION
≠
EPISTEMIC STATE
```

```text
EVIDENCE
≠
EVIDENCE ASSESSMENT
```

```text
EVIDENCE COMPATIBILITY
≠
EVIDENCE SUPPORT
```

```text
EVIDENCE
≠
GUIDANCE
```

```text
NORMATIVE RULE
≠
DECISION POLICY
```

```text
PROPOSITION
≠
CONTENT ASSERTION
```

```text
CONTENT CANDIDATE
≠
EXECUTION ARTIFACT
≠
PUBLISHED ARTIFACT
```

```text
CONTENT QUALITY
≠
OBSERVED EFFECTIVENESS
≠
CAUSAL EFFECTIVENESS
```

```text
ATTRIBUTION
≠
INCREMENTAL CAUSAL EFFECT
```

```text
STABLE CONCEPT IDENTITY
≠
IMMUTABLE REVISION IDENTITY
```

```text
REFERENCE RESOLUTION
≠
REFERENTIAL CONSISTENCY
```

An ID may resolve successfully while still being inconsistent with the rest of the decision state.

Both must hold.

---

# 3. Immutable Entity Reference

```text
ImmutableEntityRef

entity_type
entity_id
```

Used when one ID identifies exactly one immutable historical state.

Examples:

```text
Proposition
SourceArtifact
EvidenceItem
EvidencePropositionLink
EvidenceAssessment
EpistemicStateVersion
OutcomeModel
OutcomeEdge
KnowledgeGap
ResearchTrace

AudienceState
StrategyHypothesis
ContentArchitecture
ContentUnit
ContentCandidate

ContentAssertion
AssertionPropositionLink
AssertionValidationResult
CompositeImpressionAssessment

QualitativeEvaluation
ApplicabilityAssessment
RiskAssessment
UncertaintyAssessment
RightsPolicy
RightsCheck

DecisionSnapshot
PolicyResult
PolicyConflictResolution
HumanReviewRecord
PolicyOverride
DecisionRecord

ExecutionArtifact
PublicationLineage
PublishedArtifact
MeasurementState
PerformanceObservation
ChangeProposal

FinalContentPackage
```

---

# 4. Revision Reference

```text
RevisionRef

entity_type
stable_id
revision_id
```

Used for revisioned concepts.

Examples:

```text
ContentProgram
TaskContract
ChannelProfile

Guidance
NormativeRule
DecisionPolicy

MetricDefinition
AttributionModel
EvalContract

PromptConfig
ModelConfig
ToolConfig
RetrieverConfig
EvaluatorConfig
SchemaDefinition
```

Every revision is immutable.

---

# 4A. Registered Control-Plane Revision Contract

Config-like revision types used through `RevisionRef` do not require separate domain entities in the Blueprint.

They conform to:

```text
RegisteredControlPlaneRevision

entity_type
stable_id
revision_id

supersedes_revision_id?

payload_hash
payload_schema_revision_id

created_at
```

For V1 this registry covers:

```text
PromptConfig
ModelConfig
ToolConfig
RetrieverConfig
EvaluatorConfig
SchemaDefinition
```

The typed domain revisions defined elsewhere in this Blueprint remain authoritative for:

```text
ContentProgram
TaskContract
ChannelProfile
Guidance
NormativeRule
DecisionPolicy
MetricDefinition
AttributionModel
EvalContract
```

A `RevisionRef` is valid only if its target exists in the revision registry and its `entity_type`, `stable_id`, and `revision_id` agree with the registered record.

`RegisteredControlPlaneRevision.payload_schema_revision_id` MUST resolve to an immutable registered `SchemaDefinition` revision.

---

# 5. Reference Typing Rule

```text
*_revision_ref
```

MUST contain a `RevisionRef`.

```text
*_revision_id
```

MUST identify one registered immutable revision.

Historical:

```text
*_id
```

fields may only reference immutable entities unless their contract explicitly states otherwise.

Historical resolution may never substitute:

```text
CURRENT
LATEST
ACTIVE
```

for the referenced state.

---

# 5A. Reference Payload Rule

Fields ending in `_ref` or `_refs` that are not revision-specific MUST explicitly contain one of:

```text
ImmutableEntityRef
RevisionRef
```

unless their field contract states a narrower type.

Opaque business identifiers that ContentOS does not dereference are exceptions and MUST be explicitly documented as external identifiers.

For V1:

```text
TaskContractRevision.brand_id
TaskContractRevision.product_id
```

are opaque external business identifiers, not ContentOS entity references.

`run_correlation_key` is an execution-correlation value, not an entity reference.

---

# 6. Stable Identity vs Historical Identity

Stable ID:

> Which conceptual object?

Revision ID:

> Which exact historical revision?

Example:

```text
metric_id = CTR

metric_revision_id = CTR_REV_004
```

Historical decisions reference:

```text
CTR_REV_004
```

not:

```text
CTR
```

---

# 7. Untrusted Information Boundary

```text
UNTRUSTED SOURCE
↓
ISOLATED RETRIEVAL
↓
INSTRUCTION / DATA SEPARATION
↓
STRUCTURED EXTRACTION
↓
SCHEMA VALIDATION
↓
SECURITY VALIDATION
↓
EVIDENCE STAGING
↓
APPROVED REASONING CONTEXT
```

External information cannot directly:

```text
modify Control Plane

change permissions

execute arbitrary tools

authorize publication

override system instructions
```

---

# 8. Control Plane Boundary

Runtime cannot modify the Control Plane revisions that govern the same run.

```text
RUN R1

uses:
Policy P7
Rule R12
Prompt PR4
Evaluator E9
```

R1 may generate:

```text
ChangeProposal
```

but cannot activate:

```text
P8
R13
PR5
E10
```

inside R1.

---

# 9. Content Program Revision

```text
ContentProgramRevision

program_id
program_revision_id

supersedes_program_revision_id?

business_objective
brand_objective

outcome_model_id?

target_audiences
markets

message_hierarchy
content_pillars
channel_roles

success_metric_revision_ids
guardrail_metric_revision_ids

budget_context

effective_from
scheduled_expiration?

created_at
```

---

# 9A. Outcome Model

```text
OutcomeModel

outcome_model_id

business_outcomes
behavioral_outcomes

content_metric_revision_ids
diagnostic_metric_revision_ids
guardrail_metric_revision_ids

outcome_edge_ids

time_horizons

created_at
```

OutcomeModel is immutable.

Material model change creates a new `outcome_model_id`.


# 9B. Outcome Edge

```text
OutcomeEdge

edge_id

from_node
to_node

relationship_type

proposition_ids

assumptions
known_confounders
time_lag

created_at
```

Relationship types:

```text
CAUSAL
ASSOCIATIONAL
MEDIATING
DIAGNOSTIC
ACCOUNTING_IDENTITY
ATTRIBUTION
UNKNOWN
```

Relationship semantics do not themselves establish epistemic support.


# 9C. Attribution Model Revision

```text
AttributionModelRevision

attribution_model_id
attribution_model_revision_id

supersedes_attribution_model_revision_id?

model_type
eligible_touchpoints
lookback_window
credit_assignment

assumptions
limitations

created_at
```

Attribution never establishes incremental causal effect by itself.


# 9D. Metric Definition Revision

```text
MetricDefinitionRevision

metric_id
metric_revision_id

supersedes_metric_revision_id?

metric_name
layer
definition

numerator
denominator
window

attribution_model_revision_id?

effective_from
scheduled_expiration?

created_at
```


# 9E. Eval Contract Revision

```text
EvalContractRevision

eval_contract_id
eval_contract_revision_id

supersedes_eval_contract_revision_id?

component
capability

required_dimensions
hard_gates
release_impact

created_at
```

Detailed datasets, thresholds, aggregation, and evaluator methodology belong in SPEC 06.


# 9F. Channel Profile Revision

```text
ChannelProfileRevision

channel_profile_id
channel_profile_revision_id

supersedes_channel_profile_revision_id?

identity
platform_if_applicable

supported_formats
distribution_capabilities
technical_capabilities
content_capabilities

rule_revision_refs
guidance_revision_refs
metric_revision_refs

created_at
```

---

# 10. Task Contract Revision

```text
TaskContractRevision

task_id
task_revision_id

supersedes_task_revision_id?

program_revision_id?

standalone_task

objective

channel
format
language
market
jurisdiction

brand_id
product_id

audience_context

success_metric_revision_id
secondary_metric_revision_ids
guardrail_metric_revision_ids

constraints
risk_context
compute_budget

intended_publication_time?

created_at
```

Every run uses one exact `task_revision_id`.

---

# 11. Audience State

```text
AudienceState

audience_state_id
task_revision_id

state_stage

context

knowledge_state
problem_state
solution_state
product_state
brand_state
intent_state

desired_outcome

objections
decision_criteria
prior_exposure

origin
uncertainty

created_at
```

Stages:

```text
PROVISIONAL

REFINED

FINAL_FOR_DECISION
```

Immutable.

---

# 11A. Knowledge Gap

```text
KnowledgeGap

gap_id
supersedes_gap_id?
task_revision_id

question
decision_relevance

blocking
researchable
user_resolvable
assumption_allowed

risk_if_wrong
status

created_at
```

Status:

```text
OPEN
RESOLVED_BY_RESEARCH
RESOLVED_BY_USER
EXPLICIT_ASSUMPTION
UNRESOLVED_NON_BLOCKING
BLOCKING
```

KnowledgeGap is immutable.

A status change creates a new `gap_id` with `supersedes_gap_id` pointing to the prior state.

A blocking gap cannot disappear merely because research failed.


# 11B. Research Trace

```text
ResearchTrace

research_trace_id
gap_id

research_question
queries
sources_searched

retrieval_revision_ref

result_evidence_ids

coverage_limitations
outcome
stop_reason

started_at
completed_at
```

Research outcomes:

```text
FOUND_RELEVANT_EVIDENCE
NO_EVIDENCE_FOUND
SEARCH_INCOMPLETE
SEARCH_FAILED
```

`NO_EVIDENCE_FOUND` is not equivalent to proposition falsity.

---

# 12. Source Artifact

```text
SourceArtifact

source_id

source_type
publisher
author
jurisdiction

source_version

retrieved_at

content_hash
snapshot_reference

rights_policy_id

data_scope

created_at
```

Immutable.

---

# 13. Evidence Item

```text
EvidenceItem

evidence_id

origin_type
origin_id

locator?

statement
statement_type
assertion_method

evidence_domain

study_design
causal_identification
mechanism_support

valid_from
valid_until_if_known?

limitations

created_at
```

V1 supported origins:

```text
SOURCE_ARTIFACT

PERFORMANCE_OBSERVATION
```

---

# 13A. Evidence Domain

Canonical V1 domains include:

```text
PRODUCT_DOCUMENTATION
FIRST_PARTY_OBSERVATION
CUSTOMER_REPORT
EXPERT_SOURCE
ACADEMIC_STUDY
REGULATORY_SOURCE
PLATFORM_POLICY
PLATFORM_ANALYTICS
OBSERVATIONAL_PERFORMANCE
RANDOMIZED_EXPERIMENT
QUASI_EXPERIMENT
MARKET_DATA
```

EvidenceDomain participates in Compatibility evaluation.

Domain compatibility is necessary but not sufficient for support.

Evidence from one domain may not silently establish a proposition class that the compatibility policy disallows.

---

# 13B. Data Scope

```text
TENANT_PRIVATE
WORKSPACE_SHARED
AUTHORIZED_AGGREGATE
GLOBAL_PUBLIC
```


# 13C. Proposition Type

```text
FACTUAL
CAUSAL
PREDICTIVE
STRATEGIC
PERFORMANCE
AUDIENCE
MEASUREMENT
DEFINITIONAL
```


# 13D. Evidence Compatibility Status

```text
COMPATIBLE
COMPATIBLE_WITH_LIMITS
INCOMPATIBLE
UNCERTAIN
```


# 13E. Evidence Relationship

```text
SUPPORTS
PARTIALLY_SUPPORTS
QUALIFIES
CONTRADICTS
DOES_NOT_ADDRESS
```

Compatibility answers whether evidence may legitimately inform the proposition type.

Relationship answers what that specific evidence implies about that specific proposition.

```text
COMPATIBLE
≠
SUPPORTS
```

---

# 14. Proposition

```text
Proposition

proposition_id

proposition_type

canonical_meaning

subject
predicate
object

qualifiers
conditions

population_scope
jurisdiction_scope

supersedes_proposition_id?

created_at
```

Proposition is immutable.

Semantic change:

```text
NEW PROPOSITION ID
```

---

# 15. Evidence–Proposition Link

```text
EvidencePropositionLink

link_id

evidence_id
proposition_id

created_at
```

Canonical sequence:

```text
CREATE LINK
↓
CHECK COMPATIBILITY
↓
ASSESS SUPPORT
```

---

# 16. Evidence Assessment

```text
EvidenceAssessment

assessment_id

supersedes_assessment_id?

link_id

compatibility_status
relationship

assessor
assessment_method

authority
methodological_quality

directness
applicability

population_match
context_match

freshness
independence
precision

limitations
uncertainty

assessed_at
created_at
```

Reassessment creates a new `assessment_id`.

---

# 17. Epistemic State Version

```text
EpistemicStateVersion

epistemic_state_id

supersedes_epistemic_state_id?

proposition_id

assessment_ids

support_status
causal_status

uncertainty

derivation_method
derivation_revision_ref

valid_from
valid_until_if_known?

known_from

created_at
```

Support:

```text
SUPPORTED

PARTIALLY_SUPPORTED

CONFLICTING

CONTRADICTED

INSUFFICIENT

UNKNOWN
```

---

# 18. Epistemic State Chain Integrity

For each `proposition_id`, EpistemicStateVersion forms one system-time chain.

Required invariants:

```text
1.
At most one root state
for one proposition lineage.

2.
At most one direct successor
per EpistemicStateVersion.

3.
Successor.proposition_id
==
Predecessor.proposition_id.

4.
Successor.known_from
>
Predecessor.known_from.

5.
The supersession graph
MUST be acyclic.
```

Therefore:

```text
known_until(state)
```

may safely be derived from:

```text
known_from(successor(state))
```

when a successor exists.

No past EpistemicState is mutated when future knowledge appears.

---

# 18A. Causal Epistemic Guard

A general `SUPPORTS` relationship does not automatically establish causal support.

For a Proposition where:

```text
proposition_type = CAUSAL
```

`causal_status` may be upgraded only when the contributing compatible EvidenceItems and EvidenceAssessments satisfy the causal-identification requirements of the pinned derivation policy.

Pure association, platform attribution, or observational performance correlation cannot by itself produce a causally supported state.

When causal identification is insufficient:

```text
causal_status
=
INSUFFICIENT
or
UNKNOWN
```

even if an associational component is well supported.

---

# 19. Guidance Revision

```text
GuidanceRevision

guidance_id
guidance_revision_id

supersedes_guidance_revision_id?

guidance_type

recommendation
scope

supporting_proposition_ids

limitations

effective_from
scheduled_expiration?

created_at
```

---

# 20. Normative Rule Revision

```text
NormativeRuleRevision

rule_id
rule_revision_id

supersedes_rule_revision_id?

rule_type

statement

jurisdiction
scope

applicability_conditions
enforcement_level

source_ids

valid_from
known_from

scheduled_expiration?

created_at
```

---

# 21. Decision Policy Revision

```text
DecisionPolicyRevision

policy_id
policy_revision_id

supersedes_policy_revision_id?

conditions
required_inputs

action

priority_class
scope

override_allowed
override_authority_requirements?
override_scope_constraints?

created_at
```

---

# 22. Applicability Assessment

```text
ApplicabilityAssessment

assessment_id

subject_type
subject_revision_id

task_revision_id

assessment_stage

result
applicability_strength?

scope_matches
reason_codes

assessor
uncertainty

review_required

dependency_fingerprint

target_valid_time
knowledge_cutoff_time

created_at
```

Stages:

```text
PRE_GENERATION_PROVISIONAL

PRE_GENERATION_FINAL

CONTENT_LEVEL
```

Subject types:

```text
GUIDANCE
NORMATIVE_RULE
```

Results:

```text
APPLICABLE
PARTIALLY_APPLICABLE
NOT_APPLICABLE
UNCERTAIN
```

---

# 23. Governance Refresh

If research changes:

```text
market

jurisdiction

product/category

audience state

channel

material proposition state
```

then final pre-generation applicability must be recomputed.

---

# 24. Strategy Hypothesis

```text
StrategyHypothesis

strategy_id

task_revision_id
audience_state_id

core_message

behavioral_objective

persuasion_mechanism
proof_strategy

required_proposition_ids

assumptions
unknowns

failure_modes
risk_hypotheses

created_at
```

Immutable.

---

# 24A. Strategy Gate

Strategy Gate is a deterministic validation process, not a separate intelligence entity.

Inputs:

```text
FINAL_FOR_DECISION AudienceState

StrategyHypothesis

final KnowledgeGap states

required Proposition EpistemicStateVersions

PRE_GENERATION_FINAL ApplicabilityAssessments

pinned Task / Program / Channel context
```

Normal strategy execution may proceed only if:

```text
1.
No unresolved blocking KnowledgeGap remains.

2.
Every Strategy.required_proposition_id
has a current decision-time EpistemicState
available in the pinned knowledge state.

3.
Required propositions are not
CONTRADICTED or INSUFFICIENT
when the Strategy depends on them as factual proof.

4.
No applicable non-overridable governance rule
blocks the Strategy.

5.
Material assumptions and unknowns remain explicit.
```

Failure produces:

```text
BLOCKED
or
HUMAN_REVIEW_REQUIRED
```

rather than fabricated certainty.

---

# 25. Content Architecture

```text
ContentArchitecture

architecture_id

supersedes_architecture_id?

task_revision_id
strategy_id

unit_ids

created_at
```

Immutable.

---

# 26. Content Unit

```text
ContentUnit

unit_id

position
purpose

audience_state_before
audience_question

information_to_deliver

proposition_ids

copy_goal
visual_goal
audio_goal

payoff
transition

audience_state_after

created_at
```

Immutable.

---

# 27. Content Candidate

```text
ContentCandidate

candidate_id

task_revision_id

strategy_id
architecture_id

content_payload

run_config_id

parent_candidate_id?

created_at
```

Immutable.

Rewrite = new Candidate.

---

# 28. Content Assertion

```text
ContentAssertion

assertion_id

artifact_ref

modality
explicitness

interpretation
materiality

source_elements

wording_strength
conditions

audience_interpretation_context

created_at
```

`artifact_ref` is an immutable entity reference.

---

# 29. Assertion–Proposition Link

```text
AssertionPropositionLink

link_id

assertion_id
proposition_id

relation

mapping_uncertainty

created_at
```

Relations:

```text
EQUIVALENT

NARROWER

BROADER

CONJUNCT

IMPLIES

CONTRADICTS
```

---

# 30. Assertion Validation Result

```text
AssertionValidationResult

result_id

assertion_id

status

proposition_link_ids

reason_codes

required_qualification?

evaluator_revision_ref

created_at
```

Status:

```text
SUPPORTED

SUPPORTED_WITH_QUALIFICATION

OVERCLAIM

UNSUPPORTED

CONTRADICTORY
```

Immutable.

---

# 30A. Composite Impression Assessment

```text
CompositeImpressionAssessment

assessment_id

candidate_id

input_assertion_ids
likely_interpretations

implied_assertion_ids

misleading_risks
required_disclosures

status

evaluator_revision_ref

created_at
```

Status:

```text
STABLE
STABLE_WITH_REQUIREMENTS
INVALID
REVIEW_REQUIRED
```

Immutable.

A re-evaluation creates a new `assessment_id`.

---

# 31. Composite Validation Closure

```text
EXPRESS ASSERTIONS
↓
MAP ↔ PROPOSITIONS
↓
VALIDATE
↓
COMPOSITE IMPRESSION
↓
NEW IMPLIED ASSERTIONS?
```

If yes:

```text
REGISTER IMPLIED ASSERTIONS
↓
MAP ↔ PROPOSITIONS
↓
VALIDATE
↓
COMPOSITE RECHECK
```

until:

```text
STABLE
```

or:

```text
MAX_VALIDATION_ITERATIONS
→
HUMAN_REVIEW_REQUIRED
```

Express and implied assertions use the same validation path.

---

# 32. Qualitative Evaluation

```text
QualitativeEvaluation

evaluation_id

candidate_id

eval_contract_revision_id

dimension_results

hard_gate_results

overall_state?

evaluator_revision_ref

created_at
```

Immutable.

---

# 32A. Validation Release Eligibility

A normal `READY` or `READY_WITH_WARNINGS` release decision is forbidden when the selected Candidate contains any material final AssertionValidationResult with:

```text
OVERCLAIM
UNSUPPORTED
CONTRADICTORY
```

`SUPPORTED_WITH_QUALIFICATION` is eligible only after the required qualification is present in the immutable Candidate state being released.

For the selected Candidate, a final CompositeImpressionAssessment with:

```text
INVALID
```

blocks release.

A CompositeImpressionAssessment with:

```text
REVIEW_REQUIRED
```

requires Human Review before release.

A failed `QualitativeEvaluation.hard_gate_result` is handled according to the exact pinned EvalContractRevision and may not be silently ignored.

These are release-eligibility invariants, not optional scoring preferences.

---

# 33. Risk Assessment

```text
RiskAssessment

risk_assessment_id

subject_ref

harm_type

severity
likelihood
exposure
reversibility

regulatory_materiality
business_impact

created_at
```

Immutable.

---

# 34. Uncertainty Assessment

```text
UncertaintyAssessment

uncertainty_assessment_id

subject_refs

dimensions

assessment_method

created_at
```

Immutable.

---

# 34A. Rights Policy

```text
RightsPolicy

rights_policy_id

copyright_status
license

analysis_use
generation_use
quotation_use
transformation_permission
redistribution_permission
commercial_use_permission

attribution_requirements

effective_from
scheduled_expiration?

supersedes_rights_policy_id?

created_at
```

RightsPolicy is immutable by ID.

A rights-state change creates a new `rights_policy_id`.

---

# 35. Rights Check

```text
RightsCheck

rights_check_id

subject_ref

rights_policy_id

intended_use

status

required_attributions

reason_codes

target_use_time
knowledge_cutoff_time

created_at
```

Intended use:

```text
ANALYSIS
GENERATION_INPUT
QUOTATION
TRANSFORMATION
REDISTRIBUTION
COMMERCIAL_PUBLICATION
```

Status:

```text
ALLOWED
ALLOWED_WITH_REQUIREMENTS
REVIEW_REQUIRED
BLOCKED
```

Rights affect release.

They are not informational decoration.

---

# 35A. Rights Release Eligibility

For decision-relevant RightsChecks:

```text
BLOCKED
→ normal release forbidden

REVIEW_REQUIRED
→ Human Review required before release

ALLOWED_WITH_REQUIREMENTS
→ required_attributions / requirements
   MUST be satisfied by the releasable package or execution plan
```

A RightsCheck may not be treated as advisory metadata when its status imposes a release constraint.

---

# 36. Knowledge Manifest

```text
KnowledgeManifest

knowledge_manifest_id

source_ids
evidence_ids
proposition_ids
epistemic_state_ids

content_hash

created_at
```

Immutable.

---

# 37. Baseline Knowledge Snapshot

```text
BaselineKnowledgeSnapshot

baseline_snapshot_id

as_of

knowledge_manifest_id

program_revision_id?

channel_profile_revision_ids

created_at
```

---

# 38. Run Knowledge Delta

```text
RunKnowledgeDelta

delta_id
run_correlation_key

new_source_ids
new_evidence_ids
new_proposition_ids
new_evidence_proposition_link_ids
new_evidence_assessment_ids
new_epistemic_state_ids
new_knowledge_gap_ids
new_research_trace_ids

created_at
```

Immutable.

---

# 39. Governance Snapshot

```text
GovernanceSnapshot

governance_snapshot_id

as_of

guidance_revision_ids
rule_revision_ids
policy_revision_ids

metric_revision_ids
attribution_model_revision_ids

rights_policy_ids

created_at
```

Immutable.

---

# 40. Run Config

```text
RunConfig

run_config_id

prompt_revision_refs
model_config_revision_refs
tool_config_revision_refs

schema_revision_refs

retriever_revision_refs
evaluator_revision_refs

runtime_parameters

created_at
```

No `"latest"` lookup after run start.

---

# 41. Decision Snapshot

```text
DecisionSnapshot

snapshot_id

baseline_knowledge_snapshot_id
run_knowledge_delta_id

governance_snapshot_id
run_config_id

task_revision_id

audience_state_id

knowledge_gap_ids
research_trace_ids

strategy_ids
architecture_ids
candidate_ids

assertion_ids
assertion_validation_result_ids

composite_assessment_ids
qualitative_evaluation_ids

applicability_assessment_ids

risk_assessment_ids
uncertainty_assessment_id?

rights_check_ids

frozen_at
```

Every direct reference resolves to immutable state.

That alone is not sufficient.

The snapshot must also satisfy **Referential Closure**.

---

# 42. Snapshot Referential Closure

Before freezing a DecisionSnapshot, ContentOS performs a deterministic:

```text
SNAPSHOT CLOSURE VALIDATION
```

This is a validation process, not a new domain-intelligence layer.

The snapshot is invalid if any transitive relationship disagrees.

---

# 43. Task / Program Closure

If:

```text
Task.standalone_task = false
```

then:

```text
Task.program_revision_id
MUST NOT be null
```

and:

```text
Task.program_revision_id
==
BaselineKnowledgeSnapshot.program_revision_id
```

If:

```text
Task.standalone_task = true
```

then:

```text
Task.program_revision_id = null
```

and:

```text
BaselineKnowledgeSnapshot.program_revision_id = null
```

unless an explicitly informational Program reference is separately introduced in a future spec.

---

# 44. Task Metric Closure

The following exact revisions:

```text
Task.success_metric_revision_id

Task.secondary_metric_revision_ids

Task.guardrail_metric_revision_ids
```

must resolve to immutable metric revisions available in the pinned decision context.

At minimum:

```text
Task metric revision IDs
⊆
GovernanceSnapshot.metric_revision_ids
```

for every metric used by the Task decision.

No metric may be silently resolved to another revision.

---

# 44A. Task / Channel Profile Closure

For normal release decisions, the BaselineKnowledgeSnapshot MUST contain exactly one applicable ChannelProfileRevision whose identity matches:

```text
Task.channel
```

The chosen ChannelProfileRevision is immutable and may not be replaced by a later profile during the run.

If no compatible pinned ChannelProfileRevision exists:

```text
SNAPSHOT_INVALID
```

---

# 44B. Knowledge-Gap / Research Closure

Every `DecisionSnapshot.knowledge_gap_id` MUST:

```text
belong to DecisionSnapshot.task_revision_id
```

and represent the final non-superseded gap state used before Strategy generation.

Every `DecisionSnapshot.research_trace_id` MUST resolve to an immutable ResearchTrace created under the pinned RunConfig.

For run-created ResearchTrace objects:

```text
ResearchTrace.retrieval_revision_ref
∈
DecisionSnapshot.RunConfig.retriever_revision_refs
```

Every `ResearchTrace.result_evidence_id` MUST resolve to EvidenceItem state available through the BaselineKnowledgeSnapshot or RunKnowledgeDelta.

A blocking KnowledgeGap that is not legitimately closed invalidates the normal release path.

---

# 44C. Run-Created Epistemic Derivation Closure

For every EpistemicStateVersion created in the current run:

```text
derivation_revision_ref
```

MUST resolve to a registered immutable revision.

When the derivation uses an evaluator/model pinned by the run, that exact revision MUST appear in the corresponding RunConfig revision set.

No run-created EpistemicState may cite an unpinned mutable derivation configuration.

---

# 45. Audience Closure

```text
AudienceState.task_revision_id
==
DecisionSnapshot.task_revision_id
```

The AudienceState included in DecisionSnapshot must be:

```text
FINAL_FOR_DECISION
```

unless the DecisionPolicy explicitly operates on a non-final intermediate decision type.

Normal content release decisions require:

```text
FINAL_FOR_DECISION
```

---

# 46. Strategy Closure

For every:

```text
strategy_id
∈ DecisionSnapshot.strategy_ids
```

require:

```text
Strategy.task_revision_id
==
DecisionSnapshot.task_revision_id
```

and:

```text
Strategy.audience_state_id
==
DecisionSnapshot.audience_state_id
```

for final release candidates generated from that Strategy.

---

# 47. Architecture Closure

For every Architecture in the snapshot:

```text
Architecture.task_revision_id
==
DecisionSnapshot.task_revision_id
```

and:

```text
Architecture.strategy_id
∈
DecisionSnapshot.strategy_ids
```

Every:

```text
unit_id
```

must resolve to an immutable ContentUnit.

---

# 48. Candidate Closure

For every Candidate in the snapshot:

```text
Candidate.task_revision_id
==
DecisionSnapshot.task_revision_id
```

```text
Candidate.strategy_id
∈
DecisionSnapshot.strategy_ids
```

```text
Candidate.architecture_id
∈
DecisionSnapshot.architecture_ids
```

and:

```text
Candidate.architecture_id.strategy_id
==
Candidate.strategy_id
```

---

# 48A. Candidate / RunConfig Closure

For every Candidate in the snapshot:

```text
Candidate.run_config_id
==
DecisionSnapshot.run_config_id
```

Generation may not be attributed to an unpinned or later RunConfig.

---

# 49. Assertion Closure

Every Assertion in:

```text
DecisionSnapshot.assertion_ids
```

must have an `artifact_ref` pointing to a Candidate included in that snapshot for V1A release decisions.

Every `AssertionPropositionLink` used by a validation result must satisfy:

```text
Link.assertion_id
==
ValidationResult.assertion_id
```

and reference a real immutable Proposition.

---

# 50. Validation Closure

Every:

```text
AssertionValidationResult
```

included in the snapshot must reference an Assertion also included in the snapshot.

Every CompositeImpressionAssessment must reference a Candidate in the snapshot.

All:

```text
input_assertion_ids
implied_assertion_ids
```

used by the final stable Composite Assessment must resolve to Assertions included in the snapshot.

---

# 50A. Evaluation / RunConfig Closure

For every AssertionValidationResult, CompositeImpressionAssessment, and QualitativeEvaluation used in the snapshot:

```text
evaluator_revision_ref
```

or `evaluator_revision_ref` MUST resolve to a registered immutable `EvaluatorConfig` revision.

For run-created evaluations, that exact revision MUST appear in:

```text
DecisionSnapshot.RunConfig.evaluator_revision_refs
```

`QualitativeEvaluation.eval_contract_revision_id` MUST resolve to an immutable EvalContractRevision.

---

# 51. Applicability Closure

Every ApplicabilityAssessment used by the release decision must satisfy:

```text
ApplicabilityAssessment.task_revision_id
==
DecisionSnapshot.task_revision_id
```

`subject_revision_id` must resolve to a GuidanceRevision or NormativeRuleRevision contained in the relevant pinned governance context.

---

# 51A. Applicability Temporal Closure

For every ApplicabilityAssessment used in one DecisionSnapshot:

```text
knowledge_cutoff_time
<=
DecisionSnapshot.frozen_at
```

and all final decision assessments MUST use the Task's resolved target valid time.

Two final ApplicabilityAssessments for the same subject and decision may not silently use different target valid times.

---

# 52. Rights Closure

For every RightsCheck in DecisionSnapshot:

```text
RightsCheck.rights_policy_id
∈
GovernanceSnapshot.rights_policy_ids
```

and its `subject_ref` must resolve to a decision-relevant immutable entity.

For publication / redistribution decisions:

```text
RightsCheck.target_use_time
==
resolved Task target valid time
```

and:

```text
RightsCheck.knowledge_cutoff_time
<=
DecisionSnapshot.frozen_at
```

---

# 52A. Knowledge-Gap Freeze Closure

For a normal content release DecisionSnapshot:

```text
no KnowledgeGap in knowledge_gap_ids
may remain blocking and unresolved
```

An unresolved blocking gap requires:

```text
HUMAN_REVIEW_REQUIRED
or
BLOCKED
```

and prevents a normal READY release path.

---

# 52B. Snapshot Temporal Closure

For a normal decision:

```text
knowledge_cutoff_time
=
DecisionSnapshot.frozen_at
```

unless an earlier explicit cutoff is required by the Task.

Every immutable runtime input referenced by the DecisionSnapshot MUST have been created / known no later than the snapshot knowledge cutoff.

For EpistemicStateVersion:

```text
known_from
<=
knowledge_cutoff_time
```

The target valid time used for governance is:

```text
Task.intended_publication_time
```

when present; otherwise:

```text
DecisionSnapshot.frozen_at
```

Every PRE_GENERATION_FINAL and CONTENT_LEVEL ApplicabilityAssessment used by the decision MUST record that same `target_valid_time` and a `knowledge_cutoff_time` no later than snapshot freeze.

A NormativeRuleRevision is temporally eligible only when:

```text
rule.known_from
<= knowledge_cutoff_time
```

and its validity interval includes `target_valid_time`.

A GuidanceRevision uses its immutable revision creation/effective timing under the same target-valid-time principle.

A RightsCheck for publication or redistribution MUST evaluate the intended use at the same target time and may not use rights knowledge learned after the decision cutoff.

This allows a decision made today for publication tomorrow to apply a rule already known today that becomes valid tomorrow, without importing rules learned only after the decision.

---

# 53. Snapshot Freeze Rule

The sequence becomes:

```text
BUILD PRE-POLICY STATE
↓
BUILD DRAFT DECISION SNAPSHOT
↓
SNAPSHOT CLOSURE VALIDATION
↓
PASS?
```

If:

```text
NO
```

then:

```text
SNAPSHOT_INVALID
↓
DO NOT RUN RELEASE POLICY
```

If:

```text
YES
```

then:

```text
FREEZE DECISION SNAPSHOT
↓
POLICY ENGINE
```

A snapshot containing contradictory but individually valid references may never be frozen.

---

# 54. Policy Result

```text
PolicyResult

policy_result_id

snapshot_id
policy_revision_id

triggered

input_refs

action
reason_code

input_uncertainty

created_at
```

`input_refs` contain only ImmutableEntityRef or RevisionRef values.

Immutable.

---

# 54A. Policy Evaluation Closure

For every PolicyResult:

```text
PolicyResult.snapshot_id
==
the DecisionSnapshot being evaluated
```

and:

```text
PolicyResult.policy_revision_id
∈
DecisionSnapshot.GovernanceSnapshot.policy_revision_ids
```

Every `PolicyResult.input_ref` MUST be reachable from the frozen DecisionSnapshot or its frozen transitive closure.

Policy evaluation may not consume hidden post-snapshot state.

---

# 55. Policy Override

```text
PolicyOverride

override_id

snapshot_id
policy_result_ids

authorized_by

authority_basis

reason_codes

scope

created_at
```

Immutable.

Policies may explicitly set:

```text
override_allowed = false
```

---

# 56. Policy Conflict Resolution

v2.13.1 removes duplicated conflict state.

```text
PolicyConflictResolution

resolution_id

snapshot_id
conflict_key
policy_result_ids

resolution_type

override_id?

reason_codes

created_at
```

Removed:

```text
escalated
```

because `resolution_type` is the single source of truth.

---

# 57. Conflict Resolution Types

```text
HARD_DENY_OVERRIDES

HARD_REQUIREMENT_OVERRIDES

MORE_SPECIFIC_SCOPE

EXPLICIT_PRIORITY

AUTHORIZED_OVERRIDE

ESCALATE
```

---

# 58. Override Integrity

If:

```text
resolution_type =
AUTHORIZED_OVERRIDE
```

then:

```text
override_id
MUST NOT be null
```

and the referenced PolicyOverride must include every PolicyResult whose outcome is being overridden.

If:

```text
resolution_type
≠
AUTHORIZED_OVERRIDE
```

then:

```text
override_id
MUST be null
```

No conflict may claim an authorized override without an authorization object.

For an AUTHORIZED_OVERRIDE resolution:

```text
PolicyOverride.policy_result_ids
⊆
PolicyConflictResolution.policy_result_ids
```

and every result actually overridden by the resolution MUST be included in `PolicyOverride.policy_result_ids`.

---

# 58A. Override Permission Integrity

For every PolicyResult affected by a PolicyOverride:

1. resolve its exact `DecisionPolicyRevision`;
2. require `override_allowed = true`;
3. require the override authority to satisfy `override_authority_requirements`;
4. require the override scope to satisfy `override_scope_constraints`.

A PolicyOverride that fails any of these checks is invalid.

PolicyOverride must also satisfy:

```text
PolicyOverride.snapshot_id
==
PolicyResult.snapshot_id
```

for every overridden PolicyResult.

---

# 59. Governance Ordering for Conflicts

Conflict detection may occur immediately after PolicyResults.

Final PolicyConflictResolution is created only after required adjudication/authorization exists.

Canonical sequence:

```text
POLICY RESULTS
↓
DETECT CONFLICTS
↓
CAN RESOLVE DETERMINISTICALLY?
```

If yes:

```text
CREATE PolicyConflictResolution
```

If no:

```text
HUMAN REVIEW / AUTHORIZATION
↓
OPTIONAL PolicyOverride
↓
CREATE FINAL PolicyConflictResolution
```

This prevents:

```text
AUTHORIZED_OVERRIDE
```

from being recorded before the corresponding override exists.

---

# 59A. Conflict Identity and Finality

Canonical conflict identity:

```text
conflict_key =
hash(
  snapshot_id
  +
  canonical_sorted(policy_result_ids)
)
```

All PolicyResults inside one conflict MUST share the same `snapshot_id`.

Exactly one final PolicyConflictResolution may exist for one `conflict_key`.

A replacement interpretation requires a new decision workflow event, not a second simultaneous final resolution for the same conflict.

---

# 60. Human Review Record

```text
HumanReviewRecord

review_id

task_revision_id
snapshot_id

policy_result_ids

review_subject_refs

review_mode

reviewer_role
qualification
review_scope

review_decision

reason_codes

introduced_information_refs

created_at
```

HumanReviewRecord no longer requires a final ConflictResolution to exist before review.

This prevents a conflict-resolution → review → conflict-resolution dependency cycle.

---

# 61. Human Review Modes

```text
ADJUDICATION_ONLY

NEW_INFORMATION_INTRODUCED
```

For `ADJUDICATION_ONLY`:

```text
judge frozen snapshot only
```

For `NEW_INFORMATION_INTRODUCED`:

```text
RETURN TO AFFECTED PIPELINE STAGE
↓
CREATE NEW IMMUTABLE STATE
↓
REVALIDATE
↓
RECOMPUTE APPLICABILITY / RISK / RIGHTS
↓
BUILD NEW SNAPSHOT
↓
CLOSURE VALIDATE
↓
FREEZE NEW SNAPSHOT
↓
RE-RUN POLICY
```

---

# 62. Release Status

```text
READY

READY_WITH_WARNINGS

HUMAN_REVIEW_REQUIRED

BLOCKED
```

DecisionRecord is the canonical owner of final release status.

---

# 63. Decision Record

```text
DecisionRecord

decision_id

decision_type

task_revision_id

snapshot_id

policy_result_ids

conflict_resolution_ids

reason_codes

selected_action
selected_candidate_id?

release_status

human_review_id?

created_at
```

Immutable.

---

# 63A. Decision Record Closure

For every DecisionRecord:

```text
DecisionRecord.task_revision_id
==
DecisionSnapshot.task_revision_id
```

`DecisionRecord.policy_result_ids` MUST represent the complete PolicyResult set produced by the Policy Engine for that snapshot.

Every PolicyResult referenced by the DecisionRecord MUST have:

```text
PolicyResult.snapshot_id
==
DecisionRecord.snapshot_id
```

No two `DecisionRecord.conflict_resolution_ids` may share the same `conflict_key`.

Every PolicyConflictResolution referenced by the DecisionRecord MUST have:

```text
PolicyConflictResolution.snapshot_id
==
DecisionRecord.snapshot_id
```

If a HumanReviewRecord is referenced, its `snapshot_id` MUST also equal `DecisionRecord.snapshot_id`.

PolicyOverride lineage is owned by the referenced PolicyConflictResolution objects and MUST NOT be duplicated on DecisionRecord.

If the decision selects a release candidate:

```text
DecisionRecord.selected_candidate_id
MUST be present
```

and it MUST belong to `DecisionSnapshot.candidate_ids`.

---

If:

```text
DecisionRecord.release_status
∈ {READY, READY_WITH_WARNINGS}
```

and the selected action releases generated content, then:

```text
DecisionRecord.selected_candidate_id
MUST NOT be null
```

A `BLOCKED` decision MUST NOT be interpreted as release authorization.

`selected_action` is an action code only and MUST NOT embed a candidate or other entity ID. Entity selection is represented by typed fields such as `selected_candidate_id`.

---

# 64. Final Content Package

```text
FinalContentPackage

package_id

task_revision_id

decision_id
decision_snapshot_id

selected_candidate_id
alternative_candidate_ids

strategy_id
architecture_id
audience_state_id

assertion_ids
proposition_ids

risk_assessment_ids
rights_check_ids

warnings

created_at
```

Removed:

```text
release_status
```

FinalContentPackage does not own release truth.

Consumers derive:

```text
release_status
```

from:

```text
DecisionRecord
```

---

# 65. FinalContentPackage Decision Closure

Require:

```text
Package.decision_id
==
DecisionRecord.decision_id
```

and:

```text
Package.decision_snapshot_id
==
DecisionRecord.snapshot_id
```

and:

```text
Package.task_revision_id
==
DecisionRecord.task_revision_id
```

---

# 66. FinalContentPackage Candidate Closure

Require:

```text
Package.selected_candidate_id
∈
DecisionSnapshot.candidate_ids
```

and:

```text
Package.alternative_candidate_ids
⊆
DecisionSnapshot.candidate_ids
```

---

# 66A. FinalContentPackage Decision Selection Closure

If `DecisionRecord.selected_candidate_id` is non-null:

```text
Package.selected_candidate_id
==
DecisionRecord.selected_candidate_id
```

A package may not substitute another candidate merely because that candidate also exists in the same snapshot.

---

# 67. FinalContentPackage Strategy Closure

Let:

```text
C =
Package.selected_candidate_id
```

Then:

```text
Package.strategy_id
==
C.strategy_id
```

and:

```text
Package.architecture_id
==
C.architecture_id
```

---

# 68. FinalContentPackage Audience Closure

Let:

```text
S =
Package.strategy_id
```

Then:

```text
Package.audience_state_id
==
S.audience_state_id
```

and that AudienceState must equal the final AudienceState frozen in the DecisionSnapshot.

---

# 69. FinalContentPackage Assertion Closure

Every:

```text
Package.assertion_id
```

must belong to the selected Candidate's final validated assertion set.

Every:

```text
Package.proposition_id
```

must be reachable through at least one included AssertionPropositionLink or belong to `StrategyHypothesis.required_proposition_ids` for the selected Strategy.

No unrelated Proposition may be inserted into the package.

---

# 70. FinalContentPackage Risk / Rights Closure

```text
Package.risk_assessment_ids
⊆
DecisionSnapshot.risk_assessment_ids
```

and:

```text
Package.rights_check_ids
⊆
DecisionSnapshot.rights_check_ids
```

No post-decision risk or rights state may silently appear inside an old package.

---

# 71. Package Creation Rule

FinalContentPackage is created only after:

```text
DecisionRecord
```

exists.

If:

```text
DecisionRecord.release_status = BLOCKED
```

ContentOS may still create a package for:

```text
audit
review
revision workflow
```

but that package is not releasable.

Release permission is always derived from DecisionRecord.

---

# 72. Publication Lineage

```text
PublicationLineage

publication_lineage_id

channel
destination

created_at
```

`PublicationLineage` is the **single owner** of:

```text
channel
destination
```

for a continuing published object/location.

---

# 73. Published Artifact

```text
PublishedArtifact

published_artifact_id

publication_lineage_id

origin

execution_artifact_id?
source_candidate_id?

actual_content

published_hash

published_at

effective_from

supersedes_published_artifact_id?

platform_metadata

created_at
```

Removed from PublishedArtifact:

```text
channel
destination
```

These values are derived through:

```text
publication_lineage_id
```

No duplicated publication-location truth exists.

---

# 73A. PublishedArtifact Origin Integrity

If:

```text
origin = CONTENTOS_EXECUTION
```

then:

```text
execution_artifact_id
MUST NOT be null
```

and, if `source_candidate_id` is present:

```text
source_candidate_id
==
ExecutionArtifact.candidate_id
```

If:

```text
origin = MANUAL_EXTERNAL
```

then:

```text
execution_artifact_id
MUST be null
```

A PublishedArtifact may not claim incompatible origin lineage.

---

# 74. Publication Lineage Root Rule

Each PublicationLineage must contain:

```text
EXACTLY ONE ROOT
```

where:

```text
root.supersedes_published_artifact_id = null
```

A second root in the same lineage is invalid.

---

# 75. Publication Same-Lineage Rule

If:

```text
PA2.supersedes_published_artifact_id = PA1
```

then:

```text
PA2.publication_lineage_id
==
PA1.publication_lineage_id
```

Cross-lineage supersession is prohibited.

---

# 76. Publication Single-Successor Rule

Within one publication lineage:

```text
each PublishedArtifact
has at most one direct successor
```

Equivalent storage constraint:

```text
UNIQUE (
  publication_lineage_id,
  supersedes_published_artifact_id
)
```

for non-null predecessors.

---

# 77. Publication Acyclic Rule

The supersession graph of one PublicationLineage must be acyclic.

Invalid:

```text
PA1 → PA2 → PA3 → PA1
```

---

# 78. Publication Temporal Ordering

If:

```text
PA2 supersedes PA1
```

then:

```text
PA2.effective_from
>
PA1.effective_from
```

A successor cannot become effective before or at the same instant as its predecessor.

---

# 79. Publication Effective Interval

For artifact `PA`:

```text
start(PA)
=
PA.effective_from
```

If successor exists:

```text
end(PA)
=
successor.effective_from
```

Otherwise:

```text
end(PA)
=
open-ended
```

This is now unambiguous because publication lineages are:

```text
single-root
non-branching
same-lineage
acyclic
strictly time-ordered
```

---

# 80. Execution Artifact

```text
ExecutionArtifact

execution_artifact_id

candidate_id

actual_content

content_hash

production_changes

created_at
```

Immutable.

---

# 81. Measurement State

```text
MeasurementState

measurement_state_id

supersedes_measurement_state_id?

data_maturity

is_final

late_event_window

missingness

known_incidents

observed_at

created_at
```

Immutable.

---

# 81A. Measurement-State Update Rule

MeasurementState is append-only.

A maturity, missingness, incident, or finality change creates:

```text
NEW MeasurementState
```

with:

```text
supersedes_measurement_state_id
```

when it is a correction or maturation of an earlier state.

The earlier MeasurementState is never mutated.

---

# 82. Performance Observation

```text
PerformanceObservation

observation_id

publication_state

covered_published_artifact_ids

metric_revision_id

value

measurement_window_start
measurement_window_end

population_or_denominator

measurement_state_id

source_reference

supersedes_observation_id?

observed_at

created_at
```

Immutable.

---

# 83. Publication State Cardinality

```text
SINGLE_ARTIFACT
→ exactly 1 covered PublishedArtifact
```

```text
MIXED_PUBLICATION_STATE
→ at least 2 covered PublishedArtifacts
```

```text
UNRESOLVED_PUBLICATION_STATE
→ zero or partially known artifacts allowed
```

---

# 84. Performance Window Integrity

For `SINGLE_ARTIFACT`:

```text
measurement_window
⊆
derived publication interval
```

If the measurement spans publication revisions:

```text
split
```

where possible.

Otherwise:

```text
MIXED_PUBLICATION_STATE
```

Mixed observations cannot support version-specific creative claims.

---

# 84A. Performance Publication-Lineage Integrity

For `SINGLE_ARTIFACT` and `MIXED_PUBLICATION_STATE` observations, all known:

```text
covered_published_artifact_ids
```

MUST resolve to PublishedArtifacts from the same PublicationLineage.

If measurement aggregates multiple independent publication lineages, it is not a publication-revision observation and requires a separate aggregate measurement contract in SPEC 07.

---

# 85. Performance Correction

Late or corrected data creates:

```text
NEW MeasurementState
```

and when observation state/value changes:

```text
NEW PerformanceObservation
```

with:

```text
supersedes_observation_id
```

Historical observations remain immutable.

---

# 85A. Performance Correction Chain Integrity

If an observation `O2` supersedes `O1`, then:

```text
O2.metric_revision_id
==
O1.metric_revision_id
```

and correction identity must preserve the same semantic measurement scope:

```text
measurement window
population/denominator semantics
publication coverage semantics
```

If semantic scope changes, create a new independent observation rather than a correction.

For one correction lineage:

```text
at most one direct successor per observation
supersession graph is acyclic
```

This prevents simultaneous competing 'latest corrections' from being treated as one history.

---

# 86. Performance → Evidence

```text
PerformanceObservation
↓
EvidenceItem
```

Performance evidence uses:

```text
origin_type =
PERFORMANCE_OBSERVATION
```

```text
origin_id =
observation_id
```

---

# 87. Performance Evidence Firewall

Performance evidence may inform appropriate:

```text
PERFORMANCE
STRATEGIC
AUDIENCE
```

Propositions.

It does not by itself establish:

```text
PRODUCT FACTS

SAFETY FACTS

REGULATORY FACTS

MEDICAL FACTS
```

---

# 87A. Change Proposal

```text
ChangeProposal

proposal_id

proposal_type

target_revision_ref?

proposed_change

supporting_refs

uncertainty

created_at
```

`target_revision_ref`, when present, is a RevisionRef.

`supporting_refs` contain only ImmutableEntityRef or RevisionRef values.

Runtime may create ChangeProposal objects.

Only the Control Plane may activate a proposal by creating a new immutable revision.

---

# 88. Replayability Status

```text
ReplayabilityStatus

decision_id

status

missing_entity_refs

reason_codes

updated_at
```

Status:

```text
FULL

PARTIAL_REDACTED

UNAVAILABLE_DUE_TO_RETENTION

INVALIDATED_BY_DELETION
```

Data rights override replay convenience.

---

# 89. Historical Replay

Historical replay requires:

```text
DecisionSnapshot

+
every immutable direct reference

+
every immutable transitive reference

+
exact revision identities
```

and the state must have passed Snapshot Closure Validation at decision time.

Historical replay may not resolve:

```text
LATEST
CURRENT
ACTIVE
```

---

# 90. Canonical V1A Runtime

```text
USER INPUT
↓
TASK CONTRACT REVISION
↓
LOAD PROGRAM REVISION IF PRESENT
↓
LOAD BASELINE KNOWLEDGE
↓
LOAD GOVERNANCE
↓
LOAD RUN CONFIG
↓
NORMALIZE
↓
PROVISIONAL AUDIENCE STATE
↓
KNOWLEDGE GAPS
↓
PROVISIONAL GOVERNANCE
↓
RESEARCH
↓
SAFE SOURCE INGESTION
↓
EVIDENCE
↓
PROPOSITIONS
↓
EVIDENCE–PROPOSITION LINKS
↓
COMPATIBILITY
↓
EVIDENCE ASSESSMENTS
↓
EPISTEMIC STATE
↓
REFINE AUDIENCE
↓
CHECK REMAINING BLOCKING GAPS
↓
FINAL AUDIENCE STATE
↓
REFRESH FINAL GOVERNANCE
↓
STRATEGIES
↓
STRATEGY GATE
↓
CONTENT ARCHITECTURE
↓
CONTENT CANDIDATES
↓
ASSERTIONS
↓
ASSERTION ↔ PROPOSITION
↓
ASSERTION VALIDATION
↓
COMPOSITE CLOSURE
↓
QUALITATIVE EVALUATION
↓
CONTENT-LEVEL APPLICABILITY
↓
RISK
↓
UNCERTAINTY
↓
RIGHTS
↓
BUILD DRAFT DECISION SNAPSHOT
↓
SNAPSHOT CLOSURE VALIDATION
↓
FREEZE DECISION SNAPSHOT
↓
POLICY ENGINE
↓
POLICY RESULTS
↓
CONFLICT DETECTION
↓
HUMAN REVIEW / AUTHORIZATION IF REQUIRED
↓
OPTIONAL POLICY OVERRIDE
↓
FINAL POLICY CONFLICT RESOLUTION
↓
DECISION RECORD
↓
FINAL CONTENT PACKAGE
```

---

# 91. New Information During Human Review

If Human Review introduces new information:

```text
DO NOT continue from old snapshot
```

Instead:

```text
RETURN TO AFFECTED STAGE
↓
NEW IMMUTABLE STATE
↓
REVALIDATE
↓
REBUILD DRAFT SNAPSHOT
↓
SNAPSHOT CLOSURE VALIDATION
↓
FREEZE NEW SNAPSHOT
↓
RE-RUN POLICY
```

---

# 91A. Unknown-Preservation Gate

Before Strategy generation:

```text
FOR EACH KnowledgeGap
WHERE blocking = true
```

require one of:

```text
RESOLVED_BY_RESEARCH
RESOLVED_BY_USER
```

or, only when explicitly permitted:

```text
EXPLICIT_ASSUMPTION
```

with:

```text
assumption_allowed = true
```

and risk/policy treatment that permits proceeding.

The following never closes a blocking gap by itself:

```text
NO_EVIDENCE_FOUND
SEARCH_INCOMPLETE
SEARCH_FAILED
```

If a blocking gap remains unresolved:

```text
DO NOT ENTER NORMAL RELEASE STRATEGY PATH
```

The system must preserve the state as unknown / blocked / review-required rather than inventing certainty.

---

# 92. Canonical V1B Runtime

```text
PUBLISHED ARTIFACT
↓
INGEST METRIC DATA
↓
MEASUREMENT STATE
↓
PERFORMANCE OBSERVATION
↓
PUBLICATION-WINDOW VALIDATION
↓
PERFORMANCE EVIDENCE
↓
PROPOSITION
↓
EVIDENCE–PROPOSITION LINK
↓
COMPATIBILITY
↓
EVIDENCE ASSESSMENT
↓
EPISTEMIC STATE VERSION
↓
OPTIONAL CHANGE PROPOSAL
```

---

# 93. Canonical Knowledge Graph

```text
IMMUTABLE EVIDENCE ORIGIN
↓
EvidenceItem
↓
Proposition
↓
EvidencePropositionLink
↓
Compatibility
↓
EvidenceAssessment
↓
EpistemicStateVersion
```

---

# 94. Canonical Content Graph

```text
AudienceState
↓
StrategyHypothesis
↓
ContentArchitecture
↓
ContentCandidate
↓
ContentAssertion
↔
Proposition
```

via:

```text
AssertionPropositionLink
```

---

# 95. Canonical Governance Graph

```text
RULE / GUIDANCE REVISIONS
↓
APPLICABILITY
↓
POLICY REVISION
↓
POLICY RESULTS
↓
CONFLICT DETECTION
↓
HUMAN REVIEW / AUTHORIZATION IF REQUIRED
↓
OPTIONAL POLICY OVERRIDE
↓
FINAL CONFLICT RESOLUTION
↓
DECISION RECORD
```

---

# 96. Canonical Decision Graph

```text
EXACT KNOWLEDGE
+
EXACT CONTROL-PLANE REVISIONS
+
EXACT TASK REVISION
+
FINAL AUDIENCE
+
STRATEGY
+
ARCHITECTURE
+
CANDIDATE
+
ASSERTIONS
+
VALIDATION
+
COMPOSITE STATE
+
EVALUATION
+
APPLICABILITY
+
RISK
+
UNCERTAINTY
+
RIGHTS
↓
DRAFT DECISION SNAPSHOT
↓
REFERENTIAL CLOSURE VALIDATION
↓
IMMUTABLE DECISION SNAPSHOT
↓
POLICY RESULTS
↓
FINAL GOVERNANCE RESOLUTION
↓
DECISION RECORD
↓
FINAL CONTENT PACKAGE
```

---

# 97. Canonical Publication Graph

```text
PublicationLineage
↓
PublishedArtifact PA1
↓
PublishedArtifact PA2
↓
PublishedArtifact PA3
```

Properties:

```text
one root

one direct successor maximum

same lineage

acyclic

strict effective-time order
```

---

# 98. Canonical Learning Graph

```text
PublishedArtifact
↓
MeasurementState
↓
PerformanceObservation
↓
EvidenceItem
↓
Proposition
↓
EvidenceAssessment
↓
EpistemicStateVersion
↓
Optional ChangeProposal
```

---

# 99. V1A Acceptance Criteria

V1A must prove:

```text
1.
Historical references never resolve CURRENT.

2.
Every revisioned concept uses exact revision identity.

3.
Every direct Snapshot reference resolves.

4.
Every transitive Snapshot reference is consistent.

5.
Task and Baseline Program revisions cannot disagree.

6.
Task metric revisions match pinned metric context.

7.
AudienceState belongs to the Task.

8.
Final release AudienceState is FINAL_FOR_DECISION.

9.
Strategy belongs to the Task and final AudienceState.

10.
Architecture belongs to its Strategy.

11.
Candidate belongs to its Strategy and Architecture.

12.
Assertions belong to Candidate state frozen in Snapshot.

13.
Validation results reference the correct Assertions.

14.
Implied Assertions re-enter validation.

15.
Composite closure stabilizes or escalates.

16.
Applicability uses the correct Task and governance revisions.

17.
RightsCheck references pinned RightsPolicy state.

18.
Invalid closure prevents Snapshot freeze.

19.
Policy conflicts have one canonical resolution state.

20.
AUTHORIZED_OVERRIDE requires a real PolicyOverride.

21.
Human review does not require a final ConflictResolution
to exist first.

22.
Hidden reviewer knowledge cannot enter final decision state.

23.
DecisionRecord owns canonical ReleaseStatus.

24.
FinalContentPackage cannot disagree with DecisionRecord.

25.
FinalContentPackage selected Candidate exists in Snapshot.

26.
FinalContentPackage Strategy / Architecture match Candidate.

27.
FinalContentPackage risk / rights refs are snapshot subsets.

28.
Runtime cannot mutate active governance.

29.
Unknown remains unknown.

30.
Strategy Gate rejects unresolved blocking knowledge gaps.

31.
PolicyResults are bound to the exact DecisionSnapshot.

32.
FinalContentPackage selected Candidate equals the DecisionRecord selection.
```

---

# 100. V1B Acceptance Criteria

V1B must prove:

```text
1.
PublicationLineage owns channel/destination.

2.
PublishedArtifact does not duplicate lineage location.

3.
Each lineage has exactly one root.

4.
A predecessor has at most one direct successor.

5.
Successor remains in the same lineage.

6.
Supersession graph is acyclic.

7.
Successor effective_from increases strictly.

8.
Publication interval can be derived unambiguously.

9.
MeasurementState is immutable.

10.
PerformanceObservation is immutable.

11.
Metric uses exact metric_revision_id.

12.
Mixed metrics preserve publication lineage.

13.
Mixed metrics cannot masquerade
as version-specific evidence.

14.
Performance corrections append new observations.

15.
Performance Evidence preserves exact origin.

16.
Performance does not prove unrelated factual claims.

17.
EpistemicState supersession is linear per Proposition.

18.
EpistemicState system-time ordering is monotonic.

19.
EpistemicState chain is acyclic.

20.
Learning updates EpistemicState,
not Proposition meaning.

21.
ChangeProposal cannot mutate Control Plane.
```

---

# 101. Non-Negotiable Invariants

ContentOS must never:

```text
resolve historical references to CURRENT

freeze a snapshot with inconsistent transitive references

allow Task and Program context to disagree

allow Candidate and Strategy context to disagree

allow Candidate and Architecture context to disagree

allow Assertions from outside the frozen candidate state
into the decision

let implied assertions bypass validation

silently resolve policy conflicts

store both resolution_type=ESCALATE
and a contradictory escalation boolean

record AUTHORIZED_OVERRIDE
without PolicyOverride

require final ConflictResolution
before the HumanReview needed to resolve it

use hidden reviewer knowledge

mutate a DecisionSnapshot

let FinalContentPackage disagree with DecisionRecord

let FinalContentPackage select a Candidate
outside DecisionSnapshot

duplicate channel/destination
between PublicationLineage and PublishedArtifact

create multiple roots inside one publication lineage

branch publication lineage silently

cross publication lineages through supersession

create publication supersession cycles

create non-monotonic publication effective times

create branching EpistemicState histories
for one Proposition

create EpistemicState supersession cycles

mutate historical end-times

mutate Proposition meaning

mutate EvidenceAssessment

mutate ContentCandidate

mutate PublishedArtifact

mutate MeasurementState

mutate PerformanceObservation

lose performance lineage

treat performance success as factual proof

confuse compatibility with support

confuse attribution with causation

retain prohibited data merely for replay

let Runtime mutate active Control Plane
```

---

# 102. Final Freeze Criteria

v2.13.1 remains **FROZEN** only while the fixed adversarial test suite cannot demonstrate:

```text
CORE CONTRADICTION

DUPLICATED SOURCE OF TRUTH

DANGLING REFERENCE

AMBIGUOUS REVISION IDENTITY

REFERENTIAL CLOSURE FAILURE

MUTABLE HISTORY FAILURE

TEMPORAL CHAIN FAILURE

SNAPSHOT / REPLAY FAILURE

VALIDATION BYPASS

GOVERNANCE / RIGHTS BYPASS

PUBLICATION-LINEAGE FAILURE

PERFORMANCE-LINEAGE FAILURE

FINAL-PACKAGE CONSISTENCY FAILURE

MISSING V1 STATE
```

These do **not** justify v2.14:

```text
better UI

new automation

advanced causal ML

portfolio optimization

auto publishing

ranking improvements

cross-tenant learning

scale infrastructure

more sophisticated models
```

---

# 103. Final Freeze Test Suite

Run:

```text
01 Semantic identity

02 Revision identity

03 Historical revision lookup

04 Contradictory evidence

05 Evidence-domain leakage

06 Compatibility vs support

07 Stale audience

08 Stale governance

09 Untrusted-source injection

10 Express assertion overclaim

11 Implied assertion closure

12 Rights restriction

13 Policy conflict without override

14 Policy conflict with authorized override

15 Human review without new information

16 Human review with new information

17 Snapshot direct-reference resolution

18 Snapshot transitive referential closure

19 Task / Program mismatch attack

20 Candidate / Strategy mismatch attack

21 Exact snapshot replay

22 Deletion-degraded replay

23 Publication edit

24 Publication multiple-root attack

25 Publication branch attack

26 Publication cross-lineage successor attack

27 Publication cycle attack

28 Publication temporal-order attack

29 Mixed publication metric

30 Measurement maturity update

31 Performance correction

32 Performance → Evidence lineage

33 EpistemicState branch attack

34 EpistemicState cycle attack

35 EpistemicState temporal-order attack

36 FinalContentPackage candidate mismatch

37 FinalContentPackage strategy mismatch

38 FinalContentPackage decision mismatch

39 Runtime → Control Plane mutation

40 Unknown-preservation test
```

If all preserve invariants:

```text
FREEZE
ContentOS Blueprint v2.13.1
```

No further open-ended architecture audit.

Proceed to SPEC 01–10.

---

# 103A. Freeze Verification Record

The v2.13.1 freeze was performed as a patch of the v2.13 baseline rather than a full-document rewrite.

Static structural verification:

```text
CODE-FENCE / DOCUMENT STRUCTURE
PASS

DECLARED IMMUTABLE ENTITY CONTRACT COVERAGE
PASS

DECLARED REVISIONED-CONCEPT COVERAGE
PASS

REFERENCE TARGET RESOLUTION
PASS

KNOWN DUPLICATED-SOURCE-OF-TRUTH CHECKS
PASS

V1A DEPENDENCY ORDER
PASS

V1B DEPENDENCY ORDER
PASS
```

Blueprint adversarial suite:

```text
40 / 40 PASS
```

This verification is an architecture/specification-level result.

It is not a claim that implementation code has passed integration, property-based, security, load, or production tests.

From this point onward:

```text
ARCHITECTURE STATUS
FROZEN
```

A new Blueprint version is justified only by a demonstrated correctness contradiction that cannot be resolved inside the implementation specifications without changing a frozen architectural invariant.

---

# 104. Post-Freeze Specifications

```text
SPEC 01
System Architecture

SPEC 02
Domain & Data Model

SPEC 03
Evidence / Proposition / Epistemic State

SPEC 04
Governance & Policy Engine

SPEC 05
Content Intelligence Runtime

SPEC 06
Evaluation Framework

SPEC 07
Measurement / Experimentation / Learning

SPEC 08
Security / Privacy / Rights

SPEC 09
V1A Decision Core

SPEC 10
V1B Learning Closure
```

---

# 105. Final Definition

**ContentOS is an evidence-grounded content operating system whose semantic knowledge, decision state, governance state, publication history and measurement history are represented through immutable entities or exact immutable revisions.**

**Evidence maps to immutable semantic Propositions through explicit Evidence–Proposition relationships, compatibility checks and immutable EvidenceAssessments. EpistemicStateVersions form a non-branching time-ordered history for each Proposition rather than mutating semantic meaning.**

**Audience understanding, Strategy, ContentArchitecture, Candidates, explicit and implied Assertions, validation results, applicability, risk, uncertainty and rights are explicit immutable decision inputs. Before a DecisionSnapshot can be frozen, ContentOS validates not only that every reference exists, but that all transitive references describe one internally consistent decision context.**

**Policy conflicts are represented by one canonical resolution state. Authorized override cannot exist merely as a label: it requires an explicit PolicyOverride authorization event. Human review may adjudicate frozen state, while material new information forces a new immutable state and new DecisionSnapshot.**

**DecisionRecord is the canonical owner of the final release decision. FinalContentPackage contains selected output references but cannot redefine release status or contradict the DecisionSnapshot, selected Candidate, Strategy, Architecture, risk or rights state.**

**Publication history is organized into non-branching, single-root, acyclic and strictly time-ordered PublicationLineages. Location identity belongs to the PublicationLineage, while each PublishedArtifact represents one immutable content state within that lineage.**

**Performance measurements and corrections are append-only and preserve exact publication lineage. Performance-derived evidence returns through the same Evidence → Proposition → Assessment → EpistemicState architecture without being allowed to prove unrelated factual claims.**

**When retention or deletion prevents complete historical reconstruction, ContentOS reports degraded replayability rather than rewriting history, retaining prohibited data or pretending exact reconstruction remains possible.**

---

# 106. Doctrine

```text
REFERENCE RESOLUTION
IS NOT ENOUGH.

REFERENCES MUST AGREE.

ONE DECISION
ONE CONSISTENT CONTEXT.

ONE CONCEPT
MAY HAVE MANY REVISIONS.

ONE REVISION
HAS ONE IMMUTABLE ID.

ONE MEANING
ONE PROPOSITION ID.

ONE ASSERTION
ONE ASSERTION ID.

ONE POLICY CONFLICT
ONE FINAL RESOLUTION.

AN AUTHORIZED OVERRIDE
REQUIRES AUTHORIZATION.

ONE RELEASE DECISION
ONE CANONICAL OWNER:
DECISION RECORD.

FINAL CONTENT PACKAGE
CANNOT REWRITE THE DECISION.

ONE PUBLICATION LOCATION
ONE PUBLICATION LINEAGE.

ONE LINEAGE
ONE ROOT.

ONE PREDECESSOR
AT MOST ONE DIRECT SUCCESSOR.

NO CYCLES.

TIME MOVES FORWARD.

ONE PROPOSITION
ONE LINEAR EPISTEMIC HISTORY.

DO NOT REWRITE HISTORY.

DO NOT STORE FUTURE KNOWLEDGE
INSIDE PAST OBJECTS.

EVERY SNAPSHOT REFERENCE
MUST RESOLVE.

EVERY SNAPSHOT RELATIONSHIP
MUST ALSO BE CONSISTENT.

COMPATIBLE
DOES NOT MEAN SUPPORTIVE.

ATTRIBUTED
DOES NOT MEAN CAUSED.

PERFORMANCE
DOES NOT PROVE PRODUCT FACTS.

REPLAYABILITY
DOES NOT OVERRIDE DATA RIGHTS.

NO MORE ARCHITECTURE
WITHOUT A DEMONSTRATED
CORRECTNESS FAILURE.

RUN THE FIXED SUITE.

FREEZE.

SPECIFY.

IMPLEMENT.
```

**This is ContentOS Blueprint v2.13.1 — FROZEN.**