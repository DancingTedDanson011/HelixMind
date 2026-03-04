/**
 * Jarvis Telegram Bot — Bidirectional messaging via Telegram Bot API.
 * Uses native fetch() (Node 18+), no external dependencies.
 * Long-polling mode — no webhook server needed.
 */

export interface InlineButton {
  text: string;
  callback_data: string;
}

interface TelegramEntity {
  type: string; // 'mention' | 'bot_command' | 'text_mention' | ...
  offset: number;
  length: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type?: string; first_name?: string; username?: string; title?: string };
    from?: { id: number; first_name?: string; username?: string; is_bot?: boolean };
    text?: string;
    date: number;
    entities?: TelegramEntity[];
  };
  my_chat_member?: {
    chat: { id: number; type?: string };
    new_chat_member?: { status?: string };
  };
  channel_post?: {
    message_id: number;
    chat: { id: number; type?: string; title?: string };
    text?: string;
    entities?: TelegramEntity[];
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
  private botUsername?: string; // cached from getMe

  constructor(token: string, chatId: string) {
    this.token = token;
    this.allowedChatId = chatId;
  }

  /**
   * Start long-polling for incoming messages.
   * Fetches bot username for @mention detection and requests all relevant update types.
   */
  start(
    onMessage: TelegramMessageHandler,
    onCallback?: TelegramCallbackHandler,
  ): void {
    if (this.polling) return;
    this.polling = true;
    this.onMessage = onMessage;
    this.onCallback = onCallback;

    // Cache bot username for @mention detection
    this.apiCall('getMe').then((res: any) => {
      if (res?.ok && res.result?.username) {
        this.botUsername = res.result.username.toLowerCase();
      }
    }).catch(() => {});

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
        if (res.result?.username) {
          this.botUsername = res.result.username.toLowerCase();
        }
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

      // Request all relevant update types: messages, channel posts, callback queries, chat member changes
      const allowedUpdates = encodeURIComponent(JSON.stringify([
        'message', 'callback_query', 'channel_post', 'my_chat_member',
      ]));
      const res = await fetch(
        `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.offset}&timeout=25&allowed_updates=${allowedUpdates}`,
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
    // SECURITY: Reject messages from unauthorized chats
    const incomingChatId = String(
      update.message?.chat.id ??
      update.channel_post?.chat.id ??
      update.callback_query?.message?.chat.id ?? '',
    );
    if (this.allowedChatId && incomingChatId !== this.allowedChatId) return;

    // Handle text messages (DMs, groups, supergroups)
    if (update.message?.text) {
      const chatId = String(update.message.chat.id);
      const chatType = update.message.chat.type || 'private';
      const text = update.message.text;
      const entities = update.message.entities || [];
      const username = update.message.from?.username || update.message.from?.first_name || update.message.chat.first_name;

      // In groups/supergroups: only respond to @mentions or /commands directed at this bot
      if (chatType === 'group' || chatType === 'supergroup') {
        const isBotMentioned = this.isMentionedInMessage(text, entities);
        const isBotCommand = this.isCommandForBot(text, entities);

        if (!isBotMentioned && !isBotCommand) return;

        const cleanText = this.stripBotMention(text, entities);
        this.onMessage?.(cleanText, chatId, username);
        return;
      }

      // DMs: process everything (no @mention needed)
      this.onMessage?.(text, chatId, username);
    }

    // Handle channel posts
    if (update.channel_post?.text) {
      const chatId = String(update.channel_post.chat.id);
      const text = update.channel_post.text;
      const entities = update.channel_post.entities || [];

      const isBotMentioned = this.isMentionedInMessage(text, entities);
      const isBotCommand = this.isCommandForBot(text, entities);
      if (!isBotMentioned && !isBotCommand) return;

      const cleanText = this.stripBotMention(text, entities);
      this.onMessage?.(cleanText, chatId, 'channel');
    }

    // Handle callback queries (inline button presses)
    if (update.callback_query?.data) {
      const chatId = String(update.callback_query.message?.chat.id || '');

      this.onCallback?.(
        update.callback_query.data,
        chatId,
        update.callback_query.id,
      );
    }
  }

  /**
   * Check if the bot is @mentioned in a message.
   */
  private isMentionedInMessage(text: string, entities: TelegramEntity[]): boolean {
    if (!this.botUsername) return false;

    // Check for @mention entities from Telegram
    for (const entity of entities) {
      if (entity.type === 'mention') {
        const mention = text.slice(entity.offset, entity.offset + entity.length).toLowerCase();
        if (mention === `@${this.botUsername}`) return true;
      }
    }

    // Fallback: raw text search for @botname (case-insensitive)
    return text.toLowerCase().includes(`@${this.botUsername}`);
  }

  /**
   * Check if a /command is directed at this bot (e.g. /status@botname).
   */
  private isCommandForBot(text: string, entities: TelegramEntity[]): boolean {
    for (const entity of entities) {
      if (entity.type === 'bot_command') {
        const cmd = text.slice(entity.offset, entity.offset + entity.length).toLowerCase();
        // /command (no @suffix → directed at all bots, accept in allowed chat)
        if (!cmd.includes('@')) return true;
        // /command@botname → only if it's our bot
        if (this.botUsername && cmd.endsWith(`@${this.botUsername}`)) return true;
        return false;
      }
    }
    // No bot_command entity but starts with / — accept (private chat)
    return text.trim().startsWith('/');
  }

  /**
   * Strip the @botname mention from the text so handlers get clean input.
   * Also strips @botname suffix from /commands (e.g. /task@mybot → /task).
   */
  private stripBotMention(text: string, entities: TelegramEntity[]): string {
    if (!this.botUsername) return text;

    let clean = text;

    // Remove @botname from /commands (e.g. /status@jarvis_bot → /status)
    const botSuffix = new RegExp(`@${this.botUsername}`, 'gi');
    clean = clean.replace(botSuffix, '').trim();

    return clean;
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
