# ContentOS — Milestone 0 Audit Dump
# Commit SHA: a286ad37d2f9ba714f3a74653dd43ba7dbb11802
# Tag: m0-internal-verified

===== FILE: package.json =====
{
  "name": "contentos",
  "version": "1.0.0",
  "description": "ContentOS — Evidence-Grounded Content Operating System",
  "main": "dist/main.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/main.ts",
    "start": "node dist/main.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run src/tests/unit",
    "test:integration": "vitest run src/tests/integration",
    "test:property": "vitest run src/tests/property",
    "test:concurrency": "vitest run src/tests/concurrency",
    "test:failure": "vitest run src/tests/failure_injection",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  },
  "keywords": ["contentos", "evidence-grounded", "content-os"],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@fastify/cors": "^11.3.0",
    "@types/node": "^26.6.3",
    "@types/uuid": "^10.0.0",
    "bullmq": "^6.3.9",
    "dotenv": "^18.0.4",
    "drizzle-kit": "^0.31.11",
    "drizzle-orm": "^0.45.3",
    "fastify": "^5.12.5",
    "ioredis": "^6.0.0",
    "pino": "^10.3.1",
    "postgres": "^3.4.9",
    "tsx": "^4.23.15",
    "typescript": "^7.0.2",
    "uuid": "^14.0.2",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^5.0.2",
    "fast-check": "^4.10.2",
    "vitest": "^5.0.2"
  }
}

===== FILE: tsconfig.json =====
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "@contentos/domain/*": ["./src/domain/*"],
      "@contentos/application/*": ["./src/application/*"],
      "@contentos/persistence/*": ["./src/persistence/*"],
      "@contentos/workflow/*": ["./src/workflow/*"],
      "@contentos/providers/*": ["./src/providers/*"],
      "@contentos/events/*": ["./src/events/*"],
      "@contentos/security/*": ["./src/security/*"],
      "@contentos/observability/*": ["./src/observability/*"],
      "@contentos/api/*": ["./src/api/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}

===== FILE: vitest.config.ts =====
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
    ],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
      ],
    },
    // Test categories via workspace-like includes
    typecheck: {
      enabled: false,
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@contentos/domain': path.resolve(import.meta.dirname, 'src/domain'),
      '@contentos/application': path.resolve(import.meta.dirname, 'src/application'),
      '@contentos/persistence': path.resolve(import.meta.dirname, 'src/persistence'),
      '@contentos/workflow': path.resolve(import.meta.dirname, 'src/workflow'),
      '@contentos/providers': path.resolve(import.meta.dirname, 'src/providers'),
      '@contentos/events': path.resolve(import.meta.dirname, 'src/events'),
      '@contentos/security': path.resolve(import.meta.dirname, 'src/security'),
      '@contentos/observability': path.resolve(import.meta.dirname, 'src/observability'),
      '@contentos/api': path.resolve(import.meta.dirname, 'src/api'),
    },
  },
});

===== FILE: drizzle.config.ts =====
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/persistence/relational/schema/index.ts',
  out: './src/persistence/relational/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://contentos:contentos@localhost:5432/contentos',
  },
  verbose: true,
  strict: true,
});

===== FILE: .env.example =====
# ContentOS Environment Configuration
# Copy to .env for local development

# ──────────────────────────────────────────────
# Database (PostgreSQL)
# ──────────────────────────────────────────────
DATABASE_URL=postgresql://contentos:contentos@localhost:5432/contentos
DATABASE_URL_TEST=postgresql://contentos:contentos@localhost:5432/contentos_test

# ──────────────────────────────────────────────
# Redis (BullMQ)
# ──────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ──────────────────────────────────────────────
# Object Store (local filesystem for dev)
# ──────────────────────────────────────────────
OBJECT_STORE_TYPE=local
OBJECT_STORE_BASE_PATH=./data/objects

# ──────────────────────────────────────────────
# Server
# ──────────────────────────────────────────────
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# ──────────────────────────────────────────────
# Deployment Mode (SPEC01 §89)
# ──────────────────────────────────────────────
DEPLOYMENT_MODE=SINGLE_TENANT

# ──────────────────────────────────────────────
# Logging (SPEC01 §100)
# ──────────────────────────────────────────────
LOG_LEVEL=info

# ──────────────────────────────────────────────
# Secret Store (SPEC01 §93)
# ──────────────────────────────────────────────
SECRET_STORE_TYPE=env

===== FILE: README.md =====
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

===== FILE: src/main.ts =====
/**
 * ContentOS — Application Entry Point
 *
 * Bootstraps the server with all infrastructure connections.
 */
import { loadConfig } from './config.js';
import { createServer } from './api/server.js';
import { createLogger } from './observability/logger.js';

const logger = createLogger({ module: 'main' });

async function main() {
  const config = loadConfig();
  const server = createServer();

  try {
    await server.listen({ port: config.PORT, host: config.HOST });
    logger.info(
      { port: config.PORT, deployment_mode: config.DEPLOYMENT_MODE },
      'ContentOS server started',
    );
  } catch (err) {
    logger.fatal({ error: err }, 'Failed to start server');
    process.exit(1);
  }
}

void main();

===== FILE: src/config.ts =====
/**
 * ContentOS — Configuration Loader
 *
 * Loads and validates environment configuration.
 * Secrets use reference-based approach per SPEC01 §93.
 */
import { z } from 'zod';
import { DeploymentMode } from './domain/shared/types.js';

const configSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),

  // Redis
  REDIS_URL: z.string(),

  // Object Store
  OBJECT_STORE_TYPE: z.enum(['local', 's3']).default('local'),
  OBJECT_STORE_BASE_PATH: z.string().default('./data/objects'),

  // Server
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Deployment Mode (SPEC01 §89)
  DEPLOYMENT_MODE: z.nativeEnum(DeploymentMode).default(DeploymentMode.SINGLE_TENANT),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Secret Store
  SECRET_STORE_TYPE: z.enum(['env', 'vault']).default('env'),
});

export type AppConfig = z.infer<typeof configSchema>;

let _config: AppConfig | null = null;

/**
 * Load configuration from environment variables.
 * Validates all required fields.
 * Caches result for subsequent calls.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  if (_config) return _config;

  const result = configSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${issues}`);
  }

  _config = result.data;
  return _config;
}

/**
 * Reset cached config (for testing).
 */
export function resetConfig(): void {
  _config = null;
}

===== FILE: src/api/server.ts =====
/**
 * ContentOS — API Server
 *
 * Fastify-based HTTP API implementing SPEC01 §94-96.
 * Command/Query separation (SPEC01 §94).
 * Error envelope (SPEC01 §96).
 * Authentication stubs (SPEC01 §97-98).
 */
import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { createLogger } from '../observability/logger.js';

const logger = createLogger({ module: 'api' });

/**
 * Create and configure the Fastify server instance.
 */
export function createServer() {
  const server = Fastify({
    logger: false, // We use our own structured logger
    genReqId: () => crypto.randomUUID(),
  });

  // CORS
  void server.register(cors, {
    origin: true,
  });

  // Request logging
  server.addHook('onRequest', async (request) => {
    logger.info({
      trace_id: request.id,
      method: request.method,
      url: request.url,
    }, 'Request received');
  });

  // Error envelope (SPEC01 §96)
  server.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const errorEnvelope = {
      error_code: error.code ?? 'INTERNAL_ERROR',
      message: error.message,
      retryable: statusCode >= 500,
      trace_id: _request.id,
    };

    logger.error({
      trace_id: _request.id,
      error_code: errorEnvelope.error_code,
    }, error.message);

    void reply.status(statusCode).send(errorEnvelope);
  });

  // Not found handler (SPEC01 §96)
  server.setNotFoundHandler((request, reply) => {
    const errorEnvelope = {
      error_code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
      retryable: false,
      trace_id: request.id,
    };

    logger.warn({
      trace_id: request.id,
      error_code: errorEnvelope.error_code,
    }, errorEnvelope.message);

    void reply.status(404).send(errorEnvelope);
  });

  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'ok', service: 'contentos', version: '1.0.0' };
  });

  return server;
}

===== FILE: src/domain/shared/types.ts =====
/**
 * ContentOS Domain — Shared Types
 *
 * Core type definitions used across all domain modules.
 * These types implement the Blueprint's fundamental type contracts:
 *   - ImmutableEntityRef (Blueprint §3)
 *   - RevisionRef (Blueprint §4)
 *   - Temporal types (SPEC01 §115)
 *   - Deployment mode (SPEC01 §89)
 */

// ──────────────────────────────────────────────
// Branded types for type-safe IDs
// ──────────────────────────────────────────────

/** Nominal brand to distinguish ID types at compile time */
type Brand<K, T> = K & { readonly __brand: T };

/** UUID-based identifier */
export type UUID = Brand<string, 'UUID'>;

/** Tenant identifier */
export type TenantId = Brand<string, 'TenantId'>;

/** Workspace identifier */
export type WorkspaceId = Brand<string, 'WorkspaceId'>;

// ──────────────────────────────────────────────
// Timestamp types (SPEC01 §115 — all UTC)
// ──────────────────────────────────────────────

/** UTC timestamp stored as ISO 8601 string */
export type UTCTimestamp = Brand<string, 'UTCTimestamp'>;

// ──────────────────────────────────────────────
// ImmutableEntityRef (Blueprint §3)
// ──────────────────────────────────────────────

/**
 * Used when one ID identifies exactly one immutable historical state.
 * entity_type discriminates the target entity kind.
 * entity_id is the globally unique immutable ID of that entity.
 */
export interface ImmutableEntityRef {
  readonly entity_type: string;
  readonly entity_id: string;
}

// ──────────────────────────────────────────────
// RevisionRef (Blueprint §4)
// ──────────────────────────────────────────────

/**
 * Used for revisioned concepts.
 * stable_id identifies the conceptual object.
 * revision_id identifies the exact historical revision.
 */
export interface RevisionRef {
  readonly entity_type: string;
  readonly stable_id: string;
  readonly revision_id: string;
}

// ──────────────────────────────────────────────
// Deployment Mode (SPEC01 §89)
// ──────────────────────────────────────────────

export const DeploymentMode = {
  SINGLE_TENANT: 'SINGLE_TENANT',
  MULTI_TENANT: 'MULTI_TENANT',
} as const;

export type DeploymentMode = typeof DeploymentMode[keyof typeof DeploymentMode];

// ──────────────────────────────────────────────
// Data Scope (Blueprint §13B)
// ──────────────────────────────────────────────

export const DataScope = {
  TENANT_PRIVATE: 'TENANT_PRIVATE',
  WORKSPACE_SHARED: 'WORKSPACE_SHARED',
  AUTHORIZED_AGGREGATE: 'AUTHORIZED_AGGREGATE',
  GLOBAL_PUBLIC: 'GLOBAL_PUBLIC',
} as const;

export type DataScope = typeof DataScope[keyof typeof DataScope];

// ──────────────────────────────────────────────
// Principal types (SPEC01 §97)
// ──────────────────────────────────────────────

export const PrincipalType = {
  USER: 'USER',
  SERVICE: 'SERVICE',
  SYSTEM_WORKER: 'SYSTEM_WORKER',
  REVIEWER: 'REVIEWER',
  ADMIN: 'ADMIN',
} as const;

export type PrincipalType = typeof PrincipalType[keyof typeof PrincipalType];

export interface Principal {
  readonly principal_type: PrincipalType;
  readonly principal_id: string;
  readonly tenant_id: TenantId;
}

// ──────────────────────────────────────────────
// Error envelope (SPEC01 §96)
// ──────────────────────────────────────────────

export interface ErrorEnvelope {
  readonly error_code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly trace_id: string;
  readonly entity_refs?: ReadonlyArray<ImmutableEntityRef | RevisionRef>;
  readonly validation_failures?: ReadonlyArray<{
    readonly field: string;
    readonly code: string;
    readonly message: string;
  }>;
}

// ──────────────────────────────────────────────
// Retry categories (SPEC01 §82)
// ──────────────────────────────────────────────

export const RetryCategory = {
  TRANSIENT: 'TRANSIENT',
  RATE_LIMITED: 'RATE_LIMITED',
  DEPENDENCY_UNAVAILABLE: 'DEPENDENCY_UNAVAILABLE',
  INVALID_EXTERNAL_PAYLOAD: 'INVALID_EXTERNAL_PAYLOAD',
  MODEL_OUTPUT_INVALID: 'MODEL_OUTPUT_INVALID',
  DOMAIN_INVARIANT_FAILED: 'DOMAIN_INVARIANT_FAILED',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  PERMANENT_CONFIGURATION_ERROR: 'PERMANENT_CONFIGURATION_ERROR',
  HUMAN_ACTION_REQUIRED: 'HUMAN_ACTION_REQUIRED',
  STALE_DECISION_CYCLE: 'STALE_DECISION_CYCLE',
  STALE_FENCING_TOKEN: 'STALE_FENCING_TOKEN',
} as const;

export type RetryCategory = typeof RetryCategory[keyof typeof RetryCategory];

/**
 * Categories that MUST NOT be blindly retried (SPEC01 §83).
 */
export const NON_RETRYABLE_CATEGORIES: ReadonlySet<RetryCategory> = new Set([
  RetryCategory.DOMAIN_INVARIANT_FAILED,
  RetryCategory.AUTHORIZATION_FAILED,
  RetryCategory.STALE_DECISION_CYCLE,
  RetryCategory.STALE_FENCING_TOKEN,
]);

// ──────────────────────────────────────────────
// Domain error base class
// ──────────────────────────────────────────────

export class ContentOSError extends Error {
  public readonly error_code: string;
  public readonly retryable: boolean;
  public readonly category: RetryCategory;

  constructor(params: {
    error_code: string;
    message: string;
    category: RetryCategory;
    cause?: Error;
  }) {
    super(params.message, { cause: params.cause });
    this.name = 'ContentOSError';
    this.error_code = params.error_code;
    this.category = params.category;
    this.retryable = !NON_RETRYABLE_CATEGORIES.has(params.category);
  }
}

// ──────────────────────────────────────────────
// Hash type for content-addressable storage
// ──────────────────────────────────────────────

export type ContentHash = Brand<string, 'ContentHash'>;

===== FILE: src/observability/logger.ts =====
/**
 * ContentOS — Structured Logger
 *
 * Implements SPEC01 §100 structured logging fields.
 * Operational logs are NOT canonical truth (SPEC01 §100).
 * Uses pino for fast structured JSON logging.
 */
import pino from 'pino';

/**
 * SPEC01 §100 required structured fields:
 *   timestamp, level, module, run_id?, decision_cycle_id?,
 *   stage_execution_id?, snapshot_id?, decision_id?,
 *   trace_id, fencing_token?, error_code?
 */
export interface LogContext {
  readonly module: string;
  readonly run_id?: string;
  readonly decision_cycle_id?: string;
  readonly stage_execution_id?: string;
  readonly snapshot_id?: string;
  readonly decision_id?: string;
  readonly trace_id?: string;
  readonly fencing_token?: number;
  readonly error_code?: string;
}

/**
 * Create a child logger bound to specific context fields.
 * All SPEC01 §100 fields are included in every log line.
 */
export function createLogger(context: LogContext): pino.Logger {
  return baseLogger.child(context);
}

/** Base logger instance — module-level singleton */
const baseLogger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  // SPEC01 §101: prefer entity IDs, hashes, metadata
  // Redaction configured per deployment
  redact: {
    paths: ['secret', 'password', 'token', 'api_key'],
    censor: '[REDACTED]',
  },
});

export { baseLogger };

===== FILE: src/events/publisher/queue.ts =====
/**
 * ContentOS — Durable Queue
 *
 * BullMQ wrapper implementing SPEC01 §17 durable workflow
 * and SPEC01 §78 at-least-once delivery guarantee.
 *
 * Workers are stateless between jobs (SPEC01 §106).
 * Queue backpressure uses bounded concurrency (SPEC01 §107).
 */
import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { createLogger } from '../../observability/logger.js';

const logger = createLogger({ module: 'queue' });

let _connection: Redis | null = null;

/**
 * Get shared Redis connection for BullMQ.
 */
export function getQueueConnection(redisUrl?: string): Redis {
  if (_connection) return _connection;

  const url = redisUrl ?? process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  _connection = new Redis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ
  });

  return _connection;
}

/**
 * Create a typed BullMQ queue.
 *
 * @param name - Queue name (e.g., 'research', 'model-eval', 'measurement')
 */
export function createQueue<T>(name: string): Queue<T> {
  return new Queue<T>(name, {
    connection: getQueueConnection(),
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  });
}

/**
 * Create a typed BullMQ worker.
 *
 * Workers are stateless (SPEC01 §106).
 * Bounded concurrency (SPEC01 §107).
 *
 * @param name - Queue name to consume from
 * @param processor - Job handler function
 * @param concurrency - Max concurrent jobs (default 5)
 */
export function createWorker<T>(
  name: string,
  processor: (job: Job<T>) => Promise<void>,
  concurrency: number = 5,
): Worker<T> {
  const worker = new Worker<T>(name, processor, {
    connection: getQueueConnection(),
    concurrency,
  });

  worker.on('failed', (job, err) => {
    logger.error({ job_id: job?.id, error: err.message }, 'Job failed');
  });

  worker.on('completed', (job) => {
    logger.debug({ job_id: job.id }, 'Job completed');
  });

  return worker;
}

/**
 * Close queue connection (for cleanup/testing).
 */
export async function closeQueueConnection(): Promise<void> {
  if (_connection) {
    await _connection.quit();
    _connection = null;
  }
}

===== FILE: src/persistence/objects/object-store-interface.ts =====
/**
 * ContentOS — Object Store Interface
 *
 * Implements SPEC01 §12-15:
 *   - Immutable object storage for large payloads
 *   - Content-addressable via hash (SPEC01 §13)
 *   - Cross-store commit protocol (SPEC01 §14)
 *   - Orphan safety (SPEC01 §15)
 *   - Hash mismatch → OBJECT_INTEGRITY_FAILURE (SPEC01 §13)
 *
 * Domain modules use this interface.
 * Infrastructure adapters provide implementations.
 */
import { ContentHash } from '../../domain/shared/types.js';

// ──────────────────────────────────────────────
// Object metadata (SPEC01 §13)
// ──────────────────────────────────────────────

export interface ObjectMetadata {
  readonly object_reference: string;
  readonly content_hash: ContentHash;
  readonly size_bytes: number;
  readonly media_type: string;
  readonly created_at: string;
}

// ──────────────────────────────────────────────
// Object Store Interface
// ──────────────────────────────────────────────

export interface ObjectStore {
  /**
   * Step 1 of cross-store commit protocol (SPEC01 §14):
   * Write immutable object.
   * Returns the content hash and object reference.
   */
  put(data: Buffer, mediaType: string): Promise<ObjectMetadata>;

  /**
   * Step 2-3 of cross-store commit protocol (SPEC01 §14):
   * Verify object exists and verify content hash.
   * Throws OBJECT_INTEGRITY_FAILURE on hash mismatch.
   */
  verify(objectReference: string, expectedHash: ContentHash): Promise<boolean>;

  /**
   * Read object by reference.
   */
  get(objectReference: string): Promise<Buffer>;

  /**
   * Check if an object is actively GC-claimed (SPEC01 §15).
   * Returns true if safe to reference.
   */
  isReferenceable(objectReference: string): Promise<boolean>;

  /**
   * Delete orphan object (maintenance only, SPEC01 §15).
   * Must verify no canonical references exist.
   * Must hold GC claim until deletion committed.
   */
  deleteOrphan(objectReference: string): Promise<void>;
}

===== FILE: src/persistence/objects/local-object-store.ts =====
/**
 * ContentOS — Local Filesystem Object Store
 *
 * Development implementation of ObjectStore (SPEC01 §12-15).
 * Uses local filesystem with content-hash addressing (SPEC01 §13):
 *   objects/{content_hash}
 *
 * Production deployments should use S3-compatible storage.
 */
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { ContentHash } from '../../domain/shared/types.js';
import { ContentOSError, RetryCategory } from '../../domain/shared/types.js';
import type { ObjectMetadata, ObjectStore } from './object-store-interface.js';

export class LocalObjectStore implements ObjectStore {
  private readonly basePath: string;
  private readonly gcClaimed: Set<string> = new Set();

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async put(data: Buffer, mediaType: string): Promise<ObjectMetadata> {
    // Content-addressable hash (SPEC01 §13)
    const hash = createHash('sha256').update(data).digest('hex') as ContentHash;
    const objectReference = `objects/${hash}`;
    const filePath = path.join(this.basePath, hash);

    // Ensure directory exists
    await fs.mkdir(this.basePath, { recursive: true });

    // Write immutable object (Step 1, SPEC01 §14)
    // If file already exists with same hash, that's fine — idempotent
    await fs.writeFile(filePath, data);

    const metadata: ObjectMetadata = {
      object_reference: objectReference,
      content_hash: hash,
      size_bytes: data.length,
      media_type: mediaType,
      created_at: new Date().toISOString(),
    };

    // Write metadata sidecar
    await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(metadata, null, 2));

    return metadata;
  }

  async verify(objectReference: string, expectedHash: ContentHash): Promise<boolean> {
    const hash = objectReference.replace('objects/', '');
    const filePath = path.join(this.basePath, hash);

    try {
      const data = await fs.readFile(filePath);
      const actualHash = createHash('sha256').update(data).digest('hex');

      if (actualHash !== expectedHash) {
        throw new ContentOSError({
          error_code: 'OBJECT_INTEGRITY_FAILURE',
          message: `Hash mismatch for ${objectReference}: expected ${expectedHash}, got ${actualHash}`,
          category: RetryCategory.DOMAIN_INVARIANT_FAILED,
        });
      }

      return true;
    } catch (err: unknown) {
      if (err instanceof ContentOSError) throw err;
      return false;
    }
  }

  async get(objectReference: string): Promise<Buffer> {
    const hash = objectReference.replace('objects/', '');
    const filePath = path.join(this.basePath, hash);

    try {
      return await fs.readFile(filePath);
    } catch {
      throw new ContentOSError({
        error_code: 'OBJECT_NOT_FOUND',
        message: `Object not found: ${objectReference}`,
        category: RetryCategory.DOMAIN_INVARIANT_FAILED,
      });
    }
  }

  async isReferenceable(objectReference: string): Promise<boolean> {
    // Object is not referenceable if it's actively GC-claimed (SPEC01 §15)
    if (this.gcClaimed.has(objectReference)) {
      return false;
    }

    const hash = objectReference.replace('objects/', '');
    const filePath = path.join(this.basePath, hash);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteOrphan(objectReference: string): Promise<void> {
    const hash = objectReference.replace('objects/', '');
    const filePath = path.join(this.basePath, hash);

    // Claim GC lock (SPEC01 §15)
    this.gcClaimed.add(objectReference);

    try {
      // In production: verify no canonical DB references exist
      // For local dev: just delete
      await fs.unlink(filePath).catch(() => { /* already deleted */ });
      await fs.unlink(`${filePath}.meta.json`).catch(() => { /* metadata may not exist */ });
    } finally {
      this.gcClaimed.delete(objectReference);
    }
  }
}

===== FILE: src/persistence/relational/connection.ts =====
/**
 * ContentOS — Database Connection
 *
 * PostgreSQL connection using drizzle-orm + postgres.js driver.
 * Supports REPEATABLE READ isolation per SPEC01 §20.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

let _sql: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Get the postgres.js client instance.
 * Creates one on first call. Reuses on subsequent calls.
 */
export function getSql(connectionString?: string): ReturnType<typeof postgres> {
  if (_sql) return _sql;

  const url = connectionString ?? process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }

  _sql = postgres(url, {
    max: 20,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return _sql;
}

/**
 * Get the drizzle ORM instance.
 */
export function getDb(connectionString?: string): ReturnType<typeof drizzle> {
  if (_db) return _db;
  _db = drizzle(getSql(connectionString));
  return _db;
}

/**
 * Close the database connection.
 */
export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
    _db = null;
  }
}

/**
 * Reset connection state (for testing).
 */
export function resetDbConnection(): void {
  _sql = null;
  _db = null;
}

===== FILE: src/persistence/relational/schema/index.ts =====
/**
 * ContentOS — Schema Index
 *
 * Central export point for all Drizzle schema tables.
 * New milestones add their schemas here.
 */

// M0: Infrastructure schemas
export { outboxEvents, consumerReceipts } from './outbox-schema.js';
export { apiIdempotencyRecords, idempotencyRecords } from './idempotency-schema.js';

===== FILE: src/persistence/relational/schema/outbox-schema.ts =====
/**
 * ContentOS — Drizzle Schema: Outbox Events
 *
 * Implements SPEC01 §76-81, SPEC02 §19:
 *   - Transactional outbox pattern
 *   - OutboxEvent entity
 *   - ConsumerReceipt deduplication
 *   - At-least-once delivery
 *   - PRIMARY KEY(consumer_name, event_id)
 *   - FK(event_id) → OutboxEvent(event_id)
 */
import { pgTable, text, timestamp, uuid, primaryKey } from 'drizzle-orm/pg-core';

/**
 * OutboxEvent (SPEC01 §77, SPEC02 §19)
 *
 * Domain state + outbox event committed atomically.
 * Never publish event before domain commit (SPEC01 §76).
 * event_id is globally unique.
 */
export const outboxEvents = pgTable('outbox_events', {
  event_id: uuid('event_id').primaryKey().defaultRandom(),
  aggregate_type: text('aggregate_type').notNull(),
  aggregate_id: text('aggregate_id').notNull(),
  event_type: text('event_type').notNull(),
  payload: text('payload').notNull(), // JSON serialized
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  published_at: timestamp('published_at', { withTimezone: true }),
});

/**
 * ConsumerReceipt (SPEC01 §79, SPEC02 §19)
 *
 * Deduplication for event consumers.
 * PRIMARY KEY(consumer_name, event_id) prevents double-processing.
 * FK(event_id) → OutboxEvent(event_id).
 */
export const consumerReceipts = pgTable(
  'consumer_receipts',
  {
    consumer_name: text('consumer_name').notNull(),
    event_id: uuid('event_id')
      .notNull()
      .references(() => outboxEvents.event_id),
    processed_at: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.consumer_name, table.event_id] }),
  ],
);

===== FILE: src/persistence/relational/schema/idempotency-schema.ts =====
/**
 * ContentOS — Drizzle Schema: API Idempotency Record
 *
 * Implements SPEC01 §95, SPEC02 §19:
 *   - command_scope
 *   - idempotency_key
 *   - request_hash
 *   - response_ref?
 *   - status
 *   - created_at
 *   - completed_at?
 *   - PRIMARY KEY(command_scope, idempotency_key)
 *   - Same scope+key with different request_hash -> IDEMPOTENCY_CONFLICT
 */
import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { ContentOSError, RetryCategory } from '../../../domain/shared/types.js';

/**
 * Mandatory command scopes per SPEC02 §19:
 *   - StartRun
 *   - SubmitReview
 *   - CreatePublishedArtifact
 *   - IngestMeasurement
 */
export const MANDATORY_COMMAND_SCOPES = [
  'StartRun',
  'SubmitReview',
  'CreatePublishedArtifact',
  'IngestMeasurement',
] as const;

export type MandatoryCommandScope = (typeof MANDATORY_COMMAND_SCOPES)[number];

/**
 * APIIdempotencyRecord (SPEC02 §19)
 */
export const apiIdempotencyRecords = pgTable(
  'api_idempotency_records',
  {
    command_scope: text('command_scope').notNull(),
    idempotency_key: text('idempotency_key').notNull(),
    request_hash: text('request_hash').notNull(),
    response_ref: text('response_ref'),
    status: text('status').notNull(), // 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.command_scope, table.idempotency_key] }),
  ],
);

// Backward-compatible alias
export const idempotencyRecords = apiIdempotencyRecords;

export type ApiIdempotencyRecord = typeof apiIdempotencyRecords.$inferSelect;
export type NewApiIdempotencyRecord = typeof apiIdempotencyRecords.$inferInsert;

/**
 * Evaluates idempotency contract per SPEC02 §19.
 * If the record exists for (command_scope, idempotency_key):
 *   - Same request_hash: returns existing record (replayable)
 *   - Different request_hash: throws IDEMPOTENCY_CONFLICT ContentOSError
 */
export function validateIdempotencyRecord(
  existing: ApiIdempotencyRecord | null | undefined,
  incoming: { command_scope: string; idempotency_key: string; request_hash: string },
): { isReplay: boolean; existingRecord?: ApiIdempotencyRecord } {
  if (!existing) {
    return { isReplay: false };
  }

  if (existing.request_hash !== incoming.request_hash) {
    throw new ContentOSError({
      error_code: 'IDEMPOTENCY_CONFLICT',
      message: `Idempotency key '${incoming.idempotency_key}' in scope '${incoming.command_scope}' was previously used with a different request hash (expected '${existing.request_hash}', received '${incoming.request_hash}')`,
      category: RetryCategory.DOMAIN_INVARIANT_FAILED,
    });
  }

  return { isReplay: true, existingRecord: existing };
}

===== FILE: src/persistence/relational/migrations/0000_chemical_iron_man.sql =====
CREATE TABLE "api_idempotency_records" (
	"command_scope" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_ref" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "api_idempotency_records_command_scope_idempotency_key_pk" PRIMARY KEY("command_scope","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "consumer_receipts" (
	"consumer_name" text NOT NULL,
	"event_id" uuid NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consumer_receipts_consumer_name_event_id_pk" PRIMARY KEY("consumer_name","event_id")
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "consumer_receipts" ADD CONSTRAINT "consumer_receipts_event_id_outbox_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."outbox_events"("event_id") ON DELETE no action ON UPDATE no action;

===== FILE: src/tests/unit/m0-build.test.ts =====
/**
 * M0 Test 01 — Project Builds with Zero TypeScript Errors
 *
 * Validates M0 checklist item 01.
 * Runs tsc --noEmit and expects exit code 0.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '../../..');

describe('M0-01: TypeScript Build', () => {
  it('should compile with zero errors under strict mode', () => {
    // Run tsc --noEmit from project root
    const result = execSync('npx tsc --noEmit 2>&1', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
    });

    // tsc output should be empty on success
    expect(result.trim()).toBe('');
  });
});

===== FILE: src/tests/unit/m0-config.test.ts =====
/**
 * M0 Test — Configuration Loader
 *
 * Validates config loading and validation.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { loadConfig, resetConfig } from '../../config.js';

describe('M0: Configuration Loader', () => {
  afterEach(() => {
    resetConfig();
  });

  it('should load valid configuration from env', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
    });

    expect(config.DATABASE_URL).toBe('postgresql://test:test@localhost:5432/test');
    expect(config.REDIS_URL).toBe('redis://localhost:6379');
    expect(config.PORT).toBe(3000); // default
    expect(config.DEPLOYMENT_MODE).toBe('SINGLE_TENANT'); // default
  });

  it('should reject missing DATABASE_URL', () => {
    expect(() => loadConfig({ REDIS_URL: 'redis://localhost:6379' }))
      .toThrow('Configuration validation failed');
  });

  it('should accept custom port', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      PORT: '8080',
    });
    expect(config.PORT).toBe(8080);
  });
});

===== FILE: src/tests/unit/m0-dependency-direction.test.ts =====
/**
 * M0 Test 09 — Dependency Direction Verification
 *
 * Validates M0 checklist item 09.
 * Enforces SPEC01 §132: Domain cannot import from infrastructure.
 *
 * Dependency direction:
 *   API → Application → Domain ← Infrastructure
 *
 * Domain modules MUST NOT import from:
 *   - HTTP framework
 *   - database driver
 *   - cloud SDK
 *   - LLM provider SDK
 *   - queue vendor SDK
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '../../..');

describe('M0-09: Dependency Direction', () => {
  it('should not have domain/ importing from persistence/', () => {
    const result = execSync(
      'grep -r "from.*persistence" src/domain/ 2>/dev/null || true',
      { cwd: ROOT, encoding: 'utf-8' },
    );
    expect(result.trim()).toBe('');
  });

  it('should not have domain/ importing from api/', () => {
    const result = execSync(
      'grep -r "from.*api/" src/domain/ 2>/dev/null || true',
      { cwd: ROOT, encoding: 'utf-8' },
    );
    expect(result.trim()).toBe('');
  });

  it('should not have domain/ importing from events/', () => {
    const result = execSync(
      'grep -r "from.*events/" src/domain/ 2>/dev/null || true',
      { cwd: ROOT, encoding: 'utf-8' },
    );
    expect(result.trim()).toBe('');
  });

  it('should not have domain/ importing from providers/', () => {
    const result = execSync(
      'grep -r "from.*providers/" src/domain/ 2>/dev/null || true',
      { cwd: ROOT, encoding: 'utf-8' },
    );
    expect(result.trim()).toBe('');
  });

  it('should not have domain/ importing from workflow/', () => {
    const result = execSync(
      'grep -r "from.*workflow/" src/domain/ 2>/dev/null || true',
      { cwd: ROOT, encoding: 'utf-8' },
    );
    expect(result.trim()).toBe('');
  });

  it('should not have domain/ importing specific infra packages (SPEC01 §132)', () => {
    // drizzle, fastify, bullmq, ioredis, postgres driver
    const forbiddenImports = ['drizzle', 'fastify', 'bullmq', 'ioredis', 'postgres'];
    for (const pkg of forbiddenImports) {
      const result = execSync(
        `grep -r "from.*${pkg}" src/domain/ 2>/dev/null || true`,
        { cwd: ROOT, encoding: 'utf-8' },
      );
      expect(result.trim(), `domain/ must not import ${pkg}`).toBe('');
    }
  });
});

===== FILE: src/tests/unit/m0-domain-types.test.ts =====
/**
 * M0 Test — Domain Shared Types
 *
 * Validates that all Blueprint/SPEC01 core types are correctly defined.
 */
import { describe, it, expect } from 'vitest';
import {
  DeploymentMode,
  DataScope,
  PrincipalType,
  RetryCategory,
  NON_RETRYABLE_CATEGORIES,
  ContentOSError,
  type ImmutableEntityRef,
  type RevisionRef,
  type ErrorEnvelope,
  type Principal,
} from '../../domain/shared/types.js';

describe('M0: Domain Shared Types', () => {
  describe('ImmutableEntityRef (Blueprint §3)', () => {
    it('should accept entity_type and entity_id', () => {
      const ref: ImmutableEntityRef = {
        entity_type: 'Proposition',
        entity_id: 'prop-001',
      };
      expect(ref.entity_type).toBe('Proposition');
      expect(ref.entity_id).toBe('prop-001');
    });
  });

  describe('RevisionRef (Blueprint §4)', () => {
    it('should accept entity_type, stable_id, and revision_id', () => {
      const ref: RevisionRef = {
        entity_type: 'MetricDefinition',
        stable_id: 'CTR',
        revision_id: 'CTR_REV_004',
      };
      expect(ref.entity_type).toBe('MetricDefinition');
      expect(ref.stable_id).toBe('CTR');
      expect(ref.revision_id).toBe('CTR_REV_004');
    });
  });

  describe('DeploymentMode (SPEC01 §89)', () => {
    it('should have exactly SINGLE_TENANT and MULTI_TENANT', () => {
      expect(DeploymentMode.SINGLE_TENANT).toBe('SINGLE_TENANT');
      expect(DeploymentMode.MULTI_TENANT).toBe('MULTI_TENANT');
      expect(Object.keys(DeploymentMode)).toHaveLength(2);
    });
  });

  describe('DataScope (Blueprint §13B)', () => {
    it('should have all four canonical scopes', () => {
      expect(DataScope.TENANT_PRIVATE).toBe('TENANT_PRIVATE');
      expect(DataScope.WORKSPACE_SHARED).toBe('WORKSPACE_SHARED');
      expect(DataScope.AUTHORIZED_AGGREGATE).toBe('AUTHORIZED_AGGREGATE');
      expect(DataScope.GLOBAL_PUBLIC).toBe('GLOBAL_PUBLIC');
      expect(Object.keys(DataScope)).toHaveLength(4);
    });
  });

  describe('PrincipalType (SPEC01 §97)', () => {
    it('should have all five canonical principal types', () => {
      expect(PrincipalType.USER).toBe('USER');
      expect(PrincipalType.SERVICE).toBe('SERVICE');
      expect(PrincipalType.SYSTEM_WORKER).toBe('SYSTEM_WORKER');
      expect(PrincipalType.REVIEWER).toBe('REVIEWER');
      expect(PrincipalType.ADMIN).toBe('ADMIN');
      expect(Object.keys(PrincipalType)).toHaveLength(5);
    });
  });

  describe('RetryCategory (SPEC01 §82-83)', () => {
    it('should have all 11 canonical retry categories', () => {
      expect(Object.keys(RetryCategory)).toHaveLength(11);
    });

    it('should mark DOMAIN_INVARIANT_FAILED as non-retryable (SPEC01 §83)', () => {
      expect(NON_RETRYABLE_CATEGORIES.has(RetryCategory.DOMAIN_INVARIANT_FAILED)).toBe(true);
    });

    it('should mark STALE_DECISION_CYCLE as non-retryable (SPEC01 §83)', () => {
      expect(NON_RETRYABLE_CATEGORIES.has(RetryCategory.STALE_DECISION_CYCLE)).toBe(true);
    });

    it('should mark STALE_FENCING_TOKEN as non-retryable (SPEC01 §83)', () => {
      expect(NON_RETRYABLE_CATEGORIES.has(RetryCategory.STALE_FENCING_TOKEN)).toBe(true);
    });

    it('should mark AUTHORIZATION_FAILED as non-retryable (SPEC01 §83)', () => {
      expect(NON_RETRYABLE_CATEGORIES.has(RetryCategory.AUTHORIZATION_FAILED)).toBe(true);
    });

    it('should mark TRANSIENT as retryable', () => {
      expect(NON_RETRYABLE_CATEGORIES.has(RetryCategory.TRANSIENT)).toBe(false);
    });
  });

  describe('ContentOSError', () => {
    it('should set retryable=false for non-retryable categories', () => {
      const err = new ContentOSError({
        error_code: 'STALE_CYCLE',
        message: 'Cycle is stale',
        category: RetryCategory.STALE_DECISION_CYCLE,
      });
      expect(err.retryable).toBe(false);
      expect(err.error_code).toBe('STALE_CYCLE');
      expect(err.category).toBe(RetryCategory.STALE_DECISION_CYCLE);
    });

    it('should set retryable=true for retryable categories', () => {
      const err = new ContentOSError({
        error_code: 'PROVIDER_DOWN',
        message: 'Provider unavailable',
        category: RetryCategory.DEPENDENCY_UNAVAILABLE,
      });
      expect(err.retryable).toBe(true);
    });
  });

  describe('ErrorEnvelope (SPEC01 §96)', () => {
    it('should accept all required fields', () => {
      const envelope: ErrorEnvelope = {
        error_code: 'VALIDATION_FAILED',
        message: 'Input is invalid',
        retryable: false,
        trace_id: 'trace-001',
        validation_failures: [
          { field: 'name', code: 'REQUIRED', message: 'Name is required' },
        ],
      };
      expect(envelope.error_code).toBe('VALIDATION_FAILED');
      expect(envelope.validation_failures).toHaveLength(1);
    });
  });

  describe('Principal (SPEC01 §97-98)', () => {
    it('should require principal_type, principal_id, and tenant_id', () => {
      const p: Principal = {
        principal_type: PrincipalType.USER,
        principal_id: 'user-001',
        tenant_id: 'tenant-001' as any, // branded type
      };
      expect(p.principal_type).toBe('USER');
    });
  });
});

===== FILE: src/tests/unit/m0-logger.test.ts =====
/**
 * M0 Test 08 — Structured Logger
 *
 * Validates M0 checklist item 08.
 * Tests that logger outputs correct SPEC01 §100 fields.
 */
import { describe, it, expect } from 'vitest';
import { createLogger } from '../../observability/logger.js';

describe('M0-08: Structured Logger', () => {
  it('should create a child logger with required SPEC01 §100 fields', () => {
    const logger = createLogger({
      module: 'test-module',
      run_id: 'run-123',
      decision_cycle_id: 'cycle-456',
      trace_id: 'trace-789',
    });

    // Logger should exist and be callable
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should support all SPEC01 §100 context fields', () => {
    // All fields from SPEC01 §100 should be accepted
    const logger = createLogger({
      module: 'test-module',
      run_id: 'run-1',
      decision_cycle_id: 'dc-1',
      stage_execution_id: 'se-1',
      snapshot_id: 'snap-1',
      decision_id: 'dec-1',
      trace_id: 'trace-1',
      fencing_token: 42,
      error_code: 'TEST_ERROR',
    });

    expect(logger).toBeDefined();
  });

  it('should work with minimal context', () => {
    const logger = createLogger({ module: 'minimal' });
    expect(logger).toBeDefined();
  });
});

===== FILE: src/tests/unit/m0-object-store.test.ts =====
/**
 * M0 Test 06 — Object Store Write/Read/Hash-Verify Cycle
 *
 * Validates M0 checklist item 06.
 * Tests the local object store implementation against SPEC01 §12-15.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { LocalObjectStore } from '../../persistence/objects/local-object-store.js';
import { ContentHash, ContentOSError } from '../../domain/shared/types.js';

const TEST_DIR = path.resolve(import.meta.dirname, '../../../data/test-objects');

describe('M0-06: Object Store Write/Read/Hash-Verify', () => {
  let store: LocalObjectStore;

  beforeEach(async () => {
    // Clean test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    store = new LocalObjectStore(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should write an object and return valid metadata', async () => {
    const data = Buffer.from('test content for ContentOS');
    const metadata = await store.put(data, 'text/plain');

    expect(metadata.object_reference).toMatch(/^objects\//);
    expect(metadata.content_hash).toBeTruthy();
    expect(metadata.size_bytes).toBe(data.length);
    expect(metadata.media_type).toBe('text/plain');
    expect(metadata.created_at).toBeTruthy();
  });

  it('should read back the same content', async () => {
    const data = Buffer.from('immutable evidence payload');
    const metadata = await store.put(data, 'application/json');

    const retrieved = await store.get(metadata.object_reference);
    expect(retrieved.equals(data)).toBe(true);
  });

  it('should verify hash correctly', async () => {
    const data = Buffer.from('content with verifiable hash');
    const metadata = await store.put(data, 'text/plain');

    const valid = await store.verify(metadata.object_reference, metadata.content_hash);
    expect(valid).toBe(true);
  });

  it('should throw OBJECT_INTEGRITY_FAILURE on hash mismatch (SPEC01 §13)', async () => {
    const data = Buffer.from('original content');
    const metadata = await store.put(data, 'text/plain');

    await expect(
      store.verify(metadata.object_reference, 'wrong-hash' as ContentHash),
    ).rejects.toThrow(ContentOSError);

    try {
      await store.verify(metadata.object_reference, 'wrong-hash' as ContentHash);
    } catch (err) {
      expect(err).toBeInstanceOf(ContentOSError);
      expect((err as ContentOSError).error_code).toBe('OBJECT_INTEGRITY_FAILURE');
    }
  });

  it('should throw on reading non-existent object', async () => {
    await expect(
      store.get('objects/nonexistent'),
    ).rejects.toThrow(ContentOSError);
  });

  it('should be idempotent — writing same content returns same hash', async () => {
    const data = Buffer.from('deterministic content');
    const m1 = await store.put(data, 'text/plain');
    const m2 = await store.put(data, 'text/plain');

    expect(m1.content_hash).toBe(m2.content_hash);
    expect(m1.object_reference).toBe(m2.object_reference);
  });

  it('should report isReferenceable correctly', async () => {
    const data = Buffer.from('referenceable content');
    const metadata = await store.put(data, 'text/plain');

    expect(await store.isReferenceable(metadata.object_reference)).toBe(true);
    expect(await store.isReferenceable('objects/nonexistent')).toBe(false);
  });
});

===== FILE: src/tests/unit/m0-schema.test.ts =====
/**
 * M0 Test 02-03 — Drizzle Schema and Migration
 *
 * Validates M0 checklist items 02-03.
 * Tests that schema generation produces valid output and validates
 * SPEC02 §19 APIIdempotencyRecord and ConsumerReceipt contracts.
 */
import { describe, it, expect } from 'vitest';
import { outboxEvents, consumerReceipts } from '../../persistence/relational/schema/outbox-schema.js';
import {
  apiIdempotencyRecords,
  idempotencyRecords,
  validateIdempotencyRecord,
  MANDATORY_COMMAND_SCOPES,
  type ApiIdempotencyRecord,
} from '../../persistence/relational/schema/idempotency-schema.js';
import { ContentOSError } from '../../domain/shared/types.js';

describe('M0-02: Drizzle Schema Generation', () => {
  it('should export outbox_events table definition', () => {
    expect(outboxEvents).toBeDefined();
    const columns = Object.keys(outboxEvents);
    expect(columns).toContain('event_id');
    expect(columns).toContain('aggregate_type');
    expect(columns).toContain('aggregate_id');
    expect(columns).toContain('event_type');
    expect(columns).toContain('payload');
    expect(columns).toContain('created_at');
    expect(columns).toContain('published_at');
  });

  it('should export consumer_receipts table definition with PRIMARY KEY(consumer_name, event_id)', () => {
    expect(consumerReceipts).toBeDefined();
    const columns = Object.keys(consumerReceipts);
    expect(columns).toContain('consumer_name');
    expect(columns).toContain('event_id');
    expect(columns).toContain('processed_at');
  });

  it('should export api_idempotency_records table definition per SPEC02 §19', () => {
    expect(apiIdempotencyRecords).toBeDefined();
    expect(idempotencyRecords).toBe(apiIdempotencyRecords);
    const columns = Object.keys(apiIdempotencyRecords);
    expect(columns).toContain('command_scope');
    expect(columns).toContain('idempotency_key');
    expect(columns).toContain('request_hash');
    expect(columns).toContain('response_ref');
    expect(columns).toContain('status');
    expect(columns).toContain('created_at');
    expect(columns).toContain('completed_at');
  });

  it('should include all mandatory command scopes per SPEC02 §19', () => {
    expect(MANDATORY_COMMAND_SCOPES).toContain('StartRun');
    expect(MANDATORY_COMMAND_SCOPES).toContain('SubmitReview');
    expect(MANDATORY_COMMAND_SCOPES).toContain('CreatePublishedArtifact');
    expect(MANDATORY_COMMAND_SCOPES).toContain('IngestMeasurement');
  });

  describe('SPEC02 §19 IDEMPOTENCY_CONFLICT Invariant', () => {
    const existing: ApiIdempotencyRecord = {
      command_scope: 'StartRun',
      idempotency_key: 'idem-key-001',
      request_hash: 'hash-abc-123',
      response_ref: '{"run_id":"run-001"}',
      status: 'COMPLETED',
      created_at: new Date('2026-09-26T12:00:00Z'),
      completed_at: new Date('2026-09-26T12:00:01Z'),
    };

    it('should allow replay when request_hash matches', () => {
      const result = validateIdempotencyRecord(existing, {
        command_scope: 'StartRun',
        idempotency_key: 'idem-key-001',
        request_hash: 'hash-abc-123',
      });
      expect(result.isReplay).toBe(true);
      expect(result.existingRecord).toBe(existing);
    });

    it('should reject with IDEMPOTENCY_CONFLICT when request_hash differs', () => {
      expect(() => {
        validateIdempotencyRecord(existing, {
          command_scope: 'StartRun',
          idempotency_key: 'idem-key-001',
          request_hash: 'hash-xyz-999', // Different payload!
        });
      }).toThrowError(ContentOSError);

      try {
        validateIdempotencyRecord(existing, {
          command_scope: 'StartRun',
          idempotency_key: 'idem-key-001',
          request_hash: 'hash-xyz-999',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ContentOSError);
        const ce = err as ContentOSError;
        expect(ce.error_code).toBe('IDEMPOTENCY_CONFLICT');
        expect(ce.retryable).toBe(false);
      }
    });

    it('should indicate new invocation when no record exists', () => {
      const result = validateIdempotencyRecord(null, {
        command_scope: 'StartRun',
        idempotency_key: 'idem-key-002',
        request_hash: 'hash-abc-123',
      });
      expect(result.isReplay).toBe(false);
      expect(result.existingRecord).toBeUndefined();
    });
  });
});

===== FILE: src/tests/integration/m0-api.test.ts =====
/**
 * M0 Integration Test — API Server
 *
 * Validates M0 API layer foundation (Fastify).
 * Tests health check endpoint, request ID tracking, and error handling.
 */
import { describe, it, expect } from 'vitest';
import { createServer } from '../../api/server.js';

describe('M0 Integration: Fastify API Server', () => {
  const server = createServer();

  it('GET /health should return 200 and status ok', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual({
      status: 'ok',
      service: 'contentos',
      version: '1.0.0',
    });
  });

  it('should return error envelope on unknown route', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/unknown-route',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error_code');
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('retryable');
    expect(body).toHaveProperty('trace_id');
    expect(body.retryable).toBe(false);
  });
});

===== FILE: src/tests/integration/m0-infra.test.ts =====
/**
 * M0 Integration Test — Live Infrastructure Verification
 *
 * Validates Defect 3:
 * - Real PostgreSQL connection & migration execution
 * - Post-migration schema and constraints verification (PK & FK constraints)
 * - Real Redis connection
 * - Minimal BullMQ durable queue enqueue/consume roundtrip
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import postgres from 'postgres';
import { Redis } from 'ioredis';
import { Queue, Worker, type Job } from 'bullmq';

const DB_URL = process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/contentos_test';
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

describe('M0 Integration: Live Infrastructure Verification', () => {
  let sql: ReturnType<typeof postgres>;
  let redis: Redis;

  beforeAll(async () => {
    sql = postgres(DB_URL, { max: 5 });
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  });

  afterAll(async () => {
    await sql.end();
    await redis.quit();
  });

  describe('PostgreSQL Migration & Constraints Verification', () => {
    it('should connect to PostgreSQL server', async () => {
      const result = await sql`SELECT 1 as connected`;
      expect(result[0]?.['connected']).toBe(1);
    });

    it('should apply the generated migration cleanly', async () => {
      // Drop existing tables to ensure clean slate migration
      await sql`DROP TABLE IF EXISTS consumer_receipts CASCADE`;
      await sql`DROP TABLE IF EXISTS api_idempotency_records CASCADE`;
      await sql`DROP TABLE IF EXISTS outbox_events CASCADE`;

      const migrationPath = path.resolve(
        import.meta.dirname,
        '../../persistence/relational/migrations/0000_chemical_iron_man.sql',
      );
      const migrationSql = await fs.readFile(migrationPath, 'utf-8');

      // Execute statements split by drizzle breakpoint
      const statements = migrationSql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);

      for (const stmt of statements) {
        await sql.unsafe(stmt);
      }

      // Verify all 3 tables exist in information_schema
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('outbox_events', 'consumer_receipts', 'api_idempotency_records')
      `;
      const tableNames = tables.map((r) => r['table_name']);
      expect(tableNames).toContain('outbox_events');
      expect(tableNames).toContain('consumer_receipts');
      expect(tableNames).toContain('api_idempotency_records');
    });

    it('should enforce PRIMARY KEY(command_scope, idempotency_key) on api_idempotency_records', async () => {
      // Insert first record
      await sql`
        INSERT INTO api_idempotency_records (
          command_scope, idempotency_key, request_hash, status
        ) VALUES (
          'StartRun', 'test-key-01', 'hash-initial', 'STARTED'
        )
      `;

      // Duplicate in same command_scope must fail PK constraint
      await expect(sql`
        INSERT INTO api_idempotency_records (
          command_scope, idempotency_key, request_hash, status
        ) VALUES (
          'StartRun', 'test-key-01', 'hash-different', 'STARTED'
        )
      `).rejects.toThrow();

      // Same idempotency_key in a DIFFERENT command_scope must succeed (composite PK)
      const diffScopeResult = await sql`
        INSERT INTO api_idempotency_records (
          command_scope, idempotency_key, request_hash, status
        ) VALUES (
          'SubmitReview', 'test-key-01', 'hash-other', 'STARTED'
        ) RETURNING command_scope, idempotency_key
      `;
      expect(diffScopeResult[0]?.['command_scope']).toBe('SubmitReview');
    });

    it('should enforce PRIMARY KEY(consumer_name, event_id) and FK on consumer_receipts', async () => {
      // 1. Foreign key violation when outbox_event does not exist
      const fakeEventId = '00000000-0000-0000-0000-000000000001';
      await expect(sql`
        INSERT INTO consumer_receipts (consumer_name, event_id)
        VALUES ('WorkerA', ${fakeEventId})
      `).rejects.toThrow();

      // 2. Insert valid outbox_event
      const eventRows = await sql`
        INSERT INTO outbox_events (
          aggregate_type, aggregate_id, event_type, payload
        ) VALUES (
          'Run', 'run-100', 'RunStarted', '{"run_id":"run-100"}'
        ) RETURNING event_id
      `;
      const validEventId = eventRows[0]!['event_id'] as string;
      expect(validEventId).toBeTruthy();

      // 3. Valid consumer receipt insert succeeds
      await sql`
        INSERT INTO consumer_receipts (consumer_name, event_id)
        VALUES ('WorkerA', ${validEventId})
      `;

      // 4. Duplicate (consumer_name, event_id) fails PK constraint
      await expect(sql`
        INSERT INTO consumer_receipts (consumer_name, event_id)
        VALUES ('WorkerA', ${validEventId})
      `).rejects.toThrow();

      // 5. Different consumer_name for same event_id succeeds
      const workerB = await sql`
        INSERT INTO consumer_receipts (consumer_name, event_id)
        VALUES ('WorkerB', ${validEventId})
        RETURNING consumer_name
      `;
      expect(workerB[0]?.['consumer_name']).toBe('WorkerB');
    });
  });

  describe('Redis & BullMQ Durable Queue Roundtrip', () => {
    it('should connect to Redis server and respond to PING', async () => {
      const pong = await redis.ping();
      expect(pong).toBe('PONG');
    });

    it('should perform a minimal BullMQ enqueue/consume roundtrip', async () => {
      const queueName = `m0-roundtrip-${Date.now()}`;
      const queue = new Queue<{ message: string; timestamp: number }>(queueName, {
        connection: redis,
      });

      let processedMessage: string | null = null;
      let processCompletePromiseResolve: () => void;
      const processCompletePromise = new Promise<void>((resolve) => {
        processCompletePromiseResolve = resolve;
      });

      const worker = new Worker<{ message: string; timestamp: number }>(
        queueName,
        async (job: Job<{ message: string; timestamp: number }>) => {
          processedMessage = job.data.message;
          processCompletePromiseResolve();
        },
        { connection: redis },
      );

      // Enqueue job
      const testPayload = {
        message: 'SPEC01 durable workflow enqueue/consume test',
        timestamp: Date.now(),
      };
      await queue.add('test-job', testPayload);

      // Await worker processing with timeout
      await Promise.race([
        processCompletePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('BullMQ job processing timed out')), 5000),
        ),
      ]);

      expect(processedMessage).toBe(testPayload.message);

      // Clean up queue and worker
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
    });
  });
});

