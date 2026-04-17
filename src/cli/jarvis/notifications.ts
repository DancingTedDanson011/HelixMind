/**
 * Jarvis Notifications — send alerts through multiple channels.
 * Channels: browser push, email, slack, webhook, system notifications.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { NotificationConfig, NotificationChannel, NotificationTarget, NotificationUrgency } from './types.js';

const URGENCY_ORDER: Record<NotificationUrgency, number> = {
  info: 0,
  important: 1,
  critical: 2,
};

const DEFAULT_CONFIG: NotificationConfig = {
  targets: [],
  minUrgency: 'important',
};

/**
 * FIX: JARVIS-HIGH-7 — SSRF guard for webhook URLs.
 * Only https:// URLs pointing at public hostnames are allowed.
 * Blocks: http://, localhost, loopback, RFC1918 private ranges,
 * link-local, and `.local` mDNS names. This prevents Jarvis from being
 * weaponized to probe internal services (169.254.169.254 IMDS, cluster
 * admin endpoints, etc.) via a malicious notifications.json.
 */
function isValidNotifierUrl(u: string | undefined): boolean {
  if (!u) return false;
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:') return false;
    const h = url.hostname.toLowerCase();
    if (!h) return false;
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return false;
    if (/^10\./.test(h)) return false;
    if (/^192\.168\./.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    if (/^169\.254\./.test(h)) return false;
    if (/^127\./.test(h)) return false;
    if (h.endsWith('.local')) return false;
    // Reject IPv6 loopback/link-local forms like [::1], [fe80::...]
    if (h.startsWith('[::') || h.startsWith('[fe80')) return false;
    return true;
  } catch {
    return false;
  }
}

export class NotificationManager {
  private config: NotificationConfig;
  private filePath: string;

  constructor(projectRoot: string) {
    this.filePath = join(projectRoot, '.helixmind', 'jarvis', 'notifications.json');
    this.config = this.load();
  }

  private load(): NotificationConfig {
    // 1. Try project-local config
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as NotificationConfig;
        if (Array.isArray(parsed.targets) && parsed.targets.length > 0) return parsed;
      }
    } catch { /* corrupted */ }

    // 2. Fallback: global config from ~/.helixmind/jarvis/notifications.json
    try {
      const globalPath = join(homedir(), '.helixmind', 'jarvis', 'notifications.json');
      if (globalPath !== this.filePath && existsSync(globalPath)) {
        const raw = readFileSync(globalPath, 'utf-8');
        const parsed = JSON.parse(raw) as NotificationConfig;
        if (Array.isArray(parsed.targets) && parsed.targets.length > 0) return parsed;
      }
    } catch { /* corrupted */ }

    return { ...DEFAULT_CONFIG, targets: [] };
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  /**
   * Send a notification through all configured channels.
   * Respects urgency levels — only sends if urgency >= minUrgency.
   * Critical urgency sends to ALL channels regardless.
   */
  async notify(
    title: string,
    body: string,
    urgency: NotificationUrgency = 'info',
  ): Promise<{ sent: NotificationChannel[]; errors: string[] }> {
    const sent: NotificationChannel[] = [];
    const errors: string[] = [];

    // Check urgency threshold
    if (urgency !== 'critical' && URGENCY_ORDER[urgency] < URGENCY_ORDER[this.config.minUrgency]) {
      return { sent, errors };
    }

    const targets = urgency === 'critical'
      ? this.config.targets  // Critical goes to ALL
      : this.config.targets.filter(t => t.enabled);

    for (const target of targets) {
      try {
        await this.sendToChannel(target, title, body, urgency);
        sent.push(target.channel);
      } catch (err) {
        errors.push(`${target.channel}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { sent, errors };
  }

  /**
   * Add or update a notification target.
   */
  configureTarget(channel: NotificationChannel, config: Record<string, string>, enabled = true): void {
    const existing = this.config.targets.find(t => t.channel === channel);
    if (existing) {
      existing.config = config;
      existing.enabled = enabled;
    } else {
      this.config.targets.push({ channel, enabled, config });
    }
    this.save();
  }

  /**
   * Remove a notification target.
   */
  removeTarget(channel: NotificationChannel): boolean {
    const idx = this.config.targets.findIndex(t => t.channel === channel);
    if (idx === -1) return false;
    this.config.targets.splice(idx, 1);
    this.save();
    return true;
  }

  /**
   * Set minimum urgency level.
   */
  setMinUrgency(urgency: NotificationUrgency): void {
    this.config.minUrgency = urgency;
    this.save();
  }

  /**
   * Get current configuration.
   */
  getConfig(): NotificationConfig {
    return { ...this.config, targets: [...this.config.targets] };
  }

  /**
   * Get configured channels.
   */
  getConfiguredChannels(): NotificationChannel[] {
    return this.config.targets.map(t => t.channel);
  }

  // ─── Channel Implementations ─────────────────────────────────────

  private async sendToChannel(
    target: NotificationTarget,
    title: string,
    body: string,
    urgency: NotificationUrgency,
  ): Promise<void> {
    switch (target.channel) {
      case 'browser':
        // Browser push is handled via WebSocket → brain server → browser
        // The caller should push a 'notification_sent' event
        break;

      case 'webhook': {
        const url = target.config.url;
        // FIX: JARVIS-HIGH-7 — reject http/loopback/private/link-local URLs.
        if (!isValidNotifierUrl(url)) {
          console.warn(`[jarvis] webhook URL rejected by SSRF guard: ${url || '<missing>'}`);
          return;
        }

        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, urgency, timestamp: Date.now(), source: 'jarvis' }),
          signal: AbortSignal.timeout(10_000),
        });
        break;
      }

      case 'slack': {
        const webhookUrl = target.config.webhookUrl;
        // FIX: JARVIS-HIGH-7 — even Slack webhooks must be public https.
        if (!isValidNotifierUrl(webhookUrl)) {
          console.warn(`[jarvis] slack webhook URL rejected by SSRF guard: ${webhookUrl || '<missing>'}`);
          return;
        }

        const emoji = urgency === 'critical' ? ':rotating_light:' : urgency === 'important' ? ':warning:' : ':information_source:';

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `${emoji} *${title}*\n${body}`,
            username: 'Jarvis',
            icon_emoji: ':robot_face:',
          }),
          signal: AbortSignal.timeout(10_000),
        });
        break;
      }

      case 'email': {
        // Email via Resend API (already in webapp stack)
        const apiKey = target.config.apiKey;
        const to = target.config.address;
        if (!apiKey || !to) {
          console.warn('[jarvis] email skipped: missing apiKey or address');
          return;
        }
        // FIX: JARVIS-HIGH-7 — defense-in-depth: the endpoint is hard-coded
        // to api.resend.com, but still validate before the fetch so a
        // future refactor cannot accidentally make the URL configurable
        // without also keeping the SSRF guard.
        const resendUrl = 'https://api.resend.com/emails';
        if (!isValidNotifierUrl(resendUrl)) return;

        await fetch(resendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from: 'Jarvis <jarvis@helixmind.dev>',
            to,
            subject: `[Jarvis ${urgency}] ${title}`,
            text: body,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        break;
      }

      case 'system':
        // OS-native notification via node-notifier (optional dep)
        try {
          // @ts-expect-error optional peer dependency
          const notifier = await import('node-notifier').catch(() => null) as { default?: { notify: (opts: Record<string, string>) => void } } | null;
          if (notifier?.default) {
            notifier.default.notify({ title: `Jarvis: ${title}`, message: body });
          }
        } catch {
          // node-notifier not installed — skip silently
        }
        break;

      case 'telegram': {
        const botToken = target.config.botToken;
        const chatId = target.config.chatId;
        if (!botToken || !chatId) {
          console.warn('[jarvis] telegram skipped: missing botToken or chatId');
          return;
        }
        // FIX: JARVIS-HIGH-7 — the bot token is opaque but appears in the
        // URL path. Validate the base URL is the real Telegram API.
        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        if (!isValidNotifierUrl(telegramUrl)) {
          console.warn('[jarvis] telegram URL rejected by SSRF guard');
          return;
        }

        const emoji = urgency === 'critical' ? '\u{1F6A8}' : urgency === 'important' ? '\u26A0\uFE0F' : '\u2139\uFE0F';

        await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `${emoji} *${title}*\n\n${body}`,
            parse_mode: 'Markdown',
          }),
          signal: AbortSignal.timeout(10_000),
        });
        break;
      }
    }
  }
}
