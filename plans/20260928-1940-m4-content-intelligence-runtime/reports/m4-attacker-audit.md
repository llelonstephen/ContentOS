# M4 attacker audit

Status: closed internally; no external PASS claim.

## Fixed findings

1. High — caller-supplied Strategy Gate facts could fill a missing canonical proposition.
   Fixed by rejecting all request-side gap, proposition-state, and governance additions.
2. High — any allowed M4 StageExecution could reach any M4 commit port.
   Fixed by exact stage-to-artifact binding before persistence plus existing DB stage fence.
3. High — ordinary single-column FKs allowed cross-tenant relationship pivots.
   Fixed by PostgreSQL reference-scope triggers for M4 entities and relationship tables;
   live PostgreSQL attack test proves rejection.
4. High — Architecture provider could self-assert supplemental factual support and receive
   an opaque context object. Fixed by moving supplemental proof/classification to canonical
   resolver input and constructing a detached, minimized JSON-only provider payload.
5. Medium — runtime principal could mutate outbox rows after append. Fixed by revoking
   UPDATE, DELETE, and TRUNCATE on outbox_events.
6. Medium — rewrite parent closure checked identity but not exact Task/Strategy/Architecture/
   RunConfig lineage. Fixed by full parent closure validation and scoped DB trigger.

## Attack classes rechecked

- Wrong tenant/workspace, guessed IDs, shared-scope pivots, cross-tenant FKs.
- Wrong Run/current cycle, stale epoch/token/lease, wrong stage/hash/key/slot.
- Writes after FREEZING, superseded cycle, completed retry divergence.
- Hidden/current/latest config substitution and unpinned provider/tool/schema inputs.
- Prompt/tool/control-plane/publication escalation and unrestricted datastore context.
- Supplemental unsupported/contradicted facts and hidden material strategy changes.
- Candidate mutation, stale parent, inherited evaluation/release authority.
- Partial registry/entity/output/audit/outbox transactions and retry duplication.
- SPEC06 assertion/evaluation/readiness/release/publication ownership violations.

## Residual findings

No unresolved critical/high finding. Mechanically unproven operational claims are listed
separately and do not constitute external certification.
