# Phase 08 — Evidence, Commit, and Verified Tag

## Context

- All prior phase files and reports
- Baseline `fcbce2d` / `m3-v9-verified`

## Overview

- Priority: P0
- Status: Pending
- Goal: make verification claims auditable, then create local commit/tag only if fully proven.

## Files

- Finalize/create `reports/m4-verification-evidence.md`.
- Create `reports/mechanically-unproven-report.md`.
- Create `docs/content-intelligence-runtime.md`; update `README.md` M4 status only after verification.
- Do not edit any frozen Blueprint/SPEC file.

## Mechanically-unproven report schema

For every claim not directly proven, record: claim, risk tier, attempted command/test, observed evidence, why proof is incomplete, affected AV/PF/AC, blocker status, and owner/follow-up. Empty is explicit (`none`), never omitted. Any P0/P1, frozen criterion, required command, live infrastructure, or Critical/High audit item marked unproven blocks commit/tag. Record the pre-existing manual migration-journal deployment parity separately; M4 proves explicit `0000`–`0006` forward application and must not claim journal-driven deployment proof.

## Final verification steps

1. Recheck HEAD ancestry, baseline tag, worktree scope allowlist, and frozen file checksums/diff.
2. Re-run exact locked suites and assert `80/80`, `32/32`, `32/32`, no skip/todo.
3. Re-run focused suites, live PostgreSQL integration, full unfiltered repository suite with Redis, typecheck, and build after all fixes/docs.
4. Confirm migration applies twice on fresh disposable DB and role/trigger checks pass.
5. Confirm attacker audit has zero Critical/High; review every Medium/Low rationale.
6. Confirm no SPEC06 implementation/new canonical entity/public API/external effect and all new code files are <200 lines or have recorded justified exception.
7. Write evidence and mechanically-unproven reports with exact commands, exit codes, counts, commit SHA candidate, timestamps, and environment class.
8. Review `git diff --check`, staged diff, and secret scan. Stage only allowlisted M4/docs/plan evidence.
9. Create one focused conventional commit, e.g. `feat(content-runtime): implement verified M4 runtime`.
10. Verify the committed tree again where commit-sensitive evidence applies. Create annotated `m4-internal-verified` only if absent and all gates remain green; never move/force it.
11. Do not push commit/tag without separate authorization.

## Todo

- [ ] Frozen/baseline/scope proof clean
- [ ] All required suites/commands pass
- [ ] Attacker audit clean
- [ ] Mechanically-unproven blockers = 0
- [ ] Evidence/docs truthful and complete
- [ ] Secret/staged diff review clean
- [ ] Commit created
- [ ] Annotated tag created once

## Success criteria

- Tag resolves to the verified commit and evidence report names that SHA.
- Any failed, skipped, unavailable, partial, flaky, or unproven required gate prevents both commit and tag.
- Final worktree contains no accidental artifacts/secrets and frozen files match baseline.

## Risks and security

- A report is not proof unless backed by captured command/test output.
- Never delete/move an existing tag; collision is a hard stop for investigation.

## Unresolved questions

- None.
