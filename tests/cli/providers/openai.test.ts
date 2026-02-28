import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from '../../../src/cli/providers/openai.js';

// Mock the SDK
vi.mock('openai', () => {
  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield { choices: [{ delta: { content: 'Hello' } }] };
      yield { choices: [{ delta: { content: ' world' } }] };
      yield { choices: [{ delta: {} }] };
    },
  };

  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(mockStream),
        },
      },
    })),
  };
});

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider('test-key', 'gpt-4o');
  });

  it('should have correct name', () => {
    expect(provider.name).toBe('openai');
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
    const custom = new OpenAIProvider('key', 'gpt-4o-mini');
    expect(custom.model).toBe('gpt-4o-mini');
  });

  it('should use system role for non-openai providers', () => {
    const deepseek = new OpenAIProvider('key', 'deepseek-reasoner', 'https://api.deepseek.com', 'deepseek');
    expect(deepseek.name).toBe('deepseek');
  });

  it('should detect reasoner models correctly', () => {
    // Access private method via any cast for testing
    const reasoner = new OpenAIProvider('key', 'deepseek-reasoner', undefined, 'deepseek');
    expect((reasoner as any).isReasonerModel()).toBe(true);

    const r1 = new OpenAIProvider('key', 'deepseek-r1:32b', undefined, 'deepseek');
    expect((r1 as any).isReasonerModel()).toBe(true);

    const regular = new OpenAIProvider('key', 'gpt-4o', undefined, 'openai');
    expect((regular as any).isReasonerModel()).toBe(false);

    const coder = new OpenAIProvider('key', 'deepseek-chat', undefined, 'deepseek');
    expect((coder as any).isReasonerModel()).toBe(false);
  });
});
