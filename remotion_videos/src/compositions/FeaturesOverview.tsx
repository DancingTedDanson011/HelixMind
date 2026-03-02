import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { GlowText } from '../components/GlowText';
import { Badge } from '../components/Badge';
import { ScanLine } from '../components/ScanLine';
import { Particles } from '../components/Particles';
import { C, rgba } from '../utils/colors';
import { WIDTH, HEIGHT, seconds } from '../utils/layout';

// 30s @ 60fps = 1800 frames
// Features Overview — animated feature cards
// Timeline:
// 0-3s:   Title
// 3-25s:  Feature cards appear one by one with icons + descriptions
// 25-30s: "Open Source" tagline + CTA

const features = [
  {
    icon: '🌀',
    title: 'Spiral Memory',
    desc: '6-level contextual memory that promotes, decays, and persists across sessions',
    color: C.accent,
    stats: '384d embeddings · SQLite + sqlite-vec',
  },
  {
    icon: '🧠',
    title: '3D Brain',
    desc: 'Live neural map visualization — watch your knowledge graph grow in real-time',
    color: C.primary,
    stats: 'WebSocket · Three.js · Real-time sync',
  },
  {
    icon: '🛡️',
    title: 'Validation Matrix',
    desc: '3-phase code validation: static checks, mini-LLM review, spiral knowledge',
    color: C.L2,
    stats: '15+ checks · Autofix loop · Zero false positives',
  },
  {
    icon: '🌐',
    title: 'Web Knowledge',
    desc: 'Auto-fetches web intelligence during work — DuckDuckGo → spiral brain',
    color: C.L6,
    stats: 'Topic detection · HTML extraction · L6 storage',
  },
  {
    icon: '🔌',
    title: 'Offline-First',
    desc: 'Works without internet — Ollama local models, no cloud dependency',
    color: C.L5,
    stats: 'Ollama · Any GGUF model · Zero latency',
  },
];

export const FeaturesOverview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Background glowColor={C.primary} glowIntensity={0.05} />
      <ScanLine color={C.primary} speed={1} opacity={0.04} />
      <Particles count={30} colors={[C.primary, C.accent, C.L2]} seed={63} maxSize={3} />

      {/* Title */}
      <Sequence from={0} durationInFrames={seconds(3)}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Badge text="Features" color={C.primary} fontSize={28} />
          <div style={{ height: 40 }} />
          <GlowText
            text="Built Different"
            gradient
            gradientFrom={C.primary}
            gradientTo={C.L2}
            fontSize={160}
            fontWeight={900}
            showAt={seconds(0.3)}
          />
        </div>
      </Sequence>

      {/* Feature cards */}
      <Sequence from={seconds(3)} durationInFrames={seconds(22)}>
        {features.map((feature, i) => {
          const showAt = i * seconds(3.5);
          const p = spring({
            frame: frame - seconds(3) - showAt,
            fps,
            config: { damping: 15, stiffness: 80 },
          });

          if (frame < seconds(3) + showAt) return null;

          // Alternate left/right positioning
          const isLeft = i % 2 === 0;
          const cardX = isLeft ? 200 : WIDTH - 200 - 1400;
          const cardY = 300 + (i % 3) * 350;

          // Each card is visible for ~3.5s then fades
          const exitAt = showAt + seconds(3.2);
          const exitP = frame - seconds(3) > exitAt
            ? interpolate(frame - seconds(3) - exitAt, [0, seconds(0.3)], [1, 0], { extrapolateRight: 'clamp' })
            : 1;

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: cardX,
                top: cardY,
                width: 1400,
                padding: '48px 56px',
                borderRadius: 24,
                background: rgba(C.surface, 0.8),
                border: `1px solid ${rgba(feature.color, 0.2)}`,
                boxShadow: `0 0 40px ${rgba(feature.color, 0.08)}`,
                opacity: p * exitP,
                transform: `translateX(${interpolate(p, [0, 1], [isLeft ? -60 : 60, 0])}px) scale(${interpolate(p, [0, 1], [0.95, 1])})`,
                display: 'flex',
                alignItems: 'center',
                gap: 40,
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 56,
                  background: rgba(feature.color, 0.08),
                  border: `1px solid ${rgba(feature.color, 0.2)}`,
                  flexShrink: 0,
                }}
              >
                {feature.icon}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 40, fontWeight: 800, color: feature.color, fontFamily: 'Inter, system-ui', marginBottom: 12 }}>
                  {feature.title}
                </div>
                <div style={{ fontSize: 26, color: rgba(C.white, 0.5), fontFamily: 'Inter, system-ui', lineHeight: 1.5, marginBottom: 16 }}>
                  {feature.desc}
                </div>
                <div style={{ fontSize: 20, color: rgba(feature.color, 0.5), fontFamily: '"JetBrains Mono", monospace' }}>
                  {feature.stats}
                </div>
              </div>

              {/* Feature number */}
              <div
                style={{
                  fontSize: 120,
                  fontWeight: 900,
                  color: rgba(feature.color, 0.06),
                  fontFamily: 'Inter, system-ui',
                  position: 'absolute',
                  right: 40,
                  top: -20,
                  lineHeight: 1,
                }}
              >
                0{i + 1}
              </div>
            </div>
          );
        })}
      </Sequence>

      {/* CTA */}
      <Sequence from={seconds(25)}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
          <GlowText
            text="Open Source"
            gradient
            gradientFrom={C.primary}
            gradientTo={C.accent}
            fontSize={140}
            fontWeight={900}
          />
          <GlowText
            text="AGPL-3.0 · Free Forever · Community Driven"
            color={rgba(C.white, 0.4)}
            fontSize={40}
            fontWeight={400}
            letterSpacing={4}
            showAt={seconds(1)}
          />

          {/* GitHub-style badge */}
          <div
            style={{
              marginTop: 40,
              padding: '18px 48px',
              borderRadius: 16,
              background: rgba(C.white, 0.04),
              border: `1px solid ${rgba(C.white, 0.1)}`,
              fontSize: 28,
              fontFamily: '"JetBrains Mono", monospace',
              color: rgba(C.white, 0.6),
              opacity: interpolate(frame - seconds(27), [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            <span style={{ color: C.primary }}>$</span> npm install -g helixmind
          </div>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
