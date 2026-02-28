import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import type {
  LLMProvider,
  ChatMessage,
  StreamEvent,
  ToolMessage,
  ToolDefinition,
  ToolResponse,
  ContentBlock,
} from './types.js';
import {
  waitIfNeeded,
  reportSuccess,
  handleRateLimitError,
  isRateLimitError,
  detectCreditsExhausted,
} from './rate-limiter.js';

export class OpenAIProvider implements LLMProvider {
  readonly name: string;
  readonly model: string;
  private client: OpenAI;
  private systemRole: 'developer' | 'system';

  constructor(apiKey: string, model: string = 'gpt-4o', baseURL?: string, providerName?: string) {
    this.model = model;
    this.name = providerName ?? 'openai';
    // Only native OpenAI supports the 'developer' role; all others use 'system'
    this.systemRole = this.name === 'openai' ? 'developer' : 'system';
    this.client = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      timeout: 120_000, // 2 minute timeout — prevents infinite hang on slow/unresponsive APIs
    });
  }

  /** Check if the current model is a reasoning model (DeepSeek-R1 etc.) */
  private isReasonerModel(): boolean {
    const m = this.model.toLowerCase();
    return m.includes('reasoner') || m.includes('-r1');
  }

  async *stream(
    messages: ChatMessage[],
    systemPrompt: string,
  ): AsyncGenerator<StreamEvent> {
    let fullText = '';

    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        stream: true,
        messages: [
          { role: this.systemRole, content: systemPrompt },
          ...messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ],
      });

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          fullText += content;
          yield { type: 'text', content };
        }
      }

      yield { type: 'done', content: fullText };
    } catch (err) {
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
    // Convert to OpenAI format
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: this.systemRole, content: systemPrompt },
    ];

    for (const msg of messages) {
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          openaiMessages.push({ role: 'user', content: msg.content });
        } else if (Array.isArray(msg.content)) {
          // Check if it's tool results
          const first = msg.content[0];
          if (first && 'type' in first && first.type === 'tool_result') {
            for (const block of msg.content) {
              if ('tool_use_id' in block) {
                openaiMessages.push({
                  role: 'tool',
                  tool_call_id: block.tool_use_id,
                  content: block.content,
                });
              }
            }
          } else {
            // Text content blocks
            const text = msg.content
              .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
              .map(b => b.text)
              .join('');
            if (text) openaiMessages.push({ role: 'user', content: text });
          }
        }
      } else if (msg.role === 'assistant') {
        if (typeof msg.content === 'string') {
          openaiMessages.push({ role: 'assistant', content: msg.content });
        } else if (Array.isArray(msg.content)) {
          const textParts = msg.content
            .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
            .map(b => b.text)
            .join('');

          const toolCalls = msg.content
            .filter((b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } => b.type === 'tool_use')
            .map(b => ({
              id: b.id,
              type: 'function' as const,
              function: {
                name: b.name,
                arguments: JSON.stringify(b.input),
              },
            }));

          // Restore reasoning_content for DeepSeek-R1 models
          const reasoningBlocks = msg.content
            .filter((b): b is { type: 'reasoning'; text: string } => b.type === 'reasoning');
          const reasoningParts = reasoningBlocks.map(b => b.text).join('');

          const assistantMsg: any = {
            role: 'assistant',
            content: textParts || null,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          };

          // Include reasoning_content if present or if using a reasoner model
          // DeepSeek-R1 REQUIRES this field on ALL assistant messages in history
          if (reasoningBlocks.length > 0) {
            assistantMsg.reasoning_content = reasoningParts;
          } else if (this.isReasonerModel()) {
            assistantMsg.reasoning_content = '';
          }

          openaiMessages.push(assistantMsg);
        }
      }
    }

    const openaiTools: OpenAI.ChatCompletionTool[] = tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

    let response;
    const maxRetries = 5;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      await waitIfNeeded(signal);
      try {
        response = await this.client.chat.completions.create(
          {
            model: this.model,
            messages: openaiMessages,
            tools: openaiTools,
          },
          signal ? { signal } : undefined,
        );
        reportSuccess();
        break;
      } catch (err) {
        if (signal?.aborted) throw err;

        // Credits exhausted — don't retry, throw immediately with clear message
        const creditsReason = detectCreditsExhausted(err);
        if (creditsReason) {
          const freeHint = this.name === 'zai'
            ? ' Switch to a free model: /model → glm-4.7-flash or glm-4.5-flash'
            : '';
          throw new Error(`\u274C ${creditsReason}.${freeHint}`);
        }

        if (isRateLimitError(err)) {
          const waitMs = handleRateLimitError(err);
          if (attempt < maxRetries) {
            process.stdout.write(`\r\x1b[K  \u23F3 Rate limited \u2014 waiting ${Math.ceil(waitMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})...`);
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(resolve, waitMs);
              signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Aborted')); }, { once: true });
            });
            process.stdout.write('\r\x1b[K');
            continue;
          }
        }
        throw err;
      }
    }
    if (!response) throw new Error('Max retries exceeded');

    const choice = response.choices[0];
    const content: ContentBlock[] = [];

    // Capture reasoning_content from DeepSeek-R1 models (chain-of-thought)
    // Must capture even empty strings — DeepSeek requires this field on ALL assistant messages
    const rawMessage = choice.message as any;
    if (rawMessage.reasoning_content !== undefined && rawMessage.reasoning_content !== null) {
      content.push({ type: 'reasoning', text: String(rawMessage.reasoning_content) });
    } else if (this.isReasonerModel()) {
      // Reasoner models MUST have this field — insert empty marker
      content.push({ type: 'reasoning', text: '' });
    }

    if (choice.message.content) {
      content.push({ type: 'text', text: choice.message.content });
    }

    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        // v5 types include a union — narrow to function calls
        const fn = (tc as any).function as { name: string; arguments: string } | undefined;
        if (!fn) continue;
        let input: Record<string, unknown>;
        try {
          input = JSON.parse(fn.arguments);
        } catch {
          // Truncated JSON (model hit max_tokens mid-argument) — attempt repair
          input = repairTruncatedJSON(fn.arguments);
        }
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: fn.name,
          input,
        });
      }
    }

    // Map OpenAI finish_reason to our stop_reason
    const stopReason = choice.finish_reason === 'tool_calls'
      ? 'tool_use'
      : choice.finish_reason === 'length'
        ? 'max_tokens'
        : 'end_turn';

    return {
      content,
      stop_reason: stopReason as ToolResponse['stop_reason'],
      usage: response.usage ? {
        input_tokens: response.usage.prompt_tokens ?? 0,
        output_tokens: response.usage.completion_tokens ?? 0,
      } : undefined,
    };
  }
}

/**
 * Attempt to repair truncated JSON from a model that hit max_tokens.
 * Tries progressively more aggressive fixes:
 * 1. Close open strings and braces
 * 2. Return a minimal error object if unfixable
 */
function repairTruncatedJSON(raw: string): Record<string, unknown> {
  // Try closing open strings and brackets
  let attempt = raw;

  // Count open/close braces and brackets
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (const ch of attempt) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') openBraces++;
    if (ch === '}') openBraces--;
    if (ch === '[') openBrackets++;
    if (ch === ']') openBrackets--;
  }

  // If we're inside a string, close it
  if (inString) attempt += '"';

  // Remove trailing comma if present
  attempt = attempt.replace(/,\s*$/, '');

  // Close open brackets and braces
  for (let i = 0; i < openBrackets; i++) attempt += ']';
  for (let i = 0; i < openBraces; i++) attempt += '}';

  try {
    return JSON.parse(attempt);
  } catch {
    // Last resort: return a marker object so the agent loop can handle it
    return { _truncated: true, _raw: raw.slice(0, 200) };
  }
}
