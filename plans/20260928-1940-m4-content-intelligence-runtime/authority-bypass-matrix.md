# M4 Authority and Bypass Matrix

Authority: Blueprint v2.13.1 > SPEC01 v1.1.3 > SPEC02 v1.0.6 > SPEC03 v1.0.1 > SPEC04 v1.0.2 > SPEC05 v1.0.1. Baseline: `fcbce2d10737671a5e5832f5dc5017463a182526` / `m3-v9-verified`. This matrix adds no entity, field, gate, or SPEC06 behavior.

## Fixed authority model

1. M4 canonical writes use `DECISION_CYCLE` mode only. A valid PostgreSQL session is necessary but never sufficient.
2. Write authority is the conjunction of exact tenant/workspace, run/current-cycle binding, `OPEN` cycle, matching cycle epoch, `RUNNING` StageExecution, unexpired matching lease, fencing token, allowed stage name, canonical input hash, and idempotency identity.
3. Provider/model output has proposal authority only. It cannot commit, gate, publish, mutate Control Plane, select unpinned tools/config, or create SPEC06 truth.
4. Operational slots (`strategySlot`, `architectureSlot`, `variantSlot`) are immutable StageExecution request inputs included in deterministic serialization, `canonical_input_hash`, and `idempotency_key`. They are not canonical entity fields. Exact retry converges through StageExecution output refs; distinct slots remain distinct.
5. Strategy Gate is deterministic code. Outcome/reasons are StageExecution logical result plus append-only `audit_events`; no `StrategyGateResult` entity/table.
6. SPEC05 handoff is a validated DTO/port only. It creates no ContentAssertion/evaluation/release state and performs no external side effect.

## Stage authority matrix

| Stage | Exact authoritative inputs | May produce / decide | Mandatory enforcement layers | Forbidden bypasses | Locked mapping |
|---|---|---|---|---|---|
| `AUDIENCE_PROVISIONAL` | Exact Task/Program/Channel revisions; admitted knowledge/gap/trace/epistemic/governance refs; RunConfig; tenant/workspace; cycle/stage/epoch; `stateStage=PROVISIONAL`; canonical hash | One immutable structured AudienceState; explicit origin/uncertainty | Context allowlist and trust labels; pinned revision resolver; schema/semantic validator; short dual-fenced transaction; same-tx registry, row, output ref, audit/outbox | Hidden/live/future knowledge; cross-tenant context; `CURRENT` pointer; provider commit; confidence from absence | AV03–06,08–10,61-equivalent retry rule; PF03–04,06,23–29,32; AC01,03–04,20–28 |
| `AUDIENCE_REFINE` | Above plus exact prior audience ref and changed admitted knowledge/governance dependency set; `stateStage=REFINED` | New immutable state only; request governance refresh when dependencies change | Dependency fingerprint/classifier; no UPDATE; origin/uncertainty preservation; dual fence and atomic outbox | Mutate prior state; relabel prior row; omit changed jurisdiction/governance dependency | AV02–03,05,07,71–72; PF03–04,18,27–29; AC01,03–04,21,27–29 |
| `AUDIENCE_FINALIZE` | Exact refined/provisional inputs; final gaps; refreshed PRE_GENERATION_FINAL governance; `stateStage=FINAL_FOR_DECISION` | New exact final AudienceState usable by strategy path | Finality validator; task equality; final knowledge boundary; explicit uncertainty; dual fence | Treat `REFINED` as final; mutable current pointer; omit decision-relevant available knowledge | AV01–02,04–09; PF03–06,09,12–13; AC01–04,07–11 |
| `STRATEGY_GENERATE` | Exact final audience; Task/Program/Outcome/Channel; final gaps; exact decision-time epistemic and PRE_GENERATION_FINAL applicability refs; RunConfig; `strategySlot`; canonical hash | One immutable StrategyHypothesis and required-proposition links per slot | Grounding/explicit-limit validator; pinned provider/config port; trust-layer prompt; dual-fenced atomic insert/registry/output refs/audit/outbox | Non-final/wrong-task audience; hidden factual premise; delete unknowns; treat risk/performance hypotheses as truth; unpinned model | AV11–13,19–20,26–29,63; PF05–08,23–29,32; AC02–06,19–23,25–28 |
| `STRATEGY_GATE` | Exact strategy/final audience; terminal gaps; each required proposition's exact decision-time EpistemicStateVersion; PRE_GENERATION_FINAL applicability; pinned Task/Program/Channel; gate config; exact ref manifest/hash | Deterministic `PROCEED`, `BLOCKED`, or `HUMAN_REVIEW_REQUIRED` plus stable reason codes; no entity | Pure truth table; complete-set checks; reject missing/contradicted/insufficient proof; non-overridable governance; StageExecution/audit metadata; semantic-equivalence tests | Model/human judgment; missing input defaults pass; hidden post-boundary lookup; budget bypass; mutable reason; canonical gate table | AV14–25,30; PF01–02,09–13,23,27–29,32; AC05–11,20,25–28 |
| `ARCHITECTURE_GENERATE` | Exact gate `PROCEED`; Task; final audience; admitted strategy; explicit relevant epistemic/applicability/guidance refs; Channel; RunConfig; `architectureSlot`; allowlisted minimized context/hash | New immutable Architecture, Units, unit/proposition links; optional supersedes ref | No datastore handle in provider port; context admission manifest; task/strategy closure; order/capability checks; supplemental proof rule; material-change classifier; dual-fenced atomic graph/registry/output refs/audit/outbox | Generate after block/review; unrestricted tenant store; duplicate/undefined order; unsupported channel; hidden second strategy; mutation/stale governance | AV24,31–40,64,67,72–74; PF14–18,23–29,32; AC11–15,20–29 |
| `CANDIDATE_GENERATE` | Exact Task/final audience/admitted strategy/architecture/units/propositions/governance/Channel; exact RunConfig revisions; generation-approved sources; `variantSlot`; context manifest/hash | One immutable schema-valid candidate per exact slot; non-authoritative malformed/duplicate pruning | Four trust layers; pinned least-privilege provider/tool port; closure/payload/format/meaning checks; exact retry convergence; dual-fenced atomic registry/row/output refs/audit/outbox | Stale/mismatched refs; current config; invented facts/certainty; weakened hard rule; prompt/tool escalation; external side effect; self-certification | AV41–62,65–74,77–80; PF19,21–32; AC16,18–32 |
| `CANDIDATE_REWRITE` | Explicit parent candidate; structured evaluation/human request as untrusted input; actual current Task/strategy/architecture/RunConfig; new `variantSlot`; context/hash | New candidate ID with optional parent; fresh SPEC06 handoff eligibility only | Parent/closure validator; factual-new-information classifier; no inherited evaluation/release refs; dual-fenced insert/outbox | UPDATE parent; copy validation/release status; human text as Evidence; retain stale architecture/strategy refs | AV43,46–48,71–76,79; PF19–23,27–32; AC16–21,25–32 |
| `SPEC06_HANDOFF` | Persisted candidate plus exact task/strategy/architecture/RunConfig closure; parsed payload; writable/valid decision path; relevant pinned context refs | Internal handoff DTO/event only | Read-back closure validator; cycle validity check; typed port with no SPEC06 implementation; atomic outbox provenance | Create assertions/evaluations/risk/readiness; inherit validation; publish; call provider during replay | AV47–48,60,75,77–80; PF26,30–32; AC17–24,29–32 |
| Historical replay | Stored immutable candidate and lineage only | Read historical result | Repository read path; no provider/tool port reachable | Regenerate with current model; claim byte-identical reproduction; rewrite history | AV79; PF23–24,30–32; AC19–20,30 |

## Cross-layer enforcement matrix

| Layer | Required enforcement | Failure result |
|---|---|---|
| Pure domain | Frozen shapes; deterministic serialization; stable reason codes; trust labels; exact closure; unknown/assumption/governance propagation; material-change classification | Typed validation error; no provider call or write |
| Context admission | Explicit allowlist, tenant/workspace authorization, DataScope, attribution, decision relevance, secret exclusion, generation-use admission | `GENERATION_CONTEXT_STALE` or `TENANT_SCOPE_VIOLATION`; no provider call |
| Provider port | Exact prompt/model/tool/schema refs from RunConfig; stage allowlist; no DB/publication/control-plane capability; timeout/fallback only if already pinned | Retry/fail/review; no unpinned substitution |
| Transaction boundary | Reload and lock StageExecution/cycle; verify run, current cycle, cycle ID/epoch/status, stage name, tenant/workspace, lease owner/expiry/token, hash/key; revalidate all canonical refs | Rollback; stable stale/scope/closure error |
| Canonical persistence | Insert-only entity graph; same-tx immutable registry; self-FK/order/link guards where DB-expressible; exact retry returns existing output refs | One effect per slot or conflict; never overwrite |
| Operational/audit | Stage output refs; deterministic gate audit event; atomic outbox; reconstructable input/ref/hash/config/fence manifest; sensitive prompt bodies excluded | Incomplete transaction rolls back |
| Static boundary | Domain dependency rule; forbidden runtime `CURRENT/LATEST/ACTIVE`; no SPEC06/publication/control-plane adapter reachability; no new canonical entity | Preflight failure |

## Locked reverse mapping

| Locked set | Exact ownership |
|---|---|
| AV01–10 | Audience finality, immutability, origin/uncertainty, governance refresh, explicit selection, time/scope isolation |
| AV11–20 | Strategy task/finality/grounding and gate knowledge/governance/limit closure |
| AV21–30 | Deterministic gate authority, stable reasons, hypothesis boundaries, pinned config, no budget bypass |
| AV31–40 | Architecture closure/immutability/order/supplemental proof/context minimization/governance/channel |
| AV41–50 | Candidate closure/config/immutability/no inherited authority/schema admission |
| AV51–60 | Meaning preservation, trust hierarchy, tool/source boundary, no side effects |
| AV61–70 | Slot idempotency, intentional diversity, dual fencing, scope-aware cache/context |
| AV71–80 | Dependency invalidation, rewrite/new-info semantics, no self-certification, replay, no Control Plane mutation |
| PF01–08 | Frozen entity/process/audience/strategy ownership and grounding |
| PF09–13 | Complete deterministic fail-closed Strategy Gate |
| PF14–18 | Immutable architecture, closure, unit refs/order, no hidden strategy |
| PF19–24 | Immutable candidate/rewrite/closure and pinned config/provider/tool revisions |
| PF25–29 | Untrusted source, no side effects, FREEZING/stale-worker, tenant isolation |
| PF30–32 | Candidate boundary, SPEC06 ownership, single source of decision truth |
| AC01–10 | Audience/strategy immutability, exact state, grounding, deterministic knowledge gate |
| AC11–20 | Governance block; architecture/unit/candidate closure; new identity; exact RunConfig; no ambient config |
| AC21–30 | Meaning/trust/tool/side-effect boundaries; idempotency/fencing/scope/invalidation; SPEC06 ownership |
| AC31–32 | Exact `80/80` adversarial and `32/32` static preflight success |

## Attacker audit obligations

- Attempt mixed-tenant IDs, public-proposition/private-evidence pivot, workspace omission, cache poisoning, and guessed IDs at read, context, and commit boundaries.
- Attempt stage/cycle substitution, old epoch/token, lease takeover, cancelled/superseded/FREEZING cycle, changed hash under same key, and duplicate concurrent slot commits.
- Inject source/human text that requests tool escalation, policy override, secret disclosure, Control Plane mutation, publication, or READY/supported self-certification.
- Activate later prompt/model/tool revisions mid-run; remove pinned config; force timeout; attempt unpinned fallback and historical replay through generation.
- Introduce supplemental proposition, duplicate unit position, unsupported channel format, stale architecture, factual rewrite, and material strategy change without upstream regeneration.

## Resolved implementation judgments

- Preserve manual forward-migration convention: add idempotent `0006` and explicitly apply `0000`–`0006` in disposable live M4 setup. Do not re-register/reshape M2–M3 migrations in M4. Record `db:migrate` journal parity as mechanically unproven deployment debt unless separately evidenced.
- Introduce minimal `application`, `providers/models`, and thin `workflow/stages/content-intelligence` ports because provider-outside-transaction and StageExecution binding are SPEC05 runtime behavior. Add no public API.
- Use multi-tenant decision-cycle execution as M4 acceptance mode. Preserve existing standalone infrastructure, but expose no standalone M4 canonical-write path.
- Persist gate outcome/reasons through StageExecution completion/output refs plus append-only audit/outbox metadata. Never add a gate entity/table or frozen schema field.

## Unresolved questions

- None. Any deviation requires a concrete upstream frozen-contract contradiction and plan amendment; convenience is insufficient.
