// 4K video constants
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 60;

// Common durations (in frames)
export const seconds = (s: number) => Math.round(s * FPS);
