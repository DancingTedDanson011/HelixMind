/**
 * Monitor System — shared types for the security monitoring agent.
 */

// ---------------------------------------------------------------------------
// Core enums
// ---------------------------------------------------------------------------

export type MonitorMode = 'passive' | 'defensive' | 'active';

export type ThreatSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ThreatCategory =
  | 'bruteforce'
  | 'portscan'
  | 'exfiltration'
  | 'malware'
  | 'config_change'
  | 'privilege_escalation'
  | 'secret_leak'
  | 'anomaly';

export type DefenseAction =
  | 'block_ip'
  | 'kill_process'
  | 'close_port'
  | 'rotate_secret'
  | 'isolate_service'
  | 'deploy_honeypot';

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

export interface ThreatEvent {
  id: string;
  severity: ThreatSeverity;
  category: ThreatCategory;
  title: string;
  details: string;
  source: string;
  timestamp: number;
  relatedEvents: string[];
}

export interface DefenseRecord {
  id: string;
  action: DefenseAction;
  target: string;
  reason: string;
  autoApproved: boolean;
  reversible: boolean;
  timestamp: number;
}

export interface MonitorBaseline {
  processes: ProcessInfo[];
  ports: PortInfo[];
  configs: ConfigSnapshot[];
  packages: PackageInfo[];
  users: UserInfo[];
  crons: CronEntry[];
  timestamp: number;
}

export interface ProcessInfo {
  pid: number;
  user: string;
  command: string;
  cpu: number;
  mem: number;
}

export interface PortInfo {
  port: number;
  protocol: 'tcp' | 'udp';
  process: string;
  address: string;
}

export interface ConfigSnapshot {
  file: string;
  hash: string;
  lastModified: number;
}

export interface PackageInfo {
  name: string;
  version: string;
  vulnerabilities: number;
}

export interface UserInfo {
  name: string;
  uid: number;
  shell: string;
  lastLogin: number | null;
}

export interface CronEntry {
  user: string;
  schedule: string;
  command: string;
}

export interface MonitorState {
  mode: MonitorMode;
  uptime: number;
  threats: ThreatEvent[];
  defenses: DefenseRecord[];
  baseline: MonitorBaseline | null;
  lastScan: number;
}

// ---------------------------------------------------------------------------
// Scan results
// ---------------------------------------------------------------------------

export interface ScanResult {
  processes: string;
  ports: string;
  sshConfig: string;
  firewall: string;
  crontabs: string;
  packages: string;
  recentLogins: string;
  configChanges: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Drift detection
// ---------------------------------------------------------------------------

export interface Drift {
  category: 'process' | 'port' | 'config' | 'package' | 'user' | 'cron';
  description: string;
  severity: ThreatSeverity;
  details: string;
}

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

export interface MonitorCallbacks {
  sendMessage: (prompt: string) => Promise<string>;
  isAborted: () => boolean;
  onThreat: (threat: ThreatEvent) => void;
  onDefense: (defense: DefenseRecord) => void;
  onScanComplete: (phase: string) => void;
  onStatusUpdate: (status: MonitorState) => void;
  updateStatus: () => void;
}

// ---------------------------------------------------------------------------
// Approval flow
// ---------------------------------------------------------------------------

export interface ApprovalRequest {
  id: string;
  action: DefenseAction;
  target: string;
  reason: string;
  severity: ThreatSeverity;
  timestamp: number;
  expiresAt: number;
}

export interface ApprovalResponse {
  requestId: string;
  approved: boolean;
  respondedBy: 'web' | 'cli' | 'auto';
  timestamp: number;
}
