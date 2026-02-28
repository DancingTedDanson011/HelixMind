import { appendFileSync, writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SWEPrediction, TaskResult, BenchRunMetrics, RunSummary } from './types.js';

/**
 * Append a single prediction to the JSONL file (SWE-bench compatible).
 */
export function appendPrediction(outputDir: string, prediction: SWEPrediction): void {
  mkdirSync(outputDir, { recursive: true });
  appendFileSync(
    join(outputDir, 'predictions.jsonl'),
    JSON.stringify(prediction) + '\n',
    'utf-8',
  );
}

/**
 * Append a task result to the detailed results JSONL.
 */
export function appendTaskResult(outputDir: string, result: TaskResult): void {
  mkdirSync(outputDir, { recursive: true });
  // Write a compact version without the full patch/agentText
  const compact = {
    instance_id: result.instance_id,
    status: result.status,
    tokens: result.tokens,
    toolCalls: result.toolCalls,
    durationMs: result.durationMs,
    errors: result.errors,
    stepCount: result.steps.length,
  };
  appendFileSync(
    join(outputDir, 'results.jsonl'),
    JSON.stringify(compact) + '\n',
    'utf-8',
  );
}

/**
 * Write the final run summary.
 */
export function writeSummary(outputDir: string, metrics: BenchRunMetrics): void {
  mkdirSync(outputDir, { recursive: true });
  // Don't include taskResults in summary (too large)
  const { taskResults: _, ...summary } = metrics;
  writeFileSync(
    join(outputDir, 'summary.json'),
    JSON.stringify(summary, null, 2),
    'utf-8',
  );
}

/**
 * List all past benchmark runs from the bench/runs/ directory.
 */
export function listRuns(benchDir: string): RunSummary[] {
  const runsDir = join(benchDir, 'runs');
  if (!existsSync(runsDir)) return [];

  const runs: RunSummary[] = [];

  try {
    const dirs = readdirSync(runsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort()
      .reverse(); // Newest first

    for (const dir of dirs) {
      const summaryPath = join(runsDir, dir, 'summary.json');
      if (!existsSync(summaryPath)) continue;

      try {
        const data = JSON.parse(readFileSync(summaryPath, 'utf-8'));
        runs.push({
          runId: data.runId ?? dir,
          timestamp: data.timestamp ?? '',
          dataset: data.dataset ?? '',
          provider: data.provider ?? '',
          model: data.model ?? '',
          resolved: data.resolved ?? 0,
          totalTasks: data.totalTasks ?? 0,
          resolutionRate: data.resolutionRate ?? 0,
          totalCostEstimate: data.totalCostEstimate ?? 0,
          spiralMode: data.spiralMode,
        });
      } catch {
        // Corrupted summary, skip
      }
    }
  } catch {
    // Runs directory doesn't exist or can't be read
  }

  return runs;
}

/**
 * Get IDs of tasks that were already completed (resolved/failed) in a previous run.
 * Reads results.jsonl line by line and returns Set of instance_ids.
 */
export function getCompletedTaskIds(outputDir: string): Set<string> {
  const resultsPath = join(outputDir, 'results.jsonl');
  const completed = new Set<string>();
  if (!existsSync(resultsPath)) return completed;

  try {
    const lines = readFileSync(resultsPath, 'utf-8').split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        // Only skip tasks that actually completed (resolved or failed)
        // Re-run errored/timed-out tasks (they might succeed with budget)
        if (data.instance_id && (data.status === 'resolved' || data.status === 'failed')) {
          completed.add(data.instance_id);
        }
      } catch { /* skip malformed lines */ }
    }
  } catch { /* file read error */ }

  return completed;
}

/**
 * Load previous run's task results for merging into resumed run.
 */
export function loadPreviousResults(outputDir: string): Array<{ instance_id: string; status: string; tokens: { input: number; output: number }; toolCalls: number; durationMs: number; errors: string[]; stepCount: number }> {
  const resultsPath = join(outputDir, 'results.jsonl');
  if (!existsSync(resultsPath)) return [];

  const results: Array<any> = [];
  try {
    const lines = readFileSync(resultsPath, 'utf-8').split('\n').filter(l => l.trim());
    for (const line of lines) {
      try { results.push(JSON.parse(line)); } catch { /* skip */ }
    }
  } catch { /* ignore */ }
  return results;
}

/**
 * Load a specific run's summary metrics.
 */
export function loadRunSummary(benchDir: string, runId: string): BenchRunMetrics | null {
  const summaryPath = join(benchDir, 'runs', runId, 'summary.json');
  if (!existsSync(summaryPath)) return null;

  try {
    const data = JSON.parse(readFileSync(summaryPath, 'utf-8'));
    return { ...data, taskResults: [] };
  } catch {
    return null;
  }
}
