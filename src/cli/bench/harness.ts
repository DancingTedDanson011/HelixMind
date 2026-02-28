import type { SWETask, BenchConfig, TaskResult, BenchRunMetrics } from './types.js';
import { loadDataset } from './dataset.js';
import { runSingleTask } from './runner.js';
import { computeMetrics } from './metrics.js';
import { appendPrediction, appendTaskResult, writeSummary, getCompletedTaskIds } from './output.js';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { SpiralEngine } from '../../spiral/engine.js';
import { loadConfig as loadSpiralConfig } from '../../utils/config.js';

/**
 * Run the full benchmark suite.
 * Executes tasks sequentially or in parallel, writes results incrementally.
 */
export async function runBenchmark(
  config: BenchConfig,
  onTaskStart?: (task: SWETask, index: number, total: number) => void,
  onTaskEnd?: (result: TaskResult, index: number, total: number) => void,
): Promise<BenchRunMetrics> {
  const cacheDir = join(homedir(), '.helixmind', 'bench');

  const tasks = await loadDataset(config.dataset, cacheDir, {
    filter: config.taskFilter,
    limit: config.taskLimit,
    noCache: config.noCache,
  });

  if (tasks.length === 0) {
    return computeMetrics(config, []);
  }

  // Resume: skip already-completed tasks from previous run
  let completedIds = new Set<string>();
  if (config.resumeRunId) {
    const resumeDir = join(homedir(), '.helixmind', 'bench', 'runs', config.resumeRunId);
    completedIds = getCompletedTaskIds(resumeDir);
  }
  // Also check current output dir (in case we're resuming in-place)
  const currentCompleted = getCompletedTaskIds(config.outputDir);
  for (const id of currentCompleted) completedIds.add(id);

  const remainingTasks = completedIds.size > 0
    ? tasks.filter(t => !completedIds.has(t.instance_id))
    : tasks;

  const skippedCount = tasks.length - remainingTasks.length;
  if (skippedCount > 0 && onTaskStart) {
    // Notify about skipped tasks
    process.stdout?.write?.(`  Resuming: ${skippedCount} tasks already completed, ${remainingTasks.length} remaining\n`);
  }

  // Initialize shared Spiral for 'learning' mode
  let sharedSpiral: SpiralEngine | undefined;
  if (config.withSpiral && config.spiralMode === 'learning') {
    const spiralDataDir = join(config.outputDir, 'spiral-learning');
    mkdirSync(spiralDataDir, { recursive: true });
    const spiralConfig = loadSpiralConfig(spiralDataDir);
    sharedSpiral = new SpiralEngine(spiralConfig);
    await sharedSpiral.initialize();
  }

  const results: TaskResult[] = [];

  try {
    const totalDisplay = tasks.length; // Show total including skipped
    const offsetDisplay = skippedCount; // For numbering

    if (config.parallelism <= 1) {
      // Sequential execution
      for (let i = 0; i < remainingTasks.length; i++) {
        const displayIdx = offsetDisplay + i;
        onTaskStart?.(remainingTasks[i], displayIdx, totalDisplay);

        const result = await runSingleTask(remainingTasks[i], config, undefined, sharedSpiral);
        results.push(result);

        // Evolve spiral after each task (learning mode)
        if (sharedSpiral) {
          try { sharedSpiral.evolve(); } catch { /* non-critical */ }
        }

        // Write incrementally (crash-safe)
        appendPrediction(config.outputDir, {
          instance_id: result.instance_id,
          model_name_or_path: `${config.provider}/${config.model}`,
          model_patch: result.model_patch,
        });
        appendTaskResult(config.outputDir, result);

        onTaskEnd?.(result, displayIdx, totalDisplay);
      }
    } else {
      // Parallel execution with concurrency limit
      await pool(remainingTasks, config.parallelism, async (task, i) => {
        const displayIdx = offsetDisplay + i;
        onTaskStart?.(task, displayIdx, totalDisplay);

        const result = await runSingleTask(task, config, undefined, sharedSpiral);
        results.push(result);

        appendPrediction(config.outputDir, {
          instance_id: result.instance_id,
          model_name_or_path: `${config.provider}/${config.model}`,
          model_patch: result.model_patch,
        });
        appendTaskResult(config.outputDir, result);

        onTaskEnd?.(result, displayIdx, totalDisplay);
      });
    }

    // Store run summary in spiral brain (learning mode)
    if (sharedSpiral) {
      const resolved = results.filter(r => r.status === 'resolved').length;
      const total = results.length;
      try {
        await sharedSpiral.store(
          `SWE-bench run completed: ${resolved}/${total} resolved (${((resolved / Math.max(total, 1)) * 100).toFixed(1)}%). ` +
          `Dataset: ${config.dataset}, Model: ${config.model}. ` +
          `Common patterns: ${results.filter(r => r.status === 'resolved').map(r => r.instance_id).slice(0, 10).join(', ')}`,
          'summary',
          { tags: ['bench_run', 'summary', config.dataset] },
        );
      } catch { /* non-critical */ }
    }
  } finally {
    // Cleanup shared spiral
    if (sharedSpiral) {
      try { sharedSpiral.close(); } catch { /* ignore */ }
    }
  }

  const metrics = computeMetrics(config, results);
  writeSummary(config.outputDir, metrics);
  return metrics;
}

/** Simple concurrency-limited Promise pool */
async function pool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers: Promise<void>[] = [];

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      await fn(items[i], i);
    }
  }

  for (let w = 0; w < Math.min(concurrency, items.length); w++) {
    workers.push(worker());
  }

  await Promise.all(workers);
}
