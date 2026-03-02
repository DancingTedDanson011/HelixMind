import React, { useMemo } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { rgba } from '../utils/colors';
import { WIDTH, HEIGHT } from '../utils/layout';

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
  color: string;
  delay: number;
}

// Seeded random for deterministic particles
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const Particles: React.FC<{
  count?: number;
  colors?: string[];
  seed?: number;
  convergeAt?: number; // frame when particles converge to center
  convergeDuration?: number;
  convergeX?: number;
  convergeY?: number;
  maxSize?: number;
  drift?: number;
}> = ({
  count = 120,
  colors = ['#00d4ff', '#8a2be2', '#00ff88', '#ff00ff'],
  seed = 42,
  convergeAt,
  convergeDuration = 60,
  convergeX = WIDTH / 2,
  convergeY = HEIGHT / 2,
  maxSize = 6,
  drift = 0.8,
}) => {
  const frame = useCurrentFrame();
  const rng = useMemo(() => seededRandom(seed), [seed]);

  const particles: Particle[] = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: rng() * WIDTH,
      y: rng() * HEIGHT,
      size: 1 + rng() * maxSize,
      speed: 0.3 + rng() * drift,
      phase: rng() * Math.PI * 2,
      color: colors[Math.floor(rng() * colors.length)],
      delay: rng() * 30,
    }));
  }, [count, colors, seed, maxSize, drift]);

  return (
    <AbsoluteFill>
      {particles.map((p, i) => {
        const localFrame = Math.max(0, frame - p.delay);

        // Float animation
        let px = p.x + Math.sin(localFrame * 0.01 * p.speed + p.phase) * 40;
        let py = p.y + Math.cos(localFrame * 0.008 * p.speed + p.phase) * 30 - localFrame * p.speed * 0.3;

        // Wrap around
        py = ((py % HEIGHT) + HEIGHT) % HEIGHT;

        // Convergence
        if (convergeAt !== undefined && frame > convergeAt) {
          const t = interpolate(
            frame,
            [convergeAt, convergeAt + convergeDuration],
            [0, 1],
            { extrapolateRight: 'clamp' },
          );
          const ease = t * t * (3 - 2 * t); // smoothstep
          px = px + (convergeX - px) * ease;
          py = py + (convergeY - py) * ease;
        }

        // Fade in
        const opacity = interpolate(localFrame, [0, 20], [0, 0.7], {
          extrapolateRight: 'clamp',
        });

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: p.color,
              opacity,
              boxShadow: `0 0 ${p.size * 3}px ${rgba(p.color, 0.5)}`,
              willChange: 'transform',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
