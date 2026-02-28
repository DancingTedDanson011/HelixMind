#!/usr/bin/env tsx

import { mkdirSync } from 'node:fs';
import { loadConfig } from '../src/utils/config.js';
import { Database } from '../src/storage/database.js';

async function setup() {
  console.log('Setting up spiral-context-mcp...\n');

  const config = loadConfig();

  // Create data directory
  mkdirSync(config.dataDir, { recursive: true });
  console.log(`Data directory: ${config.dataDir}`);

  // Initialize database
  const db = new Database(config.dataDir);
  console.log(`Database created: ${config.dataDir}/spiral.db`);
  console.log(`sqlite-vec extension: ${db.hasVecExtension ? 'available' : 'not available (using JS fallback)'}`);
  db.close();

  // Pre-download embedding model
  console.log(`\nPre-downloading embedding model: ${config.model}`);
  console.log('This may take a moment on first run...\n');

  try {
    const { pipeline } = await import('@huggingface/transformers');
    const extractor = await pipeline('feature-extraction', config.model, {
      dtype: 'q8' as any,
    });

    // Test with a sample sentence
    const result = await extractor('test sentence', { pooling: 'mean', normalize: true });
    console.log(`Model loaded successfully! Embedding dimensions: ${result.data.length}`);
  } catch (err) {
    console.warn(`Warning: Could not download model. Server will use keyword fallback.\nError: ${err}`);
  }

  console.log('\nSetup complete! You can now use spiral-context-mcp.');
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
