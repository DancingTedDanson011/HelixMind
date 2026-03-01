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
  token: string;
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
// Monitor Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Jarvis
// ---------------------------------------------------------------------------

export type JarvisTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';
export type JarvisTaskPriority = 'high' | 'medium' | 'low';
export type JarvisDaemonState = 'stopped' | 'running' | 'paused';

export interface JarvisTaskInfo {
  id: number;
  title: string;
  description: string;
  status: JarvisTaskStatus;
  priority: JarvisTaskPriority;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: string;
  error?: string;
  retries: number;
  maxRetries: number;
  sessionId?: string;
  dependencies?: number[];
  tags?: string[];
}

export interface JarvisStatusInfo {
  daemonState: JarvisDaemonState;
  currentTaskId: number | null;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  totalCount: number;
  uptimeMs: number;
  autonomyLevel?: number;
  thinkingPhase?: string;
  activeWorkers?: number;
}

// ---------------------------------------------------------------------------
// Jarvis AGI
// ---------------------------------------------------------------------------

export interface ProposalInfo {
  id: number;
  title: string;
  description: string;
  rationale: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  category: string;
  affectedFiles: string[];
  createdAt: number;
  decidedAt?: number;
  denialReason?: string;
}

export interface IdentityInfo {
  traits: Record<string, number>;
  trust: { approvalRate: number; successRate: number; totalProposals: number };
  autonomyLevel: number;
  uptime: number;
  recentLearnings: string[];
}

export interface ScheduleInfo {
  id: number;
  type: string;
  expression: string;
  taskTitle: string;
  enabled: boolean;
  nextRunAt?: number;
  lastRunAt?: number;
}

export interface TriggerInfo {
  id: number;
  source: string;
  pattern: string;
  action: string;
  enabled: boolean;
  lastFiredAt?: number;
}

export interface WorkerInfo {
  workerId: number;
  taskId: number;
  taskTitle: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
}

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
