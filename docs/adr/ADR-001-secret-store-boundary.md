# ADR-001: SecretStore and Domain Secret-Reference Boundary

## Status
Accepted (Milestone M0 / M1)

## Context
Enterprise content systems interface with third-party model providers, social platform publishing APIs, and external vector retrieval services requiring sensitive credentials (e.g., API keys, OAuth tokens, signing secrets). Passing raw credential strings through domain entities, application states, or event payloads introduces severe risks of accidental exposure via structured logging, relational persistence, in-memory crash dumps, or event serialization.

## Decision
We enforce a strict **SecretStore abstraction boundary**:
1. Domain entities and application configurations **never** handle raw plaintext secrets.
2. Secrets are represented within domain structures and `RunConfig` runtime parameters exclusively through opaque, typed `SecretReference` tokens (`src/domain/shared/types.ts`) containing `secret_id`, `version_or_alias`, and `expected_purpose`.
3. The `ISecretStore` interface is defined in `src/security/secrets/secret-store-interface.ts` and implemented strictly within infrastructure adapters (e.g., `EnvSecretStore` in `src/security/secrets/env-secret-store.ts`).
4. Plaintext secret resolution occurs only at the edge of the system: inside the specific transport adapter (e.g., HTTP model client or database driver) immediately prior to wire transmission via `ISecretStore.resolveSecret(ref)`.
5. Secret values are masked in memory and strictly prohibited from appearing in log streams or error messages.

## Security/Correctness Properties
- **Zero Accidental Leakage**: Domain models and logs contain only opaque identifiers.
- **Auditable Key Rotation**: Rotating a key in the SecretStore requires no update to historical `RunConfig` records or canonical derivation graphs.
- **Fail-Closed on Resolution Failure**: If a `SecretReference` cannot be resolved at call-time, the adapter fails closed immediately before outbound communication.

## Rejected Alternatives
- **Environment Variable Fallback in Domain**: Allowing domain services to read `process.env` directly. Rejected because it bypasses tenant isolation and audit logging.
- **Encrypted Secret Payloads in RunConfig**: Storing encrypted ciphertexts inside relational database columns. Rejected because rotating keys invalidates historical cryptographic hashes.

## Consequences
- Every outbound provider client must accept an `ISecretStore` dependency or resolved auth token header at point of transmission.
- Unit tests for domain logic can run completely offline without dummy API keys or secret mocks.

## Related Specs/Tags
- `ContentOS_SPEC01_System_Architecture_v1.1.3_FROZEN.md` (§131)
- `ContentOS_SPEC08_Security_Privacy_Rights_v1.0.1_FROZEN.md`
- Tags: `m0-v2-verified`, `m0-v3-verified`
