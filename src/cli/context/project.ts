import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import fg from 'fast-glob';
import ignore from 'ignore';

export interface ProjectFile {
  path: string;
  size: number;
}

export interface ProjectInfo {
  name: string;
  type: 'node' | 'python' | 'rust' | 'go' | 'unknown';
  frameworks: string[];
  files: ProjectFile[];
  summary: string;
}

const KNOWN_FRAMEWORKS: Record<string, string> = {
  react: 'react',
  next: 'next',
  vue: 'vue',
  nuxt: 'nuxt',
  svelte: 'svelte',
  angular: 'angular',
  express: 'express',
  fastify: 'fastify',
  nestjs: 'nestjs',
  tailwindcss: 'tailwindcss',
  vitest: 'vitest',
  jest: 'jest',
  playwright: 'playwright',
  prisma: 'prisma',
  drizzle: 'drizzle',
  'drizzle-orm': 'drizzle',
  '@anthropic-ai/sdk': 'anthropic-sdk',
  openai: 'openai-sdk',
};

export async function analyzeProject(dir: string): Promise<ProjectInfo> {
  const info: ProjectInfo = {
    name: 'unknown',
    type: 'unknown',
    frameworks: [],
    files: [],
    summary: '',
  };

  // Detect project type
  const packageJsonPath = join(dir, 'package.json');
  if (existsSync(packageJsonPath)) {
    info.type = 'node';
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      info.name = pkg.name ?? 'unknown';

      // Detect frameworks from dependencies
      const allDeps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      };

      for (const dep of Object.keys(allDeps)) {
        const framework = KNOWN_FRAMEWORKS[dep];
        if (framework && !info.frameworks.includes(framework)) {
          info.frameworks.push(framework);
        }
      }
    } catch {
      // Invalid package.json
    }
  } else if (existsSync(join(dir, 'pyproject.toml')) || existsSync(join(dir, 'setup.py'))) {
    info.type = 'python';
  } else if (existsSync(join(dir, 'Cargo.toml'))) {
    info.type = 'rust';
  } else if (existsSync(join(dir, 'go.mod'))) {
    info.type = 'go';
  }

  // Load gitignore
  const ig = ignore();
  ig.add(['node_modules', 'dist', '.git', 'coverage', '*.db', '*.db-wal', '*.db-shm']);
  const gitignorePath = join(dir, '.gitignore');
  if (existsSync(gitignorePath)) {
    ig.add(readFileSync(gitignorePath, 'utf-8'));
  }

  // Scan files
  try {
    const allFiles = await fg('**/*', {
      cwd: dir,
      dot: false,
      onlyFiles: true,
      stats: true,
      ignore: ['node_modules/**', 'dist/**', '.git/**', 'coverage/**'],
    });

    for (const entry of allFiles) {
      const relPath = typeof entry === 'string' ? entry : entry.path;
      if (!ig.ignores(relPath)) {
        info.files.push({
          path: relPath,
          size: typeof entry === 'string' ? 0 : (entry.stats?.size ?? 0),
        });
      }
    }
  } catch {
    // Directory scan failed
  }

  // Generate summary
  info.summary = generateSummary(info);

  return info;
}

function generateSummary(info: ProjectInfo): string {
  const parts: string[] = [];

  if (info.name !== 'unknown') {
    parts.push(`Project: ${info.name}`);
  }

  if (info.type !== 'unknown') {
    parts.push(`Type: ${info.type}`);
  }

  if (info.frameworks.length > 0) {
    parts.push(`Frameworks: ${info.frameworks.join(', ')}`);
  }

  parts.push(`Files: ${info.files.length}`);

  // File type breakdown
  const extCounts: Record<string, number> = {};
  for (const file of info.files) {
    const ext = file.path.split('.').pop() ?? 'other';
    extCounts[ext] = (extCounts[ext] ?? 0) + 1;
  }

  const topExts = Object.entries(extCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ext, count]) => `${ext}: ${count}`)
    .join(', ');

  if (topExts) {
    parts.push(`Extensions: ${topExts}`);
  }

  return parts.join('\n');
}
