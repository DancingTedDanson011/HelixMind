import { describe, it, expect, beforeEach } from 'vitest';
import { CheckpointStore, type Checkpoint } from '../../../src/cli/checkpoints/store.js';

let store: CheckpointStore;

beforeEach(() => {
  store = new CheckpointStore();
});

describe('CheckpointStore', () => {
  it('should create checkpoints with auto-incrementing IDs', () => {
    const id1 = store.create({
      type: 'session_start',
      label: 'Session started',
      messageIndex: 0,
    });
    const id2 = store.create({
      type: 'chat',
      label: 'Hello',
      messageIndex: 1,
    });

    expect(id1).toBe(1);
    expect(id2).toBe(2);
    expect(store.count).toBe(2);
  });

  it('should create checkpoints for tool calls', () => {
    const id = store.createForTool(
      'read_file',
      { path: 'test.ts' },
      'file contents here',
      0,
    );

    const cp = store.get(id);
    expect(cp).toBeDefined();
    expect(cp!.type).toBe('tool_read');
    expect(cp!.label).toContain('Read');
    expect(cp!.toolName).toBe('read_file');
  });

  it('should create checkpoints for chat messages', () => {
    const id = store.createForChat('Fix the bug in auth module', 3);

    const cp = store.get(id);
    expect(cp).toBeDefined();
    expect(cp!.type).toBe('chat');
    expect(cp!.label).toContain('Fix the bug');
    expect(cp!.messageIndex).toBe(3);
  });

  it('should truncate long chat labels', () => {
    const longMessage = 'A'.repeat(100);
    const id = store.createForChat(longMessage, 0);

    const cp = store.get(id);
    expect(cp!.label.length).toBeLessThanOrEqual(63); // 60 + '...'
  });

  it('should return all checkpoints most recent first', () => {
    store.create({ type: 'session_start', label: 'Start', messageIndex: 0 });
    store.create({ type: 'chat', label: 'First', messageIndex: 1 });
    store.create({ type: 'chat', label: 'Second', messageIndex: 2 });

    const all = store.getAll();
    expect(all.length).toBe(3);
    expect(all[0].label).toBe('Second');
    expect(all[2].label).toBe('Start');
  });

  it('should get checkpoints from a specific ID', () => {
    store.create({ type: 'session_start', label: 'Start', messageIndex: 0 });
    const id2 = store.create({ type: 'chat', label: 'First', messageIndex: 1 });
    store.create({ type: 'chat', label: 'Second', messageIndex: 2 });

    const from = store.getFrom(id2);
    expect(from.length).toBe(2);
    expect(from[0].label).toBe('First');
    expect(from[1].label).toBe('Second');
  });

  it('should get checkpoints after a specific ID', () => {
    const id1 = store.create({ type: 'session_start', label: 'Start', messageIndex: 0 });
    store.create({ type: 'chat', label: 'First', messageIndex: 1 });
    store.create({ type: 'chat', label: 'Second', messageIndex: 2 });

    const after = store.getAfter(id1);
    expect(after.length).toBe(2);
    expect(after[0].label).toBe('First');
  });

  it('should truncate checkpoints after a given ID', () => {
    store.create({ type: 'session_start', label: 'Start', messageIndex: 0 });
    const id2 = store.create({ type: 'chat', label: 'First', messageIndex: 1 });
    store.create({ type: 'chat', label: 'Second', messageIndex: 2 });
    store.create({ type: 'chat', label: 'Third', messageIndex: 3 });

    const removed = store.truncateAfter(id2);
    expect(removed.length).toBe(2);
    expect(store.count).toBe(2);
  });

  it('should store file snapshots', () => {
    const id = store.create({
      type: 'tool_edit',
      label: 'Edit test.ts',
      messageIndex: 0,
      fileSnapshots: [{
        path: '/project/test.ts',
        contentBefore: 'old content',
        contentAfter: 'new content',
      }],
    });

    const cp = store.get(id);
    expect(cp!.fileSnapshots).toBeDefined();
    expect(cp!.fileSnapshots!.length).toBe(1);
    expect(cp!.fileSnapshots![0].contentBefore).toBe('old content');
    expect(cp!.fileSnapshots![0].contentAfter).toBe('new content');
  });

  it('should track memory usage from snapshots', () => {
    expect(store.memoryUsage).toBe(0);

    store.create({
      type: 'tool_edit',
      label: 'Edit',
      messageIndex: 0,
      fileSnapshots: [{
        path: '/project/a.ts',
        contentBefore: 'A'.repeat(100),
        contentAfter: 'B'.repeat(200),
      }],
    });

    expect(store.memoryUsage).toBe(300);
  });

  it('should map tool names to correct checkpoint types', () => {
    const cases: [string, string][] = [
      ['read_file', 'tool_read'],
      ['write_file', 'tool_write'],
      ['edit_file', 'tool_edit'],
      ['run_command', 'tool_run'],
      ['git_commit', 'tool_commit'],
      ['search_files', 'tool_search'],
    ];

    for (const [toolName, expectedType] of cases) {
      const id = store.createForTool(toolName, {}, '', 0);
      const cp = store.get(id);
      expect(cp!.type).toBe(expectedType);
    }
  });

  it('should format tool labels correctly', () => {
    const cases: [string, Record<string, unknown>, string][] = [
      ['read_file', { path: 'src/app.ts' }, 'Read src/app.ts'],
      ['write_file', { path: 'new.ts' }, 'Write new.ts'],
      ['git_commit', { message: 'fix: stuff' }, 'Commit "fix: stuff"'],
      ['run_command', { command: 'npm test' }, 'Run npm test'],
    ];

    for (const [toolName, input, expected] of cases) {
      const id = store.createForTool(toolName, input, '', 0);
      const cp = store.get(id);
      expect(cp!.label).toBe(expected);
    }
  });

  it('should have timestamps on all checkpoints', () => {
    const before = new Date();
    const id = store.create({
      type: 'chat',
      label: 'test',
      messageIndex: 0,
    });
    const after = new Date();

    const cp = store.get(id);
    expect(cp!.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(cp!.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
