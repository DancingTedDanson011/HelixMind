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

// Use wide terminal width so all optional parts are included
const WIDE = 200;

describe('Statusbar', () => {
  it('should render all spiral levels', () => {
    const bar = renderStatusBar(makeData(), WIDE);
    expect(bar).toContain('L1:42');
    expect(bar).toContain('L2:28');
    expect(bar).toContain('L3:15');
    expect(bar).toContain('L4:8');
    expect(bar).toContain('L5:3');
    expect(bar).toContain('L6:5');
  });

  it('should render token bar with count', () => {
    const bar = renderStatusBar(makeData(), WIDE);
    // Should show token count like "58.0k" and scale like "100.0k"
    expect(bar).toContain('58.0k');
    expect(bar).toContain('tk');
  });

  it('should auto-scale token bar', () => {
    // Under 100k — scale is 100k
    const bar1 = renderStatusBar(makeData({ sessionTokens: 50000 }), WIDE);
    expect(bar1).toContain('100.0k');

    // Over 100k — scale jumps to 250k
    const bar2 = renderStatusBar(makeData({ sessionTokens: 120000 }), WIDE);
    expect(bar2).toContain('250.0k');

    // Over 1M — scale shows in M
    const bar3 = renderStatusBar(makeData({ sessionTokens: 1200000 }), WIDE);
    expect(bar3).toContain('2.5M');
  });

  it('should render bar characters', () => {
    const bar = renderStatusBar(makeData({ sessionTokens: 50000 }), WIDE);
    // Should contain filled and empty bar chars (█ and ░)
    expect(bar).toMatch(/[█░]/);
  });

  it('should render token count', () => {
    const bar = renderStatusBar(makeData(), WIDE);
    expect(bar).toContain('3.2k tok');
  });

  it('should render tool calls when > 0', () => {
    const bar = renderStatusBar(makeData({ tools: { callsThisRound: 3 } }), WIDE);
    expect(bar).toContain('3 tools');
  });

  it('should hide tool calls when 0', () => {
    const bar = renderStatusBar(makeData({ tools: { callsThisRound: 0 } }), WIDE);
    expect(bar).not.toContain('tools');
  });

  it('should render shortened model name', () => {
    const bar = renderStatusBar(makeData(), WIDE);
    expect(bar).toContain('sonnet-4.6');
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
    const bar = renderStatusBar(data, WIDE);
    expect(bar.length).toBeGreaterThan(0);
  });

  it('should render checkpoint count when > 0', () => {
    const bar = renderStatusBar(makeData({ checkpoints: 12 }), WIDE);
    expect(bar).toContain('12 ckpts');
  });

  it('should not render checkpoint count when 0', () => {
    const bar = renderStatusBar(makeData({ checkpoints: 0 }), WIDE);
    expect(bar).not.toContain('ckpts');
  });

  it('should not render checkpoint section when undefined', () => {
    const bar = renderStatusBar(makeData(), WIDE);
    expect(bar).not.toContain('ckpts');
  });

  it('should render safe mode indicator', () => {
    const bar = renderStatusBar(makeData({ permissionMode: 'safe' }), WIDE);
    expect(bar).toContain('safe');
  });

  it('should render skip mode indicator', () => {
    const bar = renderStatusBar(makeData({ permissionMode: 'skip' }), WIDE);
    expect(bar).toContain('skip');
  });

  it('should render yolo mode indicator', () => {
    const bar = renderStatusBar(makeData({ permissionMode: 'yolo' }), WIDE);
    expect(bar).toContain('yolo');
  });

  it('should render PAUSED indicator when paused', () => {
    const bar = renderStatusBar(makeData({ paused: true }), WIDE);
    expect(bar).toContain('PAUSED');
  });

  it('should not render PAUSED when not paused', () => {
    const bar = renderStatusBar(makeData({ paused: false }), WIDE);
    expect(bar).not.toContain('PAUSED');
  });

  it('should render AUTO indicator when autonomous', () => {
    const bar = renderStatusBar(makeData({ autonomous: true }), WIDE);
    expect(bar).toContain('AUTO');
  });

  it('should format millions correctly', () => {
    const bar = renderStatusBar(makeData({ sessionTokens: 5_500_000 }), WIDE);
    expect(bar).toContain('5.5M');
    expect(bar).toContain('10.0M');
  });

  // New tests for responsive behavior
  it('should drop optional parts on narrow terminals', () => {
    const narrow = renderStatusBar(makeData(), 60);
    // Essential parts should still be there
    expect(narrow).toContain('tok');
    // Optional parts (git, time) may be dropped
  });

  it('should use compact spiral format on narrow terminals', () => {
    const narrow = renderStatusBar(makeData(), 70);
    // Compact format doesn't have L1:/L2: prefixes
    expect(narrow).not.toContain('L4:');
  });

  it('should shorten deepseek model names', () => {
    const bar = renderStatusBar(makeData({ model: 'deepseek-reasoner' }), WIDE);
    expect(bar).toContain('ds-r1');
    expect(bar).not.toContain('deepseek-reasoner');
  });
});
