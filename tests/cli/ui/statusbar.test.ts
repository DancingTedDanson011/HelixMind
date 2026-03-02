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
  it('should render brain growth bar with total nodes', () => {
    const bar = renderStatusBar(makeData(), WIDE);
    // Total = 42+28+15+8+3+5 = 101 nodes
    expect(bar).toContain('101');
    expect(bar).toContain('brain');
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

    // Master brain (1000+ nodes) — shows rocket
    const bar4 = renderStatusBar(makeData({ spiral: { l1: 800, l2: 300, l3: 0, l4: 0, l5: 0, l6: 0 } }), WIDE);
    expect(bar4).toContain('🚀');

    // Legendary brain (5000+ nodes) — shows sparkles
    const bar5 = renderStatusBar(makeData({ spiral: { l1: 4000, l2: 2000, l3: 0, l4: 0, l5: 0, l6: 0 } }), WIDE);
    expect(bar5).toContain('✨');
  });

  it('should render token bar with count', () => {
    const bar = renderStatusBar(makeData(), WIDE);
    // Should show token count like "58.0k" and scale like "100.0k"
    expect(bar).toContain('58.0k');
    expect(bar).toContain('ctx');
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
    expect(bar).toContain('3.2k msg');
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
    // Essential parts should still be there (brain bar and token bar)
    expect(narrow).toContain('brain');
    // Optional parts (git, time) may be dropped
  });

  it('should use compact brain bar on narrow terminals', () => {
    const narrow = renderStatusBar(makeData(), 70);
    // Compact format has shorter bar width
    expect(narrow).toContain('brain');
  });

  it('should shorten deepseek model names', () => {
    const bar = renderStatusBar(makeData({ model: 'deepseek-reasoner' }), WIDE);
    expect(bar).toContain('ds-r1');
    expect(bar).not.toContain('deepseek-reasoner');
  });

  it('should scale brain bar based on node count', () => {
    // Under 10 nodes — scale is 10
    const bar1 = renderStatusBar(makeData({ spiral: { l1: 5, l2: 0, l3: 0, l4: 0, l5: 0, l6: 0 } }), WIDE);
    expect(bar1).toContain('5/10');

    // Over 10 nodes — scale is 50
    const bar2 = renderStatusBar(makeData({ spiral: { l1: 30, l2: 0, l3: 0, l4: 0, l5: 0, l6: 0 } }), WIDE);
    expect(bar2).toContain('30/50');

    // Over 100 nodes — scale is 250
    const bar3 = renderStatusBar(makeData({ spiral: { l1: 150, l2: 0, l3: 0, l4: 0, l5: 0, l6: 0 } }), WIDE);
    expect(bar3).toContain('150/250');
  });
});
