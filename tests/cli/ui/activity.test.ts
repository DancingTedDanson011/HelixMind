import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ActivityIndicator, renderTaskSummary, type TaskStep } from '../../../src/cli/ui/activity.js';
import { BottomChrome } from '../../../src/cli/ui/bottom-chrome.js';

/** Creates a mock BottomChrome that tracks setRow calls */
function createMockChrome() {
  const rows: [string, string, string] = ['', '', ''];
  const chrome = {
    isActive: true,
    isInlineMode: false,
    reservedRows: 3,
    promptRow: 21,
    activate: vi.fn(),
    deactivate: vi.fn(),
    setRow: vi.fn((index: 0 | 1 | 2, content: string) => { rows[index] = content; }),
    redraw: vi.fn(),
    handleResize: vi.fn(),
    positionCursorForPrompt: vi.fn(),
    rows,
  };
  return chrome as unknown as BottomChrome & { rows: [string, string, string]; setRow: ReturnType<typeof vi.fn> };
}

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
    const chrome = createMockChrome();
    const activity = new ActivityIndicator(chrome);
    expect(activity.isRunning).toBe(false);

    activity.start();
    expect(activity.isRunning).toBe(true);

    // Should render to chrome row 0 immediately
    expect(chrome.setRow).toHaveBeenCalled();
    const content = chrome.rows[0];
    expect(content).toContain('HelixMind');
    expect(content).toContain('working');

    activity.stop();
    expect(activity.isRunning).toBe(false);
  });

  it('animates on interval', () => {
    const chrome = createMockChrome();
    const activity = new ActivityIndicator(chrome);
    activity.start();
    const callsAfterStart = chrome.setRow.mock.calls.length;

    vi.advanceTimersByTime(240); // 3 frames at 80ms
    expect(chrome.setRow.mock.calls.length).toBeGreaterThan(callsAfterStart);

    activity.stop();
  });

  it('shows step info', () => {
    const chrome = createMockChrome();
    const activity = new ActivityIndicator(chrome);
    activity.start();
    chrome.setRow.mockClear();

    activity.setStep(3, 'editing main.ts');
    vi.advanceTimersByTime(80);

    const content = chrome.rows[0];
    expect(content).toContain('Step 3');
    expect(content).toContain('editing main.ts');

    activity.stop();
  });

  it('writes Done inline to stdout on stop', () => {
    const chrome = createMockChrome();
    const activity = new ActivityIndicator(chrome);
    activity.start();
    writeSpy.mockClear();

    activity.stop();
    const output = writeSpy.mock.calls.map(c => String(c[0])).join('');
    // Writes "Done" inline (part of conversation flow) directly to stdout
    expect(output).toContain('HelixMind');
    expect(output).toContain('Done');
  });

  it('restores separator on stop', () => {
    const chrome = createMockChrome();
    const activity = new ActivityIndicator(chrome);
    activity.setSeparatorContent('───separator───');
    activity.start();
    chrome.setRow.mockClear();

    activity.stop();
    // Should restore separator on chrome row 0
    expect(chrome.setRow).toHaveBeenCalledWith(0, '───separator───');
  });

  it('restores separator on pause', () => {
    const chrome = createMockChrome();
    const activity = new ActivityIndicator(chrome);
    activity.setSeparatorContent('───separator───');
    activity.start();
    chrome.setRow.mockClear();

    activity.pauseAnimation();
    expect(chrome.setRow).toHaveBeenCalledWith(0, '───separator───');
    expect(activity.isAnimating).toBe(false);
    // Timer still runs
    expect(activity.isRunning).toBe(true);
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
