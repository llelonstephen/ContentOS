# Phase 04 — Architecture and Supplemental Proof

## Context

- SPEC05 §§41–52, 90, 97–101, 125, 148
- v1.0.1 patch closure: supplemental factual proof and minimized explicit context

## Overview

- Priority: P0
- Status: Pending
- Goal: create immutable Architecture/Unit graphs only from an exact admitted strategy.

## Files

- Create persistence: `content-architecture-persistence-service.ts`, `architecture-context-reference-resolver.ts`, `supplemental-proposition-state-resolver.ts`.
- Create application: `generate-content-architecture.ts`, `classify-architecture-material-change.ts`.

## Implementation steps

1. Verify exact `PROCEED` gate execution, strategy/audience/task/cycle/hash/RunConfig closure.
2. Build an allowlisted context manifest; expose values/refs, never a SQL client/repository/datastore handle, to the provider layer.
3. Enforce tenant/workspace/DataScope, decision relevance, attribution, source-use admission, and secret exclusion per item.
4. Validate structured architecture and units: exact task/strategy, unique deterministic position, channel format, separated copy/visual/audio goals.
5. Resolve each unit proposition. For supplemental factual proof require exact decision-time state and status not `CONTRADICTED`/`INSUFFICIENT`.
6. Preserve unknowns; if a supplemental proposition changes core message/proof/behavior/risk/governance, reject architecture and require new Strategy + gate.
7. In one short fenced transaction insert/register Units, Architecture, links, StageExecution refs, audit, and outbox.
8. Rewrite architecture through new ID and optional frozen supersedes reference only; exact retry converges via `architectureSlot`.

## Todo

- [ ] No unrestricted datastore reaches generation
- [ ] Gate/task/strategy closure exact
- [ ] Unit order and channel support exact
- [ ] Supplemental proof rule exact
- [ ] Material hidden-strategy change rejected
- [ ] Atomic immutable graph persistence

## Success criteria

- AV31–40,64,67,72–74 semantics enforced.
- All context entries reconstruct to canonical/pinned refs and authorized scope.
- Duplicate order fails in domain and migration-backed persistence checks.

## Risks and security

- Provider payload proposition IDs are untrusted IDs, not capabilities; reload and scope-check them in commit transaction.
- Do not use broad repository methods to “help” architecture generation.
- Never reinterpret Guidance as a hard rule or hard rule as Guidance.

## Next

- P05 realizes exact architecture as candidates.

## Unresolved questions

- None.
