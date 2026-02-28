import { describe, it, expect, beforeEach } from 'vitest';
import {
  createKeybindingState,
  processKeypress,
  type KeybindingState,
} from '../../../src/cli/checkpoints/keybinding.js';

let state: KeybindingState;

beforeEach(() => {
  state = createKeybindingState();
});

describe('Keybinding - Double ESC Detection', () => {
  it('should ignore a single ESC press', () => {
    const result = processKeypress({ name: 'escape' }, state);
    expect(result.action).toBe('ignore');
    expect(state.lastEscTime).toBeGreaterThan(0);
  });

  it('should detect double ESC within threshold', () => {
    // First ESC
    processKeypress({ name: 'escape' }, state);

    // Second ESC (within 300ms)
    const result = processKeypress({ name: 'escape' }, state);
    expect(result.action).toBe('open_browser');
    expect(state.lastEscTime).toBe(0); // Reset after detection
  });

  it('should NOT detect double ESC outside threshold', () => {
    // First ESC
    processKeypress({ name: 'escape' }, state);

    // Simulate time passing beyond threshold
    state.lastEscTime = Date.now() - 500;

    // Second ESC (too late)
    const result = processKeypress({ name: 'escape' }, state);
    expect(result.action).toBe('ignore');
  });

  it('should ignore non-ESC keys in normal mode', () => {
    const result = processKeypress({ name: 'a', sequence: 'a' }, state);
    expect(result.action).toBe('ignore');
  });
});

describe('Keybinding - Browser Mode', () => {
  beforeEach(() => {
    state.inBrowser = true;
  });

  it('should handle up arrow', () => {
    const result = processKeypress({ name: 'up' }, state);
    expect(result.action).toBe('up');
  });

  it('should handle down arrow', () => {
    const result = processKeypress({ name: 'down' }, state);
    expect(result.action).toBe('down');
  });

  it('should handle Enter', () => {
    const result = processKeypress({ name: 'return' }, state);
    expect(result.action).toBe('enter');
  });

  it('should handle ESC (close browser)', () => {
    const result = processKeypress({ name: 'escape' }, state);
    expect(result.action).toBe('escape');
  });

  it('should handle digit keys 1-4', () => {
    for (let i = 1; i <= 4; i++) {
      const result = processKeypress({ sequence: String(i) }, state);
      expect(result.action).toBe('digit');
      expect(result.digit).toBe(i);
    }
  });

  it('should ignore other keys in browser mode', () => {
    const result = processKeypress({ name: 'a', sequence: 'a' }, state);
    expect(result.action).toBe('ignore');
  });
});
