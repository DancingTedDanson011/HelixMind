import { resolve, normalize, sep } from 'node:path';
import { statSync, lstatSync, realpathSync } from 'node:fs';
import { SecurityError } from './security.js';

export { SecurityError } from './security.js';
export { classifyCommand, classifyShellCommand, isBlockedCommand } from './shell/classifier.js';

/** Maximum file size in bytes (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Maximum content length in characters (5MB) */
const MAX_CONTENT_LENGTH = 5 * 1024 * 1024;

/** Sensitive files that should never be read or written by the agent */
const BLOCKED_FILES = [
  // Environment files (all variants)
  '.env', '.env.local', '.env.production', '.env.staging', '.env.development', '.env.test',
  '.env.production.local', '.env.development.local', '.env.test.local', '.env.local.local',
  // SSH keys and config
  'id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa',
  '.ssh/config', '.ssh/authorized_keys', '.ssh/known_hosts', '.ssh/id_rsa', '.ssh/id_ed25519',
  // Package manager credentials
  '.npmrc', '.pypirc', '.netrc', '.yarnrc',
  // Cloud credentials
  'credentials.json', 'serviceAccountKey.json', 'service-account.json',
  '.git-credentials', '.docker/config.json',
  '.aws/credentials', '.aws/config',
  '.kube/config',
  '.config/gcloud/credentials.db', '.config/gcloud/application_default_credentials.json',
  // Shell history
  '.bash_history', '.zsh_history', '.node_repl_history', '.python_history',
  // GPG/PGP keys
  '.gnupg/secring.gpg', '.gnupg/private-keys-v1.d',
  // Token/secret files
  '.vault-token', '.terraform/credentials.tfrc.json',
  // Database files that may contain sensitive data
  '.pgpass', '.my.cnf',
];

export interface PathValidation {
  resolved: string;    // Resolved absolute path
  external: boolean;   // true if outside projectRoot
}

/**
 * Validate a path, allowing external paths (outside project root).
 * External paths need separate permission approval via the agent loop.
 * Still blocks: sensitive files, symlinks.
 */
export function validatePathEx(requestedPath: string, projectRoot: string): PathValidation {
  // SECURITY: Reject null bytes to prevent path truncation attacks
  if (requestedPath.includes('\0')) {
    throw new SecurityError('Access denied: Path contains null byte');
  }

  const normalizedPath = normalize(requestedPath);
  const resolved = resolve(projectRoot, normalizedPath);
  const normalizedRoot = normalize(projectRoot);

  // Case-insensitive comparison on Windows (NTFS is case-insensitive)
  const external = process.platform === 'win32'
    ? !resolved.toLowerCase().startsWith(normalizedRoot.toLowerCase())
    : !resolved.startsWith(normalizedRoot);

  // Sensitive files ALWAYS blocked (internal and external)
  const lower = resolved.toLowerCase().replace(/\\/g, '/');
  for (const blocked of BLOCKED_FILES) {
    if (lower.endsWith('/' + blocked) || lower === blocked) {
      throw new SecurityError(`Access denied: ${requestedPath} is a sensitive file`);
    }
  }
  // Pattern-based blocks: catch all .env variants and key files
  const filename = lower.split('/').pop() || '';
  if (/^\.env(\..+)?$/.test(filename) && !/\.(example|sample|template)$/.test(filename)) {
    throw new SecurityError(`Access denied: ${requestedPath} is a sensitive file`);
  }
  if (/^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/.test(filename)) {
    throw new SecurityError(`Access denied: ${requestedPath} is a sensitive file`);
  }

  // Symlinks ALWAYS blocked (lstatSync does NOT follow symlinks, unlike statSync)
  // Also perform realpath verification to mitigate TOCTOU race conditions:
  // if the real (dereferenced) path differs from the resolved path, a symlink exists.
  try {
    const stats = lstatSync(resolved);
    if (stats.isSymbolicLink()) {
      throw new SecurityError(`Access denied: Symlinks are not allowed`);
    }
    // SECURITY: Double-check via realpath to catch symlinks in parent directories
    // and reduce the TOCTOU window — if realpath differs, a symlink is present
    const real = realpathSync(resolved);
    const realNorm = normalize(real);
    const resolvedNorm = normalize(resolved);
    const pathsDiffer = process.platform === 'win32'
      ? realNorm.toLowerCase() !== resolvedNorm.toLowerCase()
      : realNorm !== resolvedNorm;
    if (pathsDiffer) {
      throw new SecurityError(`Access denied: Path resolves through a symlink`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      if (err instanceof SecurityError) throw err;
      throw new SecurityError(`Access denied: Invalid path: ${requestedPath}`);
    }
  }

  // Internal paths: depth limit + root check (same as validatePath)
  if (!external) {
    if (normalizedPath.split(sep).length > 10) {
      throw new SecurityError(`Access denied: Path too deep: ${requestedPath}`);
    }
    try {
      const dirStats = statSync(normalizedRoot);
      if (!dirStats.isDirectory()) {
        throw new SecurityError(`Access denied: Project root is not a directory`);
      }
    } catch (err) {
      if (err instanceof SecurityError) throw err;
      throw new SecurityError(`Access denied: Project root not accessible: ${projectRoot}`);
    }
  }

  return { resolved, external };
}

/**
 * Validate that a requested path is within the project root
 * and not a sensitive file. Returns the resolved absolute path.
 */
export function validatePath(requestedPath: string, projectRoot: string): string {
  // Normalize the requested path to handle . and .. sequences
  let normalizedPath = normalize(requestedPath);

  // Resolve against project root
  const resolved = resolve(projectRoot, normalizedPath);

  // Ensure the resolved path starts with the normalized project root
  const normalizedRoot = normalize(projectRoot);
  // Case-insensitive comparison on Windows (NTFS is case-insensitive)
  const isInside = process.platform === 'win32'
    ? resolved.toLowerCase().startsWith(normalizedRoot.toLowerCase())
    : resolved.startsWith(normalizedRoot);
  if (!isInside) {
    throw new SecurityError(`Access denied: ${requestedPath} is outside the project directory`);
  }

  // Check for path traversal attempts (multiple consecutive separators)
  if (normalizedPath.split(sep).length > 10) {
    throw new SecurityError(`Access denied: Path too deep: ${requestedPath}`);
  }

  // Normalize for case-insensitive blocked file check
  const lower = resolved.toLowerCase().replace(/\\/g, '/');
  for (const blocked of BLOCKED_FILES) {
    if (lower.endsWith('/' + blocked) || lower === blocked) {
      throw new SecurityError(`Access denied: ${requestedPath} is a sensitive file`);
    }
  }
  // Pattern-based blocks: catch all .env variants and key files
  const filename = lower.split('/').pop() || '';
  if (/^\.env(\..+)?$/.test(filename) && !/\.(example|sample|template)$/.test(filename)) {
    throw new SecurityError(`Access denied: ${requestedPath} is a sensitive file`);
  }
  if (/^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/.test(filename)) {
    throw new SecurityError(`Access denied: ${requestedPath} is a sensitive file`);
  }

  // Check if path exists and is not a symlink (lstatSync does NOT follow symlinks)
  try {
    const stats = lstatSync(resolved);
    if (stats.isSymbolicLink()) {
      throw new SecurityError(`Access denied: Symlinks are not allowed`);
    }
  } catch (err) {
    // Path doesn't exist yet, that's fine for new files
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      if (err instanceof SecurityError) throw err;
      throw new SecurityError(`Access denied: Invalid path: ${requestedPath}`);
    }
  }

  // Verify the directory exists (or can be created)
  try {
    const dirStats = statSync(normalizedRoot);
    if (!dirStats.isDirectory()) {
      throw new SecurityError(`Access denied: Project root is not a directory`);
    }
  } catch (err) {
    throw new SecurityError(`Access denied: Project root not accessible: ${projectRoot}`);
  }

  return resolved;
}

