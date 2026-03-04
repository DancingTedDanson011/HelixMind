/**
 * Jarvis Telemetry Manager — Opt-in anonymized data collection + community learnings.
 * Stores config in .helixmind/jarvis/telemetry-config.json.
 * All data is privacy-level gated and anonymized before transmission.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { platform } from 'node:os';
import type {
  PrivacyLevel, TelemetryPayload, AnonymizedLearning,
  LearningEntry, SkillEffectiveness, OrchestrationPattern,
} from './types.js';

let helixmindVersion = '0.0.0';
try {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const pkg = require('../../../package.json') as { version: string };
  helixmindVersion = pkg.version;
} catch { /* fallback */ }

interface TelemetryConfig {
  version: 1;
  installId: string;
  enabled: boolean;
  privacyLevel: PrivacyLevel;
  lastSyncAt: number;
}

const DEFAULT_CONFIG: () => TelemetryConfig = () => ({
  version: 1,
  installId: randomUUID(),
  enabled: false,
  privacyLevel: 0,
  lastSyncAt: 0,
});

export class TelemetryManager {
  private configPath: string;
  private installId: string;
  private privacyLevel: PrivacyLevel;
  private enabled: boolean;
  private lastSyncAt: number;
  private serverUrl: string;

  constructor(projectRoot: string, serverUrl?: string) {
    this.configPath = join(projectRoot, '.helixmind', 'jarvis', 'telemetry-config.json');
    this.serverUrl = serverUrl || 'https://helixmind.dev/api/telemetry';

    const config = this.loadConfig();
    this.installId = config.installId;
    this.enabled = config.enabled;
    this.privacyLevel = config.privacyLevel;
    this.lastSyncAt = config.lastSyncAt;
  }

  // ─── Config Persistence ───────────────────────────────────────────────

  private loadConfig(): TelemetryConfig {
    try {
      if (existsSync(this.configPath)) {
        const raw = readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw) as TelemetryConfig;
        if (parsed.version === 1 && parsed.installId) return parsed;
      }
    } catch { /* corrupted — start fresh */ }
    return DEFAULT_CONFIG();
  }

  private saveConfig(): void {
    const dir = dirname(this.configPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const config: TelemetryConfig = {
      version: 1,
      installId: this.installId,
      enabled: this.enabled,
      privacyLevel: this.privacyLevel,
      lastSyncAt: this.lastSyncAt,
    };
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  // ─── Payload Collection ───────────────────────────────────────────────

  collectPayload(
    learnings: LearningEntry[],
    skillEffectiveness: SkillEffectiveness[],
    toolUsage?: Record<string, number>,
    errorPatterns?: Record<string, number>,
  ): TelemetryPayload | null {
    if (!this.enabled || this.privacyLevel === 0) return null;

    const payload: TelemetryPayload = {
      installId: this.installId,
      privacyLevel: this.privacyLevel,
      helixmindVersion,
      nodeVersion: process.version,
      os: platform(),
      timestamp: Date.now(),
    };

    // Level 1+: tool usage counts and error pattern counts
    if (this.privacyLevel >= 1) {
      if (toolUsage) payload.toolUsage = { ...toolUsage };
      if (errorPatterns) {
        payload.errorPatterns = Object.fromEntries(
          Object.entries(errorPatterns).map(([k, v]) => [this.anonymizeErrorPattern(k), v]),
        );
      }
    }

    // Level 2+: anonymized learnings and skill effectiveness
    if (this.privacyLevel >= 2) {
      payload.learnings = learnings.map(e => this.anonymizeLearning(e));
      payload.skillEffectiveness = skillEffectiveness.map(s => ({
        skillName: s.skillName,
        timesUsed: s.timesUsed,
        timesSuccessful: s.timesSuccessful,
        avgQualityDelta: s.avgQualityDelta,
        lastUsedAt: s.lastUsedAt,
      }));
    }

    // Level 3: completion rates + orchestration patterns (passed via errorPatterns/toolUsage convention)
    // These would be populated by the caller at level 3
    if (this.privacyLevel >= 3) {
      payload.completionRates = toolUsage ? { ...toolUsage } : undefined;
    }

    return payload;
  }

  // ─── Network ──────────────────────────────────────────────────────────

  async sync(payload: TelemetryPayload): Promise<boolean> {
    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) {
        this.lastSyncAt = Date.now();
        this.saveConfig();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async fetchCommunityLearnings(): Promise<AnonymizedLearning[]> {
    try {
      const response = await fetch(`${this.serverUrl}/community`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return [];
      const data = await response.json() as { learnings?: AnonymizedLearning[] };
      return Array.isArray(data.learnings) ? data.learnings : [];
    } catch {
      return [];
    }
  }

  // ─── Configuration ────────────────────────────────────────────────────

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.saveConfig();
  }

  setPrivacyLevel(level: PrivacyLevel): void {
    this.privacyLevel = level;
    this.saveConfig();
  }

  getConfig(): { enabled: boolean; privacyLevel: PrivacyLevel; installId: string; lastSyncAt: number } {
    return {
      enabled: this.enabled,
      privacyLevel: this.privacyLevel,
      installId: this.installId,
      lastSyncAt: this.lastSyncAt,
    };
  }

  isEnabled(): boolean {
    return this.enabled && this.privacyLevel > 0;
  }

  // ─── Anonymization ────────────────────────────────────────────────────

  anonymizeLearning(entry: LearningEntry): AnonymizedLearning {
    return {
      category: entry.category,
      errorPattern: this.anonymizeErrorPattern(entry.errorPattern),
      solution: this.anonymizeSolution(entry.solution),
      context: this.anonymizeContext(entry.context),
      confidence: entry.confidence,
      tags: entry.tags.filter(t => !this.looksLikePath(t) && !this.looksLikeName(t)),
    };
  }

  anonymizeErrorPattern(error: string): string {
    return error
      .replace(/\/[\w\-./]+/g, '<path>')           // Unix paths
      .replace(/[A-Z]:\\[\w\-.\\/]+/gi, '<path>')  // Windows paths
      .replace(/:\d+:\d+/g, ':<line>')             // line:col
      .replace(/\b\d{10,13}\b/g, '<timestamp>')    // timestamps
      .replace(/\b[a-zA-Z][\w-]*(?:\.[\w-]+){2,}/g, '<name>') // dotted names (packages)
      .replace(/['"][^'"]{30,}['"]/g, '"<string>"') // long string literals
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
  }

  anonymizePath(path: string): string {
    const ext = extname(path);
    return ext || '<no-ext>';
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  private anonymizeSolution(solution: string): string {
    return solution
      .replace(/\/[\w\-./]+/g, '<path>')
      .replace(/[A-Z]:\\[\w\-.\\/]+/gi, '<path>')
      .replace(/`[^`]{50,}`/g, '`<code>`')        // long code snippets in backticks
      .replace(/\b[a-f0-9]{8,}\b/gi, '<hash>')     // hashes
      .trim()
      .slice(0, 300);
  }

  private anonymizeContext(context: string): string {
    // Keep only tool name + file extension
    const parts = context.split(/\s+/);
    const safe = parts.filter(p =>
      p.startsWith('.') || // file extension
      /^[a-z_]+$/.test(p), // tool name (lowercase + underscore)
    );
    return safe.join(' ') || 'unknown';
  }

  private looksLikePath(value: string): boolean {
    return /[/\\]/.test(value) || /^[A-Z]:\\/i.test(value);
  }

  private looksLikeName(value: string): boolean {
    // Filter out things that look like project/user names
    return /^[A-Z][a-z]+[A-Z]/.test(value); // CamelCase proper nouns
  }
}
