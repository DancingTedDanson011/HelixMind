import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import chalk from 'chalk';
import { theme } from './theme.js';
import type { StreamEvent } from '../providers/types.js';

// Configure marked for terminal output with Claude Code-quality rendering
const marked = new Marked();
marked.use(markedTerminal({
  // Code blocks: clean borders with syntax highlighting
  code: chalk.hex('#e6e6e6'),
  codespan: chalk.hex('#00d4ff'),
  // Headings: bold with brand color hierarchy
  heading: chalk.hex('#00d4ff').bold,
  // Strong/emphasis
  strong: chalk.bold,
  em: chalk.italic,
  // Links
  href: chalk.hex('#4169e1').underline,
  // Lists
  listitem: chalk.white,
  // Tables
  tableOptions: {
    chars: {
      top: '\u2500', 'top-mid': '\u252C', 'top-left': '\u250C', 'top-right': '\u2510',
      bottom: '\u2500', 'bottom-mid': '\u2534', 'bottom-left': '\u2514', 'bottom-right': '\u2518',
      left: '\u2502', 'left-mid': '\u251C', mid: '\u2500', 'mid-mid': '\u253C',
      right: '\u2502', 'right-mid': '\u2524', middle: '\u2502',
    },
  },
  // Blockquotes
  blockquote: chalk.hex('#6c757d').italic,
  // Paragraphs
  paragraph: chalk.white,
  // Horizontal rules
  hr: chalk.dim,
  // Width
  width: Math.max(60, (process.stdout.columns || 80) - 8),
  // Reflowing
  reflowText: true,
  // Tab size
  tab: 2,
}) as any);

export function renderMarkdown(text: string): string {
  try {
    return (marked.parse(text) as string).trim();
  } catch {
    return text;
  }
}

export function renderUserMessage(message: string): void {
  process.stdout.write(`\n${theme.userLabel}  ${message}\n\n`);
}

export function renderAssistantStart(): void {
  process.stdout.write(`${theme.aiLabel}  `);
}

export function renderStreamToken(token: string): void {
  process.stdout.write(token);
}

/**
 * Renders the final assistant answer with a visible separator.
 * Saves the cursor row so we can scroll back to it later.
 */
let lastAnswerStartRow = -1;

export function getLastAnswerRow(): number {
  return lastAnswerStartRow;
}

/** Strip ANSI escape codes to get visible character count */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Wrap a single line (may contain ANSI codes) to fit within maxWidth visible characters */
function wrapLine(line: string, maxWidth: number): string[] {
  const visLen = stripAnsi(line).length;
  if (visLen <= maxWidth) return [line];

  // Word-wrap: split on spaces, reassemble into chunks
  const words = line.split(/( +)/); // keep spaces as separate tokens
  const lines: string[] = [];
  let current = '';
  let currentVis = 0;

  for (const word of words) {
    const wordVis = stripAnsi(word).length;
    if (currentVis + wordVis > maxWidth && currentVis > 0) {
      lines.push(current);
      current = '';
      currentVis = 0;
      // Skip leading spaces on new line
      if (word.trim() === '') continue;
    }
    current += word;
    currentVis += wordVis;
  }
  if (current) lines.push(current);

  // Fallback: if a single word is wider than max, hard-break it
  const result: string[] = [];
  for (const l of lines) {
    if (stripAnsi(l).length <= maxWidth) {
      result.push(l);
    } else {
      // Hard break — character by character tracking visible width
      let chunk = '';
      let chunkVis = 0;
      let i = 0;
      const raw = l;
      while (i < raw.length) {
        // Check for ANSI escape sequence
        const ansiMatch = raw.slice(i).match(/^\x1b\[[0-9;]*m/);
        if (ansiMatch) {
          chunk += ansiMatch[0];
          i += ansiMatch[0].length;
          continue;
        }
        if (chunkVis >= maxWidth) {
          result.push(chunk);
          chunk = '';
          chunkVis = 0;
        }
        chunk += raw[i];
        chunkVis++;
        i++;
      }
      if (chunk) result.push(chunk);
    }
  }

  return result.length > 0 ? result : [line];
}

export function renderAssistantEnd(fullText: string): void {
  // Clear the raw stream line
  process.stdout.write('\r\x1b[K');

  // Render formatted markdown
  const formatted = renderMarkdown(fullText);
  const contentWidth = Math.max(40, (process.stdout.columns || 80) - 6);

  // Wrap each line to fit within terminal width
  const rawLines = formatted.split('\n');
  const outputLines: string[] = [];
  for (const line of rawLines) {
    const wrapped = wrapLine(line, contentWidth);
    for (const w of wrapped) {
      outputLines.push(`  ${w}`);
    }
  }
  const output = outputLines.join('\n');

  // Clean output: label + content + subtle separator
  process.stdout.write(`\n  ${theme.aiLabel}\n\n${output}\n\n`);
}

export function renderError(message: string): void {
  process.stdout.write(`\n  ${theme.error('\u2717 Error:')} ${message}\n`);
}

export function renderInfo(message: string): void {
  process.stdout.write(`  ${theme.dim(message)}\n`);
}

export function renderSpiralStatus(
  nodeCount: number,
  l1: number,
  l2: number,
  l3: number,
  l4: number = 0,
  l5: number = 0,
): void {
  process.stdout.write(
    `${theme.dim('Spiral:')} ` +
    `${theme.spiralL1(`L1:${l1}`)} ` +
    `${theme.spiralL2(`L2:${l2}`)} ` +
    `${theme.spiralL3(`L3:${l3}`)} ` +
    `${theme.spiralL4(`L4:${l4}`)} ` +
    `${theme.spiralL5(`L5:${l5}`)} ` +
    `${theme.dim(`(${nodeCount} total)`)}\n`
  );
}
