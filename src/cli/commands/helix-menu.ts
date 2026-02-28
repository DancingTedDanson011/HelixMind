import { exec } from 'node:child_process';
import { platform } from 'node:os';
import { theme } from '../ui/theme.js';
import { renderError, renderInfo } from '../ui/chat-view.js';
import { renderFeedProgress, renderFeedSummary } from '../ui/progress.js';
import { exportBrainData } from '../brain/exporter.js';
import { generateBrainFile, startLiveBrain } from '../brain/generator.js';
import { runFeedPipeline } from '../feed/pipeline.js';
import { selectMenu, confirmMenu } from '../ui/select-menu.js';
import type { BrainScope } from '../../utils/config.js';

import { showKeyManagement, showModelSwitcher } from './setup.js';
import type { ConfigStore } from '../config/store.js';

const MENU_ITEMS = [
  { label: '\u{1F9E0} Brain View',        description: 'Open 3D Spiral Visualization' },
  { label: '\u{1F4CA} Spiral Status',     description: 'Show metrics & statistics' },
  { label: '\u{1F50D} Search Context',    description: 'Search the spiral' },
  { label: '\u{1F4C1} Feed Files',        description: 'Feed files/directories' },
  { label: '\u{1F517} Show Relations',    description: 'Show top connections' },
  { label: '\u{1F4C8} Token Budget',      description: 'Token usage & distribution' },
  { label: '\u{1F3D7}\uFE0F  Architecture',     description: 'Detected project architecture' },
  { label: '\u{1F4DD} Memory Log',        description: 'What has the spiral learned?' },
  { label: '\u{1F511} API Keys',          description: 'Manage providers & keys' },
  { label: '\u{1F504} Switch Model',      description: 'Change provider/model' },
  { label: '\u{1F5D1}\uFE0F  Reset',             description: 'Reset spiral' },
];

function openInBrowser(filePath: string): void {
  const cmd = platform() === 'win32' ? `start "" "${filePath}"`
    : platform() === 'darwin' ? `open "${filePath}"`
    : `xdg-open "${filePath}"`;
  exec(cmd, () => {});
}

export async function showHelixMenu(spiralEngine: any, configStore?: ConfigStore, brainScope: BrainScope = 'global'): Promise<void> {
  process.stdout.write('\n');
  process.stdout.write(theme.primary('  \u{1F300} HelixMind Command Center\n'));
  process.stdout.write(theme.separator + '\n\n');

  while (true) {
    const choice = await selectMenu(MENU_ITEMS, {
      title: 'Command Center',
      cancelLabel: 'Back to chat',
      pageSize: 12,
    });

    if (choice < 0) return;

    switch (choice) {
      case 0:
        if (spiralEngine) await handleBrainView(spiralEngine, brainScope);
        else renderInfo('Spiral engine not available.');
        break;
      case 1:
        if (spiralEngine) handleSpiralStatus(spiralEngine);
        else renderInfo('Spiral engine not available.');
        break;
      case 2:
        if (spiralEngine) await handleSearch(spiralEngine);
        else renderInfo('Spiral engine not available.');
        break;
      case 3:
        if (spiralEngine) await handleFeed(spiralEngine);
        else renderInfo('Spiral engine not available.');
        break;
      case 4:
        if (spiralEngine) handleRelations(spiralEngine);
        else renderInfo('Spiral engine not available.');
        break;
      case 5:
        if (spiralEngine) handleTokenBudget(spiralEngine);
        else renderInfo('Spiral engine not available.');
        break;
      case 6:
        if (spiralEngine) handleArchitecture(spiralEngine);
        else renderInfo('Spiral engine not available.');
        break;
      case 7:
        if (spiralEngine) handleMemoryLog(spiralEngine);
        else renderInfo('Spiral engine not available.');
        break;
      case 8:
        if (configStore) {
          await showKeyManagement(configStore);
        } else {
          renderInfo('Use "helixmind config list" to see settings.');
        }
        break;
      case 9:
        if (configStore) {
          await showModelSwitcher(configStore);
        } else {
          renderInfo('Config store not available.');
        }
        break;
      case 10:
        if (spiralEngine) await handleReset(spiralEngine);
        else renderInfo('Spiral engine not available.');
        break;
    }

    process.stdout.write('\n');
  }
}

async function handleBrainView(engine: any, brainScope: BrainScope = 'global'): Promise<void> {
  renderInfo('Starting live brain visualization...');
  try {
    const data = exportBrainData(engine, 'HelixMind Project', brainScope);
    if (data.meta.totalNodes === 0) {
      renderInfo('Spiral is empty. Feed some files first: /feed or helixmind feed ./src/');
      return;
    }
    const url = await startLiveBrain(engine, 'HelixMind Project', brainScope);
    openInBrowser(url);
    process.stdout.write(`  ${theme.success('\u{1F9E0} Brain View live at:')} ${url}\n`);
    renderInfo('Brain auto-updates when spiral changes. Keep HelixMind running.');
  } catch (err) {
    renderError(`Failed to start brain view: ${err}`);
  }
}

function handleSpiralStatus(engine: any): void {
  try {
    const status = engine.status();
    const l1 = status.per_level[1] ?? 0;
    const l2 = status.per_level[2] ?? 0;
    const l3 = status.per_level[3] ?? 0;
    const l4 = status.per_level[4] ?? 0;
    const l5 = status.per_level[5] ?? 0;
    const total = status.total_nodes;

    const bar = (count: number, max: number) => {
      const pct = max > 0 ? count / max : 0;
      const filled = Math.round(pct * 14);
      return '\u2588'.repeat(filled) + '\u2591'.repeat(14 - filled);
    };

    process.stdout.write(`
${theme.bold('\u{1F300} Spiral Status')}
${theme.separator}
Nodes:      ${total} total
  Level 1:  ${String(l1).padStart(4)} (Focus)        ${theme.spiralL1(bar(l1, total))} ${Math.round(l1/Math.max(total,1)*100)}%
  Level 2:  ${String(l2).padStart(4)} (Active)       ${theme.spiralL2(bar(l2, total))} ${Math.round(l2/Math.max(total,1)*100)}%
  Level 3:  ${String(l3).padStart(4)} (Reference)    ${theme.spiralL3(bar(l3, total))} ${Math.round(l3/Math.max(total,1)*100)}%
  Level 4:  ${String(l4).padStart(4)} (Archive)      ${theme.spiralL4(bar(l4, total))} ${Math.round(l4/Math.max(total,1)*100)}%
  Level 5:  ${String(l5).padStart(4)} (Deep Archive) ${theme.spiralL5(bar(l5, total))} ${Math.round(l5/Math.max(total,1)*100)}%

Relations:  ${status.total_edges} connections
Storage:    ${(status.storage_size_bytes / 1024).toFixed(1)} KB
Embeddings: ${status.embedding_status}
${status.oldest_node ? `Oldest:     ${status.oldest_node.slice(0,10)}` : ''}
${status.newest_node ? `Newest:     ${status.newest_node.slice(0,10)}` : ''}
`);
  } catch (err) {
    renderError(`Failed to get status: ${err}`);
  }
}

async function handleSearch(engine: any): Promise<void> {
  // Raw stdin text input — same pattern as selectMenu
  process.stdout.write(theme.primary('\n  Search query: '));

  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  if (stdin.isTTY) stdin.setRawMode(true);
  stdin.resume();

  let buffer = '';

  const query: string = await new Promise(resolve => {
    function onData(data: Buffer): void {
      const key = data.toString();
      if (key === '\r' || key === '\n') {
        cleanup(); process.stdout.write('\n'); resolve(buffer); return;
      }
      if (key === '\x7f' || key === '\b') {
        if (buffer.length > 0) { buffer = buffer.slice(0, -1); process.stdout.write('\b \b'); }
        return;
      }
      if (key === '\x03' || key === '\x1b') {
        cleanup(); process.stdout.write('\n'); resolve(''); return;
      }
      if (key.startsWith('\x1b[')) return;
      for (const ch of key) {
        if (ch.charCodeAt(0) >= 32) { buffer += ch; process.stdout.write(ch); }
      }
    }
    function cleanup(): void {
      stdin.removeListener('data', onData);
      if (stdin.isTTY) stdin.setRawMode(wasRaw);
    }
    stdin.on('data', onData);
  });

  if (!query.trim()) return;

  try {
    const result = await engine.query(query.trim());
    if (result.node_count === 0) {
      renderInfo('No matching context found.');
    } else {
      const sections = [
        { label: 'L1 Focus', nodes: result.level_1, color: theme.spiralL1 },
        { label: 'L2 Active', nodes: result.level_2, color: theme.spiralL2 },
        { label: 'L3 Reference', nodes: result.level_3, color: theme.spiralL3 },
        { label: 'L4 Archive', nodes: result.level_4, color: theme.spiralL4 },
        { label: 'L5 Deep Archive', nodes: result.level_5, color: theme.spiralL5 },
      ];
      for (const { label, nodes, color } of sections) {
        if (nodes.length > 0) {
          process.stdout.write(`\n  ${color(label)}:\n`);
          for (const node of nodes) {
            process.stdout.write(`    ${color('\u25CF')} [${node.type}] ${node.content.slice(0, 80)}${node.content.length > 80 ? '...' : ''}\n`);
            process.stdout.write(`      ${theme.dim(`relevance: ${node.relevance.toFixed(3)}`)}\n`);
          }
        }
      }
      process.stdout.write(`\n  ${theme.dim(`${result.node_count} nodes, ${result.total_tokens} tokens`)}\n`);
    }
  } catch (err) {
    renderError(`Search failed: ${err}`);
  }
}

async function handleFeed(engine: any): Promise<void> {
  const rootDir = process.cwd();
  renderInfo('Feeding current directory...\n');
  try {
    const result = await runFeedPipeline(rootDir, engine, {
      onProgress: renderFeedProgress,
    });
    renderFeedSummary(result);
  } catch (err) {
    renderError(`Feed failed: ${err}`);
  }
}

function handleRelations(engine: any): void {
  try {
    const data = engine.exportForVisualization();
    if (data.edges.length === 0) {
      renderInfo('No relations found. Feed some files first.');
      return;
    }

    // Count relation types
    const typeCounts: Record<string, number> = {};
    for (const edge of data.edges) {
      typeCounts[edge.type] = (typeCounts[edge.type] ?? 0) + 1;
    }

    process.stdout.write(`\n${theme.bold('\u{1F517} Relations')}\n${theme.separator}\n`);
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
      process.stdout.write(`  ${type.padEnd(16)} ${count}\n`);
    }

    // Top connected nodes
    const nodeDegree: Record<string, number> = {};
    for (const edge of data.edges) {
      nodeDegree[edge.source] = (nodeDegree[edge.source] ?? 0) + 1;
      nodeDegree[edge.target] = (nodeDegree[edge.target] ?? 0) + 1;
    }

    const topNodes = Object.entries(nodeDegree)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (topNodes.length > 0) {
      process.stdout.write(`\n  ${theme.bold('Most connected:')}\n`);
      for (const [nodeId, degree] of topNodes) {
        const node = data.nodes.find((n: any) => n.id === nodeId);
        const label = node?.label ?? nodeId.slice(0, 8);
        process.stdout.write(`    ${String(degree).padStart(3)} connections \u2014 ${label}\n`);
      }
    }
    process.stdout.write('\n');
  } catch (err) {
    renderError(`Failed to show relations: ${err}`);
  }
}

function handleTokenBudget(engine: any): void {
  try {
    const status = engine.status();
    const totalBudget = 100_000;
    const l1Tokens = (status.per_level[1] ?? 0) * 30;
    const l2Tokens = (status.per_level[2] ?? 0) * 20;
    const l3Tokens = (status.per_level[3] ?? 0) * 10;
    const l4Tokens = (status.per_level[4] ?? 0) * 5;
    const l5Tokens = (status.per_level[5] ?? 0) * 2;
    const spiralTotal = l1Tokens + l2Tokens + l3Tokens + l4Tokens + l5Tokens;

    const bar = (tokens: number) => {
      const pct = Math.min(tokens / totalBudget, 1);
      const filled = Math.round(pct * 14);
      return '\u2588'.repeat(filled) + '\u2591'.repeat(14 - filled);
    };

    process.stdout.write(`
${theme.bold('\u{1F4C8} Token Budget Allocation')}
${theme.separator}
Total Budget:  ${totalBudget.toLocaleString()} tokens

  L1 Focus:       ${String(l1Tokens).padStart(6)}  ${theme.spiralL1(bar(l1Tokens))} ${Math.round(l1Tokens/totalBudget*100)}%
  L2 Active:      ${String(l2Tokens).padStart(6)}  ${theme.spiralL2(bar(l2Tokens))} ${Math.round(l2Tokens/totalBudget*100)}%
  L3 Reference:   ${String(l3Tokens).padStart(6)}  ${theme.spiralL3(bar(l3Tokens))} ${Math.round(l3Tokens/totalBudget*100)}%
  L4 Archive:     ${String(l4Tokens).padStart(6)}  ${theme.spiralL4(bar(l4Tokens))} ${Math.round(l4Tokens/totalBudget*100)}%
  L5 Deep Arch:   ${String(l5Tokens).padStart(6)}  ${theme.spiralL5(bar(l5Tokens))} ${Math.round(l5Tokens/totalBudget*100)}%
  Spiral total:   ${String(spiralTotal).padStart(6)}
  Available:      ${String(totalBudget - spiralTotal).padStart(6)}
`);
  } catch (err) {
    renderError(`Failed to show token budget: ${err}`);
  }
}

function handleArchitecture(engine: any): void {
  try {
    const data = engine.exportForVisualization();
    const archNodes = data.nodes.filter((n: any) => n.type === 'architecture');
    const moduleNodes = data.nodes.filter((n: any) => n.type === 'module');

    process.stdout.write(`\n${theme.bold('\u{1F3D7}\uFE0F  Detected Architecture')}\n${theme.separator}\n`);

    if (archNodes.length === 0 && moduleNodes.length === 0) {
      renderInfo('No architecture data. Feed your project first: helixmind feed ./src/');
      return;
    }

    for (const node of archNodes) {
      process.stdout.write(`\n  ${theme.accent(node.label)}\n`);
      process.stdout.write(`  ${theme.dim(node.content)}\n`);
    }

    if (moduleNodes.length > 0) {
      process.stdout.write(`\n  ${theme.bold('Modules:')}\n`);
      for (const mod of moduleNodes) {
        process.stdout.write(`    ${theme.spiralL2('\u25CF')} ${mod.label}\n`);
      }
    }
    process.stdout.write('\n');
  } catch (err) {
    renderError(`Failed to show architecture: ${err}`);
  }
}

function handleMemoryLog(engine: any): void {
  try {
    const data = engine.exportForVisualization();
    if (data.nodes.length === 0) {
      renderInfo('Spiral is empty.');
      return;
    }

    // Group by date
    const byDate: Record<string, number> = {};
    for (const node of data.nodes) {
      const date = node.createdAt.slice(0, 10);
      byDate[date] = (byDate[date] ?? 0) + 1;
    }

    process.stdout.write(`\n${theme.bold('\u{1F4DD} Memory Log')}\n${theme.separator}\n`);
    process.stdout.write(`  Total: ${data.nodes.length} nodes, ${data.edges.length} relations\n\n`);

    const dates = Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10);
    for (const [date, count] of dates) {
      const isToday = date === new Date().toISOString().slice(0, 10);
      const label = isToday ? 'Today' : date;
      process.stdout.write(`    ${label.padEnd(12)} +${count} nodes\n`);
    }
    process.stdout.write('\n');
  } catch (err) {
    renderError(`Failed to show memory log: ${err}`);
  }
}

async function handleReset(engine: any): Promise<void> {
  const confirmed = await confirmMenu(theme.warning('\u26A0\uFE0F  Are you sure you want to reset the spiral?'));
  if (confirmed) {
    try {
      engine.compact(true);
      renderInfo('Spiral compacted aggressively.');
    } catch (err) {
      renderError(`Reset failed: ${err}`);
    }
  } else {
    renderInfo('Reset cancelled.');
  }
}
