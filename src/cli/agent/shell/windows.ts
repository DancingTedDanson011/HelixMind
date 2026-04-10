import type { CommandKind } from './types.js';

const WINDOWS_LIST_COMMANDS = new Set([
  'dir',
  'tree',
  'get-childitem',
]);

const WINDOWS_SEARCH_COMMANDS = new Set([
  'findstr',
  'select-string',
  'where',
]);

const WINDOWS_READ_COMMANDS = new Set([
  'type',
  'more',
  'get-content',
  'get-item',
  'test-path',
  'resolve-path',
  'get-location',
  'pwd',
]);

const WINDOWS_WRITE_COMMANDS = new Set([
  'copy',
  'copy-item',
  'move',
  'move-item',
  'ren',
  'rename-item',
  'del',
  'erase',
  'remove-item',
  'mkdir',
  'md',
  'new-item',
  'ni',
  'set-content',
  'add-content',
  'rmdir',
  'rd',
]);

const WINDOWS_SAFE_PROCESS_COMMANDS = new Set([
  'echo',
  'cd',
  'chdir',
  'write-host',
  'write-output',
]);

const WINDOWS_NETWORK_COMMANDS = new Set([
  'curl',
  'wget',
  'invoke-webrequest',
  'invoke-restmethod',
  'ssh',
  'scp',
  'sftp',
]);

const POWERSHELL_PREFIXES = [
  'get-',
  'set-',
  'remove-',
  'select-',
  'start-',
  'stop-',
  'new-',
  'test-',
  'resolve-',
  'write-',
  'invoke-',
  'out-',
];

const WINDOWS_DANGEROUS_PATTERNS = [
  /Remove-Item\s+.*-Recurse/i,
  /Set-ExecutionPolicy/i,
  /powershell(?:\.exe)?\s+.*-(?:e|enc|encodedcommand)\b/i,
  /\bpwsh\s+.*-(?:e|enc|encodedcommand)\b/i,
  /\btaskkill\s+\/f\b/i,
  /\breg\s+delete\b/i,
  /\bsc\s+delete\b/i,
  /\bformat\s+[a-z]:/i,
  /\bdiskpart\b/i,
  /\bbcdedit\b/i,
];

export function isPowerShellLikeCommand(command: string): boolean {
  const base = getBaseCommand(command);
  if (!base) return false;
  if (base === 'powershell' || base === 'powershell.exe' || base === 'pwsh') {
    return true;
  }
  return POWERSHELL_PREFIXES.some(prefix => base.startsWith(prefix));
}

export function hasWindowsDangerousPattern(command: string): boolean {
  return WINDOWS_DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
}

export function detectWindowsCommandKind(baseCommand: string): CommandKind | undefined {
  const base = baseCommand.toLowerCase();

  if (WINDOWS_LIST_COMMANDS.has(base)) return 'list';
  if (WINDOWS_SEARCH_COMMANDS.has(base)) return 'search';
  if (WINDOWS_READ_COMMANDS.has(base)) return 'read';
  if (WINDOWS_WRITE_COMMANDS.has(base)) return 'write';
  if (WINDOWS_NETWORK_COMMANDS.has(base)) return 'network';
  if (WINDOWS_SAFE_PROCESS_COMMANDS.has(base)) return 'process';

  return undefined;
}

function getBaseCommand(command: string): string {
  return command.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
}
