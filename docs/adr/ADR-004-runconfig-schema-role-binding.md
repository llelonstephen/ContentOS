# ADR-004: RunConfigSchemaRoleBinding and Exact SchemaDefinition Membership

## Status
Accepted (Milestone M4)

## Context
SPEC05 v1.0.4 and v1.0.5 require that content intelligence stages (such as Audience derivation) project unstructured model proposals into typed, verifiable assertions using projection rules defined within a registered `SchemaDefinition`. If a run could execute against an unpinned or arbitrary schema, or if schemas were identified merely by a loose name or unstable revision ID without explicit binding to the `RunConfig`, historical replays could deviate, and runtime workers could substitute untracked projection rules.

## Decision
We enforce a normalized, relational **Schema Role Binding** model:
1. **Normalized Schema Membership (`run_config_schema_revisions`)**:
   - Every schema used by a run must be explicitly registered as a member of the run's `RunConfig`.
   - Membership is tracked as an exact 4-tuple: `(run_config_id, entity_type, stable_id, revision_id)`.
   - The primary key covers all four fields, allowing multiple revisions of the same stable schema or different schemas with similar revision tags to coexist unambiguously.
   - A check constraint enforces `entity_type = 'SchemaDefinition'`.
2. **Explicit Schema Role Bindings (`run_config_schema_role_bindings`)**:
   - Functional roles (e.g., `CONTENT_INTELLIGENCE_AUDIENCE`) are bound explicitly to a schema member.
   - A foreign key constraint (`fk_run_config_schema_role_member`) guarantees that a role can only be assigned to a schema that is already an active member in `run_config_schema_revisions`.
3. **Database Completeness Trigger**:
   - The PostgreSQL trigger `trg_run_config_audience_role_complete` runs before run execution, failing closed if a required schema role binding is missing or incomplete.
4. **Byte-Exact Payload Verification**:
   - The schema payload is fetched from object storage using the SHA256 payload hash registered in `registered_control_plane_revision_payloads`, ensuring that schema AST rules cannot be mutated in place.

## Security/Correctness Properties
- **No Unpinned Schema Substitution**: A worker cannot execute a stage using a schema that was not cryptographically pinned in the `RunConfig`.
- **Zero Ambiguity on Revision Collisions**: Identifying schemas by `(entity_type, stable_id, revision_id)` prevents collisions between different schema definitions that share revision labels.
- **Relational Integrity Guaranteed**: Database foreign keys prevent inserting a role binding for an unreferenced schema.

## Rejected Alternatives
- **In-Memory Schema JSON in RunConfig Parameters**: Storing the full raw schema JSON inside `run_configs.runtime_parameters`. Rejected because schemas are reusable control-plane entities that must be independently versioned, audited, and referenced by SHA256 payload hash.
- **Bare String Schema Name Binding**: Storing a string like `schema_name: 'audience-v1'` in `RunConfig`. Rejected because it allows silent schema mutation without generating a new immutable revision ID.

## Consequences
- Seeding test or production `RunConfig` records requires inserting both the member row into `run_config_schema_revisions` and the role binding row into `run_config_schema_role_bindings`.
- RunConfig canonical hash computation includes all schema members and role bindings deterministically sorted.

## Related Specs/Tags
- `ContentOS_SPEC02_Domain_Data_Model_v1.0.6_FROZEN.md`
- `ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.5_FROZEN.md` (§3, §4)
- Tag: `m4-v1-verified`
