import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import type { SpiralConfig } from '../types.js';

export type BrainScope = 'project' | 'global';

function globalDataDir(): string {
  if (process.env.SPIRAL_DATA_DIR) {
    return process.env.SPIRAL_DATA_DIR;
  }
  return join(homedir(), '.spiral-context');
}

function projectDataDir(projectRoot: string): string {
  return join(projectRoot, '.helixmind');
}

/**
 * Determine the default brain scope for a project directory.
 * If `.helixmind/` exists in the project root → project-local.
 * Otherwise → global.
 */
export function detectBrainScope(projectRoot: string): BrainScope {
  return existsSync(projectDataDir(projectRoot)) ? 'project' : 'global';
}

/**
 * Resolve the data directory for a given scope.
 */
export function resolveDataDir(scope: BrainScope, projectRoot: string): string {
  return scope === 'project' ? projectDataDir(projectRoot) : globalDataDir();
}

export function loadConfig(overrideDataDir?: string): SpiralConfig {
  return {
    dataDir: overrideDataDir ?? globalDataDir(),
    maxTokens: parseInt(process.env.SPIRAL_MAX_TOKENS ?? '4000', 10),
    model: process.env.SPIRAL_MODEL ?? 'Xenova/all-MiniLM-L6-v2',
    logLevel: (process.env.SPIRAL_LOG_LEVEL as SpiralConfig['logLevel']) ?? 'info',
    embeddingDimensions: 384,
    levelThresholds: {
      l1Min: 0.7,
      l2Min: 0.5,
      l3Min: 0.3,
      l4Min: 0.1,
    },
    decayRate: 0.05,
    decayIntervalHours: 1,
  };
}
