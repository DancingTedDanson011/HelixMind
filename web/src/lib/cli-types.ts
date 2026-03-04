/**
 * Shared TypeScript interfaces for CLI ↔ Web communication.
 * Wire types are canonically defined in @helixmind/protocol (shared/protocol-types.ts)
 * and re-exported here. Web-only types are defined below.
 */

// Re-export all shared wire types from the canonical source
export type {
  SessionStatus,
  SessionInfo,
  InstanceMeta,
  Finding,
  BugStatus,
  BugInfo,
  BrowserScreenshotInfo,
  JarvisTaskStatus,
  JarvisTaskPriority,
  JarvisDaemonState,
  JarvisTaskInfo,
  JarvisStatusInfo,
  ProposalInfo,
  IdentityInfo,
  ScheduleInfo,
  TriggerInfo,
  WorkerInfo,
  ChatFileAttachment,
  ToolPermissionRequest,
  StatusBarInfo,
  CheckpointInfo,
  WSMessage,
  PlanInfo,
  PlanStepInfo,
  PlanStatusInfo,
  PlanStepStatusInfo,
} from '@helixmind/protocol';

// ---------------------------------------------------------------------------
// Web-only types (not shared with CLI)
// ---------------------------------------------------------------------------

// --- Discovery ---

import type { InstanceMeta } from '@helixmind/protocol';

export interface DiscoveredInstance {
  port: number;
  meta: InstanceMeta;
  token: string;
  tokenHint: string;
}

// --- Web Chat Events (CLI → Browser, streamed) ---

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

// --- Monitor Types ---

export type MonitorMode = 'passive' | 'defensive' | 'active';
export type ThreatSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ThreatEvent {
  id: string;
  severity: ThreatSeverity;
  category: string;
  title: string;
  details: string;
  source: string;
  timestamp: number;
  relatedEvents: string[];
}

export interface DefenseRecord {
  id: string;
  action: string;
  target: string;
  reason: string;
  autoApproved: boolean;
  reversible: boolean;
  timestamp: number;
}

export interface ApprovalRequest {
  id: string;
  action: string;
  target: string;
  reason: string;
  severity: ThreatSeverity;
  timestamp: number;
  expiresAt: number;
}

export interface MonitorStatus {
  mode: MonitorMode;
  uptime: number;
  threatCount: number;
  defenseCount: number;
  lastScan: number;
}

// --- Jarvis AGI web-only types ---

export interface ThinkingUpdate {
  phase: string;
  observation?: string;
  timestamp: number;
}

export interface ConsciousnessEvent {
  eventType: string;
  content: string;
  depth: string;
  timestamp: number;
}

// --- Connection ---

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'error';

export type ConnectionMode = 'local' | 'relay';
