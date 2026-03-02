import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { rgba } from '../utils/colors';
import { HEIGHT } from '../utils/layout';

// Animated horizontal scan line that sweeps vertically
export const ScanLine: React.FC<{
  color?: string;
  speed?: number;
  thickness?: number;
  opacity?: number;
}> = ({ color = '#00d4ff', speed = 2, thickness = 3, opacity = 0.15 }) => {
  const frame = useCurrentFrame();

  const y = (frame * speed) % HEIGHT;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: y,
        height: thickness,
        background: `linear-gradient(90deg, transparent, ${rgba(color, opacity)}, transparent)`,
        boxShadow: `0 0 40px 10px ${rgba(color, opacity * 0.5)}`,
        pointerEvents: 'none',
      }}
    />
  );
};
