# ContentOS — Security and Correctness Invariant Catalog

This catalog documents the core security and correctness invariants enforced across ContentOS. Each invariant is backed by one or more concrete enforcement mechanisms, such as domain/application guards, relational constraints/triggers, transactional checks, static checks, and focused/adversarial tests. Under no circumstances may an implementation edit relax or remove these invariants.

---

## 1. IDs Are Not Authorization Capabilities

- **Invariant**: Knowledge of an entity identifier (`run_id`, `stage_execution_id`, `decision_cycle_id`, `proposition_id`) conveys zero authority to inspect, lock, claim, or mutate that entity.
- **Why**: Prevents IDOR (Insecure Direct Object Reference) and unauthorized cross-tenant data exfiltration or state corruption.
- **Enforced at**: Persistence query boundaries (`WHERE tenant_id = $1 AND workspace_id IS NOT DISTINCT FROM $2`).
- **Typical Regression/Attack**: Querying by bare primary key (`WHERE run_id = $1 FOR UPDATE`) and checking tenant equality in memory after the row is already locked.

---

## 2. Tenant and Workspace Scope Checked at Query/Lock Boundaries

- **Invariant**: Security-sensitive tenant/workspace-owned reads, claims, locks, and commits must be scoped according to their ownership envelope (accounting for valid tenant-global or nullable-workspace entities where the frozen data model permits them).
- **Why**: Prevents cross-tenant denial of service via row-locking and prevents timing/existence oracles.
- **Enforced at**: Relational repository SQL queries (`content-stage-execution-repository.ts`, `runs`, `decision_cycles`, `stage_executions`).
- **Typical Regression/Attack**: A malicious tenant submits a known foreign `stage_execution_id` to acquire a lock or induce lock timeouts for another tenant's active worker.

---

## 3. Fail-Closed Default on Ambiguity

- **Invariant**: In any ambiguous condition—such as an unrecognized schema, unmapped role binding, hash mismatch, or missing parameter—the system immediately aborts the transaction with a typed validation error.
- **Why**: Prevents silent degradation into permissive or unvalidated states.
- **Enforced at**: Validation guards in Domain, Application, and Persistence layers.
- **Typical Regression/Attack**: Treating an unresolvable fact basis or missing schema binding as empty or benign, allowing ungrounded generative content to enter canonical state.

---

## 4. No Caller/Provider Authority for Trusted State

- **Invariant**: External model providers and API callers possess **proposal authority only**. All trusted inputs (task contracts, market context, schema payloads, epistemic support) must be resolved by trusted server-side resolvers (`TrustedPreProviderResolver` in `src/persistence/relational/services/trusted-pre-provider-resolver.ts`) directly from canonical database records.
- **Why**: Models hallucinate, and client callers can forge request parameters.
- **Enforced at**: `src/persistence/relational/services/trusted-pre-provider-resolver.ts`, `src/persistence/relational/services/postgres-audience-state-commit-port.ts`.
- **Typical Regression/Attack**: Accepting `canonical_input_hash` or `task_market` supplied directly by an API request body or LLM JSON output.

---

## 5. No CURRENT/LATEST Fallback Where Exact Revision Identity Is Required

- **Invariant**: Runtime derivation, policy evaluation, and epistemic queries must reference exact immutable revision IDs (`task_revision_id`, `schema_revision_id`, `prompt_revision_id`). Resolving `CURRENT`, `LATEST`, or `ACTIVE` during mid-run execution is strictly prohibited.
- **Why**: Prevents mid-run configuration drift, race conditions during control-plane updates, and breaks in deterministic replayability.
- **Enforced at**: `RunConfig` pinning, `GovernanceSnapshot` resolution, database foreign keys.
- **Typical Regression/Attack**: Querying `SELECT * FROM schemas WHERE status = 'ACTIVE'` instead of joining the exact revision pinned in `run_config_schema_revisions`.

---

## 6. StageExecution Canonical Input Hash Immutable After Claim

- **Invariant**: Once a `StageExecution` is claimed and assigned a `canonical_input_hash`, that hash cannot be modified. Any subsequent renewal or takeover must match the exact existing hash.
- **Why**: Prevents a worker from claiming a stage under one set of inputs and executing it under a different, tampered set of inputs.
- **Enforced at**: `claimContentStageExecution` in `src/persistence/relational/services/content-stage-execution-repository.ts`.
- **Typical Regression/Attack**: Retrying a failed stage execution with modified runtime parameters or task revisions using the original stage execution identifier.

---

## 7. Provider Invocation Only After Successful Atomic Claim

- **Invariant**: An external model provider (or costly derivation agent) may only be invoked **after** an atomic database claim transaction has successfully completed and established active lease ownership.
- **Why**: Prevents resource waste, duplicate model invocations, and racing workers from running uncontrolled background completions.
- **Enforced at**: `DeriveAudienceState.execute` orchestrator boundary (mandatory `AudienceStageClaimPort`).
- **Typical Regression/Attack**: Spawning LLM calls concurrently before obtaining a database lease, leading to orphaned LLM costs when another worker claims the slot.

---

## 8. Distributed Lease Takeover and Stale Worker Protection

- **Invariant**:
  - An unexpired lease owned by another worker blocks the claimant (`claimed: false`). A blocked worker receives zero execution authority and must immediately terminate without invoking external providers.
  - An expired lease may be legitimately taken over through the authorized atomic claim path. Takeover increments both `fencing_token` and `attempt_count`.
  - The previous worker holding the expired lease becomes stale; any subsequent commit attempt by that stale worker is rejected with `STALE_FENCING_TOKEN`.
  - Mismatched identity, scope, or hash always fails closed with `IDEMPOTENCY_CONFLICT` or `STAGE_CLAIM_SCOPE_MISMATCH`.
- **Why**: Solves distributed system split-brain and slow-worker races while allowing self-healing recovery from dead worker processes.
- **Enforced at**: `claimContentStageExecution` and commit ports (`fencing_token` conditional check).
- **Typical Regression/Attack**: Treating valid takeover as an unhandled failure or allowing a delayed worker to overwrite a newer attempt.

---

## 9. Fencing Token Verification at Commit

- **Invariant**: Every commit submitted by a worker must verify `WHERE stage_execution_id = $1 AND fencing_token = $2`. Stale workers whose leases were taken over are rejected immediately.
- **Why**: Guarantees that a delayed worker waking up after a lease expiry cannot overwrite the work of the takeover worker.
- **Enforced at**: Commit-time conditional update in relational persistence ports.
- **Typical Regression/Attack**: A delayed worker wakes up after a 5-minute timeout and overwrites a fresher, completed stage execution result.

---

## 10. The FREEZING Barrier

- **Invariant**: Once a `DecisionCycle` transitions to `FREEZING` or `FROZEN`, no new stage executions can be claimed, and no new knowledge deltas or epistemic states can be committed to that cycle.
- **Why**: Guarantees that the knowledge base and strategy inputs evaluated by the Governance Engine and Decision Core remain strictly fixed.
- **Enforced at**: `claimContentStageExecution`, `EvidencePersistenceService`, `DecisionPersistenceService`.
- **Typical Regression/Attack**: A background research crawler commits an updated proposition while the governance engine is evaluating policy rules for release.

---

## 11. Canonical Input Hash vs. Audience Admission Hash Separation

- **Invariant**:
  - `canonical_input_hash` is computed strictly over pre-provider inputs (`PreProviderManifestCore`) via `hashPreProviderManifestCore` (`src/domain/content/pre-provider-manifest-core.ts`) and locked into `StageExecution` upon atomic claim. It MUST NOT be present in its own preimage.
  - `audience_admission_hash` is computed over post-provider admissions via `computeAudienceAdmissionHash` (`src/domain/content/audience-admission-validator.ts`), binding the normalized proposal, factual leaves, fact basis links, semantic projection rules, and `canonical_input_hash`. It MUST NOT be present in its own preimage.
  - Neither hash may substitute for or overwrite the other.
- **Why**: Enforces full two-phase traceability between what was requested before generation and what was admitted after generation (SPEC05 v1.0.5 §91, §112, §113).
- **Enforced at**: `src/domain/content/pre-provider-manifest-core.ts`, `src/domain/content/audience-admission-validator.ts`, `src/persistence/relational/services/postgres-audience-state-commit-port.ts`.
- **Typical Regression/Attack**: Using a single composite hash computed after model execution, obscuring pre-provider input parameters and preventing verification of the initial execution envelope.

---

## 12. Exact RunConfig Normalized Reference Set Identity

- **Invariant**: A `RunConfig` identity encompasses both its `runtime_parameters` and its exact associated reference sets across prompt, model, tool, schema, retriever, and evaluator link tables. Canonical hashing must sort rows deterministically to ensure row insertion order does not change hash identity.
- **Why**: Prevents hidden tool or model configuration mutations under the same `run_config_id`.
- **Enforced at**: `ContentRuntimeRunConfigResolver.ts`, database uniqueness constraints.
- **Typical Regression/Attack**: Adding a tool or changing a prompt revision link without updating the `run_config_id`.

---

## 13. SPEC03 evaluateSemanticEquivalence Is Sole Semantic Authority

- **Invariant**: Determination of proposition semantic equivalence and deduplication is governed strictly by the deterministic `evaluateSemanticEquivalence` engine. External models may not declare propositions equivalent.
- **Why**: Ensures uniform epistemic graph integrity and prevents adversarial model outputs from merging distinct factual assertions.
- **Enforced at**: `evaluateSemanticEquivalence` in `src/domain/knowledge/epistemic-state.ts`.
- **Typical Regression/Attack**: Relying on vector embedding cosine similarity thresholds to automatically merge legal or clinical propositions.

---

## 14. Commit-Time Server-Side Reconstruction and Revalidation

- **Invariant**: During the final atomic persistence transaction, the commit port must independently re-read immutable inputs from trusted database records, reconstruct the derivation manifest core, recompute all cryptographic hashes, and verify that the recomputed hashes match the claim and admission hashes.
- **Why**: Guarantees tamper-evidence. Even if an in-memory application worker state is corrupted, the database commit rejects forged claims.
- **Enforced at**: `PostgresAudienceStateCommitPort.commitAudienceState`.
- **Typical Regression/Attack**: Trusting the in-memory orchestrator's claim that inputs were valid without recomputing the SHA256 digest inside the database transaction.

---

## 15. Immutable Historical and Revision Semantics

- **Invariant**: Canonical historical and revision records (`TaskContractRevision`, `Proposition`, `AudienceState`, `GovernanceSnapshot`, `DecisionRecord`) are immutable under normal application and runtime correction paths. State evolution creates new immutable records or revisions with explicit parent/supersedes pointers rather than updating historical meaning in place. Any exceptional retention, privacy-erasure, or explicitly authorized destructive flow must follow the exact frozen specification governing that capability and must not be treated as an ordinary correction path. Historical provider output is recorded and admitted such that its authority can be revalidated without relying on a new provider call.
- **Why**: Guarantees auditability, non-repudiation, and historical revalidation.
- **Enforced at**: PostgreSQL database triggers (`trg_immutable_*`), application domain boundaries.
- **Typical Regression/Attack**: Issuing an `UPDATE audience_states SET state_stage = 'FINAL'` instead of inserting a new `AudienceState` version.

---

## 16. No New Canonical Entity Without Frozen-Spec Authorization

- **Invariant**: No implementation may invent new canonical entities, database tables, or top-level registry types that are not explicitly specified in a frozen specification. Reconstructable manifestations (such as manifests and projections) must remain ephemeral or supporting tables.
- **Why**: Prevents architecture drift, spec divergence, and unvetted relational sprawl.
- **Enforced at**: Code audits and preflight verification vectors.
- **Typical Regression/Attack**: Creating a new canonical `PreProviderManifest` database table and registering it in `immutable_entity_registry` when the specification requires it to be reconstructable in-memory.

---

## 17. Milestone M5 Evaluation Stage Authority and Closure Hashing (SPEC06 v1.0.2 Frozen Requirements)

- **Invariant**:
  - **Mandatory Atomic Claim**: An evaluator, model, or provider may only be invoked after successful atomic claim of a `StageExecution` with exact tenant/workspace scope, `run_id`, `decision_cycle_id`, `stage_name`, `idempotency_key`, and `canonical_input_hash`. Losing claimants receive zero execution authority.
  - **Non-Canonical DTO**: `EvaluationStageInputCore` is a non-canonical, reconstructable operational DTO and MUST NOT become a canonical domain entity or separate truth store.
  - **Deterministic Serialization**: Canonical hashing of stage inputs follows §127A deterministic serialization (sorted keys, typed deterministic sorting of set-like collections, canonical timestamps, preimage exclusion).
  - **Full RunConfig & Selected Config Binding**: Every stage input binds the full immutable `RunConfig` identity (`run_config_id`, `runtime_parameters`, and normalized prompt, model, tool, schema, retriever, evaluator ref sets) AND the exact stage-utilized config member revisions actually used. Selecting an unpinned config fails closed.
  - **Commit-Time Trusted Reconstruction**: Inside the atomic commit transaction, the worker must re-read trusted records directly from the database, reconstruct `EvaluationStageInputCore`, recompute `canonical_input_hash`, and assert byte-exact equality with `StageExecution.canonical_input_hash`. Stale workers or hash mismatches fail closed with zero silent repair or rebase (§150A).
  - **Exact Closure Reference Package Hashing**: `EVALUATION_CLOSURE` StageExecution binds the exact closure package (§133A). Any reference change between claim and commit produces a hash mismatch and rejects closure; silent rebase is strictly prohibited (§158).
  - **Preservation of Core Boundaries**: Stale-worker fencing, lease takeover protection, scope-first tenant isolation, and the `FREEZING` barrier apply fully to all evaluation stages.
- **Why**: Prevents untrusted model execution outside lease authority, configuration drift, silent rebase of unvalidated evaluation artifacts into release snapshots, and cross-tenant existence leaks.
- **Enforced at**: Future Milestone M5 evaluation stage repositories, orchestrators, and commit ports (formalized in `ContentOS_SPEC06_Evaluation_Framework_v1.0.2_FROZEN.md` and [ADR-006](adr/ADR-006-spec06-evaluation-stage-authority.md)).
- **Typical Regression/Attack**: Calling an evaluator model before claiming a stage lease; altering selected model or evaluator revision without changing `canonical_input_hash`; or silently substituting favorable validation results during snapshot closure.

*(Note: These requirements represent the frozen M5 specification baseline; M5 implementation is currently pending.)*
