/**
 * Directory Trust System — asks the user to confirm trust before
 * creating project-local data (.helixmind/) in a new directory.
 *
 * Trusted directories are stored in ~/.helixmind/trusted-dirs.json.
 * System-protected directories are always rejected (no prompt).
 */

import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const TRUST_FILE = join(homedir(), '.helixmind', 'trusted-dirs.json');

/** Directories that should NEVER have .helixmind/ created in them */
const SYSTEM_DIRS_WIN = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData',
];

const SYSTEM_DIRS_UNIX = [
  '/usr',
  '/bin',
  '/sbin',
  '/etc',
  '/var',
  '/tmp',
  '/opt',
  '/lib',
  '/lib64',
  '/boot',
  '/dev',
  '/proc',
  '/sys',
  '/root',
];

/**
 * Check if a directory is a system-protected directory where we should
 * never attempt to create .helixmind/.
 */
export function isSystemDirectory(dir: string): boolean {
  const normalized = dir.replace(/\//g, '\\');
  const lower = normalized.toLowerCase();

  if (platform() === 'win32') {
    return SYSTEM_DIRS_WIN.some(sys => lower.startsWith(sys.toLowerCase()));
  }

  return SYSTEM_DIRS_UNIX.some(sys => dir.startsWith(sys));
}

/**
 * Load the list of trusted directories.
 */
function loadTrustedDirs(): string[] {
  try {
    if (existsSync(TRUST_FILE)) {
      return JSON.parse(readFileSync(TRUST_FILE, 'utf-8'));
    }
  } catch {
    // Corrupted file — start fresh
  }
  return [];
}

/**
 * Save the list of trusted directories.
 */
function saveTrustedDirs(dirs: string[]): void {
  const parentDir = join(homedir(), '.helixmind');
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }
  writeFileSync(TRUST_FILE, JSON.stringify(dirs, null, 2), 'utf-8');
}

/**
 * Check if a directory is already trusted.
 */
export function isDirectoryTrusted(dir: string): boolean {
  // Home directory is always trusted
  if (dir === homedir()) return true;

  // Subdirectories of home are trusted if parent is trusted
  const home = homedir();
  if (dir.startsWith(home)) {
    // Direct children of home (Desktop, Documents, etc.) are always trusted
    const relative = dir.slice(home.length + 1);
    const depth = relative.split(/[/\\]/).length;
    if (depth <= 1) return true;
  }

  // If .helixmind/ already exists, it was previously trusted
  if (existsSync(join(dir, '.helixmind'))) return true;

  // Check the trust list
  const trusted = loadTrustedDirs();
  const normalized = dir.replace(/\\/g, '/').toLowerCase();
  return trusted.some(t => t.replace(/\\/g, '/').toLowerCase() === normalized);
}

/**
 * Add a directory to the trusted list.
 */
export function trustDirectory(dir: string): void {
  const trusted = loadTrustedDirs();
  const normalized = dir.replace(/\\/g, '/').toLowerCase();

  if (!trusted.some(t => t.replace(/\\/g, '/').toLowerCase() === normalized)) {
    trusted.push(dir);
    saveTrustedDirs(trusted);
  }
}
