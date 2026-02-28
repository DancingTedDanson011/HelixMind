import { resolve, normalize } from 'node:path';

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
  const resolved = resolve(projectRoot, requestedPath);
  const normalizedRoot = normalize(projectRoot);

  if (!resolved.startsWith(normalizedRoot)) {
    throw new SecurityError(`Access denied: ${requestedPath} is outside the project directory`);
  }

  const lower = resolved.toLowerCase().replace(/\\/g, '/');
  for (const blocked of BLOCKED_FILES) {
    if (lower.endsWith('/' + blocked) || lower.endsWith('\\' + blocked) || lower === blocked) {
      throw new SecurityError(`Access denied: ${requestedPath} is a sensitive file`);
    }
  }

  return resolved;
}

/**
 * Classify a shell command's danger level.
 */
export function classifyCommand(cmd: string): 'safe' | 'ask' | 'dangerous' {
  if (DANGEROUS_PATTERNS.some(p => p.test(cmd))) return 'dangerous';
  if (/\brm\s/.test(cmd) || /\bmv\s/.test(cmd) || /\bgit\s+push/.test(cmd)) return 'ask';
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
