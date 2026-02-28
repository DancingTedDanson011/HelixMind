import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ActivityIndicator, renderTaskSummary, type TaskStep } from '../../../src/cli/ui/activity.js';

describe('ActivityIndicator', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    writeSpy.mockRestore();
    vi.useRealTimers();
  });

  it('starts and stops cleanly', () => {
    const activity = new ActivityIndicator();
    expect(activity.isRunning).toBe(false);

    activity.start();
    expect(activity.isRunning).toBe(true);

    // Should render immediately
    expect(writeSpy).toHaveBeenCalled();
    const output = writeSpy.mock.calls.map(c => String(c[0])).join('');
    expect(output).toContain('HelixMind');
    expect(output).toContain('working');

    activity.stop();
    expect(activity.isRunning).toBe(false);
  });

  it('animates on interval', () => {
    const activity = new ActivityIndicator();
    activity.start();
    const callsAfterStart = writeSpy.mock.calls.length;

    vi.advanceTimersByTime(240); // 3 frames at 80ms
    expect(writeSpy.mock.calls.length).toBeGreaterThan(callsAfterStart);

    activity.stop();
  });

  it('shows step info', () => {
    const activity = new ActivityIndicator();
    activity.start();
    writeSpy.mockClear();

    activity.setStep(3, 'editing main.ts');
    vi.advanceTimersByTime(80);

    const output = writeSpy.mock.calls.map(c => String(c[0])).join('');
    expect(output).toContain('Step 3');
    expect(output).toContain('editing main.ts');

    activity.stop();
  });

  it('clears line on stop', () => {
    const activity = new ActivityIndicator();
    activity.start();
    writeSpy.mockClear();

    activity.stop();
    const output = writeSpy.mock.calls.map(c => String(c[0])).join('');
    expect(output).toContain('\r\x1b[K');
  });
});

describe('renderTaskSummary', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('does nothing with no steps', () => {
    renderTaskSummary([]);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('renders completed steps with checkmarks', () => {
    const steps: TaskStep[] = [
      { num: 1, tool: 'read_file', label: 'reading main.ts', status: 'done' },
      { num: 2, tool: 'edit_file', label: 'editing main.ts', status: 'done' },
    ];
    renderTaskSummary(steps);
    const output = writeSpy.mock.calls.map(c => String(c[0])).join('');
    expect(output).toContain('Task Summary');
    expect(output).toContain('Step 1');
    expect(output).toContain('Step 2');
    expect(output).toContain('2 steps completed');
  });

  it('renders errors prominently', () => {
    const steps: TaskStep[] = [
      { num: 1, tool: 'read_file', label: 'reading main.ts', status: 'done' },
      { num: 2, tool: 'run_command', label: 'running tests', status: 'error', error: 'exit code 1' },
    ];
    renderTaskSummary(steps);
    const output = writeSpy.mock.calls.map(c => String(c[0])).join('');
    expect(output).toContain('1 done');
    expect(output).toContain('1 error');
    expect(output).toContain('exit code 1');
  });
});
