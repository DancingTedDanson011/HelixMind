import { describe, it, expect } from 'vitest';
import { trimConversation, estimateTokens } from '../../../src/cli/context/trimmer.js';
import type { ToolMessage } from '../../../src/cli/providers/types.js';

describe('trimConversation', () => {
  it('should not trim when within budget', () => {
    const history: ToolMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];
    const dropped = trimConversation(history, 10_000);
    expect(dropped).toBe(0);
    expect(history).toHaveLength(2);
  });

  it('should trim old messages from front', () => {
    const history: ToolMessage[] = [
      { role: 'user', content: 'A'.repeat(2000) },
      { role: 'assistant', content: 'B'.repeat(2000) },
      { role: 'user', content: 'C'.repeat(200) },
      { role: 'assistant', content: 'D'.repeat(200) },
      { role: 'user', content: 'E'.repeat(200) },
      { role: 'assistant', content: 'F'.repeat(200) },
      { role: 'user', content: 'Recent question' },
      { role: 'assistant', content: 'Recent answer' },
    ];
    // Budget so tight that old messages must be dropped
    const dropped = trimConversation(history, 500);
    expect(dropped).toBeGreaterThan(0);
    // First message should be the trimmed marker
    expect(history[0].role).toBe('user');
    expect(history[0].content).toContain('trimmed');
  });

  it('should drop orphaned tool_result messages after trimming', () => {
    // This is the exact scenario that caused the 400 error:
    // [user text] [assistant with tool_use] [user with tool_result] [assistant text] ...
    // Trimming drops the first 2 (user + assistant/tool_use), leaving
    // the orphaned tool_result as the first message.
    const history: ToolMessage[] = [
      { role: 'user', content: 'A'.repeat(3000) },  // 0: big user message
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'toolu_abc', name: 'list_directory', input: { path: '.' } },
        ],
      },  // 1: assistant with tool_use
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'toolu_abc', content: 'file1.ts\nfile2.ts' },
        ],
      },  // 2: user with tool_result (paired with index 1)
      { role: 'assistant', content: 'D'.repeat(200) },  // 3: assistant text
      { role: 'user', content: 'E'.repeat(200) },       // 4: user text
      { role: 'assistant', content: 'F'.repeat(200) },   // 5: assistant text
      { role: 'user', content: 'Recent question' },      // 6: recent
      { role: 'assistant', content: 'Recent answer' },    // 7: recent
    ];

    const dropped = trimConversation(history, 800);

    expect(dropped).toBeGreaterThan(0);

    // The critical check: no message should have tool_result content
    // without a preceding assistant message with tool_use
    for (let i = 0; i < history.length; i++) {
      const msg = history[i];
      if (Array.isArray(msg.content)) {
        const hasToolResult = msg.content.some((b: any) => b.type === 'tool_result');
        if (hasToolResult) {
          // Must have a preceding assistant with tool_use
          expect(i).toBeGreaterThan(0);
          const prev = history[i - 1];
          expect(prev.role).toBe('assistant');
          expect(Array.isArray(prev.content)).toBe(true);
          const hasToolUse = (prev.content as any[]).some((b: any) => b.type === 'tool_use');
          expect(hasToolUse).toBe(true);
        }
      }
    }

    // First message should be the trimmed marker (user text)
    expect(history[0].role).toBe('user');
    expect(typeof history[0].content).toBe('string');
    expect(history[0].content).toContain('trimmed');
  });

  it('should handle multiple consecutive tool_result orphans', () => {
    // Edge case: multiple tool calls in a row get orphaned
    const history: ToolMessage[] = [
      { role: 'user', content: 'A'.repeat(3000) },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'toolu_1', name: 'read_file', input: { path: 'a.ts' } }],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'content a' }],
      },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'toolu_2', name: 'read_file', input: { path: 'b.ts' } }],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'toolu_2', content: 'content b' }],
      },
      { role: 'assistant', content: 'Final answer' },
      { role: 'user', content: 'Next question' },
      { role: 'assistant', content: 'Next answer' },
    ];

    const dropped = trimConversation(history, 600);
    expect(dropped).toBeGreaterThan(0);

    // First real message (after marker) must NOT be an orphaned tool_result
    expect(history[0].role).toBe('user');
    expect(typeof history[0].content).toBe('string');

    // No orphaned tool_results anywhere
    for (let i = 0; i < history.length; i++) {
      const msg = history[i];
      if (Array.isArray(msg.content)) {
        const hasToolResult = msg.content.some((b: any) => b.type === 'tool_result');
        if (hasToolResult) {
          expect(i).toBeGreaterThan(0);
          const prev = history[i - 1];
          expect(prev.role).toBe('assistant');
        }
      }
    }
  });
});

describe('estimateTokens', () => {
  it('should estimate tokens for string content', () => {
    const msgs: ToolMessage[] = [
      { role: 'user', content: 'Hello world' }, // 11 chars = ~3 tokens
    ];
    expect(estimateTokens(msgs)).toBe(3);
  });

  it('should estimate tokens for array content', () => {
    const msgs: ToolMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Some response' },
        ],
      },
    ];
    expect(estimateTokens(msgs)).toBeGreaterThan(0);
  });
});
