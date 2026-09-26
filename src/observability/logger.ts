/**
 * ContentOS — Structured Logger
 *
 * Implements SPEC01 §100 structured logging fields.
 * Operational logs are NOT canonical truth (SPEC01 §100).
 * Uses pino for fast structured JSON logging.
 * Guarantees trace_id on every emitted operational log line.
 */
import pino from 'pino';
import crypto from 'crypto';

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
 * Base logger options.
 */
const baseOptions: pino.LoggerOptions = {
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
};

/** Base logger instance — module-level singleton */
const baseLogger = pino(baseOptions);

/**
 * Create a child logger bound to specific context fields.
 * Every emitted operational log is guaranteed to have a trace_id per SPEC01 §100,
 * either supplied by context or deterministically generated at the logging boundary.
 */
export function createLogger(context: LogContext, destination?: pino.DestinationStream): pino.Logger {
  const traceId = context.trace_id && context.trace_id.trim().length > 0
    ? context.trace_id
    : crypto.randomUUID();

  const boundContext: LogContext & { trace_id: string } = {
    ...context,
    trace_id: traceId,
  };

  if (destination) {
    return pino(baseOptions, destination).child(boundContext);
  }

  return baseLogger.child(boundContext);
}
