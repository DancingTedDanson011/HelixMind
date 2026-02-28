import chalk from 'chalk';
import { theme } from './theme.js';
import { formatElapsed } from './activity.js';

const TOOL_ICONS: Record<string, string> = {
  read_file: '\u{1F4C4}',
  write_file: '\u{1F4DD}',
  edit_file: '\u270F\uFE0F',
  list_directory: '\u{1F4C1}',
  search_files: '\u{1F50D}',
  find_files: '\u{1F50D}',
  run_command: '\u26A1',
  git_status: '\u{1F4E6}',
  git_diff: '\u{1F4E6}',
  git_commit: '\u{1F4E6}',
  git_log: '\u{1F4E6}',
  spiral_query: '\u{1F300}',
  spiral_store: '\u{1F300}',
  web_research: '\u{1F310}',
};

/** Track tool call count for compact display */
let toolCallCount = 0;
let toolBlockOpen = false;

/** Reset tool call counter (call at start of each agent run) */
export function resetToolCounter(): void {
  toolCallCount = 0;
}

/** Check if currently inside a visual tool block */
export function isInsideToolBlock(): boolean {
  return toolBlockOpen;
}

/** Start a visual tool block — bordered section grouping tool calls */
export function renderToolBlockStart(): void {
  toolBlockOpen = true;
  const termWidth = (process.stdout.columns || 80) - 4;
  const headerText = '\u2500 Working ';
  const line = headerText + '\u2500'.repeat(Math.max(10, termWidth - headerText.length - 1));
  process.stdout.write(`\n  ${chalk.dim('\u250C' + line)}\n`);
}

/** Close the visual tool block with a summary footer */
export function renderToolBlockEnd(stepCount: number, durationMs: number): void {
  toolBlockOpen = false;
  const termWidth = (process.stdout.columns || 80) - 4;
  const timeStr = formatElapsed(durationMs);
  const footerText = `\u2500\u2500 ${stepCount} step${stepCount !== 1 ? 's' : ''} \u00B7 ${timeStr} `;
  const line = footerText + '\u2500'.repeat(Math.max(10, termWidth - footerText.length - 1));
  process.stdout.write(`  ${chalk.dim('\u2514' + line)}\n`);
}

/**
 * Display a tool call as a compact single-line that overwrites previous tool output.
 */
export function renderToolCall(name: string, input: Record<string, unknown>): void {
  toolCallCount++;
  const icon = TOOL_ICONS[name] || '\u{1F527}';
  const summary = formatToolInput(name, input);
  const countStr = `[${toolCallCount}]`;
  // Prefix: "  │ [N] " = 5 + countStr.length + 1; Suffix: " ✓ NNN lines" ≈ 15
  const overhead = 5 + countStr.length + 1 + 2 + 15; // prefix + icon(2col) + suffix room
  const maxLabel = Math.max(20, (process.stdout.columns || 80) - overhead);
  const label = `${name}: ${summary}`;
  const truncLabel = label.length > maxLabel ? label.slice(0, maxLabel - 1) + '\u2026' : label;

  // Clear current readline input, write tool line, readline will re-prompt after
  process.stdout.write(`\r\x1b[K  ${chalk.dim('\u2502')} ${theme.dim(countStr)} ${icon} ${theme.secondary(truncLabel)}`);
}

/**
 * Display tool execution result — compact suffix on the same line.
 */
export function renderToolResult(name: string, result: string): void {
  const isError = result.startsWith('Error:');
  if (isError) {
    const errMsg = result.slice(7, 60).replace(/\n/g, ' ');
    process.stdout.write(` ${theme.error('\u2717')} ${theme.dim(errMsg)}\n`);
  } else {
    const lines = result.split('\n').length;
    const chars = result.length;
    // More informative size hints based on tool type
    let sizeHint: string;
    if (name === 'read_file') {
      sizeHint = `${lines} lines`;
    } else if (name === 'write_file') {
      sizeHint = `${lines} lines written`;
    } else if (name === 'edit_file') {
      sizeHint = 'applied';
    } else if (name === 'list_directory') {
      // Count entries (lines minus header)
      const entries = Math.max(0, lines - 1);
      sizeHint = `${entries} entries`;
    } else if (name === 'search_files' || name === 'find_files') {
      const matches = lines > 1 ? lines : 0;
      sizeHint = matches > 0 ? `${matches} matches` : 'no matches';
    } else if (name === 'run_command') {
      sizeHint = lines > 1 ? `${lines} lines output` : `${chars}ch`;
    } else {
      sizeHint = lines > 1 ? `${lines} ln` : `${chars}ch`;
    }
    process.stdout.write(` ${theme.success('\u2713')} ${theme.dim(sizeHint)}\n`);
  }
}

/**
 * Display when user denies a tool call.
 */
export function renderToolDenied(name: string): void {
  process.stdout.write(`  ${chalk.dim('\u2502')} ${theme.error('\u2717')} ${name}: ${theme.dim('denied by user')}\n`);
}

/**
 * Display diff between old and new content.
 */
export function renderDiff(oldStr: string, newStr: string): void {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');

  process.stdout.write(theme.dim('  ┌─ Diff ─────\n'));

  // Simple diff: show removed and added lines
  for (const line of oldLines) {
    process.stdout.write(`  │ ${theme.error('- ' + line)}\n`);
  }
  for (const line of newLines) {
    process.stdout.write(`  │ ${theme.success('+ ' + line)}\n`);
  }

  process.stdout.write(theme.dim('  └─────────────\n'));
}

function formatToolInput(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'read_file': {
      const p = shortenPath(String(input.path || ''));
      return input.line_start ? `${p}:${input.line_start}` : p;
    }
    case 'write_file':
      return shortenPath(String(input.path || ''));
    case 'edit_file':
      return shortenPath(String(input.path || ''));
    case 'list_directory':
      return shortenPath(String(input.path || '.'));
    case 'search_files':
      return `"${input.pattern}" in ${input.include || '**/*'}`;
    case 'find_files':
      return String(input.pattern || '');
    case 'run_command': {
      const cmd = String(input.command || '');
      return cmd.length > 60 ? cmd.slice(0, 57) + '...' : cmd;
    }
    case 'git_commit':
      return `"${String(input.message || '').slice(0, 50)}"`;
    case 'git_diff':
      return input.path ? shortenPath(String(input.path)) : '(all)';
    case 'git_log':
      return input.file ? shortenPath(String(input.file)) : `last ${input.count || 10}`;
    case 'spiral_query':
      return `"${input.query}"`;
    case 'spiral_store':
      return `[${input.type}] ${String(input.content || '').slice(0, 50)}`;
    case 'web_research':
      return `"${String(input.query || '').slice(0, 50)}"`;
    default:
      return JSON.stringify(input).slice(0, 80);
  }
}

/** Shorten file paths by showing only the last 2-3 segments */
function shortenPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 3) return normalized;
  return '.../' + parts.slice(-3).join('/');
}
