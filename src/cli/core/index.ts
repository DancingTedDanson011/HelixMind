/**
 * Core CLI rendering architecture.
 *
 * Three layers:
 * 1. Terminal — raw terminal operations (ANSI, cursor, scroll regions)
 * 2. Screen   — zone manager (output, input frame, suggestions, chrome)
 * 3. InputManager — readline wrapper with isolated input rendering
 */

export { Terminal, ANSI, visibleLength, truncateStyled } from './terminal.js';
export type { ResizeCallback } from './terminal.js';

export { Screen } from './screen.js';
export type { ChromeRowIndex, ScreenOptions } from './screen.js';

export { InputManager } from './input.js';
export type { InputManagerOptions, InputManagerEvents } from './input.js';
