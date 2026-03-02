// HelixMind brand colors — mirrored from web/src/lib/constants.ts

export const C = {
  primary: '#00d4ff',
  secondary: '#4169e1',
  accent: '#8a2be2',
  bg: '#050510',
  surface: '#0a0a1a',
  surfaceLight: '#12122a',

  // Spiral levels
  L1: '#00ffff',
  L2: '#00ff88',
  L3: '#4169e1',
  L4: '#8a2be2',
  L5: '#6c757d',
  L6: '#ffaa00',

  // Modes
  jarvis: '#ff00ff',
  agent: '#00d4ff',
  monitor: '#ff4444',

  // Semantic
  success: '#00ff88',
  error: '#ff4444',
  warning: '#ffaa00',
  info: '#00d4ff',

  white: '#ffffff',
  gray: '#888888',
  grayDark: '#333333',
  grayLight: '#cccccc',
} as const;

export function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function glow(hex: string, size = 20, spread = 0): string {
  return `0 0 ${size}px ${spread}px ${rgba(hex, 0.6)}`;
}
