/**
 * Session — encapsulates all state for one independent agent task.
 * Each background task (security, auto, user query) gets its own Session.
 */
import type { ToolMessage } from '../providers/types.js';
import { AgentController } from '../agent/loop.js';
import { UndoStack } from '../agent/undo.js';
import { SessionBuffer } from '../context/session-buffer.js';
import type { TaskStep } from '../ui/activity.js';

export type SessionStatus = 'idle' | 'running' | 'done' | 'error' | 'paused';

export interface SessionResult {
  text: string;
  steps: TaskStep[];
  errors: string[];
  durationMs: number;
}

export class Session {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  status: SessionStatus = 'idle';
  startTime = 0;
  endTime = 0;

  /** Independent conversation history */
  readonly history: ToolMessage[] = [];

  /** Independent working memory */
  readonly buffer: SessionBuffer;

  /** Independent abort controller */
  readonly controller = new AgentController();

  /** Independent undo stack */
  readonly undoStack = new UndoStack();

  /** Captured output lines (for replay when switching tabs) */
  readonly output: string[] = [];

  /** Result after completion */
  result: SessionResult | null = null;

  /** Copy of original CLI flags for spawned sessions */
  readonly flags: { yolo: boolean; skipPermissions: boolean };

  /** Optional callback for output streaming (CLI ↔ Web protocol) */
  onCapture?: (line: string, index: number) => void;

  constructor(
    id: string,
    name: string,
    icon: string,
    flags: { yolo: boolean; skipPermissions: boolean },
    baseHistory?: ToolMessage[],
  ) {
    this.id = id;
    this.name = name;
    this.icon = icon;
    this.flags = flags;
    this.buffer = new SessionBuffer();

    // Copy base history so sessions don't share mutable arrays
    if (baseHistory) {
      this.history.push(...baseHistory.map(m => ({ ...m })));
    }
  }

  start(): void {
    this.status = 'running';
    this.startTime = Date.now();
    this.controller.reset();
  }

  complete(result: SessionResult): void {
    this.status = result.errors.length > 0 ? 'error' : 'done';
    this.endTime = Date.now();
    this.result = result;
  }

  abort(): void {
    this.controller.abort();
    this.status = 'error';
    this.endTime = Date.now();
  }

  get elapsed(): number {
    if (this.startTime === 0) return 0;
    return (this.endTime || Date.now()) - this.startTime;
  }

  /** Capture an output line to the buffer */
  capture(line: string): void {
    this.output.push(line);
    const index = this.output.length - 1;
    // Keep max 500 lines per session
    if (this.output.length > 500) {
      this.output.splice(0, this.output.length - 500);
    }
    // Notify output streaming subscribers
    this.onCapture?.(line, index);
  }
}
