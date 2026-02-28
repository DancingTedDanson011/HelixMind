/**
 * Validation Reporter — Terminal UI for validation results.
 * Shows a compact summary box with check results per category.
 */
import chalk from 'chalk';
import type { CheckResult } from './static-checks.js';
import type { ValidationResult, ValidationStatus } from './autofix.js';
import type { CriterionCategory } from './criteria.js';

/**
 * Render the validation summary box.
 */
export function renderValidationSummary(result: ValidationResult, verbose: boolean = false): string {
  const totalChecks = result.results.length;
  const passed = result.results.filter(r => r.passed).length;
  const errors = result.results.filter(r => !r.passed && r.severity === 'error').length;
  const warnings = result.results.filter(r => !r.passed && r.severity === 'warning').length;

  const statusIcon = getStatusIcon(result.status);
  const durationStr = result.duration < 1000
    ? `${result.duration}ms`
    : `${(result.duration / 1000).toFixed(1)}s`;

  const lines: string[] = [];

  // ── Header ──
  const header = `${statusIcon} Validation Matrix \u2500\u2500 ${totalChecks} checks \u2500\u2500 ${result.loops} loop${result.loops !== 1 ? 's' : ''} \u2500\u2500 ${durationStr}`;
  lines.push(chalk.dim('\u256D\u2500\u2500\u2500 ') + headerColor(result.status)(header) + chalk.dim(' \u2500\u2500\u2500\u256E'));
  lines.push(chalk.dim('\u2502'));

  // ── Category summary ──
  if (verbose) {
    // Show every single check
    for (const r of result.results) {
      const icon = r.passed ? chalk.green('\u2705') : (r.severity === 'error' ? chalk.red('\u274C') : chalk.yellow('\u26A0\uFE0F'));
      const detail = r.passed ? chalk.dim(r.details) : chalk.white(r.details);
      lines.push(chalk.dim('\u2502  ') + `${icon} ${chalk.cyan(r.id)} ${detail}`);
      if (!r.passed && r.fix) {
        lines.push(chalk.dim('\u2502     \u2192 ') + chalk.yellow(r.fix));
      }
    }
  } else {
    // Group by category
    const grouped = groupByCategory(result.results);
    for (const [category, checks] of grouped) {
      const categoryPassed = checks.filter(r => r.passed).length;
      const categoryTotal = checks.length;
      const icons = checks.map(r => r.passed ? '\u2705' : (r.severity === 'error' ? '\u274C' : '\u26A0\uFE0F')).join('');

      // Check for autofixed items
      const fixed = checks.filter(r => r.passed && r.autofix);
      const fixedSuffix = fixed.length > 0 ? chalk.dim(` (${fixed.length} fixed)`) : '';

      const label = formatCategory(category);
      const ratio = `${categoryPassed}/${categoryTotal}`;

      lines.push(chalk.dim('\u2502  ') + `${label}: ${icons}  ${chalk.dim(ratio)}${fixedSuffix}`);
    }

    // Show failed checks details
    const failed = result.results.filter(r => !r.passed && r.severity === 'error');
    if (failed.length > 0) {
      lines.push(chalk.dim('\u2502'));
      for (const f of failed) {
        lines.push(chalk.dim('\u2502  ') + chalk.red(`\u274C ${f.id}: ${f.details}`));
        if (f.fix) {
          lines.push(chalk.dim('\u2502     \u2192 ') + chalk.yellow(f.fix));
        }
      }
    }
  }

  // ── Footer ──
  lines.push(chalk.dim('\u2502'));

  const footerParts: string[] = [];
  if (result.fixesApplied > 0) {
    footerParts.push(chalk.cyan(`\u{1F527} ${result.fixesApplied} autofix${result.fixesApplied !== 1 ? 'es' : ''} applied`));
  }
  footerParts.push(`${warnings} warning${warnings !== 1 ? 's' : ''}`);
  footerParts.push(`${errors} error${errors !== 1 ? 's' : ''}`);

  lines.push(chalk.dim('\u2502  ') + footerParts.join(chalk.dim(' \u2502 ')));
  lines.push(chalk.dim('\u2570') + chalk.dim('\u2500'.repeat(60)) + chalk.dim('\u256F'));

  return lines.join('\n');
}

/**
 * Render a compact one-line validation result (for status bar or non-verbose).
 */
export function renderValidationOneLine(result: ValidationResult): string {
  const passed = result.results.filter(r => r.passed).length;
  const total = result.results.length;
  const icon = result.status === 'passed' ? '\u2705' : result.status === 'warnings' ? '\u26A0\uFE0F' : '\u274C';

  return `${icon} Validation: ${passed}/${total} checks passed (${result.duration}ms)`;
}

/**
 * Show validation start indicator.
 */
export function renderValidationStart(): string {
  return chalk.dim('\n  \u{1F50D} Validating output...\n');
}

/**
 * Render classification info (for verbose mode).
 */
export function renderClassification(category: string, complexity: string, criteriaCount: number): string {
  return chalk.dim(`  \u{1F4CB} Task: ${category} | Complexity: ${complexity} | ${criteriaCount} criteria`);
}

// ── Helpers ──

function getStatusIcon(status: ValidationStatus): string {
  switch (status) {
    case 'passed': return '\u2705';
    case 'warnings': return '\u26A0\uFE0F';
    case 'errors': return '\u274C';
    case 'max_loops': return '\u{1F504}';
    default: return '\u2753';
  }
}

function headerColor(status: ValidationStatus): (s: string) => string {
  switch (status) {
    case 'passed': return chalk.green;
    case 'warnings': return chalk.yellow;
    case 'errors': return chalk.red;
    case 'max_loops': return chalk.hex('#FF6600');
    default: return chalk.white;
  }
}

function formatCategory(category: string): string {
  const labels: Record<string, string> = {
    structural: 'Structural  ',
    completeness: 'Completeness',
    consistency: 'Consistency ',
    logic: 'Logic       ',
    style: 'Style       ',
    security: 'Security    ',
    performance: 'Performance ',
  };
  return chalk.bold(labels[category] || category.padEnd(12));
}

function groupByCategory(results: CheckResult[]): Map<string, CheckResult[]> {
  const grouped = new Map<string, CheckResult[]>();
  const order: CriterionCategory[] = ['structural', 'completeness', 'consistency', 'logic', 'style', 'security', 'performance'];

  // Pre-fill in order
  for (const cat of order) {
    grouped.set(cat, []);
  }

  for (const r of results) {
    // Infer category from ID patterns
    const category = inferCategory(r.id);
    const list = grouped.get(category);
    if (list) {
      list.push(r);
    } else {
      grouped.set(category, [r]);
    }
  }

  // Remove empty categories
  for (const [key, val] of grouped) {
    if (val.length === 0) grouped.delete(key);
  }

  return grouped;
}

function inferCategory(id: string): string {
  if (id.includes('html') || id.includes('syntax') || id.includes('links') || id.includes('ids') || id.includes('import') || id.includes('types') || id.includes('bracket') || id.includes('assertion') || id.includes('mocks')) return 'structural';
  if (id.includes('requirement') || id.includes('complete') || id.includes('bug-addressed') || id.includes('output-format') || id.includes('responsive')) return 'completeness';
  if (id.includes('style') || id.includes('naming') || id.includes('pattern') || id.includes('response-format') || id.includes('spiral-style') || id.includes('spiral-pattern')) return 'consistency';
  if (id.includes('dead-code') || id.includes('async') || id.includes('error-handling') || id.includes('no-regression') || id.includes('behavior') || id.includes('edge') || id.includes('circular') || id.includes('separation') || id.includes('input-handled') || id.includes('false-positive') || id.includes('spiral-bugs')) return 'logic';
  if (id.includes('security') || id.includes('sql') || id.includes('hardcoded') || id.includes('auth') || id.includes('secret') || id.includes('injection') || id.includes('no-secrets')) return 'security';
  if (id.includes('status-code') || id.includes('img-alt') || id.includes('events')) return 'structural';
  if (id.startsWith('dyn-') || id.startsWith('spiral-')) return 'completeness';
  return 'structural';
}
