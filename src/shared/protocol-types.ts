/**
 * Shared Protocol Types — canonical definitions for CLI ↔ Web communication.
 *
 * This file is the single source of truth for wire types used in both:
 * - CLI: src/cli/brain/control-protocol.ts (re-exports + CLI-only types)
 * - Web: web/src/lib/cli-types.ts (re-exports + web-only types)
 */

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export type SessionStatus = 'idle' | 'running' | 'done' | 'error' | 'paused';

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
  /** Agent identity name (e.g. "@main", "@jarvis") */
  agentName?: string;
  /** Agent identity color hex (e.g. "#00d4ff") */
  agentColor?: string;
  /** Swarm ID if this session is a swarm worker */
  swarmId?: string;
  /** Sub-task ID within the swarm */
  swarmTaskId?: number;
}

// ---------------------------------------------------------------------------
// Instance metadata
// ---------------------------------------------------------------------------

export interface InstanceMeta {
  instanceId: string;
  projectName: string;
  projectPath: string;
  model: string;
  provider: string;
  uptime: number;
  version: string;
  permissionMode?: 'safe' | 'skip-permissions' | 'yolo';
}

// ---------------------------------------------------------------------------
// Findings
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
  scope?: 'local' | 'global';
  jarvisName?: string;
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

// ---------------------------------------------------------------------------
// Swarm Orchestration
// ---------------------------------------------------------------------------

export type SwarmStatus = 'idle' | 'planning' | 'executing' | 'completed' | 'failed' | 'aborted';

export interface SwarmInfo {
  id: string;
  originalRequest: string;
  status: SwarmStatus;
  reason: string;
  subTasks: SwarmSubTaskInfo[];
  parallelGroups: number[][];
  startedAt: number;
  completedAt?: number;
  totalCompleted: number;
  totalFailed: number;
}

export interface SwarmSubTaskInfo {
  id: number;
  title: string;
  description: string;
  affectedFiles: string[];
  dependencies: number[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  sessionId?: string;
  workerId?: number;
  startedAt?: number;
  completedAt?: number;
  result?: string;
}

// ---------------------------------------------------------------------------
// File Attachments
// ---------------------------------------------------------------------------

export interface ChatFileAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
}

// ---------------------------------------------------------------------------
// Tool Permission Approval
// ---------------------------------------------------------------------------

export interface ToolPermissionRequest {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  permissionLevel: 'ask' | 'dangerous';
  detail: string;
  sessionId: string;
  timestamp: number;
  expiresAt: number;
  reminderAt?: number;
}

// ---------------------------------------------------------------------------
// Status Bar
// ---------------------------------------------------------------------------

export interface StatusBarInfo {
  spiral: { l1: number; l2: number; l3: number; l4: number; l5: number; l6: number };
  tokens: { thisMessage: number; thisSession: number; sessionTotal: number };
  tools: { callsThisRound: number };
  model: string;
  git: { branch: string; uncommitted: number };
  checkpoints: number;
  permissionMode: 'safe' | 'skip' | 'yolo' | 'plan';
  autonomous: boolean;
  paused: boolean;
  /** Plan mode active indicator */
  planMode?: boolean;
  /** Active plan status description */
  plan?: string;
}

// ---------------------------------------------------------------------------
// Checkpoints
// ---------------------------------------------------------------------------

export interface CheckpointInfo {
  id: number;
  timestamp: number;
  type: string;
  label: string;
  messageIndex: number;
  hasFileSnapshots: boolean;
  fileCount: number;
  toolName?: string;
}

// ---------------------------------------------------------------------------
// Execution Plan
// ---------------------------------------------------------------------------

export type PlanStepStatusInfo = 'pending' | 'running' | 'done' | 'error' | 'skipped';
export type PlanStatusInfo = 'drafting' | 'pending_approval' | 'approved' | 'executing'
  | 'completed' | 'failed' | 'rejected' | 'modified';

export interface PlanStepInfo {
  id: number;
  title: string;
  description: string;
  tools: string[];
  affectedFiles: string[];
  dependencies: number[];
  status: PlanStepStatusInfo;
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface PlanInfo {
  id: string;
  title: string;
  description: string;
  steps: PlanStepInfo[];
  status: PlanStatusInfo;
  source: 'user_plan_mode' | 'jarvis_proposal' | 'auto_complex';
  createdAt: number;
  approvedAt?: number;
  completedAt?: number;
  rejectionReason?: string;
  totalStepsCompleted: number;
  totalStepsFailed: number;
  proposalId?: number;
}

// ---------------------------------------------------------------------------
// Voice Conversation
// ---------------------------------------------------------------------------

export type VoiceSessionState = 'idle' | 'listening' | 'processing' | 'speaking';
export type VoiceProvider = 'elevenlabs' | 'web_speech';
export type STTProvider = 'whisper' | 'web_speech';

export interface VoiceConfig {
  sttProvider: STTProvider;
  ttsProvider: VoiceProvider;
  elevenLabsApiKey?: string;
  clonedVoiceId?: string;
  whisperModel?: string;
  vadSensitivity?: number;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// WS message envelope
// ---------------------------------------------------------------------------

export interface WSMessage {
  type: string;
  requestId?: string;
  timestamp: number;
}
