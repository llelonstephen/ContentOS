# ContentOS

**Evidence-Grounded Content Operating System**

Implementation of ContentOS Blueprint v2.13.1 (FROZEN).

## Project documentation

- [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) — System purpose, bounded contexts, and conceptual foundations
- [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md) — **Start here:** authoritative handoff, current milestone status, and baseline metrics
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Subsystem architecture, derivation cycles, and relational patterns
- [docs/SECURITY_INVARIANTS.md](docs/SECURITY_INVARIANTS.md) — Non-negotiable security, isolation, and fencing invariants
- [docs/MILESTONES.md](docs/MILESTONES.md) — Historical milestone verification records (M0–M4)
- [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) — Audit-driven development lifecycle and operating rules
- [docs/adr/](docs/adr/) — Architecture Decision Records (ADR-001 through ADR-006)

> [!NOTE]
> `docs/CURRENT_STATUS.md` is the first file a new contributor or coding agent should read before exploring or modifying the codebase.

## Architecture

```text
MODULAR MONOLITH + DURABLE WORKFLOW + TRANSACTIONAL RELATIONAL DATABASE
+ IMMUTABLE OBJECT STORAGE + DURABLE QUEUE + TRANSACTIONAL OUTBOX
```

See `ContentOS_Blueprint_v2.13.1_FROZEN.md` for full architecture.

## Technology Stack

| Component | Technology |
|---|---|
| Language | TypeScript (strict mode) |
| Runtime | Node.js |
| Database | PostgreSQL + Drizzle ORM |
| Queue | BullMQ (Redis) |
| API | Fastify |
| Object Store | Local FS (dev) / S3 (prod) |
| Tests | Vitest + fast-check |

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Start PostgreSQL and Redis (e.g., via Docker)
docker run -d --name contentos-pg -e POSTGRES_USER=contentos -e POSTGRES_PASSWORD=contentos -e POSTGRES_DB=contentos -p 5432:5432 postgres:16
docker run -d --name contentos-redis -p 6379:6379 redis:7

# Push schema to database
npm run db:migrate

# Run tests
npm test

# Type check
npm run typecheck

# Start dev server
npm run dev
```

## Project Structure (SPEC01 §131)

```text
src/
  api/                    # HTTP API layer
  application/            # Application services
    content-intelligence/ cycles/ decisions/ measurement/ publication/ reviews/ runs/ tasks/
  domain/                 # Domain logic (no infra deps)
    control_plane/ knowledge/ audience/ strategy/ content/
    validation/ governance/ decision/ publication/ measurement/
    learning/ shared/
  workflow/               # Durable workflow
    stages/ leases/ fencing/ freeze/
  providers/              # External integrations
    models/ retrieval/ measurement/
  persistence/            # Data layer
    relational/schema/    # Drizzle schema
    relational/migrations/# Database migrations
    objects/              # Object store
    outbox/               # Transactional outbox
  events/                 # Event system
    publisher/ consumers/ receipts/
  security/               # Auth/AuthZ
  observability/          # Logging, tracing, metrics
  tests/                  # Test suites
    unit/ integration/ property/ concurrency/ failure_injection/
```

## Dependency Direction (SPEC01 §132)

```text
API → APPLICATION → DOMAIN ← INFRASTRUCTURE ADAPTERS
```

Domain MUST NOT import from infrastructure, API, events, providers, or workflow.

## Implementation Milestones

| Milestone | Status |
|---|---|
| M0 — Repository / Toolchain / Infrastructure | EXTERNALLY CLOSED (`m0-v3-verified`) |
| M1 — System Architecture + Persistence | EXTERNALLY CLOSED (`m1-v7-verified`) |
| M2 — Evidence / Proposition / Epistemic State | EXTERNALLY CLOSED (`m2-v9-verified`) |
| M3 — Governance / Policy Engine | EXTERNALLY CLOSED (`m3-v9-verified`) |
| M4 — Content Intelligence Runtime | EXTERNALLY CLOSED (`m4-v1-verified`) |
| M5 — Evaluation Framework | SPEC FROZEN / IMPLEMENTATION PENDING |
| M6 — Security / Privacy / Rights | PENDING |
| M7 — V1A Decision Core | PENDING |
| M8 — Measurement / Experimentation / Learning | PENDING |
| M9 — V1B Learning Closure | PENDING |
| M10 — Full System Integration Audit | PENDING |

## Frozen Specification Files and Milestone Approval

Only explicitly FROZEN specification artifacts (`*_FROZEN.md`) are normative for ContentOS. Each milestone pins the exact frozen specification revision required for its implementation scope.

Upstream frozen specifications exist for future milestones (e.g., `SPEC06` through `SPEC10`), but their existence in the repository does not constitute an approved implementation target. Prior to commencing implementation on any new milestone, the corresponding frozen specification must undergo an independent specification audit, verify its cryptographic hash, and be formally designated as the active milestone target. Implementation must never begin merely because a specification file exists.
