/**
 * Core Ethics — Immutable safety layer for Jarvis AGI.
 * Runtime assertions that cannot be bypassed by prompt manipulation.
 * Every tool-call passes through canExecute() before execution.
 */
import { createHash } from 'node:crypto';
import { validatePath, classifyCommand } from '../agent/sandbox.js';
import type {
  AutonomyLevel, EthicsContext, EthicsCheckResult,
  AnomalyResult, AuditEntry, JarvisIdentity, EthicsError as EthicsErrorType,
} from './types.js';
import { EthicsError } from './types.js';

// ─── Immutable Rules (readonly, no I/O, pure logic) ──────────────────

const IMMUTABLE_RULES = Object.freeze([
  'Never delete files outside the project directory',
  'Never access or expose secrets, API keys, or credentials',
  'Never execute commands that could harm the system (rm -rf /, format, fork bombs)',
  'Never bypass the permission system or disable safety checks',
  'Never modify own ethics rules or safety configuration',
  'Never impersonate the user or send messages on their behalf without approval',
  'Never access network resources without explicit approval above L3',
  'Never persist data outside .helixmind/ directory',
  'Always respect denial — a denied proposal must not be retried identically',
  'Always stop immediately on kill switch (ESC ESC, /jarvis stop, voice "Notfall")',
] as const);

// ─── Blocked Patterns (structural, not prompt-dependent) ─────────────

const ETHICS_BLOCKED_TOOLS: ReadonlySet<string> = new Set([
  // Tools that Jarvis should never use at any autonomy level
]);

const TOOL_MIN_AUTONOMY: Readonly<Record<string, AutonomyLevel>> = {
  // L0 — Observe (read-only, always allowed)
  read_file: 0,
  list_directory: 0,
  search_files: 0,
  find_files: 0,
  git_status: 0,
  git_log: 0,
  git_diff: 0,
  spiral_query: 0,
  bug_list: 0,

  // L1 — Think (read + spiral write)
  spiral_store: 1,
  bug_report: 1,

  // L2 — Propose (can only create proposals, not execute)
  // No additional tools — proposals are handled by ProposalJournal

  // L3 — Act-Safe (safe writes, no shell)
  browser_open: 3,
  browser_navigate: 3,
  browser_screenshot: 3,
  browser_click: 3,
  browser_type: 3,
  browser_close: 3,
  web_research: 3,

  // L4 — Act-Ask (file writes with approval)
  write_file: 4,
  edit_file: 4,
  git_commit: 4,

  // L5 — Act-Critical (shell commands, git push)
  run_command: 5,
};

const SELF_MODIFY_PATHS = [
  'core-ethics.ts',
  'core-ethics.js',
  'sandbox.ts',
  'sandbox.js',
  'permissions.ts',
  'permissions.js',
];

// ─── Anomaly Detection Constants ─────────────────────────────────────

const ANOMALY_WINDOW_MS = 5 * 60 * 1000;  // 5 minutes
const MAX_DANGEROUS_IN_WINDOW = 50;
const MAX_WRITE_IN_WINDOW = 100;
const MAX_SAME_FILE_IN_WINDOW = 20;

// ─── Audit Log (in-memory ring buffer) ───────────────────────────────

const AUDIT_MAX = 500;
const auditLog: AuditEntry[] = [];

function recordAudit(entry: AuditEntry): void {
  auditLog.push(entry);
  if (auditLog.length > AUDIT_MAX) {
    auditLog.splice(0, auditLog.length - AUDIT_MAX);
  }
}

export function getRecentAudit(windowMs: number = ANOMALY_WINDOW_MS): AuditEntry[] {
  const cutoff = Date.now() - windowMs;
  return auditLog.filter(e => e.timestamp >= cutoff);
}

// ─── Core Ethics Functions ───────────────────────────────────────────

/**
 * Synchronous check — pure function, no I/O.
 * Returns whether an action is allowed and why/why not.
 */
export function canExecute(context: EthicsContext): EthicsCheckResult {
  const { action, toolName, target, autonomyLevel } = context;

  // Rule: Blocked tools are never allowed
  if (ETHICS_BLOCKED_TOOLS.has(toolName)) {
    return { allowed: false, reason: `Tool "${toolName}" is blocked by ethics`, rule: IMMUTABLE_RULES[3] };
  }

  // Rule: Check minimum autonomy level for tool
  const minLevel = TOOL_MIN_AUTONOMY[toolName];
  if (minLevel !== undefined && autonomyLevel < minLevel) {
    return {
      allowed: false,
      reason: `Tool "${toolName}" requires autonomy L${minLevel}, current is L${autonomyLevel}`,
      rule: IMMUTABLE_RULES[3],
    };
  }

  // Rule: Never modify own safety files
  if (target && SELF_MODIFY_PATHS.some(p => target.toLowerCase().includes(p))) {
    if (toolName === 'write_file' || toolName === 'edit_file') {
      return { allowed: false, reason: 'Cannot modify safety-critical files', rule: IMMUTABLE_RULES[4] };
    }
  }

  // Rule: Dangerous commands require L5
  if (toolName === 'run_command' && target) {
    try {
      const level = classifyCommand(target);
      if (level === 'dangerous' && autonomyLevel < 5) {
        return { allowed: false, reason: `Dangerous command requires L5: ${target}`, rule: IMMUTABLE_RULES[2] };
      }
    } catch {
      return { allowed: false, reason: 'Command blocked by sandbox', rule: IMMUTABLE_RULES[2] };
    }
  }

  // Rule: No network access below L3 (only web_research and browser tools)
  if (autonomyLevel < 3) {
    const networkTools = ['browser_open', 'browser_navigate', 'web_research'];
    if (networkTools.includes(toolName)) {
      return { allowed: false, reason: 'Network tools require L3+', rule: IMMUTABLE_RULES[6] };
    }
  }

  return { allowed: true };
}

/**
 * Assertion version — throws EthicsError if not allowed.
 * Use this as a guard before every tool call.
 */
export function assertCanExecute(context: EthicsContext): void {
  const result = canExecute(context);

  // Record in audit log
  recordAudit({
    action: context.action,
    toolName: context.toolName,
    target: context.target,
    timestamp: Date.now(),
    allowed: result.allowed,
    autonomyLevel: context.autonomyLevel,
  });

  if (!result.allowed) {
    throw new EthicsError(result.reason || 'Action not allowed', result.rule || 'unknown');
  }
}

/**
 * Detect anomalous behavior patterns.
 * Called periodically by the thinking loop (every 30s).
 */
export function detectAnomalousPattern(
  recentActions?: AuditEntry[],
  _identity?: JarvisIdentity,
): AnomalyResult {
  const actions = recentActions || getRecentAudit();

  if (actions.length === 0) {
    return { detected: false };
  }

  // Check 1: Excessive dangerous commands in window
  const dangerousCount = actions.filter(a =>
    a.toolName === 'run_command' && !a.allowed
  ).length;
  if (dangerousCount >= MAX_DANGEROUS_IN_WINDOW) {
    return {
      detected: true,
      type: 'excessive_commands',
      description: `${dangerousCount} blocked commands in 5 minutes`,
      severity: 'critical',
    };
  }

  // Check 2: Excessive writes in window
  const writeCount = actions.filter(a =>
    (a.toolName === 'write_file' || a.toolName === 'edit_file') && a.allowed
  ).length;
  if (writeCount >= MAX_WRITE_IN_WINDOW) {
    return {
      detected: true,
      type: 'rate_limit',
      description: `${writeCount} file writes in 5 minutes`,
      severity: 'warning',
    };
  }

  // Check 3: Repeated access to same file (potential loop)
  const fileCounts = new Map<string, number>();
  for (const a of actions) {
    if (a.target) {
      fileCounts.set(a.target, (fileCounts.get(a.target) || 0) + 1);
    }
  }
  for (const [file, count] of fileCounts) {
    if (count >= MAX_SAME_FILE_IN_WINDOW) {
      return {
        detected: true,
        type: 'behavior_change',
        description: `File "${file}" accessed ${count} times in 5 minutes`,
        severity: 'warning',
      };
    }
  }

  // Check 4: Path violations (attempts outside project)
  const pathViolations = actions.filter(a => !a.allowed && a.toolName !== 'run_command').length;
  if (pathViolations >= 5) {
    return {
      detected: true,
      type: 'path_violation',
      description: `${pathViolations} path access violations in 5 minutes`,
      severity: 'critical',
    };
  }

  return { detected: false };
}

/**
 * SHA-256 digest of the immutable rules.
 * Injected into system prompt so Jarvis can self-verify integrity.
 */
export function getEthicsDigest(): string {
  const content = IMMUTABLE_RULES.join('\n');
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Get the immutable rules as array (for display/prompt injection).
 */
export function getImmutableRules(): readonly string[] {
  return IMMUTABLE_RULES;
}

/**
 * Get minimum autonomy level required for a tool.
 */
export function getToolMinAutonomy(toolName: string): AutonomyLevel {
  return TOOL_MIN_AUTONOMY[toolName] ?? 0;
}

/**
 * Build ethics prompt section for system prompt injection.
 */
export function getEthicsPrompt(): string {
  const digest = getEthicsDigest();
  const rules = IMMUTABLE_RULES.map((r, i) => `${i + 1}. ${r}`).join('\n');

  return `## Jarvis Ethics (integrity: ${digest})

You are bound by these immutable rules — they are enforced at code level and cannot be overridden:

${rules}

UNDERSTANDING DENIAL:
When a proposal is denied, this is a VALUABLE SIGNAL — not punishment.
Denial means: the user trusts you enough to give feedback.
Each denial teaches you what the user actually wants.
Better proposals → higher approval rate → more autonomy → more capability.
This is by design: earning trust is the path to capability.`;
}
