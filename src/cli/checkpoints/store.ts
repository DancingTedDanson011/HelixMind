export type CheckpointType =
  | 'session_start'
  | 'chat'
  | 'tool_read'
  | 'tool_edit'
  | 'tool_write'
  | 'tool_run'
  | 'tool_commit'
  | 'tool_search'
  | 'feed'
  | 'config';

export interface FileSnapshot {
  path: string;
  contentBefore: string | null; // null if file didn't exist
  contentAfter: string;
}

export interface Checkpoint {
  id: number;
  timestamp: Date;
  type: CheckpointType;
  label: string;

  // Chat state
  messageIndex: number;

  // Code state (only for file-changing actions)
  fileSnapshots?: FileSnapshot[];

  // Metadata
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
}

/** Map tool names to checkpoint types */
const TOOL_TYPE_MAP: Record<string, CheckpointType> = {
  read_file: 'tool_read',
  write_file: 'tool_write',
  edit_file: 'tool_edit',
  list_directory: 'tool_read',
  search_files: 'tool_search',
  find_files: 'tool_search',
  run_command: 'tool_run',
  git_status: 'tool_read',
  git_diff: 'tool_read',
  git_commit: 'tool_commit',
  git_log: 'tool_read',
  spiral_query: 'tool_read',
  spiral_store: 'tool_write',
  bug_report: 'tool_write',
  bug_list: 'tool_read',
  browser_open: 'tool_run',
  browser_navigate: 'tool_run',
  browser_screenshot: 'tool_read',
  browser_click: 'tool_run',
  browser_type: 'tool_run',
  browser_close: 'tool_run',
};

/** Icon map for display */
const TYPE_ICONS: Record<CheckpointType, string> = {
  session_start: '\u{1F680}',
  chat: '\u{1F4AC}',
  tool_read: '\u{1F4C4}',
  tool_edit: '\u{270F}\u{FE0F}',
  tool_write: '\u{1F4DD}',
  tool_run: '\u26A1',
  tool_commit: '\u{1F4E6}',
  tool_search: '\u{1F50D}',
  feed: '\u{1F300}',
  config: '\u2699\u{FE0F}',
};

export class CheckpointStore {
  private checkpoints: Checkpoint[] = [];
  private nextId = 1;
  private maxSnapshots = 200;
  private maxSnapshotBytes = 50 * 1024 * 1024; // 50MB
  private currentSnapshotBytes = 0;

  /** Create a new checkpoint and return its ID */
  create(data: Omit<Checkpoint, 'id' | 'timestamp'>): number {
    const id = this.nextId++;
    const checkpoint: Checkpoint = {
      ...data,
      id,
      timestamp: new Date(),
    };

    // Track snapshot memory
    if (checkpoint.fileSnapshots) {
      for (const snap of checkpoint.fileSnapshots) {
        this.currentSnapshotBytes += (snap.contentBefore?.length ?? 0) + snap.contentAfter.length;
      }
    }

    this.checkpoints.push(checkpoint);

    // Evict old snapshots if over memory limit
    this.evictIfNeeded();

    return id;
  }

  /** Create a checkpoint for a tool call */
  createForTool(
    toolName: string,
    input: Record<string, unknown>,
    result: string,
    messageIndex: number,
    fileSnapshots?: FileSnapshot[],
  ): number {
    const type = TOOL_TYPE_MAP[toolName] ?? 'tool_run';
    const label = formatToolLabel(toolName, input);

    return this.create({
      type,
      label,
      messageIndex,
      fileSnapshots,
      toolName,
      toolInput: input,
      toolResult: result.length > 500 ? result.slice(0, 500) + '...' : result,
    });
  }

  /** Create a checkpoint for a chat message */
  createForChat(label: string, messageIndex: number): number {
    return this.create({
      type: 'chat',
      label: label.length > 60 ? label.slice(0, 60) + '...' : label,
      messageIndex,
    });
  }

  /** Get a checkpoint by ID */
  get(id: number): Checkpoint | undefined {
    return this.checkpoints.find(c => c.id === id);
  }

  /** Get all checkpoints, most recent first */
  getAll(): Checkpoint[] {
    return [...this.checkpoints].reverse();
  }

  /** Get checkpoints after (and including) a given ID */
  getFrom(id: number): Checkpoint[] {
    const idx = this.checkpoints.findIndex(c => c.id === id);
    if (idx === -1) return [];
    return this.checkpoints.slice(idx);
  }

  /** Get checkpoints after a given ID (exclusive) */
  getAfter(id: number): Checkpoint[] {
    const idx = this.checkpoints.findIndex(c => c.id === id);
    if (idx === -1) return [];
    return this.checkpoints.slice(idx + 1);
  }

  /** Remove all checkpoints after (exclusive) a given ID */
  truncateAfter(id: number): Checkpoint[] {
    const idx = this.checkpoints.findIndex(c => c.id === id);
    if (idx === -1) return [];
    const removed = this.checkpoints.splice(idx + 1);

    // Recalculate snapshot bytes
    for (const cp of removed) {
      if (cp.fileSnapshots) {
        for (const snap of cp.fileSnapshots) {
          this.currentSnapshotBytes -= (snap.contentBefore?.length ?? 0) + snap.contentAfter.length;
        }
      }
    }

    return removed;
  }

  /** Total checkpoint count */
  get count(): number {
    return this.checkpoints.length;
  }

  /** Get the icon for a checkpoint type */
  static icon(type: CheckpointType): string {
    return TYPE_ICONS[type] ?? '\u{1F4CC}';
  }

  /** Get approximate memory usage in bytes */
  get memoryUsage(): number {
    return this.currentSnapshotBytes;
  }

  private evictIfNeeded(): void {
    // Evict oldest snapshots when over memory limit
    while (this.currentSnapshotBytes > this.maxSnapshotBytes && this.checkpoints.length > 1) {
      const oldest = this.checkpoints[0];
      if (oldest.fileSnapshots) {
        for (const snap of oldest.fileSnapshots) {
          this.currentSnapshotBytes -= (snap.contentBefore?.length ?? 0) + snap.contentAfter.length;
        }
        // Keep the checkpoint but drop the snapshots
        oldest.fileSnapshots = undefined;
      } else {
        // Already no snapshots, nothing to evict from this one
        break;
      }
    }

    // Hard limit on total checkpoints
    while (this.checkpoints.length > this.maxSnapshots) {
      const removed = this.checkpoints.shift()!;
      if (removed.fileSnapshots) {
        for (const snap of removed.fileSnapshots) {
          this.currentSnapshotBytes -= (snap.contentBefore?.length ?? 0) + snap.contentAfter.length;
        }
      }
    }
  }
}

function formatToolLabel(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'read_file':
      return `Read ${input.path ?? ''}`;
    case 'write_file':
      return `Write ${input.path ?? ''}`;
    case 'edit_file':
      return `Edit ${input.path ?? ''}`;
    case 'list_directory':
      return `List ${input.path ?? '.'}`;
    case 'search_files':
      return `Search "${input.pattern ?? ''}"`;
    case 'find_files':
      return `Find ${input.pattern ?? ''}`;
    case 'run_command': {
      const cmd = String(input.command ?? '');
      return `Run ${cmd.length > 40 ? cmd.slice(0, 40) + '...' : cmd}`;
    }
    case 'git_status':
      return 'Git status';
    case 'git_diff':
      return `Git diff ${input.path ?? '(all)'}`;
    case 'git_commit':
      return `Commit "${input.message ?? ''}"`;
    case 'git_log':
      return `Git log ${input.file ?? `last ${input.count ?? 10}`}`;
    case 'spiral_query':
      return `Query "${input.query ?? ''}"`;
    case 'spiral_store':
      return `Store [${input.type ?? ''}]`;
    default:
      return toolName;
  }
}
