import { createSpinner } from 'nanospinner';

export function createThinkingSpinner() {
  return createSpinner('Thinking...', {
    color: 'cyan',
    frames: ['◐', '◓', '◑', '◒'],
    interval: 100,
  });
}

export function createLoadingSpinner(text: string) {
  return createSpinner(text, {
    color: 'cyan',
  });
}
