# ADR-002: Control-Plane Authority Isolation and Non-Forgeable Authorization Boundary

## Status
Accepted (Milestone M1 / M2)

## Context
In ContentOS, canonical control-plane entities—such as `TaskContractRevision`, `MetricDefinitionRevision`, `SchemaDefinition`, and `ContentProgramRevision`—define the authoritative governance rules, evaluation standards, and data contracts that govern all runs. If runtime execution workers or client API callers could register, mutate, or substitute control-plane revisions on the fly, runtime workers could escalate privileges, weaken quality thresholds, or forge audit trails.

## Decision
We enforce a strict separation between **Control-Plane Authority** and **Runtime Worker Authority**:
1. Control-plane entities are registered exclusively through dedicated control-plane management services (`ControlPlanePersistenceService` in `src/persistence/relational/services/control-plane-persistence-service.ts`) backed by database role privilege separation.
2. At the database level, PostgreSQL roles enforce least-privilege access:
   - `contentos_control_plane_role`: Holds privileges to insert into `revision_registry` and registered control-plane payload tables.
   - `contentos_runtime_role`: Holds privileges to claim stage executions, execute runs, and insert runtime derivation outputs, but is denied direct write privileges to control-plane revision tables.
3. Standalone writes and control-plane registrations verify active session principals at connection checkout (Vector 60 enforcement), preventing session spoofing.
4. Runtime derivation code receives control-plane entities strictly through trusted server-side resolvers (`TrustedPreProviderResolver` in `src/persistence/relational/services/trusted-pre-provider-resolver.ts`) querying canonical database tables, never from caller-supplied payload overrides.

## Security/Correctness Properties
- **Non-Forgeable Contracts**: A runtime worker cannot forge a task contract or insert an ad-hoc schema revision mid-run.
- **Relational Immutability**: All registered control-plane revisions are protected by PostgreSQL triggers (`trg_immutable_*`), rejecting any `UPDATE` or `DELETE`.
- **Session Principal Verification**: The database rejects operations if the connecting user does not possess the requisite PostgreSQL role membership.

## Rejected Alternatives
- **Single Universal DB User with Application-Level Role Checks**: Relying solely on application-level TypeScript `if (user.role === 'admin')` checks using a single database superuser. Rejected because an SQL injection or compromised application worker would have full write access to all control-plane tables.
- **Dynamic Control-Plane Creation in Orchestrator**: Allowing the orchestrator to automatically create missing schemas on the fly. Rejected because it violates preflight auditability and reproducibility.

## Consequences
- Migrations must grant explicit, least-privilege permissions to `contentos_control_plane_role` and `contentos_runtime_role`.
- Test suites must seed control-plane fixtures via `ControlPlanePersistenceService` prior to running runtime tests.

## Related Specs/Tags
- `ContentOS_SPEC01_System_Architecture_v1.1.3_FROZEN.md`
- `ContentOS_SPEC02_Domain_Data_Model_v1.0.6_FROZEN.md` (§37 Adversarial Vector 60)
- Tags: `m1-v6-verified`, `m1-v7-verified`, `m2-v7-verified`
