import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import fg from 'fast-glob';
import ignore from 'ignore';

export interface ScannedFile {
  path: string;
  relativePath: string;
  size: number;
  ext: string;
  priority: number; // Lower = higher priority
  lastModified: number;
}

// Priority order (lower number = processed first)
const PRIORITY_MAP: Record<string, number> = {
  'package.json': 1, 'Cargo.toml': 1, 'go.mod': 1, 'pyproject.toml': 1,
  'README.md': 2, 'ARCHITECTURE.md': 2, 'CLAUDE.md': 2,
  'tsconfig.json': 3, '.env.example': 3, 'vite.config.ts': 3,
  'vitest.config.ts': 3, 'next.config.js': 3, 'next.config.ts': 3,
};

const ENTRY_POINT_NAMES = new Set([
  'index', 'main', 'app', 'server', 'cli', 'entry',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2',
  '.ttf', '.eot', '.mp3', '.mp4', '.zip', '.tar', '.gz', '.db',
  '.db-wal', '.db-shm', '.lock', '.map',
]);

export async function scanDirectory(
  rootDir: string,
  targetPath?: string,
): Promise<ScannedFile[]> {
  const scanDir = targetPath ? join(rootDir, targetPath) : rootDir;

  if (!existsSync(scanDir)) return [];

  // Check if targetPath is a single file
  try {
    const stat = statSync(scanDir);
    if (stat.isFile()) {
      const ext = extname(scanDir);
      return [{
        path: scanDir,
        relativePath: targetPath ?? scanDir,
        size: stat.size,
        ext,
        priority: 5,
        lastModified: stat.mtimeMs,
      }];
    }
  } catch { /* continue with directory scan */ }

  // Load ignore rules
  const ig = ignore();
  ig.add([
    'node_modules', 'dist', '.git', 'coverage', '.next', '.nuxt',
    '__pycache__', 'target', 'build', '.cache', '.turbo',
    '*.db', '*.db-wal', '*.db-shm', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  ]);

  // .gitignore
  const gitignorePath = join(rootDir, '.gitignore');
  if (existsSync(gitignorePath)) {
    ig.add(readFileSync(gitignorePath, 'utf-8'));
  }

  // .helixmindignore
  const hmIgnorePath = join(rootDir, '.helixmindignore');
  if (existsSync(hmIgnorePath)) {
    ig.add(readFileSync(hmIgnorePath, 'utf-8'));
  }

  const cwd = targetPath ? scanDir : rootDir;
  const allFiles = await fg('**/*', {
    cwd,
    dot: false,
    onlyFiles: true,
    stats: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**', 'coverage/**'],
  });

  const scanned: ScannedFile[] = [];

  for (const entry of allFiles) {
    const relPath = typeof entry === 'string' ? entry : entry.path;
    const fullRelPath = targetPath ? `${targetPath}/${relPath}` : relPath;

    if (ig.ignores(fullRelPath)) continue;

    const ext = extname(relPath);
    if (BINARY_EXTENSIONS.has(ext)) continue;

    const size = typeof entry === 'string' ? 0 : (entry.stats?.size ?? 0);
    const lastModified = typeof entry === 'string' ? 0 : (entry.stats?.mtimeMs ?? 0);

    scanned.push({
      path: join(cwd, relPath),
      relativePath: fullRelPath,
      size,
      ext,
      priority: computePriority(relPath, fullRelPath),
      lastModified,
    });
  }

  // Sort by priority (lower = first), then by path
  scanned.sort((a, b) => a.priority - b.priority || a.relativePath.localeCompare(b.relativePath));

  return scanned;
}

function computePriority(filename: string, relPath: string): number {
  // Config/meta files
  const basename = filename.split('/').pop() ?? filename;
  if (PRIORITY_MAP[basename]) return PRIORITY_MAP[basename];

  // Documentation
  if (basename.endsWith('.md')) return 4;

  // Entry points
  const nameWithoutExt = basename.replace(/\.\w+$/, '');
  if (ENTRY_POINT_NAMES.has(nameWithoutExt)) return 5;

  // Config files
  if (basename.startsWith('.') || basename.includes('config')) return 6;

  // Core source files
  if (relPath.includes('src/core/') || relPath.includes('src/lib/')) return 7;

  // API routes
  if (relPath.includes('routes/') || relPath.includes('api/') || relPath.includes('endpoints/')) return 8;

  // Models/types
  if (relPath.includes('types') || relPath.includes('models') || relPath.includes('interfaces')) return 9;

  // Regular source
  if (relPath.includes('src/')) return 10;

  // Utils/helpers
  if (relPath.includes('utils/') || relPath.includes('helpers/') || relPath.includes('lib/')) return 11;

  // Tests (low priority)
  if (relPath.includes('test') || relPath.includes('spec') || relPath.includes('__test')) return 15;

  return 12;
}
