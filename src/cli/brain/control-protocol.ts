/**
 * Control Protocol — shared types and serializers for CLI ↔ Web communication.
 * Used by both local WebSocket (Brain Server) and remote Relay connections.
 *
 * Wire types are canonically defined in @helixmind/protocol (shared/protocol-types.ts)
 * and re-exported here for backwards compatibility.
 */
import type { Session } from '../sessions/session.js';
import type { BrainInstance, BrainLimits } from './instance-manager.js';

// Import shared wire types from the canonical source (for local use)
import type {
  SessionStatus, SessionInfo, InstanceMeta, Finding, BugStatus, BugInfo,
  BrowserScreenshotInfo, JarvisTaskStatus, JarvisTaskPriority, JarvisDaemonState,
  JarvisTaskInfo, JarvisStatusInfo, ProposalInfo, IdentityInfo, ScheduleInfo,
  TriggerInfo, WorkerInfo, ChatFileAttachment, ToolPermissionRequest, StatusBarInfo,
  CheckpointInfo, WSMessage,
  PlanInfo, PlanStepInfo, PlanStatusInfo, PlanStepStatusInfo,
  SwarmStatus, SwarmInfo, SwarmSubTaskInfo,
} from '@helixmind/protocol';

// Re-export all shared wire types for backwards compatibility
export type {
  SessionStatus, SessionInfo, InstanceMeta, Finding, BugStatus, BugInfo,
  BrowserScreenshotInfo, JarvisTaskStatus, JarvisTaskPriority, JarvisDaemonState,
  JarvisTaskInfo, JarvisStatusInfo, ProposalInfo, IdentityInfo, ScheduleInfo,
  TriggerInfo, WorkerInfo, ChatFileAttachment, ToolPermissionRequest, StatusBarInfo,
  CheckpointInfo, WSMessage,
  PlanInfo, PlanStepInfo, PlanStatusInfo, PlanStepStatusInfo,
  SwarmStatus, SwarmInfo, SwarmSubTaskInfo,
};

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
export interface SendChatRequest extends WSMessage { type: 'send_chat'; text: string; chatId?: string; mode?: 'normal' | 'skip-permissions'; files?: ChatFileAttachment[] }
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
export interface DeleteJarvisTaskRequest extends WSMessage { type: 'delete_jarvis_task'; taskId: number }
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
export interface GetConfigRequest extends WSMessage { type: 'get_config' }
export interface SwitchModelRequest extends WSMessage { type: 'switch_model'; provider: string; model: string }

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
export interface ConfigResponse extends WSMessage { type: 'config_response'; provider: string; apiKey: string; model: string }

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

// --- Brain Sync (CLI ↔ Web) ---
export interface BrainSyncPushRequest extends WSMessage { type: 'brain_sync_push'; brainId: string; version: number; nodesJson: string; metadata: Record<string, unknown> }
export interface BrainSyncPullRequest extends WSMessage { type: 'brain_sync_pull'; brainId: string }
export interface BrainSyncDataResponse extends WSMessage { type: 'brain_sync_data'; brainId: string; version: number; nodesJson: string }
export interface BrainSyncStatusEvent extends WSMessage { type: 'brain_sync_status'; brainId: string; synced: boolean; version: number; lastSyncedAt: number }

// --- Brain Node Events (CLI → Browser, Enterprise) ---
export interface BrainNodeCreatedEvent extends WSMessage { type: 'brain_node_created'; brainId: string; node: { id: string; content: string; level: number } }
export interface BrainNodeUpdatedEvent extends WSMessage { type: 'brain_node_updated'; brainId: string; node: { id: string; content: string; level: number } }
export interface BrainNodeDeletedEvent extends WSMessage { type: 'brain_node_deleted'; brainId: string; nodeId: string }
export interface BrainStatsUpdateEvent extends WSMessage { type: 'brain_stats_update'; brainId: string; nodeCount: number; levelCounts: Record<number, number> }

// --- License (CLI ↔ Web) ---
export interface LicenseValidateRequest extends WSMessage { type: 'license_validate'; licenseKey: string }
export interface LicenseStatusResponse extends WSMessage { type: 'license_status'; valid: boolean; plan: string; features: string[]; expiresAt: string }

// --- Status Bar (CLI → Browser) ---
export interface GetStatusBarRequest extends WSMessage { type: 'get_status_bar' }
export interface StatusBarUpdateEvent extends WSMessage { type: 'status_bar_update'; data: StatusBarInfo }

// --- Checkpoints (CLI ↔ Browser) ---
export interface ListCheckpointsRequest extends WSMessage { type: 'list_checkpoints' }
export interface CheckpointsListResponse extends WSMessage { type: 'checkpoints_list'; checkpoints: CheckpointInfo[] }
export interface RevertToCheckpointRequest extends WSMessage { type: 'revert_to_checkpoint'; checkpointId: number; mode: 'chat' | 'code' | 'both' }
export interface CheckpointRevertedResponse extends WSMessage { type: 'checkpoint_reverted'; checkpointId: number; mode: string; filesReverted: number; messagesRemoved: number }
export interface CheckpointCreatedEvent extends WSMessage { type: 'checkpoint_created'; checkpoint: CheckpointInfo }

// --- Plan Mode Requests (Browser → CLI) ---
export interface GetActivePlanRequest extends WSMessage { type: 'get_active_plan' }
export interface ApprovePlanRequest extends WSMessage { type: 'approve_plan'; planId: string }
export interface RejectPlanRequest extends WSMessage { type: 'reject_plan'; planId: string; reason: string }
export interface SetPlanModeRequest extends WSMessage { type: 'set_plan_mode'; enabled: boolean }

// --- Plan Mode Responses (CLI → Browser) ---
export interface ActivePlanResponse extends WSMessage { type: 'active_plan'; plan: PlanInfo | null }
export interface PlanApprovedResponse extends WSMessage { type: 'plan_approved_response'; planId: string }
export interface PlanRejectedResponse extends WSMessage { type: 'plan_rejected_response'; planId: string }
export interface PlanModeSetResponse extends WSMessage { type: 'plan_mode_set'; enabled: boolean }

// --- Plan Events (CLI → Browser, async) ---
export interface PlanCreatedEvent extends WSMessage { type: 'plan_created'; plan: PlanInfo }
export interface PlanUpdatedEvent extends WSMessage { type: 'plan_updated'; plan: PlanInfo }
export interface PlanStepUpdatedEvent extends WSMessage { type: 'plan_step_updated'; planId: string; step: PlanStepInfo }

// --- Swarm Requests (Browser → CLI) ---
export interface StartSwarmRequest extends WSMessage { type: 'start_swarm'; message: string }
export interface AbortSwarmRequest extends WSMessage { type: 'abort_swarm'; swarmId: string }
export interface GetSwarmStatusRequest extends WSMessage { type: 'get_swarm_status' }

// --- Swarm Responses (CLI → Browser) ---
export interface SwarmStartedResponse extends WSMessage { type: 'swarm_started'; swarmId: string }
export interface SwarmAbortedResponse extends WSMessage { type: 'swarm_aborted'; swarmId: string }
export interface SwarmStatusResponse extends WSMessage { type: 'swarm_status'; swarm: SwarmInfo | null }

// --- Swarm Events (CLI → Browser, async) ---
export interface SwarmCreatedEvent extends WSMessage { type: 'swarm_created'; swarm: SwarmInfo }
export interface SwarmUpdatedEvent extends WSMessage { type: 'swarm_updated'; swarm: SwarmInfo }
export interface SwarmCompletedEvent extends WSMessage { type: 'swarm_completed'; swarm: SwarmInfo }

// --- Brain Management Requests (Browser → CLI) ---
export interface GetBrainListRequest extends WSMessage { type: 'get_brain_list' }
export interface RenameBrainRequest extends WSMessage { type: 'rename_brain'; brainId: string; newName: string }
export interface SwitchBrainRequest extends WSMessage { type: 'switch_brain'; brainId: string }
export interface CreateBrainRequest extends WSMessage { type: 'create_brain'; name: string; brainType: 'global' | 'local'; projectPath?: string }

// --- Brain Management Responses (CLI → Browser) ---
export interface BrainListResponse extends WSMessage { type: 'brain_list'; brains: BrainInstance[]; limits: BrainLimits }
export interface BrainRenamedResponse extends WSMessage { type: 'brain_renamed'; brainId: string; newName: string }
export interface BrainSwitchedResponse extends WSMessage { type: 'brain_switched'; brainId: string }
export interface BrainCreatedResponse extends WSMessage { type: 'brain_created'; brain: BrainInstance }
export interface BrainLimitReachedEvent extends WSMessage { type: 'brain_limit_reached'; limitType: string; current: number; max: number }

// --- Remote Tool Execution (Server → CLI → Server) ---
export interface RemoteToolCallRequest extends WSMessage { type: 'remote_tool_call'; callId: string; toolName: string; toolInput: Record<string, unknown>; jarvisSessionId: string }
export interface RemoteToolCallResult extends WSMessage { type: 'remote_tool_result'; callId: string; jarvisSessionId: string; success: boolean; result?: string; error?: string }
export interface JarvisResultEvent extends WSMessage { type: 'jarvis_result'; taskId: number; result: string; steps: number }

// --- Tool Permission Approval (CLI ↔ Browser/Telegram) ---
export interface ToolPermissionResponseRequest extends WSMessage { type: 'tool_permission_response'; requestId: string; approved: boolean; mode?: 'once' | 'session' | 'yolo' }
export interface ToolPermissionRequestEvent extends WSMessage { type: 'tool_permission_request'; request: ToolPermissionRequest }
export interface ToolPermissionReminderEvent extends WSMessage { type: 'tool_permission_reminder'; request: ToolPermissionRequest }
export interface ToolPermissionResolvedEvent extends WSMessage { type: 'tool_permission_resolved'; requestId: string; approved: boolean; deniedBy?: 'user' | 'system_timeout' }

// --- Web Chat Events (CLI → Browser, streamed) ---
export interface ChatStartedEvent extends WSMessage { type: 'chat_started'; chatId: string }
export interface ChatTextChunkEvent extends WSMessage { type: 'chat_text_chunk'; chatId: string; text: string }
export interface ChatToolStartEvent extends WSMessage { type: 'chat_tool_start'; chatId: string; stepNum: number; toolName: string; toolInput: Record<string, unknown> }
export interface ChatToolEndEvent extends WSMessage { type: 'chat_tool_end'; chatId: string; stepNum: number; toolName: string; status: 'done' | 'error'; result?: string }
export interface ChatCompleteEvent extends WSMessage { type: 'chat_complete'; chatId: string; text: string; steps: number; tokensUsed: { input: number; output: number } }
export interface ChatErrorEvent extends WSMessage { type: 'chat_error'; chatId: string; error: string }
export interface ChatFileEvent extends WSMessage { type: 'chat_file'; chatId: string; file: { name: string; mimeType: string; sizeBytes: number; dataBase64: string } }

/** All valid control request type strings — derived from the ControlRequest union. */
export const CONTROL_REQUEST_TYPES = new Set<string>([
  'list_sessions', 'start_auto', 'start_security', 'start_monitor', 'stop_monitor',
  'monitor_command', 'approval_response', 'abort_session', 'subscribe_output',
  'unsubscribe_output', 'send_chat', 'get_findings', 'get_bugs', 'ping',
  'start_jarvis', 'stop_jarvis', 'pause_jarvis', 'resume_jarvis',
  'add_jarvis_task', 'list_jarvis_tasks', 'delete_jarvis_task', 'get_jarvis_status',
  'clear_jarvis_completed',
  'list_proposals', 'approve_proposal', 'deny_proposal',
  'set_autonomy_level', 'get_identity', 'trigger_deep_think',
  'add_schedule', 'remove_schedule', 'list_schedules',
  'add_trigger', 'remove_trigger', 'list_triggers',
  'list_projects', 'register_project', 'get_workers',
  'get_brain_list', 'rename_brain', 'switch_brain', 'create_brain',
  'get_config', 'switch_model',
  'remote_tool_result', 'tool_permission_response',
  'get_status_bar', 'list_checkpoints', 'revert_to_checkpoint',
  'brain_sync_push', 'brain_sync_pull', 'license_validate',
  'get_active_plan', 'approve_plan', 'reject_plan', 'set_plan_mode',
  'start_swarm', 'abort_swarm', 'get_swarm_status',
]);

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
  | DeleteJarvisTaskRequest
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
  | GetWorkersRequest
  | GetBrainListRequest
  | RenameBrainRequest
  | SwitchBrainRequest
  | CreateBrainRequest
  | GetConfigRequest
  | SwitchModelRequest
  | RemoteToolCallResult
  | ToolPermissionResponseRequest
  | GetStatusBarRequest
  | ListCheckpointsRequest
  | RevertToCheckpointRequest
  | BrainSyncPushRequest
  | BrainSyncPullRequest
  | LicenseValidateRequest
  | GetActivePlanRequest
  | ApprovePlanRequest
  | RejectPlanRequest
  | SetPlanModeRequest
  | StartSwarmRequest
  | AbortSwarmRequest
  | GetSwarmStatusRequest;

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
  sendChat(text: string, chatId?: string, mode?: 'normal' | 'skip-permissions', files?: ChatFileAttachment[]): void;
  getFindings(): Finding[];
  getBugs(): BugInfo[];
  // Jarvis
  startJarvis(): string | null;              // returns sessionId or null if limit reached
  stopJarvis(): boolean;
  pauseJarvis(): boolean;
  resumeJarvis(): boolean;
  addJarvisTask(title: string, description: string, opts?: { priority?: JarvisTaskPriority; dependencies?: number[]; tags?: string[] }): JarvisTaskInfo;
  listJarvisTasks(): JarvisTaskInfo[];
  deleteJarvisTask(taskId: number): boolean;
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
  // Brain Management
  getBrainList(): { brains: BrainInstance[]; limits: BrainLimits };
  renameBrain(brainId: string, newName: string): boolean;
  switchBrain(brainId: string): boolean;
  createBrain(name: string, brainType: 'global' | 'local', projectPath?: string): BrainInstance | null;
  // Config sharing (local connections only)
  getConfig(): { provider: string; apiKey: string; model: string };
  switchModel(provider: string, model: string): boolean;
  // Tool Permission Approval (remote)
  handleToolPermissionResponse(requestId: string, approved: boolean, mode?: 'once' | 'session' | 'yolo'): void;
  // Status Bar
  getStatusBar(): StatusBarInfo;
  // Checkpoints
  listCheckpoints(): CheckpointInfo[];
  revertToCheckpoint(id: number, mode: 'chat' | 'code' | 'both'): { filesReverted: number; messagesRemoved: number };
  // Plan Mode
  getActivePlan(): PlanInfo | null;
  approvePlan(planId: string): boolean;
  rejectPlan(planId: string, reason: string): boolean;
  setPlanMode(enabled: boolean): boolean;
  // Swarm
  startSwarm(message: string): string;          // returns swarmId
  abortSwarm(swarmId: string): boolean;
  getSwarmStatus(): SwarmInfo | null;
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
    swarmId: session.swarmId,
    swarmTaskId: session.swarmTaskId,
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
  permissionMode: 'safe' | 'skip-permissions' | 'yolo' = 'safe',
): InstanceMeta {
  return {
    instanceId,
    projectName,
    projectPath,
    model,
    provider,
    uptime: Math.floor((Date.now() - instanceStartTime) / 1000),
    version,
    permissionMode,
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
