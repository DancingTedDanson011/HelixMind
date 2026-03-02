import * as readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import { classifyCommand } from './sandbox.js';
import type { ToolPermissionRequest } from '../brain/control-protocol.js';

export type PermissionLevel = 'auto' | 'ask' | 'dangerous';

/** Timeout durations in milliseconds */
const TIMEOUT_ASK_MS = 10 * 60_000;     // 10 minutes for ask-level
const TIMEOUT_DANGER_MS = 15 * 60_000;  // 15 minutes for dangerous-level

/** Map tools to their default permission level */
const TOOL_PERMISSIONS: Record<string, PermissionLevel> = {
  // Auto-allow (read-only operations)
  read_file: 'auto',
  list_directory: 'auto',
  search_files: 'auto',
  find_files: 'auto',
  git_status: 'auto',
  git_log: 'auto',
  git_diff: 'auto',
  spiral_query: 'auto',

  // Ask user (write operations)
  edit_file: 'ask',
  write_file: 'ask',
  git_commit: 'ask',
  spiral_store: 'auto', // Auto — spiral stores are low-risk

  // Bug journal (safe — local metadata only)
  bug_report: 'auto',
  bug_list: 'auto',

  // Browser control (ask — opens external browser)
  browser_open: 'ask',
  browser_navigate: 'ask',
  browser_screenshot: 'ask',
  browser_click: 'ask',
  browser_type: 'ask',
  browser_close: 'auto', // Closing is always safe

  // Dangerous (shell execution)
  run_command: 'ask', // Upgraded to 'dangerous' based on command content
};

interface PendingRemoteEntry {
  resolve: (result: { approved: boolean; deniedBy?: 'user' | 'system_timeout' }) => void;
  timer: ReturnType<typeof setTimeout>;
  reminderTimer: ReturnType<typeof setTimeout>;
}

interface RemoteHandlerOpts {
  onRequest: (req: ToolPermissionRequest) => void;
  onReminder: (req: ToolPermissionRequest) => void;
  onResolved: (requestId: string, approved: boolean, deniedBy?: 'user' | 'system_timeout') => void;
}

export class PermissionManager {
  private yoloMode = false;
  private skipPermissionsMode = false;
  private rl: readline.Interface | null = null;
  private onPromptActive?: (active: boolean) => void;

  // Remote approval
  private pendingRemote = new Map<string, PendingRemoteEntry>();
  private remoteHandler: RemoteHandlerOpts | null = null;

  setReadline(rl: readline.Interface): void {
    this.rl = rl;
  }

  /** Callback to suppress statusbar while permission prompt is active */
  setPromptCallback(cb: (active: boolean) => void): void {
    this.onPromptActive = cb;
  }

  setYolo(enabled: boolean): void {
    this.yoloMode = enabled;
  }

  isYolo(): boolean {
    return this.yoloMode;
  }

  setSkipPermissions(enabled: boolean): void {
    this.skipPermissionsMode = enabled;
  }

  isSkipPermissions(): boolean {
    return this.skipPermissionsMode;
  }

  /** Get the current mode label for display */
  getModeLabel(): 'safe' | 'skip' | 'yolo' {
    if (this.yoloMode) return 'yolo';
    if (this.skipPermissionsMode) return 'skip';
    return 'safe';
  }

  /** Register remote approval handler (Brain server, Telegram, etc.) */
  setRemoteHandler(opts: RemoteHandlerOpts): void {
    this.remoteHandler = opts;
  }

  /** Resolve a pending remote permission request (called from WebSocket/Telegram handler) */
  resolveRemote(requestId: string, approved: boolean, deniedBy: 'user' | 'system_timeout' = 'user'): void {
    const entry = this.pendingRemote.get(requestId);
    if (!entry) return;

    clearTimeout(entry.timer);
    clearTimeout(entry.reminderTimer);
    this.pendingRemote.delete(requestId);
    entry.resolve({ approved, deniedBy });
  }

  /** Clean up all pending remote requests (e.g. on session end) */
  clearPending(): void {
    for (const [id, entry] of this.pendingRemote) {
      clearTimeout(entry.timer);
      clearTimeout(entry.reminderTimer);
      this.pendingRemote.delete(id);
      entry.resolve({ approved: false, deniedBy: 'system_timeout' });
    }
  }

  /**
   * Check if a tool call is allowed.
   * Returns true if allowed, false if denied.
   */
  async check(
    toolName: string,
    input: Record<string, unknown>,
    displayFn: (msg: string) => void,
  ): Promise<boolean> {
    let level = TOOL_PERMISSIONS[toolName] ?? 'ask';

    // Upgrade run_command based on command content
    if (toolName === 'run_command' && typeof input.command === 'string') {
      const cmdLevel = classifyCommand(input.command);
      if (cmdLevel === 'dangerous') level = 'dangerous';
      else if (cmdLevel === 'ask') level = 'ask';
    }

    // Auto-allow
    if (level === 'auto') return true;

    // YOLO mode: auto-allow everything, even dangerous
    if (this.yoloMode) return true;

    // Skip-permissions mode: auto-allow 'ask' level, still prompt for 'dangerous'
    if (this.skipPermissionsMode && level !== 'dangerous') return true;

    // Ask user with full context about what's being done
    return this.promptUser(toolName, input, level, displayFn);
  }

  private async promptUser(
    toolName: string,
    input: Record<string, unknown>,
    level: PermissionLevel,
    displayFn: (msg: string) => void,
  ): Promise<boolean> {
    if (!this.rl) return true; // No readline = non-interactive, allow

    const defaultYes = level !== 'dangerous';

    // Build detailed context about what the tool wants to do
    const detail = this.formatToolDetail(toolName, input);
    const levelTag = level === 'dangerous' ? '\x1b[31m\u26A0 DANGEROUS\x1b[0m' : '\x1b[33m\u270F\uFE0F  WRITE\x1b[0m';

    process.stdout.write('\n');
    process.stdout.write(`  \x1b[2m\u250C\u2500 ${levelTag} \x1b[2m\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\x1b[0m\n`);
    process.stdout.write(`  \x1b[2m\u2502\x1b[0m ${detail}\n`);
    process.stdout.write(`  \x1b[2m\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\x1b[0m\n`);

    // Show options
    const yKey = defaultYes ? 'Y' : 'y';
    const nKey = defaultYes ? 'n' : 'N';
    process.stdout.write(`  [${yKey}] Allow  [${nKey}] Deny  \x1b[2m[s] Skip once  [a] Always skip\x1b[0m\n`);
    process.stdout.write(`  \x1b[2m[!s] --skip-permissions  [!y] --yolo mode\x1b[0m\n`);

    // Create remote permission promise (if remote handler is set)
    let remotePromise: Promise<{ approved: boolean; deniedBy?: 'user' | 'system_timeout' }> | null = null;
    let requestId: string | null = null;

    if (this.remoteHandler) {
      const timeoutMs = level === 'dangerous' ? TIMEOUT_DANGER_MS : TIMEOUT_ASK_MS;
      const now = Date.now();
      requestId = randomUUID();

      const req: ToolPermissionRequest = {
        id: requestId,
        toolName,
        toolInput: input,
        permissionLevel: level as 'ask' | 'dangerous',
        detail: this.formatToolDetailPlain(toolName, input),
        sessionId: 'main',
        timestamp: now,
        expiresAt: now + timeoutMs,
        reminderAt: now + Math.floor(timeoutMs / 2),
      };

      remotePromise = new Promise((resolve) => {
        const timer = setTimeout(() => {
          this.pendingRemote.delete(requestId!);
          resolve({ approved: false, deniedBy: 'system_timeout' });
          this.remoteHandler?.onResolved(requestId!, false, 'system_timeout');
        }, timeoutMs);

        const reminderTimer = setTimeout(() => {
          this.remoteHandler?.onReminder(req);
        }, Math.floor(timeoutMs / 2));

        this.pendingRemote.set(requestId!, { resolve, timer, reminderTimer });
      });

      // Push request to all channels
      this.remoteHandler.onRequest(req);

      if (this.remoteHandler) {
        process.stdout.write(`  \x1b[2m\u{1F4F1} Also sent to remote channels (Web/Telegram)\x1b[0m\n`);
      }
    }

    // Race: local readline vs remote response
    const localPromise = this.askLocal(defaultYes);

    if (remotePromise && requestId) {
      const rid = requestId;
      const result = await Promise.race([
        localPromise.then(approved => ({ approved, deniedBy: 'user' as const, source: 'local' as const })),
        remotePromise.then(r => ({ ...r, source: 'remote' as const })),
      ]);

      // Clean up the losing side
      if (result.source === 'local') {
        // Local won — clean up remote
        const entry = this.pendingRemote.get(rid);
        if (entry) {
          clearTimeout(entry.timer);
          clearTimeout(entry.reminderTimer);
          this.pendingRemote.delete(rid);
        }
        this.remoteHandler?.onResolved(rid, result.approved, 'user');
      }
      // If remote won, readline is still waiting but that's okay — it'll just be ignored

      if (result.source === 'remote') {
        const label = result.approved ? '\x1b[32m\u2705 Approved remotely\x1b[0m' : '\x1b[31m\u274C Denied remotely\x1b[0m';
        process.stdout.write(`\n  ${label}\n`);
      }

      return result.approved;
    }

    // No remote handler — just use local
    return localPromise;
  }

  /** Handle local readline input and return approval boolean */
  private async askLocal(defaultYes: boolean): Promise<boolean> {
    const answer = await this.ask('  > ');
    const trimmed = answer.trim().toLowerCase();

    switch (trimmed) {
      case '':
        return defaultYes;
      case 'y': case 'yes':
        return true;
      case 'n': case 'no':
        return false;
      case 's':
        // Skip once — allow just this one
        return true;
      case 'a':
        // Always skip — enable skip-permissions for this session
        this.skipPermissionsMode = true;
        process.stdout.write('  \x1b[33m\u26A1 Skip-permissions enabled for this session\x1b[0m\n');
        return true;
      case '!s': {
        // Double confirmation for skip-permissions mode
        const confirm = await this.ask('  \x1b[33m\u26A0 Enable --skip-permissions? (y/N)\x1b[0m > ');
        if (confirm.trim().toLowerCase() === 'y') {
          this.skipPermissionsMode = true;
          process.stdout.write('  \x1b[33m\u26A1 --skip-permissions mode enabled\x1b[0m\n');
          return true;
        }
        return false;
      }
      case '!y': {
        // Double confirmation for YOLO mode
        const confirm = await this.ask('  \x1b[31m\u26A0 Enable --yolo (ALL permissions skipped)? (y/N)\x1b[0m > ');
        if (confirm.trim().toLowerCase() === 'y') {
          this.yoloMode = true;
          process.stdout.write('  \x1b[31m\u{1F525} YOLO mode enabled \u2014 no more confirmations\x1b[0m\n');
          return true;
        }
        return false;
      }
      default:
        return defaultYes;
    }
  }

  /** Ask a single question via readline, suppressing statusbar during input */
  private ask(prompt: string): Promise<string> {
    return new Promise<string>((resolve) => {
      this.onPromptActive?.(true);
      this.rl!.question(prompt, (answer) => {
        this.onPromptActive?.(false);
        resolve(answer);
      });
    });
  }

  /** Format a human-readable description of what a tool call does (with ANSI colors) */
  private formatToolDetail(name: string, input: Record<string, unknown>): string {
    switch (name) {
      case 'write_file': {
        const path = String(input.path || '');
        const content = String(input.content || '');
        const lines = content.split('\n').length;
        return `\x1b[1mWrite file\x1b[0m \x1b[36m${path}\x1b[0m \x1b[2m(${lines} lines)\x1b[0m`;
      }
      case 'edit_file': {
        const path = String(input.path || '');
        const oldStr = String(input.old_string || '').slice(0, 60).replace(/\n/g, '\\n');
        const newStr = String(input.new_string || '').slice(0, 60).replace(/\n/g, '\\n');
        return `\x1b[1mEdit file\x1b[0m \x1b[36m${path}\x1b[0m\n  \x1b[2m\u2502\x1b[0m  \x1b[31m- ${oldStr}${String(input.old_string || '').length > 60 ? '\u2026' : ''}\x1b[0m\n  \x1b[2m\u2502\x1b[0m  \x1b[32m+ ${newStr}${String(input.new_string || '').length > 60 ? '\u2026' : ''}\x1b[0m`;
      }
      case 'run_command': {
        const cmd = String(input.command || '');
        return `\x1b[1mRun command\x1b[0m \x1b[33m$ ${cmd}\x1b[0m`;
      }
      case 'git_commit': {
        const msg = String(input.message || '');
        return `\x1b[1mGit commit\x1b[0m \x1b[36m"${msg}"\x1b[0m`;
      }
      default: {
        const summary = Object.entries(input)
          .map(([k, v]) => `${k}: ${String(v).slice(0, 50)}`)
          .join(', ');
        return `\x1b[1m${name}\x1b[0m \x1b[2m${summary.slice(0, 100)}\x1b[0m`;
      }
    }
  }

  /** Format a plain-text description (no ANSI) for remote channels (Telegram, Web) */
  formatToolDetailPlain(name: string, input: Record<string, unknown>): string {
    switch (name) {
      case 'write_file': {
        const path = String(input.path || '');
        const content = String(input.content || '');
        const lines = content.split('\n').length;
        return `Write file ${path} (${lines} lines)`;
      }
      case 'edit_file': {
        const path = String(input.path || '');
        const oldStr = String(input.old_string || '').slice(0, 60).replace(/\n/g, '\\n');
        const newStr = String(input.new_string || '').slice(0, 60).replace(/\n/g, '\\n');
        return `Edit file ${path}\n- ${oldStr}${String(input.old_string || '').length > 60 ? '\u2026' : ''}\n+ ${newStr}${String(input.new_string || '').length > 60 ? '\u2026' : ''}`;
      }
      case 'run_command': {
        const cmd = String(input.command || '');
        return `Run command: $ ${cmd}`;
      }
      case 'git_commit': {
        const msg = String(input.message || '');
        return `Git commit "${msg}"`;
      }
      default: {
        const summary = Object.entries(input)
          .map(([k, v]) => `${k}: ${String(v).slice(0, 50)}`)
          .join(', ');
        return `${name} ${summary.slice(0, 100)}`;
      }
    }
  }
}
