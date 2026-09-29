# ADR-003: StageExecution Claim, Distributed Leasing, Fencing, and FREEZING Barrier

## Status
Accepted (Originated in Milestones M0/M1; Hardened in Milestone M4 for Audience derivation, exact identity closure, and tenant/workspace-scoped lookup)

## Context
In a distributed architecture, long-running intelligence derivation stages (such as generating audience segment views or content architectures via LLM completions) face classic distributed coordination failure modes:
1. Two workers concurrently claim the same operational stage slot.
2. A worker experiences a prolonged execution or network pause, its lease expires, a second worker takes over and commits, and the delayed first worker wakes up and attempts an overwriting commit.
3. A cycle completes and freezes, but a delayed worker attempts to commit late knowledge or stage derivations.
4. A worker attempts to claim or lock rows belonging to a foreign tenant.

StageExecution leasing and fencing mechanisms originated in foundational milestones (M0/M1) under SPEC01 and SPEC02. In Milestone M4, these mechanisms were rigorously hardened to close authority bypasses in Audience derivation, enforce exact RunConfig closure, make claim authority mandatory prior to external provider invocation, and eliminate foreign-tenant locking vectors through tenant/workspace-scoped database lookups.

## Decision
We enforce a **fenced, tenant-scoped atomic claim and freeze barrier** protocol:
1. **Tenant & Workspace-Scoped Locking**: Security-sensitive tenant/workspace-owned reads, claims, locks, and commits must be scoped according to their ownership envelope. Stage execution claims query and lock `runs`, `decision_cycles`, and `stage_executions` using database-level `FOR UPDATE` locks filtered explicitly by `tenant_id` and null-safe `workspace_id`. Bare ID queries are strictly prohibited.
2. **Monotonic Fencing Tokens and Lease Takeover**:
   - Initial claim creates a `stage_executions` row with `fencing_token: 1`, `attempt_count: 1`, and status `RUNNING`.
   - An unexpired lease owned by another worker blocks the claimant.
   - Renewal by the same active lease owner preserves the lease without incrementing `fencing_token`.
   - An expired lease may be legitimately taken over through the authorized atomic claim path; takeover increments both `fencing_token` and `attempt_count`.
   - Any mismatch in `run_id`, `decision_cycle_id`, `stage_name`, or `canonical_input_hash` fails closed immediately with `IDEMPOTENCY_CONFLICT` or `STAGE_CLAIM_SCOPE_MISMATCH`.
3. **Commit Fencing Verification**: When a worker commits its result, the commit transaction verifies `WHERE stage_execution_id = $1 AND fencing_token = $2`. Stale workers whose leases were taken over fail immediately with `STALE_FENCING_TOKEN`.
4. **FREEZING Barrier**: Once `decision_cycles.status` transitions to `FREEZING` or `FROZEN`, any stage claim or knowledge commit fails immediately with `KNOWLEDGE_COMMIT_REJECTED_AFTER_FREEZING`.
5. **No Existence Oracles on Conflict**: If a cross-tenant attempt collides on a globally unique primary key (`stage_execution_id`) or idempotency constraint, the repository catches PostgreSQL error `23505` and fails closed with `STAGE_CLAIM_SCOPE_MISMATCH` without exposing foreign record details.

## Security/Correctness Properties
- **Mutual Exclusion**: Exactly one worker holds an active lease for a given stage slot at any instant.
- **Split-Brain Immunity**: Stale workers cannot overwrite results written by takeover workers.
- **Cycle Immutability**: No late knowledge commits can alter frozen decision inputs.
- **Tenant Isolation**: Foreign IDs cannot be used to lock rows or discover data across tenants.

## Rejected Alternatives
- **Pure Optimistic Concurrency without Fencing Tokens**: Relying only on `version` numbers on `runs`. Rejected because stage executions run concurrently within a cycle, requiring per-stage fencing.
- **Redis-Only Distributed Locks**: Managing locks exclusively in Redis/BullMQ. Rejected because Redis lock expiration does not prevent stale database write races; database-level fencing token checks are required at the storage boundary.

## Consequences
- Every stage commit port must accept a `fencing_token` parameter and check it in the persistence transaction.
- External model calls must only happen **after** the claim transaction has returned `claimed: true`.

## Related Specs/Tags
- `ContentOS_SPEC01_System_Architecture_v1.1.3_FROZEN.md`
- `ContentOS_SPEC02_Domain_Data_Model_v1.0.6_FROZEN.md`
- `ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.5_FROZEN.md` (§91, §92)
- Tags: `m1-v7-verified`, `m4-v1-verified`
