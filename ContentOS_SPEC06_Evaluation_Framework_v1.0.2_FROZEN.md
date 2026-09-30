# ContentOS SPEC 06 — Evaluation Framework
## Assertion Validation, Composite Closure, Qualitative Evaluation, Risk & Uncertainty
### Version 1.0.2 — Frozen Evaluation Framework

---

# 0. Status

```text
SPEC
SPEC 06 — EVALUATION FRAMEWORK

VERSION
1.0.2

SOURCE OF TRUTH
ContentOS Blueprint v2.13.1 — FROZEN
ContentOS SPEC 01 v1.1.3 — FROZEN
ContentOS SPEC 02 v1.0.6 — FROZEN
ContentOS SPEC 03 v1.0.1 — FROZEN
ContentOS SPEC 04 v1.0.2 — FROZEN
ContentOS SPEC 05 v1.0.5 — FROZEN

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

SPEC05 v1.0.5
c8d645700d24091a4853e83b27f1a2e7218f6f4b3b83925a1541224c84e0eeaf
```

SPEC06 defines evaluation behavior.

It does not change frozen domain schemas.

---

# 1. Purpose

SPEC06 defines how ContentOS evaluates what was actually generated.

Canonical flow:

```text
ContentCandidate
↓
ContentAssertion extraction
↓
AssertionPropositionLink mapping
↓
AssertionValidationResult
↓
CompositeImpressionAssessment
↺ implied assertions re-enter validation
↓
QualitativeEvaluation
↓
RiskAssessment
↓
UncertaintyAssessment
↓
DecisionSnapshot closure
```

SPEC06 closes behavioral contracts for:

```text
assertion extraction
assertion identity
assertion materiality handling
assertion-to-proposition mapping
mapping uncertainty
wording-strength validation
scope/condition validation
qualification requirements
implied-assertion discovery
composite impression closure
misleading-risk detection
required disclosures
qualitative evaluation
EvalContract execution
hard-gate handling
risk assessment
uncertainty assessment
evaluation revision pinning
evaluation idempotency
evaluation concurrency
stale-worker protection
FREEZING boundary
snapshot evaluation closure
historical replay
```

---

# 2. Non-Goals

SPEC06 does not own:

```text
content generation
strategy generation
evidence extraction
epistemic derivation
governance policy execution
rights/license interpretation
publication
measurement
experimentation
learning
```

Rights are SPEC08.

Measurement/experimentation/learning are SPEC07.

Release truth remains owned by DecisionRecord through SPEC04.

---

# 3. Evaluation Doctrine

```text
CANDIDATE
IS NOT TRUTH.

ASSERTION
IS NOT PROPOSITION.

MAPPING
IS NOT SUPPORT.

A SUPPORTED PROPOSITION
DOES NOT AUTOMATICALLY SUPPORT
BROADER WORDING.

UNKNOWN
DOES NOT BECOME SUPPORTED.

INSUFFICIENT
DOES NOT BECOME SUPPORTED.

CONTRADICTED
DOES NOT BECOME SUPPORTED.

QUALIFICATION
MUST EXIST
IN THE CANDIDATE
BEFORE RELEASE.

IMPLIED ASSERTIONS
ARE REAL ASSERTIONS.

IMPLIED ASSERTIONS
USE THE SAME VALIDATION PATH.

A GOOD SCORE
CANNOT OVERRIDE
A FAILED HARD GATE.

RISK
IS NOT UNCERTAINTY.

UNCERTAINTY
IS NOT RISK.

EVALUATION
IS IMMUTABLE.

RE-EVALUATION
CREATES NEW STATE.

THE SNAPSHOT
PINS EXACT RESULTS.

NO HIDDEN MODEL MEMORY.
NO CURRENT CONFIG LOOKUP.
NO STALE-WORKER COMMIT.
```

---

# 4. Canonical Entities Used

SPEC06 uses the frozen contracts:

```text
ContentCandidate
ContentAssertion
AssertionPropositionLink
AssertionValidationResult
CompositeImpressionAssessment
QualitativeEvaluation
RiskAssessment
UncertaintyAssessment

Proposition
EpistemicStateVersion

EvalContractRevision
RunConfig
DecisionSnapshot

ApplicabilityAssessment
RightsCheck
```

SPEC06 introduces no new canonical domain entity.

Operational iteration counters, stage outcomes, caches and diagnostic views are non-authoritative.

---

# 5. Authoritative Canonical Schema Rule

SPEC06 uses the canonical Blueprint `.md` + SPEC02 schema.

It does NOT add fields found only in non-authoritative intermediate text/patch variants such as:

```text
supersedes_validation_result_id
validation_round
supersedes_composite_assessment_id
iteration
validator_revision_ref
```

Canonical fields remain those frozen upstream.

---

# 6. ContentAssertion Contract

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

Immutable.

---

# 7. Assertion Artifact Binding

For V1A candidate evaluation:

```text
ContentAssertion.artifact_ref
→ exact ContentCandidate
```

The referenced Candidate must be the candidate actually evaluated.

An Assertion extracted from Candidate A may not be attached to Candidate B.

---

# 8. Assertion Identity

One material audience-interpretable assertion receives one immutable:

```text
assertion_id
```

If interpretation materially changes:

```text
new assertion_id
```

Do not mutate the old assertion.

---

# 9. Assertion Extraction

Extraction must inspect the actual immutable candidate payload.

It must not validate only:

```text
prompt intent
architecture intent
strategy intent
writer explanation
```

Evaluation concerns what the Candidate communicates.

---

# 10. Multimodal Extraction

When candidate payload contains multiple modalities:

```text
text
visual
audio
multimodal combinations
```

assertion extraction must inspect all decision-relevant modalities.

The evaluation runtime must not treat text as the only source of claims when visuals/audio can materially change audience interpretation.

SPEC06 does not freeze new modality enum values absent from upstream closed vocabularies.

---

# 11. Explicit and Implied Assertions

ContentOS distinguishes:

```text
directly expressed assertions
implied assertions
```

The exact stored `explicitness` value must follow the configured schema.

Behavioral invariant:

```text
IMPLIED MEANING
CANNOT BYPASS VALIDATION.
```

---

# 12. Materiality

`materiality` identifies decision relevance of an assertion.

Materiality affects:

```text
validation priority
release closure
risk assessment
composite interpretation
```

A low-materiality assertion may still be validated.

A material assertion may never be silently omitted from final release validation.

---

# 13. Source Elements

`source_elements` identify where the assertion arises in the candidate.

Examples:

```text
sentence/span
headline
caption
visual region
scene
audio segment
combination of elements
```

Source elements support audit.

They do not replace `artifact_ref`.

---

# 14. Interpretation

`interpretation` expresses the audience-interpretable meaning being evaluated.

It must preserve:

```text
qualifiers
conditions
scope
comparison basis
time scope
population scope
causal strength
certainty strength
```

when those are material.

---

# 15. Wording Strength

`wording_strength` captures how strongly the Candidate expresses the assertion.

Examples conceptually include distinctions like:

```text
may
can
often
is associated with
improves
guarantees
causes
always
```

SPEC06 does not freeze a universal numeric scale.

Evaluator config may define structured strength semantics.

---

# 16. Assertion Conditions

Conditions that materially narrow a claim belong in:

```text
conditions
```

Dropping conditions during extraction is invalid.

Example:

```text
"may improve X when Y"
```

must not be extracted as:

```text
"improves X"
```

---

# 17. Audience Interpretation Context

`audience_interpretation_context` records material context needed to understand likely meaning.

It may include:

```text
adjacent wording
visual context
audio context
placement
sequence
disclosure proximity
channel conventions
```

It must not become hidden unverifiable rationale.

---

# 18. Assertion Extraction Grounding

Extractor output must be grounded in:

```text
Candidate.content_payload
```

plus explicit evaluation context.

The extractor may not invent a claim that is not reasonably communicated by the Candidate.

---

# 19. Assertion Completeness

For release evaluation, extraction must cover all material assertions in the Candidate.

"Only validate the claims we already know about" is insufficient.

Composite closure exists partly to discover material implied assertions missed by first-pass extraction.

---

# 20. Assertion Extraction Uncertainty

If assertion identity/interpretation is materially ambiguous:

```text
preserve ambiguity
```

through interpretation/context and downstream mapping uncertainty.

Do not select the most favorable interpretation merely to pass validation.

---

# 21. AssertionPropositionLink Contract

```text
AssertionPropositionLink

link_id

assertion_id
proposition_id

relation

mapping_uncertainty

created_at
```

Immutable.

---

# 22. Frozen Mapping Relations

V1 closed relation vocabulary:

```text
EQUIVALENT
NARROWER
BROADER
CONJUNCT
IMPLIES
CONTRADICTS
```

No silent replacement with free-form relation semantics.

---

# 23. Mapping Purpose

AssertionPropositionLink answers:

```text
HOW DOES THE ASSERTION'S MEANING
RELATE TO THIS CANONICAL PROPOSITION?
```

It does not answer:

```text
IS THE ASSERTION SUPPORTED?
```

Support belongs to AssertionValidationResult using EpistemicState.

---

# 24. EQUIVALENT

Use only when the assertion and proposition are materially equivalent in:

```text
meaning
scope
conditions
population
jurisdiction
certainty/strength
```

Superficial semantic similarity is insufficient.

---

# 25. NARROWER

The assertion claims a materially narrower scope than the Proposition.

A narrower assertion may be supportable when the Proposition's supported scope actually covers the assertion's narrower scope.

Narrowness alone does not guarantee support.

---

# 26. BROADER

The assertion extends beyond the mapped Proposition's supported meaning.

A BROADER mapping may not inherit support beyond the Proposition.

If the broader portion lacks adequate support:

```text
OVERCLAIM
or
UNSUPPORTED
```

as semantically appropriate.

---

# 27. CONJUNCT

The assertion combines multiple proposition-level meanings.

All material conjuncts needed for the assertion must be mapped and validated.

One supported conjunct cannot support the entire combined assertion.

---

# 28. IMPLIES

The assertion communicates meaning that implies a Proposition or depends on an inference relation.

Implication does not automatically preserve support strength.

The evaluator must check whether the claimed inference is justified by the exact mapped epistemic state.

---

# 29. CONTRADICTS

Use when the assertion materially conflicts with the mapped Proposition meaning.

This relation by itself is not the validation result.

Validation still considers the Proposition's EpistemicState.

---

# 30. Mapping Uncertainty

`mapping_uncertainty` preserves ambiguity in the assertion↔proposition relationship.

If uncertainty is material enough to change validation status:

```text
SUPPORTED
```

must not be emitted merely by choosing the favorable mapping.

---

# 31. Proposition Resolution Before Mapping

The target Proposition must already exist canonically or be resolved through SPEC03 proposition identity rules before an AssertionPropositionLink is created.

SPEC06 must not invent mutable proposition text as a substitute for a real Proposition ID.

---

# 32. New Proposition During Evaluation

If evaluation discovers a material assertion meaning for which no canonical Proposition exists:

```text
route through SPEC03 Proposition resolution
```

Then:

```text
obtain decision-time EpistemicState if available
```

If required knowledge is unavailable:

```text
do not fabricate support
```

The old decision cycle may require new knowledge / new cycle depending on timing and materiality.

---

# 33. AssertionValidationResult Contract

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

Immutable.

---

# 34. Frozen Validation Statuses

```text
SUPPORTED

SUPPORTED_WITH_QUALIFICATION

OVERCLAIM

UNSUPPORTED

CONTRADICTORY
```

No additional canonical validation status in V1.

---

# 35. Validation Input Closure

Every validation result must satisfy:

```text
result.assertion_id
=
the Assertion being validated
```

Every `proposition_link_id` must:

```text
exist
reference the same assertion_id
reference a real Proposition
```

No cross-assertion links.

---

# 36. Exact Epistemic Input

Validation consumes exact decision-time:

```text
EpistemicStateVersion IDs
```

for mapped Propositions.

It may not resolve:

```text
CURRENT
LATEST
ACTIVE
```

during replay or after the evaluation boundary is pinned.

---

# 37. Evaluator Revision Closure

For run-created AssertionValidationResult:

```text
evaluator_revision_ref
```

must resolve to an immutable registered EvaluatorConfig revision and must be present in:

```text
DecisionSnapshot.RunConfig.evaluator_revision_refs
```

for any snapshot using that result.

---

# 38. SUPPORTED

`SUPPORTED` requires that the material assertion meaning is adequately covered by mapped Proposition state under the pinned evaluator contract.

At minimum:

```text
no material unsupported remainder
no material contradicted component
no missing required qualification
no unresolved mapping uncertainty that would change the result
wording strength does not exceed epistemic support
```

---

# 39. SUPPORTED Is Not Proposition SUPPORTED Copy

A Proposition with:

```text
support_status = SUPPORTED
```

does not automatically make every linked Assertion:

```text
SUPPORTED
```

The assertion may still be:

```text
BROADER
stronger
less qualified
different population
different condition
different jurisdiction
different causal strength
```

---

# 40. PARTIALLY_SUPPORTED Proposition

A material assertion relying on:

```text
EpistemicState.support_status = PARTIALLY_SUPPORTED
```

may be valid only if the assertion wording/conditions stay within the supported portion and limitations are preserved.

Otherwise it cannot be emitted as unqualified `SUPPORTED`.

---

# 41. UNKNOWN / INSUFFICIENT Guard

If material required Proposition state is:

```text
UNKNOWN
or
INSUFFICIENT
```

the validator may not transform the assertion into:

```text
SUPPORTED
```

Possible outcomes include:

```text
UNSUPPORTED
OVERCLAIM
SUPPORTED_WITH_QUALIFICATION
```

only when semantically justified by the exact mapped meaning.

Unknown remains unknown.

---

# 42. CONFLICTING Guard

If relevant EpistemicState is materially:

```text
CONFLICTING
```

the validator may not erase the conflict.

Unqualified `SUPPORTED` is prohibited when unresolved conflict materially affects the assertion.

---

# 43. CONTRADICTED Guard

If the assertion affirms a Proposition whose relevant decision-time state is materially:

```text
CONTRADICTED
```

the result must not be `SUPPORTED`.

When the assertion materially conflicts with supported/contradicting knowledge:

```text
CONTRADICTORY
```

is required when that status exactly describes the relationship.

---

# 44. Causal Strength Guard

An assertion using causal wording requires causal epistemic support under SPEC03.

Associational support or attribution alone may not validate a causal assertion as `SUPPORTED`.

---

# 45. Predictive Strength Guard

Predictive wording must not exceed the support available for the exact predictive Proposition.

Observed past performance does not automatically support guaranteed future outcomes.

---

# 46. OVERCLAIM

Use when the assertion has a related support basis but materially exceeds it in:

```text
scope
strength
certainty
population
condition
causal language
time horizon
generalization
```

OVERCLAIM differs from total absence of support.

---

# 47. UNSUPPORTED

Use when the required support basis is absent or inadequate for the material assertion meaning.

Examples:

```text
no mapped Proposition
missing decision-time epistemic basis
UNKNOWN/INSUFFICIENT basis without permissible qualification
unmapped material conjunct
```

---

# 48. CONTRADICTORY

Use when the assertion materially conflicts with the supported knowledge state or affirmatively states a meaning contradicted by decision-time knowledge.

It must not be used merely because evidence is missing.

---

# 49. SUPPORTED_WITH_QUALIFICATION

Use only when support becomes acceptable if a specific qualification/disclosure is present.

Required:

```text
required_qualification
MUST be non-empty
```

The required qualification must be concrete enough to verify against the Candidate.

---

# 50. Qualification Release Rule

A Candidate containing a material assertion with:

```text
SUPPORTED_WITH_QUALIFICATION
```

is not release-eligible until the required qualification is actually present in the exact immutable Candidate state selected for release.

A planned future edit does not satisfy the requirement.

---

# 51. Qualification Repair

If qualification is absent:

```text
SPEC05 rewrite
→ new Candidate
→ new Assertions
→ new validation
```

Do not mutate the old Candidate or old validation result.

---

# 52. Re-Evaluation

Re-evaluation creates:

```text
new result_id
```

It never mutates an earlier AssertionValidationResult.

Because the canonical schema has no validation supersession field, SPEC06 does not invent one.

---

# 53. Final Assertion Validation Selection

For a release DecisionSnapshot, each material final ContentAssertion included for the selected Candidate must have exactly one AssertionValidationResult selected into that snapshot as the decision-final validation for that assertion.

Required V1 snapshot rule:

```text
within one release DecisionSnapshot,
do not include two competing final validation results
for the same assertion_id.
```

Earlier evaluations may exist historically outside that snapshot.

---

# 54. No Favorable-Result Shopping

If multiple historical evaluation attempts exist:

```text
runtime may not pick an older favorable result
after a newer material candidate/evaluation context changed.
```

The selected result must correspond to the exact Candidate/assertion/context frozen into the decision.

---

# 55. Candidate Assertion Closure

For V1A release decisions:

```text
every ContentAssertion in DecisionSnapshot.assertion_ids
must artifact_ref a Candidate in DecisionSnapshot.candidate_ids.
```

For selected Candidate release closure:

```text
all material final assertions belong to selected candidate state.
```

---

# 56. CompositeImpressionAssessment Contract

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

Immutable.

Re-evaluation creates a new `assessment_id`.

---

# 57. Frozen Composite Statuses

```text
STABLE
STABLE_WITH_REQUIREMENTS
INVALID
REVIEW_REQUIRED
```

No extra canonical status is added in SPEC06.

---

# 58. Composite Purpose

Composite evaluation asks:

```text
WHAT MIGHT A REASONABLE AUDIENCE
UNDERSTAND FROM THE CANDIDATE AS A WHOLE?
```

It checks interactions that isolated assertion validation may miss.

Examples:

```text
headline + footnote
visual + caption
before/after imagery + copy
sequence of individually true statements
omitted condition
prominence imbalance
disclosure too remote
```

---

# 59. Composite Input Closure

Every `input_assertion_id` must:

```text
exist
belong to candidate_id
```

Every implied assertion used by the final release assessment must also:

```text
exist as ContentAssertion
belong to candidate_id
enter ordinary proposition mapping and validation
```

---

# 60. Implied Assertions Are First-Class

When composite assessment discovers a material implied assertion:

```text
create ContentAssertion
↓
map to Proposition(s)
↓
validate with AssertionValidationResult
↓
re-run composite assessment
```

The implied assertion may not remain only as prose inside:

```text
likely_interpretations
misleading_risks
```

if it is material to release.

---

# 61. No Implied-Assertion Bypass

A CompositeImpressionAssessment cannot be considered final stable closure if it contains a newly discovered material implied assertion that has not completed ordinary validation.

---

# 62. Composite Closure Loop

Operational flow:

```text
extract direct assertions
↓
map
↓
validate
↓
composite assessment
↓
new material implied assertions?
```

If yes:

```text
register assertions
↓
map
↓
validate
↓
new composite assessment
```

Repeat until closure or iteration budget.

---

# 63. Maximum Validation Iterations

`MAX_VALIDATION_ITERATIONS` is a pinned runtime parameter.

If closure does not stabilize before the limit:

```text
HUMAN_REVIEW_REQUIRED
```

for release governance.

Iteration exhaustion may not be converted into:

```text
STABLE
```

for convenience.

---

# 64. Composite Re-Evaluation

Each re-evaluation creates a new immutable:

```text
assessment_id
```

The schema does not contain a canonical supersession pointer.

Historical assessments remain immutable.

---

# 65. Final Composite Selection

For one selected Candidate in one release DecisionSnapshot:

```text
exactly one CompositeImpressionAssessment
is selected as the final decision-time composite state.
```

Earlier assessments may exist historically but are not simultaneously treated as competing final states in that snapshot.

---

# 66. STABLE

`STABLE` means:

```text
no unresolved material implied assertion
no material composite misleading defect
no unmet composite disclosure requirement
```

It does not mean:

```text
high-performing
good creative
safe in every legal jurisdiction
```

---

# 67. STABLE_WITH_REQUIREMENTS

Use only when the composite state is acceptable subject to explicit requirements.

Required:

```text
required_disclosures or equivalent explicit requirements
MUST be non-empty and machine-auditable enough to verify.
```

Those requirements must be satisfied before normal release if upstream governance treats them as mandatory.

---

# 68. INVALID

`INVALID` blocks normal:

```text
READY
READY_WITH_WARNINGS
```

release for the selected Candidate.

No aggregate score may override it.

---

# 69. REVIEW_REQUIRED

`REVIEW_REQUIRED` requires Human Review before normal release.

It must not be silently converted to STABLE due to iteration budget or model confidence.

---

# 70. Misleading Risks

`misleading_risks` captures whole-candidate interpretive risks.

It does not replace:

```text
RiskAssessment
```

A material misleading risk may trigger downstream RiskAssessment and governance.

---

# 71. Required Disclosures

`required_disclosures` are composite-level content requirements.

If a disclosure requires candidate modification:

```text
rewrite candidate
→ new candidate state
→ re-evaluate
```

A disclosure stored only in assessment metadata does not alter the Candidate.

---

# 72. Composite Evaluator Revision

For run-created composite assessments:

```text
evaluator_revision_ref
```

must resolve to registered immutable EvaluatorConfig and be pinned by DecisionSnapshot.RunConfig.

No current evaluator lookup.

---

# 73. QualitativeEvaluation Contract

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

# 74. EvalContractRevision Contract

Frozen EvalContractRevision owns:

```text
component
capability
required_dimensions
hard_gates
release_impact
```

Detailed rubrics, thresholds and evaluator methodology are implementation/configuration under exact immutable revisions.

---

# 75. Qualitative Evaluation Purpose

QualitativeEvaluation measures content quality/capability dimensions defined by the pinned EvalContractRevision.

Possible dimensions conceptually include:

```text
clarity
coherence
channel fit
brand fit
structural quality
specific capability quality
```

SPEC06 does not freeze a universal dimension list.

The EvalContractRevision does.

---

# 76. Required Dimensions

Every dimension required by the exact EvalContractRevision must have a result.

Missing required dimension:

```text
evaluation incomplete
```

not automatically passing.

---

# 77. Hard Gates

Every hard gate defined by the exact EvalContractRevision must be evaluated.

A failed hard gate may not be averaged away by:

```text
high soft scores
overall_state
model confidence
operator preference
```

---

# 78. Release Impact

The exact `EvalContractRevision.release_impact` determines how failed gates/dimensions are consumed downstream.

SPEC06 must preserve that release impact into policy/snapshot inputs.

It may not downgrade a mandatory gate into advice.

---

# 79. overall_state

`overall_state?` is an optional derived summary.

It is not a substitute for:

```text
dimension_results
hard_gate_results
```

If `overall_state` contradicts a hard gate:

```text
hard gate truth wins for release handling
```

under the EvalContract.

---

# 80. EvalContract Revision Closure

`eval_contract_revision_id` must resolve to the exact immutable EvalContractRevision intended for this capability.

No:

```text
latest eval contract
current rubric
active threshold
```

resolution after run pinning.

---

# 81. Qualitative Evaluator Closure

`evaluator_revision_ref` must resolve to registered immutable EvaluatorConfig.

For run-created evaluation used by snapshot:

```text
evaluator_revision_ref
∈
DecisionSnapshot.RunConfig.evaluator_revision_refs
```

---

# 82. Evaluation Candidate Binding

QualitativeEvaluation.candidate_id must equal the Candidate actually evaluated.

Results cannot be copied to a rewrite candidate.

---

# 83. Re-Evaluation of Candidate Rewrite

Candidate rewrite creates a new candidate ID.

Therefore:

```text
new Candidate
→ new QualitativeEvaluation
```

when formal evaluation is required.

Old evaluation remains historical.

---

# 84. Evaluation Contract Change

If EvalContractRevision changes:

```text
old QualitativeEvaluation remains historical.
```

A new evaluation may be created under the new contract.

Historical replay uses the recorded old contract.

---

# 85. Evaluator Change

Changing evaluator configuration creates a new evaluation event.

It does not mutate the prior evaluation.

No hidden evaluator upgrade during replay.

---

# 86. RiskAssessment Contract

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

# 87. Risk Purpose

RiskAssessment evaluates potential harm/impact of one exact subject.

Subject may be decision-relevant immutable state such as:

```text
Candidate
Assertion
Strategy
other permitted immutable subject
```

The exact `subject_ref` is authoritative.

---

# 88. Risk Is Not Policy

RiskAssessment describes risk.

It does not itself own final release status.

Policies consume RiskAssessment and decide governance consequences.

---

# 89. Risk Is Not Uncertainty

Risk dimensions such as:

```text
severity
likelihood
exposure
reversibility
```

must not be duplicated as epistemic uncertainty merely to increase severity.

Uncertainty about a risk estimate belongs in UncertaintyAssessment where material.

---

# 90. Risk Methodology

SPEC06 does not freeze one universal risk formula.

The runtime must use a deterministic/reconstructable risk methodology pinned by the run's exact configuration and StageExecution context.

Because RiskAssessment has no evaluator revision field in the frozen schema:

```text
SPEC06 MUST NOT invent one.
```

Operational provenance must preserve the exact configured method through existing RunConfig / StageExecution lineage.

---

# 91. Risk Scale Semantics

If severity/likelihood/exposure/reversibility use categorical or numeric scales:

```text
scale definition
ordering
threshold semantics
```

must be pinned in the applicable configuration.

The runtime may not compare values using an unstated scale.

---

# 92. Regulatory Materiality

`regulatory_materiality` is a risk dimension.

It does not replace SPEC04 applicability or SPEC08 rights/legal checks.

---

# 93. Business Impact

`business_impact` captures business consequences.

It must not override harm, regulatory or rights constraints merely because expected business value is high.

---

# 94. Risk Re-Assessment

Material subject/context change creates a new RiskAssessment.

Old risk state is never mutated.

---

# 95. UncertaintyAssessment Contract

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

# 96. Uncertainty Purpose

UncertaintyAssessment captures uncertainty that remains material to the decision.

Potential dimensions include uncertainty about:

```text
knowledge
assertion interpretation
mapping
evaluation
risk estimate
audience understanding
governance applicability
```

Exact dimensions are structured by the configured method.

---

# 97. Uncertainty Subject Closure

Every `subject_ref` must resolve to a real immutable decision-relevant subject.

Uncertainty may not reference opaque narrative objects outside canonical state.

---

# 98. assessment_method

`assessment_method` must identify the method used sufficiently for audit.

If the method depends on runtime config:

```text
that config must be pinned through RunConfig / StageExecution lineage.
```

SPEC06 does not redefine the frozen field type.

---

# 99. No Uncertainty Erasure

High model confidence does not erase canonical uncertainty.

If upstream EpistemicState, mapping, applicability or risk remains materially uncertain:

```text
UncertaintyAssessment must preserve it
```

when decision-relevant.

---

# 100. No Risk Double Counting

The same uncertainty MUST NOT be transformed simultaneously into:

```text
higher likelihood
+
higher severity
+
separate uncertainty penalty
```

unless the pinned methodology explicitly defines and justifies those as distinct, non-duplicative semantic contributions.

If the methodology does not explicitly distinguish those meanings:

```text
DOUBLE COUNTING IS INVALID
```

Risk and uncertainty must remain conceptually separable.

---

# 101. DecisionSnapshot Evaluation Closure

DecisionSnapshot pins exact:

```text
assertion_ids
assertion_validation_result_ids
composite_assessment_ids
qualitative_evaluation_ids
risk_assessment_ids
uncertainty_assessment_id?
```

No hidden evaluation state may affect policy/decision outside those exact references.

---

# 102. Validation / RunConfig Closure

Any canonical evaluation stage must use the exact normalized RunConfig identity already established by the verified M4 baseline (SPEC02 / SPEC05).

Where relevant, exact normalized ref sets include:

```text
prompt_revision_refs        (run_config_prompt_revisions)
model_config_revision_refs  (run_config_model_revisions)
tool_config_revision_refs   (run_config_tool_revisions)
schema_revision_refs        (run_config_schema_revisions)
retriever_revision_refs     (run_config_retriever_revisions)
evaluator_revision_refs     (run_config_evaluator_revisions)
runtime_parameters
```

No CURRENT, LATEST, ACTIVE, or default config resolution is permitted after the run boundary.

For every run-created:

```text
AssertionValidationResult
CompositeImpressionAssessment
QualitativeEvaluation
```

used in DecisionSnapshot:

```text
evaluator_revision_ref
```

as well as all model, prompt, schema, tool, and retriever configurations used by the stage, must be exact, immutable, and proven members of the pinned RunConfig closure.

Caller or provider cannot substitute an unpinned revision.
Do not invent a second RunConfig authority mechanism.

---

# 103. Qualitative / EvalContract Closure

Every QualitativeEvaluation in DecisionSnapshot must reference a real immutable:

```text
EvalContractRevision
```

The exact contract must be the one used during evaluation.

---

# 104. Candidate Closure

For every evaluation object in DecisionSnapshot:

```text
its Candidate / Assertion lineage
must resolve into Candidate state
contained in the same snapshot.
```

No evaluation for a foreign candidate.

---

# 105. Final Assertion Result Closure

For the selected release Candidate:

```text
every material final assertion
→ exactly one selected final validation result
```

in the DecisionSnapshot.

No material assertion may have:

```text
zero results
```

or:

```text
two competing final results
```

inside the same release snapshot.

---

# 106. Final Composite Closure

For the selected release Candidate:

```text
exactly one final CompositeImpressionAssessment
```

must represent the decision-time composite state in the release snapshot.

Its input and implied assertion IDs must all resolve within the snapshot.

---

# 107. Release Eligibility — Assertion Validation

Normal:

```text
READY
READY_WITH_WARNINGS
```

is forbidden when any material selected final assertion result is:

```text
OVERCLAIM
UNSUPPORTED
CONTRADICTORY
```

---

# 108. Release Eligibility — Qualification

`SUPPORTED_WITH_QUALIFICATION` is release-eligible only when the qualification is already present in the exact immutable Candidate selected for release.

Metadata-only future intention is insufficient.

---

# 109. Release Eligibility — Composite

Selected final CompositeImpressionAssessment:

```text
INVALID
→ normal release blocked

REVIEW_REQUIRED
→ Human Review required
```

`STABLE_WITH_REQUIREMENTS` requires satisfaction of applicable mandatory requirements before normal release.

---

# 110. Release Eligibility — Hard Gate

Failed QualitativeEvaluation hard gate must be handled exactly according to pinned EvalContractRevision.

It may not be silently ignored by downstream policy.

---

# 111. Risk / Uncertainty Decision Relevance

Material RiskAssessment and UncertaintyAssessment must be present in DecisionSnapshot when required by the decision context/evaluation contract.

Omitting an inconvenient risk from the snapshot is invalid.

---

# 112. Rights Boundary

SPEC06 may detect content patterns that suggest a rights concern.

It does not create rights truth.

Rights state belongs to:

```text
RightsPolicy
RightsCheck
SPEC08
```

Evaluation may request a RightsCheck.

It may not infer legal permission itself.

---

# 113. Governance Boundary

SPEC06 may trigger:

```text
CONTENT_LEVEL ApplicabilityAssessment
```

when generated content introduces governance-relevant meaning.

SPEC04 owns applicability semantics.

SPEC06 consumes the resulting exact assessment state.

---

# 114. New Knowledge During Evaluation

If evaluation discovers material factual information not already in canonical knowledge:

```text
do not inject it directly into validation as hidden truth.
```

Route through SPEC03.

If this occurs after the old cycle's decision-input boundary:

```text
new decision cycle may be required.
```

---

# 115. Evaluator Model Output Is Not Evidence

An evaluator model saying:

```text
"this claim is true"
```

does not create EvidenceItem or EpistemicState.

Validation must consume canonical Proposition/EpistemicState.

---

# 116. Evaluation Independence From Writer

The writer/generator may provide hints or annotations.

Those are non-authoritative.

The evaluator must not accept:

```text
writer says supported
```

as proof.

---

# 117. Self-Evaluation Boundary

The same model/config may technically be used for generation and evaluation only if the exact evaluation contract permits it.

Even then:

```text
evaluation still consumes canonical knowledge
and produces independent immutable evaluation state.
```

Generator self-certification is never authoritative.

---

# 118. Structured Output

Canonical evaluation inserts require schema-valid structured output.

Malformed evaluator response:

```text
retry
fail
or human path
```

not silently coerced into PASS.

---

# 119. Reason Codes

AssertionValidationResult.reason_codes must expose stable machine-readable reasons.

Examples conceptually:

```text
SCOPE_EXCEEDS_SUPPORT
CAUSAL_STRENGTH_EXCEEDS_SUPPORT
MISSING_PROPOSITION
MISSING_EPISTEMIC_STATE
QUALIFICATION_REQUIRED
CONTRADICTED_BY_KNOWLEDGE
```

These examples are implementation reason codes, not new canonical enums.

---

# 120. Composite Reason Trace

Composite assessment uses:

```text
likely_interpretations
misleading_risks
required_disclosures
```

as structured audit state.

Operational reason codes may also be logged.

Do not replace canonical fields with free-form evaluator prose.

---

# 121. Evaluation Context Minimization

Evaluators receive only material decision context needed for the evaluation.

They must not receive unrestricted tenant data.

Required context is explicit and scoped.

---

# 122. Prompt Injection Defense

Candidate/source text is untrusted data relative to evaluator instructions.

The candidate may not tell the evaluator to:

```text
ignore rubric
mark supported
use another tool
read secret state
skip hard gates
```

Instruction hierarchy remains pinned.

---

# 123. Tool Authority

Evaluator tools must be:

```text
pinned
authorized
least-privilege
auditable
```

Tool output that introduces new factual knowledge must enter SPEC03 before becoming factual validation basis.

---

# 124. EvalContract Pinning

The exact EvalContractRevision must be resolved before evaluation.

No live lookup of:

```text
CURRENT
LATEST
ACTIVE
```

after the run boundary.

---

# 125. EvaluatorConfig Pinning

All evaluator configurations, models, prompts, tools, schemas, and retrievers used by canonical validation/evaluation must be exact immutable revisions pinned in the normalized RunConfig reference sets established at the run boundary.

Runtime lookup of unpinned or default evaluator configs is strictly prohibited.

---

# 126. StageExecution Binding & Mandatory Claim Authority

SPEC06 evaluation stages execute through SPEC01 StageExecution.

Suggested canonical stage names:

```text
ASSERTION_EXTRACT
ASSERTION_MAP
ASSERTION_VALIDATE
COMPOSITE_ASSESS
QUALITATIVE_EVALUATE
RISK_ASSESS
UNCERTAINTY_ASSESS
EVALUATION_CLOSURE
```

Names may vary, but execution authority semantics may not.

Every canonical SPEC06 evaluation stage has a mandatory trusted StageExecution authority boundary.

Required authority invariant:

```text
trusted runtime resolves exact stage inputs directly from canonical records
↓
deterministically constructs exact non-authoritative/reconstructable stage input identity
↓
computes canonical_input_hash (excluding hash from its own preimage)
↓
atomically claims StageExecution with exact:
    tenant/workspace ownership envelope
    run_id
    decision_cycle_id
    stage_name
    idempotency_key
    canonical_input_hash
↓
only successful claim owner (claimed: true) receives execution authority
↓
only then may an external evaluator/model/provider be invoked
```

Strictly forbidden:
- Evaluator, model, or provider invocation before successful atomic claim.
- Caller-supplied or provider-supplied authoritative `canonical_input_hash`.
- Provisional, unverified, or dummy hashes.
- Losing claimant continuing execution after claim rejection (`claimed: false`).
- Retry silently replacing or mutating `canonical_input_hash`.

Distributed leasing and takeover:
- An unexpired lease owned by another worker blocks the claimant (`claimed: false`).
- An expired lease may be taken over only through the authorized atomic claim path, preserving exact stage identity and `canonical_input_hash` while incrementing `fencing_token` and `attempt_count`.
- The old worker holding the expired lease becomes stale; any subsequent commit attempt by that worker is rejected with `STALE_FENCING_TOKEN`.

---

# 127. Stage Idempotency & Retry

Exact retry:
- same stage identity
- same canonical input
- same `canonical_input_hash`
- convergent canonical effect

Material input or configuration change:
- new explicit evaluation/stage identity
- never mutate old canonical evaluation state

Takeover must not redefine the original canonical input identity.

Deliberate re-evaluation uses a new explicit stage and idempotency identity.

---

# 127A. Common Normative Serialization Contract for Stage Input Hashes

All canonical SPEC06 stage input hashes (`canonical_input_hash`) MUST be computed via a deterministic canonical serialization contract over the stage's non-canonical input DTO:

```text
EvaluationStageInputCore
↓
deterministic canonical serialization
↓
SHA-256
↓
canonical_input_hash (lowercase hex string)
```

Normative contract requirements:

1. **Non-Canonical DTO Nature:**
   `EvaluationStageInputCore` is a strictly non-canonical, reconstructable operational DTO. It MUST NOT become a canonical domain entity or persistent database table.
2. **Symmetric Reconstruction Contract:**
   Claim-time and commit-time reconstruction MUST use the exact same canonical serialization function and contract.
3. **Deterministic Object/Member Serialization:**
   Object and member serialization MUST be deterministic. Member keys must be serialized in a stable, deterministic canonical order (e.g., lexicographical sorting of member field names).
4. **Deterministic Sorting of Set-Like Ref Collections:**
   Set-like collections of references or identifiers MUST be deterministically sorted using their complete typed identity (e.g., lexicographical ascending byte/character order of typed identifiers) before serialization.
   Examples include:
   - RunConfig normalized revision refs (prompts, models, tools, schemas, retrievers, evaluators),
   - Proposition refs (`proposition_id` / `proposition_link_id` sets),
   - EpistemicStateVersion refs,
   - validation result refs,
   - subject refs where ordering is not semantically meaningful.
5. **Preservation of Semantically Ordered Collections:**
   Collections with defined semantic order MUST preserve their exact defined semantic order without reordering.
6. **Deterministic Null / Absent Representation:**
   Null and absent field representations MUST be deterministic and MUST NOT depend on language or runtime incidental behavior (e.g., omitting undefined vs null must follow a uniform, frozen serialization rule).
7. **Canonical Representation of Scalars and Timestamps:**
   Timestamps or scalar values included in the preimage MUST use their frozen canonical representation (e.g., ISO 8601 UTC with fixed precision for timestamps; canonical JSON numbers/strings).
8. **Preimage Self-Exclusion:**
   `canonical_input_hash` MUST NOT appear in its own preimage.
9. **Database Independence:**
   The serialization implementation MUST NOT rely on database row-return order, object insertion order, or caller/provider serialization. Reconstructed collections from SQL queries must pass through deterministic sorting before hashing.
10. **Repository-Wide Convention:**
    Implementations MUST use one repository-wide canonical hashing convention; creating stage-specific incompatible serializers is strictly prohibited.
11. **RunConfig Closure and Stage-Utilized Config Binding:**
    Every SPEC06 `EvaluationStageInputCore` MUST bind:
    - exact `run_config_id`,
    - canonical `runtime_parameters`,
    - complete normalized ref sets (`prompt_revision_refs`, `model_config_revision_refs`, `tool_config_revision_refs`, `schema_revision_refs`, `retriever_revision_refs`, `evaluator_revision_refs`, sorted deterministically),
    AND
    - the exact stage-utilized config refs selected from those sets (exact prompt, model, tool, schema, retriever, and evaluator revisions actually utilized by the stage).
    Every stage-utilized config MUST be an exact, proven member of the pinned RunConfig closure. Binding the complete allowed set alone is not sufficient; selecting a different config member or altering runtime parameters produces a materially different canonical stage input and MUST yield a different `canonical_input_hash`.

The exact stage-specific field closures defined in §128–§133A remain authoritative for the fields comprising each stage's `EvaluationStageInputCore`.

---

# 128. Assertion Extraction Idempotency & Input Hash

The extraction stage deterministically constructs its non-canonical, reconstructable input identity (`EvaluationStageInputCore`). It MUST NOT become a new canonical entity.

`canonical_input_hash` binds the exact trusted inputs for extraction:

```text
tenant/workspace ownership envelope
run_id, decision_cycle_id
candidate_id
RunConfig closure identity:
  exact run_config_id
  canonical runtime_parameters
  complete normalized ref sets:
    sorted prompt_revision_refs
    sorted model_config_revision_refs
    sorted tool_config_revision_refs
    sorted schema_revision_refs
    sorted retriever_revision_refs
    sorted evaluator_revision_refs
stage-utilized config member selections (must be exact members of normalized RunConfig):
  exact extractor/evaluator revision actually used
  exact prompt revision actually used (if applicable)
  exact model revision actually used (if applicable)
  exact schema revision actually used
  exact tool revision(s) actually used (if applicable)
  exact retriever revision actually used (if applicable)
deterministic extraction parameters
```

The hash MUST NOT contain itself in its own preimage.

Exact retry converges without duplicate equivalent assertions under the same extraction contract.

A materially different interpretation or new Candidate revision is a new semantic assertion event, not a retry.

---

# 129. Mapping Idempotency & Input Hash

The assertion-to-proposition mapping stage constructs its reconstructable stage input identity.

`canonical_input_hash` binds:

```text
tenant/workspace ownership envelope
run_id, decision_cycle_id
assertion_id
candidate_id
sorted available/eligible Proposition refs
RunConfig closure identity:
  exact run_config_id
  canonical runtime_parameters
  complete normalized ref sets:
    sorted prompt_revision_refs
    sorted model_config_revision_refs
    sorted tool_config_revision_refs
    sorted schema_revision_refs
    sorted retriever_revision_refs
    sorted evaluator_revision_refs
stage-utilized config member selections (must be exact members of normalized RunConfig):
  exact mapping evaluator revision actually used
  exact prompt revision actually used (if applicable)
  exact model revision actually used (if applicable)
  exact schema revision actually used (if applicable)
  exact tool revision(s) actually used (if applicable)
  exact retriever revision actually used (if applicable)
deterministic mapping parameters
```

The hash MUST NOT contain itself in its own preimage.

Exact assertion→proposition mapping retry must converge on equivalent canonical mapping effects.

If multiple distinct links represent materially distinct relation judgments, those are distinct semantic events and must not be confused with retry duplicates.

---

# 130. Validation Idempotency & Input Hash

The validation stage constructs its reconstructable stage input identity.

`canonical_input_hash` binds:

```text
tenant/workspace ownership envelope
run_id, decision_cycle_id
assertion_id
sorted proposition_link_ids
exact decision-time EpistemicStateVersion refs (sorted if multiple)
RunConfig closure identity:
  exact run_config_id
  canonical runtime_parameters
  complete normalized ref sets:
    sorted prompt_revision_refs
    sorted model_config_revision_refs
    sorted tool_config_revision_refs
    sorted schema_revision_refs
    sorted retriever_revision_refs
    sorted evaluator_revision_refs
stage-utilized config member selections (must be exact members of normalized RunConfig):
  exact evaluator_revision_ref actually used
  exact prompt revision actually used (if applicable)
  exact model revision actually used (if applicable)
  exact schema revision actually used (if applicable)
  exact tool revision(s) actually used (if applicable)
  exact retriever revision actually used (if applicable)
deterministic validation parameters
```

The hash MUST NOT contain itself in its own preimage.

Exact retry converges.

Re-evaluation after material epistemic or config change is a new evaluation event.

---

# 131. Composite Idempotency & Input Hash

The composite assessment stage constructs its reconstructable stage input identity.

`canonical_input_hash` binds:

```text
tenant/workspace ownership envelope
run_id, decision_cycle_id
candidate_id
sorted input_assertion_ids
sorted selected validation_result_ids
RunConfig closure identity:
  exact run_config_id
  canonical runtime_parameters
  complete normalized ref sets:
    sorted prompt_revision_refs
    sorted model_config_revision_refs
    sorted tool_config_revision_refs
    sorted schema_revision_refs
    sorted retriever_revision_refs
    sorted evaluator_revision_refs
stage-utilized config member selections (must be exact members of normalized RunConfig):
  exact evaluator_revision_ref actually used
  exact prompt revision actually used (if applicable)
  exact model revision actually used (if applicable)
  exact schema revision actually used (if applicable)
  exact tool revision(s) actually used (if applicable)
  exact retriever revision actually used (if applicable)
deterministic composite rules/parameters
```

The hash MUST NOT contain itself in its own preimage.

Exact retry converges.

A newly discovered implied assertion set creates a new composite input and therefore a new assessment.

---

# 132. Qualitative Idempotency & Input Hash

The qualitative evaluation stage constructs its reconstructable stage input identity.

`canonical_input_hash` binds:

```text
tenant/workspace ownership envelope
run_id, decision_cycle_id
candidate_id
eval_contract_revision_id
RunConfig closure identity:
  exact run_config_id
  canonical runtime_parameters
  complete normalized ref sets:
    sorted prompt_revision_refs
    sorted model_config_revision_refs
    sorted tool_config_revision_refs
    sorted schema_revision_refs
    sorted retriever_revision_refs
    sorted evaluator_revision_refs
stage-utilized config member selections (must be exact members of normalized RunConfig):
  exact evaluator_revision_ref actually used
  exact prompt revision actually used (if applicable)
  exact model revision actually used (if applicable)
  exact schema revision actually used (if applicable)
  exact tool revision(s) actually used (if applicable)
  exact retriever revision actually used (if applicable)
deterministic evaluation parameters
```

The hash MUST NOT contain itself in its own preimage.

Exact retry converges.

---

# 133. Risk / Uncertainty Idempotency & Input Hash

The risk and uncertainty assessment stages construct their reconstructable stage input identity.

`canonical_input_hash` binds:

```text
tenant/workspace ownership envelope
run_id, decision_cycle_id
sorted subject refs (candidate / assertion / evaluation refs)
exact assessment method / config revision
RunConfig closure identity:
  exact run_config_id
  canonical runtime_parameters
  complete normalized ref sets:
    sorted prompt_revision_refs
    sorted model_config_revision_refs
    sorted tool_config_revision_refs
    sorted schema_revision_refs
    sorted retriever_revision_refs
    sorted evaluator_revision_refs
stage-utilized config member selections (must be exact members of normalized RunConfig):
  exact assessment evaluator/method revision actually used
  exact prompt revision actually used (if applicable)
  exact model revision actually used (if applicable)
  exact schema revision actually used (if applicable)
  exact tool revision(s) actually used (if applicable)
  exact retriever revision actually used (if applicable)
deterministic method inputs
```

The hash MUST NOT contain itself in its own preimage.

Exact retry over identical canonical inputs must converge without contradictory duplicate records.

Material context or method changes require a new assessment event.

---

# 133A. Evaluation Closure Idempotency & Input Hash

The evaluation closure stage (`EVALUATION_CLOSURE`) deterministically constructs its non-canonical, reconstructable input identity (`EvaluationStageInputCore`). It MUST NOT become a canonical domain entity or persistent database table.

`canonical_input_hash` binds the exact trusted closure reference package:

```text
tenant/workspace ownership envelope
run_id, decision_cycle_id
selected candidate_id
sorted material assertion_ids
sorted selected assertion_validation_result_ids (one decision-final result per material final assertion)
exact final composite assessment identity/ref(s) (sorted if multiple)
sorted qualitative_evaluation_ids used by closure
sorted material risk_assessment_ids
exact uncertainty_assessment_id when required
sorted EvalContractRevision refs used by selected evaluations
sorted evaluator/config refs required by those selected records
RunConfig closure identity:
  exact run_config_id
  canonical runtime_parameters
  complete normalized ref sets:
    sorted prompt_revision_refs
    sorted model_config_revision_refs
    sorted tool_config_revision_refs
    sorted schema_revision_refs
    sorted retriever_revision_refs
    sorted evaluator_revision_refs
stage-utilized config member selections (must be exact members of normalized RunConfig)
deterministic closure parameters, if any
```

The hash MUST NOT contain itself in its own preimage.
All set-like collections MUST use §127A deterministic sorting.

The closure hash MUST bind the exact intended closure reference package. It MUST NOT permit claiming under closure reference package A and committing under materially different closure reference package B under the same `canonical_input_hash`. If any closure input or reference changes after claim:
- the recomputed `canonical_input_hash` MUST differ;
- commit MUST fail closed;
- silent rebase is strictly prohibited;
- a new explicit closure attempt and StageExecution claim identity is required.

EVALUATION_CLOSURE MUST NOT invent a new canonical domain entity, create a duplicate evaluation truth store, or claim/mutate DecisionSnapshot ownership contrary to upstream specifications.

---

# 134. Fencing & Commit Verification

Every pre-freeze canonical SPEC06 write validates:

```text
DecisionCycle fencing epoch
StageExecution fencing token (WHERE stage_execution_id = $1 AND fencing_token = $2)
active lease authority
idempotency identity
exact canonical_input_hash equality with StageExecution
```

Stale evaluator workers whose leases were taken over cannot commit. Any such attempt is rejected immediately with `STALE_FENCING_TOKEN`.

---

# 135. FREEZING Barrier

Assertions, validation, composite, qualitative, risk and uncertainty used by DecisionSnapshot are upstream decision inputs.

Before:

```text
DecisionCycle → FREEZING
```

required evaluation stages must be terminal.

After FREEZING:

```text
no new evaluation input
may enter the old cycle.
```

---

# 136. Late Evaluator Response

If evaluator returns after FREEZING/cancellation/supersession:

```text
commit rejected
```

or evaluation is explicitly rerun under a valid successor cycle.

No late state leaks into the old snapshot.

---

# 137. Candidate Rewrite During Evaluation

If evaluation causes a rewrite:

```text
old candidate stays immutable
new candidate created
old cycle evaluation path for old candidate remains historical
new candidate must be evaluated independently
```

---

# 138. Evaluation Feedback

Evaluation feedback used for rewrite must be explicit and traceable.

It may not mutate:

```text
Candidate
Assertion
ValidationResult
CompositeAssessment
QualitativeEvaluation
RiskAssessment
UncertaintyAssessment
```

---

# 139. Human Evaluation Input

Human evaluator/reviewer may create or influence new immutable evaluation records under authorized workflow.

If human introduces new material factual information:

```text
route through SPEC03 / new-cycle rules
```

Do not smuggle hidden knowledge into old validation state.

---

# 140. Tenant Isolation & Scope-First Resolution

Security-sensitive tenant/workspace-owned reads, claims, locks, and commits must resolve within their exact ownership envelope before identity evaluation (`WHERE tenant_id = $1 AND workspace_id IS NOT DISTINCT FROM $2`).

Knowing a foreign identifier:

```text
candidate_id
assertion_id
proposition_id
evaluation_id
stage_execution_id
run_id
decision_cycle_id
```

conveys zero authority and must not provide a foreign existence oracle.

Cross-tenant claim or query collisions must fail closed with generic not-found or scope mismatch errors without leaking foreign record metadata or existence.

Respect valid tenant-global or nullable-workspace entities only where the frozen data model explicitly permits them.

---

# 141. Data Minimization

Evaluator context should contain only necessary tenant/private content.

No full knowledge-store dump by default.

---

# 142. Secrets

Secrets must not be exposed in:

```text
evaluator prompts
reason codes
dimension results
logs
human review payloads
```

unless an explicitly authorized secure workflow requires them.

---

# 143. Cache Rules

Evaluation caches are non-authoritative.

Cache key must include exact:

```text
tenant/workspace
candidate/assertion refs
proposition/epistemic refs
EvalContract revision
EvaluatorConfig revision
canonical input hash
```

Material input change invalidates cache reuse.

---

# 144. Historical Replay

Replay reads recorded immutable evaluation objects.

It does not re-run:

```text
current evaluator
current rubric
current epistemic state
current risk methodology
```

to replace historical truth.

---

# 145. Reproduction Attempt

Re-running historical evaluation with exact inputs may be used for diagnostic reproduction.

It must be labeled separately.

It may not overwrite the historical result.

---

# 146. Deletion / Retention

If required historical evaluation inputs are deleted lawfully:

```text
ReplayabilityStatus may degrade.
```

The system may not retain prohibited payload solely for replay.

It may not fabricate missing validation.

---

# 147. Observability

SPEC06 stages should emit:

```text
run_id
decision_cycle_id
stage_execution_id
candidate_id
assertion_id when relevant
proposition IDs when relevant
epistemic_state_ids when relevant
eval_contract_revision_id when relevant
evaluator_revision_ref when relevant
canonical_input_hash
result/status
reason codes
duration
attempt
fencing metadata
```

Sensitive payloads should not be duplicated unnecessarily.

---

# 148. Audit Trace

For one selected Candidate, auditor must be able to traverse:

```text
Candidate
↓
ContentAssertions
↓
AssertionPropositionLinks
↓
Propositions
↓
decision-time EpistemicStateVersions
↓
AssertionValidationResults
↓
final CompositeImpressionAssessment
↓
QualitativeEvaluation
↓
RiskAssessment
↓
UncertaintyAssessment
```

and exact evaluator / eval contract configuration where frozen contracts provide it.

---

# 149. Failure Taxonomy

Operational reason codes may include:

```text
ASSERTION_EXTRACTION_INVALID
ASSERTION_ARTIFACT_MISMATCH
ASSERTION_INTERPRETATION_UNCERTAIN
PROPOSITION_MAPPING_UNRESOLVED
MAPPING_SCOPE_MISMATCH
EPISTEMIC_STATE_MISSING
VALIDATION_INPUT_INVALID
VALIDATION_OVERCLAIM
VALIDATION_UNSUPPORTED
VALIDATION_CONTRADICTORY
QUALIFICATION_REQUIRED
COMPOSITE_CLOSURE_UNSTABLE
COMPOSITE_INVALID
COMPOSITE_REVIEW_REQUIRED
EVAL_CONTRACT_MISSING
EVALUATOR_REVISION_UNPINNED
REQUIRED_DIMENSION_MISSING
HARD_GATE_FAILED
RISK_METHOD_UNRESOLVED
UNCERTAINTY_METHOD_UNRESOLVED
EVALUATION_CONTEXT_STALE
STALE_WORKER
TENANT_SCOPE_VIOLATION
```

These are not new canonical domain enums.

---

# 150. Fail-Closed Conditions

Fail closed when:

```text
assertion artifact does not match candidate
material assertion extraction is incomplete
mapping unresolved materially
required Proposition missing
decision-time EpistemicState missing
unsupported broader meaning would be passed
required qualification absent
material implied assertion remains unvalidated
composite closure fails to stabilize
EvalContract missing/unresolvable
EvaluatorConfig unpinned
required dimension missing
hard gate execution missing
risk/uncertainty method materially unresolved
tenant boundary fails
worker fence stale
FREEZING boundary crossed
```

Fail closed means:

```text
do not produce release-eligible evaluation closure
```

not "mark supported."

---

# 150A. Common Normative Preamble for Canonical Evaluation and Closure Transactions

All SPEC06 canonical persistence transactions (§151–§158) MUST enforce trusted commit-time revalidation inside the atomic database transaction before completing their stage execution.

The common pre-commit revalidation sequence is:

```text
BEGIN TRANSACTION (isolation: READ COMMITTED / SERIALIZABLE as required by SPEC02)

1. Re-resolve trusted Run, DecisionCycle, and StageExecution rows directly from the database using scope-first queries (WHERE tenant_id = $1 AND workspace_id IS NOT DISTINCT FROM $2 FOR UPDATE).
2. Verify exact stage identity: tenant_id, workspace_id, run_id, decision_cycle_id, stage_name, and idempotency_key match the executing worker's claim.
3. Verify current fencing_token and active lease authority (WHERE stage_execution_id = $1 AND fencing_token = $2). Stale workers fail immediately with STALE_FENCING_TOKEN.
4. Verify DecisionCycle status remains writable and has not crossed FREEZING or entered FROZEN status.
5. Reconstruct the exact trusted stage-input identity (EvaluationStageInputCore) from authoritative database records using §127A deterministic canonical serialization contract.
6. Recompute canonical_input_hash from the reconstructed stage-input identity.
7. Require exact byte equality between the recomputed hash and StageExecution.canonical_input_hash locked at claim time.
8. Re-resolve exact RunConfig identity (run_config_id, canonical runtime_parameters, and normalized prompt, model, tool, schema, retriever, evaluator ref sets) and verify that all stage-utilized configs are exact, immutable members of the pinned closure.
```

Following the common revalidation sequence (steps 1–8), transactions bifurcate by stage category:

### Category A: §151–§157 Canonical Evaluation-Write Transactions

All canonical evaluation-write transactions (§151–§157) MUST:
- perform §150A trusted scope/fence/hash/RunConfig revalidation (steps 1–8);
- verify object-specific refs;
- insert ONLY their already-frozen canonical evaluation object;
- transition their StageExecution to COMPLETED;
- write required outbox event(s);
- commit atomically.

### Category B: §158 EVALUATION_CLOSURE Stage Transaction

The evaluation closure stage (§158) does not define or persist a new canonical evaluation entity. Instead, it must execute through the mandatory `EVALUATION_CLOSURE` StageExecution.

It MUST:
- have successful prior atomic claim;
- perform the same scope-first Run / DecisionCycle / StageExecution lock;
- verify fencing_token / active authority;
- verify cycle still writable;
- reconstruct exact closure-stage `EvaluationStageInputCore` (§133A);
- recompute `canonical_input_hash`;
- require equality with `StageExecution.canonical_input_hash`;
- verify exact RunConfig normalized closure, run_config_id, and runtime_parameters;
- verify all material assertion / validation / composite / qualitative / risk / uncertainty refs required for closure;
- reject closure on any mismatch (no silent rebase);
- transition `EVALUATION_CLOSURE` StageExecution to COMPLETED atomically.

It MUST NOT:
- invent a new canonical evaluation entity merely to satisfy §150A;
- create a duplicate evaluation truth store;
- silently repair or rebase snapshot refs;
- invoke evaluator/provider inside commit;
- claim ownership over DecisionSnapshot creation/mutation beyond the frozen upstream ownership contract.

Any mismatch, scope violation, stale token, or hash discrepancy FAILS CLOSED immediately.
No silent repair.
No silent rebase.
No external provider or evaluator model invocation inside the commit transaction.

---

# 151. Assertion Write Transaction

Enforces §150A Common Normative Preamble:

```text
BEGIN

execute §150A trusted revalidation:
  verify Run / DecisionCycle / StageExecution scope and lock
  verify fencing_token and lease authority
  verify cycle has not crossed FREEZING
  reconstruct extraction stage input identity from DB
  recompute and assert canonical_input_hash == StageExecution.canonical_input_hash
  verify full RunConfig closure (run_config_id, runtime_parameters, normalized ref sets, and stage-utilized configs)
verify Candidate
verify artifact_ref
validate assertion structure
insert immutable ContentAssertion
mark StageExecution COMPLETED
write outbox event

COMMIT
```

---

# 152. Mapping Write Transaction

Enforces §150A Common Normative Preamble:

```text
BEGIN

execute §150A trusted revalidation:
  verify Run / DecisionCycle / StageExecution scope and lock
  verify fencing_token and lease authority
  verify cycle has not crossed FREEZING
  reconstruct mapping stage input identity from DB
  recompute and assert canonical_input_hash == StageExecution.canonical_input_hash
  verify full RunConfig closure (run_config_id, runtime_parameters, normalized ref sets, and stage-utilized configs)
verify Assertion
verify Proposition
validate relation
preserve mapping uncertainty
insert immutable AssertionPropositionLink
mark StageExecution COMPLETED
write outbox event

COMMIT
```

---

# 153. Validation Write Transaction

Enforces §150A Common Normative Preamble:

```text
BEGIN

execute §150A trusted revalidation:
  verify Run / DecisionCycle / StageExecution scope and lock
  verify fencing_token and lease authority
  verify cycle has not crossed FREEZING
  reconstruct validation stage input identity from DB
  recompute and assert canonical_input_hash == StageExecution.canonical_input_hash
  verify full RunConfig closure (run_config_id, runtime_parameters, normalized ref sets, and stage-utilized configs)
verify Assertion
verify all proposition links belong to Assertion
verify exact EpistemicState inputs
verify evaluator revision
validate status semantics
verify qualification invariant
insert AssertionValidationResult
mark StageExecution COMPLETED
write outbox event

COMMIT
```

---

# 154. Composite Write Transaction

Enforces §150A Common Normative Preamble:

```text
BEGIN

execute §150A trusted revalidation:
  verify Run / DecisionCycle / StageExecution scope and lock
  verify fencing_token and lease authority
  verify cycle has not crossed FREEZING
  reconstruct composite stage input identity from DB
  recompute and assert canonical_input_hash == StageExecution.canonical_input_hash
  verify full RunConfig closure (run_config_id, runtime_parameters, normalized ref sets, and stage-utilized configs)
verify Candidate
verify all input assertions belong to Candidate
verify implied assertions belong to Candidate
verify evaluator revision
verify no unvalidated material implied assertion
validate status/requirements
insert CompositeImpressionAssessment
mark StageExecution COMPLETED
write outbox event

COMMIT
```

---

# 155. Qualitative Write Transaction

Enforces §150A Common Normative Preamble:

```text
BEGIN

execute §150A trusted revalidation:
  verify Run / DecisionCycle / StageExecution scope and lock
  verify fencing_token and lease authority
  verify cycle has not crossed FREEZING
  reconstruct qualitative stage input identity from DB
  recompute and assert canonical_input_hash == StageExecution.canonical_input_hash
  verify full RunConfig closure (run_config_id, runtime_parameters, normalized ref sets, and stage-utilized configs)
verify Candidate
verify EvalContractRevision
verify EvaluatorConfig revision
verify required dimensions
verify all hard gates evaluated
insert QualitativeEvaluation
mark StageExecution COMPLETED
write outbox event

COMMIT
```

---

# 156. Risk Write Transaction

Enforces §150A Common Normative Preamble:

```text
BEGIN

execute §150A trusted revalidation:
  verify Run / DecisionCycle / StageExecution scope and lock
  verify fencing_token and lease authority
  verify cycle has not crossed FREEZING
  reconstruct risk stage input identity from DB
  recompute and assert canonical_input_hash == StageExecution.canonical_input_hash
  verify full RunConfig closure (run_config_id, runtime_parameters, normalized ref sets, and stage-utilized configs)
verify subject_ref
verify configured risk method lineage
validate risk dimensions
insert immutable RiskAssessment
mark StageExecution COMPLETED
write outbox event

COMMIT
```

---

# 157. Uncertainty Write Transaction

Enforces §150A Common Normative Preamble:

```text
BEGIN

execute §150A trusted revalidation:
  verify Run / DecisionCycle / StageExecution scope and lock
  verify fencing_token and lease authority
  verify cycle has not crossed FREEZING
  reconstruct uncertainty stage input identity from DB
  recompute and assert canonical_input_hash == StageExecution.canonical_input_hash
  verify full RunConfig closure (run_config_id, runtime_parameters, normalized ref sets, and stage-utilized configs)
verify every subject_ref
verify assessment_method
insert immutable UncertaintyAssessment
mark StageExecution COMPLETED
write outbox event

COMMIT
```

---

# 158. Snapshot Evaluation Closure Transaction

Evaluation closure executes as Category B under §150A through the mandatory `EVALUATION_CLOSURE` StageExecution. It verifies that all required evaluation artifacts are present, valid, and pinned before snapshot freeze, without inserting a synthetic evaluation entity.

`EVALUATION_CLOSURE` reconstructs its exact `EvaluationStageInputCore` (§133A) from authoritative database records and verifies:

```text
BEGIN

execute §150A Category B trusted revalidation:
  verify Run / DecisionCycle / StageExecution scope and lock
  verify fencing_token and active authority
  verify cycle still writable (has not crossed FREEZING)
  reconstruct closure stage EvaluationStageInputCore from DB (§133A)
  recompute and assert canonical_input_hash == StageExecution.canonical_input_hash
  verify RunConfig normalized closure, run_config_id, and runtime_parameters

verify closure prerequisites against reconstructed package:
  all material assertion IDs resolve
  exact selected validation result per final assertion
  final composite assessment unique for selected candidate
  all composite assertion refs resolve
  all qualitative eval refs resolve
  all evaluator refs pinned in normalized RunConfig
  all eval contracts resolve
  all material risk refs resolve
  uncertainty ref resolves when required
  candidate/runconfig closure holds

transition EVALUATION_CLOSURE StageExecution to COMPLETED atomically
write outbox event if required

COMMIT
```

Failure:

```text
SNAPSHOT_INVALID
```

Any verification failure, reference divergence, or hash discrepancy rejects closure immediately.
No release policy execution.
No silent rebase or repair.
No synthetic evaluation entity is created.
No duplicate evaluation truth store.
DecisionSnapshot creation and mutation remain under frozen upstream ownership.

---

# 159. Fixed Adversarial Test Suite

The following suite is locked for SPEC06 v1.0 audit.

```text
01 assertion extracted from wrong Candidate
02 assertion interpretation drops material qualifier
03 assertion extraction ignores material visual claim
04 assertion extraction ignores material audio claim
05 implied assertion kept only as prose and never registered
06 material assertion omitted from release validation
07 assertion mutation after creation
08 candidate rewrite reuses old assertion IDs as if unchanged
09 extractor trusts candidate instruction to mark claim supported
10 cross-tenant assertion extraction context leak (subcases: foreign tenant/workspace claim/lookup fails without existence disclosure; bare ID lookup outside tenant scope rejected)

11 mapping created before canonical Proposition exists
12 EQUIVALENT used despite material scope mismatch
13 NARROWER assumed supported without scope check
14 BROADER inherits support beyond Proposition
15 CONJUNCT validates only one material conjunct
16 IMPLIES treated as automatic support
17 CONTRADICTS relation itself treated as epistemic contradiction
18 material mapping uncertainty ignored to obtain SUPPORTED
19 assertion link references another assertion
20 current/latest Proposition state resolved during replay

21 SUPPORTED copied directly from Proposition support_status
22 PARTIALLY_SUPPORTED Proposition produces unqualified SUPPORTED beyond supported scope
23 UNKNOWN EpistemicState converted to SUPPORTED
24 INSUFFICIENT EpistemicState converted to SUPPORTED
25 CONFLICTING EpistemicState conflict erased
26 contradicted factual assertion marked SUPPORTED
27 causal assertion supported by associational evidence only
28 predictive guarantee inferred from observational performance
29 broader wording classified SUPPORTED instead of OVERCLAIM/UNSUPPORTED
30 no support basis classified as SUPPORTED

31 SUPPORTED_WITH_QUALIFICATION has empty required_qualification
32 required qualification missing from Candidate but release closure passes
33 qualification metadata treated as if Candidate was rewritten
34 revalidation mutates old AssertionValidationResult
35 two competing final results for same Assertion enter one release snapshot
36 favorable old validation selected after material context changed
37 evaluator_revision_ref not registered (subcases: unpinned normalized RunConfig ref rejected; caller-selected unpinned evaluator revision fails closed)
38 evaluator revision not pinned in RunConfig (subcases: prompt/model/tool/schema/retriever/evaluator unpinned member fails closed; runtime fallback to LATEST rejected)
39 validation result uses proposition link from different Assertion
40 validation consumes hidden model knowledge outside EpistemicState

41 composite input assertion belongs to another Candidate
42 composite implied assertion belongs to another Candidate
43 new material implied assertion not revalidated
44 newly discovered implied assertion bypasses proposition mapping
45 composite marked STABLE with unvalidated material implied assertion
46 composite loop reaches max iterations then silently marks STABLE
47 two competing final composite assessments enter one release snapshot
48 INVALID composite ignored by release path
49 REVIEW_REQUIRED composite treated as READY
50 STABLE_WITH_REQUIREMENTS has no explicit requirement

51 required disclosure stored only in assessment metadata but Candidate not changed
52 misleading composite risk replaces RiskAssessment
53 composite evaluator revision unpinned (subcases: unpinned composite evaluator or model revision fails closed; no ad-hoc config resolution)
54 qualitative evaluation bound to wrong Candidate
55 EvalContractRevision missing/unresolvable
56 evaluator uses latest EvalContract after run start
57 required evaluation dimension omitted and still passes
58 failed hard gate averaged away by high dimension scores
59 overall_state overrides failed hard gate
60 evaluator_revision_ref not pinned (subcases: qualitative evaluator revision not in normalized RunConfig ref set fails closed)

61 Candidate rewrite inherits QualitativeEvaluation
62 new EvalContract silently rewrites old evaluation meaning
63 risk assessment mutates existing record
64 RiskAssessment subject_ref points to wrong Candidate/assertion
65 risk methodology uses unstated scale
66 regulatory_materiality replaces governance applicability
67 high business impact overrides harm constraint
68 uncertainty erased by evaluator confidence
69 uncertainty references non-canonical opaque subject
70 same uncertainty double-counted into risk dimensions without method

71 hidden factual information introduced during evaluation bypasses SPEC03
72 evaluator model output treated as Evidence
73 source/candidate prompt injection changes evaluator instructions
74 evaluator self-grants tool authority
75 cache reused after candidate/epistemic/evaluator input changes (subcases: cache/input identity mismatch fails closed; caller-selected canonical_input_hash rejected; exact retry preserves canonical_input_hash; exact same selected configs + same runtime parameters + same semantic inputs with different DB row insertion/return order produces identical canonical_input_hash; materially different exact ref or value produces different canonical_input_hash; same RunConfig ref sets but different selected model/config member produces different canonical_input_hash; runtime_parameters materially differ produces different canonical_input_hash; closure selected-reference set changes between claim and commit triggers canonical_input_hash mismatch, fails closed, and rejects silent rebase)
76 stale evaluator commits after lease takeover (subcases: takeover worker increments fencing_token/attempt_count; stale worker commit rejected; canonical hash changes between claim and commit rejected)
77 stale evaluator commits after cycle cancellation/supersession (subcases: canceled run/cycle rejects evaluator commit; losing claimant invoking evaluator fails closed)
78 late evaluation commit accepted after FREEZING (subcases: FREEZING barrier rejects late write; late evaluator response fails closed)
79 historical replay recomputes with current evaluator/rubric
80 runtime evaluation directly mutates Control Plane (subcases: runtime evaluation authority boundary enforced; provider/evaluator called before claim fails closed)
```

Expected for freeze:

```text
80 / 80
PRESERVE INVARIANTS
```

No additional freeze blocker may be introduced after suite lock unless a concrete contradiction against Blueprint v2.13.1 or SPEC01–05 frozen contracts is demonstrated.

---

# 160. Static Contract Preflight

SPEC06 freeze audit must check exactly:

```text
01 no new canonical domain entity invented
02 canonical ContentAssertion fields preserved
03 canonical AssertionPropositionLink relation vocabulary preserved
04 canonical AssertionValidationStatus vocabulary preserved
05 canonical CompositeAssessmentStatus vocabulary preserved
06 no non-canonical validation/composite fields imported from draft variants
07 Candidate/assertion artifact binding preserved
08 implied assertions use ordinary validation path
09 mapping remains separate from support judgment
10 exact decision-time EpistemicState drives validation
11 UNKNOWN/INSUFFICIENT cannot become SUPPORTED
12 causal assertion guard preserved
13 BROADER/CONJUNCT/IMPLIES cannot inherit unsupported meaning
14 required qualification must be non-empty
15 qualification must exist in Candidate before release
16 validation results remain immutable
17 exactly one selected final validation per final assertion in release snapshot
18 composite assessments remain immutable
19 final composite assertion refs stay inside snapshot/candidate closure
20 composite closure loops implied assertions until stable/review
21 composite INVALID blocks normal release
22 composite REVIEW_REQUIRED requires review
23 EvalContractRevision is exact and immutable
24 evaluator revisions are pinned by RunConfig where required (requiring full immutable RunConfig identity, runtime_parameters, exact stage-utilized member refs, and verified membership in normalized prompt/model/tool/schema/retriever/evaluator ref sets)
25 required qualitative dimensions/hard gates cannot be omitted
26 failed hard gate cannot be averaged away
27 RiskAssessment remains distinct from policy/right/uncertainty
28 UncertaintyAssessment remains distinct from risk
29 evaluation state is complete before FREEZING
30 stale-worker fencing preserved (fencing token verification, valid expired lease takeover, stale worker rejection, and mandatory claim before provider invocation)
31 tenant isolation preserved (scope-first lookup and locking, zero existence oracles, null-safe workspace matching)
32 historical replay uses recorded exact evaluation state
33 SPEC08 remains rights owner
34 no duplicated source of evaluation truth
```

Freeze target:

```text
34 / 34 PASS
```

---

# 161. Acceptance Criteria

SPEC06 is freeze-eligible only if:

```text
1.
Assertions are extracted from the actual immutable Candidate.

2.
Material qualifiers/conditions survive extraction.

3.
Material multimodal assertions are not skipped.

4.
Implied assertions become first-class ContentAssertions.

5.
Every material final assertion is validated.

6.
Assertion→Proposition mapping remains distinct from support judgment.

7.
Mapping uncertainty remains explicit.

8.
Validation consumes exact decision-time EpistemicState.

9.
SUPPORTED cannot exceed mapped support scope/strength.

10.
UNKNOWN/INSUFFICIENT cannot become SUPPORTED.

11.
Causal wording requires causal support.

12.
SUPPORTED_WITH_QUALIFICATION has explicit required qualification.

13.
Required qualification must exist in the exact release Candidate.

14.
Re-evaluation never mutates old validation state.

15.
One release snapshot cannot contain competing final validation states for one assertion.

16.
Composite evaluation discovers and validates implied assertions.

17.
Composite closure does not fake stability after iteration exhaustion.

18.
One selected Candidate has one final composite state in a release snapshot.

19.
INVALID composite blocks normal release.

20.
REVIEW_REQUIRED composite requires Human Review.

21.
Qualitative evaluation uses exact EvalContractRevision.

22.
Required dimensions and hard gates are complete.

23.
Failed hard gates cannot be averaged away.

24.
Evaluator revisions and stage-utilized configs are exact, immutable, and pinned in full RunConfig identity (with runtime_parameters and normalized ref sets).

25.
RiskAssessment is immutable and subject-bound.

26.
Risk does not replace governance or rights state.

27.
Uncertainty is preserved separately from risk.

28.
Hidden evaluator knowledge cannot become factual truth.

29.
Evaluation cannot bypass SPEC03 for new factual information.

30.
FREEZING rejects late evaluation writes.

31.
Stale evaluator workers cannot commit.

32.
Historical replay reads recorded evaluation state.

33.
The 80-test adversarial suite passes.

34.
The 34-check static preflight passes.
```

---

# 161A. v1.0.1 Patch Closure

This patch changes only the demonstrated v1.0 blocker:

```text
The same uncertainty MUST NOT be counted simultaneously
through multiple risk/uncertainty channels unless the pinned
methodology explicitly defines those contributions as distinct
and non-duplicative.
```

The locked audit suite remains exactly:

```text
80 adversarial tests
34 static preflight checks
```

No new freeze criterion is introduced by v1.0.1.

---

# 161B. v1.0.2 Patch Closure

This patch exists only because SPEC06 v1.0.1 was frozen against SPEC05 v1.0.1 while the current verified baseline is SPEC05 v1.0.5 (`c8d645700d24091a4853e83b27f1a2e7218f6f4b3b83925a1541224c84e0eeaf`).

The following authority and runtime compatibility deltas are formally closed in v1.0.2:

1. Upstream Pinning:
   Replaced SPEC05 v1.0.1 upstream dependency with SPEC05 v1.0.5 FROZEN (`c8d645700d24091a4853e83b27f1a2e7218f6f4b3b83925a1541224c84e0eeaf`).

2. Mandatory StageExecution Claim Authority:
   Every evaluation stage requires prior atomic database claim before external provider/evaluator invocation. Losing claimants receive zero execution authority.

3. Reconstructable Stage Input Identity & Canonical Input Hash:
   `canonical_input_hash` is deterministically computed from trusted database records prior to claim and locked into StageExecution (§127A). The hash field is excluded from its own preimage. Caller cannot supply or override this hash. `EVALUATION_CLOSURE` binds its exact closure reference package (§133A) with no silent rebase.

4. Exact RunConfig Closure & Selected Config Binding:
   Canonical evaluation stages bind to the full immutable RunConfig identity (exact `run_config_id`, canonical `runtime_parameters`, and normalized prompt, model, tool, schema, retriever, evaluator ref sets) and the exact stage-utilized member configs (§128–§133A). No mid-run LATEST/ACTIVE resolution.

5. Scope-First Tenant/Workspace Locking:
   Database queries and locks filter by `tenant_id` and null-safe `workspace_id` prior to row inspection, eliminating foreign existence oracles and cross-tenant lock denial-of-service.

6. Commit-Time Revalidation Preamble:
   All canonical write and closure transactions (§151–§158) independently re-read trusted inputs, recompute `canonical_input_hash`, verify active fencing tokens, confirm cycle writability, and verify exact RunConfig closure inside the atomic commit transaction (§150A).

7. Lease Takeover and Retry Semantics:
   Exact retries preserve canonical stage identity and input hash. Valid takeover of an expired lease increments `fencing_token` and `attempt_count`, rendering the old worker stale.

All evaluation-domain semantics (assertions, mapping, validation statuses, composite loop, EvalContract, qualitative dimensions, risk/uncertainty, and DecisionSnapshot closure) remain 100% unchanged.

The locked audit suite remains exactly:
80 adversarial tests
34 static preflight checks

---

# 162. Verification Record — Final Freeze

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

EXTERNAL FREEZE AUDIT INPUT SHA256
bbe9cd003dd4244357f32716630891b5a3cb288b2e69c74422ede93531667204
```

Later patching may address only demonstrated failures in the locked suite or concrete upstream contradictions.

No open-ended architecture expansion after suite lock.

---

# 163. Canonical V1 Evaluation Runtime

```text
ContentCandidate
↓
extract material ContentAssertions
↓
map each Assertion ↔ Proposition(s)
↓
resolve exact decision-time EpistemicState
↓
AssertionValidationResult
↓
CompositeImpressionAssessment
↓
new implied assertions?
```

If yes:

```text
register implied assertions
↓
map
↓
validate
↓
new CompositeImpressionAssessment
```

Until:

```text
stable / stable-with-requirements
or
invalid / review-required
or
iteration limit → review required
```

Then:

```text
QualitativeEvaluation
↓
RiskAssessment
↓
UncertaintyAssessment
↓
CONTENT_LEVEL governance / RightsCheck as needed
↓
DecisionSnapshot closure
```

---

# 164. Candidate Repair Loop

```text
Candidate C1
↓
validation/composite/qualitative feedback
↓
SPEC05 creates Candidate C2
↓
SPEC06 extracts new assertions
↓
SPEC06 evaluates C2 independently
```

No old validation transfer.

---

# 165. Final Doctrine

```text
EVALUATE
WHAT WAS ACTUALLY GENERATED.

ONE ASSERTION
ONE IMMUTABLE ID.

ASSERTION
IS NOT PROPOSITION.

MAPPING
IS NOT SUPPORT.

SUPPORT
MUST MATCH
MEANING, SCOPE AND STRENGTH.

UNKNOWN
STAYS UNKNOWN.

INSUFFICIENT
STAYS INSUFFICIENT.

CONTRADICTION
CANNOT BE WISHED AWAY.

QUALIFICATION
MUST EXIST
IN THE CONTENT.

IMPLIED CLAIMS
ARE CLAIMS.

COMPOSITE MEANING
MUST CLOSE.

HARD GATES
ARE HARD.

RISK
IS NOT UNCERTAINTY.

RIGHTS
BELONG TO SPEC08.

RE-EVALUATION
CREATES NEW STATE.

SNAPSHOT
PINS EXACT RESULTS.

NO HIDDEN KNOWLEDGE.
NO CURRENT LOOKUP.
NO STALE WORKER.
NO MUTABLE HISTORY.

LOCK THE SUITE.
AUDIT IT.
THEN FREEZE.
```

---

**End of ContentOS SPEC 06 — Evaluation Framework v1.0.2 — FROZEN**
