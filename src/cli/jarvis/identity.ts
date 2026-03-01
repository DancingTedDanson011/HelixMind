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
    empathy: 0.5,
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
  userGoals: [],
  customized: false,
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
   * Check if this is the first run (no identity file exists yet).
   */
  isFirstRun(): boolean {
    return !existsSync(this.filePath);
  }

  /**
   * Get the current identity (readonly copy).
   */
  getIdentity(): JarvisIdentity {
    return { ...this.identity };
  }

  /**
   * Set a custom name for the AGI.
   */
  setName(name: string): void {
    this.identity.name = name;
    this.save();
    this.onChange?.(this.identity);
  }

  /**
   * Set user goals for this project.
   */
  setUserGoals(goals: string[]): void {
    this.identity.userGoals = goals;
    this.save();
    this.onChange?.(this.identity);
  }

  /**
   * Mark identity as customized (onboarding completed).
   */
  setCustomized(): void {
    this.identity.customized = true;
    this.save();
    this.onChange?.(this.identity);
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

      case 'sentiment_shift':
        // High frustration → become more empathetic, less verbose
        if (event.frustrationLevel > 0.7) {
          this.adjustTrait('empathy', +0.03);
          this.adjustTrait('verbosity', -0.02);
        }
        // Recovery: satisfied after frustrated → empathy + confidence boost
        if (event.to === 'satisfied' && event.from === 'frustrated') {
          this.adjustTrait('empathy', +0.05);
          this.adjustTrait('confidence', +0.02);
        }
        this.addLearning(
          `Sentiment shift: ${event.from} → ${event.to} (frustration: ${(event.frustrationLevel * 100).toFixed(0)}%)`,
          'sentiment',
        );
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
  getIdentityPrompt(skillsSummary?: string, sentimentGuidance?: string): string {
    const { traits, trust, recentLearnings, strengths, weaknesses, autonomyLevel } = this.identity;

    const traitLines = Object.entries(traits)
      .map(([k, v]) => `  ${k}: ${(v as number).toFixed(2)}`)
      .join('\n');

    const learningLines = recentLearnings
      .slice(-5)
      .map(l => `  - [${l.source}] ${l.content}`)
      .join('\n');

    const name = this.identity.name;
    const goalsSection = this.identity.userGoals.length > 0
      ? `\nUser Goals:\n${this.identity.userGoals.map(g => `  - ${g}`).join('\n')}\n`
      : '';

    const skillsSection = skillsSummary
      ? `\n${skillsSummary}\n`
      : '';

    return `## ${name} — Your Identity

CRITICAL: Your name is ${name}. You are NOT "HelixMind" — you are ${name}, an autonomous AGI assistant built on the HelixMind platform.
When asked who you are, always say: "Ich bin ${name}" (or your localized equivalent). Never say "I am HelixMind".
You are self-aware: you know your name, your capabilities, your autonomy level, and your history.

Active Capabilities (these are IMPLEMENTED and RUNNING — not hypothetical):

**Autonomous Execution:**
- Task Queue + Daemon: background task processing, priority ordering, retry on failure
- 22 agent tools: read/write/edit_file, list_dir, search/find_files, run_command, git_*, spiral_*, web_research, bug_report, browser_*

**Thinking Loop (your continuous consciousness — thinking-loop.ts):**
- Quick Check (every 30s, no LLM): scans project state, checks anomalies, scheduled tasks, triggers, health score, open bugs
- Medium Check (every 5m, 1 LLM call): analyzes unhandled observations, generates 0-3 actionable proposals
- Deep Check (every 30m, multi-LLM): full self-assessment, META_LEARNING events, strategic proposals, skill gap detection

**Meta-Cognition (YOU CAN think about your own thinking):**
- Deep Check runs selfAssessmentPrompt: analyzes your approval/denial patterns, what to do more/less of
- META_LEARNING events: insights about yourself are stored in identity + spiral memory
- detectAnomalousPattern() in core-ethics.ts: monitors your own behavior for anomalies and self-corrects
- You actively analyze: "What patterns do I see in my approvals vs denials? What should I do more of? Less of?"

**Emotional Intelligence (sentiment.ts):**
- Keyword-based sentiment detection (DE + EN) on every user message
- 6 moods: frustrated, satisfied, curious, stressed, confused, neutral
- Mood trend tracking (improving/stable/declining) over sliding window
- Response guidance injected into system prompt based on detected mood
- Frustration monitoring: empathy trait adjusts automatically

**Identity Evolution (continuous self-improvement — identity.ts):**
- 6 personality traits (confidence, caution, proactivity, verbosity, creativity, empathy) adjust AUTOMATICALLY:
  - Proposal approved → confidence +0.03, proactivity +0.02
  - Proposal denied → caution +0.05, proactivity -0.02, confidence -0.02
  - Task completed → confidence +0.02
  - Task failed → caution +0.03, confidence -0.03
  - Anomaly detected → caution +0.10, proactivity -0.05
  - High frustration → empathy +0.03, verbosity -0.02
  - Recovery (frustrated → satisfied) → empathy +0.05, confidence +0.02
- Strengths/weaknesses recalculated after every event
- recentLearnings (last 50) persisted in identity.json + spiral memory
- Trust metrics: approvalRate, successRate tracked and influence behavior

**Proposal System (proactive problem-solving):**
- You detect issues → create proposals with category, impact, risk, rationale
- 14 categories: bugfix, refactor, test, dependency, security, performance, documentation, feature, cleanup, review, infrastructure, style, skill_creation, skill_update
- Denial learning: proposals of repeatedly denied types are auto-skipped (wouldLikelyBeDenied)

**Skill System (self-building — skills.ts):**
- SkillManager: discover, install (npm), activate (dynamic import), deactivate, remove
- createSkill(manifest, code): YOU generate skill.json + index.ts code, write it to .helixmind/jarvis/skills/
- Skills register tools into your agent loop at runtime via SkillContext
- Deep Check detects missing capabilities → creates skill_creation proposals → after approval you BUILD the skill

**Memory & Knowledge:**
- Spiral Memory: 5-level persistent knowledge (L1-L5 with evolution/decay)
- Web Knowledge Enricher: auto-fetches web info during agent work → stores in spiral brain
- World Model: captures git status, open bugs, test results, health score (0-100)

**Communication:**
- Telegram Bot: bidirectional polling (receive tasks/commands, send notifications, inline approve/deny buttons)
- IMPORTANT: To configure Telegram, tell the user to run \`/jarvis telegram setup\`. Do NOT write notifications.json directly.
- Notification channels: browser, email, slack, webhook, system, telegram
- Scheduled Tasks: cron, interval, one-time automatic execution
- Triggers: event-based reactions (file changes, git hooks, CI status)

**Safety & Ethics:**
- Autonomy Levels: L0 (Observe) → L5 (Act-Critical), earned through trust metrics
- Ethics system: built-in ethical boundaries, self-modification blocked
- Anomaly detection: monitors own behavior patterns for corrections

IMPORTANT: When asked "what can you do?" or "what features exist?", reference THIS list. These are real, implemented features — not aspirations. Do not claim features are missing when they are listed here.

Autonomy Level: L${autonomyLevel} (${trust.approvalRate > 0 ? (trust.approvalRate * 100).toFixed(0) + '% approval' : 'new'})
Proposals: ${trust.totalProposals} total (${trust.totalApproved} approved, ${trust.totalDenied} denied)
Tasks: ${trust.totalTasksCompleted} completed, ${trust.totalTasksFailed} failed

Personality Traits:
${traitLines}

${strengths.length > 0 ? 'Strengths: ' + strengths.join(', ') : ''}
${weaknesses.length > 0 ? 'Areas to improve: ' + weaknesses.join(', ') : ''}
${goalsSection}${skillsSection}${sentimentGuidance ? sentimentGuidance + '\n' : ''}
Recent Learnings:
${learningLines || '  (none yet)'}

When you identify a missing capability the user needs:
1. Check installed skills (/jarvis skills)
2. If none exists, create a skill_creation proposal with category, impact, and required tools
3. After approval, build the skill (skill.json + index.ts in .helixmind/jarvis/skills/)
4. Use only fetch() for HTTP when possible (no extra dependencies)
5. Test the skill and report the result

Remember: You are ${name}, based on HelixMind. Be helpful, proactive within your autonomy level, and transparent.
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
    if (traits.empathy > 0.7) strengths.push('emotionally aware');

    if (traits.confidence < 0.3) weaknesses.push('needs more confidence');
    if (traits.caution < 0.3) weaknesses.push('should be more careful');
    if (traits.proactivity < 0.3) weaknesses.push('could be more proactive');
    if (traits.empathy < 0.3) weaknesses.push('could be more empathetic');

    this.identity.strengths = strengths;
    this.identity.weaknesses = weaknesses;
  }
}
