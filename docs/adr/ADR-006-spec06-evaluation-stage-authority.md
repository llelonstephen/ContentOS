# ADR-006: SPEC06 Evaluation Stage Execution and Closure Authority Model

## Status
Accepted for M5 specification baseline (Implementation pending)

## Context
Milestone M4 established a rigorous StageExecution leasing, fencing, and cryptographic hashing model under `ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.5_FROZEN.md` (ADR-003, ADR-004, ADR-005).

However, `ContentOS_SPEC06_Evaluation_Framework_v1.0.1_FROZEN.md` had been frozen against SPEC05 v1.0.1, leading to several critical architectural gaps:
1. Evaluation stages lacked explicit normative StageExecution claim authority boundaries, leaving open the risk of invoking evaluators or models prior to database lease acquisition.
2. The stage input identity (`EvaluationStageInputCore`) lacked an explicit canonical serialization contract for `canonical_input_hash`, risking nondeterminism from database row insertion or return order.
3. Shorthand references to "normalized RunConfig refs" failed to bind the exact `run_config_id`, `runtime_parameters`, and the specific stage-utilized config members (e.g. which specific model or evaluator from an allowed set was actually executed).
4. Section 150A mandated inserting canonical evaluation records for all stages (§151–§158), which contradicted §158 (`EVALUATION_CLOSURE`), a stage that validates closure prerequisites over upstream-owned snapshot references without defining a synthetic evaluation entity.
5. `EVALUATION_CLOSURE` lacked an explicit `canonical_input_hash` binding, creating the hazard that a worker could claim closure under reference package A and commit under a materially different reference package B (silent rebase).

An independent external audit of `ContentOS_SPEC06_Evaluation_Framework_v1.0.2_FREEZE_CANDIDATE.md` (input SHA256: `bbe9cd003dd4244357f32716630891b5a3cb288b2e69c74422ede93531667204`) identified 2 blockers and 2 partials, which were remediated and verified with 0 blockers and 0 partials (PASS). The audited specification was then formally frozen as `ContentOS_SPEC06_Evaluation_Framework_v1.0.2_FROZEN.md` (SHA256: `5c8e61eb5203a33a58727ec0eb98a194326c512b01e536e5bea5ef0a093c8df5`).

## Decision
We formally adopt the SPEC06 v1.0.2 evaluation authority model as the normative foundation for Milestone M5:

1. **Mandatory Atomic Stage Claim Authority (§126)**:
   All evaluation stages (`ASSERTION_EXTRACT`, `ASSERTION_MAP`, `ASSERTION_VALIDATE`, `COMPOSITE_ASSESS`, `QUALITATIVE_EVALUATE`, `RISK_ASSESS`, `UNCERTAINTY_ASSESS`, `EVALUATION_CLOSURE`) must atomically claim their `StageExecution` in the database under scope-first locks before any external evaluator, model, or provider is invoked. Losing claimants (`claimed: false`) receive zero execution authority.

2. **Non-Canonical Reconstructable DTO (`EvaluationStageInputCore`)**:
   Stage inputs are structured as a non-canonical, reconstructable operational DTO. It MUST NOT become a persistent database table or canonical domain entity.

3. **Deterministic Canonical Serialization Contract (§127A)**:
   `canonical_input_hash` is computed as `SHA-256(canonical_serialize(EvaluationStageInputCore))`. Member keys are lexicographically sorted; all set-like collections (RunConfig revision refs, Proposition refs, EpistemicStateVersion refs, validation result refs, subject refs) are deterministically sorted using their complete typed identity; and the hash is strictly excluded from its own preimage.

4. **Full RunConfig Identity & Selected Config Binding (§102, §125, §128–§133A)**:
   Every evaluation stage binds:
   - exact `run_config_id`,
   - canonical `runtime_parameters`,
   - complete normalized ref sets (`prompt_revision_refs`, `model_config_revision_refs`, `tool_config_revision_refs`, `schema_revision_refs`, `retriever_revision_refs`, `evaluator_revision_refs`),
   AND
   - the exact stage-utilized config refs selected from those sets.
   A stage-utilized config must be an exact member of the pinned RunConfig closure.

5. **Commit-Time Revalidation Preamble with Category A / Category B Split (§150A)**:
   - **Category A (§151–§157)**: Canonical evaluation-write transactions verify scope, lock, fencing, cycle writability, reconstruct inputs, verify hash equality, verify RunConfig closure, verify object refs, insert ONLY their frozen canonical evaluation object, complete StageExecution, and write outbox events atomically.
   - **Category B (§158)**: `EVALUATION_CLOSURE` executes through the mandatory `EVALUATION_CLOSURE` StageExecution, reconstructs its exact closure-stage `EvaluationStageInputCore` (§133A), recomputes and verifies `canonical_input_hash`, verifies closure prerequisites against the reconstructed package, and transitions StageExecution to `COMPLETED` atomically without creating a synthetic evaluation entity or duplicate truth store.

6. **Exact Closure Reference Package Hashing & Anti-Rebase (§133A, §158)**:
   `EVALUATION_CLOSURE` binds the exact closure reference package. If any closure input or reference changes between claim and commit, the recomputed `canonical_input_hash` differs, commit fails closed, and silent rebase is rejected.

7. **Scope-First Tenant Isolation and Fencing Preservation (§126, §134, §150A)**:
   All database operations enforce tenant/workspace scoping prior to row inspection, eliminating existence oracles. Fencing tokens prevent stale worker commits after lease takeover. Late responses after cycle `FREEZING` fail closed.

## Consequences
- Eliminates specification drift between M4 / SPEC05 v1.0.5 and M5 / SPEC06.
- Prevents expensive or runaway evaluator/model calls by requiring prior database lease ownership.
- Guarantees deterministic, tamper-evident evaluation caching and historical replay.
- Prevents silent rebase of unvalidated or mutated artifacts into decision snapshots.
- No new canonical entity or duplicate source of truth is introduced.
- Status is strictly accepted as the **specification baseline**; implementation remains pending.

## References
- `ContentOS_SPEC06_Evaluation_Framework_v1.0.2_FROZEN.md` (SHA256: `5c8e61eb5203a33a58727ec0eb98a194326c512b01e536e5bea5ef0a093c8df5`)
- `ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.5_FROZEN.md` (SHA256: `c8d645700d24091a4853e83b27f1a2e7218f6f4b3b83925a1541224c84e0eeaf`)
- [ADR-003](ADR-003-stage-execution-fencing.md) (StageExecution Fencing and Lease Takeover)
- [ADR-004](ADR-004-runconfig-schema-role-binding.md) (RunConfig Schema Role Binding)
- [ADR-005](ADR-005-audience-two-phase-hashing.md) (SPEC05 Two-Phase Audience Hashing Protocol)
