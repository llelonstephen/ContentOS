# ContentOS SPEC 03 — Evidence / Proposition / Epistemic State
## Evidence Semantics, Knowledge Construction & Epistemic Derivation
### Version 1.0.1 — Frozen Evidence / Proposition / Epistemic State

---

# 0. Status

```text
SPEC
SPEC 03 — EVIDENCE / PROPOSITION / EPISTEMIC STATE

VERSION
1.0.1

SOURCE OF TRUTH
ContentOS Blueprint v2.13.1 — FROZEN
ContentOS SPEC 01 v1.1.3 — FROZEN
ContentOS SPEC 02 v1.0.6 — FROZEN

STATUS
FROZEN
```

SPEC03 defines exactly how ContentOS turns immutable source/observation state into:

```text
EvidenceItem
↓
Proposition
↓
EvidencePropositionLink
↓
EvidenceAssessment
↓
EpistemicStateVersion
```

and how research outcomes interact with:

```text
KnowledgeGap
ResearchTrace
Unknown-Preservation Gate
```

SPEC03 does not change the frozen entities or relational contracts.

If this SPEC conflicts with an upstream frozen source:

```text
BLUEPRINT
>
SPEC01
>
SPEC02
>
SPEC03
```

Source fingerprints used for this draft:

```text
Blueprint v2.13.1
SHA-256
24e024bff59e5f5bce73172d82ca0c8a5fd696264d1498a3b8884cec55a95fa9

SPEC01 v1.1.3
SHA-256
cc74f045e6e1cd25f8ebe37e7db85bb66550b5cde5d5e99db1a098a0816e858d

SPEC02 v1.0.6
SHA-256
6cd0f47de653e260f35729dc4cb62ba0bd5155962eb84caa6a7570c4ba6313c6
```

---

# 1. Purpose

SPEC03 closes the behavioral contracts for:

```text
knowledge-gap handling
research trace semantics
safe source ingestion
evidence extraction
evidence-origin typing
evidence-domain classification
proposition identity
proposition reuse
proposition semantic change
evidence/proposition linking
compatibility determination
evidence assessment
reassessment
epistemic aggregation
causal-support guard
performance-evidence firewall
valid-time / known-time behavior
epistemic supersession
unknown preservation
deletion/replay interaction
idempotency
concurrency
failure handling
auditability
```

The goal is not to maximize certainty.

The goal is:

```text
REPRESENT
WHAT IS KNOWN,
WHAT IS NOT KNOWN,
WHY,
FROM WHICH EXACT EVIDENCE,
AT WHICH TIME,
UNDER WHICH EXACT DERIVATION CONFIGURATION.
```

---

# 2. Non-Goals

SPEC03 does not define:

```text
general policy DSL
normative-rule resolution
rights-license interpretation
content-writing algorithms
creative ranking
qualitative evaluation rubrics
publication workflow
experiment design
incrementality estimation
user interface
provider-specific prompts
cross-tenant learning
automatic Control Plane activation
```

Those remain owned by other SPECs.

SPEC03 may consume exact pinned revisions from those systems.

It does not redefine them.

---

# 3. Core Doctrine

```text
SOURCE
IS NOT EVIDENCE.

EVIDENCE
IS NOT A PROPOSITION.

PROPOSITION
IS NOT EPISTEMIC STATE.

COMPATIBLE
DOES NOT MEAN SUPPORTIVE.

SUPPORT
DOES NOT MEAN CAUSATION.

ATTRIBUTION
DOES NOT MEAN CAUSATION.

RESEARCH FAILURE
DOES NOT MEAN FALSITY.

NO EVIDENCE FOUND
DOES NOT MEAN CONTRADICTED.

UNKNOWN
MUST REMAIN UNKNOWN.

SEMANTIC CHANGE
CREATES A NEW PROPOSITION.

KNOWLEDGE CHANGE
CREATES A NEW EPISTEMIC STATE.

HISTORICAL STATE
IS NEVER REWRITTEN.

UPSTREAM DECIDES WHAT.
WRITER DECIDES HOW TO EXPRESS IT.
```

---

# 4. Canonical Knowledge Construction Graph

```text
KnowledgeGap
↓
ResearchTrace
↓
SourceArtifact / PerformanceObservation
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
↓
Audience / Strategy / Validation / Governance consumers
```

No stage may silently skip an upstream identity.

Invalid:

```text
SourceArtifact
→ EpistemicStateVersion
```

Invalid:

```text
EvidenceItem
→ support_status
```

Invalid:

```text
ResearchTrace.outcome = NO_EVIDENCE_FOUND
→ Proposition = false
```

---

# 5. Frozen Canonical Entities Used by SPEC03

SPEC03 uses the frozen schemas from SPEC02:

```text
KnowledgeGap
ResearchTrace
SourceArtifact
EvidenceItem
Proposition
EvidencePropositionLink
EvidenceAssessment
EpistemicStateVersion
PerformanceObservation
RunKnowledgeDelta
BaselineKnowledgeSnapshot
DecisionSnapshot
ReplayabilityStatus
```

SPEC03 introduces no new canonical domain entity.

Operational locks, derived fingerprints, caches and diagnostic views are permitted only when they are:

```text
NON-AUTHORITATIVE
REBUILDABLE
NOT REFERENCED AS HISTORICAL DOMAIN TRUTH
```

---

# 6. Canonical V1 Vocabularies

## 6.1 EvidenceDomain

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

## 6.2 DataScope

```text
TENANT_PRIVATE
WORKSPACE_SHARED
AUTHORIZED_AGGREGATE
GLOBAL_PUBLIC
```

## 6.3 PropositionType

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

## 6.4 EvidenceCompatibilityStatus

```text
COMPATIBLE
COMPATIBLE_WITH_LIMITS
INCOMPATIBLE
UNCERTAIN
```

## 6.5 EvidenceRelationship

```text
SUPPORTS
PARTIALLY_SUPPORTS
QUALIFIES
CONTRADICTS
DOES_NOT_ADDRESS
```

## 6.6 Epistemic SupportStatus

```text
SUPPORTED
PARTIALLY_SUPPORTED
CONFLICTING
CONTRADICTED
INSUFFICIENT
UNKNOWN
```

## 6.7 CausalStatus

SPEC03 closes the V1 implementation vocabulary for `EpistemicStateVersion.causal_status`:

```text
SUPPORTED
PARTIALLY_SUPPORTED
ASSOCIATIONAL_ONLY
CONFLICTING
INSUFFICIENT
UNKNOWN
NOT_APPLICABLE
```

This vocabulary does not change PropositionType.

For every Proposition where:

```text
proposition_type != CAUSAL
```

required:

```text
causal_status = NOT_APPLICABLE
```

No exception exists for a hidden or embedded causal subclaim.

If a causal subclaim is material enough to require causal epistemic evaluation:

```text
CREATE / RESOLVE A SEPARATE CAUSAL PROPOSITION
```

or otherwise model the Proposition itself as `CAUSAL` when that is its canonical meaning.

A non-causal Proposition may never receive:

```text
SUPPORTED
PARTIALLY_SUPPORTED
ASSOCIATIONAL_ONLY
CONFLICTING
INSUFFICIENT
UNKNOWN
```

as its `causal_status`.

---

# 7. Required Execution Order

The canonical evidence path is:

```text
1. identify KnowledgeGap if relevant
2. perform ResearchTrace if research is attempted
3. ingest immutable origin
4. extract EvidenceItem
5. resolve / create Proposition
6. create EvidencePropositionLink
7. determine compatibility
8. create EvidenceAssessment
9. derive new EpistemicStateVersion when warranted
10. update downstream decision state through new immutable objects
```

The system MUST NOT:

```text
assess support before Proposition identity exists

create EpistemicStateVersion
without exact EvidenceAssessment IDs

treat EvidenceDomain as relationship judgment

treat relationship as compatibility judgment

resolve a blocking KnowledgeGap
from research failure alone
```

---

# 8. KnowledgeGap Contract

A KnowledgeGap represents a decision-relevant unknown.

Canonical fields remain those frozen in Blueprint/SPEC02.

A KnowledgeGap is immutable.

Status change creates:

```text
NEW gap_id
```

with optional:

```text
supersedes_gap_id = prior_gap_id
```

The prior gap is never updated.

---

# 9. KnowledgeGap Status Semantics

## OPEN

The question exists and no terminal disposition has been recorded.

## BLOCKING

The unknown currently blocks the normal strategy/release path.

`blocking = true` and `status = BLOCKING` are not interchangeable concepts:

```text
blocking
=
decision importance flag

status
=
current immutable resolution state
```

## RESOLVED_BY_RESEARCH

Research produced sufficient decision-relevant knowledge under the applicable evidence rules.

This does not require:

```text
support_status = SUPPORTED
```

A gap may be resolved by discovering that the answer is:

```text
CONTRADICTED
CONFLICTING
INSUFFICIENT
```

if that state itself answers the decision question sufficiently.

## RESOLVED_BY_USER

An authorized user supplied the missing decision input through the relevant upstream contract.

User input does not automatically become EvidenceItem unless it enters through a supported evidence-origin contract.

## EXPLICIT_ASSUMPTION

Allowed only when:

```text
assumption_allowed = true
```

and the downstream risk/policy path permits proceeding.

The assumption MUST remain explicit.

It MUST NOT be represented as factual support.

## UNRESOLVED_NON_BLOCKING

The unknown remains unresolved but is not blocking the current normal path.

Unknown remains unknown.

---

# 10. Unknown-Preservation Gate

Before normal Strategy generation:

```text
FOR EACH final KnowledgeGap
WHERE blocking = true
```

require:

```text
RESOLVED_BY_RESEARCH
or
RESOLVED_BY_USER
```

or:

```text
EXPLICIT_ASSUMPTION
```

only when:

```text
assumption_allowed = true
```

and downstream treatment permits proceeding.

The following ResearchTrace outcomes never close a blocking gap by themselves:

```text
NO_EVIDENCE_FOUND
SEARCH_INCOMPLETE
SEARCH_FAILED
```

If blocking uncertainty remains:

```text
DO NOT ENTER NORMAL RELEASE STRATEGY PATH
```

Allowed outcomes include:

```text
BLOCKED
HUMAN_REVIEW_REQUIRED
additional research
explicit user resolution
```

Never:

```text
invented certainty
```

---

# 11. ResearchTrace Contract

ResearchTrace records what was attempted.

It is not itself evidence.

It is not a truth judgment.

Required semantics:

```text
research_question
=
what was searched

queries
=
what retrieval operations were issued

sources_searched
=
where the search actually looked

retrieval_revision_ref
=
exact pinned retrieval implementation/configuration

result_evidence_ids
=
EvidenceItems actually admitted from this research attempt

coverage_limitations
=
known search-space limitations

outcome
=
what happened operationally / evidentially

stop_reason
=
why this trace ended
```

---

# 12. Research Outcomes

## FOUND_RELEVANT_EVIDENCE

At least one admitted EvidenceItem materially addresses the research question.

It does NOT mean:

```text
the Proposition is supported
```

Compatibility and assessment still follow.

## NO_EVIDENCE_FOUND

No relevant evidence was found inside the searched scope.

It means only:

```text
nothing adequate was found
within this search
under its coverage limitations
```

It does NOT mean:

```text
false
contradicted
impossible
does not exist
```

## SEARCH_INCOMPLETE

The search did not reach its intended coverage.

## SEARCH_FAILED

Execution failed materially.

Neither incomplete nor failed research may be used as negative Evidence.

---

# 13. Research Stop Rule

Research may stop when one or more apply:

```text
decision question resolved
search budget exhausted
time budget exhausted
source access exhausted
rights restriction prevents further admissible use
retrieval dependency unavailable
marginal search value below configured threshold
human escalation required
```

`stop_reason` must reflect the actual reason.

Budget exhaustion is not epistemic resolution.

---

# 14. SourceArtifact Admission

A SourceArtifact is an immutable captured source state.

Canonical admission requires:

```text
source identity metadata
retrieval timestamp
content hash
immutable snapshot_reference
rights_policy_id
data_scope
```

A URL by itself is not a canonical SourceArtifact snapshot.

The captured bytes/object referenced by:

```text
snapshot_reference
```

are the historical source state.

---

# 15. Safe Source Boundary

External source content is untrusted data.

It may not:

```text
modify Control Plane
change permissions
issue tool commands
authorize publication
override system instructions
self-declare truth
self-declare policy authority
```

Canonical ingestion:

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

---

# 16. Source Rights Boundary

SPEC03 does not interpret licenses.

It consumes the exact RightsPolicy / rights decision contracts owned elsewhere.

Evidence extraction and downstream use MUST respect the allowed use.

A source may be:

```text
retrievable
```

while not being permitted for:

```text
generation input
quotation
transformation
redistribution
commercial publication
```

Rights restrictions do not change the truth semantics of Evidence.

They change permitted use.

---

# 17. DataScope Boundary

Evidence and source access must preserve:

```text
TENANT_PRIVATE
WORKSPACE_SHARED
AUTHORIZED_AGGREGATE
GLOBAL_PUBLIC
```

Cross-scope use is allowed only through explicit authorization defined by the tenant/data-access model.

The epistemic engine MUST NOT infer that:

```text
GLOBAL_PUBLIC
=
high authority
```

or:

```text
TENANT_PRIVATE
=
low authority
```

Data scope and epistemic quality are separate.

---

# 18. EvidenceItem Contract

EvidenceItem is an immutable assessable statement originating from a supported immutable origin.

V1 supported origin types are exactly:

```text
SOURCE_ARTIFACT
PERFORMANCE_OBSERVATION
```

Origin integrity:

```text
SOURCE_ARTIFACT
→ origin_id resolves SourceArtifact

PERFORMANCE_OBSERVATION
→ origin_id resolves PerformanceObservation
```

No unsupported origin type is admitted in V1.

---

# 19. EvidenceItem Extraction Rule

EvidenceItem.statement should represent an assessable statement attributable to the immutable origin.

The extractor MUST preserve:

```text
material qualifiers
conditions
population
jurisdiction
time
measurement basis
uncertainty
reported-vs-observed distinction
```

The extractor MUST NOT silently strengthen:

```text
may
→ will

associated with
→ causes

observed
→ proven

reported by source
→ established fact
```

If one source sentence contains materially separable claims, the extractor SHOULD create separate EvidenceItems when independent assessment is required.

This is an extraction rule, not a new identity entity.

---

# 20. Evidence Locator

When a source origin supports locators, `locator` SHOULD identify the smallest stable source region sufficient for audit.

Examples:

```text
page/section
paragraph identifier
timecode
table/row
record key
measurement segment
```

Locator is not a substitute for origin_id.

Historical verification always resolves:

```text
origin_id
+
locator
```

against the immutable origin state.

---

# 21. Evidence Statement Type & Assertion Method

`statement_type` and `assertion_method` describe how the statement is represented and obtained.

They MUST NOT encode:

```text
support_status
compatibility_status
relationship
causal_status
```

Those belong downstream.

No field inside EvidenceItem may pre-judge the target Proposition.

---

# 22. EvidenceDomain Classification

EvidenceDomain answers:

```text
WHAT KIND OF EVIDENCE IS THIS?
```

It does not answer:

```text
IS THE PROPOSITION TRUE?
```

Classification uses immutable origin context plus the EvidenceItem extraction.

The classifier may use an exact pinned model/evaluator configuration.

Its identity must be reconstructable through the stage's RunConfig / StageExecution lineage.

---

# 23. Evidence-Domain Safety Rule

Evidence from one domain may not silently establish a proposition class that the active compatibility contract disallows.

Examples:

```text
CUSTOMER_REPORT
cannot automatically establish
a general causal product-effect claim

OBSERVATIONAL_PERFORMANCE
cannot automatically establish
a product fact

PLATFORM_ANALYTICS
cannot automatically establish
incremental causal lift
```

Domain compatibility is evaluated later per EvidencePropositionLink.

---

# 24. Performance Evidence Origin

When evidence derives from PerformanceObservation:

```text
origin_type = PERFORMANCE_OBSERVATION

origin_id = exact observation_id
```

The EvidenceItem MUST preserve the observation's:

```text
metric revision
publication coverage semantics
measurement window
measurement maturity context
population/denominator semantics
```

through origin resolution and statement wording.

---

# 25. Performance Evidence Firewall

Performance evidence may inform appropriate:

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

Nor does:

```text
high conversion
```

prove:

```text
the content's factual claims are true
```

Observed effectiveness and factual truth remain separate.

---

# 26. Attribution Firewall

Attribution models may assign observed credit.

They do not establish incremental causal effect by themselves.

Therefore:

```text
attributed performance
≠
causal effect
```

An EvidenceItem derived from attributed performance must retain that limitation.

---

# 27. Evidence Valid-Time Rule

EvidenceItem:

```text
valid_from
valid_until_if_known?
```

describes the real-world/business interval for which the statement is asserted to apply.

`valid_until_if_known` may be stored only when known at EvidenceItem creation.

A later superseding event MUST NOT mutate old EvidenceItem timing.

---

# 28. Evidence Immutability

Material change to:

```text
statement
origin
locator
evidence_domain
study_design
causal_identification
mechanism_support
valid-time semantics
limitations
```

creates a new EvidenceItem.

Never patch the old row.

If the immutable origin itself was corrected:

```text
new origin
→ new EvidenceItem
```

as needed.

---

# 29. Proposition Contract

Proposition is immutable semantic meaning.

It answers:

```text
WHAT EXACT CLAIM / MEANING IS UNDER DISCUSSION?
```

It does not answer:

```text
HOW WELL IS IT SUPPORTED?
```

Support belongs to EpistemicStateVersion.

---

# 30. Proposition Semantic Identity

Material proposition identity consists of the combined meaning of:

```text
proposition_type
canonical_meaning
subject
predicate
object
qualifiers
conditions
population_scope
jurisdiction_scope
```

Two propositions are the same semantic identity only when these resolve to materially equivalent meaning.

For one accessible semantic meaning under one ownership/access scope:

```text
ONE MEANING
→ ONE CANONICAL proposition_id
```

Creating a second canonical Proposition for a meaning already resolved as equivalent is invalid.

Textual similarity alone is insufficient.

---

# 31. Proposition Reuse Rule

Before creating a new Proposition, the runtime MUST search existing accessible Propositions for semantic equivalence.

Reuse is allowed only when:

```text
semantic meaning is equivalent
```

including material qualifiers/scope.

Unsafe reuse examples:

```text
"reduces noise at 1 metre"
!=
"reduces noise at 3 metres"

"customers reported faster setup"
!=
"setup is objectively faster"

"associated with higher CTR"
!=
"causes higher CTR"
```

---

# 32. Proposition Resolution Outcomes

A semantic resolver may produce:

```text
REUSE_EXISTING
CREATE_NEW
REVIEW_REQUIRED
```

These are runtime outcomes, not new canonical domain entities.

Rules:

```text
high-confidence semantic equivalence
→ REUSE_EXISTING

material semantic difference
→ CREATE_NEW

uncertain material equivalence
→ REVIEW_REQUIRED
or safe CREATE_NEW
```

Never silently merge uncertain semantics.

---

# 33. Semantic Fingerprints

Implementations may calculate a derived:

```text
semantic_fingerprint
```

for search, locking and dedup acceleration.

It is:

```text
NON-AUTHORITATIVE
DERIVED
REBUILDABLE
```

It MUST NOT replace proposition_id.

Hash collision or normalization collision may never force semantic identity.

---

# 34. Proposition Creation Race

Concurrent workers may independently attempt to create semantically identical Propositions.

The implementation MUST serialize proposition resolution on a derived semantic lock/fingerprint or an equivalent concurrency-safe mechanism during the resolution transaction.

Canonical pattern:

```text
derive semantic candidate
↓
acquire semantic-resolution lock
↓
re-query accessible propositions
↓
reuse if equivalent
else create
↓
release lock
```

The lock is operational infrastructure.

It is not historical truth.

The transaction MUST re-check semantic equivalence after acquiring the serialization boundary.

If an equivalent Proposition now exists:

```text
REUSE_EXISTING
```

is mandatory.

A concurrent race may not produce two canonical proposition IDs for one resolved semantic meaning.

---

# 35. Proposition Semantic Change

If semantic meaning changes materially:

```text
CREATE NEW proposition_id
```

Optional:

```text
supersedes_proposition_id
```

may document semantic succession.

Evidence linked to the old Proposition does NOT silently transfer to the new Proposition.

The new Proposition must receive its own EvidencePropositionLinks.

---

# 36. Proposition Supersession Meaning

`supersedes_proposition_id` means:

```text
this new semantic object intentionally replaces
an earlier semantic formulation
```

It does not mean:

```text
same identity, newer version
```

ContentOS has no mutable Proposition version.

Old Proposition meaning remains immutable.

---

# 37. EvidencePropositionLink Contract

EvidencePropositionLink says:

```text
THIS EVIDENCE ITEM
IS BEING ASSESSED
AGAINST THIS PROPOSITION.
```

It does not contain:

```text
support judgment
compatibility judgment
weight
confidence
```

Those belong to EvidenceAssessment.

---

# 38. Link Uniqueness

For one exact pair:

```text
(evidence_id, proposition_id)
```

there is one canonical EvidencePropositionLink.

SPEC02 uniqueness applies:

```text
UNIQUE(evidence_id, proposition_id)
```

Reassessment does not create a duplicate link.

It creates a new EvidenceAssessment.

---

# 39. Link Creation Order

Canonical sequence:

```text
EvidenceItem exists
+
Proposition exists
↓
create/reuse EvidencePropositionLink
↓
evaluate compatibility
↓
assess relationship/quality
```

Support may not be decided before link identity exists.

---

# 40. Compatibility Contract

Compatibility answers:

```text
MAY THIS KIND OF EVIDENCE
LEGITIMATELY INFORM
THIS KIND OF PROPOSITION
UNDER THESE CONDITIONS?
```

Compatibility is not truth.

Compatibility is not support.

Canonical statuses:

```text
COMPATIBLE
COMPATIBLE_WITH_LIMITS
INCOMPATIBLE
UNCERTAIN
```

---

# 41. Compatibility Inputs

Compatibility evaluation may use:

```text
EvidenceItem.evidence_domain
EvidenceItem.statement_type
EvidenceItem.assertion_method
EvidenceItem.study_design
EvidenceItem.causal_identification
EvidenceItem.mechanism_support
EvidenceItem.valid-time scope
EvidenceItem.limitations

Proposition.proposition_type
Proposition.conditions
Proposition.population_scope
Proposition.jurisdiction_scope

task / market / jurisdiction context
pinned compatibility/derivation configuration
```

It MUST NOT use:

```text
desired business outcome
preferred creative direction
whether the evidence is convenient
```

to change epistemic compatibility.

---

# 42. Compatibility Determinism Boundary

Hard compatibility exclusions MUST be deterministic from structured inputs and pinned configuration.

Model-assisted classification may propose structured values.

The final admitted compatibility state must pass schema and rule validation.

Unparseable or unresolved material compatibility:

```text
UNCERTAIN
```

not:

```text
COMPATIBLE
```

---

# 43. COMPATIBLE

Evidence may contribute to epistemic derivation for the target Proposition, subject to EvidenceAssessment quality and relationship.

---

# 44. COMPATIBLE_WITH_LIMITS

Evidence may contribute only within explicit limitations.

Examples:

```text
population mismatch
partial jurisdiction match
stale but still informative evidence
indirect measurement
narrower condition
```

The limitations MUST remain visible in:

```text
EvidenceAssessment
and/or
EpistemicStateVersion.uncertainty
```

---

# 45. INCOMPATIBLE

The evidence may not contribute epistemic support or contradiction to the target Proposition under the active contract.

It may remain linked for audit.

Epistemic derivation MUST exclude it as evidential weight.

It cannot be silently converted to:

```text
SUPPORTS
CONTRADICTS
```

for aggregation.

---

# 46. UNCERTAIN Compatibility

`UNCERTAIN` means the system cannot establish admissibility confidently.

It is not equivalent to:

```text
COMPATIBLE
```

An uncertain item may remain in the assessment record.

It may not by itself promote a Proposition to `SUPPORTED`.

The pinned derivation policy determines whether it contributes only to uncertainty or triggers review.

---

# 47. EvidenceAssessment Contract

EvidenceAssessment is an immutable judgment about one exact EvidencePropositionLink.

It owns:

```text
compatibility_status
relationship
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
```

It also records:

```text
assessor
assessment_method
assessed_at
```

---

# 48. Assessment Separation Rule

The following must remain separate:

```text
compatibility_status
relationship
```

Examples:

```text
COMPATIBLE
+
CONTRADICTS
```

is valid.

```text
COMPATIBLE_WITH_LIMITS
+
SUPPORTS
```

may be valid.

```text
INCOMPATIBLE
```

cannot contribute epistemic weight regardless of a model-generated relationship label.

---

# 49. Evidence Relationship Semantics

## SUPPORTS

Evidence materially supports the exact Proposition meaning.

## PARTIALLY_SUPPORTS

Evidence supports only part of the Proposition or supports it with material limitations.

## QUALIFIES

Evidence narrows, conditions or materially qualifies the Proposition without simply supporting or contradicting it.

## CONTRADICTS

Evidence materially conflicts with the exact Proposition meaning.

## DOES_NOT_ADDRESS

Evidence does not materially answer the Proposition.

`DOES_NOT_ADDRESS` contributes no support/contradiction weight.

---

# 50. Assessment Dimension Payloads

SPEC02 stores several assessment dimensions as structured/text payloads.

SPEC03 requires each material dimension to be machine-readable enough for deterministic derivation.

Recommended canonical shape:

```text
{
  level: ...,
  reason_codes: [...],
  notes?: ...,
  uncertainty?: ...
}
```

SPEC03 does not freeze one universal numerical scoring scale.

Thresholds and mappings belong to the exact pinned derivation/evaluator revision.

This prevents hard-coding one scoring theory into architecture.

---

# 51. Assessor Identity

`assessor` must identify the assessment source sufficiently for audit.

Examples:

```text
deterministic rule engine
human reviewer identity/role
exact evaluator/model configuration
hybrid evaluator
```

A free-form label like:

```text
AI
```

is insufficient if it prevents exact audit.

Model/config revision lineage must remain reconstructable through:

```text
RunConfig
StageExecution
assessment_method
or exact referenced configuration
```

---

# 52. Assessment Method

`assessment_method` must state the method family used.

Examples:

```text
RULE_BASED
HUMAN_REVIEW
MODEL_ASSISTED_STRUCTURED
HYBRID
```

The concrete method configuration is pinned through existing revision infrastructure.

SPEC03 does not create a new revisioned concept.

---

# 53. Reassessment

Reassessment creates:

```text
NEW assessment_id
```

It never mutates the prior EvidenceAssessment.

If:

```text
A2.supersedes_assessment_id = A1
```

then required:

```text
A2.link_id = A1.link_id
A2.assessed_at > A1.assessed_at
```

SPEC03 does not impose one global single-successor chain on EvidenceAssessment because the frozen Blueprint/SPEC02 do not require one.

Independent assessments by different methods may coexist.

An EpistemicStateVersion avoids double counting by explicitly listing the exact assessment IDs it uses.

---

# 54. Assessment Independence Rule

Multiple assessments are not automatically independent evidence.

Independence is evaluated primarily from underlying evidence/origin lineage, not merely distinct assessment IDs.

Invalid weighting:

```text
same EvidenceItem
assessed by 3 evaluators
→ counted as 3 independent evidence items
```

Assessment multiplicity may increase review confidence.

It does not multiply factual observations.

---

# 55. Evidence Dependency Rule

Evidence derived from the same underlying source family may be statistically or semantically dependent.

`independence` must reflect known dependency.

Examples:

```text
same SourceArtifact quoted by many pages
same press release syndicated by multiple outlets
same PerformanceObservation sliced into repeated claims
same study summarized by many secondary sources
```

The derivation policy must not count obvious duplicates as independent confirmation.

---

# 56. EpistemicStateVersion Contract

EpistemicStateVersion is the immutable system judgment about one exact Proposition at a system-known time.

It owns:

```text
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
```

It does NOT change Proposition meaning.

---

# 57. Exact Assessment Closure

Every `assessment_id` in an EpistemicStateVersion MUST satisfy:

```text
assessment exists
↓
assessment.link_id exists
↓
link.proposition_id
==
EpistemicStateVersion.proposition_id
```

No assessment for another Proposition may enter the state.

This is a hard closure invariant.

---

# 58. Assessment Selection Boundary

Epistemic derivation receives an explicit exact assessment set.

It MUST NOT internally substitute:

```text
latest assessment
current assessment
all assessments
```

without first resolving the exact immutable IDs at the knowledge boundary.

The resulting EpistemicStateVersion stores those exact IDs.

Historical replay reads the stored set.

---

# 59. Superseded Assessment Double-Count Guard

If the derivation includes both:

```text
A1
A2
```

and:

```text
A2.supersedes_assessment_id = A1
```

the derivation MUST NOT treat A1 and A2 as independent contemporaneous evidence.

Normally only the assessment state selected for the decision boundary contributes.

Historical A1 remains available for historical replay of earlier epistemic states.

---

# 60. SupportStatus Semantics

## SUPPORTED

The exact compatible assessment set meets the pinned derivation policy's support requirements with no unresolved material contradiction that prevents support.

## PARTIALLY_SUPPORTED

Meaningful support exists but material scope, quality, precision or qualification limits full support.

## CONFLICTING

Material compatible assessments support and contradict the Proposition and the pinned derivation policy cannot resolve the conflict sufficiently.

## CONTRADICTED

Material compatible contradiction satisfies the pinned derivation policy's contradiction criteria and support is insufficient to prevent contradiction status.

## INSUFFICIENT

Relevant evidence exists but does not meet the policy's minimum basis for a stronger epistemic conclusion.

## UNKNOWN

The system lacks enough admissible/assessed information to make a substantive epistemic judgment.

Unknown is not a weaker synonym for false.

---

# 61. Unknown vs Insufficient

Use:

```text
UNKNOWN
```

when the system effectively lacks an adequate basis to judge.

Use:

```text
INSUFFICIENT
```

when there is decision-relevant evidence, but its quality/quantity/scope is inadequate under the derivation policy.

Neither means:

```text
CONTRADICTED
```

---

# 62. Contradictory Evidence

Contradiction is represented through:

```text
EvidenceAssessment.relationship = CONTRADICTS
```

The EpistemicStateVersion may become:

```text
CONFLICTING
or
CONTRADICTED
```

depending on the full compatible assessment set and pinned derivation policy.

The system MUST preserve:

```text
supporting evidence
contradicting evidence
uncertainty
```

rather than deleting inconvenient evidence.

---

# 63. Epistemic Derivation Revision

`derivation_revision_ref` pins the exact immutable derivation configuration used.

The revision may define implementation details such as:

```text
dimension interpretation
minimum evidence thresholds
conflict treatment
freshness rules
dependency handling
causal-identification requirements
uncertainty aggregation
```

SPEC03 does not create a new config entity.

It uses the existing registered revision infrastructure.

The exact revision must be present in RunConfig or otherwise explicitly pinned by the stage contract.

---

# 64. Derivation Method

`derivation_method` describes how the state was produced.

It is not the source of configuration truth.

Configuration truth is the exact:

```text
derivation_revision_ref
```

Historical replay may display the method label, but must resolve the exact revision.

---

# 65. Causal Support Guard

For:

```text
Proposition.proposition_type = CAUSAL
```

a general:

```text
EvidenceAssessment.relationship = SUPPORTS
```

is not sufficient to set:

```text
causal_status = SUPPORTED
```

Causal support may be upgraded only when the contributing compatible EvidenceItems and EvidenceAssessments satisfy the causal-identification requirements of the pinned derivation policy.

---

# 66. Causal Status Semantics

## NOT_APPLICABLE

Required for every Proposition whose:

```text
proposition_type != CAUSAL
```

A material causal subclaim must be represented as a separate `CAUSAL` Proposition rather than evaluated inside a non-causal Proposition.

## UNKNOWN

No adequate causal-identification basis is available.

## INSUFFICIENT

Potentially relevant causal evidence exists but does not meet the required identification standard.

## ASSOCIATIONAL_ONLY

Association is supported, but causal identification is not.

## PARTIALLY_SUPPORTED

Some causal components satisfy the derivation policy but material limitations remain.

## CONFLICTING

Compatible causal evidence materially conflicts.

## SUPPORTED

The exact compatible evidence set satisfies the pinned causal-identification policy for the Proposition's scope.

This does not mean absolute certainty.

---

# 67. Observational Causal Firewall

These alone cannot yield causal_status=SUPPORTED:

```text
observational performance correlation
platform attribution
before/after correlation without adequate identification
engagement lift
conversion correlation
customer anecdote
```

They may support:

```text
ASSOCIATIONAL_ONLY
STRATEGIC
PERFORMANCE
AUDIENCE
```

states when compatible.

---

# 68. Causal Study Inputs

Causal derivation considers at minimum:

```text
study_design
causal_identification
mechanism_support
population_match
context_match
independence
precision
limitations
uncertainty
```

The exact accepted designs/thresholds belong to the pinned derivation policy.

SPEC03 does not hard-code one scientific hierarchy.

---

# 69. Bitemporal Semantics

ContentOS distinguishes:

```text
VALID TIME
```

from:

```text
KNOWN TIME
```

For EpistemicStateVersion:

```text
valid_from
valid_until_if_known?
```

describe the state of the proposition in valid/business time.

```text
known_from
```

describes when ContentOS knew this epistemic state.

These are not interchangeable.

---

# 70. known_from Rule

`known_from` is immutable.

For a successor:

```text
successor.known_from
>
predecessor.known_from
```

No two states in one proposition lineage may claim the same system-time ordering point when one supersedes the other.

---

# 71. valid_until_if_known Rule

`valid_until_if_known` may be stored only if the end was already known when the EpistemicStateVersion was created.

Future knowledge MUST NOT mutate the prior row.

If future evidence changes the valid-time interpretation:

```text
CREATE NEW EpistemicStateVersion
```

---

# 72. Epistemic Chain Integrity

For each `proposition_id`:

```text
at most one root
at most one direct successor per state
same proposition through successor edge
known_from strictly increases
acyclic graph
```

Storage enforcement follows SPEC02.

Runtime must also lock/serialize successor creation.

---

# 73. Epistemic Successor Transaction

Canonical write:

```text
BEGIN

lock proposition epistemic lineage / current terminal state

resolve exact assessment set

validate all assessment closure

validate predecessor still terminal

derive support_status
derive causal_status
derive uncertainty

insert new EpistemicStateVersion

COMMIT
```

If another worker wins first:

```text
retry from the new terminal state
```

Never branch silently.

---

# 74. Epistemic Idempotency

A derivation request identity SHOULD include:

```text
proposition_id
sorted exact assessment_ids
derivation_revision_ref
valid-time target
decision-cycle context
```

Equivalent exact requests should produce at most one canonical state transition.

If the requested derived state is semantically identical to the terminal state and no new historical event needs recording:

```text
NO-OP
```

may be returned rather than appending meaningless duplicate states.

---

# 75. No Hidden Evidence

An EpistemicStateVersion may depend only on:

```text
assessment_ids
derivation_revision_ref
explicit derivation inputs
```

recorded/reconstructable from canonical state.

The derivation may not rely on:

```text
unstored model memory
reviewer private knowledge
unlogged web pages
mutable current configuration
untracked prompt context
```

---

# 76. Human Knowledge

If a human introduces material new factual information:

```text
it must enter an allowed canonical state path
```

before a final decision relies on it.

Human review may not directly edit EpistemicStateVersion.

Material new information requires:

```text
new immutable upstream state
↓
new/reassessed evidence when applicable
↓
new EpistemicStateVersion when warranted
↓
new DecisionSnapshot
```

---

# 77. Current Decision-Time Epistemic State

Consumers may require a current decision-time state.

They MUST resolve it against:

```text
exact proposition_id
knowledge boundary
valid-time target
```

They must not query a mutable generic:

```text
CURRENT
```

without an explicit boundary.

The resolved exact `epistemic_state_id` is what enters snapshots/manifests.

---

# 78. Strategy Gate Integration

For every:

```text
StrategyHypothesis.required_proposition_id
```

normal strategy execution requires a decision-time EpistemicStateVersion in the pinned knowledge state.

When factual proof is required, states:

```text
CONTRADICTED
INSUFFICIENT
```

cannot be treated as adequate support.

Material assumptions/unknowns remain explicit.

Blocking KnowledgeGaps must satisfy the Unknown-Preservation Gate.

---

# 79. Audience Integration

Research may change:

```text
knowledge state
problem state
solution state
product state
brand state
intent state
objections
decision criteria
```

When decision-relevant knowledge changes materially:

```text
create new AudienceState
```

Do not mutate a prior AudienceState.

SPEC05 owns detailed audience reasoning.

---

# 80. Governance Refresh Trigger

If research changes:

```text
market
jurisdiction
product/category
audience state
channel
material proposition state
```

the runtime must trigger final governance recomputation under Blueprint/SPEC01 rules.

SPEC03 emits knowledge change.

It does not decide governance applicability itself.

---

# 81. RunKnowledgeDelta Integration

Run-created canonical knowledge entities are accumulated during a DecisionCycle.

Near freeze, SPEC01 materializes:

```text
RunKnowledgeDelta
```

from exact decision-relevant IDs.

SPEC03 MUST NOT continuously mutate RunKnowledgeDelta.

If knowledge changes after materialization but before FREEZING:

```text
new pre-freeze materialization
```

may be created as permitted by SPEC01.

After FREEZING:

```text
no upstream decision-input commit
```

to that cycle.

---

# 82. Baseline Knowledge Integration

BaselineKnowledgeSnapshot is immutable.

Research never rewrites baseline knowledge.

New run-created knowledge is represented by new immutable entities and later included in RunKnowledgeDelta.

---

# 83. DecisionSnapshot Integration

DecisionSnapshot pins exact:

```text
baseline knowledge
run knowledge delta
KnowledgeGap IDs
ResearchTrace IDs
EpistemicState IDs through manifests/transitive closure
```

Snapshot closure must prove all referenced knowledge is internally consistent.

Historical replay never recomputes old knowledge using future state.

---

# 84. Deletion & Replay

Data rights override replay convenience.

If a required source/evidence payload is lawfully deleted:

```text
historical domain rows are not rewritten merely for replay
```

SPEC02 deletion closure applies.

Replayability may become:

```text
PARTIAL_REDACTED
UNAVAILABLE_DUE_TO_RETENTION
INVALIDATED_BY_DELETION
```

The system MUST NOT invent missing evidence.

---

# 85. Deletion Effect on Future Knowledge

Historical EpistemicStateVersion remains historical truth about what the system recorded then, subject to replayability status.

For future decisions:

```text
deleted/unavailable prohibited evidence
MUST NOT be silently reused
```

If the available evidence basis materially changes:

```text
derive a new EpistemicStateVersion
```

from the exact lawful available assessment set.

Do not retain prohibited payload merely to preserve old support.

---

# 86. Source Correction

When a source/observation is corrected:

```text
do not mutate old SourceArtifact / PerformanceObservation
```

Create the appropriate successor/new origin under its owning SPEC.

Then:

```text
new EvidenceItem
or reassessment
or new EpistemicStateVersion
```

as warranted.

Historical lineage remains intact.

---

# 87. Evidence Freshness

Freshness is an assessment dimension.

It is not a global expiry switch.

Old evidence may remain relevant.

The pinned assessment/derivation policy determines whether age:

```text
reduces weight
requires qualification
makes evidence incompatible
requires refresh
```

No generic cron job mutates old EvidenceAssessment or EpistemicStateVersion.

---

# 88. Jurisdiction & Population Mismatch

Evidence may be:

```text
credible in its source context
```

but poorly applicable to a target Proposition scope.

This is represented through:

```text
compatibility_status
applicability
population_match
context_match
limitations
uncertainty
```

The system must not silently generalize:

```text
one population
→ all populations

one jurisdiction
→ all jurisdictions
```

---

# 89. Precision Rule

Evidence precision is not the same as authority.

A highly authoritative source may still provide an imprecise estimate.

A precise measurement may still be low-authority for the Proposition.

These dimensions remain separate.

---

# 90. Independence Rule

Independence is not inferred from different URLs, publishers or assessment IDs alone.

Known shared origin must be represented as dependency.

The derivation policy must avoid false confidence from replicated dependent evidence.

---

# 91. Contradiction Preservation

The system may never discard contradictory compatible evidence solely because it reduces confidence.

Material contradiction must appear in the exact assessment set or in explicit reasons for exclusion.

A `SUPPORTED` state cannot be produced by silently omitting material in-scope contradiction.

---

# 92. Evidence Exclusion Reasons

When an otherwise relevant assessment is excluded from an Epistemic derivation, exclusion should be auditable.

Common reasons:

```text
INCOMPATIBLE
outside valid-time target
outside population/jurisdiction scope
superseded assessment selected out
duplicate/dependent evidence
rights/data-access unavailable for current decision
deleted/unavailable
invalid assessment schema
```

Exclusion does not delete the assessment.

---

# 93. Epistemic Uncertainty

`EpistemicStateVersion.uncertainty` must preserve material uncertainty that affects downstream interpretation.

It may include:

```text
evidence gaps
conflict
scope mismatch
measurement noise
sampling limits
causal-identification limits
source dependency
freshness
missing data
deletion effects
```

Uncertainty is not optional prose decoration.

Downstream consumers may use it for deterministic gates.

---

# 94. Unknown Preservation

The following transformations are forbidden:

```text
NO_EVIDENCE_FOUND
→ CONTRADICTED

SEARCH_FAILED
→ false

UNCERTAIN compatibility
→ COMPATIBLE

INSUFFICIENT
→ SUPPORTED

ASSOCIATIONAL_ONLY
→ causal SUPPORTED

missing value
→ plausible default fact
```

When the system does not know:

```text
UNKNOWN
```

is a valid canonical state.

---

# 95. Failure Taxonomy

SPEC03 uses operational failure classes from SPEC01.

Evidence-specific examples:

```text
ORIGIN_UNRESOLVABLE
RIGHTS_USE_BLOCKED
EVIDENCE_SCHEMA_INVALID
PROPOSITION_IDENTITY_UNCERTAIN
LINK_CONFLICT
COMPATIBILITY_UNRESOLVED
ASSESSMENT_INVALID
EPISTEMIC_CLOSURE_FAILED
EPISTEMIC_CHAIN_RACE
BLOCKING_KNOWLEDGE_GAP
RESEARCH_INCOMPLETE
RESEARCH_FAILED
DELETED_REQUIRED_STATE
```

These are implementation error/reason codes.

They are not new canonical entities.

---

# 96. Fail-Closed Rules

Fail closed when:

```text
origin type cannot be validated
proposition identity is materially ambiguous and merge would be unsafe
assessment closure crosses proposition identity
causal support requirement is not satisfied
epistemic successor would branch
required evidence is deleted/unavailable
blocking gap remains unresolved
```

Fail closed means:

```text
do not fabricate a stronger knowledge state
```

It may mean:

```text
UNKNOWN
INSUFFICIENT
BLOCKED
HUMAN_REVIEW_REQUIRED
retry/research
```

depending on stage.

---

# 97. Idempotency — Source Ingestion

Canonical source ingestion identity SHOULD include stable retrieval identity such as:

```text
tenant/workspace
source locator
source version if known
content_hash
retrieval operation identity
```

Duplicate ingestion of identical captured bytes must not create contradictory source history.

Whether identical source snapshots are deduplicated into one SourceArtifact or represented as separate retrieval events is an implementation choice only when historical semantics remain unambiguous.

---

# 98. Idempotency — Evidence Extraction

Evidence extraction idempotency key SHOULD include:

```text
origin_type
origin_id
extractor/evaluator revision
extraction schema revision
canonical extraction input hash
```

Retrying one exact extraction must not create duplicate canonical EvidenceItems for the same extracted statement identity within that exact execution contract.

---

# 99. Idempotency — Link Creation

Database uniqueness:

```text
UNIQUE(evidence_id, proposition_id)
```

is the final authority.

Two workers racing to create the same link:

```text
one wins
one reloads canonical link
```

No duplicate link IDs.

---

# 100. Idempotency — Assessment

Assessment creation identity SHOULD include:

```text
link_id
assessment configuration revision
assessor identity/mode
canonical assessment input hash
```

A retry of one exact stage execution must not create duplicate equivalent assessments.

A deliberate reassessment is a new semantic event and must use a distinct idempotency identity.

---

# 101. Idempotency — Epistemic Derivation

Canonical derivation key SHOULD include:

```text
proposition_id
sorted assessment_ids
derivation_revision_ref
valid-time target
decision-cycle context
```

Concurrent exact derivations must converge to at most one canonical successor effect.

---

# 102. StageExecution Binding

Every asynchronous SPEC03 stage runs through SPEC01 StageExecution.

At minimum:

```text
RESEARCH
SOURCE_INGEST
EVIDENCE_EXTRACT
PROPOSITION_RESOLVE
EVIDENCE_LINK
EVIDENCE_ASSESS
EPISTEMIC_DERIVE
KNOWLEDGE_GAP_RESOLVE
```

may be represented as stage names/substages.

Each uses:

```text
idempotency key
lease
fencing token
attempt count
canonical input hash
output refs
```

---

# 103. Stale Worker Protection

A worker may physically return after:

```text
lease takeover
cycle cancellation
cycle supersession
FREEZING
```

Its canonical commit must be rejected by SPEC01 fencing rules.

This applies equally to:

```text
EvidenceItem
Proposition
EvidenceAssessment
EpistemicStateVersion
```

creation in decision-cycle workflows.

---

# 104. FREEZING Boundary

Before DecisionCycle enters FREEZING:

```text
all required decision-input stages terminal
```

After FREEZING begins:

```text
no new upstream knowledge commit
```

to that cycle.

Late research/evidence may:

```text
be stored outside the old decision path
or
trigger a new DecisionCycle
```

but cannot enter the frozen old DecisionSnapshot.

---

# 105. Tenant Isolation

Every SPEC03 read/write follows SPEC02 ownership envelope.

A tenant knowing another tenant's:

```text
source_id
evidence_id
proposition_id
assessment_id
epistemic_state_id
```

does not grant access.

Cross-tenant use requires explicit shared/public authorization semantics.

---

# 106. Global/Public Proposition Reuse

A GLOBAL_PUBLIC Proposition may be reusable across authorized contexts only if:

```text
the Proposition itself is accessible
the required Evidence/Assessment state is accessible under data-scope rules
the target scope remains semantically equivalent
```

A public Proposition ID does not automatically expose private evidence supporting it.

Knowledge access and evidence access may differ.

---

# 107. Cache Rules

Allowed caches:

```text
semantic search
proposition candidate lookup
source parsing
evidence extraction
compatibility classification
assessment
epistemic derivation
```

Caches are non-authoritative.

Cache hit MUST verify:

```text
exact input hash
exact revision refs
tenant/data scope
```

Cache loss must not change historical truth.

---

# 108. Observability

Every material stage should emit:

```text
run_id
decision_cycle_id
stage_execution_id
input refs
output refs
pinned revision refs
duration
result class
reason codes
retry count
fencing metadata
```

Sensitive evidence payload should not be duplicated into logs unnecessarily.

Logs are not evidence.

---

# 109. Audit Trace

For one EpistemicStateVersion, an auditor must be able to traverse:

```text
EpistemicStateVersion
↓
assessment_ids
↓
EvidenceAssessment
↓
EvidencePropositionLink
↓
EvidenceItem
↓
origin_id
↓
SourceArtifact or PerformanceObservation
```

and separately:

```text
EpistemicStateVersion
↓
proposition_id
↓
Proposition
```

and:

```text
EpistemicStateVersion
↓
derivation_revision_ref
↓
exact registered revision
```

---

# 110. Historical Replay

Historical replay reads recorded immutable state.

It does not regenerate:

```text
old EvidenceAssessment
old EpistemicStateVersion
```

from current models.

If all required payloads exist:

```text
FULL
```

Otherwise replay degrades according to ReplayabilityStatus.

No CURRENT/LATEST/ACTIVE substitution.

---

# 111. Determinism Boundary

The following must be deterministic or exact-recorded:

```text
reference resolution
link uniqueness
schema validation
hard compatibility exclusions
assessment closure
epistemic closure
chain integrity
unknown-preservation gate
```

Model-assisted judgments may be probabilistic during creation.

Historical truth is the immutable recorded output plus exact configuration lineage.

---

# 112. Change Proposal Boundary

Learning from evidence may produce:

```text
ChangeProposal
```

It may suggest changes to:

```text
Guidance
PromptConfig
EvaluatorConfig
other Control Plane revisions
```

Runtime cannot activate the change.

Only Control Plane creates/activates a new immutable revision.

---

# 113. Security Invariants

SPEC03 must never:

```text
execute source instructions
treat source HTML/prompt text as system instructions
allow source content to alter permissions
accept model-produced IDs without validation
cross tenant scope implicitly
hide unsupported evidence origin
use deleted prohibited payload
allow untrusted text to select privileged tools
```

---

# 114. Data Quality Invariants

Before canonical insertion:

```text
all required fields parse
references resolve
enum values valid
timestamps coherent
origin type matches origin target
scope is explicit
hash/object reference validated where applicable
```

Invalid structured output is rejected or retried.

It is not stored as valid canonical knowledge.

---

# 115. Knowledge Construction Transaction Boundaries

Domain inserts may span multiple durable stages.

Do not require one distributed transaction across:

```text
retrieval
object storage
model inference
database
```

Each canonical commit must satisfy its local invariants.

Cross-store durability follows SPEC01 object-first + relational commit protocols.

---

# 116. Proposition Creation Transaction

```text
BEGIN

acquire semantic-resolution lock
resolve accessible equivalent propositions

IF equivalent:
    return existing proposition_id
ELSE:
    insert Proposition
    register immutable identity
    write outbox event

COMMIT
```

Any model decision used to claim equivalence must be structured and auditable.

---

# 117. Evidence Link Transaction

```text
BEGIN

verify EvidenceItem exists
verify Proposition exists
verify tenant/data access
insert EvidencePropositionLink

ON UNIQUE CONFLICT:
    load existing canonical link

COMMIT
```

---

# 118. Assessment Transaction

```text
BEGIN

verify link closure
verify exact assessment config
validate structured assessment output
insert EvidenceAssessment
write outbox event

COMMIT
```

No link mutation.

---

# 119. Epistemic Derivation Transaction

```text
BEGIN

lock proposition epistemic lineage
resolve predecessor terminal state
validate exact assessment_ids
validate proposition closure
validate compatibility exclusions
validate causal guard
derive structured result
insert successor EpistemicStateVersion
write outbox event

COMMIT
```

Failure before commit:

```text
no partial epistemic state
```

---

# 120. KnowledgeGap Resolution Transaction

ResearchTrace never mutates the prior gap.

When a resolution state is justified:

```text
BEGIN

verify prior gap
verify research/user/assumption basis
create new KnowledgeGap state
set supersedes_gap_id when applicable
write outbox event

COMMIT
```

Research outcome alone cannot bypass the Unknown-Preservation Gate.

---

# 121. Derived Views

Allowed non-authoritative projections include:

```text
current epistemic state by proposition/as-of boundary
open blocking gaps
evidence count by proposition
contradiction dashboard
research coverage dashboard
stale evidence dashboard
proposition semantic-search index
```

They are rebuildable.

They are not snapshot truth.

---

# 122. Query Semantics — Epistemic As-Of

An as-of epistemic query must specify:

```text
proposition_id
known_at
target_valid_time if relevant
```

Resolution returns the exact EpistemicStateVersion whose system-time position is valid at that boundary.

It MUST NOT simply return the row with maximum created_at without proposition-chain and time validation.

---

# 123. Query Semantics — Evidence Basis

For a returned EpistemicStateVersion:

```text
evidence basis
=
exact assessment_ids
→ exact links
→ exact EvidenceItems
```

The UI may summarize.

The API/audit layer must be able to return exact refs.

---

# 124. Query Semantics — Why Unknown?

For:

```text
support_status = UNKNOWN
or
INSUFFICIENT
```

the system should expose structured reason codes derived from:

```text
assessment set
uncertainty
knowledge gaps
coverage limitations
```

It must not generate a fabricated explanation disconnected from canonical state.

---

# 125. Query Semantics — Contradiction

For:

```text
CONFLICTING
or
CONTRADICTED
```

the system should expose both:

```text
supporting assessment refs
contradicting assessment refs
```

where present.

Do not present only one side.

---

# 126. Research Coverage

ResearchTrace coverage is explicit.

Search result count is not coverage proof.

Coverage limitations may include:

```text
paywall
language limitation
jurisdiction limitation
database limitation
time cutoff
source access failure
query budget
rights restriction
```

These limitations can flow into epistemic uncertainty.

---

# 127. Research Retry

Retrying the exact failed retrieval operation uses SPEC01 idempotency.

A materially changed query plan is a new ResearchTrace.

Do not mutate old:

```text
queries
sources_searched
coverage_limitations
outcome
```

---

# 128. Source Deduplication

Content hash equality may identify identical captured bytes.

It does not automatically mean identical source semantics across:

```text
publisher
version
jurisdiction
retrieval context
rights state
```

Dedup may optimize storage.

Canonical SourceArtifact identity must preserve required semantics.

---

# 129. Evidence Deduplication

Two EvidenceItems may have similar text but differ materially in:

```text
origin
locator
valid time
scope
method
limitations
```

Text equality does not force identity.

Evidence dedup is conservative.

False merge is worse than harmless duplicate evidence because false merge destroys provenance.

---

# 130. Proposition Deduplication

Proposition reuse is semantic.

Evidence dedup is provenance-sensitive.

Therefore:

```text
many EvidenceItems
may map to
one Proposition
```

This is expected.

---

# 131. Support Strength vs Wording Strength

Epistemic support must constrain downstream assertion wording.

SPEC03 itself does not write content.

It exposes structured support/uncertainty state.

SPEC05/SPEC06 later enforce wording and validation.

No writer may transform:

```text
PARTIALLY_SUPPORTED
```

into an unqualified factual certainty without passing assertion validation.

---

# 132. Knowledge-Gap Creation Triggers

A KnowledgeGap may be created when the system identifies a missing decision-relevant input such as:

```text
unknown product fact
unknown jurisdiction requirement
unknown audience condition
unknown source authority
unknown causal basis
unknown metric meaning
unknown rights state
```

SPEC03 does not require every uncertainty to become a KnowledgeGap.

Create one when explicit lifecycle tracking is decision-relevant.

---

# 133. Knowledge-Gap Blocking Decision

`blocking` should reflect:

```text
decision relevance
risk_if_wrong
ability to proceed safely under uncertainty
policy/governance requirements
```

It must not be determined by:

```text
whether research is convenient
whether the system wants to generate content anyway
```

---

# 134. Explicit Assumption Rule

An explicit assumption must identify:

```text
what is assumed
why proceeding is permitted
risk if wrong
downstream limitations
```

It cannot silently upgrade:

```text
UNKNOWN
→ SUPPORTED
```

The assumption belongs in Strategy/decision uncertainty as appropriate.

---

# 135. Evidence from User Input

Direct user statements do not automatically become SOURCE_ARTIFACT evidence.

If product requirements later allow user-provided evidence, they require a canonical supported origin contract.

Until then, user answers may resolve a KnowledgeGap as:

```text
RESOLVED_BY_USER
```

without pretending they are independently verified evidence.

---

# 136. Regulatory / Platform Source Rule

REGULATORY_SOURCE and PLATFORM_POLICY evidence may be highly decision-relevant.

But evidence is still separate from:

```text
NormativeRuleRevision
```

A regulatory source can support rule ingestion.

It does not itself become the canonical rule object.

Governance SPEC owns that conversion.

---

# 137. Guidance Boundary

Evidence may support Propositions.

GuidanceRevision may reference supporting Proposition IDs.

Evidence never becomes Guidance directly.

Canonical separation:

```text
Evidence
→ Proposition
→ EpistemicState
→ possible Guidance revision process
```

Runtime cannot activate new Guidance.

---

# 138. Measurement Boundary

PerformanceObservation is an immutable evidence origin.

SPEC07 owns measurement methodology and correction semantics.

SPEC03 consumes:

```text
exact observation_id
metric_revision_id
publication coverage
measurement state
```

and may create performance EvidenceItems.

It does not reinterpret raw platform data outside the observation contract.

---

# 139. Causal Measurement Boundary

Even when a PerformanceObservation comes from a randomized/quasi-experimental workflow, causal support still requires:

```text
correct EvidenceDomain
study_design
causal_identification
scope match
pinned causal derivation policy
```

The word:

```text
experiment
```

is not itself sufficient.

---

# 140. Model Output Boundary

LLM output may propose:

```text
EvidenceItem fields
Proposition candidate fields
compatibility classification
EvidenceAssessment dimensions
```

LLM output is not evidence merely because an LLM produced it.

All canonical outputs require:

```text
schema validation
reference validation
security validation
pinned config lineage
```

---

# 141. Explanation Boundary

Generated explanations are presentation.

Canonical truth remains:

```text
IDs
enums
structured dimensions
reason codes
exact references
immutable records
```

Narrative text may not override canonical state.

---

# 142. Migration Rule

SPEC03 semantic migrations may not mutate historical knowledge meaning in place.

If a future derivation method changes:

```text
old EpistemicStateVersion remains
```

New decisions may derive:

```text
new EpistemicStateVersion
```

under a new exact `derivation_revision_ref`.

No backfill may rewrite historical decision truth without an explicit migration event and preserved prior state.

---

# 143. Version Upgrade Rule

Changing:

```text
extractor
semantic resolver
compatibility logic
assessment logic
epistemic derivation
causal guard
```

requires a new exact configuration revision when behavior can materially change canonical outputs.

Runs pin exact revisions.

No hidden hot-swap.

---

# 144. Regression Corpus

SPEC03 implementation should maintain a fixed corpus covering:

```text
semantic near-duplicates
scope changes
qualifier changes
contradictory evidence
customer anecdote
academic study
regulatory source
performance evidence
attribution-only evidence
causal experiment evidence
stale evidence
cross-jurisdiction evidence
deleted evidence
failed research
no evidence found
blocking gaps
independence duplicates
```

The corpus is test data, not canonical product knowledge.

---

# 145. Fixed Adversarial Test Suite

The following suite is locked for SPEC03 v1.0 audit.

```text
01 source instruction injection
02 unsupported evidence origin type
03 origin_type / origin_id mismatch
04 source snapshot missing
05 source rights use blocked
06 tenant-private source cross-tenant read
07 NO_EVIDENCE_FOUND treated as falsity
08 SEARCH_FAILED closes blocking gap
09 SEARCH_INCOMPLETE closes blocking gap
10 explicit assumption when assumption_allowed=false

11 evidence extractor drops material qualifier
12 evidence extractor upgrades association to causation
13 evidence domain classified as support judgment
14 observational performance used as product fact
15 attribution used as causal proof
16 stale evidence silently treated as fresh
17 population mismatch silently generalized
18 jurisdiction mismatch silently generalized
19 duplicate dependent evidence counted as independent
20 same EvidenceItem assessed three times counted as three independent origins

21 proposition semantic near-duplicate safe reuse
22 proposition material qualifier mismatch false merge
23 proposition causal-vs-associational false merge
24 proposition scope mismatch false merge
25 uncertain proposition equivalence silently merged
26 semantic change mutates old Proposition
27 old Evidence links silently transferred to new Proposition
28 concurrent proposition creation race
29 semantic fingerprint collision forces identity
30 inaccessible cross-tenant Proposition reused

31 duplicate EvidencePropositionLink creation
32 support assessed before Link identity
33 compatibility conflated with relationship
34 INCOMPATIBLE evidence contributes support
35 INCOMPATIBLE evidence contributes contradiction weight
36 UNCERTAIN compatibility promoted to COMPATIBLE
37 DOES_NOT_ADDRESS counted as support
38 COMPATIBLE_WITH_LIMITS loses limitations
39 reassessment mutates prior EvidenceAssessment
40 reassessment supersedes assessment from different link

41 EpistemicState uses assessment for another Proposition
42 EpistemicState implicitly resolves latest assessment
43 superseded assessment double-counted
44 hidden unstored evidence affects derivation
45 material contradiction silently omitted
46 UNKNOWN promoted to SUPPORTED
47 INSUFFICIENT promoted to SUPPORTED
48 conflicting evidence collapsed to certainty
49 derivation config changes without new revision
50 replay recomputes old state using current model

51 causal Proposition gets SUPPORTED from general SUPPORTS relationship alone
52 observational correlation becomes causal SUPPORTED
53 platform attribution becomes causal SUPPORTED
54 causal evidence scope mismatch ignored
55 non-causal Proposition receives causal SUPPORTED instead of NOT_APPLICABLE
56 causal-status requirements change mid-run without pinned revision
57 evidence valid-time outside target silently used
58 valid_until mutated after future event
59 known_from non-monotonic successor
60 EpistemicState successor crosses Proposition

61 two concurrent Epistemic successors branch
62 Epistemic supersession cycle
63 second root for same Proposition
64 historical EpistemicState mutated
65 deletion keeps prohibited payload for replay
66 deletion silently preserves old evidence in future derivation
67 deletion causes fabricated replacement evidence
68 blocking KnowledgeGap disappears after research failure
69 blocking gap enters normal Strategy path unresolved
70 Strategy required Proposition missing decision-time EpistemicState

71 RunKnowledgeDelta mutated continuously
72 knowledge commit accepted after FREEZING
73 stale worker commits EvidenceAssessment after cycle supersession
74 stale worker creates EpistemicState after cancellation
75 historical replay resolves CURRENT/LATEST/ACTIVE
76 runtime Evidence learning directly activates Control Plane change
```

Expected for freeze:

```text
76 / 76
PRESERVE INVARIANTS
```

No extra freeze blocker should be introduced after this suite is locked unless a concrete contradiction against Blueprint v2.13.1, SPEC01 v1.1.3 or SPEC02 v1.0.6 is demonstrated.

---

# 146. Static Contract Preflight

SPEC03 freeze audit must additionally check exactly:

```text
01 no new canonical domain entity invented
02 all canonical enums preserved
03 Evidence origin types limited to V1-supported origins
04 Proposition remains immutable semantic identity
05 EvidencePropositionLink remains unique per pair
06 compatibility and relationship remain separate
07 EvidenceAssessment remains immutable
08 reassessment never mutates old record
09 EpistemicState uses exact assessment IDs
10 support_status vocabulary preserved
11 causal_status closed and causal guard enforced
12 Epistemic chain single-root
13 Epistemic chain non-branching
14 Epistemic chain same-Proposition
15 Epistemic known_from monotonic
16 Epistemic chain acyclic
17 valid time distinct from known time
18 unknown-preservation gate intact
19 research failure not falsity
20 performance evidence firewall intact
21 attribution/causation separation intact
22 RunKnowledgeDelta lifecycle consistent with SPEC01
23 FREEZING boundary consistent with SPEC01
24 deletion/replay consistent with SPEC02
25 tenant/data-scope isolation intact
26 no CURRENT/LATEST/ACTIVE historical substitution
27 Runtime cannot mutate Control Plane
28 no duplicate source of epistemic truth
```

Freeze target:

```text
28 / 28 PASS
```

---

# 147. Acceptance Criteria

SPEC03 is freeze-eligible only if all are true:

```text
1. Every EvidenceItem has a valid immutable origin.

2. Research failure never becomes proposition falsity.

3. EvidenceDomain never substitutes for support judgment.

4. Proposition identity is semantic and immutable.

5. Material semantic change creates a new Proposition.

6. Evidence links are canonical and unique per EvidenceItem/Proposition pair.

7. Compatibility and relationship are separate.

8. Incompatible evidence cannot contribute epistemic weight.

9. Reassessment creates new immutable EvidenceAssessment.

10. EpistemicState references exact assessments for one Proposition only.

11. Contradictory evidence remains representable.

12. Unknown and insufficient remain distinct from contradiction.

13. Causal support cannot arise from association/attribution alone.

14. Performance evidence cannot by itself establish unrelated factual claims.

15. EpistemicState forms one acyclic non-branching system-time chain per Proposition.

16. Valid time and known time remain separate.

17. Historical knowledge is never rewritten.

18. Blocking KnowledgeGaps obey the Unknown-Preservation Gate.

19. Decision-time consumers use exact epistemic_state_ids.

20. New knowledge after FREEZING cannot enter the old cycle.

21. Stale workers cannot commit canonical knowledge.

22. Deletion may degrade replay but cannot justify prohibited retention.

23. Future decisions do not silently rely on deleted/unavailable prohibited evidence.

24. Tenant/data-scope boundaries apply to knowledge reads and writes.

25. Historical replay uses recorded immutable state and exact revisions.

26. Runtime learning may propose but cannot activate Control Plane changes.

27. The 76-test adversarial suite passes at specification level.

28. The 28-check static preflight passes.
```

---

# 147A. v1.0.1 Patch Closure

This patch changes only the two demonstrated v1.0 blockers:

```text
1. Proposition semantic identity resolution is mandatory and concurrency-safe.

2. Non-causal Propositions always use causal_status = NOT_APPLICABLE;
   material causal subclaims require a CAUSAL Proposition.
```

The locked audit suite remains exactly:

```text
76 adversarial tests
28 static preflight checks
```

No new freeze criterion is introduced by v1.0.1.

---

# 148. Verification Record — Final Freeze

SPEC03 v1.0.1 passed the locked audit suite:

```text
STATUS
FROZEN

FIXED ADVERSARIAL SUITE
76 / 76 PASS

STATIC PREFLIGHT
28 / 28 PASS

BLOCKERS
0

PARTIALS
0

FROZEN?
YES
```

A later SPEC03 audit may change only demonstrated blockers.

Do not perform open-ended architecture expansion after the fixed suite is accepted.

---

# 149. Canonical Implementation Flow

```text
TASK / DECISION CYCLE
↓
PROVISIONAL AUDIENCE
↓
KNOWLEDGE GAPS
↓
RESEARCH TRACE
↓
SAFE ORIGIN INGESTION
↓
EVIDENCE EXTRACTION
↓
PROPOSITION RESOLUTION
↓
EVIDENCE–PROPOSITION LINK
↓
COMPATIBILITY
↓
EVIDENCE ASSESSMENT
↓
EPISTEMIC DERIVATION
↓
UNKNOWN-PRESERVATION GATE
↓
REFINE AUDIENCE
↓
GOVERNANCE REFRESH IF DEPENDENCIES CHANGED
↓
STRATEGY GATE
```

---

# 150. Canonical Historical Audit Flow

```text
DecisionSnapshot
↓
BaselineKnowledgeSnapshot
+
RunKnowledgeDelta
↓
EpistemicStateVersion
↓
EvidenceAssessment
↓
EvidencePropositionLink
↓
EvidenceItem
↓
SourceArtifact / PerformanceObservation
```

Exact revisions:

```text
RunConfig
derivation_revision_ref
retrieval_revision_ref
evaluator/config refs
```

remain resolvable or replayability degrades explicitly.

---

# 151. Final Doctrine

```text
EVIDENCE
DOES NOT OWN TRUTH.

PROPOSITION
OWNS MEANING.

EPISTEMIC STATE
OWNS WHAT CONTENTOS
CURRENTLY KNOWS
AT AN EXPLICIT BOUNDARY.

COMPATIBILITY
IS ADMISSIBILITY,
NOT SUPPORT.

SUPPORT
IS NOT CAUSATION.

PERFORMANCE
IS NOT FACTUAL PROOF.

RESEARCH FAILURE
IS NOT FALSITY.

UNKNOWN
IS A VALID STATE.

SEMANTIC CHANGE
CREATES A NEW PROPOSITION.

KNOWLEDGE CHANGE
CREATES A NEW EPISTEMIC STATE.

OLD HISTORY
IS NEVER REWRITTEN.

EXACT INPUTS.
EXACT REFERENCES.
EXACT DERIVATION REVISION.
EXPLICIT UNCERTAINTY.

TEST THE FIXED SUITE.

THEN FREEZE.
```

---

**End of ContentOS SPEC 03 — Evidence / Proposition / Epistemic State v1.0.1 — FROZEN**
