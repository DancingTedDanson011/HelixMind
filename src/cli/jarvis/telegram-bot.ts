/**
 * Jarvis Telegram Bot — Bidirectional messaging via Telegram Bot API.
 * Uses native fetch() (Node 18+), no external dependencies.
 * Long-polling mode — no webhook server needed.
 */

export interface InlineButton {
  text: string;
  callback_data: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; first_name?: string; username?: string };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
}

interface TelegramResponse {
  ok: boolean;
  result?: TelegramUpdate[];
  description?: string;
}

export type TelegramMessageHandler = (text: string, chatId: string, username?: string) => void;
export type TelegramCallbackHandler = (data: string, chatId: string, queryId: string) => void;

export class JarvisTelegramBot {
  private token: string;
  private allowedChatId: string;
  private polling = false;
  private offset = 0;
  private onMessage?: TelegramMessageHandler;
  private onCallback?: TelegramCallbackHandler;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private abortController?: AbortController;

  constructor(token: string, chatId: string) {
    this.token = token;
    this.allowedChatId = chatId;
  }

  /**
   * Start long-polling for incoming messages.
   */
  start(
    onMessage: TelegramMessageHandler,
    onCallback?: TelegramCallbackHandler,
  ): void {
    if (this.polling) return;
    this.polling = true;
    this.onMessage = onMessage;
    this.onCallback = onCallback;
    this.poll();
  }

  /**
   * Stop polling.
   */
  stop(): void {
    this.polling = false;
    this.abortController?.abort();
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  /**
   * Send a text message (with optional inline keyboard).
   */
  async send(
    text: string,
    opts?: {
      chatId?: string;
      buttons?: InlineButton[][];
      parseMode?: 'Markdown' | 'HTML';
    },
  ): Promise<void> {
    const body: Record<string, unknown> = {
      chat_id: opts?.chatId || this.allowedChatId,
      text,
      parse_mode: opts?.parseMode ?? 'Markdown',
    };

    if (opts?.buttons && opts.buttons.length > 0) {
      body.reply_markup = {
        inline_keyboard: opts.buttons.map(row =>
          row.map(btn => ({ text: btn.text, callback_data: btn.callback_data })),
        ),
      };
    }

    await this.apiCall('sendMessage', body);
  }

  /**
   * Answer a callback query (dismiss button loading state).
   */
  async answerCallback(queryId: string, text?: string): Promise<void> {
    await this.apiCall('answerCallbackQuery', {
      callback_query_id: queryId,
      text: text || '',
    });
  }

  /**
   * Check if bot token is valid.
   */
  async verify(): Promise<{ ok: boolean; botName?: string }> {
    try {
      const res = await this.apiCall('getMe') as { ok: boolean; result?: { first_name?: string; username?: string } };
      if (res.ok) {
        return { ok: true, botName: res.result?.username || res.result?.first_name };
      }
      return { ok: false };
    } catch {
      return { ok: false };
    }
  }

  get isRunning(): boolean {
    return this.polling;
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    if (!this.polling) return;

    try {
      this.abortController = new AbortController();

      const res = await fetch(
        `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.offset}&timeout=25`,
        { signal: this.abortController.signal },
      );

      if (!res.ok) {
        // Rate limited or auth error — back off
        this.pollTimer = setTimeout(() => this.poll(), 10_000);
        return;
      }

      const data = (await res.json()) as TelegramResponse;

      if (data.ok && data.result) {
        for (const update of data.result) {
          this.offset = update.update_id + 1;
          this.handleUpdate(update);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Intentional stop
      }
      // Network error — retry after delay
    }

    if (this.polling) {
      this.pollTimer = setTimeout(() => this.poll(), 1_000);
    }
  }

  private handleUpdate(update: TelegramUpdate): void {
    // Handle text messages
    if (update.message?.text) {
      const chatId = String(update.message.chat.id);

      // Security: only accept messages from allowed chat
      if (chatId !== this.allowedChatId) return;

      const username = update.message.chat.username || update.message.chat.first_name;
      this.onMessage?.(update.message.text, chatId, username);
    }

    // Handle callback queries (inline button presses)
    if (update.callback_query?.data) {
      const chatId = String(update.callback_query.message?.chat.id || '');
      if (chatId !== this.allowedChatId) return;

      this.onCallback?.(
        update.callback_query.data,
        chatId,
        update.callback_query.id,
      );
    }
  }

  private async apiCall(method: string, body?: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    return res.json();
  }
}

/**
 * Built-in command handler for the Telegram bot.
 * Parses /commands and dispatches to Jarvis actions.
 */
export function parseTelegramCommand(text: string): {
  command: string | null;
  args: string;
} {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) {
    return { command: null, args: trimmed };
  }

  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    return { command: trimmed.slice(1).toLowerCase(), args: '' };
  }

  return {
    command: trimmed.slice(1, spaceIdx).toLowerCase(),
    args: trimmed.slice(spaceIdx + 1).trim(),
  };
}
