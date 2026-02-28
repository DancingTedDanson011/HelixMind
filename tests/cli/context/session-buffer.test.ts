import { describe, it, expect, beforeEach } from 'vitest';
import { SessionBuffer } from '../../../src/cli/context/session-buffer.js';

describe('SessionBuffer', () => {
  let buffer: SessionBuffer;

  beforeEach(() => {
    buffer = new SessionBuffer();
  });

  it('starts empty', () => {
    expect(buffer.eventCount).toBe(0);
    expect(buffer.totalErrors).toBe(0);
    expect(buffer.buildContext()).toBe('');
  });

  it('tracks user messages', () => {
    buffer.addUserMessage('fix the bug in main.ts');
    expect(buffer.eventCount).toBe(1);
    const ctx = buffer.buildContext();
    expect(ctx).toContain('fix the bug in main.ts');
    expect(ctx).toContain('Session Working Memory');
  });

  it('truncates long user messages', () => {
    const long = 'a'.repeat(300);
    buffer.addUserMessage(long);
    const ctx = buffer.buildContext();
    expect(ctx).toContain('...');
    expect(ctx).not.toContain('a'.repeat(300));
  });

  it('tracks tool calls', () => {
    buffer.addToolCall('read_file', { path: 'src/main.ts' });
    buffer.addToolCall('edit_file', { path: 'src/main.ts' });
    expect(buffer.eventCount).toBe(2);
    const ctx = buffer.buildContext();
    expect(ctx).toContain('2 tool calls');
  });

  it('tracks file modifications separately from reads', () => {
    buffer.addToolCall('read_file', { path: 'src/a.ts' });
    buffer.addToolCall('write_file', { path: 'src/b.ts' });
    buffer.addToolCall('edit_file', { path: 'src/c.ts' });

    const modified = buffer.getModifiedFiles();
    expect(modified).toContain('src/b.ts');
    expect(modified).toContain('src/c.ts');
    expect(modified).not.toContain('src/a.ts');
  });

  it('tracks errors for auto-recovery', () => {
    buffer.addToolError('run_command', 'npm test failed with exit code 1');
    expect(buffer.totalErrors).toBe(1);

    const errors = buffer.getRecentErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].summary).toContain('npm test failed');

    const ctx = buffer.buildContext();
    expect(ctx).toContain('Recent errors');
    expect(ctx).toContain('auto-recover');
  });

  it('builds context with file info', () => {
    buffer.addToolCall('read_file', { path: 'src/a.ts' });
    buffer.addToolCall('write_file', { path: 'src/b.ts' });
    buffer.addToolCall('read_file', { path: 'src/c.ts' });

    const ctx = buffer.buildContext();
    expect(ctx).toContain('Files modified');
    expect(ctx).toContain('src/b.ts');
    expect(ctx).toContain('Files read');
    // a.ts and c.ts are read-only
    expect(ctx).toContain('src/a.ts');
  });

  it('limits event count with smart pruning', () => {
    // Add more than maxEvents
    for (let i = 0; i < 70; i++) {
      buffer.addToolCall('read_file', { path: `file${i}.ts` });
    }
    // Should be pruned below max
    expect(buffer.eventCount).toBeLessThanOrEqual(60);
  });

  it('preserves user messages and errors during pruning', () => {
    buffer.addUserMessage('important request');
    buffer.addToolError('run_command', 'critical error');
    // Fill with tool calls to trigger pruning
    for (let i = 0; i < 70; i++) {
      buffer.addToolCall('list_directory', { path: '.' });
    }
    const ctx = buffer.buildContext();
    expect(ctx).toContain('important request');
    expect(ctx).toContain('critical error');
  });

  it('summarizes different tool types correctly', () => {
    buffer.addToolCall('run_command', { command: 'npm run build' });
    buffer.addToolCall('search_files', { pattern: 'TODO' });
    buffer.addToolCall('git_status', {});
    expect(buffer.eventCount).toBe(3);
  });

  it('tracks assistant summaries', () => {
    buffer.addAssistantSummary('I fixed the bug by updating the import');
    expect(buffer.eventCount).toBe(1);
  });

  describe('topic tracking', () => {
    it('extracts topics from assistant responses', () => {
      buffer.addTopicFromResponse(
        'The AGPL license requires that any modified version of the software must also be released under AGPL when distributed. This means commercial forks must share their source code.',
      );
      const topics = buffer.getTopicsCovered();
      expect(topics.length).toBe(1);
      expect(topics[0]).toBeTruthy();
    });

    it('avoids duplicate topics', () => {
      buffer.addTopicFromResponse(
        'The AGPL license requires source code sharing for all distributed modifications.',
      );
      buffer.addTopicFromResponse(
        'The AGPL license also mandates that network users can request the source code.',
      );
      const topics = buffer.getTopicsCovered();
      // Both mention AGPL license — should deduplicate
      expect(topics.length).toBe(1);
    });

    it('includes topics in context output', () => {
      buffer.addTopicFromResponse(
        'Docker containers provide process isolation using Linux namespaces and cgroups.',
      );
      const ctx = buffer.buildContext();
      expect(ctx).toContain('Topics already covered');
      expect(ctx).toContain('DO NOT repeat');
    });

    it('skips very short responses', () => {
      buffer.addTopicFromResponse('OK done.');
      expect(buffer.getTopicsCovered().length).toBe(0);
    });

    it('limits topic count', () => {
      for (let i = 0; i < 20; i++) {
        buffer.addTopicFromResponse(
          `Unique topic number ${i}: explanation about completely different subject matter ${i * 1000}`,
        );
      }
      expect(buffer.getTopicsCovered().length).toBeLessThanOrEqual(15);
    });
  });
});
