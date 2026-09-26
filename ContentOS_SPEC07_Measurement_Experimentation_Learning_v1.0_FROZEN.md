# ContentOS SPEC 07 — Measurement / Experimentation / Learning
## Publication-Aware Measurement, Attribution, Incrementality Boundaries & Learning Closure
### Version 1.0 — Frozen Measurement / Experimentation / Learning

---

# 0. Status

```text
SPEC
SPEC 07 — MEASUREMENT / EXPERIMENTATION / LEARNING

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
```

SPEC07 defines runtime behavior.

It does not change frozen canonical schemas.

---

# 1. Purpose

SPEC07 defines the post-publication learning closure:

```text
Decision
↓
FinalContentPackage
↓
ExecutionArtifact / PublishedArtifact
↓
MeasurementState
↓
PerformanceObservation
↓
Attribution / aggregate measurement interpretation
↓
Performance-derived EvidenceItem
↓
Proposition / EvidenceAssessment / EpistemicState
↓
ChangeProposal
↓
future decisions
```

SPEC07 closes:

```text
publication-aware measurement
measurement state maturity/corrections
performance observation creation
publication interval integrity
publication-state cardinality
aggregate measurement handling
metric-definition pinning
attribution-model pinning
observed effectiveness
attributed effectiveness
causal effectiveness
incrementality boundaries
experimental evidence integration
performance-to-evidence conversion
correction handling
learning proposals
ChangeProposal integrity
runtime/control-plane separation
idempotency
concurrency
tenant isolation
historical replay
```

---

# 2. Non-Goals

SPEC07 does not own:

```text
content generation
assertion validation
rights/license interpretation
security/privacy retention policy
policy conflict handling
publication UI
ad-platform implementation details
generic causal inference research methodology
```

Security / Privacy / Rights belong to SPEC08.

SPEC07 may consume rights/privacy constraints but does not redefine them.

---

# 3. Measurement Doctrine

```text
CONTENT QUALITY
≠
OBSERVED EFFECTIVENESS.

OBSERVED EFFECTIVENESS
≠
CAUSAL EFFECTIVENESS.

ATTRIBUTION
≠
INCREMENTAL CAUSAL EFFECT.

CORRELATION
≠
CAUSATION.

PLATFORM CREDIT
≠
INCREMENTAL LIFT.

ONE OBSERVATION
DOES NOT PROVE
WHY PERFORMANCE CHANGED.

PUBLISHED STATE
MUST MATCH
THE MEASUREMENT WINDOW.

MIXED PUBLICATION STATE
CANNOT SUPPORT
VERSION-SPECIFIC CLAIMS.

CORRECTION
CREATES NEW STATE.

HISTORY
IS NOT REWRITTEN.

PERFORMANCE LEARNING
RETURNS THROUGH
THE SAME EVIDENCE PIPELINE.

RUNTIME MAY PROPOSE.

CONTROL PLANE
ALONE MAY ACTIVATE.

NO CURRENT LOOKUPS
IN HISTORICAL REPLAY.
```

---

# 4. Canonical Entities Used

SPEC07 uses:

```text
FinalContentPackage
ExecutionArtifact
PublicationLineage
PublishedArtifact

MetricDefinitionRevision
AttributionModelRevision

MeasurementState
PerformanceObservation

EvidenceItem
Proposition
EvidencePropositionLink
EvidenceAssessment
EpistemicStateVersion

ChangeProposal
ReplayabilityStatus
```

SPEC07 introduces no new canonical domain entity.

---

# 5. Aggregate Measurement Contract Is Non-Canonical

Blueprint requires a separate aggregate measurement contract when measurement spans multiple independent PublicationLineages.

SPEC07 defines that contract as:

```text
PINNED NON-CANONICAL MEASUREMENT CONFIGURATION
```

represented through existing immutable configuration/revision infrastructure.

It is not a new domain entity.

It must be reconstructable through:

```text
MetricDefinitionRevision
AttributionModelRevision if used
RunConfig / ToolConfig / SchemaDefinition
StageExecution canonical input hash
source_reference provenance
```

---

# 6. Publication-Aware Measurement Boundary

Measurement begins from immutable external publication state.

The runtime must distinguish:

```text
ContentCandidate
ExecutionArtifact
PublishedArtifact
```

Performance measurement attaches to:

```text
PublishedArtifact publication state
```

not merely the generating Candidate.

---

# 7. PublicationLineage Contract

```text
PublicationLineage

publication_lineage_id

channel
destination

created_at
```

PublicationLineage is the canonical owner of:

```text
channel
destination
```

PublishedArtifact does not duplicate this truth.

---

# 8. PublishedArtifact Contract

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

Immutable.

---

# 9. Publication Origin Integrity

If:

```text
origin = CONTENTOS_EXECUTION
```

then:

```text
execution_artifact_id MUST NOT be null
```

and, when source_candidate_id exists:

```text
source_candidate_id
=
ExecutionArtifact.candidate_id
```

If:

```text
origin = MANUAL_EXTERNAL
```

then:

```text
execution_artifact_id MUST be null
```

No incompatible lineage.

---

# 10. Publication Effective Interval

For artifact `PA`:

```text
start(PA) = PA.effective_from
```

If successor exists:

```text
end(PA) = successor.effective_from
```

Else:

```text
end(PA) = open-ended
```

This interval is the basis for version-specific measurement.

---

# 11. Publication Chain Integrity

Within one PublicationLineage:

```text
exactly one root
at most one direct successor
same-lineage successor
acyclic graph
strictly increasing effective_from
```

SPEC07 consumes these frozen invariants.

It does not create alternative lineage semantics.

---

# 12. ExecutionArtifact Contract

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

Measurement does not assume:

```text
Candidate.content_payload
=
PublishedArtifact.actual_content
```

unless exact lineage proves it.

---

# 13. Publication Content Identity

Performance claims about a published state must resolve the exact:

```text
published_artifact_id
published_hash
actual_content
effective interval
```

A content edit creates a new PublishedArtifact.

Do not attribute post-edit performance to the predecessor version.

---

# 14. MetricDefinitionRevision Contract

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

Immutable revision.

---

# 15. Metric Pinning

Every PerformanceObservation must reference exact:

```text
metric_revision_id
```

Historical interpretation uses that exact MetricDefinitionRevision.

No:

```text
CURRENT metric definition
LATEST denominator
ACTIVE window rule
```

substitution.

---

# 16. Metric Semantic Identity

A material change to:

```text
definition
numerator
denominator
window
layer
attribution relationship
```

requires a new MetricDefinitionRevision.

Do not reinterpret old observations under a new metric revision.

---

# 17. AttributionModelRevision Contract

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

Immutable revision.

---

# 18. Attribution Semantics

Attribution answers:

```text
HOW IS OBSERVED CREDIT ASSIGNED
UNDER THIS MODEL?
```

It does not answer:

```text
WHAT WOULD HAVE HAPPENED
WITHOUT THIS CONTENT?
```

Therefore:

```text
ATTRIBUTION
≠
INCREMENTAL CAUSAL EFFECT
```

---

# 19. Attribution Limitations

Any PerformanceObservation or derived EvidenceItem influenced by an AttributionModelRevision must preserve material:

```text
assumptions
limitations
lookback window
eligible touchpoints
credit assignment
```

Do not strip attribution caveats during learning.

---

# 20. Attribution Does Not Upgrade Evidence

Examples that remain non-causal absent causal evidence:

```text
last-touch conversion
platform-attributed revenue
view-through conversion
linear attribution credit
position-based credit
```

Attribution credit alone cannot yield causal `SUPPORTED`.

---

# 21. MeasurementState Contract

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

SPEC07 follows canonical `.md` / SPEC02, including `is_final`.

It does not import the conflicting draft `.txt` removal of that field.

---

# 22. MeasurementState Meaning

MeasurementState describes quality/maturity context of measurement data.

It includes:

```text
maturity
finality
late-event expectations
missingness
known incidents
observation time
```

It is not the metric value itself.

---

# 23. MeasurementState Update Rule

Any material change to:

```text
data_maturity
is_final
late_event_window
missingness
known_incidents
```

creates:

```text
NEW MeasurementState
```

Never update the old row.

---

# 24. MeasurementState Correction Chain

When a state corrects/matures an earlier state:

```text
supersedes_measurement_state_id
```

may link them.

Required:

```text
at most one direct successor
acyclic correction lineage
```

A materially different measurement-quality context is not a correction successor.

---

# 25. Finality Consistency

`data_maturity` and `is_final` must not contradict the exact configured measurement-state semantics.

SPEC07 does not invent a new maturity enum.

The configured schema must define valid combinations.

If inconsistent:

```text
MEASUREMENT_STATE_INVALID
```

not "pick whichever field is convenient."

---

# 26. PerformanceObservation Contract

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

# 27. Measurement Window Rule

Required:

```text
measurement_window_end
>
measurement_window_start
```

The measurement window describes the metric observation interval.

It is not automatically the platform export interval if the metric contract defines a narrower semantic window.

---

# 28. SINGLE_ARTIFACT Cardinality

If:

```text
publication_state = SINGLE_ARTIFACT
```

then:

```text
covered_published_artifact_ids
contains exactly 1 PublishedArtifact
```

No zero-artifact or multi-artifact state.

---

# 29. SINGLE_ARTIFACT Window Integrity

For the covered PublishedArtifact:

```text
measurement_window
⊆
derived PublishedArtifact effective interval
```

If not:

```text
split observation where possible
```

or use appropriate mixed/unresolved semantics.

Never assign the whole window to one version incorrectly.

---

# 30. MIXED_PUBLICATION_STATE Cardinality

If:

```text
publication_state = MIXED_PUBLICATION_STATE
```

then:

```text
covered_published_artifact_ids
contains at least 2 known PublishedArtifacts
```

All known covered artifacts must belong to:

```text
ONE PublicationLineage
```

for this publication-revision observation.

---

# 31. Mixed-State Meaning

MIXED_PUBLICATION_STATE means the observation spans multiple revisions/states in one PublicationLineage.

It may support:

```text
lineage-level observed performance
mixed-period analysis
```

It must not support:

```text
version-specific creative performance claim
```

for one artifact without further valid decomposition.

---

# 32. UNRESOLVED_PUBLICATION_STATE

If publication coverage cannot be resolved fully:

```text
publication_state = UNRESOLVED_PUBLICATION_STATE
```

Zero or partially known covered artifacts are permitted.

Unresolved coverage must remain explicit.

It cannot be silently upgraded to SINGLE_ARTIFACT.

---

# 33. Unresolved-State Learning

UNRESOLVED publication state may support only learning whose scope explicitly preserves unresolved/aggregate publication identity.

It must not support:

```text
"This exact creative version produced X"
```

unless the exact version coverage is later established.

---

# 34. Multi-Lineage Aggregate Measurement

If measurement aggregates multiple independent PublicationLineages:

```text
DO NOT
represent it as SINGLE_ARTIFACT
or MIXED_PUBLICATION_STATE publication-revision observation.
```

Use a pinned aggregate measurement contract.

---

# 35. Aggregate Measurement Contract

The non-canonical aggregate contract must define at minimum:

```text
metric_revision_id
aggregation scope
included lineages / selection rule
time window
population/denominator semantics
deduplication semantics
attribution model if any
missingness handling
late-event handling
known limitations
source_reference semantics
```

The contract must be immutable/pinned for the observation workflow.

---

# 36. Aggregate Observation Representation

A multi-lineage aggregate may produce:

```text
PerformanceObservation
```

only when its `publication_state` and coverage semantics do not falsely claim publication-revision specificity.

V1 safe default:

```text
UNRESOLVED_PUBLICATION_STATE
```

plus explicit aggregate measurement provenance.

Do not stuff multiple lineages into MIXED_PUBLICATION_STATE.

---

# 37. source_reference

`source_reference` is opaque external provenance.

It must identify the measurement source sufficiently for audit, such as:

```text
platform export
analytics query
warehouse snapshot
experiment result snapshot
measurement job output
```

It is not a ContentOS entity ID unless explicitly typed elsewhere.

---

# 38. population_or_denominator

`population_or_denominator` must preserve the semantic base needed to interpret the metric.

Examples conceptually:

```text
impressions
eligible users
sessions
orders
spend
exposed population
randomized units
```

Changing denominator semantics is a semantic measurement-scope change.

---

# 39. Observation Immutability

Never update:

```text
value
window
population
coverage
metric
measurement_state
source_reference
```

on an existing PerformanceObservation.

Correction creates a new observation.

---

# 40. Observation Correction

When late/corrected data changes observation state/value:

```text
NEW PerformanceObservation
```

with:

```text
supersedes_observation_id
```

when it is a true correction.

---

# 41. Observation Correction Identity

A correction requires:

```text
same metric_revision_id
same semantic measurement window
same population/denominator semantics
same publication coverage semantics
```

Otherwise:

```text
NEW INDEPENDENT OBSERVATION
```

not a correction successor.

---

# 42. Observation Correction Chain

For one correction lineage:

```text
at most one direct successor
acyclic
```

Competing "latest" corrections are invalid.

---

# 43. Observation Correction & MeasurementState

A corrected observation may reference a newer MeasurementState.

If the new MeasurementState materially changes interpretation:

```text
create new PerformanceObservation
```

rather than mutating the old observation.

---

# 44. Late Events

Late events are represented through:

```text
MeasurementState.late_event_window
MeasurementState maturity/finality
new MeasurementState
new PerformanceObservation when needed
```

Old values are not rewritten.

---

# 45. Missingness

Missingness must be explicit in MeasurementState.

Observed metric values with material missingness cannot be presented as complete data without preserving that limitation.

---

# 46. Known Incidents

Known incidents such as:

```text
tracking outage
API delay
duplicate event issue
bot traffic
warehouse backfill
platform reporting anomaly
```

belong in MeasurementState.

They must flow into derived learning uncertainty.

---

# 47. Data Maturity

Preliminary/non-final measurement may inform tentative learning.

It must not be presented as final performance truth when the MeasurementState says otherwise.

---

# 48. Observed Effectiveness

Observed effectiveness is what the measurement shows under its exact metric/source/publication scope.

Examples:

```text
observed CTR
observed watch time
observed conversions
attributed revenue
```

It does not by itself answer causality.

---

# 49. Content Quality Separation

A high QualitativeEvaluation score does not imply observed performance.

A high PerformanceObservation does not imply the content was qualitatively high.

These are separate systems.

---

# 50. Causal Effectiveness

Causal effectiveness requires evidence supporting a counterfactual causal interpretation.

It may not be inferred from:

```text
before/after only
platform attribution only
cross-sectional correlation
high engagement
high conversion
one successful post
```

alone.

---

# 51. Experimentation Without New Domain Entity

Canonical Blueprint does not define an `Experiment` entity.

SPEC07 does not invent one.

Experimental evidence enters ContentOS through existing knowledge architecture:

```text
SourceArtifact
↓
EvidenceItem
↓
EvidenceDomain =
RANDOMIZED_EXPERIMENT
or
QUASI_EXPERIMENT
↓
EvidenceAssessment
↓
EpistemicStateVersion
```

---

# 52. Experiment Source Capture

Experiment outputs must be captured as immutable source state before being used as evidence.

Required provenance may include:

```text
design
assignment mechanism
population
treatment/control definition
metric
analysis window
sample size
exclusions
stopping rule if applicable
analysis result
limitations
```

The exact storage format may be external/SourceArtifact-backed.

---

# 53. Randomized Experiment Semantics

RANDOMIZED_EXPERIMENT evidence may support causal claims only when:

```text
randomization is credible
treatment contrast is defined
outcome measurement is valid
scope/population match is adequate
major contamination/attrition issues are addressed
```

Causal status remains owned by SPEC03 EpistemicState derivation.

---

# 54. Quasi-Experiment Semantics

QUASI_EXPERIMENT evidence may support causal learning when the identification strategy is explicit and assessed.

Examples conceptually:

```text
difference-in-differences
regression discontinuity
instrumental variable
matched/control design
synthetic control
```

SPEC07 does not hardcode one hierarchy.

SPEC03 assessment/causal rules remain authoritative.

---

# 55. Experiment Metric Pinning

Experimental outcomes used for ContentOS learning must bind to exact metric semantics.

If using a ContentOS MetricDefinitionRevision:

```text
pin exact metric_revision_id
```

If using an external metric not represented in ContentOS:

```text
capture full metric semantics in SourceArtifact/EvidenceItem context
```

Do not mix definitions silently.

---

# 56. Experiment Publication Identity

If an experiment compares published content variants:

```text
each treatment version
must resolve to exact immutable PublishedArtifact
or exact external source state.
```

Do not compare vague "creative A vs B" labels without immutable content identity.

---

# 57. Treatment Contamination

When exposure/treatment is contaminated or crossover exists:

```text
record limitation
```

Do not silently report a clean causal conclusion.

---

# 58. Experiment Missingness

Experiment missingness/attrition is material evidence context.

It must be preserved through EvidenceItem/EvidenceAssessment.

---

# 59. Multiple Testing

If an experiment workflow performs many outcomes/variants and multiplicity matters:

```text
the analysis contract must preserve that limitation.
```

SPEC07 does not prescribe one universal correction method.

---

# 60. Stopping / Peeking

If stopping behavior can bias inference:

```text
preserve stopping-rule context.
```

Do not present opportunistic stopping as pre-specified evidence.

---

# 61. Incrementality Boundary

An incrementality claim requires a valid causal counterfactual basis.

Attribution model output alone:

```text
MUST NOT
```

be used as incremental causal lift.

---

# 62. Attribution Observation

When a MetricDefinitionRevision references:

```text
attribution_model_revision_id
```

the PerformanceObservation represents metric value under that exact attribution model.

Its EvidenceItem must preserve that limitation.

---

# 63. Platform-Reported Metrics

Platform-reported conversions/revenue may be measured and stored.

They must remain:

```text
PLATFORM-REPORTED / ATTRIBUTED OBSERVATION
```

unless separate causal evidence exists.

---

# 64. Cross-Channel Attribution

If a metric credits touchpoints across channels:

```text
eligible touchpoints
lookback window
credit assignment
```

must be explicit in the AttributionModelRevision.

Cross-channel credit is still not incrementality.

---

# 65. Performance → Evidence

Canonical path:

```text
PerformanceObservation
↓
EvidenceItem
```

Required:

```text
origin_type = PERFORMANCE_OBSERVATION
origin_id = exact observation_id
```

---

# 66. Performance Evidence Statement

Derived EvidenceItem must preserve:

```text
metric revision
publication coverage
measurement window
measurement state/maturity
population/denominator
attribution model limitations
source-reference limitations
```

Do not reduce an observation to an unqualified:

```text
"creative worked"
```

---

# 67. Performance Evidence Firewall

Performance-derived evidence may inform appropriate:

```text
PERFORMANCE
STRATEGIC
AUDIENCE
```

Propositions.

By itself it does not establish:

```text
PRODUCT FACTS
SAFETY FACTS
REGULATORY FACTS
MEDICAL FACTS
```

---

# 68. Performance Does Not Prove Content Claims

High conversion or engagement does not prove that factual claims inside content are true.

Validation truth and observed effectiveness remain independent.

---

# 69. Performance Feature Learning

Learning about a content feature must ground that feature in exact immutable PublishedArtifact content.

Example:

```text
"shorter opening correlated with higher watch-through"
```

requires the feature to be observable from exact compared publication states.

Do not infer unseen causal mechanisms.

---

# 70. Observational Feature Learning

Without causal evidence:

```text
feature-performance learning
=
observational / associational
```

It may inform strategy hypotheses.

It may not be expressed as:

```text
"feature X causes lift"
```

---

# 71. Evidence Correction After Observation Correction

If a corrected PerformanceObservation changes the measurement statement:

```text
new EvidenceItem
```

must be created as needed.

Canonical `.md` does not define `supersedes_evidence_id` on EvidenceItem, so SPEC07 does not invent that field.

SPEC03 EpistemicState derivation must avoid treating known correction-lineage observations as independent corroboration.

---

# 72. Correction-Lineage Deduplication

When multiple EvidenceItems derive from one PerformanceObservation correction lineage:

```text
they MUST NOT
be counted as independent evidence
for the same current knowledge state
```

when they represent corrected versions of the same underlying measurement.

Historical replay may still resolve old states.

---

# 73. MeasurementState Learning Uncertainty

Any material:

```text
missingness
incident
non-final maturity
late-event exposure
```

must propagate into:

```text
EvidenceItem limitations
EvidenceAssessment uncertainty
or downstream UncertaintyAssessment
```

as appropriate.

---

# 74. Metric Definition Change

A new MetricDefinitionRevision does not rewrite old performance history.

To compare across revisions:

```text
explicit harmonization logic
```

is required.

If semantic equivalence cannot be established:

```text
do not aggregate them as one metric series.
```

---

# 75. Attribution Model Change

Changing AttributionModelRevision may materially change metric values.

Observations under different attribution models must not be treated as directly identical without explicit comparison logic.

---

# 76. Outcome Model Boundary

OutcomeModel / OutcomeEdge may define hypothesized relationships between metrics and outcomes.

They do not convert observed correlation into causal truth.

Causal learning still requires canonical causal evidence.

---

# 77. ChangeProposal Contract

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

# 78. ChangeProposal Purpose

A ChangeProposal expresses:

```text
WHAT MAY BE WORTH CHANGING
BASED ON LEARNING
```

It is not:

```text
an activation
a policy update
a prompt mutation
a strategy truth
```

---

# 79. ChangeProposal Supporting Refs

Every `supporting_ref` must be an existing:

```text
ImmutableEntityRef
or
RevisionRef
```

Examples:

```text
PerformanceObservation
EvidenceItem
Proposition
EpistemicStateVersion
PublishedArtifact
MetricDefinitionRevision
AttributionModelRevision
```

No opaque narrative-only justification.

---

# 80. ChangeProposal Uncertainty

`uncertainty` must preserve:

```text
measurement maturity
missingness
attribution limitations
observational-vs-causal status
sample scope
generalization limits
```

where material.

---

# 81. Runtime Cannot Activate Change

Runtime may create ChangeProposal.

Runtime may not:

```text
activate a new PromptConfig
activate a new ModelConfig
activate a new GuidanceRevision
activate a new DecisionPolicyRevision
activate a new MetricDefinitionRevision
change ControlPlaneActivation
```

Only Control Plane may activate new immutable revisions.

---

# 82. Learning From Observation

Observation-based learning may propose:

```text
test this hook again
adjust strategy hypothesis
investigate audience segment
change channel role
revise metric instrumentation
run an experiment
```

It must preserve observational uncertainty.

---

# 83. Learning From Causal Evidence

When SPEC03 EpistemicState for a causal Proposition is causally supported:

```text
ChangeProposal may reference that causal state.
```

Proposal still remains a proposal.

Control Plane review/activation remains separate.

---

# 84. No Automatic Self-Optimization

ContentOS V1 must not implement:

```text
observe metric
→ automatically mutate prompt/policy/strategy configuration
```

without explicit Control Plane activation.

This prevents hidden self-modification.

---

# 85. Learning Does Not Rewrite History

A new learning state cannot retroactively alter:

```text
old DecisionSnapshot
old DecisionRecord
old Candidate
old PublishedArtifact
old PerformanceObservation
```

Future runs may use new approved revisions/knowledge.

---

# 86. V1B Learning Loop

Canonical learning closure:

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
ChangeProposal
↓
Control Plane review
↓
optional new immutable revision
↓
future Run
```

---

# 87. Measurement Ingestion Command

`IngestMeasurement` is an externally retried mutation command.

Per SPEC01 it MUST accept:

```text
Idempotency-Key
```

Same key + different request hash:

```text
IDEMPOTENCY_CONFLICT
```

---

# 88. Measurement Ingestion Idempotency

Canonical ingestion identity must distinguish:

```text
tenant/workspace
measurement source
metric_revision_id
measurement window
population/denominator semantics
publication coverage semantics
source snapshot/export identity
```

Exact retry:

```text
at most one canonical measurement effect
```

---

# 89. Correction Is Not Retry

A correction with new data is a new semantic event.

It must not reuse the old request identity as though nothing changed.

Use new idempotency identity and explicit supersession.

---

# 90. Publication Command Idempotency

CreatePublishedArtifact also requires Idempotency-Key under SPEC01.

Duplicate external publication ingestion must not create duplicate PublishedArtifact history.

---

# 91. Measurement Worker StageExecution

Suggested stages:

```text
PUBLICATION_INGEST
MEASUREMENT_INGEST
MEASUREMENT_VALIDATE
OBSERVATION_CORRECT
PERFORMANCE_TO_EVIDENCE
LEARNING_DERIVE
CHANGE_PROPOSAL_CREATE
```

Names may vary.

Semantics may not.

---

# 92. Measurement Transactions

Canonical PerformanceObservation write:

```text
BEGIN

verify tenant/workspace
verify metric revision
verify measurement window
verify measurement state
verify publication-state cardinality
verify publication lineage integrity
verify publication interval containment
verify source provenance
verify correction semantics if superseding
insert PerformanceObservation
write outbox event

COMMIT
```

---

# 93. MeasurementState Transaction

```text
BEGIN

verify correction predecessor if any
verify no successor branch
verify context compatibility
validate maturity/finality/missingness/incidents
insert MeasurementState
write outbox event

COMMIT
```

---

# 94. Observation Correction Transaction

```text
BEGIN

lock predecessor correction lineage
verify no direct successor exists
verify same metric revision
verify same semantic measurement scope
insert corrected observation
write outbox event

COMMIT
```

---

# 95. Performance-to-Evidence Transaction

```text
BEGIN

verify PerformanceObservation
verify MeasurementState
verify publication/metric context
create EvidenceItem with origin_type=PERFORMANCE_OBSERVATION
preserve limitations
write outbox event

COMMIT
```

Evidence mapping/assessment then follows SPEC03.

---

# 96. ChangeProposal Transaction

```text
BEGIN

verify every supporting ref
verify target_revision_ref if present
verify tenant/scope
validate uncertainty
insert immutable ChangeProposal
write outbox event

COMMIT
```

No activation occurs in this transaction.

---

# 97. Multi-Tenant Isolation

Measurement data is tenant/workspace scoped under SPEC02.

Knowing another tenant's:

```text
publication_lineage_id
published_artifact_id
observation_id
metric_revision_id
```

does not grant access.

Cross-tenant aggregate learning requires explicit authorized aggregate scope.

---

# 98. Authorized Aggregate Learning

AUTHORIZED_AGGREGATE data may be used only when:

```text
source authorization permits it
privacy/security contract permits it
aggregation prevents prohibited tenant leakage
```

SPEC08 defines privacy/security constraints.

SPEC07 does not assume cross-tenant learning is allowed by default.

---

# 99. Source Data Integrity

Raw platform/warehouse data used for measurement may be object-backed.

Canonical object-backed measurement references must follow SPEC02 ObjectRegistry integrity.

No canonical observation may reference a deleted/GC-claimed object as valid source state.

---

# 100. Measurement Deletion

If source data must be deleted under SPEC08:

```text
data rights win
```

Replayability may degrade.

Do not keep prohibited raw measurement solely for reproducibility.

---

# 101. Historical Measurement Replay

Historical replay uses exact:

```text
PublishedArtifact IDs
MetricDefinitionRevision
AttributionModelRevision if applicable
MeasurementState
PerformanceObservation
source references where available
```

No current metric/attribution model substitution.

---

# 102. Current Performance Query

Operational current-state query may resolve the terminal correction successor.

Historical replay must still expose the exact observation used at the historical knowledge boundary.

"Latest correction" is a query behavior, not mutation of history.

---

# 103. No CURRENT in Evidence Origin

An EvidenceItem derived from performance must reference exact:

```text
observation_id
```

It may not reference:

```text
"latest observation for campaign X"
```

---

# 104. Learning Time

New performance knowledge becomes available when its canonical observation/evidence state is known.

Future decisions may use it.

Past frozen decisions do not gain it retroactively.

---

# 105. Measurement Window vs Knowledge Time

Measurement business time and system-known time are distinct.

A window may cover last week while the observation becomes known today.

Future decision epistemic state must respect:

```text
known_from
```

through SPEC03.

---

# 106. Incomplete Observation

An observation tied to a non-final MeasurementState may still exist canonically.

It must carry the exact maturity/missingness context into learning.

It must not be mislabeled final.

---

# 107. Final Observation

`MeasurementState.is_final = true` does not mean:

```text
causal
error-free
universally generalizable
```

It only means finality according to the measurement-state contract.

---

# 108. Causal Claim Construction

To produce a causal Proposition such as:

```text
"Creative treatment X increased conversion by Y"
```

the evidence path must include valid causal evidence under SPEC03.

A plain PerformanceObservation is insufficient by itself.

---

# 109. Incremental Lift

Incremental lift requires a comparison to an explicit counterfactual/control basis.

If the measurement contract does not identify a credible counterfactual:

```text
do not label value incremental lift.
```

---

# 110. Platform Lift Studies

A platform-provided lift study may be ingested as experiment evidence when its design/source state is captured and assessed.

Do not treat the label "lift study" as automatically causal.

The EvidenceAssessment still evaluates method quality/identification.

---

# 111. Natural Experiments

Natural/quasi-experimental evidence may enter as:

```text
EvidenceDomain = QUASI_EXPERIMENT
```

when the identification design is explicit.

Otherwise it remains observational.

---

# 112. A/B Test Label Safety

A workflow named "A/B test" is not automatically a randomized experiment.

If assignment is not random/credible:

```text
do not classify as RANDOMIZED_EXPERIMENT
```

---

# 113. Experiment Publication Drift

If treatment content changes during an experiment:

```text
published state changed
```

The analysis must preserve which PublishedArtifact states were actually exposed.

Do not continue treating the treatment as one immutable creative.

---

# 114. Experiment Population Drift

If eligible population or allocation changes materially:

```text
preserve that context
```

and assess whether analysis remains comparable.

Do not hide population changes inside one causal estimate.

---

# 115. Metric Guardrails

Guardrail metrics may inform experiment decisions.

They do not disappear because primary metric improves.

A learning proposal must preserve material guardrail failures.

---

# 116. Outcome Lag

OutcomeModel time lags may inform measurement windows.

A too-short window should be marked as a limitation rather than interpreted as "no effect."

---

# 117. Measurement Completeness

Learning logic must not cherry-pick only favorable measured outcomes when required guardrail/diagnostic metrics are part of the decision contract.

Omitted required metrics:

```text
LEARNING_INCOMPLETE
```

---

# 118. Metric Layer Separation

Content metrics, diagnostic metrics, business outcomes and guardrails may occupy different layers.

A movement in one layer does not automatically imply movement in another.

---

# 119. Attribution Credit Sum

If an AttributionModelRevision defines normalized credit allocation, the runtime must validate its contract-specific consistency.

SPEC07 does not impose a universal "sum to 1" rule when the model semantics do not require it.

---

# 120. Lookback Window

Attribution must respect the exact model's:

```text
lookback_window
```

Do not use touchpoints outside the model contract and still call the result model-compliant.

---

# 121. Eligible Touchpoints

Only touchpoints allowed by the AttributionModelRevision may receive credit under that model.

Hidden extra touchpoints make the attribution result invalid.

---

# 122. Attribution Model Revision Mismatch

A metric tied to AttributionModelRevision A cannot be calculated under model B while retaining A's metric revision identity.

New semantics require new appropriate metric/revision state.

---

# 123. Performance Observation Scope

An observation must not claim narrower creative specificity than its publication coverage allows.

Scope must be at least as broad/uncertain as the underlying coverage.

---

# 124. Mixed State Split Preference

When exact effective intervals permit:

```text
split a mixed measurement into artifact-specific observations
```

rather than keeping an unnecessarily mixed state.

But splitting must preserve denominator semantics and avoid double counting.

---

# 125. Split Conservation

When a mixed observation is split:

```text
do not duplicate the same events/denominator across child observations
```

unless the metric semantics explicitly require overlapping windows.

---

# 126. Aggregate Deduplication

Multi-lineage aggregate measurement contract must define deduplication when one event/user may belong to multiple lineages/touchpoints.

Undefined deduplication:

```text
AGGREGATE_MEASUREMENT_INVALID
```

when double counting is material.

---

# 127. Aggregate Attribution

An aggregate measurement may use an AttributionModelRevision.

If so:

```text
credit assignment remains attribution,
not causality.
```

---

# 128. Aggregate Learning Scope

Learning from aggregate multi-lineage measurements may support:

```text
portfolio/channel/program-level
PERFORMANCE / STRATEGIC / AUDIENCE
```

Propositions whose scope matches the aggregate.

It may not silently become one-artifact learning.

---

# 129. Learning Proposition Identity

Performance-derived learning must resolve canonical Proposition identity under SPEC03.

Do not create duplicate semantic Propositions for each measurement run.

---

# 130. Learning Epistemic Update

New performance evidence may produce:

```text
new EvidenceAssessment
new EpistemicStateVersion
```

under SPEC03.

Old EpistemicStateVersion remains immutable.

---

# 131. Correction & Epistemic Update

A corrected observation does not mutate an old EpistemicState.

New corrected evidence leads to new assessment/state as needed.

Historical decision replay keeps the old known state.

---

# 132. ChangeProposal Targeting

If `target_revision_ref` is present:

```text
it must resolve to one immutable revision.
```

The proposal does not target:

```text
CURRENT
LATEST
ACTIVE
```

---

# 133. ChangeProposal General Proposal

A proposal may omit target_revision_ref when proposing a new concept/revision not tied to one exact existing target.

Supporting refs remain mandatory enough for audit according to proposal type.

---

# 134. Proposal Evidence Strength

Observed associations may justify:

```text
TEST / INVESTIGATE / CONSIDER
```

type proposed changes.

They do not justify wording that falsely asserts:

```text
PROVEN CAUSAL IMPROVEMENT
```

unless causal evidence supports it.

---

# 135. Learning Uncertainty Preservation

ChangeProposal.uncertainty must not be empty when the supporting learning materially depends on:

```text
non-final data
mixed publication state
unresolved coverage
attribution assumptions
observational design
sample limitations
known incidents
```

---

# 136. Human Approval Does Not Create Evidence

A human approving a ChangeProposal authorizes a future config/revision workflow.

It does not itself upgrade the underlying evidence quality.

---

# 137. Control Plane Activation

If proposal is accepted:

```text
Control Plane creates new immutable revision
```

and may activate it under ControlPlaneActivation rules.

The proposal itself is never the active revision.

---

# 138. Future Run Isolation

A new activated revision affects only runs/cycles whose initialization/as-of boundary legitimately resolves it.

Historical runs do not change.

---

# 139. Measurement Cache

Caches may accelerate:

```text
source ingestion
metric calculation
attribution calculation
aggregate rollups
learning derivation
```

Cache key must include exact:

```text
metric revision
attribution model revision
publication IDs
window
population/denominator semantics
source snapshot
measurement contract
tenant/workspace
```

Cache is non-authoritative.

---

# 140. Cache Invalidation

Material change to any measurement input invalidates reuse.

Do not reuse a cached metric after:

```text
publication edit
metric revision change
attribution model change
measurement correction
population change
source backfill
```

---

# 141. Stale Worker Protection

Measurement correction / learning workers using StageExecution must obey fencing where applicable.

A stale worker may not create a competing correction successor after losing authority.

---

# 142. Correction Concurrency

Two workers correcting the same predecessor:

```text
one may win
the other must reload canonical successor or fail
```

No branching correction history.

---

# 143. Observation Concurrency

Exact ingestion retry may not create duplicate canonical observations.

Distinct semantically independent observations may coexist.

---

# 144. Learning Concurrency

Two workers deriving the same semantic learning may produce duplicate proposal attempts operationally.

Canonical ChangeProposal idempotency should converge when the exact proposal identity/input is identical.

Different genuinely independent proposals may coexist.

---

# 145. Performance Evidence Idempotency

Exact performance-to-evidence derivation must not create uncontrolled duplicate equivalent EvidenceItems for one observation/extractor contract.

SPEC03 idempotency rules apply.

---

# 146. Experiment Evidence Idempotency

Re-ingesting the exact same experiment result snapshot must not create contradictory duplicate source/evidence history.

A corrected experiment analysis is a new immutable source/evidence event.

---

# 147. Observability

SPEC07 stages should emit:

```text
tenant/workspace
publication_lineage_id
published_artifact_ids
metric_revision_id
attribution_model_revision_id if any
measurement_state_id
observation_id
source reference/hash
window
population/denominator
publication_state
correction predecessor
stage execution/idempotency
result class
reason codes
```

Sensitive raw measurement payload should not be duplicated in logs.

---

# 148. Audit Trace

For one learned proposal, auditor must traverse:

```text
ChangeProposal
↓
supporting refs
↓
EpistemicState / EvidenceAssessment
↓
EvidenceItem
↓
PerformanceObservation or experiment SourceArtifact
↓
MeasurementState
↓
MetricDefinitionRevision
↓
AttributionModelRevision if applicable
↓
PublishedArtifact / PublicationLineage
```

No hidden measurement truth.

---

# 149. Historical Replay

Historical replay must not:

```text
recalculate old observations using current metric definitions
reassign attribution using current models
replace old publication coverage
replace preliminary data with latest correction
```

unless explicitly performing a labeled counterfactual/re-analysis.

---

# 150. Counterfactual Re-Analysis

A user may request:

```text
"What would this old publication look like under today's metric/attribution model?"
```

That is allowed as new analysis.

It must be labeled:

```text
COUNTERFACTUAL / RE-ANALYSIS
```

and must not overwrite historical observations.

---

# 151. Fail-Closed Conditions

Fail closed when:

```text
metric revision missing
attribution model missing when required
publication coverage invalid
SINGLE_ARTIFACT cardinality invalid
MIXED state crosses lineages
single-artifact window exceeds effective interval
aggregate contract missing
aggregate deduplication undefined materially
measurement-state context inconsistent
correction semantic scope differs
correction would branch
source provenance missing
causal claim lacks causal evidence
ChangeProposal supporting refs unresolved
runtime attempts Control Plane activation
tenant boundary fails
```

Fail closed means:

```text
do not produce misleading canonical measurement/learning state
```

---

# 152. Operational Reason Codes

Examples:

```text
METRIC_REVISION_MISSING
ATTRIBUTION_MODEL_MISSING
PUBLICATION_COVERAGE_INVALID
PUBLICATION_WINDOW_MISMATCH
MIXED_LINEAGE_INVALID
AGGREGATE_CONTRACT_MISSING
AGGREGATE_DEDUP_UNDEFINED
MEASUREMENT_STATE_INVALID
MEASUREMENT_NOT_FINAL
MEASUREMENT_MISSINGNESS
MEASUREMENT_INCIDENT
CORRECTION_SCOPE_MISMATCH
CORRECTION_BRANCH_CONFLICT
ATTRIBUTION_NOT_CAUSAL
CAUSAL_EVIDENCE_REQUIRED
PERFORMANCE_EVIDENCE_FIREWALL
CHANGE_PROPOSAL_REF_INVALID
CONTROL_PLANE_ACTIVATION_FORBIDDEN
TENANT_SCOPE_VIOLATION
```

These are operational codes, not new canonical enums.

---

# 153. Fixed Adversarial Test Suite

The following suite is locked for SPEC07 v1.0 audit.

```text
01 Candidate performance measured without resolving PublishedArtifact
02 PublishedArtifact channel/destination duplicated as canonical truth
03 CONTENTOS_EXECUTION missing ExecutionArtifact
04 MANUAL_EXTERNAL incorrectly carries ExecutionArtifact
05 source_candidate_id disagrees with ExecutionArtifact.candidate_id
06 second publication root created
07 publication branch created
08 publication successor crosses lineage
09 publication cycle created
10 publication effective_from not strictly increasing

11 metric observation resolves CURRENT metric revision
12 old observation reinterpreted under new metric definition
13 metric denominator changes without new revision
14 attribution model changes while metric revision identity remains unchanged
15 attribution result treated as incremental causal effect
16 platform conversion credit labeled causal lift
17 touchpoint outside eligible set receives attribution credit
18 lookback window ignored
19 attribution limitations dropped from learning
20 cross-channel attribution treated as causal evidence

21 MeasurementState mutated in place
22 MeasurementState correction branches
23 unrelated measurement-quality context falsely supersedes old state
24 maturity/finality inconsistency silently accepted
25 missingness omitted despite known missing data
26 known tracking incident hidden
27 preliminary data presented as final
28 late-event update rewrites old state
29 measurement source provenance missing
30 deleted raw source still treated fully replayable

31 SINGLE_ARTIFACT contains zero artifacts
32 SINGLE_ARTIFACT contains multiple artifacts
33 SINGLE_ARTIFACT window exceeds artifact effective interval
34 mixed revision window incorrectly assigned to one artifact
35 MIXED_PUBLICATION_STATE contains artifacts from multiple lineages
36 MIXED state used for version-specific creative claim
37 UNRESOLVED state silently upgraded to SINGLE
38 unresolved state used for exact-artifact performance claim
39 multi-lineage aggregate stored as MIXED publication-revision observation
40 multi-lineage aggregate lacks pinned aggregate measurement contract

41 aggregate contract lacks dedup semantics where material
42 aggregate observation silently double-counts overlapping users/events
43 aggregate result assigned to one artifact
44 aggregate attribution treated as causal
45 population/denominator semantics changed in correction
46 corrected observation changes metric revision
47 corrected observation changes measurement window semantics
48 observation correction branches
49 observation correction cycle
50 corrected value mutates old observation

51 corrected MeasurementState changes interpretation but old observation reused as current
52 corrected observation and predecessor counted as independent corroboration
53 PerformanceObservation converted to EvidenceItem with wrong origin_type
54 performance EvidenceItem drops measurement maturity/missingness context
55 high conversion used to prove product factual claim
56 high engagement used to prove safety claim
57 observed feature association stated as causal lift
58 feature learning not grounded in exact PublishedArtifact content
59 mixed-state performance used as version-specific proposition
60 metric revision mismatch hidden in aggregate learning

61 workflow named A/B test classified RANDOMIZED_EXPERIMENT without credible randomization
62 experiment treatment identity not bound to immutable content state
63 experiment metric semantics not pinned/captured
64 experiment attrition/missingness omitted
65 opportunistic stopping hidden
66 quasi-experiment lacks explicit identification strategy but reported causal
67 experiment population drift hidden
68 treatment content changes mid-experiment but treated as one immutable variant
69 causal claim built from plain observational PerformanceObservation only
70 platform lift label accepted as causal without EvidenceAssessment

71 ChangeProposal has unresolved supporting ref
72 ChangeProposal targets CURRENT/LATEST revision
73 observational association proposal claims proven causality
74 proposal uncertainty erased despite non-final/mixed/attributed data
75 runtime ChangeProposal directly activates Control Plane revision
76 new learning rewrites old DecisionSnapshot
77 measurement cache reused after metric/publication/correction input changed
78 duplicate IngestMeasurement key with different payload not rejected
79 historical replay recalculates using current metric/attribution model
80 cross-tenant performance data leaks into learning
```

Expected for freeze:

```text
80 / 80
PRESERVE INVARIANTS
```

No additional freeze blocker may be introduced after suite lock unless a concrete contradiction against Blueprint v2.13.1 or SPEC01–06 frozen contracts is demonstrated.

---

# 154. Static Contract Preflight

SPEC07 freeze audit must check exactly:

```text
01 no new canonical domain entity invented
02 Candidate != ExecutionArtifact != PublishedArtifact preserved
03 PublicationLineage remains sole channel/destination owner
04 publication single-root invariant preserved
05 publication non-branching invariant preserved
06 publication same-lineage successor invariant preserved
07 publication acyclic/time-order invariants preserved
08 MetricDefinitionRevision remains exact immutable revision
09 AttributionModelRevision remains exact immutable revision
10 attribution != incremental causal effect preserved
11 MeasurementState canonical fields preserved including is_final
12 MeasurementState remains append-only/non-branching
13 PerformanceObservation canonical fields preserved
14 PublicationState closed vocabulary preserved
15 SINGLE_ARTIFACT cardinality preserved
16 SINGLE_ARTIFACT window containment preserved
17 MIXED known artifacts remain same PublicationLineage
18 multi-lineage aggregate does not misuse MIXED publication-revision state
19 aggregate measurement contract is non-canonical/pinned
20 observation correction scope identity preserved
21 observation correction chain non-branching/acyclic
22 performance-to-evidence origin contract preserved
23 performance evidence firewall preserved
24 correction lineage not double-counted as independent evidence
25 experiment learning uses existing SourceArtifact/Evidence pipeline
26 no new Experiment entity invented
27 causal learning still owned by SPEC03 epistemic rules
28 ChangeProposal remains immutable
29 runtime cannot activate Control Plane
30 IngestMeasurement API idempotency preserved
31 tenant isolation preserved
32 deletion/replay degradation preserved
33 historical replay uses exact old metric/attribution/observation state
34 no duplicated source of measurement truth
```

Freeze target:

```text
34 / 34 PASS
```

---

# 155. Acceptance Criteria

SPEC07 is freeze-eligible only if:

```text
1.
Performance measurement resolves exact PublishedArtifact state.

2.
Publication lineage identity remains correct and immutable.

3.
Metric interpretation uses exact MetricDefinitionRevision.

4.
Attribution uses exact AttributionModelRevision.

5.
Attribution never becomes causal incrementality by label alone.

6.
MeasurementState corrections are append-only.

7.
PerformanceObservation corrections are append-only.

8.
Correction scope cannot silently change.

9.
SINGLE_ARTIFACT cardinality is exact.

10.
SINGLE_ARTIFACT measurement window stays inside publication interval.

11.
MIXED publication-revision observations stay within one lineage.

12.
Multi-lineage aggregates use a separate pinned aggregate contract.

13.
Aggregate deduplication is explicit where material.

14.
UNRESOLVED publication identity remains unresolved.

15.
Performance-derived evidence preserves measurement context.

16.
Performance evidence cannot prove unrelated factual/safety/regulatory/medical claims.

17.
Observed effectiveness remains distinct from content quality.

18.
Observed effectiveness remains distinct from causal effectiveness.

19.
Randomized/quasi-experimental learning enters existing evidence architecture.

20.
No new Experiment entity is invented.

21.
Causal conclusions still require SPEC03 causal epistemic support.

22.
Correction-lineage measurements are not double-counted as independent evidence.

23.
ChangeProposal has typed supporting refs.

24.
ChangeProposal preserves learning uncertainty.

25.
Runtime may propose but cannot activate revisions.

26.
Learning cannot rewrite old decisions/publications/observations.

27.
IngestMeasurement is idempotent.

28.
Same idempotency key + different payload is rejected.

29.
Measurement cache is input-exact and non-authoritative.

30.
Cross-tenant learning is denied unless explicitly authorized.

31.
Historical replay uses recorded exact measurement state.

32.
Deletion may degrade replay but not rewrite history.

33.
The 80-test adversarial suite passes.

34.
The 34-check static preflight passes.
```

---

# 156. Verification Record — Final Freeze

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

# 157. Canonical V1B Measurement Runtime

```text
PublishedArtifact
↓
resolve effective publication state
↓
MetricDefinitionRevision
↓
AttributionModelRevision if metric requires
↓
MeasurementState
↓
PerformanceObservation
↓
validate publication coverage/window
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
future Run
```

---

# 158. Experimental Learning Runtime

```text
experiment result snapshot
↓
SourceArtifact
↓
EvidenceItem
(
RANDOMIZED_EXPERIMENT
or
QUASI_EXPERIMENT
)
↓
EvidenceAssessment
↓
causal EpistemicStateVersion if justified
↓
ChangeProposal
↓
Control Plane review
```

No separate Experiment domain entity is required in V1.

---

# 159. Correction Runtime

```text
MeasurementState M1
PerformanceObservation O1
↓
late/corrected data
↓
MeasurementState M2
supersedes M1 when same quality context
↓
PerformanceObservation O2
supersedes O1 when same semantic measurement scope
↓
new performance evidence as needed
↓
new EpistemicStateVersion as needed
```

Old M1/O1 remain immutable.

---

# 160. Final Doctrine

```text
MEASURE
THE PUBLISHED STATE,
NOT THE INTENDED CANDIDATE.

PIN THE METRIC.

PIN THE ATTRIBUTION MODEL.

ATTRIBUTION
IS NOT CAUSATION.

OBSERVATION
IS NOT INCREMENTALITY.

CORRECTION
CREATES NEW STATE.

MIXED PUBLICATION STATE
STAYS MIXED.

UNKNOWN COVERAGE
STAYS UNKNOWN.

PERFORMANCE EVIDENCE
RETURNS THROUGH
THE EVIDENCE PIPELINE.

EXPERIMENTS
DO NOT BYPASS
EPISTEMIC ASSESSMENT.

LEARNING
MAY PROPOSE.

RUNTIME
MAY NOT ACTIVATE.

HISTORY
DOES NOT REWRITE ITSELF.

NO HIDDEN CURRENT STATE.
NO DOUBLE COUNTING.
NO TENANT LEAKAGE.
NO MOVING GOALPOSTS.

LOCK THE SUITE.
AUDIT IT.
THEN FREEZE.
```

---

**End of ContentOS SPEC 07 — Measurement / Experimentation / Learning v1.0 — FROZEN**
