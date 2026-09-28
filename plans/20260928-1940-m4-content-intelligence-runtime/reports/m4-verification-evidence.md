# M4 verification evidence

Baseline: `m3-v9-verified` / `fcbce2d10737671a5e5832f5dc5017463a182526`

Release identity: annotated tag `m4-internal-verified`; exact commit is reported from Git
after the evidence commit is created.

## Required final gates

- SPEC05 adversarial vectors: 80/80 passed, zero skip/todo.
- Static preflight: 32/32 passed, zero skip/todo.
- Acceptance criteria: 32/32 passed, zero skip/todo.
- M0–M3 regression selection: 589/589 passed across 21 files.
- Full repository: 774/774 passed across 31 files.
- Live PostgreSQL integration: 285/285 passed across 7 files; M4 live subset 5/5.
- Typecheck: passed (`tsc --noEmit`).
- Build: passed (`tsc`).
- Frozen specification diff: empty against `fcbce2d`.
- Worktree cleanliness: checked after commit/tag.

## Internal attacker audit

Zero unresolved critical/high findings after remediation. See `m4-attacker-audit.md`.

## Mechanically unproven

See `mechanically-unproven-report.md`. No external PASS is asserted.
