# ContentOS — Milestone History (M0 to M4)

This document chronicles the design, implementation, and verified security closures of ContentOS from Milestone M0 through Milestone M4, as established by the repository's immutable Git history and verified tags.

---

## Milestone 0: Core Toolchain, Foundation, and Isolation Boundaries

### Goal
Establish the foundational runtime architecture, TypeScript strict-mode compiler toolchain, modular monolith boundaries, structured logging, safe configuration parsing, SecretStore boundary, and test database safety barriers.

### Major Security and Architecture Closures
- **SecretStore Non-Exportable Boundary**: Eliminated raw secret strings in domain code. Introduced `SecretReference` typed identifiers (`src/domain/shared/types.ts`), where secrets are resolved strictly by infrastructure adapters at point-of-call via `ISecretStore` (`src/security/secrets/secret-store-interface.ts`, implemented by `EnvSecretStore`) and never logged or serialized into JSON entities ([ADR-001](adr/ADR-001-secret-store-boundary.md)).
- **AST Dependency Direction Verification**: Implemented automated AST checks (`tests/unit/m0-domain-types.test.ts`) enforcing `API → APPLICATION → DOMAIN ← INFRASTRUCTURE`, ensuring the Domain layer imports no infrastructure or framework packages.
- **Trace Context and Structured Logging**: Encapsulated Pino within `createLogger`, requiring `trace_id` injection across all log records and preventing unformatted `console.log` statements.
- **Test Database Guard (`assertTestDatabase`)**: Enforced runtime safeguards preventing execution of destructive tests or migration scripts against any database whose name does not contain `test`.

### Verified Tags
- `m0-internal-verified`
- `m0-v2-verified`
- `m0-v3-verified` (commit `a6efd6d8c0cf147f42b93b75489fba5abb508ff2`)

### Inherited by M1
- Foundational domain types (`TenantId`, `WorkspaceId`, `TraceId`, `RunId`).
- Hexagonal directory structure (`src/domain`, `src/application`, `src/persistence`, `src/api`).
- Zero-dependency core domain isolation.

---

## Milestone 1: Relational Persistence and Domain Data Model

### Goal
Implement the core relational schema, entity registries, immutability triggers, and transactional persistence layers adhering strictly to `ContentOS_SPEC02_Domain_Data_Model_v1.0.6_FROZEN.md`.

### Major Security and Architecture Closures
- **Relational Immutability Triggers**: Designed and deployed PostgreSQL triggers (`trg_immutable_*`) on canonical entities and registries (`immutable_entity_registry`, `revision_registry`, `task_contract_revisions`, `run_configs`), raising exceptions on any `UPDATE` or `DELETE` attempt.
- **PostgreSQL Capability & Privilege Separation**: Separated database users into `contentos_control_plane_role` (authorized to register new revisions) and `contentos_runtime_role` (least-privilege runtime agent, restricted to leased operational execution).
- **76-Vector Adversarial Verification Suite**: Implemented `src/tests/integration/m1-spec02-76-vectors.test.ts` covering tenant isolation, cross-workspace boundaries, foreign key integrity, immutable payload hashing, and fail-closed transaction aborts.
- **Vector 60 Non-Forgeable Boundary**: Closed role escalation vulnerability by verifying database session principals at connection checkout.

### Verified Tags
- `m1-internal-verified`
- `m1-v2-verified` through `m1-v6-verified`
- `m1-v7-verified` (commit `53b0fc6d67a4a23bfc9c005a1c611d53c778d1bf`)

### Inherited by M2
- Full PostgreSQL Drizzle ORM schema with migration history (`0000_chemical_iron_man.sql`, `0001_fantastic_kid_colt.sql`).
- Relational immutability mechanisms protecting all canonical records.
- Base entity registry tables: `immutable_entity_registry` and `revision_registry`.

---

## Milestone 2: Evidence, Proposition, and Epistemic State Engine

### Goal
Implement the knowledge substrate defined in `ContentOS_SPEC03_Evidence_Proposition_Epistemic_State_v1.0.1_FROZEN.md`, establishing evidence grounding, semantic deduplication, and monotonic epistemic status evaluation.

### Major Security and Architecture Closures
- **Semantic Fingerprinting & Deduplication**: Canonical meaning generation and proposition equivalence checking via `evaluateSemanticEquivalence`, preventing near-duplicate propositions from fragmenting evidence weight.
- **Epistemic Monotonic Progression**: Enforced strict rules for epistemic state transitions (`SUPPORTED`, `INSUFFICIENT`, `CONTRADICTED`, `UNKNOWN`) and causal qualifications (`CORRELATIONAL`, `CAUSAL`, `NOT_APPLICABLE`), preventing observational evidence from claiming causal support.
- **Standalone Write Authorization**: Restricted standalone evidence and proposition ingestion through principal capability checks, ensuring runtime workers cannot bypass audit registries.
- **76-Vector SPEC03 Adversarial Suite**: Built `src/tests/integration/m2-spec03-76-vectors.test.ts` covering adversarial injection attempts, evidence invalidation, cross-tenant evidence queries, and temporal valid-time window constraints.

### Verified Tags
- `m2-internal-verified`
- `m2-v2-verified` through `m2-v8-verified`
- `m2-v9-verified` (commit `10e2cade01b65a35200a1d5b06de6b527ebd4796`)

### Inherited by M3
- Robust, immutable knowledge graphs linking `EvidenceItem`, `Proposition`, `EvidencePropositionLink`, and `EpistemicStateVersion`.
- Temporal resolution logic guaranteeing facts are evaluated at valid snapshot cutoffs.

---

## Milestone 3: Governance and Policy Engine

### Goal
Implement the governance runtime and policy evaluator specified in `ContentOS_SPEC04_Governance_Policy_Engine_v1.0.2_FROZEN.md`, enabling deterministic policy compliance checking, conflict resolution, and immutable decision audit packaging.

### Major Security and Architecture Closures
- **Deterministic Policy DSL Interpreter**: Created a bounded, side-effect-free, AST-based policy language with zero network or filesystem capabilities, enforcing strict step count bounds and timeout limits.
- **Hierarchical Conflict Resolution**: Implemented deterministic conflict resolution with canonical sorting of conflict keys, precedence ladders (`NormativeRule` > `Guidance`), and authorized override verification.
- **Snapshot Freeze Boundary (`GovernanceSnapshot`)**: Bound policy evaluations immutably to frozen snapshot closures, rejecting any attempt to evaluate against mutable current state.
- **80-Vector SPEC04 Adversarial Suite**: Added `src/tests/integration/m3-spec04-80-vectors.test.ts` proving zero bypasses across rule tampering, AST recursion attacks, human review misattributions, and unauthorized release status elevations.
- **Exact Schema Payload Validation**: Enforced byte-exact SHA256 validation of `SchemaDefinition` payloads stored in object storage.

### Verified Tags
- `m3-internal-verified`
- `m3-v2-verified` through `m3-v8-verified`
- `m3-v9-verified` (commit `fcbce2d10737671a5e5832f5dc5017463a182526`)

### Inherited by M4
- Production-grade Policy DSL and policy conflict resolver.
- Snapshot freeze lifecycle (`OPEN` → `FREEZING` → `FROZEN`).
- Strict schema definition payload validation patterns.

---

## Milestone 4: Content Intelligence Runtime

### Goal
Implement the creative derivation runtime specified in `ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.5_FROZEN.md`, orchestrating the generation of `AudienceState`, `StrategyHypothesis`, `ContentArchitecture`, and `ContentCandidate` under strict two-phase cryptographic pinning and distributed leasing.

### Major Security and Architecture Closures
- **SPEC05 v1.0.5 Normative Alignment**: Updated specification and implementation to version 1.0.5, formalizing two-phase cryptographic hashing and mandatory stage claim authority.
- **RunConfigSchemaRoleBinding & Exact Membership**: Formalized schema role assignment (`CONTENT_INTELLIGENCE_AUDIENCE`) requiring exact 4-tuple membership (`run_config_id`, `entity_type`, `stable_id`, `revision_id`) in `run_config_schema_revisions`, preventing unauthorized or unpinned schema substitution ([ADR-004](adr/ADR-004-runconfig-schema-role-binding.md)).
- **Audience Semantic Projection Rules**: Enforced deterministic projection of unstructured model proposals into typed, fact-bound assertions via `AudienceSemanticProjectionRule` templates.
- **Factual & Path-Bound Uncertainty Model**: Bound every admitted proposition and uncertainty record to exact JSON pointers (`fact_path`), requiring verified epistemic support before admission.
- **Two-Phase Cryptographic Hashing**:
  - `canonical_input_hash`: Computed from pre-provider inputs (`PreProviderManifestCore`) via `hashPreProviderManifestCore` (`src/domain/content/pre-provider-manifest-core.ts`) and locked into `StageExecution` upon atomic claim. The hash field is strictly excluded from its own preimage.
  - `audience_admission_hash`: Computed over post-provider admissions via `computeAudienceAdmissionHash` (`src/domain/content/audience-admission-validator.ts`), binding normalized proposal content, factual leaves, exact basis links, semantic projection rules, and `canonical_input_hash` into canonical admission authority. It is strictly excluded from its own preimage ([ADR-005](adr/ADR-005-audience-two-phase-hashing.md)).
- **Mandatory StageExecution Claim Authority**: Refactored `DeriveAudienceState` to make `AudienceStageClaimPort` structurally mandatory, preventing any provider execution without prior lease ownership.
- **Commit-Time Reconstruction & Revalidation**: In `PostgresAudienceStateCommitPort`, reconstructed the entire pre-provider manifest and recomputed both hashes from trusted relational records, failing closed on any discrepancy.
- **Exact RunConfig Normalized Ref Set Closure**: Closed RunConfig canonical identity by including all normalized link tables (`run_config_prompt_revisions`, `run_config_model_revisions`, `run_config_tool_revisions`, `run_config_schema_revisions`, `run_config_retriever_revisions`, `run_config_evaluator_revisions`), ensuring deterministic sorting and row-ordering invariance.
- **Tenant & Workspace-Scoped Database Lookup and Locking**: Closed the final external audit blocker by ensuring `runs`, `decision_cycles`, and `stage_executions` are resolved and locked `FOR UPDATE` strictly within authorized `tenant_id` and `workspace_id` scopes before evaluating identity. Catches unique constraint violations (`23505`) on cross-tenant claims and fails closed with `STAGE_CLAIM_SCOPE_MISMATCH` without leaking foreign record details ([ADR-003](adr/ADR-003-stage-execution-fencing.md)).

### Verified Tags
- `m4-internal-verified`
- `m4-v2-internal-verified`
- `m4-v1-verified` (commit `30ab5def8e2cab540c6811a8f577a995d188e10f`)

### Inherited by M5
- Validated `ContentCandidate` entities with complete parent lineage.
- Fully wired, fenced, and tenant-scoped `StageExecution` leasing coordinator.
- Cryptographically pinned generation records ready for assertion extraction and evaluation under SPEC06.
