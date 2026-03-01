/**
 * Control Protocol — shared types and serializers for CLI ↔ Web communication.
 * Used by both local WebSocket (Brain Server) and remote Relay connections.
 */
import type { Session, SessionStatus } from '../sessions/session.js';

// ---------------------------------------------------------------------------
// Data types
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

export interface Finding {
  sessionName: string;
  finding: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  file: string;
  timestamp: number;
}

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

export interface BrowserScreenshotInfo {
  url: string;
  title?: string;
  timestamp: number;
  /** Base64-encoded PNG screenshot (may be absent if too large) */
  imageBase64?: string;
  analysis?: string;
}

// --- Jarvis data types ---
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

// --- Jarvis AGI data types ---

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
// WS message envelope
// ---------------------------------------------------------------------------

export interface WSMessage {
  type: string;
  requestId?: string;
  timestamp: number;
}

// --- Auth ---
export interface AuthMessage extends WSMessage { type: 'auth'; token: string }
export interface AuthOkMessage extends WSMessage { type: 'auth_ok' }
export interface AuthFailMessage extends WSMessage { type: 'auth_fail'; reason: string }

// --- CLI → Relay auth ---
export interface CliAuthMessage extends WSMessage { type: 'cli_auth'; apiKey: string }
export interface CliAuthOkMessage extends WSMessage { type: 'cli_auth_ok'; userId: string; instanceId: string }

// --- Requests (Browser → CLI) ---
export interface ListSessionsRequest extends WSMessage { type: 'list_sessions' }
export interface StartAutoRequest extends WSMessage { type: 'start_auto'; goal?: string }
export interface StartSecurityRequest extends WSMessage { type: 'start_security' }
export interface AbortSessionRequest extends WSMessage { type: 'abort_session'; sessionId: string }
export interface SubscribeOutputRequest extends WSMessage { type: 'subscribe_output'; sessionId: string }
export interface UnsubscribeOutputRequest extends WSMessage { type: 'unsubscribe_output'; sessionId: string }
export interface SendChatRequest extends WSMessage { type: 'send_chat'; text: string; chatId?: string; mode?: 'normal' | 'skip-permissions' }
export interface GetFindingsRequest extends WSMessage { type: 'get_findings' }
export interface GetBugsRequest extends WSMessage { type: 'get_bugs' }
export interface PingRequest extends WSMessage { type: 'ping' }
export interface StartMonitorRequest extends WSMessage { type: 'start_monitor'; mode: 'passive' | 'defensive' | 'active' }
export interface StopMonitorRequest extends WSMessage { type: 'stop_monitor' }
export interface MonitorCommandRequest extends WSMessage { type: 'monitor_command'; command: 'set_mode' | 'rescan' | 'unblock_ip' | 'stop_monitor'; params?: Record<string, string> }
export interface ApprovalResponseRequest extends WSMessage { type: 'approval_response'; requestId: string; approved: boolean }

// --- Jarvis Requests (Browser → CLI) ---
export interface StartJarvisRequest extends WSMessage { type: 'start_jarvis' }
export interface StopJarvisRequest extends WSMessage { type: 'stop_jarvis' }
export interface PauseJarvisRequest extends WSMessage { type: 'pause_jarvis' }
export interface ResumeJarvisRequest extends WSMessage { type: 'resume_jarvis' }
export interface AddJarvisTaskRequest extends WSMessage { type: 'add_jarvis_task'; title: string; description: string; priority?: 'high' | 'medium' | 'low'; dependencies?: number[]; tags?: string[] }
export interface ListJarvisTasksRequest extends WSMessage { type: 'list_jarvis_tasks' }
export interface GetJarvisStatusRequest extends WSMessage { type: 'get_jarvis_status' }
export interface ClearJarvisCompletedRequest extends WSMessage { type: 'clear_jarvis_completed' }

// --- Jarvis AGI Requests (Browser → CLI) ---
export interface ListProposalsRequest extends WSMessage { type: 'list_proposals' }
export interface ApproveProposalRequest extends WSMessage { type: 'approve_proposal'; proposalId: number }
export interface DenyProposalRequest extends WSMessage { type: 'deny_proposal'; proposalId: number; reason: string }
export interface SetAutonomyLevelRequest extends WSMessage { type: 'set_autonomy_level'; level: number }
export interface GetIdentityRequest extends WSMessage { type: 'get_identity' }
export interface TriggerDeepThinkRequest extends WSMessage { type: 'trigger_deep_think' }
export interface AddScheduleRequest extends WSMessage { type: 'add_schedule'; expression: string; taskTitle: string; scheduleType?: string }
export interface RemoveScheduleRequest extends WSMessage { type: 'remove_schedule'; scheduleId: number }
export interface ListSchedulesRequest extends WSMessage { type: 'list_schedules' }
export interface AddTriggerRequest extends WSMessage { type: 'add_trigger'; source: string; pattern: string; action: string }
export interface RemoveTriggerRequest extends WSMessage { type: 'remove_trigger'; triggerId: number }
export interface ListTriggersRequest extends WSMessage { type: 'list_triggers' }
export interface ListProjectsRequest extends WSMessage { type: 'list_projects' }
export interface RegisterProjectRequest extends WSMessage { type: 'register_project'; path: string; name?: string }
export interface GetWorkersRequest extends WSMessage { type: 'get_workers' }

// --- Responses (CLI → Browser) ---
export interface SessionsListResponse extends WSMessage { type: 'sessions_list'; sessions: SessionInfo[] }
export interface AutoStartedResponse extends WSMessage { type: 'auto_started'; sessionId: string }
export interface SecurityStartedResponse extends WSMessage { type: 'security_started'; sessionId: string }
export interface SessionAbortedResponse extends WSMessage { type: 'session_aborted'; sessionId: string }
export interface OutputSubscribedResponse extends WSMessage { type: 'output_subscribed' }
export interface ChatReceivedResponse extends WSMessage { type: 'chat_received' }
export interface FindingsListResponse extends WSMessage { type: 'findings_list'; findings: Finding[] }
export interface BugsListResponse extends WSMessage { type: 'bugs_list'; bugs: BugInfo[] }
export interface PongResponse extends WSMessage { type: 'pong' }
export interface MonitorStartedResponse extends WSMessage { type: 'monitor_started'; sessionId: string; mode: string }

// --- Jarvis Responses (CLI → Browser) ---
export interface JarvisStartedResponse extends WSMessage { type: 'jarvis_started'; sessionId: string }
export interface JarvisStoppedResponse extends WSMessage { type: 'jarvis_stopped' }
export interface JarvisTaskAddedResponse extends WSMessage { type: 'jarvis_task_added'; task: JarvisTaskInfo }
export interface JarvisTasksListResponse extends WSMessage { type: 'jarvis_tasks_list'; tasks: JarvisTaskInfo[] }
export interface JarvisStatusResponse extends WSMessage { type: 'jarvis_status'; status: JarvisStatusInfo }

// --- Jarvis AGI Responses (CLI → Browser) ---
export interface ProposalsListResponse extends WSMessage { type: 'proposals_list'; proposals: ProposalInfo[] }
export interface ProposalApprovedResponse extends WSMessage { type: 'proposal_approved'; proposalId: number }
export interface ProposalDeniedResponse extends WSMessage { type: 'proposal_denied'; proposalId: number }
export interface AutonomyLevelSetResponse extends WSMessage { type: 'autonomy_level_set'; level: number }
export interface IdentityResponse extends WSMessage { type: 'identity_info'; identity: IdentityInfo }
export interface SchedulesListResponse extends WSMessage { type: 'schedules_list'; schedules: ScheduleInfo[] }
export interface TriggersListResponse extends WSMessage { type: 'triggers_list'; triggers: TriggerInfo[] }
export interface ProjectsListResponse extends WSMessage { type: 'projects_list'; projects: Array<{ name: string; path: string; health: number }> }
export interface WorkersListResponse extends WSMessage { type: 'workers_list'; workers: WorkerInfo[] }

// --- Server-Push Events (CLI → Browser, async) ---
export interface SessionUpdatedEvent extends WSMessage { type: 'session_updated'; session: SessionInfo }
export interface SessionCreatedEvent extends WSMessage { type: 'session_created'; session: SessionInfo }
export interface SessionRemovedEvent extends WSMessage { type: 'session_removed'; sessionId: string }
export interface OutputLineEvent extends WSMessage { type: 'output_line'; sessionId: string; line: string; lineIndex: number }
export interface InstanceMetaEvent extends WSMessage { type: 'instance_meta'; instance: InstanceMeta }
export interface BugCreatedEvent extends WSMessage { type: 'bug_created'; bug: BugInfo }
export interface BugUpdatedEvent extends WSMessage { type: 'bug_updated'; bug: BugInfo }
export interface BrowserScreenshotEvent extends WSMessage { type: 'browser_screenshot'; screenshot: BrowserScreenshotInfo }

// --- Monitor Events (CLI → Browser, async) ---
export interface ThreatDetectedEvent extends WSMessage { type: 'threat_detected'; threat: Record<string, unknown> }
export interface DefenseActivatedEvent extends WSMessage { type: 'defense_activated'; defense: Record<string, unknown> }
export interface ApprovalRequestEvent extends WSMessage { type: 'approval_request'; request: Record<string, unknown> }
export interface MonitorStatusEvent extends WSMessage { type: 'monitor_status'; mode: string; uptime: number; threatCount: number; defenseCount: number; lastScan: number }

// --- Jarvis Events (CLI → Browser, async) ---
export interface JarvisTaskCreatedEvent extends WSMessage { type: 'jarvis_task_created'; task: JarvisTaskInfo }
export interface JarvisTaskUpdatedEvent extends WSMessage { type: 'jarvis_task_updated'; task: JarvisTaskInfo }
export interface JarvisStatusChangedEvent extends WSMessage { type: 'jarvis_status_changed'; status: JarvisStatusInfo }

// --- Jarvis AGI Events (CLI → Browser, async) ---
export interface ThinkingUpdateEvent extends WSMessage { type: 'thinking_update'; phase: string; observation?: string }
export interface ConsciousnessEventMsg extends WSMessage { type: 'consciousness_event'; eventType: string; content: string; depth: string }
export interface JarvisLearningEvent extends WSMessage { type: 'jarvis_learning'; topic: string; content: string; spiralLevel: number; tags: string[]; sourcePhase: string }
export interface IdentityChangedEvent extends WSMessage { type: 'identity_changed'; trait: string; oldValue: number; newValue: number; reason: string }
export interface AutonomyChangedEvent extends WSMessage { type: 'autonomy_changed'; oldLevel: number; newLevel: number; reason: string }
export interface NeuronFiredEvent extends WSMessage { type: 'neuron_fired'; fromOrbit: string; color: string; trigger: string }
export interface ProposalCreatedEvent extends WSMessage { type: 'proposal_created'; proposal: ProposalInfo }
export interface ProposalUpdatedEvent extends WSMessage { type: 'proposal_updated'; proposal: ProposalInfo }
export interface ScheduleFiredEvent extends WSMessage { type: 'schedule_fired'; scheduleId: number; taskTitle: string }
export interface TriggerFiredEvent extends WSMessage { type: 'trigger_fired'; triggerId: number; source: string; details: string }
export interface WorkerStartedEvent extends WSMessage { type: 'worker_started'; worker: WorkerInfo }
export interface WorkerCompletedEvent extends WSMessage { type: 'worker_completed'; worker: WorkerInfo }
export interface TTSAudioEvent extends WSMessage { type: 'tts_audio'; audioBase64: string; text: string; duration: number }
export interface NotificationSentEvent extends WSMessage { type: 'notification_sent'; channel: string; title: string }

// --- Web Chat Events (CLI → Browser, streamed) ---
export interface ChatStartedEvent extends WSMessage { type: 'chat_started'; chatId: string }
export interface ChatTextChunkEvent extends WSMessage { type: 'chat_text_chunk'; chatId: string; text: string }
export interface ChatToolStartEvent extends WSMessage { type: 'chat_tool_start'; chatId: string; stepNum: number; toolName: string; toolInput: Record<string, unknown> }
export interface ChatToolEndEvent extends WSMessage { type: 'chat_tool_end'; chatId: string; stepNum: number; toolName: string; status: 'done' | 'error'; result?: string }
export interface ChatCompleteEvent extends WSMessage { type: 'chat_complete'; chatId: string; text: string; steps: number; tokensUsed: { input: number; output: number } }
export interface ChatErrorEvent extends WSMessage { type: 'chat_error'; chatId: string; error: string }

// Union of all control request types
export type ControlRequest =
  | ListSessionsRequest
  | StartAutoRequest
  | StartSecurityRequest
  | StartMonitorRequest
  | StopMonitorRequest
  | MonitorCommandRequest
  | ApprovalResponseRequest
  | AbortSessionRequest
  | SubscribeOutputRequest
  | UnsubscribeOutputRequest
  | SendChatRequest
  | GetFindingsRequest
  | GetBugsRequest
  | PingRequest
  | StartJarvisRequest
  | StopJarvisRequest
  | PauseJarvisRequest
  | ResumeJarvisRequest
  | AddJarvisTaskRequest
  | ListJarvisTasksRequest
  | GetJarvisStatusRequest
  | ClearJarvisCompletedRequest
  | ListProposalsRequest
  | ApproveProposalRequest
  | DenyProposalRequest
  | SetAutonomyLevelRequest
  | GetIdentityRequest
  | TriggerDeepThinkRequest
  | AddScheduleRequest
  | RemoveScheduleRequest
  | ListSchedulesRequest
  | AddTriggerRequest
  | RemoveTriggerRequest
  | ListTriggersRequest
  | ListProjectsRequest
  | RegisterProjectRequest
  | GetWorkersRequest;

// ---------------------------------------------------------------------------
// Control handler callbacks — registered from chat.ts
// ---------------------------------------------------------------------------

export interface ControlHandlers {
  listSessions(): SessionInfo[];
  startAuto(goal?: string): string;          // returns sessionId
  startSecurity(): string;                    // returns sessionId
  startMonitor(mode: 'passive' | 'defensive' | 'active'): string; // returns sessionId
  stopMonitor(): boolean;
  handleMonitorCommand(command: string, params?: Record<string, string>): void;
  handleApprovalResponse(requestId: string, approved: boolean): void;
  abortSession(sessionId: string): boolean;
  sendChat(text: string, chatId?: string, mode?: 'normal' | 'skip-permissions'): void;
  getFindings(): Finding[];
  getBugs(): BugInfo[];
  // Jarvis
  startJarvis(): string;                    // returns sessionId
  stopJarvis(): boolean;
  pauseJarvis(): boolean;
  resumeJarvis(): boolean;
  addJarvisTask(title: string, description: string, opts?: { priority?: JarvisTaskPriority; dependencies?: number[]; tags?: string[] }): JarvisTaskInfo;
  listJarvisTasks(): JarvisTaskInfo[];
  getJarvisStatus(): JarvisStatusInfo;
  clearJarvisCompleted(): void;
  // Jarvis AGI
  listProposals(): ProposalInfo[];
  approveProposal(id: number): boolean;
  denyProposal(id: number, reason: string): boolean;
  setAutonomyLevel(level: number): boolean;
  getIdentity(): IdentityInfo | null;
  triggerDeepThink(): void;
  addSchedule(expression: string, taskTitle: string, scheduleType?: string): ScheduleInfo | null;
  removeSchedule(id: number): boolean;
  listSchedules(): ScheduleInfo[];
  addTrigger(source: string, pattern: string, action: string): TriggerInfo | null;
  removeTrigger(id: number): boolean;
  listTriggers(): TriggerInfo[];
  listProjects(): Array<{ name: string; path: string; health: number }>;
  registerProject(path: string, name?: string): { name: string; path: string; health: number } | null;
  getWorkers(): WorkerInfo[];
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

export function serializeSession(session: Session): SessionInfo {
  const recentOutput = session.output.slice(-20);
  return {
    id: session.id,
    name: session.name,
    icon: session.icon,
    status: session.status,
    startTime: session.startTime,
    endTime: session.endTime,
    elapsed: session.elapsed,
    outputLineCount: session.output.length,
    recentOutput,
    result: session.result
      ? {
          text: session.result.text.slice(0, 2000),
          stepsCount: session.result.steps.length,
          errorsCount: session.result.errors.length,
        }
      : null,
  };
}

let instanceStartTime = Date.now();

export function buildInstanceMeta(
  projectName: string,
  projectPath: string,
  model: string,
  provider: string,
  version: string,
  instanceId: string,
): InstanceMeta {
  return {
    instanceId,
    projectName,
    projectPath,
    model,
    provider,
    uptime: Math.floor((Date.now() - instanceStartTime) / 1000),
    version,
  };
}

/** Reset instance start time (called once on CLI startup) */
export function resetInstanceStartTime(): void {
  instanceStartTime = Date.now();
}

/** Serialize a JarvisTask to JarvisTaskInfo for wire transmission */
export function serializeJarvisTask(task: {
  id: number; title: string; description: string; status: string; priority: string;
  createdAt: number; updatedAt: number; startedAt?: number; completedAt?: number;
  result?: string; error?: string; retries: number; maxRetries: number;
  sessionId?: string; dependencies?: number[]; tags?: string[];
}): JarvisTaskInfo {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status as JarvisTaskStatus,
    priority: task.priority as JarvisTaskPriority,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    result: task.result,
    error: task.error,
    retries: task.retries,
    maxRetries: task.maxRetries,
    sessionId: task.sessionId,
    dependencies: task.dependencies,
    tags: task.tags,
  };
}
