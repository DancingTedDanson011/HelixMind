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
// Bug Journal
// ---------------------------------------------------------------------------

export type BugStatus = 'open' | 'investigating' | 'fixed' | 'verified';

export interface BugInfo {
  id: number;
  description: string;
  file?: string;
  line?: number;
  status: BugStatus;
  createdAt: number;
  updatedAt: number;
  fixedAt?: number;
  fixDescription?: string;
}

// ---------------------------------------------------------------------------
// Browser Screenshot
// ---------------------------------------------------------------------------

export interface BrowserScreenshotInfo {
  url: string;
  title?: string;
  timestamp: number;
  imageBase64?: string;
  analysis?: string;
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

// ---------------------------------------------------------------------------
// Web Chat Events (CLI → Browser, streamed)
// ---------------------------------------------------------------------------

export interface ChatStartedEvent {
  type: 'chat_started';
  chatId: string;
  timestamp: number;
}

export interface ChatTextChunkEvent {
  type: 'chat_text_chunk';
  chatId: string;
  text: string;
  timestamp: number;
}

export interface ChatToolStartEvent {
  type: 'chat_tool_start';
  chatId: string;
  stepNum: number;
  toolName: string;
  toolInput: Record<string, unknown>;
  timestamp: number;
}

export interface ChatToolEndEvent {
  type: 'chat_tool_end';
  chatId: string;
  stepNum: number;
  toolName: string;
  status: 'done' | 'error';
  result?: string;
  timestamp: number;
}

export interface ChatCompleteEvent {
  type: 'chat_complete';
  chatId: string;
  text: string;
  steps: number;
  tokensUsed: { input: number; output: number };
  timestamp: number;
}

export interface ChatErrorEvent {
  type: 'chat_error';
  chatId: string;
  error: string;
  timestamp: number;
}

export type ChatEvent =
  | ChatStartedEvent
  | ChatTextChunkEvent
  | ChatToolStartEvent
  | ChatToolEndEvent
  | ChatCompleteEvent
  | ChatErrorEvent;

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
