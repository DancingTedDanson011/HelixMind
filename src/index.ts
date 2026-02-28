#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { loadConfig } from './utils/config.js';
import { setLogLevel, logger } from './utils/logger.js';

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  logger.info('Starting spiral-context-mcp server...');

  const { server, engine } = createServer(config);

  // Initialize embedding model (async, non-blocking for server start)
  engine.initialize().catch(err => {
    logger.warn(`Embedding initialization failed: ${err}. Running in fallback mode.`);
  });

  // Connect via STDIO transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('spiral-context-mcp server connected via STDIO');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    engine.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    engine.close();
    process.exit(0);
  });
}

main().catch(err => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
