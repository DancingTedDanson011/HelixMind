import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { runAgentLoop, AgentController, AgentAbortError } from '../../../src/cli/agent/loop.js';
import { initializeTools } from '../../../src/cli/agent/tools/registry.js';
import { PermissionManager } from '../../../src/cli/agent/permissions.js';
import { UndoStack } from '../../../src/cli/agent/undo.js';
import { CheckpointStore } from '../../../src/cli/checkpoints/store.js';
import type { LLMProvider, ToolMessage, ToolDefinition, ToolResponse, ContentBlock } from '../../../src/cli/providers/types.js';

// Mock provider that returns tool calls
function createMockProvider(responses: ToolResponse[]): LLMProvider {
  let callIdx = 0;
  return {
    name: 'mock',
    model: 'mock-model',
    async *stream() { yield { type: 'done' as const, content: 'mock' }; },
    async chatWithTools(messages, systemPrompt, tools): Promise<ToolResponse> {
      const response = responses[callIdx] ?? {
        content: [{ type: 'text' as const, text: 'Done.' }],
        stop_reason: 'end_turn' as const,
      };
      callIdx++;
      return response;
    },
  };
}

let testDir: string;

beforeAll(async () => {
  await initializeTools();
});

beforeEach(() => {
  testDir = join(tmpdir(), `helixmind-loop-test-${randomUUID()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
});

describe('Agent Loop', () => {
  it('should handle text-only response', async () => {
    const provider = createMockProvider([{
      content: [{ type: 'text', text: 'Hello, I can help you!' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    }]);

    const result = await runAgentLoop('Hello', [], {
      provider,
      systemPrompt: 'You are helpful',
      permissions: new PermissionManager(),
      toolContext: { projectRoot: testDir, undoStack: new UndoStack() },
    });

    expect(result.text).toContain('Hello, I can help you!');
    expect(result.toolCalls).toBe(0);
    expect(result.aborted).toBe(false);
  });

  it('should execute tool calls in the loop', async () => {
    // Create a test file
    writeFileSync(join(testDir, 'test.ts'), 'console.log("hello");\n', 'utf-8');

    const provider = createMockProvider([
      // First response: tool call
      {
        content: [{
          type: 'tool_use',
          id: 'call_1',
          name: 'read_file',
          input: { path: 'test.ts' },
        }],
        stop_reason: 'tool_use',
        usage: { input_tokens: 20, output_tokens: 10 },
      },
      // Second response: text after getting tool result
      {
        content: [{ type: 'text', text: 'I read the file. It contains a console.log.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 30, output_tokens: 15 },
      },
    ]);

    const result = await runAgentLoop('Read test.ts', [], {
      provider,
      systemPrompt: 'You are helpful',
      permissions: new PermissionManager(),
      toolContext: { projectRoot: testDir, undoStack: new UndoStack() },
    });

    expect(result.toolCalls).toBe(1);
    expect(result.tokensUsed.input).toBeGreaterThan(0);
  });

  it('should handle multiple sequential tool calls', async () => {
    writeFileSync(join(testDir, 'a.ts'), 'file A', 'utf-8');
    writeFileSync(join(testDir, 'b.ts'), 'file B', 'utf-8');

    const provider = createMockProvider([
      {
        content: [{
          type: 'tool_use', id: 'c1', name: 'read_file', input: { path: 'a.ts' },
        }],
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 5 },
      },
      {
        content: [{
          type: 'tool_use', id: 'c2', name: 'read_file', input: { path: 'b.ts' },
        }],
        stop_reason: 'tool_use',
        usage: { input_tokens: 20, output_tokens: 10 },
      },
      {
        content: [{ type: 'text', text: 'Both files read.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 30, output_tokens: 15 },
      },
    ]);

    const result = await runAgentLoop('Read both files', [], {
      provider,
      systemPrompt: 'You are helpful',
      permissions: new PermissionManager(),
      toolContext: { projectRoot: testDir, undoStack: new UndoStack() },
    });

    expect(result.toolCalls).toBe(2);
  });

  it('should respect max iterations', async () => {
    // Provider that always returns tool calls
    const infiniteProvider = createMockProvider(
      Array.from({ length: 10 }, (_, i) => ({
        content: [{
          type: 'tool_use' as const,
          id: `call_${i}`,
          name: 'read_file',
          input: { path: 'test.ts' },
        }],
        stop_reason: 'tool_use' as const,
        usage: { input_tokens: 10, output_tokens: 5 },
      })),
    );

    writeFileSync(join(testDir, 'test.ts'), 'x', 'utf-8');

    const result = await runAgentLoop('Loop forever', [], {
      provider: infiniteProvider,
      systemPrompt: 'test',
      permissions: new PermissionManager(),
      toolContext: { projectRoot: testDir, undoStack: new UndoStack() },
      maxIterations: 3,
    });

    expect(result.toolCalls).toBe(3);
  });

  it('should track token usage across iterations', async () => {
    const provider = createMockProvider([
      {
        content: [{ type: 'text', text: 'Done.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    ]);

    const result = await runAgentLoop('Test', [], {
      provider,
      systemPrompt: 'test',
      permissions: new PermissionManager(),
      toolContext: { projectRoot: testDir, undoStack: new UndoStack() },
    });

    expect(result.tokensUsed.input).toBe(100);
    expect(result.tokensUsed.output).toBe(50);
  });

  it('should create checkpoints for tool calls when store provided', async () => {
    writeFileSync(join(testDir, 'test.ts'), 'content', 'utf-8');

    const checkpointStore = new CheckpointStore();
    const provider = createMockProvider([
      {
        content: [{
          type: 'tool_use', id: 'c1', name: 'read_file', input: { path: 'test.ts' },
        }],
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 5 },
      },
      {
        content: [{ type: 'text', text: 'Done.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 20, output_tokens: 10 },
      },
    ]);

    await runAgentLoop('Read test.ts', [], {
      provider,
      systemPrompt: 'test',
      permissions: new PermissionManager(),
      toolContext: { projectRoot: testDir, undoStack: new UndoStack() },
      checkpointStore,
    });

    expect(checkpointStore.count).toBe(1);
    const cp = checkpointStore.getAll()[0];
    expect(cp.type).toBe('tool_read');
    expect(cp.toolName).toBe('read_file');
  });
});
