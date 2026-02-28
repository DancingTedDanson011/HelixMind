import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SpiralEngine } from '../../spiral/engine.js';
import { loadConfig } from '../../utils/config.js';
import { exportToZip, importFromZip, validateArchive } from '../brain/archive.js';
import { renderInfo, renderError } from '../ui/chat-view.js';
import { theme } from '../ui/theme.js';

export async function exportCommand(
  outputDir?: string,
  options?: { name?: string },
): Promise<void> {
  const spiralConfig = loadConfig();
  const engine = new SpiralEngine(spiralConfig);

  try {
    const dir = resolve(outputDir ?? process.cwd());
    const name = options?.name ?? 'HelixMind Project';
    const status = engine.status();

    if (status.total_nodes === 0) {
      renderError('Spiral is empty. Nothing to export.');
      return;
    }

    const zipPath = exportToZip(engine, dir, name);
    renderInfo(`Exported ${status.total_nodes} nodes to:`);
    process.stdout.write(`  ${theme.success(zipPath)}\n`);
  } finally {
    engine.close();
  }
}

export async function importCommand(
  zipFile: string,
  options?: { replace?: boolean },
): Promise<void> {
  const filePath = resolve(zipFile);

  if (!existsSync(filePath)) {
    renderError(`File not found: ${filePath}`);
    return;
  }

  // Validate first
  const validation = validateArchive(filePath);
  if (!validation.valid) {
    renderError('Invalid archive:');
    for (const err of validation.errors) {
      process.stdout.write(`  - ${err}\n`);
    }
    return;
  }

  const spiralConfig = loadConfig();
  const engine = new SpiralEngine(spiralConfig);

  try {
    const mode = options?.replace ? 'replace' : 'merge';
    const result = importFromZip(filePath, engine, mode);

    if (result.errors.length > 0) {
      renderError('Import completed with errors:');
      for (const err of result.errors) {
        process.stdout.write(`  - ${err}\n`);
      }
    }

    renderInfo(`Import complete (${mode} mode):`);
    process.stdout.write(`  Imported: ${result.imported}\n`);
    if (result.skipped > 0) {
      process.stdout.write(`  Skipped (duplicates): ${result.skipped}\n`);
    }
    if (result.cleared > 0) {
      process.stdout.write(`  Cleared: ${result.cleared}\n`);
    }
  } finally {
    engine.close();
  }
}
