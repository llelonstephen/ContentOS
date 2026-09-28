# M4 Codebase Scout Report

Scout date: 2026-09-28 (Asia/Ho_Chi_Minh)  
Baseline: `fcbce2d10737671a5e5832f5dc5017463a182526` (`m3-v9-verified`, `origin/main`)  
Scope: read-only architecture/API/test/migration inspection. No production code edited.

## Baseline shape

- TypeScript ESM, strict compiler settings, PostgreSQL via `postgres` + Drizzle schema, Vitest, BullMQ/Redis, Fastify.
- Actual architecture is persistence-service centric. `src/application/`, `src/workflow/`, and `src/providers/` described by README do not exist. Durable queue helper exists at `src/events/publisher/queue.ts`; no stage worker implementation exists.
- Domain code is pure TypeScript under `src/domain/{shared,knowledge,governance,services}`. `src/tests/unit/m0-dependency-direction.test.ts` AST-enforces no domain imports from persistence/API/events/providers/workflow/security/observability or infrastructure packages.
- Infrastructure services use raw tagged SQL and `this.sql.begin(...)`; they validate references/scopes inside the same transaction and throw `RegistryValidationError` with stable codes.
- API currently exposes only `/health`; composition root only constructs `StandaloneIngestionAdapter`.
- `outbox_events` schema/queue primitives exist, but no production persistence service inserts an outbox event. SPEC05's transaction recipes therefore require new atomic outbox writes in the M4 service.

## Existing M0-M3 contracts and reusable APIs

| Area | Existing API / enforcement | M4 use or limitation |
|---|---|---|
| Canonical errors | `RegistryValidationError`; `ContentOSError` + retry categories | Reuse stable fail-closed codes; avoid provider/domain error ambiguity. |
| Stage authority | `verifyStageFencing(sqlTx, { fencingContext, tenantId, workspaceId, requireCycleContext, writeMode })`; `StageFencingContext`; `WriteMode` | Reuse inside every audience/strategy/architecture/candidate commit. It checks cycle state, tenant/workspace, StageExecution `RUNNING`, lease expiry/owner, fencing token. |
| Cycle lifecycle | `DecisionPersistenceService.createDecisionCycle`, `cancelDecisionCycle`, `freezeDecisionSnapshot`, `createSuccessorDecisionCycleForReview` | M4 writes must stay upstream of freeze. Current fence rejects `FREEZING/FROZEN`, cancelled/superseded/failed cycles. |
| Knowledge cycle adapter | `DecisionCycleKnowledgeAdapter` requires explicit decision cycle/stage/token | Pattern for a dedicated M4 cycle-bound adapter or service API. |
| Unknown gate | `assertUnknownPreservationGate`, `KnowledgeGapPersistenceService.assertTaskUnknownPreservationGate` | Reuse for strategy gate blocking-gap closure. |
| Strategy knowledge gate | `StrategyKnowledgeGateService.evaluateKnowledgeGate` | Useful exact-state resolver and terminal-gap validation, but incomplete for SPEC05: does not require `FINAL_FOR_DECISION`, does not reject `CONTRADICTED/INSUFFICIENT`, and does not enforce pre-generation governance/applicability. Extend carefully or wrap with a complete deterministic gate. |
| Governance | `GovernancePersistenceService.resolveOrRefreshGovernanceSnapshot`, `assessApplicability`, `evaluatePolicySet`; `TemporalGovernanceResolver` | Consume exact frozen/pinned results. Do not call `resolveActiveAt` after run start for generation config. |
| Pinned config | `run_configs`; normalized `run_config_{prompt,model,tool,schema,retriever,evaluator}_revisions`; registered revision payloads | Resolve exact revisions/payload hashes only. Tables currently store only `revision_id` and have no FK to `revision_registry`; service-level exact entity-type/tenant/payload checks are mandatory. |
| Safe source boundary | `validateSafeSourceBoundary`; object store and registered payload hash patterns | Reuse instruction/data separation concepts; M4 still needs explicit prompt/context manifest builder. |
| Idempotency | `api_idempotency_records` + `validateIdempotencyRecord`; StageExecution global unique `idempotency_key` + `canonical_input_hash`; output refs | M4 canonical slot identity should use StageExecution. No M4-specific canonical uniqueness exists yet; transaction must converge exact retry without collapsing variant slots. |
| Immutability | DB trigger `prevent_immutable_mutation()` on audience, strategy, architecture, units, candidates and link sets | Preserve append-only evolution; rewrite inserts a new candidate. |
| Registry | `immutable_entity_registry` and insert guard trigger | Audience, StrategyHypothesis, ContentCandidate are guarded. ContentArchitecture and ContentUnit lack registry guard triggers in `0001`; M4 service should register them and an M4 migration should close DB enforcement if consistent with SPEC02. |
| Snapshot closure | normalized decision snapshot strategy/architecture/candidate sets; candidate/package closure checks in decision service | M4 creates inputs only; SPEC06/decision layer owns evaluation and release. |

M0-M3 invariants that M4 must not regress: exact immutable/revision refs; no current/latest historical substitution; append-only canonical truth; same-transaction registry insert; tenant/workspace isolation; standalone authority by PostgreSQL principal; decision-cycle writes by lease/fence/cycle state; unknown preservation; exact decision-time epistemic state; complete frozen-governance evaluation; runtime cannot mutate Control Plane; `DecisionRecord` alone owns release status.

## M4 schema readiness and gaps

Already present from M1 frozen schema:

- `audience_states`, `strategy_hypotheses`, `content_architectures`, `content_units`, `content_candidates`.
- `strategy_required_propositions`, `content_architecture_units`, `content_unit_propositions`.
- DecisionSnapshot strategy/architecture/candidate link tables.
- StageExecution + output refs, RunConfig/config revision sets, immutable registries, outbox.
- Immutable triggers for every M4 entity/link table.

Important gaps/weak spots:

- No M4 persistence/application/workflow/provider implementation exists.
- `content_architectures.supersedes_architecture_id` and `content_candidates.parent_candidate_id` are text only; Drizzle and migration have no self-FK.
- Unit order is stored on `content_units.position`; DB cannot express uniqueness per architecture through the join table. Enforce under transaction/lock and test concurrency.
- M4 relationship tables carry no tenant/workspace columns. Every referenced row must be loaded and compared in the fenced transaction.
- Existing schema has no canonical StrategyGateResult by design. Gate result/reasons must remain operational StageExecution output/log metadata.
- StageExecution output refs provide output lineage but no reverse unique constraint. Exact-retry convergence needs a locked stage/idempotency transaction and deterministic output recovery.
- Current `verifyStageFencing` checks cycle status and stage token, but not equality between StageExecution `decision_cycle_id` and supplied cycle, its `run_id`, stage name, or `canonical_input_hash`. M4 should close these before commit.
- Current fencing does not compare cycle `fencing_epoch` with a context epoch. Cancellation increments epoch, but M4 should explicitly bind/verify it if SPEC01 dual-fence behavior is required.
- Outbox atomicity is absent in all current persistence services.
- `src/domain/shared/types.ts` and `src/domain/knowledge/types.ts` duplicate some vocabularies. Put new content types in one module; do not create a third source of truth.

## Migration conventions

- Drizzle config: schema index at `src/persistence/relational/schema/index.ts`, output under `.../migrations`, PostgreSQL dialect, `strict: true`.
- `0000`/`0001` are generated, use `--> statement-breakpoint`, and are recorded in `meta/_journal.json` plus snapshots.
- `0002`-`0005` are hand-written forward closures for triggers/RBAC/security and are not recorded in the Drizzle journal.
- Tests execute SQL by reading migration files and splitting on the breakpoint marker. M1 persistence drops all public tables, then applies only `0000` + `0001`. M2 vector suite explicitly applies `0002`-`0004`. M3 integration suite does not apply `0005`; its static suite only reads it.
- Likely M4 convention: add `0006_m4_content_intelligence_invariants.sql` with no new canonical table, idempotent trigger/constraint/RBAC closure, breakpoint-separated statements; explicitly apply it in M4 live tests. If Drizzle schema changes, keep TS schema and SQL synchronized.
- High risk: `npm run db:migrate` will not apply `0002`-`0005` because journal lists only `0000`/`0001`. Decide whether M4 preserves manual-test application or repairs migration registration/deployment separately.

## Test suites and live harness

- Vitest is deliberately serial: `fileParallelism: false`, `sequence.concurrent: false`, 30s test/hook timeout.
- Current test counts: M1 locked 76 vectors, M2 locked 76, M3 locked 80; M2 preflight 28; M3 acceptance 34; M3 preflight 34. Older M0/M1 unit/integration suites remain active.
- Live PostgreSQL tests use `DATABASE_URL_TEST`, then `DATABASE_URL`, then `postgresql://localhost:5432/contentos_test`; every destructive harness rejects a DB name lacking `test`.
- Tests use real PostgreSQL and create/grant NOLOGIN roles plus login test users. Role-sensitive connections append `options=-c%20role=...`.
- M0 infra also requires Redis and performs BullMQ enqueue/consume. Most M1-M3 integration tests require PostgreSQL only.
- Suites share database state and depend on serial file order. Fixtures mostly use timestamp/random IDs and `ON CONFLICT DO NOTHING`; cleanup is partial.
- M4 should mirror established files: one exact 80-vector live suite, one exact 32-check static preflight, one 32-criterion acceptance file. Add focused domain/unit/property/concurrency tests only if they do not alter locked counts.
- Baseline validation was attempted but dependencies are absent: `npm run typecheck` -> `tsc: command not found`; `npm run test:unit` -> `vitest: command not found`. Run `npm ci` before verification. Live DB tests were not run during scout because they are stateful/destructive to `contentos_test`.

## Package scripts

```text
build             tsc
dev               tsx watch src/main.ts
start             node dist/main.js
test              vitest run
test:watch        vitest
test:coverage     vitest run --coverage
test:unit         vitest run src/tests/unit
test:integration  vitest run src/tests/integration
test:property     vitest run src/tests/property
test:concurrency  vitest run src/tests/concurrency
test:failure      vitest run src/tests/failure_injection
typecheck         tsc --noEmit
db:generate       drizzle-kit generate
db:push           drizzle-kit push
db:migrate        drizzle-kit migrate
db:studio         drizzle-kit studio
```

`property`, `concurrency`, and `failure_injection` directories do not exist yet; their scripts currently match zero tests.

## Likely M4 change map

Add:

- `src/domain/content/` split into small pure modules: content runtime types, canonical serialization/hash, audience/strategy/architecture/candidate validators, deterministic Strategy Gate, prompt trust/context admission, state-change/invalidation rules. Keep each code file near/below 200 lines where practical.
- `src/persistence/relational/services/content-intelligence-persistence-service.ts` only if decomposed helpers keep it manageable; preferable split by audience/strategy/architecture/candidate plus shared transactional context resolver.
- `src/application/content-intelligence/` for provider-call orchestration outside transactions, deterministic context manifests, retries/variants/cache policy, and SPEC06 handoff DTO. This would establish the README's intended layer instead of putting provider logic into persistence.
- `src/providers/models/` provider interface/adapter with exact pinned config; no direct publication/control-plane mutation capability.
- `src/workflow/stages/content-intelligence/` only if actual StageExecution claim/execute/commit workers are in M4 scope; otherwise keep workflow entrypoints thin and test the service boundary.
- `src/persistence/relational/migrations/0006_m4_content_intelligence_invariants.sql` for DB-enforceable closure/RBAC/registry/self-FK protections without new canonical entities.
- `src/tests/integration/m4-spec05-80-vectors.test.ts`, `src/tests/unit/m4-spec05-preflight.test.ts`, `src/tests/unit/m4-spec05-acceptance.test.ts`; optionally focused `src/tests/property/` and `src/tests/concurrency/` files.

Modify:

- `src/persistence/relational/schema/content.ts` only for upstream-frozen FK/index/check corrections; do not invent fields/entities.
- `src/persistence/relational/schema/operational.ts` only if an operational constraint/index is needed; prefer existing StageExecution/output refs.
- `src/persistence/relational/schema/reference-sets.ts` for exact FK/index corrections if allowed by frozen schema.
- `src/persistence/relational/services/stage-fencing-coordinator.ts` to validate supplied cycle equals stage cycle, canonical input hash/idempotency, and possibly cycle epoch/run binding.
- `src/persistence/relational/services/strategy-knowledge-gate-service.ts` or replace with a complete deterministic M4 gate while retaining M2 callers.
- `src/bootstrap/composition-root.ts` to wire M4 ports/services, not provider globals.
- Documentation under `docs/` per repository instructions; directory is currently absent. README milestone statuses are stale (`M0 IN PROGRESS`, M1-M4 PENDING) despite M3 verified tag.

Avoid modifying `src/api/server.ts` unless M4 explicitly requires public endpoints. No existing API command pattern exists to copy.

## Commands used for scout

```bash
git status --short --branch
git rev-parse HEAD
git show -s --format='%H %s' fcbce2d
git log --oneline --decorate -20
rg --files src tests docs plans | sort
find src -type d | sort
wc -l src/persistence/relational/schema/*.ts src/persistence/relational/services/*.ts src/domain/**/*.ts src/tests/**/*.test.ts src/persistence/relational/migrations/*.sql
rg -n 'pgTable\(|export (const|interface|type|class|function)' src
rg -n 'ContentArchitecture|ContentUnit|ContentCandidate|StageExecution|fencing|FREEZING|idempot' src ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.1_FROZEN.md
rg -n 'outbox_events|INSERT INTO outbox' src --glob '!src/tests/**'
sed -n '1,260p' README.md package.json tsconfig.json vitest.config.ts drizzle.config.ts .env.example
sed -n '1,240p' src/persistence/relational/migrations/meta/_journal.json
npm run typecheck
npm run test:unit
```

## Recommended verification commands after implementation

```bash
npm ci
npm run typecheck
npm run test:unit
DATABASE_URL_TEST=postgresql://contentos:contentos@localhost:5432/contentos_test npm run test:integration
npm test
npm run build
git status --short
```

Use a disposable database whose name contains `test`. Redis must be reachable for `m0-infra.test.ts` and full `npm test`.

## Main risks

1. Locked schema: SPEC05 adds behavior, not entities. Operational convenience tables/entities can fail preflight.
2. Incomplete existing StrategyKnowledgeGate may be mistaken for full SPEC05 Strategy Gate.
3. Fencing has missing stage-to-cycle/hash/epoch checks; stale workers could pass a token from the wrong stage/cycle.
4. Idempotency versus intentional variants has no current canonical service implementation.
5. Scope integrity is mostly service-level for content graph links; raw inserts can cross tenant/workspace unless M4 migration closes it.
6. Provider calls inside SQL transactions would hold locks and violate SPEC05 pattern.
7. Broad tenant datastore context, prompt concatenation, or generic model/tool clients can violate v1.0.1 context minimization and instruction authority.
8. RunConfig ref sets are weakly constrained; `revision_id` existence/type/tenant/payload/hash must be validated explicitly.
9. Outbox requirement currently has no reusable writer; easy to omit or emit non-atomically.
10. Migration journal/manual forward-migration split can make local tests pass while production `db:migrate` misses M2-M4 protections.
11. Shared serial integration DB can create order-dependent false passes/failures; M4 suite should bootstrap its own required forward migration and unique fixtures.
12. Large existing service/test files already exceed 200 lines. New M4 implementation should modularize rather than append to them.

## Unresolved questions

- Should M4 repair Drizzle journal/deployment handling for manual migrations `0002`-`0005`, or preserve the current forward-SQL convention and document deployment separately?
- Is orchestration/provider execution in M4 scope, or only deterministic domain + fenced persistence runtime? This changes whether `src/application`, `src/workflow`, and `src/providers` are introduced now.
- Which existing operational storage is authoritative for Strategy Gate outcome/reasons and full input manifest: StageExecution output refs plus logs, or an existing audit-event convention? No current service persists structured stage result metadata.
