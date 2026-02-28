/**
 * Validation Statistics — tracks validation results over time.
 * Stores stats in spiral memory for long-term analysis.
 */
import chalk from 'chalk';
import type { SpiralEngine } from '../../spiral/engine.js';
import type { ValidationResult } from './autofix.js';
import type { CheckResult } from './static-checks.js';

export interface ValidationStats {
  totalValidations: number;
  totalChecks: number;
  totalPassed: number;
  totalFailed: number;
  totalAutofixes: number;
  averageDuration: number;
  averageLoops: number;
  autofixRate: number;
  issueFrequency: Map<string, { count: number; autofixed: number }>;
}

/**
 * Store validation result in spiral for long-term stats.
 */
export async function storeValidationResult(
  result: ValidationResult,
  taskCategory: string,
  engine: SpiralEngine | undefined,
): Promise<void> {
  if (!engine) return;

  const failed = result.results.filter(r => !r.passed);
  if (failed.length === 0 && result.fixesApplied === 0) return; // Don't store perfect passes

  const content = formatForSpiral(result, taskCategory);

  try {
    await engine.store(content, 'code', {
      tags: ['validation', taskCategory, result.status],
    });
  } catch {
    // Non-critical — don't block
  }
}

/**
 * Query validation stats from spiral memory.
 */
export async function getValidationStats(engine: SpiralEngine | undefined): Promise<ValidationStats | null> {
  if (!engine) return null;

  try {
    const query = await engine.query('validation statistics issues autofix', undefined, [1, 2, 3]);
    const nodes = [
      ...query.level_1.map(n => n.content),
      ...query.level_2.map(n => n.content),
      ...query.level_3.map(n => n.content),
    ];

    if (nodes.length === 0) return null;

    return aggregateStats(nodes);
  } catch {
    return null;
  }
}

/**
 * Render validation stats for display.
 */
export function renderValidationStats(stats: ValidationStats): string {
  const lines: string[] = [];

  lines.push(chalk.bold('\n\u{1F4CA} Validation Statistics:\n'));

  // Top issues
  const sorted = [...stats.issueFrequency.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  if (sorted.length > 0) {
    lines.push(chalk.dim('  Most common issues:'));
    for (let i = 0; i < sorted.length; i++) {
      const [id, data] = sorted[i];
      const fixInfo = data.autofixed > 0
        ? chalk.green(`${data.autofixed} autofixed`)
        : chalk.yellow('manual fix');
      lines.push(`  ${chalk.dim(`${i + 1}.`)} ${chalk.cyan(id.padEnd(20))} \u2014 ${data.count} time${data.count !== 1 ? 's' : ''} (${fixInfo})`);
    }
  }

  lines.push('');
  lines.push(`  Autofix success rate: ${chalk.bold(formatPercent(stats.autofixRate))}`);
  lines.push(`  Average validation time: ${chalk.bold(stats.averageDuration.toFixed(0) + 'ms')}`);
  lines.push(`  Average loops needed: ${chalk.bold(stats.averageLoops.toFixed(1))}`);
  lines.push(`  Total validations: ${chalk.bold(String(stats.totalValidations))}`);
  lines.push('');

  return lines.join('\n');
}

// ── Internal ──

function formatForSpiral(result: ValidationResult, category: string): string {
  const failed = result.results.filter(r => !r.passed);
  const lines = [
    `[validation] category=${category} status=${result.status} checks=${result.results.length} loops=${result.loops} fixes=${result.fixesApplied} duration=${result.duration}ms`,
  ];

  for (const f of failed) {
    lines.push(`  ${f.severity}: ${f.id} — ${f.details}${f.autofix ? ' [autofixed]' : ''}`);
  }

  return lines.join('\n');
}

function aggregateStats(nodes: string[]): ValidationStats {
  let totalValidations = 0;
  let totalChecks = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalAutofixes = 0;
  let totalDuration = 0;
  let totalLoops = 0;
  const issueFrequency = new Map<string, { count: number; autofixed: number }>();

  for (const content of nodes) {
    // Parse validation log lines
    const headerMatch = content.match(/\[validation\]\s+.*checks=(\d+)\s+loops=(\d+)\s+fixes=(\d+)\s+duration=(\d+)/);
    if (headerMatch) {
      totalValidations++;
      totalChecks += parseInt(headerMatch[1]);
      totalLoops += parseInt(headerMatch[2]);
      totalAutofixes += parseInt(headerMatch[3]);
      totalDuration += parseInt(headerMatch[4]);
    }

    // Parse individual issue lines
    const issueLines = content.match(/^\s+(error|warning|info):\s+(\S+)\s+/gm);
    if (issueLines) {
      for (const line of issueLines) {
        const idMatch = line.match(/:\s+(\S+)/);
        if (idMatch) {
          const id = idMatch[1];
          const entry = issueFrequency.get(id) || { count: 0, autofixed: 0 };
          entry.count++;
          if (line.includes('[autofixed]')) entry.autofixed++;
          issueFrequency.set(id, entry);
          totalFailed++;
        }
      }
    }
  }

  totalPassed = totalChecks - totalFailed;

  return {
    totalValidations,
    totalChecks,
    totalPassed,
    totalFailed,
    totalAutofixes,
    averageDuration: totalValidations > 0 ? totalDuration / totalValidations : 0,
    averageLoops: totalValidations > 0 ? totalLoops / totalValidations : 0,
    autofixRate: totalFailed > 0 ? totalAutofixes / totalFailed : 1,
    issueFrequency,
  };
}

function formatPercent(n: number): string {
  return (n * 100).toFixed(0) + '%';
}
