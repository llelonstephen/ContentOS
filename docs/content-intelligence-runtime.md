# M4 Content Intelligence Runtime

M4 implements SPEC05 v1.0.1 only. It creates AudienceState, StrategyHypothesis,
deterministic Strategy Gate outcomes, ContentArchitecture/ContentUnit graphs, and
ContentCandidate versions. It does not evaluate, approve, release, or publish content.

## Authority path

Every canonical write requires an exact tenant/workspace, running Run, current OPEN
DecisionCycle, cycle epoch, RUNNING StageExecution, stage-specific lease and fencing
token, stage name, canonical input hash, idempotency key, pinned RunConfig, and required
operational slot. Provider output has proposal authority only.

The persistence phase is a short transaction: verify both fences, insert registry
identity, insert the immutable graph, resolve exact scoped output refs, complete the
StageExecution, and append audit/outbox records. Exact completed retries resolve stored
output refs; they do not call a provider or create another immutable entity.

## Stage ownership

| Stage | Canonical result |
|---|---|
| Audience provisional/refine/finalize | New immutable AudienceState |
| Strategy generate | New StrategyHypothesis and exact proposition links |
| Strategy Gate | StageExecution result/output refs only; no gate entity |
| Architecture generate | New Architecture, ordered Units, and proposition links |
| Candidate generate/rewrite | New Candidate; rewrite keeps exact parent lineage |
| SPEC06 handoff | Typed internal DTO/event only |

Stage-to-artifact binding is enforced before persistence and again by exact DB fencing.
The runtime role can insert required immutable/output/audit/outbox rows and complete a
StageExecution, but cannot update/delete immutable M4 state or mutate the outbox.

## Generation boundary

RunConfig pins prompt, model, tool, schema, and canonical input hash. Context admission
requires exact attribution, tenant/workspace authorization, decision relevance,
generation permission, freshness, and no secrets or authority escalation. Provider
context is detached inert JSON; it contains no datastore, publication, Control Plane,
or general tool capability.

Architecture receives only a minimized exact-reference manifest and its scoped values.
Supplemental proposition proof/classification comes from the canonical resolver, never
from the provider proposal. Factual supplemental use must have an exact decision-time
epistemic state and an admissible support status. Material meaning changes require a new
StrategyHypothesis and another deterministic gate.

## Immutability and isolation

M4 uses insert-only entities with explicit supersedes/parent lineage. PostgreSQL guards
require registry identity and exact tenant/workspace scope for Task, Audience, Strategy,
Architecture, Unit, Proposition, RunConfig, and parent relationships. FREEZING/FROZEN,
superseded cycles, stale epochs, stale leases, wrong hashes, and wrong stage identities
fail closed.

Historical replay reads the stored Candidate. It never regenerates with a current model
or claims byte-identical provider reproduction.

## SPEC06 boundary

M4 may emit only a validated handoff containing the persisted Candidate and exact pinned
lineage/context references. Assertion extraction, evaluation, risk/readiness, approval,
release, publication, and self-certification remain owned by SPEC06 and later milestones.
