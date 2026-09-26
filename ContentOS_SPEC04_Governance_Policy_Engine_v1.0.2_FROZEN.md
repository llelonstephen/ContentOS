# ContentOS SPEC 04 — Governance & Policy Engine
## Governance Resolution, Applicability, Policy Evaluation, Conflict Resolution & Decision Governance
### Version 1.0.2 — Frozen Governance & Policy Engine

---

# 0. Status

```text
SPEC
SPEC 04 — GOVERNANCE & POLICY ENGINE

VERSION
1.0.2

SOURCE OF TRUTH
ContentOS Blueprint v2.13.1 — FROZEN
ContentOS SPEC 01 v1.1.3 — FROZEN
ContentOS SPEC 02 v1.0.6 — FROZEN
ContentOS SPEC 03 v1.0.1 — FROZEN

STATUS
FROZEN
```

If this SPEC conflicts with an upstream frozen source:

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
```

SPEC04 defines behavior.

It does not change frozen schemas.

---

# 1. Purpose

SPEC04 defines:

```text
governance dependency resolution

GovernanceSnapshot construction

governance refresh

Guidance vs NormativeRule separation

applicability evaluation

target-valid-time semantics

knowledge-cutoff semantics

DecisionPolicyRevision execution semantics

deterministic policy DSL

policy input selection

PolicyResult completeness

PolicyResult idempotency

conflict detection

conflict identity

conflict resolution ordering

override authorization

human adjudication

new-information review routing

DecisionRecord governance closure

release-status governance mapping

governance auditability

governance failure handling
```

---

# 2. Non-Goals

SPEC04 does not define:

```text
rights/license interpretation logic

copyright law analysis

content generation algorithms

audience reasoning

strategy generation

assertion extraction

qualitative evaluation rubrics

risk scoring methodology

measurement methodology

experiment design

publication execution

user interface

identity-provider implementation
```

Rights interpretation belongs to SPEC08.

SPEC04 consumes immutable RightsPolicy / RightsCheck state where already present.

---

# 3. Governance Doctrine

```text
GUIDANCE
IS NOT LAW.

RULE
IS NOT POLICY.

POLICY
IS NOT EVIDENCE.

APPLICABILITY
IS NOT TRIGGERING.

TRIGGERING
IS NOT CONFLICT RESOLUTION.

HUMAN REVIEW
IS NOT HIDDEN STATE.

OVERRIDE
IS NOT PERMISSION TO IGNORE POLICY.

MISSING POLICY RESULT
IS NOT PASS.

FROZEN SNAPSHOT
IS THE POLICY INPUT BOUNDARY.

GOVERNANCE MUST BE
KNOWN BY THE DECISION CUTOFF

AND

VALID FOR THE TARGET USE TIME.

RUNTIME SELECTS
EXISTING IMMUTABLE REVISIONS.

RUNTIME DOES NOT
MUTATE CONTROL PLANE.
```

---

# 4. Canonical Governance Graph

```text
GuidanceRevision
NormativeRuleRevision
DecisionPolicyRevision
RightsPolicy
MetricDefinitionRevision
AttributionModelRevision
        ↓
Governance dependency resolution
        ↓
GovernanceSnapshot
        ↓
ApplicabilityAssessment
        ↓
Strategy / Content / Risk / Rights / Validation
        ↓
DecisionSnapshot FROZEN
        ↓
Policy Engine
        ↓
PolicyResult set COMPLETE
        ↓
Conflict detection
        ↓
PolicyConflictResolution
        ↓
HumanReviewRecord / PolicyOverride when required
        ↓
DecisionRecord
```

---

# 5. Frozen Canonical Entities Used by SPEC04

SPEC04 uses:

```text
GuidanceRevision
NormativeRuleRevision
DecisionPolicyRevision
ApplicabilityAssessment
GovernanceSnapshot
DecisionSnapshot
PolicyResult
PolicyOverride
PolicyConflictResolution
HumanReviewRecord
DecisionRecord
RightsPolicy
RightsCheck
RiskAssessment
UncertaintyAssessment
TaskContractRevision
ChannelProfileRevision
ContentCandidate
FinalContentPackage
```

SPEC04 introduces no new canonical domain entity.

Operational evaluators, selector compilers, caches and conflict detectors are non-authoritative infrastructure.

---

# 6. Governance Categories

ContentOS distinguishes:

```text
GuidanceRevision
NormativeRuleRevision
DecisionPolicyRevision
```

Their semantics are different.

---

# 7. GuidanceRevision Semantics

Guidance expresses:

```text
recommended practice
heuristic
platform recommendation
domain practice
internal playbook
```

Guidance may influence:

```text
strategy
content structure
evaluation
warnings
recommendations
```

Guidance does not automatically behave as a hard prohibition.

A GuidanceRevision becomes decision-relevant only through explicit applicability and policy logic.

---

# 8. NormativeRuleRevision Semantics

NormativeRuleRevision represents authoritative constraints such as:

```text
law
regulation
platform hard policy
security rule
privacy rule
brand hard rule
business hard rule
```

A NormativeRuleRevision has:

```text
jurisdiction
scope
applicability_conditions
enforcement_level
valid_from
known_from
scheduled_expiration?
```

Rule authority and applicability remain distinct.

A rule may be authoritative but not applicable to this Task.

---

# 9. DecisionPolicyRevision Semantics

DecisionPolicyRevision converts frozen decision state into a deterministic governance result.

It owns:

```text
conditions
required_inputs
action
priority_class
scope
override_allowed
override_authority_requirements?
override_scope_constraints?
```

It does not create new evidence or alter upstream facts.

---

# 10. GovernanceSnapshot Semantics

GovernanceSnapshot is the exact immutable governance revision set selected for one decision state.

It pins:

```text
guidance_revision_ids
rule_revision_ids
policy_revision_ids
metric_revision_ids
attribution_model_revision_ids
rights_policy_ids
```

It is not:

```text
"whatever is active now"
```

Historical replay uses exact IDs.

---

# 11. Governance Resolution Inputs

Governance resolution considers:

```text
TaskContractRevision
ContentProgramRevision if present
ChannelProfileRevision
market
jurisdiction
brand
product/category
audience state
channel
format
risk context
material Proposition state
intended publication time
decision knowledge boundary
already-authorized Control Plane revisions
```

The resolver may only choose existing immutable eligible revisions.

---

# 12. No Runtime Control-Plane Mutation

Runtime may:

```text
select existing revisions
create GovernanceSnapshot
create ApplicabilityAssessment
create PolicyResult
create PolicyOverride
create PolicyConflictResolution
create HumanReviewRecord
create DecisionRecord
create ChangeProposal
```

Runtime may not:

```text
edit GuidanceRevision
edit NormativeRuleRevision
edit DecisionPolicyRevision
activate a new revision
change effective intervals
change priority class
change override permissions
```

---

# 13. Governance Coverage

Coverage answers:

```text
DOES THIS GOVERNANCE SNAPSHOT
CONTAIN EVERY REQUIRED GOVERNANCE FAMILY
FOR THIS DECISION CONTEXT?
```

Coverage is not the same as applicability.

A revision may need to be loaded for evaluation and ultimately be:

```text
NOT_APPLICABLE
```

---

# 14. Provisional Governance

Early runtime may construct a provisional GovernanceSnapshot.

It may support:

```text
initial applicability
research planning
risk planning
content constraints
```

It is not guaranteed to be the final GovernanceSnapshot.

---

# 15. Governance Refresh Triggers

Final governance refresh is required when research or refinement materially changes:

```text
market
jurisdiction
product/category
audience state
channel
material proposition state
```

The refresh must re-evaluate:

```text
coverage
+
applicability
```

---

# 16. Governance Refresh Result

If dependencies change:

```text
DO NOT mutate old GovernanceSnapshot.
```

Create:

```text
NEW GovernanceSnapshot
```

with exact eligible revision IDs.

Then create new final ApplicabilityAssessments.

---

# 17. Final Governance Requirement

Before normal strategy/release flow uses final governance:

```text
GovernanceSnapshot coverage
=
COMPLETE for required decision context
```

If required governance cannot be resolved:

```text
FAIL CLOSED
```

Possible outcomes:

```text
BLOCKED
HUMAN_REVIEW_REQUIRED
RESEARCH/CONFIGURATION REQUIRED
```

Never silently proceed with under-covered governance.

---

# 18. Governance Temporal Model

Governance uses two time axes:

```text
KNOWLEDGE TIME
VALID / TARGET TIME
```

Knowledge time asks:

```text
WAS THIS GOVERNANCE REVISION KNOWN
AT THE DECISION BOUNDARY?
```

Target time asks:

```text
IS IT VALID FOR THE INTENDED USE TIME?
```

---

# 19. Target Valid Time

Canonical target valid time:

```text
Task.intended_publication_time
```

when present.

Otherwise:

```text
DecisionSnapshot.frozen_at
```

For final decision applicability, all PRE_GENERATION_FINAL and CONTENT_LEVEL assessments use the resolved target valid time for that Task.

---

# 20. Knowledge Cutoff Time

Every final ApplicabilityAssessment records:

```text
knowledge_cutoff_time
```

and requires:

```text
knowledge_cutoff_time
<=
DecisionSnapshot.frozen_at
```

No governance knowledge learned after the decision boundary may be imported into that decision.

---

# 21. Normative Rule Temporal Eligibility

A NormativeRuleRevision is eligible only if:

```text
rule.known_from
<=
assessment.knowledge_cutoff_time
```

and:

```text
rule.valid_from
<=
target_valid_time
```

and, when expiration exists:

```text
target_valid_time
<
scheduled_expiration
```

unless the frozen rule contract defines inclusive boundary semantics.

Boundary semantics must be deterministic and consistent across all rules.

---

# 22. Future-Valid Known Rule

A rule may be:

```text
known today
valid tomorrow
```

and may correctly apply to content intended for tomorrow.

That is allowed when:

```text
known_from <= knowledge_cutoff
AND
valid interval covers target_valid_time
```

---

# 23. Future-Known Rule

A rule learned only after snapshot freeze:

```text
MUST NOT
```

be imported into historical replay or policy evaluation for the old snapshot.

Even if it would have been valid at the publication date.

Knowledge cutoff wins historical availability.

---

# 24. Guidance Temporal Eligibility

Guidance uses:

```text
effective_from
scheduled_expiration?
created_at / revision availability
```

under the same target-valid-time and decision-boundary principles.

No `LATEST` substitution.

---

# 25. ApplicabilityAssessment Purpose

ApplicabilityAssessment answers:

```text
DOES THIS EXACT GUIDANCE/RULE REVISION
APPLY TO THIS TASK
AT THIS STAGE
FOR THIS TARGET TIME
UNDER THIS KNOWLEDGE CUTOFF?
```

It does not decide final release by itself.

---

# 26. Applicability Subject Types

V1:

```text
GUIDANCE
NORMATIVE_RULE
```

`subject_revision_id` must resolve according to `subject_type`.

---

# 27. Applicability Stages

```text
PRE_GENERATION_PROVISIONAL
PRE_GENERATION_FINAL
CONTENT_LEVEL
```

Semantics:

```text
PROVISIONAL
=
early planning state

PRE_GENERATION_FINAL
=
final pre-strategy/content governance state

CONTENT_LEVEL
=
evaluation of actual generated content state
```

---

# 28. Applicability Results

```text
APPLICABLE
PARTIALLY_APPLICABLE
NOT_APPLICABLE
UNCERTAIN
```

`UNCERTAIN` is not equivalent to `NOT_APPLICABLE`.

---

# 29. Applicability Inputs

Applicability may use only explicit frozen/reconstructable inputs such as:

```text
TaskContractRevision
AudienceState
StrategyHypothesis when stage permits
ContentCandidate / ContentAssertion when CONTENT_LEVEL
EpistemicStateVersion
ChannelProfileRevision
market/jurisdiction
brand/product
target_valid_time
knowledge_cutoff_time
subject revision
```

No hidden mutable state.

---

# 30. Applicability Output Integrity

Every ApplicabilityAssessment must record:

```text
subject_type
subject_revision_id
task_revision_id
assessment_stage
result
scope_matches
reason_codes
assessor
uncertainty
review_required
dependency_fingerprint
target_valid_time
knowledge_cutoff_time
```

Its dependency fingerprint must identify the material dependency set used for that assessment.

It is not a substitute for canonical references.

---

# 31. Applicability Uncertainty

If material applicability cannot be resolved:

```text
result = UNCERTAIN
```

and:

```text
review_required = true
```

when unresolved applicability could change a release constraint.

Do not default uncertainty to NOT_APPLICABLE.

---

# 32. Content-Level Applicability

CONTENT_LEVEL applicability evaluates actual candidate/assertion state.

It may differ from pre-generation applicability because generated content may:

```text
make a regulated claim
introduce a restricted topic
change scope
add a disclosure need
use a prohibited framing
```

Content-level governance never rewrites pre-generation assessments.

---

# 33. Final Applicability Closure

DecisionSnapshot final governance closure requires:

```text
all required final ApplicabilityAssessments
reference exact GovernanceSnapshot revisions

all use valid target time

all knowledge cutoffs <= frozen_at

no assessment uses a subject revision
outside final GovernanceSnapshot
```

---

# 34. Policy Engine Admission

Policy Engine starts only after:

```text
DecisionSnapshot = FROZEN
```

It accepts only:

```text
frozen DecisionSnapshot
+
exact DecisionPolicyRevisions
from its pinned GovernanceSnapshot
```

It may not read live mutable state.

---

# 35. Policy DSL Goals

The V1 Policy DSL must be:

```text
deterministic
typed
bounded
side-effect free
network-free
tool-free
replayable
schema-validated
fail-closed
```

It is an embedded value contract inside:

```text
DecisionPolicyRevision.conditions
required_inputs
action
```

It is not a new canonical entity.

---

# 36. Policy DSL Forbidden Capabilities

Policy expressions may not:

```text
execute arbitrary code
perform HTTP requests
query current web data
read environment secrets
invoke tools
modify records
write files
publish content
create revisions
select CURRENT/LATEST/ACTIVE
use model free-text as executable code
```

---

# 37. Required Inputs Contract

`DecisionPolicyRevision.required_inputs` declares every canonical input family the policy may read.

A policy evaluator may read only:

```text
declared input selectors
```

that resolve into the frozen snapshot or frozen transitive closure.

Hidden read = invalid PolicyResult.

---

# 38. V1 Policy Selector Contract

A selector is a structured immutable value of the conceptual form:

```text
selector {
  root
  path
  cardinality
  expected_type
}
```

Examples:

```text
DecisionSnapshot.release candidate evaluations
DecisionSnapshot.risk assessments
DecisionSnapshot.rights checks
DecisionSnapshot.applicability assessments
DecisionSnapshot.uncertainty assessment
DecisionSnapshot.knowledge gaps
DecisionSnapshot.assertion validations
GovernanceSnapshot exact revision refs
```

Selectors resolve IDs, enums and structured immutable values.

---

# 39. Selector Safety

Selectors may never perform:

```text
unbounded recursive traversal
arbitrary SQL
cross-tenant lookup
unscoped current-state lookup
provider access
```

Selector resolution is deterministic over frozen state.

---

# 40. V1 Predicate Operators

V1 conditions may use bounded structured operators such as:

```text
ALL
ANY
NOT

EQ
NEQ

IN
NOT_IN

EXISTS
NOT_EXISTS

COUNT_EQ
COUNT_GT
COUNT_GTE
COUNT_LT
COUNT_LTE

SET_CONTAINS
SET_OVERLAPS

IS_TRUE
IS_FALSE
```

Optional numeric comparisons are permitted only for typed scalar inputs.

No dynamic code evaluation.

---

# 41. Policy Expression Form

Conceptual form:

```text
condition {
  op: ALL
  args: [
    { op: EQ, left: <selector>, right: <literal> },
    { op: EXISTS, value: <selector> }
  ]
}
```

The persisted physical shape is schema-versioned.

The exact schema revision is pinned through existing RunConfig/SchemaDefinition infrastructure.

---

# 42. Null / Missing Semantics

Policy evaluation distinguishes:

```text
MISSING
NULL/ABSENT OPTIONAL VALUE
EMPTY COLLECTION
FALSE
ZERO
```

They are not interchangeable.

Missing required input is:

```text
POLICY EVALUATION ERROR
```

not false.

---

# 43. Type Safety

Comparison requires compatible types.

Invalid examples:

```text
RiskSeverity == ContentCandidateID

ReleaseStatus > "high"

Timestamp IN BooleanSet
```

Type mismatch fails evaluation closed.

---

# 44. Policy Action Contract

`DecisionPolicyRevision.action` is a structured immutable action description.

V1 action semantics must be classifiable into one of these implementation effects:

```text
NO_RELEASE_EFFECT
WARNING
REQUIREMENT
REQUIRE_REVIEW
BLOCK
```

This is a SPEC04 embedded policy-action vocabulary.

It does not add a canonical entity field or alter DecisionRecord schema.

PolicyResult stores the exact action value emitted by the policy revision.

---

# 45. Triggering Semantics

For one policy:

```text
triggered = evaluate(conditions)
```

If false:

```text
PolicyResult still exists
```

with:

```text
triggered = false
```

and an action/result representation defined deterministically by the policy contract.

No result omission.

---

# 46. Policy Priority Class

`priority_class` participates only in conflict resolution when the policy contract permits priority-based resolution.

Priority must not:

```text
erase a non-overridable hard constraint
```

unless an upstream frozen contract explicitly authorizes that relationship.

---

# 47. Policy Scope

`scope` identifies the context in which a policy is intended to operate.

More-specific-scope resolution requires deterministic comparability.

Scope specificity must be calculated from structured scope dimensions.

Free-text "more specific" judgment is not allowed.

---

# 48. Policy Input Closure

Every PolicyResult requires:

```text
PolicyResult.snapshot_id
=
evaluated DecisionSnapshot.snapshot_id
```

and:

```text
PolicyResult.policy_revision_id
∈
DecisionSnapshot.GovernanceSnapshot.policy_revision_ids
```

and every input ref:

```text
reachable from frozen DecisionSnapshot
or frozen transitive closure
```

---

# 49. Expected Policy Set

Canonical expected set:

```text
expected_policy_revision_ids
=
DecisionSnapshot
→ GovernanceSnapshot
→ policy_revision_ids
```

For V1 content release:

```text
every expected policy_revision_id
→ exactly one terminal PolicyResult
for one DecisionSnapshot
```

No multiple independently keyed PolicyResult rows are permitted in V1.

If one future policy needs internally keyed sub-evaluations, they must remain internal deterministic evaluation detail and collapse into the single canonical PolicyResult unless an upstream frozen contract is explicitly revised.

---

# 50. PolicyResult Uniqueness

V1 requires:

```text
UNIQUE(
  snapshot_id,
  policy_revision_id
)
```

Exactly one canonical PolicyResult exists for one exact policy revision and DecisionSnapshot.

Any duplicate insert attempt must resolve to the existing canonical result after semantic-equivalence verification.

No secondary evaluation key may create another canonical PolicyResult row in V1.

---

# 51. PolicyResult Completeness Barrier

Policy stage is complete only when:

```text
count(valid terminal results)
=
count(expected policy evaluations)
```

and exact identity sets match.

Set equality is required.

Not just count equality.

---

# 52. Missing Policy Result

If one expected policy result is missing:

```text
POLICY SET INCOMPLETE
```

Consequences:

```text
DO NOT START FINAL CONFLICT RESOLUTION
DO NOT CREATE RELEASE-AUTHORIZING DecisionRecord
FAIL CLOSED
```

---

# 53. Policy Evaluation Determinism

Retrying exact:

```text
snapshot_id
policy_revision_id
policy revision payload
```

must produce semantically equivalent result.

Any internal sub-evaluation key is implementation detail only and may not alter canonical PolicyResult identity.

If not:

```text
DETERMINISM VIOLATION
```

and policy stage fails closed.

---

# 54. PolicyResult Content

PolicyResult records:

```text
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

`input_refs` are exact typed references.

Narrative explanations may be derived but cannot replace these canonical fields.

---

# 55. Input Uncertainty

PolicyResult.input_uncertainty preserves uncertainty material to the policy outcome.

Policies may explicitly define behavior such as:

```text
uncertainty → REQUIRE_REVIEW
```

or:

```text
uncertainty → BLOCK
```

They must not silently coerce uncertainty to certainty.

---

# 56. Policy Failure

Examples:

```text
missing required input
type mismatch
selector escape
unresolved reference
policy schema invalid
evaluation timeout
determinism violation
hidden-state read
```

Result:

```text
DO NOT TREAT AS NOT_TRIGGERED
```

Fail policy stage closed.

---

# 57. Conflict Definition

A conflict exists when multiple terminal PolicyResults over the same snapshot demand outcomes that cannot all be satisfied simultaneously.

Examples:

```text
BLOCK
vs
RELEASE-PERMITTING result

REQUIREMENT A
vs
incompatible REQUIREMENT B

policy permits action
vs
hard rule-derived policy blocks action
```

Conflict detection is deterministic.

---

# 58. Conflict Detection Admission

Conflict detection begins only after:

```text
POLICY RESULT SET COMPLETE
```

Never resolve conflicts over a partial result set.

---

# 59. Conflict Identity

Canonical:

```text
conflict_key =
hash(
  snapshot_id
  +
  canonical_sorted(policy_result_ids)
)
```

All PolicyResults in one conflict share one snapshot.

---

# 60. Conflict Finality

For one conflict_key:

```text
EXACTLY ONE FINAL PolicyConflictResolution
```

No simultaneous competing final interpretations.

---

# 61. Conflict Resolution Types

Frozen vocabulary:

```text
HARD_DENY_OVERRIDES
HARD_REQUIREMENT_OVERRIDES
MORE_SPECIFIC_SCOPE
EXPLICIT_PRIORITY
AUTHORIZED_OVERRIDE
ESCALATE
```

No additional V1 resolution type.

---

# 62. HARD_DENY_OVERRIDES

Use only when the governing policy semantics define one result as a non-overridable deny relative to the conflicting results.

Do not infer "hard deny" from wording alone.

It must come from exact policy/rule semantics.

---

# 63. HARD_REQUIREMENT_OVERRIDES

Use when a mandatory requirement can be satisfied while preserving the allowed outcome and it canonically dominates a conflicting weaker result.

It must not override a hard deny unless the frozen policy semantics explicitly allow it.

---

# 64. MORE_SPECIFIC_SCOPE

Allowed only when scope relation is deterministically provable from structured scope.

If specificity is ambiguous:

```text
ESCALATE
```

not guessed precedence.

---

# 65. EXPLICIT_PRIORITY

Allowed only when:

```text
priority_class
```

defines a deterministic ordering for the competing policies.

Equal/incomparable priority cannot be silently broken by insertion order.

---

# 66. AUTHORIZED_OVERRIDE

Requires:

```text
override_id != null
```

and a valid PolicyOverride.

No override object:

```text
NO AUTHORIZED_OVERRIDE resolution
```

---

# 67. ESCALATE

Use when conflict cannot be resolved deterministically from frozen policy semantics.

It routes to:

```text
Human Review / authorization
```

It is not a release authorization.

---

# 68. PolicyOverride Contract

PolicyOverride is immutable.

It binds:

```text
snapshot_id
policy_result_ids
authorized_by
authority_basis
reason_codes
scope
created_at
```

It does not modify PolicyResult.

---

# 69. Override Permission

For every affected PolicyResult:

```text
resolve exact DecisionPolicyRevision
```

then require:

```text
override_allowed = true
```

If any affected policy says:

```text
override_allowed = false
```

the override is invalid for that result.

---

# 70. Override Authority

When policy defines:

```text
override_authority_requirements
```

server-side authorization must prove those requirements.

UI visibility is not proof.

---

# 71. Override Scope

Override.scope must satisfy:

```text
override_scope_constraints
```

for every affected policy.

An override cannot widen its own authority.

---

# 72. Override Snapshot Binding

Every overridden PolicyResult requires:

```text
PolicyResult.snapshot_id
=
PolicyOverride.snapshot_id
```

No cross-snapshot override.

---

# 73. Override Subset Rule

For AUTHORIZED_OVERRIDE:

```text
PolicyOverride.policy_result_ids
⊆
PolicyConflictResolution.policy_result_ids
```

Every result actually overridden must be included.

---

# 74. Override Integrity

If:

```text
resolution_type != AUTHORIZED_OVERRIDE
```

then:

```text
override_id = null
```

A non-override conflict result may not carry an override as hidden justification.

---

# 75. Conflict Ordering

Canonical flow:

```text
COMPLETE POLICY RESULTS
↓
DETECT CONFLICTS
↓
DETERMINISTICALLY RESOLVABLE?
```

If yes:

```text
CREATE FINAL PolicyConflictResolution
```

If no:

```text
HUMAN REVIEW / AUTHORIZATION
↓
OPTIONAL PolicyOverride
↓
CREATE FINAL PolicyConflictResolution
```

---

# 76. No Premature AUTHORIZED_OVERRIDE

A PolicyConflictResolution may not be inserted as:

```text
AUTHORIZED_OVERRIDE
```

before its valid PolicyOverride exists.

---

# 77. HumanReviewRecord Contract

HumanReviewRecord is immutable.

It records:

```text
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

---

# 78. Human Review Authorization

Human review requires server-side:

```text
principal identity
role
qualification
scope
authority
snapshot binding
audit record
```

Frontend state is not authority.

---

# 79. Review Subject Closure

Every review_subject_ref must be:

```text
reachable from frozen snapshot
or
a permitted governance/post-snapshot object
created specifically for adjudication
```

ADJUDICATION_ONLY review may not import hidden factual state.

---

# 80. ADJUDICATION_ONLY

Semantics:

```text
judge frozen snapshot only
```

It may:

```text
interpret policy
apply authorized discretion
authorize override when permitted
record conditions
reject
escalate
```

It may not add material new factual inputs to the old snapshot.

---

# 81. NEW_INFORMATION_INTRODUCED

If review introduces material new information:

```text
DO NOT continue final decision on old snapshot
```

Canonical route:

```text
old snapshot remains frozen
↓
new DecisionCycle
↓
new immutable upstream state
↓
revalidate affected stages
↓
new RunKnowledgeDelta as required
↓
new GovernanceSnapshot as required
↓
new DecisionSnapshot
↓
rerun complete policy set
```

---

# 82. Review Information Integrity

For ADJUDICATION_ONLY:

```text
introduced_information_refs
must be empty
```

For NEW_INFORMATION_INTRODUCED:

```text
introduced_information_refs
must be non-empty
```

and those refs must become canonical upstream state before a new release decision relies on them.

---

# 83. Review Cannot Mutate Snapshot

Human reviewer may not:

```text
edit DecisionSnapshot
edit PolicyResult
edit ApplicabilityAssessment
edit RiskAssessment
edit RightsCheck
edit ContentCandidate
```

Review creates new immutable post-snapshot governance records.

---

# 84. DecisionRecord Admission

DecisionRecord may be created only after:

```text
frozen snapshot
complete policy result set
all material conflicts have final resolution
required human review completed when applicable
required valid overrides exist when applicable
```

This admission rule applies to every DecisionRecord, including:

```text
READY
READY_WITH_WARNINGS
HUMAN_REVIEW_REQUIRED
BLOCKED
```

There is no partial-governance exception.

A non-release disposition still requires the complete PolicyResult set and final conflict state for that snapshot.

If governance evaluation cannot reach that closure:

```text
DO NOT CREATE DecisionRecord
```

Record operational failure/escalation outside DecisionRecord until the required canonical governance closure exists.

---

# 85. DecisionRecord Closure

Require:

```text
DecisionRecord.task_revision_id
=
DecisionSnapshot.task_revision_id
```

Every referenced PolicyResult:

```text
snapshot_id = DecisionRecord.snapshot_id
```

Every referenced PolicyConflictResolution:

```text
snapshot_id = DecisionRecord.snapshot_id
```

Referenced HumanReviewRecord if present:

```text
snapshot_id = DecisionRecord.snapshot_id
```

---

# 86. Complete Policy Set in DecisionRecord

```text
DecisionRecord.policy_result_ids
=
complete terminal policy result set
for snapshot
```

Exact set equality.

A DecisionRecord cannot omit an inconvenient PolicyResult.

---

# 87. Conflict Closure in DecisionRecord

Every material detected conflict must have:

```text
exactly one final resolution
```

before any DecisionRecord for that snapshot is created, including `HUMAN_REVIEW_REQUIRED` and `BLOCKED`.

DecisionRecord must reference the relevant final resolution.

No two referenced conflict resolutions may share one conflict_key.

---

# 88. Selected Action

`selected_action` is an action code.

It must not embed:

```text
candidate ID
policy result ID
review ID
other entity identity
```

Typed entity choices use typed fields.

---

# 89. Selected Candidate

If a release action selects generated content:

```text
selected_candidate_id
MUST be present
```

and:

```text
selected_candidate_id
∈
DecisionSnapshot.candidate_ids
```

---

# 90. Release Status

Frozen values:

```text
READY
READY_WITH_WARNINGS
HUMAN_REVIEW_REQUIRED
BLOCKED
```

DecisionRecord is the single canonical owner.

---

# 91. READY

READY means:

```text
normal release is governance-authorized
```

subject to downstream package/execution closure.

It does not bypass:

```text
FinalContentPackage
rights requirements
execution validation
publication constraints
```

---

# 92. READY_WITH_WARNINGS

Release is governance-authorized, but warnings/requirements must remain visible and be satisfied where mandatory.

It is not equivalent to ignoring warning-producing policies.

---

# 93. HUMAN_REVIEW_REQUIRED

No normal release authorization.

The decision path is paused pending required adjudication/new-cycle handling.

---

# 94. BLOCKED

Normal release forbidden.

BLOCKED must never be interpreted as:

```text
no opinion
```

or:

```text
soft warning
```

---

# 95. DecisionRecord Idempotency

For one exact snapshot governance outcome, retries must not create contradictory duplicate DecisionRecords.

Canonical decision creation idempotency includes at minimum:

```text
snapshot_id
decision_type
complete policy_result_ids
final conflict_resolution_ids
human_review_id if any
selected_action
selected_candidate_id if any
release_status
```

Equivalent retries converge.

---

# 96. Policy Stage Idempotency

Canonical PolicyResult idempotency key:

```text
snapshot_id
+
policy_revision_id
```

Internal sub-evaluation keys, if any, do not create additional canonical PolicyResult rows.

Retry does not create duplicate canonical results.

---

# 97. Conflict Idempotency

Conflict identity is conflict_key.

Competing workers attempting final resolution:

```text
one final resolution wins
others reload canonical result
```

No branch.

---

# 98. Override Idempotency

Equivalent authorization attempts over the same:

```text
snapshot
policy-result set
principal/authority basis
scope
```

should converge to one semantic override event where implementation identity permits.

Duplicate button clicks must not create contradictory authorizations.

---

# 99. Human Review Idempotency

A review submission must use request idempotency.

A replayed identical submission cannot create divergent immutable review records.

A materially changed review decision is a new review workflow action, not a retry.

---

# 100. Governance Stage Names

SPEC01 StageExecution may represent:

```text
GOVERNANCE_RESOLVE
APPLICABILITY_PROVISIONAL
GOVERNANCE_REFRESH
APPLICABILITY_FINAL
APPLICABILITY_CONTENT
POLICY_EVALUATE
POLICY_CONFLICT_DETECT
HUMAN_REVIEW
POLICY_OVERRIDE
POLICY_CONFLICT_FINALIZE
DECISION_RECORD
```

Exact naming may vary.

Semantics may not.

---

# 101. Stale Worker Protection

Any governance worker returning after:

```text
lease takeover
cycle cancellation
cycle supersession
FREEZING boundary invalidation
```

must satisfy SPEC01 fencing before canonical commit.

Pre-freeze governance writes use the cycle fence.

Post-snapshot policy/review writes bind to exact snapshot identity and their own idempotency/authorization boundaries.

---

# 102. FREEZING Boundary

Applicability/governance inputs required for the DecisionSnapshot must be terminal before FREEZING.

After FREEZING:

```text
no new upstream decision-input governance state
```

may enter that cycle.

PolicyResult and post-snapshot governance occur only after snapshot freeze.

---

# 103. Snapshot Freeze Boundary

Policy engine never participates in constructing the snapshot it evaluates.

Canonical order:

```text
governance/applicability
↓
snapshot freeze
↓
policy
```

This prevents circular policy inputs.

---

# 104. Policy Result Does Not Rewrite Snapshot

PolicyResult is post-snapshot governance truth.

It does not become a hidden field inside DecisionSnapshot.

DecisionRecord references both.

---

# 105. Conflict Result Does Not Rewrite PolicyResult

PolicyConflictResolution resolves coexistence of immutable PolicyResults.

It does not edit them.

---

# 106. Override Does Not Rewrite Policy

PolicyOverride records authorization to depart from a result under permitted conditions.

It does not mutate:

```text
DecisionPolicyRevision
PolicyResult
GovernanceSnapshot
DecisionSnapshot
```

---

# 107. Governance Audit Trace

For one final DecisionRecord, auditor must traverse:

```text
DecisionRecord
↓
DecisionSnapshot
↓
GovernanceSnapshot
↓
exact DecisionPolicyRevisions
↓
PolicyResults
↓
PolicyConflictResolutions
↓
PolicyOverride when used
↓
HumanReviewRecord when used
```

and separately:

```text
ApplicabilityAssessment
↓
exact GuidanceRevision / NormativeRuleRevision
```

---

# 108. Historical Replay

Replay uses recorded exact revisions and immutable results.

Never:

```text
rerun old decision against today's active policy
```

unless doing a clearly labeled counterfactual analysis outside historical truth.

Historical truth is:

```text
what exact policy/rule set was used
what exact result was produced
what exact conflict resolution occurred
what exact authorization existed
```

---

# 109. No CURRENT/LATEST/ACTIVE

After run start / historical replay:

```text
CURRENT
LATEST
ACTIVE
```

are never valid substitutes for exact revision refs.

---

# 110. Policy Schema Versioning

A material change to DSL semantics requires a new immutable configuration/schema revision.

Old DecisionPolicyRevision payloads keep their original interpretation contract.

No interpreter hot-swap may silently change historical meaning.

---

# 111. Policy Interpreter Compatibility

Runtime must reject a policy revision whose DSL/schema version it cannot safely execute.

It must not guess.

Outcome:

```text
POLICY EVALUATION FAILED CLOSED
```

---

# 112. Governance Cache Rules

Caches may accelerate:

```text
governance resolution
applicability
policy selector resolution
policy evaluation
conflict detection
```

Cache key must include exact relevant revisions and input hashes.

Cache is non-authoritative.

---

# 113. Tenant Isolation

All governance reads/writes obey SPEC02 tenant envelope.

Knowing another tenant's:

```text
rule revision ID
policy revision ID
snapshot ID
policy result ID
override ID
```

does not grant access.

Shared/public rules may be referenced only through explicit authorized scope.

---

# 114. Authorization Separation

Authentication/authorization answers:

```text
WHO MAY PERFORM THIS GOVERNANCE ACTION?
```

Policy semantics answer:

```text
WHAT SHOULD THE DECISION BE?
```

Do not encode authorization solely in UI.

Do not infer policy truth solely from actor role.

---

# 115. Reviewer Qualification

When policy requires a qualified reviewer:

```text
reviewer_role
qualification
review_scope
```

must satisfy the exact requirement.

"Human reviewed" is insufficient if qualification matters.

---

# 116. Override Auditability

Every override must expose:

```text
who
authority basis
which PolicyResults
scope
reason codes
snapshot
created time
```

No silent bypass path.

---

# 117. Applicability Auditability

For one applicability decision, auditor must reconstruct:

```text
exact subject revision
task revision
stage
target_valid_time
knowledge_cutoff_time
dependency fingerprint
scope matches
result
uncertainty
review requirement
```

---

# 118. Governance Reason Codes

Reason codes should be stable machine-readable identifiers.

Narrative explanations may be generated from them.

Narrative wording is not canonical governance truth.

---

# 119. Policy Reason Codes

PolicyResult.reason_code must explain the deterministic result class sufficiently for audit.

A generic value such as:

```text
POLICY
```

is insufficient.

---

# 120. Fail-Closed Conditions

Governance fails closed on:

```text
missing required governance family
ambiguous eligible revision
future-known rule leakage
invalid target-valid-time evaluation
invalid applicability schema
policy selector escape
missing required policy input
policy type mismatch
policy interpreter mismatch
incomplete PolicyResult set
conflict detector failure
unresolved material conflict
invalid override
unauthorized reviewer
hidden review information
cross-snapshot reference
stale worker commit
tenant boundary violation
```

---

# 121. Governance Error Codes

Implementation reason/error codes may include:

```text
GOVERNANCE_COVERAGE_INCOMPLETE
GOVERNANCE_REVISION_AMBIGUOUS
APPLICABILITY_UNCERTAIN
APPLICABILITY_INVALID
TEMPORAL_ELIGIBILITY_FAILED
POLICY_SCHEMA_UNSUPPORTED
POLICY_INPUT_MISSING
POLICY_TYPE_ERROR
POLICY_HIDDEN_INPUT
POLICY_EVALUATION_FAILED
POLICY_SET_INCOMPLETE
POLICY_NONDETERMINISTIC
CONFLICT_UNRESOLVED
OVERRIDE_NOT_ALLOWED
OVERRIDE_AUTHORITY_INVALID
OVERRIDE_SCOPE_INVALID
REVIEWER_UNAUTHORIZED
REVIEW_HIDDEN_INFORMATION
SNAPSHOT_MISMATCH
```

These are operational codes, not new canonical entities.

---

# 122. Governance Transaction Boundaries

Do not hold DB transactions across:

```text
human review
external identity checks
model calls
network calls
```

Canonical immutable insert transactions stay short.

---

# 123. Applicability Write Transaction

```text
BEGIN

verify exact subject revision
verify task/context refs
verify target_valid_time
verify knowledge_cutoff_time
validate structured result
insert ApplicabilityAssessment
write outbox event

COMMIT
```

---

# 124. GovernanceSnapshot Write Transaction

```text
BEGIN

verify every exact revision exists
verify tenant/scope access
verify temporal eligibility where required
verify coverage set
insert GovernanceSnapshot
write outbox event

COMMIT
```

Never update prior snapshot.

---

# 125. PolicyResult Write Transaction

```text
BEGIN

verify frozen DecisionSnapshot
verify exact policy revision belongs to GovernanceSnapshot
verify all input_refs reachable
verify policy evaluation identity
insert PolicyResult

ON uniqueness retry:
  load canonical existing result
  verify semantic equivalence

write outbox event

COMMIT
```

---

# 126. Conflict Resolution Write Transaction

```text
BEGIN

verify complete PolicyResult set
verify conflict_key
verify same snapshot
verify no existing final resolution
verify override integrity when applicable
insert PolicyConflictResolution
write outbox event

COMMIT
```

---

# 127. Human Review Write Transaction

```text
BEGIN

verify reviewer authorization
verify snapshot binding
verify policy result binding
verify review mode / introduced-information invariant
insert HumanReviewRecord
write outbox event

COMMIT
```

Material new information triggers new-cycle workflow after commit.

---

# 128. PolicyOverride Write Transaction

```text
BEGIN

verify principal authority
verify same snapshot
verify every affected policy override_allowed
verify authority requirements
verify scope constraints
insert PolicyOverride
write outbox event

COMMIT
```

---

# 129. DecisionRecord Write Transaction

```text
BEGIN

verify snapshot
verify complete policy set
verify all conflict finality
verify review requirement satisfied
verify override integrity
verify selected action/candidate closure
verify release_status coherence
insert DecisionRecord
write outbox event

COMMIT
```

---

# 130. New Information During Review

Material new information is never added as an ad-hoc review note and used to release from the old snapshot.

It must enter the canonical upstream pipeline.

Old review/snapshot stay immutable.

---

# 131. Governance Refresh After Review Information

When new review information changes governance dependencies:

```text
new DecisionCycle
↓
new upstream state
↓
new governance coverage resolution
↓
new ApplicabilityAssessments
↓
new GovernanceSnapshot if needed
↓
new DecisionSnapshot
↓
new complete policy evaluation
```

---

# 132. Rights Boundary

SPEC04 consumes RightsCheck status only as frozen policy input.

SPEC04 does not decide:

```text
whether a license permits quotation
whether copyright applies
whether transformation is lawful
```

Those are SPEC08 concerns.

A PolicyRevision may deterministically respond to a frozen RightsCheck status.

---

# 133. Risk Boundary

SPEC04 consumes RiskAssessment / UncertaintyAssessment.

It does not define how risk severity/likelihood are calculated.

Policies may gate on those frozen values.

---

# 134. Evaluation Boundary

SPEC04 consumes QualitativeEvaluation and validation state.

It does not define scoring rubrics.

Policies may require release blocking/review based on exact frozen evaluation outputs.

---

# 135. Decision vs Policy

Policy Engine produces:

```text
PolicyResult
```

It does not itself own final release truth.

Conflict/review/override state is resolved into:

```text
DecisionRecord
```

DecisionRecord owns release_status.

---

# 136. No Silent Conflict Resolution

The system must never:

```text
pick the first policy
pick the newest policy
pick the highest database ID
pick the friendliest result
ignore the conflicting result
```

Conflict resolution must use an explicit frozen resolution type.

---

# 137. No Hidden Human Override

A reviewer saying:

```text
"ship it"
```

is not enough.

If policy outcome is being overridden:

```text
PolicyOverride
```

must exist when required and pass authority/scope checks.

---

# 138. Review New Information Is Not Override

New information and override are distinct:

```text
NEW_INFORMATION_INTRODUCED
→ new decision cycle

AUTHORIZED_OVERRIDE
→ same frozen snapshot,
  permitted governance exception
```

Never use override to smuggle new factual evidence into old snapshot.

---

# 139. Conflict Set Stability

After PolicyResult completeness barrier:

```text
policy result identity set is immutable
```

Conflict detection over that snapshot must operate on that complete set.

New PolicyResult requires a different legitimate policy evaluation key or a new snapshot context, not mutation.

---

# 140. Governance Change After Snapshot

If Control Plane activates a new policy/rule after snapshot freeze:

```text
old snapshot policy evaluation remains pinned
```

No automatic import.

Future decision cycles/runs may resolve the new revision under their own boundaries.

---

# 141. Counterfactual Governance Analysis

A tool may ask:

```text
"what would today's policy say about this old snapshot?"
```

That is permitted only as a clearly labeled counterfactual analysis.

It must not overwrite historical PolicyResult / DecisionRecord truth.

---

# 142. Policy Performance Metrics

Policy engine operational metrics may include:

```text
evaluation latency
selector failures
policy failure rate
conflict rate
review rate
override rate
incomplete-set rate
```

These metrics do not change policy truth.

---

# 143. Security Invariants

SPEC04 must never allow:

```text
policy DSL arbitrary code execution
selector tenant escape
reviewer self-elevation
override self-authorization
untrusted content to define privileged selector paths
untrusted content to create policy revisions
live network reads during frozen policy evaluation
secret leakage in reason logs
```

---

# 144. Observability

Every governance stage should emit:

```text
run_id
decision_cycle_id when applicable
snapshot_id when post-freeze
stage_execution_id
input refs
output refs
policy_revision_ids
governance_snapshot_id
duration
result class
reason codes
principal/reviewer identity where authorized
fencing/idempotency metadata
```

Sensitive payload should not be duplicated unnecessarily.

---

# 145. Fixed Adversarial Test Suite

The following suite is locked for SPEC04 v1.0 audit.

```text
01 guidance treated automatically as hard law
02 normative rule ignored because guidance disagrees
03 runtime mutates active GuidanceRevision
04 runtime mutates active NormativeRuleRevision
05 runtime mutates active DecisionPolicyRevision
06 governance resolver uses CURRENT after run start
07 provisional GovernanceSnapshot mutated in place
08 research changes jurisdiction but governance not refreshed
09 research changes material proposition state but applicability not recomputed
10 final GovernanceSnapshot under-covers required policy family

11 future-known rule leaks into old decision
12 known-today/future-valid rule wrongly excluded from future publication target
13 expired rule applied after expiration
14 target_valid_time mismatch across final applicability assessments
15 knowledge_cutoff_time after DecisionSnapshot.frozen_at
16 guidance temporal eligibility resolved from current state instead of exact revision
17 applicability subject_type points to wrong revision kind
18 UNCERTAIN applicability treated as NOT_APPLICABLE
19 content-level rule bypasses generated claim
20 applicability reads hidden post-cutoff state

21 Policy Engine starts before snapshot freeze
22 policy reads live runtime state
23 policy DSL executes arbitrary code
24 policy DSL performs network access
25 selector escapes frozen snapshot closure
26 policy required input missing treated as false
27 policy type mismatch coerced silently
28 policy schema unsupported but evaluator guesses
29 policy retry produces semantically different result
30 expected policy revision omitted from evaluation

31 non-triggered policy result omitted
32 duplicate PolicyResult for same snapshot/policy
33 policy completeness checked by count only with wrong identity set
34 incomplete policy set proceeds to conflict detection
35 missing PolicyResult treated as PASS
36 PolicyResult.policy_revision_id outside GovernanceSnapshot
37 PolicyResult.input_ref outside snapshot closure
38 PolicyResult bound to wrong snapshot
39 hidden uncertainty discarded
40 policy action embeds mutable entity lookup

41 conflict detection runs on partial policy set
42 same conflict gets two final resolutions
43 conflict_key built from unsorted result IDs
44 conflict combines results from different snapshots
45 conflict resolution chosen by insertion order
46 MORE_SPECIFIC_SCOPE used when scopes incomparable
47 EXPLICIT_PRIORITY used when priorities equal/incomparable
48 ESCALATE interpreted as release authorization
49 AUTHORIZED_OVERRIDE has null override_id
50 non-override resolution carries override_id

51 PolicyOverride references wrong snapshot
52 PolicyOverride omits actually overridden PolicyResult
53 override applied to override_allowed=false policy
54 override authority requirement not satisfied
55 override scope widens its own authority
56 UI role accepted without server-side authorization
57 reviewer unqualified for required review
58 human review references PolicyResult from another snapshot
59 ADJUDICATION_ONLY contains introduced information
60 NEW_INFORMATION_INTRODUCED has no introduced_information_refs

61 new review information used without new DecisionCycle
62 reviewer mutates DecisionSnapshot
63 reviewer mutates PolicyResult
64 hidden reviewer knowledge affects release
65 conflict finalized AUTHORIZED_OVERRIDE before override exists
66 unresolved material conflict omitted from DecisionRecord
67 DecisionRecord omits PolicyResult from complete set
68 DecisionRecord references conflict resolution from another snapshot
69 DecisionRecord references duplicate conflict_key resolutions
70 DecisionRecord HumanReviewRecord bound to different snapshot

71 release action selects candidate outside snapshot
72 READY release has release action but missing selected_candidate_id
73 BLOCKED interpreted as release authorization
74 selected_action embeds candidate ID
75 DecisionRecord release_status duplicated/overridden in package
76 stale governance worker commits after cycle invalidation
77 pre-freeze governance commit accepted after FREEZING
78 post-snapshot policy evaluation imports newly activated policy
79 historical replay evaluates today's active policy instead of recorded revision
80 runtime governance learning directly activates Control Plane revision
```

Expected for freeze:

```text
80 / 80
PRESERVE INVARIANTS
```

No additional freeze blocker should be introduced after this suite is locked unless a concrete contradiction against Blueprint v2.13.1 or SPEC01/02/03 frozen contracts is demonstrated.

---

# 146. Static Contract Preflight

SPEC04 freeze audit must check exactly:

```text
01 no new canonical domain entity invented
02 Guidance / NormativeRule / DecisionPolicy remain distinct
03 GovernanceSnapshot remains immutable
04 no CURRENT/LATEST/ACTIVE historical resolution
05 governance refresh triggered by frozen dependency set changes
06 target-valid-time semantics preserved
07 knowledge-cutoff semantics preserved
08 future-known rule exclusion preserved
09 known-now/future-valid rule eligibility preserved
10 Applicability subject typing preserved
11 Applicability uncertainty remains explicit
12 Policy Engine input is frozen DecisionSnapshot only
13 PolicyResult bound to one snapshot
14 PolicyResult policy revision belongs to GovernanceSnapshot
15 PolicyResult inputs reachable from snapshot closure
16 expected policy set derived from GovernanceSnapshot
17 non-triggered results still required
18 policy result completeness is exact-set complete
19 missing result is not PASS
20 conflict identity deterministic
21 one final resolution per conflict_key
22 conflict resolution vocabulary preserved
23 AUTHORIZED_OVERRIDE requires valid PolicyOverride
24 non-overridable policy cannot be overridden
25 override authority/scope enforced
26 Human Review cannot add hidden state
27 new information causes new decision cycle/snapshot
28 DecisionRecord owns release_status
29 DecisionRecord contains complete PolicyResult set
30 DecisionRecord candidate closure preserved
31 Runtime cannot mutate Control Plane
32 tenant/scope isolation preserved
33 rights interpretation remains out of SPEC04
34 no duplicated governance source of truth
```

Freeze target:

```text
34 / 34 PASS
```

---

# 147. Acceptance Criteria

SPEC04 is freeze-eligible only if:

```text
1.
GovernanceSnapshot contains exact immutable revision IDs.

2.
Governance refresh never mutates an old snapshot.

3.
Material dependency change triggers coverage refresh + applicability recomputation.

4.
Normative rule known-time and valid-time are both enforced.

5.
Applicability uses explicit target_valid_time and knowledge_cutoff_time.

6.
UNCERTAIN applicability does not silently become NOT_APPLICABLE.

7.
Policy evaluation starts only after DecisionSnapshot freeze.

8.
Policy DSL is deterministic, bounded and side-effect free.

9.
Policies read only declared inputs reachable from frozen snapshot closure.

10.
Every expected policy evaluation has exactly one terminal PolicyResult.

11.
A non-triggered policy still has a PolicyResult.

12.
Missing result cannot be interpreted as PASS.

13.
Conflict detection begins only after exact result-set completeness.

14.
conflict_key is deterministic.

15.
There is exactly one final resolution per conflict_key.

16.
Conflict resolution cannot silently use insertion order or hidden state.

17.
AUTHORIZED_OVERRIDE requires a valid PolicyOverride.

18.
Non-overridable policy cannot be overridden.

19.
Override authority and scope are enforced server-side.

20.
Human review is immutable and snapshot-bound.

21.
ADJUDICATION_ONLY introduces no new information.

22.
NEW_INFORMATION_INTRODUCED routes to a new decision cycle/snapshot.

23.
Reviewer hidden knowledge cannot alter old frozen decision truth.

24.
DecisionRecord references the complete PolicyResult set.

25.
DecisionRecord conflict refs are same-snapshot and unique by conflict_key.

26.
DecisionRecord selected candidate belongs to snapshot.

27.
READY / READY_WITH_WARNINGS release action has selected candidate.

28.
BLOCKED cannot authorize release.

29.
DecisionRecord remains sole release_status owner.

30.
Historical replay uses recorded governance revisions/results.

31.
Runtime cannot activate governance revisions.

32.
Tenant/scope boundaries remain enforced.

33.
The 80-test adversarial suite passes.

34.
The 34-check static preflight passes.
```

---

# 147A. v1.0.1 Patch Closure

This patch changes only the two demonstrated v1.0 blockers:

```text
1. V1 canonical PolicyResult identity is strictly:
   (snapshot_id, policy_revision_id)
   with exactly one terminal result.

2. Every DecisionRecord, including BLOCKED and HUMAN_REVIEW_REQUIRED,
   requires complete policy-set and final conflict closure.
```

The locked audit suite remains exactly:

```text
80 adversarial tests
34 static preflight checks
```

No new freeze criterion is introduced by v1.0.1.

---

# 147B. v1.0.2 Patch Closure

This patch changes only the demonstrated temporal-closure blocker:

```text
Task.intended_publication_time
if present

else

DecisionSnapshot.frozen_at
```

The locked audit suite remains exactly:

```text
80 adversarial tests
34 static preflight checks
```

No new freeze criterion is introduced by v1.0.2.

---

# 148. Verification Record — Final Freeze

```text
STATUS
FROZEN

FIXED ADVERSARIAL SUITE
80 / 80 PASS

STATIC PREFLIGHT
34 / 34 PASS

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

# 149. Canonical V1 Governance Execution

```text
PROVISIONAL CONTEXT
↓
PROVISIONAL GovernanceSnapshot
↓
PROVISIONAL Applicability
↓
RESEARCH / KNOWLEDGE
↓
DEPENDENCY CHANGE CHECK
↓
FINAL GOVERNANCE COVERAGE RESOLUTION
↓
FINAL GovernanceSnapshot
↓
PRE_GENERATION_FINAL Applicability
↓
STRATEGY / CONTENT / VALIDATION / RISK / RIGHTS
↓
CONTENT_LEVEL Applicability
↓
DecisionSnapshot CLOSURE
↓
DecisionSnapshot FROZEN
↓
COMPLETE POLICY EVALUATION
↓
POLICY RESULT COMPLETENESS BARRIER
↓
CONFLICT DETECTION
↓
DETERMINISTIC CONFLICT RESOLUTION
OR
HUMAN REVIEW / AUTHORIZATION
↓
OPTIONAL PolicyOverride
↓
FINAL PolicyConflictResolution
↓
DecisionRecord
```

---

# 150. Historical Governance Replay

```text
DecisionRecord
↓
DecisionSnapshot
↓
GovernanceSnapshot
↓
exact policy/rule/guidance revisions
↓
ApplicabilityAssessments
↓
PolicyResults
↓
PolicyConflictResolutions
↓
PolicyOverride if any
↓
HumanReviewRecord if any
```

No re-resolution to current active governance.

---

# 151. Final Doctrine

```text
PIN GOVERNANCE.

EVALUATE APPLICABILITY
AT AN EXPLICIT TARGET TIME.

RESPECT WHAT WAS KNOWN
AT THE DECISION CUTOFF.

FREEZE SNAPSHOT
BEFORE POLICY.

EVALUATE EVERY POLICY.

MISSING RESULT
IS NOT PASS.

COMPLETE SET
BEFORE CONFLICTS.

ONE CONFLICT
ONE FINAL RESOLUTION.

OVERRIDE REQUIRES
REAL AUTHORITY.

HUMAN REVIEW
MAY ADJUDICATE
FROZEN STATE.

NEW INFORMATION
CREATES NEW STATE.

DECISION RECORD
OWNS RELEASE TRUTH.

RUNTIME SELECTS.
CONTROL PLANE ACTIVATES.

NO HIDDEN STATE.
NO SILENT BYPASS.
NO MOVING GOALPOSTS.

LOCK THE SUITE.
AUDIT IT.
THEN FREEZE.
```

---

**End of ContentOS SPEC 04 — Governance & Policy Engine v1.0.2 — FROZEN**
