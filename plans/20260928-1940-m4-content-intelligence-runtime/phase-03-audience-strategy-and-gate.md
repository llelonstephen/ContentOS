# Phase 03 — Audience, Strategy, and Deterministic Gate

## Context

- SPEC05 §§7–40, 91–99, 123–124
- Existing unknown-preservation and governance services
- Existing `strategy-knowledge-gate-service.ts` remains compatible for M2 callers

## Overview

- Priority: P0
- Status: Pending
- Goal: admit immutable audience/strategy state and a complete deterministic Strategy Gate.

## Files

- Create persistence: `audience-state-persistence-service.ts`, `strategy-hypothesis-persistence-service.ts`, `content-strategy-gate-input-resolver.ts`, `content-strategy-gate-persistence-service.ts`.
- Create application: `derive-audience-state.ts`, `generate-strategy-hypothesis.ts`, `execute-deterministic-strategy-gate.ts`.
- Do not modify or repurpose M2's `strategy-knowledge-gate-service.ts`; compose/reuse knowledge primitives where semantics match.

## Implementation steps

1. Load only explicit tenant/workspace-authorized task/program/channel/knowledge/gap/epistemic/governance/RunConfig refs.
2. Validate provider proposal outside SQL; commit AudienceState with origin, uncertainty, exact stage and task binding.
3. On audience material dependency changes, require governance refresh evidence before `FINAL_FOR_DECISION` admission.
4. Generate strategy only from exact final audience; validate every factual premise maps to required proposition or explicit assumption/unknown.
5. Commit StrategyHypothesis plus required-proposition links atomically; retries converge by `strategySlot`.
6. Resolve terminal gaps, exact decision-time state IDs, PRE_GENERATION_FINAL assessments, hard-rule overrideability, and pinned context into a complete gate input manifest.
7. Reject omitted canonical gaps/propositions/assessments and any caller attempt to weaken persisted requirements.
8. Run pure gate; persist StageExecution outcome/output refs and append-only audit/outbox reason metadata. Do not add canonical gate state.
9. Permit architecture path only on exact `PROCEED` for matching strategy/audience/hash/config/cycle.

## Gate outcome policy

- `BLOCKED`: deterministic hard failure—blocking gap, absent/contradicted/insufficient factual proof, hard non-overridable rule, identity/scope mismatch.
- `HUMAN_REVIEW_REQUIRED`: frozen rules explicitly allow judgment for unresolved non-hard uncertainty/review-required applicability.
- Any unclassified missing/contradictory input fails closed; never infer `PROCEED`.

## Todo

- [ ] Audience derivation/finalization atomic and immutable
- [ ] Governance refresh dependency enforced
- [ ] Strategy grounding and slot idempotency
- [ ] Exact gate input resolver
- [ ] Stable deterministic gate audit result

## Success criteria

- AV01–30 behavior is implementable without hidden/live lookup.
- Gate result/reasons repeat for identical exact inputs.
- No architecture service can accept block/review or a result from another cycle/hash.

## Risks and security

- Temporal `ORDER BY` is allowed only inside explicit cutoff/valid-time resolution; selected IDs enter the manifest. No ambient “latest” helper.
- Caller-provided lists may add scrutiny but cannot omit/override canonical requirements.

## Next

- P04 consumes only exact admitted gate output.

## Unresolved questions

- None.
