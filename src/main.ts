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
