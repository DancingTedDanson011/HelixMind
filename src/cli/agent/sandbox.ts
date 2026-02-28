import { resolve, normalize, sep } from 'node:path';
import { statSync, existsSync, mkdirSync } from 'node:fs';

/** Maximum file size in bytes (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Maximum content length in characters (5MB) */
const MAX_CONTENT_LENGTH = 5 * 1024 * 1024;

/** Sensitive files that should never be read or written by the agent */
const BLOCKED_FILES = [
  '.env', '.env.local', '.env.production', '.env.staging',
  'id_rsa', 'id_ed25519', 'id_ecdsa',
  '.ssh/config', '.npmrc', '.pypirc',
  'credentials.json', 'serviceAccountKey.json',
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
  if (!resolved.startsWith(normalizedRoot)) {
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

  // Check if path exists and is not a symlink (follow symlinks could bypass security)
  try {
    const stats = statSync(resolved);
    if (stats.isSymbolicLink()) {
      throw new SecurityError(`Access denied: Symlinks are not allowed`);
    }
  } catch (err) {
    // Path doesn't exist yet, that's fine for new files
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
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
  // Sanitize command: remove shell metacharacters
  const sanitized = cmd
    .replace(/[^\w\s|;&<>()]/g, '') // Remove dangerous characters
    .trim();

  if (!sanitized || sanitized.length === 0) {
    throw new SecurityError('Command cannot be empty');
  }

  // Check for command injection attempts
  if (sanitized.length > 10000) {
    throw new SecurityError('Command too long');
  }

  // Check for blocked commands
  if (isBlockedCommand(sanitized)) {
    throw new SecurityError('This command is blocked');
  }

  // Check for dangerous patterns
  if (DANGEROUS_PATTERNS.some(p => p.test(sanitized))) return 'dangerous';

  // Check for potentially dangerous operations
  if (/\brm\s/.test(sanitized) || /\bmv\s/.test(sanitized) || /\bgit\s+push/.test(sanitized)) return 'ask';

  return 'safe';
}

/**
 * Check if a command is blocked entirely (should never run).
 */
export function isBlockedCommand(cmd: string): boolean {
  const blocked = [
    /\bformat\s+c:/i,
    /:\(\)\s*\{[^}]*\|\s*:.*&\s*\}\s*;/,  // fork bomb
  ];
  return blocked.some(p => p.test(cmd));
}
