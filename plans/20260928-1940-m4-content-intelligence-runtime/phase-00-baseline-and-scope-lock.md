# Phase 00 — Baseline and Scope Lock

## Context

- [Plan](./plan.md)
- [Authority/bypass matrix](./authority-bypass-matrix.md)
- [Scout report](./reports/codebase-scout-report.md)

## Overview

- Priority: P0
- Status: Pending
- Goal: prove starting authority and freeze an implementation allowlist before production edits.

## Requirements

- `HEAD` must equal `fcbce2d10737671a5e5832f5dc5017463a182526`; `m3-v9-verified` points there.
- Existing non-plan worktree changes block implementation; do not reset or overwrite them.
- Record SHA-256 for all 11 frozen files; implementation must not edit them.
- Bind implementation to the already-created standalone authority matrix.
- Scope excludes SPEC06 entities/behavior, public APIs, publication, measurement, learning, and Control Plane mutation.

## Implementation steps

1. Capture `git status`, branch, HEAD, tags, baseline ancestry, Node/npm/PostgreSQL/Redis versions.
2. Hash frozen Blueprint/SPEC files into the phase evidence report.
3. Inventory allowed M4 paths from Phases 01–08; flag any later diff outside the allowlist.
4. Confirm no `StrategyGateResult` schema/table and no proposed canonical field/table.
5. Confirm the migration choice: one idempotent manual forward `0006`; no M2–M3 journal rewrite.
6. Confirm M4 write mode is decision-cycle only and operational slots are StageExecution inputs.

## Files

- Read only: repository, frozen specs, existing migrations/schema/services.
- Create during execution: `reports/m4-baseline-scope-lock.md`.
- Do not modify production code in this phase.

## Todo

- [ ] Exact baseline/tag verified
- [ ] Worktree collision check passed
- [ ] Frozen checksums recorded
- [ ] Scope allowlist recorded
- [ ] Matrix accepted as binding

## Success criteria

- Reproducible baseline evidence exists; zero unexplained pre-existing changes.
- Frozen checksum and scope assertions can be rerun in Phase 08.

## Risks and security

- Wrong starting SHA invalidates every later proof. Stop rather than rebase/reset.
- Never read secrets; environment inspection records names/status only, not values.

## Next

- P01 starts only after all checks pass.

## Unresolved questions

- None.
