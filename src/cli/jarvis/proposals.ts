/**
 * Proposal Journal — Jarvis never acts directly, he proposes.
 * User approves or denies. Jarvis learns from denials.
 * Follows the BugJournal pattern (src/cli/bugs/journal.ts).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type {
  ProposalEntry, ProposalStatus, ProposalCategory, ProposalSource,
  ProposalEvidence, ProposalJournalData, DenialPattern, JarvisTask,
} from './types.js';

const EMPTY_DATA: ProposalJournalData = {
  version: 1, nextId: 1, proposals: [], denialPatterns: [],
};

const DENIAL_PATTERN_THRESHOLD = 3;  // after 3 similar denials, filter future proposals
const MAX_PROPOSALS_KEPT = 200;      // keep last 200 proposals (older are pruned)

export class ProposalJournal {
  private data: ProposalJournalData;
  private filePath: string;
  private onChange?: (event: string, proposal: ProposalEntry) => void;
  private onConvertToTask?: (proposal: ProposalEntry) => JarvisTask | undefined;

  constructor(
    projectRoot: string,
    onChange?: (event: string, proposal: ProposalEntry) => void,
  ) {
    this.filePath = join(projectRoot, '.helixmind', 'jarvis', 'proposals.json');
    this.onChange = onChange;
    this.data = this.load();
  }

  private load(): ProposalJournalData {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as ProposalJournalData;
        if (parsed.version === 1 && Array.isArray(parsed.proposals)) {
          return parsed;
        }
      }
    } catch {
      // Corrupted file — start fresh
    }
    return { ...EMPTY_DATA, proposals: [], denialPatterns: [] };
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Prune old resolved proposals to prevent unbounded growth
    if (this.data.proposals.length > MAX_PROPOSALS_KEPT) {
      const resolved = this.data.proposals.filter(p =>
        p.status !== 'pending' && p.status !== 'approved'
      );
      if (resolved.length > MAX_PROPOSALS_KEPT / 2) {
        // Remove oldest resolved proposals
        resolved.sort((a, b) => a.createdAt - b.createdAt);
        const toRemove = new Set(resolved.slice(0, resolved.length - MAX_PROPOSALS_KEPT / 2).map(p => p.id));
        this.data.proposals = this.data.proposals.filter(p => !toRemove.has(p.id));
      }
    }

    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  /**
   * Create a new proposal.
   * Returns null if it would likely be denied (based on DenialPatterns).
   */
  create(
    title: string,
    description: string,
    rationale: string,
    opts?: Partial<Pick<ProposalEntry,
      'category' | 'source' | 'impact' | 'risk' | 'affectedFiles' | 'evidence'
    >>,
  ): ProposalEntry {
    const proposal: ProposalEntry = {
      id: this.data.nextId++,
      title,
      description,
      rationale,
      category: opts?.category ?? 'feature',
      source: opts?.source ?? 'thinking_medium',
      status: 'pending',
      impact: opts?.impact ?? 'medium',
      risk: opts?.risk ?? 'low',
      affectedFiles: opts?.affectedFiles ?? [],
      evidence: opts?.evidence ?? [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.data.proposals.push(proposal);
    this.save();
    this.onChange?.('proposal_created', proposal);
    return proposal;
  }

  /**
   * Approve a proposal — converts it to a JarvisTask.
   * Returns the proposal (caller should enqueue the task).
   */
  approve(id: number): ProposalEntry | undefined {
    const proposal = this.data.proposals.find(p => p.id === id);
    if (!proposal || proposal.status !== 'pending') return undefined;

    proposal.status = 'approved';
    proposal.resolvedAt = Date.now();
    proposal.updatedAt = Date.now();
    this.save();
    this.onChange?.('proposal_approved', proposal);
    return proposal;
  }

  /**
   * Deny a proposal — records the denial pattern for learning.
   */
  deny(id: number, reason: string): ProposalEntry | undefined {
    const proposal = this.data.proposals.find(p => p.id === id);
    if (!proposal || proposal.status !== 'pending') return undefined;

    proposal.status = 'denied';
    proposal.denialReason = reason;
    proposal.resolvedAt = Date.now();
    proposal.updatedAt = Date.now();

    // Record denial pattern for learning
    this.recordDenialPattern(proposal, reason);

    this.save();
    this.onChange?.('proposal_denied', proposal);
    return proposal;
  }

  /**
   * Check if a proposal in this category/files would likely be denied.
   * Based on accumulated denial patterns.
   */
  wouldLikelyBeDenied(category: ProposalCategory, files: string[]): boolean {
    for (const pattern of this.data.denialPatterns) {
      if (pattern.category !== category) continue;
      if (pattern.count < DENIAL_PATTERN_THRESHOLD) continue;

      // Check if any affected files match the denial pattern
      if (pattern.filePatterns.length === 0) {
        // Category-wide denial pattern
        return true;
      }

      const filesMatch = files.some(f =>
        pattern.filePatterns.some(fp => f.includes(fp))
      );
      if (filesMatch) return true;
    }
    return false;
  }

  /**
   * Get a proposal by ID.
   */
  get(id: number): ProposalEntry | undefined {
    return this.data.proposals.find(p => p.id === id);
  }

  /**
   * Get proposals by status.
   */
  getByStatus(status: ProposalStatus): ProposalEntry[] {
    return this.data.proposals.filter(p => p.status === status);
  }

  /**
   * Get all pending proposals.
   */
  getPending(): ProposalEntry[] {
    return this.getByStatus('pending');
  }

  /**
   * Get all proposals.
   */
  getAll(): ProposalEntry[] {
    return [...this.data.proposals];
  }

  /**
   * Get denial patterns for prompt injection (helps Jarvis avoid bad proposals).
   */
  getDenialPatterns(): DenialPattern[] {
    return [...this.data.denialPatterns];
  }

  /**
   * Build a summary for system prompt injection.
   */
  getSummaryForPrompt(): string | null {
    const pending = this.getPending();
    const recentDenials = this.data.proposals
      .filter(p => p.status === 'denied')
      .sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0))
      .slice(0, 5);

    if (pending.length === 0 && recentDenials.length === 0 && this.data.denialPatterns.length === 0) {
      return null;
    }

    const lines: string[] = ['## Jarvis Proposals'];

    if (pending.length > 0) {
      lines.push(`\nPending proposals (${pending.length}):`);
      for (const p of pending) {
        lines.push(`- #${p.id}: ${p.title} [${p.category}/${p.impact}]`);
      }
    }

    if (recentDenials.length > 0) {
      lines.push(`\nRecent denials (learn from these):`);
      for (const p of recentDenials) {
        lines.push(`- #${p.id}: ${p.title} — denied: ${p.denialReason || 'no reason'}`);
      }
    }

    if (this.data.denialPatterns.length > 0) {
      const active = this.data.denialPatterns.filter(dp => dp.count >= DENIAL_PATTERN_THRESHOLD);
      if (active.length > 0) {
        lines.push(`\nAvoid these proposal types (repeatedly denied):`);
        for (const dp of active) {
          const files = dp.filePatterns.length > 0 ? ` in [${dp.filePatterns.join(', ')}]` : '';
          lines.push(`- ${dp.category}${files}: ${dp.reason} (denied ${dp.count}x)`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Short status line for display.
   */
  getStatusLine(): string {
    const pending = this.getPending().length;
    const approved = this.getByStatus('approved').length;
    const denied = this.getByStatus('denied').length;

    if (pending + approved + denied === 0) return '';

    const parts: string[] = [];
    if (pending > 0) parts.push(`${pending} pending`);
    if (approved > 0) parts.push(`${approved} approved`);
    if (denied > 0) parts.push(`${denied} denied`);
    return parts.join(', ');
  }

  /**
   * Get approval rate (0.0-1.0).
   */
  getApprovalRate(): number {
    const resolved = this.data.proposals.filter(p =>
      p.status === 'approved' || p.status === 'denied'
    );
    if (resolved.length === 0) return 0;
    const approved = resolved.filter(p => p.status === 'approved').length;
    return approved / resolved.length;
  }

  get count(): number {
    return this.data.proposals.length;
  }

  get pendingCount(): number {
    return this.getPending().length;
  }

  /**
   * Set or replace the onChange callback.
   */
  setOnChange(handler: (event: string, proposal: ProposalEntry) => void): void {
    this.onChange = handler;
  }

  /**
   * Set callback for converting approved proposals to tasks.
   */
  setOnConvertToTask(handler: (proposal: ProposalEntry) => JarvisTask | undefined): void {
    this.onConvertToTask = handler;
  }

  // ─── Internal ───────────────────────────────────────────────────────

  private recordDenialPattern(proposal: ProposalEntry, reason: string): void {
    // Extract directory-level patterns from affected files
    const filePatterns = proposal.affectedFiles.map(f => {
      const parts = f.split('/');
      return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    }).filter(Boolean);

    // Find or create matching pattern
    const existing = this.data.denialPatterns.find(dp =>
      dp.category === proposal.category &&
      dp.filePatterns.sort().join(',') === filePatterns.sort().join(',')
    );

    if (existing) {
      existing.count++;
      existing.lastDeniedAt = Date.now();
      // Update reason to the latest one
      existing.reason = reason;
    } else {
      this.data.denialPatterns.push({
        category: proposal.category,
        filePatterns,
        reason,
        count: 1,
        lastDeniedAt: Date.now(),
      });
    }
  }
}
