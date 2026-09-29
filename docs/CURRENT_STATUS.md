# ContentOS — Current Status and Handoff

> **Authoritative Handoff Document**
> *Baseline Date: September 30, 2026*

---

## 1. Milestone Baseline

| Attribute | Value |
|---|---|
| **Current Milestone** | **M4 VERIFIED** |
| **Verified Git Tag** | [`m4-v1-verified`](https://github.com/llelonstephen/ContentOS/releases/tag/m4-v1-verified) |
| **Verified Implementation Commit** | `30ab5def8e2cab540c6811a8f577a995d188e10f` |
| **Current Working Branch** | `m5-base` |
| **Next Milestone** | **M5 / SPEC06** |
| **Operational State** | **SPEC06 REVIEW / EXTERNAL SPEC AUDIT REQUIRED BEFORE IMPLEMENTATION** |
| **Authoritative SPEC05** | `ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.5_FROZEN.md` |
| **Frozen SPEC05 SHA256** | `c8d645700d24091a4853e83b27f1a2e7218f6f4b3b83925a1541224c84e0eeaf` |
| **Upcoming SPEC06 File** | `ContentOS_SPEC06_Evaluation_Framework_v1.0.1_FROZEN.md` |
| **SPEC06 SHA256** | `8a3c0420fefda8dfed367f55d86f3f81375c5c2bbc7bad4e0800247e31a9cb47` |
| **SPEC06 Audit Status** | **NOT PROVEN (independent external specification audit required)** |

---

## 2. Instructions for a New Coding Agent

> [!IMPORTANT]
> **MANDATORY READING ORDER BEFORE WRITING CODE**
> Any AI agent, pair programmer, or software engineer resuming work on ContentOS **MUST** read and understand the following documents prior to proposing or implementing code changes:
>
> 1. [`docs/PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) — High-level architecture, bounded contexts, and canonical/operational separation.
> 2. [`docs/CURRENT_STATUS.md`](CURRENT_STATUS.md) — This document: baseline verification numbers, open work, and immutable designs.
> 3. [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — End-to-end subsystem mechanics, entity graphs, and derivation loops.
> 4. [`docs/SECURITY_INVARIANTS.md`](SECURITY_INVARIANTS.md) — The catalog of security, tenant, and fencing invariants that MUST NOT be weakened.
> 5. [`docs/DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md) — The strict audit-driven development protocol from spec freeze to verified tag.
> 6. Relevant ADRs in [`docs/adr/`](adr/) — Specifically:
>    - [ADR-001](adr/ADR-001-secret-store-boundary.md) (SecretStore non-exportable boundary)
>    - [ADR-002](adr/ADR-002-control-plane-authority.md) (Control plane authority & DB privileges)
>    - [ADR-003](adr/ADR-003-stage-execution-fencing.md) (Stage execution claims & fencing)
>    - [ADR-004](adr/ADR-004-runconfig-schema-role-binding.md) (RunConfig schema role bindings)
>    - [ADR-005](adr/ADR-005-audience-two-phase-hashing.md) (Audience two-phase hashing)
> 7. The relevant **Frozen Specification** file(s) for your assigned milestone.
>
> **CRITICAL CONSTRAINTS:**
> - **CANONICAL WORKSPACE**: The root of the active ContentOS Git repository.
>   Current local workspace on the owner's Mac: `/Users/elonstephen/Downloads/App/ContentOS`.
>   New coding platforms or clones must use their own repository root.
> - **Do not create additional Git worktrees or shadow repositories unless explicitly requested.**
> - **Never modify a `*_FROZEN.md` specification file.**
> - **Never weaken existing test assertions or remove security vectors.**
> - **Never create a verified tag without an independent external source audit.**

---

## 3. Verified Milestone Baseline Tags

The repository has established verified audit baselines across all preceding milestones:

| Milestone | Final Verified Tag | Commit SHA | Audit Scope / Major Closures |
|---|---|---|---|
| **M0** | `m0-v3-verified` | `a6efd6d8c0cf147f42b93b75489fba5abb508ff2` | Core logger boundaries, SecretStore, test database safety guard, AST dependency check |
| **M1** | `m1-v7-verified` | `53b0fc6d67a4a23bfc9c005a1c611d53c778d1bf` | Relational persistence, 76 adversarial vectors, unforgeable role & connection boundary |
| **M2** | `m2-v9-verified` | `10e2cade01b65a35200a1d5b06de6b527ebd4796` | Evidence & Epistemic engine, 76 adversarial vectors, standalone write authorization |
| **M3** | `m3-v9-verified` | `fcbce2d10737671a5e5832f5dc5017463a182526` | Policy DSL engine, 80 adversarial vectors, exact schema payload validation & AST bounds |
| **M4** | `m4-v1-verified` | `30ab5def8e2cab540c6811a8f577a995d188e10f` | Intelligence runtime, SPEC05 v1.0.5 two-phase hash, tenant-scoped claim, RunConfig closure |

---

## 4. Verification Baseline Numbers

As of commit `30ab5def8e2cab540c6811a8f577a995d188e10f` (tag `m4-v1-verified`), the test suite achieves 100% green execution across all verification surfaces:

| Verification Suite | Target Command | Result | Pass Rate |
|---|---|---|---|
| **Full Repository** | `npm test` | **PASS** | **882 / 882 tests** across 39 files |
| **Targeted M4 Suite** | `npm test -- m4` | **PASS** | **293 / 293 tests** across 18 files |
| **Stage Claim Focused** | `npm test -- src/tests/integration/m4-spec05-stage-claim-closure.test.ts` | **PASS** | **18 / 18 tests** (14 regression + 4 tenant-scoped) |
| **Live M0 Suite** | `npm test -- src/tests/integration/m0-` | **PASS** | **9 / 9 tests** across 2 files |
| **Live M1 Suite** | `npm test -- src/tests/integration/m1-` | **PASS** | **117 / 117 tests** across 3 files |
| **Live M2 Suite** | `npm test -- src/tests/integration/m2-` | **PASS** | **76 / 76 tests** across 1 file |
| **Live M3 Suite** | `npm test -- src/tests/integration/m3-` | **PASS** | **80 / 80 tests** across 1 file |
| **Live M4 Suite** | `npm test -- src/tests/integration/m4-` | **PASS** | **191 / 191 tests** across 7 files |
| **Live Total (M0–M4)** | Combined Live Integration Suites | **PASS** | **473 / 473 tests** |
| **TypeScript Typecheck** | `npx tsc --noEmit` / `npm run typecheck` | **PASS** | 0 errors |
| **Production Build** | `npm run build` | **PASS** | Exit code 0 |
| **Clean Migration Chain** | Direct apply `0000_...sql` to `0009_...sql` from scratch | **PASS** | 100% clean application, 0 errors |
| **Frozen SPEC05 SHA256** | `shasum -a 256 ContentOS_SPEC05_...v1.0.5_FROZEN.md` | **PASS** | `c8d645700d24091a4853e83b27f1a2e7218f6f4b3b83925a1541224c84e0eeaf` |

---

## 5. Standard Build and Test Commands

```bash
# Full test suite (all 39 test files)
npm test

# Fast TypeScript compile check without emitting files
npm run typecheck

# Full production TypeScript compilation
npm run build

# Focused M4 tests
npm test -- m4

# Live database integration suites by milestone
npm test -- src/tests/integration/m0-
npm test -- src/tests/integration/m1-
npm test -- src/tests/integration/m2-
npm test -- src/tests/integration/m3-
npm test -- src/tests/integration/m4-

# Focused StageExecution claim closure suite
npm test -- src/tests/integration/m4-spec05-stage-claim-closure.test.ts

# Run database migrations
npm run db:migrate
```

---

## 6. Architecture Foundations That Must NOT Be Redesigned

The following core components have undergone multi-round external security audits and are formally locked:

1. **SecretStore Isolation Boundary**:
   Domain code never receives raw secret strings. `SecretReference` opaque handles (defined in `src/domain/shared/types.ts`) are resolved only by transport/provider adapters at point-of-call via `ISecretStore` (`src/security/secrets/secret-store-interface.ts`, implemented by `EnvSecretStore` in `src/security/secrets/env-secret-store.ts`) (see [ADR-001](adr/ADR-001-secret-store-boundary.md)).
2. **Two-Phase Cryptographic Audience Derivation**:
   `canonical_input_hash` is computed over pre-provider inputs (`PreProviderManifestCore`) via `hashPreProviderManifestCore` (`src/domain/content/pre-provider-manifest-core.ts`) and locked into `StageExecution` upon atomic claim. `audience_admission_hash` is computed over post-provider admissions via `computeAudienceAdmissionHash` (`src/domain/content/audience-admission-validator.ts`). Neither hash is present in its own preimage, and neither hash replaces the other (see [ADR-005](adr/ADR-005-audience-two-phase-hashing.md)).
3. **StageExecution Atomic Claim & Distributed Fencing**:
   Workers claim stages using database-level `FOR UPDATE` locking. Security-sensitive tenant/workspace-owned reads, claims, locks, and commits must be scoped according to their ownership envelope (accounting for valid tenant-global or nullable-workspace entities where permitted). Identifiers are not authorization capabilities. An unexpired lease held by another worker blocks claimants; an expired lease may be taken over through authorized atomic claim, which increments `fencing_token` and `attempt_count` (rendering the old worker stale). Mismatched identity, scope, or hash fails closed (see [ADR-003](adr/ADR-003-stage-execution-fencing.md)).
4. **Exact RunConfig Normalized Ref Closure**:
   A `RunConfig` is uniquely defined by its runtime parameters and its exact normalized ref sets (`run_config_prompt_revisions`, `run_config_model_revisions`, `run_config_tool_revisions`, `run_config_schema_revisions`, `run_config_retriever_revisions`, `run_config_evaluator_revisions`). Row insertion ordering does not affect canonical hash identity.
5. **Typed Schema Role Bindings**:
   Role bindings (`CONTENT_INTELLIGENCE_AUDIENCE`) require exact 4-tuple schema membership (`run_config_id`, `entity_type`, `stable_id`, `revision_id`) in `run_config_schema_revisions` (see [ADR-004](adr/ADR-004-runconfig-schema-role-binding.md)).
6. **Relational Immutability Triggers**:
   PostgreSQL triggers prevent `UPDATE` or `DELETE` operations on canonical entities, immutable registries, and outbox event tables.
7. **Cycle Freeze Barrier (`FREEZING` / `FROZEN`)**:
   Once a `DecisionCycle` transitions to `FREEZING` or `FROZEN`, no new stage executions or knowledge delta commits can be claimed or accepted.

---

## 7. Known Open Work (Milestone M5 Scope)

Next milestone: **M5 / SPEC06**
State: **SPEC06 REVIEW / EXTERNAL SPEC AUDIT REQUIRED BEFORE IMPLEMENTATION**

- **Specification**: `ContentOS_SPEC06_Evaluation_Framework_v1.0.1_FROZEN.md`
- **SHA256**: `8a3c0420fefda8dfed367f55d86f3f81375c5c2bbc7bad4e0800247e31a9cb47`
- **Independent Specification Audit**: **NOT PROVEN** from repository evidence. An independent external audit of SPEC06 must be completed, recorded, and verified before implementation begins.
- **Core Milestone Scope (Pending Approved Audit)**:
  - Evaluation Contract modeling (`EvalContractRevision`).
  - Assertion Extraction: Deterministic decomposition of `ContentCandidate` text into verifiable assertions.
  - Evaluator Dispatch: Execution of deterministic rule-based evaluators, epistemic consistency checkers, metric scorers, and model-based evaluators.
  - Evaluation Admission & Scoring: Aggregation of individual scores, confidence intervals, and threshold checks.
  - Evaluation Gate Decision: Gate outcome formulation (`PASS`, `FAIL`, `REVIEW_REQUIRED`) for consumption by Milestone M7 (Decision Core).
  - Persistence & Fencing: Evaluation stage execution claims, evaluation result registries, and immutability triggers.

---

## 8. Exact Next Recommended Action

1. **Verify Baseline State**:
   Confirm working tree is clean at commit `30ab5def8e2cab540c6811a8f577a995d188e10f` on branch `m5-base`.
2. **Review & Audit SPEC06**:
   Conduct an independent external specification audit of `ContentOS_SPEC06_Evaluation_Framework_v1.0.1_FROZEN.md` (SHA256: `8a3c0420fefda8dfed367f55d86f3f81375c5c2bbc7bad4e0800247e31a9cb47`).
3. **Verify & Freeze Status**:
   Confirm that SPEC06 has no contradictions, underspecifications, or boundary bypasses. Record the audit PASS in repository documentation.
4. **Draft Implementation Plan**:
   Only after the specification audit passes, draft the Milestone M5 implementation plan delineating domain types, schema migrations, stage execution definitions, and evaluator ports.
5. **Execute Audited Implementation**:
   Follow [`docs/DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md) strictly.
