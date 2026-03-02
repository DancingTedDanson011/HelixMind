import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { GlowText } from '../components/GlowText';
import { Badge } from '../components/Badge';
import { ScanLine } from '../components/ScanLine';
import { C, rgba } from '../utils/colors';
import { WIDTH, HEIGHT, seconds } from '../utils/layout';

// 30s @ 60fps = 1800 frames
// Spiral Memory — flowing levels visualization
// Timeline:
// 0-3s:   Title
// 3-24s:  L1-L6 levels animate in, nodes flow between levels
// 24-30s: Decay/promotion arrows + "Never Forget" text

const levels = [
  { key: 'L1', name: 'Focus', color: C.L1, desc: 'Current conversation context', width: 0.9 },
  { key: 'L2', name: 'Active', color: C.L2, desc: 'Recently used knowledge', width: 0.78 },
  { key: 'L3', name: 'Reference', color: C.L3, desc: 'Project patterns & decisions', width: 0.66 },
  { key: 'L4', name: 'Archive', color: C.L4, desc: 'Historical context', width: 0.54 },
  { key: 'L5', name: 'Deep Archive', color: C.L5, desc: 'Dormant but retrievable', width: 0.42 },
  { key: 'L6', name: 'Web Knowledge', color: C.L6, desc: 'Internet-enriched intelligence', width: 0.88 },
];

// Seeded random
function sr(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export const SpiralMemory: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Generate memory nodes for each level
  const nodes = useMemo(() => {
    const rng = sr(99);
    return levels.flatMap((level, li) => {
      const count = 4 + li;
      return Array.from({ length: count }, (_, ni) => ({
        level: li,
        x: 300 + rng() * (WIDTH - 600) * level.width,
        y: 480 + li * 220 + (rng() - 0.5) * 60,
        size: 12 + rng() * 16,
        phase: rng() * Math.PI * 2,
        color: level.color,
        label: ['auth.ts', 'loop.ts', 'schema', 'pattern', 'bug #42', 'REST API', 'config', 'deploy', 'test', 'cache'][Math.floor(rng() * 10)],
      }));
    });
  }, []);

  return (
    <AbsoluteFill>
      <Background glowColor={C.accent} glowIntensity={0.06} />
      <ScanLine color={C.accent} speed={1} opacity={0.04} />

      {/* Title */}
      <Sequence from={0}>
        <div style={{ position: 'absolute', top: 120, left: 0, right: 0, textAlign: 'center' }}>
          <Badge text="Spiral Context Memory" color={C.accent} icon="🌀" fontSize={30} />
        </div>
      </Sequence>

      <Sequence from={seconds(0.5)}>
        <div style={{ position: 'absolute', top: 220, left: 0, right: 0, textAlign: 'center' }}>
          <GlowText
            text="Six Levels of Intelligence"
            gradient
            gradientFrom={C.L1}
            gradientTo={C.L4}
            fontSize={100}
            fontWeight={800}
          />
        </div>
      </Sequence>

      {/* Level bars */}
      {levels.map((level, i) => {
        const showAt = seconds(3) + i * seconds(0.6);
        const p = spring({ frame: frame - showAt, fps, config: { damping: 18, stiffness: 100 } });
        if (frame < showAt) return null;

        const barY = 480 + i * 220;
        const barWidth = (WIDTH - 400) * level.width;
        const barX = (WIDTH - barWidth) / 2;

        return (
          <div key={i}>
            {/* Level bar */}
            <div
              style={{
                position: 'absolute',
                left: barX,
                top: barY,
                width: barWidth * p,
                height: 120,
                borderRadius: 16,
                background: rgba(level.color, 0.04),
                borderLeft: `4px solid ${level.color}`,
                border: `1px solid ${rgba(level.color, 0.12)}`,
                borderLeftWidth: 4,
                borderLeftColor: level.color,
                opacity: p,
                display: 'flex',
                alignItems: 'center',
                padding: '0 36px',
                gap: 20,
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: level.color,
                  boxShadow: `0 0 12px ${rgba(level.color, 0.6)}`,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: level.color, fontFamily: 'Inter, system-ui' }}>
                  {level.key} — {level.name}
                </div>
                <div style={{ fontSize: 22, color: rgba(C.white, 0.4), fontFamily: 'Inter, system-ui', marginTop: 4 }}>
                  {level.desc}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Floating nodes */}
      {nodes.map((node, i) => {
        const showAt = seconds(5) + node.level * seconds(0.6) + i * 3;
        if (frame < showAt) return null;

        const p = interpolate(frame - showAt, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
        const float = Math.sin(frame * 0.02 + node.phase) * 8;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: node.x - node.size / 2,
              top: node.y + float - node.size / 2,
              width: node.size,
              height: node.size,
              borderRadius: '50%',
              background: node.color,
              opacity: p * 0.7,
              boxShadow: `0 0 ${node.size}px ${rgba(node.color, 0.4)}`,
            }}
          />
        );
      })}

      {/* Promotion/Decay arrows */}
      <Sequence from={seconds(20)}>
        <div style={{ position: 'absolute', right: 250, top: 550, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Promotion arrow (up) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              opacity: interpolate(frame - seconds(20), [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            <div style={{ fontSize: 36, color: C.success }}>↑</div>
            <div style={{ fontSize: 24, color: C.success, fontFamily: 'Inter, system-ui', fontWeight: 600 }}>
              Promote (frequent use)
            </div>
          </div>

          {/* Decay arrow (down) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              opacity: interpolate(frame - seconds(21), [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            <div style={{ fontSize: 36, color: C.L5 }}>↓</div>
            <div style={{ fontSize: 24, color: C.L5, fontFamily: 'Inter, system-ui', fontWeight: 600 }}>
              Decay (unused context)
            </div>
          </div>
        </div>
      </Sequence>

      {/* "Never Forget" */}
      <Sequence from={seconds(24)}>
        <div style={{ position: 'absolute', bottom: 180, left: 0, right: 0, textAlign: 'center' }}>
          <GlowText
            text="Context That Never Dies"
            color={rgba(C.white, 0.6)}
            fontSize={64}
            fontWeight={400}
            letterSpacing={6}
            glowSize={15}
          />
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
