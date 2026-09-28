# Phase 05 — Candidate Runtime and SPEC06 Boundary

## Context

- SPEC05 §§53–151
- Authority matrix candidate/rewrite/handoff rows

## Overview

- Priority: P0
- Status: Pending
- Goal: provider-outside-transaction orchestration, immutable candidates, and a hard SPEC06 boundary.

## Files

- Create provider port: `src/providers/models/content-intelligence-provider.ts`, `pinned-provider-request.ts`, `provider-result-validation.ts`.
- Create application: `content-generation-context-builder.ts`, `generate-content-candidate.ts`, `rewrite-content-candidate.ts`, `content-intelligence-runtime.ts`, `spec06-handoff-port.ts`.
- Create persistence: `content-candidate-persistence-service.ts`, `candidate-lineage-reader.ts`, `content-runtime-replay-service.ts`.
- Create workflow: `src/workflow/stages/content-intelligence/stage-executor.ts` plus small stage-specific handlers.
- Modify exclusively: `src/bootstrap/composition-root.ts` to inject the provider port and expose M4 runtime.
- No `src/api/server.ts` change.

## Architecture

```text
claim stage → load/authorize exact immutable refs → build four-layer manifest
→ call injected pinned provider outside SQL → validate proposal
→ short dual-fenced idempotent commit + audit/outbox → typed SPEC06 handoff
```

No cache in initial M4 implementation (YAGNI); identity design remains cache-safe. Provider selection is composition-root injection constrained by exact RunConfig revisions; absence fails, never falls back to ambient config.

## Implementation steps

1. Provider request accepts serialized control/canonical/untrusted/style layers, exact config refs, allowed tools, schema, hash; exposes no DB or effectful publication/control-plane adapter.
2. Context builder includes exact Task/final audience/strategy/architecture/units/epistemic/applicability/guidance/admitted source/RunConfig refs; minimize without dropping constraints.
3. Validate candidate parse/schema/format/channel/meaning/closure before transaction.
4. Commit exactly one candidate per `variantSlot`; changed input under same key conflicts; distinct declared slots remain distinct.
5. Rewrites always use new ID, explicit parent, actual current refs, and no inherited validation/release state. Factual human/evaluator input routes upstream.
6. Provider timeout permits exact retry or already-pinned fallback only; malformed/exhausted output stores no canonical candidate.
7. Replay reads stored payload/lineage only. A separately named reproduction path, if needed later, is out of M4 YAGNI scope.
8. Handoff verifies persisted closure and emits only candidate/context DTO/event. Do not create ContentAssertion, links, validation, qualitative/risk/readiness state.
9. Wire audience/strategy/gate/architecture/candidate stage handlers through one executor with renewed authority check at commit.

## Todo

- [ ] Four-layer minimized context
- [ ] Exact pinned provider boundary
- [ ] Candidate slot idempotency and immutable rewrite
- [ ] No side-effect capability
- [ ] Replay is read-only
- [ ] SPEC06 handoff DTO/event only

## Success criteria

- AV41–80 behavior is enforceable; provider latency never holds a DB transaction.
- No route from generation to publication, messaging, ads, external account, Control Plane, or SPEC06 persistence.
- Candidate/outbox/registry/output refs are atomic and audit-traversable.

## Risks and security

- Model JSON is hostile even when schema-valid; reload every referenced ID and recheck scope/closure.
- Logs record refs/hashes/result class, not full prompts, secrets, or private source bodies.

## Next

- P06 proves all contracts against live infrastructure and static boundaries.

## Unresolved questions

- None; vendor-specific adapters are intentionally not invented by SPEC05.
