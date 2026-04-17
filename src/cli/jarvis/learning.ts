/**
 * Jarvis Learning Journal — Failure Memory + Error→Solution Pairs.
 * Learns from errors and user corrections, persists in .helixmind/jarvis/learnings.json.
 * Provides prompt injection for the agent loop so Jarvis never repeats the same mistake.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import type { LearningCategory, LearningEntry, LearningJournalData } from './types.js';

const EMPTY_DATA: LearningJournalData = {
  version: 1,
  nextId: 1,
  entries: [],
  lastDecayAt: Date.now(),
};

const DECAY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DECAY_FACTOR = 0.95;
const PRUNE_THRESHOLD = 0.1;
const MAX_PROMPT_TOKENS = 500;
const CONFIDENCE_INITIAL = 0.5;
const CONFIDENCE_SUCCESS_DELTA = 0.1;
const CONFIDENCE_FAILURE_DELTA = -0.15;
const SPIRAL_PROMOTION_THRESHOLD = 0.8;

export class LearningJournal {
  private data: LearningJournalData;
  private filePath: string;
  private onChange?: (event: string, entry: LearningEntry) => void;

  constructor(projectRoot: string, onChange?: (event: string, entry: LearningEntry) => void) {
    this.filePath = join(projectRoot, '.helixmind', 'jarvis', 'learnings.json');
    this.onChange = onChange;
    this.data = this.load();
    this.applyDecay();
  }

  // ─── Persistence ─────────────────────────────────────────────────────

  private load(): LearningJournalData {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as LearningJournalData;
        if (parsed.version === 1 && Array.isArray(parsed.entries)) return parsed;
      }
    } catch { /* corrupted — start fresh */ }
    return { ...EMPTY_DATA, entries: [], lastDecayAt: Date.now() };
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  // ─── Core Operations ─────────────────────────────────────────────────

  /**
   * Record a new learning from an error→solution pair.
   */
  recordLearning(
    errorPattern: string,
    solution: string,
    category: LearningCategory,
    context: string,
    tags: string[] = [],
  ): LearningEntry {
    const normalized = this.normalizeError(errorPattern);

    // Check for existing similar entry
    const existing = this.data.entries.find(e =>
      e.errorPattern === normalized && e.context === context,
    );
    if (existing) {
      existing.solution = solution;
      existing.successCount++;
      existing.confidence = Math.min(1.0, existing.confidence + CONFIDENCE_SUCCESS_DELTA);
      existing.lastUsedAt = Date.now();
      existing.tags = [...new Set([...existing.tags, ...tags])];
      this.save();
      this.onChange?.('learning_updated', existing);
      return existing;
    }

    const entry: LearningEntry = {
      id: this.data.nextId++,
      category,
      errorPattern: normalized,
      solution,
      context,
      confidence: CONFIDENCE_INITIAL,
      successCount: 0,
      failCount: 0,
      tags,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };

    this.data.entries.push(entry);
    this.save();
    this.onChange?.('learning_recorded', entry);
    return entry;
  }

  /**
   * Find relevant learnings for a given tool + input context.
   */
  queryRelevant(toolName: string, input: Record<string, unknown>, maxTokens: number = MAX_PROMPT_TOKENS): LearningEntry[] {
    const inputStr = JSON.stringify(input).toLowerCase();
    const filePath = (input.path as string) || '';
    const ext = filePath ? extname(filePath) : '';

    const scored = this.data.entries
      .filter(e => e.confidence >= PRUNE_THRESHOLD)
      .map(e => {
        let score = e.confidence;

        // Tool name match
        if (e.context.includes(toolName)) score += 0.3;

        // File extension match
        if (ext && e.context.includes(ext)) score += 0.2;

        // Tag overlap
        const inputTags = this.extractTags(inputStr);
        const overlap = e.tags.filter(t => inputTags.includes(t.toLowerCase())).length;
        score += overlap * 0.1;

        // Error pattern keyword match
        const errorWords = e.errorPattern.toLowerCase().split(/\s+/);
        const matchingWords = errorWords.filter(w => inputStr.includes(w)).length;
        score += (matchingWords / Math.max(errorWords.length, 1)) * 0.2;

        return { entry: e, score };
      })
      .filter(s => s.score > 0.3)
      .sort((a, b) => b.score - a.score);

    // Respect token limit
    const result: LearningEntry[] = [];
    let tokenCount = 0;
    for (const { entry } of scored) {
      const entryTokens = this.estimateTokens(entry);
      if (tokenCount + entryTokens > maxTokens) break;
      result.push(entry);
      tokenCount += entryTokens;
    }

    return result;
  }

  /**
   * Reinforce a learning as successful.
   */
  reinforceSuccess(id: number): void {
    const entry = this.data.entries.find(e => e.id === id);
    if (!entry) return;
    entry.successCount++;
    entry.confidence = Math.min(1.0, entry.confidence + CONFIDENCE_SUCCESS_DELTA);
    entry.lastUsedAt = Date.now();
    this.save();
    this.onChange?.('learning_reinforced', entry);
  }

  /**
   * Mark a learning as failed (solution didn't work).
   */
  reinforceFailure(id: number): void {
    const entry = this.data.entries.find(e => e.id === id);
    if (!entry) return;
    entry.failCount++;
    entry.confidence = Math.max(0, entry.confidence + CONFIDENCE_FAILURE_DELTA);
    entry.lastUsedAt = Date.now();
    this.save();
    this.onChange?.('learning_weakened', entry);
  }

  /**
   * Get a prompt section with relevant learnings for a tool call.
   * Max 500 tokens.
   */
  getPromptSection(toolName: string, input: Record<string, unknown>): string | null {
    const relevant = this.queryRelevant(toolName, input);
    if (relevant.length === 0) return null;

    const lines = ['[Learning Hints from past experience:]'];
    for (const entry of relevant) {
      lines.push(`- ${entry.category}: "${entry.errorPattern}" → Fix: ${entry.solution} (confidence: ${(entry.confidence * 100).toFixed(0)}%)`);
    }
    return lines.join('\n');
  }

  /**
   * Get a summary of top learnings for the system prompt.
   */
  getSummaryForPrompt(): string | null {
    const topEntries = this.data.entries
      .filter(e => e.confidence >= 0.6)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);

    if (topEntries.length === 0) return null;

    const lines = ['## Failure Memory (Learned Patterns)'];
    for (const e of topEntries) {
      lines.push(`- [${e.category}] "${e.errorPattern}" → ${e.solution} (${(e.confidence * 100).toFixed(0)}% confidence, used ${e.successCount}x)`);
    }
    lines.push(`\nTotal learnings: ${this.data.entries.length}, High-confidence (≥80%): ${this.data.entries.filter(e => e.confidence >= 0.8).length}`);
    return lines.join('\n');
  }

  /**
   * Get status line for statusbar.
   */
  getStatusLine(): string {
    const total = this.data.entries.length;
    if (total === 0) return '';
    const highConf = this.data.entries.filter(e => e.confidence >= 0.8).length;
    return `${total} learnings (${highConf} high-conf)`;
  }

  /**
   * Get entries ready for spiral promotion (confidence >= 0.8).
   */
  getPromotionCandidates(): LearningEntry[] {
    return this.data.entries.filter(e =>
      e.confidence >= SPIRAL_PROMOTION_THRESHOLD && !e.spiralNodeId,
    );
  }

  /**
   * Mark an entry as promoted to spiral.
   */
  markPromoted(id: number, spiralNodeId: string): void {
    const entry = this.data.entries.find(e => e.id === id);
    if (!entry) return;
    entry.spiralNodeId = spiralNodeId;
    this.save();
  }

  /**
   * Get a specific entry by ID.
   */
  get(id: number): LearningEntry | undefined {
    return this.data.entries.find(e => e.id === id);
  }

  /**
   * Get all entries.
   */
  getAll(): LearningEntry[] {
    return [...this.data.entries];
  }

  /**
   * Get entry count.
   */
  get count(): number {
    return this.data.entries.length;
  }

  /**
   * Set onChange callback (for late binding).
   */
  setOnChange(handler: (event: string, entry: LearningEntry) => void): void {
    this.onChange = handler;
  }

  // ─── Decay & Pruning ──────────────────────────────────────────────────

  /**
   * Apply time-based confidence decay. Called on load and periodically.
   */
  applyDecay(): void {
    const now = Date.now();
    const elapsed = now - this.data.lastDecayAt;
    const periods = Math.floor(elapsed / DECAY_INTERVAL_MS);

    if (periods <= 0) return;

    let changed = false;
    for (const entry of this.data.entries) {
      const newConf = entry.confidence * Math.pow(DECAY_FACTOR, periods);
      if (newConf !== entry.confidence) {
        entry.confidence = Math.round(newConf * 1000) / 1000; // avoid float drift
        changed = true;
      }
    }

    // Prune entries below threshold
    const before = this.data.entries.length;
    this.data.entries = this.data.entries.filter(e => e.confidence >= PRUNE_THRESHOLD);

    this.data.lastDecayAt = now;
    if (changed || this.data.entries.length !== before) {
      this.save();
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  /**
   * Normalize error patterns — strip paths, line numbers, timestamps.
   *
   * FIX: JARVIS-MEDIUM-2 — keep the last path segment (basename + ext) as
   * a feature. The previous implementation stripped the entire path,
   * collapsing unrelated errors like "Cannot find module 'foo.ts'" and
   * "Cannot find module 'bar.ts'" into the same normalized pattern. The
   * basename is a high-signal discriminator without leaking full paths.
   */
  private normalizeError(error: string): string {
    // Replace Unix paths but preserve the basename + extension.
    // /abc/def/file.ts → <path>/file.ts
    const unixPathRe = /(?:\/[\w\-.]+)+\/([\w\-.]+\.\w+)/g;
    const withBasenameUnix = error.replace(unixPathRe, '<path>/$1');
    // Then bare directory paths (no trailing .ext) → <path>
    const withNoExtUnix = withBasenameUnix.replace(/\/[\w\-./]+/g, '<path>');

    // Windows paths: C:\foo\bar\file.ts → <path>\file.ts, else <path>
    const winPathRe = /[A-Z]:\\(?:[\w\-.]+\\)+([\w\-.]+\.\w+)/gi;
    const withBasenameWin = withNoExtUnix.replace(winPathRe, '<path>\\$1');
    const withNoExtWin = withBasenameWin.replace(/[A-Z]:\\[\w\-.\\/]+/gi, '<path>');

    return withNoExtWin
      .replace(/:\d+:\d+/g, ':<line>')             // line:col
      .replace(/\b\d{10,13}\b/g, '<timestamp>')    // timestamps
      .replace(/\s+/g, ' ')                        // normalize whitespace
      .trim()
      .slice(0, 200);                              // cap length
  }

  private extractTags(input: string): string[] {
    const words = input.toLowerCase().split(/[\s,.;:{}()\[\]"']+/);
    return words.filter(w => w.length > 2 && w.length < 30);
  }

  private estimateTokens(entry: LearningEntry): number {
    const text = `${entry.category}: "${entry.errorPattern}" → ${entry.solution}`;
    return Math.ceil(text.length / 4); // rough estimate
  }
}
