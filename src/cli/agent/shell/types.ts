export type ShellType = 'cmd' | 'powershell' | 'bash';

export type CommandRisk = 'auto' | 'ask' | 'dangerous' | 'blocked';

export type CommandKind =
  | 'read'
  | 'search'
  | 'list'
  | 'write'
  | 'git'
  | 'network'
  | 'package_manager'
  | 'process'
  | 'unknown';

export type LegacyCommandLevel = 'safe' | 'ask' | 'dangerous';

export interface CommandClassification {
  shell: ShellType;
  kind: CommandKind;
  risk: CommandRisk;
  summary: string;
  touchesNetwork: boolean;
  writesFiles: boolean;
  canBackground: boolean;
}
