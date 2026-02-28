import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import chalk from 'chalk';
import { ConfigStore } from '../config/store.js';
import { runBenchmark } from '../bench/harness.js';
import { listRuns, loadRunSummary } from '../bench/output.js';
import { renderTaskResult, renderTaskStart, renderResultsSummary, renderComparison, renderRunList } from '../bench/ui.js';
import type { BenchConfig } from '../bench/types.js';

const CONFIG_DIR = join(homedir(), '.helixmind');
const BENCH_DIR = join(CONFIG_DIR, 'bench');

export interface BenchRunOptions {
  dataset?: string;
  tasks?: number;
  model?: string;
  provider?: string;
  parallel?: number;
  maxIterations?: number;
  timeout?: number;
  filter?: string;
  output?: string;
  cache?: boolean; // --no-cache sets this to false
  withSpiral?: boolean;
  spiralMode?: string;
  resume?: string;
}

export async function benchRunCommand(options: BenchRunOptions): Promise<void> {
  const store = new ConfigStore(CONFIG_DIR);
  const config = store.getAll();

  if (!config.apiKey) {
    process.stdout.write(chalk.red('\n  No API key configured. Run: helixmind config set apiKey <key>\n\n'));
    process.exit(1);
  }

  const dataset = (options.dataset === 'verified' ? 'verified' : 'lite') as 'lite' | 'verified';
  const provider = options.provider ?? config.provider;
  const model = options.model ?? config.model;
  const runId = `${new Date().toISOString().slice(0, 10)}_${model.replace(/[/:]/g, '-')}_${randomUUID().slice(0, 6)}`;
  const outputDir = options.output ?? join(BENCH_DIR, 'runs', runId);

  mkdirSync(outputDir, { recursive: true });

  const spiralMode = (options.spiralMode === 'learning' ? 'learning' : 'fresh') as 'fresh' | 'learning';

  // When resuming, use the same output dir as the previous run
  const resumeRunId = options.resume;
  const effectiveOutputDir = resumeRunId
    ? join(BENCH_DIR, 'runs', resumeRunId)
    : outputDir;

  const benchConfig: BenchConfig = {
    dataset,
    taskLimit: options.tasks,
    taskFilter: options.filter ? new RegExp(options.filter) : undefined,
    provider,
    model,
    apiKey: config.apiKey,
    baseURL: config.providers[provider]?.baseURL,
    maxIterations: options.maxIterations ?? 30,
    timeoutSeconds: options.timeout ?? 600,
    parallelism: options.parallel ?? 1,
    outputDir: effectiveOutputDir,
    runId: resumeRunId ?? runId,
    noCache: options.cache === false,
    withSpiral: options.withSpiral ?? false,
    spiralMode,
    resumeRunId,
  };

  const modeLabel = benchConfig.withSpiral ? `spiral (${spiralMode})` : 'naked';

  process.stdout.write('\n');
  process.stdout.write(chalk.bold('  SWE-bench Benchmark\n'));
  process.stdout.write(chalk.dim(`  Dataset: ${dataset} | Model: ${provider}/${model} | Max iterations: ${benchConfig.maxIterations}\n`));
  process.stdout.write(chalk.dim(`  Mode: ${benchConfig.withSpiral ? chalk.magenta(modeLabel) : modeLabel}\n`));
  if (resumeRunId) process.stdout.write(chalk.yellow(`  Resuming run: ${resumeRunId}\n`));
  if (options.tasks) process.stdout.write(chalk.dim(`  Task limit: ${options.tasks}\n`));
  process.stdout.write(chalk.dim(`  Output: ${effectiveOutputDir}\n`));
  process.stdout.write('\n');

  const startTime = Date.now();

  const metrics = await runBenchmark(
    benchConfig,
    (task, i, total) => {
      process.stdout.write(renderTaskStart(task, i, total));
    },
    (result, i, total) => {
      // Overwrite the "starting" line with the result
      process.stdout.write(`\x1b[1A\x1b[2K`);
      process.stdout.write(renderTaskResult(result, i, total));
    },
  );

  process.stdout.write(renderResultsSummary(metrics));
  process.stdout.write(chalk.dim(`  Predictions: ${join(outputDir, 'predictions.jsonl')}\n`));
  process.stdout.write(chalk.dim(`  Evaluate with: python -m swebench.harness.run_evaluation --predictions_path ${join(outputDir, 'predictions.jsonl')}\n\n`));
}

export async function benchResultsCommand(options: { run?: string; format?: string }): Promise<void> {
  const runs = listRuns(BENCH_DIR);

  if (runs.length === 0) {
    process.stdout.write(chalk.dim('\n  No benchmark runs found. Run: helixmind bench run\n\n'));
    return;
  }

  const runId = options.run ?? runs[0].runId;
  const metrics = loadRunSummary(BENCH_DIR, runId);

  if (!metrics) {
    process.stdout.write(chalk.red(`\n  Run not found: ${runId}\n\n`));
    return;
  }

  if (options.format === 'json') {
    process.stdout.write(JSON.stringify(metrics, null, 2) + '\n');
  } else {
    process.stdout.write(renderResultsSummary(metrics));
  }
}

export async function benchCompareCommand(options: { runs?: string }): Promise<void> {
  const allRuns = listRuns(BENCH_DIR);

  let runIds: string[];
  if (options.runs) {
    runIds = options.runs.split(',').map(s => s.trim());
  } else {
    // Compare the last 5 runs
    runIds = allRuns.slice(0, 5).map(r => r.runId);
  }

  const metrics = runIds
    .map(id => loadRunSummary(BENCH_DIR, id))
    .filter((m): m is NonNullable<typeof m> => m !== null);

  if (metrics.length === 0) {
    process.stdout.write(chalk.dim('\n  No runs to compare.\n\n'));
    return;
  }

  process.stdout.write(renderComparison(metrics));
}

export async function benchListCommand(): Promise<void> {
  const runs = listRuns(BENCH_DIR);
  process.stdout.write(renderRunList(runs));
}
