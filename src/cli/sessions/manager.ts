/**
 * SessionManager — manages multiple concurrent agent sessions.
 *
 * Background tasks (/security, /auto) run in their own Session, so the
 * user gets the prompt back immediately and can continue chatting.
 * Sessions are displayed as terminal tabs (tab-view.ts).
 */
import { randomUUID } from 'node:crypto';
import { Session, type SessionResult, type SessionStatus } from './session.js';
import type { ToolMessage } from '../providers/types.js';
import { renderTabBar } from './tab-view.js';

export interface SessionManagerOptions {
  flags: { yolo: boolean; skipPermissions: boolean };
  onSessionComplete?: (session: Session) => void;
  onSessionError?: (session: Session, error: string) => void;
  /** Called when a tab is auto-closed after completion (for UI refresh) */
  onSessionAutoClose?: (session: Session) => void;
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  private _activeId: string;
  private readonly mainId: string;
  private opts: SessionManagerOptions;
  private completionListeners: Array<(session: Session) => void> = [];
  private autoCloseTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Time to wait before auto-closing a finished background tab (5 minutes) */
  private static readonly AUTO_CLOSE_DELAY_MS = 300_000;

  constructor(opts: SessionManagerOptions) {
    this.opts = opts;

    // Create the main (interactive) session — always exists
    const main = new Session('main', 'Chat', '\u{1F4AC}', opts.flags);
    main.status = 'running';
    main.startTime = Date.now();
    this.sessions.set('main', main);
    this._activeId = 'main';
    this.mainId = 'main';
  }

  /** The session the user is currently viewing */
  get active(): Session {
    return this.sessions.get(this._activeId)!;
  }

  get activeId(): string {
    return this._activeId;
  }

  /** The main interactive session */
  get main(): Session {
    return this.sessions.get(this.mainId)!;
  }

  /** All sessions in creation order */
  get all(): Session[] {
    return [...this.sessions.values()];
  }

  /** Background sessions (everything except main) */
  get background(): Session[] {
    return this.all.filter(s => s.id !== this.mainId);
  }

  /** Running background sessions */
  get running(): Session[] {
    return this.background.filter(s => s.status === 'running');
  }

  /** Create a new background session */
  create(
    name: string,
    icon: string,
    baseHistory?: ToolMessage[],
  ): Session {
    const id = randomUUID().slice(0, 8);
    const session = new Session(id, name, icon, this.opts.flags, baseHistory);
    this.sessions.set(id, session);
    return session;
  }

  /** Switch the active (viewed) session — cancels auto-close for the target */
  switchTo(id: string): boolean {
    if (!this.sessions.has(id)) return false;
    this._activeId = id;
    // User is looking at it → don't auto-close
    this.cancelAutoClose(id);
    return true;
  }

  /** Switch to main session */
  switchToMain(): void {
    this._activeId = this.mainId;
  }

  /** Switch to next session (cycle) */
  switchNext(): void {
    const ids = [...this.sessions.keys()];
    const idx = ids.indexOf(this._activeId);
    const next = (idx + 1) % ids.length;
    this._activeId = ids[next];
  }

  /** Switch to previous session (cycle) */
  switchPrev(): void {
    const ids = [...this.sessions.keys()];
    const idx = ids.indexOf(this._activeId);
    const prev = (idx - 1 + ids.length) % ids.length;
    this._activeId = ids[prev];
  }

  /** Mark a session as completed — starts auto-close timer for background tabs */
  complete(id: string, result: SessionResult): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.complete(result);
    this.opts.onSessionComplete?.(session);
    this.completionListeners.forEach(fn => fn(session));

    // Auto-close background tabs after delay
    if (id !== this.mainId) {
      this.scheduleAutoClose(id);
    }
  }

  /** Abort a session */
  abort(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.abort();
  }

  /** Abort all background sessions */
  abortAll(): void {
    for (const session of this.background) {
      if (session.status === 'running') {
        session.abort();
      }
    }
  }

  /** Remove a completed/errored session */
  remove(id: string): boolean {
    if (id === this.mainId) return false;
    const session = this.sessions.get(id);
    if (!session) return false;
    if (session.status === 'running') {
      session.abort();
    }
    // Cancel pending auto-close timer
    const timer = this.autoCloseTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.autoCloseTimers.delete(id);
    }
    this.sessions.delete(id);
    if (this._activeId === id) {
      this._activeId = this.mainId;
    }
    return true;
  }

  /** Schedule auto-close for a finished background session */
  private scheduleAutoClose(id: string): void {
    // Cancel any existing timer
    const existing = this.autoCloseTimers.get(id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.autoCloseTimers.delete(id);
      const session = this.sessions.get(id);
      if (!session) return;
      // Only auto-close if not currently being viewed and not running
      if (session.status !== 'running' && this._activeId !== id) {
        this.sessions.delete(id);
        this.opts.onSessionAutoClose?.(session);
      }
    }, SessionManager.AUTO_CLOSE_DELAY_MS);

    this.autoCloseTimers.set(id, timer);
  }

  /** Cancel auto-close (e.g. when user switches to the tab) */
  cancelAutoClose(id: string): void {
    const timer = this.autoCloseTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.autoCloseTimers.delete(id);
    }
  }

  /** Get a session by ID */
  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /** Find session by name (partial match) */
  findByName(query: string): Session | undefined {
    const lower = query.toLowerCase();
    return this.all.find(s => s.name.toLowerCase().includes(lower));
  }

  /** Listen for session completion */
  onComplete(listener: (session: Session) => void): void {
    this.completionListeners.push(listener);
  }

  /** Check if there are running background tasks */
  get hasBackgroundTasks(): boolean {
    return this.running.length > 0;
  }

  /** Render the tab bar */
  renderTabs(): string {
    return renderTabBar(this.all, this._activeId);
  }

  /** Get summary of all sessions for display */
  getSummary(): string[] {
    return this.all.map(s => {
      const statusIcon = s.status === 'running' ? '\u{1F504}'
        : s.status === 'done' ? '\u2705'
        : s.status === 'error' ? '\u274C'
        : s.status === 'paused' ? '\u23F8\uFE0F'
        : '\u23F9';
      const elapsed = s.elapsed > 0
        ? ` (${Math.round(s.elapsed / 1000)}s)`
        : '';
      return `${statusIcon} ${s.icon} ${s.name}${elapsed}`;
    });
  }
}
