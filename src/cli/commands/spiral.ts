import { theme } from '../ui/theme.js';
import { renderSpiralStatus, renderError, renderInfo } from '../ui/chat-view.js';

async function getSpiralEngine() {
  try {
    const { SpiralEngine } = await import('../../spiral/engine.js');
    const { loadConfig } = await import('../../utils/config.js');
    const config = loadConfig();
    return new SpiralEngine(config);
  } catch (err) {
    renderError(`Failed to initialize spiral engine: ${err}`);
    return null;
  }
}

export async function spiralStatusCommand(): Promise<void> {
  const engine = await getSpiralEngine();
  if (!engine) return;

  try {
    const status = engine.status();
    process.stdout.write(`\n${theme.bold('Spiral Status')}\n`);
    process.stdout.write(`${theme.separator}\n`);
    renderSpiralStatus(
      status.total_nodes,
      status.per_level[1] ?? 0,
      status.per_level[2] ?? 0,
      status.per_level[3] ?? 0,
    );
    process.stdout.write(`  Edges: ${status.total_edges}\n`);
    process.stdout.write(`  Storage: ${(status.storage_size_bytes / 1024).toFixed(1)} KB\n`);
    process.stdout.write(`  Embeddings: ${status.embedding_status}\n\n`);
  } finally {
    engine.close();
  }
}

export async function spiralSearchCommand(query: string): Promise<void> {
  const engine = await getSpiralEngine();
  if (!engine) return;

  try {
    await engine.initialize();
    const result = await engine.query(query);

    process.stdout.write(`\n${theme.bold('Search Results')}\n`);
    process.stdout.write(`${theme.separator}\n`);

    if (result.node_count === 0) {
      renderInfo('No matching context found.');
      return;
    }

    if (result.level_1.length > 0) {
      process.stdout.write(`\n${theme.spiralL1('Level 1 — Focus:')}\n`);
      for (const node of result.level_1) {
        process.stdout.write(`  ${theme.spiralL1('●')} [${node.type}] ${node.content.slice(0, 100)}\n`);
      }
    }

    if (result.level_2.length > 0) {
      process.stdout.write(`\n${theme.spiralL2('Level 2 — Association:')}\n`);
      for (const node of result.level_2) {
        process.stdout.write(`  ${theme.spiralL2('●')} [${node.type}] ${node.content.slice(0, 100)}\n`);
      }
    }

    if (result.level_3.length > 0) {
      process.stdout.write(`\n${theme.spiralL3('Level 3 — Periphery:')}\n`);
      for (const node of result.level_3) {
        process.stdout.write(`  ${theme.spiralL3('●')} [${node.type}] ${node.content.slice(0, 100)}\n`);
      }
    }

    process.stdout.write(`\n${theme.dim(`${result.node_count} nodes, ${result.total_tokens} tokens`)}\n\n`);
  } finally {
    engine.close();
  }
}

export async function spiralCompactCommand(): Promise<void> {
  const engine = await getSpiralEngine();
  if (!engine) return;

  try {
    const result = engine.compact(false);
    renderInfo(`Compacted: ${result.compacted_nodes} nodes, freed ${result.freed_tokens} tokens, deleted ${result.nodes_deleted} nodes`);
  } finally {
    engine.close();
  }
}
