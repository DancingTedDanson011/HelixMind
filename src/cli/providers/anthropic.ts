import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  ChatMessage,
  StreamEvent,
  ToolMessage,
  ToolDefinition,
  ToolResponse,
  ContentBlock,
  TokenUsage,
} from './types.js';
import {
  RateLimiter,
  isRateLimitError,
  sleep,
} from './rate-limiter.js';
import { getModelContextLength, getMaxOutputTokens } from './model-limits.js';

/**
 * Mark the last user message with cache_control: ephemeral so Anthropic's
 * prompt cache will checkpoint the full conversation up to that point.
 * Mutates a *copy* of the messages array.
 * FIX: PROVIDERS-M1 — prompt caching for conversation cache.
 */
function markLastUserMessageEphemeral(
  messages: Array<{ role: 'user' | 'assistant'; content: any }>,
): Array<{ role: 'user' | 'assistant'; content: any }> {
  if (messages.length === 0) return messages;

  // Find the last user message index
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx === -1) return messages;

  const target = messages[lastUserIdx];
  const cloned = { ...target };

  // Anthropic accepts content as either a string or a content-block array.
  // We promote a string to a single text block with cache_control.
  if (typeof target.content === 'string') {
    cloned.content = [
      { type: 'text', text: target.content, cache_control: { type: 'ephemeral' } },
    ];
  } else if (Array.isArray(target.content)) {
    const arr = [...target.content];
    // Find the last block we're allowed to annotate — prefer text blocks,
    // then tool_result, otherwise fall back to the last block.
    let targetIdx = -1;
    for (let i = arr.length - 1; i >= 0; i--) {
      const t = (arr[i] as any)?.type;
      if (t === 'text' || t === 'tool_result' || t === 'image') {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx === -1) targetIdx = arr.length - 1;
    if (targetIdx >= 0) {
      arr[targetIdx] = { ...(arr[targetIdx] as any), cache_control: { type: 'ephemeral' } };
    }
    cloned.content = arr;
  }

  const copy = [...messages];
  copy[lastUserIdx] = cloned;
  return copy;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly model: string;
  readonly maxContextLength: number;
  private client: Anthropic;
  // FIX: PROVIDERS-C2 — Each provider instance owns a RateLimiter.
  private readonly _rateLimiter: RateLimiter;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-6') {
    this.model = model;
    this.maxContextLength = getModelContextLength(model, 'anthropic');
    this.client = new Anthropic({ apiKey });
    this._rateLimiter = new RateLimiter('anthropic');
  }

  /** Access the provider's rate limiter (e.g. to register a wait listener). */
  get rateLimiter(): RateLimiter {
    return this._rateLimiter;
  }

  async *stream(
    messages: ChatMessage[],
    systemPrompt: string,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    let fullText = '';

    try {
      await this._rateLimiter.waitIfNeeded(signal);

      // FIX: PROVIDERS-M1 — prompt caching on system prompt for stream too.
      const cachedSystem = [
        { type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } },
      ];

      const baseMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const cachedMessages = markLastUserMessageEphemeral(baseMessages);

      // FIX: PROVIDERS-C1 — pass signal as 2nd arg for hard cancellation.
      const stream = this.client.messages.stream(
        {
          model: this.model,
          max_tokens: getMaxOutputTokens(this.model),
          system: cachedSystem as any,
          messages: cachedMessages as any,
        },
        signal ? { signal } : undefined,
      );

      for await (const event of stream) {
        // FIX: PROVIDERS-C1 — bail out immediately if cancelled between events.
        if (signal?.aborted) return;
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          fullText += event.delta.text;
          yield { type: 'text', content: event.delta.text };
          if (signal?.aborted) return;
        }
      }

      this._rateLimiter.reportSuccess();
      yield { type: 'done', content: fullText };
    } catch (err) {
      if (signal?.aborted) return;
      if (isRateLimitError(err)) {
        const waitMs = this._rateLimiter.handleRateLimitError(err);
        yield { type: 'error', content: `Rate limited — waiting ${Math.ceil(waitMs / 1000)}s...` };
        return;
      }
      yield {
        type: 'error',
        content: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async chatWithTools(
    messages: ToolMessage[],
    systemPrompt: string,
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<ToolResponse> {
    const anthropicMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as any,
    }));

    // FIX: PROVIDERS-M1 — prompt caching on system + tools + last user message.
    const cachedSystem = [
      { type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } },
    ];

    const anthropicTools = tools.map((t, i) => {
      const base = {
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      };
      // Mark only the LAST tool ephemeral — cache_control on that marker
      // caches the entire tool block up to that point.
      return i === tools.length - 1
        ? { ...base, cache_control: { type: 'ephemeral' as const } }
        : base;
    });

    const cachedMessages = markLastUserMessageEphemeral(anthropicMessages);

    // FIX: PROVIDERS-C3 — provider OWNS rate-limit retry; the loop no longer retries 429s.
    let response;
    const maxRetries = 5;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      await this._rateLimiter.waitIfNeeded(signal);

      try {
        response = await this.client.messages.create(
          {
            model: this.model,
            // FIX: PROVIDERS-M2 — per-model output cap instead of hardcoded 8192.
            max_tokens: getMaxOutputTokens(this.model),
            system: cachedSystem as any,
            messages: cachedMessages as any,
            tools: anthropicTools,
          },
          signal ? { signal } : undefined,
        );
        this._rateLimiter.reportSuccess();
        break;
      } catch (err) {
        if (signal?.aborted) throw err;
        if (isRateLimitError(err)) {
          const waitMs = this._rateLimiter.handleRateLimitError(err);
          if (attempt < maxRetries) {
            process.stdout.write(
              `\r\x1b[K  \u23F3 Rate limited \u2014 waiting ${Math.ceil(waitMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})...`,
            );
            // FIX: PROVIDERS-C3 — use signal-aware sleep helper.
            try {
              await sleep(waitMs, signal);
            } catch {
              process.stdout.write('\r\x1b[K');
              throw err;
            }
            process.stdout.write('\r\x1b[K');
            continue;
          }
        }
        throw err;
      }
    }

    if (!response) throw new Error('Max retries exceeded');

    const content: ContentBlock[] = response.content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text' as const, text: block.text };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use' as const,
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
      }
      return { type: 'text' as const, text: '' };
    });

    // FIX: PROVIDERS-M1 — surface prompt-cache token counts to callers.
    const rawUsage = response.usage as any;
    const usage: TokenUsage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    };
    if (typeof rawUsage?.cache_creation_input_tokens === 'number') {
      usage.cache_creation_input_tokens = rawUsage.cache_creation_input_tokens;
    }
    if (typeof rawUsage?.cache_read_input_tokens === 'number') {
      usage.cache_read_input_tokens = rawUsage.cache_read_input_tokens;
    }

    return {
      content,
      stop_reason: response.stop_reason as ToolResponse['stop_reason'],
      usage,
    };
  }
}
