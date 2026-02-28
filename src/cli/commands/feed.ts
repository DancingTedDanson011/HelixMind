import { resolve, normalize, sep } from 'node:path';
import { existsSync } from 'node:fs';
import { theme } from '../ui/theme.js';
import { renderFeedProgress, renderFeedSummary } from '../ui/progress.js';
import { renderError, renderInfo } from '../ui/chat-view.js';
import { runFeedPipeline } from '../feed/pipeline.js';
import { FeedWatcher } from '../feed/watcher.js';
import { SecurityError } from '../agent/sandbox.js';

/** Maximum path depth to prevent traversal attacks */
const MAX_PATH_DEPTH = 10;

/**
 * Validate that a target path is within the project root and safe to scan
 */
function validateFeedPath(targetPath: string, rootDir: string): string {
  // Normalize the path to handle . and .. sequences
  let normalizedPath = normalize(targetPath);

  // Resolve against project root
  const resolved = resolve(rootDir, normalizedPath);

  // Ensure the resolved path starts with the normalized project root
  const normalizedRoot = normalize(rootDir);
  if (!resolved.startsWith(normalizedRoot)) {
    throw new SecurityError(`Access denied: ${targetPath} is outside the project directory`);
  }

  // Check for path traversal attempts (multiple consecutive separators)
  if (normalizedPath.split(sep).length > MAX_PATH_DEPTH) {
    throw new SecurityError(`Access denied: Path too deep: ${targetPath}`);
  }

  // Check if the path exists
  if (!existsSync(resolved)) {
    throw new SecurityError(`Path not found: ${targetPath}`);
  }

  // Check if it's a directory or a file
  const stats = require('node:fs').statSync(resolved);
  if (!stats.isDirectory() && !stats.isFile()) {
    throw new SecurityError(`Path is not a file or directory: ${targetPath}`);
  }

  return resolved;
}

async function getSpiralEngine() {
  try {
    const { SpiralEngine } = await import('../../spiral/engine.js');
    const { loadConfig } = await import('../../utils/config.js');
    const config = loadConfig();
    const engine = new SpiralEngine(config);
    await engine.initialize();
    return engine;
  } catch (err) {
    renderError(`Failed to initialize spiral engine: ${err}`);
    return null;
  }
}

export async function feedCommand(
  paths: string[],
  options: { deep?: boolean; quick?: boolean; watch?: boolean },
): Promise<void> {
  const engine = await getSpiralEngine();
  if (!engine) return;

  const rootDir = process.cwd();
  const targetPaths = paths.length > 0 ? paths : ['.'];

  process.stdout.write(`\n${theme.accent('🌀')} ${theme.bold('HelixMind Feed')}\n\n`);

  try {
    for (const target of targetPaths) {
      // Validate path before processing
      const resolvedTarget = target === '.' ? undefined : validateFeedPath(target, rootDir);

      renderInfo(`  Feeding: ${target}`);
      process.stdout.write('\n');

      const result = await runFeedPipeline(rootDir, engine, {
        targetPath: resolvedTarget,
        deep: options.deep ?? false,
        onProgress: renderFeedProgress,
      });

      renderFeedSummary(result);
    }

    // Watch mode
    if (options.watch) {
      renderInfo('👁️  Watch mode active. Press Ctrl+C to stop.\n');
      const watcher = new FeedWatcher(engine, rootDir);
      watcher.start();

      process.on('SIGINT', () => {
        watcher.stop();
        engine.close();
        process.exit(0);
      });

      // Keep process alive
      await new Promise(() => {}); // Never resolves
    } else {
      engine.close();
    }
  } catch (err) {
    engine.close();
    renderError(`Feed failed: ${err}`);
  }
}
