# M4 mechanically unproven requirements

Status: non-blocking internal limitations; no external PASS claim.

- Real vendor model behavior is not exercised. Provider-independent schema, pinning,
  context, authority, and persistence boundaries are mechanically tested.
- Prompt-injection resistance and semantic meaning preservation cannot be proven for all
  future model outputs; the runtime fails closed on the explicit structural classifiers.
- The local live suite proves PostgreSQL behavior on the configured test instance, not all
  managed PostgreSQL versions, failover modes, or production role provisioning paths.
- Migration `0006` is an additive SQL migration and is idempotently applied/tested, but the
  existing Drizzle metadata journal predates it and was not rewritten in M4.
- Queue transport and downstream SPEC06 processing are outside M4. Only the typed handoff
  boundary and absence of M5/SPEC06 canonical writes are proven here.
- External red-team review and external milestone closure remain pending by design.

Unresolved P0/P1 mechanically unproven claims: none.
