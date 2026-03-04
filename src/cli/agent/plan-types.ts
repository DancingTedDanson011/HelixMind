/**
 * Plan Mode Types & Agent Identity definitions.
 *
 * Plan Mode lets the agent first explore (read-only), then present a structured
 * plan, then execute step-by-step after user approval.
 *
 * Agent Identities provide colored @names for all agents/sessions.
 */

// ---------------------------------------------------------------------------
// Plan Step & Execution Plan
// ---------------------------------------------------------------------------

export type PlanStepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export interface PlanStep {
  id: number;
  title: string;
  description: string;
  tools: string[];           // predicted tools for this step
  affectedFiles: string[];
  dependencies: number[];    // step IDs that must complete first
  status: PlanStepStatus;
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export type PlanStatus =
  | 'drafting'
  | 'pending_approval'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'modified';

export interface ExecutionPlan {
  id: string;               // UUID
  title: string;
  description: string;
  steps: PlanStep[];
  status: PlanStatus;
  source: 'user_plan_mode' | 'jarvis_proposal' | 'auto_complex';
  createdAt: number;
  approvedAt?: number;
  completedAt?: number;
  rejectionReason?: string;
  totalStepsCompleted: number;
  totalStepsFailed: number;
  proposalId?: number;      // link to Jarvis Proposal if converted
}

export type PlanModeState = 'off' | 'planning' | 'reviewing' | 'executing';

// ---------------------------------------------------------------------------
// Read-only tool whitelist for plan mode
// ---------------------------------------------------------------------------

export const PLAN_MODE_TOOLS = new Set([
  'read_file',
  'list_directory',
  'search_files',
  'find_files',
  'git_status',
  'git_log',
  'git_diff',
  'spiral_query',
  'bug_list',
]);

// ---------------------------------------------------------------------------
// Agent Identity — colored @names for all agents/sessions
// ---------------------------------------------------------------------------

export interface AgentIdentity {
  name: string;           // "@main", "@jarvis", "@security"
  displayName: string;    // "HelixMind", "JARVIS", "Security"
  color: string;          // hex color for chalk
  icon: string;           // emoji prefix
}

export const AGENT_IDENTITIES: Record<string, AgentIdentity> = {
  main:     { name: '@main',     displayName: 'HelixMind', color: '#00d4ff', icon: '\u{1F4AC}' },
  jarvis:   { name: '@jarvis',   displayName: 'JARVIS',    color: '#8a2be2', icon: '\u{1F916}' },
  security: { name: '@security', displayName: 'Security',  color: '#ff4444', icon: '\u{1F512}' },
  auto:     { name: '@auto',     displayName: 'Auto',      color: '#00ff88', icon: '\u{1F504}' },
  monitor:  { name: '@monitor',  displayName: 'Monitor',   color: '#ff6600', icon: '\u{1F6E1}' },
  swarm:    { name: '@swarm',    displayName: 'Swarm',     color: '#ffd700', icon: '\u{1F41D}' },
};

/** Colors for swarm worker identities (cycled for workers 1-N) */
const WORKER_COLORS = ['#00d4ff', '#ff6b9d', '#00ff88', '#ffd700', '#c084fc', '#f97316'];

/** Resolve a session name to its AgentIdentity (case-insensitive, partial match) */
export function resolveAgentIdentity(sessionName: string): AgentIdentity | undefined {
  const lower = sessionName.toLowerCase();
  // Direct key match
  if (AGENT_IDENTITIES[lower]) return AGENT_IDENTITIES[lower];
  // Dynamic worker-N match: "Worker-1", "worker-3", "Worker 2"
  const workerMatch = lower.match(/worker[- ]?(\d+)/);
  if (workerMatch) {
    const idx = parseInt(workerMatch[1], 10) - 1;
    return {
      name: `@worker-${idx + 1}`,
      displayName: `Worker-${idx + 1}`,
      color: WORKER_COLORS[idx % WORKER_COLORS.length],
      icon: '\u{1F41D}',
    };
  }
  // Partial match: "Security Audit" → security, "Auto: fix lint" → auto
  for (const [key, identity] of Object.entries(AGENT_IDENTITIES)) {
    if (lower.includes(key) || lower.includes(identity.displayName.toLowerCase())) {
      return identity;
    }
  }
  return undefined;
}
