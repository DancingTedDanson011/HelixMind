/**
 * FIX: BRAIN-F7 — Path guard for control-protocol register_project / create_brain.
 *
 * Validates a project path string received from a remote/untrusted channel
 * and rejects any candidate that could escalate to system directories,
 * escape the workspace, or abuse OS-specific path semantics (UNC, null-byte,
 * traversal).
 *
 * Defense-in-depth:
 *  - Must be a string of bounded length
 *  - No null bytes, no traversal tokens
 *  - Must be absolute (rejects relative paths that are resolved against cwd)
 *  - Rejects UNC paths on Windows (`\\host\share`, `//host/share`)
 *  - Rejects well-known system roots on both platforms
 *  - Normalizes via path.resolve() then re-checks to detect redundant `..` segments
 */
import * as path from 'node:path';

const MAX_PATH_LEN = 500;

const FORBIDDEN_PREFIXES_CI = [
  // Windows system paths
  'c:\\windows',
  'c:/windows',
  'c:\\program files',
  'c:/program files',
  'c:\\programdata',
  'c:/programdata',
  '\\windows\\',
  // Unix system paths
  '/etc/',
  '/etc',
  '/usr/',
  '/usr',
  '/bin/',
  '/bin',
  '/sbin/',
  '/sbin',
  '/boot/',
  '/system',
  '/proc/',
  '/proc',
  '/sys/',
  '/sys',
  '/root/',
  '/root',
  '/dev/',
  '/dev',
];

export function isValidProjectPath(p: unknown): p is string {
  if (typeof p !== 'string') return false;
  if (p.length === 0 || p.length > MAX_PATH_LEN) return false;

  // Null bytes would truncate downstream filesystem calls — always reject.
  if (p.includes('\0')) return false;

  // Reject raw traversal tokens in the input. Even if path.resolve() would
  // normalize them away, accepting them would let an attacker smuggle past
  // a string-prefix check on the result.
  if (p.includes('..')) return false;

  // Must be absolute on the current platform.
  if (!path.isAbsolute(p)) return false;

  // Reject UNC paths on Windows — these can reach arbitrary network shares.
  if (process.platform === 'win32' && (p.startsWith('\\\\') || p.startsWith('//'))) {
    return false;
  }

  // Normalize and compare — if resolution changes the string drastically
  // (e.g. `/foo/./bar` → `/foo/bar`), the original still must not have used
  // traversal tokens (enforced above).
  let resolved: string;
  try {
    resolved = path.resolve(p);
  } catch {
    return false;
  }

  const lower = resolved.toLowerCase();
  for (const prefix of FORBIDDEN_PREFIXES_CI) {
    if (lower === prefix || lower.startsWith(prefix + (prefix.endsWith('/') || prefix.endsWith('\\') ? '' : path.sep)) || lower.startsWith(prefix)) {
      // Additional precise check: must be a real prefix boundary
      if (lower === prefix) return false;
      if (lower.startsWith(prefix + path.sep)) return false;
      if (lower.startsWith(prefix + '/')) return false;
      if (lower.startsWith(prefix + '\\')) return false;
    }
  }
  return true;
}
