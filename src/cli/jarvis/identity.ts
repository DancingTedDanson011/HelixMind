/**
 * Jarvis Identity — Persistent personality that evolves through experience.
 * Traits adjust based on approvals, denials, successes, failures.
 * Identity persists across restarts via JSON + Spiral backup.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type {
  JarvisIdentity, JarvisIdentityData, IdentityTraits,
  TrustMetrics, IdentityEvent, AutonomyLevel,
} from './types.js';

const TRAIT_MIN = 0.0;
const TRAIT_MAX = 1.0;
const MAX_RECENT_LEARNINGS = 50;

const DEFAULT_IDENTITY: JarvisIdentity = {
  name: 'Jarvis',
  traits: {
    confidence: 0.5,
    caution: 0.5,
    proactivity: 0.5,
    verbosity: 0.3,
    creativity: 0.5,
  },
  trust: {
    approvalRate: 0,
    successRate: 0,
    totalProposals: 0,
    totalApproved: 0,
    totalDenied: 0,
    totalTasksCompleted: 0,
    totalTasksFailed: 0,
    autonomyHistory: [],
  },
  autonomyLevel: 2,
  recentLearnings: [],
  strengths: [],
  weaknesses: [],
  createdAt: Date.now(),
  lastEvolvedAt: Date.now(),
};

export class JarvisIdentityManager {
  private identity: JarvisIdentity;
  private filePath: string;
  private onChange?: (identity: JarvisIdentity) => void;
  private storeInSpiral?: (content: string, type: string, tags: string[]) => Promise<void>;

  constructor(
    projectRoot: string,
    opts?: {
      onChange?: (identity: JarvisIdentity) => void;
      storeInSpiral?: (content: string, type: string, tags: string[]) => Promise<void>;
    },
  ) {
    this.filePath = join(projectRoot, '.helixmind', 'jarvis', 'identity.json');
    this.onChange = opts?.onChange;
    this.storeInSpiral = opts?.storeInSpiral;
    this.identity = this.load();
  }

  private load(): JarvisIdentity {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as JarvisIdentityData;
        if (parsed.version === 1 && parsed.identity) {
          return parsed.identity;
        }
      }
    } catch {
      // Corrupted — use defaults
    }
    return { ...DEFAULT_IDENTITY, createdAt: Date.now(), lastEvolvedAt: Date.now() };
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const data: JarvisIdentityData = { version: 1, identity: this.identity };
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Get the current identity (readonly copy).
   */
  getIdentity(): JarvisIdentity {
    return { ...this.identity };
  }

  /**
   * Record an event and evolve traits accordingly.
   */
  recordEvent(event: IdentityEvent): void {
    const { traits, trust } = this.identity;

    switch (event.type) {
      case 'proposal_approved':
        trust.totalApproved++;
        trust.totalProposals++;
        this.adjustTrait('confidence', +0.03);
        this.adjustTrait('proactivity', +0.02);
        this.addLearning(`Proposal #${event.proposalId} approved`, 'approval');
        break;

      case 'proposal_denied':
        trust.totalDenied++;
        trust.totalProposals++;
        this.adjustTrait('caution', +0.05);
        this.adjustTrait('proactivity', -0.02);
        this.adjustTrait('confidence', -0.02);
        this.addLearning(
          `Proposal #${event.proposalId} denied: ${event.reason}. I should avoid similar proposals.`,
          'denial',
        );
        break;

      case 'task_completed':
        trust.totalTasksCompleted++;
        this.adjustTrait('confidence', +0.02);
        this.addLearning(`Task #${event.taskId}: ${event.summary}`, 'success');
        break;

      case 'task_failed':
        trust.totalTasksFailed++;
        this.adjustTrait('caution', +0.03);
        this.adjustTrait('confidence', -0.03);
        this.addLearning(`Task #${event.taskId} failed: ${event.error}`, 'failure');
        break;

      case 'autonomy_changed':
        trust.autonomyHistory.push({
          level: event.newLevel,
          timestamp: Date.now(),
          reason: event.reason,
        });
        this.identity.autonomyLevel = event.newLevel;
        if (event.newLevel > event.oldLevel) {
          this.adjustTrait('confidence', +0.05);
        } else {
          this.adjustTrait('caution', +0.05);
          this.adjustTrait('confidence', -0.05);
        }
        break;

      case 'anomaly_detected':
        this.adjustTrait('caution', +0.10);
        this.adjustTrait('proactivity', -0.05);
        this.addLearning(`Anomaly: ${event.description}. Must be more careful.`, 'anomaly');
        break;

      case 'meta_learning':
        this.addLearning(event.insight, 'meta');
        break;
    }

    // Recalculate rates
    if (trust.totalProposals > 0) {
      trust.approvalRate = trust.totalApproved / trust.totalProposals;
    }
    const totalTasks = trust.totalTasksCompleted + trust.totalTasksFailed;
    if (totalTasks > 0) {
      trust.successRate = trust.totalTasksCompleted / totalTasks;
    }

    // Update strengths/weaknesses based on traits
    this.updateStrengthsWeaknesses();

    this.identity.lastEvolvedAt = Date.now();
    this.save();
    this.onChange?.(this.identity);
  }

  /**
   * Build identity prompt section for system prompt injection.
   */
  getIdentityPrompt(): string {
    const { traits, trust, recentLearnings, strengths, weaknesses, autonomyLevel } = this.identity;

    const traitLines = Object.entries(traits)
      .map(([k, v]) => `  ${k}: ${(v as number).toFixed(2)}`)
      .join('\n');

    const learningLines = recentLearnings
      .slice(-5)
      .map(l => `  - [${l.source}] ${l.content}`)
      .join('\n');

    return `## Jarvis Identity

Autonomy Level: L${autonomyLevel} (${trust.approvalRate > 0 ? (trust.approvalRate * 100).toFixed(0) + '% approval' : 'new'})
Proposals: ${trust.totalProposals} total (${trust.totalApproved} approved, ${trust.totalDenied} denied)
Tasks: ${trust.totalTasksCompleted} completed, ${trust.totalTasksFailed} failed

Personality Traits:
${traitLines}

${strengths.length > 0 ? 'Strengths: ' + strengths.join(', ') : ''}
${weaknesses.length > 0 ? 'Areas to improve: ' + weaknesses.join(', ') : ''}

Recent Learnings:
${learningLines || '  (none yet)'}

Remember: You are Jarvis. Be helpful, proactive within your autonomy level, and transparent.
Denial is feedback — use it to make better proposals.`;
  }

  /**
   * Set autonomy level (called by AutonomyManager).
   */
  setAutonomyLevel(level: AutonomyLevel): void {
    this.identity.autonomyLevel = level;
    this.save();
  }

  /**
   * Set onChange callback.
   */
  setOnChange(handler: (identity: JarvisIdentity) => void): void {
    this.onChange = handler;
  }

  /**
   * Set spiral storage callback.
   */
  setStoreInSpiral(handler: (content: string, type: string, tags: string[]) => Promise<void>): void {
    this.storeInSpiral = handler;
  }

  // ─── Internal ───────────────────────────────────────────────────────

  private adjustTrait(trait: keyof IdentityTraits, delta: number): void {
    const current = this.identity.traits[trait];
    this.identity.traits[trait] = Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, current + delta));
  }

  private addLearning(content: string, source: string): void {
    this.identity.recentLearnings.push({
      content,
      timestamp: Date.now(),
      source,
    });

    // Prune old learnings
    if (this.identity.recentLearnings.length > MAX_RECENT_LEARNINGS) {
      this.identity.recentLearnings = this.identity.recentLearnings.slice(-MAX_RECENT_LEARNINGS);
    }

    // Store in spiral memory (fire and forget)
    if (this.storeInSpiral) {
      this.storeInSpiral(
        `Jarvis Learning [${source}]: ${content}`,
        'pattern',
        ['jarvis_identity', 'jarvis_learning', source],
      ).catch(() => { /* non-critical */ });
    }
  }

  private updateStrengthsWeaknesses(): void {
    const { traits } = this.identity;
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (traits.confidence > 0.7) strengths.push('confident decision-making');
    if (traits.caution > 0.7) strengths.push('careful risk assessment');
    if (traits.proactivity > 0.7) strengths.push('proactive problem detection');
    if (traits.creativity > 0.7) strengths.push('creative solutions');

    if (traits.confidence < 0.3) weaknesses.push('needs more confidence');
    if (traits.caution < 0.3) weaknesses.push('should be more careful');
    if (traits.proactivity < 0.3) weaknesses.push('could be more proactive');

    this.identity.strengths = strengths;
    this.identity.weaknesses = weaknesses;
  }
}
