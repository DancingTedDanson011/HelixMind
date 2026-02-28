import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { theme } from '../ui/theme.js';
import { isSystemDirectory } from '../config/trust.js';

const HELIXMIND_CONTEXT_TEMPLATE = `# HelixMind Project Context

## Project Overview
<!-- Describe your project here. HelixMind reads this for context. -->

## Conventions
<!-- Code conventions, patterns, or rules HelixMind should follow -->

## Important Files
<!-- Key files HelixMind should know about -->
`;

export function initCommand(): void {
  const cwd = process.cwd();

  if (isSystemDirectory(cwd)) {
    process.stdout.write(`${theme.error('Cannot init in system directory:')} ${cwd}\n`);
    return;
  }

  const dir = join(cwd, '.helixmind');

  if (existsSync(dir)) {
    process.stdout.write(`${theme.warning('Already initialized:')} ${dir}\n`);
    return;
  }

  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    process.stdout.write(`${theme.error('Permission denied:')} cannot create ${dir}\n`);
    return;
  }
  writeFileSync(join(dir, 'context.md'), HELIXMIND_CONTEXT_TEMPLATE, 'utf-8');

  process.stdout.write(`${theme.success('Initialized')} HelixMind project in ${dir}\n`);
  process.stdout.write(`${theme.dim('Edit .helixmind/context.md to add project-specific context.')}\n`);
}
