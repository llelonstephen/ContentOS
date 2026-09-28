# Phase 01 — Pure Domain Contracts

## Context

- [Authority/bypass matrix](./authority-bypass-matrix.md)
- SPEC05 §§7–122, 131–151
- Existing dependency guard: `src/tests/unit/m0-dependency-direction.test.ts`

## Overview

- Priority: P0
- Status: Pending
- Goal: small infrastructure-free modules that make frozen semantics executable.

## Architecture

`src/domain/content/**` owns shapes and deterministic decisions only. It imports no persistence, workflow, provider, API, events, security, or observability code. Every file targets <200 lines; split catalogs/validators by concern.

## Files

- Create: `types.ts`, `runtime-stage-contracts.ts`, `content-error-codes.ts`, `canonical-input-serialization.ts`, `request-identity.ts`.
- Create: `audience-state-validator.ts`, `strategy-grounding-validator.ts`, `deterministic-strategy-gate.ts`.
- Create: `architecture-closure-validator.ts`, `supplemental-proposition-admission.ts`, `candidate-closure-validator.ts`.
- Create: `generation-context-trust-boundary.ts`, `meaning-preservation-validator.ts`, `dependency-invalidation.ts`, `spec06-handoff-contract.ts`, `index.ts`.

## Implementation steps

1. Define frozen entity input/output views without duplicating persistence schemas.
2. Define exact stage names, allowed entity output kinds, `strategySlot`/`architectureSlot`/`variantSlot`, and stable reason codes.
3. Serialize deterministic manifests with explicit version, ordered tuple fields, normalized timestamps, set sorting only for semantic sets, and preserved ContentUnit order.
4. Derive idempotency identity from tenant/workspace/run/cycle/stage/slot/exact refs/RunConfig/hash; never time/random/provider output.
5. Validate audience stage/task/origin/uncertainty and append-only transitions.
6. Validate strategy factual bases, explicit assumptions/unknowns, and required proposition completeness.
7. Implement pure gate truth table: missing/contradictory/insufficient/blocking/hard-governance input cannot `PROCEED`; stable ordered reasons.
8. Validate architecture task/strategy/order/channel/proposition closure and v1.0.1 supplemental-proof/material-change rule.
9. Validate candidate task/strategy/architecture/RunConfig/payload/parent closure and no inherited authority.
10. Represent four trust layers and deny secrets/tool escalation/external-effect instructions.
11. Classify material changes requiring governance refresh/new strategy/new architecture/new candidate/successor cycle.
12. Define SPEC06 handoff DTO only; exclude assertion/evaluation/readiness types.

## Todo

- [ ] Deterministic serializers and identities
- [ ] Audience/strategy/gate contracts
- [ ] Architecture/candidate contracts
- [ ] Trust and invalidation contracts
- [ ] SPEC06 boundary DTO
- [ ] Focused pure unit/property tests authored outside locked counts

## Success criteria

- Identical inputs yield byte-identical serialization/hash inputs and semantically identical gate outcome/reasons.
- Every fail-closed class returns a stable code; no domain dependency violation.
- No file exceeds 200 lines without documented split rationale.

## Risks and security

- Sorting ordered units corrupts meaning; array semantics must be explicit per field.
- Hashes support audit/idempotency but never replace exact refs.
- Regex-only prompt defense is insufficient; trust layers are typed/serialized separately.

## Next

- P02 binds pure contracts to dual-fenced transactions.

## Unresolved questions

- None.
