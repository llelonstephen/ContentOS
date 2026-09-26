# ContentOS SPEC 09 — V1A Decision Core
## End-to-End Decision Integration, Snapshot Freeze, Release Decision & Final Package Closure
### Version 1.0 — Frozen V1A Decision Core

---

# 0. Status

```text
SPEC
SPEC 09 — V1A DECISION CORE

VERSION
1.0

SOURCE OF TRUTH
ContentOS Blueprint v2.13.1 — FROZEN
ContentOS SPEC 01 v1.1.3 — FROZEN
ContentOS SPEC 02 v1.0.6 — FROZEN
ContentOS SPEC 03 v1.0.1 — FROZEN
ContentOS SPEC 04 v1.0.2 — FROZEN
ContentOS SPEC 05 v1.0.1 — FROZEN
ContentOS SPEC 06 v1.0.1 — FROZEN
ContentOS SPEC 07 v1.0 — FROZEN
ContentOS SPEC 08 v1.0.1 — FROZEN

STATUS
FROZEN
```

Source precedence:

```text
BLUEPRINT
>
SPEC01
>
SPEC02
>
SPEC03
>
SPEC04
>
SPEC05
>
SPEC06
>
SPEC07
>
SPEC08
>
SPEC09
```

Source fingerprints:

```text
Blueprint v2.13.1
24e024bff59e5f5bce73172d82ca0c8a5fd696264d1498a3b8884cec55a95fa9

SPEC01 v1.1.3
cc74f045e6e1cd25f8ebe37e7db85bb66550b5cde5d5e99db1a098a0816e858d

SPEC02 v1.0.6
6cd0f47de653e260f35729dc4cb62ba0bd5155962eb84caa6a7570c4ba6313c6

SPEC03 v1.0.1
f532c6a75f267744f0d1e8fe1a7964e5c79e448eabae8445ca68eca03c5a02c5

SPEC04 v1.0.2
b8fd07453cde9556e4113bebd14b3abd467fc6f04b32714c15d9ddb3c6a48d7b

SPEC05 v1.0.1
d7b7470813f17da1bb50098ca46e52c6b3d69248ca9c8bfa4f24716a1be882e5

SPEC06 v1.0.1
8a3c0420fefda8dfed367f55d86f3f81375c5c2bbc7bad4e0800247e31a9cb47

SPEC07 v1.0
4e8691f85f3a811045cc10a59519314fd260a4fa343a25cf2ca7410ec12808ba

SPEC08 v1.0.1
7d86c1ebfba6d40073f7b7930d9446dde58cb21d8b221a008f525e4551109803
```

SPEC09 integrates frozen upstream behavior.

It does not redefine upstream semantics or canonical schemas.

---

# 1. Purpose

SPEC09 defines the executable V1A release-decision core.

Canonical end-to-end path:

```text
Run
↓
DecisionCycle
↓
Knowledge / Governance / Audience / Strategy / Content / Evaluation / Rights
↓
VERIFY REQUIRED DECISION-INPUT STAGES TERMINAL
↓
DecisionCycle OPEN → FREEZING
↓
materialize RunKnowledgeDelta
↓
select final GovernanceSnapshot
↓
build Draft DecisionSnapshot
↓
deterministic Snapshot Closure Validation
↓
set DecisionSnapshot.frozen_at
↓
ATOMIC SNAPSHOT FREEZE
↓
complete PolicyResult set
↓
conflict resolution
↓
human review / override where required
↓
DecisionRecord
↓
FinalContentPackage
```

SPEC09 closes integration behavior for:

```text
V1A dependency ordering
required-stage terminality
freeze admission
decision-input closure
DecisionSnapshot referential closure
temporal closure
exact config/revision closure
policy completeness
policy conflict finality
human review routing
DecisionRecord admission
release-status mapping
selected-candidate closure
FinalContentPackage closure
decision/package immutability
idempotency
concurrency
stale-worker rejection
historical replay
failure semantics
```

---

# 2. Non-Goals

SPEC09 does not redefine:

```text
evidence semantics
proposition identity
epistemic derivation
governance applicability
policy DSL
content generation
assertion validation
risk methodology
rights interpretation
measurement methodology
learning logic
publication lineage
```

Those are owned by SPEC03–08.

SPEC09 integrates them.

---

# 3. V1A Decision Doctrine

```text
ONE DECISION
ONE CONSISTENT CONTEXT.

REFERENCE RESOLUTION
IS NOT ENOUGH.

REFERENCES
MUST AGREE.

FREEZE
IS A BARRIER.

NO NEW INPUT
AFTER FREEZING.

SNAPSHOT
IS THE POLICY INPUT BOUNDARY.

POLICY COMPLETENESS
PRECEDES CONFLICT RESOLUTION.

CONFLICT FINALITY
PRECEDES DECISION.

HUMAN REVIEW
MAY ADJUDICATE
FROZEN STATE.

MATERIAL NEW INFORMATION
CREATES A NEW CYCLE.

DECISION RECORD
OWNS RELEASE STATUS.

FINAL CONTENT PACKAGE
CANNOT REWRITE THE DECISION.

BLOCKED
IS NOT RELEASE.

HUMAN_REVIEW_REQUIRED
IS NOT RELEASE.

READY_WITH_WARNINGS
CANNOT DOWNGRADE
A HARD BLOCK.

NO HIDDEN POST-SNAPSHOT STATE.

NO CURRENT/LATEST/ACTIVE
IN HISTORICAL DECISIONS.

NO STALE-WORKER COMMITS.

NO MUTABLE DECISION HISTORY.
```

---

# 4. Canonical Entities Used

SPEC09 uses:

```text
Run
DecisionCycle
StageExecution

BaselineKnowledgeSnapshot
RunKnowledgeDelta
GovernanceSnapshot
RunConfig
TaskContractRevision
AudienceState

KnowledgeGap
ResearchTrace
StrategyHypothesis
ContentArchitecture
ContentCandidate

ContentAssertion
AssertionValidationResult
CompositeImpressionAssessment
QualitativeEvaluation
ApplicabilityAssessment
RiskAssessment
UncertaintyAssessment
RightsCheck

DecisionSnapshot

PolicyResult
PolicyConflictResolution
PolicyOverride
HumanReviewRecord

DecisionRecord
FinalContentPackage
```

SPEC09 introduces no new canonical domain entity.

---

# 5. Canonical `.md` Authority Rule

SPEC09 follows the authoritative frozen Blueprint `.md` and SPEC02/04 contracts.

It does NOT import non-canonical fields found only in alternate `.txt`/patch variants, including:

```text
StrategyGateResult
strategy_gate_result_ids
decision_key
supersedes_decision_id
selected_action_type
human_review_ids
override_ids
knowledge_gap_resolution_ids
```

when those fields are absent from the frozen canonical `.md` / SPEC02 schema.

Strategy Gate remains a deterministic process defined by SPEC05.

---

# 6. DecisionSnapshot Contract

Canonical schema:

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

Immutable.

---

# 7. DecisionSnapshot Meaning

DecisionSnapshot is the exact frozen decision-input state.

It answers:

```text
WHAT DID THE SYSTEM KNOW?

WHICH GOVERNANCE STATE APPLIED?

WHICH CONFIGS WERE PINNED?

WHICH AUDIENCE / STRATEGY / CONTENT EXISTED?

WHICH ASSERTIONS / VALIDATIONS EXISTED?

WHICH RISKS / UNCERTAINTIES / RIGHTS EXISTED?

WHAT WAS THE FINAL KNOWLEDGE BOUNDARY?
```

Policy execution may consume only this snapshot and its frozen transitive closure.

---

# 8. Snapshot Direct-Reference Rule

Every direct ID/reference in DecisionSnapshot must resolve to the correct immutable entity or revision.

A missing direct reference:

```text
SNAPSHOT_INVALID
```

No policy execution.

---

# 9. Referential Consistency Rule

Successful reference resolution is necessary but insufficient.

All transitive relationships must describe one coherent decision context.

Example:

```text
Candidate resolves
Strategy resolves
Architecture resolves
```

but if Candidate.strategy_id disagrees with Architecture.strategy_id:

```text
SNAPSHOT_INVALID
```

---

# 10. Task / Program Closure

For non-standalone Task:

```text
Task.program_revision_id
=
BaselineKnowledgeSnapshot.program_revision_id
```

For standalone Task:

```text
Task.program_revision_id = null
```

and:

```text
BaselineKnowledgeSnapshot.program_revision_id = null
```

unless future frozen architecture explicitly adds informational-only program semantics.

---

# 11. Task / Metric Closure

Task metric revision IDs used for the decision must resolve to exact immutable MetricDefinitionRevisions in the pinned decision context.

No current metric lookup.

---

# 12. Task / Channel Closure

BaselineKnowledgeSnapshot must pin the exact applicable ChannelProfileRevision for:

```text
Task.channel
```

Task channel and pinned channel context must agree.

---

# 13. Audience Closure

Require:

```text
AudienceState.task_revision_id
=
DecisionSnapshot.task_revision_id
```

Normal release requires:

```text
AudienceState.state_stage = FINAL_FOR_DECISION
```

---

# 14. Strategy Closure

Every StrategyHypothesis included in the snapshot must satisfy:

```text
Strategy.task_revision_id
=
DecisionSnapshot.task_revision_id
```

and:

```text
Strategy.audience_state_id
=
DecisionSnapshot.audience_state_id
```

---

# 15. Strategy Gate Closure

SPEC09 does not create StrategyGateResult.

For any Strategy allowed to reach normal release path:

```text
SPEC05 deterministic Strategy Gate
MUST have admitted that Strategy
```

The admission outcome/reasons must be reconstructable from StageExecution / stage result metadata.

A blocked/review-required Strategy cannot silently appear as release-admitted.

---

# 16. Architecture Closure

For every ContentArchitecture in the decision path:

```text
Architecture.task_revision_id
=
DecisionSnapshot.task_revision_id
```

and:

```text
Architecture.strategy_id
∈
DecisionSnapshot.strategy_ids
```

---

# 17. Candidate Closure

For every ContentCandidate:

```text
Candidate.task_revision_id
=
DecisionSnapshot.task_revision_id
```

and:

```text
Candidate.strategy_id
∈
DecisionSnapshot.strategy_ids

Candidate.architecture_id
∈
DecisionSnapshot.architecture_ids
```

The referenced Architecture must itself belong to Candidate.strategy_id.

---

# 18. Candidate / RunConfig Closure

For every Candidate in snapshot:

```text
Candidate.run_config_id
=
DecisionSnapshot.run_config_id
```

No candidate generated under another RunConfig may be silently imported.

---

# 19. Assertion Closure

Every ContentAssertion in DecisionSnapshot must refer to a Candidate included in:

```text
DecisionSnapshot.candidate_ids
```

No assertion from a foreign Candidate.

---

# 20. Assertion Validation Closure

Every AssertionValidationResult in snapshot must:

```text
reference an Assertion in snapshot
```

and every mapped Proposition/link required by the validation must resolve through frozen knowledge state.

---

# 21. Final Assertion Selection

For the selected release Candidate:

```text
every material final Assertion
→ exactly one selected final AssertionValidationResult
```

inside the release snapshot.

No missing material validation.

No competing final validation state for one Assertion.

---

# 22. Composite Closure

Every CompositeImpressionAssessment in snapshot must reference a Candidate in snapshot.

All input/implied Assertion IDs used by the final composite state must be included in the snapshot.

---

# 23. Composite Stabilization

Release path requires composite closure to have reached a terminal state under SPEC06.

New implied Assertions discovered by composite analysis must have re-entered normal validation.

---

# 24. Qualitative Evaluation Closure

Every QualitativeEvaluation in snapshot must:

```text
reference Candidate in snapshot
reference exact immutable EvalContractRevision
reference exact pinned EvaluatorConfig
```

when required by SPEC06.

---

# 25. Applicability Closure

Every final ApplicabilityAssessment used by release decision must:

```text
task_revision_id
=
DecisionSnapshot.task_revision_id
```

and subject revisions must resolve to the pinned governance context.

Required final stages:

```text
PRE_GENERATION_FINAL
CONTENT_LEVEL
```

as applicable.

---

# 26. Rights Closure

Every RightsCheck in snapshot must:

```text
rights_policy_id
∈
GovernanceSnapshot.rights_policy_ids
```

and its subject must resolve to decision-relevant immutable state.

---

# 27. Risk Closure

Every RiskAssessment in snapshot must target state reachable from the frozen decision context.

No selected Candidate may import risk state from another Candidate unless the assessment explicitly targets a shared upstream subject.

---

# 28. Uncertainty Closure

If `uncertainty_assessment_id` exists:

```text
all subject_refs
must resolve within frozen decision context.
```

Material assumptions/uncertainties required by upstream specs must not be omitted.

---

# 29. KnowledgeGap Closure

For normal release:

```text
no blocking KnowledgeGap
may remain unresolved
```

A blocking gap forces:

```text
HUMAN_REVIEW_REQUIRED
or
BLOCKED
```

and prevents READY / READY_WITH_WARNINGS.

---

# 30. ResearchTrace Closure

Every ResearchTrace included in snapshot must resolve to exact retriever/tool configuration used by the run when required by SPEC03.

No current retriever lookup.

---

# 31. Evaluator / RunConfig Closure

Every run-created:

```text
AssertionValidationResult
CompositeImpressionAssessment
QualitativeEvaluation
```

used in the snapshot must reference evaluator revisions pinned by:

```text
DecisionSnapshot.run_config_id
```

---

# 32. GovernanceSnapshot Closure

DecisionSnapshot must point to one exact immutable GovernanceSnapshot.

Policy evaluation expected set is derived from:

```text
GovernanceSnapshot.policy_revision_ids
```

No policy discovered after snapshot freeze may join the old decision.

---

# 33. RunKnowledgeDelta Closure

DecisionSnapshot pins one exact immutable RunKnowledgeDelta.

RunKnowledgeDelta is not mutable after materialization.

DecisionCycleBinding does not duplicate delta truth.

---

# 34. DecisionCycleBinding Rule

Per SPEC02 final freeze:

```text
DecisionCycleBinding
stores only
decision_cycle_id → decision_snapshot_id
```

RunKnowledgeDelta / GovernanceSnapshot binding is derived through DecisionSnapshot.

SPEC09 must not recreate duplicate cycle-binding truth.

---

# 35. Required Stage Terminality

DecisionCycle may enter FREEZING only after every required decision-input StageExecution is terminal.

No required stage may remain:

```text
PENDING
CLAIMED
RUNNING
FAILED_RETRYABLE
```

---

# 36. Required Successful Outputs

Freeze admission requires all required successful outputs to exist.

A stage being terminal does not by itself mean the decision is valid.

Example:

```text
FAILED_PERMANENT
```

may permit freeze only when that stage's explicit failure semantics allow a non-release decision.

---

# 37. No Pending Human Action at Freeze Admission

A required pre-freeze human action cannot remain pending when the DecisionCycle enters FREEZING.

Post-snapshot adjudication belongs to the frozen-snapshot governance path.

---

# 38. Entering FREEZING

Canonical transition:

```text
lock DecisionCycle

verify status = OPEN

verify required decision-input stages terminal

verify required outputs

verify no blocking unresolved gap

verify no required writable worker claim

increment cycle fencing epoch

OPEN → FREEZING
```

Atomic compare-and-swap or equivalent.

---

# 39. FREEZING Is a Write Barrier

After:

```text
DecisionCycle = FREEZING
```

no new upstream decision input may join that cycle.

Rejected examples:

```text
late Candidate
late RightsCheck
late RiskAssessment
late AssertionValidationResult
late GovernanceSnapshot
late AudienceState
```

---

# 40. Pre-Freeze Worker Invalidity

Entering FREEZING increments the cycle fencing epoch.

Workers carrying the prior epoch are stale.

Their later canonical commit must fail.

---

# 41. Freeze Materialization

After writable decision inputs close:

```text
materialize RunKnowledgeDelta

select exact final GovernanceSnapshot

resolve final AudienceState

select decision-time EpistemicStateVersions

resolve final Strategy / Architecture / Candidate

resolve final validation/evaluation/risk/rights state

build Draft DecisionSnapshot
```

No new input may join during this phase.

---

# 42. Draft Snapshot Is Not Frozen Truth

Before Atomic Snapshot Freeze, the draft structure is internal workflow state.

It must not be consumed by the Policy Engine as a frozen snapshot.

---

# 43. Snapshot Closure Validator

The validator must deterministically check at minimum:

```text
direct references

transitive references

Task / Program

Task / Channel

Task / Metric

Audience / Task

Strategy / Audience / Task

Architecture / Strategy

Candidate / Architecture / Strategy

Candidate / RunConfig

Assertion / Candidate

Validation / Assertion

Composite / Candidate

Evaluator / RunConfig

EvalContract

Applicability / Governance

KnowledgeGap state

Rights state

Risk / Uncertainty

temporal cutoffs

no post-cutoff state
```

---

# 44. Temporal Snapshot Closure

For normal decision:

```text
knowledge_cutoff_time
=
DecisionSnapshot.frozen_at
```

unless the Task requires an earlier explicit cutoff.

Stage-local immutable cutoffs may be earlier.

All must satisfy:

```text
stage knowledge_cutoff_time
<=
DecisionSnapshot.frozen_at
```

---

# 45. No Future Runtime Input

Every runtime input referenced by DecisionSnapshot must have been created/known no later than:

```text
DecisionSnapshot.frozen_at
```

No future knowledge in past snapshot.

---

# 46. Epistemic Temporal Closure

Every decision-relevant EpistemicStateVersion must satisfy:

```text
known_from
<=
snapshot knowledge cutoff
```

---

# 47. Applicability Target-Time Closure

Final applicability assessments must use the exact resolved Task target valid time.

Resolved target:

```text
Task.intended_publication_time
```

when present, otherwise:

```text
DecisionSnapshot.frozen_at
```

---

# 48. Rights Target-Time Closure

Publication/redistribution RightsChecks must use the same resolved target time.

No temporal mismatch between governance and rights release state.

---

# 49. Closure Failure

Any closure failure yields:

```text
SNAPSHOT_INVALID
```

The runtime must not:

```text
freeze snapshot
run release policy
create DecisionRecord
create releasable package
```

from that invalid state.

---

# 50. Atomic Snapshot Freeze

Canonical transaction:

```text
BEGIN

lock DecisionCycle

verify DecisionCycle = FREEZING

verify fencing epoch

verify required stages terminal

run final closure validation

set final DecisionSnapshot.frozen_at

insert immutable DecisionSnapshot

bind DecisionCycle → DecisionSnapshot

set DecisionCycle = FROZEN

write outbox/audit

COMMIT
```

No partially frozen visible state.

---

# 51. Freeze Idempotency

Exact retry of Atomic Snapshot Freeze must converge on one canonical snapshot effect for the exact freeze identity.

A retry may return existing frozen snapshot.

It must not create two competing snapshots for one exact freeze attempt.

---

# 52. Post-Freeze Immutability

After freeze:

```text
DecisionSnapshot
DecisionCycle frozen decision binding
```

cannot be mutated to include new decision input.

New material information requires a successor DecisionCycle.

---

# 53. Policy Engine Admission

Policy Engine may start only after DecisionSnapshot is frozen.

Inputs:

```text
exact frozen DecisionSnapshot
exact GovernanceSnapshot.policy_revision_ids
exact pinned DecisionPolicyRevision state
```

No live runtime state.

---

# 54. Expected Policy Set

For V1 release evaluation:

```text
expected policy set
=
GovernanceSnapshot.policy_revision_ids
```

---

# 55. Policy Completeness

Before conflict detection:

```text
PolicyResult.policy_revision_id set
MUST equal expected policy set
```

Exact identity equality.

Not count-only.

---

# 56. Non-Triggered Policies

A non-triggered policy still requires a terminal PolicyResult.

Missing PolicyResult is never PASS.

---

# 57. Policy Result Uniqueness

Exactly one terminal PolicyResult per:

```text
(snapshot_id, policy_revision_id)
```

for V1 release evaluation.

---

# 58. Policy Failure

If a required policy cannot produce a terminal valid result:

```text
DO NOT continue to final conflict resolution
DO NOT create DecisionRecord
```

Operational failure remains outside DecisionRecord until governance closure exists.

---

# 59. Conflict Detection Admission

Conflict detection runs only after complete policy set exists.

Never on partial results.

---

# 60. Conflict Identity

Material conflict identity uses deterministic `conflict_key` per SPEC04.

Same conflict may not produce multiple competing final resolutions.

---

# 61. Conflict Finality

Every material detected conflict must have:

```text
exactly one final PolicyConflictResolution
```

before any DecisionRecord is created.

This applies to:

```text
READY
READY_WITH_WARNINGS
HUMAN_REVIEW_REQUIRED
BLOCKED
```

No partial-governance exception.

---

# 62. ESCALATE Semantics

`ESCALATE` is not release authorization.

A READY/READY_WITH_WARNINGS decision may not retain unresolved material conflict requiring escalation.

---

# 63. Authorized Override

A conflict resolution using:

```text
AUTHORIZED_OVERRIDE
```

requires a valid PolicyOverride satisfying:

```text
same snapshot
override_allowed
authority requirements
scope constraints
affected PolicyResults
```

---

# 64. Non-Override Resolution

Non-override conflict resolution must not carry an override ID.

No fake override lineage.

---

# 65. HumanReviewRecord Contract Use

SPEC09 consumes SPEC04 HumanReviewRecord.

A referenced review must belong to:

```text
DecisionRecord.snapshot_id
```

---

# 66. ADJUDICATION_ONLY

ADJUDICATION_ONLY:

```text
judges frozen snapshot only
```

It may not add material new factual state.

`introduced_information_refs` must be empty.

---

# 67. NEW_INFORMATION_INTRODUCED

If review introduces material new information:

```text
DO NOT continue final decision on old snapshot
```

Route:

```text
old snapshot stays frozen
↓
new DecisionCycle
↓
new upstream immutable state
↓
revalidate affected stages
↓
new snapshot
↓
full policy rerun
```

---

# 68. Review Cannot Mutate Snapshot

Reviewer may not edit:

```text
DecisionSnapshot
PolicyResult
ApplicabilityAssessment
RiskAssessment
RightsCheck
ContentCandidate
```

Review creates new immutable records only.

---

# 69. DecisionRecord Contract

Canonical schema:

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

# 70. Release Status Vocabulary

```text
READY
READY_WITH_WARNINGS
HUMAN_REVIEW_REQUIRED
BLOCKED
```

DecisionRecord is the only canonical owner.

---

# 71. DecisionRecord Admission

DecisionRecord may be created only after:

```text
frozen DecisionSnapshot

complete PolicyResult set

all material conflicts have final resolution

required Human Review complete when applicable

required valid override exists when applicable
```

No partial-governance exception.

---

# 72. Decision Task Closure

Require:

```text
DecisionRecord.task_revision_id
=
DecisionSnapshot.task_revision_id
```

---

# 73. Decision Snapshot Closure

Require:

```text
DecisionRecord.snapshot_id
=
the frozen DecisionSnapshot used by policy/review
```

No decision may point to an unfrozen or foreign snapshot.

---

# 74. Decision PolicyResult Closure

Require:

```text
DecisionRecord.policy_result_ids
=
complete terminal PolicyResult set
for snapshot
```

Exact set equality.

---

# 75. Decision Conflict Closure

Every DecisionRecord.conflict_resolution_id must:

```text
belong to DecisionRecord.snapshot_id
```

No two referenced resolutions may share one `conflict_key`.

Every material detected conflict must be represented by its unique final resolution.

---

# 76. Decision Human Review Closure

If:

```text
human_review_id != null
```

then:

```text
HumanReviewRecord.snapshot_id
=
DecisionRecord.snapshot_id
```

No review from another snapshot.

---

# 77. Override Lineage Ownership

PolicyOverride lineage is owned by PolicyConflictResolution.

DecisionRecord does not duplicate override ownership.

---

# 78. selected_action

`selected_action` is an action code only.

It must not embed:

```text
candidate_id
snapshot_id
policy_result_id
other entity IDs
```

Entity selection belongs in typed fields.

---

# 79. selected_candidate_id

If DecisionRecord selects generated content for release:

```text
selected_candidate_id MUST NOT be null
```

and:

```text
selected_candidate_id
∈
DecisionSnapshot.candidate_ids
```

---

# 80. READY

READY means normal release authorization exists under the frozen decision state.

It requires:

```text
release gates satisfied
selected candidate present
selected_action expresses release
```

---

# 81. READY_WITH_WARNINGS

READY_WITH_WARNINGS is releasable only with non-blocking warnings.

It may not downgrade:

```text
hard policy deny
BLOCKED rights
REVIEW_REQUIRED rights
material unsupported assertion
INVALID composite
required hard-gate failure
blocking KnowledgeGap
unresolved material conflict
```

into warning-only state.

---

# 82. HUMAN_REVIEW_REQUIRED

HUMAN_REVIEW_REQUIRED is not releasable.

Selected action must represent review/escalation semantics.

No FinalContentPackage may be treated as releasable solely because content exists.

---

# 83. BLOCKED

BLOCKED is not release authorization.

It may represent:

```text
hard deny
required revision
unresolved blocking condition
```

depending on reason/action semantics.

---

# 84. Selected Candidate Release Gates

For READY / READY_WITH_WARNINGS, selected Candidate must satisfy all frozen release gates.

At minimum:

```text
Strategy admitted by deterministic Strategy Gate

no unresolved blocking KnowledgeGap

no material final AssertionValidationResult in:
OVERCLAIM
UNSUPPORTED
CONTRADICTORY

SUPPORTED_WITH_QUALIFICATION requirements satisfied

final CompositeImpressionAssessment release-compatible

required QualitativeEvaluations complete

required hard gates satisfied

required ApplicabilityAssessments complete

required RightsChecks release-compatible

material Risk / Uncertainty represented

no unresolved hard policy deny

all material conflicts finalized
```

---

# 85. Composite Release Compatibility

SPEC06 canonical composite statuses:

```text
STABLE
STABLE_WITH_REQUIREMENTS
INVALID
REVIEW_REQUIRED
```

READY path requires no unmet composite requirement.

INVALID blocks normal release.

REVIEW_REQUIRED requires review.

---

# 86. Qualitative Hard Gates

A failed required hard gate cannot be averaged away.

Decision admission consumes the exact EvalContract semantics.

---

# 87. Rights Release Closure

For required release uses:

```text
RightsCheck.status = BLOCKED
→ normal release forbidden

RightsCheck.status = REVIEW_REQUIRED
→ review required

ALLOWED_WITH_REQUIREMENTS
→ requirements must already be satisfied
```

---

# 88. Risk / Uncertainty Release Closure

SPEC09 does not invent universal risk thresholds.

It requires all material risk/uncertainty state required by upstream policy/evaluation context to be present and consumed.

Policy owns final governance effect.

---

# 89. FinalContentPackage Contract

Canonical schema:

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

Immutable.

---

# 90. Package Does Not Own Release Status

FinalContentPackage contains no canonical:

```text
release_status
```

Consumers derive release status from:

```text
DecisionRecord
```

---

# 91. Package Creation Rule

FinalContentPackage may be created only after DecisionRecord exists.

Package cannot cause DecisionRecord.

DecisionRecord causes package creation.

---

# 92. Package Decision Closure

Require:

```text
Package.decision_id
=
DecisionRecord.decision_id

Package.decision_snapshot_id
=
DecisionRecord.snapshot_id

Package.task_revision_id
=
DecisionRecord.task_revision_id
```

---

# 93. Package Candidate Closure

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

# 94. Package Decision Selection Closure

If DecisionRecord.selected_candidate_id is non-null:

```text
Package.selected_candidate_id
=
DecisionRecord.selected_candidate_id
```

No candidate substitution.

---

# 95. Package Strategy Closure

Let:

```text
C = Package.selected_candidate_id
```

Require:

```text
Package.strategy_id
=
C.strategy_id
```

---

# 96. Package Architecture Closure

Require:

```text
Package.architecture_id
=
C.architecture_id
```

No alternate architecture.

---

# 97. Package Audience Closure

Let:

```text
S = Package.strategy_id
```

Require:

```text
Package.audience_state_id
=
S.audience_state_id
=
DecisionSnapshot.audience_state_id
```

---

# 98. Package Assertion Closure

Every Package.assertion_id must:

```text
belong to selected Candidate
be included in frozen DecisionSnapshot
belong to final validated assertion state
```

No assertion from another Candidate.

---

# 99. Package Proposition Closure

Every Package.proposition_id must be reachable through at least one:

```text
included AssertionPropositionLink
or
selected Strategy.required_proposition_ids
```

under authoritative `.md` closure.

No unrelated Proposition.

---

# 100. Package Risk Closure

Require:

```text
Package.risk_assessment_ids
⊆
DecisionSnapshot.risk_assessment_ids
```

No post-decision RiskAssessment.

---

# 101. Package Rights Closure

Require:

```text
Package.rights_check_ids
⊆
DecisionSnapshot.rights_check_ids
```

No post-decision RightsCheck.

---

# 102. Package Warning Semantics

`warnings` are derived presentation from frozen decision state.

They must not:

```text
change release_status
hide hard blocks
invent new policy truth
omit material frozen warning semantics
```

---

# 103. BLOCKED Package

A package may exist for:

```text
audit
review
revision workflow
```

even if DecisionRecord.release_status = BLOCKED.

Such package is:

```text
NOT RELEASABLE
```

---

# 104. HUMAN_REVIEW_REQUIRED Package

A package associated with HUMAN_REVIEW_REQUIRED is also not releasable.

It may support review workflow only.

---

# 105. Releasable Package

A package is releasable only when its DecisionRecord has:

```text
READY
or
READY_WITH_WARNINGS
```

and all package closure rules pass.

---

# 106. Package Immutability

FinalContentPackage is immutable.

Correction/repackaging creates a new package if needed.

Old package remains historical.

---

# 107. No Post-Decision Injection

After DecisionRecord:

```text
new RiskAssessment
new RightsCheck
new AssertionValidationResult
new Candidate
```

cannot be silently injected into an old package/decision.

Material new state requires appropriate new decision workflow.

---

# 108. Decision / Package Idempotency

Exact retry of:

```text
DecisionRecord creation
FinalContentPackage creation
```

must converge on one canonical effect for the exact idempotency identity.

No duplicate canonical history from transport retry.

---

# 109. Decision Idempotency Inputs

Operational identity should include:

```text
snapshot_id
decision_type
complete policy_result_ids
conflict_resolution_ids
human_review_id if any
selected_action
selected_candidate_id if any
canonical decision-input hash
```

Different material decision state is a new semantic event.

---

# 110. Package Idempotency Inputs

Operational package identity should include:

```text
decision_id
decision_snapshot_id
selected_candidate_id
strategy_id
architecture_id
audience_state_id
final assertion/proposition refs
risk/rights refs
canonical package-input hash
```

---

# 111. Decision Concurrency

Concurrent workers trying to create the same exact decision effect:

```text
one canonical insert wins
others return/reload canonical result
```

No duplicate DecisionRecord from retry race.

---

# 112. Package Concurrency

Concurrent exact package creation must similarly converge.

No two conflicting packages from one exact package identity.

---

# 113. Human New Information Concurrency

If one reviewer introduces material new information while another old-snapshot decision worker continues:

```text
old worker must not consume new info
old snapshot remains frozen
new DecisionCycle owns the new information path
```

---

# 114. Stale Worker Protection

Every asynchronous decision-input commit before freeze follows SPEC01 fencing.

Every stale pre-freeze worker must fail.

Post-snapshot governance workers must also use stage/idempotency authority appropriate to their workflow.

---

# 115. Freeze Race

If worker response arrives during/after OPEN → FREEZING:

```text
pre-freeze epoch write rejected
```

No late candidate/rights/evaluation state can enter the snapshot.

---

# 116. Policy Race

A policy activated after snapshot freeze cannot join the old expected set.

The old snapshot uses:

```text
GovernanceSnapshot.policy_revision_ids
```

only.

---

# 117. Review Race

ADJUDICATION_ONLY review may act only on exact frozen snapshot.

If material new information is discovered concurrently:

```text
new-information path wins for that new fact
old frozen-state adjudication cannot import it
```

---

# 118. Failure Taxonomy

Operational reason codes may include:

```text
FREEZE_STAGE_NOT_TERMINAL
FREEZE_REQUIRED_OUTPUT_MISSING
FREEZE_BLOCKING_GAP
FREEZE_PENDING_HUMAN_ACTION
FREEZE_STALE_WORKER
SNAPSHOT_DIRECT_REF_INVALID
SNAPSHOT_TRANSITIVE_CLOSURE_INVALID
SNAPSHOT_TEMPORAL_CLOSURE_INVALID
SNAPSHOT_TASK_PROGRAM_MISMATCH
SNAPSHOT_CHANNEL_MISMATCH
SNAPSHOT_CANDIDATE_CLOSURE_INVALID
SNAPSHOT_VALIDATION_CLOSURE_INVALID
SNAPSHOT_RIGHTS_CLOSURE_INVALID
SNAPSHOT_RISK_CLOSURE_INVALID
POLICY_SET_INCOMPLETE
POLICY_RESULT_DUPLICATE
POLICY_CONFLICT_UNRESOLVED
OVERRIDE_INVALID
REVIEW_SNAPSHOT_MISMATCH
DECISION_ADMISSION_INCOMPLETE
DECISION_CANDIDATE_INVALID
DECISION_RELEASE_GATE_FAILED
PACKAGE_DECISION_MISMATCH
PACKAGE_CANDIDATE_MISMATCH
PACKAGE_STRATEGY_MISMATCH
PACKAGE_ASSERTION_CLOSURE_INVALID
PACKAGE_RIGHTS_CLOSURE_INVALID
STALE_DECISION_CYCLE
```

These are operational codes, not new canonical domain enums.

---

# 119. Fail-Closed Conditions

Fail closed when:

```text
required stage not terminal
required output missing
blocking KnowledgeGap unresolved
snapshot reference missing
transitive closure disagreement
post-cutoff state present
candidate/runconfig mismatch
assertion/validation mismatch
rights mismatch
risk/uncertainty mismatch
policy set incomplete
conflict unresolved
override invalid
review incomplete
selected candidate outside snapshot
release gate failed
package contradicts decision
```

Fail closed means:

```text
do not produce a releasable decision/package
```

---

# 120. Historical Replay

Historical replay reads exact:

```text
DecisionSnapshot
PolicyResults
ConflictResolutions
HumanReviewRecord
DecisionRecord
FinalContentPackage
```

and exact referenced revisions/entities.

No CURRENT/LATEST/ACTIVE substitution.

---

# 121. Replay With Deletion

If retention/deletion degraded historical state:

```text
report ReplayabilityStatus
```

Do not fabricate missing state.

DecisionRecord/package history remains immutable to the extent lawfully retained.

---

# 122. Explainability

For any V1A DecisionRecord, system should be able to answer from canonical state:

```text
what Task was decided?
what knowledge/governance/config snapshot was frozen?
what AudienceState was used?
which Strategies/Candidates existed?
which Candidate was selected?
what Assertions were validated?
what risks/uncertainty existed?
what rights checks applied?
which policies ran?
which conflicts existed?
how were conflicts resolved?
was Human Review used?
why is release READY / WARNING / REVIEW / BLOCKED?
which package was produced?
```

No hidden decision rationale outside canonical refs/reason codes.

---

# 123. Fixed Adversarial Test Suite

The following suite is locked for SPEC09 v1.0 audit.

```text
01 historical revision resolves CURRENT/LATEST
02 DecisionSnapshot direct ref missing
03 resolved refs disagree transitively
04 Task program differs from Baseline program
05 standalone Task carries Program revision
06 Task metric revision outside pinned metric context
07 Task channel mismatches pinned ChannelProfile
08 AudienceState belongs to another Task
09 normal release uses non-FINAL_FOR_DECISION AudienceState
10 Strategy belongs to wrong AudienceState

11 Strategy belongs to wrong Task
12 blocked Strategy treated as admitted
13 Architecture references foreign Strategy
14 Candidate references foreign Strategy
15 Candidate references foreign Architecture
16 Candidate run_config_id differs from snapshot
17 Assertion belongs to Candidate outside snapshot
18 AssertionValidationResult references foreign Assertion
19 material selected Assertion has no final validation result
20 two competing final validation results selected for one Assertion

21 implied material Assertion absent from snapshot
22 final Composite references Assertion outside snapshot
23 composite closure not stabilized/reviewed but snapshot freezes
24 QualitativeEvaluation references foreign Candidate
25 evaluator revision not pinned in RunConfig
26 EvalContract missing
27 ApplicabilityAssessment belongs to wrong Task
28 applicability subject outside GovernanceSnapshot
29 RiskAssessment references unreachable subject
30 RightsCheck policy absent from GovernanceSnapshot

31 RightsCheck subject outside frozen decision state
32 RightsCheck target time differs from Task target
33 stage knowledge cutoff after snapshot frozen_at
34 EpistemicState known_from after snapshot cutoff
35 future-created runtime input included in snapshot
36 blocking KnowledgeGap remains unresolved
37 ResearchTrace uses unpinned retriever/config
38 required decision-input stage still RUNNING
39 required stage terminal but required output missing
40 pending required human action ignored at FREEZING

41 OPEN→FREEZING does not bump cycle epoch
42 stale pre-freeze worker commits after FREEZING
43 new Candidate commits while cycle FREEZING
44 draft snapshot consumed by Policy Engine before atomic freeze
45 closure failure still inserts frozen snapshot
46 freeze retry creates second competing snapshot
47 DecisionCycleBinding duplicates GovernanceSnapshot truth
48 post-freeze GovernanceSnapshot swapped
49 post-freeze candidate appended to snapshot
50 policy activated after freeze joins old expected set

51 expected policy omitted from evaluation
52 non-triggered policy result omitted
53 duplicate PolicyResult for same snapshot/policy
54 policy completeness checked by count only
55 conflict detection runs before policy set complete
56 same conflict gets two final resolutions
57 conflict resolution belongs to another snapshot
58 AUTHORIZED_OVERRIDE lacks valid PolicyOverride
59 non-overridable policy overridden
60 ESCALATE treated as release authorization

61 DecisionRecord created before complete policy set
62 DecisionRecord created before all material conflicts finalized
63 DecisionRecord omits inconvenient PolicyResult
64 DecisionRecord PolicyResult belongs to another snapshot
65 DecisionRecord conflict resolution belongs to another snapshot
66 two referenced conflict resolutions share conflict_key
67 HumanReviewRecord belongs to another snapshot
68 ADJUDICATION_ONLY imports new factual info
69 NEW_INFORMATION_INTRODUCED continues old-snapshot release
70 reviewer mutates frozen snapshot

71 READY has no selected_candidate_id
72 READY selected candidate outside snapshot
73 READY_WITH_WARNINGS downgrades hard block
74 BLOCKED treated as release authorization
75 HUMAN_REVIEW_REQUIRED treated as releasable
76 selected_action embeds candidate ID
77 package created before DecisionRecord
78 package selected Candidate differs from DecisionRecord
79 package Strategy/Architecture/Audience disagree with selected Candidate
80 package injects post-decision Assertion/Risk/Rights state
```

Expected for freeze:

```text
80 / 80
PRESERVE INVARIANTS
```

No additional freeze blocker may be introduced after suite lock unless a concrete contradiction against Blueprint v2.13.1 or SPEC01–08 frozen contracts is demonstrated.

---

# 124. Static Contract Preflight

SPEC09 freeze audit must check exactly:

```text
01 no new canonical domain entity invented
02 canonical DecisionSnapshot fields preserved
03 no StrategyGateResult introduced
04 canonical DecisionRecord fields preserved
05 no decision_key/supersession fields imported from non-authoritative variant
06 canonical FinalContentPackage fields preserved
07 DecisionRecord remains sole release-status owner
08 FinalContentPackage has no release_status truth
09 required stage terminality precedes FREEZING
10 OPEN→FREEZING bumps fencing epoch
11 FREEZING rejects new decision-input writes
12 RunKnowledgeDelta materialized immutably
13 one final GovernanceSnapshot selected
14 direct snapshot references must resolve
15 transitive snapshot references must agree
16 Task/Program closure preserved
17 Task/Channel closure preserved
18 Audience/Task/final-stage closure preserved
19 Strategy/Audience/Task closure preserved
20 Architecture/Strategy closure preserved
21 Candidate/Strategy/Architecture/RunConfig closure preserved
22 Assertion/Candidate closure preserved
23 Validation/Assertion closure preserved
24 Composite implied-assertion closure preserved
25 Evaluator/RunConfig and EvalContract closure preserved
26 Applicability/Governance closure preserved
27 Risk/Uncertainty closure preserved
28 Rights/Governance/target-time closure preserved
29 blocking KnowledgeGap cannot normal-release
30 no post-cutoff state in snapshot
31 snapshot freeze is atomic
32 PolicyResult expected set is complete exact identity set
33 PolicyResult uniqueness preserved
34 conflict detection waits for policy completeness
35 one final resolution per conflict_key
36 valid override required for AUTHORIZED_OVERRIDE
37 Human Review new info creates new cycle/snapshot
38 DecisionRecord admission requires full governance closure
39 selected release Candidate belongs to snapshot and passes release gates
40 FinalContentPackage closes over DecisionRecord/snapshot/Candidate state
```

Freeze target:

```text
40 / 40 PASS
```

---

# 125. Acceptance Criteria

SPEC09 is freeze-eligible only if all Blueprint V1A integration requirements are enforceable.

```text
1.
Historical references never resolve CURRENT/LATEST/ACTIVE.

2.
Every direct DecisionSnapshot reference resolves.

3.
Every transitive DecisionSnapshot reference agrees.

4.
Task/Program cannot disagree.

5.
Task metrics resolve to pinned metric context.

6.
Task channel matches pinned ChannelProfile.

7.
Audience belongs to Task.

8.
Normal release uses FINAL_FOR_DECISION AudienceState.

9.
Blocking KnowledgeGap cannot pass normal release.

10.
Research failure never becomes falsity.

11.
Strategy belongs to Task/final Audience.

12.
Architecture belongs to Strategy.

13.
Candidate belongs to Strategy/Architecture.

14.
Candidate RunConfig equals snapshot RunConfig.

15.
Assertions belong to frozen Candidate state.

16.
Validation results belong to correct Assertions.

17.
Implied Assertions re-enter validation.

18.
Composite closure stabilizes or escalates.

19.
Qualitative evaluation uses exact EvalContract/Evaluator revisions.

20.
Applicability belongs to exact Task/governance/target time.

21.
Risk/uncertainty state is reachable and immutable.

22.
RightsPolicy/RightCheck closure is exact.

23.
Source-use rights remain enforced upstream.

24.
Final rights checks affect release.

25.
Invalid closure prevents freeze.

26.
FREEZING is a real write barrier.

27.
Snapshot freeze is atomic.

28.
PolicyResult is bound to one snapshot.

29.
PolicyResult inputs are frozen-snapshot reachable.

30.
Policy set is complete before conflict detection.

31.
Conflicts have one final resolution.

32.
AUTHORIZED_OVERRIDE requires valid authorization.

33.
Non-overridable policy cannot be overridden.

34.
Human review cannot inject hidden state.

35.
Material new review information creates new cycle/snapshot.

36.
DecisionRecord owns canonical release status/action.

37.
FinalContentPackage cannot substitute another Candidate.

38.
Package Strategy/Architecture/Audience match selected Candidate.

39.
Package Assertion/Proposition/Risk/Rights refs close over frozen decision.

40.
Runtime cannot mutate active Control Plane.
```

---

# 126. Verification Record — Final Freeze

```text
STATUS
FROZEN

FIXED ADVERSARIAL SUITE
80 / 80 PASS

STATIC PREFLIGHT
40 / 40 PASS

BLOCKERS
0

PARTIALS
0

FROZEN?
YES
```

Later patching may address only demonstrated failures in the locked suite or concrete upstream contradictions.

No open-ended architecture expansion after suite lock.

---

# 127. Canonical V1A Decision Runtime

```text
START RUN
↓
ATOMIC RUN INITIALIZATION
↓
OPEN DecisionCycle
↓
research / knowledge
↓
final governance resolution
↓
FINAL_FOR_DECISION AudienceState
↓
StrategyHypothesis
↓
deterministic Strategy Gate
↓
ContentArchitecture / ContentUnit
↓
ContentCandidate
↓
Assertions / validation / composite / qualitative
↓
risk / uncertainty / rights
↓
verify all required decision-input stages terminal
↓
bump cycle fencing epoch
↓
OPEN → FREEZING
↓
materialize RunKnowledgeDelta
↓
select final GovernanceSnapshot
↓
build Draft DecisionSnapshot
↓
SNAPSHOT CLOSURE VALIDATION
↓
PASS?
```

If NO:

```text
SNAPSHOT_INVALID
↓
no frozen snapshot
no release policy
```

If YES:

```text
set final frozen_at
↓
ATOMIC SNAPSHOT FREEZE
↓
DecisionCycle → FROZEN
↓
complete PolicyResult set
↓
conflict resolution
↓
Human Review / Override if required
↓
DecisionRecord
↓
FinalContentPackage
```

---

# 128. Human New-Information Loop

```text
Frozen Snapshot S1
↓
Human Review
↓
material new information?
```

If NO:

```text
ADJUDICATION_ONLY
↓
same frozen S1
↓
complete governance closure
↓
DecisionRecord
```

If YES:

```text
S1 remains frozen
↓
new DecisionCycle
↓
new immutable upstream state
↓
new DecisionSnapshot S2
↓
complete policy rerun
↓
new DecisionRecord
```

No hidden mutation of S1.

---

# 129. Release Outcome Mapping

```text
READY
→ releasable

READY_WITH_WARNINGS
→ releasable with non-blocking warnings

HUMAN_REVIEW_REQUIRED
→ not releasable

BLOCKED
→ not releasable
```

Package existence never changes this mapping.

---

# 130. Final Doctrine

```text
V1A
IS ONE COMPLETE
DECISION PATH.

NOT A BAG
OF MODULES.

FREEZE
THE INPUTS.

VALIDATE
THE CLOSURE.

RUN
THE COMPLETE POLICY SET.

FINALIZE
EVERY MATERIAL CONFLICT.

REVIEW
WITHOUT HIDDEN STATE.

NEW INFORMATION
MEANS NEW CYCLE.

DECISION RECORD
OWNS RELEASE.

PACKAGE
MIRRORS THE DECISION.

PACKAGE
DOES NOT REWRITE IT.

NO FUTURE KNOWLEDGE.

NO CURRENT LOOKUP.

NO STALE WORKER.

NO PARTIAL GOVERNANCE.

NO CANDIDATE SUBSTITUTION.

NO POST-DECISION INJECTION.

ONE CONSISTENT
FROZEN DECISION CONTEXT.

LOCK THE SUITE.
AUDIT IT.
THEN FREEZE.
```

---

**End of ContentOS SPEC 09 — V1A Decision Core v1.0 — FROZEN**
