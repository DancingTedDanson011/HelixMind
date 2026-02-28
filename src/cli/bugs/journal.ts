import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { BugEntry, BugEvidence, BugJournalData, BugStatus } from './types.js';

const EMPTY_DATA: BugJournalData = { version: 1, nextId: 1, bugs: [] };

export class BugJournal {
  private data: BugJournalData;
  private filePath: string;
  private onChange?: (event: string, bug: BugEntry) => void;

  constructor(projectRoot: string, onChange?: (event: string, bug: BugEntry) => void) {
    this.filePath = join(projectRoot, '.helixmind', 'bugs.json');
    this.onChange = onChange;
    this.data = this.load();
  }

  private load(): BugJournalData {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as BugJournalData;
        if (parsed.version === 1 && Array.isArray(parsed.bugs)) {
          return parsed;
        }
      }
    } catch {
      // Corrupted file — start fresh
    }
    return { ...EMPTY_DATA, bugs: [] };
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  create(description: string, opts?: {
    file?: string;
    line?: number;
    evidence?: BugEvidence[];
    relatedFiles?: string[];
  }): BugEntry {
    const bug: BugEntry = {
      id: this.data.nextId++,
      description,
      file: opts?.file,
      line: opts?.line,
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      evidence: opts?.evidence ?? [],
      relatedFiles: opts?.relatedFiles ?? [],
    };
    this.data.bugs.push(bug);
    this.save();
    this.onChange?.('bug_created', bug);
    return bug;
  }

  get(id: number): BugEntry | undefined {
    return this.data.bugs.find(b => b.id === id);
  }

  update(id: number, updates: Partial<Pick<BugEntry, 'description' | 'status' | 'file' | 'line' | 'fixDescription'>>): BugEntry | undefined {
    const bug = this.data.bugs.find(b => b.id === id);
    if (!bug) return undefined;

    if (updates.description !== undefined) bug.description = updates.description;
    if (updates.file !== undefined) bug.file = updates.file;
    if (updates.line !== undefined) bug.line = updates.line;
    if (updates.fixDescription !== undefined) bug.fixDescription = updates.fixDescription;
    if (updates.status !== undefined) {
      bug.status = updates.status;
      if (updates.status === 'fixed') bug.fixedAt = Date.now();
      if (updates.status === 'verified') bug.verifiedAt = Date.now();
    }
    bug.updatedAt = Date.now();
    this.save();
    this.onChange?.('bug_updated', bug);
    return bug;
  }

  addEvidence(id: number, evidence: BugEvidence): BugEntry | undefined {
    const bug = this.data.bugs.find(b => b.id === id);
    if (!bug) return undefined;

    bug.evidence.push(evidence);
    bug.updatedAt = Date.now();
    this.save();
    this.onChange?.('bug_updated', bug);
    return bug;
  }

  addRelatedFile(id: number, filePath: string): BugEntry | undefined {
    const bug = this.data.bugs.find(b => b.id === id);
    if (!bug) return undefined;

    if (!bug.relatedFiles.includes(filePath)) {
      bug.relatedFiles.push(filePath);
      bug.updatedAt = Date.now();
      this.save();
    }
    return bug;
  }

  markFixed(id: number, fixDescription?: string): BugEntry | undefined {
    return this.update(id, { status: 'fixed', fixDescription });
  }

  markVerified(id: number): BugEntry | undefined {
    return this.update(id, { status: 'verified' });
  }

  getByStatus(status: BugStatus): BugEntry[] {
    return this.data.bugs.filter(b => b.status === status);
  }

  getOpenBugs(): BugEntry[] {
    return this.data.bugs.filter(b => b.status === 'open' || b.status === 'investigating');
  }

  getAllBugs(): BugEntry[] {
    return [...this.data.bugs];
  }

  get count(): number {
    return this.data.bugs.length;
  }

  get openCount(): number {
    return this.getOpenBugs().length;
  }

  /**
   * Build a summary string for injection into the system prompt.
   * Keeps it concise so it doesn't waste context budget.
   */
  getSummaryForPrompt(): string | null {
    if (this.data.bugs.length === 0) return null;

    const open = this.getByStatus('open');
    const investigating = this.getByStatus('investigating');
    const fixed = this.getByStatus('fixed');

    if (open.length === 0 && investigating.length === 0 && fixed.length === 0) return null;

    const lines: string[] = ['## Bug Journal'];

    if (open.length > 0) {
      lines.push(`\nOpen bugs (${open.length}):`);
      for (const bug of open) {
        const loc = bug.file ? ` (${bug.file}${bug.line ? ':' + bug.line : ''})` : '';
        lines.push(`- #${bug.id}: ${bug.description}${loc}`);
      }
    }

    if (investigating.length > 0) {
      lines.push(`\nInvestigating (${investigating.length}):`);
      for (const bug of investigating) {
        const loc = bug.file ? ` (${bug.file}${bug.line ? ':' + bug.line : ''})` : '';
        lines.push(`- #${bug.id}: ${bug.description}${loc}`);
      }
    }

    if (fixed.length > 0) {
      lines.push(`\nFixed (awaiting verification, ${fixed.length}):`);
      for (const bug of fixed.slice(0, 5)) {
        lines.push(`- #${bug.id}: ${bug.description} — ${bug.fixDescription || 'no description'}`);
      }
    }

    lines.push('\nUse bug_report tool to update bug status. When you fix a bug, mark it as fixed with a description.');

    return lines.join('\n');
  }

  /**
   * Short status line for the status bar.
   */
  /** Set or replace the onChange callback (useful when brain server starts after construction) */
  setOnChange(handler: (event: string, bug: BugEntry) => void): void {
    this.onChange = handler;
  }

  getStatusLine(): string {
    const open = this.getByStatus('open').length;
    const investigating = this.getByStatus('investigating').length;
    const fixed = this.getByStatus('fixed').length;
    const verified = this.getByStatus('verified').length;

    if (open + investigating + fixed === 0 && verified === 0) return '';

    const parts: string[] = [];
    if (open > 0) parts.push(`${open} open`);
    if (investigating > 0) parts.push(`${investigating} investigating`);
    if (fixed > 0) parts.push(`${fixed} fixed`);
    if (verified > 0) parts.push(`${verified} verified`);
    return parts.join(', ');
  }
}
