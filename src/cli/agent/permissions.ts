import * as readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import { classifyCommand } from './sandbox.js';
import type { ToolPermissionRequest } from '../brain/control-protocol.js';
import { selectMenu, type MenuItem } from '../ui/select-menu.js';
import chalk from 'chalk';

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

/** Permission choice result */
interface PermissionChoice {
  approved: boolean;
  mode?: 'once' | 'session' | 'yolo';
}

export class PermissionManager {
  private yoloMode = false;
  private skipPermissionsMode = false;
  private _planMode = false;
  private rl: readline.Interface | null = null;
  private onPromptActive?: (active: boolean) => void;

  // Remote approval
  private pendingRemote = new Map<string, PendingRemoteEntry>();
  private remoteHandler: RemoteHandlerOpts | null = null;

  // Enterprise: Use select menu instead of text input
  private useSelectMenu = true;

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

  /** Enable/disable select menu mode (Enterprise feature) */
  setSelectMenuMode(enabled: boolean): void {
    this.useSelectMenu = enabled;
  }

  /** Enable/disable plan mode (read-only — blocks write/execute tools) */
  setPlanMode(enabled: boolean): void {
    this._planMode = enabled;
  }

  isPlanMode(): boolean {
    return this._planMode;
  }

  /** Get the current mode label for display */
  getModeLabel(): 'safe' | 'skip' | 'yolo' | 'plan' {
    if (this._planMode) return 'plan';
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

    // SECURITY: Remote clients cannot escalate permission modes (YOLO/skip).
    // Permission mode changes must originate from the local terminal only.

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
   * Check permission for external path access.
   * Always treated as 'dangerous' level — user MUST confirm.
   * Only YOLO mode auto-allows; skip-permissions still prompts.
   */
  async checkExternalAccess(
    toolName: string,
    externalPath: string,
    input: Record<string, unknown>,
    displayFn: (msg: string) => void,
  ): Promise<boolean> {
    if (this.yoloMode) return true;

    // External access is always dangerous-level — skip-permissions does NOT auto-allow
    return this.promptUser(toolName, {
      ...input,
      __externalPath: externalPath,
    }, 'dangerous', displayFn);
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
    // Plan mode: only allow read-only tools, silently deny writes
    if (this._planMode) {
      const readOnlyTools = new Set([
        'read_file', 'list_directory', 'search_files', 'find_files',
        'git_status', 'git_log', 'git_diff', 'spiral_query', 'bug_list',
      ]);
      if (!readOnlyTools.has(toolName)) {
        return false; // Silent deny — plan mode is read-only
      }
      return true;
    }

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
    if (!this.rl) return false; // No readline = non-interactive, deny for safety

    const defaultYes = level !== 'dangerous';

    // Build detailed context about what the tool wants to do
    const detail = this.formatToolDetail(toolName, input);
    const levelTag = level === 'dangerous' 
      ? chalk.red.bold('⚠ DANGEROUS') 
      : chalk.yellow.bold('✏️ WRITE');

    // Enterprise: Display header
    process.stdout.write('\n');
    process.stdout.write(chalk.dim('  ┌─────────────────────────────────────────────────────────────\n'));
    process.stdout.write(`  │ ${levelTag} ${chalk.dim('────────────────────────────────────────────')}\n`);
    process.stdout.write(`  │ ${detail}\n`);
    process.stdout.write(chalk.dim('  └─────────────────────────────────────────────────────────────\n'));

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
        process.stdout.write(chalk.dim('  📱 Also sent to remote channels (Web/Telegram)\n'));
      }
    }

    // Enterprise: Use select menu instead of text input
    const localPromise = this.useSelectMenu 
      ? this.promptWithSelectMenu(level, defaultYes)
      : this.askLocal(defaultYes);

    if (remotePromise && requestId) {
      const rid = requestId;
      const result = await Promise.race([
        localPromise.then(choice => ({ 
          approved: choice.approved, 
          deniedBy: 'user' as const, 
          source: 'local' as const,
          mode: choice.mode 
        })),
        remotePromise.then(r => ({ ...r, source: 'remote' as const, mode: undefined })),
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
        const label = result.approved 
          ? chalk.green.bold('✅ Approved remotely') 
          : chalk.red.bold('❌ Denied remotely');
        process.stdout.write(`\n  ${label}\n`);
      }

      return result.approved;
    }

    // No remote handler — just use local
    const choice = await localPromise;
    return choice.approved;
  }

  /**
   * Enterprise: Show permission prompt as select menu
   * This is the main improvement - no text input required!
   */
  private async promptWithSelectMenu(
    level: PermissionLevel,
    defaultYes: boolean,
  ): Promise<PermissionChoice> {
    const items: MenuItem[] = [
      {
        label: defaultYes ? '✓ Allow' : 'Allow',
        description: 'Allow this operation',
        key: 'y',
        marker: defaultYes ? '◀ default' : undefined,
      },
      {
        label: '✗ Deny',
        description: 'Block this operation',
        key: 'n',
        marker: !defaultYes ? '◀ default' : undefined,
      },
      {
        label: '→ Skip once',
        description: 'Allow just this one time',
        key: 's',
      },
      {
        label: '⚡ Always allow (session)',
        description: 'Skip permissions for this session',
        key: 'a',
      },
    ];

    // Add YOLO option for dangerous operations
    if (level === 'dangerous') {
      items.push({
        label: '🔥 YOLO mode',
        description: 'Disable ALL confirmations (dangerous!)',
        key: '!',
      });
    }

    process.stdout.write('\n');
    this.rl?.pause();
    const idx = await selectMenu(items, {
      title: 'Permission Required',
      cancelLabel: 'Deny',
    });
    this.rl?.resume();

    // Handle selection
    switch (idx) {
      case 0: // Allow
        return { approved: true, mode: 'once' };
      case 1: // Deny
        return { approved: false };
      case 2: // Skip once
        return { approved: true, mode: 'once' };
      case 3: // Always allow (session)
        this.skipPermissionsMode = true;
        process.stdout.write(chalk.yellow('\n  ⚡ Skip-permissions enabled for this session\n'));
        return { approved: true, mode: 'session' };
      case 4: // YOLO mode (only for dangerous)
        this.yoloMode = true;
        process.stdout.write(chalk.red('\n  🔥 YOLO mode enabled — no more confirmations\n'));
        return { approved: true, mode: 'yolo' };
      case -1: // Cancelled (ESC)
        return { approved: false };
      default:
        return { approved: defaultYes, mode: 'once' };
    }
  }

  /** Handle local readline input and return approval boolean */
  private async askLocal(defaultYes: boolean): Promise<PermissionChoice> {
    const answer = await this.ask('  > ');
    const trimmed = answer.trim().toLowerCase();

    switch (trimmed) {
      case '':
        return { approved: defaultYes, mode: 'once' };
      case 'y': case 'yes':
        return { approved: true, mode: 'once' };
      case 'n': case 'no':
        return { approved: false };
      case 's':
        // Skip once — allow just this one
        return { approved: true, mode: 'once' };
      case 'a':
        // Always skip — enable skip-permissions for this session
        this.skipPermissionsMode = true;
        process.stdout.write(chalk.yellow('  ⚡ Skip-permissions enabled for this session\n'));
        return { approved: true, mode: 'session' };
      case '!s': {
        // Double confirmation for skip-permissions mode
        const confirm = await this.ask(chalk.yellow('  ⚠ Enable --skip-permissions? (y/N)') + ' > ');
        if (confirm.trim().toLowerCase() === 'y') {
          this.skipPermissionsMode = true;
          process.stdout.write(chalk.yellow('  ⚡ --skip-permissions mode enabled\n'));
          return { approved: true, mode: 'session' };
        }
        return { approved: false };
      }
      case '!y': {
        // Double confirmation for YOLO mode
        const confirm = await this.ask(chalk.red('  ⚠ Enable --yolo (ALL permissions skipped)? (y/N)') + ' > ');
        if (confirm.trim().toLowerCase() === 'y') {
          this.yoloMode = true;
          process.stdout.write(chalk.red('  🔥 YOLO mode enabled — no more confirmations\n'));
          return { approved: true, mode: 'yolo' };
        }
        return { approved: false };
      }
      default:
        return { approved: defaultYes, mode: 'once' };
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
    const extPath = input.__externalPath as string | undefined;
    if (extPath) {
      const action = name === 'read_file' ? 'Read' : name === 'write_file' ? 'Write' : name === 'edit_file' ? 'Edit' : name === 'list_directory' ? 'List' : 'Access';
      return `${chalk.red.bold('🔓 EXTERNAL ACCESS')} — ${action} ${chalk.cyan(extPath)}\n  │   ${chalk.yellow('This path is outside the current project directory')}`;
    }
    switch (name) {
      case 'write_file': {
        const path = String(input.path || '');
        const content = String(input.content || '');
        const lines = content.split('\n').length;
        return `${chalk.bold('Write file')} ${chalk.cyan(path)} ${chalk.dim(`(${lines} lines)`)}`;
      }
      case 'edit_file': {
        const path = String(input.path || '');
        const oldStr = String(input.old_string || '').slice(0, 60).replace(/\n/g, '\\n');
        const newStr = String(input.new_string || '').slice(0, 60).replace(/\n/g, '\\n');
        return `${chalk.bold('Edit file')} ${chalk.cyan(path)}\n  │   ${chalk.red(`- ${oldStr}${String(input.old_string || '').length > 60 ? '…' : ''}`)}\n  │   ${chalk.green(`+ ${newStr}${String(input.new_string || '').length > 60 ? '…' : ''}`)}`;
      }
      case 'run_command': {
        const cmd = String(input.command || '');
        return `${chalk.bold('Run command')} ${chalk.yellow(`$ ${cmd}`)}`;
      }
      case 'git_commit': {
        const msg = String(input.message || '');
        return `${chalk.bold('Git commit')} ${chalk.cyan(`"${msg}"`)}`;
      }
      default: {
        const summary = Object.entries(input)
          .map(([k, v]) => `${k}: ${String(v).slice(0, 50)}`)
          .join(', ');
        return `${chalk.bold(name)} ${chalk.dim(summary.slice(0, 100))}`;
      }
    }
  }

  /** Format a plain-text description (no ANSI) for remote channels (Telegram, Web) */
  formatToolDetailPlain(name: string, input: Record<string, unknown>): string {
    const extPath = input.__externalPath as string | undefined;
    if (extPath) {
      const action = name === 'read_file' ? 'Read' : name === 'write_file' ? 'Write' : name === 'edit_file' ? 'Edit' : name === 'list_directory' ? 'List' : 'Access';
      return `🔓 EXTERNAL ACCESS — ${action} ${extPath} (outside project directory)`;
    }
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
        return `Edit file ${path}\n- ${oldStr}${String(input.old_string || '').length > 60 ? '…' : ''}\n+ ${newStr}${String(input.new_string || '').length > 60 ? '…' : ''}`;
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
