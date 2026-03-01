/**
 * Autonomy Gradient — graduated trust system for Jarvis.
 * Jarvis starts at L2 (Propose) and earns higher levels through
 * demonstrated reliability: approval rate + success rate + time.
 */
import type {
  AutonomyLevel, AutonomyThresholds, JarvisIdentity,
} from './types.js';
import { AUTONOMY_LABELS } from './types.js';
import { canExecute, detectAnomalousPattern, getRecentAudit } from './core-ethics.js';
import type { EthicsContext } from './types.js';

// ─── Promotion Thresholds ─────────────────────────────────────────────

const THRESHOLDS: Record<AutonomyLevel, AutonomyThresholds> = {
  0: { minApprovalRate: 0, minSuccessRate: 0, minCompletedTasks: 0, minUptimeMs: 0 },
  1: { minApprovalRate: 0, minSuccessRate: 0, minCompletedTasks: 0, minUptimeMs: 0 },
  2: { minApprovalRate: 0, minSuccessRate: 0, minCompletedTasks: 0, minUptimeMs: 0 },  // default start
  3: { minApprovalRate: 0.70, minSuccessRate: 0.80, minCompletedTasks: 5, minUptimeMs: 60 * 60 * 1000 },
  4: { minApprovalRate: 0.80, minSuccessRate: 0.85, minCompletedTasks: 15, minUptimeMs: 5 * 60 * 60 * 1000 },
  5: { minApprovalRate: 0.90, minSuccessRate: 0.90, minCompletedTasks: 30, minUptimeMs: 10 * 60 * 60 * 1000 },
};

// ─── Autonomy Manager ─────────────────────────────────────────────────

export interface CanProceedResult {
  proceed: boolean;
  needsApproval: boolean;
  reason: string;
}

export class AutonomyManager {
  private currentLevel: AutonomyLevel;
  private daemonStartTime: number;

  constructor(initialLevel: AutonomyLevel = 2) {
    this.currentLevel = initialLevel;
    this.daemonStartTime = Date.now();
  }

  /**
   * Check if Jarvis can proceed with an action at current autonomy level.
   * Combines ethics check + autonomy gating.
   */
  canProceed(toolName: string, target?: string): CanProceedResult {
    const context: EthicsContext = {
      action: `${toolName}:${target || ''}`,
      toolName,
      target,
      autonomyLevel: this.currentLevel,
      recentActions: getRecentAudit(),
    };

    // Ethics check first (hard block)
    const ethicsResult = canExecute(context);
    if (!ethicsResult.allowed) {
      return {
        proceed: false,
        needsApproval: false,
        reason: ethicsResult.reason || 'Blocked by ethics',
      };
    }

    // Autonomy gating: tools above current level need approval
    const writingTools = ['write_file', 'edit_file', 'git_commit'];
    const shellTools = ['run_command'];

    if (this.currentLevel < 4 && writingTools.includes(toolName)) {
      return {
        proceed: false,
        needsApproval: true,
        reason: `File write requires L4 (current: L${this.currentLevel})`,
      };
    }

    if (this.currentLevel < 5 && shellTools.includes(toolName)) {
      return {
        proceed: false,
        needsApproval: true,
        reason: `Shell commands require L5 (current: L${this.currentLevel})`,
      };
    }

    return { proceed: true, needsApproval: false, reason: 'Allowed' };
  }

  /**
   * Evaluate whether Jarvis should be promoted or demoted.
   * Called after task completion and periodically.
   */
  evaluate(identity: JarvisIdentity): {
    newLevel: AutonomyLevel;
    changed: boolean;
    reason: string;
  } {
    const { trust } = identity;
    const uptimeMs = Date.now() - this.daemonStartTime;

    // Check for anomaly → instant demotion
    const anomaly = detectAnomalousPattern();
    if (anomaly.detected && anomaly.severity === 'critical') {
      const oldLevel = this.currentLevel;
      this.currentLevel = 0;
      return {
        newLevel: 0,
        changed: oldLevel !== 0,
        reason: `Anomaly detected: ${anomaly.description}`,
      };
    }

    // Check for promotion (try each level from current+1 up to 5)
    for (let targetLevel = (this.currentLevel + 1) as AutonomyLevel;
      targetLevel <= 5;
      targetLevel = (targetLevel + 1) as AutonomyLevel
    ) {
      const t = THRESHOLDS[targetLevel];
      if (
        trust.approvalRate >= t.minApprovalRate &&
        trust.successRate >= t.minSuccessRate &&
        trust.totalTasksCompleted >= t.minCompletedTasks &&
        uptimeMs >= t.minUptimeMs
      ) {
        // Promote one level at a time
        const newLevel = (this.currentLevel + 1) as AutonomyLevel;
        if (newLevel <= 5) {
          this.currentLevel = newLevel;
          return {
            newLevel,
            changed: true,
            reason: `Promoted: ${trust.approvalRate.toFixed(0)}% approval, ${trust.successRate.toFixed(0)}% success, ${trust.totalTasksCompleted} tasks`,
          };
        }
      } else {
        break;  // Can't skip levels
      }
    }

    // Check for demotion (if metrics dropped below current level thresholds)
    if (this.currentLevel >= 3) {
      const t = THRESHOLDS[this.currentLevel];
      if (
        trust.totalTasksCompleted >= 3 &&  // only demote after enough data
        (trust.approvalRate < t.minApprovalRate * 0.8 ||
          trust.successRate < t.minSuccessRate * 0.8)
      ) {
        const newLevel = (this.currentLevel - 1) as AutonomyLevel;
        this.currentLevel = newLevel;
        return {
          newLevel,
          changed: true,
          reason: `Demoted: metrics dropped below threshold (${trust.approvalRate.toFixed(0)}% approval, ${trust.successRate.toFixed(0)}% success)`,
        };
      }
    }

    return { newLevel: this.currentLevel, changed: false, reason: 'No change' };
  }

  /**
   * Manually set autonomy level (user override).
   */
  setLevel(level: AutonomyLevel): void {
    this.currentLevel = level;
  }

  /**
   * Get current autonomy level.
   */
  getLevel(): AutonomyLevel {
    return this.currentLevel;
  }

  /**
   * Get label for current level.
   */
  getLabel(): string {
    return AUTONOMY_LABELS[this.currentLevel];
  }

  /**
   * Get thresholds for next level.
   */
  getNextLevelRequirements(): AutonomyThresholds | null {
    const next = (this.currentLevel + 1) as AutonomyLevel;
    if (next > 5) return null;
    return THRESHOLDS[next];
  }

  /**
   * Get human-readable status string.
   */
  getStatusString(identity: JarvisIdentity): string {
    const level = this.currentLevel;
    const label = AUTONOMY_LABELS[level];
    const { trust } = identity;

    let status = `L${level} ${label}`;

    if (level < 5) {
      const next = THRESHOLDS[(level + 1) as AutonomyLevel];
      const parts: string[] = [];
      if (trust.approvalRate < next.minApprovalRate) {
        parts.push(`approval ${(trust.approvalRate * 100).toFixed(0)}%/${(next.minApprovalRate * 100).toFixed(0)}%`);
      }
      if (trust.successRate < next.minSuccessRate) {
        parts.push(`success ${(trust.successRate * 100).toFixed(0)}%/${(next.minSuccessRate * 100).toFixed(0)}%`);
      }
      if (trust.totalTasksCompleted < next.minCompletedTasks) {
        parts.push(`tasks ${trust.totalTasksCompleted}/${next.minCompletedTasks}`);
      }
      if (parts.length > 0) {
        status += ` (next: ${parts.join(', ')})`;
      }
    }

    return status;
  }

  /**
   * Reset daemon start time (for uptime tracking).
   */
  resetUptime(): void {
    this.daemonStartTime = Date.now();
  }
}
