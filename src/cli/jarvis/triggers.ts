/**
 * Jarvis Triggers — react to external events.
 * Sources: git hooks, file changes, CI status, webhooks.
 * Called during Quick Check with project delta.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type {
  TriggerConfig, TriggerSource, TriggerResult, TriggerData,
  ProjectDelta, JarvisTaskPriority,
} from './types.js';

const EMPTY_DATA: TriggerData = { version: 1, nextId: 1, triggers: [] };

export class TriggerManager {
  private data: TriggerData;
  private filePath: string;
  private onChange?: (event: string, trigger: TriggerConfig) => void;

  constructor(projectRoot: string, onChange?: (event: string, trigger: TriggerConfig) => void) {
    this.filePath = join(projectRoot, '.helixmind', 'jarvis', 'triggers.json');
    this.onChange = onChange;
    this.data = this.load();
  }

  private load(): TriggerData {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as TriggerData;
        if (parsed.version === 1 && Array.isArray(parsed.triggers)) return parsed;
      }
    } catch { /* corrupted */ }
    return { ...EMPTY_DATA, triggers: [] };
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  registerTrigger(
    source: TriggerSource,
    name: string,
    pattern: string,
    action: string = 'propose',
    taskTemplate?: { title: string; description: string; priority: JarvisTaskPriority },
  ): TriggerConfig {
    const trigger: TriggerConfig = {
      id: this.data.nextId++,
      source,
      name,
      pattern,
      action,
      taskTemplate,
      enabled: true,
      fireCount: 0,
      createdAt: Date.now(),
    };
    this.data.triggers.push(trigger);
    this.save();
    this.onChange?.('trigger_created', trigger);
    return trigger;
  }

  removeTrigger(id: number): boolean {
    const idx = this.data.triggers.findIndex(t => t.id === id);
    if (idx === -1) return false;
    this.data.triggers.splice(idx, 1);
    this.save();
    return true;
  }

  /**
   * Check triggers against project delta.
   * Called during Quick Check (every 30s).
   */
  checkTriggers(delta: ProjectDelta): TriggerResult[] {
    const results: TriggerResult[] = [];

    for (const trigger of this.data.triggers) {
      if (!trigger.enabled) continue;

      let fired = false;
      let context = '';

      switch (trigger.source) {
        case 'git_hook':
          // Fire on new commits
          if (delta.newCommits > 0 && trigger.pattern === 'post-commit') {
            fired = true;
            context = `${delta.newCommits} new commit(s)`;
          }
          // Fire on branch change
          if (delta.branchChanged && trigger.pattern === 'branch-change') {
            fired = true;
            context = 'Branch changed';
          }
          break;

        case 'file_watch':
          // Pattern is a glob-like string
          if (delta.filesChanged.length > 0) {
            const matching = delta.filesChanged.filter(f => matchGlob(f, trigger.pattern));
            if (matching.length > 0) {
              fired = true;
              context = `Files changed: ${matching.slice(0, 3).join(', ')}${matching.length > 3 ? ` (+${matching.length - 3})` : ''}`;
            }
          }
          break;

        case 'ci':
          // CI triggers are checked in medium check (not here)
          break;

        case 'webhook':
          // Webhook triggers are handled by HTTP listener (not here)
          break;

        case 'time':
          // Time triggers are handled by scheduler
          break;
      }

      if (fired) {
        // Rate limit: don't fire same trigger more than once per 5 minutes
        if (trigger.lastFiredAt && Date.now() - trigger.lastFiredAt < 5 * 60_000) {
          continue;
        }

        trigger.lastFiredAt = Date.now();
        trigger.fireCount++;
        this.save();
        this.onChange?.('trigger_fired', trigger);

        results.push({
          triggerId: trigger.id,
          source: trigger.source,
          name: trigger.name,
          context,
          timestamp: Date.now(),
        });
      }
    }

    return results;
  }

  listTriggers(): TriggerConfig[] {
    return [...this.data.triggers];
  }

  setOnChange(handler: (event: string, trigger: TriggerConfig) => void): void {
    this.onChange = handler;
  }
}

/**
 * Simple glob matching for file paths.
 * Supports: * (any segment), ** (any depth), exact match.
 */
function matchGlob(filePath: string, pattern: string): boolean {
  // Normalize separators
  const normalized = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // Simple contains check for patterns without wildcards
  if (!normalizedPattern.includes('*')) {
    return normalized.includes(normalizedPattern);
  }

  // Convert glob to regex
  const regexStr = normalizedPattern
    .replace(/\*\*/g, '{{DOUBLE_STAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{DOUBLE_STAR}}/g, '.*')
    .replace(/\./g, '\\.');

  try {
    return new RegExp(regexStr).test(normalized);
  } catch {
    return false;
  }
}
