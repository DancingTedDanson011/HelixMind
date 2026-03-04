import { resolve, normalize, sep } from 'node:path';
import { statSync, lstatSync, existsSync, mkdirSync } from 'node:fs';

/** Maximum file size in bytes (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Maximum content length in characters (5MB) */
const MAX_CONTENT_LENGTH = 5 * 1024 * 1024;

/** Sensitive files that should never be read or written by the agent */
const BLOCKED_FILES = [
  '.env', '.env.local', '.env.production', '.env.staging', '.env.development', '.env.test',
  'id_rsa', 'id_ed25519', 'id_ecdsa',
  '.ssh/config', '.ssh/authorized_keys', '.ssh/known_hosts',
  '.npmrc', '.pypirc', '.netrc',
  'credentials.json', 'serviceAccountKey.json',
  '.git-credentials', '.docker/config.json',
  '.aws/credentials', '.aws/config',
  '.kube/config',
  '.bash_history', '.zsh_history',
  '.config/gcloud/credentials.db',
];

/** Dangerous command patterns that require extra confirmation */
const DANGEROUS_PATTERNS = [
  /\brm\s+(-rf?|--recursive)/,
  /\bsudo\b/,
  /\bchmod\b.*777/,
  /\bdd\b\s/,
  /\b>\s*\/dev\//,
  /\bcurl\b.*\|\s*(ba)?sh/,
  /\bwget\b.*\|\s*(ba)?sh/,
  /\bnpm\s+publish/,
  /\bgit\s+push\s+.*--force/,
  /\bdrop\s+(database|table)/i,
  /\btruncate\s+table/i,
  /\bformat\s+[a-z]:/i,
  /\bdel\s+\/[sq]/i,
  /\brmdir\s+\/s/i,
];

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

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
    if (lower.endsWith('/' + blocked) || lower.endsWith('\\' + blocked) || lower === blocked) {
      throw new SecurityError(`Access denied: ${requestedPath} is a sensitive file`);
    }
  }

  // Symlinks ALWAYS blocked (lstatSync does NOT follow symlinks, unlike statSync)
  try {
    const stats = lstatSync(resolved);
    if (stats.isSymbolicLink()) {
      throw new SecurityError(`Access denied: Symlinks are not allowed`);
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
    if (lower.endsWith('/' + blocked) || lower.endsWith('\\' + blocked) || lower === blocked) {
      throw new SecurityError(`Access denied: ${requestedPath} is a sensitive file`);
    }
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

/**
 * Classify a shell command's danger level.
 */
export function classifyCommand(cmd: string): 'safe' | 'ask' | 'dangerous' {
  const trimmed = cmd.trim();

  if (!trimmed || trimmed.length === 0) {
    throw new SecurityError('Command cannot be empty');
  }

  if (trimmed.length > 10000) {
    throw new SecurityError('Command too long');
  }

  // Check for blocked commands on the ORIGINAL command (not sanitized)
  if (isBlockedCommand(trimmed)) {
    throw new SecurityError('This command is blocked');
  }

  // Detect shell metacharacter abuse (backticks, $(), encoded payloads)
  if (/`[^`]+`/.test(trimmed) || /\$\([^)]+\)/.test(trimmed)) return 'dangerous';

  // Check for dangerous patterns on the ORIGINAL command
  if (DANGEROUS_PATTERNS.some(p => p.test(trimmed))) return 'dangerous';

  // PowerShell-specific dangerous patterns (Windows)
  if (/powershell|pwsh/i.test(trimmed)) return 'dangerous';
  if (/Remove-Item\s.*-Recurse/i.test(trimmed)) return 'dangerous';
  if (/Invoke-(WebRequest|Expression|RestMethod)/i.test(trimmed)) return 'dangerous';
  if (/Set-ExecutionPolicy/i.test(trimmed)) return 'dangerous';

  // Additional blocked system commands
  if (/\b(shutdown|reboot)\b/.test(trimmed)) return 'dangerous';
  if (/\btaskkill\s+\/f/i.test(trimmed)) return 'dangerous';

  // Language interpreter code execution (bypass vector for shell sandbox)
  if (/\b(python3?|ruby|perl|lua)\s+-[ce]\b/.test(trimmed)) return 'dangerous';
  if (/\bnode\s+-e\b/.test(trimmed)) return 'dangerous';
  if (/\beval\s/.test(trimmed)) return 'dangerous';

  // Encoded/obfuscated payload execution
  if (/base64\s.*\|\s*(ba)?sh/i.test(trimmed)) return 'dangerous';
  if (/powershell.*-e(nc(odedcommand)?)?/i.test(trimmed)) return 'dangerous';
  if (/\[Net\.WebClient\]|\[System\.Net\.WebClient\]/i.test(trimmed)) return 'dangerous';

  // Windows system commands
  if (/\bwmic\b.*\bdelete\b/i.test(trimmed)) return 'dangerous';
  if (/\breg\s+delete/i.test(trimmed)) return 'dangerous';
  if (/\bsc\s+delete/i.test(trimmed)) return 'dangerous';

  // Check for potentially dangerous operations
  if (/\brm\s/.test(trimmed) || /\bmv\s/.test(trimmed) || /\bgit\s+push/.test(trimmed)) return 'ask';

  return 'safe';
}

/**
 * Check if a command is blocked entirely (should never run).
 * These are hard-blocked even in YOLO mode.
 */
export function isBlockedCommand(cmd: string): boolean {
  const blocked = [
    /\bformat\s+c:/i,
    /:\(\)\s*\{[^}]*\|\s*:.*&\s*\}\s*;/,  // fork bomb
    /\brm\s+(-rf?|--recursive)\s+\/(\s|$)/,   // rm -rf / (root, with or without trailing flags)
    /\bdd\b.*of=\/dev\/[sh]d/,              // overwrite disk devices
    /\bmkfs\b/,                              // format filesystems
    /\bfdisk\b/,                             // partition table modification
    /\bbcdedit\b/i,                          // Windows boot config
    /\bdiskpart\b/i,                         // Windows disk partition
  ];
  return blocked.some(p => p.test(cmd));
}
