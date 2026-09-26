# ContentOS SPEC 05 — Content Intelligence Runtime
## Audience, Strategy, Architecture & Candidate Generation Runtime
### Version 1.0.1 — Frozen Content Intelligence Runtime

---

# 0. Status

```text
SPEC
SPEC 05 — CONTENT INTELLIGENCE RUNTIME

VERSION
1.0.1

SOURCE OF TRUTH
ContentOS Blueprint v2.13.1 — FROZEN
ContentOS SPEC 01 v1.1.3 — FROZEN
ContentOS SPEC 02 v1.0.6 — FROZEN
ContentOS SPEC 03 v1.0.1 — FROZEN
ContentOS SPEC 04 v1.0.2 — FROZEN

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

SPEC05 defines runtime behavior.

It does not change frozen schemas.

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

It does not decide whether a claim is supported enough for release.

---

# 3. Content Runtime Doctrine

```text
UPSTREAM DECIDES WHAT.

WRITER DECIDES
HOW TO EXPRESS IT.

AUDIENCE STATE
IS EXPLICIT.

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
MUST REMAIN UNKNOWN.

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

`origin` must identify the canonical basis used to derive the audience state sufficiently for audit.

Possible basis includes:

```text
Task.audience_context
authorized user input
EvidenceItems
Propositions
EpistemicStateVersions
ResearchTrace results
historical public/tenant knowledge
```

The runtime must not invent hidden research and then summarize it as `origin`.

---

# 10. AudienceState Uncertainty

`uncertainty` must preserve material unknowns such as:

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
uncertainty preservation
pinned model/prompt config
```

A plausible audience narrative is not enough.

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

SPEC05 does not attempt to prove every generated claim before generation.

Instead:

```text
generation is constrained by grounded context
+
SPEC06 extracts and validates actual Assertions
```

If the generator nevertheless creates an unsupported claim:

```text
SPEC06 must catch it
```

and release gates remain closed.

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

If decision-relevant input changes materially:

```text
new AudienceState
```

not a retry.

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

This is not a new canonical domain entity.

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

```text
BEGIN

verify task revision
verify tenant/workspace scope
verify stage inputs / canonical input hash
validate structured AudienceState
validate origin/uncertainty
insert immutable AudienceState
write outbox event

COMMIT
```

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
provider call
↓
validate output
↓
short fenced commit
```

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

Avoid logging sensitive full prompt payloads by default.

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

---

# 134. Historical Replay

Historical replay does not regenerate candidate text from a current model.

It reads the immutable ContentCandidate.

If generation provenance payload/config has been deleted lawfully:

```text
replayability degrades explicitly
```

The candidate history itself is not rewritten to pretend reproducibility.

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

Expected for freeze:

```text
80 / 80
PRESERVE INVARIANTS
```

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

# 155. Verification Record — Final Freeze

```text
STATUS
FROZEN

FIXED ADVERSARIAL SUITE
80 / 80 PASS

STATIC PREFLIGHT
32 / 32 PASS

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

UNKNOWN STAYS UNKNOWN.

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

**End of ContentOS SPEC 05 — Content Intelligence Runtime v1.0.1 — FROZEN**
