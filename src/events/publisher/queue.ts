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
