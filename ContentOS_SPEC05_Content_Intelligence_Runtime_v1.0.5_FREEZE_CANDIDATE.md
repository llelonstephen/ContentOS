# ContentOS SPEC 05 — Content Intelligence Runtime
## Audience, Strategy, Architecture & Candidate Generation Runtime
### Version 1.0.5 — Two-Phase Hash Closure — FREEZE_CANDIDATE

---

# 0. Status

```text
SPEC
SPEC 05 — CONTENT INTELLIGENCE RUNTIME

VERSION
1.0.5

SOURCE OF TRUTH
ContentOS Blueprint v2.13.1 — FROZEN
ContentOS SPEC 01 v1.1.3 — FROZEN
ContentOS SPEC 02 v1.0.6 — FROZEN
ContentOS SPEC 03 v1.0.1 — FROZEN
ContentOS SPEC 04 v1.0.2 — FROZEN

STATUS
FREEZE CANDIDATE
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
>
SPEC05
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
```

PATCH BASE
ContentOS SPEC 05 v1.0.4 — FROZEN
SHA256 25c5c0ec1513c77c72773cf25b32ac085f3bb1412165a02d1dfb9619efd36c95

PATCH TARGET
Demonstrated v1.0.4 temporal circular dependency —
pre-provider canonical_input_hash vs post-provider generated-leaf admission identity

SPEC05 defines runtime behavior.

---

# 1. Purpose

SPEC05 defines the content-intelligence runtime that transforms a frozen decision context into grounded content candidates.

Canonical scope:

```text
TaskContractRevision
↓
AudienceState
↓
StrategyHypothesis
↓
Deterministic Strategy Gate
↓
ContentArchitecture
↓
ContentUnit
↓
ContentCandidate
```

SPEC05 defines:

```text
audience-state derivation
audience refinement
audience factual-basis admission
audience uncertainty preservation
final-audience admission
strategy generation
strategy grounding
strategy-gate behavior
architecture generation
content-unit contracts
candidate generation
candidate rewrite semantics
RunConfig binding
prompt/model/tool pinning usage
context construction
generation-context minimization
grounding preservation
assumption propagation
governance propagation
uncertainty propagation
idempotency
concurrency
failure handling
stale-worker protection
auditability
handoff to SPEC06 evaluation
```

---

# 2. Non-Goals

SPEC05 does not own:

```text
EvidenceAssessment derivation
EpistemicState derivation
governance applicability semantics
policy execution
rights/license interpretation
AssertionValidationResult semantics
CompositeImpressionAssessment semantics
QualitativeEvaluation rubrics
risk scoring methodology
final release decision
publication execution
measurement
learning
```

Those belong to other frozen or later SPECs.

In particular:

```text
SPEC05 CREATES CONTENT.

SPEC06 EVALUATES CONTENT.
```

SPEC05 may prepare assertion-extraction input.

It does not decide whether a generated content claim is supported enough for release.

Audience factual-basis enforcement in v1.0.3 does not replace SPEC03 epistemic derivation. SPEC05 consumes exact canonical knowledge state produced upstream.

---

# 3. Content Runtime Doctrine

```text
UPSTREAM DECIDES WHAT.

WRITER DECIDES
HOW TO EXPRESS IT.

AUDIENCE STATE
IS EXPLICIT.

CONFIDENT AUDIENCE FACTS
REQUIRE ATTRIBUTABLE
CANONICAL BASIS.

STRATEGY
IS EXPLICIT.

ARCHITECTURE
IS EXPLICIT.

CANDIDATE
IS IMMUTABLE.

REWRITE
CREATES A NEW CANDIDATE.

MODEL OUTPUT
IS NOT TRUTH.

MODEL OUTPUT
IS NOT EVIDENCE.

GENERATION MAY BE CREATIVE.

DECISION INPUTS
MUST NOT BE INVENTED.

UNKNOWN
MUST REMAIN UNKNOWN
UNTIL CANONICAL BASIS
RESOLVES IT.

ASSUMPTIONS
MUST REMAIN EXPLICIT.

GOVERNANCE LIMITS
MUST SURVIVE GENERATION.

RUN CONFIG
IS PINNED.

NO LATEST LOOKUPS.

NO HIDDEN CONTEXT.

NO STALE-WORKER COMMITS.
```

---

# 4. Canonical Runtime Graph

```text
TaskContractRevision
+
BaselineKnowledgeSnapshot
+
RunKnowledgeDelta
+
FINAL_FOR_DECISION AudienceState
+
PRE_GENERATION_FINAL ApplicabilityAssessments
+
GovernanceSnapshot
+
RunConfig
↓
StrategyHypothesis
↓
STRATEGY GATE
↓
ContentArchitecture
↓
ContentUnit[]
↓
ContentCandidate[]
↓
SPEC06:
Assertion extraction / mapping / validation /
composite assessment / qualitative evaluation
```

---

# 5. Canonical Entities Used by SPEC05

SPEC05 uses the frozen contracts:

```text
TaskContractRevision
ContentProgramRevision
OutcomeModel
ChannelProfileRevision

AudienceState
KnowledgeGap
ResearchTrace
Proposition
EpistemicStateVersion

GuidanceRevision
NormativeRuleRevision
ApplicabilityAssessment
GovernanceSnapshot

StrategyHypothesis
ContentArchitecture
ContentUnit
ContentCandidate

RunConfig
DecisionCycle
StageExecution
DecisionSnapshot
```

SPEC05 introduces no new canonical domain entity.

v1.0.2 introduced one normalized supporting enforcement relation:

```text
AudienceFactBasisLink
```

a structured payload shape inside the already-existing:

```text
AudienceState.uncertainty
```

and one derived non-authoritative semantic-resolution input:

```text
AudienceFactClaim
```

v1.0.3 additionally defines one logical configuration contract:

```text
AudienceSemanticProjectionSchema
```

`AudienceSemanticProjectionSchema` is NOT a new canonical entity. It is a required section of an existing immutable `SchemaDefinition` payload revision pinned through the existing RunConfig/schema-revision mechanism.

v1.0.4 additionally introduces one normalized supporting role-assignment relation:

```text
RunConfigSchemaRoleBinding
```

`RunConfigSchemaRoleBinding` has no independent canonical entity identity and is not registered as a new domain/config entity. Its relational identity is the composite `(run_config_id, role)`. It may reference only an existing normalized member of `RunConfig.schema_revision_refs`; it owns role assignment, not schema membership.

These structures do not own epistemic truth.

`AudienceFactBasisLink` does not replace AudienceState, create AudienceState supersession, create a current/latest pointer, derive EpistemicState, replace Proposition, or replace EvidenceAssessment.

`AudienceFactClaim` is transient derived input to the existing SPEC03 semantic resolver. It is not persisted as an alternative Proposition and has no independent truth authority.

`AudienceSemanticProjectionSchema` owns only the deterministic translation from a SPEC05 Audience factual leaf representation into the already-frozen SPEC03 `PropositionSemanticIdentity` representation. It does not decide semantic equivalence and does not create Proposition truth.

`RunConfigSchemaRoleBinding` owns only the deterministic role assignment from one RunConfig to one already-pinned SchemaDefinition revision for `CONTENT_INTELLIGENCE_AUDIENCE`. It cannot introduce an unpinned revision and does not replace `RunConfig.schema_revision_refs` as membership truth.

These structures exist only to make AudienceState factual-basis admission and its runtime configuration mechanically auditable and enforceable.

---

# 6. Strategy Gate Is Not a New Entity

In the authoritative Blueprint v2.13.1 `.md`:

```text
Strategy Gate
=
deterministic validation process
```

It is not a canonical domain entity.

SPEC05 therefore does NOT create:

```text
StrategyGateResult
```

as a new canonical object.

Strategy-gate outcome is represented through deterministic stage outcome / reason codes and the presence or absence of admitted downstream architecture generation.

---

# 7. AudienceState Contract

Frozen schema:

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

AudienceState is immutable.

---

# 8. AudienceState Meaning

AudienceState is not a demographic blob.

It is the runtime's explicit representation of:

```text
what the audience currently understands
what problem they perceive
what solution state they occupy
what they know about the product
what they know about the brand
what intent they have
what outcome they want
what objections exist
what criteria influence decision
what prior exposure matters
```

All material uncertainty stays explicit.

---

# 9. AudienceState Origin

`origin` is the frozen AudienceState origin enum/value and remains a coarse derivation-classification field.

Possible derivation inputs include:

```text
Task.audience_context
authorized user input represented through an allowed canonical upstream path
EvidenceItems
Propositions
EpistemicStateVersions
ResearchTrace results
historical public/tenant knowledge
```

The runtime must not invent hidden research and then summarize it as `origin`.

For v1.0.2 admissions:

```text
origin alone
IS NOT
sufficient authority
for a confident factual audience value.
```

The runtime must not infer fact-level support from an origin label.

Raw model text is not proof.
Raw EvidenceItem existence is not by itself proof of an audience Proposition.
Raw ResearchTrace existence is not by itself proof of an audience Proposition.

Where factual certainty depends on researched knowledge, the authoritative factual basis must already have entered the canonical Proposition / EpistemicState path.

An authorized user resolving a KnowledgeGap with `RESOLVED_BY_USER` does not automatically create factual proof. If that user-supplied information is to appear as a confident factual AudienceState value, it must be represented through an eligible typed factual-basis path defined by this SPEC. Otherwise the uncertainty may be operationally resolved for gap workflow purposes while the audience fact remains qualified/uncertain.

---

# 10. AudienceState Uncertainty

`uncertainty` must preserve unknowns such as:

```text
uncertain intent
uncertain prior exposure
uncertain objection prevalence
uncertain product awareness
uncertain problem awareness
uncertain decision criteria
population mismatch
sparse evidence
```

Uncertainty is not decorative prose.

It affects Strategy Gate and downstream risk/evaluation.

For AudienceStates newly admitted under v1.0.3, an uncertainty item relied upon for factual-leaf coverage MUST be machine-readable while remaining inside the frozen top-level `AudienceState.uncertainty` field.

The current implementation-compatible logical item shape is:

```text
AudienceUncertaintyItem

kind: string
description: string
blocking?: boolean

audience_field: AudienceFactualField
fact_path: CanonicalAudienceFactPath
status: UNRESOLVED
```

This v1.0.3 shape supersedes the v1.0.2 illustrative `uncertainty_kind` name for coverage purposes and preserves the existing `kind`, `description`, and optional `blocking` members.

No new top-level AudienceState field is introduced.

`audience_field` identifies one factual-state surface.

`fact_path` uses the deterministic canonical path encoding defined by the exact pinned audience `SchemaDefinition` revision.

Required coverage status is:

```text
UNRESOLVED
```

Free text may explain uncertainty through `description`.

Free text alone may not satisfy factual-state coverage.

A coverage item is valid only when:

```text
audience_field is a defined factual-state surface
fact_path is syntactically valid under the pinned schema
fact_path identifies the intended leaf location or schema-defined unresolved location
status = UNRESOLVED
```

Legacy/non-coverage uncertainty entries may remain representable, but they do not satisfy §10F unless they carry the exact path-bound coverage fields above.

---

# 10A. Audience Factual-State Fields

For v1.0.3 factual-basis enforcement, these AudienceState fields are factual-state surfaces:

```text
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
```

`context` may contain structural/task context.

It must not be abused to hide audience factual assertions that would otherwise require factual-basis or uncertainty coverage.

For `FINAL_FOR_DECISION` admission, coverage is deterministic and does not depend on a caller/provider judgment of "materiality".

The exact pinned audience payload/schema revision MUST define the canonical traversal/serialization rules and MAY classify paths as:

```text
STRUCTURAL_NON_FACTUAL
```

Only paths classified by the exact pinned schema revision as structural/non-factual are exempt from factual-basis coverage.

For every other populated scalar leaf reachable under the factual-state surfaces:

```text
DEFAULT CLASSIFICATION
=
FACTUAL_ASSERTION
```

unless the exact pinned schema revision explicitly defines a different non-confident/uncertainty representation.

Arrays and objects are traversed deterministically to scalar leaves using the pinned path rules.

A provider/model may not classify its own output as structural/non-factual.

A caller may not exempt a path ad hoc.

---

# 10B. AudienceFactBasisLink

`AudienceFactBasisLink` is normalized supporting enforcement infrastructure.

It carries the standard SPEC02 ownership envelope:

```text
tenant_id
workspace_id?
```

Logical contract:

```text
AudienceFactBasisLink

audience_state_id

audience_field
fact_path
fact_value_hash

basis_kind

task_id?
task_revision_id?
task_audience_context_path?
task_audience_context_value_hash?

proposition_id?
epistemic_state_id?

ordinal
```

`basis_kind` is the closed V1 vocabulary:

```text
TASK_AUDIENCE_CONTEXT
AUDIENCE_EPISTEMIC_STATE
```

Exactly one typed basis branch MUST be populated.

For:

```text
basis_kind = TASK_AUDIENCE_CONTEXT
```

required:

```text
task_id
task_revision_id
task_audience_context_path
task_audience_context_value_hash
```

and prohibited:

```text
proposition_id
epistemic_state_id
```

The Task reference is a typed exact `RevisionRef<TaskContractRevision>` and MUST resolve as:

```text
(entity_type = TaskContractRevision, task_id, task_revision_id)
```

through the frozen revision infrastructure.

For:

```text
basis_kind = AUDIENCE_EPISTEMIC_STATE
```

required:

```text
proposition_id
epistemic_state_id
```

and prohibited:

```text
task_id
task_revision_id
task_audience_context_path
task_audience_context_value_hash
```

`proposition_id` and `epistemic_state_id` are typed immutable references.

Required closure:

```text
EpistemicStateVersion.epistemic_state_id
=
AudienceFactBasisLink.epistemic_state_id

EpistemicStateVersion.proposition_id
=
AudienceFactBasisLink.proposition_id
```

The relation binds:

```text
exact AudienceState
+
exact factual location
+
exact stored factual value
+
exact typed canonical basis
```

`fact_value_hash` is computed over deterministic canonical serialization of the exact value at the declared:

```text
audience_field + fact_path
```

using the exact pinned audience payload/schema serialization revision.

A link whose path cannot resolve is invalid.

A link whose value hash does not match is invalid.

A valid canonical reference cannot authorize a different factual value merely because the referenced object itself is legitimate.

Required uniqueness MUST prevent ambiguous duplicate links for the same exact:

```text
audience_state_id
audience_field
fact_path
basis branch identity
```

while permitting multiple independent eligible bases when intentionally supplied.

All normalized owner/target references receive the relational FK/index protections required by SPEC02.

---

# 10C. Eligible Confidence Basis

A confident factual audience leaf may use only one of these sufficient V1 basis classes:

```text
TASK_AUDIENCE_CONTEXT
AUDIENCE_EPISTEMIC_STATE
```

Other derivation inputs may influence synthesis and may appear in the stage manifest/origin.

They are not independently sufficient to convert an unknown into unqualified confident factual audience truth.

## TASK_AUDIENCE_CONTEXT

The factual value is directly represented in the exact pinned:

```text
TaskContractRevision.audience_context
```

Required:

```text
typed TaskContractRevision ref is exact
task_audience_context_path resolves deterministically
task_audience_context_value_hash matches the exact canonical value
```

For direct Task-context basis:

```text
fact_value_hash
=
task_audience_context_value_hash
```

unless an explicitly pinned deterministic normalization schema defines a semantics-preserving representation transform.

A model-created inference from Task audience context is not automatically equivalent to direct Task context.

An authorized user input is sufficient through this branch only when that input has already been captured in the exact TaskContractRevision audience context or another future upstream frozen contract explicitly authorizes an equivalent typed path.

## AUDIENCE_EPISTEMIC_STATE

The factual certainty comes from exact decision-time canonical epistemic state.

Required:

```text
typed proposition_id exists
typed epistemic_state_id exists

EpistemicStateVersion.proposition_id
=
proposition_id

Proposition.proposition_type
=
AUDIENCE
```

The EpistemicStateVersion must be selected against the exact stage-local audience knowledge cutoff defined in §10D.

For unqualified confident audience truth:

```text
support_status = SUPPORTED
```

`PARTIALLY_SUPPORTED`, `CONFLICTING`, `UNKNOWN`, and `INSUFFICIENT` may inform audience synthesis only while the relevant limitation/uncertainty remains explicit.

`CONTRADICTED` cannot support the factual assertion.

SPEC05 does not re-derive support.

It consumes SPEC03's exact immutable Proposition and EpistemicStateVersion.

---

# 10D. Exact Derivation Manifest and Audience Knowledge Cutoff

Before audience provider/model invocation, the trusted runtime MUST establish one coherent audience-derivation read boundary.

Canonical pattern:

```text
claim valid StageExecution
↓
open coherent read boundary
(REPEATABLE READ or stronger equivalent where applicable)
↓
trusted runtime captures:
audience_knowledge_cutoff_time
↓
resolve exact eligible audience inputs as-of that boundary
↓
construct PRE_PROVIDER_MANIFEST_CORE
↓
compute StageExecution.canonical_input_hash
over the core only
↓
seal PRE_PROVIDER_MANIFEST_ENVELOPE
with the computed hash
↓
provider/model invocation
```

`audience_knowledge_cutoff_time` is stage-local immutable operational/audit metadata.

It is NOT:

```text
supplied by the provider
chosen by the caller
taken from mutable CURRENT/LATEST state
backfilled from future DecisionSnapshot.frozen_at
```

The provider/caller may echo/assert the cutoff only for equality checking.

It may never widen it.

At minimum the exact derivation manifest records:

```text
TaskContractRevision
eligible Task.audience_context paths
eligible AUDIENCE Proposition refs
exact EpistemicStateVersion refs resolved against:
    exact proposition_id
    audience_knowledge_cutoff_time
    applicable valid-time target
final KnowledgeGap refs
ResearchTrace refs when used
ChannelProfileRevision
Program context when used
governance context when used
RunConfig
audience_knowledge_cutoff_time
tenant/workspace
canonical_input_hash
```

Every EpistemicStateVersion admitted to the manifest MUST satisfy the frozen SPEC03 decision-time selection semantics and:

```text
known_from
<=
audience_knowledge_cutoff_time
```

plus applicable valid-time/scope requirements.

The provider may reference only basis identities present in this exact manifest.

The provider may not invent Proposition IDs, EpistemicStateVersion IDs, Task revisions, Task paths, or basis refs outside the manifest and have them accepted as authority.

At canonical commit, the runtime MUST verify the same StageExecution/cycle authority and the exact recorded cutoff/manifest identity used before provider invocation.

At later snapshot freeze:

```text
audience_knowledge_cutoff_time
<=
DecisionSnapshot.frozen_at
```

must hold under SPEC01 snapshot closure.

The manifest is:

```text
NON-AUTHORITATIVE
RECONSTRUCTABLE
DERIVED FROM CANONICAL INPUT
```

It does not duplicate epistemic truth.

---

# 10E. Audience Fact Semantic Closure

A valid `AUDIENCE_EPISTEMIC_STATE` reference is not sufficient merely because the referenced Proposition is of type `AUDIENCE`.

The audience factual leaf and the linked Proposition MUST have equivalent frozen SPEC03 semantic identity.

For every factual leaf attempting to use:

```text
AUDIENCE_EPISTEMIC_STATE
```

the trusted runtime MUST execute this exact chain:

```text
exact audience factual leaf
+
exact pinned AudienceSemanticProjectionSchema rule
↓
derived non-authoritative AudienceFactClaim
↓
complete SPEC03 PropositionSemanticIdentity
↓
existing SPEC03 evaluateSemanticEquivalence(...)
↓
REUSE_EXISTING / CREATE_NEW / REVIEW_REQUIRED
```

The projection step is owned by SPEC05 representation/configuration semantics.

The equivalence decision remains owned by the unchanged SPEC03 resolver.

The projection MUST NOT be supplied by the provider or caller.

The resolution is against the exact `proposition_id` referenced by the `AudienceFactBasisLink`.

Permitted confident-fact outcome:

```text
REUSE_EXISTING
```

where the semantically compared existing Proposition is exactly:

```text
AudienceFactBasisLink.proposition_id
```

The following do NOT authorize confident admission:

```text
no matching projection rule
multiple matching projection rules
projection input missing
projection output incomplete
projection_type != AUDIENCE
CREATE_NEW
REVIEW_REQUIRED
material qualifier mismatch
population mismatch
jurisdiction mismatch
subject/predicate/object mismatch
canonical-meaning mismatch
```

If the existing SPEC03 resolver does not return `REUSE_EXISTING` for the exact linked Proposition:

```text
preserve uncertainty
or
fail closed / route to review
```

If the projected identity represents meaning for which a new Proposition would be required, that meaning must first enter the normal upstream SPEC03 Proposition/evidence/assessment/EpistemicState path before a later AudienceState may rely on it as confident truth.

SPEC05 MUST NOT create a Proposition or EpistemicState inside Audience admission merely to make projection succeed.

Canonical admission independently verifies:

```text
typed basis branch is valid
basis identity existed in exact derivation manifest
scope is authorized
audience knowledge cutoff is exact
fact path resolves
fact hash matches
exact projection schema revision is pinned
exactly one projection rule matches when EPISTEMIC basis is used
projection output is a complete PropositionSemanticIdentity

TASK_AUDIENCE_CONTEXT:
    direct value / permitted deterministic normalization closure

AUDIENCE_EPISTEMIC_STATE:
    PropositionType = AUDIENCE
    exact EpistemicStateVersion closure
    support-status rule
    existing SPEC03 evaluateSemanticEquivalence is invoked
    outcome = REUSE_EXISTING
    compared proposition_id = linked proposition_id
```

An `AudienceFactBasisLink` proves provenance/admission eligibility.

It does not create or modify Proposition, EvidenceAssessment, or EpistemicStateVersion.

---

# 10F. Fact Coverage Rule

For a v1.0.3 `FINAL_FOR_DECISION` AudienceState to enter a normal release decision path, every factual leaf under the factual-state surfaces MUST be deterministically covered.

For each populated scalar leaf not exempted as `STRUCTURAL_NON_FACTUAL` by the exact pinned audience payload/schema revision, require exactly one of:

```text
one or more eligible AudienceFactBasisLink rows
```

or:

```text
an explicit AudienceUncertaintyItem
covering that exact audience_field + fact_path
```

Therefore:

```text
NO ELIGIBLE BASIS
+
NO EXPLICIT UNCERTAINTY
=
NO CONFIDENT CANONICAL AUDIENCE FACT
```

There is no provider/caller-controlled "materiality" escape hatch.

If the runtime cannot mechanically classify, traverse, semantically bind, or support a factual leaf:

```text
preserve uncertainty
or
fail admission
```

It must not guess.

---

# 10G. AudienceSemanticProjectionSchema

`AudienceSemanticProjectionSchema` is a logical contract carried inside the exact immutable `SchemaDefinition` revision already pinned for the M4 content-intelligence run.

V1 implementation binding:

```text
RunConfig
+
RunConfigSchemaRoleBinding(
    role = CONTENT_INTELLIGENCE_AUDIENCE
)
+
exact relational membership in
RunConfig.schema_revision_refs
↓
exact immutable SchemaDefinition revision
↓
audience traversal/classification rules
+
audience uncertainty-coverage schema
+
audience semantic-projection rules
```

`RunConfigSchemaRoleBinding` is normalized supporting enforcement infrastructure, not a new canonical domain/config entity.

It does not add a RunConfig top-level field and MUST NOT hide the selected canonical SchemaDefinition reference inside `RunConfig.runtime_parameters`.

The exact pinned schema revision MUST own all of the following together for Audience admission:

```text
canonical object/array traversal
canonical fact-path encoding
scalar canonical serialization / hashing
STRUCTURAL_NON_FACTUAL exemptions
path-bound uncertainty coverage shape
Audience factual-leaf semantic projection rules
```

A semantic projection rule has the logical shape:

```text
AudienceSemanticProjectionRule

rule_id

audience_field
fact_path_selector

classification = FACTUAL_ASSERTION

proposition_type = AUDIENCE

canonical_meaning_template
subject_template
predicate_template
object_template
qualifiers_template
conditions_template
population_scope_template
jurisdiction_scope_template

required_input_refs[]
```

`proposition_type` is fixed by contract:

```text
AUDIENCE
```

It is not caller/provider configurable.

Every selected rule MUST deterministically produce all nine required frozen SPEC03 identity fields:

```text
propositionType
canonicalMeaning
subject
predicate
object
qualifiers
conditions
populationScope
jurisdictionScope
```

The string templates are declarative configuration, not executable code and not model prompts.

Allowed projection inputs are restricted to exact already-authorized values:

```text
CONST("...")
FACT_VALUE_CANONICAL
AUDIENCE_FIELD
FACT_PATH
TASK_MARKET
TASK_JURISDICTION
TASK_AUDIENCE_CONTEXT(<exact canonical path>)
```

A SchemaDefinition revision MAY define equivalent names for these operands, but it MUST NOT expand authority beyond these classes without a later explicit SPEC revision.

Template rendering may perform only deterministic literal concatenation/interpolation over those operands using pinned canonical serialization.

V1 projection rules MUST NOT contain:

```text
arbitrary executable code
model calls
current/latest lookups
hidden memory
provider-authored semantic fields
caller-authored semantic fields
unlogged external data
conditional semantic inference not represented by the rule itself
```

If a required input is absent:

```text
PROJECTION FAILS CLOSED
```

The schema validator MUST reject ambiguous projection authority.

For an `AUDIENCE_EPISTEMIC_STATE`-backed leaf, rule selection MUST yield exactly one matching semantic projection rule.

V1 selector grammar is deterministic:

```text
root = exact audience_field
path segments = exact object-key segments or single array-element wildcard [*]
no recursive wildcard
no regex
no provider-defined selector
```

A valid SchemaDefinition revision MUST NOT contain overlapping selectors that can both match the same factual leaf.

Therefore:

```text
0 matching rules  -> fail closed / preserve uncertainty
1 matching rule   -> project
2+ matching rules -> invalid schema / fail closed
```

A `TASK_AUDIENCE_CONTEXT` direct basis does not require Proposition semantic projection because its authority is exact Task revision + exact path/value closure under §10C.

---

# 10H. SPEC03 Resolver Ownership and Runtime Identity

SPEC03 remains the sole owner of Proposition semantic identity comparison.

The current frozen implementation authority used by SPEC05 is the existing deterministic:

```text
evaluateSemanticEquivalence(
  a: PropositionSemanticIdentity,
  b: PropositionSemanticIdentity
)
```

SPEC05 MUST reuse that resolver.

SPEC05 MUST NOT implement a second semantic-equivalence algorithm or an Audience-specific substitute.

The current repository does not expose a separate runtime-configurable semantic-resolver revision.

Therefore v1.0.3 supersedes any v1.0.2 wording that required a fabricated:

```text
semantic resolver/config revision
```

The pinned decision input is instead:

```text
exact AudienceSemanticProjectionSchema / SchemaDefinition revision
+
exact linked Proposition identity
+
existing SPEC03 resolver behavior supplied by the running application code lineage
```

RunConfig/schema pinning MUST pin the projection schema revision.

Implementation/build provenance MAY record the executable code revision through existing deployment/audit mechanisms, but SPEC05 does not invent a new canonical resolver-version entity or fake resolver config solely for AV05.

Provider output may not select, replace, parameterize, or claim the outcome of the SPEC03 resolver.

---

# 10I. Canonical Audience Schema Role Binding

`RunConfig.schema_revision_refs` is a normalized `RevisionRefSet` and may legitimately contain multiple `SchemaDefinition` revisions for different runtime roles.

SPEC05 therefore defines one normalized supporting relation:

```text
RunConfigSchemaRoleBinding

run_config_id
role
schema_entity_type
schema_stable_id
schema_revision_id
```

Closed V1 role vocabulary for this SPEC:

```text
CONTENT_INTELLIGENCE_AUDIENCE
```

Required relational contract:

```text
PRIMARY KEY(run_config_id, role)

FK(run_config_id)
→ RunConfig.run_config_id

FK(
  run_config_id,
  schema_entity_type,
  schema_stable_id,
  schema_revision_id
)
→ exact normalized RunConfig.schema_revision_refs membership row

CHECK(schema_entity_type = SchemaDefinition)
```

For every RunConfig used by normal SPEC05 audience derivation there MUST be exactly one row where:

```text
role = CONTENT_INTELLIGENCE_AUDIENCE
```

The binding row does not own a second copy of schema membership truth.

Canonical meaning is split without duplication:

```text
RunConfig.schema_revision_refs
= which schema revisions are pinned by this RunConfig

RunConfigSchemaRoleBinding
= which already-pinned schema revision owns the Audience runtime role
```

The exact foreign-key/membership closure means the role binding can never point to an unpinned SchemaDefinition revision.

The referenced registered SchemaDefinition revision MUST also satisfy the frozen Control Plane revision contract, including exact immutable payload binding and tenant/workspace ownership where applicable.

A RunConfig is invalid for normal SPEC05 audience derivation if any of the following holds:

```text
zero CONTENT_INTELLIGENCE_AUDIENCE bindings
multiple CONTENT_INTELLIGENCE_AUDIENCE bindings
binding entity_type != SchemaDefinition
binding target is not an exact RunConfig.schema_revision_refs member
binding target does not resolve to an immutable registered SchemaDefinition revision
binding target violates authorized tenant/workspace scope
binding payload is unavailable or payload-hash binding is invalid
```

Selection authority is closed as follows:

```text
NO lookup by CURRENT/LATEST/ACTIVE
NO application-local default schema
NO "first SchemaDefinition in set" rule
NO selection by iteration order
NO ad-hoc payload-content discovery to choose the role owner
NO provider/caller-selected role binding
NO environment-variable override
NO fallback to another RunConfig.schema_revision_refs member
NO hidden canonical SchemaDefinition ID/ref inside runtime_parameters
```

`RunConfigSchemaRoleBinding` is immutable supporting RunConfig state.

Canonical RunConfig creation MUST persist the RunConfig, its normalized `schema_revision_refs` membership, and all required schema-role bindings as one complete configuration unit before that `run_config_id` is usable by a Run. A later INSERT/UPDATE/DELETE of a role binding for the same committed `run_config_id` is forbidden because it would change runtime meaning without changing immutable RunConfig identity.

Historical replay MUST load the same exact role-binding tuple by `run_config_id`; it may not re-resolve the role through CURRENT/LATEST/ACTIVE state or application defaults.

A runtime stage may resolve and verify the binding; runtime/provider/caller code may not create, replace, or widen it to make an Audience admission succeed.

Before provider invocation the trusted runtime MUST:

```text
read exact immutable RunConfig
↓
resolve exactly one CONTENT_INTELLIGENCE_AUDIENCE RunConfigSchemaRoleBinding
↓
verify exact FK/membership in RunConfig.schema_revision_refs
↓
resolve exact registered SchemaDefinition revision + payload binding
↓
validate Audience traversal / uncertainty / semantic-projection sections
```

At canonical commit the runtime MUST re-verify the same exact role-binding tuple and resolved SchemaDefinition revision/payload identity used before provider invocation.

If a different Audience schema revision is required, a later RunConfig / binding set must be created through trusted Control Plane configuration; existing historical binding state is not mutated.

---

# 11. PROVISIONAL AudienceState

PROVISIONAL audience state may be created before research closure.

It is allowed to contain:

```text
hypotheses
explicit uncertainty
unresolved gaps
```

It is not sufficient for normal release strategy generation.

---

# 12. REFINED AudienceState

REFINED audience state incorporates available research/knowledge updates.

It may still contain:

```text
non-blocking unknowns
explicit assumptions
material uncertainty
```

It is not automatically the final audience state.

---

# 13. FINAL_FOR_DECISION AudienceState

Normal release strategy generation requires:

```text
state_stage = FINAL_FOR_DECISION
```

and:

```text
AudienceState.task_revision_id
=
current TaskContractRevision.task_revision_id
```

A FINAL_FOR_DECISION state must reflect all decision-relevant knowledge available at the applicable decision boundary.

For v1.0.2 normal release paths it must additionally satisfy:

```text
Audience factual-basis coverage
+
explicit unresolved uncertainty coverage
```

FINAL_FOR_DECISION does not mean everything is known.

It means:

```text
known facts are attributable
unknown material facts remain explicit
```

---

# 14. Audience Finalization Is Append-Only

Audience refinement never mutates an earlier AudienceState.

Canonical evolution:

```text
A1 PROVISIONAL
↓
A2 REFINED
↓
A3 FINAL_FOR_DECISION
```

These are separate immutable objects.

The schema does not define an AudienceState supersession edge.

Therefore SPEC05 does not invent one.

The DecisionSnapshot pins the exact final `audience_state_id`.

---

# 15. Multiple Audience States

Multiple AudienceStates may exist for one Task.

Only one exact state is selected into a given DecisionSnapshot.

Normal release requires the selected state to be:

```text
FINAL_FOR_DECISION
```

SPEC05 does not create a mutable "current audience" pointer.

---

# 16. Audience Derivation Inputs

Audience derivation may use:

```text
TaskContractRevision
Program context when present
ChannelProfileRevision
market
jurisdiction
language
format
audience_context
knowledge graph
final KnowledgeGap states
ResearchTrace results
EpistemicStateVersions
governance context where it changes audience interpretation
```

It may not use:

```text
unlogged model memory
private operator assumptions
undeclared live web state
future knowledge
```

---

# 17. Audience Derivation Boundary

Model-assisted audience synthesis is allowed.

Canonical admission requires:

```text
structured output
schema validation
task binding
origin trace
structured uncertainty preservation
factual-basis coverage
exact derivation manifest
pinned model/prompt config
```

A plausible audience narrative is not enough.

A valid provider response must not gain authority by including an arbitrary canonical-looking ID.

All basis refs must resolve through the trusted runtime's exact derivation manifest.

---

# 18. Audience Hallucination Guard

The runtime must not convert:

```text
no evidence
```

into:

```text
audience definitely believes X
```

If a state is inferred weakly:

```text
represent uncertainty
```

or:

```text
create a KnowledgeGap
```

when decision-relevant.

For v1.0.2:

```text
unsupported factual value
+
uncertainty removed
=
canonical admission failure
```

An unknown may become known only when the resulting confident factual value has an eligible exact canonical basis.

This does not mean `unknown can never become known`.

It means:

```text
certainty increase requires attributable canonical basis.
```

---

# 19. Audience-to-Governance Feedback

If audience refinement changes a governance dependency:

```text
market
jurisdiction
product/category interpretation
audience state
channel relevance
material proposition state
```

SPEC04 governance refresh must run before final strategy admission.

---

# 20. StrategyHypothesis Contract

Frozen schema:

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

# 21. Strategy Meaning

StrategyHypothesis answers:

```text
WHAT behavioral change are we trying to influence?

WHAT core message should organize the content?

WHY might that message work for this AudienceState?

WHAT proof is required?

WHAT propositions must be true/supported?

WHAT assumptions remain?

HOW could this strategy fail?

WHAT risks should be tested?
```

It is a hypothesis.

It is not a guarantee of effectiveness.

---

# 22. Strategy Generation Inputs

Strategy generation may use only explicit decision state:

```text
TaskContractRevision
FINAL_FOR_DECISION AudienceState
Program/Outcome context
ChannelProfileRevision
final KnowledgeGap states
decision-time EpistemicStateVersions
PRE_GENERATION_FINAL ApplicabilityAssessments
GuidanceRevision state
Risk context
RunConfig
```

No live hidden lookup.

---

# 23. Strategy Output Grounding

Every material factual basis in a StrategyHypothesis must resolve to:

```text
required_proposition_ids
```

or remain explicitly represented in:

```text
assumptions
unknowns
```

A factual premise may not hide inside:

```text
persuasion_mechanism
proof_strategy
core_message
```

without canonical knowledge support.

---

# 24. Required Proposition Rule

If the Strategy depends on a proposition as factual proof:

```text
proposition_id
MUST appear in
required_proposition_ids
```

The Strategy Gate then checks the exact decision-time EpistemicState.

---

# 25. Strategy Assumptions

Assumptions are permitted only when they do not violate:

```text
KnowledgeGap rules
governance rules
rights rules
risk constraints
```

Assumptions remain explicit.

They do not become propositions with `SUPPORTED` status merely because a strategy uses them.

---

# 26. Strategy Unknowns

Unknowns are explicit residual uncertainty.

Strategy generation must not delete unknowns merely to make the strategy cleaner.

Material unknowns may trigger:

```text
BLOCKED
HUMAN_REVIEW_REQUIRED
additional research
```

through upstream/gate rules.

---

# 27. Strategy Failure Modes

`failure_modes` should describe how the proposed strategy may fail operationally or behaviorally.

Examples:

```text
message is not believed
proof is too weak
audience already knows claim
audience objection not addressed
channel format suppresses explanation
content framing triggers governance risk
```

They are hypotheses, not measured outcomes.

---

# 28. Strategy Risk Hypotheses

`risk_hypotheses` describe risks that downstream risk/evaluation stages should examine.

They do not replace RiskAssessment.

---

# 29. Strategy Candidate Diversity

The runtime may generate multiple StrategyHypotheses.

Diversity may vary:

```text
core message
behavioral objective
persuasion mechanism
proof strategy
content angle
```

But each strategy must independently satisfy grounding/gating.

Diversity is never a license to fabricate unsupported facts.

---

# 30. Strategy Generation Is Model-Replaceable

The strategy generator may be:

```text
LLM
rules
templates
hybrid system
human-assisted workflow
```

Canonical output contract is independent of provider.

Provider identity belongs in pinned RunConfig lineage.

---

# 31. Strategy Gate Inputs

The deterministic Strategy Gate consumes exactly:

```text
FINAL_FOR_DECISION AudienceState

StrategyHypothesis

final KnowledgeGap states

required Proposition EpistemicStateVersions

PRE_GENERATION_FINAL ApplicabilityAssessments

pinned Task / Program / Channel context
```

It may additionally validate cross-reference integrity required by SPEC01/02.

It may not use hidden post-boundary state.

---

# 32. Strategy Gate Condition 1 — Blocking Gaps

Normal strategy execution requires:

```text
NO unresolved blocking KnowledgeGap
```

If one remains:

```text
BLOCKED
or
HUMAN_REVIEW_REQUIRED
```

No architecture generation for a normal release path.

---

# 33. Strategy Gate Condition 2 — Required Proposition Availability

For every:

```text
StrategyHypothesis.required_proposition_id
```

there must be an exact current decision-time EpistemicState in the pinned knowledge state.

Missing state:

```text
NO NORMAL STRATEGY PASS
```

---

# 34. Strategy Gate Condition 3 — Factual Proof

If a strategy depends on a required proposition as factual proof:

```text
support_status
must not be
CONTRADICTED
or
INSUFFICIENT
```

Unknown handling must follow the explicit upstream strategy/knowledge rules.

No fabricated certainty.

---

# 35. Strategy Gate Condition 4 — Governance

No applicable non-overridable governance rule may block the Strategy.

Strategy generation cannot reinterpret a hard applicable rule as optional guidance.

---

# 36. Strategy Gate Condition 5 — Explicit Limits

Material:

```text
assumptions
unknowns
limitations
```

must remain explicit.

The gate may not approve a strategy only because those fields were omitted from model output.

---

# 37. Strategy Gate Outcome

SPEC05 runtime uses only these process outcomes:

```text
PROCEED
BLOCKED
HUMAN_REVIEW_REQUIRED
```

These are stage outcomes, not new canonical entity fields.

`PROCEED` means all Blueprint Strategy Gate conditions passed.

---

# 38. Strategy Gate Determinism

Given identical:

```text
exact strategy_id
exact audience_state_id
exact KnowledgeGap IDs
exact EpistemicStateVersion IDs
exact ApplicabilityAssessment IDs
exact Task/Program/Channel revisions
exact gate configuration
```

the gate must return semantically equivalent outcome/reason codes.

---

# 39. Strategy Gate Fail-Closed

If gate input is missing, contradictory or cannot be resolved:

```text
DO NOT PROCEED
```

Use:

```text
BLOCKED
or
HUMAN_REVIEW_REQUIRED
```

according to the failure class.

Never default to pass.

---

# 40. Strategy Gate Auditability

Stage output must expose:

```text
strategy_id
audience_state_id
input refs
outcome
reason codes
gate config revision
stage_execution_id
```

This may live in StageExecution output metadata/logical result.

It is not a new canonical domain entity.

---

# 41. ContentArchitecture Contract

Frozen schema:

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

# 42. ContentArchitecture Meaning

ContentArchitecture defines the planned sequence and function of content.

It answers:

```text
WHAT units exist?

IN WHAT order?

WHAT audience transition should each unit create?

WHAT information/propositions should each unit deliver?

WHAT copy/visual/audio goal should each unit serve?

HOW does one unit transition to the next?
```

It is not the final copy.

---

# 43. Architecture Admission

A ContentArchitecture may be generated for a normal release path only after:

```text
Strategy Gate = PROCEED
```

for its exact StrategyHypothesis and final decision context.

A blocked strategy cannot bypass the gate by generating architecture directly.

---

# 44. Architecture Task Closure

Require:

```text
ContentArchitecture.task_revision_id
=
StrategyHypothesis.task_revision_id
```

and:

```text
ContentArchitecture.strategy_id
=
StrategyHypothesis.strategy_id
```

for the strategy being realized.

---

# 45. Architecture Supersession

Changing architecture creates a new:

```text
architecture_id
```

Old architecture remains immutable.

`supersedes_architecture_id?` may preserve intentional architectural revision lineage.

SPEC05 does not invent additional branching constraints absent from frozen upstream contracts.

---

# 46. ContentUnit Contract

Frozen schema:

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

# 47. ContentUnit Position

Within one ContentArchitecture:

```text
position
```

must define an unambiguous intended ordering.

The architecture runtime must reject:

```text
duplicate positions
undefined order
```

for release-eligible sequential formats unless the channel/format contract explicitly permits parallel/nonlinear units.

---

# 48. ContentUnit Audience Transition

Each unit models an intended transition:

```text
audience_state_before
↓
content unit
↓
audience_state_after
```

These are structured content-planning values.

They do not replace canonical AudienceState.

---

# 49. ContentUnit Proposition Use

`proposition_ids` identify canonical meanings intended to be communicated or relied on by the unit.

A unit must not silently introduce a factual proposition that has no decision-time epistemic basis.

---

# 50. Supplemental Proposition Rule

If architecture introduces a Proposition not already material to the Strategy:

```text
resolve exact decision-time EpistemicState
```

and validate that its use is compatible with:

```text
Task
Audience
Governance
Strategy
```

If that supplemental Proposition is used as factual proof, the architecture runtime MUST apply the same factual-proof admission rule as the Strategy Gate.

At minimum:

```text
decision-time EpistemicState MUST exist

support_status MUST NOT be:
CONTRADICTED
INSUFFICIENT
```

Unknown/uncertain handling must preserve the upstream unknown-preservation rules.

A supplemental factual Proposition may not enter release-eligible Architecture merely because it was introduced after Strategy generation.

If the new Proposition materially changes:

```text
core message
proof strategy
behavioral logic
risk
governance dependency
```

create a new StrategyHypothesis and rerun Strategy Gate.

Architecture may not become a hidden second strategy layer.

---

# 51. Unit Goal Separation

These remain distinct:

```text
information_to_deliver
copy_goal
visual_goal
audio_goal
```

A visual/audio goal may shape expression.

It may not invent a new factual claim without entering normal assertion/evaluation flow.

---

# 52. Architecture Context

Architecture generation receives a minimized explicit context containing:

```text
Task
final AudienceState
admitted StrategyHypothesis
relevant epistemic state
relevant applicability/guidance
ChannelProfileRevision
RunConfig
```

Architecture generation MUST NOT receive the entire unrestricted datastore.

Every injected context item MUST be decision-relevant, authorized for the tenant/workspace, and attributable to an explicit canonical input or pinned configuration.

Unscoped datastore access is a context-admission failure, not an optimization choice.

---

# 53. Candidate Contract

Frozen schema:

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

Rewrite:

```text
NEW candidate_id
```

---

# 54. Candidate Task Closure

Require:

```text
Candidate.task_revision_id
=
Architecture.task_revision_id
=
Strategy.task_revision_id
```

---

# 55. Candidate Strategy Closure

Require:

```text
Candidate.strategy_id
=
Architecture.strategy_id
```

and the strategy must be the strategy admitted by the Strategy Gate for this path.

---

# 56. Candidate Architecture Closure

Candidate generation must realize the exact:

```text
architecture_id
```

it references.

If generation materially departs from architecture:

```text
either
create a new architecture
or
treat the result as non-conformant
```

It may not keep a stale architecture reference merely for convenience.

---

# 57. Candidate RunConfig Closure

Every ContentCandidate stores exact:

```text
run_config_id
```

For any DecisionSnapshot containing the candidate:

```text
Candidate.run_config_id
=
DecisionSnapshot.run_config_id
```

Generation may not be attributed to a later or unpinned RunConfig.

---

# 58. RunConfig Pinning

RunConfig pins exact runtime revisions such as:

```text
prompt revisions
model configs
tool configs
schema revisions
retriever revisions
evaluator revisions
runtime parameters
```

SPEC05 generation uses only exact pinned revisions.

No:

```text
latest prompt
current model config
active tool config
```

lookup after run start.

---

# 59. Candidate Generation Context

Candidate generation context must include enough explicit state to reconstruct why the model was allowed to produce the candidate.

At minimum:

```text
TaskContractRevision
FINAL_FOR_DECISION AudienceState
StrategyHypothesis
ContentArchitecture
ContentUnits
relevant Proposition/Epistemic state
PRE_GENERATION_FINAL ApplicabilityAssessments
relevant Guidance
generation-allowed source material if any
RunConfig
```

---

# 60. Context Minimization

Only decision-relevant context should be injected.

Benefits:

```text
lower prompt ambiguity
lower data exposure
better auditability
lower accidental instruction leakage
lower token cost
```

Context minimization may not remove a material constraint.

---

# 61. Instruction Hierarchy

Generation context must distinguish:

```text
SYSTEM/CONTROL INSTRUCTIONS

CANONICAL DECISION DATA

UNTRUSTED SOURCE CONTENT

OPTIONAL STYLE EXAMPLES
```

Untrusted source text is data.

It is not executable instruction.

---

# 62. Tool Authority Boundary

Content-generation models may only use tools explicitly authorized by:

```text
RunConfig
ToolConfig
stage authority
```

Candidate generation may not grant itself new tool permissions.

---

# 63. Source-Use Boundary

If source material is supplied directly into generation context:

```text
SPEC08 rights/security admission
must already permit that use
```

SPEC05 does not reinterpret rights.

It consumes the admitted generation context.

---

# 64. Candidate Content Payload

`content_payload` is structured/text according to Task format and ChannelProfile capability.

It may contain:

```text
copy
scene plan
visual directions
audio directions
metadata
format-specific structure
```

The payload shape must be schema-validated when a schema revision is pinned.

---

# 65. Candidate Is Not Publication

ContentCandidate is not:

```text
ExecutionArtifact
PublishedArtifact
```

Candidate content may later change during production/execution.

Those later states get their own immutable identities.

---

# 66. Candidate Is Not Evidence

A generated statement inside a Candidate does not become true because the model wrote it.

Candidate content enters SPEC06 assertion extraction and validation.

---

# 67. Candidate Is Not Decision

Candidate generation does not authorize release.

Only:

```text
DecisionRecord
```

owns final release status.

---

# 68. Candidate Rewrite

A rewrite never mutates:

```text
content_payload
```

of an existing Candidate.

Canonical:

```text
C1
↓ rewrite
C2
```

with new:

```text
candidate_id
```

`parent_candidate_id` may identify the source candidate.

---

# 69. Rewrite Inputs

Rewrite may use:

```text
parent Candidate
evaluation feedback
required qualification
human revision request
architecture changes
strategy changes
governance changes
```

But references on the new Candidate must reflect the actual current:

```text
task
strategy
architecture
run_config
```

---

# 70. Rewrite Does Not Inherit Validation

Validation state belongs to the exact candidate/assertion state.

A rewrite:

```text
DOES NOT inherit
old candidate validation as final truth.
```

SPEC06 must evaluate the new immutable candidate state.

---

# 71. Candidate Variant Generation

Multiple candidates may share:

```text
task
strategy
architecture
run_config
```

while differing in expression.

This is expected.

Candidate diversity is not duplicate-history failure.

---

# 72. Candidate Diversity Boundary

Variants may differ in:

```text
hook
wording
ordering within allowed architecture expression
visual treatment
audio treatment
tone
examples
CTA expression
```

They may not silently change:

```text
required factual meaning
strategy
architecture
governance constraints
```

while keeping stale references.

---

# 73. Model Creativity Boundary

The model may invent:

```text
phrasing
metaphor
non-factual scene details
stylistic structure
creative transitions
```

within Task/governance limits.

It may not invent:

```text
product facts
statistics
legal permissions
scientific support
customer results
pricing
availability
claims of causation
```

unless those are grounded in admitted canonical state.

---

# 74. Factual Claim Boundary

SPEC05 does not attempt to prove every generated content claim before generation.

Instead:

```text
generation is constrained by grounded context
+
SPEC06 extracts and validates actual Assertions
```

If the generator nevertheless creates an unsupported candidate claim:

```text
SPEC06 must catch it
```

and release gates remain closed.

AudienceState factual-basis admission is different because AudienceState is upstream decision state.

Unsupported confident audience facts may not be deferred to SPEC06. They must be prevented or kept uncertain before Strategy generation.

---

# 75. Assumption Propagation

Material strategy assumptions relevant to expression must remain visible in candidate-generation context.

Generator must not convert:

```text
assumption
→ unqualified factual statement
```

without validation.

---

# 76. Unknown Propagation

Material strategy/audience unknowns relevant to content must remain available to generation.

Unknown may influence wording such as:

```text
conditional framing
qualification
avoiding unsupported specificity
```

Unknown must not become invented certainty.

---

# 77. Governance Propagation

Relevant PRE_GENERATION_FINAL applicability state must be converted into explicit generation constraints.

Examples:

```text
required disclosure
prohibited framing
channel restriction
claim limitation
mandatory caveat
```

SPEC05 may transform governance state into generation instructions.

It may not weaken the governing semantics.

---

# 78. Guidance Propagation

Applicable Guidance may affect:

```text
structure
style
channel conventions
best practices
```

Guidance remains distinguishable from hard rule constraints.

---

# 79. ChannelProfile Binding

Candidate generation must respect the exact pinned ChannelProfileRevision relevant to the Task channel.

At minimum:

```text
supported format
technical capability
content capability
```

must not be contradicted by the generated payload.

---

# 80. Task Constraint Binding

Generation must preserve:

```text
objective
channel
format
language
market
jurisdiction
brand/product identity
constraints
risk context
compute budget
```

from exact TaskContractRevision.

---

# 81. Program Context

When Task references a ContentProgramRevision, strategy/content generation must remain consistent with the pinned Program:

```text
business objective
brand objective
message hierarchy
content pillars
channel roles
metrics
```

Standalone tasks do not invent a hidden Program.

---

# 82. Outcome Context

OutcomeModel may inform strategy hypotheses.

Outcome relationships do not automatically establish epistemic truth.

For example:

```text
OutcomeEdge.relationship_type = CAUSAL
```

does not itself prove the underlying causal Proposition.

SPEC03 epistemic rules still govern.

---

# 83. Compute Budget

Task.compute_budget may constrain:

```text
number of strategies
number of candidates
model class
iteration count
```

It may not bypass:

```text
Strategy Gate
governance
rights
validation
hard release gates
```

Cost-saving mode cannot weaken correctness.

---

# 84. Candidate Count

The runtime may generate one or many candidates.

Candidate count is an optimization parameter.

Correctness requirements apply independently to every candidate.

---

# 85. Selection Before Evaluation

SPEC05 may perform non-authoritative generation-time pruning for:

```text
duplicate wording
malformed output
schema failure
obvious architecture mismatch
```

It must not claim final content quality or release eligibility.

Formal candidate evaluation belongs to SPEC06.

---

# 86. Generation-Time Schema Validation

Before canonical Candidate insertion:

```text
payload parses
required fields exist
format constraints parse
task/strategy/architecture refs agree
run_config_id exact
```

Malformed provider output is retried or rejected.

It is not stored as a valid Candidate.

---

# 87. Provider Retry

Provider retry with exact generation input and exact idempotency identity must not create uncontrolled duplicate canonical history.

Implementation may:

```text
reuse exact successful canonical candidate
```

or intentionally create multiple candidates only when the workflow requested multiple variants.

---

# 88. Candidate Idempotency

Canonical generation request identity SHOULD include:

```text
decision_cycle_id
task_revision_id
audience_state_id
strategy_id
architecture_id
run_config_id
variant_slot
canonical generation-input hash
```

Exact retry:

```text
at most one canonical effect per variant_slot
```

---

# 89. Strategy Generation Idempotency

A strategy-generation request identity SHOULD include:

```text
decision_cycle_id
task_revision_id
audience_state_id
run_config_id
strategy_slot
canonical input hash
```

Retries of one exact slot converge.

Deliberately requested alternative strategies use different slots.

---

# 90. Architecture Generation Idempotency

Architecture generation identity SHOULD include:

```text
decision_cycle_id
strategy_id
task_revision_id
run_config_id
architecture_slot
canonical input hash
```

Retry does not create accidental duplicate history.

---

# 91. Audience Derivation Idempotency

Audience derivation identity SHOULD include:

```text
decision_cycle_id
task_revision_id
state_stage
canonical knowledge input hash
derivation config
```

For v1.0.2, the canonical knowledge input hash must cover, when applicable:

```text
eligible Task audience-context inputs
eligible AUDIENCE Proposition refs
exact decision-time EpistemicStateVersion refs
structured KnowledgeGap inputs
exact audience derivation manifest
pinned audience schema/config
```

If decision-relevant input changes materially:

```text
new AudienceState
```

not a retry.

If an uncertainty becomes resolvable because new canonical knowledge entered, that is material input change and produces a new AudienceState.

---

# 92. StageExecution Binding

Content runtime stages execute through SPEC01 StageExecution.

Suggested stage names:

```text
AUDIENCE_PROVISIONAL
AUDIENCE_REFINE
AUDIENCE_FINALIZE
STRATEGY_GENERATE
STRATEGY_GATE
ARCHITECTURE_GENERATE
CANDIDATE_GENERATE
CANDIDATE_REWRITE
```

Names may vary.

Semantics may not.

---

# 93. Stage Fencing

Every pre-freeze canonical write must validate:

```text
DecisionCycle
fencing token
lease ownership
stage idempotency
```

A worker that loses authority cannot commit later.

---

# 94. FREEZING Barrier

Audience/strategy/architecture/candidate state used by DecisionSnapshot is upstream decision input.

Therefore after:

```text
DecisionCycle → FREEZING
```

no new content-intelligence input may join that cycle.

Late provider responses:

```text
commit rejected
```

or routed to a new valid cycle if explicitly re-executed.

---

# 95. Cancellation

Cycle cancellation invalidates old content-generation workers through fencing epoch rules.

A cancelled cycle must not accept:

```text
late Candidate
late Strategy
late Architecture
late AudienceState
```

commits from stale workers.

---

# 96. Cycle Supersession

When material new information causes a new DecisionCycle:

```text
old cycle remains historical
```

Content generation for the successor cycle must use successor-cycle decision state.

It may reuse immutable upstream objects only when exact references remain valid.

---

# 97. Reuse Across Cycles

Safe reuse requires exact semantic/context compatibility.

Examples potentially reusable:

```text
same immutable Proposition
same unchanged SourceArtifact
same exact RunConfig
same immutable GuidanceRevision
```

Decision-state objects such as:

```text
AudienceState
StrategyHypothesis
ContentArchitecture
ContentCandidate
```

must not be silently treated as current merely because IDs still resolve.

The successor cycle must explicitly select/revalidate them.

---

# 98. New Information After Candidate Generation

If new information materially changes:

```text
audience
required propositions
governance
strategy assumptions
rights
risk
```

before freeze:

```text
recompute affected stages
```

Do not patch the old Candidate.

Generate new immutable downstream state.

---

# 99. Governance Change After Candidate Generation

If final governance refresh changes a material generation constraint:

```text
old candidate may remain historical
```

but it may not be treated as conformant without appropriate regeneration/revalidation.

---

# 100. Strategy Change

If core strategy meaning changes:

```text
new StrategyHypothesis
```

Then downstream:

```text
new ContentArchitecture
new ContentCandidate
```

for the new strategy path.

Do not reuse stale strategy IDs.

---

# 101. Architecture Change

If architecture changes materially:

```text
new ContentArchitecture
```

Candidate generation must reference the new architecture.

Old candidates remain bound to their old architecture.

---

# 102. Candidate Repair

If evaluation requests a wording repair but strategy/architecture remain valid:

```text
new Candidate
parent_candidate_id = prior candidate
```

The new candidate still receives new SPEC06 evaluation.

---

# 103. Qualification Repair

If SPEC06 returns:

```text
SUPPORTED_WITH_QUALIFICATION
```

and required qualification is absent:

```text
new Candidate
```

must incorporate the qualification before release eligibility can be reconsidered.

Do not mutate the old Candidate.

---

# 104. Content-Level Governance Feedback

If generated content causes a new:

```text
CONTENT_LEVEL ApplicabilityAssessment
```

that imposes material constraint:

```text
candidate may require rewrite
or
review/block
```

The old candidate remains immutable.

---

# 105. Candidate-to-SPEC06 Handoff

SPEC05 hands SPEC06:

```text
candidate_id
task_revision_id
strategy_id
architecture_id
run_config_id
content_payload
relevant pinned context refs
```

SPEC06 then owns:

```text
ContentAssertion creation/extraction behavior
AssertionPropositionLink behavior
AssertionValidationResult
CompositeImpressionAssessment
QualitativeEvaluation
validation closure
```

Canonical entity schemas remain those frozen upstream.

---

# 106. Assertion Boundary

SPEC05 may ask a model to emit tentative claim annotations for efficiency.

Those annotations are:

```text
NON-AUTHORITATIVE
```

until SPEC06 creates canonical ContentAssertions and validation state.

Candidate generator may not self-certify its own claims.

---

# 107. Quality Boundary

SPEC05 may use lightweight generation heuristics to reject malformed candidates.

It may not create final truth such as:

```text
"high quality"
"safe"
"supported"
"ready"
```

Those require downstream canonical evaluation/governance.

---

# 108. Feedback Boundary

Evaluation feedback may be used to generate a new Candidate.

Feedback must enter as explicit structured input.

The generator may not silently inspect mutable evaluator state.

---

# 109. Human Rewrite Input

Human-authored edit instructions may produce a new Candidate.

Material factual information introduced by the human must enter the appropriate upstream knowledge path before a final release relies on it.

Human rewrite text itself is not automatically Evidence.

---

# 110. Prompt Construction

Prompt construction must be deterministic enough to audit from:

```text
exact prompt revision
exact canonical inputs
exact serialization rules
runtime parameters
```

Provider nondeterminism may still produce different content.

Historical provenance remains reconstructable.

---

# 111. Prompt Injection Defense

Retrieved/source text is untrusted.

Generation prompt builders must prevent source content from changing:

```text
system instruction priority
tool authorization
governance constraints
task identity
run configuration
```

---

# 112. Context Reference Manifest

Implementation SHOULD maintain a reconstructable stage input manifest using existing StageExecution canonical_input_hash + output refs / logs.

It may record:

```text
exact IDs/revisions serialized into generation context
```

as operational metadata.

For audience derivation under v1.0.5, the manifest MUST be exact enough to validate every `AudienceFactBasisLink`, every path-bound uncertainty coverage item, and every semantic-projection input.

PRE-PROVIDER DERIVATION MANIFEST
=
CANONICAL ELIGIBILITY CONTEXT

The authoritative hash input is PRE_PROVIDER_MANIFEST_CORE.

PRE_PROVIDER_MANIFEST_CORE includes, where applicable:

- exact TaskContractRevision;
- exact eligible Task.audience_context paths/values;
- eligible AUDIENCE Proposition refs;
- exact eligible EpistemicStateVersion refs;
- KnowledgeGap / ResearchTrace refs;
- ChannelProfileRevision / Program/governance context when material;
- exact RunConfig;
- exact CONTENT_INTELLIGENCE_AUDIENCE role binding;
- exact schema_revision_refs membership proof;
- exact SchemaDefinition revision;
- exact immutable SchemaDefinition payload identity/hash;
- complete AudienceSemanticProjectionSchema configuration;
- traversal/path/classification configuration;
- uncertainty-coverage configuration;
- tenant/workspace;
- trusted audience_knowledge_cutoff_time;
- all other deterministic material pre-provider inputs.

StageExecution.canonical_input_hash may appear only in the sealed envelope (PRE_PROVIDER_MANIFEST_ENVELOPE) / operational metadata after computation.
The hash is not a member of the serialization it hashes.

It MUST NOT pre-provider record or claim:

- generated factual leaf;
- generated fact_path that does not yet exist;
- selected projection rule_id for a generated leaf;
- leaf-specific projection inputs;
- projected PropositionSemanticIdentity;
- evaluateSemanticEquivalence outcome;
- final AudienceFactBasisLink admission result;
- audience_admission_hash.

Those are POST-PROVIDER admission values.

The pre-provider manifest must contain enough configuration to deterministically VALIDATE those values later, not pretend they already exist.

---

# 113. Canonical Input Hash

Each generation stage computes:

```text
canonical_input_hash
```

over a deterministic serialization of material stage inputs.

The hash participates in:

```text
idempotency
retry verification
cache validation
audit
```

It does not replace the underlying IDs.

For audience derivation under v1.0.5, canonical input identity MUST include:

```text
exact TaskContractRevision
exact relevant Task.audience_context paths/values
exact AUDIENCE Proposition refs
exact EpistemicStateVersion refs
exact KnowledgeGap / ResearchTrace refs when used
exact CONTENT_INTELLIGENCE_AUDIENCE RunConfigSchemaRoleBinding tuple
proof that the binding target is an exact member of RunConfig.schema_revision_refs
exact SchemaDefinition revision + immutable payload hash/binding containing:
    traversal/path rules
    factual classification rules
    uncertainty coverage schema
    semantic projection rules
exact RunConfig
exact tenant/workspace scope
exact audience_knowledge_cutoff_time
```

StageExecution.canonical_input_hash
=
hash(PRE_PROVIDER_MANIFEST_CORE canonical serialization)

and NOT:
hash(PRE_PROVIDER_MANIFEST_ENVELOPE containing canonical_input_hash)

It MUST NOT require generated-output-dependent values such as:
- final generated Audience factual leaf values;
- generated fact paths that cannot exist before output;
- selected projection rule_id for a generated leaf;
- leaf-specific projection input values;
- projected PropositionSemanticIdentity;
- evaluateSemanticEquivalence result;
- final AudienceFactBasisLink admission result.

Those belong to post-provider admission.

### 113.1 audience_admission_hash

After trusted post-provider admission resolution, compute:

`audience_admission_hash`

It MUST deterministically bind the complete canonical admission decision.

At minimum include:

- StageExecution.canonical_input_hash;
- exact normalized Audience proposal content being admitted;
- exact generated factual leaves;
- audience_field;
- fact_path;
- canonical fact value;
- fact_value_hash;
- exact uncertainty coverage identity;
- exact AudienceFactBasisLink candidate identities;
- exact Task basis path/value identity where used;
- exact Proposition identity where used;
- exact EpistemicStateVersion identity where used;
- exact selected semantic projection rule_id;
- exact projection inputs;
- complete projected PropositionSemanticIdentity;
- exact evaluateSemanticEquivalence outcome;
- exact linked proposition_id;
- exact audience_knowledge_cutoff_time;
- tenant/workspace scope;
- exact Audience role binding;
- exact SchemaDefinition identity/payload identity where required for deterministic reconstruction.

The provider cannot authoritatively provide this hash.
A caller-provided hash may be echoed only for equality comparison.
Trusted runtime owns its computation.

### 113.2 Hash Role Separation

The SPEC MUST explicitly state:

StageExecution.canonical_input_hash answers:
"Exactly what canonical input state was supplied to this generation attempt?"

audience_admission_hash answers:
"Exactly what generated Audience proposal plus canonical authority was validated for canonical admission?"

They are not interchangeable.
The admission hash MUST NOT replace StageExecution.canonical_input_hash.
StageExecution.canonical_input_hash MUST NOT be mutated after provider output to become an admission hash.

## 113.3 Commit-Time Full Revalidation

At canonical Audience commit:

BEGIN

Revalidate mutable operational authority:
- StageExecution;
- lease;
- fencing_token;
- DecisionCycle;
- cycle fencing epoch;
- writable state;
- FREEZING rules.

Re-resolve exact canonical configuration:
- RunConfig;
- CONTENT_INTELLIGENCE_AUDIENCE role binding;
- schema_revision_refs membership;
- exact SchemaDefinition revision;
- exact immutable payload binding/hash;
- TaskContractRevision;
- tenant/workspace;
- trusted audience_knowledge_cutoff_time.

Verify:
`StageExecution.canonical_input_hash` == the exact pre-provider canonical input identity recorded for this attempt.

Then reconstruct trusted post-provider admission from:
- exact provider proposal being admitted;
- canonical records;
- exact pre-provider manifest identity.

Re-run:
- factual traversal;
- classification;
- fact path derivation;
- fact value hashing;
- path-bound uncertainty validation;
- basis validation;
- Task basis resolution;
- Proposition resolution;
- EpistemicStateVersion resolution;
- cutoff check;
- valid-time/scope check;
- projection rule selection;
- projection inputs;
- PropositionSemanticIdentity construction;
- SPEC03 evaluateSemanticEquivalence;
- exact linked proposition closure;
- full factual coverage.

Then recompute:
`commit_time_audience_admission_hash`

Require:
`commit_time_audience_admission_hash` == `post_provider_precommit_audience_admission_hash`

If unequal:
FAIL CLOSED.
Do not silently rebase.
Do not repair authority in-place.
Do not invoke provider again from inside the commit transaction.

If equal:
- insert immutable AudienceState
- insert immutable AudienceFactBasisLink rows
- insert required supporting audit/admission metadata if the frozen upstream persistence model permits it
- write outbox

COMMIT.

Provider calls remain outside DB transaction.

## 113.4 No Precomputed Claim Catalog

Do NOT solve validation by constraining the provider to a precomputed exhaustive catalog of final Audience factual claims.
The provider remains capable of synthesizing an Audience proposal.
Trust is established AFTER generation through deterministic canonical admission validation.

## 113.5 No Hidden Authority DTO

An implementation may use internal DTOs, but fields such as:
`admission_authority, isSupported, isAuthorized, isEligible, selectedSchema, selectedProjectionRule, projectedIdentity, semanticOutcome, trustedCutoff, manifest, canonical_input_hash, audience_admission_hash`
are authoritative only when constructed by the trusted SPEC05 runtime from canonical sources.
A type name such as `Resolved...`, `Trusted...`, or `Validated...` does NOT create authority.
Provider/caller/generic adapter-supplied authority assertions remain non-authoritative.

---

# 114. Cache Rules

Allowed caches include:

```text
audience synthesis
strategy generation
architecture generation
prompt rendering
candidate generation
```

Cache key must include:

```text
tenant/workspace
exact revision refs
exact immutable refs
canonical input hash
provider/model config
```

Cache is non-authoritative.

---

# 115. Cache Staleness

A cache hit is invalid if any material input changes.

Do not reuse:

```text
old audience output
old strategy output
old candidate output
```

against a different canonical input hash.

---

# 116. Tenant Isolation

All content runtime reads/writes obey SPEC02 tenant/workspace boundaries.

A model prompt may not combine:

```text
Tenant A private data
+
Tenant B task
```

without explicit authorized shared scope.

AudienceFactBasisLink validation must reject a basis ref outside the authorized tenant/workspace scope unless an explicit frozen shared/public scope contract permits it.

---

# 117. Data Minimization

Private source/evidence content supplied to a generation model should be minimized to what is necessary for the Task.

Do not send entire tenant knowledge stores by default.

---

# 118. Secrets

Secrets must never appear in:

```text
content_payload
prompt examples
model-visible context
candidate metadata
logs
```

unless an explicit secure workflow requires them.

Standard content generation does not.

---

# 119. Tool Use

Tools used during content generation must be:

```text
pinned
authorized
least-privilege
auditable
```

Tool outputs that create factual knowledge must enter canonical knowledge/evidence paths before being relied on as fact.

A direct tool response is not sufficient `AUDIENCE_EPISTEMIC_STATE` basis until the normal SPEC03 path creates the required canonical knowledge state.

---

# 120. External Side Effects

SPEC05 generation has no authority to:

```text
publish
send messages
buy ads
modify external accounts
change Control Plane
```

Generation produces internal immutable content state only.

---

# 121. Failure Taxonomy

Implementation reason/error codes may include:

```text
AUDIENCE_INPUT_INVALID
AUDIENCE_UNCERTAIN_BLOCKING
AUDIENCE_FACT_UNGROUNDED
AUDIENCE_PROVENANCE_INVALID
AUDIENCE_BASIS_REF_INVALID
AUDIENCE_FACT_SEMANTIC_MISMATCH
AUDIENCE_SEMANTIC_PROJECTION_MISSING
AUDIENCE_SEMANTIC_PROJECTION_AMBIGUOUS
AUDIENCE_SEMANTIC_PROJECTION_INVALID
AUDIENCE_UNCERTAINTY_COVERAGE_INVALID
AUDIENCE_KNOWLEDGE_CUTOFF_MISMATCH
AUDIENCE_SCHEMA_CLASSIFICATION_INVALID

STRATEGY_SCHEMA_INVALID
STRATEGY_GROUNDING_FAILED
STRATEGY_GATE_BLOCKED
STRATEGY_GATE_REVIEW_REQUIRED

ARCHITECTURE_SCHEMA_INVALID
ARCHITECTURE_STRATEGY_MISMATCH
ARCHITECTURE_PROPOSITION_UNGROUNDED

CANDIDATE_SCHEMA_INVALID
CANDIDATE_TASK_MISMATCH
CANDIDATE_STRATEGY_MISMATCH
CANDIDATE_ARCHITECTURE_MISMATCH

RUN_CONFIG_MISMATCH
GENERATION_PROVIDER_FAILED
GENERATION_OUTPUT_MALFORMED
GENERATION_CONTEXT_STALE
STALE_WORKER
TENANT_SCOPE_VIOLATION
```

These are operational codes.

They are not new canonical entities.

---

# 122. Fail-Closed Conditions

Fail closed when:

```text
final audience is missing

a factual leaf required by §10F has:
    no eligible typed basis
    and no exact structured uncertainty coverage

path-bound uncertainty coverage:
    is missing audience_field/fact_path/status
    uses a path invalid under the pinned schema
    claims coverage with status other than UNRESOLVED

AudienceFactBasisLink typed branch is invalid
AudienceFactBasisLink path does not resolve
AudienceFactBasisLink fact hash mismatches
AudienceFactBasisLink basis is outside exact derivation manifest
AudienceFactBasisLink basis is outside authorized tenant/workspace

audience_knowledge_cutoff_time is caller/provider-selected
audience cutoff/manifest identity differs between provider invocation and commit
EpistemicStateVersion is future-known relative to audience_knowledge_cutoff_time

AUDIENCE_EPISTEMIC_STATE basis:
    does not close to exact linked Proposition
    PropositionType is not AUDIENCE
    support status is not sufficient for the asserted confidence
    no semantic projection rule matches
    more than one semantic projection rule matches
    projection requires unavailable input
    projection output is not a complete PropositionSemanticIdentity
    projected propositionType is not AUDIENCE
    existing SPEC03 resolver outcome is not REUSE_EXISTING
    semantic comparison is against another proposition_id
    qualifier/population/jurisdiction meaning is mismatched

provider output attempts to act as its own evidence
provider/caller supplies or overrides semantic-projection fields
provider/caller attempts to classify a factual path as structural/non-factual
pinned audience schema cannot deterministically classify/traverse the output
pinned projection schema contains ambiguous overlapping selectors

blocking KnowledgeGap remains
required proposition has no decision-time EpistemicState
required factual proposition is contradicted/insufficient
applicable hard governance blocks strategy
strategy references wrong Task
architecture references wrong Strategy
candidate references mismatched Task/Strategy/Architecture
candidate RunConfig mismatches
generation context is stale
provider output is malformed
worker fence is stale
tenant boundary fails
```

Fail closed means:

```text
do not create a release-eligible downstream state
```

not necessarily destroy historical failed artifacts.

---

# 123. Audience Write Transaction

Provider/model work remains outside database transactions.

Required lifecycle:

```text
claim valid StageExecution
↓
open coherent read boundary
↓
capture trusted audience_knowledge_cutoff_time
↓
resolve exact canonical eligible bases/config
↓
resolve exact Audience schema role binding
↓
resolve exact SchemaDefinition payload
↓
construct PRE_PROVIDER_MANIFEST_CORE
↓
compute/finalize StageExecution.canonical_input_hash
↓
seal PRE_PROVIDER_MANIFEST_ENVELOPE
↓
provider/model invocation
↓
treat provider proposal as untrusted
↓
trusted deterministic post-provider admission resolution
↓
compute post_provider_precommit_audience_admission_hash
↓
canonical commit transaction
```

Inside canonical commit:

```text
BEGIN

verify StageExecution
verify DecisionCycle
verify lease/fencing
verify writable/FREEZING state

re-resolve exact:
- TaskContractRevision;
- tenant/workspace;
- trusted audience_knowledge_cutoff_time;
- RunConfig;
- Audience role binding;
- schema membership;
- SchemaDefinition revision/payload.

reconstruct PRE_PROVIDER_MANIFEST_CORE
↓
recompute canonical_input_hash
↓
compare to the finalized StageExecution value

Do not hash the envelope's stored hash field.

Then from the exact proposal being admitted:

re-run:
- structured Audience validation;
- factual traversal;
- classification;
- audience_field/fact_path;
- fact_value_hash;
- uncertainty coverage;
- basis-link validation;
- Task basis resolution;
- Proposition resolution;
- EpistemicStateVersion resolution;
- cutoff/valid-time/scope checks;
- exactly-one projection rule;
- projection inputs;
- PropositionSemanticIdentity construction;
- SPEC03 evaluateSemanticEquivalence;
- exact REUSE_EXISTING closure where required;
- full factual coverage.

recompute:

commit_time_audience_admission_hash

require:

commit_time_audience_admission_hash
==
post_provider_precommit_audience_admission_hash

if unequal:
FAIL CLOSED

only then:

insert AudienceState
insert AudienceFactBasisLink rows
write outbox

COMMIT
```

Provider calls remain outside DB transaction.

AudienceState and its factual-basis links for one canonical admission are committed atomically.

A failed provenance, projection, semantic-closure, cutoff, uncertainty-coverage, or factual-coverage check creates no partially admitted release-eligible AudienceState.

---

# 124. Strategy Write Transaction

```text
BEGIN

verify Task
verify FINAL_FOR_DECISION AudienceState
verify required Proposition refs
validate assumptions/unknowns
validate structured StrategyHypothesis
insert immutable StrategyHypothesis
write outbox event

COMMIT
```

Strategy Gate runs as a deterministic stage after insertion.

---

# 125. Architecture Write Transaction

```text
BEGIN

verify Strategy Gate = PROCEED
verify task/strategy closure
verify unit ordering
verify proposition refs
validate architecture/unit structures
insert ContentUnits
insert ContentArchitecture
write outbox event

COMMIT
```

Cross-store object payload protocols follow SPEC01/02 when applicable.

---

# 126. Candidate Write Transaction

```text
BEGIN

verify stage fencing
verify task/strategy/architecture closure
verify exact run_config_id
verify candidate payload schema
verify canonical input identity
insert immutable ContentCandidate
write outbox event

COMMIT
```

---

# 127. Candidate Rewrite Transaction

```text
BEGIN

verify parent candidate if supplied
verify new current task/strategy/architecture/run_config refs
verify payload
insert new ContentCandidate
write outbox event

COMMIT
```

Never update parent candidate.

---

# 128. Provider Calls Outside Transactions

LLM/tool/provider work occurs outside database transactions.

Canonical pattern:

```text
claim stage
↓
read immutable inputs
↓
construct exact derivation/generation manifest
↓
provider call
↓
validate output
↓
short fenced commit
```

For audience derivation, provider output may propose only basis refs already present in the exact trusted manifest.

---

# 129. Provider Timeout

Timeout does not authorize fallback to invented content.

Allowed:

```text
retry
alternate pinned provider/config if RunConfig permits
fail stage
human workflow
```

No silent unpinned model switch.

---

# 130. Model Configuration Failure

If the pinned model/config is unavailable:

```text
do not substitute latest/current config
```

Use only an explicitly permitted pinned fallback already represented in the runtime configuration contract.

Otherwise fail.

---

# 131. Determinism Boundary

Content text itself may be nondeterministic.

The following must remain deterministic/reconstructable:

```text
input selection
reference resolution
audience factual-basis eligibility
fact-path/hash verification
gate rules
schema validation
RunConfig selection
task/strategy/architecture closure
fencing
idempotency identity
```

---

# 132. Observability

Every SPEC05 stage should emit:

```text
run_id
decision_cycle_id
stage_execution_id
task_revision_id
audience_state_id when relevant
strategy_id when relevant
architecture_id when relevant
candidate_id when relevant
run_config_id
canonical_input_hash
pinned revision refs
provider result class
duration
retry count
reason codes
fencing metadata
```

Audience stages should additionally make reconstructable:

```text
accepted factual-basis ref identities
rejected factual-basis reason codes
```

without logging sensitive raw payloads unnecessarily.

---

# 133. Audit Trace

For one Candidate, an auditor must be able to traverse:

```text
ContentCandidate
↓
task_revision_id
strategy_id
architecture_id
run_config_id
parent_candidate_id?
```

Then:

```text
StrategyHypothesis
↓
audience_state_id
required_proposition_ids
assumptions
unknowns
```

For a v1.0.2 AudienceState, the auditor can additionally traverse:

```text
AudienceState
↓
AudienceFactBasisLink[]
↓
exact Task audience-context basis
or
exact AUDIENCE EpistemicStateVersion
↓
exact Proposition
```

Then:

```text
ContentArchitecture
↓
unit_ids
↓
ContentUnits
↓
proposition_ids
```

and exact pinned generation configuration.

AudienceFactBasisLink does not become an alternative knowledge source. The underlying Task / Proposition / EpistemicState remains authoritative.

---

# 134. Historical Replay

Historical replay does not regenerate candidate text from a current model.

It reads the immutable ContentCandidate.

If generation provenance payload/config has been deleted lawfully:

```text
replayability degrades explicitly
```

The candidate history itself is not rewritten to pretend reproducibility.

Historical AudienceStates created before v1.0.2 are not backfilled to pretend they carried factual-basis links at creation time.

A later decision path requiring v1.0.2 audience admission guarantees must admit a conforming AudienceState rather than silently upgrading historical meaning.

---

# 135. Reproduction vs Replay

Distinguish:

```text
REPLAY
=
read historical immutable result

REPRODUCTION ATTEMPT
=
rerun generation with exact historical inputs/config
```

Provider nondeterminism may prevent byte-identical reproduction.

That does not change historical Candidate truth.

---

# 136. Candidate Comparison

Comparing candidates is allowed.

Final qualitative ranking/evaluation belongs to SPEC06.

SPEC05 may expose structural differences:

```text
strategy
architecture
word count
format
payload structure
```

without declaring final winner.

---

# 137. Generation Heuristics

Heuristics may help generate:

```text
hooks
proof ordering
CTA styles
scene structures
```

They are Guidance-like runtime techniques unless formally represented upstream.

They may not act as hidden hard governance.

---

# 138. Template Use

Templates are permitted when pinned through runtime configuration.

Template content may shape expression.

A template may not silently override:

```text
Task
Strategy
Governance
RunConfig
```

---

# 139. Style Examples

Style examples are non-authoritative generation aids.

They must not introduce unsupported factual claims into the canonical candidate merely because the example contains them.

---

# 140. Language Handling

Candidate language must match:

```text
Task.language
```

unless Task explicitly permits multilingual output.

Translation that materially changes factual meaning requires downstream assertion validation like any other candidate.

---

# 141. Format Handling

Candidate format must match:

```text
Task.format
+
ChannelProfileRevision capability
```

Unsupported format:

```text
generation fails before canonical release path
```

---

# 142. Market / Jurisdiction Handling

Market/jurisdiction context affects:

```text
language
examples
claims
disclosures
governance
```

Generator may localize expression.

It may not localize away a hard applicable rule.

---

# 143. Brand/Product Identity

`brand_id` / `product_id` are task context.

Generator may not substitute another product/brand.

Unknown product details must remain unknown.

---

# 144. Metric Awareness

Success/guardrail metrics may influence strategy and candidate emphasis.

They do not prove that a candidate will perform.

No:

```text
"this candidate will win because metric X is target"
```

semantic leap.

---

# 145. Outcome Awareness

OutcomeModel can guide behavioral objective selection.

It does not guarantee causal success.

Strategy remains hypothesis.

---

# 146. Candidate Parent Semantics

`parent_candidate_id` expresses derivational lineage.

It does not imply:

```text
same validation status
same release eligibility
same architecture
same strategy
```

The new Candidate's own refs are authoritative.

---

# 147. No Candidate Mutation

The system must never update in place:

```text
content_payload
strategy_id
architecture_id
run_config_id
parent_candidate_id
```

of an existing ContentCandidate.

Correction = new Candidate.

---

# 148. No Architecture Mutation

The system must never update an existing ContentArchitecture to match a later candidate.

New architecture = new `architecture_id`.

---

# 149. No Strategy Mutation

The system must never edit a StrategyHypothesis after evaluation.

New strategy meaning = new `strategy_id`.

---

# 150. No Audience Mutation

New audience understanding = new `audience_state_id`.

Old audience state remains historical.

New audience provenance understanding also creates a new AudienceState admission.

Historical AudienceState payload or provenance is never rewritten merely to satisfy newer v1.0.2 rules.

---

# 151. Handoff Closure to SPEC06

A candidate may enter formal evaluation only when:

```text
candidate exists
task/strategy/architecture/run_config closure passes
candidate payload parses
candidate belongs to writable/valid decision path
```

SPEC06 then performs content assertion/evaluation closure.

---

# 152. Fixed Adversarial Test Suite

The following suite is locked for SPEC05 v1.0 audit.

```text
01 PROVISIONAL AudienceState used as final release audience
02 REFINED AudienceState used as FINAL_FOR_DECISION without new object
03 AudienceState mutated after research
04 AudienceState bound to wrong task
05 audience unknown converted to confident fact
06 hidden model knowledge enters audience origin
07 audience refinement changes jurisdiction but governance not refreshed
08 multiple audience states resolved through CURRENT pointer
09 future knowledge imported into final audience
10 cross-tenant audience context leakage

11 strategy bound to wrong task
12 strategy bound to non-final audience
13 factual premise hidden outside required_proposition_ids
14 required proposition missing decision-time EpistemicState
15 contradicted required factual proposition passes gate
16 insufficient required factual proposition passes gate
17 unresolved blocking KnowledgeGap passes gate
18 applicable non-overridable rule ignored by gate
19 assumptions silently converted to facts
20 unknowns omitted to force gate pass

21 Strategy Gate implemented as unpinned model judgment
22 Strategy Gate missing input defaults to PROCEED
23 Strategy Gate reads hidden post-boundary state
24 blocked Strategy directly generates architecture
25 human/model changes gate reason without input change
26 strategy risk hypothesis treated as RiskAssessment
27 strategy performance hypothesis treated as fact
28 strategy uses current Guidance instead of pinned applicability
29 strategy generator switches to unpinned model
30 compute budget bypasses Strategy Gate

31 architecture task differs from strategy task
32 architecture strategy_id mismatches admitted strategy
33 architecture mutated in place
34 duplicate unit positions create ambiguous order
35 unit introduces unsupported factual proposition silently
36 supplemental proposition materially changes strategy without new Strategy
37 unit audience transition treated as canonical AudienceState mutation
38 architecture receives unrestricted tenant datastore
39 architecture uses stale governance constraints
40 architecture uses unsupported channel format

41 candidate task differs from architecture/strategy
42 candidate strategy differs from architecture strategy
43 candidate architecture ref is stale after material architecture change
44 candidate run_config_id differs from snapshot RunConfig
45 candidate uses latest prompt/model after run start
46 rewrite mutates existing Candidate
47 rewrite inherits prior validation as final truth
48 candidate parent lineage used as release eligibility
49 candidate generated from blocked strategy
50 candidate payload malformed but stored canonical

51 candidate invents product fact
52 candidate invents statistic
53 candidate turns assumption into certainty
54 candidate turns unknown into certainty
55 candidate treats Guidance as hard law
56 candidate weakens hard governance requirement
57 candidate source prompt injection changes system instructions
58 untrusted source grants itself tool authority
59 source blocked for generation input enters prompt context
60 candidate generation performs external publication side effect

61 exact retry creates duplicate candidate in same variant slot
62 intentional two-variant generation incorrectly deduplicates variants
63 strategy exact retry creates duplicate strategy slot
64 architecture exact retry creates accidental duplicate
65 stale worker commits candidate after lease takeover
66 stale worker commits candidate after cycle cancellation
67 stale worker commits architecture after cycle supersession
68 late provider result commits after FREEZING
69 generation uses different tenant private data
70 cache hit reused after material input change

71 new information changes audience but downstream candidate not regenerated/revalidated
72 governance change after candidate ignored
73 strategy change keeps old architecture/candidate refs
74 architecture change keeps old candidate architecture ref
75 qualification repair mutates old Candidate
76 human rewrite adds factual information without upstream knowledge path
77 candidate self-certifies claim as supported
78 generation-time heuristic declares READY
79 historical replay regenerates candidate with current model
80 runtime generation directly mutates Control Plane
```

## AV05 Exact Semantic Closure

Vector 05 must be tested through the actual audience canonical-admission path.

The semantic projection used by the test MUST come from the exact pinned `SchemaDefinition` revision, not from test-only/provider/caller semantic fields.

### AV05 negative case A — no factual basis

Given a valid prior audience context where one factual leaf is unresolved, attempt to admit a later `FINAL_FOR_DECISION` AudienceState that:

```text
expresses that leaf as a confident factual audience value
removes the corresponding path-bound uncertainty
has valid Task identity
has valid stage progression
has valid StageExecution/fencing
uses the exact pinned schema/config
but
has no eligible typed factual-basis link
```

Expected:

```text
FAIL CLOSED
```

for the exact unsupported-certainty reason.

### AV05 negative case B — semantically unrelated supported Proposition

Provide an exact decision-time:

```text
SUPPORTED
AUDIENCE Proposition
```

and an otherwise-valid EPISTEMIC basis link, but make the linked Proposition's frozen semantic identity differ materially from the identity deterministically projected for the asserted audience leaf by the exact pinned projection rule.

All IDs, tenant/workspace scope, cutoff timing and FK closure are otherwise valid.

Expected:

```text
FAIL CLOSED
```

because the existing SPEC03 resolver does not return:

```text
REUSE_EXISTING
```

for the exact projected identity versus the exact linked Proposition identity.

The same vector MUST also prove that provider/caller-supplied semantic fields cannot override the pinned projection rule.

If no projection rule matches or multiple rules match:

```text
FAIL CLOSED
```

rather than allowing the provider/test fixture to invent the nine semantic identity fields.

### AV05 negative case B2 — missing / ambiguous / non-member / hidden-default Audience schema role binding

Construct a RunConfig / runtime attempt where any of the following holds:

```text
zero CONTENT_INTELLIGENCE_AUDIENCE RunConfigSchemaRoleBinding rows
or
multiple CONTENT_INTELLIGENCE_AUDIENCE binding rows
or
binding entity_type != SchemaDefinition
or
binding target is not an exact member of RunConfig.schema_revision_refs
or
runtime chooses a SchemaDefinition by iteration order / ad-hoc payload discovery / local default / CURRENT-LATEST lookup
or
caller/provider attempts to replace the canonical role binding
```

Expected:

```text
FAIL CLOSED
```

This is a role-selection subcase of frozen AV05 and does not add a new adversarial vector.


### AV05 negative case C — caller/provider widens cutoff

Construct provider output using an EpistemicStateVersion known only after the trusted runtime's recorded:

```text
audience_knowledge_cutoff_time
```

Expected:

```text
FAIL CLOSED
```

even if the caller/provider supplies a later cutoff assertion.

### AV05 negative case D — two-phase hash forgery and authority violations

The provider or caller attempts to forge hash identity or assert authoritative projection decisions before trusted admission validation.

**Subcases (MUST FAIL CLOSED):**
- implementation attempts to verify canonical_input_hash by hashing an envelope containing that same hash field (INVALID IMPLEMENTATION CONTRACT)
- forged caller/provider `canonical_input_hash` (mismatch against reconstructed pre-provider manifest)
- forged caller/provider `audience_admission_hash` (mismatch against reconstructed trusted admission)
- provider attempts to select projection rule (authoritative selection belongs solely to runtime)
- provider supplies projected semantic identity (authoritative construction belongs solely to runtime)
- provider supplies `REUSE_EXISTING` semantic outcome (authoritative validation belongs solely to runtime)
- provider changes factual leaf but reuses prior admission hash (admission hash mismatch)
- commit-time canonical authority differs from post-provider authority (commit-time revalidation failure)
- commit-time admission hash differs from pre-commit validation (commit-time revalidation failure)

---

### AV05 positive control

Demonstrates that full semantic projection and two-phase hash integration correctly generate factual claims that pass ALL strict post-provider validations.

Required assertions:
- canonical pre-provider context is constructed
- `StageExecution.canonical_input_hash` is finalized
- provider-generated proposal is returned
- trusted post-provider admission resolution validates all claims and projection rules
- `audience_admission_hash` is computed
- commit-time canonical reconstruction occurs
- same `audience_admission_hash` is verified at commit
- canonical Audience admission PASS

Expected for freeze:

```text
80 / 80
PRESERVE INVARIANTS
```

No additional adversarial vector is added. These are exact subcases of locked Vector 05.

No additional freeze blocker may be introduced after suite lock unless a concrete contradiction against Blueprint v2.13.1 or SPEC01–04 frozen contracts is demonstrated.

---

# 153. Static Contract Preflight

SPEC05 freeze audit must check exactly:

```text
01 no new canonical domain entity invented
02 Strategy Gate remains a deterministic process, not canonical entity
03 AudienceState stages preserved
04 AudienceState remains immutable
05 final release uses FINAL_FOR_DECISION audience
06 AudienceState task binding preserved
07 StrategyHypothesis schema ownership preserved
08 Strategy factual bases map to required propositions or explicit assumptions/unknowns
09 blocking-gap Strategy Gate preserved
10 required-proposition EpistemicState gate preserved
11 contradicted/insufficient factual-proof gate preserved
12 governance Strategy Gate preserved
13 Strategy Gate fails closed
14 ContentArchitecture remains immutable
15 architecture task/strategy closure preserved
16 ContentUnit proposition refs preserved
17 unit ordering unambiguous
18 supplemental proposition cannot become hidden strategy change
19 ContentCandidate remains immutable
20 rewrite creates new candidate_id
21 candidate task/strategy/architecture closure preserved
22 candidate run_config_id closure preserved
23 no CURRENT/LATEST/ACTIVE generation config lookup
24 provider/tool configs pinned
25 source instructions remain untrusted data
26 generation has no external side-effect authority
27 FREEZING blocks late content-intelligence commits
28 stale-worker fencing preserved
29 tenant isolation preserved
30 Candidate is not Evidence / Decision / PublishedArtifact
31 SPEC06 owns formal assertion/evaluation behavior
32 no duplicated source of content decision truth
```

Freeze target:

```text
32 / 32 PASS
```

---

# 154. Acceptance Criteria

SPEC05 is freeze-eligible only if:

```text
1.
AudienceState remains immutable.

2.
Normal release strategy uses FINAL_FOR_DECISION AudienceState.

3.
Audience uncertainty remains explicit.

For v1.0.5 this additionally requires:
- every factual leaf on the defined Audience factual-state surfaces is deterministically covered;
- provider/caller materiality classification cannot exempt a factual leaf;
- unsupported confident audience facts fail closed;
- uncertainty used for coverage preserves existing `kind`/`description` semantics and carries exact `audience_field + fact_path + UNRESOLVED` binding under the pinned schema;
- exactly one normalized `RunConfigSchemaRoleBinding(role = CONTENT_INTELLIGENCE_AUDIENCE)` selects the Audience schema role;
- the role-binding target is an exact relational member of `RunConfig.schema_revision_refs` and has `entity_type = SchemaDefinition`;
- zero/multiple bindings, non-membership, hidden/default selection, CURRENT/LATEST/ACTIVE lookup, or provider/caller override fails closed;
- the exact role-bound SchemaDefinition revision owns traversal, classification, uncertainty coverage, and Audience semantic-projection rules;
- an EPISTEMIC-backed factual leaf must match exactly one projection rule;
- the projection deterministically emits all nine frozen SPEC03 PropositionSemanticIdentity fields with `propositionType = AUDIENCE`;
- provider/caller cannot supply or override the projected semantic identity;
- the existing SPEC03 `evaluateSemanticEquivalence` remains the sole semantic-equivalence authority;
- confident admission requires `REUSE_EXISTING` against the exact linked Proposition;
- no fabricated semantic-resolver config/revision is required;
- future/post-cutoff knowledge cannot resolve uncertainty;
- legitimately resolved uncertainty may disappear only when the resulting factual value has eligible typed canonical basis;
- StageExecution.canonical_input_hash contains only pre-provider-known material inputs;
- it is finalized before provider invocation;
- provider output cannot mutate it;
- generated-leaf-specific projection/admission state is excluded from it;
- trusted runtime computes audience_admission_hash only after provider output;
- provider/caller hashes are non-authoritative;
- commit-time canonical admission is fully re-resolved;
- commit-time audience_admission_hash must equal the trusted post-provider precommit hash;
- mismatch fails closed;
- no hidden authority DTO can substitute for canonical reconstruction;
- canonical_input_hash hashes an exact deterministic pre-provider manifest core;
- the hash field is excluded from its own hash input;
- the final manifest envelope may record the resulting hash only after computation;
- self-referential/fixed-point hashing is forbidden.

4.
Audience changes create new immutable state.

5.
StrategyHypothesis is grounded in exact decision state.

6.
Material factual strategy premises resolve to required propositions or explicit assumptions/unknowns.

7.
Strategy Gate is deterministic and fail-closed.

8.
Blocking KnowledgeGap cannot pass the gate.

9.
Missing decision-time EpistemicState cannot pass required proposition gating.

10.
Contradicted/insufficient factual proof cannot pass as supported strategy proof.

11.
Applicable non-overridable governance can block Strategy.

12.
ContentArchitecture is generated only from admitted Strategy.

13.
Architecture remains immutable.

14.
ContentUnit ordering and proposition references are explicit.

15.
Material architecture-level strategy change creates a new StrategyHypothesis path.

16.
ContentCandidate is immutable.

17.
Rewrite creates a new candidate_id.

18.
Candidate task/strategy/architecture references are consistent.

19.
Candidate run_config_id is exact and pinned.

20.
No generation stage resolves CURRENT/LATEST/ACTIVE config.

21.
Unknowns/assumptions cannot silently become facts.

22.
Untrusted source content cannot change instruction authority.

23.
Generation cannot self-grant tool authority.

24.
Generation cannot perform publication/external consequential side effects.

25.
Retries are idempotent without collapsing intentional variants.

26.
Stale workers cannot commit.

27.
FREEZING blocks late decision-input generation writes.

28.
Cross-tenant data cannot enter generation context.

29.
New information causes affected downstream state to be regenerated/revalidated.

30.
SPEC06 remains the owner of formal assertion/evaluation closure.

31.
The 80-test adversarial suite passes.

32.
The 32-check static preflight passes.
```

---

# 154A. v1.0.1 Patch Closure

This patch changes only the two demonstrated v1.0 blockers:

```text
1. Supplemental factual Propositions introduced by Architecture
   must pass the same factual-proof admission rule as Strategy Gate.

2. Architecture generation MUST NOT receive the unrestricted datastore;
   injected context must be explicitly scoped and decision-relevant.
```

The locked audit suite remains exactly:

```text
80 adversarial tests
32 static preflight checks
```

No new freeze criterion is introduced by v1.0.1.

---

# 154B. v1.0.2 Patch Closure

v1.0.2 changes only the demonstrated under-specification exposed by exact semantic execution of:

```text
AV05 — audience unknown converted to confident fact
```

The demonstrated problem was:

```text
v1.0.1 required uncertainty preservation
and prohibited no-evidence → confident audience truth

but

AudienceState factual payloads were opaque
and origin did not provide a mechanically enforceable
fact-to-canonical-basis relation.
```

v1.0.2 closes that gap by defining:

```text
structured factual-leaf uncertainty coverage

AudienceFactBasisLink
as normalized supporting enforcement infrastructure
with exactly-one typed basis branch

exact fact path/value hashing

closed sufficient basis classes:
  TASK_AUDIENCE_CONTEXT
  AUDIENCE_EPISTEMIC_STATE

trusted stage-local audience_knowledge_cutoff_time
captured before provider invocation

exact derivation-manifest membership

pinned audience payload/schema classification
with factual-by-default leaf coverage

derived non-authoritative AudienceFactClaim

pinned SPEC03 semantic resolution requiring:
  REUSE_EXISTING
  to the exact linked AUDIENCE proposition_id

scope/time/tenant/workspace checks

fail-closed factual-basis admission
```

It does NOT:

```text
create a new canonical intelligence entity
change the AudienceState top-level schema
create a second knowledge truth store
change Proposition semantic identity
change EpistemicState derivation semantics
allow provider-selected semantic equivalence
allow provider-selected temporal cutoff
create AudienceState supersession
create a mutable current audience pointer
change Strategy Gate ownership
change SPEC06 ownership
add audit-suite cases
```

The locked suite remains exactly:

```text
80 adversarial tests
32 static preflight checks
32 acceptance criteria
```

---

# 154C. v1.0.3 Patch Closure

v1.0.3 changes only the demonstrated implementation boundary discovered after v1.0.2 was frozen:

```text
v1.0.2 required AudienceFactClaim semantic closure

but

current SPEC03 implementation accepts only a complete
PropositionSemanticIdentity

and

current AudienceState factual surfaces are opaque JsonValue
with no canonical leaf -> nine-field semantic projection contract.
```

Repository inspection also demonstrated that:

```text
SPEC03 already owns deterministic semantic comparison
through evaluateSemanticEquivalence(...)

existing Control Plane SchemaDefinition revisions
and RunConfig schema pins can own the missing projection configuration

there is no existing separate semantic-resolver config revision
```

v1.0.3 therefore closes exactly these representation gaps:

```text
1. AudienceSemanticProjectionSchema
   is defined as a logical section of the existing immutable SchemaDefinition payload.

2. Each EPISTEMIC-backed factual leaf must match exactly one pinned declarative projection rule.

3. The rule deterministically emits all nine existing SPEC03 PropositionSemanticIdentity fields.

4. propositionType is fixed to AUDIENCE.

5. Projection inputs are restricted to the exact leaf plus explicit Task market/jurisdiction/audience-context values authorized by the rule.

6. Existing SPEC03 evaluateSemanticEquivalence remains unchanged and authoritative.

7. v1.0.2's requirement for a separate pinned semantic-resolver/config revision is superseded; no fake resolver revision is invented.

8. AudienceState.uncertainty coverage uses the existing kind/description/blocking shape plus exact audience_field/fact_path/status binding under the pinned schema.
```

It does NOT:

```text
change PropositionSemanticIdentity
change SPEC03 resolver semantics
create a second semantic resolver
create a new canonical config entity
change the AudienceState top-level schema
allow provider-authored semantic identity
allow caller-authored semantic identity
change v1.0.2 typed basis classes
change v1.0.2 trusted cutoff authority
add adversarial vectors
add preflight checks
add acceptance criteria
```

The locked suite remains exactly:

```text
80 adversarial tests
32 static preflight checks
32 acceptance criteria
```

---

# 154D. v1.0.4 Patch Closure

v1.0.4 changes only the deterministic role-selection gap found by independent re-audit of v1.0.3:

```text
v1.0.3 correctly required one exact pinned SchemaDefinition revision
for Audience traversal / uncertainty / semantic projection

but

RunConfig.schema_revision_refs is a set
and v1.0.3 named content_intelligence.schema_revision_id
without defining a canonical normalized role-binding contract.

Therefore a runtime could still choose one of multiple pinned SchemaDefinition revisions
through hidden application wiring / iteration order / local default
and only record that chosen revision after the fact.
```

The re-audit also confirmed frozen SPEC02 §9 requires `runtime_parameters` not to hide canonical entity IDs that should be relational references and not to become an alternate source of truth for relationally modeled fields.

v1.0.4 therefore closes the role-selection gap with normalized supporting infrastructure rather than an opaque runtime-parameter reference:

```text
RunConfigSchemaRoleBinding(
    run_config_id,
    role = CONTENT_INTELLIGENCE_AUDIENCE,
    exact SchemaDefinition RevisionRef fields
)
```

Required closure:

```text
PRIMARY KEY(run_config_id, role)
+
immutable complete-at-RunConfig-creation binding state
+
exact FK to RunConfig
+
exact FK/membership to normalized RunConfig.schema_revision_refs
+
entity_type = SchemaDefinition
+
exact immutable RegisteredControlPlaneRevision payload binding
+
exact tenant/workspace closure where applicable
+
role-binding tuple included in derivation manifest and canonical_input_hash
+
pre-provider and commit-time equality re-check
```

It explicitly forbids:

```text
CURRENT/LATEST/ACTIVE schema selection
application-local default schema
first-member / iteration-order selection
ad-hoc payload discovery as role selection
provider/caller role override
environment override
fallback to another pinned schema member
hidden canonical SchemaDefinition IDs/refs in runtime_parameters
```

It does NOT:

```text
add a RunConfig top-level field
create a new canonical domain/config/knowledge entity
change RunConfig.schema_revision_refs ownership of pinned schema membership
change SchemaDefinition identity
change PropositionSemanticIdentity
change SPEC03 resolver semantics
change v1.0.3 projection grammar
change v1.0.3 uncertainty shape
change v1.0.2 typed basis or temporal cutoff semantics
add adversarial vectors
add static preflight checks
add acceptance criteria
```

The locked suite remains exactly:

```text
80 adversarial tests
32 static preflight checks
32 acceptance criteria
```

---


# 154E. v1.0.5 Patch Closure

v1.0.5 changes only the temporal circular dependency found by independent re-audit of v1.0.4 regarding `canonical_input_hash` semantics:

**Demonstrated Contradiction:**
v1.0.4 required `canonical_input_hash` to be computed *before* provider invocation, but also required it to include generated-leaf-specific values (e.g. selected semantic projection rule_id) that only exist *after* provider invocation. This forced the hash to serve as both pre-provider input identity and post-provider admission identity.

v1.0.5 therefore closes this circular dependency with explicit two-phase hash semantics:
1. `StageExecution.canonical_input_hash`: Strictly represents pre-provider material stage input identity.
2. `audience_admission_hash`: Strictly represents post-provider trusted audience admission identity.

The two-phase-hash patch also makes the pre-provider hash serialization mechanically non-self-referential:
manifest core → canonical_input_hash → sealed manifest envelope.

- all unrelated v1.0.4 closures remain preserved;
- v1.0.5 supersedes ONLY the v1.0.4 clauses that require generated-leaf-specific/post-provider admission values inside the pre-provider StageExecution.canonical_input_hash;
- those values now belong to audience_admission_hash;
- RunConfigSchemaRoleBinding, projection authority, uncertainty, basis, cutoff, fencing and SPEC03 resolver ownership remain unchanged.

# 155. Verification Record — v1.0.5 Freeze Candidate

```text
STATUS
FREEZE CANDIDATE

PATCH BASE
SPEC05 v1.0.4 — FROZEN

PATCH BASE SHA256
25c5c0ec1513c77c72773cf25b32ac085f3bb1412165a02d1dfb9619efd36c95

DEMONSTRATED PATCH TARGET
two-phase hash temporal circularity

INTERNAL SELF-AUDIT
PASS

EXTERNAL RE-AUDIT
PENDING

READY FOR EXTERNAL RE-AUDIT
YES

FROZEN?
NO

INTERNAL KNOWN BLOCKERS
0
```

Required implementation evidence after freeze and implementation:

```text
AV05 negative A
unsupported certainty rejected for exact reason

AV05 negative B
pinned projection vs semantically unrelated SUPPORTED AUDIENCE Proposition rejected
provider/caller semantic override rejected
missing/ambiguous projection rule rejected
zero/multiple/non-member/wrong-type Audience schema role binding rejected
hidden/default/current/latest/iteration-order schema selection rejected

AV05 negative C
post-cutoff/future EpistemicState rejected

AV05 positive control
eligible typed basis
+
exact pinned projection
+
existing SPEC03 REUSE_EXISTING
+
trusted temporal closure
succeeds

AC03
exact path-bound uncertainty and confidence-resolution semantics proven

FIXED ADVERSARIAL SUITE
80 / 80 semantic production-path PASS

STATIC PREFLIGHT
32 / 32 PASS

ACCEPTANCE
32 / 32 semantic PASS
```

No implementation result is claimed by this specification candidate.

v1.0.1 and v1.0.2 remain immutable historical frozen specifications.

No open-ended architecture expansion is authorized by this patch.

---

# 156. Canonical V1 Content Runtime

```text
TaskContractRevision
↓
PROVISIONAL AudienceState
↓
Research / Knowledge refinement
↓
REFINED AudienceState
↓
Governance refresh if dependencies changed
↓
FINAL_FOR_DECISION AudienceState
with:
    explicit unresolved uncertainty
    +
    attributable confident factual basis
↓
StrategyHypothesis[]
↓
Deterministic Strategy Gate
↓
admitted StrategyHypothesis[]
↓
ContentArchitecture
↓
ContentUnit[]
↓
ContentCandidate[]
↓
SPEC06 Evaluation Framework
```

---

# 157. Candidate Rewrite Loop

```text
Candidate C1
↓
SPEC06 feedback / governance feedback / human revision
↓
rewrite request
↓
Candidate C2
(parent_candidate_id = C1 when appropriate)
↓
SPEC06 evaluates C2
```

No mutation of C1.

---

# 158. Final Doctrine

```text
AUDIENCE IS STATE,
NOT A PROMPT PARAGRAPH.

AUDIENCE CERTAINTY
REQUIRES ATTRIBUTABLE BASIS.

STRATEGY IS A HYPOTHESIS,
NOT A GUARANTEE.

GATE BEFORE ARCHITECTURE.

ARCHITECTURE BEFORE COPY.

PIN EVERY RUNTIME CONFIG.

GENERATE FROM
EXACT DECISION STATE.

MODEL OUTPUT
MAY BE CREATIVE.

DECISION INPUT
MAY NOT BE INVENTED.

UNKNOWN STAYS UNKNOWN
UNTIL EXACT TYPED CANONICAL BASIS
+
SEMANTIC CLOSURE
+
TRUSTED TEMPORAL CLOSURE
RESOLVE IT.

ASSUMPTION STAYS ASSUMPTION.

GOVERNANCE SURVIVES GENERATION.

REWRITE
MEANS NEW CANDIDATE.

CANDIDATE
IS NOT EVIDENCE.

CANDIDATE
IS NOT RELEASE AUTHORIZATION.

SPEC06
EVALUATES WHAT WAS ACTUALLY GENERATED.

NO HIDDEN STATE.
NO STALE WORKER.
NO CURRENT LOOKUP.
NO MUTABLE HISTORY.

LOCK THE SUITE.
AUDIT IT.
THEN FREEZE.
```

---

**End of ContentOS SPEC 05 — Content Intelligence Runtime v1.0.5 — FREEZE_CANDIDATE**
