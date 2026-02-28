import chalk from 'chalk';
import type { SWETask, TaskResult, BenchRunMetrics, RunSummary } from './types.js';
import { formatCurrency, formatTokens, formatDuration, estimateCost } from './metrics.js';

const STATUS_ICONS: Record<string, string> = {
  resolved: chalk.green('\u2713'),
  failed: chalk.red('\u2717'),
  error: chalk.red('\u26A0'),
  timeout: chalk.yellow('\u29D7'),
};

/** Render a task result line */
export function renderTaskResult(result: TaskResult, index: number, total: number): string {
  const icon = STATUS_ICONS[result.status] ?? '?';
  const id = result.instance_id.length > 35
    ? result.instance_id.slice(0, 32) + '...'
    : result.instance_id.padEnd(35);
  const dur = formatDuration(result.durationMs).padStart(6);
  const tools = `${result.toolCalls} tools`.padStart(9);
  const tokens = formatTokens(result.tokens.input + result.tokens.output).padStart(6);
  const progress = chalk.dim(`[${String(index + 1).padStart(String(total).length)}/${total}]`);

  return `  ${progress} ${icon} ${chalk.cyan(id)} ${chalk.dim(result.status.padEnd(8))} ${dur} ${tools} ${tokens}\n`;
}

/** Render progress line for a starting task */
export function renderTaskStart(task: SWETask, index: number, total: number): string {
  const progress = chalk.dim(`[${String(index + 1).padStart(String(total).length)}/${total}]`);
  const id = task.instance_id.length > 40
    ? task.instance_id.slice(0, 37) + '...'
    : task.instance_id;
  return `  ${progress} ${chalk.yellow('\u25B6')} ${chalk.white(id)} ${chalk.dim('...')}\n`;
}

/** Render the final results summary */
export function renderResultsSummary(metrics: BenchRunMetrics): string {
  const lines: string[] = [];
  const w = 52;
  const d = chalk.dim;

  lines.push('');
  lines.push(d('\u256D' + '\u2500'.repeat(w) + '\u256E'));
  lines.push(d('\u2502') + chalk.bold.white('  SWE-bench Results') + ' '.repeat(w - 19) + d('\u2502'));
  lines.push(d('\u251C' + '\u2500'.repeat(w) + '\u2524'));

  const row = (label: string, value: string): string => {
    const pad = w - label.length - value.length - 4;
    return d('\u2502') + `  ${label}${' '.repeat(Math.max(1, pad))}${value}  ` + d('\u2502');
  };

  lines.push(row('Run', metrics.runId));
  lines.push(row('Model', `${metrics.provider}/${metrics.model}`));
  lines.push(row('Dataset', `SWE-bench ${metrics.dataset}`));
  lines.push(row('Mode', metrics.spiralMode ?? 'naked'));
  lines.push(row('Tasks', String(metrics.totalTasks)));

  lines.push(d('\u251C' + '\u2500'.repeat(w) + '\u2524'));

  const rateColor = metrics.resolutionRate >= 50 ? chalk.green
    : metrics.resolutionRate >= 25 ? chalk.yellow
    : chalk.red;

  lines.push(row('Resolution Rate', rateColor(`${metrics.resolutionRate.toFixed(1)}%`)));
  lines.push(row('Resolved', chalk.green(String(metrics.resolved))));
  lines.push(row('Failed', chalk.red(String(metrics.failed))));
  if (metrics.errors > 0) lines.push(row('Errors', chalk.red(String(metrics.errors))));
  if (metrics.timeouts > 0) lines.push(row('Timeouts', chalk.yellow(String(metrics.timeouts))));

  lines.push(d('\u251C' + '\u2500'.repeat(w) + '\u2524'));

  lines.push(row('Avg Tokens/Task', `${formatTokens(metrics.avgTokensPerTask.input)} in / ${formatTokens(metrics.avgTokensPerTask.output)} out`));
  lines.push(row('Avg Tool Calls', String(metrics.avgToolCallsPerTask)));
  lines.push(row('Avg Duration', formatDuration(metrics.avgDurationMs)));
  lines.push(row('Total Duration', formatDuration(metrics.totalDurationMs)));
  lines.push(row('Total Cost', formatCurrency(metrics.totalCostEstimate)));

  lines.push(d('\u2570' + '\u2500'.repeat(w) + '\u256F'));
  lines.push('');

  return lines.join('\n');
}

/** Render comparison table between multiple runs */
export function renderComparison(runs: BenchRunMetrics[]): string {
  if (runs.length === 0) return chalk.dim('  No runs to compare.\n');

  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.bold('  SWE-bench Comparison'));
  lines.push('');

  // Header
  const cols = [
    'Model'.padEnd(25),
    'Mode'.padEnd(10),
    'Dataset'.padEnd(10),
    'Tasks'.padStart(5),
    'Resolved'.padStart(8),
    'Rate'.padStart(7),
    'Avg Tokens'.padStart(10),
    'Cost'.padStart(8),
    'Duration'.padStart(10),
  ];
  lines.push('  ' + cols.join('  '));
  lines.push('  ' + cols.map(c => '\u2500'.repeat(c.length)).join('  '));

  for (const r of runs) {
    const model = `${r.provider}/${r.model}`.slice(0, 25).padEnd(25);
    const mode = (r.spiralMode ?? 'naked').padEnd(10);
    const dataset = r.dataset.padEnd(10);
    const tasks = String(r.totalTasks).padStart(5);
    const resolved = chalk.green(String(r.resolved).padStart(8));
    const rate = `${r.resolutionRate.toFixed(1)}%`.padStart(7);
    const tokens = formatTokens(r.avgTokensPerTask.input + r.avgTokensPerTask.output).padStart(10);
    const cost = formatCurrency(r.totalCostEstimate).padStart(8);
    const duration = formatDuration(r.totalDurationMs).padStart(10);

    lines.push(`  ${model}  ${mode}  ${dataset}  ${tasks}  ${resolved}  ${rate}  ${tokens}  ${cost}  ${duration}`);
  }

  lines.push('');
  return lines.join('\n');
}

/** Render list of past runs */
export function renderRunList(runs: RunSummary[]): string {
  if (runs.length === 0) return chalk.dim('  No benchmark runs found.\n');

  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.bold('  Past Benchmark Runs'));
  lines.push('');

  for (const r of runs) {
    const rate = r.totalTasks > 0 ? `${r.resolutionRate.toFixed(1)}%` : 'N/A';
    const rateColor = r.resolutionRate >= 50 ? chalk.green : r.resolutionRate >= 25 ? chalk.yellow : chalk.red;
    const mode = (r.spiralMode ?? 'naked').padEnd(10);
    lines.push(
      `  ${chalk.dim(r.timestamp.slice(0, 10))}  ${chalk.cyan(r.model.padEnd(25))}` +
      `  ${mode}` +
      `  ${rateColor(rate.padStart(6))}  (${r.resolved}/${r.totalTasks})` +
      `  ${formatCurrency(r.totalCostEstimate).padStart(8)}` +
      `  ${chalk.dim(r.runId)}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}
