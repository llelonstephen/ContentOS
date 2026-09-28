# Phase 07 — Attacker Audit

## Context

- [Attacker obligations](./authority-bypass-matrix.md#attacker-audit-obligations)
- Passing Phase 06 implementation and evidence

## Overview

- Priority: P0
- Status: Pending
- Goal: hostile review of authority, scope, concurrency, prompt, and boundary bypasses.

## Files

- Create only: `reports/m4-attacker-audit.md`.
- Any fix returns to its owning phase/file and requires complete Phase 06 rerun; audit does not edit production code directly.

## Audit method

1. Diff from `fcbce2d`; enumerate every new call edge into canonical writes and external adapters.
2. Trace each stage from untrusted/provider input to transaction, DB triggers, audit/outbox, and output refs.
3. Attempt all matrix attacks: guessed/mixed-scope IDs, stale cycle/stage/epoch/token/lease/hash/key, concurrent slots, FREEZING race.
4. Attempt prompt/source/human escalation, secret extraction, tool expansion, unpinned fallback, config hot-switch, publication/control-plane/SPEC06 writes.
5. Attempt hidden strategy via architecture, stale refs, duplicate order, invalid supplemental proof, factual rewrite, validation inheritance, current-model replay.
6. Review SQL injection/search-path/RLS-role/grant boundaries, lock order/deadlocks, logging exposure, and outbox atomicity.
7. Run static searches for `current|latest|active`, UPDATE/DELETE on immutable tables, direct provider SDKs, SPEC06 tables, publication/effect adapters, and broad datastore context.
8. Classify findings Critical/High/Medium/Low with exploit, evidence, owner, fix, and retest. No dismissal without mechanical evidence.

## Todo

- [ ] Authority graph audited
- [ ] Tenant/data-scope attacks executed
- [ ] Concurrency/idempotency attacks executed
- [ ] Prompt/tool/effect attacks executed
- [ ] SPEC06 and replay boundaries audited
- [ ] All critical/high findings fixed and full verification rerun

## Success criteria

- Zero open Critical/High findings.
- Every Medium/Low item has explicit non-freeze rationale and owner; no invariant is waived.
- Report maps findings/tests back to AV/PF/AC IDs.

## Risks and security

- Audit payloads use synthetic non-secret data and isolated test infrastructure.
- A passing happy-path suite is not evidence against a bypass; negative effects must be observed.

## Next

- P08 produces final proof ledger and gates commit/tag.

## Unresolved questions

- None.
