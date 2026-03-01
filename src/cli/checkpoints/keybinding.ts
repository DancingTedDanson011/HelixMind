/**
 * Double-ESC detection and keypress handler for the checkpoint browser.
 */

export type KeyAction = 'open_browser' | 'up' | 'down' | 'enter' | 'escape' | 'digit' | 'ignore';

export interface KeybindingState {
  lastEscTime: number;
  doubleEscThreshold: number; // ms
  inBrowser: boolean;
}

export function createKeybindingState(): KeybindingState {
  return {
    lastEscTime: 0,
    doubleEscThreshold: 500,
    inBrowser: false,
  };
}

/**
 * Process a keypress event. Returns the action to take.
 */
export function processKeypress(
  key: { name?: string; sequence?: string; ctrl?: boolean },
  state: KeybindingState,
): { action: KeyAction; digit?: number } {
  // In browser mode, handle navigation keys
  if (state.inBrowser) {
    if (key.name === 'up') return { action: 'up' };
    if (key.name === 'down') return { action: 'down' };
    if (key.name === 'return') return { action: 'enter' };
    if (key.name === 'escape') return { action: 'escape' };
    // Digit keys for option selection
    if (key.sequence && /^[1-4]$/.test(key.sequence)) {
      return { action: 'digit', digit: parseInt(key.sequence) };
    }
    return { action: 'ignore' };
  }

  // In normal mode, detect double-ESC
  if (key.name === 'escape') {
    const now = Date.now();
    if (now - state.lastEscTime < state.doubleEscThreshold) {
      state.lastEscTime = 0;
      return { action: 'open_browser' };
    }
    state.lastEscTime = now;
    return { action: 'ignore' };
  }

  state.lastEscTime = 0;
  return { action: 'ignore' };
}
