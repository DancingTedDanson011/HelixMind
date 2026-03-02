import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, rgba } from '../utils/colors';
import { WIDTH, HEIGHT } from '../utils/layout';

// Deep space background with animated dot grid + radial glow
export const Background: React.FC<{
  glowColor?: string;
  glowIntensity?: number;
  showGrid?: boolean;
  gridOpacity?: number;
}> = ({
  glowColor = C.primary,
  glowIntensity = 0.08,
  showGrid = true,
  gridOpacity = 0.15,
}) => {
  const frame = useCurrentFrame();

  // Slow pulsing glow
  const pulse = interpolate(Math.sin(frame * 0.02), [-1, 1], [0.6, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: WIDTH * 0.7,
          height: HEIGHT * 0.5,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${rgba(glowColor, glowIntensity * pulse)}, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />

      {/* Dot grid */}
      {showGrid && (
        <svg
          width={WIDTH}
          height={HEIGHT}
          style={{ position: 'absolute', top: 0, left: 0, opacity: gridOpacity }}
        >
          <defs>
            <pattern id="dotGrid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="1.2" fill={rgba(C.white, 0.3)} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotGrid)" />
        </svg>
      )}

      {/* Bottom fade */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '40%',
          background: `linear-gradient(to top, ${C.bg}, transparent)`,
        }}
      />
    </AbsoluteFill>
  );
};
