/**
 * Shared TypeScript interfaces mirroring the CLI's control-protocol.ts types.
 * Used by web hooks and components to communicate with local or relay CLI instances.
 */

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export type SessionStatus = 'idle' | 'running' | 'done' | 'error' | 'paused';

// ---------------------------------------------------------------------------
// Instance metadata returned by CLI's /api/instance endpoint
// ---------------------------------------------------------------------------

export interface InstanceMeta {
  instanceId: string;
  projectName: string;
  projectPath: string;
  model: string;
  provider: string;
  uptime: number;
  version: string;
}

// ---------------------------------------------------------------------------
// Session info from list_sessions response
// ---------------------------------------------------------------------------

export interface SessionInfo {
  id: string;
  name: string;
  icon: string;
  status: SessionStatus;
  startTime: number;
  endTime: number;
  elapsed: number;
  outputLineCount: number;
  recentOutput: string[];
  result: { text: string; stepsCount: number; errorsCount: number } | null;
}

// ---------------------------------------------------------------------------
// Finding from security/auto sessions
// ---------------------------------------------------------------------------

export interface Finding {
  sessionName: string;
  finding: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  file: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Discovery result from scanning local ports
// ---------------------------------------------------------------------------

export interface DiscoveredInstance {
  port: number;
  meta: InstanceMeta;
  tokenHint: string;
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'error';

export type ConnectionMode = 'local' | 'relay';
