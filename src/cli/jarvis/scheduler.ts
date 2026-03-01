/**
 * Jarvis Scheduler — time-based task scheduling.
 * Supports cron expressions, intervals, and one-time schedules.
 * Called during Quick Check (every 30s) to fire due schedules.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { ScheduleEntry, ScheduleType, SchedulerData, JarvisTaskPriority } from './types.js';

const EMPTY_DATA: SchedulerData = { version: 1, nextId: 1, schedules: [] };

/**
 * Parse a simple cron expression: "min hour day month weekday"
 * Only supports: *, numbers, and step (asterisk/number).
 * For complex cron, use a library. This covers 90% of use cases.
 */
function matchesCron(expression: string, date: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const fields = [
    date.getMinutes(),     // 0-59
    date.getHours(),       // 0-23
    date.getDate(),        // 1-31
    date.getMonth() + 1,   // 1-12
    date.getDay(),         // 0-6 (Sunday=0)
  ];

  for (let i = 0; i < 5; i++) {
    if (!matchesCronField(parts[i], fields[i])) return false;
  }
  return true;
}

function matchesCronField(field: string, value: number): boolean {
  if (field === '*') return true;

  // Step: */5 means every 5th
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    return !isNaN(step) && step > 0 && value % step === 0;
  }

  // Comma-separated: 1,3,5
  if (field.includes(',')) {
    return field.split(',').some(f => matchesCronField(f.trim(), value));
  }

  // Range: 1-5
  if (field.includes('-')) {
    const [min, max] = field.split('-').map(n => parseInt(n, 10));
    return !isNaN(min) && !isNaN(max) && value >= min && value <= max;
  }

  // Exact number
  const num = parseInt(field, 10);
  return !isNaN(num) && value === num;
}

export class JarvisScheduler {
  private data: SchedulerData;
  private filePath: string;
  private onChange?: (event: string, schedule: ScheduleEntry) => void;

  constructor(projectRoot: string, onChange?: (event: string, schedule: ScheduleEntry) => void) {
    this.filePath = join(projectRoot, '.helixmind', 'jarvis', 'schedules.json');
    this.onChange = onChange;
    this.data = this.load();
  }

  private load(): SchedulerData {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as SchedulerData;
        if (parsed.version === 1 && Array.isArray(parsed.schedules)) return parsed;
      }
    } catch { /* corrupted */ }
    return { ...EMPTY_DATA, schedules: [] };
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  addSchedule(
    type: ScheduleType,
    expression: string,
    taskTitle: string,
    taskDescription: string,
    priority: JarvisTaskPriority = 'medium',
  ): ScheduleEntry {
    const entry: ScheduleEntry = {
      id: this.data.nextId++,
      type,
      expression,
      taskTitle,
      taskDescription,
      priority,
      enabled: true,
      createdAt: Date.now(),
      nextFireAt: this.calculateNextFire(type, expression),
    };
    this.data.schedules.push(entry);
    this.save();
    this.onChange?.('schedule_created', entry);
    return entry;
  }

  removeSchedule(id: number): boolean {
    const idx = this.data.schedules.findIndex(s => s.id === id);
    if (idx === -1) return false;
    this.data.schedules.splice(idx, 1);
    this.save();
    return true;
  }

  /**
   * Check for due schedules. Called every 30s by Quick Check.
   * Returns entries that should fire now.
   */
  tick(): ScheduleEntry[] {
    const now = Date.now();
    const due: ScheduleEntry[] = [];

    for (const entry of this.data.schedules) {
      if (!entry.enabled) continue;

      let shouldFire = false;

      switch (entry.type) {
        case 'cron':
          shouldFire = matchesCron(entry.expression, new Date(now));
          // Prevent firing more than once per minute
          if (shouldFire && entry.lastFiredAt && now - entry.lastFiredAt < 60_000) {
            shouldFire = false;
          }
          break;

        case 'interval': {
          const intervalMs = parseInt(entry.expression, 10);
          if (!isNaN(intervalMs) && intervalMs > 0) {
            const lastFire = entry.lastFiredAt || entry.createdAt;
            shouldFire = now - lastFire >= intervalMs;
          }
          break;
        }

        case 'once':
          if (!entry.lastFiredAt) {
            const fireAt = parseInt(entry.expression, 10);
            shouldFire = !isNaN(fireAt) && now >= fireAt;
          }
          break;
      }

      if (shouldFire) {
        entry.lastFiredAt = now;
        entry.nextFireAt = this.calculateNextFire(entry.type, entry.expression);
        due.push(entry);

        // Disable one-time schedules after firing
        if (entry.type === 'once') {
          entry.enabled = false;
        }

        this.onChange?.('schedule_fired', entry);
      }
    }

    if (due.length > 0) this.save();
    return due;
  }

  listSchedules(): ScheduleEntry[] {
    return [...this.data.schedules];
  }

  getNextDue(): ScheduleEntry | undefined {
    const enabled = this.data.schedules.filter(s => s.enabled);
    if (enabled.length === 0) return undefined;
    return enabled.sort((a, b) => (a.nextFireAt || Infinity) - (b.nextFireAt || Infinity))[0];
  }

  setOnChange(handler: (event: string, schedule: ScheduleEntry) => void): void {
    this.onChange = handler;
  }

  private calculateNextFire(type: ScheduleType, expression: string): number | undefined {
    const now = Date.now();
    switch (type) {
      case 'interval': {
        const ms = parseInt(expression, 10);
        return !isNaN(ms) ? now + ms : undefined;
      }
      case 'once': {
        const ts = parseInt(expression, 10);
        return !isNaN(ts) && ts > now ? ts : undefined;
      }
      case 'cron':
        // Approximate: next minute
        return now + 60_000;
    }
  }
}
