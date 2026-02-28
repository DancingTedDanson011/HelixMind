import { resolve } from 'node:path';
import { theme } from '../ui/theme.js';
import { renderFeedProgress, renderFeedSummary } from '../ui/progress.js';
import { renderError, renderInfo } from '../ui/chat-view.js';
import { runFeedPipeline } from '../feed/pipeline.js';
import { FeedWatcher } from '../feed/watcher.js';

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
      const resolvedTarget = target === '.' ? undefined : target;

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
