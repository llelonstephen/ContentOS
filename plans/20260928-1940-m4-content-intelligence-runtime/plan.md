---
title: "ContentOS M4 Content Intelligence Runtime"
description: "Implement SPEC05 v1.0.1 on the verified M3 baseline with deterministic authority, fenced immutable writes, and exact locked verification."
status: complete
priority: P1
effort: 64h
branch: codex/m4-content-intelligence-runtime
tags: [feature, backend, database, critical]
created: 2026-09-28
---

# ContentOS M4 Content Intelligence Runtime

## Outcome

Implement only M4/SPEC05 v1.0.1 from `fcbce2d` (`m3-v9-verified`). Preserve all M0–M3 invariants, frozen schemas/spec text, SPEC06 ownership, and immutable decision history. Tag `m4-internal-verified` only after every required proof passes.

## Binding inputs

- [Authority/bypass matrix](./authority-bypass-matrix.md)
- [SPEC05 contract report](./research/spec05-contract-report.md)
- [M0–M3 invariant report](./research/m0-m3-invariants-report.md)
- [Codebase scout](./reports/codebase-scout-report.md)
- Frozen precedence: Blueprint > SPEC01 > SPEC02 > SPEC03 > SPEC04 > SPEC05

## Phases

| # | Phase | Effort | Status |
|---|---|---:|---|
| 00 | [Baseline and scope lock](./phase-00-baseline-and-scope-lock.md) | 2h | Complete |
| 01 | [Pure domain contracts](./phase-01-pure-domain-contracts.md) | 7h | Complete |
| 02 | [Fenced persistence and migration](./phase-02-fenced-persistence-and-migration.md) | 10h | Complete |
| 03 | [Audience, strategy, deterministic gate](./phase-03-audience-strategy-and-gate.md) | 10h | Complete |
| 04 | [Architecture and supplemental proof](./phase-04-architecture-and-supplemental-proof.md) | 8h | Complete |
| 05 | [Candidate runtime and SPEC06 boundary](./phase-05-candidate-runtime-and-spec06-boundary.md) | 10h | Complete |
| 06 | [Locked suites and full verification](./phase-06-locked-suites-and-full-verification.md) | 10h | Complete |
| 07 | [Attacker audit](./phase-07-attacker-audit.md) | 4h | Complete |
| 08 | [Evidence, commit, and verified tag](./phase-08-evidence-commit-and-verified-tag.md) | 3h | Complete |

## Dependency graph

```text
P00 → P01 → P02 → P03 → P04 → P05 → P06 → P07 → P08
```

Sequential execution is deliberate: later stages consume earlier authority contracts; no shared-file parallel edits. Tests may be authored with each phase, but Phase 06 owns locked catalogs/harnesses and final counts.

## File ownership

| Phase | Exclusive ownership |
|---|---|
| P01 | `src/domain/content/**` |
| P02 | fencing coordinator, M4 transaction/idempotency/audit/outbox helpers, `content.ts`, migration `0006` |
| P03 | audience/strategy/gate persistence and application modules |
| P04 | architecture persistence/application modules |
| P05 | provider port, workflow executors, candidate runtime, composition root, SPEC06 handoff port |
| P06 | all `m4-*` test catalogs/harnesses/fixtures |
| P07 | `reports/m4-attacker-audit.md` |
| P08 | verification/unproven reports, M4 docs, README, commit/tag |

## Release gates

- Exact `80/80` adversarial, `32/32` static preflight, `32/32` acceptance; zero skip/todo.
- Focused unit/property/concurrency/failure-injection suites; live disposable PostgreSQL; full repository tests with Redis; typecheck; build.
- Frozen files unchanged; baseline ancestor intact; no SPEC06 implementation or new canonical entity.
- Attacker audit: zero unresolved critical/high findings. Mechanically-unproven report: zero P0/P1 or freeze claims unproven.
- Only then conventional commit and annotated tag `m4-internal-verified`; never force/move tag; no push unless separately authorized.

## Unresolved questions

- None. Resolved judgments are binding in the authority matrix; deviations require documented frozen-contract contradiction.
