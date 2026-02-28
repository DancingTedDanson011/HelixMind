/**
 * Session Buffer — short-term "working memory" for the current chat session.
 *
 * Tracks user messages, tool calls, errors, and file changes. Provides a
 * compressed summary that gets injected into the system prompt so the LLM
 * maintains session awareness even as conversation history gets long.
 */

export interface SessionEvent {
  type: 'user_message' | 'tool_call' | 'tool_error' | 'file_change' | 'assistant_summary';
  summary: string;
  timestamp: number;
}

export class SessionBuffer {
  private events: SessionEvent[] = [];
  private maxEvents = 60;
  private filesModified = new Set<string>();
  private filesRead = new Set<string>();
  private errorCount = 0;

  addUserMessage(message: string): void {
    this.push({
      type: 'user_message',
      summary: message.length > 120 ? message.slice(0, 120) + '...' : message,
      timestamp: Date.now(),
    });
  }

  addToolCall(tool: string, input: Record<string, unknown>): void {
    const summary = this.summarizeToolCall(tool, input);
    this.push({ type: 'tool_call', summary, timestamp: Date.now() });

    // Track file operations
    const path = String(input.path || '');
    if (path) {
      if (tool === 'read_file') this.filesRead.add(path);
      if (tool === 'write_file' || tool === 'edit_file') this.filesModified.add(path);
    }
  }

  addToolError(tool: string, error: string): void {
    this.errorCount++;
    this.push({
      type: 'tool_error',
      summary: `${tool}: ${error.slice(0, 100)}`,
      timestamp: Date.now(),
    });
  }

  addAssistantSummary(text: string): void {
    this.push({
      type: 'assistant_summary',
      summary: text.length > 100 ? text.slice(0, 100) + '...' : text,
      timestamp: Date.now(),
    });
  }

  /**
   * Build a concise context string for the system prompt.
   * Keeps it under ~800 tokens to not bloat the prompt.
   */
  buildContext(): string {
    if (this.events.length === 0) return '';

    const lines: string[] = ['## Session Working Memory'];

    // Summary stats
    const userMsgs = this.events.filter(e => e.type === 'user_message');
    const toolCalls = this.events.filter(e => e.type === 'tool_call');
    lines.push(`Turn ${userMsgs.length} | ${toolCalls.length} tool calls | ${this.errorCount} errors`);

    // Recent user messages (last 3)
    const recentUser = userMsgs.slice(-3);
    if (recentUser.length > 0) {
      lines.push('\nRecent user requests:');
      for (const ev of recentUser) {
        lines.push(`- ${ev.summary}`);
      }
    }

    // Files context
    if (this.filesModified.size > 0) {
      lines.push(`\nFiles modified this session: ${[...this.filesModified].slice(-10).join(', ')}`);
    }
    if (this.filesRead.size > 0) {
      const readOnly = [...this.filesRead].filter(f => !this.filesModified.has(f));
      if (readOnly.length > 0) {
        lines.push(`Files read: ${readOnly.slice(-8).join(', ')}`);
      }
    }

    // Recent errors (critical for auto-recovery)
    const recentErrors = this.events.filter(e => e.type === 'tool_error').slice(-3);
    if (recentErrors.length > 0) {
      lines.push('\nRecent errors (auto-recover if possible):');
      for (const err of recentErrors) {
        lines.push(`! ${err.summary}`);
      }
    }

    return lines.join('\n');
  }

  /** Get recent errors for auto-recovery */
  getRecentErrors(): SessionEvent[] {
    return this.events.filter(e => e.type === 'tool_error').slice(-5);
  }

  /** Get all modified files */
  getModifiedFiles(): string[] {
    return [...this.filesModified];
  }

  get totalErrors(): number {
    return this.errorCount;
  }

  get eventCount(): number {
    return this.events.length;
  }

  private push(event: SessionEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      // Keep user messages and errors longer, trim tool calls
      const important = this.events.filter(
        e => e.type === 'user_message' || e.type === 'tool_error',
      );
      const recent = this.events.slice(-this.maxEvents / 2);
      // Merge: important + recent, deduplicated
      const merged = new Map<string, SessionEvent>();
      for (const e of [...important, ...recent]) {
        merged.set(`${e.timestamp}-${e.type}`, e);
      }
      this.events = [...merged.values()].sort((a, b) => a.timestamp - b.timestamp);
    }
  }

  private summarizeToolCall(tool: string, input: Record<string, unknown>): string {
    switch (tool) {
      case 'read_file': return `read ${input.path}`;
      case 'write_file': return `write ${input.path}`;
      case 'edit_file': return `edit ${input.path}`;
      case 'run_command': return `$ ${String(input.command || '').slice(0, 60)}`;
      case 'search_files': return `search "${input.pattern}"`;
      case 'find_files': return `find "${input.pattern}"`;
      case 'list_directory': return `ls ${input.path || '.'}`;
      case 'git_status': return 'git status';
      case 'git_diff': return `git diff ${input.path || ''}`;
      case 'git_commit': return `git commit "${input.message}"`;
      case 'git_log': return 'git log';
      case 'spiral_query': return `spiral: "${input.query}"`;
      case 'spiral_store': return `spiral store [${input.type}]`;
      default: return `${tool}(${JSON.stringify(input).slice(0, 50)})`;
    }
  }
}
