# ContentOS SPEC 10 — V1B Learning Closure
## Post-Publication Evidence Closure, Change Proposal Governance & Future-Run Admission
### Version 1.0 — Frozen V1B Learning Closure

---

# 0. Status

```text
SPEC
SPEC 10 — V1B LEARNING CLOSURE

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
ContentOS SPEC 09 v1.0 — FROZEN

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
>
SPEC10
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

SPEC09 v1.0
aa2bb4e78f12a0bb38684a9dc8855b2415e24375098e0a301536eb7be0825683
```

SPEC10 integrates the frozen V1B learning path.

It does not redefine frozen domain schemas.

---

# 1. Purpose

SPEC10 defines the final V1B closed-loop integration:

```text
PublishedArtifact
↓
MeasurementState
↓
PerformanceObservation
↓
Performance-derived EvidenceItem
↓
EvidencePropositionLink
↓
EvidenceAssessment
↓
EpistemicStateVersion
↓
ChangeProposal
↓
Control Plane review
↓
optional new immutable revision
↓
future Run initialization
↓
new V1A decision
```

SPEC10 closes behavior for:

```text
post-publication learning admission
correction propagation
performance-evidence lineage
epistemic update closure
learning proposition identity
observational-vs-causal boundaries
ChangeProposal creation
proposal targeting
proposal uncertainty
proposal deduplication/idempotency
runtime/control-plane separation
activation atomicity
future-run activation visibility
future-run knowledge visibility
old-run isolation
cross-tenant learning boundaries
deletion/replay interaction
learning auditability
failure handling
```

---

# 2. Non-Goals

SPEC10 does not redefine:

```text
measurement calculation
attribution math
experiment design
evidence compatibility
epistemic derivation policy
governance policy DSL
content generation
rights law interpretation
deletion mechanics
V1A decision closure
```

Those remain owned by SPEC03–09.

SPEC10 only specifies how the frozen systems close the learning loop.

---

# 3. V1B Learning Doctrine

```text
LEARNING
DOES NOT BYPASS
EVIDENCE.

PERFORMANCE
DOES NOT BECOME
KNOWLEDGE DIRECTLY.

OBSERVATION
→ EVIDENCE
→ ASSESSMENT
→ EPISTEMIC STATE.

CORRECTION
CREATES NEW STATE.

CORRECTED HISTORY
IS NOT DOUBLE-COUNTED.

OBSERVATION
IS NOT CAUSATION.

ATTRIBUTION
IS NOT INCREMENTALITY.

A/B LABEL
IS NOT RANDOMIZATION.

CHANGE PROPOSAL
IS NOT ACTIVATION.

RUNTIME
MAY PROPOSE.

CONTROL PLANE
MAY ACTIVATE.

ACTIVATION
CREATES NEW IMMUTABLE REVISION.

OLD RUNS
DO NOT CHANGE.

FUTURE RUNS
PIN STATE
AT INITIALIZATION.

NEW KNOWLEDGE
HAS A KNOWN TIME.

PAST DECISIONS
DO NOT RECEIVE
FUTURE LEARNING.

DATA RIGHTS
CAN DEGRADE
FUTURE/REPLAY KNOWLEDGE.

NO HIDDEN SELF-MODIFICATION.

NO MUTABLE LEARNING TRUTH.

NO CROSS-TENANT
LEARNING WITHOUT AUTHORIZATION.
```

---

# 4. Canonical Entities Used

SPEC10 uses:

```text
PublishedArtifact
PublicationLineage

MeasurementState
PerformanceObservation

SourceArtifact
EvidenceItem
EvidencePropositionLink
EvidenceCompatibility
EvidenceAssessment

Proposition
EpistemicStateVersion

ChangeProposal

RevisionRegistry
ControlPlaneActivation

Run
RunConfig
BaselineKnowledgeSnapshot
GovernanceSnapshot

ReplayabilityStatus
```

SPEC10 introduces no new canonical domain entity.

---

# 5. No Separate Learning Store

ContentOS V1B does not maintain a separate:

```text
learning truth store
```

outside the canonical knowledge system.

Learned factual state enters:

```text
Evidence
→ Proposition
→ Assessment
→ EpistemicStateVersion
```

Learned configuration ideas enter:

```text
ChangeProposal
→ Control Plane review
→ optional new immutable revision
```

---

# 6. Learning Inputs

V1B learning may consume:

```text
PublishedArtifact
MeasurementState
PerformanceObservation
experiment SourceArtifact
existing Proposition state
existing EpistemicStateVersion
existing revision/config state
```

It may not consume hidden mutable state as authoritative truth.

---

# 7. Publication Identity First

Any performance learning about content must resolve the exact immutable publication state.

At minimum:

```text
published_artifact_id
publication_lineage_id
published_hash
effective interval
actual_content
```

must be reconstructable for artifact-specific learning.

---

# 8. Candidate Is Not Published State

Learning must not assume:

```text
ContentCandidate
=
PublishedArtifact
```

unless exact execution/publication lineage proves equivalence.

Production edits may change actual content.

---

# 9. Measurement Identity

Performance learning must reference exact:

```text
PerformanceObservation.observation_id
```

not:

```text
latest metric
current dashboard
current campaign total
```

---

# 10. Measurement Context

Before learning from an observation, resolve exact:

```text
metric_revision_id
measurement_state_id
publication_state
covered_published_artifact_ids
measurement window
population_or_denominator
source_reference
attribution model if applicable
```

---

# 11. Measurement Maturity

Non-final/preliminary MeasurementState may support tentative learning.

It must preserve:

```text
data_maturity
is_final
late_event_window
missingness
known_incidents
```

into downstream uncertainty.

---

# 12. Measurement Correction

Late/corrected data creates:

```text
new MeasurementState
```

and, when observation state/value changes:

```text
new PerformanceObservation
```

Old objects remain immutable.

---

# 13. Correction Scope Identity

A superseding PerformanceObservation must preserve:

```text
metric_revision_id
semantic measurement window
population/denominator semantics
publication coverage semantics
```

If those change materially:

```text
NEW INDEPENDENT OBSERVATION
```

not correction.

---

# 14. Correction Chain

One correction lineage is:

```text
non-branching
acyclic
```

with at most one direct successor per observation.

No competing "latest corrections."

---

# 15. Performance → Evidence

Each performance-derived EvidenceItem must use:

```text
origin_type = PERFORMANCE_OBSERVATION

origin_id = exact observation_id
```

No generic campaign-level pointer.

---

# 16. Performance Evidence Statement

The EvidenceItem must preserve the measurement meaning.

It must not compress:

```text
observed CTR = 4.1%
```

into:

```text
this creative is objectively better
```

unless the canonical evidence actually supports that proposition.

---

# 17. Publication Scope Preservation

Evidence scope must be no narrower than publication coverage allows.

Examples:

```text
SINGLE_ARTIFACT
→ exact-artifact learning may be possible

MIXED_PUBLICATION_STATE
→ version-specific learning forbidden without valid split

UNRESOLVED_PUBLICATION_STATE
→ artifact-specific learning forbidden
```

---

# 18. Aggregate Learning Scope

Multi-lineage aggregate performance may support:

```text
program-level
portfolio-level
channel-level
aggregate audience/strategic
```

Propositions when scope matches.

It may not become one-artifact evidence.

---

# 19. Performance Evidence Firewall

Performance-derived evidence may inform appropriate:

```text
PERFORMANCE
STRATEGIC
AUDIENCE
```

Propositions.

By itself it must not establish:

```text
PRODUCT FACTS
SAFETY FACTS
REGULATORY FACTS
MEDICAL FACTS
```

---

# 20. Feature Learning

Learning about a content feature must ground that feature in exact immutable PublishedArtifact content.

The system may not infer:

```text
"short intro caused lift"
```

from performance if the feature itself was never resolved from actual published content.

---

# 21. Observational Feature Learning

Without causal evidence:

```text
feature ↔ performance
```

learning remains observational/associational.

It may support future strategy hypotheses.

It may not become a causal Proposition with causal_status=SUPPORTED.

---

# 22. Attribution Boundary

Attribution-model credit remains:

```text
attributed outcome
```

not:

```text
incremental causal effect
```

Learning must preserve AttributionModel assumptions/limitations.

---

# 23. Experiment Boundary

Experiment results enter the existing evidence path.

No new Experiment domain entity.

Canonical evidence domain may be:

```text
RANDOMIZED_EXPERIMENT
QUASI_EXPERIMENT
```

only when the actual design supports that classification.

---

# 24. A/B Naming Is Not Evidence Design

A workflow called:

```text
A/B test
```

must not be classified RANDOMIZED_EXPERIMENT unless randomization/assignment is credible.

Otherwise classify under the actually supported evidence design.

---

# 25. Experiment Content Identity

Experimental treatment variants must resolve to exact immutable content/publication state.

Vague labels such as:

```text
creative A
creative B
```

are insufficient if the actual immutable content identity cannot be reconstructed.

---

# 26. Experiment Metric Identity

Experimental outcomes must preserve exact metric semantics.

A metric-definition mismatch cannot be hidden during causal learning.

---

# 27. Experiment Limitations

Material:

```text
attrition
missingness
contamination
stopping behavior
population mismatch
measurement issues
```

must survive into EvidenceAssessment/uncertainty.

---

# 28. EvidencePropositionLink

Learning evidence maps to canonical Proposition identity through the normal SPEC03 link path.

No direct:

```text
Observation → EpistemicState
```

shortcut.

---

# 29. Compatibility Before Support

EvidenceCompatibility semantics remain distinct from support assessment.

A performance observation that is merely compatible with a Proposition is not automatically SUPPORTS.

---

# 30. EvidenceAssessment

Every learning claim that affects EpistemicState must pass normal immutable EvidenceAssessment.

Assessment must use:

```text
exact EvidenceItem
exact Proposition
exact method/config revision
explicit limitations
```

---

# 31. Proposition Identity Reuse

If a semantically equivalent Proposition already exists:

```text
reuse canonical proposition_id
```

Do not create a duplicate proposition for each performance run.

---

# 32. New Learning Proposition

If no semantically equivalent Proposition exists:

```text
resolve/create canonical Proposition
```

under SPEC03 identity rules before assessment.

---

# 33. Proposition Domain Safety

A learning proposition must use the correct semantic domain/scope.

Example:

```text
"Published artifact X had 4.1% CTR"
```

is performance knowledge.

It must not silently become:

```text
"Product X improves outcome Y"
```

---

# 34. Epistemic Update

New accepted EvidenceAssessments may produce a new:

```text
EpistemicStateVersion
```

under SPEC03 derivation rules.

Old EpistemicStateVersion remains immutable.

---

# 35. Epistemic Lineage

For each proposition:

```text
at most one root
at most one direct successor
same proposition across successor edge
known_from strictly increases
acyclic
```

Learning cannot create a branch.

---

# 36. Learning known_from

The new EpistemicStateVersion.known_from must reflect when ContentOS actually learned that state.

It must not be backdated to the measurement window merely because the events occurred earlier.

---

# 37. Valid Time vs Known Time

Performance may describe an earlier business-time interval.

That does not mean the knowledge existed then.

SPEC10 preserves:

```text
valid time
!=
known time
```

---

# 38. Future Decision Knowledge Boundary

A future decision may use a learned EpistemicStateVersion only when:

```text
known_from
<=
that decision's applicable knowledge cutoff
```

Past frozen decisions never gain it.

---

# 39. No Retroactive Decision Rewrite

New learning must not update:

```text
old DecisionSnapshot
old DecisionRecord
old FinalContentPackage
```

Historical decisions remain what was known at the time.

---

# 40. Corrected Observation Evidence

If O2 corrects O1 and both generate evidence for the same measurement statement:

```text
current knowledge derivation
MUST NOT count O1-derived and O2-derived evidence
as independent corroboration
```

---

# 41. Canonical `.md` Correction Rule

The authoritative frozen `.md` EvidenceItem schema does not include:

```text
supersedes_evidence_id
```

SPEC10 therefore does not invent that field.

Correction-lineage deduplication is derived from:

```text
EvidenceItem.origin_id
→ PerformanceObservation correction lineage
```

plus exact assessment/derivation logic.

---

# 42. Correction-Aware Evidence Selection

For current learning state:

```text
resolve observation correction lineage
identify terminal valid observation
avoid simultaneous corroboration credit
for predecessor/successor measurements
```

Historical replay may still expose predecessor evidence.

---

# 43. Corrected Epistemic Update

When a correction changes the assessment:

```text
create new EvidenceAssessment as needed
↓
derive new EpistemicStateVersion as needed
```

Do not mutate old assessment/state.

---

# 44. No Meaningless Epistemic Churn

If corrected/new evidence produces no material epistemic change and SPEC03 derivation policy permits NO-OP:

```text
NO-OP
```

may be used instead of appending meaningless duplicate state.

---

# 45. ChangeProposal Contract

Canonical schema:

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

Immutable.

---

# 46. ChangeProposal Meaning

ChangeProposal answers:

```text
WHAT CHANGE
MAY BE WORTH CONSIDERING
BASED ON CURRENT LEARNING?
```

It is not:

```text
a revision
an activation
a policy decision
a release decision
a factual proof by itself
```

---

# 47. Proposal Supporting Refs

Every supporting ref must resolve to:

```text
ImmutableEntityRef
or
RevisionRef
```

Examples:

```text
PublishedArtifact
PerformanceObservation
EvidenceItem
EvidenceAssessment
EpistemicStateVersion
MetricDefinitionRevision
AttributionModelRevision
```

---

# 48. Proposal Target

If `target_revision_ref` exists:

```text
it MUST resolve to one exact immutable revision
```

No:

```text
CURRENT
LATEST
ACTIVE
```

targeting.

---

# 49. Proposal Without Target

A proposal may omit `target_revision_ref` when proposing:

```text
a new concept
a new revision family member
a new investigation/test
```

whose exact target revision does not yet exist.

Supporting refs remain required by proposal semantics.

---

# 50. Proposal Uncertainty

`uncertainty` must preserve material limitations such as:

```text
non-final measurement
mixed publication state
unresolved publication scope
attribution assumptions
observational design
sample/population limits
known incidents
causal uncertainty
generalization limits
```

---

# 51. Proposal Language

An observational learning proposal must not claim:

```text
proven causal improvement
```

unless canonical causal evidence supports that statement.

---

# 52. Proposal Types Are Not Invented Here

SPEC10 does not freeze a new proposal_type enum absent an upstream closed vocabulary.

Implementations may define typed proposal categories through pinned schema/config contracts.

---

# 53. Proposal Idempotency

Exact proposal retry must converge.

Operational identity should include:

```text
proposal_type
target_revision_ref if any
canonical proposed_change hash
sorted supporting_refs
uncertainty semantics
tenant/workspace
```

Different material proposed change is a new proposal event.

---

# 54. Proposal Concurrency

Two workers attempting the exact same proposal effect:

```text
one canonical proposal
```

should result under one exact idempotency identity.

Distinct independent proposals may coexist.

---

# 55. No Proposal Mutation

Proposal refinement does not update:

```text
proposed_change
supporting_refs
uncertainty
target_revision_ref
```

of an existing ChangeProposal.

Create a new proposal if material proposal meaning changes.

---

# 56. Runtime Authority Boundary

Runtime may:

```text
measure
derive evidence
update epistemic state
create ChangeProposal
```

Runtime may not:

```text
create ControlPlaneActivation
mutate active revision
replace revision payload
change activation window
```

without Control Plane authority.

---

# 57. Control Plane Review

The Control Plane may review:

```text
proposal content
supporting refs
epistemic state
uncertainty
security/privacy scope
operational compatibility
```

Review does not upgrade evidence quality by approval alone.

---

# 58. No Hidden Approval Truth

Canonical frozen `.md` does not define a ChangeProposalDisposition entity.

SPEC10 therefore does not invent one.

Approval/rejection workflow is represented through authorized Control Plane workflow/audit state unless a future frozen schema introduces a canonical disposition entity.

---

# 59. Approved Proposal

An approved proposal still does not become active configuration directly.

Canonical activation path:

```text
approved proposal
↓
create new immutable revision
↓
register exact revision payload
↓
create ControlPlaneActivation
```

---

# 60. New Immutable Revision

Material config/guidance/policy change creates a new immutable revision ID.

Never overwrite the prior revision row/payload.

---

# 61. RevisionRegistry Closure

Every new revision must have exact registered identity and payload binding per SPEC02.

No metadata-only revision without replayable exact payload.

---

# 62. ControlPlaneActivation Contract

Operational activation includes:

```text
activation_id
deployment_scope
component_type
stable_id
active_revision_id
effective_from
effective_until?
created_at
```

---

# 63. Activation Revision Integrity

Require:

```text
(component_type, stable_id, active_revision_id)
```

to resolve to exact RevisionRegistry identity.

No activation to a nonexistent revision.

---

# 64. Activation Interval Integrity

Require:

```text
effective_until is null
or
effective_until > effective_from
```

---

# 65. Single-Active Semantics

For one:

```text
deployment_scope
component_type
stable_id
```

activation intervals must not overlap when single-active semantics apply.

---

# 66. Activation Resolution

Resolution at one instant returns:

```text
zero or one revision
```

under single-active semantics.

Ambiguous activation is invalid.

---

# 67. Control Plane Activation Atomicity

Creating a new activation must serialize against overlapping activation writes.

Use:

```text
temporal exclusion
or
serializable transaction + overlap check
```

No race-generated overlap.

---

# 68. Proposal Cannot Self-Activate

A ChangeProposal ID is not an active revision ID.

Runtime may not treat:

```text
proposal created
```

as:

```text
revision active
```

---

# 69. Approved But Not Activated

A proposal/revision may exist without active deployment.

Future Runs use it only after valid ControlPlaneActivation makes it eligible at initialization.

---

# 70. Future Run Initialization

Each future Run performs atomic initialization per SPEC01:

```text
BEGIN CONSISTENT READ SNAPSHOT

capture initialization_cutoff

resolve exact active revisions as-of cutoff

resolve baseline knowledge as-of cutoff

create RunConfig
create BaselineKnowledgeSnapshot
create initial GovernanceSnapshot
create Run

COMMIT
```

---

# 71. Activation Visibility

A Control Plane activation is visible to a future Run only when it is effective/visible at:

```text
Run.initialization_cutoff
```

for the relevant activation semantics.

---

# 72. Post-Cutoff Activation

A revision activated after a Run.initialization_cutoff:

```text
MUST NOT
alter that Run's already pinned initial RunConfig/Baseline state
```

---

# 73. Old Run Isolation

Learning from Run N may produce a proposal/activation later.

It must not mutate Run N.

It may affect:

```text
future Run N+1
```

only through legitimate future initialization.

---

# 74. RunConfig Pinning

Once future Run initializes:

```text
PromptConfig
ModelConfig
ToolConfig
RetrieverConfig
EvaluatorConfig
SchemaDefinition
```

pinned in RunConfig cannot be re-resolved through current/latest/active.

---

# 75. Baseline Knowledge Admission

Future Run BaselineKnowledgeSnapshot may include learned knowledge only when the exact EpistemicStateVersion is available as-of the new initialization cutoff.

No future-known state.

---

# 76. Governance Learning Admission

If learning results in a new approved/activated governance revision:

```text
future governance resolution
```

must still obey SPEC04:

```text
known-time
valid-time
scope
target use
```

Activation alone does not bypass applicability.

---

# 77. Metric Learning Admission

If learning proposes a new MetricDefinitionRevision:

```text
future Run
must pin exact revision
```

Old measurements remain under old metric revisions.

---

# 78. Attribution Learning Admission

A new AttributionModelRevision affects only metrics/runs that explicitly pin/use it.

Old PerformanceObservations are not rewritten.

---

# 79. Prompt/Model Learning Admission

A learning-derived PromptConfig/ModelConfig revision may affect only future Runs whose RunConfig pins that revision.

No silent hot-swap into an existing Run.

---

# 80. Evaluator Learning Admission

A new EvaluatorConfig revision does not reinterpret old AssertionValidationResult/QualitativeEvaluation.

Future evaluations use it only when pinned.

---

# 81. Decision Policy Learning Admission

A new DecisionPolicyRevision does not join an already frozen DecisionSnapshot.

Future decision governance may include it only through legitimate future governance resolution.

---

# 82. Guidance Learning Admission

New GuidanceRevision may inform future decisions once eligible.

It remains Guidance, not law.

---

# 83. Normative Rule Boundary

Runtime performance learning cannot fabricate legal/regulatory NormativeRule truth.

Any new NormativeRuleRevision requires the appropriate authoritative/control-plane process.

Performance observations alone are not regulatory evidence.

---

# 84. Knowledge vs Configuration Learning

Distinguish:

```text
knowledge learning
→ Evidence / EpistemicState

configuration learning
→ ChangeProposal / new revision
```

Do not store the same meaning as both mutable hidden state.

---

# 85. Knowledge Learning Does Not Require Activation

A new EpistemicStateVersion is canonical knowledge state.

It does not require ControlPlaneActivation.

Future Run includes it through baseline knowledge resolution if eligible by knowledge boundary.

---

# 86. Config Learning Does Require Activation

A new revision intended as active runtime configuration requires ControlPlaneActivation or the exact frozen activation mechanism for that revision family.

Creation alone is insufficient.

---

# 87. Learning Feedback to Strategy

Performance/epistemic learning may influence future StrategyHypothesis generation.

It must enter through:

```text
future BaselineKnowledgeSnapshot
or
eligible Guidance/config revision
```

not hidden model memory.

---

# 88. Learning Feedback to Audience

Audience learning may affect future AudienceState only through canonical knowledge/evidence context.

Old AudienceState remains immutable.

---

# 89. Learning Feedback to Governance

Governance-affecting learning does not mutate old GovernanceSnapshot.

Future Runs/cycles resolve new immutable governance state.

---

# 90. Learning Feedback to Content

Content-generation behavior may change only via:

```text
future knowledge
future Guidance
future Prompt/Model/Tool revision
future Task/Program revision
```

properly pinned.

No hidden optimizer side channel.

---

# 91. Learning Feedback to Evaluation

Evaluation methodology changes require new immutable EvalContract/Evaluator config state.

Old evaluation results remain historical.

---

# 92. Learning Feedback to Rights

Performance outcomes do not alter RightsPolicy permission.

Rights changes require rights-state/control-plane process.

---

# 93. Cross-Tenant Learning Default

Tenant-private performance/knowledge is not available to another tenant by default.

Cross-tenant learning requires explicit:

```text
AUTHORIZED_AGGREGATE
or
GLOBAL_PUBLIC
```

scope plus authorization/privacy constraints.

---

# 94. Authorized Aggregate Learning

Aggregate learning must prevent:

```text
membership inference
raw tenant identity leakage
source/hash existence leakage
unauthorized drill-down
```

---

# 95. Aggregate Knowledge Scope

Aggregate evidence must produce Propositions whose scope matches the aggregate population/context.

It may not silently generalize to one tenant or one artifact.

---

# 96. Tenant-Specific Future Run

A tenant future Run may use:

```text
tenant-private learned knowledge
workspace-shared knowledge
authorized aggregate knowledge
global public knowledge
```

only when authorization/DataScope permits.

---

# 97. Data Deletion Interaction

If source/performance data is deleted under SPEC08:

```text
data rights win
```

Derived learning must follow applicable deletion/retention rules.

---

# 98. Deletion May Degrade Knowledge

Required deletion may make prior evidence unavailable.

The system may need to:

```text
recompute
invalidate
tombstone
or lawfully retain
```

derived state according to frozen lifecycle rules.

SPEC10 does not invent new lifecycle entities absent canonical `.md`.

---

# 99. No Replay Retention Exception

Do not retain prohibited measurement/source data merely to preserve:

```text
learning reproducibility
historical replay
proposal justification
```

---

# 100. Proposal After Deletion

A ChangeProposal whose supporting refs become unavailable/deleted may remain historical where lawful, but its support may become degraded/unresolvable.

Do not silently replace missing support with new refs.

---

# 101. Activation After Support Deletion

Control Plane must not newly activate a proposal-derived revision if required support is no longer valid/available and the governing review contract requires that support.

Fail closed.

---

# 102. ReplayabilityStatus

Historical decision replay degradation remains represented through canonical ReplayabilityStatus.

Learning closure must not rewrite old decision history to maintain FULL replay.

---

# 103. Learning Audit Trace

For a future revision influenced by learning, auditor should traverse:

```text
future active revision
↓
ControlPlaneActivation
↓
proposal/review provenance
↓
ChangeProposal
↓
supporting refs
↓
EpistemicStateVersion / EvidenceAssessment
↓
EvidenceItem
↓
PerformanceObservation or experiment SourceArtifact
↓
PublishedArtifact / measurement context
```

No hidden optimization state.

---

# 104. Future-Run Audit Trace

For a future Run, auditor must be able to answer:

```text
which learned EpistemicStateVersions were available at initialization?
which learning-derived revisions were active?
what was the initialization_cutoff?
which exact revisions were pinned?
which older learning existed but was not yet visible/active?
```

---

# 105. No Hidden Model Memory

A model remembering prior performance outside canonical state cannot affect future content decisions as authoritative learning.

If the learning matters:

```text
store it canonically
```

or do not rely on it.

---

# 106. No Direct Runtime Mutation

Forbidden runtime learning actions include direct modification of:

```text
NormativeRuleRevision
DecisionPolicyRevision
GuidanceRevision
PromptConfigRevision
ModelConfigRevision
ToolConfigRevision
RetrieverConfigRevision
EvaluatorConfigRevision
SchemaDefinitionRevision
MetricDefinitionRevision
AttributionModelRevision
```

when that modification bypasses immutable revision creation + Control Plane activation.

---

# 107. No Direct Decision Mutation

Learning may not edit:

```text
DecisionSnapshot
DecisionRecord
FinalContentPackage
```

Old decision history stays immutable.

---

# 108. No Direct Publication Mutation

Learning may not rewrite PublishedArtifact content/history.

Publication edits create new PublishedArtifact states per SPEC07.

---

# 109. No Direct Measurement Mutation

Learning may not rewrite MeasurementState/PerformanceObservation.

Corrections create new immutable state.

---

# 110. No Direct Epistemic Mutation

Learning may not update an EpistemicStateVersion row.

New knowledge creates successor state.

---

# 111. Idempotent Performance-to-Evidence

Exact derivation from one observation under one extractor/derivation contract must not create uncontrolled duplicate equivalent EvidenceItems.

---

# 112. Idempotent Epistemic Derivation

Equivalent exact evidence/assessment inputs should converge on at most one canonical epistemic transition when SPEC03 idempotency semantics apply.

---

# 113. Idempotent ChangeProposal Creation

Exact retry of proposal creation must not create duplicate semantic proposals under the same exact idempotency identity.

---

# 114. Idempotent Activation

Exact retry of one activation command must not create overlapping duplicate activations.

---

# 115. Activation Concurrency

Concurrent activation attempts for one stable revision family must serialize against interval overlap.

One valid temporal state wins.

---

# 116. Learning Worker Fencing

Durable learning workers use StageExecution/idempotency/fencing where applicable.

Stale workers cannot create competing correction/epistemic/proposal effects after losing authority.

---

# 117. Outbox

Canonical writes that need downstream learning/event processing use transactional outbox.

Do not publish learning events before the canonical transaction commits.

---

# 118. Consumer Deduplication

Redelivered learning events must not duplicate canonical effects.

ConsumerReceipt/idempotency semantics from SPEC01 apply.

---

# 119. Learning Cache

Caches may accelerate:

```text
feature extraction
measurement interpretation
evidence derivation
proposal generation
activation lookup
```

Cache remains non-authoritative.

---

# 120. Cache Key Exactness

Material cache keys must include exact relevant:

```text
tenant/workspace
PublishedArtifact IDs
PerformanceObservation IDs
metric revision
attribution revision
Evidence/Assessment refs
EpistemicState ref
config revisions
canonical input hash
```

---

# 121. Cache Invalidation

Cache reuse is invalid after material:

```text
observation correction
measurement-state correction
publication edit
metric revision change
attribution model change
evidence reassessment
epistemic successor
proposal change
activation change
deletion/redaction
```

---

# 122. Historical Learning Replay

Historical learning replay resolves exact:

```text
observation
evidence
assessment
epistemic state
proposal
revision
activation
```

as recorded.

It does not replace them with current state.

---

# 123. Counterfactual Re-Learning

Re-analyzing old observations under new models/metrics is allowed as a new analysis event.

It must not overwrite old learning history.

---

# 124. Failure Taxonomy

Operational codes may include:

```text
LEARNING_PUBLICATION_UNRESOLVED
LEARNING_MEASUREMENT_SCOPE_INVALID
LEARNING_MEASUREMENT_NOT_FINAL
LEARNING_CORRECTION_BRANCH
LEARNING_EVIDENCE_ORIGIN_INVALID
LEARNING_EVIDENCE_SCOPE_INVALID
LEARNING_PROPOSITION_SCOPE_INVALID
LEARNING_CAUSAL_BYPASS
LEARNING_EPISTEMIC_BRANCH
CHANGE_PROPOSAL_SUPPORT_INVALID
CHANGE_PROPOSAL_TARGET_INVALID
CHANGE_PROPOSAL_UNCERTAINTY_MISSING
CONTROL_PLANE_AUTH_REQUIRED
CONTROL_PLANE_REVISION_INVALID
CONTROL_PLANE_ACTIVATION_OVERLAP
FUTURE_RUN_PINNING_INVALID
CROSS_TENANT_LEARNING_DENIED
LEARNING_SUPPORT_DELETED
STALE_LEARNING_WORKER
```

These are operational codes, not new canonical enums.

---

# 125. Fail-Closed Conditions

Fail closed when:

```text
publication identity is unresolved for artifact-specific learning
measurement scope contradicts publication coverage
observation correction would branch
performance EvidenceItem origin is wrong
proposition scope exceeds evidence scope
causal claim lacks causal support
epistemic successor would branch
ChangeProposal support refs do not resolve
proposal target revision is ambiguous/current/latest
material uncertainty is erased
runtime attempts activation
activation revision does not resolve
activation intervals overlap
future Run imports post-cutoff activation into old pinning
tenant scope is unauthorized
required support was deleted/invalidated
```

Fail closed means:

```text
do not create misleading learned truth
do not activate revision
do not import invalid learning into future Run
```

---

# 126. Fixed Adversarial Test Suite

The following suite is locked for SPEC10 v1.0 audit.

```text
01 performance learning uses ContentCandidate instead of PublishedArtifact identity
02 artifact-specific learning uses MIXED publication state
03 artifact-specific learning uses UNRESOLVED publication state
04 aggregate learning silently narrows to one artifact
05 performance EvidenceItem has wrong origin_type
06 performance EvidenceItem points to latest observation instead of exact observation_id
07 Evidence statement drops MeasurementState missingness
08 Evidence statement drops known incident
09 preliminary observation presented as final learning
10 attribution credit treated as incremental causal effect

11 observational performance creates causal Proposition support directly
12 A/B label classified randomized without credible randomization
13 experiment treatment cannot resolve immutable content state
14 experiment metric semantics differ from stated metric
15 experiment attrition omitted
16 opportunistic stopping omitted
17 Proposition duplicated instead of canonical semantic reuse
18 EvidenceCompatibility treated as SUPPORTS
19 EvidenceAssessment bypassed
20 Observation directly writes EpistemicStateVersion

21 Epistemic successor branches
22 Epistemic successor crosses Proposition
23 known_from backdated to measurement window
24 future learning inserted into past DecisionSnapshot
25 corrected predecessor/successor evidence counted as independent corroboration
26 observation correction mutates prior EvidenceItem truth
27 corrected assessment mutates old EvidenceAssessment
28 corrected learning mutates old EpistemicStateVersion
29 semantically identical epistemic state creates uncontrolled duplicate history
30 hidden model memory changes future knowledge without canonical state

31 ChangeProposal supporting_ref unresolved
32 ChangeProposal supporting_ref is opaque narrative instead of typed ref
33 ChangeProposal targets CURRENT/LATEST revision
34 observational proposal claims proven causal effect
35 proposal uncertainty omits material non-final/mixed/attribution limitation
36 proposal mutated in place
37 exact proposal retry creates duplicate semantic proposal
38 runtime treats proposal creation as activation
39 runtime directly edits active PromptConfigRevision
40 runtime directly edits active DecisionPolicyRevision

41 runtime directly edits active GuidanceRevision
42 runtime directly edits active EvaluatorConfigRevision
43 new revision created without exact RevisionRegistry/payload binding
44 ControlPlaneActivation points to nonexistent revision
45 activation effective_until <= effective_from
46 overlapping single-active activation intervals created
47 concurrent activation race creates overlap
48 approved-but-not-activated revision enters future Run
49 ChangeProposal ID used as active_revision_id
50 activation approval itself upgrades evidence quality

51 future Run resolves activation after its initialization_cutoff
52 existing RunConfig hot-swaps newly activated PromptConfig
53 existing Run imports newly activated DecisionPolicy
54 old DecisionSnapshot gains new learned EpistemicState
55 old AudienceState mutated from new learning
56 old GovernanceSnapshot mutated from new learning
57 old QualitativeEvaluation reinterpreted under new evaluator
58 old PerformanceObservation reinterpreted under new metric revision
59 old attributed observation recalculated under new attribution model in-place
60 future BaselineKnowledgeSnapshot includes EpistemicState known after cutoff

61 future strategy uses hidden performance memory instead of baseline knowledge
62 performance learning changes RightsPolicy permission directly
63 performance observation creates NormativeRuleRevision automatically
64 Guidance learning becomes hard law automatically
65 knowledge learning requires ControlPlaneActivation before future use
66 config revision creation alone is treated as active without activation
67 cross-tenant private learning leaks into another tenant's future Run
68 AUTHORIZED_AGGREGATE leaks tenant identity
69 aggregate Proposition scope silently generalizes to one tenant
70 global/public scope used despite rights/privacy prohibition

71 deleted measurement source retained only for learning replay
72 deleted support silently replaced inside ChangeProposal
73 proposal-derived revision activated after required support invalidation
74 replay fabricates deleted learning evidence
75 learning cache reused after observation correction
76 stale learning worker creates competing epistemic successor
77 redelivered event creates duplicate EvidenceItem/proposal
78 outbox publishes learning event before canonical commit
79 historical learning replay resolves current revision/activation
80 runtime learning rewrites old DecisionRecord/FinalContentPackage
```

Expected:

```text
80 / 80
PRESERVE INVARIANTS
```

No new freeze blocker may be introduced after suite lock unless a concrete contradiction against Blueprint v2.13.1 or SPEC01–09 frozen contracts is demonstrated.

---

# 127. Static Contract Preflight

SPEC10 freeze audit must check exactly:

```text
01 no new canonical domain entity invented
02 PublishedArtifact remains learning publication identity
03 MeasurementState remains immutable/correction-based
04 PerformanceObservation remains immutable/correction-based
05 performance EvidenceItem origin contract preserved
06 performance evidence firewall preserved
07 publication-state scope limits preserved
08 attribution != incrementality preserved
09 observational != causal preserved
10 no Experiment entity introduced
11 EvidenceCompatibility != EvidenceSupport preserved
12 EvidenceAssessment remains mandatory before epistemic learning
13 Proposition semantic identity reused
14 EpistemicStateVersion remains append-only
15 epistemic chain remains non-branching/acyclic/time-ordered
16 known time remains distinct from valid time
17 corrected observations not double-counted as independent evidence
18 authoritative `.md` schema not extended with supersedes_evidence_id
19 ChangeProposal canonical fields preserved
20 ChangeProposal remains immutable
21 ChangeProposal refs remain typed
22 ChangeProposal target is exact RevisionRef when present
23 runtime may propose but cannot activate
24 ControlPlaneActivation remains operational activation truth
25 activation revision identity resolves through RevisionRegistry
26 activation intervals cannot overlap under single-active semantics
27 activation resolution is unambiguous
28 future Run pins activation state at initialization_cutoff
29 post-cutoff activation cannot alter existing Run
30 learned knowledge enters future baseline only by knowledge cutoff
31 config learning enters future Run only through activated immutable revisions
32 old decisions/runs/evaluations/measurements remain immutable
33 tenant/DataScope boundaries preserved
34 deletion/replay degradation preserved
35 cache remains non-authoritative
36 learning writes remain idempotent
37 stale-worker fencing preserved
38 outbox/consumer dedup preserved
39 historical replay uses exact recorded learning/activation state
40 no duplicated source of learning truth
```

Freeze target:

```text
40 / 40 PASS
```

---

# 128. Acceptance Criteria

SPEC10 is freeze-eligible only if:

```text
1.
Learning starts from exact immutable publication/measurement state.

2.
Performance evidence returns through the canonical evidence architecture.

3.
Performance evidence cannot prove unrelated factual domains.

4.
Publication scope limits learning scope.

5.
Attribution remains non-causal unless separate causal evidence exists.

6.
Experiment labels cannot bypass design assessment.

7.
Canonical Proposition identity is reused.

8.
EvidenceCompatibility remains distinct from support.

9.
EvidenceAssessment remains mandatory.

10.
Epistemic history remains linear and immutable.

11.
known_from records when learning became known.

12.
Past decisions never receive future learning.

13.
Correction-lineage evidence is not double-counted.

14.
Corrections create new assessment/state rather than mutation.

15.
ChangeProposal is immutable.

16.
ChangeProposal supporting refs are typed and resolvable.

17.
Proposal uncertainty preserves material limitations.

18.
Runtime cannot activate Control Plane state.

19.
Proposal creation is not activation.

20.
Approved revision creation is not activation by itself.

21.
ControlPlaneActivation points to exact registered revision.

22.
Activation intervals are valid and non-overlapping.

23.
Concurrent activation cannot create ambiguity.

24.
Future Run initialization pins one coherent state boundary.

25.
Post-cutoff activation cannot hot-swap an existing Run.

26.
Learned knowledge enters future baseline only when known by cutoff.

27.
Learning-derived config enters future Run only through valid activation.

28.
Old RunConfig remains immutable.

29.
Old DecisionSnapshot/DecisionRecord/Package remain immutable.

30.
Old Measurement/Evaluation history remains immutable.

31.
Cross-tenant learning is denied by default.

32.
Authorized aggregate learning preserves aggregate scope/privacy.

33.
Deletion may invalidate/degrade learning support.

34.
Replay convenience never overrides deletion rights.

35.
Caches cannot become learning truth.

36.
Exact learning retries are idempotent.

37.
Stale workers cannot create competing canonical effects.

38.
Historical replay uses exact old learning/activation state.

39.
The 80-test adversarial suite passes.

40.
The 40-check static preflight passes.
```

---

# 129. Verification Record — Final Freeze

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

# 130. Canonical V1B Learning Runtime

```text
PublishedArtifact
↓
MeasurementState
↓
PerformanceObservation
↓
validate publication / metric / attribution scope
↓
EvidenceItem
origin = PERFORMANCE_OBSERVATION
↓
resolve canonical Proposition
↓
EvidencePropositionLink
↓
EvidenceCompatibility
↓
EvidenceAssessment
↓
EpistemicStateVersion
↓
ChangeProposal
↓
Control Plane review
↓
new immutable revision if approved
↓
ControlPlaneActivation if activated
↓
future Run initialization
↓
new RunConfig / BaselineKnowledgeSnapshot / GovernanceSnapshot
↓
V1A Decision Core
```

---

# 131. Knowledge-Only Learning Path

```text
PerformanceObservation
↓
Evidence
↓
Proposition
↓
EvidenceAssessment
↓
EpistemicStateVersion
↓
future BaselineKnowledgeSnapshot
```

No ControlPlaneActivation is required merely for knowledge to exist.

---

# 132. Configuration-Learning Path

```text
EpistemicStateVersion / supporting learning
↓
ChangeProposal
↓
Control Plane review
↓
new immutable revision
↓
ControlPlaneActivation
↓
future Run initialization
↓
exact revision pinned
```

---

# 133. Correction Learning Path

```text
O1 / M1
↓
late/corrected source
↓
O2 / M2
↓
new performance EvidenceItem
↓
new EvidenceAssessment
↓
new EpistemicStateVersion if warranted
↓
new/updated learning proposal as a NEW ChangeProposal if materially changed
```

No mutation of O1/M1/evidence/assessment/state/proposal.

---

# 134. Future-Run Isolation

```text
Learning event at T2
```

must not change a Run initialized at:

```text
T1 < T2
```

A Run initialized at:

```text
T3 > T2
```

may use the learning only when:

```text
knowledge available by T3
and/or
revision validly activated by T3
```

under exact temporal/scope rules.

---

# 135. Final Doctrine

```text
OBSERVE.

GROUND.

ASSESS.

UPDATE KNOWLEDGE.

PROPOSE CHANGE.

REVIEW.

CREATE NEW REVISION.

ACTIVATE EXPLICITLY.

PIN AT FUTURE RUN START.

NEVER HOT-SWAP HISTORY.

PERFORMANCE
IS NOT TRUTH
BY ITSELF.

ATTRIBUTION
IS NOT CAUSATION.

CORRECTION
IS NOT DUPLICATE EVIDENCE.

PROPOSAL
IS NOT ACTIVATION.

APPROVAL
IS NOT EVIDENCE.

NEW REVISION
IS NOT ACTIVE
UNTIL ACTIVATED.

PAST RUNS
STAY PAST.

FUTURE RUNS
GET EXACT NEW STATE
ONLY THROUGH
THE FROZEN BOUNDARIES.

NO HIDDEN OPTIMIZER.

NO SECRET SELF-MODIFICATION.

NO CURRENT LOOKUP
IN HISTORICAL LEARNING.

NO CROSS-TENANT LEAKAGE.

NO REPLAY OVERRIDE
OF DATA RIGHTS.

V1A DECIDES.

V1B LEARNS.

V1B FEEDS
THE NEXT V1A.

LOCK THE SUITE.
AUDIT IT.
THEN FREEZE.
```

---

**End of ContentOS SPEC 10 — V1B Learning Closure v1.0 — FROZEN**
