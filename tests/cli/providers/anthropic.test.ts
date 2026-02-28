import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicProvider } from '../../../src/cli/providers/anthropic.js';

// Mock the SDK
vi.mock('@anthropic-ai/sdk', () => {
  const mockStream = {
    on: vi.fn().mockReturnThis(),
    finalMessage: vi.fn().mockResolvedValue({
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
    [Symbol.asyncIterator]: async function* () {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } };
      yield { type: 'message_stop' };
    },
  };

  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        stream: vi.fn().mockReturnValue(mockStream),
      },
    })),
  };
});

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider('test-key', 'claude-sonnet-4-6');
  });

  it('should have correct name', () => {
    expect(provider.name).toBe('anthropic');
  });

  it('should stream text events', async () => {
    const events = [];
    for await (const event of provider.stream(
      [{ role: 'user', content: 'Hello' }],
      'You are helpful.',
    )) {
      events.push(event);
    }
    expect(events.some(e => e.type === 'text')).toBe(true);
    expect(events[events.length - 1].type).toBe('done');
  });

  it('should use custom model', () => {
    const custom = new AnthropicProvider('key', 'claude-opus-4-6');
    expect(custom.model).toBe('claude-opus-4-6');
  });
});
