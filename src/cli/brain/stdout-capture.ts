/**
 * StdoutCapture — intercepts process.stdout.write to capture main session output.
 *
 * Extracts meaningful lines (filtering statusbar noise), strips ANSI,
 * and feeds them into the session's capture() method for web streaming.
 */
import type { Session } from '../sessions/session.js';

const STATUSBAR_RE = /L\d+:\d+\s+L\d+:\d+|safe permissions|shift\+tab to cycle|esc to interrupt|FREE_PLUS|FREE_BASE|\d+\/\d+\.?\d*k tk|\d+ ckpts/;

export class StdoutCapture {
  private origWrite: typeof process.stdout.write;
  private buffer = '';
  private active = false;

  constructor(private session: Session) {
    this.origWrite = process.stdout.write.bind(process.stdout);
  }

  /** Start intercepting stdout */
  start(): void {
    if (this.active) return;
    this.active = true;

    const self = this;
    process.stdout.write = function(chunk: any, encoding?: any, callback?: any) {
      const text = typeof chunk === 'string' ? chunk : chunk.toString();
      self.buffer += text;
      let ni;
      while ((ni = self.buffer.indexOf('\n')) !== -1) {
        const line = self.buffer.slice(0, ni);
        self.buffer = self.buffer.slice(ni + 1);
        // Strip all ANSI sequences (colors, cursor movement, etc.)
        const stripped = line.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '').trim();
        // Skip empty lines, statusbar redraws, and prompt-only lines
        if (stripped.length > 0 && !STATUSBAR_RE.test(stripped) && stripped !== '›' && stripped !== '>') {
          self.session.capture(line);
        }
      }
      return self.origWrite(chunk, encoding, callback);
    } as typeof process.stdout.write;
  }

  /** Stop intercepting and restore original stdout.write */
  stop(): void {
    if (!this.active) return;
    this.active = false;
    process.stdout.write = this.origWrite;
  }
}
