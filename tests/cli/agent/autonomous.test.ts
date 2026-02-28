import { describe, it, expect, vi } from 'vitest';
import { runAutonomousLoop } from '../../../src/cli/agent/autonomous.js';

describe('Autonomous Mode', () => {
  it('should stop when ALL_TASKS_COMPLETE is returned', async () => {
    const rounds: number[] = [];

    const result = await runAutonomousLoop({
      sendMessage: async () => 'ALL_TASKS_COMPLETE',
      isAborted: () => false,
      onRoundStart: (r) => rounds.push(r),
      onRoundEnd: () => {},
      updateStatus: () => {},
    });

    expect(result).toBe(0); // No tasks completed (immediately said done)
    expect(rounds).toEqual([1]);
  });

  it('should complete multiple rounds before stopping', async () => {
    let callCount = 0;
    const summaries: string[] = [];

    const result = await runAutonomousLoop({
      sendMessage: async () => {
        callCount++;
        if (callCount >= 3) return 'ALL_TASKS_COMPLETE';
        return `DONE: Fixed issue ${callCount}`;
      },
      isAborted: () => false,
      onRoundStart: () => {},
      onRoundEnd: (_r, summary) => summaries.push(summary),
      updateStatus: () => {},
    });

    expect(result).toBe(2);
    expect(summaries).toEqual(['Fixed issue 1', 'Fixed issue 2']);
  });

  it('should stop when aborted', async () => {
    let aborted = false;
    let callCount = 0;

    const result = await runAutonomousLoop({
      sendMessage: async () => {
        callCount++;
        if (callCount >= 2) aborted = true;
        return `DONE: Task ${callCount}`;
      },
      isAborted: () => aborted,
      onRoundStart: () => {},
      onRoundEnd: () => {},
      updateStatus: () => {},
    });

    expect(result).toBeLessThanOrEqual(2);
  });

  it('should continue after errors', async () => {
    let callCount = 0;

    const result = await runAutonomousLoop({
      sendMessage: async () => {
        callCount++;
        if (callCount === 1) throw new Error('API error');
        if (callCount === 2) return 'DONE: Fixed after error';
        return 'ALL_TASKS_COMPLETE';
      },
      isAborted: () => false,
      onRoundStart: () => {},
      onRoundEnd: () => {},
      updateStatus: () => {},
    });

    expect(result).toBe(1); // One successful task despite error
  });

  it('should extract DONE: summary correctly', async () => {
    const summaries: string[] = [];

    await runAutonomousLoop({
      sendMessage: async () => {
        if (summaries.length === 0) {
          return 'I found a bug in the code.\nI fixed it by changing X to Y.\nDONE: Fixed null check in parser.ts';
        }
        return 'ALL_TASKS_COMPLETE';
      },
      isAborted: () => false,
      onRoundStart: () => {},
      onRoundEnd: (_r, s) => summaries.push(s),
      updateStatus: () => {},
    });

    expect(summaries[0]).toBe('Fixed null check in parser.ts');
  });
});
