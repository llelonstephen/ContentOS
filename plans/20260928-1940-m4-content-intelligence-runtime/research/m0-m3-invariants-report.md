# M0–M3 Invariants M4 Must Preserve

Research date: 2026-09-28 (Asia/Ho_Chi_Minh)  
Authoritative baseline: commit `fcbce2d10737671a5e5832f5dc5017463a182526`  
Sources: Blueprint v2.13.1 FROZEN; SPEC01 v1.1.3; SPEC02 v1.0.6; SPEC03 v1.0.1; SPEC04 v1.0.2. No current-worktree interpretation substituted for baseline text.

## Executive summary

M4 is an append-only, fenced producer of candidate/assertion/evaluation state inside one exact run/cycle/config universe. It is not a live-config resolver, truth authority, policy engine, publication authority, or Control Plane mutator. Every model-assisted output is only a proposal until typed/schema/security/domain validation and a short fenced transaction admit it.

Highest-risk distinction: runtime configs are fixed in `RunConfig`; final governance is not blindly fixed to the provisional initialization set. Governance may refresh before freeze, but only by selecting exact immutable revisions under explicit knowledge-cutoff, target-valid-time, scope, and final-context rules. No path may use unqualified CURRENT/LATEST/ACTIVE.

## Cross-cutting invariant map

### 1. Exact `RunConfig`; no ambient current state

- Clauses: Blueprint §5, §40, §44B–C, §48A, §50A, §89, §101; SPEC01 §§20–22, §86–87; SPEC02 §§2, 6, `RunConfig`, `DecisionSnapshot`; SPEC03 §110–111; SPEC04 §10, §108–111.
- Preserve: initialize task/program/channel/baseline plus prompt/model/tool/schema/retriever/evaluator revisions from one repeatable-read boundary; persist exact typed revision refs. Candidate `run_config_id` must equal snapshot `run_config_id`; every run-created evaluator/retriever/derivation ref must belong to that pinned config set.
- Governance nuance: final refresh selects existing exact revisions by `knowledge_cutoff_time`, `target_valid_time`, scope, and final context. It may exceed provisional governance, but never becomes an ambient active lookup.
- Implementation risk: a provider adapter, cache, evaluator, prompt loader, or replay helper resolves by stable name/default alias; hot activation changes an in-flight run; final governance incorrectly reuses only the provisional set.
- Required tests: activate a new prompt/model/tool/evaluator during a run and prove outputs retain old refs; reject candidate/evaluation/research output with later/unpinned config; replay with changed active revisions and get recorded state; test future-valid-known versus future-known governance.

### 2. Immutable history; rewrite means new identity

- Clauses: Blueprint §2, §27, §30–32, §36–41, §53–63, §101; SPEC01 §§28–32, 58–59; SPEC02 §§2, 7, 10, 34–36 and `ContentCandidate`; SPEC03 §§8, 28–36, 53, 56, 72–74, 82–84; SPEC04 §§12, 16, 68, 77, 83, 104–106.
- Preserve: canonical decision truth is insert-only. Candidate rewrite creates new `candidate_id` with optional parent; re-evaluation/reassessment creates a new immutable record; material proposition meaning creates a new proposition and fresh links. Baseline, delta manifests, governance snapshots, decision snapshots, policy results, conflicts, reviews, overrides, and decisions are never patched.
- Mutable exception: operational lifecycle/lease/fence rows may mutate under explicit optimistic/transactional rules; they cannot rewrite canonical history.
- Implementation risk: an edit endpoint updates `content_payload`; validation overwrites an old result; review modifies candidate/snapshot; a JSON payload duplicates canonical IDs/source-of-truth relations.
- Required tests: deny ordinary UPDATE/DELETE at DB role; rewrite preserves parent and old payload/hash; reassessment does not duplicate link; old snapshot/package remains byte/ref stable after correction, review, or successor cycle.

### 3. Prompt-injection, tool, model, and publication boundaries

- Clauses: Blueprint §7–8, §71–79, §90–91; SPEC01 §§44–49, 69–71, 94–95; SPEC03 §§14–19, 113–114, 140–141; SPEC04 §§34–39, 91–94.
- Preserve: source text remains data through isolated retrieval, instruction/data separation, structured extraction, schema/security validation, and evidence staging. It cannot change instructions/permissions, select privileged tools, activate revisions, authorize release, or self-declare truth/policy authority.
- All model calls go through the gateway with exact pinned config and hashes. JSON validity is insufficient: parse, schema, semantic, reference, security, domain, and fence validation are mandatory.
- Publication is downstream and separately authorized. `DecisionRecord` alone owns release status; READY still requires package/execution/rights/publication closure. M4 cannot publish directly or interpret BLOCKED/REVIEW as authorization.
- Implementation risk: retrieved prompt text reaches system/tool channel; free-form model IDs are trusted; model stage calls provider SDK/tool directly; generation success emits publication command.
- Required tests: malicious source attempts tool call/policy override/publication; fabricated/cross-tenant IDs; valid JSON violating domain refs; READY versus BLOCKED/REVIEW publication gating; no publish side effect from M4 stages.

### 4. Retry idempotency versus intentional variants

- Clauses: SPEC01 §§33–41, 43, 82–85, 95; SPEC02 `StageExecution`, §36; SPEC03 §§97–103; SPEC04 §§50–53, 95–99.
- Preserve: exact retry identity is the hash of run, cycle, stage, canonical input-reference set, and pinned config-reference set; DB uniqueness is final authority. Duplicate delivery reloads canonical outputs; same external idempotency key with changed payload conflicts.
- Intentional new generation/rewrite/variant is a new semantic action, not a retry. Its deliberate variant discriminator must be immutable and included in canonical inputs/idempotency identity. Provider randomness must not create divergent canonical outputs behind one key.
- Implementation risk: every variant collapses to the first candidate; or retry generates a second candidate because nonce/time/random seed is injected invisibly; repair attempts create canonical partial outputs.
- Required tests: duplicate queue delivery and crash/retry converge to identical output refs; concurrent claim has one business effect; same variant request is idempotent; distinct declared variant IDs can create distinct candidates; changed payload under same key rejects; exhausted repair stores no invalid canonical output.

### 5. Dual fencing and `FREEZING`

- Clauses: SPEC01 §§26–27, 35–43, 50–57, 119–124; SPEC02 `Run`, `DecisionCycle`, `StageExecution`, §23, §34–36; SPEC03 §§102–104; SPEC04 §§101–103.
- Preserve: every async commit validates both stage fencing token and current cycle epoch; writable requires cycle OPEN and current-cycle pointer. Entering FREEZING is atomic/CAS only after all required inputs are terminal, increments epoch, and closes upstream writes. Freeze validates closure and atomically inserts snapshot/binding/status/outbox.
- Implementation risk: long model call returns after takeover, cancel, successor, or FREEZING and commits; lease validity alone is treated as authority; snapshot freezes while required stage is retryable/running; reopening preserves old epoch.
- Required tests: late worker after takeover/cancel/supersession/FREEZING gets stale error and no canonical rows; freeze/write race; two concurrent freeze attempts; rollback leaves no partial snapshot; repairable reopen increments epoch.

### 6. Tenant/workspace/data-scope isolation

- Clauses: SPEC01 §§89–92, 97–99, 127; SPEC02 §§4, 32, 36; SPEC03 §§17, 105–106; SPEC04 §§39, 113–116, 120.
- Preserve: multi-tenant canonical and operational rows carry ownership; private references require same tenant; workspace/public/aggregate reuse requires explicit `DataScope` plus authorization. IDs are not capabilities. A public Proposition does not expose private evidence.
- Implementation risk: semantic search/cache/dedup leaks another tenant; worker commits refs from mixed ownership; global proposition reuse bypasses evidence access; selector crosses tenant.
- Required tests: Tenant A knowing B IDs cannot read/write/link; workspace sharing succeeds only when explicit; public proposition/private evidence separation; cache key contains tenant/workspace/scope and exact revisions; same-tenant ownership checked in fenced transaction.

### 7. Dependency invalidation and downstream regeneration

- Clauses: Blueprint §61, §90–91; SPEC01 §§27–32, 58–59, 134; SPEC03 §7, §80–84, 131; SPEC04 §§14–17, 32–33, 81–83, 130–131, 138.
- Preserve: material changes to market, jurisdiction, category, audience, channel, or proposition state force coverage/applicability refresh and new immutable governance state. Candidate/implied assertion changes re-enter mapping, validation, composite closure, content-level applicability, risk, uncertainty, and rights as affected.
- After FREEZING or material reviewer new information: old cycle/snapshot stays frozen; create successor cycle, canonicalize new upstream state, recompute affected stages, build/freeze a new snapshot, and rerun the complete policy set. Override is never a vehicle for new facts.
- Implementation risk: stale downstream outputs reused because dependency fingerprint omits one input; reviewer note patches old decision; new assertion bypasses full validation/governance.
- Required tests: change each material dependency independently and assert expected stage/key invalidation; implied assertion loops until stable or review limit; post-freeze late knowledge cannot join old snapshot; review-new-info produces successor cycle/full policy rerun.

### 8. Factual-proof admission and wording strength

- Clauses: Blueprint §2, §29–32A, 49–50A, 87, 101; SPEC03 §§7–13, 18–26, 38–67, 93–96, 131–141.
- Preserve: canonical path is origin → EvidenceItem → Proposition → link → compatibility → immutable assessment → epistemic state → assertion mapping/validation. Compatibility is not support; research success is not truth; no evidence is not contradiction; assumptions/user answers/model output are not factual evidence without a supported origin contract.
- Performance/attribution/observational results may support scoped performance/strategy/audience statements, not product/safety/regulatory/medical facts or causal proof by themselves. Wording strength cannot exceed exact pinned epistemic support; implied assertions use the same admission/validation path.
- Implementation risk: candidate cites raw source/LLM output rather than proposition state; high conversion becomes factual proof; PARTIALLY_SUPPORTED becomes unqualified certainty; duplicate dependent evidence is counted independently.
- Required tests: assertion links only to reachable immutable propositions; qualifiers/population/jurisdiction/time survive extraction and generation; incompatible/uncertain evidence cannot promote support; causal claim requires pinned causal-identification rules; material OVERCLAIM/UNSUPPORTED/CONTRADICTORY blocks normal release.

### 9. Governance and policy mechanics M4 must feed correctly

- Clauses: Blueprint §§51–63A; SPEC04 §§3–53, 57–99, 118–139.
- Preserve: guidance, normative rule, policy, applicability, triggering, conflict, review, and override stay distinct. Policy reads only a frozen snapshot plus exact policies and declared selectors; DSL is deterministic, typed, bounded, side-effect/network/tool-free. One terminal `PolicyResult` exists per `(snapshot, policy_revision)` including non-triggered results; expected-set equality precedes conflict detection.
- Conflicts have deterministic `conflict_key` and one final resolution. No guessing by newest/insertion/friendly result. AUTHORIZED_OVERRIDE needs an already-valid same-snapshot override, policy permission, authority, and scope. DecisionRecord requires complete policy set, final conflicts, review/override closure, coherent selected candidate/action/status.
- Implementation risk: M4 treats guidance as hard law; policy engine reads live candidate/cache state; missing policy result becomes pass; policy chooses/publishes candidate directly; UI role is trusted as authorization.
- Required tests: completeness uses exact set equality; policy failure/hidden input/type mismatch fail closed; one result under concurrency; unresolved conflict cannot authorize release; override subset/snapshot/authority rules; DecisionRecord candidate is in snapshot and package cannot substitute it.

## Priority test gates for M4

1. P0: exact-config lineage on every candidate/model/evaluator/retriever output; reject unpinned refs.
2. P0: dual-fence every canonical write; exhaustive late-worker and freeze-race tests.
3. P0: untrusted text cannot select tools, alter authority, or trigger publication.
4. P0: tenant/workspace ownership checked during reads, cache/dedup, and commits.
5. P0: factual assertion admission, qualification, implied-assertion closure, and release blockers.
6. P1: idempotent retries versus explicitly distinct variants; deterministic canonical hashes.
7. P1: dependency fingerprints drive immutable downstream regeneration and governance refresh.
8. P1: frozen-snapshot-only policy handoff and complete auditable output refs.

## Unresolved questions

- Baseline through SPEC04 does not name M4's intentional generation-variant discriminator. SPEC05/implementation plan must identify the immutable field/reference and include it in canonical input hash/idempotency identity.
- Confirm whether M4 acceptance runs both deployment modes or multi-tenant only; single-tenant simplification still needs an explicit one-trust-tenant assumption/sentinel.
