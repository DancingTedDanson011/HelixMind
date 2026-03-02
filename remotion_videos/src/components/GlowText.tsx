import React from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { C, rgba, glow } from '../utils/colors';

export const GlowText: React.FC<{
  text: string;
  color?: string;
  fontSize?: number;
  showAt?: number;
  gradient?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  letterSpacing?: number;
  fontWeight?: number;
  y?: number;
  glowSize?: number;
}> = ({
  text,
  color = C.white,
  fontSize = 140,
  showAt = 0,
  gradient = false,
  gradientFrom = C.primary,
  gradientTo = C.accent,
  letterSpacing = -2,
  fontWeight = 800,
  y = 0,
  glowSize = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - showAt,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [80, 0]);
  const blur = interpolate(progress, [0, 1], [12, 0]);

  // Subtle shimmer
  const shimmer = interpolate(
    Math.sin((frame - showAt) * 0.03),
    [-1, 1],
    [0.85, 1],
  );

  const textStyle: React.CSSProperties = {
    fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
    fontSize,
    fontWeight,
    letterSpacing,
    lineHeight: 1.1,
    textAlign: 'center',
    opacity: opacity * shimmer,
    transform: `translateY(${translateY + y}px)`,
    filter: `blur(${blur}px)`,
    textShadow: `0 0 ${glowSize}px ${rgba(gradient ? gradientFrom : color, 0.4)}`,
  };

  if (gradient) {
    return (
      <div
        style={{
          ...textStyle,
          background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {text}
      </div>
    );
  }

  return (
    <div style={{ ...textStyle, color }}>
      {text}
    </div>
  );
};
