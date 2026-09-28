# Phase 06 — Locked Suites and Full Verification

## Context

- SPEC05 §§152–154A
- [Authority reverse mapping](./authority-bypass-matrix.md#locked-reverse-mapping)
- Existing serial Vitest and live PostgreSQL conventions

## Overview

- Priority: P0
- Status: Pending
- Goal: mechanical proof with exact locked cardinalities plus focused regression suites.

## Files

- Create `src/tests/integration/m4-spec05-80-vectors.test.ts` as thin live harness.
- Create eight `src/tests/integration/m4-vectors/m4-vectors-01-10.ts` … `71-80.ts`; no extra cases in locked catalog.
- Create `src/tests/unit/m4-spec05-32-preflight.test.ts` and four eight-check preflight catalogs.
- Create `src/tests/integration/m4-spec05-32-acceptance.test.ts` and four eight-criterion catalogs.
- Create focused `src/tests/unit/m4-*`, `src/tests/property/m4-*`, `src/tests/concurrency/m4-*`, `src/tests/failure_injection/m4-*` files outside locked catalogs.
- Create shared `src/tests/fixtures/m4-live-postgres-fixture.ts` and `m4-stage-authority-fixture.ts`.

## Exact locked tests

- Adversarial: exactly 80 named cases, one per §152 item, order/wording IDs `AV01`–`AV80`; catalog length assertion `=== 80`; live PostgreSQL for persistence/race vectors.
- Preflight: exactly 32 checks, one per §153 item, IDs `PF01`–`PF32`; catalog length `=== 32`; AST/text/schema/migration reachability checks, not duplicate runtime tests.
- Acceptance: exactly 32 criteria, one per §154 item, IDs `AC01`–`AC32`; catalog length `=== 32`; each cites mechanical evidence. AC31/32 require completed locked suite summaries.
- `skip`, `todo`, filtered runs, weakened assertions, and added locked blockers fail the harness.

## Focused suites

1. Gate truth-table/property equivalence and stable reason ordering.
2. Canonical serialization/hash properties and slot separation.
3. Atomic entity/registry/output/audit/outbox rollback.
4. Takeover/cancel/supersede/FREEZING/epoch/hash/lease races.
5. Prompt/tool/secret/cross-tenant/cache-key attackers; no external-effect adapter reachability.
6. Migration reapply, self-FK, registry guards, unit-position concurrency, role denial.
7. Rewrite/new-info/governance invalidation and read-only replay.

## Execution steps

1. `npm ci`; record lockfile integrity and tool versions.
2. Create/use disposable DB whose name contains `test`; apply `0000`–`0006` explicitly; never target non-test DB.
3. Run focused unit/property/concurrency/failure suites and exact locked files.
4. Run `npm run typecheck` and `npm run build`.
5. Start/verify Redis; run live `npm run test:integration`, then unfiltered `npm test` for the full repository.
6. Repeat race-sensitive M4 suites enough to expose flakiness; any flaky/failed/partial result is failure.
7. Retain command outputs, environment class, counts, and durations for P08; do not edit P08-owned evidence files here.

## Todo

- [ ] `80/80`, `32/32`, `32/32` exact
- [ ] Focused suites pass
- [ ] Live PostgreSQL pass
- [ ] Full repo with Redis pass
- [ ] Typecheck/build pass
- [ ] No skipped/flaky tests

## Success criteria

- Every required command exits zero from a fresh install and disposable live database.
- Existing M0–M3 locked suites remain unchanged and pass.
- Tests fail when each enforcement layer is deliberately bypassed; no self-fulfilling mock-only proof.

## Risks and security

- Destructive setup must parse DB name and reject any without `test` before connection/drop.
- Serial shared-state tests use unique IDs and explicit prerequisites, never prior test residue.

## Next

- P07 attacks the passing implementation independently.

## Unresolved questions

- None.
