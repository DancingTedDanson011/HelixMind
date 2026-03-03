import { describe, it, expect } from 'vitest';
import { renderStatusBar, type StatusBarData } from '../../../src/cli/ui/statusbar.js';

function makeData(overrides: Partial<StatusBarData> = {}): StatusBarData {
  return {
    spiral: { l1: 42, l2: 28, l3: 15, l4: 8, l5: 3, l6: 5 },
    sessionTokens: 58000,
    tokens: { thisMessage: 3200, thisSession: 12000 },
    tools: { callsThisRound: 3 },
    model: 'claude-sonnet-4-6',
    git: { branch: 'main', uncommitted: 2 },
    ...overrides,
  };
}

// Standard CMD width — used for overflow/fit tests
const WIDTH = 78;
// Wide width — used for content-presence tests (avoids truncation)
const WIDE = 160;

describe('Statusbar', () => {
  it('should render 1 or 2 lines (adaptive)', () => {
    const bar = renderStatusBar(makeData(), WIDTH);
    const lines = bar.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.length).toBeLessThanOrEqual(2);
  });

  it('should render brain growth bar with total nodes', () => {
    const bar = renderStatusBar(makeData(), WIDE);
    // Total = 42+28+15+8+3+5 = 101 nodes
    expect(bar).toContain('101');
  });

  it('should show different icons based on brain maturity', () => {
    // Small brain (under 10 nodes)
    const bar1 = renderStatusBar(makeData({ spiral: { l1: 5, l2: 0, l3: 0, l4: 0, l5: 0, l6: 0 } }), WIDE);
    expect(bar1).toContain('🧠');

    // Growing brain (100+ nodes)
    const bar2 = renderStatusBar(makeData({ spiral: { l1: 80, l2: 20, l3: 0, l4: 0, l5: 0, l6: 0 } }), WIDE);
    expect(bar2).toContain('💯');

    // Expert brain (500-1000 nodes) — shows fire emoji
    const bar3 = renderStatusBar(makeData({ spiral: { l1: 700, l2: 200, l3: 0, l4: 0, l5: 0, l6: 0 } }), WIDE);
    expect(bar3).toContain('🔥');

    // Master brain (1000+ nodes) — shows sparkles
    const bar4 = renderStatusBar(makeData({ spiral: { l1: 800, l2: 300, l3: 0, l4: 0, l5: 0, l6: 0 } }), WIDE);
    expect(bar4).toContain('✨');
  });

  it('should render token bar with count', () => {
    const bar = renderStatusBar(makeData(), WIDE);
    expect(bar).toContain('58.0k');
    expect(bar).toContain('ctx');
  });

  it('should render bar characters', () => {
    const bar = renderStatusBar(makeData({ sessionTokens: 50000 }), WIDE);
    expect(bar).toMatch(/[█░]/);
  });

  it('should render message token count', () => {
    const bar = renderStatusBar(makeData(), WIDE);
    expect(bar).toContain('3.2k');
  });

  it('should render tool calls with word label', () => {
    const bar = renderStatusBar(makeData({ tools: { callsThisRound: 3 } }), WIDE);
    expect(bar).toContain('Tools:');
    expect(bar).toContain('3');
  });

  it('should show tool calls even when 0', () => {
    const bar = renderStatusBar(makeData({ tools: { callsThisRound: 0 } }), WIDE);
    expect(bar).toContain('Tools:');
    expect(bar).toContain('0');
  });

  it('should render shortened model name', () => {
    const bar = renderStatusBar(makeData(), WIDE);
    expect(bar).toContain('sonnet');
  });

  it('should render git branch with uncommitted count', () => {
    const bar = renderStatusBar(makeData(), WIDE);
    expect(bar).toContain('main');
    expect(bar).toContain('\u21912');
  });

  it('should render clean git branch without arrow', () => {
    const bar = renderStatusBar(makeData({ git: { branch: 'main', uncommitted: 0 } }), WIDE);
    expect(bar).toContain('main');
    expect(bar).not.toContain('\u2191');
  });

  it('should render time', () => {
    const bar = renderStatusBar(makeData(), WIDE);
    expect(bar).toMatch(/\d{2}:\d{2}/);
  });

  it('should render at different terminal widths', () => {
    const data = makeData();
    const bar = renderStatusBar(data, WIDTH);
    expect(bar.length).toBeGreaterThan(0);
  });

  it('should render checkpoint count when > 0', () => {
    const bar = renderStatusBar(makeData({ checkpoints: 12 }), WIDE);
    expect(bar).toContain('12');
  });

  it('should show checkpoint label even when 0', () => {
    const bar = renderStatusBar(makeData({ checkpoints: 0 }), WIDE);
    expect(bar).toContain('CP:');
  });

  it('should render safe mode as word label', () => {
    const bar = renderStatusBar(makeData({ permissionMode: 'safe' }), WIDE);
    expect(bar).toContain('Safe');
  });

  it('should render skip mode as word label', () => {
    const bar = renderStatusBar(makeData({ permissionMode: 'skip' }), WIDE);
    expect(bar).toContain('Skip');
  });

  it('should render yolo mode as word label', () => {
    const bar = renderStatusBar(makeData({ permissionMode: 'yolo' }), WIDE);
    expect(bar).toContain('YOLO');
  });

  it('should format millions correctly', () => {
    const bar = renderStatusBar(makeData({ sessionTokens: 5_500_000 }), WIDE);
    expect(bar).toContain('5.5M');
  });

  it('should shorten deepseek model names', () => {
    const bar = renderStatusBar(makeData({ model: 'deepseek-reasoner' }), WIDE);
    expect(bar).toContain('ds-r1');
    expect(bar).not.toContain('deepseek-reasoner');
  });

  it('should fit within standard CMD width', () => {
    const bar = renderStatusBar(makeData(), WIDTH);
    const lines = bar.split('\n');
    for (const line of lines) {
      const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
      expect(cleanLine.length).toBeLessThanOrEqual(WIDTH);
    }
  });

  it('should render runtime when provided', () => {
    const bar = renderStatusBar(makeData({ runtime: 125 }), WIDE);
    expect(bar).toContain('2m5s');
  });

  it('should render short runtime correctly', () => {
    const bar = renderStatusBar(makeData({ runtime: 45 }), WIDE);
    expect(bar).toContain('45s');
  });
});
