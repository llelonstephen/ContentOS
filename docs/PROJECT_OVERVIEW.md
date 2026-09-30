# ContentOS — Project Overview

## 1. Executive Summary

**ContentOS** is an **Evidence-Grounded Content Operating System** implementing the formal specifications defined in the ContentOS Blueprint. Its core mission is to enable deterministic, audit-traceable, and evidence-grounded content intelligence, strategy formulation, candidate generation, evaluation, governance, and publication for high-stakes enterprise applications.

Unlike conventional prompt-engineering or raw generative AI pipelines that treat large language models (LLMs) as authoritative decision-makers, ContentOS treats external models strictly as **untrusted proposal generators**. All state assertions, epistemic qualifications, governance constraints, and decision policies are enforced through **first-class relational invariants**, **cryptographic content hashing**, **immutable append-only audit registers**, and **deterministic semantic boundaries**.

---

## 2. High-Level Purpose and Core Tenets

ContentOS is engineered around five fundamental tenets:

1. **Evidence Grounding over Generative Hallucination**:
   Canonical factual assertions must have an eligible typed basis appropriate to the stage and frozen specification. For Audience derivation under SPEC05, this includes an exact `TASK_AUDIENCE_CONTEXT` basis or an exact `AUDIENCE_EPISTEMIC_STATE` basis closing through canonical `Proposition` / `EpistemicStateVersion` authority.
2. **Untrusted Model Boundary**:
   External AI models (LLMs, embeddings, generative multi-modal systems) never possess authority to write directly to canonical state or mutate system metadata. They propose candidate structures that must survive rigorous admission gates, semantic projection rules, schema role bindings, and governance policy engines.
3. **Deterministic, Reproducible Replay**:
   Historical runs and decision cycles can be audited, replayed, and verified against the exact immutable revisions of code, configurations, schemas, and governance rules that were active at the execution cutoff time—without relying on model non-determinism.
4. **Strong Tenant and Workspace Isolation**:
   Security-sensitive entities, reads, claims, locks, and commits are scoped according to their frozen ownership envelope. Tenant/workspace-owned records require exact tenant/workspace scope, while tenant-global or nullable-workspace records remain valid only where the frozen data model explicitly permits them. Identifiers are never authorization capabilities.
5. **Fail-Closed Security Posture**:
   Mismatched identity, scope, or hash fails closed; stale fencing tokens fail closed; and unrecognized authority or ambiguous configurations fail closed. An expired lease by itself is not an error; it may be taken over through the authorized atomic claim path (incrementing `fencing_token` and `attempt_count`, and making the old worker stale).

---

## 3. Major Bounded Contexts and Modules

The system is structured as a **Modular Monolith** adhering strictly to hexagonal / clean architecture:

```text
       ┌────────────────────────────────────────────────────────┐
       │                       API Layer                        │
       │           (Fastify, HTTP REST, Request Validation)      │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                   Application Layer                    │
       │   (Orchestrators, Stage Pipelines, Workflows, Ports)   │
       └───────────────────────────┬────────────────────────────┘
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
       ┌───────────────────────────┐ ┌──────────────────────────┐
       │       Domain Layer        │ │  Infrastructure Adapters │
       │  (Pure Business Logic,    │ │  (Postgres, Object Store,│
       │   Rules, Invariants, ASTs)│ │   Redis/BullMQ, Secrets) │
       └───────────────────────────┘ └──────────────────────────┘
```

The primary bounded contexts are:

- **Control Plane & Registries (`src/domain/control_plane`, `src/persistence/relational/schema/registries.ts`)**:
  Manages immutable entity registrations (`ImmutableEntityRegistry`), versioned revision registrations (`RevisionRegistry`), and registered payload stores. Houses `TaskContractRevision`, `MetricDefinitionRevision`, `SchemaDefinition`, `ContentProgramRevision`, and `EvalContractRevision`.
- **Evidence & Epistemic Engine (`src/domain/knowledge`, `SPEC03`)**:
  Maintains verified `EvidenceItem` records, `Proposition` graphs, `EvidencePropositionLink` assessments, and monotonic `EpistemicStateVersion` progressions. Computes factual support status (`SUPPORTED`, `INSUFFICIENT`, `CONTRADICTED`, `UNKNOWN`) and causal qualifications.
- **Governance & Policy Engine (`src/domain/governance`, `SPEC04`)**:
  Applies `NormativeRuleRevision`, `DecisionPolicyRevision`, and `GuidanceRevision` over frozen `GovernanceSnapshot` closures using a deterministic AST policy language (Policy DSL). Detects conflicts, evaluates overrides, and binds policy results immutably to decisions.
- **Content Intelligence Runtime (`src/domain/content`, `src/application/content-intelligence`, `SPEC05`)**:
  Executes the creative derivation runtime across `AudienceState`, `StrategyHypothesis`, `StrategyGate`, `ContentArchitecture`, and `ContentCandidate`. Enforces two-phase cryptographic hashing, semantic projection rules, and schema role bindings.
- **Durable Workflow & Fencing (`src/workflow`, `src/persistence/relational/services`)**:
  Coordinates distributed stage claims, lease timeouts, atomic renewals, heartbeat fencing tokens, and cycle freeze barriers across concurrent worker processes.
- **Evaluation Framework (`SPEC06`, Milestone M5)**:
  Assesses generated content candidates against task contracts, quality criteria, safety boundaries, and quantitative metric definitions.
- **Decision Core & Publication (`SPEC09`, `SPEC10`, Milestones M7–M9)**:
  Produces immutable `DecisionRecord` packages, manages multi-channel publication adapters with cryptographic outbox receipts, and ingests post-release measurement feedback loops.

---

## 4. Architectural Philosophy: Canonical vs. Operational State

ContentOS enforces a strict ontological separation between **Canonical State** and **Operational State**:

### Canonical State (Immutable, Authoritative)
- Represents immutable domain truths, historical decisions, verified knowledge, and cryptographically pinned revisions.
- Backed by relational tables with PostgreSQL triggers preventing `UPDATE` and `DELETE`.
- Key entities: `TaskContractRevision`, `EvidenceItem`, `Proposition`, `EpistemicStateVersion`, `GovernanceSnapshot`, `PolicyResult`, `DecisionRecord`, `AudienceState`, `StrategyHypothesis`, `ContentArchitecture`, `ContentCandidate`.
- Every canonical entity has an entry in `immutable_entity_registry` or `revision_registry`.
- Payloads in object storage are addressed strictly by SHA256 content hash (`objects/<hash>`).

### Operational State (Ephemeral, Mutable Execution Coordination)
- Coordinates work execution, concurrent leasing, worker heartbeats, and transactional queues.
- Mutable within strict transactional bounds governed by fencing tokens and epochs.
- Key entities: `runs`, `decision_cycles`, `stage_executions`, `distributed_leases`, `outbox_events`.
- Transitioning operational state to canonical state requires an atomic locking transaction that verifies active fencing tokens before inserting canonical rows and completing the stage.

---

## 5. The Decision-Cycle Model

All system operations occur within the hierarchical lifecycle of a **Run**, a **DecisionCycle**, and individual **StageExecutions**:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ Run (run_id, status: RUNNING, pinned run_config_id, task_revision_id)   │
 │                                                                        │
 │   ┌────────────────────────────────────────────────────────────────┐   │
 │   │ DecisionCycle (cycle_number: 1, fencing_epoch: 1, status: OPEN) │   │
 │   │                                                                │   │
 │   │   ┌────────────────────────────────────────────────────────┐   │   │
 │   │   │ StageExecution: AUDIENCE_FINALIZE                      │   │   │
 │   │   │ (lease_owner, fencing_token: 1, canonical_input_hash)  │   │   │
 │   │   │                                                        │   │   │
 │   │   │ 1. Atomic claim & lease allocation                     │   │   │
 │   │   │ 2. Pre-provider manifest hash verification             │   │   │
 │   │   │ 3. External provider proposal generation               │   │   │
 │   │   │ 4. Post-provider semantic admission & fact links       │   │   │
 │   │   │ 5. Atomic persist & StageExecution COMPLETED           │   │   │
 │   │   └────────────────────────────────────────────────────────┘   │   │
 │   │                                                                │   │
 │   │   [Cycle transitions to FREEZING → FROZEN before decision]     │   │
 │   └────────────────────────────────────────────────────────────────┘   │
 └────────────────────────────────────────────────────────────────────────┘
```

1. **Run**: Root execution envelope for a task contract revision, binding an immutable `RunConfig` and initialization cutoff timestamp.
2. **DecisionCycle**: An iteration within a run (e.g., initial attempt, revision after feedback, or failure recovery). Carries a strictly monotonic `fencing_epoch`. When state collection terminates, the cycle transitions to `FREEZING` and then `FROZEN`, blocking any late knowledge or stage commits.
3. **StageExecution**: A single atomic step (e.g., `AUDIENCE_FINALIZE`, `STRATEGY_GENERATE`). Claimed with a unique `idempotency_key`, bound to a `lease_owner`, guarded by a `fencing_token`, and bound to an immutable `canonical_input_hash`.

---

## 6. How Specifications Relate to Implementation

ContentOS is specification-driven. The codebase does not treat Markdown specifications as informal guidance or design notes; rather, **frozen specifications are the normative contract**.

- **Spec Hierarchy**:
  1. `ContentOS_Blueprint_v2.13.1_FROZEN.md`: System-wide master architecture.
  2. `ContentOS_SPEC01_System_Architecture_v1.1.3_FROZEN.md`: Modular structure, dependency rules, technology choices.
  3. `ContentOS_SPEC02_Domain_Data_Model_v1.0.6_FROZEN.md`: Entity schemas, relational layouts, immutability triggers.
  4. `ContentOS_SPEC03_Evidence_Proposition_Epistemic_State_v1.0.1_FROZEN.md`: Knowledge graph, epistemic scoring.
  5. `ContentOS_SPEC04_Governance_Policy_Engine_v1.0.2_FROZEN.md`: Policy DSL, conflict resolution, overrides.
  6. `ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.5_FROZEN.md`: Intelligence runtime, two-phase hashing, audience derivation.
  7. `ContentOS_SPEC06_Evaluation_Framework_v1.0.2_FROZEN.md`: Content evaluation and gate admission.
  8. `ContentOS_SPEC07_Measurement_Experimentation_Learning_v1.0_FROZEN.md`: Post-publication learning.
  9. `ContentOS_SPEC08_Security_Privacy_Rights_v1.0.1_FROZEN.md`: RBAC, secret storage, rights enforcement.
  10. `ContentOS_SPEC09_V1A_Decision_Core_v1.0_FROZEN.md`: End-to-end V1A decision core execution.
  11. `ContentOS_SPEC10_V1B_Learning_Closure_v1.0_FROZEN.md`: End-to-end V1B feedback and learning closure.

### Normative Precedence Rules
- In any conflict between code and a frozen spec, **the frozen spec governs**.
- Code changes must never alter frozen specifications without formal specification revision and re-audit.
- A test failure against a frozen specification vector indicates an implementation defect, not a specification flaw.

---

## 7. Current Milestone Progression

| Milestone | Title | Status | Baseline Verified Tag |
|---|---|---|---|
| **M0** | Core Infrastructure, Toolchain, Registries | **VERIFIED** | `m0-v3-verified` |
| **M1** | Relational Persistence & Adversarial Schema (76 vectors) | **VERIFIED** | `m1-v7-verified` |
| **M2** | Evidence, Proposition & Epistemic State Engine (76 vectors) | **VERIFIED** | `m2-v9-verified` |
| **M3** | Governance & Policy Engine (80 vectors, Policy DSL) | **VERIFIED** | `m3-v9-verified` |
| **M4** | Content Intelligence Runtime (SPEC05 v1.0.5, Two-Phase Hashing) | **VERIFIED** | `m4-v1-verified` |
| **M5** | Evaluation Framework & Multi-Metric Assessment (SPEC06) | **SPEC FROZEN / IMPLEMENTATION PENDING** | SPEC06 v1.0.2 audited (PASS); implementation pending |
| **M6** | Security, Privacy, Rights & RBAC Enforcement (SPEC08) | PENDING | — |
| **M7** | V1A Decision Core (SPEC09) | PENDING | — |
| **M8** | Measurement & Experimentation (SPEC07) | PENDING | — |
| **M9** | V1B Learning Closure (SPEC10) | PENDING | — |
| **M10**| Full System Integration & Production Audit | PENDING | — |

The system currently sits at **M4 VERIFIED** (`m4-v1-verified`), with a 100% green test suite (882/882 tests) across all production databases, triggers, and runtime invariants. SPEC06 v1.0.2 is frozen and externally audited (PASS); development is positioned to commence **Milestone M5 implementation planning**.
