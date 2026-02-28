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

  /** Extracted user goals — never trimmed, always visible in context */
  private goals: string[] = [];
  private static readonly MAX_GOALS = 5;

  /** Key entities: repo URLs, branch names, ticket numbers, file paths */
  private entities = new Map<string, string>();
  private static readonly MAX_ENTITIES = 15;

  /** Important decisions from agent responses */
  private decisions: string[] = [];
  private static readonly MAX_DECISIONS = 5;

  addUserMessage(message: string): void {
    this.push({
      type: 'user_message',
      summary: message.length > 200 ? message.slice(0, 200) + '...' : message,
      timestamp: Date.now(),
    });
    this.extractGoals(message);
    this.extractEntities(message);
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
      summary: text.length > 300 ? text.slice(0, 300) + '...' : text,
      timestamp: Date.now(),
    });
  }

  /** Add a decision from agent response */
  addDecision(text: string): void {
    const trimmed = text.length > 200 ? text.slice(0, 200) + '...' : text;
    if (this.decisions.length >= SessionBuffer.MAX_DECISIONS) {
      this.decisions.shift();
    }
    this.decisions.push(trimmed);
  }

  /**
   * Build a concise context string for the system prompt.
   * Budget: ~1500 tokens. Goals and entities are never trimmed.
   */
  buildContext(): string {
    if (this.events.length === 0 && this.goals.length === 0) return '';

    const lines: string[] = ['## Session Working Memory'];

    // Summary stats
    const userMsgs = this.events.filter(e => e.type === 'user_message');
    const toolCalls = this.events.filter(e => e.type === 'tool_call');
    lines.push(`Turn ${userMsgs.length} | ${toolCalls.length} tool calls | ${this.errorCount} errors`);

    // GOALS — always shown, never trimmed (most important for context)
    if (this.goals.length > 0) {
      lines.push('\nActive goals:');
      for (const goal of this.goals) {
        lines.push(`> ${goal}`);
      }
    }

    // ENTITIES — key references the user mentioned
    if (this.entities.size > 0) {
      lines.push('\nKey references:');
      for (const [key, value] of this.entities) {
        lines.push(`- ${key}: ${value}`);
      }
    }

    // DECISIONS — important agent decisions
    if (this.decisions.length > 0) {
      lines.push('\nDecisions made:');
      for (const d of this.decisions) {
        lines.push(`- ${d}`);
      }
    }

    // Recent user messages (last 5, up from 3)
    const recentUser = userMsgs.slice(-5);
    if (recentUser.length > 0) {
      lines.push('\nRecent user requests:');
      for (const ev of recentUser) {
        lines.push(`- ${ev.summary}`);
      }
    }

    // Recent assistant summaries (last 3)
    const recentAssistant = this.events
      .filter(e => e.type === 'assistant_summary')
      .slice(-3);
    if (recentAssistant.length > 0) {
      lines.push('\nRecent responses:');
      for (const ev of recentAssistant) {
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

  /** Extract goals from user messages via heuristics */
  extractGoals(message: string): void {
    const lower = message.toLowerCase();
    // German + English imperative/desire patterns
    const goalPatterns = [
      /(?:ich will|ich möchte|ich brauche|mache|erstelle|baue|push|deploy|fix|implement|create|add|remove|update|refactor|migrate|build|setup|configure)\s+(.{10,})/i,
      /(?:wir müssen|wir sollten|we need to|we should|let's|lass uns)\s+(.{10,})/i,
      /(?:ziel|goal|task|aufgabe|todo)[:\s]+(.{10,})/i,
    ];

    for (const pattern of goalPatterns) {
      const match = message.match(pattern);
      if (match) {
        const goal = match[0].slice(0, 200);
        // Avoid duplicate goals
        if (!this.goals.some(g => g.toLowerCase().includes(goal.toLowerCase().slice(0, 30)))) {
          if (this.goals.length >= SessionBuffer.MAX_GOALS) {
            this.goals.shift();
          }
          this.goals.push(goal);
        }
        break;
      }
    }

    // Fallback: if the message is short and imperative-sounding, treat it as a goal
    if (this.goals.length === 0 && lower.length > 15 && lower.length < 300) {
      const startsImperative = /^(mach|fix|add|create|build|push|deploy|update|remove|refactor|test|run|install|setup|check|review|write|read|show|find|search|debug)/i.test(lower);
      if (startsImperative) {
        this.goals.push(message.slice(0, 200));
      }
    }
  }

  /** Extract key entities (URLs, repos, branches, tickets) from text */
  extractEntities(message: string): void {
    // URLs
    const urlMatch = message.match(/https?:\/\/[^\s<>"']+/g);
    if (urlMatch) {
      for (const url of urlMatch.slice(0, 3)) {
        // Derive a label from the URL
        try {
          const parsed = new URL(url);
          const label = parsed.hostname + parsed.pathname.split('/').slice(0, 3).join('/');
          this.addEntity(label, url);
        } catch {
          this.addEntity('url', url);
        }
      }
    }

    // Git branches (e.g. "branch main", "auf branch feature/xyz")
    const branchMatch = message.match(/(?:branch|zweig)\s+([a-zA-Z0-9_./-]+)/i);
    if (branchMatch) {
      this.addEntity('branch', branchMatch[1]);
    }

    // Repo paths (e.g. "user/repo", "/path/to/project")
    const repoMatch = message.match(/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)(?:\s|$|\.)/);
    if (repoMatch && !repoMatch[1].includes('://')) {
      this.addEntity('repo', repoMatch[1]);
    }

    // Ticket/issue numbers (e.g. #123, PROJ-456)
    const ticketMatch = message.match(/#(\d+)|([A-Z]{2,}-\d+)/g);
    if (ticketMatch) {
      for (const t of ticketMatch.slice(0, 2)) {
        this.addEntity('ticket', t);
      }
    }
  }

  /** Get current goals */
  getGoals(): string[] {
    return [...this.goals];
  }

  /** Get current entities */
  getEntities(): Map<string, string> {
    return new Map(this.entities);
  }

  private addEntity(key: string, value: string): void {
    if (this.entities.size >= SessionBuffer.MAX_ENTITIES) {
      // Remove oldest entry
      const firstKey = this.entities.keys().next().value;
      if (firstKey !== undefined) this.entities.delete(firstKey);
    }
    this.entities.set(key, value);
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
      case 'bug_report': return `bug ${input.action} ${input.bug_id ? '#' + input.bug_id : ''}`.trim();
      case 'bug_list': return `bugs ${input.status || 'all'}`;
      case 'browser_open': return `browser open${input.url ? ' ' + input.url : ''}`;
      case 'browser_navigate': return `browser → ${input.url}`;
      case 'browser_screenshot': return 'browser screenshot';
      case 'browser_click': return `browser click ${input.selector}`;
      case 'browser_type': return `browser type → ${input.selector}`;
      case 'browser_close': return 'browser close';
      default: return `${tool}(${JSON.stringify(input).slice(0, 50)})`;
    }
  }
}
