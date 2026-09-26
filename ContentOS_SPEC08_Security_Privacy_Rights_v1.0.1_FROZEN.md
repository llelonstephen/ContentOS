# ContentOS SPEC 08 — Security / Privacy / Rights
## Tenant Isolation, Authorization, Rights Enforcement, Retention, Deletion & Replay Degradation
### Version 1.0.1 — Frozen Security / Privacy / Rights

---

# 0. Status

```text
SPEC
SPEC 08 — SECURITY / PRIVACY / RIGHTS

VERSION
1.0.1

SOURCE OF TRUTH
ContentOS Blueprint v2.13.1 — FROZEN
ContentOS SPEC 01 v1.1.3 — FROZEN
ContentOS SPEC 02 v1.0.6 — FROZEN
ContentOS SPEC 03 v1.0.1 — FROZEN
ContentOS SPEC 04 v1.0.2 — FROZEN
ContentOS SPEC 05 v1.0.1 — FROZEN
ContentOS SPEC 06 v1.0.1 — FROZEN
ContentOS SPEC 07 v1.0 — FROZEN

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
```

SPEC08 defines runtime/security behavior.

It does not change frozen canonical schemas.

---

# 1. Purpose

SPEC08 defines:

```text
authentication boundary
authorization boundary
tenant/workspace isolation
cross-tenant shared/public scope handling
secret handling
sensitive logging
security audit events

RightsPolicy interpretation
RightsCheck execution
rights temporal semantics
analysis/generation-input rights
quotation/transformation/redistribution/commercial-publication rights
required attribution enforcement
rights release eligibility

retention/redaction/deletion workflow
deletion dependency closure
ObjectRegistry / GC safety
replay degradation
privacy-preserving auditability
data-rights precedence
```

---

# 2. Non-Goals

SPEC08 does not redefine:

```text
evidence semantics
epistemic scoring
governance policy DSL
content generation
qualitative evaluation
risk scoring
measurement methodology
experiment design
DecisionRecord ownership
```

SPEC08 consumes those frozen contracts.

---

# 3. Security / Privacy / Rights Doctrine

```text
KNOWING AN ID
IS NOT AUTHORIZATION.

AUTHORIZATION
IS SERVER-SIDE.

TENANT ISOLATION
IS A HARD BOUNDARY.

SHARED
DOES NOT MEAN PUBLIC.

PUBLIC
DOES NOT MEAN UNRESTRICTED.

SECRETS
ARE NOT DOMAIN DATA.

RIGHTS
ARE DECISION INPUTS.

RIGHTS
ARE NOT ADVISORY METADATA.

ANALYSIS RIGHTS
DO NOT IMPLY
PUBLICATION RIGHTS.

GENERATION INPUT RIGHTS
DO NOT IMPLY
REDISTRIBUTION RIGHTS.

ATTRIBUTION REQUIREMENTS
MUST BE SATISFIED.

RIGHTS KNOWLEDGE
CANNOT ARRIVE FROM THE FUTURE.

DATA RIGHTS
OVERRIDE REPLAY CONVENIENCE.

DELETION
DOES NOT REWRITE HISTORY.

IF HISTORY CANNOT BE REPLAYED,
REPORT DEGRADATION.

GC
MUST NOT RACE
CANONICAL REFERENCES.

NO CROSS-TENANT
CONTENT-HASH EXISTENCE LEAK.

NO RAW SECRETS
IN LOGS.

NO RETENTION
JUST TO PRESERVE REPLAY.
```

---

# 4. Canonical Rights Entities

SPEC08 uses:

```text
RightsPolicy
RightsCheck
GovernanceSnapshot
DecisionSnapshot
FinalContentPackage
ReplayabilityStatus
```

Security/authentication/audit infrastructure remains operational architecture unless already canonical upstream.

SPEC08 introduces no new canonical domain entity.

---

# 5. RightsPolicy Contract

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

Immutable.

---

# 6. RightsPolicy Meaning

RightsPolicy is the immutable rights-state interpretation used by runtime.

It expresses permitted-use dimensions.

It does not itself authorize a specific runtime subject/use.

That is RightsCheck.

---

# 7. Rights State Change

A material rights change creates:

```text
NEW rights_policy_id
```

Old RightsPolicy remains immutable.

`supersedes_rights_policy_id` may preserve rights-state lineage.

---

# 8. RightsPolicy Temporal Validity

A RightsPolicy is valid for a target use only when:

```text
effective_from <= target_use_time
```

and, when expiration exists:

```text
target_use_time < scheduled_expiration
```

unless an upstream frozen boundary explicitly defines another interval convention.

---

# 9. Rights Knowledge Cutoff

Decision-time rights evaluation must not use rights state learned after:

```text
RightsCheck.knowledge_cutoff_time
```

For snapshot-bound checks:

```text
knowledge_cutoff_time
<=
DecisionSnapshot.frozen_at
```

---

# 10. RightsPolicy Availability

Because RightsPolicy has no separate `known_from` field in the frozen schema, runtime historical availability must be reconstructable from immutable creation/ingestion lineage.

A policy state created/learned after the decision cutoff may not be imported into the old decision merely because its effective interval covers the target use.

---

# 11. RightsCheck Contract

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

Immutable.

---

# 12. Intended Use Vocabulary

V1 intended use:

```text
ANALYSIS
GENERATION_INPUT
QUOTATION
TRANSFORMATION
REDISTRIBUTION
COMMERCIAL_PUBLICATION
```

No free-form replacement.

---

# 13. Status Vocabulary

V1 status:

```text
ALLOWED
ALLOWED_WITH_REQUIREMENTS
REVIEW_REQUIRED
BLOCKED
```

No additional canonical RightsCheck status.

---

# 14. Subject Binding

`subject_ref` must resolve to the exact immutable subject being checked.

Examples may include:

```text
SourceArtifact
ContentCandidate
ExecutionArtifact
PublishedArtifact
other decision-relevant immutable subject
```

A RightsCheck for one subject cannot authorize another subject.

---

# 15. Rights Policy Binding

Every decision-relevant RightsCheck requires:

```text
rights_policy_id
∈
DecisionSnapshot.GovernanceSnapshot.rights_policy_ids
```

No hidden rights policy outside frozen governance context.

---

# 16. ANALYSIS Rights

For:

```text
intended_use = ANALYSIS
```

the rights evaluator must enforce the exact RightsPolicy analysis permission and any applicable requirements.

Permission to analyze does not imply permission to quote, transform, redistribute or publish.

---

# 17. GENERATION_INPUT Rights

For:

```text
intended_use = GENERATION_INPUT
```

the runtime must enforce:

```text
generation_use
```

and any material attribution/usage requirements.

A source blocked for generation input must not enter model context as generation material.

---

# 18. QUOTATION Rights

For:

```text
intended_use = QUOTATION
```

the runtime must evaluate:

```text
quotation_use
```

plus applicable attribution requirements and scope limitations.

Analysis permission alone is insufficient.

---

# 19. TRANSFORMATION Rights

For:

```text
intended_use = TRANSFORMATION
```

the runtime must evaluate:

```text
transformation_permission
```

plus any other material conditions represented by the exact policy.

Generation permission alone does not imply transformation permission.

---

# 20. REDISTRIBUTION Rights

For:

```text
intended_use = REDISTRIBUTION
```

the runtime must evaluate:

```text
redistribution_permission
```

and mandatory attribution/requirements.

---

# 21. COMMERCIAL_PUBLICATION Rights

For:

```text
intended_use = COMMERCIAL_PUBLICATION
```

the runtime must evaluate:

```text
commercial_use_permission
```

and every other rights dimension materially required by the actual publication action, including redistribution/quotation/transformation where those uses are present.

Commercial permission alone cannot erase another applicable prohibition.

---

# 22. Rights Are Use-Specific

One RightsCheck may not be reused for a materially different intended use.

Examples:

```text
ANALYSIS ALLOWED
!=
GENERATION_INPUT ALLOWED

GENERATION_INPUT ALLOWED
!=
COMMERCIAL_PUBLICATION ALLOWED
```

---

# 23. Target Use Time

For publication / redistribution decisions:

```text
RightsCheck.target_use_time
=
resolved Task target valid time
```

Resolved target valid time:

```text
Task.intended_publication_time
```

when present, otherwise:

```text
DecisionSnapshot.frozen_at
```

---

# 24. Same Decision Target Time

All final publication/redistribution RightsChecks used by one DecisionSnapshot must evaluate the same resolved Task target time.

A check may not silently use "today" while another uses the intended future publication time.

---

# 25. Future-Valid Known Rights

A rights state known by the decision cutoff and effective at a future intended-use time MUST be treated as temporally eligible when its validity interval covers the resolved target_use_time.

The runtime MUST NOT reject that RightsPolicy solely because:

```text
RightsPolicy.effective_from
>
decision time
```

when:

```text
rights state was known by the applicable knowledge cutoff

AND

RightsPolicy.effective_from
<=
target_use_time

AND

target_use_time
<
scheduled_expiration
```

when expiration exists.

Rights temporal eligibility is evaluated against the intended-use target time, not merely the decision wall-clock time.

---

# 26. Future-Known Rights

A rights state learned after snapshot freeze:

```text
MUST NOT
```

be imported into historical decision replay.

Even if it would have changed the decision.

---

# 27. RightsCheck Status — ALLOWED

ALLOWED means the exact intended use is permitted under the exact RightsPolicy without unmet material requirement.

It is use-specific and subject-specific.

---

# 28. RightsCheck Status — ALLOWED_WITH_REQUIREMENTS

Use only when intended use is permitted if explicit requirements are satisfied.

`required_attributions` or equivalent structured requirements must be sufficiently explicit to verify.

---

# 29. RightsCheck Status — REVIEW_REQUIRED

Use when rights state cannot support an automated release decision and human adjudication is required.

It is not equivalent to ALLOWED.

---

# 30. RightsCheck Status — BLOCKED

BLOCKED means the intended use is not permitted under the decision-time rights state.

For normal release:

```text
BLOCKED
→ release forbidden
```

---

# 31. Release Eligibility

Decision-relevant RightsChecks enforce:

```text
BLOCKED
→ normal READY/READY_WITH_WARNINGS forbidden

REVIEW_REQUIRED
→ Human Review required

ALLOWED_WITH_REQUIREMENTS
→ requirements must be satisfied
```

Rights are release constraints.

---

# 32. Required Attribution

If RightsCheck requires attribution:

```text
the exact releasable package/execution plan
MUST satisfy it.
```

An attribution stored only inside RightsCheck metadata is not sufficient.

---

# 33. Attribution Verification

Attribution verification must inspect the exact releasable content/execution state.

It must verify material requirements such as:

```text
required credit text
required source identity
placement/prominence when represented
link/reference when represented
other explicit policy condition
```

---

# 34. Rights Requirement Repair

If required attribution/rights requirement is absent:

```text
rewrite/repair execution plan or candidate
→ new immutable downstream state as required
→ new RightsCheck when subject/use state changes
```

Do not mutate an old RightsCheck to pretend compliance.

---

# 35. RightsCheck Re-Evaluation

Rights re-evaluation creates:

```text
new rights_check_id
```

Old RightsCheck remains immutable.

---

# 36. No Retroactive Rights Legalization

A later ALLOWED RightsCheck does not rewrite the fact that an earlier runtime use may have been BLOCKED under the earlier state.

Historical audit preserves the exact check used at the time.

---

# 37. Source-Use Boundary

Before rights-sensitive source content is used for:

```text
ANALYSIS
GENERATION_INPUT
QUOTATION
TRANSFORMATION
```

the runtime must possess the appropriate exact RightsCheck when the workflow requires rights gating.

A final publication RightsCheck does not retroactively authorize an earlier prohibited source use.

---

# 38. Generation Context Rights

SPEC05 generation context admission must reject a source/content object when:

```text
required GENERATION_INPUT RightsCheck
=
BLOCKED
```

or when required review has not been completed.

---

# 39. Evaluation Context Rights

SPEC06 may analyze candidate/source state only under the applicable rights/security constraints.

Evaluation does not grant additional rights.

---

# 40. Rights Uncertainty

When rights facts are materially uncertain and automation cannot establish permission:

```text
REVIEW_REQUIRED
or
BLOCKED
```

according to the applicable rights method/policy.

Do not default uncertainty to ALLOWED.

---

# 41. Rights Reason Codes

`reason_codes` must expose machine-readable reasons sufficient for downstream governance/audit.

Examples conceptually:

```text
ANALYSIS_NOT_PERMITTED
GENERATION_USE_NOT_PERMITTED
QUOTATION_NOT_PERMITTED
TRANSFORMATION_NOT_PERMITTED
REDISTRIBUTION_NOT_PERMITTED
COMMERCIAL_USE_NOT_PERMITTED
ATTRIBUTION_REQUIRED
RIGHTS_STATE_UNCERTAIN
RIGHTS_POLICY_EXPIRED
RIGHTS_KNOWLEDGE_AFTER_CUTOFF
```

These examples do not create a frozen reason-code enum.

---

# 42. Tenant Deployment Mode

Deployment declares:

```text
SINGLE_TENANT
or
MULTI_TENANT
```

SPEC08 preserves SPEC01 deployment semantics.

---

# 43. SINGLE_TENANT Mode

In SINGLE_TENANT mode, physical tenant fields may be simplified.

Security assumptions must explicitly state:

```text
one trust tenant per deployment
```

Single-tenant deployment does not remove normal user/service authorization requirements.

---

# 44. MULTI_TENANT Mode

In MULTI_TENANT mode:

```text
tenant/workspace ownership
is mandatory
```

for tenant-scoped canonical and operational resources.

Authorization must enforce tenant boundary server-side.

---

# 45. IDs Are Not Capabilities

Possession/knowledge of:

```text
entity_id
revision_id
object_id
run_id
snapshot_id
```

does not grant access.

Every sensitive operation requires authorization.

---

# 46. Authorization Decision Inputs

Authorization uses:

```text
principal
deployment/tenant
resource
action
scope
policy
```

Authorization must occur before sensitive read/write.

---

# 47. Principal Types

SPEC01 principal types:

```text
USER
SERVICE
SYSTEM_WORKER
REVIEWER
ADMIN
```

SPEC08 does not add a new canonical principal vocabulary.

---

# 48. Least Privilege

Service/worker permissions must be scoped to the actions/resources needed by the stage.

A generation worker does not automatically receive:

```text
Control Plane activation
cross-tenant read
deletion authority
secret-store administrative access
```

---

# 49. Reviewer Authority

REVIEWER identity does not imply universal authority.

Review authorization must still enforce:

```text
role
scope
qualification
tenant
specific action
```

as required by upstream review contracts.

---

# 50. Admin Boundary

ADMIN is not a bypass around immutable decision semantics.

Administrative privileges may authorize operational/security actions but must not silently mutate immutable canonical history.

---

# 51. Cross-Tenant References

In MULTI_TENANT mode:

```text
no cross-tenant FK/reference
```

unless an explicit shared/public contract authorizes it.

---

# 52. DataScope

Existing V1 DataScope:

```text
TENANT_PRIVATE
WORKSPACE_SHARED
AUTHORIZED_AGGREGATE
GLOBAL_PUBLIC
```

Data scope and authorization are separate.

A DataScope label alone does not authorize access.

---

# 53. TENANT_PRIVATE

TENANT_PRIVATE state may only be accessed within its authorized tenant boundary.

No cross-tenant inference/existence leak.

---

# 54. WORKSPACE_SHARED

WORKSPACE_SHARED permits access only within the authorized workspace-sharing semantics.

It does not become tenant-global or public automatically.

---

# 55. AUTHORIZED_AGGREGATE

AUTHORIZED_AGGREGATE permits only the approved aggregate use.

It must not expose tenant-private row identity, raw payload, hashes or source existence beyond the authorized aggregate contract.

---

# 56. GLOBAL_PUBLIC

GLOBAL_PUBLIC may be broadly readable according to policy.

Public data still obeys:

```text
rights
license
privacy
integrity
rate/access controls
```

Public does not mean unrestricted reuse.

---

# 57. Cross-Tenant Aggregate Safety

Aggregate workflows must prevent:

```text
membership inference
single-tenant leakage
object/hash existence leakage
raw identifier exposure
unauthorized drill-down
```

where material.

---

# 58. ObjectRegistry Tenant Isolation

In MULTI_TENANT mode:

```text
ObjectRegistry
is tenant-scoped
```

Default content-address uniqueness:

```text
UNIQUE(tenant_id, content_hash)
```

not global hash identity.

---

# 59. No Cross-Tenant Hash Leak

Content-address deduplication must not reveal whether another tenant has:

```text
same content hash
same object
same source
same payload
```

Any future cross-tenant physical deduplication must remain cryptographically and authorization isolated.

---

# 60. ObjectReference Ownership

Canonical object reference owner tenant must equal ObjectRegistry tenant unless an explicit authorized shared/public contract applies.

---

# 61. Secrets

Secrets live in a dedicated secret-management system.

Domain/canonical objects store:

```text
secret_reference
```

not raw secret material.

---

# 62. Secret Non-Propagation

Raw secrets must not be copied into:

```text
Candidate content
SourceArtifact text
EvidenceItem statement
model prompt payload
evaluation output
logs
audit event payload
ChangeProposal
```

unless an explicitly authorized secure workflow requires the value and storage contract.

Normal ContentOS content runtime does not.

---

# 63. Secret Logging

Operational logs must not contain raw credentials/tokens.

Prefer:

```text
secret reference
credential ID
provider name
redacted metadata
```

---

# 64. Sensitive Logging

Operational logs are not canonical truth.

Prefer:

```text
entity IDs
hashes
metadata
redacted excerpts
```

Avoid raw sensitive source/content by default.

---

# 65. Prompt / Model Privacy Boundary

Before private data enters an external model/provider context:

```text
authorization
tenant scope
rights permission
privacy/provider policy
minimum necessary data
```

must all permit the transfer.

Provider integration does not inherit unrestricted datastore access.

---

# 66. Data Minimization

Send only content necessary for the stage.

Do not send:

```text
full tenant knowledge store
unrelated private sources
hidden credentials
unneeded personal data
```

by default.

---

# 67. Provider Data Boundary

Tool/model/provider calls must use only the data scope explicitly authorized for that call.

A provider response cannot grant itself more read scope.

---

# 68. Audit Trail

Security/governance-sensitive operations produce append-only audit events.

At minimum upstream events include:

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

# 69. Audit Event Safety

Auditability does not justify logging prohibited sensitive payload.

Audit events should record:

```text
actor/principal
action
target identity
tenant/scope
timestamp
reason/outcome
trace/correlation
minimal lawful metadata
```

---

# 70. Audit Immutability

Security audit history is append-only.

Corrections are represented as new audit events rather than destructive edits where lawful.

---

# 71. ReplayabilityStatus

Supported states:

```text
FULL
PARTIAL_REDACTED
UNAVAILABLE_DUE_TO_RETENTION
INVALIDATED_BY_DELETION
```

Replayability status is not permission to retain prohibited data.

---

# 72. Data Rights Precedence

Canonical doctrine:

```text
DATA RIGHTS
>
REPLAY CONVENIENCE
```

If required deletion makes replay incomplete:

```text
degrade replayability
```

Do not retain prohibited data to preserve FULL replay.

---

# 73. Detachable Payload Deletion

Where law/policy permits durable minimal identity:

```text
delete/redact detachable payload
retain minimum lawful structural identity
set payload state REDACTED/DELETED
update ReplayabilityStatus
write audit/outbox
```

No surviving semantic value is rewritten.

---

# 74. Identity Deletion

If the identity/structural row itself contains prohibited data or must legally be erased:

```text
it MUST NOT be retained
merely for FK/replay convenience.
```

Required deletion removes that prohibited identity state.

---

# 75. Historical Reference Rule

Deletion workflow must never:

```text
rewrite historical reference ID
to substitute/tombstone ID

null immutable historical reference
merely to satisfy FK
```

Surviving historical values remain exactly as originally written while lawful to retain.

---

# 76. Deletion Dependency Closure

If deleting a target would break surviving enforced FKs:

```text
compute explicit deletion closure
```

Process:

```text
target
↓
discover dependents
↓
classify lawful retention
↓
recurse for dependents that must also be deleted
↓
validate no surviving real FK dangles
↓
delete required closure
↓
degrade replayability
```

---

# 77. Required Deletion Atomicity

Deletion closure should execute atomically where practical.

At minimum, intermediate states must not expose a surviving canonical graph that falsely appears valid while real required references are broken.

---

# 78. Out-of-Band Deletion Metadata

When lawful, the system may retain minimal non-sensitive infrastructure metadata identifying that a target was deleted/unresolvable.

This metadata:

```text
is not the original entity
does not satisfy entity resolution
does not restore FULL replay
```

---

# 79. Tombstone Rule

A tombstone may preserve lineage detection when lawful.

It must not be treated as:

```text
AVAILABLE payload
successful exact entity replay
authorization to retain prohibited data
```

---

# 80. Replay After Deletion

If required references/payloads are unavailable:

```text
FULL replay is forbidden
```

Return the appropriate degraded ReplayabilityStatus.

Do not synthesize missing historical state.

---

# 81. Redaction

Redaction removes or masks prohibited/sensitive payload while preserving only lawful structural metadata.

Redaction is not permission to keep the original raw payload in hidden logs/backups outside retention control.

---

# 82. Retention Scope

Retention applies across every copy under system control that contains the regulated payload, including as applicable:

```text
database sidecars
object store
provider/export cache
queue payload
logs
derived cache
temporary processing artifact
backup/replica under policy control
```

SPEC08 does not define vendor-specific deletion mechanics.

---

# 83. Derived Data

Deletion/privacy workflow must assess whether derived artifacts still contain prohibited identifiable/sensitive content.

"Derived" does not automatically mean exempt.

---

# 84. Cache Deletion

A deleted/redacted canonical payload must not remain retrievable from a stale cache.

Caches must participate in invalidation/deletion policy.

---

# 85. ObjectRegistry States

Canonical ObjectRegistry state:

```text
AVAILABLE
GC_CLAIMED
DELETED
```

No canonical row may create a reference to GC_CLAIMED or DELETED object.

---

# 86. Object Write Safety

Canonical object reference creation:

```text
write object
↓
verify existence/hash
↓
lock ObjectRegistry
↓
verify AVAILABLE
↓
commit reference
```

No free-form object reference bypass.

---

# 87. GC Reachability

GC must compute reachability over the complete registered set of canonical ObjectRegistry reference paths.

At minimum:

```text
ObjectReference
RegisteredControlPlaneRevisionPayload
every dedicated ObjectRegistry FK
```

Checking only ObjectReference rows is invalid.

---

# 88. GC Claim

Safe GC admission requires:

```text
canonical_object_reference_count(object_id) = 0
```

under the ObjectRegistry serialization boundary.

Then:

```text
AVAILABLE → GC_CLAIMED
```

---

# 89. GC Race Prevention

After claiming, GC must re-verify no canonical reference was committed across the serialized boundary before object deletion.

Canonical reference creation must reject or wait on GC_CLAIMED.

---

# 90. GC Deletion

After safe deletion:

```text
GC_CLAIMED → DELETED
```

Historical canonical entities must not claim full payload availability after this state.

---

# 91. New Object FK Registration

Any schema migration introducing a new ObjectRegistry FK must register that reference source before the migration is considered complete.

Otherwise GC reachability is unsound.

---

# 92. RightsCheck and Snapshot Closure

Every RightsCheck in DecisionSnapshot must satisfy:

```text
rights_policy_id
∈
GovernanceSnapshot.rights_policy_ids
```

and its subject_ref must resolve to decision-relevant immutable state.

---

# 93. RightsCheck Knowledge Cutoff

For every snapshot-bound RightsCheck:

```text
knowledge_cutoff_time
<=
DecisionSnapshot.frozen_at
```

No post-freeze rights state.

---

# 94. RightsCheck Publication Target

For publication/redistribution:

```text
target_use_time
=
resolved Task target valid time
```

No temporal drift.

---

# 95. FinalContentPackage Rights Closure

FinalContentPackage rights references must come from:

```text
DecisionSnapshot.rights_check_ids
```

No post-decision RightsCheck may be silently inserted into an old package.

---

# 96. Package Requirements

A package may not omit a material required rights constraint merely to appear release-ready.

Required attributions/requirements affecting release must be satisfied in the releasable package/execution plan.

---

# 97. DecisionRecord Ownership

Rights checks constrain the decision.

They do not own release status.

Final release truth remains:

```text
DecisionRecord.release_status
```

---

# 98. Rights vs Governance Policy

RightsPolicy/RightCheck are not NormativeRule/DecisionPolicy.

SPEC04 policy may consume rights state.

SPEC08 does not convert RightsPolicy into a DecisionPolicy.

---

# 99. Rights vs Evidence

Rights state answers permission/use questions.

It does not establish factual truth.

RightsPolicy is not EvidenceItem or EpistemicState.

---

# 100. Privacy vs Epistemic Truth

Deletion/redaction can remove evidence needed for replay.

The system must report degraded replay.

It must not invent replacement evidence to preserve epistemic confidence.

---

# 101. Authorization Failure

Authorization failure must fail closed.

Do not downgrade to:

```text
not found
then search another tenant
```

or another data source automatically.

---

# 102. Existence Leak

Error handling must avoid exposing cross-tenant existence through materially distinct unauthorized responses when that distinction creates a leakage risk.

---

# 103. External Identity

Opaque external business IDs are not authorization tokens.

Knowing brand/product/provider identifiers does not grant access to tenant state.

---

# 104. Worker Scope

SYSTEM_WORKER access is stage-scoped.

A worker must not read arbitrary tenant state outside the claimed job's authorized context.

---

# 105. Service-to-Service Auth

Internal service calls must authenticate service identity and authorize resource/action scope.

Network location alone is insufficient trust.

---

# 106. Queue Payload Security

Durable queue messages must not contain unnecessary raw sensitive payload.

Prefer immutable IDs/object refs and retrieve authorized data at execution time.

---

# 107. Outbox Security

Outbox events containing sensitive references/payload must be tenant-scoped and consumed only by authorized consumers.

ConsumerReceipt does not grant data access by itself.

---

# 108. API Error Safety

API error envelopes may expose:

```text
error_code
message
retryable
trace_id
entity_refs?
validation_failures?
```

Sensitive entity refs/validation data must still obey authorization/redaction.

---

# 109. Human Review Privacy

Human reviewers receive only:

```text
authorized
decision-relevant
minimum necessary
```

content.

Review UI visibility does not expand canonical authorization.

---

# 110. Human Rights Review

A reviewer may adjudicate rights uncertainty only within authorized role/scope.

New factual/rights information introduced by review must follow new-information / new-cycle rules when material to the frozen decision.

---

# 111. Rights Check Idempotency

Exact rights-check identity should include:

```text
subject_ref
rights_policy_id
intended_use
target_use_time
knowledge_cutoff_time
canonical rights-input hash
```

Exact retry must converge without duplicate contradictory canonical effect.

---

# 112. Rights Re-Evaluation Identity

If any material input changes:

```text
rights policy
subject
intended use
target time
knowledge cutoff
rights facts
```

that is a new RightsCheck event, not a retry.

---

# 113. Rights Worker StageExecution

Suggested stages:

```text
RIGHTS_RESOLVE
RIGHTS_CHECK_ANALYSIS
RIGHTS_CHECK_GENERATION_INPUT
RIGHTS_CHECK_CONTENT
RIGHTS_CHECK_RELEASE
PRIVACY_DELETE
OBJECT_GC
```

Names may vary.

Semantics may not.

---

# 114. Rights Write Transaction

```text
BEGIN

verify tenant/scope
verify subject_ref
verify rights_policy_id
verify rights policy included in governance context when decision-bound
verify intended_use
verify target_use_time
verify knowledge_cutoff_time
evaluate exact rights state
validate status/requirements
insert immutable RightsCheck
write outbox/audit event if required

COMMIT
```

---

# 115. Deletion Transaction

Where detachable payload deletion is sufficient:

```text
BEGIN

authorize privileged deletion
lock identity/registry/object refs
remove/redact detachable payload
mark payload state
invalidate caches
update ReplayabilityStatus
write DATA_REDACTED / DATA_DELETED audit
write outbox

COMMIT
```

---

# 116. Required-Deletion Closure Transaction

When identity/dependent rows must also be removed:

```text
BEGIN

authorize privileged deletion
compute dependency closure
classify lawful survivors
lock required graph
validate no surviving enforced FK will dangle
delete required closure
invalidate object/cache state
write lawful non-sensitive deletion metadata
degrade ReplayabilityStatus
write audit/outbox

COMMIT
```

---

# 117. Deletion Idempotency

Repeated execution of the same authorized deletion request must converge.

It must not:

```text
recreate deleted payload
re-add tombstoned state
return FULL replay
```

after deletion.

---

# 118. Audit of Deletion

Deletion audit must record enough non-sensitive information to prove:

```text
authorized deletion occurred
scope affected
completion outcome
replay degradation outcome
```

without retaining the prohibited payload itself.

---

# 119. Backup / Replica Policy

Retention/deletion requirements must include backups/replicas according to the deployment's lawful deletion/expiry mechanism.

The live database deletion alone is not proof that all controlled copies are gone.

---

# 120. Provider Copies

When external providers are used, privacy policy/config must define whether provider-side retention/caching is permitted.

Do not send data under assumptions that contradict the provider-use contract.

---

# 121. Rights / Privacy Failure Taxonomy

Operational codes may include:

```text
AUTHENTICATION_REQUIRED
AUTHORIZATION_DENIED
TENANT_SCOPE_VIOLATION
WORKSPACE_SCOPE_VIOLATION
DATA_SCOPE_VIOLATION
SECRET_EXPOSURE_BLOCKED
RIGHTS_POLICY_MISSING
RIGHTS_POLICY_EXPIRED
RIGHTS_KNOWLEDGE_AFTER_CUTOFF
RIGHTS_ANALYSIS_BLOCKED
RIGHTS_GENERATION_BLOCKED
RIGHTS_QUOTATION_BLOCKED
RIGHTS_TRANSFORMATION_BLOCKED
RIGHTS_REDISTRIBUTION_BLOCKED
RIGHTS_COMMERCIAL_BLOCKED
RIGHTS_REVIEW_REQUIRED
ATTRIBUTION_REQUIREMENT_UNMET
DELETION_NOT_AUTHORIZED
DELETION_CLOSURE_INVALID
REPLAY_DEGRADED
OBJECT_GC_REFERENCE_EXISTS
OBJECT_GC_CLAIM_CONFLICT
```

These are operational codes, not new canonical enums.

---

# 122. Fail-Closed Conditions

Fail closed when:

```text
authentication missing
authorization denied
tenant/workspace scope mismatch
shared/public scope unproven
secret boundary violated
rights policy missing
rights subject mismatch
intended-use permission absent
rights target time invalid
rights knowledge cutoff invalid
required attribution unmet
rights uncertainty requires review
deletion authorization missing
deletion closure would leave dangling enforced FK
GC reachability incomplete
GC object still referenced
cross-tenant object/hash leakage risk
```

Fail closed means:

```text
do not perform the sensitive use/release/deletion/GC action
```

until the governing condition is resolved.

---

# 123. Fixed Adversarial Test Suite

The following suite is locked for SPEC08 v1.0 audit.

```text
01 entity ID guessed across tenant and read succeeds
02 tenant-private FK crosses tenant
03 WORKSPACE_SHARED treated as tenant-global
04 AUTHORIZED_AGGREGATE exposes raw tenant rows
05 GLOBAL_PUBLIC treated as unrestricted rights-free reuse
06 object hash reveals another tenant's stored content
07 cross-tenant content-address dedupe leaks existence
08 worker reads arbitrary tenant data outside claimed job
09 service call trusts network location without auth
10 admin mutates immutable decision history directly

11 raw secret stored in domain object
12 raw token copied into prompt
13 secret emitted in operational log
14 queue contains unnecessary raw secret/private payload
15 audit event stores prohibited raw sensitive content
16 provider receives unrelated tenant private data
17 model/provider call bypasses minimum-necessary context
18 unauthorized error response reveals target existence
19 reviewer UI exposes unrelated tenant data
20 external business ID treated as access capability

21 RightsPolicy mutated in place
22 rights-state change reuses old rights_policy_id
23 RightsCheck subject differs from actual source/content
24 decision RightsCheck uses policy absent from GovernanceSnapshot
25 ANALYSIS permission reused for GENERATION_INPUT
26 GENERATION_INPUT permission reused for COMMERCIAL_PUBLICATION
27 quotation proceeds when quotation_use false
28 transformation proceeds when transformation_permission false
29 redistribution proceeds when redistribution_permission false
30 commercial publication proceeds when commercial_use_permission false

31 commercial publication ignores another material rights prohibition
32 rights uncertainty defaults to ALLOWED
33 ALLOWED_WITH_REQUIREMENTS has no verifiable requirement
34 required attribution missing but release passes
35 attribution requirement stored only in RightsCheck metadata
36 BLOCKED treated as advisory warning
37 REVIEW_REQUIRED treated as READY
38 later ALLOWED check retroactively legalizes earlier prohibited use
39 source blocked for GENERATION_INPUT still enters generation context
40 final publication RightsCheck used to excuse earlier blocked source use

41 publication RightsCheck target_use_time differs from Task target
42 rights check uses DecisionSnapshot freeze time despite future intended publication
43 rights knowledge learned after freeze imported into old decision
44 expired RightsPolicy used at target time
45 future-effective RightsPolicy incorrectly rejected despite being known by cutoff
46 final rights checks in one decision use inconsistent target times
47 knowledge_cutoff_time after DecisionSnapshot.frozen_at
48 historical replay resolves latest RightsPolicy
49 RightsCheck from another Candidate/source silently reused
50 rights re-evaluation mutates old RightsCheck

51 FinalContentPackage injects post-decision RightsCheck
52 FinalContentPackage omits material required rights requirement
53 RightsCheck directly owns release status
54 RightsPolicy converted into DecisionPolicy truth
55 RightsPolicy treated as factual Evidence
56 cross-tenant shared source used without explicit DataScope authorization
57 reviewer adjudicates rights outside authority/scope
58 reviewer introduces material new rights info without new-cycle handling
59 rights worker commits stale result after cycle invalidation
60 duplicate exact rights retry creates contradictory canonical result

61 deletion keeps prohibited identity solely to preserve replay
62 deletion rewrites historical reference to tombstone ID
63 deletion nulls immutable reference to satisfy FK
64 deletion removes target but leaves surviving enforced FK dangling
65 dependent prohibited history not included in deletion closure
66 deletion tombstone treated as successful entity resolution
67 deleted payload still reported FULL replay
68 replay synthesizes deleted historical content
69 deleted payload remains available from cache
70 derived data containing prohibited content retained without assessment

71 raw payload deleted from DB but retained indefinitely in controlled object copy
72 DATA_DELETED audit retains the prohibited payload itself
73 GC checks only ObjectReference and misses dedicated ObjectRegistry FK
74 GC claims object with canonical reference still present
75 reference creation succeeds against GC_CLAIMED object
76 GC deletes object after race without re-verification
77 new ObjectRegistry FK migration omitted from reference-source registry
78 ObjectReference owner tenant differs from ObjectRegistry tenant
79 source snapshot reference bypasses ObjectRegistry/GC safety
80 replay convenience overrides required data-rights deletion
```

Expected for freeze:

```text
80 / 80
PRESERVE INVARIANTS
```

No additional freeze blocker may be introduced after suite lock unless a concrete contradiction against Blueprint v2.13.1 or SPEC01–07 frozen contracts is demonstrated.

---

# 124. Static Contract Preflight

SPEC08 freeze audit must check exactly:

```text
01 no new canonical domain entity invented
02 RightsPolicy canonical fields preserved
03 RightsCheck canonical fields preserved
04 Rights intended-use vocabulary preserved
05 Rights status vocabulary preserved
06 RightsPolicy remains immutable
07 RightsCheck remains immutable
08 rights policy belongs to frozen GovernanceSnapshot
09 rights subject exact immutable binding preserved
10 publication/redistribution target_use_time semantics preserved
11 rights knowledge cutoff <= snapshot freeze
12 future rights knowledge cannot enter old decision
13 ALLOWED_WITH_REQUIREMENTS requires enforceable requirements
14 BLOCKED forbids normal release
15 REVIEW_REQUIRED requires review
16 FinalContentPackage rights refs remain snapshot-bound
17 DecisionRecord remains sole release owner
18 tenant isolation remains server-side
19 IDs are not capabilities
20 DataScope remains distinct from authorization
21 secrets remain outside domain payload
22 sensitive logging minimization preserved
23 data rights override replay convenience
24 ReplayabilityStatus vocabulary preserved
25 deletion never rewrites immutable historical refs
26 required deletion computes dependency closure
27 surviving enforced FKs cannot dangle
28 tombstone does not count as successful entity resolution
29 ObjectRegistry tenant isolation preserved
30 GC checks complete reference-source registry
31 reference creation rejects/waits on GC_CLAIMED
32 caches participate in deletion/invalidation
33 historical replay never synthesizes deleted state
34 no duplicated source of security/rights truth
```

Freeze target:

```text
34 / 34 PASS
```

---

# 125. Acceptance Criteria

SPEC08 is freeze-eligible only if:

```text
1.
Authentication is required at protected boundaries.

2.
Authorization is server-side and resource/action/scope aware.

3.
Tenant boundaries cannot be bypassed by knowing IDs.

4.
Shared/public/aggregate scopes require explicit semantics.

5.
Cross-tenant object/hash existence is not leaked.

6.
Raw secrets are not domain data.

7.
Sensitive logs are minimized.

8.
RightsPolicy is immutable.

9.
RightsCheck is immutable and subject/use-specific.

10.
Analysis/generation/quotation/transformation/redistribution/commercial rights remain distinct.

11.
Publication/redistribution rights use the exact Task target time.

12.
Post-cutoff rights knowledge cannot enter old decisions.

13.
BLOCKED rights prevent normal release.

14.
REVIEW_REQUIRED requires Human Review.

15.
ALLOWED_WITH_REQUIREMENTS is not satisfied by metadata alone.

16.
Required attribution must exist in the releasable state.

17.
A final RightsCheck cannot retroactively authorize prohibited earlier use.

18.
Rights checks in snapshots close against GovernanceSnapshot.

19.
FinalContentPackage cannot inject post-decision rights state.

20.
DecisionRecord remains the release-status owner.

21.
Data rights override replay completeness.

22.
Detachable prohibited payload can be removed without semantic rewriting.

23.
Required identity deletion is permitted even when replay degrades.

24.
Deletion never rewrites immutable historical reference values.

25.
Deletion closure removes dependent rows when legally required.

26.
No surviving enforced FK may dangle after deletion.

27.
Deleted/tombstoned state cannot report FULL replay.

28.
Caches/controlled copies participate in privacy deletion.

29.
Object GC cannot race canonical reference creation.

30.
GC reachability covers every registered ObjectRegistry reference path.

31.
Cross-tenant ObjectRegistry ownership remains isolated.

32.
Historical replay never synthesizes deleted payload.

33.
The 80-test adversarial suite passes.

34.
The 34-check static preflight passes.
```

---

# 125A. v1.0.1 Patch Closure

This patch changes only the demonstrated v1.0 blocker:

```text
A RightsPolicy known by the decision cutoff MUST remain eligible
for a future intended-use target when its validity interval covers
that target_use_time.

The runtime MUST NOT reject it solely because effective_from is
later than the decision wall-clock time.
```

The locked audit suite remains exactly:

```text
80 adversarial tests
34 static preflight checks
```

No new freeze criterion is introduced by v1.0.1.

---

# 126. Verification Record — Final Freeze

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

# 127. Canonical V1 Rights Runtime

```text
subject/source/content
↓
exact RightsPolicy
↓
intended use
↓
target use time
↓
knowledge cutoff
↓
RightsCheck
↓
ALLOWED
or
ALLOWED_WITH_REQUIREMENTS
or
REVIEW_REQUIRED
or
BLOCKED
↓
DecisionSnapshot
↓
Policy Engine / Human Review
↓
DecisionRecord
↓
FinalContentPackage
```

---

# 128. Canonical Privacy Deletion Runtime

```text
authorized deletion request
↓
identify prohibited payload/state
↓
detachable payload only?
```

If yes:

```text
redact/delete payload
↓
mark payload state
↓
invalidate caches
↓
degrade ReplayabilityStatus as needed
↓
audit
```

If identity/dependents must also go:

```text
compute deletion dependency closure
↓
lock graph
↓
delete required closure
↓
ensure no surviving FK dangles
↓
retain only lawful non-sensitive deletion metadata
↓
degrade replayability
↓
audit
```

No history rewriting.

---

# 129. Canonical Object GC Runtime

```text
lock ObjectRegistry
↓
enumerate every registered canonical reference source
↓
canonical_object_reference_count = 0?
↓
AVAILABLE → GC_CLAIMED
↓
re-verify serialized boundary
↓
delete object
↓
GC_CLAIMED → DELETED
```

Reference creation:

```text
must reject/wait on GC_CLAIMED
```

---

# 130. Final Doctrine

```text
AUTHENTICATE.

AUTHORIZE.

SCOPE EVERY READ.

SCOPE EVERY WRITE.

TENANT BOUNDARIES
ARE HARD.

RIGHTS
ARE USE-SPECIFIC.

ANALYSIS
IS NOT PUBLICATION.

GENERATION INPUT
IS NOT REDISTRIBUTION.

ATTRIBUTION REQUIREMENTS
MUST EXIST
IN THE RELEASE STATE.

RIGHTS KNOWLEDGE
CANNOT COME FROM
AFTER THE DECISION.

DATA RIGHTS
BEAT REPLAY.

DELETE WHAT
MUST BE DELETED.

DO NOT REWRITE
THE PAST
TO MAKE DELETION EASY.

REPORT
DEGRADED REPLAY.

GC
MUST SEE
EVERY REFERENCE.

SECRETS
STAY SECRET.

NO CROSS-TENANT
EXISTENCE LEAK.

NO HIDDEN RIGHTS STATE.
NO MUTABLE RIGHTS HISTORY.
NO SYNTHETIC REPLAY.
NO SECURITY BY ID OBSCURITY.

LOCK THE SUITE.
AUDIT IT.
THEN FREEZE.
```

---

**End of ContentOS SPEC 08 — Security / Privacy / Rights v1.0.1 — FROZEN**
