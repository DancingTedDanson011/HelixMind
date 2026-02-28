import Anthropic from '@anthropic-ai/sdk';
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
} from './rate-limiter.js';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly model: string;
  private client: Anthropic;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-6') {
    this.model = model;
    this.client = new Anthropic({ apiKey });
  }

  async *stream(
    messages: ChatMessage[],
    systemPrompt: string,
  ): AsyncGenerator<StreamEvent> {
    let fullText = '';

    try {
      await waitIfNeeded();
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          fullText += event.delta.text;
          yield { type: 'text', content: event.delta.text };
        }
      }

      reportSuccess();
      yield { type: 'done', content: fullText };
    } catch (err) {
      if (isRateLimitError(err)) {
        const waitMs = handleRateLimitError(err);
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
    const anthropicMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as any,
    }));

    const anthropicTools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool.InputSchema,
    }));

    // Rate limit aware request with auto-retry
    let response;
    const maxRetries = 5;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      await waitIfNeeded(signal);

      try {
        response = await this.client.messages.create(
          {
            model: this.model,
            max_tokens: 8192,
            system: systemPrompt,
            messages: anthropicMessages,
            tools: anthropicTools,
          },
          signal ? { signal } : undefined,
        );
        reportSuccess();
        break;
      } catch (err) {
        if (signal?.aborted) throw err;
        if (isRateLimitError(err)) {
          const waitMs = handleRateLimitError(err);
          if (attempt < maxRetries) {
            // Show wait and retry
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

    const content: ContentBlock[] = response.content.map(block => {
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

    return {
      content,
      stop_reason: response.stop_reason as ToolResponse['stop_reason'],
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    };
  }
}
