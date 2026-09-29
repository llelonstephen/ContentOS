# ADR-005: SPEC05 Two-Phase Audience Hashing Protocol

## Status
Accepted (Milestone M4)

## Context
Under earlier draft iterations of SPEC05, ambiguity existed regarding when and how inputs and outputs of content intelligence stages (such as Audience derivation) were hashed. If a single composite hash was calculated only after external model generation, the pre-provider execution envelope (task contract, run config, eligible facts, schema binding) was not cryptographically bound prior to calling the untrusted provider. Conversely, if only pre-provider inputs were hashed, post-provider semantic admissions, projection outputs, and fact basis selections lacked cryptographic binding to the committed authority.

Furthermore, loose descriptions risked implying circular or self-referential hashing (e.g., hashing a structure that contains its own computed hash field).

## Decision
We enforce a strict **Two-Phase Hashing Protocol** as mandated by `ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.5_FROZEN.md` (§91, §92, §112, §113):

```text
================================================================================
PHASE 1: PRE-PROVIDER INPUT ENVELOPE
================================================================================
Inputs:
  TaskContractRevision, exact RunConfig normalized ref sets,
  CONTENT_INTELLIGENCE_AUDIENCE role binding, Audience Knowledge Cutoff,
  eligible task audience context, eligible epistemic proposition refs,
  retriever/evaluator refs, provider context hash
       │
       ▼
Construct PreProviderManifestCore (in-memory reconstructable DTO)
       │
       ▼  Canonical deterministic serialization (serializePreProviderManifestCore)
       │  Function: hashPreProviderManifestCore()
       ▼
canonical_input_hash
  * CRITICAL INVARIANT: canonical_input_hash is pre-provider only.
  * canonical_input_hash MUST NOT be present in its own preimage.
       │
       ▼
StageExecution atomic claim locks canonical_input_hash into DB (claimContentStageExecution)

================================================================================
PHASE 2: POST-PROVIDER SEMANTIC ADMISSION
================================================================================
External Model Output (untrusted Audience proposal)
       │
       ▼
Deterministic Semantic Projection & Admission Validation:
  - Collect generated factual leaves against schema classification rules
  - Materialize fact basis links (TASK_AUDIENCE_CONTEXT or AUDIENCE_EPISTEMIC_STATE)
  - For epistemic state basis: bind projection rule, projection inputs,
    projected PropositionSemanticIdentity, and evaluateSemanticEquivalence outcome
       │
       ▼  Deterministic canonical admission serialization
       │  Function: computeAudienceAdmissionHash()
       ▼
audience_admission_hash
  Computed over:
    trusted normalized Audience proposal
    + factual leaves
    + exact basis links
    + projection rule identity
    + projection inputs
    + projected PropositionSemanticIdentity
    + SPEC03 equivalence outcome
    + exact linked proposition
    + canonical_input_hash
    + required scope/config identity
  * CRITICAL INVARIANT: audience_admission_hash MUST NOT be present in its own preimage.

================================================================================
PHASE 3: COMMIT-TIME SERVER-SIDE REVALIDATION
================================================================================
In PostgresAudienceStateCommitPort:
  1. Re-read trusted records directly from the database within the commit transaction.
  2. Recompute canonical_input_hash from DB records; assert == StageExecution.canonical_input_hash.
  3. Recompute audience_admission_hash; assert == precommit audience_admission_hash.
  4. Write AudienceState, FactBasisLinks, and DerivationAuthority records.
  5. Transition StageExecution to COMPLETED.
```

### Role of Legacy `derivation_manifest_hash`
The database schema retains the column `derivation_manifest_hash` alongside `canonical_input_hash` and `audience_admission_hash` for backwards schema compatibility. In earlier milestones, `hashAudienceDerivationManifest` computed a hash over an interim manifest DTO (excluding `derivation_manifest_hash` from its own preimage). In SPEC05 v1.0.5, authoritative cryptographic derivation and admission fencing is governed strictly by the two-phase separation of `canonical_input_hash` (§113) and `audience_admission_hash` (§113.1); `derivation_manifest_hash` serves as legacy structural metadata and does not replace either authoritative hash.

## Security/Correctness Properties
- **No Self-Referential Hashing**: Neither `canonical_input_hash` nor `audience_admission_hash` includes its own hash field in its preimage serialization.
- **Strict Role Separation**:
  - `canonical_input_hash` answers: *"Exactly what canonical input state was supplied to this generation attempt?"*
  - `audience_admission_hash` answers: *"Exactly what generated Audience proposal plus canonical authority was validated for canonical admission?"*
- **Tamper Evidence**: In-flight changes to prompt configs, models, task revisions, or cutoff dates between claim and commit cause immediate transaction failure.
- **Traceable Basis Links**: An audience state cannot be persisted without cryptographic proof of its admitted epistemic basis links and projection rules.
- **Independent Replay Fidelity**: Historical provider output is recorded and admitted such that its authority can be revalidated without relying on a new provider call.

## Rejected Alternatives
- **Single Composite Post-Provider Hash**: Combining inputs and outputs into a single hash computed after provider execution. Rejected because it fails to fence the stage execution claim with the input envelope prior to calling external providers (§113.2).
- **Mutating canonical_input_hash Post-Provider**: Modifying `StageExecution.canonical_input_hash` after generation to include output hashes. Rejected because StageExecution inputs are immutable once claimed.

## Consequences
- The application orchestrator (`DeriveAudienceState`) coordinates two distinct hashing phases.
- The commit port enforces full server-side reconstruction of both hashes, rejecting caller-supplied or forged hashes.

## Related Specs/Tags
- `ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.5_FROZEN.md` (§91, §92, §112, §113, §113.1, §113.2, §113.3)
- Tag: `m4-v1-verified`
