import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { CheckpointStore } from '../../../src/cli/checkpoints/store.js';
import {
  revertChatOnly,
  revertCodeOnly,
  revertBoth,
  captureFileSnapshots,
  fillSnapshotAfter,
} from '../../../src/cli/checkpoints/revert.js';
import type { ToolMessage } from '../../../src/cli/providers/types.js';

let testDir: string;
let store: CheckpointStore;

beforeEach(() => {
  testDir = join(tmpdir(), `helixmind-revert-test-${randomUUID()}`);
  mkdirSync(testDir, { recursive: true });
  store = new CheckpointStore();
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
});

describe('revertChatOnly', () => {
  it('should truncate chat history to checkpoint', () => {
    const agentHistory: ToolMessage[] = [
      { role: 'user', content: 'msg1' },
      { role: 'assistant', content: [{ type: 'text', text: 'resp1' }] },
      { role: 'user', content: 'msg2' },
      { role: 'assistant', content: [{ type: 'text', text: 'resp2' }] },
    ];
    const simpleMessages = [
      { role: 'user', content: 'msg1' },
      { role: 'user', content: 'msg2' },
    ];

    // Create checkpoints
    const cp1 = store.create({ type: 'chat', label: 'msg1', messageIndex: 2 });
    store.create({ type: 'chat', label: 'msg2', messageIndex: 4 });

    const result = revertChatOnly(cp1, store, agentHistory, simpleMessages);

    expect(result.type).toBe('chat');
    expect(result.filesReverted).toBe(0);
    expect(agentHistory.length).toBe(2);
    expect(simpleMessages.length).toBe(1);
    expect(store.count).toBe(1); // Only cp1 remains
  });

  it('should handle non-existent checkpoint gracefully', () => {
    const result = revertChatOnly(999, store, [], []);
    expect(result.messagesRemoved).toBe(0);
    expect(result.checkpointsRemoved).toBe(0);
  });
});

describe('revertCodeOnly', () => {
  it('should restore files to their state before the checkpoint', () => {
    const filePath = join(testDir, 'code.ts');
    writeFileSync(filePath, 'original content', 'utf-8');

    // Create checkpoint with file snapshot (simulating an edit)
    const cpId = store.create({
      type: 'tool_edit',
      label: 'Edit code.ts',
      messageIndex: 2,
      fileSnapshots: [{
        path: filePath,
        contentBefore: 'original content',
        contentAfter: 'modified content',
      }],
    });

    // Simulate the file was actually changed
    writeFileSync(filePath, 'modified content', 'utf-8');

    const result = revertCodeOnly(cpId, store);

    expect(result.type).toBe('code');
    expect(result.filesReverted).toBe(1);
    expect(readFileSync(filePath, 'utf-8')).toBe('original content');
  });

  it('should handle multiple file changes', () => {
    const file1 = join(testDir, 'a.ts');
    const file2 = join(testDir, 'b.ts');
    writeFileSync(file1, 'a-original', 'utf-8');
    writeFileSync(file2, 'b-original', 'utf-8');

    const cpId = store.create({
      type: 'tool_edit',
      label: 'Edit a.ts',
      messageIndex: 0,
      fileSnapshots: [{
        path: file1,
        contentBefore: 'a-original',
        contentAfter: 'a-modified',
      }],
    });

    store.create({
      type: 'tool_edit',
      label: 'Edit b.ts',
      messageIndex: 1,
      fileSnapshots: [{
        path: file2,
        contentBefore: 'b-original',
        contentAfter: 'b-modified',
      }],
    });

    // Simulate changes
    writeFileSync(file1, 'a-modified', 'utf-8');
    writeFileSync(file2, 'b-modified', 'utf-8');

    const result = revertCodeOnly(cpId, store);

    expect(result.filesReverted).toBe(2);
    expect(readFileSync(file1, 'utf-8')).toBe('a-original');
    expect(readFileSync(file2, 'utf-8')).toBe('b-original');
  });
});

describe('revertBoth', () => {
  it('should revert both chat and code', () => {
    const filePath = join(testDir, 'both.ts');
    writeFileSync(filePath, 'before', 'utf-8');

    const agentHistory: ToolMessage[] = [
      { role: 'user', content: 'do stuff' },
      { role: 'assistant', content: [{ type: 'text', text: 'ok' }] },
    ];
    const simpleMessages = [{ role: 'user', content: 'do stuff' }];

    const cpId = store.create({
      type: 'tool_edit',
      label: 'Edit both.ts',
      messageIndex: 0,
      fileSnapshots: [{
        path: filePath,
        contentBefore: 'before',
        contentAfter: 'after',
      }],
    });

    store.create({ type: 'chat', label: 'response', messageIndex: 2 });

    writeFileSync(filePath, 'after', 'utf-8');

    const result = revertBoth(cpId, store, agentHistory, simpleMessages);

    expect(result.type).toBe('both');
    expect(result.filesReverted).toBeGreaterThan(0);
    expect(agentHistory.length).toBe(0);
    expect(readFileSync(filePath, 'utf-8')).toBe('before');
  });
});

describe('captureFileSnapshots', () => {
  it('should capture snapshot for write_file', () => {
    const filePath = join(testDir, 'snap.ts');
    writeFileSync(filePath, 'existing', 'utf-8');

    const snapshots = captureFileSnapshots('write_file', { path: 'snap.ts' }, testDir);

    expect(snapshots).toBeDefined();
    expect(snapshots!.length).toBe(1);
    expect(snapshots![0].contentBefore).toBe('existing');
    expect(snapshots![0].contentAfter).toBe(''); // placeholder
  });

  it('should capture null for non-existent file', () => {
    const snapshots = captureFileSnapshots('write_file', { path: 'nonexistent.ts' }, testDir);

    expect(snapshots).toBeDefined();
    expect(snapshots![0].contentBefore).toBeNull();
  });

  it('should return undefined for read-only tools', () => {
    expect(captureFileSnapshots('read_file', { path: 'test.ts' }, testDir)).toBeUndefined();
    expect(captureFileSnapshots('search_files', { pattern: 'foo' }, testDir)).toBeUndefined();
    expect(captureFileSnapshots('run_command', { command: 'ls' }, testDir)).toBeUndefined();
  });
});

describe('fillSnapshotAfter', () => {
  it('should fill after content from disk', () => {
    const filePath = join(testDir, 'fill.ts');
    writeFileSync(filePath, 'after edit', 'utf-8');

    const snapshots = [{ path: filePath, contentBefore: 'before', contentAfter: '' }];
    fillSnapshotAfter(snapshots);

    expect(snapshots[0].contentAfter).toBe('after edit');
  });

  it('should handle undefined gracefully', () => {
    // Should not throw
    fillSnapshotAfter(undefined);
  });
});
