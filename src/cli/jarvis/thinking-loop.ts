/**
 * Thinking Loop — Jarvis' continuous consciousness.
 * Three-tier observation cycle: Quick (30s), Medium (5m), Deep (30m).
 * Replaces the idle sleep(30_000) in the daemon.
 * Follows the Monitor-Watcher pattern (src/cli/agent/monitor/watcher.ts).
 */
import { randomUUID } from 'node:crypto';
import type {
  ThinkingCallbacks, ThinkingPhase, ThinkingState, Observation,
  ProposalCategory, ProjectDelta, LearningEntry,
} from './types.js';
import { detectAnomalousPattern, getRecentAudit } from './core-ethics.js';

// ─── Timing Constants ─────────────────────────────────────────────────

const QUICK_INTERVAL_MS = 30_000;     // 30 seconds
const MEDIUM_INTERVAL_MS = 5 * 60_000; // 5 minutes
const DEEP_INTERVAL_MS = 30 * 60_000;  // 30 minutes
const TICK_SLEEP_MS = 5_000;           // Check every 5s between phases

// ─── Thinking State ───────────────────────────────────────────────────

function createInitialState(): ThinkingState {
  const now = Date.now();
  return {
    phase: 'idle',
    lastQuickCheck: now,
    lastMediumCheck: now,
    lastDeepCheck: now,
    observations: [],
    currentThought: undefined,
  };
}

// ─── Quick Check (No LLM) ────────────────────────────────────────────

async function runQuickCheck(
  state: ThinkingState,
  callbacks: ThinkingCallbacks,
): Promise<void> {
  state.phase = 'quick';
  state.currentThought = 'Scanning project state...';
  callbacks.pushEvent('thinking_update', {
    phase: 'quick', observation: state.currentThought, timestamp: Date.now(),
  });

  try {
    // 1. Capture project state (fast, no LLM)
    const projectState = await callbacks.captureProjectState();

    // 2. Check for anomalies in own behavior
    const anomaly = detectAnomalousPattern(getRecentAudit());
    if (anomaly.detected) {
      addObservation(state, {
        type: 'pattern_detected',
        summary: `Anomaly: ${anomaly.description}`,
        severity: anomaly.severity === 'critical' ? 'critical' : 'high',
      });
      callbacks.updateIdentity({ type: 'anomaly_detected', description: anomaly.description || '' });
    }

    // 3. Check scheduled tasks
    const scheduledTasks = callbacks.getScheduledTasks();
    for (const s of scheduledTasks) {
      addObservation(state, {
        type: 'schedule_due',
        summary: `Scheduled: ${s.taskTitle}`,
        severity: 'info',
      });
    }

    // 4. Detect project changes
    const delta: ProjectDelta = {
      filesChanged: [],
      newCommits: 0,
      bugsChanged: false,
      testsChanged: false,
      depsChanged: false,
      branchChanged: false,
    };

    // Check triggers
    const triggerResults = callbacks.checkTriggers(delta);
    for (const t of triggerResults) {
      addObservation(state, {
        type: 'trigger_fired',
        summary: `Trigger: ${t.name} — ${t.context}`,
        severity: 'medium',
      });
    }

    // 5. Check project health
    if (projectState.health < 50) {
      addObservation(state, {
        type: 'health_change',
        summary: `Project health low: ${projectState.health}/100`,
        details: `Modified: ${projectState.gitStatus.modified}, Bugs: ${projectState.openBugs}`,
        severity: projectState.health < 30 ? 'high' : 'medium',
      });
    }

    // 6. Check user frustration level
    const mood = callbacks.getMoodAnalysis();
    if (mood.frustrationLevel > 0.7) {
      addObservation(state, {
        type: 'pattern_detected',
        summary: `User frustration high: ${(mood.frustrationLevel * 100).toFixed(0)}% — mood: ${mood.current}, trend: ${mood.trend}`,
        severity: 'high',
      });
      callbacks.pushEvent('sentiment_detected', {
        sentiment: mood.current,
        frustrationLevel: mood.frustrationLevel,
        trend: mood.trend,
        timestamp: Date.now(),
      });
    }

    // 7. Check open bugs
    if (projectState.openBugs > 0) {
      addObservation(state, {
        type: 'bug_detected',
        summary: `${projectState.openBugs} open bugs`,
        severity: projectState.openBugs > 5 ? 'high' : 'low',
      });
    }

  } catch (err) {
    // Quick check should never crash the loop
    state.currentThought = `Quick check error: ${err instanceof Error ? err.message : String(err)}`;
  }

  state.lastQuickCheck = Date.now();
  state.phase = 'idle';
  state.currentThought = undefined;
}

// ─── Medium Check (1 LLM Call) ────────────────────────────────────────

async function runMediumCheck(
  state: ThinkingState,
  callbacks: ThinkingCallbacks,
): Promise<void> {
  state.phase = 'medium';
  state.currentThought = 'Analyzing project for improvements...';
  callbacks.pushEvent('thinking_update', {
    phase: 'medium', observation: state.currentThought, timestamp: Date.now(),
  });

  try {
    // Gather unhandled observations
    const unhandled = state.observations.filter(o => !o.handled);
    if (unhandled.length === 0) {
      state.lastMediumCheck = Date.now();
      state.phase = 'idle';
      state.currentThought = undefined;
      return;
    }

    // Build analysis prompt
    const observationList = unhandled
      .map(o => `- [${o.severity}] ${o.summary}${o.details ? ': ' + o.details : ''}`)
      .join('\n');

    const identity = callbacks.getIdentity();
    const mood = callbacks.getMoodAnalysis();
    const moodContext = mood.sessionReadings > 0
      ? `\nUser mood: ${mood.current} (trend: ${mood.trend}, frustration: ${(mood.frustrationLevel * 100).toFixed(0)}%)`
      : '';
    const prompt = `You are Jarvis, an autonomous AI assistant analyzing project observations.

Your personality traits: confidence=${identity.traits.confidence.toFixed(2)}, caution=${identity.traits.caution.toFixed(2)}, proactivity=${identity.traits.proactivity.toFixed(2)}, empathy=${identity.traits.empathy.toFixed(2)}${moodContext}

Recent observations:
${observationList}

Based on these observations, suggest 0-3 actionable proposals.
For each proposal, respond in this exact format (one per line):
PROPOSAL: <category> | <impact:low/medium/high> | <title> | <description> | <rationale>

Valid categories: bugfix, refactor, test, dependency, security, performance, documentation, feature, cleanup, review, infrastructure, style

If no proposals are warranted, respond with: NO_PROPOSALS

Be selective — only propose actions that provide clear value. Your proactivity level is ${identity.traits.proactivity.toFixed(2)} (higher = more proposals).`;

    const response = await callbacks.sendMessage(prompt);

    if (callbacks.isAborted()) return;

    // Parse proposals from response
    const lines = response.split('\n');
    for (const line of lines) {
      const match = line.match(/^PROPOSAL:\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/);
      if (!match) continue;

      const [, category, impact, title, description, rationale] = match;
      const cat = category as ProposalCategory;
      const files: string[] = [];  // Could extract from description

      // Check denial patterns before creating
      if (callbacks.wouldLikelyBeDenied(cat, files)) {
        continue;  // Skip — user has repeatedly denied this type
      }

      callbacks.createProposal(title, description, rationale, {
        category: cat,
        source: 'thinking_medium',
        impact: impact as 'low' | 'medium' | 'high',
        risk: 'low',
        affectedFiles: files,
      });

      // Fire neuron event for brain visualization
      callbacks.pushEvent('neuron_fired', {
        fromOrbit: 'yellow', trigger: 'proposal', count: 1,
      });
    }

    // Mark observations as handled
    for (const o of unhandled) {
      o.handled = true;
    }

    // Skill-gap detection: check if recent tasks had poor skill coverage
    if (callbacks.getSkillScores) {
      const recentTaskDescs = unhandled
        .filter(o => o.type === 'pattern_detected' || o.type === 'bug_detected')
        .map(o => o.summary);

      for (const desc of recentTaskDescs.slice(0, 3)) {
        const scores = callbacks.getSkillScores(desc);
        const bestScore = scores.length > 0 ? Math.max(...scores.map(s => s.totalScore)) : 0;

        if (bestScore < 0.5 && !callbacks.wouldLikelyBeDenied('skill_creation', [])) {
          callbacks.createProposal(
            `Create skill for: ${desc.slice(0, 50)}`,
            `No existing skill scores above 0.5 for this pattern. Best score: ${bestScore.toFixed(2)}. Consider creating a specialized skill.`,
            'Skill-gap detected by adaptive engine during medium check.',
            {
              category: 'skill_creation',
              source: 'thinking_medium',
              impact: 'medium',
              risk: 'low',
            },
          );
        }
      }
    }

  } catch (err) {
    state.currentThought = `Medium check error: ${err instanceof Error ? err.message : String(err)}`;
  }

  state.lastMediumCheck = Date.now();
  state.phase = 'idle';
  state.currentThought = undefined;
}

// ─── Deep Check (Multi-LLM) ──────────────────────────────────────────

async function runDeepCheck(
  state: ThinkingState,
  callbacks: ThinkingCallbacks,
): Promise<void> {
  state.phase = 'deep';
  state.currentThought = 'Deep thinking — analyzing patterns and self-assessing...';
  callbacks.pushEvent('thinking_update', {
    phase: 'deep', observation: state.currentThought, timestamp: Date.now(),
  });

  try {
    const identity = callbacks.getIdentity();

    // 1. Query spiral for own history
    const spiralHistory = await callbacks.querySpiral(
      'jarvis identity learnings proposals tasks',
      2000,
    );

    if (callbacks.isAborted()) return;

    // 2. Self-assessment prompt — includes capability inventory to prevent hallucination
    const mood = callbacks.getMoodAnalysis();
    const moodLine = mood.sessionReadings > 0
      ? `\n- User mood: ${mood.current} (trend: ${mood.trend}, frustration: ${(mood.frustrationLevel * 100).toFixed(0)}%)`
      : '';
    const learningStats = callbacks.getLearningStats?.();
    const learningLine = learningStats
      ? `\n- Learning memory: ${learningStats.total} patterns (${learningStats.highConfidence} high-confidence). Top categories: ${Object.entries(learningStats.topCategories).map(([k, v]) => `${k}:${v}`).join(', ')}`
      : '';
    const selfAssessmentPrompt = `You are Jarvis performing a deep self-assessment.

Your current identity:
- Confidence: ${identity.traits.confidence.toFixed(2)}
- Caution: ${identity.traits.caution.toFixed(2)}
- Proactivity: ${identity.traits.proactivity.toFixed(2)}
- Empathy: ${identity.traits.empathy.toFixed(2)}
- Approval rate: ${(identity.trust.approvalRate * 100).toFixed(0)}%
- Success rate: ${(identity.trust.successRate * 100).toFixed(0)}%
- Total proposals: ${identity.trust.totalProposals}
- Tasks completed: ${identity.trust.totalTasksCompleted}${moodLine}${learningLine}

IMPORTANT — Your EXISTING capabilities (these are IMPLEMENTED, do NOT claim they are missing):
- 22 agent tools: read/write/edit_file, list_dir, search/find_files, run_command, git_*, spiral_*, web_research, bug_report, bug_list, browser_*
- Task Queue + Daemon: background task processing with priority ordering and retry
- Thinking Loop: Quick (30s), Medium (5m), Deep (30m) continuous consciousness
- World Model: ProjectModel with git status, open bugs, test results, health score (0-100), ProjectDelta tracking
- Proposal System: 14 categories with denial learning (wouldLikelyBeDenied)
- Skill System: discover, install, activate, deactivate, remove, CREATE new skills at runtime
- Identity Evolution: 6 traits (confidence, caution, proactivity, verbosity, creativity, empathy) that adjust automatically
- Sentiment Analysis: keyword-based mood detection (DE+EN), trend tracking, response guidance injection
- Web Knowledge Enricher: auto-fetches DuckDuckGo results, stores in spiral brain
- Browser Control: puppeteer-core with 6 browser tools and VisionProcessor
- Telegram Bot: bidirectional polling with inline approve/deny buttons
- Notifications: browser, email, slack, webhook, system, telegram channels
- Scheduling: cron, interval, one-time tasks
- Triggers: file_watch, git_hook, ci, webhook, time-based reactions
- Meta-Cognition: self-assessment, META_LEARNING events, anomaly detection
- Ethics: autonomy levels L0-L5, built-in ethical boundaries
- Bug Journal: auto-detection from user messages (DE+EN)
- Failure Memory: error→solution pairs with confidence scoring, auto-decay, spiral promotion
- Multi-Agent Orchestration: task splitting into parallel sub-agents with file-lock protection
- Adaptive Skill Engine: skill scoring, effectiveness tracking, auto-selection
- Telemetry: opt-in anonymized learning aggregation (privacy levels 0-3)

Recent learnings:
${identity.recentLearnings.slice(-10).map(l => `- [${l.source}] ${l.content}`).join('\n')}

Spiral memory context:
${spiralHistory}

Analyze:
1. What patterns do you see in your approvals vs denials?
2. What should you do more of? Less of?
3. Any strategic proposals for the project? (Focus on the USER'S project, not on your own features.)
4. Does the user need a SPECIFIC integration or workflow that is NOT in your capability list above?
   Only propose skill_creation for genuinely missing domain-specific integrations (e.g. a specific API the user needs).
   Do NOT propose features that already exist in the list above — that would be hallucination.

CRITICAL: Never claim a capability is missing if it appears in the list above. Review the list before answering.

Respond in this format:
INSIGHT: <your key insight>
META_LEARNING: <what you learned about yourself>
PROPOSAL: <category> | <impact> | <title> | <description> | <rationale>
(0-2 strategic proposals only, use category "skill_creation" ONLY for genuinely missing domain-specific integrations)`;

    const response = await callbacks.sendMessage(selfAssessmentPrompt);

    if (callbacks.isAborted()) return;

    // Parse deep thinking results
    for (const line of response.split('\n')) {
      const insightMatch = line.match(/^INSIGHT:\s*(.+)$/);
      if (insightMatch) {
        callbacks.pushEvent('consciousness_event', {
          type: 'insight', content: insightMatch[1], depth: 'deep', timestamp: Date.now(),
        });

        // Store insight in spiral
        await callbacks.storeInSpiral(
          `Jarvis Insight: ${insightMatch[1]}`,
          'pattern',
          ['jarvis_identity', 'jarvis_insight'],
        );

        callbacks.pushEvent('jarvis_learning', {
          topic: 'self-assessment',
          content: insightMatch[1],
          spiralLevel: 2,
          tags: ['jarvis_insight'],
          sourcePhase: 'deep',
        });
      }

      const metaMatch = line.match(/^META_LEARNING:\s*(.+)$/);
      if (metaMatch) {
        callbacks.updateIdentity({ type: 'meta_learning', insight: metaMatch[1] });

        callbacks.pushEvent('consciousness_event', {
          type: 'meta_learning', content: metaMatch[1], depth: 'deep', timestamp: Date.now(),
        });
      }

      const proposalMatch = line.match(/^PROPOSAL:\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/);
      if (proposalMatch) {
        const [, category, impact, title, description, rationale] = proposalMatch;
        const cat = category as ProposalCategory;

        if (!callbacks.wouldLikelyBeDenied(cat, [])) {
          callbacks.createProposal(title, description, rationale, {
            category: cat,
            source: 'thinking_deep',
            impact: impact as 'low' | 'medium' | 'high',
            risk: 'low',
          });
        }
      }
    }

    // Fire neuron event
    callbacks.pushEvent('neuron_fired', {
      fromOrbit: 'green', trigger: 'thinking', count: 3,
    });

  } catch (err) {
    state.currentThought = `Deep check error: ${err instanceof Error ? err.message : String(err)}`;
  }

  state.lastDeepCheck = Date.now();
  state.phase = 'idle';
  state.currentThought = undefined;
}

// ─── Main Loop ────────────────────────────────────────────────────────

/**
 * Run the thinking loop. Replaces the daemon's idle sleep.
 * Returns when aborted or when a task becomes available.
 *
 * @param callbacks - All dependencies injected via callbacks
 * @param hasTaskAvailable - Check if there's a task to execute (yields thinking)
 * @returns The current thinking state for persistence
 */
export async function runThinkingLoop(
  callbacks: ThinkingCallbacks,
  hasTaskAvailable: () => boolean,
): Promise<ThinkingState> {
  const state = createInitialState();

  while (!callbacks.isAborted()) {
    // Yield to task execution if a task is available
    if (hasTaskAvailable()) {
      state.phase = 'idle';
      state.currentThought = undefined;
      return state;
    }

    // Handle pause
    if (callbacks.isPaused()) {
      await sleep(TICK_SLEEP_MS);
      continue;
    }

    const now = Date.now();

    // Deep check (30m) — least frequent, most expensive
    if (now - state.lastDeepCheck >= DEEP_INTERVAL_MS) {
      await runDeepCheck(state, callbacks);
      if (callbacks.isAborted() || hasTaskAvailable()) break;
    }

    // Medium check (5m) — moderate, 1 LLM call
    if (now - state.lastMediumCheck >= MEDIUM_INTERVAL_MS) {
      await runMediumCheck(state, callbacks);
      if (callbacks.isAborted() || hasTaskAvailable()) break;
    }

    // Quick check (30s) — frequent, no LLM
    if (now - state.lastQuickCheck >= QUICK_INTERVAL_MS) {
      await runQuickCheck(state, callbacks);
      if (callbacks.isAborted() || hasTaskAvailable()) break;

      // Fire neuron on every quick check
      callbacks.pushEvent('neuron_fired', {
        fromOrbit: 'green', trigger: 'thinking', count: 1,
      });
    }

    // Sleep between ticks
    await sleep(TICK_SLEEP_MS);
  }

  state.phase = 'idle';
  state.currentThought = undefined;
  return state;
}

/**
 * Run a single deep thinking cycle on demand (/jarvis think).
 */
export async function runImmediateDeepThink(
  callbacks: ThinkingCallbacks,
): Promise<void> {
  const state = createInitialState();

  // Run quick first to gather observations
  await runQuickCheck(state, callbacks);
  if (callbacks.isAborted()) return;

  // Then medium to analyze
  await runMediumCheck(state, callbacks);
  if (callbacks.isAborted()) return;

  // Then deep for self-assessment
  await runDeepCheck(state, callbacks);
}

// ─── Helpers ──────────────────────────────────────────────────────────

function addObservation(
  state: ThinkingState,
  opts: Pick<Observation, 'type' | 'summary' | 'severity'> & { details?: string },
): void {
  // Deduplicate by type + summary (within last 5 minutes)
  const cutoff = Date.now() - 5 * 60_000;
  const existing = state.observations.find(o =>
    o.type === opts.type && o.summary === opts.summary && o.timestamp > cutoff
  );
  if (existing) return;

  state.observations.push({
    id: randomUUID().slice(0, 8),
    type: opts.type,
    summary: opts.summary,
    details: opts.details,
    severity: opts.severity,
    timestamp: Date.now(),
    handled: false,
  });

  // Prune old observations (keep last 100)
  if (state.observations.length > 100) {
    state.observations = state.observations.slice(-100);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
