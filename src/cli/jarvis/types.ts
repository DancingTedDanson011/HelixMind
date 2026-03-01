// ─── Existing Task Types ──────────────────────────────────────────────

export type JarvisTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';
export type JarvisTaskPriority = 'high' | 'medium' | 'low';
export type JarvisDaemonState = 'stopped' | 'running' | 'paused';

export interface JarvisTask {
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

export interface JarvisQueueData {
  version: 1;
  nextId: number;
  tasks: JarvisTask[];
  daemonState: JarvisDaemonState;
  lastRunAt?: number;
}

export interface JarvisStatusInfo {
  daemonState: JarvisDaemonState;
  currentTaskId: number | null;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  totalCount: number;
  uptimeMs: number;
  autonomyLevel?: AutonomyLevel;
  thinkingPhase?: ThinkingPhase;
  activeWorkers?: number;
}

// ─── Autonomy ─────────────────────────────────────────────────────────

/** 0=Observe, 1=Think, 2=Propose, 3=Act-Safe, 4=Act-Ask, 5=Act-Critical */
export type AutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  0: 'Observe',
  1: 'Think',
  2: 'Propose',
  3: 'Act-Safe',
  4: 'Act-Ask',
  5: 'Act-Critical',
};

export interface AutonomyThresholds {
  minApprovalRate: number;
  minSuccessRate: number;
  minCompletedTasks: number;
  minUptimeMs: number;
}

// ─── Proposals ────────────────────────────────────────────────────────

export type ProposalStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'superseded';
export type ProposalCategory =
  | 'bugfix' | 'refactor' | 'test' | 'dependency' | 'security'
  | 'performance' | 'documentation' | 'feature' | 'cleanup' | 'review'
  | 'infrastructure' | 'style' | 'meta';

export type ProposalSource =
  | 'thinking_quick' | 'thinking_medium' | 'thinking_deep'
  | 'trigger' | 'schedule' | 'user_request' | 'self_improvement';

export interface ProposalEvidence {
  type: 'code_snippet' | 'test_result' | 'git_diff' | 'metric' | 'observation';
  content: string;
  timestamp: number;
}

export interface ProposalEntry {
  id: number;
  title: string;
  description: string;
  rationale: string;
  category: ProposalCategory;
  source: ProposalSource;
  status: ProposalStatus;
  impact: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  affectedFiles: string[];
  evidence: ProposalEvidence[];
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  denialReason?: string;
  convertedTaskId?: number;
}

export interface ProposalJournalData {
  version: 1;
  nextId: number;
  proposals: ProposalEntry[];
  denialPatterns: DenialPattern[];
}

export interface DenialPattern {
  category: ProposalCategory;
  filePatterns: string[];
  reason: string;
  count: number;
  lastDeniedAt: number;
}

// ─── Thinking ─────────────────────────────────────────────────────────

export type ThinkingPhase = 'idle' | 'quick' | 'medium' | 'deep';

export interface ThinkingState {
  phase: ThinkingPhase;
  lastQuickCheck: number;
  lastMediumCheck: number;
  lastDeepCheck: number;
  observations: Observation[];
  currentThought?: string;
}

export interface Observation {
  id: string;
  type: 'git_change' | 'test_failure' | 'bug_detected' | 'dependency_issue'
    | 'file_change' | 'performance_change' | 'pattern_detected' | 'schedule_due'
    | 'trigger_fired' | 'health_change' | 'stale_branch' | 'coverage_drop';
  summary: string;
  details?: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  handled: boolean;
}

export interface ThinkingCallbacks {
  sendMessage: (prompt: string) => Promise<string>;
  isAborted: () => boolean;
  isPaused: () => boolean;
  querySpiral: (query: string, maxTokens?: number) => Promise<string>;
  storeInSpiral: (content: string, type: string, tags: string[]) => Promise<void>;
  createProposal: (title: string, description: string, rationale: string, opts: Partial<ProposalEntry>) => ProposalEntry;
  wouldLikelyBeDenied: (category: ProposalCategory, files: string[]) => boolean;
  getIdentity: () => JarvisIdentity;
  updateIdentity: (event: IdentityEvent) => void;
  pushEvent: (type: string, payload: Record<string, unknown>) => void;
  captureProjectState: () => Promise<ProjectModel>;
  getScheduledTasks: () => ScheduleEntry[];
  checkTriggers: (delta: ProjectDelta) => TriggerResult[];
  updateStatus: () => void;
}

// ─── Identity ─────────────────────────────────────────────────────────

export interface IdentityTraits {
  confidence: number;   // 0.0-1.0
  caution: number;      // 0.0-1.0
  proactivity: number;  // 0.0-1.0
  verbosity: number;    // 0.0-1.0
  creativity: number;   // 0.0-1.0
}

export interface TrustMetrics {
  approvalRate: number;       // 0.0-1.0
  successRate: number;        // 0.0-1.0
  totalProposals: number;
  totalApproved: number;
  totalDenied: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  autonomyHistory: { level: AutonomyLevel; timestamp: number; reason: string }[];
}

export type IdentityEvent =
  | { type: 'proposal_approved'; proposalId: number }
  | { type: 'proposal_denied'; proposalId: number; reason: string }
  | { type: 'task_completed'; taskId: number; summary: string }
  | { type: 'task_failed'; taskId: number; error: string }
  | { type: 'autonomy_changed'; oldLevel: AutonomyLevel; newLevel: AutonomyLevel; reason: string }
  | { type: 'anomaly_detected'; description: string }
  | { type: 'meta_learning'; insight: string };

export interface JarvisIdentity {
  name: string;
  traits: IdentityTraits;
  trust: TrustMetrics;
  autonomyLevel: AutonomyLevel;
  recentLearnings: { content: string; timestamp: number; source: string }[];
  strengths: string[];
  weaknesses: string[];
  createdAt: number;
  lastEvolvedAt: number;
}

export interface JarvisIdentityData {
  version: 1;
  identity: JarvisIdentity;
}

// ─── World Model ──────────────────────────────────────────────────────

export interface ProjectModel {
  name: string;
  path: string;
  gitBranch: string;
  gitStatus: { modified: number; untracked: number; staged: number };
  openBugs: number;
  testStatus: { total: number; passing: number; failing: number; lastRunAt: number } | null;
  health: number;  // 0-100
  lastScannedAt: number;
}

export interface ProjectDelta {
  filesChanged: string[];
  newCommits: number;
  bugsChanged: boolean;
  testsChanged: boolean;
  depsChanged: boolean;
  branchChanged: boolean;
}

export interface UserModel {
  preferredCategories: Record<ProposalCategory, number>;  // approval rate per category
  activeHours: number[];       // hours of day when user is active (0-23)
  communicationStyle: 'concise' | 'detailed';
  lastActiveAt: number;
}

export interface WorldModel {
  projects: ProjectModel[];
  user: UserModel;
  lastUpdatedAt: number;
}

// ─── Ethics ───────────────────────────────────────────────────────────

export interface EthicsContext {
  action: string;
  toolName: string;
  target?: string;
  autonomyLevel: AutonomyLevel;
  recentActions: AuditEntry[];
}

export interface EthicsCheckResult {
  allowed: boolean;
  reason?: string;
  rule?: string;
}

export interface AnomalyResult {
  detected: boolean;
  type?: 'excessive_commands' | 'path_violation' | 'behavior_change' | 'rate_limit';
  description?: string;
  severity?: 'warning' | 'critical';
}

export interface AuditEntry {
  action: string;
  toolName: string;
  target?: string;
  timestamp: number;
  allowed: boolean;
  autonomyLevel: AutonomyLevel;
}

export class EthicsError extends Error {
  public readonly rule: string;
  constructor(message: string, rule: string) {
    super(message);
    this.name = 'EthicsError';
    this.rule = rule;
  }
}

// ─── Scheduling ───────────────────────────────────────────────────────

export type ScheduleType = 'cron' | 'interval' | 'once';

export interface ScheduleEntry {
  id: number;
  type: ScheduleType;
  expression: string;    // cron string or interval ms
  taskTitle: string;
  taskDescription: string;
  priority: JarvisTaskPriority;
  enabled: boolean;
  lastFiredAt?: number;
  nextFireAt?: number;
  createdAt: number;
}

export interface SchedulerData {
  version: 1;
  nextId: number;
  schedules: ScheduleEntry[];
}

// ─── Triggers ─────────────────────────────────────────────────────────

export type TriggerSource = 'git_hook' | 'file_watch' | 'ci' | 'webhook' | 'time';

export interface TriggerConfig {
  id: number;
  source: TriggerSource;
  name: string;
  pattern: string;       // glob for file_watch, URL for ci, event name for git_hook
  action: string;        // what to do: 'propose', 'task', 'notify'
  taskTemplate?: { title: string; description: string; priority: JarvisTaskPriority };
  enabled: boolean;
  lastFiredAt?: number;
  fireCount: number;
  createdAt: number;
}

export interface TriggerResult {
  triggerId: number;
  source: TriggerSource;
  name: string;
  context: string;
  timestamp: number;
}

export interface TriggerData {
  version: 1;
  nextId: number;
  triggers: TriggerConfig[];
}

// ─── Notifications ────────────────────────────────────────────────────

export type NotificationChannel = 'browser' | 'email' | 'slack' | 'webhook' | 'system';
export type NotificationUrgency = 'info' | 'important' | 'critical';

export interface NotificationTarget {
  channel: NotificationChannel;
  enabled: boolean;
  config: Record<string, string>;  // email: {address}, slack: {webhookUrl}, webhook: {url}
}

export interface NotificationConfig {
  targets: NotificationTarget[];
  minUrgency: NotificationUrgency;  // only send if urgency >= this
}

// ─── Parallel Execution ──────────────────────────────────────────────

export interface TaskWorkerState {
  workerId: number;
  taskId: number;
  taskTitle: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  progress?: string;
}

export interface ParallelConfig {
  maxWorkers: number;
  maxConcurrentLLMCalls: number;
}

// ─── Voice ────────────────────────────────────────────────────────────

export type VoiceIntentType =
  | 'approve_proposal' | 'deny_proposal' | 'add_task'
  | 'start_jarvis' | 'stop_jarvis' | 'pause_jarvis' | 'resume_jarvis'
  | 'emergency_stop' | 'query' | 'think_deep' | 'unknown';

export interface VoiceIntent {
  type: VoiceIntentType;
  confidence: number;    // 0.0-1.0
  params: Record<string, string | number>;
  rawText: string;
}

export interface TTSConfig {
  provider: 'elevenlabs' | 'web_speech';
  apiKey?: string;
  voiceId?: string;
  enabled: boolean;
}

// ─── Multi-Project ────────────────────────────────────────────────────

export interface RegisteredProject {
  name: string;
  path: string;
  addedAt: number;
  lastScannedAt: number;
  health: number;
}

export interface MultiProjectData {
  version: 1;
  projects: RegisteredProject[];
}

// ─── Capabilities ─────────────────────────────────────────────────────

export type JarvisCapability =
  | 'thinking' | 'proposals' | 'identity' | 'autonomy'
  | 'scheduling' | 'triggers' | 'notifications' | 'parallel'
  | 'tts' | 'multi_project' | 'voice' | 'code_review'
  | 'dependency_guard' | 'test_sentinel' | 'git_intelligence'
  | 'performance_profiler';

export interface CapabilityStatus {
  capability: JarvisCapability;
  enabled: boolean;
  status: 'active' | 'inactive' | 'error';
  details?: string;
}

// ─── WebSocket Events ─────────────────────────────────────────────────

export interface ThinkingUpdateEvent {
  phase: ThinkingPhase;
  observation?: string;
  currentThought?: string;
  timestamp: number;
}

export interface ConsciousnessEvent {
  type: 'thought' | 'insight' | 'self_assessment' | 'meta_learning';
  content: string;
  depth: ThinkingPhase;
  timestamp: number;
}

export interface JarvisLearningEvent {
  topic: string;
  content: string;
  spiralLevel: number;
  tags: string[];
  sourcePhase: ThinkingPhase;
}

export interface IdentityChangedEvent {
  trait: keyof IdentityTraits;
  oldValue: number;
  newValue: number;
  reason: string;
}

export interface AutonomyChangedEvent {
  oldLevel: AutonomyLevel;
  newLevel: AutonomyLevel;
  reason: string;
}

export interface NeuronFiredEvent {
  fromOrbit: 'green' | 'yellow';
  trigger: 'thinking' | 'proposal' | 'learning';
  count: number;
}
