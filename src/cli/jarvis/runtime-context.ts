/**
 * Runtime Context — aggregates live state of all Jarvis modules
 * into a dynamic prompt section. Injected every message turn so
 * the LLM always knows its own current state (no hallucination).
 */
import type { JarvisQueue } from './queue.js';
import type { ProposalJournal } from './proposals.js';
import type { JarvisIdentityManager } from './identity.js';
import type { AutonomyManager } from './autonomy.js';
import type { SentimentAnalyzer } from './sentiment.js';
import type { JarvisScheduler } from './scheduler.js';
import type { TriggerManager } from './triggers.js';
import type { WorldModelManager } from './world-model.js';
import type { NotificationManager } from './notifications.js';
import type { SkillManager } from './skills.js';
import type { JarvisTelegramBot } from './telegram-bot.js';
import type { Session } from '../sessions/session.js';

export interface RuntimeModules {
  queue: JarvisQueue;
  proposals: ProposalJournal;
  identity: JarvisIdentityManager;
  autonomy: AutonomyManager;
  sentiment: SentimentAnalyzer;
  scheduler: JarvisScheduler;
  triggers: TriggerManager;
  worldModel: WorldModelManager;
  notifications: NotificationManager;
  skills: SkillManager;
  telegramBot: JarvisTelegramBot | null;
  daemonSession: Session | null;
  sessionCount: number;
}

export function buildRuntimeContext(m: RuntimeModules): string {
  const sections: string[] = [];

  // ── 1. Daemon State ──
  const daemon = m.daemonSession;
  if (daemon && daemon.status === 'running') {
    const uptimeMs = Date.now() - daemon.startTime;
    const uptimeStr = formatUptime(uptimeMs);
    sections.push(`Daemon: running (uptime: ${uptimeStr})`);
  } else {
    sections.push('Daemon: stopped');
  }

  // ── 2. Autonomy ──
  const identity = m.identity.getIdentity();
  const autonomyStr = m.autonomy.getStatusString(identity);
  sections.push(`Autonomy: ${autonomyStr}`);

  // ── 3. Mood ──
  const mood = m.sentiment.analyzeMood();
  if (mood.current !== 'neutral' || mood.frustrationLevel > 0.3) {
    sections.push(`Mood: ${mood.current} (trend: ${mood.trend}, frustration: ${Math.round(mood.frustrationLevel * 100)}%)`);
  }

  // ── 4. Task Queue ──
  const queueSummary = m.queue.getSummaryForPrompt();
  if (queueSummary) {
    sections.push('');
    sections.push(queueSummary);
  }

  // ── 5. Proposals ──
  const proposalSummary = m.proposals.getSummaryForPrompt();
  if (proposalSummary) {
    sections.push('');
    sections.push(proposalSummary);
  }

  // ── 6. Communication ──
  const commLines: string[] = [];
  const telegramBot = m.telegramBot;
  const teleConfig = m.notifications.getConfig().targets.find(t => t.channel === 'telegram');
  if (telegramBot?.isRunning) {
    commLines.push('Telegram: active (polling)');
  } else if (teleConfig?.enabled) {
    commLines.push('Telegram: configured (not polling)');
  } else {
    commLines.push('Telegram: not configured');
  }
  const channels = m.notifications.getConfiguredChannels();
  if (channels.length > 0) {
    commLines.push(`Channels: ${channels.join(', ')}`);
  }
  if (commLines.length > 0) {
    sections.push('');
    sections.push('### Communication');
    sections.push(...commLines);
  }

  // ── 7. Skills ──
  const activeSkills = m.skills.getActiveSkills();
  if (activeSkills.length > 0) {
    sections.push('');
    sections.push('### Active Skills');
    for (const s of activeSkills) {
      sections.push(`- ${s.manifest.name} v${s.manifest.version}`);
    }
  }

  // ── 8. Scheduler ──
  const schedules = m.scheduler.listSchedules().filter(s => s.enabled);
  if (schedules.length > 0) {
    sections.push('');
    sections.push('### Scheduled');
    for (const s of schedules) {
      sections.push(`- ${s.taskTitle} (${s.type}: ${s.expression})`);
    }
  }

  // ── 9. Triggers ──
  const triggers = m.triggers.listTriggers().filter(t => t.enabled);
  if (triggers.length > 0) {
    sections.push('');
    sections.push('### Triggers');
    for (const t of triggers) {
      sections.push(`- ${t.name} [${t.source}] → ${t.action}`);
    }
  }

  // ── 10. World Model ──
  const worldPrompt = m.worldModel.getWorldModelPrompt();
  if (worldPrompt) {
    sections.push('');
    sections.push(worldPrompt);
  }

  // ── Sessions ──
  if (m.sessionCount > 1) {
    sections.push('');
    sections.push(`Active sessions: ${m.sessionCount}`);
  }

  // ── Anti-Hallucination Rule ──
  const antiHallucination = `
CRITICAL: This is your LIVE state. Do not claim features are missing if they appear above. Do not claim the daemon is not running if it says "running" above. Your Runtime State is the source of truth about what you are currently doing.`;

  return `## Runtime State (live — updated every message)

${sections.join('\n')}
${antiHallucination}`;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
