# Phase 02 — Fenced Persistence and Migration

## Context

- SPEC05 §§88–96, 112–128
- Existing `stage-fencing-coordinator.ts`, registries, StageExecution, audit, outbox
- [Scout migration findings](./reports/codebase-scout-report.md)

## Overview

- Priority: P0
- Status: Pending
- Goal: one reusable short-transaction authority boundary for every M4 canonical write.

## Files

- Modify exclusively: `src/persistence/relational/services/stage-fencing-coordinator.ts`.
- Create: `content-stage-execution-repository.ts`, `content-runtime-transaction-context.ts`, `content-runtime-reference-loader.ts`.
- Create: `content-runtime-idempotency-repository.ts`, `content-runtime-audit-writer.ts`, `content-runtime-outbox-writer.ts`, `content-runtime-registry-writer.ts`.
- Modify: `src/persistence/relational/schema/content.ts` only for frozen self-reference/index parity.
- Create: `src/persistence/relational/migrations/0006_m4_content_intelligence_invariants.sql`.

## Migration design

- Idempotent, breakpoint-separated forward SQL; no new table/entity/column.
- Add self-FKs for `content_architectures.supersedes_architecture_id` and `content_candidates.parent_candidate_id`.
- Add immutable-registry guard coverage for ContentArchitecture and ContentUnit.
- Add DB enforcement for unambiguous unit position per architecture using an immutable-safe constraint trigger.
- Add only required indexes/role grants/revokes supporting exact refs and insert-only M4 roles.
- Explicit live setup applies `0000`–`0006`; do not edit old migrations or journal.

## Implementation steps

1. Extend fencing input with exact run ID, cycle epoch, stage name, hash, and idempotency key.
2. In one transaction lock/reload Run, current DecisionCycle, and StageExecution; verify all matrix conjunctions and M4 stage allowlist.
3. Reject standalone mode for M4 commits; retain existing generic standalone behavior for M0–M3 callers.
4. Claim/reload exact StageExecution identity; same key+same hash returns recorded outputs, same key+changed hash conflicts.
5. Make slots part of identity/hash while keeping them operational.
6. Centralize same-transaction immutable registry, output refs, audit event, and outbox insert helpers.
7. Ensure failures roll back entity graph and outbox together; provider calls are impossible from helpers.
8. Add/apply/reapply/rollback-test `0006` on disposable PostgreSQL; synchronize Drizzle declarations where representable.

## Todo

- [ ] Dual fence closes cycle/stage/run/hash gaps
- [ ] Exact retry versus distinct slot proven
- [ ] Atomic registry/output/audit/outbox helpers
- [ ] `0006` idempotent and role-safe
- [ ] No regression to old standalone callers

## Success criteria

- Old token/epoch/cycle/stage/hash cannot commit; FREEZING/cancel/supersession reject.
- Concurrent exact slot yields one canonical effect and one atomic outbox event.
- Migration works twice, has no frozen schema expansion, and live tests can apply full forward chain.

## Risks and security

- Lock order is Run → Cycle → StageExecution → referenced rows to avoid deadlocks.
- Trigger functions must set fixed `search_path`, schema-qualify objects, and not trust caller-controlled SQL identifiers.
- If self-FK would reject valid pre-existing rows, migration must preflight and fail with diagnostics, never delete/repair history.

## Next

- P03 uses these helpers; no service may hand-roll weaker authority.

## Unresolved questions

- None; deployment journal parity is tracked in the final mechanically-unproven report, outside M4 migration mutation scope.
