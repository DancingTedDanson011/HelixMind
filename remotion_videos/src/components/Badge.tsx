import React from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { C, rgba, glow } from '../utils/colors';

export const Badge: React.FC<{
  text: string;
  color?: string;
  showAt?: number;
  icon?: string;
  fontSize?: number;
}> = ({ text, color = C.primary, showAt = 0, icon, fontSize = 26 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - showAt,
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 28px',
        borderRadius: 100,
        border: `1px solid ${rgba(color, 0.3)}`,
        background: rgba(color, 0.06),
        fontSize,
        fontWeight: 600,
        color,
        letterSpacing: 3,
        textTransform: 'uppercase',
        fontFamily: '"Inter", system-ui, sans-serif',
        opacity: interpolate(progress, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px) scale(${interpolate(progress, [0, 1], [0.9, 1])})`,
        boxShadow: `0 0 20px ${rgba(color, 0.1)}`,
      }}
    >
      {icon && <span>{icon}</span>}
      {text}
    </div>
  );
};
