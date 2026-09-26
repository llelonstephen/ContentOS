# ContentOS SPEC 02 — Domain & Data Model
## Relational Contracts for Blueprint v2.13.1 FROZEN
### Version 1.0.6 — Frozen Domain & Data Model

---

# 0. Status

```text
SPEC
SPEC 02 — DOMAIN & DATA MODEL

VERSION
1.0.6

SOURCE OF TRUTH
ContentOS Blueprint v2.13.1 — FROZEN
ContentOS SPEC 01 v1.1.3 — FROZEN

STATUS
FROZEN
```

This specification translates the frozen semantic architecture into an implementable canonical relational model.

v1.0.6 removes the final duplicated-source-of-truth defects in RevisionRegistry and DecisionCycleBinding, then freezes SPEC02 after the locked regression and static contract suite passes.

It does not change ContentOS semantics.

If this SPEC conflicts with the Blueprint or SPEC01:

```text
BLUEPRINT
>
SPEC01
>
SPEC02
```

Source fingerprints used while drafting:

```text
Blueprint SHA-256
24e024bff59e5f5bce73172d82ca0c8a5fd696264d1498a3b8884cec55a95fa9

SPEC01 SHA-256
cc74f045e6e1cd25f8ebe37e7db85bb66550b5cde5d5e99db1a098a0816e858d
```

---

# 1. Purpose

SPEC02 defines:

```text
canonical identity
stable ID vs revision ID
typed immutable references
revision registry
immutable entity registry
logical field types
relational normalization
foreign-key rules
uniqueness
append-only history
bitemporal storage
lineage constraints
snapshot support
operational persistence
tenant ownership envelope
object-registry integrity
indexes
migration constraints
deletion / replay degradation
data-model acceptance tests
```

SPEC02 does not define:

```text
evidence-scoring algorithms
policy DSL implementation
generation algorithms
evaluation rubrics
measurement methodology
rights interpretation logic
UI
provider selection
```

Those belong to later specifications.

---

# 2. Data-Model Doctrine

```text
ONE HISTORICAL STATE
ONE IMMUTABLE ID.

ONE REVISION
ONE REVISION ID.

STABLE ID
IS NOT HISTORICAL ID.

REFERENCES ARE TYPED.

REFERENCE EXISTENCE
IS NOT ENOUGH;
REFERENCES MUST AGREE.

CANONICAL ID COLLECTIONS
ARE RELATIONAL,
NOT OPAQUE JSON ARRAYS.

CORRECTIONS APPEND.
THEY DO NOT MUTATE HISTORY.

OPERATIONAL STATE
MAY MUTATE;
DECISION TRUTH MAY NOT.

CURRENT / LATEST / ACTIVE
NEVER REPLACES
AN EXACT HISTORICAL REFERENCE.

DATA RIGHTS MAY REMOVE PAYLOADS.
THE SYSTEM MUST REPORT
DEGRADED REPLAYABILITY
RATHER THAN INVENT HISTORY.
```

---

# 3. Logical Storage Types

SPEC02 uses vendor-neutral logical types.

| Type | Contract |
|---|---|
| `EntityId` | opaque globally unique immutable historical ID |
| `StableId` | identity of a revisioned conceptual object |
| `RevisionId` | immutable exact revision identity |
| `ExternalId` | opaque business identifier not dereferenced by ContentOS |
| `CorrelationKey` | execution correlation value; not an entity reference |
| `Timestamp` | UTC instant |
| `Hash256` | V1 SHA-256 digest; binary-32 or canonical 64-hex physical representation |
| `HashKey` | deterministic canonical hash used for identity/idempotency |
| `Boolean` | true/false |
| `Integer` | signed integer with field-level range checks |
| `TypedScalar` | metric-defined scalar validated against MetricDefinition |
| `Structured/Text` | schema-validated structured value or text |
| `StructuredCollection` | ordered/set payload not representing entity references |
| `ImmutableEntityRef` | `(entity_type, entity_id)` |
| `RevisionRef` | `(entity_type, stable_id, revision_id)` |
| `RefSet<T>` | normalized relation to immutable entities |
| `RevisionRefSet` | normalized relation to registered revisions |
| `TypedRefSet` | normalized tagged union of ImmutableEntityRef / RevisionRef |
| `ObjectRef` | canonical FK to `ObjectRegistry.object_id`; logical field may expose an immutable object reference |

Physical engines may map these differently, but semantic constraints MUST remain identical.

---

# 4. Canonical Row Envelope

In `MULTI_TENANT` deployments every tenant-scoped table receives persistence-envelope columns:

```text
tenant_id
workspace_id?
```

These are storage ownership fields, not replacements for Blueprint domain fields.

In `SINGLE_TENANT` mode they may be implemented using one deployment sentinel.

Every canonical row also has a database-internal physical primary key only if required by the chosen database; such keys MUST NOT replace domain IDs.

Cross-tenant references are rejected unless an explicit shared/public scope contract permits them.

---

# 5. Immutable Entity Registry

Generic `ImmutableEntityRef` values require a relationally enforceable target.

Canonical persistence registry:

```text
ImmutableEntityRegistry

entity_type
entity_id

tenant_id
workspace_id?

payload_state

created_at
deleted_at?
```

Primary key:

```text
PRIMARY KEY(entity_type, entity_id)
```

`payload_state`:

```text
AVAILABLE
REDACTED
DELETED
```

Rules:

1. Every immutable domain entity inserts one matching registry row in the same transaction.
2. Generic references FK to this registry.
3. Normal decision closure accepts only `AVAILABLE` targets.
4. Rights/retention deletion may remove prohibited payload while retaining a minimal non-sensitive registry tombstone.
5. A tombstone is not equivalent to successful historical replay.
6. ReplayabilityStatus records degraded reconstruction.

The registry is persistence infrastructure, not a new ContentOS intelligence entity.

---

# 6. Revision Registry

Every exact revision is registered in an identity/index registry:

```text
RevisionRegistry

entity_type
stable_id
revision_id

tenant_id
workspace_id?

payload_state

created_at
deleted_at?
```

Keys:

```text
PRIMARY KEY(entity_type, revision_id)

UNIQUE(entity_type, stable_id, revision_id)
```

A `RevisionRef` FK uses:

```text
(entity_type, stable_id, revision_id)
```

and therefore cannot resolve a revision under the wrong stable identity.

`RevisionRegistry` owns revision identity / lookup metadata only.

It does NOT own supersession semantics.

Canonical supersession truth remains solely in the authoritative revision record:

```text
typed domain revision:
  supersedes_<concept>_revision_id?

generic config revision:
  RegisteredControlPlaneRevision.supersedes_revision_id?
```

`RevisionRegistry` MUST NOT duplicate a `supersedes_revision_id`.

Typed revision tables are authoritative for typed domain revisions.

Generic config revisions additionally use the `RegisteredControlPlaneRevision` contract.

No historical query may substitute an active revision for the exact revision ID.

---

# 7. Revision Supersession Rules

For every revisioned concept:

```text
successor.stable_id
==
predecessor.stable_id
```

A supersedes reference may not point to a revision of a different entity type or stable ID.

Supersession has exactly one canonical owner:

```text
the authoritative typed revision row
or
RegisteredControlPlaneRevision for generic config revisions
```

`RevisionRegistry` is identity/index infrastructure and MUST NOT duplicate that relation.

Unless the Blueprint explicitly requires a single-successor chain, SPEC02 does not invent one.

Revision rows are immutable after commit.

---

# 8. Reference Storage

Scalar entity references use typed FK columns.

Reference collections such as:

```text
candidate_ids
policy_result_ids
assertion_ids
metric_revision_ids
```

MUST be stored in normalized association tables.

Canonical association shape:

```text
owner_id
target_id
ordinal?
```

with:

```text
UNIQUE(owner_id, target_id)
```

and, when ordering is semantically meaningful:

```text
UNIQUE(owner_id, ordinal)
```

Generic ref collections use:

```text
owner_id
ordinal
ref_kind
entity_type
entity_id?
stable_id?
revision_id?
```

with a check enforcing exactly one valid tagged-union branch.

Opaque JSON arrays of canonical IDs are not the canonical relational representation.

---

# 9. Structured Payloads

Fields such as:

```text
conditions
limitations
uncertainty
runtime_parameters
content_payload
dimension_results
platform_metadata
```

may be physically stored as JSON/document values.

They MUST:

```text
pass the applicable schema
have deterministic canonical serialization when hashed
not hide canonical entity IDs that should be relational references
not become an alternate source of truth for fields modeled relationally
```

Large payloads may be object-backed according to SPEC01.

---

# 10. Immutability Enforcement

For immutable domain/revision tables:

```text
INSERT
allowed

UPDATE
forbidden in normal application role

DELETE
forbidden in normal application role
```

Corrections create new rows.

A privileged retention/deletion workflow may redact/delete payload only under SPEC08 rules.

Where legally permissible, retention-sensitive content SHOULD be separable from a minimal canonical identity / structural row:

```text
IMMUTABLE IDENTITY / STRUCTURAL ROW
+
DETACHABLE PAYLOAD STORAGE
```

so ordinary payload deletion need not damage the historical graph.

This separation is an optimization for integrity, not a right to retain prohibited identity data.

If the identity / structural row itself must be deleted under SPEC08, data-rights requirements take precedence and replayability degrades explicitly.

Database permissions and/or triggers MUST prevent ordinary mutation.

Mutable operational tables are explicitly identified later.

---

# 11. Timestamp & Temporal Rules

All timestamps are UTC.

General checks:

```text
scheduled_expiration > effective_from
when scheduled_expiration exists

valid_until_if_known > valid_from
when valid_until_if_known exists

measurement_window_end > measurement_window_start

completed_at >= started_at
when both exist
```

System/known time and valid/business time remain distinct.

SPEC02 MUST NOT infer `known_until` by mutating an old immutable EpistemicStateVersion.

---

# 12. Canonical Enum Vocabulary

The following source-defined vocabularies are closed for V1 unless a later SPEC explicitly extends them.

```text
EvidenceDomain:
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

DataScope:
TENANT_PRIVATE
WORKSPACE_SHARED
AUTHORIZED_AGGREGATE
GLOBAL_PUBLIC

PropositionType:
FACTUAL
CAUSAL
PREDICTIVE
STRATEGIC
PERFORMANCE
AUDIENCE
MEASUREMENT
DEFINITIONAL

EvidenceCompatibilityStatus:
COMPATIBLE
COMPATIBLE_WITH_LIMITS
INCOMPATIBLE
UNCERTAIN

EvidenceRelationship:
SUPPORTS
PARTIALLY_SUPPORTS
QUALIFIES
CONTRADICTS
DOES_NOT_ADDRESS

ResearchOutcome:
FOUND_RELEVANT_EVIDENCE
NO_EVIDENCE_FOUND
SEARCH_INCOMPLETE
SEARCH_FAILED

AudienceStateStage:
PROVISIONAL
REFINED
FINAL_FOR_DECISION

KnowledgeGapStatus:
OPEN
RESOLVED_BY_RESEARCH
RESOLVED_BY_USER
EXPLICIT_ASSUMPTION
UNRESOLVED_NON_BLOCKING
BLOCKING

ApplicabilityStage:
PRE_GENERATION_PROVISIONAL
PRE_GENERATION_FINAL
CONTENT_LEVEL

ApplicabilitySubjectType:
GUIDANCE
NORMATIVE_RULE

ApplicabilityResult:
APPLICABLE
PARTIALLY_APPLICABLE
NOT_APPLICABLE
UNCERTAIN

AssertionPropositionRelation:
EQUIVALENT
NARROWER
BROADER
CONJUNCT
IMPLIES
CONTRADICTS

AssertionValidationStatus:
SUPPORTED
SUPPORTED_WITH_QUALIFICATION
OVERCLAIM
UNSUPPORTED
CONTRADICTORY

CompositeAssessmentStatus:
STABLE
STABLE_WITH_REQUIREMENTS
INVALID
REVIEW_REQUIRED

RightsCheckStatus:
ALLOWED
ALLOWED_WITH_REQUIREMENTS
REVIEW_REQUIRED
BLOCKED

HumanReviewMode:
ADJUDICATION_ONLY
NEW_INFORMATION_INTRODUCED

ReleaseStatus:
READY
READY_WITH_WARNINGS
HUMAN_REVIEW_REQUIRED
BLOCKED

ConflictResolutionType:
HARD_DENY_OVERRIDES
HARD_REQUIREMENT_OVERRIDES
MORE_SPECIFIC_SCOPE
EXPLICIT_PRIORITY
AUTHORIZED_OVERRIDE
ESCALATE

PublicationState:
SINGLE_ARTIFACT
MIXED_PUBLICATION_STATE
UNRESOLVED_PUBLICATION_STATE

ReplayabilityStatusValue:
FULL
PARTIAL_REDACTED
UNAVAILABLE_DUE_TO_RETENTION
INVALIDATED_BY_DELETION
```

---

# 13. Domain Contract Representation

The following sections reproduce every Blueprint field in the canonical data model.

`Required` means required by the source contract unless the field ends in `?`.

Reference sets are normalized according to §8.


# 14. Control Plane & Task

## RegisteredControlPlaneRevision

```text
canonical_table: registered_control_plane_revision
identity: `(entity_type, revision_id)`; stable identity `(entity_type, stable_id)`
mutability: IMMUTABLE REVISION
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `entity_type` | `EntityType` | REQUIRED | — |
| `stable_id` | `StableId` | REQUIRED | stable identity within `entity_type` |
| `revision_id` | `RevisionId` | REQUIRED | exact revision identity; FK via `RevisionRegistry` |
| `supersedes_revision_id` | `RevisionId` | OPTIONAL | same `entity_type` + `stable_id`; validated through `RevisionRegistry` |
| `payload_hash` | `Hash256` | REQUIRED | — |
| `payload_schema_revision_id` | `RevisionId` | REQUIRED | must resolve to SchemaDefinition revision |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- `entity_type` MUST be one of PromptConfig, ModelConfig, ToolConfig, RetrieverConfig, EvaluatorConfig, SchemaDefinition.
- `payload_schema_revision_id` resolves to an immutable registered SchemaDefinition revision.
- A RevisionRef is valid only when entity_type, stable_id and revision_id agree with RevisionRegistry.

Canonical payload persistence:

```text
RegisteredControlPlaneRevisionPayload

entity_type
stable_id
revision_id

tenant_id
workspace_id?

object_id
payload_hash
payload_schema_revision_id

created_at
```

Required:

```text
PRIMARY KEY(entity_type, revision_id)

FK(entity_type, stable_id, revision_id)
→ RevisionRegistry(entity_type, stable_id, revision_id)

FK(object_id)
→ ObjectRegistry(object_id)
```

Ownership constraint in MULTI_TENANT mode:

```text
RegisteredControlPlaneRevisionPayload.tenant_id
=
RevisionRegistry.tenant_id
=
ObjectRegistry.tenant_id
```

and, when workspace ownership is present:

```text
payload.workspace_id
=
revision.workspace_id
=
object.workspace_id
```

unless a later explicit shared/public ownership contract authorizes a narrower exception.

A payload row MUST NOT bind one tenant's revision identity to another tenant's object.

The payload row is immutable.

`payload_hash` MUST equal the hash of the referenced ObjectRegistry payload.

`payload_schema_revision_id` MUST equal the RegisteredControlPlaneRevision schema reference and resolve to an immutable SchemaDefinition revision.

Historical replay of PromptConfig / ModelConfig / ToolConfig / RetrieverConfig / EvaluatorConfig / SchemaDefinition loads the exact payload through this row.

The payload owner is the revision identity, not `ImmutableEntityRegistry`.

## ContentProgramRevision

```text
canonical_table: content_program_revision
identity: `program_revision_id`; stable identity `program_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `program_id` | `StableId` | REQUIRED | stable conceptual identity |
| `program_revision_id` | `RevisionId` | REQUIRED | PRIMARY KEY; exact revision identity; FK via `RevisionRegistry` |
| `supersedes_program_revision_id` | `Ref<ContentProgramRevision>` | OPTIONAL | FK → `ContentProgramRevision`; predecessor MUST share stable ID |
| `business_objective` | `Structured/Text` | REQUIRED | — |
| `brand_objective` | `Structured/Text` | REQUIRED | — |
| `outcome_model_id` | `Ref<OutcomeModel>` | OPTIONAL | FK → `OutcomeModel` |
| `target_audiences` | `Structured/Text` | REQUIRED | — |
| `markets` | `Structured/Text` | REQUIRED | — |
| `message_hierarchy` | `Structured/Text` | REQUIRED | — |
| `content_pillars` | `Structured/Text` | REQUIRED | — |
| `channel_roles` | `Structured/Text` | REQUIRED | — |
| `success_metric_revision_ids` | `RefSet<MetricDefinitionRevision>` | REQUIRED | FK → `MetricDefinitionRevision`; normalized link table; no canonical opaque ID array |
| `guardrail_metric_revision_ids` | `RefSet<MetricDefinitionRevision>` | REQUIRED | FK → `MetricDefinitionRevision`; normalized link table; no canonical opaque ID array |
| `budget_context` | `Structured/Text` | REQUIRED | — |
| `effective_from` | `Timestamp` | REQUIRED | — |
| `scheduled_expiration` | `Timestamp` | OPTIONAL | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- `program_revision_id` is exact historical identity and registers in RevisionRegistry.
- `program_id` is conceptual identity and MUST equal predecessor stable ID when `supersedes_program_revision_id` is present.
- No UPDATE after commit.

## OutcomeModel

```text
canonical_table: outcome_model
identity: `outcome_model_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `outcome_model_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `business_outcomes` | `Structured/Text` | REQUIRED | — |
| `behavioral_outcomes` | `Structured/Text` | REQUIRED | — |
| `content_metric_revision_ids` | `RefSet<MetricDefinitionRevision>` | REQUIRED | FK → `MetricDefinitionRevision`; normalized link table; no canonical opaque ID array |
| `diagnostic_metric_revision_ids` | `RefSet<MetricDefinitionRevision>` | REQUIRED | FK → `MetricDefinitionRevision`; normalized link table; no canonical opaque ID array |
| `guardrail_metric_revision_ids` | `RefSet<MetricDefinitionRevision>` | REQUIRED | FK → `MetricDefinitionRevision`; normalized link table; no canonical opaque ID array |
| `outcome_edge_ids` | `RefSet<OutcomeEdge>` | REQUIRED | FK → `OutcomeEdge`; normalized link table; no canonical opaque ID array |
| `time_horizons` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

## OutcomeEdge

```text
canonical_table: outcome_edge
identity: `edge_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `edge_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `from_node` | `Structured/Text` | REQUIRED | — |
| `to_node` | `Structured/Text` | REQUIRED | — |
| `relationship_type` | `Enum` | REQUIRED | — |
| `proposition_ids` | `RefSet<Proposition>` | REQUIRED | FK → `Proposition`; normalized link table; no canonical opaque ID array |
| `assumptions` | `Structured/Text` | REQUIRED | — |
| `known_confounders` | `Structured/Text` | REQUIRED | — |
| `time_lag` | `Duration/Window` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

## AttributionModelRevision

```text
canonical_table: attribution_model_revision
identity: `attribution_model_revision_id`; stable identity `attribution_model_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `attribution_model_id` | `StableId` | REQUIRED | stable conceptual identity |
| `attribution_model_revision_id` | `RevisionId` | REQUIRED | PRIMARY KEY; exact revision identity; FK via `RevisionRegistry` |
| `supersedes_attribution_model_revision_id` | `Ref<AttributionModelRevision>` | OPTIONAL | FK → `AttributionModelRevision`; predecessor MUST share stable ID |
| `model_type` | `Structured/Text` | REQUIRED | — |
| `eligible_touchpoints` | `Structured/Text` | REQUIRED | — |
| `lookback_window` | `Duration/Window` | REQUIRED | — |
| `credit_assignment` | `Structured/Text` | REQUIRED | — |
| `assumptions` | `Structured/Text` | REQUIRED | — |
| `limitations` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- `attribution_model_revision_id` is exact historical identity and registers in RevisionRegistry.
- `attribution_model_id` is conceptual identity and MUST equal predecessor stable ID when `supersedes_attribution_model_revision_id` is present.
- No UPDATE after commit.

## MetricDefinitionRevision

```text
canonical_table: metric_definition_revision
identity: `metric_revision_id`; stable identity `metric_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `metric_id` | `StableId` | REQUIRED | stable conceptual identity |
| `metric_revision_id` | `RevisionId` | REQUIRED | PRIMARY KEY; exact revision identity; FK via `RevisionRegistry` |
| `supersedes_metric_revision_id` | `Ref<MetricDefinitionRevision>` | OPTIONAL | FK → `MetricDefinitionRevision`; predecessor MUST share stable ID |
| `metric_name` | `Structured/Text` | REQUIRED | — |
| `layer` | `Structured/Text` | REQUIRED | — |
| `definition` | `Structured/Text` | REQUIRED | — |
| `numerator` | `Structured/Text` | REQUIRED | — |
| `denominator` | `Structured/Text` | REQUIRED | — |
| `window` | `Duration/Window` | REQUIRED | — |
| `attribution_model_revision_id` | `Ref<AttributionModelRevision>` | OPTIONAL | FK → `AttributionModelRevision` |
| `effective_from` | `Timestamp` | REQUIRED | — |
| `scheduled_expiration` | `Timestamp` | OPTIONAL | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- `metric_revision_id` is exact historical identity and registers in RevisionRegistry.
- `metric_id` is conceptual identity and MUST equal predecessor stable ID when `supersedes_metric_revision_id` is present.
- No UPDATE after commit.

## EvalContractRevision

```text
canonical_table: eval_contract_revision
identity: `eval_contract_revision_id`; stable identity `eval_contract_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `eval_contract_id` | `StableId` | REQUIRED | stable conceptual identity |
| `eval_contract_revision_id` | `RevisionId` | REQUIRED | PRIMARY KEY; exact revision identity; FK via `RevisionRegistry` |
| `supersedes_eval_contract_revision_id` | `Ref<EvalContractRevision>` | OPTIONAL | FK → `EvalContractRevision`; predecessor MUST share stable ID |
| `component` | `Structured/Text` | REQUIRED | — |
| `capability` | `Structured/Text` | REQUIRED | — |
| `required_dimensions` | `Structured/Text` | REQUIRED | — |
| `hard_gates` | `Structured/Text` | REQUIRED | — |
| `release_impact` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- `eval_contract_revision_id` is exact historical identity and registers in RevisionRegistry.
- `eval_contract_id` is conceptual identity and MUST equal predecessor stable ID when `supersedes_eval_contract_revision_id` is present.
- No UPDATE after commit.

## ChannelProfileRevision

```text
canonical_table: channel_profile_revision
identity: `channel_profile_revision_id`; stable identity `channel_profile_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `channel_profile_id` | `StableId` | REQUIRED | stable conceptual identity |
| `channel_profile_revision_id` | `RevisionId` | REQUIRED | PRIMARY KEY; exact revision identity; FK via `RevisionRegistry` |
| `supersedes_channel_profile_revision_id` | `Ref<ChannelProfileRevision>` | OPTIONAL | FK → `ChannelProfileRevision`; predecessor MUST share stable ID |
| `identity` | `Structured/Text` | REQUIRED | — |
| `platform_if_applicable` | `Structured/Text` | REQUIRED | — |
| `supported_formats` | `Structured/Text` | REQUIRED | — |
| `distribution_capabilities` | `Structured/Text` | REQUIRED | — |
| `technical_capabilities` | `Structured/Text` | REQUIRED | — |
| `content_capabilities` | `Structured/Text` | REQUIRED | — |
| `rule_revision_refs` | `RevisionRefSet` | REQUIRED | FK via `revision_registry`; normalized typed-ref link table |
| `guidance_revision_refs` | `RevisionRefSet` | REQUIRED | FK via `revision_registry`; normalized typed-ref link table |
| `metric_revision_refs` | `RevisionRefSet` | REQUIRED | FK via `revision_registry`; normalized typed-ref link table |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- `channel_profile_revision_id` is exact historical identity and registers in RevisionRegistry.
- `channel_profile_id` is conceptual identity and MUST equal predecessor stable ID when `supersedes_channel_profile_revision_id` is present.
- No UPDATE after commit.

## TaskContractRevision

```text
canonical_table: task_contract_revision
identity: `task_revision_id`; stable identity `task_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `task_id` | `StableId` | REQUIRED | stable conceptual identity |
| `task_revision_id` | `RevisionId` | REQUIRED | PRIMARY KEY; exact revision identity; FK via `RevisionRegistry` |
| `supersedes_task_revision_id` | `Ref<TaskContractRevision>` | OPTIONAL | FK → `TaskContractRevision`; predecessor MUST share stable ID |
| `program_revision_id` | `Ref<ContentProgramRevision>` | OPTIONAL | FK → `ContentProgramRevision` |
| `standalone_task` | `Boolean` | REQUIRED | — |
| `objective` | `Structured/Text` | REQUIRED | — |
| `channel` | `Structured/Text` | REQUIRED | — |
| `format` | `Structured/Text` | REQUIRED | — |
| `language` | `Structured/Text` | REQUIRED | — |
| `market` | `Structured/Text` | REQUIRED | — |
| `jurisdiction` | `Structured/Text` | REQUIRED | — |
| `brand_id` | `ExternalId` | REQUIRED | opaque external business ID; not dereferenced by ContentOS; Blueprint explicit external-ID exception |
| `product_id` | `ExternalId` | REQUIRED | opaque external business ID; not dereferenced by ContentOS; Blueprint explicit external-ID exception |
| `audience_context` | `Structured/Text` | REQUIRED | — |
| `success_metric_revision_id` | `Ref<MetricDefinitionRevision>` | REQUIRED | FK → `MetricDefinitionRevision` |
| `secondary_metric_revision_ids` | `RefSet<MetricDefinitionRevision>` | REQUIRED | FK → `MetricDefinitionRevision`; normalized link table; no canonical opaque ID array |
| `guardrail_metric_revision_ids` | `RefSet<MetricDefinitionRevision>` | REQUIRED | FK → `MetricDefinitionRevision`; normalized link table; no canonical opaque ID array |
| `constraints` | `Structured/Text` | REQUIRED | — |
| `risk_context` | `Structured/Text` | REQUIRED | — |
| `compute_budget` | `Structured/Text` | REQUIRED | — |
| `intended_publication_time` | `Timestamp` | OPTIONAL | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- `task_revision_id` is exact historical identity and registers in RevisionRegistry.
- `task_id` is conceptual identity and MUST equal predecessor stable ID when `supersedes_task_revision_id` is present.
- No UPDATE after commit.
- `standalone_task=false` requires non-null program_revision_id; standalone_task=true requires null program_revision_id for decision closure.
- `brand_id` and `product_id` remain opaque external identifiers.

## GuidanceRevision

```text
canonical_table: guidance_revision
identity: `guidance_revision_id`; stable identity `guidance_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `guidance_id` | `StableId` | REQUIRED | stable conceptual identity |
| `guidance_revision_id` | `RevisionId` | REQUIRED | PRIMARY KEY; exact revision identity; FK via `RevisionRegistry` |
| `supersedes_guidance_revision_id` | `Ref<GuidanceRevision>` | OPTIONAL | FK → `GuidanceRevision`; predecessor MUST share stable ID |
| `guidance_type` | `Enum` | REQUIRED | — |
| `recommendation` | `Structured/Text` | REQUIRED | — |
| `scope` | `Structured/Text` | REQUIRED | — |
| `supporting_proposition_ids` | `RefSet<Proposition>` | REQUIRED | FK → `Proposition`; normalized link table; no canonical opaque ID array |
| `limitations` | `Structured/Text` | REQUIRED | — |
| `effective_from` | `Timestamp` | REQUIRED | — |
| `scheduled_expiration` | `Timestamp` | OPTIONAL | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- `guidance_revision_id` is exact historical identity and registers in RevisionRegistry.
- `guidance_id` is conceptual identity and MUST equal predecessor stable ID when `supersedes_guidance_revision_id` is present.
- No UPDATE after commit.

## NormativeRuleRevision

```text
canonical_table: normative_rule_revision
identity: `rule_revision_id`; stable identity `rule_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `rule_id` | `StableId` | REQUIRED | stable conceptual identity |
| `rule_revision_id` | `RevisionId` | REQUIRED | PRIMARY KEY; exact revision identity; FK via `RevisionRegistry` |
| `supersedes_rule_revision_id` | `Ref<NormativeRuleRevision>` | OPTIONAL | FK → `NormativeRuleRevision`; predecessor MUST share stable ID |
| `rule_type` | `Enum` | REQUIRED | — |
| `statement` | `Structured/Text` | REQUIRED | — |
| `jurisdiction` | `Structured/Text` | REQUIRED | — |
| `scope` | `Structured/Text` | REQUIRED | — |
| `applicability_conditions` | `Structured/Text` | REQUIRED | — |
| `enforcement_level` | `Enum` | REQUIRED | — |
| `source_ids` | `RefSet<SourceArtifact>` | REQUIRED | FK → `SourceArtifact`; normalized link table; no canonical opaque ID array |
| `valid_from` | `Timestamp` | REQUIRED | — |
| `known_from` | `Timestamp` | REQUIRED | — |
| `scheduled_expiration` | `Timestamp` | OPTIONAL | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- `rule_revision_id` is exact historical identity and registers in RevisionRegistry.
- `rule_id` is conceptual identity and MUST equal predecessor stable ID when `supersedes_rule_revision_id` is present.
- No UPDATE after commit.

## DecisionPolicyRevision

```text
canonical_table: decision_policy_revision
identity: `policy_revision_id`; stable identity `policy_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `policy_id` | `StableId` | REQUIRED | stable conceptual identity |
| `policy_revision_id` | `RevisionId` | REQUIRED | PRIMARY KEY; exact revision identity; FK via `RevisionRegistry` |
| `supersedes_policy_revision_id` | `Ref<DecisionPolicyRevision>` | OPTIONAL | FK → `DecisionPolicyRevision`; predecessor MUST share stable ID |
| `conditions` | `Structured/Text` | REQUIRED | — |
| `required_inputs` | `Structured/Text` | REQUIRED | — |
| `action` | `Structured/Text` | REQUIRED | — |
| `priority_class` | `Structured/Text` | REQUIRED | — |
| `scope` | `Structured/Text` | REQUIRED | — |
| `override_allowed` | `Boolean` | REQUIRED | — |
| `override_authority_requirements` | `Structured/Text` | OPTIONAL | — |
| `override_scope_constraints` | `Structured/Text` | OPTIONAL | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- `policy_revision_id` is exact historical identity and registers in RevisionRegistry.
- `policy_id` is conceptual identity and MUST equal predecessor stable ID when `supersedes_policy_revision_id` is present.
- No UPDATE after commit.

# 15. Knowledge & Epistemic

## AudienceState

```text
canonical_table: audience_state
identity: `audience_state_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `audience_state_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `task_revision_id` | `Ref<TaskContractRevision>` | REQUIRED | FK → `TaskContractRevision` |
| `state_stage` | `Enum` | REQUIRED | — |
| `context` | `Structured/Text` | REQUIRED | — |
| `knowledge_state` | `Structured/Text` | REQUIRED | — |
| `problem_state` | `Structured/Text` | REQUIRED | — |
| `solution_state` | `Structured/Text` | REQUIRED | — |
| `product_state` | `Structured/Text` | REQUIRED | — |
| `brand_state` | `Structured/Text` | REQUIRED | — |
| `intent_state` | `Structured/Text` | REQUIRED | — |
| `desired_outcome` | `Structured/Text` | REQUIRED | — |
| `objections` | `Structured/Text` | REQUIRED | — |
| `decision_criteria` | `Structured/Text` | REQUIRED | — |
| `prior_exposure` | `Structured/Text` | REQUIRED | — |
| `origin` | `Enum` | REQUIRED | — |
| `uncertainty` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

## KnowledgeGap

```text
canonical_table: knowledge_gap
identity: `gap_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `gap_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `supersedes_gap_id` | `Ref<KnowledgeGap>` | OPTIONAL | FK → `KnowledgeGap` |
| `task_revision_id` | `Ref<TaskContractRevision>` | REQUIRED | FK → `TaskContractRevision` |
| `question` | `Structured/Text` | REQUIRED | — |
| `decision_relevance` | `Structured/Text` | REQUIRED | — |
| `blocking` | `Boolean` | REQUIRED | — |
| `researchable` | `Boolean` | REQUIRED | — |
| `user_resolvable` | `Boolean` | REQUIRED | — |
| `assumption_allowed` | `Boolean` | REQUIRED | — |
| `risk_if_wrong` | `Structured/Text` | REQUIRED | — |
| `status` | `Enum` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- Status change inserts a new gap_id and may set supersedes_gap_id; prior row remains immutable.
- Research failure does not permit a blocking gap to disappear.

## ResearchTrace

```text
canonical_table: research_trace
identity: `research_trace_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `research_trace_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `gap_id` | `Ref<KnowledgeGap>` | REQUIRED | FK → `KnowledgeGap` |
| `research_question` | `Structured/Text` | REQUIRED | — |
| `queries` | `Structured/Text` | REQUIRED | — |
| `sources_searched` | `Structured/Text` | REQUIRED | — |
| `retrieval_revision_ref` | `RevisionRef` | REQUIRED | FK via `revision_registry` |
| `result_evidence_ids` | `RefSet<EvidenceItem>` | REQUIRED | FK → `EvidenceItem`; normalized link table; no canonical opaque ID array |
| `coverage_limitations` | `Structured/Text` | REQUIRED | — |
| `outcome` | `Structured/Text` | REQUIRED | — |
| `stop_reason` | `Structured/Text` | REQUIRED | — |
| `started_at` | `Timestamp` | REQUIRED | — |
| `completed_at` | `Timestamp` | REQUIRED | — |

## SourceArtifact

```text
canonical_table: source_artifact
identity: `source_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `source_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `source_type` | `Enum` | REQUIRED | — |
| `publisher` | `Structured/Text` | REQUIRED | — |
| `author` | `Structured/Text` | REQUIRED | — |
| `jurisdiction` | `Structured/Text` | REQUIRED | — |
| `source_version` | `Structured/Text` | REQUIRED | — |
| `retrieved_at` | `Timestamp` | REQUIRED | — |
| `content_hash` | `Hash256` | REQUIRED | — |
| `snapshot_reference` | `ObjectRef` | REQUIRED | FK → `ObjectRegistry.object_id`; referenced object MUST be AVAILABLE at canonical insert |
| `rights_policy_id` | `Ref<RightsPolicy>` | REQUIRED | FK → `RightsPolicy` |
| `data_scope` | `Enum` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required object invariant:

- `snapshot_reference` is not free-form text in canonical storage.
- Canonical SourceArtifact insert and ObjectRegistry availability check follow the serialized object-reference protocol in §30.

## EvidenceItem

```text
canonical_table: evidence_item
identity: `evidence_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `evidence_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `origin_type` | `Enum` | REQUIRED | — |
| `origin_id` | `EntityId` | REQUIRED | dynamic FK: SOURCE_ARTIFACT→SourceArtifact; PERFORMANCE_OBSERVATION→PerformanceObservation |
| `locator` | `Structured/Text` | OPTIONAL | — |
| `statement` | `Structured/Text` | REQUIRED | — |
| `statement_type` | `Enum` | REQUIRED | — |
| `assertion_method` | `Enum` | REQUIRED | — |
| `evidence_domain` | `Enum` | REQUIRED | — |
| `study_design` | `Structured/Text` | REQUIRED | — |
| `causal_identification` | `Structured/Text` | REQUIRED | — |
| `mechanism_support` | `Structured/Text` | REQUIRED | — |
| `valid_from` | `Timestamp` | REQUIRED | — |
| `valid_until_if_known` | `Timestamp` | OPTIONAL | — |
| `limitations` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- origin_type=SOURCE_ARTIFACT requires origin_id resolve to SourceArtifact.
- origin_type=PERFORMANCE_OBSERVATION requires origin_id resolve to PerformanceObservation.

## Proposition

```text
canonical_table: proposition
identity: `proposition_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `proposition_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `proposition_type` | `Enum` | REQUIRED | — |
| `canonical_meaning` | `Structured/Text` | REQUIRED | — |
| `subject` | `Structured/Text` | REQUIRED | — |
| `predicate` | `Structured/Text` | REQUIRED | — |
| `object` | `Structured/Text` | REQUIRED | — |
| `qualifiers` | `Structured/Text` | REQUIRED | — |
| `conditions` | `Structured/Text` | REQUIRED | — |
| `population_scope` | `Structured/Text` | REQUIRED | — |
| `jurisdiction_scope` | `Structured/Text` | REQUIRED | — |
| `supersedes_proposition_id` | `Ref<Proposition>` | OPTIONAL | FK → `Proposition` |
| `created_at` | `Timestamp` | REQUIRED | — |

## EvidencePropositionLink

```text
canonical_table: evidence_proposition_link
identity: `link_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `link_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `evidence_id` | `Ref<EvidenceItem>` | REQUIRED | FK → `EvidenceItem` |
| `proposition_id` | `Ref<Proposition>` | REQUIRED | FK → `Proposition` |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- UNIQUE(evidence_id, proposition_id) is REQUIRED unless later SPEC demonstrates legitimate duplicate-link semantics.

## EvidenceAssessment

```text
canonical_table: evidence_assessment
identity: `assessment_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `assessment_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `supersedes_assessment_id` | `Ref<EvidenceAssessment>` | OPTIONAL | FK → `EvidenceAssessment` |
| `link_id` | `Ref<EvidencePropositionLink>` | REQUIRED | FK → `EvidencePropositionLink` |
| `compatibility_status` | `Enum` | REQUIRED | — |
| `relationship` | `Enum` | REQUIRED | — |
| `assessor` | `Structured/Text` | REQUIRED | — |
| `assessment_method` | `Structured/Text` | REQUIRED | — |
| `authority` | `Structured/Text` | REQUIRED | — |
| `methodological_quality` | `Structured/Text` | REQUIRED | — |
| `directness` | `Structured/Text` | REQUIRED | — |
| `applicability` | `Structured/Text` | REQUIRED | — |
| `population_match` | `Structured/Text` | REQUIRED | — |
| `context_match` | `Structured/Text` | REQUIRED | — |
| `freshness` | `Structured/Text` | REQUIRED | — |
| `independence` | `Structured/Text` | REQUIRED | — |
| `precision` | `Structured/Text` | REQUIRED | — |
| `limitations` | `Structured/Text` | REQUIRED | — |
| `uncertainty` | `Structured/Text` | REQUIRED | — |
| `assessed_at` | `Timestamp` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- Reassessment inserts a new assessment_id; compatibility and relationship remain separate fields.

## EpistemicStateVersion

```text
canonical_table: epistemic_state_version
identity: `epistemic_state_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `epistemic_state_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `supersedes_epistemic_state_id` | `Ref<EpistemicStateVersion>` | OPTIONAL | FK → `EpistemicStateVersion` |
| `proposition_id` | `Ref<Proposition>` | REQUIRED | FK → `Proposition` |
| `assessment_ids` | `RefSet<EvidenceAssessment>` | REQUIRED | FK → `EvidenceAssessment`; normalized link table; no canonical opaque ID array |
| `support_status` | `Enum` | REQUIRED | — |
| `causal_status` | `Enum` | REQUIRED | — |
| `uncertainty` | `Structured/Text` | REQUIRED | — |
| `derivation_method` | `Structured/Text` | REQUIRED | — |
| `derivation_revision_ref` | `RevisionRef` | REQUIRED | FK via `revision_registry` |
| `valid_from` | `Timestamp` | REQUIRED | — |
| `valid_until_if_known` | `Timestamp` | OPTIONAL | — |
| `known_from` | `Timestamp` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- At most one root per proposition_id.
- At most one direct successor per predecessor.
- Successor proposition_id MUST equal predecessor proposition_id.
- Successor known_from MUST be greater than predecessor known_from.
- Supersession graph MUST be acyclic.

# 16. Content, Validation, Risk & Rights

## ApplicabilityAssessment

```text
canonical_table: applicability_assessment
identity: `assessment_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `assessment_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `subject_type` | `Enum` | REQUIRED | — |
| `subject_revision_id` | `RevisionId` | REQUIRED | typed by subject_type: GuidanceRevision or NormativeRuleRevision |
| `task_revision_id` | `Ref<TaskContractRevision>` | REQUIRED | FK → `TaskContractRevision` |
| `assessment_stage` | `Enum` | REQUIRED | — |
| `result` | `Enum` | REQUIRED | — |
| `applicability_strength` | `Structured/Text` | OPTIONAL | — |
| `scope_matches` | `Structured/Text` | REQUIRED | — |
| `reason_codes` | `Structured/Text` | REQUIRED | — |
| `assessor` | `Structured/Text` | REQUIRED | — |
| `uncertainty` | `Structured/Text` | REQUIRED | — |
| `review_required` | `Boolean` | REQUIRED | — |
| `dependency_fingerprint` | `Structured/Text` | REQUIRED | — |
| `target_valid_time` | `Timestamp` | REQUIRED | — |
| `knowledge_cutoff_time` | `Timestamp` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- subject_revision_id target is determined by subject_type.
- For final decision assessments: knowledge_cutoff_time <= DecisionSnapshot.frozen_at.
- Final decision assessments use one resolved target_valid_time for the Task.

## StrategyHypothesis

```text
canonical_table: strategy_hypothesis
identity: `strategy_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `strategy_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `task_revision_id` | `Ref<TaskContractRevision>` | REQUIRED | FK → `TaskContractRevision` |
| `audience_state_id` | `Ref<AudienceState>` | REQUIRED | FK → `AudienceState` |
| `core_message` | `Structured/Text` | REQUIRED | — |
| `behavioral_objective` | `Structured/Text` | REQUIRED | — |
| `persuasion_mechanism` | `Structured/Text` | REQUIRED | — |
| `proof_strategy` | `Structured/Text` | REQUIRED | — |
| `required_proposition_ids` | `RefSet<Proposition>` | REQUIRED | FK → `Proposition`; normalized link table; no canonical opaque ID array |
| `assumptions` | `Structured/Text` | REQUIRED | — |
| `unknowns` | `Structured/Text` | REQUIRED | — |
| `failure_modes` | `Structured/Text` | REQUIRED | — |
| `risk_hypotheses` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

## ContentArchitecture

```text
canonical_table: content_architecture
identity: `architecture_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `architecture_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `supersedes_architecture_id` | `Ref<ContentArchitecture>` | OPTIONAL | FK → `ContentArchitecture` |
| `task_revision_id` | `Ref<TaskContractRevision>` | REQUIRED | FK → `TaskContractRevision` |
| `strategy_id` | `Ref<StrategyHypothesis>` | REQUIRED | FK → `StrategyHypothesis` |
| `unit_ids` | `RefSet<ContentUnit>` | REQUIRED | FK → `ContentUnit`; normalized link table; no canonical opaque ID array |
| `created_at` | `Timestamp` | REQUIRED | — |

## ContentUnit

```text
canonical_table: content_unit
identity: `unit_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `unit_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `position` | `Integer` | REQUIRED | — |
| `purpose` | `Structured/Text` | REQUIRED | — |
| `audience_state_before` | `Structured/Text` | REQUIRED | — |
| `audience_question` | `Structured/Text` | REQUIRED | — |
| `information_to_deliver` | `Structured/Text` | REQUIRED | — |
| `proposition_ids` | `RefSet<Proposition>` | REQUIRED | FK → `Proposition`; normalized link table; no canonical opaque ID array |
| `copy_goal` | `Structured/Text` | REQUIRED | — |
| `visual_goal` | `Structured/Text` | REQUIRED | — |
| `audio_goal` | `Structured/Text` | REQUIRED | — |
| `payoff` | `Structured/Text` | REQUIRED | — |
| `transition` | `Structured/Text` | REQUIRED | — |
| `audience_state_after` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

## ContentCandidate

```text
canonical_table: content_candidate
identity: `candidate_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `candidate_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `task_revision_id` | `Ref<TaskContractRevision>` | REQUIRED | FK → `TaskContractRevision` |
| `strategy_id` | `Ref<StrategyHypothesis>` | REQUIRED | FK → `StrategyHypothesis` |
| `architecture_id` | `Ref<ContentArchitecture>` | REQUIRED | FK → `ContentArchitecture` |
| `content_payload` | `Structured/Text` | REQUIRED | — |
| `run_config_id` | `Ref<RunConfig>` | REQUIRED | FK → `RunConfig` |
| `parent_candidate_id` | `Ref<ContentCandidate>` | OPTIONAL | FK → `ContentCandidate` |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- run_config_id MUST equal the RunConfig frozen into any DecisionSnapshot containing the candidate.
- Rewrite creates a new candidate_id.

## ContentAssertion

```text
canonical_table: content_assertion
identity: `assertion_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `assertion_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `artifact_ref` | `ImmutableEntityRef` | REQUIRED | FK via immutable/revision registry tagged union; must resolve to immutable artifact entity |
| `modality` | `Enum` | REQUIRED | — |
| `explicitness` | `Enum` | REQUIRED | — |
| `interpretation` | `Structured/Text` | REQUIRED | — |
| `materiality` | `Enum` | REQUIRED | — |
| `source_elements` | `Structured/Text` | REQUIRED | — |
| `wording_strength` | `Structured/Text` | REQUIRED | — |
| `conditions` | `Structured/Text` | REQUIRED | — |
| `audience_interpretation_context` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

## AssertionPropositionLink

```text
canonical_table: assertion_proposition_link
identity: `link_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `link_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `assertion_id` | `Ref<ContentAssertion>` | REQUIRED | FK → `ContentAssertion` |
| `proposition_id` | `Ref<Proposition>` | REQUIRED | FK → `Proposition` |
| `relation` | `Enum` | REQUIRED | — |
| `mapping_uncertainty` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

## AssertionValidationResult

```text
canonical_table: assertion_validation_result
identity: `result_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `result_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `assertion_id` | `Ref<ContentAssertion>` | REQUIRED | FK → `ContentAssertion` |
| `status` | `Enum` | REQUIRED | — |
| `proposition_link_ids` | `RefSet<AssertionPropositionLink>` | REQUIRED | FK → `AssertionPropositionLink`; normalized link table; no canonical opaque ID array |
| `reason_codes` | `Structured/Text` | REQUIRED | — |
| `required_qualification` | `Structured/Text` | OPTIONAL | — |
| `evaluator_revision_ref` | `RevisionRef` | REQUIRED | FK via `revision_registry` |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- evaluator_revision_ref MUST resolve to registered EvaluatorConfig and, for run-created results, be present in the snapshot RunConfig.

## CompositeImpressionAssessment

```text
canonical_table: composite_impression_assessment
identity: `assessment_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `assessment_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `candidate_id` | `Ref<ContentCandidate>` | REQUIRED | FK → `ContentCandidate` |
| `input_assertion_ids` | `RefSet<ContentAssertion>` | REQUIRED | FK → `ContentAssertion`; normalized link table; no canonical opaque ID array |
| `likely_interpretations` | `Structured/Text` | REQUIRED | — |
| `implied_assertion_ids` | `RefSet<ContentAssertion>` | REQUIRED | FK → `ContentAssertion`; normalized link table; no canonical opaque ID array |
| `misleading_risks` | `Structured/Text` | REQUIRED | — |
| `required_disclosures` | `Structured/Text` | REQUIRED | — |
| `status` | `Enum` | REQUIRED | — |
| `evaluator_revision_ref` | `RevisionRef` | REQUIRED | FK via `revision_registry` |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- All input_assertion_ids and implied_assertion_ids used by the final stable assessment must be present in the DecisionSnapshot.

## QualitativeEvaluation

```text
canonical_table: qualitative_evaluation
identity: `evaluation_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `evaluation_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `candidate_id` | `Ref<ContentCandidate>` | REQUIRED | FK → `ContentCandidate` |
| `eval_contract_revision_id` | `Ref<EvalContractRevision>` | REQUIRED | FK → `EvalContractRevision` |
| `dimension_results` | `Structured/Text` | REQUIRED | — |
| `hard_gate_results` | `Structured/Text` | REQUIRED | — |
| `overall_state` | `Structured/Text` | OPTIONAL | — |
| `evaluator_revision_ref` | `RevisionRef` | REQUIRED | FK via `revision_registry` |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- eval_contract_revision_id resolves to EvalContractRevision.
- evaluator_revision_ref resolves to registered EvaluatorConfig and must be pinned in RunConfig for run-created evaluations.

## RiskAssessment

```text
canonical_table: risk_assessment
identity: `risk_assessment_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `risk_assessment_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `subject_ref` | `ImmutableEntityRef` | REQUIRED | FK via immutable/revision registry tagged union |
| `harm_type` | `Structured/Text` | REQUIRED | — |
| `severity` | `Structured/Text` | REQUIRED | — |
| `likelihood` | `Structured/Text` | REQUIRED | — |
| `exposure` | `Structured/Text` | REQUIRED | — |
| `reversibility` | `Structured/Text` | REQUIRED | — |
| `regulatory_materiality` | `Structured/Text` | REQUIRED | — |
| `business_impact` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

## UncertaintyAssessment

```text
canonical_table: uncertainty_assessment
identity: `uncertainty_assessment_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `uncertainty_assessment_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `subject_refs` | `TypedRefSet` | REQUIRED | FK via immutable/revision registry tagged union; normalized typed-ref link table |
| `dimensions` | `Structured/Text` | REQUIRED | — |
| `assessment_method` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

## RightsPolicy

```text
canonical_table: rights_policy
identity: `rights_policy_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `rights_policy_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `copyright_status` | `Structured/Text` | REQUIRED | — |
| `license` | `Structured/Text` | REQUIRED | — |
| `analysis_use` | `Boolean` | REQUIRED | — |
| `generation_use` | `Boolean` | REQUIRED | — |
| `quotation_use` | `Boolean` | REQUIRED | — |
| `transformation_permission` | `Boolean` | REQUIRED | — |
| `redistribution_permission` | `Boolean` | REQUIRED | — |
| `commercial_use_permission` | `Boolean` | REQUIRED | — |
| `attribution_requirements` | `Structured/Text` | REQUIRED | — |
| `effective_from` | `Timestamp` | REQUIRED | — |
| `scheduled_expiration` | `Timestamp` | OPTIONAL | — |
| `supersedes_rights_policy_id` | `Ref<RightsPolicy>` | OPTIONAL | FK → `RightsPolicy` |
| `created_at` | `Timestamp` | REQUIRED | — |

## RightsCheck

```text
canonical_table: rights_check
identity: `rights_check_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `rights_check_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `subject_ref` | `ImmutableEntityRef` | REQUIRED | FK via immutable/revision registry tagged union |
| `rights_policy_id` | `Ref<RightsPolicy>` | REQUIRED | FK → `RightsPolicy` |
| `intended_use` | `Enum` | REQUIRED | — |
| `status` | `Enum` | REQUIRED | — |
| `required_attributions` | `Structured/Text` | REQUIRED | — |
| `reason_codes` | `Structured/Text` | REQUIRED | — |
| `target_use_time` | `Structured/Text` | REQUIRED | — |
| `knowledge_cutoff_time` | `Timestamp` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- rights_policy_id MUST be included in the DecisionSnapshot GovernanceSnapshot for decision-relevant checks.
- For publication/redistribution, target_use_time equals resolved Task target valid time.
- knowledge_cutoff_time <= DecisionSnapshot.frozen_at.

# 17. Snapshots, Governance & Decision

## KnowledgeManifest

```text
canonical_table: knowledge_manifest
identity: `knowledge_manifest_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `knowledge_manifest_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `source_ids` | `RefSet<SourceArtifact>` | REQUIRED | FK → `SourceArtifact`; normalized link table; no canonical opaque ID array |
| `evidence_ids` | `RefSet<EvidenceItem>` | REQUIRED | FK → `EvidenceItem`; normalized link table; no canonical opaque ID array |
| `proposition_ids` | `RefSet<Proposition>` | REQUIRED | FK → `Proposition`; normalized link table; no canonical opaque ID array |
| `epistemic_state_ids` | `RefSet<EpistemicStateVersion>` | REQUIRED | FK → `EpistemicStateVersion`; normalized link table; no canonical opaque ID array |
| `content_hash` | `Hash256` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

## BaselineKnowledgeSnapshot

```text
canonical_table: baseline_knowledge_snapshot
identity: `baseline_snapshot_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `baseline_snapshot_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `as_of` | `Timestamp` | REQUIRED | — |
| `knowledge_manifest_id` | `Ref<KnowledgeManifest>` | REQUIRED | FK → `KnowledgeManifest` |
| `program_revision_id` | `Ref<ContentProgramRevision>` | OPTIONAL | FK → `ContentProgramRevision` |
| `channel_profile_revision_ids` | `RefSet<ChannelProfileRevision>` | REQUIRED | FK → `ChannelProfileRevision`; normalized link table; no canonical opaque ID array |
| `created_at` | `Timestamp` | REQUIRED | — |

## RunKnowledgeDelta

```text
canonical_table: run_knowledge_delta
identity: `delta_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `delta_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `run_correlation_key` | `CorrelationKey` | REQUIRED | — |
| `new_source_ids` | `RefSet<SourceArtifact>` | REQUIRED | FK → `SourceArtifact`; normalized link table; no canonical opaque ID array |
| `new_evidence_ids` | `RefSet<EvidenceItem>` | REQUIRED | FK → `EvidenceItem`; normalized link table; no canonical opaque ID array |
| `new_proposition_ids` | `RefSet<Proposition>` | REQUIRED | FK → `Proposition`; normalized link table; no canonical opaque ID array |
| `new_evidence_proposition_link_ids` | `RefSet<EvidencePropositionLink>` | REQUIRED | FK → `EvidencePropositionLink`; normalized link table; no canonical opaque ID array |
| `new_evidence_assessment_ids` | `RefSet<EvidenceAssessment>` | REQUIRED | FK → `EvidenceAssessment`; normalized link table; no canonical opaque ID array |
| `new_epistemic_state_ids` | `RefSet<EpistemicStateVersion>` | REQUIRED | FK → `EpistemicStateVersion`; normalized link table; no canonical opaque ID array |
| `new_knowledge_gap_ids` | `RefSet<KnowledgeGap>` | REQUIRED | FK → `KnowledgeGap`; normalized link table; no canonical opaque ID array |
| `new_research_trace_ids` | `RefSet<ResearchTrace>` | REQUIRED | FK → `ResearchTrace`; normalized link table; no canonical opaque ID array |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- run_correlation_key MUST resolve to exactly one Run.run_correlation_key.

## GovernanceSnapshot

```text
canonical_table: governance_snapshot
identity: `governance_snapshot_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `governance_snapshot_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `as_of` | `Timestamp` | REQUIRED | — |
| `guidance_revision_ids` | `RefSet<GuidanceRevision>` | REQUIRED | FK → `GuidanceRevision`; normalized link table; no canonical opaque ID array |
| `rule_revision_ids` | `RefSet<NormativeRuleRevision>` | REQUIRED | FK → `NormativeRuleRevision`; normalized link table; no canonical opaque ID array |
| `policy_revision_ids` | `RefSet<DecisionPolicyRevision>` | REQUIRED | FK → `DecisionPolicyRevision`; normalized link table; no canonical opaque ID array |
| `metric_revision_ids` | `RefSet<MetricDefinitionRevision>` | REQUIRED | FK → `MetricDefinitionRevision`; normalized link table; no canonical opaque ID array |
| `attribution_model_revision_ids` | `RefSet<AttributionModelRevision>` | REQUIRED | FK → `AttributionModelRevision`; normalized link table; no canonical opaque ID array |
| `rights_policy_ids` | `RefSet<RightsPolicy>` | REQUIRED | FK → `RightsPolicy`; normalized link table; no canonical opaque ID array |
| `created_at` | `Timestamp` | REQUIRED | — |

## RunConfig

```text
canonical_table: run_config
identity: `run_config_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `run_config_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `prompt_revision_refs` | `RevisionRefSet` | REQUIRED | FK via `revision_registry`; normalized typed-ref link table |
| `model_config_revision_refs` | `RevisionRefSet` | REQUIRED | FK via `revision_registry`; normalized typed-ref link table |
| `tool_config_revision_refs` | `RevisionRefSet` | REQUIRED | FK via `revision_registry`; normalized typed-ref link table |
| `schema_revision_refs` | `RevisionRefSet` | REQUIRED | FK via `revision_registry`; normalized typed-ref link table |
| `retriever_revision_refs` | `RevisionRefSet` | REQUIRED | FK via `revision_registry`; normalized typed-ref link table |
| `evaluator_revision_refs` | `RevisionRefSet` | REQUIRED | FK via `revision_registry`; normalized typed-ref link table |
| `runtime_parameters` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

## DecisionSnapshot

```text
canonical_table: decision_snapshot
identity: `snapshot_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `snapshot_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `baseline_knowledge_snapshot_id` | `Ref<BaselineKnowledgeSnapshot>` | REQUIRED | FK → `BaselineKnowledgeSnapshot` |
| `run_knowledge_delta_id` | `Ref<RunKnowledgeDelta>` | REQUIRED | FK → `RunKnowledgeDelta` |
| `governance_snapshot_id` | `Ref<GovernanceSnapshot>` | REQUIRED | FK → `GovernanceSnapshot` |
| `run_config_id` | `Ref<RunConfig>` | REQUIRED | FK → `RunConfig` |
| `task_revision_id` | `Ref<TaskContractRevision>` | REQUIRED | FK → `TaskContractRevision` |
| `audience_state_id` | `Ref<AudienceState>` | REQUIRED | FK → `AudienceState` |
| `knowledge_gap_ids` | `RefSet<KnowledgeGap>` | REQUIRED | FK → `KnowledgeGap`; normalized link table; no canonical opaque ID array |
| `research_trace_ids` | `RefSet<ResearchTrace>` | REQUIRED | FK → `ResearchTrace`; normalized link table; no canonical opaque ID array |
| `strategy_ids` | `RefSet<StrategyHypothesis>` | REQUIRED | FK → `StrategyHypothesis`; normalized link table; no canonical opaque ID array |
| `architecture_ids` | `RefSet<ContentArchitecture>` | REQUIRED | FK → `ContentArchitecture`; normalized link table; no canonical opaque ID array |
| `candidate_ids` | `RefSet<ContentCandidate>` | REQUIRED | FK → `ContentCandidate`; normalized link table; no canonical opaque ID array |
| `assertion_ids` | `RefSet<ContentAssertion>` | REQUIRED | FK → `ContentAssertion`; normalized link table; no canonical opaque ID array |
| `assertion_validation_result_ids` | `RefSet<AssertionValidationResult>` | REQUIRED | FK → `AssertionValidationResult`; normalized link table; no canonical opaque ID array |
| `composite_assessment_ids` | `RefSet<CompositeImpressionAssessment>` | REQUIRED | FK → `CompositeImpressionAssessment`; normalized link table; no canonical opaque ID array |
| `qualitative_evaluation_ids` | `RefSet<QualitativeEvaluation>` | REQUIRED | FK → `QualitativeEvaluation`; normalized link table; no canonical opaque ID array |
| `applicability_assessment_ids` | `RefSet<ApplicabilityAssessment>` | REQUIRED | FK → `ApplicabilityAssessment`; normalized link table; no canonical opaque ID array |
| `risk_assessment_ids` | `RefSet<RiskAssessment>` | REQUIRED | FK → `RiskAssessment`; normalized link table; no canonical opaque ID array |
| `uncertainty_assessment_id` | `Ref<UncertaintyAssessment>` | OPTIONAL | FK → `UncertaintyAssessment` |
| `rights_check_ids` | `RefSet<RightsCheck>` | REQUIRED | FK → `RightsCheck`; normalized link table; no canonical opaque ID array |
| `frozen_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- Every direct reference MUST resolve to exact immutable state.
- Every transitive relationship MUST pass Snapshot Closure Validation.
- Every referenced runtime input must have been created/known no later than frozen_at.
- No CURRENT/LATEST/ACTIVE lookup is permitted during historical replay.

## PolicyResult

```text
canonical_table: policy_result
identity: `policy_result_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `policy_result_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `snapshot_id` | `Ref<DecisionSnapshot>` | REQUIRED | FK → `DecisionSnapshot` |
| `policy_revision_id` | `Ref<DecisionPolicyRevision>` | REQUIRED | FK → `DecisionPolicyRevision` |
| `triggered` | `Boolean` | REQUIRED | — |
| `input_refs` | `TypedRefSet` | REQUIRED | FK via immutable/revision registry tagged union; normalized typed-ref link table |
| `action` | `Structured/Text` | REQUIRED | — |
| `reason_code` | `Structured/Text` | REQUIRED | — |
| `input_uncertainty` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- UNIQUE(snapshot_id, policy_revision_id).
- policy_revision_id MUST belong to DecisionSnapshot.GovernanceSnapshot.policy_revision_ids.
- input_refs MUST be reachable from the frozen snapshot or its transitive closure.

## PolicyOverride

```text
canonical_table: policy_override
identity: `override_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `override_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `snapshot_id` | `Ref<DecisionSnapshot>` | REQUIRED | FK → `DecisionSnapshot` |
| `policy_result_ids` | `RefSet<PolicyResult>` | REQUIRED | FK → `PolicyResult`; normalized link table; no canonical opaque ID array |
| `authorized_by` | `Structured/Text` | REQUIRED | — |
| `authority_basis` | `Structured/Text` | REQUIRED | — |
| `reason_codes` | `Structured/Text` | REQUIRED | — |
| `scope` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- Every overridden PolicyResult must share snapshot_id.
- Override validity requires exact DecisionPolicyRevision.override_allowed and authority/scope checks.

## PolicyConflictResolution

```text
canonical_table: policy_conflict_resolution
identity: `resolution_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `resolution_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `snapshot_id` | `Ref<DecisionSnapshot>` | REQUIRED | FK → `DecisionSnapshot` |
| `conflict_key` | `HashKey` | REQUIRED | — |
| `policy_result_ids` | `RefSet<PolicyResult>` | REQUIRED | FK → `PolicyResult`; normalized link table; no canonical opaque ID array |
| `resolution_type` | `Enum` | REQUIRED | — |
| `override_id` | `Ref<PolicyOverride>` | OPTIONAL | FK → `PolicyOverride` |
| `reason_codes` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- conflict_key = hash(snapshot_id + canonical_sorted(policy_result_ids)).
- Exactly one final resolution per conflict_key.
- AUTHORIZED_OVERRIDE requires non-null override_id; all other resolution types require override_id null.

## HumanReviewRecord

```text
canonical_table: human_review_record
identity: `review_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `review_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `task_revision_id` | `Ref<TaskContractRevision>` | REQUIRED | FK → `TaskContractRevision` |
| `snapshot_id` | `Ref<DecisionSnapshot>` | REQUIRED | FK → `DecisionSnapshot` |
| `policy_result_ids` | `RefSet<PolicyResult>` | REQUIRED | FK → `PolicyResult`; normalized link table; no canonical opaque ID array |
| `review_subject_refs` | `TypedRefSet` | REQUIRED | FK via immutable/revision registry tagged union; normalized typed-ref link table |
| `review_mode` | `Enum` | REQUIRED | — |
| `reviewer_role` | `Structured/Text` | REQUIRED | — |
| `qualification` | `Structured/Text` | REQUIRED | — |
| `review_scope` | `Structured/Text` | REQUIRED | — |
| `review_decision` | `Structured/Text` | REQUIRED | — |
| `reason_codes` | `Structured/Text` | REQUIRED | — |
| `introduced_information_refs` | `TypedRefSet` | REQUIRED | FK via immutable/revision registry tagged union; normalized typed-ref link table |
| `created_at` | `Timestamp` | REQUIRED | — |

## DecisionRecord

```text
canonical_table: decision_record
identity: `decision_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `decision_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `decision_type` | `Enum` | REQUIRED | — |
| `task_revision_id` | `Ref<TaskContractRevision>` | REQUIRED | FK → `TaskContractRevision` |
| `snapshot_id` | `Ref<DecisionSnapshot>` | REQUIRED | FK → `DecisionSnapshot` |
| `policy_result_ids` | `RefSet<PolicyResult>` | REQUIRED | FK → `PolicyResult`; normalized link table; no canonical opaque ID array |
| `conflict_resolution_ids` | `RefSet<PolicyConflictResolution>` | REQUIRED | FK → `PolicyConflictResolution`; normalized link table; no canonical opaque ID array |
| `reason_codes` | `Structured/Text` | REQUIRED | — |
| `selected_action` | `Structured/Text` | REQUIRED | — |
| `selected_candidate_id` | `Ref<ContentCandidate>` | OPTIONAL | FK → `ContentCandidate` |
| `release_status` | `Enum` | REQUIRED | — |
| `human_review_id` | `Ref<HumanReviewRecord>` | OPTIONAL | FK → `HumanReviewRecord` |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- Owns canonical release_status.
- Referenced PolicyResults and ConflictResolutions MUST belong to snapshot_id.
- selected_candidate_id, when present, MUST belong to DecisionSnapshot.candidate_ids.

Additional required closure invariants:

- `DecisionRecord.task_revision_id == DecisionSnapshot.task_revision_id`.
- Every referenced `PolicyResult.snapshot_id == DecisionRecord.snapshot_id`.
- Every referenced `PolicyConflictResolution.snapshot_id == DecisionRecord.snapshot_id`.
- No two referenced conflict resolutions may share the same `conflict_key`.
- If `human_review_id` is present, `HumanReviewRecord.snapshot_id == DecisionRecord.snapshot_id`.
- `DecisionRecord.policy_result_ids` MUST equal the complete terminal PolicyResult set for the snapshot.
- If the decision selects a release candidate, `selected_candidate_id` MUST be present and belong to `DecisionSnapshot.candidate_ids`.
- If `release_status ∈ {READY, READY_WITH_WARNINGS}` and `selected_action` releases generated content, `selected_candidate_id` MUST NOT be null.
- `BLOCKED` never authorizes release.
- `selected_action` is an action code only and MUST NOT embed a candidate ID or any other entity ID.
- PolicyOverride lineage is owned by referenced `PolicyConflictResolution` objects and MUST NOT be duplicated on DecisionRecord.

## FinalContentPackage

```text
canonical_table: final_content_package
identity: `package_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `package_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `task_revision_id` | `Ref<TaskContractRevision>` | REQUIRED | FK → `TaskContractRevision` |
| `decision_id` | `Ref<DecisionRecord>` | REQUIRED | FK → `DecisionRecord` |
| `decision_snapshot_id` | `Ref<DecisionSnapshot>` | REQUIRED | FK → `DecisionSnapshot` |
| `selected_candidate_id` | `Ref<ContentCandidate>` | REQUIRED | FK → `ContentCandidate` |
| `alternative_candidate_ids` | `RefSet<ContentCandidate>` | REQUIRED | FK → `ContentCandidate`; normalized link table; no canonical opaque ID array |
| `strategy_id` | `Ref<StrategyHypothesis>` | REQUIRED | FK → `StrategyHypothesis` |
| `architecture_id` | `Ref<ContentArchitecture>` | REQUIRED | FK → `ContentArchitecture` |
| `audience_state_id` | `Ref<AudienceState>` | REQUIRED | FK → `AudienceState` |
| `assertion_ids` | `RefSet<ContentAssertion>` | REQUIRED | FK → `ContentAssertion`; normalized link table; no canonical opaque ID array |
| `proposition_ids` | `RefSet<Proposition>` | REQUIRED | FK → `Proposition`; normalized link table; no canonical opaque ID array |
| `risk_assessment_ids` | `RefSet<RiskAssessment>` | REQUIRED | FK → `RiskAssessment`; normalized link table; no canonical opaque ID array |
| `rights_check_ids` | `RefSet<RightsCheck>` | REQUIRED | FK → `RightsCheck`; normalized link table; no canonical opaque ID array |
| `warnings` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- Does not own release_status.
- decision_snapshot_id and task_revision_id MUST equal DecisionRecord.
- selected_candidate_id MUST equal DecisionRecord.selected_candidate_id when the latter is non-null.
- strategy/architecture/audience/assertion/proposition/risk/rights closure MUST match the frozen decision.

# 18. Publication, Measurement & Learning

## PublicationLineage

```text
canonical_table: publication_lineage
identity: `publication_lineage_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `publication_lineage_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `channel` | `Structured/Text` | REQUIRED | — |
| `destination` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- channel and destination are owned only here, not duplicated on PublishedArtifact.

## PublishedArtifact

```text
canonical_table: published_artifact
identity: `published_artifact_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `published_artifact_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `publication_lineage_id` | `Ref<PublicationLineage>` | REQUIRED | FK → `PublicationLineage` |
| `origin` | `Enum` | REQUIRED | — |
| `execution_artifact_id` | `Ref<ExecutionArtifact>` | OPTIONAL | FK → `ExecutionArtifact` |
| `source_candidate_id` | `Ref<ContentCandidate>` | OPTIONAL | FK → `ContentCandidate` |
| `actual_content` | `Structured/Text` | REQUIRED | — |
| `published_hash` | `Hash256` | REQUIRED | — |
| `published_at` | `Timestamp` | REQUIRED | — |
| `effective_from` | `Timestamp` | REQUIRED | — |
| `supersedes_published_artifact_id` | `Ref<PublishedArtifact>` | OPTIONAL | FK → `PublishedArtifact` |
| `platform_metadata` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- Exactly one root per PublicationLineage; lineage and first root are created atomically.
- At most one direct successor per predecessor.
- Successor must stay in same lineage and have strictly later effective_from.
- Supersession graph MUST be acyclic.
- origin=CONTENTOS_EXECUTION requires execution_artifact_id; origin=MANUAL_EXTERNAL requires it null.

## ExecutionArtifact

```text
canonical_table: execution_artifact
identity: `execution_artifact_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `execution_artifact_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `candidate_id` | `Ref<ContentCandidate>` | REQUIRED | FK → `ContentCandidate` |
| `actual_content` | `Structured/Text` | REQUIRED | — |
| `content_hash` | `Hash256` | REQUIRED | — |
| `production_changes` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

## MeasurementState

```text
canonical_table: measurement_state
identity: `measurement_state_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `measurement_state_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `supersedes_measurement_state_id` | `Ref<MeasurementState>` | OPTIONAL | FK → `MeasurementState` |
| `data_maturity` | `Enum` | REQUIRED | — |
| `is_final` | `Boolean` | REQUIRED | — |
| `late_event_window` | `Duration/Window` | REQUIRED | — |
| `missingness` | `Structured/Text` | REQUIRED | — |
| `known_incidents` | `Structured/Text` | REQUIRED | — |
| `observed_at` | `Timestamp` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- Corrections/maturation append a new row.
- At most one direct successor per predecessor under SPEC01 replacement-chain semantics.
- Correction graph MUST be acyclic.

## PerformanceObservation

```text
canonical_table: performance_observation
identity: `observation_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `observation_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `publication_state` | `Enum` | REQUIRED | — |
| `covered_published_artifact_ids` | `RefSet<PublishedArtifact>` | REQUIRED | FK → `PublishedArtifact`; normalized link table; no canonical opaque ID array |
| `metric_revision_id` | `Ref<MetricDefinitionRevision>` | REQUIRED | FK → `MetricDefinitionRevision` |
| `value` | `TypedScalar` | REQUIRED | — |
| `measurement_window_start` | `Timestamp` | REQUIRED | — |
| `measurement_window_end` | `Timestamp` | REQUIRED | — |
| `population_or_denominator` | `Structured/Text` | REQUIRED | — |
| `measurement_state_id` | `Ref<MeasurementState>` | REQUIRED | FK → `MeasurementState` |
| `source_reference` | `Structured/Text` | REQUIRED | external/ingest provenance reference; SPEC07 may narrow |
| `supersedes_observation_id` | `Ref<PerformanceObservation>` | OPTIONAL | FK → `PerformanceObservation` |
| `observed_at` | `Timestamp` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- Correction preserves metric_revision_id and semantic measurement scope.
- At most one direct successor per predecessor; correction graph MUST be acyclic.
- SINGLE_ARTIFACT requires exactly one covered artifact; MIXED requires at least two; known covered artifacts must share one PublicationLineage.
- SINGLE_ARTIFACT measurement window must fit the derived publication interval.

## ChangeProposal

```text
canonical_table: change_proposal
identity: `proposal_id`
mutability: IMMUTABLE
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `proposal_id` | `EntityId` | REQUIRED | PRIMARY KEY; registered in `ImmutableEntityRegistry` |
| `proposal_type` | `Enum` | REQUIRED | — |
| `target_revision_ref` | `RevisionRef` | OPTIONAL | FK via `revision_registry` |
| `proposed_change` | `Structured/Text` | REQUIRED | — |
| `supporting_refs` | `TypedRefSet` | REQUIRED | FK via immutable/revision registry tagged union; normalized typed-ref link table |
| `uncertainty` | `Structured/Text` | REQUIRED | — |
| `created_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- Runtime may insert proposals but cannot activate a new revision; activation remains Control Plane only.

## ReplayabilityStatus

```text
canonical_table: replayability_status
identity: `decision_id`
mutability: MUTABLE PROJECTION
```

| Field | Logical type | Nullability | Relational contract |
|---|---|---|---|
| `decision_id` | `Ref<DecisionRecord>` | REQUIRED | PRIMARY KEY; FK → `DecisionRecord` |
| `status` | `Enum` | REQUIRED | — |
| `missing_entity_refs` | `TypedRefSet` | REQUIRED | normalized typed-ref link table |
| `reason_codes` | `Structured/Text` | REQUIRED | — |
| `updated_at` | `Timestamp` | REQUIRED | — |

Required invariants:

- Mutable operational projection only; it never rewrites historical DecisionRecord or DecisionSnapshot.

# 19. Operational Persistence Contracts

## ControlPlaneActivation

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

Required:

```text
PK(activation_id)

FK(component_type, stable_id, active_revision_id)
→ RevisionRegistry(entity_type, stable_id, revision_id)

effective_until IS NULL
OR effective_until > effective_from
```

For one:

```text
deployment_scope
component_type
stable_id
```

active intervals MUST NOT overlap under single-active semantics.

Resolution at one instant returns zero or one revision only.

Implement using a temporal exclusion constraint where available, otherwise serializable activation writes plus an overlap predicate check.

---

## Run

```text
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

Required:

```text
PK(run_id)
UNIQUE(run_correlation_key)
FK(task_revision_id) → TaskContractRevision
FK(initial_run_config_id) → RunConfig
FK(initial_baseline_snapshot_id) → BaselineKnowledgeSnapshot
DEFERRED FK(current_decision_cycle_id) → DecisionCycle
version >= 0
```

When `current_decision_cycle_id` is non-null:

```text
DecisionCycle.run_id = Run.run_id
```

`current_decision_cycle_id` means:

```text
the Run's currently active decision-cycle pointer
```

It does NOT mean the cycle is necessarily writable.

The pointed cycle may validly be:

```text
OPEN
FREEZING
FROZEN
CANCELLED
FAILED
```

depending on lifecycle position.

Writable-cycle eligibility is a separate predicate:

```text
DecisionCycle.status = OPEN
AND
Run.current_decision_cycle_id = DecisionCycle.decision_cycle_id
```

The Run/current-cycle relation is updated atomically with cycle creation, freeze/cancel transitions and successor-cycle activation.

Run is mutable operational lifecycle state.

Updates use optimistic concurrency:

```text
WHERE run_id = ?
AND version = expected_version
```

then atomically increment `version`.

---

## DecisionCycle

```text
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

Required:

```text
PK(decision_cycle_id)
FK(run_id) → Run
FK(parent_cycle_id) → DecisionCycle
FK(superseded_by_cycle_id) → DecisionCycle
UNIQUE(run_id, cycle_number)
UNIQUE(parent_cycle_id) WHERE parent_cycle_id IS NOT NULL
UNIQUE(superseded_by_cycle_id) WHERE superseded_by_cycle_id IS NOT NULL
CHECK(parent_cycle_id IS NULL OR parent_cycle_id <> decision_cycle_id)
CHECK(superseded_by_cycle_id IS NULL OR superseded_by_cycle_id <> decision_cycle_id)
fencing_epoch >= 0
```

Cross-row validator requirements:

```text
parent.run_id = child.run_id

successor.run_id = predecessor.run_id

if predecessor.superseded_by_cycle_id = successor.decision_cycle_id:
    successor.parent_cycle_id = predecessor.decision_cycle_id
```

A cycle cannot point across Runs.

`superseded_by_cycle_id` is a successor pointer; a previously frozen cycle remains `FROZEN`.

A database constraint/transaction MUST guarantee at most one writable cycle per Run.

`current_decision_cycle_id` may continue to point at a non-OPEN cycle during FREEZING/FROZEN terminalization until a successor cycle is atomically installed.

Writable means:

```text
status = OPEN
AND
Run.current_decision_cycle_id = decision_cycle_id
```

Transitions invalidating old workers increment `fencing_epoch` atomically.

---

## DecisionCycleBinding

Persistence-only association:

```text
decision_cycle_id
decision_snapshot_id
```

Required:

```text
PK(decision_cycle_id)
FK(decision_cycle_id) → DecisionCycle
FK(decision_snapshot_id) → DecisionSnapshot
UNIQUE(decision_snapshot_id)
```

This table does not create new domain semantics.

It records only which immutable DecisionSnapshot one operational cycle froze.

For a FROZEN cycle:

```text
exactly one DecisionCycleBinding row exists
```

RunKnowledgeDelta and GovernanceSnapshot are NOT duplicated here.

They are derived only through:

```text
DecisionCycleBinding.decision_snapshot_id
→ DecisionSnapshot.run_knowledge_delta_id
→ DecisionSnapshot.governance_snapshot_id
```

Therefore DecisionSnapshot remains the single canonical owner of those frozen decision inputs.

`decision_snapshot_id` cannot be rebound to another cycle.

---

## StageExecution

```text
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
started_at?
completed_at?
error_code?
```

Required:

```text
PK(stage_execution_id)
UNIQUE(idempotency_key)
FK(run_id) → Run
FK(decision_cycle_id) → DecisionCycle
fencing_token >= 0
attempt_count >= 0
```

`run_id` MUST equal the Run that owns `decision_cycle_id`.

Lease renewal/takeover compares:

```text
lease_owner
+
fencing_token
```

atomically.

Business commit additionally checks current `DecisionCycle.fencing_epoch`.

Stage outputs are stored in:

```text
StageExecutionOutputRef(
  stage_execution_id,
  ordinal,
  ref_kind,
  entity_type,
  entity_id?,
  stable_id?,
  revision_id?
)
```

using the same typed-ref rules as §8.

---

## OutboxEvent

```text
event_id
aggregate_type
aggregate_id
event_type
payload
created_at
published_at?
```

Required:

```text
PK(event_id)
```

The canonical state mutation and OutboxEvent insert occur in one relational transaction.

`published_at` is operational delivery metadata and may be updated.

---

## ConsumerReceipt

```text
consumer_name
event_id
processed_at
```

Required:

```text
PRIMARY KEY(consumer_name, event_id)
FK(event_id) → OutboxEvent
```

Internal transactional side effects and receipt insertion occur in the same transaction.

External non-transactional effects require provider idempotency or a durable outbound-command pattern.

---

## APIIdempotencyRecord

```text
command_scope
idempotency_key
request_hash
response_ref?
status
created_at
completed_at?
```

Required:

```text
PRIMARY KEY(command_scope, idempotency_key)
```

Same key + different request_hash:

```text
IDEMPOTENCY_CONFLICT
```

Mandatory command scopes:

```text
StartRun
SubmitReview
CreatePublishedArtifact
IngestMeasurement
```

---

## CanonicalObjectReferenceSource

Persistence metadata used by GC integrity checks:

```text
source_name
source_table
object_id_column
owner_scope_columns
active
created_at
```

Required:

```text
PRIMARY KEY(source_name)
UNIQUE(source_table, object_id_column)
```

This registry is schema infrastructure, not domain truth.

Every canonical FK path to `ObjectRegistry.object_id` MUST have one active entry here.

At minimum V1 registers:

```text
ObjectReference.object_id
RegisteredControlPlaneRevisionPayload.object_id
SourceArtifact.snapshot_reference
```

where `SourceArtifact.snapshot_reference` is implemented either as its dedicated ObjectRegistry FK or by the normalized `ObjectReference` path, but not counted twice.

GC reachability is computed from this registered set.

---

## ObjectRegistry

```text
object_id
content_hash
object_key
size_bytes
media_type
state
gc_claim_token?
gc_claimed_at?
created_at
deleted_at?
```

State:

```text
AVAILABLE
GC_CLAIMED
DELETED
```

Ownership model:

```text
ObjectRegistry is tenant-scoped in MULTI_TENANT mode.
```

It carries:

```text
tenant_id
workspace_id?
```

through the canonical row envelope.

Content-address deduplication MUST NOT cross tenant boundaries by default.

Required:

```text
PK(object_id)

UNIQUE(tenant_id, content_hash)
in MULTI_TENANT mode

UNIQUE(content_hash)
only in SINGLE_TENANT mode

UNIQUE(tenant_id, object_key)
in MULTI_TENANT mode
```

Any future cross-tenant physical deduplication must remain cryptographically and authorization isolated and may not expose existence, hashes, or object identity across tenants.

Object write protocol:

```text
write immutable object
→ verify existence/hash
→ lock ObjectRegistry row
→ ensure state = AVAILABLE
→ commit canonical relational reference
```

GC protocol:

```text
lock ObjectRegistry row
↓
enumerate every registered canonical ObjectRegistry reference source
↓
verify canonical_object_reference_count(object_id) = 0
↓
AVAILABLE → GC_CLAIMED
↓
re-verify no canonical reference was committed across the serialized boundary
↓
delete object
↓
GC_CLAIMED → DELETED
```

The canonical reference-source registry MUST include:

```text
ObjectReference
RegisteredControlPlaneRevisionPayload
all dedicated ObjectRegistry FK fields
```

Any new schema migration that introduces another ObjectRegistry FK MUST register that reference source before the migration may be considered complete.

Canonical reference creation MUST reject or wait on `GC_CLAIMED`.

Canonical object references are relationally represented by either a dedicated typed FK column or:

```text
ObjectReference

owner_entity_type
owner_entity_id
field_name
object_id
created_at
```

Required:

```text
PK(owner_entity_type, owner_entity_id, field_name)

FK(owner_entity_type, owner_entity_id)
→ ImmutableEntityRegistry(entity_type, entity_id)

FK(object_id)
→ ObjectRegistry(object_id)
```

`ObjectReference` insertion and ObjectRegistry availability validation occur in one relational transaction while holding the ObjectRegistry row lock.

In MULTI_TENANT mode:

```text
ObjectReference.owner tenant
=
ObjectRegistry.tenant_id
```

unless an explicit shared/public storage contract introduced by a later SPEC authorizes otherwise.

GC may claim/delete an object only when no canonical object reference exists through ANY supported reference path.

Canonical object reachability includes at minimum:

```text
ObjectReference.object_id

RegisteredControlPlaneRevisionPayload.object_id

every dedicated canonical FK column
whose target is ObjectRegistry.object_id
```

Therefore GC MUST evaluate:

```text
canonical_object_reference_count(object_id)
```

across the complete registered set of ObjectRegistry reference sources.

Safe GC admission requires:

```text
canonical_object_reference_count(object_id) = 0
```

while holding the ObjectRegistry row lock / GC claim serialization boundary.

Checking only `ObjectReference` is invalid.

For `SourceArtifact.snapshot_reference`, the canonical physical representation MUST use this FK contract (directly or through `ObjectReference`), never free-form text.

Generic Control Plane revision payloads do NOT use `ObjectReference.owner_entity_id`, because revisions are not ImmutableEntityRegistry entities.

They use the dedicated:

```text
RegisteredControlPlaneRevisionPayload
```

binding whose owner FK is `RevisionRegistry(entity_type, stable_id, revision_id)`.

---

## AuditEvent

```text
audit_event_id
event_type
principal_ref
resource_ref?
run_id?
snapshot_id?
decision_id?
reason_codes
created_at
```

AuditEvent is append-only.

It does not replace canonical domain state.

# 20. Canonical Reference-Set Tables

Every Blueprint field containing canonical entity/revision ID collections is normalized.

Representative mandatory mappings:

```text
ContentProgramRevision.success_metric_revision_ids
→ content_program_success_metric

ContentProgramRevision.guardrail_metric_revision_ids
→ content_program_guardrail_metric

OutcomeModel.*_metric_revision_ids
→ outcome_model_metric

OutcomeModel.outcome_edge_ids
→ outcome_model_edge

ChannelProfileRevision.rule_revision_refs
→ channel_profile_rule_revision

ChannelProfileRevision.guidance_revision_refs
→ channel_profile_guidance_revision

ChannelProfileRevision.metric_revision_refs
→ channel_profile_metric_revision

TaskContractRevision.secondary_metric_revision_ids
→ task_secondary_metric

TaskContractRevision.guardrail_metric_revision_ids
→ task_guardrail_metric

ResearchTrace.result_evidence_ids
→ research_trace_evidence

EpistemicStateVersion.assessment_ids
→ epistemic_state_assessment

StrategyHypothesis.required_proposition_ids
→ strategy_required_proposition

ContentArchitecture.unit_ids
→ content_architecture_unit

ContentUnit.proposition_ids
→ content_unit_proposition

AssertionValidationResult.proposition_link_ids
→ assertion_validation_link

DecisionSnapshot.assertion_validation_result_ids
→ decision_snapshot_assertion_validation_result

DecisionSnapshot.composite_assessment_ids
→ decision_snapshot_composite_assessment

DecisionSnapshot.qualitative_evaluation_ids
→ decision_snapshot_qualitative_evaluation

DecisionSnapshot.applicability_assessment_ids
→ decision_snapshot_applicability_assessment

CompositeImpressionAssessment.input_assertion_ids
→ composite_input_assertion

CompositeImpressionAssessment.implied_assertion_ids
→ composite_implied_assertion

KnowledgeManifest.*
→ knowledge_manifest_* link tables

RunKnowledgeDelta.*
→ run_delta_* link tables

GovernanceSnapshot.*
→ governance_snapshot_* link tables

RunConfig.*_revision_refs
→ run_config_*_revision link tables

DecisionSnapshot.*
→ decision_snapshot_* link tables

PolicyResult.input_refs
→ policy_result_input_ref

PolicyOverride.policy_result_ids
→ policy_override_result

PolicyConflictResolution.policy_result_ids
→ policy_conflict_result

HumanReviewRecord.policy_result_ids
→ human_review_policy_result

HumanReviewRecord.review_subject_refs
→ human_review_subject_ref

HumanReviewRecord.introduced_information_refs
→ human_review_introduced_ref

DecisionRecord.policy_result_ids
→ decision_policy_result

DecisionRecord.conflict_resolution_ids
→ decision_conflict_resolution

FinalContentPackage.alternative_candidate_ids
→ package_alternative_candidate

FinalContentPackage.assertion_ids
→ package_assertion

FinalContentPackage.proposition_ids
→ package_proposition

FinalContentPackage.risk_assessment_ids
→ package_risk

FinalContentPackage.rights_check_ids
→ package_rights

PerformanceObservation.covered_published_artifact_ids
→ performance_observation_artifact

ChangeProposal.supporting_refs
→ change_proposal_supporting_ref
```

All association rows are immutable when their owner is immutable.


# 21. Revision Integrity Constraints

Typed revision insertion transaction:

```text
BEGIN

insert RevisionRegistry exact identity

insert typed revision row

insert normalized reference-set rows

validate predecessor identity if present

COMMIT
```

Generic config revision insertion transaction:

```text
write immutable payload object
↓
verify object existence + payload_hash

BEGIN

insert RevisionRegistry exact identity

insert RegisteredControlPlaneRevision metadata

insert RegisteredControlPlaneRevisionPayload
bound to exact revision identity + ObjectRegistry object

validate same tenant / workspace ownership
across RevisionRegistry, payload binding, and ObjectRegistry

validate SchemaDefinition RevisionRef

COMMIT
```

The revision metadata and payload binding become canonical atomically.

A RegisteredControlPlaneRevision without its exact payload binding is invalid for activation, RunConfig pinning, or historical replay.

For every supersedes revision:

```text
successor.entity_type = predecessor.entity_type
successor.stable_id = predecessor.stable_id
successor.revision_id != predecessor.revision_id
```

A revision may never supersede itself.


# 22. Epistemic Chain Constraints

For `EpistemicStateVersion`:

```text
UNIQUE(proposition_id)
WHERE supersedes_epistemic_state_id IS NULL

UNIQUE(supersedes_epistemic_state_id)
WHERE supersedes_epistemic_state_id IS NOT NULL
```

Insertion validator additionally enforces:

```text
same proposition_id
successor.known_from > predecessor.known_from
no cycle
```

`known_until` is derived from the successor's `known_from`; it is not written into the old row.


# 23. Snapshot Persistence & Closure Support

DecisionSnapshot insert occurs only through the freeze transaction.

Before insert, the closure validator resolves all normalized reference rows and verifies:

```text
Task / Program closure
Task metric closure
Task / ChannelProfile closure
KnowledgeGap / Research closure
run-created Epistemic derivation closure
Audience closure
Strategy closure
Architecture closure
Candidate closure
Candidate / RunConfig closure
Assertion closure
Validation closure
Evaluation / RunConfig closure
Applicability closure
Applicability temporal closure
Rights closure
Knowledge-gap freeze closure
Snapshot temporal closure
```

Database-level minimum constraints:

```text
PK(snapshot_id)
FK all scalar typed refs
UNIQUE normalized ref membership
all stage-local knowledge_cutoff_time <= frozen_at
all referenced runtime entity created_at/known_from <= frozen_at where applicable
```

Set-equality and transitive graph checks are deterministic transaction validators, not ad-hoc application guesses.

A DecisionSnapshot row is inserted only after the validator returns PASS.


# 24. Policy & Decision Constraints

PolicyResult:

```text
UNIQUE(snapshot_id, policy_revision_id)
```

The expected policy set is:

```text
DecisionSnapshot.GovernanceSnapshot.policy_revision_ids
```

A decision cannot become final until exact set equality holds between expected policies and terminal PolicyResults.

PolicyConflictResolution:

```text
conflict_key =
hash(
  snapshot_id
  +
  canonical_sorted(policy_result_ids)
)
```

Required:

```text
UNIQUE(conflict_key)
```

All conflict PolicyResults share one snapshot.

`AUTHORIZED_OVERRIDE`:

```text
override_id IS NOT NULL
```

Other resolution types:

```text
override_id IS NULL
```

DecisionRecord closure validator checks:

```text
task_revision_id == snapshot.task_revision_id

complete PolicyResult set

all PolicyResults bound to snapshot_id

all PolicyConflictResolutions bound to snapshot_id

no duplicate conflict_key in referenced resolutions

HumanReviewRecord, when present, bound to snapshot_id

selected candidate belongs to snapshot

READY / READY_WITH_WARNINGS release action
requires selected_candidate_id

selected_action contains only an action code,
never an embedded entity identifier
```

DecisionRecord is immutable and is the only canonical owner of `release_status`.


# 25. FinalContentPackage Constraints

Package creation requires an existing DecisionRecord.

Validator requires:

```text
package.decision_snapshot_id
=
decision.snapshot_id

package.task_revision_id
=
decision.task_revision_id

package.selected_candidate_id
=
decision.selected_candidate_id
when decision.selected_candidate_id is non-null
```

Candidate must belong to the frozen snapshot.

Package strategy and architecture must equal the selected Candidate.

Package audience must equal the selected Strategy audience and the final frozen AudienceState.

Package Assertions, Propositions, RiskAssessments and RightsChecks must satisfy Blueprint closure.

`release_status` MUST NOT exist on FinalContentPackage.


# 26. Publication Lineage Constraints

Canonical insertion of a new lineage:

```text
BEGIN

insert PublicationLineage
insert exactly one root PublishedArtifact
COMMIT
```

Root constraint:

```text
UNIQUE(publication_lineage_id)
WHERE supersedes_published_artifact_id IS NULL
```

Direct-successor constraint:

```text
UNIQUE(
  publication_lineage_id,
  supersedes_published_artifact_id
)
WHERE supersedes_published_artifact_id IS NOT NULL
```

Successor transaction locks predecessor or lineage and verifies:

```text
same publication_lineage_id
predecessor has no successor
successor.effective_from > predecessor.effective_from
no cycle
```

PublishedArtifact never stores canonical `channel` or `destination`.

Those resolve through PublicationLineage only.


# 27. Measurement & Correction Constraints

MeasurementState is append-only.

Under SPEC01 replacement-chain semantics:

```text
UNIQUE(supersedes_measurement_state_id)
WHERE supersedes_measurement_state_id IS NOT NULL
```

and correction lineage is acyclic.

PerformanceObservation correction:

```text
UNIQUE(supersedes_observation_id)
WHERE supersedes_observation_id IS NOT NULL
```

A correction requires:

```text
same metric_revision_id
same semantic measurement window
same population/denominator semantics
same publication coverage semantics
```

Otherwise insert a new independent observation.

Publication-state cardinality:

```text
SINGLE_ARTIFACT
→ exactly 1 known covered artifact

MIXED_PUBLICATION_STATE
→ at least 2 known covered artifacts

UNRESOLVED_PUBLICATION_STATE
→ zero or partially known artifacts allowed
```

Known covered artifacts for SINGLE/MIXED must belong to one PublicationLineage.

For SINGLE_ARTIFACT:

```text
measurement_window
⊆
derived PublishedArtifact effective interval
```


# 28. Performance Evidence Origin Constraint

When EvidenceItem uses:

```text
origin_type = PERFORMANCE_OBSERVATION
```

then:

```text
origin_id
→ PerformanceObservation.observation_id
```

When:

```text
origin_type = SOURCE_ARTIFACT
```

then:

```text
origin_id
→ SourceArtifact.source_id
```

The FK is implemented through a type-discriminated validator or registry-based polymorphic reference.

Later Evidence/Proposition logic must still enforce the performance-evidence firewall.


# 29. Activation Interval Model

ControlPlaneActivation is operational and mutable only through Control Plane commands.

For one key:

```text
(deployment_scope, component_type, stable_id)
```

intervals are half-open:

```text
[effective_from, effective_until)
```

with null `effective_until` representing open-ended activation.

No overlap is allowed where single-active semantics apply.

As-of resolution:

```text
effective_from <= t
AND
(effective_until IS NULL OR t < effective_until)
```

must return at most one row.

Run initialization executes this resolution inside one consistent database read snapshot.


# 30. Object-Backed Payload Integrity

Fields that may point to object storage include at minimum:

```text
SourceArtifact.snapshot_reference
large content_payload values
large actual_content values
raw provider exports
large execution/measurement payloads
```

Canonical object-backed row stores an ObjectRegistry reference and expected content hash.

Commit ordering:

```text
object write
↓
existence verification
↓
hash verification
↓
ObjectRegistry AVAILABLE lock
↓
relational transaction
↓
canonical entity + outbox
↓
commit
```

Object GC and canonical reference creation serialize on ObjectRegistry.

No canonical row may reference an object in `GC_CLAIMED` or `DELETED`.


# 31. Deletion, Redaction & Replay

Normal FKs never target retention-sensitive payload rows.

They target durable typed identity / structural rows and the corresponding registry identity.

Canonical physical pattern:

```text
TypedIdentityRow
+
TypedPayloadSidecar?
+
ObjectRegistry object(s)?
```

The logical Blueprint entity remains one immutable entity; this split is only persistence representation.

`TypedIdentityRow` contains the minimum durable identity and structural reference material required to preserve graph integrity.

Retention-sensitive content is stored in:

```text
TypedPayloadSidecar
or
ObjectRegistry-backed payload
```

and may be removed by a privileged SPEC08 workflow.

When prohibited payload must be removed:

```text
BEGIN

lock identity + registry rows

delete/redact detachable payload only

set registry.payload_state =
REDACTED or DELETED

update ReplayabilityStatus

write audit/outbox event

COMMIT
```

Required invariants when retention law/policy permits a minimal identity tombstone:

```text
typed identity row may remain
typed FK graph remains valid
surviving semantic values are not rewritten
payload absence is explicit
normal replay closure does not treat tombstone as AVAILABLE
```

However, replayability MUST NOT override data-rights deletion.

If the identity / structural row itself contains prohibited data or is legally required to be erased:

```text
the typed identity row MAY NOT be retained merely to preserve FK or replay
```

In that case the privileged deletion workflow MUST:

```text
remove the prohibited typed identity / payload data

DO NOT rewrite or replace surviving historical reference values

record an out-of-band non-sensitive deletion tombstone
or resolution-failure record keyed by the deleted target identity,
only when legally permitted

mark replayability degraded

preserve only the minimum lineage/audit metadata legally permitted
```

Historical rows keep their original reference values exactly as written for as long as those rows are legally retained.

If deletion of a target would violate a live relational FK, privileged SPEC08 deletion MUST compute an explicit deletion closure before commit.

Canonical required-deletion closure:

```text
identify prohibited target
↓
discover all retained rows whose real FK / typed reference depends on that target
↓
classify each dependent row:
  LEGALLY RETAINABLE WITHOUT PROHIBITED DATA
  MUST ALSO BE DELETED
↓
for MUST ALSO BE DELETED:
  recurse through the dependency graph
↓
validate no surviving real FK would point to a deleted row
↓
delete the complete required closure atomically where practical
↓
write non-sensitive out-of-band deletion metadata only when lawful
↓
mark affected replayability degraded
```

Rules:

```text
NEVER rewrite a historical reference ID to a substitute ID.

NEVER null out or mutate an immutable historical reference merely to satisfy FK constraints.

If a dependent immutable row cannot legally survive without the deleted target,
that dependent row joins the deletion closure.

If an entire historical branch must be removed,
replayability degrades accordingly.
```

After required deletion, only legally retained rows remain in the canonical relational graph, so no surviving real FK is dangling.

Any historical state removed by the deletion closure is represented only through out-of-band non-sensitive deletion metadata when lawful.

Such metadata is infrastructure state, not the original immutable entity and MUST NOT be treated as successful entity resolution.

A `payload_state != AVAILABLE` target is resolvable only to the extent permitted by retained non-sensitive metadata; it is never equivalent to complete historical payload.

The system must not synthesize missing data.

Historical replay encountering unavailable payload returns one of:

```text
PARTIAL_REDACTED
UNAVAILABLE_DUE_TO_RETENTION
INVALIDATED_BY_DELETION
```

as appropriate.

A retained tombstone may allow identity/lineage detection only when lawful and non-sensitive; it does not count as full payload resolution.

`ON DELETE CASCADE` from historical identity tables is prohibited for ordinary application deletion.

Canonical out-of-band deletion metadata:

```text
DeletedTargetTombstone

entity_type
entity_id

tenant_id
workspace_id?

deletion_reason_code
deleted_at
payload_retained = false
```

or for revisioned targets:

```text
DeletedRevisionTombstone

entity_type
stable_id
revision_id

tenant_id
workspace_id?

deletion_reason_code
deleted_at
payload_retained = false
```

These tombstones:

```text
MUST NOT contain prohibited semantic payload
MUST NOT satisfy ImmutableEntityRef / RevisionRef resolution
MUST NOT serve as substitute FK targets
MUST NOT be written into historical reference fields
MAY support audit, lineage detection, and degraded replay reporting
```

They are out-of-band records consulted only after canonical resolution fails because the referenced canonical state was lawfully removed.

Privileged SPEC08 deletion may intentionally remove referenced targets when required by data rights.

Before commit it MUST compute and apply the required deletion closure so every surviving enforced FK still resolves.

It MUST NOT rewrite historical source rows, null immutable references, or substitute new reference values merely to keep those rows.

Required deletion MUST NOT leave surviving canonical relational rows with broken enforced FKs.

Instead:

```text
dependent rows that cannot legally survive
join the explicit deletion closure
```

while legally retained rows keep their original values unchanged.

Replayability is degraded explicitly and no prohibited data is retained merely to satisfy referential integrity.

# 32. Tenant Integrity

In MULTI_TENANT mode every canonical and operational row carries ownership envelope fields.

For a normal tenant-private FK:

```text
source.tenant_id
==
target.tenant_id
```

Workspace/public sharing exceptions require explicit DataScope and authorization semantics.

Database row-level security may be used, but application authorization remains required.

IDs are not authorization capabilities.


# 33. Index Baseline

Required indexes include:

```text
RevisionRegistry(entity_type, stable_id, revision_id)
RevisionRegistry(entity_type, stable_id, created_at)

ImmutableEntityRegistry(entity_type, entity_id)

ControlPlaneActivation(
  deployment_scope,
  component_type,
  stable_id,
  effective_from,
  effective_until
)

Run(run_correlation_key)
Run(status, started_at)

DecisionCycle(run_id, cycle_number)
DecisionCycle(run_id, status)

StageExecution(idempotency_key)
StageExecution(decision_cycle_id, status)
StageExecution(lease_expires_at, status)

EpistemicStateVersion(proposition_id, known_from)
EpistemicStateVersion(supersedes_epistemic_state_id)

PolicyResult(snapshot_id, policy_revision_id)
PolicyConflictResolution(conflict_key)

PublishedArtifact(publication_lineage_id, effective_from)
PublishedArtifact(publication_lineage_id, supersedes_published_artifact_id)

MeasurementState(supersedes_measurement_state_id)

PerformanceObservation(metric_revision_id, measurement_window_start, measurement_window_end)
PerformanceObservation(supersedes_observation_id)

OutboxEvent(published_at, created_at)
ConsumerReceipt(consumer_name, event_id)

ObjectRegistry(tenant_id, content_hash)
ObjectRegistry(tenant_id, state, created_at)
RegisteredControlPlaneRevisionPayload(entity_type, stable_id, revision_id)
RegisteredControlPlaneRevisionPayload(object_id)
CanonicalObjectReferenceSource(source_table, object_id_column)
```

Every normalized owner/target relation receives indexes on both owner and target keys.

Exact physical indexes may be adjusted from production query evidence, but required uniqueness semantics may not be weakened.


# 34. Database Transaction Boundaries

Use one relational transaction for:

```text
revision registry + typed revision insert
immutable registry + immutable entity insert
normalized link rows for one immutable owner
Run initialization bundle
new DecisionCycle transition
StageExecution claim/takeover
snapshot freeze
PolicyResult insert
PolicyConflictResolution insert
DecisionRecord insert
publication successor insert
measurement correction insert
outbox insert with canonical mutation
consumer effect + ConsumerReceipt
```

Do not hold a database transaction across:

```text
LLM calls
retrieval
external APIs
human review
long evaluation
```


# 35. Migration Rules

Schema migrations have two classes.

## Physical migration

May change:

```text
index shape
partitioning
storage representation
column encoding
JSON physical layout
```

without semantic change.

## Semantic migration

Any change to:

```text
entity meaning
reference semantics
identity
immutability
temporal interpretation
enum meaning
closure invariant
```

requires an explicit new specification/revision path.

A migration MUST NOT rewrite immutable historical meaning in place.

Any migration introducing a new canonical FK to `ObjectRegistry.object_id` MUST atomically or deployment-safely:

```text
create the FK/reference path
+
register it in CanonicalObjectReferenceSource
+
make GC aware of it
```

before GC may operate against objects referenced through that path.

Backfills must be deterministic, auditable and separately versioned.


# 36. Database-Level vs Validator-Level Enforcement

## MUST be database-enforced where practical

```text
primary keys
foreign keys
NOT NULL
simple CHECK constraints
reference-set uniqueness
policy result uniqueness
conflict_key uniqueness
idempotency uniqueness
publication single-successor uniqueness
epistemic single-successor uniqueness
performance single-successor uniqueness
measurement-state single-successor uniqueness
tenant ownership columns
hash/key uniqueness
DecisionCycle scalar self-reference FKs
ObjectReference → ObjectRegistry FK
RegisteredControlPlaneRevisionPayload → RevisionRegistry FK
RegisteredControlPlaneRevisionPayload → ObjectRegistry FK
RegisteredControlPlaneRevisionPayload tenant ownership columns
CanonicalObjectReferenceSource uniqueness
```


## MUST be deterministic transactional validators

```text
acyclic lineage checks
same-lineage successor checks
strict temporal successor ordering
snapshot transitive closure
policy set completeness
override authorization integrity
FinalContentPackage closure
measurement-window/publication-interval containment
governance temporal eligibility
cross-tenant shared/public authorization exceptions
DecisionCycle same-run / reciprocal successor-parent consistency
current-cycle pointer lifecycle semantics
retention deletion / detached tombstone legality
out-of-band deletion tombstone / unresolved-reference semantics
DecisionRecord full snapshot closure
ObjectReference/ObjectRegistry same-tenant ownership
RegisteredControlPlaneRevision payload hash/schema/revision consistency
RegisteredControlPlaneRevisionPayload / RevisionRegistry / ObjectRegistry same-tenant ownership
complete ObjectRegistry reference-source registration before GC eligibility
```


Application code alone is insufficient when a database constraint can enforce the invariant.


# 37. Fixed SPEC02 Adversarial Test Suite

Run the same suite after every SPEC02 patch.

```text
01 RevisionRef wrong stable_id with valid revision_id
02 RevisionRef wrong entity_type
03 ImmutableEntityRef wrong entity_type
04 runtime CURRENT/LATEST substitution
05 revision supersedes different stable ID
06 revision self-supersession
07 cross-tenant private FK
08 opaque brand_id treated as ContentOS FK
09 generic ref with both entity and revision branches populated
10 canonical ID collection hidden only in JSON

11 second EpistemicState root
12 EpistemicState branch
13 EpistemicState cycle
14 EpistemicState known_from non-increasing
15 blocking KnowledgeGap silently removed
16 EvidenceItem origin discriminator mismatch
17 performance EvidenceItem points to SourceArtifact
18 Applicability subject_type/subject_revision mismatch
19 Applicability cutoff after DecisionSnapshot.frozen_at
20 RightsCheck cutoff after DecisionSnapshot.frozen_at

21 Candidate run_config mismatch
22 evaluator revision absent from RunConfig
23 snapshot dangling direct ref
24 snapshot transitive mismatch
25 snapshot input created after frozen_at
26 partial PolicyResult set treated complete
27 duplicate PolicyResult for snapshot/policy
28 duplicate final resolution for conflict_key
29 AUTHORIZED_OVERRIDE without PolicyOverride
30 PolicyOverride crosses snapshots

31 DecisionRecord selected candidate outside snapshot
32 FinalContentPackage candidate differs from DecisionRecord
33 FinalContentPackage strategy mismatch
34 FinalContentPackage injects post-decision RightsCheck
35 second publication root
36 publication branch
37 publication cross-lineage successor
38 publication cycle
39 publication effective_from non-increasing
40 CONTENTOS_EXECUTION without ExecutionArtifact

41 MeasurementState branch
42 PerformanceObservation correction branch
43 PerformanceObservation correction changes metric revision
44 correction changes semantic measurement scope
45 SINGLE_ARTIFACT with zero or multiple covered artifacts
46 MIXED publication observation across lineages
47 SINGLE_ARTIFACT window crosses publication interval
48 object GC race with canonical reference creation
49 duplicate StageExecution idempotency key
50 stale StageExecution fencing token

51 two writable DecisionCycles for one Run
52 cancellation without cycle epoch bump
53 duplicate API idempotency key with different request hash
54 duplicate consumer event delivery
55 activation interval overlap
56 ambiguous as-of activation
57 normal UPDATE on immutable entity
58 destructive CASCADE deletes historical graph
59 deleted payload reported as FULL replay
60 runtime ChangeProposal directly activates revision

61 primary immutable/revision identity accidentally modeled as self-FK
62 canonical ID-set stored as opaque StructuredCollection
63 DecisionCycle parent/successor/current pointer crosses Run or dangles
64 retention deletion breaks typed FK graph or mutates surviving semantic history
65 SourceArtifact snapshot_reference bypasses ObjectRegistry / GC serialization
66 Run.current_decision_cycle_id rejects valid FREEZING/FROZEN active cycle
67 required deletion retains prohibited identity data only to preserve FK/replay
68 cross-tenant ObjectRegistry content_hash/object reference collision or existence leak
69 required deletion rewrites immutable historical reference to tombstone ID
70 DecisionRecord violates snapshot/task/review/selected-action closure
71 generic Control Plane revision has metadata but no exact replayable payload binding
72 required deletion removes target but leaves a surviving enforced FK dangling
73 generic Control Plane payload binds tenant A revision to tenant B ObjectRegistry object
74 GC sees zero ObjectReference rows but object is still referenced by RegisteredControlPlaneRevisionPayload or another dedicated ObjectRegistry FK
75 DecisionCycleBinding duplicates RunKnowledgeDelta / GovernanceSnapshot truth or disagrees with DecisionSnapshot
76 RevisionRegistry duplicates supersession truth or disagrees with the authoritative revision row
```

Expected:

```text
76 / 76
PRESERVE INVARIANTS
```

`76` is the locked final SPEC02 regression suite for v1.0.6.

No additional freeze blocker may be introduced without a concrete contradiction against Blueprint v2.13.1 or SPEC01 v1.1.3.


This is specification-level acceptance, not a claim about implementation code.


# 38. SPEC02 Acceptance Criteria

SPEC02 may be frozen only when:

```text
1.
Every Blueprint schema field is represented.

2.
Every revision type has stable and historical identity.

3.
Every RevisionRef can be relationally validated.

4.
Every ImmutableEntityRef can be relationally validated.

5.
Canonical reference sets are normalized.

6.
Opaque external IDs are explicitly separated from ContentOS references.

7.
Immutable history cannot be normally updated.

8.
Revision supersession cannot cross stable identity.

9.
Epistemic chain invariants are enforceable.

10.
Snapshot direct and transitive closure is implementable.

11.
Policy completeness and conflict finality are enforceable.

12.
DecisionRecord remains sole release-status owner.

13.
FinalContentPackage cannot redefine decision truth.

14.
Publication lineage is single-root, non-branching, same-lineage, acyclic and time-ordered.

15.
Measurement and observation corrections are append-only and non-branching.

16.
Object GC cannot race canonical reference creation.

17.
Operational idempotency/fencing state has database constraints.

18.
Control Plane activation resolution is unambiguous.

19.
Tenant ownership is enforceable.

20.
Deletion/retention can degrade replay without silently rewriting history.

21.
The fixed adversarial suite passes at specification level.

22.
Primary entity IDs are values, never self-referential FKs.

23.
All canonical ID collections, including validation/evaluation/applicability sets, are normalized typed relations.

24.
Run.current_decision_cycle_id, DecisionCycle.parent_cycle_id and superseded_by_cycle_id are FK-safe and same-Run coherent.

25.
Retention/deletion removes detachable payload when possible; if protected identity/state itself must be removed, explicit deletion closure removes dependent rows as required so no surviving enforced FK dangles.

26.
Canonical object references are enforced through ObjectRegistry-backed relational references.

27.
Run.current_decision_cycle_id represents the active cycle pointer and does not incorrectly require OPEN status.

28.
Data-rights deletion may remove prohibited identity data and degrade replay; referential integrity never justifies retaining prohibited data.

29.
ObjectRegistry content-address uniqueness and ObjectReference ownership are tenant-scoped in MULTI_TENANT mode.

30.
Required deletion never mutates historical reference values; deleted targets become intentionally unresolved and are represented only by out-of-band non-sensitive tombstone/resolution-failure metadata when lawful.

31.
DecisionRecord enforces full task/snapshot/policy/conflict/human-review/selected-candidate closure and `selected_action` cannot embed entity IDs.

32.
Every generic Control Plane revision has an immutable exact payload binding to ObjectRegistry through its RevisionRegistry identity.

33.
Required deletion computes an explicit dependency closure so no surviving canonical row retains a dangling enforced FK, while immutable reference values are never rewritten to substitute targets.

34.
Generic Control Plane payload binding enforces the same tenant/workspace ownership across RevisionRegistry, RegisteredControlPlaneRevisionPayload and ObjectRegistry.

35.
Object GC evaluates the complete registered set of canonical ObjectRegistry reference paths, including ObjectReference, RegisteredControlPlaneRevisionPayload and every dedicated ObjectRegistry FK; zero ObjectReference rows alone never imply an object is unreachable.

36.
DecisionCycleBinding stores only `decision_cycle_id → decision_snapshot_id`; RunKnowledgeDelta and GovernanceSnapshot are derived from DecisionSnapshot and have no duplicate cycle-binding truth.

37.
RevisionRegistry stores revision identity/index metadata only; supersession has exactly one canonical owner in the authoritative revision record.
```


# 39. Verification Matrix

| Area | Target |
|---|---|
| Blueprint field coverage | PASS |
| Revision identity | PASS |
| Immutable identity | PASS |
| Generic ref integrity | PASS |
| Typed FK integrity | PASS |
| Reference-set normalization | PASS |
| Immutability | PASS |
| Bitemporal support | PASS |
| Epistemic chain | PASS |
| Snapshot closure support | PASS |
| Policy completeness | PASS |
| Conflict finality | PASS |
| Decision closure | PASS |
| Final package closure | PASS |
| Publication lineage | PASS |
| Measurement correction lineage | PASS |
| Object registry / GC serialization | PASS |
| Run / DecisionCycle persistence | PASS |
| Stage idempotency / fencing | PASS |
| Outbox / consumer dedupe | PASS |
| API idempotency | PASS |
| Activation intervals | PASS |
| Tenant integrity | PASS |
| Replay degradation | PASS |
| Migration safety | PASS |
| Primary identity typing | PASS |
| Full canonical ID-set normalization | PASS |
| DecisionCycle reference integrity | PASS |
| Retention tombstone FK integrity | PASS |
| ObjectRegistry reference enforcement | PASS |
| Active-cycle pointer lifecycle semantics | PASS |
| Data-rights deletion precedence | PASS |
| ObjectRegistry tenant scope | PASS |
| Historical reference immutability under deletion | PASS |
| DecisionRecord full closure | PASS |
| Generic Control Plane payload replay | PASS |
| Required-deletion referential closure | PASS |
| Generic payload tenant isolation | PASS |
| Complete ObjectRegistry GC reachability | PASS |
| DecisionCycleBinding single-source closure | PASS |
| Revision supersession single source of truth | PASS |

---

# 40. Non-Goals

SPEC02 intentionally does not choose:

```text
PostgreSQL vs another relational product
ORM
migration framework
queue vendor
object-store vendor
exact partition sizes
exact JSON schema contents
exact evaluator algorithms
exact evidence scoring
exact policy language
exact analytics aggregation method
```

These choices may be made during implementation or later SPECs without changing the frozen domain contracts.

---

# 41. Canonical Persistence Graph

```text
RevisionRegistry
├─ typed Control Plane revisions
└─ RegisteredControlPlaneRevision

ImmutableEntityRegistry
├─ Knowledge entities
├─ Content entities
├─ Validation / Rights entities
├─ Decision entities
├─ Publication entities
└─ Measurement / Learning entities

Run
└─ DecisionCycle
   ├─ StageExecution
   └─ DecisionCycleBinding
      ├─ RunKnowledgeDelta
      ├─ GovernanceSnapshot
      └─ DecisionSnapshot
         ├─ PolicyResult
         ├─ PolicyConflictResolution
         ├─ HumanReviewRecord
         └─ DecisionRecord
            └─ FinalContentPackage

PublicationLineage
└─ PublishedArtifact → PublishedArtifact → ...

MeasurementState → MeasurementState → ...

PerformanceObservation
→ corrected by PerformanceObservation
→ EvidenceItem
→ Proposition
→ EvidenceAssessment
→ EpistemicStateVersion

Canonical mutation
+
OutboxEvent
→ durable delivery
→ ConsumerReceipt
```

---

# 42. Final Doctrine

```text
MODEL THE IDENTITY.

TYPE THE REFERENCE.

NORMALIZE THE RELATIONSHIP.

KEEP THE HISTORY.

APPEND THE CORRECTION.

LOCK THE SUCCESSOR.

VALIDATE THE GRAPH.

FREEZE ONLY CLOSED STATE.

DO NOT HIDE REFERENCES
INSIDE OPAQUE JSON.

PRIMARY IDS
ARE NOT SELF-REFERENCES.

DELETE PAYLOAD
WHEN POSSIBLE.

DELETE IDENTITY TOO
WHEN RIGHTS REQUIRE IT.

DO NOT REWRITE
THE OLD REFERENCES.

REQUIRED DELETION
MAY REMOVE
DEPENDENT HISTORY TOO.

SURVIVING REAL FKS
MUST STILL RESOLVE.

REPLAY NEVER JUSTIFIES
PROHIBITED RETENTION.

OBJECT REFERENCES
ARE REAL FKS,
NOT FREE-FORM STRINGS.

GC SEES
EVERY OBJECT FK,
NOT ONE TABLE.

OBJECT IDENTITY
DOES NOT CROSS TENANTS
BY DEFAULT.

GENERIC CONFIG REVISIONS
HAVE EXACT PAYLOAD BINDINGS.

DECISION CYCLE BINDS
TO ONE SNAPSHOT,
NOT DUPLICATE INPUT TRUTH.

REVISION REGISTRY
IDENTIFIES REVISIONS;
REVISION ROWS
OWN SUPERSESSION.

REVISION + PAYLOAD + OBJECT
SHARE ONE TENANT SCOPE.

DECISION RECORD
MUST AGREE
WITH ITS SNAPSHOT.

DO NOT CONFUSE
STABLE ID
WITH REVISION ID.

DO NOT CONFUSE
REGISTRY RESOLUTION
WITH PAYLOAD AVAILABILITY.

DO NOT LET RETENTION
BECOME HISTORY REWRITING.

DO NOT LET CURRENT STATE
LEAK INTO OLD DECISIONS.

DATABASE WHERE POSSIBLE.

DETERMINISTIC VALIDATOR
WHERE RELATIONAL CHECKS
ARE NOT ENOUGH.

AUDIT.

PATCH.

FREEZE.

THEN SPECIFY THE NEXT LAYER.
```

**End of ContentOS SPEC 02 — Domain & Data Model v1.0.6 — FROZEN**
