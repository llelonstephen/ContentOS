# ContentOS

**Evidence-Grounded Content Operating System**

Implementation of ContentOS Blueprint v2.13.1 (FROZEN).

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
npm run db:push

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
    tasks/ runs/ cycles/ reviews/ decisions/ publication/ measurement/
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
| M0 — Repository / Toolchain / Infrastructure | IN PROGRESS |
| M1 — System Architecture + Persistence | PENDING |
| M2 — Evidence / Proposition / Epistemic State | PENDING |
| M3 — Governance / Policy Engine | PENDING |
| M4 — Content Intelligence Runtime | PENDING |
| M5 — Evaluation Framework | PENDING |
| M6 — Security / Privacy / Rights | PENDING |
| M7 — V1A Decision Core | PENDING |
| M8 — Measurement / Experimentation / Learning | PENDING |
| M9 — V1B Learning Closure | PENDING |
| M10 — Full System Integration Audit | PENDING |

## Frozen Specification Files

All 11 specification files are authoritative. See implementation instructions for precedence rules.
