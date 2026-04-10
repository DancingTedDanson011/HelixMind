import type { CommandClassification } from './types.js';

export function summarizeCommandClassification(
  classification: Omit<CommandClassification, 'summary'>,
  command: string,
): string {
  if (classification.risk === 'blocked') {
    return 'Blocked destructive or system-level command';
  }

  if (classification.risk === 'dangerous') {
    switch (classification.kind) {
      case 'network':
        return 'Dangerous network or remote execution command';
      case 'write':
        return 'Dangerous filesystem or system modification command';
      case 'git':
        return 'Dangerous git history or publish operation';
      case 'package_manager':
        return 'Dangerous package manager or environment mutation';
      default:
        return 'Dangerous shell command requiring explicit approval';
    }
  }

  switch (classification.kind) {
    case 'list':
      return 'List files or directories';
    case 'search':
      return 'Search files or command output';
    case 'read':
      return 'Read file or system state';
    case 'git':
      return classification.risk === 'auto'
        ? 'Run read-only git command'
        : 'Run git command that changes or publishes state';
    case 'write':
      return 'Modify files or filesystem state';
    case 'network':
      return 'Access network resources';
    case 'package_manager':
      return 'Run package manager command';
    case 'process':
      if (/\b(test|build|check|lint|typecheck)\b/i.test(command)) {
        return 'Run build, test, or verification command';
      }
      return 'Run local process command';
    default:
      return 'Run general shell command';
  }
}
