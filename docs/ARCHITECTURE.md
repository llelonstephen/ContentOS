# ContentOS — System Architecture

This document outlines the architectural patterns, runtime mechanisms, and component interactions in ContentOS as of Milestone M4 (`m4-v1-verified`).

For normative requirements, refer to:
- `ContentOS_SPEC01_System_Architecture_v1.1.3_FROZEN.md`
- `ContentOS_SPEC02_Domain_Data_Model_v1.0.6_FROZEN.md`
- `ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.5_FROZEN.md`

---

## 1. Architectural Layers and Dependency Direction

ContentOS follows Hexagonal (Ports and Adapters) Architecture, enforcing a strict unidirectional dependency graph:

```text
       ┌───────────────────────────────┐
       │           API Layer           │ (Fastify REST, HTTP handlers)
       └───────────────┬───────────────┘
                       │ imports
                       ▼
       ┌───────────────────────────────┐
       │       Application Layer       │ (Orchestrators, Stage Pipelines, Workflows)
       └───────────────┬───────────────┘
                       │ imports
         ┌─────────────┴─────────────┐
         ▼                           ▼
┌───────────────────┐       ┌──────────────────────────────────┐
│   Domain Layer    │       │     Infrastructure Adapters      │
│ (Pure logic, ASTs,│       │  (Postgres repositories,         │
│  validation rules)│       │   Object store, Redis queue)     │
└───────────────────┘       └──────────────────────────────────┘
```

- **Domain Layer (`src/domain/`)**: Pure TypeScript logic, entity definitions, and validation rules. It contains **zero external framework dependencies** (no fastify, no postgres, no redis). Automated AST lint tests (`m0-domain-types.test.ts`) fail if Domain imports infrastructure packages.
- **Application Layer (`src/application/`)**: Coordinates workflows, defines input/output ports, and orchestrates stage executions (e.g., `DeriveAudienceState`).
- **Persistence Layer (`src/persistence/`)**: Implements database repositories, relational schemas (Drizzle ORM), migration scripts, and object store drivers.
- **API Layer (`src/api/`)**: Exposes RESTful HTTP endpoints with strict request-body schema validation and tenant extraction.

---

## 2. Execution Hierarchy: Run, DecisionCycle, StageExecution

The runtime coordinates work across three nested execution layers:

```text
Run (run_id, tenant_id, workspace_id, status: RUNNING)
 │
 ├── current_decision_cycle_id: cycle_id_1
 │    │
 │    └── DecisionCycle (decision_cycle_id, fencing_epoch: 1, status: OPEN)
 │         │
 │         ├── StageExecution: AUDIENCE_FINALIZE
 │         │    ├── lease_owner: worker-a
 │         │    ├── fencing_token: 1
 │         │    └── canonical_input_hash: 0a1b...
 │         │
 │         └── StageExecution: STRATEGY_GENERATE (subsequent stage)
 │
 └── (optional successor cycle on feedback or failure)
```

1. **`runs`**:
   Represents the top-level execution of a task revision against an immutable `RunConfig`. A run starts in `INITIALIZING`, moves to `RUNNING`, and terminates in `COMPLETED`, `FAILED`, or `CANCELLED`.
2. **`decision_cycles`**:
   Represents a discrete cycle of intelligence, evaluation, and decision-making within a run. Cycles have a strictly monotonic `cycle_number` and `fencing_epoch`. A cycle starts in `OPEN`, transitions to `FREEZING` when knowledge inputs are closed, and becomes `FROZEN` before decision evaluation.
3. **`stage_executions`**:
   Represents an individual unit of derivation (e.g., `AUDIENCE_FINALIZE`, `STRATEGY_GENERATE`, `ARCHITECTURE_GENERATE`, `CANDIDATE_GENERATE`). Claimed with database-level distributed leasing.

---

## 3. Distributed Stage Leasing, Fencing, and FREEZING

To prevent split-brain execution and stale worker writes in distributed environments, stage execution is governed by three interlocking mechanisms:

### Atomic Claim & Scoped Resolution
Workers invoke `claimContentStageExecution` within a database transaction. The repository queries `runs`, `decision_cycles`, and `stage_executions` using `FOR UPDATE` locks scoped explicitly by `tenant_id` and null-safe `workspace_id`.
- If an active lease is held by another worker and has not expired: The claimant is blocked (`claimed: false`).
- If an active lease is held by the same worker: The lease is renewed without incrementing `fencing_token`.
- If an existing lease has expired: Another worker may take over the stage slot. The atomic claim path increments both `fencing_token` and `attempt_count`, making the prior worker stale.
- If identity, scope, or hash mismatches occur: Any mismatch in `run_id`, `decision_cycle_id`, `stage_name`, or `canonical_input_hash` results in an immediate fail-closed `IDEMPOTENCY_CONFLICT` or `STAGE_CLAIM_SCOPE_MISMATCH`.
- If no stage row exists: A new stage record is inserted with `fencing_token: 1`, `attempt_count: 1`, and status `RUNNING`.

### Stale Worker Rejection via Fencing Tokens
Every successful lease takeover increments `fencing_token`. When a worker completes its operation and commits to the database, the commit transaction verifies that the stage row's current `fencing_token` matches the worker's token. If an earlier worker was delayed (e.g., by a long external provider call) and a takeover occurred, the earlier worker's commit is rejected with `STALE_FENCING_TOKEN`.

### The FREEZING Barrier
When a cycle enters `FREEZING` or `FROZEN`, `claimContentStageExecution` and all knowledge delta commit ports immediately reject new claims or commits with `KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING`.

---

## 4. RunConfig Canonical Identity and Schema Role Bindings

A `RunConfig` defines the immutable execution envelope for a run. Under SPEC02 and SPEC05, a RunConfig's cryptographic identity is determined not merely by JSON runtime parameters, but by its **complete normalized reference sets**:

```text
RunConfig
 ├── runtime_parameters (JSONB)
 ├── prompt_revision_refs      (run_config_prompt_revisions)
 ├── model_config_revision_refs(run_config_model_revisions)
 ├── tool_config_revision_refs (run_config_tool_revisions)
 ├── schema_revision_refs      (run_config_schema_revisions)
 ├── retriever_revision_refs   (run_config_retriever_revisions)
 └── evaluator_revision_refs   (run_config_evaluator_revisions)
```

### Typed Schema Role Bindings
`run_config_schema_role_bindings` maps functional roles (such as `CONTENT_INTELLIGENCE_AUDIENCE`) to an exact schema revision. To prevent unpinned schema drift, the database enforces:
1. The role binding must point to a schema revision that is an active member in `run_config_schema_revisions`.
2. Schema membership is tracked by the complete 4-tuple: `(run_config_id, entity_type, stable_id, revision_id)`.
3. Database triggers (`trg_run_config_audience_role_complete`) verify role completeness prior to execution.

---

## 5. SecretStore Boundary

In compliance with SPEC08 and [ADR-001](adr/ADR-001-secret-store-boundary.md), ContentOS enforces strict secret isolation:
- Raw secret strings (API tokens, database credentials, cryptographic keys) **never** enter the Domain or Application layers.
- Components reference secrets via opaque `SecretReference` tokens (`src/domain/shared/types.ts`).
- Only infrastructure adapters (such as external model provider HTTP clients) invoke `ISecretStore` (`src/security/secrets/secret-store-interface.ts`, implemented by `EnvSecretStore`) to retrieve secrets at the immediate point of wire transmission.
- Secret values are redacted from logs and never written to relational tables or object payloads.

---

## 6. Two-Phase Cryptographic Audience Derivation

Milestone M4 formalizes a two-phase hashing protocol for content intelligence stages in compliance with SPEC05 v1.0.5 (§91, §92, §112, §113):

```text
Phase 1: Pre-Provider (Input Envelope)
  Immutable Inputs (RunConfig refs, TaskContractRevision, SchemaBinding, Cutoff)
       │
       ▼
  Reconstruct PreProviderManifestCore (DTO)
       │
       ▼  Function: hashPreProviderManifestCore()
  canonical_input_hash = SHA256(canonical_json(PreProviderManifestCore))
  * Excluded from its own preimage
       │
       ▼
  StageExecution CLAIMED (locks canonical_input_hash into DB)

Phase 2: External Provider & Semantic Admission
  External Model Provider (generates candidate Audience proposal)
       │
       ▼
  Validate Audience Admission & Basis Selections against Epistemic Graph:
    - Factual leaves classified against projection schema
    - Epistemic basis links bound to Proposition and EpistemicStateVersion
    - Semantic equivalence outcomes and projection rule IDs recorded
       │
       ▼  Function: computeAudienceAdmissionHash()
  audience_admission_hash = SHA256(canonical_json(
    proposal + leaves + links + projection_evidence + canonical_input_hash + scope
  ))
  * Excluded from its own preimage

Phase 3: Atomic Persistence
  PostgresAudienceStateCommitPort:
    1. Verify StageExecution lock and fencing_token
    2. Re-read trusted records and reconstruct PreProviderManifestCore from DB
    3. Assert recomputed input hash == StageExecution.canonical_input_hash
    4. Assert recomputed admission hash == committed audience_admission_hash
    5. Write AudienceState, FactBasisLinks, DerivationAuthority
    6. Transition StageExecution to COMPLETED
```

This ensures that:
- Pre-provider inputs cannot be altered during generation.
- Model proposals cannot invent fact claims without traceable basis links to verified `EpistemicStateVersion` rows.
- Historical provider output is recorded and admitted such that its authority can be revalidated without relying on a new provider call.

---

## 7. Tenant and Workspace Isolation

Security-sensitive tenant/workspace-owned reads, claims, locks, and commits must be scoped according to their ownership envelope (accounting for valid tenant-global or nullable-workspace entities where permitted):
- **Null-Safe Workspace Equality**: Workspace equality in PostgreSQL is evaluated using `workspace_id IS NOT DISTINCT FROM target_workspace`, properly handling single-workspace or global tenant configurations without accidental wildcard matching.
- **Pre-Lock Scope Verification**: Workers cannot query or lock foreign tenant rows. Scoping conditions (`tenant_id = $1 AND workspace_id IS NOT DISTINCT FROM $2`) are embedded directly in the `WHERE` clauses of all `SELECT ... FOR UPDATE` statements.
- **Zero Existence Oracles**: Cross-tenant requests that reference foreign IDs fail closed with generic not-found or scope mismatch errors (`RUN_NOT_FOUND`, `STAGE_CLAIM_SCOPE_MISMATCH`), disclosing no metadata about foreign rows.

---

## 8. Deterministic Replay Principles

ContentOS mandates auditability without reliance on non-deterministic external LLMs:
- **No Live LLM Replay**: Replaying a historical run never calls an external model. Instead, replay verifies historical generation outputs, their `canonical_input_hash`, and their respective stage derivation and admission records against the immutable database registry.
- **Immutable Historical Lineage**: Every generated artifact preserves parent lineage (`supersedes_task_revision_id`, `parent_candidate_id`).
- **Cryptographic Object Addressing**: All structured and unstructured payloads in object storage are stored by SHA256 content address (`objects/<sha256>`), guaranteeing tamper evidence.

---

## 9. Milestone M5 Evaluation Stage Authority (SPEC06 v1.0.2 Frozen Requirements)

Milestone M5 implements the content evaluation framework specified in `ContentOS_SPEC06_Evaluation_Framework_v1.0.2_FROZEN.md`. Evaluation stages inherit and extend the StageExecution distributed leasing, fencing, and immutability architecture established in Milestone M4:

### Inherited StageExecution Authority Model
Canonical evaluation stages (`ASSERTION_EXTRACT`, `ASSERTION_MAP`, `ASSERTION_VALIDATE`, `COMPOSITE_ASSESS`, `QUALITATIVE_EVALUATE`, `RISK_ASSESS`, `UNCERTAINTY_ASSESS`, `EVALUATION_CLOSURE`) execute through SPEC01 `StageExecution`. Every stage requires a mandatory trusted atomic claim before any external evaluator, model, or provider is invoked. A losing claimant (`claimed: false`) receives zero execution authority and fails closed.

### Reconstructable Stage Input Identity (`EvaluationStageInputCore`)
Stage inputs are dynamically constructed from authoritative database rows into a non-canonical, reconstructable operational DTO (`EvaluationStageInputCore`). This DTO is never persisted as a canonical domain entity or separate truth store.

### Deterministic Canonical Serialization (§127A)
`canonical_input_hash` is computed as `SHA-256(canonical_serialize(EvaluationStageInputCore))`. Hashing enforces:
1. Lexicographical sorting of object/member keys.
2. Deterministic typed sorting of all set-like ref collections (RunConfig revision refs, Proposition refs, EpistemicStateVersion refs, validation result refs, subject refs).
3. Preservation of semantically ordered sequences.
4. Language-independent deterministic null/absent representations and canonical timestamps.
5. Strict exclusion of `canonical_input_hash` from its own preimage.
6. Row insertion order invariance.

### Full RunConfig Identity and Stage-Utilized Config Binding
Every stage input binds the full immutable `RunConfig` identity:
- `run_config_id`
- canonical `runtime_parameters`
- complete normalized ref sets: `prompt_revision_refs`, `model_config_revision_refs`, `tool_config_revision_refs`, `schema_revision_refs`, `retriever_revision_refs`, `evaluator_revision_refs`
AND
- the exact stage-utilized config member revisions actually used by that stage.
A selected config must be an exact, proven member of the pinned RunConfig closure. Selecting a different config member or altering runtime parameters produces a distinct canonical input and yields a different `canonical_input_hash`.

### Commit-Time Server-Side Reconstruction & Revalidation (§150A)
All evaluation persistence transactions enforce pre-commit revalidation inside the atomic database transaction:
- **Category A: Evaluation Write Transactions (§151–§157)**: Re-resolve Run, DecisionCycle, and StageExecution under scope-first locks; verify fencing_token and cycle writability (cycle has not crossed `FREEZING`); reconstruct `EvaluationStageInputCore` from trusted database rows; verify byte equality between recomputed hash and `StageExecution.canonical_input_hash`; verify exact RunConfig closure; verify object-specific refs; insert ONLY the already-frozen canonical evaluation object; transition StageExecution to `COMPLETED`; write outbox events.
- **Category B: Evaluation Closure Transaction (§158)**: Executes through the mandatory `EVALUATION_CLOSURE` StageExecution. Reconstructs the exact closure-stage `EvaluationStageInputCore` (§133A); recomputes and verifies `canonical_input_hash`; verifies full RunConfig closure; verifies all material assertion, validation, composite, qualitative, risk, and uncertainty refs; rejects closure on any discrepancy without silent rebase; transitions `EVALUATION_CLOSURE` StageExecution to `COMPLETED` atomically. Does NOT create a synthetic evaluation entity or duplicate truth store.

### Scope-First Isolation, Distributed Fencing, and FREEZING Barrier
All database queries embed `tenant_id` and null-safe `workspace_id` in their `WHERE` clauses prior to row inspection. Fencing tokens prevent stale worker commits after lease takeover. The `FREEZING` barrier strictly rejects late claims or evaluation writes after cycle freeze.

*(Note: These requirements represent the frozen M5 specification baseline; M5 implementation is currently pending.)*
