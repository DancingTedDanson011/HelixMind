import chalk from 'chalk';
import { theme } from './theme.js';
import { visibleLength } from './statusbar.js';
import type { FeedProgress } from '../feed/pipeline.js';

const STAGES: Record<string, string> = {
  scanning: 'Scanning',
  reading: 'Reading',
  parsing: 'Parsing',
  analyzing: 'Understanding',
  spiraling: 'Spiraling',
  enriching: '\u{1F310} Web Research',
  done: 'Done',
};

const BAR_WIDTH = 20;

/** Get usable terminal width (with small margin) */
function termWidth(): number {
  return (process.stdout.columns || 80) - 4;
}

/** Truncate a plain string to maxLen, adding ellipsis if needed */
function truncText(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}

export function renderFeedProgress(progress: FeedProgress): void {
  const tw = termWidth();
  const label = STAGES[progress.stage] ?? progress.stage;
  const pct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  const filled = Math.round((pct / 100) * BAR_WIDTH);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(BAR_WIDTH - filled);

  let line = `  ${label.padEnd(16)} ${theme.primary(bar)} ${String(pct).padStart(3)}%`;

  // Calculate remaining space for detail/file info
  const baseLen = visibleLength(line);
  const remaining = tw - baseLen;

  if (remaining > 10 && progress.detail) {
    const detail = truncText(progress.detail, remaining - 4);
    line += `  ${theme.dim(detail)}`;
  }

  const afterDetail = visibleLength(line);
  const remaining2 = tw - afterDetail;

  if (remaining2 > 10 && progress.currentFile) {
    const file = truncText(progress.currentFile, remaining2 - 4);
    line += `  ${theme.dim(file)}`;
  }

  // Use carriage return to overwrite the line
  process.stdout.write(`\r\x1b[K${line}`);

  if (progress.stage === 'done') {
    process.stdout.write('\n');
  }
}

export function renderFeedSummary(result: {
  filesScanned: number;
  filesRead: number;
  nodesCreated: number;
  nodesSkipped?: number;
  relationsCreated: number;
  modules: Array<{ name: string; files: string[]; description: string }>;
  architecture: string;
  techStack: string[];
  webEnrichment?: {
    topics: string[];
    nodesStored: number;
    duration_ms: number;
  };
}): void {
  const tw = termWidth();
  const indent = '  ';
  const moduleIndent = '     ';

  process.stdout.write('\n');
  process.stdout.write(`${theme.accent('\u{1F300}')} ${theme.bold('Feed Complete!')}\n\n`);
  process.stdout.write(`${indent}${theme.primary('\u{1F4C1}')} Scanned: ${result.filesScanned} files (${result.filesRead} relevant)\n`);
  const skipNote = result.nodesSkipped ? ` ${theme.dim(`(${result.nodesSkipped} unchanged)`)}` : '';
  process.stdout.write(`${indent}${theme.primary('\u{1F9E0}')} Created: ${result.nodesCreated} context nodes${skipNote}\n`);
  process.stdout.write(`${indent}${theme.primary('\u{1F517}')} Relations: ${result.relationsCreated} connections\n`);

  if (result.modules.length > 0) {
    process.stdout.write(`${indent}${theme.primary('\u{1F4CA}')} Modules detected:\n`);
    for (let i = 0; i < result.modules.length; i++) {
      const mod = result.modules[i];
      const isLast = i === result.modules.length - 1;
      const prefix = isLast ? '\u2514\u2500' : '\u251C\u2500';

      // Header line: "├─ moduleName (N files)"
      const header = `${moduleIndent}${prefix} ${mod.name} (${mod.files.length} files)`;
      process.stdout.write(`${theme.bold(header)}\n`);

      // Description parts on separate indented lines, each truncated
      const descParts = mod.description.split(' \u2014 ').filter(Boolean);
      const descIndent = moduleIndent + (isLast ? '   ' : '\u2502  ');
      for (const part of descParts) {
        // Skip the redundant "N files" part (already in header)
        if (/^\d+ files$/.test(part.trim())) continue;
        const truncated = truncText(part.trim(), tw - descIndent.length);
        process.stdout.write(`${descIndent}${theme.dim(truncated)}\n`);
      }
    }
  }

  // Architecture — truncate to fit
  const archPrefix = `${indent}${theme.primary('\u{1F3D7}\uFE0F')}  Architecture: `;
  const archText = truncText(result.architecture, tw - 24);
  process.stdout.write(`${archPrefix}${archText}\n`);

  // Tech stack — wrap into multiple lines if needed
  const stackPrefix = `${indent}${theme.primary('\u{1F527}')} Stack: `;
  const stackPrefixLen = 12; // "  🔧 Stack: " visible length
  writeWrappedList(result.techStack, stackPrefix, stackPrefixLen, tw, indent + '         ');

  if (result.webEnrichment && result.webEnrichment.nodesStored > 0) {
    process.stdout.write(`${indent}${theme.primary('\u{1F310}')} Web Knowledge: +${result.webEnrichment.nodesStored} nodes from internet research\n`);
    if (result.webEnrichment.topics.length > 0) {
      const topicText = truncText(result.webEnrichment.topics.join(', '), tw - moduleIndent.length);
      process.stdout.write(`${moduleIndent}${theme.dim(topicText)}\n`);
    }
  }

  process.stdout.write('\n');
  process.stdout.write(`${indent}${theme.dim('Your spiral now deeply understands this project.')}\n\n`);
}

/** Write a comma-separated list with word-wrapping at terminal width */
function writeWrappedList(
  items: string[],
  prefix: string,
  prefixVisibleLen: number,
  maxWidth: number,
  wrapIndent: string,
): void {
  if (items.length === 0) {
    process.stdout.write(`${prefix}\n`);
    return;
  }

  let line = prefix;
  let lineLen = prefixVisibleLen;
  let firstItem = true;

  for (const item of items) {
    const separator = firstItem ? '' : ', ';
    const addition = separator + item;

    if (!firstItem && lineLen + addition.length > maxWidth) {
      // Wrap to next line
      process.stdout.write(`${line}\n`);
      line = wrapIndent + item;
      lineLen = wrapIndent.length + item.length;
    } else {
      line += addition;
      lineLen += addition.length;
    }
    firstItem = false;
  }

  process.stdout.write(`${line}\n`);
}
