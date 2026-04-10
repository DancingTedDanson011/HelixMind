import { platform as getPlatform } from 'node:os';
import { SecurityError } from '../security.js';
import type {
  CommandClassification,
  CommandKind,
  CommandRisk,
  LegacyCommandLevel,
  ShellType,
} from './types.js';
import {
  detectWindowsCommandKind,
  hasWindowsDangerousPattern,
  isPowerShellLikeCommand,
} from './windows.js';
import { summarizeCommandClassification } from './summary.js';

const MAX_COMMAND_LENGTH = 10_000;

const BLOCKED_PATTERNS = [
  /\bformat\s+c:/i,
  /:\(\)\s*\{[^}]*\|\s*:.*&\s*\}\s*;/,
  /\brm\s+(-rf?|--recursive)\s+\/(\s|$)/,
  /\bdd\b.*of=\/dev\/[sh]d/,
  /\bmkfs\b/,
  /\bfdisk\b/,
  /\bbcdedit\b/i,
  /\bdiskpart\b/i,
];

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
  /\b(nc|ncat|netcat)\s.*-[el]/,
  /\bdocker\s+run\b.*--privileged/,
  /\bdocker\s+run\b.*-v\s*\/:/,
  /\bcrontab\s+-[re]/,
  /\bssh\b.*@/,
  /`[^`]+`/,
  /\$\([^)]+\)/,
  /\$[A-Za-z_]/,
  /<<<?\s/,
  /\b(alias|export\s+\w+=)/,
  /\b(BASH_ENV|ENV|BASH_FUNC_)=/,
  /\b(python3?|ruby|perl|lua)\s+-[ce]\b/,
  /\bnode\s+-e\b/,
  /\beval\s/,
  /base64\s.*\|\s*(ba)?sh/i,
  /\[Net\.WebClient\]|\[System\.Net\.WebClient\]/i,
  /\bwmic\b.*\bdelete\b/i,
];

const LIST_COMMANDS = new Set([
  'ls',
  'tree',
]);

const SEARCH_COMMANDS = new Set([
  'rg',
  'grep',
  'ag',
  'ack',
  'which',
  'where',
  'find',
]);

const READ_COMMANDS = new Set([
  'cat',
  'head',
  'tail',
  'less',
  'more',
  'sed',
  'awk',
  'wc',
  'stat',
  'file',
  'pwd',
]);

const WRITE_COMMANDS = new Set([
  'rm',
  'mv',
  'cp',
  'chmod',
  'chown',
  'touch',
  'mkdir',
  'rmdir',
]);

const SAFE_PROCESS_COMMANDS = new Set([
  'echo',
  'printf',
  'true',
  'false',
]);

const NETWORK_COMMANDS = new Set([
  'curl',
  'wget',
  'http',
  'https',
  'ftp',
  'ssh',
  'scp',
  'sftp',
]);

const PACKAGE_MANAGER_COMMANDS = new Set([
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'pip',
  'pip3',
  'pipx',
  'cargo',
  'go',
  'composer',
  'gem',
]);

const LEGACY_SAFE_PROCESS_PATTERNS = [
  /^\s*npm\s+test\b/i,
  /^\s*vitest(?:\s|$)/i,
  /^\s*tsc\b/i,
];

export function classifyShellCommand(
  command: string,
  options: { platform?: NodeJS.Platform } = {},
): CommandClassification {
  const trimmed = command.trim();
  const platform = options.platform ?? getPlatform();

  if (!trimmed) {
    throw new SecurityError('Command cannot be empty');
  }

  if (trimmed.length > MAX_COMMAND_LENGTH) {
    throw new SecurityError('Command too long');
  }

  const shell = detectShellType(trimmed, platform);
  const kind = detectCommandKind(trimmed, shell);
  const risk = detectRisk(trimmed, kind, shell);
  const touchesNetwork = kind === 'network' || /\b(curl|wget|ssh|scp|sftp|invoke-webrequest|invoke-restmethod)\b/i.test(trimmed);
  const writesFiles = kind === 'write' || kind === 'package_manager' || doesGitWrite(trimmed);
  const canBackground = canCommandBackground(trimmed, kind, risk);

  const classificationWithoutSummary = {
    shell,
    kind,
    risk,
    touchesNetwork,
    writesFiles,
    canBackground,
  };

  return {
    ...classificationWithoutSummary,
    summary: summarizeCommandClassification(classificationWithoutSummary, trimmed),
  };
}

export function classifyCommand(
  command: string,
  options: { platform?: NodeJS.Platform } = {},
): LegacyCommandLevel {
  const classification = classifyShellCommand(command, options);

  if (classification.risk === 'blocked') {
    throw new SecurityError('This command is blocked');
  }

  if (classification.risk === 'auto') {
    return 'safe';
  }

  if (classification.risk === 'ask' && LEGACY_SAFE_PROCESS_PATTERNS.some(pattern => pattern.test(command))) {
    return 'safe';
  }

  return classification.risk;
}

export function isBlockedCommand(command: string): boolean {
  return BLOCKED_PATTERNS.some(pattern => pattern.test(command));
}

function detectShellType(command: string, platform: NodeJS.Platform): ShellType {
  if (isPowerShellLikeCommand(command)) {
    return 'powershell';
  }
  return platform === 'win32' ? 'cmd' : 'bash';
}

function detectCommandKind(command: string, shell: ShellType): CommandKind {
  const base = firstToken(command);

  if (!base) return 'unknown';

  if (base === 'git') return 'git';

  const windowsKind = detectWindowsCommandKind(base);
  if (windowsKind) return windowsKind;

  if (LIST_COMMANDS.has(base)) return 'list';
  if (SEARCH_COMMANDS.has(base)) return 'search';
  if (READ_COMMANDS.has(base)) return 'read';
  if (WRITE_COMMANDS.has(base)) return 'write';
  if (NETWORK_COMMANDS.has(base)) return 'network';

  if (PACKAGE_MANAGER_COMMANDS.has(base)) {
    if (isTestOrBuildPackageCommand(command)) {
      return 'process';
    }
    return 'package_manager';
  }

  if (SAFE_PROCESS_COMMANDS.has(base)) return 'process';

  if (shell === 'powershell' && /^Get-/i.test(base)) {
    return 'read';
  }

  return 'unknown';
}

function detectRisk(command: string, kind: CommandKind, shell: ShellType): CommandRisk {
  if (isBlockedCommand(command)) return 'blocked';
  if (DANGEROUS_PATTERNS.some(pattern => pattern.test(command))) return 'dangerous';
  if ((shell === 'cmd' || shell === 'powershell') && hasWindowsDangerousPattern(command)) return 'dangerous';

  if (kind === 'git') {
    return classifyGitRisk(command);
  }

  if (kind === 'package_manager') {
    return classifyPackageRisk(command);
  }

  if (kind === 'network') {
    return 'ask';
  }

  if (kind === 'write') {
    return 'ask';
  }

  if (kind === 'process') {
    return SAFE_PROCESS_COMMANDS.has(firstToken(command)) ? 'auto' : 'ask';
  }

  if (kind === 'list' || kind === 'search' || kind === 'read') {
    return 'auto';
  }

  if (/\b(shutdown|reboot)\b/i.test(command)) return 'dangerous';

  return 'ask';
}

function classifyGitRisk(command: string): CommandRisk {
  const tokens = tokenize(command);
  const subcommand = tokens[1]?.toLowerCase();

  if (!subcommand) return 'ask';

  if (subcommand === 'push') {
    return /--force\b/.test(command) ? 'dangerous' : 'ask';
  }

  if (subcommand === 'reset' && /--hard\b/.test(command)) {
    return 'dangerous';
  }

  if (subcommand === 'clean') {
    return 'dangerous';
  }

  if ([
    'status',
    'diff',
    'log',
    'show',
    'rev-parse',
    'branch',
  ].includes(subcommand)) {
    return 'auto';
  }

  return 'ask';
}

function classifyPackageRisk(command: string): CommandRisk {
  if (/\b(?:install|add)\s+-g\b/i.test(command) || /\bnpm\s+publish\b/i.test(command)) {
    return 'dangerous';
  }

  if (/\b(?:install|add|update|upgrade|remove|uninstall)\b/i.test(command)) {
    return 'ask';
  }

  return 'ask';
}

function doesGitWrite(command: string): boolean {
  if (!command.trim().toLowerCase().startsWith('git ')) return false;
  return classifyGitRisk(command) !== 'auto';
}

function canCommandBackground(command: string, kind: CommandKind, risk: CommandRisk): boolean {
  if (risk === 'blocked' || risk === 'dangerous') return false;
  if (kind === 'write' || kind === 'network') return false;
  return /\b(test|build|watch|dev|serve|start|lint|typecheck|check)\b/i.test(command);
}

function isTestOrBuildPackageCommand(command: string): boolean {
  return /\b(?:test|run|exec|check|build|lint|typecheck)\b/i.test(command);
}

function firstToken(command: string): string {
  return tokenize(command)[0]?.toLowerCase() ?? '';
}

function tokenize(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}
