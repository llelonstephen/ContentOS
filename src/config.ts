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
