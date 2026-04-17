/**
 * StdoutCapture — intercepts process.stdout.write to capture main session output.
 *
 * Extracts meaningful lines (filtering statusbar noise), strips ANSI,
 * and feeds them into the session's capture() method for web streaming.
 */
import type { Session } from '../sessions/session.js';

const STATUSBAR_RE = /L\d+:\d+\s+L\d+:\d+|safe permissions|shift\+tab to cycle|esc to interrupt|FREE_PLUS|FREE_BASE|\d+\/\d+\.?\d*k tk|\d+ ckpts/;

/**
 * FIX: BRAIN-F4 — redact high-entropy credentials from any line that will be
 * forwarded to the web/relay. Patterns cover the providers the CLI supports
 * plus generic PEM/AWS/Bearer tokens. This mirrors the redaction logic used
 * by the spiral store so captured output doesn't leak secrets the spiral
 * already treats as sensitive.
 *
 * Defense-in-depth: we do NOT redact the local terminal copy (self.origWrite
 * still receives the untouched chunk) — only what enters session.capture().
 */
export function redactSecrets(s: string): string {
  try {
    return s
      // Anthropic API keys (must come before generic sk- rule)
      .replace(/\bsk-ant-[A-Za-z0-9_\-]{20,}/g, '[REDACTED_KEY]')
      // OpenAI / generic "sk-" keys
      .replace(/\bsk-[A-Za-z0-9_\-]{20,}/g, '[REDACTED_KEY]')
      // GitHub personal access tokens
      .replace(/\bghp_[A-Za-z0-9]{36,}/g, '[REDACTED_TOKEN]')
      // GitHub fine-grained tokens
      .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}/g, '[REDACTED_TOKEN]')
      // Bearer tokens in Authorization headers / env dumps
      .replace(/\bBearer\s+[A-Za-z0-9_\-\.]{20,}/gi, 'Bearer [REDACTED]')
      // AWS access keys
      .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED_AWS]')
      // PEM-encoded private keys (multi-line, already flattened to one line here)
      .replace(/-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
      // Slack tokens
      .replace(/\bxox[baprs]-[A-Za-z0-9-]{10,}/g, '[REDACTED_SLACK]');
  } catch (err) {
    // If the regex engine throws for some pathological input, fail closed:
    // redact the whole line rather than passing it through unmodified.
    console.error('[stdout-capture] redactSecrets error:', err instanceof Error ? err.message : String(err));
    return '[REDACTED]';
  }
}

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
        // Skip empty lines, statusbar redraws, prompt-only lines, and readline echoed input
        // Readline shows user input with prompt prefix like "│ ❯ /help" - we must NOT capture this!
        const isReadlineInput = stripped.startsWith('│') || stripped.startsWith('|') ||
                                stripped.includes('❯') || stripped === '›' || stripped === '>';
        if (stripped.length > 0 && !STATUSBAR_RE.test(stripped) && !isReadlineInput) {
          // FIX: BRAIN-F4 — scrub credentials before the line is pushed to
          // any web/relay client. The original chunk (with credentials) is
          // still written to the local TTY by self.origWrite() below.
          const redacted = redactSecrets(line);
          self.session.capture(redacted);
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
