import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UndoStack } from '../../../src/cli/agent/undo.js';
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('UndoStack', () => {
  let stack: UndoStack;
  let testDir: string;

  beforeEach(() => {
    stack = new UndoStack();
    testDir = join(tmpdir(), `helixmind-undo-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should track file changes', () => {
    stack.push({
      id: '1',
      timestamp: Date.now(),
      tool: 'edit_file',
      path: '/test/file.ts',
      originalContent: 'before',
      newContent: 'after',
    });

    expect(stack.size).toBe(1);
  });

  it('should undo file changes', () => {
    const filePath = join(testDir, 'test.txt');
    writeFileSync(filePath, 'modified content', 'utf-8');

    stack.push({
      id: '1',
      timestamp: Date.now(),
      tool: 'edit_file',
      path: filePath,
      originalContent: 'original content',
      newContent: 'modified content',
    });

    const result = stack.undo(1);
    expect(result.undone).toBe(1);
    expect(readFileSync(filePath, 'utf-8')).toBe('original content');
  });

  it('should undo multiple changes in LIFO order', () => {
    const file1 = join(testDir, 'a.txt');
    const file2 = join(testDir, 'b.txt');
    writeFileSync(file1, 'modified A', 'utf-8');
    writeFileSync(file2, 'modified B', 'utf-8');

    stack.push({
      id: '1', timestamp: Date.now(), tool: 'edit_file',
      path: file1, originalContent: 'original A', newContent: 'modified A',
    });
    stack.push({
      id: '2', timestamp: Date.now(), tool: 'edit_file',
      path: file2, originalContent: 'original B', newContent: 'modified B',
    });

    const result = stack.undo(2);
    expect(result.undone).toBe(2);
    expect(readFileSync(file1, 'utf-8')).toBe('original A');
    expect(readFileSync(file2, 'utf-8')).toBe('original B');
  });

  it('should list entries most recent first', () => {
    stack.push({
      id: '1', timestamp: 1000, tool: 'edit_file',
      path: '/a.txt', originalContent: 'a', newContent: 'a2',
    });
    stack.push({
      id: '2', timestamp: 2000, tool: 'write_file',
      path: '/b.txt', originalContent: null, newContent: 'b',
    });

    const list = stack.list();
    expect(list.length).toBe(2);
    expect(list[0].id).toBe('2'); // Most recent first
    expect(list[1].id).toBe('1');
  });

  it('should capture file state', () => {
    const filePath = join(testDir, 'capture.txt');
    writeFileSync(filePath, 'test content', 'utf-8');

    const state = UndoStack.captureState(filePath);
    expect(state).toBe('test content');
  });

  it('should return null for non-existent files', () => {
    const state = UndoStack.captureState(join(testDir, 'nonexistent.txt'));
    expect(state).toBeNull();
  });
});
