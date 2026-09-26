# ContentOS SPEC 01 — System Architecture
## Implementation Architecture for Blueprint v2.13.1 FROZEN
### Version 1.1.3 — Frozen System Architecture

---

# 0. Status

```text
SPEC
SPEC 01 — SYSTEM ARCHITECTURE

VERSION
1.1.3

SOURCE OF TRUTH
ContentOS Blueprint v2.13.1 — FROZEN

SUPERSEDES
SPEC 01 v1.1.2

STATUS
FROZEN
```

SPEC01 v1.1.3 preserves the system topology of v1.1.2 and restores Blueprint-consistent stage-local temporal cutoffs while retaining the proven freeze/fencing model.

It exists to close:

```text
ATOMIC RUN INITIALIZATION

IMMUTABLE RUN-KNOWLEDGE LIFECYCLE

IMMUTABLE GOVERNANCE-SNAPSHOT LIFECYCLE

CONCURRENT STAGE EXECUTION

STALE WORKER WRITES

DECISION-CYCLE ISOLATION

SNAPSHOT FREEZE BARRIER

POLICY-RESULT COMPLETENESS

OBJECT-STORE / DATABASE DURABILITY

EVENT CONSUMER DEDUPLICATION

CONTROL-PLANE ACTIVATION AMBIGUITY

TENANT ISOLATION MODE
```

If this SPEC conflicts with Blueprint v2.13.1:

```text
BLUEPRINT WINS
```

---

# 1. Purpose

SPEC01 defines:

```text
system boundaries

logical modules

physical deployment baseline

Control Plane

Runtime Plane

Data Plane

workflow execution

run lifecycle

decision-cycle lifecycle

transaction boundaries

concurrency control

leases / fencing

idempotency

retry / recovery

snapshot freezing

policy completeness

event delivery

cross-store durability

security zones

observability

replay architecture

scaling rules
```

It does not redefine ContentOS domain semantics.

---

# 2. Architectural Principle

ContentOS V1 prioritizes:

```text
CORRECTNESS
>
AVAILABILITY
>
THROUGHPUT
```

at decision-critical boundaries.

The implementation MUST preserve:

```text
immutable historical state

exact immutable references

exact revision references

append-only domain history

deterministic decision boundaries

fail-closed governance

no hidden runtime state

no stale-worker commits

no duplicate business history

no silent current-state lookup
```

---

# 3. V1 Architecture Style

V1 uses:

```text
MODULAR MONOLITH

+

DURABLE WORKFLOW EXECUTION

+

TRANSACTIONAL RELATIONAL DATABASE

+

IMMUTABLE OBJECT STORAGE

+

DURABLE QUEUE

+

TRANSACTIONAL OUTBOX
```

Microservices are not required for V1.

Logical module boundaries MUST exist even when deployed in one application.

---

# 4. High-Level Topology

```text
                       ┌─────────────────────┐
                       │      CLIENTS        │
                       │ UI / API / Operator │
                       └─────────┬───────────┘
                                 │
                                 ▼
                       ┌─────────────────────┐
                       │      API LAYER      │
                       │ Auth / Validation   │
                       └─────────┬───────────┘
                                 │
                                 ▼
                ┌────────────────────────────────┐
                │         CONTENTOS CORE         │
                │                                │
                │  ┌──────────────────────────┐  │
                │  │ Durable Run Orchestrator │  │
                │  └─────────────┬────────────┘  │
                │                │               │
                │  ┌─────────────▼────────────┐  │
                │  │      Domain Modules      │  │
                │  └─────────────┬────────────┘  │
                │                │               │
                │  ┌─────────────▼────────────┐  │
                │  │ Closure / Policy Gates   │  │
                │  └──────────────────────────┘  │
                └───────┬──────────┬─────────────┘
                        │          │
              ┌─────────▼───┐   ┌──▼───────────────┐
              │ Relational  │   │ Immutable Object │
              │ Database    │   │ Storage          │
              └──────┬──────┘   └──────────────────┘
                     │
                     ▼
               ┌────────────┐
               │ Durable    │
               │ Queue      │
               └─────┬──────┘
                     │
          ┌──────────┼──────────────┐
          ▼          ▼              ▼
       Research   Model/Eval    Measurement
       Workers     Workers        Workers
```

---

# 5. Logical Planes

```text
CONTROL PLANE

RUNTIME PLANE

DATA PLANE

OPERATIONS / OBSERVABILITY PLANE
```

---

# 6. Control Plane

Control Plane owns immutable revisions for:

```text
ContentProgram

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

RightsPolicy activation state
```

Runtime may read pinned revisions.

Runtime may create:

```text
ChangeProposal
```

Runtime may not activate a replacement revision governing the same run.

---

# 7. Control-Plane Activation Registry

Operational activation state:

```text
ControlPlaneActivation

activation_id

deployment_scope

component_type

stable_id

active_revision_id

effective_from

effective_until?

created_at
```

This operational registry is mutable through controlled Control Plane actions.

Historical runs do not reference it directly after initialization.

---

# 8. Deterministic Activation Resolution

At one effective instant and one scope:

```text
deployment_scope
+
component_type
+
stable_id
```

MUST resolve to:

```text
ZERO OR ONE ACTIVE REVISION
```

Never:

```text
TWO ACTIVE REVISIONS
```

when single-active semantics apply.

If activation resolution is ambiguous:

```text
RUN_INITIALIZATION_FAILED
```

The system MUST NOT arbitrarily select one.

---

# 9. Activation Constraints

Where supported, enforce non-overlapping active intervals.

Conceptually:

```text
NO OVERLAPPING ACTIVE INTERVALS

FOR SAME:
scope
component_type
stable_id
```

Detailed database representation belongs to SPEC02.

---

# 10. Runtime Plane

Runtime logical modules:

```text
Task Service

Run Initializer

Workflow Orchestrator

Audience Module

Knowledge Gap Module

Research Module

Retrieval Gateway

Evidence Module

Proposition Module

Evidence Assessment Module

Epistemic Module

Governance Applicability Module

Strategy Module

Strategy Gate

Content Architecture Module

Candidate Generation Module

Assertion Module

Validation Module

Composite Validation Module

Evaluation Module

Risk Module

Uncertainty Module

Rights Module

Snapshot Builder

Snapshot Closure Validator

Policy Engine

Conflict Resolver

Human Review Coordinator

Decision Service

Final Package Service
```

Logical module does not imply separately deployed service.

---

# 11. Data Plane

Canonical relational database stores:

```text
entity metadata

immutable entities

revision registry

supersession links

run state

decision cycles

stage executions

workflow checkpoints

snapshot references

policy results

decision records

publication lineage

measurement lineage

idempotency records

outbox events

consumer receipts
```

Relational state is authoritative for referential integrity.

---

# 12. Immutable Object Store

Object storage is used for large payloads:

```text
source snapshots

documents

large content

media

raw provider exports

execution payloads

measurement files

large traces
```

Objects referenced by immutable historical entities MUST NOT be overwritten.

---

# 13. Object Addressing

Preferred object addressing:

```text
objects/{content_hash}
```

or equivalent immutable addressing.

Metadata includes:

```text
object_reference

content_hash

size_bytes

media_type

created_at
```

Hash mismatch:

```text
OBJECT_INTEGRITY_FAILURE
```

---

# 14. Cross-Store Commit Protocol

Database and object store do not share one ACID transaction.

Therefore canonical write protocol is:

```text
1. WRITE IMMUTABLE OBJECT

2. VERIFY OBJECT EXISTS

3. VERIFY CONTENT HASH

4. BEGIN DATABASE TRANSACTION

5. CREATE CANONICAL ENTITY
   REFERENCING OBJECT

6. WRITE OUTBOX EVENT IF REQUIRED

7. COMMIT DATABASE TRANSACTION
```

Never:

```text
DATABASE COMMIT
↓
UPLOAD OBJECT LATER
```

for required immutable payloads.

---

# 15. Orphan Objects

If object write succeeds but database commit fails:

```text
OBJECT EXISTS
BUT NO CANONICAL ENTITY REFERENCES IT
```

This is permitted temporarily.

Such objects are:

```text
ORPHAN OBJECTS
```

Maintenance may garbage-collect them after a safety retention window.

Object garbage collection and canonical database-reference creation MUST serialize through a durable ObjectRegistry / GC-claim boundary.

The implementation must prevent this race:

```text
GC verifies no references
↓
writer verifies object exists
↓
GC deletes object
↓
writer commits canonical reference
```

Deletion MUST verify no canonical references exist and MUST hold the required GC/object-registry claim until deletion is committed.

Canonical reference creation MUST reject an object that is actively GC-claimed or deleted.

---

# 16. Cache

Cache is non-authoritative.

Allowed:

```text
revision resolution cache

source retrieval cache

model response cache

embedding cache

compiled policy cache

query projection cache
```

Cache loss MUST NOT alter historical truth.

---

# 17. Durable Workflow

Every V1A decision run executes through durable workflow state.

Workflow must survive:

```text
process crash

worker crash

deployment restart

network timeout

provider timeout

queue redelivery

temporary database outage
```

---

# 18. Run

Operational entity:

```text
Run

run_id

run_correlation_key

task_revision_id

initialization_cutoff

initial_run_config_id

initial_baseline_snapshot_id

status

current_decision_cycle_id?

started_at

completed_at?

version
```

Run is operational lifecycle state.

It is not itself immutable historical decision truth.

---

# 19. Run Status

```text
INITIALIZING

QUEUED

RUNNING

WAITING_EXTERNAL

WAITING_HUMAN

COMPLETED

BLOCKED

FAILED

CANCELLED
```

---

# 20. Atomic Run Initialization

Run initialization MUST resolve all initial pinned state from one coherent read boundary.

Canonical process:

```text
BEGIN CONSISTENT READ SNAPSHOT
```

Use:

```text
REPEATABLE READ
```

or stronger equivalent semantics.

Inside the same logical initialization boundary:

```text
capture initialization_cutoff

resolve TaskRevision

resolve optional ProgramRevision

resolve ChannelProfileRevision

resolve active governance revisions

resolve metric revisions

resolve model/prompt/tool/retriever/evaluator/schema revisions

resolve baseline knowledge as-of cutoff

create RunConfig

create BaselineKnowledgeSnapshot

create initial GovernanceSnapshot

create Run
```

Then:

```text
COMMIT
```

---

# 21. Initialization Cutoff

Every Run stores:

```text
initialization_cutoff
```

All initial activation resolution uses:

```text
state visible as-of initialization_cutoff
```

A Control Plane activation occurring after that cutoff:

```text
MUST NOT
alter initial pinned state
```

---

# 22. No Re-Resolution Rule

After initialization, runtime/config revisions already pinned into `RunConfig` MUST NOT be re-resolved through:

```text
ACTIVE
CURRENT
LATEST
```

This applies to:

```text
PromptConfig
ModelConfig
ToolConfig
RetrieverConfig
EvaluatorConfig
SchemaDefinition
```

Governance temporal resolution is different.

Time-sensitive governance inputs retain their own immutable temporal cutoff.

For each final PRE_GENERATION_FINAL or CONTENT_LEVEL ApplicabilityAssessment, and each decision-relevant RightsCheck:

```text
assessment_or_check.knowledge_cutoff_time
<=
DecisionSnapshot.frozen_at
```

Governance revision eligibility is evaluated using the specific assessment/check cutoff together with:

```text
target_valid_time
+
final market / jurisdiction / product / audience / channel context
```

For NormativeRuleRevision eligibility:

```text
rule.known_from
<=
assessment.knowledge_cutoff_time

AND

rule validity covers
assessment.target_valid_time
```

Guidance, RightsPolicy, MetricDefinition and other decision-relevant governance revisions MUST likewise resolve to exact immutable revisions under their applicable temporal and scope semantics.

Final governance resolution MUST NOT be restricted to only the provisional governance set discovered at run initialization.

It still MUST NOT perform an unqualified `CURRENT`, `LATEST`, or `ACTIVE` lookup inside historical decision state.

---

# 23. Decision Cycle

A Run may contain multiple decision cycles.

```text
DecisionCycle

decision_cycle_id

run_id

cycle_number

parent_cycle_id?

reason

status

fencing_epoch

opened_at

freeze_started_at?

frozen_at?

superseded_by_cycle_id?
```

---

# 24. Why DecisionCycle Exists

Examples:

```text
initial decision
→ Cycle 1

Human Review introduces new information
→ Cycle 2

material restart from affected stage
→ Cycle 3
```

Each cycle represents one coherent candidate decision state.

---

# 25. DecisionCycle Status

```text
OPEN

FREEZING

FROZEN

CANCELLED

FAILED
```

---

# 26. DecisionCycle Invariants

At most one cycle in one Run may be:

```text
current writable cycle
```

A `FROZEN` or `CANCELLED` cycle cannot accept new decision-input commits.

A frozen cycle may later reference a successor through `superseded_by_cycle_id` while remaining `FROZEN` as historical truth.

---

# 27. New Cycle Creation

New cycle creation is atomic.

Example:

```text
BEGIN

lock current Run / DecisionCycle

verify old current cycle is not writable for the new decision path

increment old cycle fencing_epoch

create new DecisionCycle OPEN

set old_cycle.superseded_by_cycle_id = new_cycle_id

set Run.current_decision_cycle_id = new_cycle_id

COMMIT
```

Old asynchronous work may still physically return.

It must not be allowed to commit.

---

# 28. RunKnowledgeDelta Lifecycle

During a decision cycle, run-created knowledge exists as ordinary immutable entities.

Examples:

```text
SourceArtifact

EvidenceItem

Proposition

EvidenceAssessment

EpistemicStateVersion

KnowledgeGap

ResearchTrace
```

Do not continuously mutate one RunKnowledgeDelta.

---

# 29. RunKnowledgeDelta Materialization

When a cycle approaches snapshot freeze:

```text
COLLECT
all decision-relevant
run-created immutable knowledge IDs
for current DecisionCycle
```

Then create:

```text
RunKnowledgeDelta
```

exactly as an immutable manifest.

New knowledge after this requires:

```text
new DecisionCycle
or
new pre-freeze materialization
before the cycle enters FREEZING
```

Never mutate a materialized RunKnowledgeDelta.

---

# 30. BaselineKnowledgeSnapshot Lifecycle

BaselineKnowledgeSnapshot is created during Run initialization.

It is immutable.

It is never changed because research finds new information.

New run-created information belongs to:

```text
RunKnowledgeDelta
```

---

# 31. GovernanceSnapshot Lifecycle

GovernanceSnapshot is immutable.

Provisional governance:

```text
GovernanceSnapshot G1
```

If research changes governance dependencies:

```text
CREATE G2
```

Never update G1.

Before final snapshot freeze:

```text
resolve exact final governance revisions
using the immutable cutoffs recorded by
the relevant ApplicabilityAssessments / RightsChecks
+
target_valid_time
+
final decision context
↓
create exact final GovernanceSnapshot
for current DecisionCycle
```

DecisionSnapshot pins that exact immutable `governance_snapshot_id`.

A later Control Plane activation is not automatically imported merely because it is active; eligibility is determined by the decision's explicit temporal and scope rules.

---

# 32. Governance Refresh

Governance refresh means:

```text
recompute applicability
+
re-resolve exact eligible immutable governance revisions
against the relevant immutable assessment/check knowledge cutoff
and target_valid_time
+
create new immutable governance-related state
```

It never means:

```text
mutate existing GovernanceSnapshot
```

and it never means resolving an unqualified `CURRENT` / `LATEST` revision.

---

# 33. Stage Execution

Every asynchronous workflow stage has a canonical operational record:

```text
StageExecution

stage_execution_id

idempotency_key

run_id

decision_cycle_id

stage_name

status

lease_owner?

lease_expires_at?

fencing_token

attempt_count

canonical_input_hash

output_refs

started_at?

completed_at?

error_code?
```

---

# 34. StageExecution Status

```text
PENDING

CLAIMED

RUNNING

SUCCEEDED

FAILED_RETRYABLE

FAILED_PERMANENT

CANCELLED

STALE
```

---

# 35. Stage Idempotency Key

```text
idempotency_key =
hash(
    run_id
    +
    decision_cycle_id
    +
    stage_name
    +
    canonical_input_reference_set
    +
    pinned_config_reference_set
)
```

Database enforces:

```text
UNIQUE(idempotency_key)
```

---

# 36. Atomic Stage Claim

A worker may execute a stage only after atomically claiming its StageExecution.

Conceptually:

```text
INSERT StageExecution
ON UNIQUE idempotency_key
```

or:

```text
COMPARE-AND-SWAP
PENDING → CLAIMED
```

Only the winning claimant owns execution rights.

---

# 37. Duplicate Delivery

If another worker receives the same job:

```text
lookup idempotency_key
```

If:

```text
SUCCEEDED
```

return existing output refs.

If:

```text
RUNNING with valid lease
```

do not independently execute business commit.

If lease expired:

```text
attempt controlled takeover
```

---

# 38. Stage Lease

Long-running stages use a lease:

```text
lease_owner
lease_expires_at
```

Worker MUST renew before expiry if work continues.

Lease renewal MUST atomically compare:

```text
lease_owner
+
fencing_token
```

A takeover after expiry MUST also atomically compare the previous ownership/token state before assigning a new owner and incremented fencing token.

A stale owner cannot renew a lease after a newer fencing token has been issued.

Lease expiry allows controlled takeover.

Lease alone is not sufficient.

---

# 39. Fencing Token

Every successful stage ownership grant increments:

```text
fencing_token
```

Every later business commit from that worker MUST include the token.

Commit accepted only if:

```text
submitted_fencing_token
==
current StageExecution.fencing_token
```

Older workers become stale automatically.

---

# 40. DecisionCycle Fencing

Every asynchronous commit also carries:

```text
run_id

decision_cycle_id

cycle_fencing_epoch
```

Commit accepted only if:

```text
DecisionCycle.status = OPEN
```

and:

```text
cycle_fencing_epoch
==
current expected epoch
```

---

# 41. Stale Worker Protection

Scenario:

```text
Worker A starts model call
↓
Cycle 1 is closed for writes and points to successor Cycle 2
↓
Cycle 2 begins
↓
Worker A returns
```

Worker A's commit MUST fail with:

```text
STALE_DECISION_CYCLE
```

Its external result may be discarded or stored only as non-authoritative diagnostic data.

It cannot become canonical decision state.

---

# 42. Cancellation Protection

Any cancellation that invalidates worker authority MUST be atomic with a DecisionCycle fencing-epoch increment.

Canonical current-cycle cancellation:

```text
lock Run / current DecisionCycle
↓
verify cancellable state
↓
increment DecisionCycle.fencing_epoch
↓
set DecisionCycle.status = CANCELLED
↓
set Run.status = CANCELLED when run cancellation was requested
↓
COMMIT
```

If only the current DecisionCycle is cancelled, the Run status follows the orchestration semantics defined by the caller.

All later business commits carrying the pre-cancellation cycle epoch are rejected.

Cancellation means:

```text
STOP FUTURE DOMAIN WRITES
```

It does not delete already committed immutable history.

---

# 43. Workflow Stage Contract

Each stage declares:

```text
stage_name

required_inputs

required_config_refs

produced_entity_types

retry_policy

timeout_policy

failure_semantics
```

A stage succeeds only when:

```text
required refs resolve

cycle still writable

fencing valid

outputs validate

transaction commits
```

---

# 44. External Calls and Transactions

Never hold relational transaction open across:

```text
LLM call

retrieval call

external API

human review

long evaluation
```

Pattern:

```text
claim stage
↓
load immutable inputs
↓
external operation
↓
validate response
↓
short fenced commit transaction
```

---

# 45. Model Gateway

All model calls use:

```text
ModelGateway
```

Responsibilities:

```text
provider abstraction

exact ModelConfig resolution

rate limiting

timeouts

retry

structured output enforcement

request hash

response hash

token usage

cost usage

trace propagation

provider error normalization
```

Domain modules may not directly call model provider SDKs.

---

# 46. Model Response Trust

```text
MODEL OUTPUT
↓
PARSE
↓
SCHEMA VALIDATE
↓
SEMANTIC VALIDATE
↓
DOMAIN INVARIANT VALIDATE
↓
FENCED COMMIT
```

Model output is never authoritative merely because it is valid JSON.

---

# 47. Retrieval Gateway

All external research uses:

```text
RetrievalGateway
```

Responsibilities:

```text
connector/network permissions

query execution

isolation

size limits

content type checks

source snapshot capture

retrieval metadata

rights metadata

content hash

instruction/data separation
```

---

# 48. Untrusted Source Boundary

```text
UNTRUSTED SOURCE
↓
ISOLATED RETRIEVAL
↓
SAFE EXTRACTION
↓
SCHEMA VALIDATION
↓
EvidenceItem staging
↓
approved reasoning context
```

Source text cannot directly:

```text
change system instruction

execute arbitrary tools

authorize release

activate revisions

override permissions
```

---

# 49. Research Failure Semantics

These outcomes:

```text
NO_EVIDENCE_FOUND

SEARCH_INCOMPLETE

SEARCH_FAILED
```

do not resolve a blocking KnowledgeGap by themselves.

Unknown remains unknown.

---

# 50. Snapshot Freeze Barrier

Snapshot freeze is not simply:

```text
run validator
+
insert row
```

It is a workflow barrier.

---

# 51. Entering FREEZING

DecisionCycle may enter `FREEZING` only after every required decision-input StageExecution is already terminal.

Canonical transition:

```text
lock DecisionCycle
↓
verify status = OPEN
↓
verify all required decision-input stages terminal
↓
increment fencing_epoch
↓
OPEN → FREEZING
```

The transition uses compare-and-swap / equivalent transactional protection.

After transition:

```text
NO NEW UPSTREAM DECISION INPUT
MAY COMMIT INTO THE CYCLE
```

Any worker carrying the prior cycle fencing epoch is stale and its commit MUST be rejected.

The freeze transition closes the writable decision-input set. It does not retroactively impose one shared knowledge cutoff on all earlier immutable assessments.

---

# 52. Freeze Barrier Admission

A cycle may enter `FREEZING` only when:

```text
all required decision-input StageExecutions are terminal

all required successful outputs exist

no blocking gap remains unresolved

no required human action remains pending

no required decision-input worker still owns a writable claim
```

A required stage that is `RUNNING`, `CLAIMED`, `PENDING`, or `FAILED_RETRYABLE` prevents entry into `FREEZING`.

---

# 53. Freeze Barrier Terminality Rule

There is no required-writer drain after the cycle enters `FREEZING`.

Required decision-input stages MUST already be terminal before the transition.

Allowed terminal states at freeze admission:

```text
SUCCEEDED

FAILED_PERMANENT
where explicit stage failure semantics permit decision freeze

CANCELLED
only where the stage is non-required
```

Otherwise:

```text
DO NOT ENTER FREEZING
```

---

# 54. Freeze Materialization

After required decision-input writers are closed, freeze preparation materializes the exact immutable state to be frozen.

Time-sensitive inputs keep the immutable cutoffs recorded when they were created.

In particular:

```text
PRE_GENERATION_FINAL ApplicabilityAssessment
CONTENT_LEVEL ApplicabilityAssessment
RightsCheck
```

retain their own:

```text
knowledge_cutoff_time
```

and each such cutoff MUST satisfy:

```text
knowledge_cutoff_time
<=
DecisionSnapshot.frozen_at
```

Then:

```text
materialize immutable RunKnowledgeDelta

select exact final GovernanceSnapshot

resolve final AudienceState

select final decision-time EpistemicStateVersions

resolve final strategy/candidate/validation state

build Draft DecisionSnapshot
```

Snapshot Closure validates that every referenced runtime input was created / known no later than the final snapshot boundary.

No new decision-input state can join afterward.

---

# 55. Closure Validation

Snapshot Closure Validator checks:

```text
direct ref resolution

transitive ref resolution

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

KnowledgeGap final state

ResearchTrace / Retriever

Evaluator / RunConfig

EvalContract

Applicability / Governance

Temporal cutoff consistency

all stage-local knowledge_cutoff_time values
<= DecisionSnapshot.frozen_at

no referenced runtime input
created / known after DecisionSnapshot.frozen_at

Rights state

Risk / Uncertainty

no post-cutoff state
```

---

# 56. Atomic Snapshot Freeze

Canonical transaction:

```text
BEGIN

verify DecisionCycle = FREEZING

lock DecisionCycle

verify fencing epoch

verify required StageExecutions terminal

run final closure validation

set final snapshot freeze boundary

validate every referenced runtime input
was created / known no later than that boundary

validate every stage-local knowledge_cutoff_time
<= that boundary

insert immutable DecisionSnapshot
with DecisionSnapshot.frozen_at = final freeze boundary

set DecisionCycle.frozen_at

set DecisionCycle.status = FROZEN

write SNAPSHOT_FROZEN outbox event

COMMIT
```

If failure:

```text
ROLLBACK
```

No partially frozen snapshot may exist.

---

# 57. Freeze Failure

Depending on failure class, a repairable operational error may allow:

```text
FREEZING
↓
increment fencing_epoch
↓
OPEN
```

The epoch MUST change before reopening so workers authorized before the failed freeze cannot become valid again.

For correctness/invariant failures:

```text
DecisionCycle → FAILED
```

or:

```text
HUMAN_REVIEW_REQUIRED
```

as specified by later specs.

---

# 58. Human Review — No New Information

`ADJUDICATION_ONLY`:

```text
uses frozen snapshot

does not reopen cycle

does not add hidden state
```

Review result becomes post-snapshot governance state.

---

# 59. Human Review — New Information

If reviewer introduces material new information:

```text
old DecisionCycle remains FROZEN

old DecisionSnapshot remains immutable

old DecisionCycle may set superseded_by_cycle_id
to the new successor cycle
```

Then:

```text
create new DecisionCycle

pin same historical RunConfig universe unless legitimately changed by spec

add new immutable information

recompute affected stages

materialize new RunKnowledgeDelta

create new governance states

freeze new DecisionSnapshot at the new cycle's final snapshot boundary

rerun policy
```

---

# 60. Policy Engine Input

Policy Engine accepts only:

```text
FROZEN DecisionSnapshot

+

exact pinned DecisionPolicyRevisions
```

It may not read mutable live runtime state.

---

# 61. Expected Policy Set

For one DecisionSnapshot:

```text
expected_policy_revision_ids
=
DecisionSnapshot
  .GovernanceSnapshot
  .policy_revision_ids
```

Every expected policy receives exactly one terminal PolicyResult.

---

# 62. PolicyResult Uniqueness

Enforce:

```text
UNIQUE(
  snapshot_id,
  policy_revision_id
)
```

No duplicate result for one exact policy revision and snapshot.

---

# 63. PolicyResult Completeness Barrier

Policy evaluation stage is complete iff:

```text
for every expected_policy_revision_id

exactly one terminal PolicyResult exists
```

Result may be:

```text
triggered = false
```

That is still a valid result.

Missing result is not equivalent to:

```text
not triggered
```

---

# 64. Conflict Detection Admission

Conflict detection may begin only after:

```text
POLICY RESULT SET COMPLETE
```

If expected policy count is 12:

```text
12 terminal results required
```

not 11.

---

# 65. Policy Engine Retry

Policy evaluation is deterministic.

Retrying exact:

```text
snapshot_id
+
policy_revision_id
```

must return semantically equivalent PolicyResult.

Duplicate storage prevented by uniqueness constraint.

---

# 66. Policy Failure

If policy execution cannot produce a terminal valid result:

```text
DO NOT CONTINUE TO FINAL DECISION
```

Fail closed.

---

# 67. Human Authorization

Human review / override requires server-side:

```text
principal identity

role

qualification

scope

authority

snapshot binding

audit record
```

UI permission alone is insufficient.

---

# 68. Decision Record

DecisionRecord created only after:

```text
policy set complete

all required conflicts resolved

required reviews complete

overrides validated
```

DecisionRecord is immutable.

---

# 69. FinalContentPackage

FinalContentPackage is derived from:

```text
DecisionRecord
+
DecisionSnapshot
+
selected Candidate
```

It may not create or reinterpret decision truth.

---

# 70. Publication Workflow

Publication history uses:

```text
PublicationLineage
↓
PublishedArtifact
↓
PublishedArtifact
...
```

Writes use concurrency protection.

---

# 71. Publication Successor Write

When creating successor:

```text
lock lineage or predecessor

verify predecessor has no successor

verify same lineage

verify no cycle

verify effective time increases

insert new PublishedArtifact
```

Database uniqueness SHOULD additionally prevent two direct successors.

---

# 72. Measurement Workflow

Canonical ordering:

```text
RAW METRIC INGESTION
↓
MeasurementState
↓
PerformanceObservation
↓
Publication-window validation
↓
Performance Evidence
```

PerformanceObservation cannot exist before MeasurementState.

---

# 73. Measurement Idempotency

Use:

```text
measurement_idempotency_key =
hash(
  source_system
  +
  source_export_identity
  +
  metric_revision_id
  +
  measurement_scope
)
```

Reprocessing identical external measurement must not create duplicate canonical observations.

---

# 74. Performance Correction Chain

Corrections are append-only:

```text
O1
↓
O2
↓
O3
```

Enforce:

```text
at most one direct successor per observation

same semantic measurement scope

acyclic chain
```

Scope change means:

```text
NEW INDEPENDENT OBSERVATION
```

not correction.

---

# 75. MeasurementState Correction

If MeasurementState uses supersession semantics:

```text
same replacement-chain principles apply
```

No simultaneous competing final successor state.

Exact semantics are completed in SPEC07.

---

# 76. Transactional Outbox

Canonical domain transaction:

```text
BEGIN

write canonical domain state

write OutboxEvent

COMMIT
```

Never publish event first.

---

# 77. OutboxEvent

```text
OutboxEvent

event_id

aggregate_type

aggregate_id

event_type

payload

created_at

published_at?
```

`event_id` is globally unique.

---

# 78. Outbox Delivery

Dispatcher sends committed events to durable queue.

Delivery guarantee:

```text
AT LEAST ONCE
```

Exactly-once transport is not assumed.

---

# 79. Consumer Receipt

Each event consumer maintains:

```text
ConsumerReceipt

consumer_name

event_id

processed_at
```

Enforce:

```text
UNIQUE(
  consumer_name,
  event_id
)
```

This provides standard event deduplication for transactional internal effects.

For non-transactional external side effects, consumer receipt deduplication alone is insufficient.

Such effects MUST use either:

```text
provider-supported idempotency
```

or:

```text
durable outbound-command / outbox pattern
```

so a crash between external success and local receipt commit cannot duplicate the external effect.

---

# 80. Consumer Transaction

Canonical consumer pattern:

```text
BEGIN

check ConsumerReceipt

if exists:
    return

perform idempotent business effect

insert ConsumerReceipt

COMMIT
```

---

# 81. Event Semantics

Events announce committed canonical state.

Events do not become the canonical source of truth.

Consumer can always reload entity by ID.

---

# 82. Retry Categories

```text
TRANSIENT

RATE_LIMITED

DEPENDENCY_UNAVAILABLE

INVALID_EXTERNAL_PAYLOAD

MODEL_OUTPUT_INVALID

DOMAIN_INVARIANT_FAILED

AUTHORIZATION_FAILED

PERMANENT_CONFIGURATION_ERROR

HUMAN_ACTION_REQUIRED

STALE_DECISION_CYCLE

STALE_FENCING_TOKEN
```

---

# 83. Retry Policy

Retry only retryable categories.

Never blindly retry:

```text
DOMAIN_INVARIANT_FAILED

AUTHORIZATION_FAILED

STALE_DECISION_CYCLE

STALE_FENCING_TOKEN
```

---

# 84. External Backoff

Use:

```text
exponential backoff
+
jitter
+
maximum attempt count
```

Budget applies.

---

# 85. Model Repair Retry

Invalid structured output may receive limited repair attempts.

Example:

```text
Attempt 1
↓ invalid
Attempt 2
↓ invalid
Attempt 3
↓ fail
```

After limit:

```text
MODEL_OUTPUT_INVALID
```

---

# 86. Control-Plane Activation and Running Runs

New activation changes do not replace runtime/config revisions already pinned in `RunConfig`.

For:

```text
PromptConfig
ModelConfig
ToolConfig
RetrieverConfig
EvaluatorConfig
SchemaDefinition
```

activation changes affect future run initialization only.

Governance evaluation is governed by temporal applicability rather than by blindly freezing the initialization-time active set.

Final governance resolution may include an exact immutable governance revision not present in the provisional initialization set when that revision is legitimately:

```text
known by the relevant immutable assessment/check knowledge_cutoff_time
+
valid at target_valid_time
+
applicable to final decision scope
```

No historical decision step may use an unqualified `CURRENT`, `LATEST`, or `ACTIVE` lookup.

---

# 87. Replay

Historical replay loads:

```text
DecisionSnapshot

BaselineKnowledgeSnapshot

RunKnowledgeDelta

GovernanceSnapshot

RunConfig

exact immutable direct refs

exact immutable transitive refs
```

No `CURRENT` lookup.

---

# 88. Replay Degradation

Supported states:

```text
FULL

PARTIAL_REDACTED

UNAVAILABLE_DUE_TO_RETENTION

INVALIDATED_BY_DELETION
```

Deletion rights beat replay completeness.

---

# 89. Tenant Deployment Mode

Deployment declares:

```text
DeploymentMode
```

One of:

```text
SINGLE_TENANT

MULTI_TENANT
```

---

# 90. Single-Tenant Mode

In:

```text
SINGLE_TENANT
```

tenant ownership fields may be physically simplified.

Security assumptions MUST explicitly state:

```text
one trust tenant per deployment
```

---

# 91. Multi-Tenant Mode

In:

```text
MULTI_TENANT
```

tenant/workspace ownership is:

```text
MANDATORY
```

on every tenant-scoped canonical and operational resource.

Authorization MUST enforce tenant boundary server-side.

Knowing an entity ID does not grant access.

---

# 92. Cross-Tenant Constraints

In multi-tenant mode:

```text
no cross-tenant FK/reference
```

unless the contract explicitly supports a shared/public scope.

Public or authorized aggregate knowledge requires explicit DataScope semantics.

---

# 93. Secrets

Secrets live in a dedicated secret-management system.

Domain objects contain:

```text
secret_reference
```

not raw secret values.

---

# 94. API Command / Query Separation

Commands mutate state.

Examples:

```text
StartRun

CancelRun

SubmitReview

CreatePublishedArtifact

IngestMeasurement
```

Queries do not mutate.

Examples:

```text
GetRun

GetSnapshot

GetDecision

ReplayDecision
```

---

# 95. API Idempotency

These externally retried commands MUST accept `Idempotency-Key`:

```text
StartRun
SubmitReview
CreatePublishedArtifact
IngestMeasurement
```

Other externally retried mutation commands SHOULD accept:

```text
Idempotency-Key
```

Stored as:

```text
idempotency_key
request_hash
response_ref
created_at
```

Same key + different payload:

```text
IDEMPOTENCY_CONFLICT
```

---

# 96. API Error Envelope

```text
error_code

message

retryable

trace_id

entity_refs?

validation_failures?
```

`error_code` is machine-authoritative.

---

# 97. Authentication

Principal types:

```text
USER

SERVICE

SYSTEM_WORKER

REVIEWER

ADMIN
```

---

# 98. Authorization

Authorization decision uses:

```text
principal

deployment/tenant

resource

action

scope

policy
```

Checked before sensitive read and write.

---

# 99. Audit Trail

Security/governance-sensitive operations generate append-only audit events:

```text
CONTROL_PLANE_REVISION_ACTIVATED

RUN_INITIALIZED

DECISION_CYCLE_CREATED

DECISION_CYCLE_SUPERSEDED

SNAPSHOT_FROZEN

POLICY_OVERRIDE_CREATED

HUMAN_REVIEW_SUBMITTED

DECISION_CREATED

RIGHTS_BLOCK_TRIGGERED

DATA_REDACTED

DATA_DELETED

REPLAY_REQUESTED
```

---

# 100. Logging

Operational logs are not canonical truth.

Structured fields:

```text
timestamp

level

module

run_id?

decision_cycle_id?

stage_execution_id?

snapshot_id?

decision_id?

trace_id

fencing_token?

error_code?
```

---

# 101. Sensitive Logging

Prefer:

```text
entity IDs

hashes

metadata

redacted excerpts
```

Avoid raw sensitive source/content by default.

---

# 102. Tracing

Trace:

```text
API request

Run initialization

DecisionCycle

StageExecution

retrieval

model call

database transaction

freeze barrier

policy evaluation

human review

measurement ingest
```

---

# 103. Operational Metrics

```text
run throughput

run latency

decision-cycle count

stage latency

stage lease expiry rate

stale-worker rejection count

fencing-token rejection count

queue depth

retry rate

model failure rate

retrieval failure rate

snapshot closure failure rate

freeze barrier wait time

policy completeness failure rate

outbox lag

consumer dedupe count

measurement ingest lag

database conflict rate
```

---

# 104. Deployment Baseline

Initial deployment:

```text
API PROCESS

WORKER PROCESS

RELATIONAL DATABASE

OBJECT STORE

DURABLE QUEUE

SECRET STORE

OBSERVABILITY BACKEND
```

Workers may be partitioned logically.

---

# 105. Worker Pools

```text
RESEARCH POOL

MODEL / GENERATION POOL

EVALUATION POOL

MEASUREMENT POOL

MAINTENANCE POOL
```

Worker pool separation is operational.

Domain truth remains shared through canonical storage.

---

# 106. Stateless Worker Rule

Workers should remain stateless between jobs.

Durable truth resides in:

```text
database

object store

workflow state

queue
```

---

# 107. Queue Backpressure

External provider pressure uses:

```text
bounded concurrency

queueing

provider rate limits

backoff
```

Never unbounded fan-out.

---

# 108. Budget Enforcement

Run budget may cover:

```text
model calls

retrieval calls

tokens

cost

candidate count

evaluation count

wall-clock time
```

Budget exhaustion yields:

```text
BUDGET_EXHAUSTED
```

It may not silently skip mandatory governance or validation.

---

# 109. Graceful Degradation

Optional generation work may degrade.

Mandatory boundaries fail closed.

Examples:

```text
extra optional strategy generation unavailable
→ maybe continue
```

But:

```text
Snapshot Closure unavailable
→ do not freeze

Rights evaluation unavailable
→ do not release

Hard Policy Engine unavailable
→ do not release
```

---

# 110. Domain Ownership

```text
Control Plane
→ revisions / activations

Knowledge
→ source/evidence/proposition/assessment/epistemic state

Content Runtime
→ audience/strategy/architecture/candidate/assertions

Evaluation
→ validation/composite/qualitative/risk/uncertainty

Governance
→ applicability/policy/result/conflict/override

Decision
→ snapshot/decision/package

Publication
→ lineage/artifacts

Measurement
→ measurement state/observations

Learning
→ performance evidence/change proposals
```

---

# 111. Cross-Module Access

Modules may query other modules through:

```text
typed application interfaces
```

They may not perform arbitrary writes to another module's tables.

---

# 112. No Mutable Context Blob

Do not implement:

```text
run.context = giant mutable JSON
```

Workflow operational metadata may exist.

Canonical decision truth must live in explicit entities.

---

# 113. Referential Enforcement Layers

```text
DATABASE CONSTRAINTS

DOMAIN VALIDATORS

FENCING / CYCLE VALIDATORS

SNAPSHOT CLOSURE VALIDATOR

PROPERTY-BASED TESTS
```

No single layer is sufficient.

---

# 114. Graph Constraints

For:

```text
PublicationArtifact lineage

EpistemicState lineage

PerformanceObservation correction lineage
```

enforce:

```text
same-lineage / same-semantic scope

single direct successor

acyclic

time monotonicity where required
```

---

# 115. Time

All system timestamps stored as:

```text
UTC
```

Presentation timezone is external.

Business valid time remains distinct from system/knowledge time.

---

# 116. Clock Safety

Do not use wall clock alone for concurrency correctness.

Use:

```text
transactions

version numbers

predecessor relationships

fencing tokens

cycle epochs
```

---

# 117. Schema Versioning

Version schemas for:

```text
API payloads

model outputs

queue events

Control Plane payloads

retrieval extraction

object metadata
```

Historical schema revisions are pinned where required.

---

# 118. Database Migration Rule

Physical migrations may change representation.

They may not silently alter domain meaning.

Semantic change requires explicit domain migration semantics defined in SPEC02.

---

# 119. Required Concurrency Tests

Must test:

```text
two workers claim same stage

two workers commit same stage concurrently

lease expires during model call

stale worker commits after takeover

stale worker commits after cycle superseded

stale worker commits after cancellation with old cycle epoch

freeze begins while worker still running

worker returns after FREEZING begins

two snapshot freeze attempts race

two publication successors race

two performance corrections race

two active Control Plane revisions overlap
```

Expected:

```text
at most one canonical effect
```

---

# 120. Required Crash Tests

Inject crash:

```text
before object upload

after object upload before DB commit

after DB commit before outbox dispatch

after queue publish before ack

after stage claim

during provider call

after provider response before commit

during freeze barrier

after snapshot insert before event delivery

during policy set execution

during final package creation
```

---

# 121. Required Recovery Properties

After every injected crash:

```text
no duplicated immutable history

no missing required canonical event

safe retry possible

stale worker cannot overwrite newer state

snapshot remains coherent

policy result set cannot be partial-final

object reference never points to missing required object
```

---

# 122. Required Policy Tests

```text
expected set = {P1,P2,P3}

P1 completed
P2 completed
P3 missing
→ conflict detection forbidden

P1 false
P2 false
P3 false
→ complete

duplicate result for P2
→ rejected
```

---

# 122A. Required Governance Temporal Tests

```text
Rule known before an ApplicabilityAssessment.knowledge_cutoff_time
but valid only at intended publication time
→ eligible when target_valid_time is inside rule validity

Research changes jurisdiction
and introduces a newly applicable exact rule revision
known by the final applicability assessment cutoff
→ final governance recomputation MUST include it

Governance revision learned after the applicable
assessment/check knowledge_cutoff_time
→ MUST NOT be used by that assessment/check

stage-local knowledge_cutoff_time
> DecisionSnapshot.frozen_at
→ snapshot rejected

EpistemicState known after DecisionSnapshot.frozen_at
→ MUST NOT enter that DecisionSnapshot

runtime input created after DecisionSnapshot.frozen_at
→ MUST NOT enter that DecisionSnapshot

unqualified CURRENT / LATEST governance lookup
→ rejected
```

---

# 123. Required DecisionCycle Tests

```text
Cycle1 OPEN

worker W1 starts
↓
new information
↓
Cycle1 FROZEN
Cycle1.superseded_by_cycle_id = Cycle2
Cycle2 OPEN
↓
W1 returns
→ commit rejected
```

---

# 124. Required Freeze Tests

```text
Cycle OPEN
+
all required decision-input stages terminal
→ may atomically bump epoch
  and enter FREEZING

Cycle OPEN
+
required stage running
→ MUST NOT enter FREEZING

FREEZING
+
new upstream commit
→ rejected

FREEZING
+
worker carrying pre-freeze cycle epoch commits
→ rejected

FREEZING → OPEN recovery
→ fencing epoch increments before reopen

state known / created after DecisionSnapshot.frozen_at
→ rejected from snapshot

closure failure
→ no frozen snapshot
```

---

# 125. Required Object-Store Tests

```text
object upload fails
→ DB entity not created

object upload succeeds
DB commit fails
→ orphan object only

orphan cleanup
→ never delete referenced object

hash mismatch
→ entity creation rejected

GC claim races with canonical reference creation
→ at most one operation wins safely

object actively GC-claimed
→ canonical reference creation rejected or waits under serialized protocol
```

---

# 126. Required Event Tests

```text
event delivered twice
→ one consumer business effect

consumer crashes after effect
before ack
→ retry does not duplicate effect

outbox dispatcher crashes
after publish
before mark-published
→ redelivery safe

external side effect succeeds
consumer crashes before local receipt commit
→ provider idempotency or outbound-command identity prevents duplicate external effect
```

---

# 127. Required Tenant Tests

For multi-tenant deployment:

```text
Tenant A knows entity ID from Tenant B
→ access denied

cross-tenant write
→ denied

public/global knowledge
→ allowed only through explicit DataScope
```

---

# 128. Implementation Acceptance Criteria

SPEC01 implementation is accepted only when:

```text
1.
Run initialization is coherent and atomic.

2.
Pinned revision state cannot change mid-run.

3.
RunKnowledgeDelta is immutable once materialized.

4.
GovernanceSnapshot is immutable.

5.
Human new-info creates new DecisionCycle.

6.
Stage execution is idempotent under concurrent delivery.

7.
Stage claims use leases.

8.
Business commits use fencing tokens.

9.
Stale workers cannot commit.

10.
Cancelled cycles cannot accept late writes.

11.
Freeze barrier closes decision-input writes.

12.
Snapshot freeze is atomic.

13.
Policy set completeness is enforced.

14.
Conflict detection cannot run on partial policy set.

15.
Object-store payload exists before canonical DB reference commits.

16.
Outbox delivery is at-least-once safe.

17.
Consumers deduplicate events.

18.
Activation resolution is unambiguous.

19.
Publication successor concurrency is safe.

20.
Performance correction concurrency is safe.

21.
Replay uses exact revisions.

22.
Multi-tenant mode enforces tenant boundary.

23.
Crash/recovery property tests pass.

24.
DecisionCycle enters FREEZING only after required decision-input stages are terminal.

25.
Every lifecycle transition that invalidates prior workers bumps the cycle fencing epoch.

26.
Frozen DecisionCycles remain FROZEN and represent supersession through superseded_by_cycle_id.

27.
Final governance resolution uses explicit knowledge_cutoff_time and target_valid_time rather than the initialization-time provisional active set.

28.
Lease renew and takeover use atomic owner + fencing-token comparison.

29.
Object GC cannot race canonical reference creation.

30.
Critical externally retried commands require Idempotency-Key.

31.
External consumer side effects use provider idempotency or durable outbound-command semantics.

32.
OPEN → FREEZING atomically bumps the cycle fencing epoch and closes the writable decision-input set.

33.
PRE_GENERATION_FINAL / CONTENT_LEVEL ApplicabilityAssessments and RightsChecks preserve their own immutable knowledge_cutoff_time values.

34.
Every stage-local knowledge_cutoff_time used by the decision is <= DecisionSnapshot.frozen_at.

35.
DecisionSnapshot.frozen_at is the final snapshot boundary established only after required decision inputs are closed.

36.
Every runtime input referenced by the snapshot was created / known no later than DecisionSnapshot.frozen_at.

37.
Run / DecisionCycle cancellation atomically bumps the current cycle fencing_epoch before or with CANCELLED state.
```

---

# 129. SPEC01 Verification Matrix

| Area | Required Result |
|---|---|
| Blueprint alignment | PASS |
| System topology | PASS |
| Run initialization coherence | PASS |
| Revision pinning | PASS |
| Decision-cycle isolation | PASS |
| RunKnowledgeDelta immutability | PASS |
| GovernanceSnapshot immutability | PASS |
| Stage idempotency | PASS |
| Concurrent stage claim | PASS |
| Lease takeover | PASS |
| Fencing | PASS |
| Stale-worker rejection | PASS |
| Cancellation safety | PASS |
| Freeze barrier | PASS |
| Snapshot atomicity | PASS |
| Policy completeness | PASS |
| Object/DB durability | PASS |
| Outbox correctness | PASS |
| Consumer deduplication | PASS |
| Publication concurrency | PASS |
| Measurement correction concurrency | PASS |
| Replay | PASS |
| Tenant isolation where applicable | PASS |
| Freeze terminality semantics | PASS |
| Cycle epoch invalidation | PASS |
| Governance temporal resolution | PASS |
| Frozen-cycle supersession semantics | PASS |
| Object GC/reference serialization | PASS |
| Critical API idempotency | PASS |
| External side-effect deduplication | PASS |
| Stage-local temporal cutoffs | PASS |
| Final snapshot temporal boundary | PASS |
| Cancellation epoch invalidation | PASS |

---

# 130. Non-Goals

SPEC01 does not choose:

```text
specific programming language

specific cloud

specific relational database product

specific queue product

specific workflow product

specific LLM provider

specific retrieval provider

exact SQL schema

exact indexes

exact policy DSL

exact evidence scoring algorithm

exact evaluator rubric

exact UI architecture
```

---

# 131. Recommended Repository Layout

```text
/contentos

  /api

  /application
    /tasks
    /runs
    /cycles
    /reviews
    /decisions
    /publication
    /measurement

  /domain
    /control_plane
    /knowledge
    /audience
    /strategy
    /content
    /validation
    /governance
    /decision
    /publication
    /measurement
    /learning

  /workflow
    /stages
    /leases
    /fencing
    /freeze

  /providers
    /models
    /retrieval
    /measurement

  /persistence
    /relational
    /objects
    /outbox

  /events
    /publisher
    /consumers
    /receipts

  /security

  /observability

  /tests
    /unit
    /integration
    /property
    /concurrency
    /failure_injection
```

---

# 132. Dependency Direction

```text
API
↓
APPLICATION
↓
DOMAIN
↑
INFRASTRUCTURE ADAPTERS
```

Domain cannot directly depend on:

```text
HTTP framework

database driver

cloud SDK

LLM provider SDK

queue vendor SDK
```

---

# 133. Canonical V1A Execution

```text
API
↓
ATOMIC RUN INITIALIZATION
↓
RUN
↓
DECISION CYCLE OPEN
↓
DURABLE STAGE EXECUTION
↓
RESEARCH / KNOWLEDGE
↓
FINAL GOVERNANCE
↓
STRATEGY
↓
CONTENT
↓
VALIDATION
↓
RISK / RIGHTS
↓
VERIFY REQUIRED DECISION-INPUT STAGES TERMINAL
↓
BUMP CYCLE FENCING EPOCH
↓
CYCLE → FREEZING
↓
MATERIALIZE RunKnowledgeDelta
↓
SELECT FINAL GovernanceSnapshot
↓
BUILD DRAFT DecisionSnapshot
↓
CLOSURE VALIDATION
↓
SET FINAL DecisionSnapshot.frozen_at
↓
ATOMIC SNAPSHOT FREEZE
↓
COMPLETE POLICY SET
↓
CONFLICT RESOLUTION
↓
HUMAN REVIEW / OVERRIDE
↓
DecisionRecord
↓
FinalContentPackage
```

---

# 134. Canonical New-Information Flow

```text
DecisionSnapshot S1
↓
Human Review
↓
NEW INFORMATION
↓
S1 REMAINS IMMUTABLE
↓
DecisionCycle 1 closed
↓
DecisionCycle 2 OPEN
↓
new immutable state
↓
recompute affected stages
↓
RunKnowledgeDelta D2
↓
GovernanceSnapshot G2
↓
DecisionSnapshot S2
↓
rerun complete policy set
```

---

# 135. Canonical V1B Execution

```text
PublishedArtifact
↓
metric ingestion
↓
MeasurementState
↓
PerformanceObservation
↓
window validation
↓
Performance Evidence
↓
Proposition mapping
↓
Evidence Assessment
↓
EpistemicStateVersion
↓
optional ChangeProposal
```

All asynchronous writes use:

```text
idempotency
+
lease
+
fencing
+
transaction
```

where applicable.

---

# 136. System Doctrine

```text
PIN ONCE.

READ ONE COHERENT INITIAL STATE.

ONE RUN MAY HAVE
MULTIPLE DECISION CYCLES.

ONE WRITABLE CYCLE
AT A TIME.

OLD WORKERS
CANNOT WRITE NEW HISTORY.

LEASES ALLOW TAKEOVER.

FENCING PREVENTS STALE COMMITS.

IDEMPOTENCY MUST SURVIVE
CONCURRENT DELIVERY.

FREEZE IS A BARRIER,
NOT JUST AN INSERT.

REQUIRED WRITERS
FINISH BEFORE FREEZING.

ENTERING FREEZING
INVALIDATES PRIOR WORKERS
AND CLOSES NEW DECISION INPUTS.

NO WRITES ENTER
A FREEZING DECISION STATE.

TIME-SENSITIVE INPUTS
KEEP THEIR OWN
IMMUTABLE KNOWLEDGE CUTOFFS.

THE SNAPSHOT FREEZE TIME
IS THE FINAL DECISION BOUNDARY.

CANCELLATION
BUMPS THE CYCLE EPOCH.

RUN KNOWLEDGE DELTAS
ARE MATERIALIZED IMMUTABLY.

GOVERNANCE SNAPSHOTS
ARE NEVER MUTATED.

POLICY COMPLETENESS
PRECEDES CONFLICT RESOLUTION.

MISSING POLICY RESULT
IS NOT FALSE.

WRITE OBJECT FIRST.

VERIFY HASH.

THEN COMMIT THE REFERENCE.

EVENTS ARE AT-LEAST-ONCE.

CONSUMERS DEDUPLICATE.

ACTIVATION MUST BE
UNAMBIGUOUS.

PIN RUNTIME CONFIG ONCE.

RESOLVE GOVERNANCE
BY KNOWLEDGE CUTOFF
AND TARGET VALID TIME.

MULTI-TENANT SECURITY
IS NEVER OPTIONAL.

DATABASE TRANSACTIONS
STAY SHORT.

EXTERNAL WORK
STAYS OUTSIDE TRANSACTIONS.

FAIL CLOSED
AT DECISION BOUNDARIES.

CORRECTNESS FIRST.

REPLAY EXACTLY
WHEN DATA RIGHTS ALLOW.

SPECIFY.

TEST CONCURRENCY.

TEST FAILURE.

THEN IMPLEMENT.
```

**End of ContentOS SPEC 01 — System Architecture v1.1.3 — FROZEN**
