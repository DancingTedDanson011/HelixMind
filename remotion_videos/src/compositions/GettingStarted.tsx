import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { Terminal } from '../components/Terminal';
import { GlowText } from '../components/GlowText';
import { Badge } from '../components/Badge';
import { Particles } from '../components/Particles';
import { ScanLine } from '../components/ScanLine';
import { C, rgba } from '../utils/colors';
import { WIDTH, HEIGHT, seconds } from '../utils/layout';

// 45s @ 60fps = 2700 frames
// Getting Started tutorial — step by step
// Timeline:
// 0-3s:    Title "Getting Started"
// 3-10s:   Step 1: npm install
// 10-18s:  Step 2: helixmind init
// 18-28s:  Step 3: First chat + spiral memory
// 28-38s:  Step 4: Brain visualization
// 38-45s:  Summary + CTA

interface StepProps {
  number: number;
  title: string;
  color: string;
  showAt: number;
}

const StepIndicator: React.FC<StepProps> = ({ number, title, color, showAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = spring({ frame: frame - showAt, fps, config: { damping: 15, stiffness: 100 } });
  if (frame < showAt) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 140,
        left: 200,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        opacity: p,
        transform: `translateX(${interpolate(p, [0, 1], [-30, 0])}px)`,
      }}
    >
      <div
        style={{
          width: 70,
          height: 70,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          fontWeight: 800,
          color,
          background: rgba(color, 0.1),
          border: `2px solid ${rgba(color, 0.4)}`,
          boxShadow: `0 0 20px ${rgba(color, 0.2)}`,
          fontFamily: 'Inter, system-ui',
        }}
      >
        {number}
      </div>
      <span
        style={{
          fontSize: 40,
          fontWeight: 700,
          color,
          fontFamily: 'Inter, system-ui',
          letterSpacing: -1,
        }}
      >
        {title}
      </span>
    </div>
  );
};

export const GettingStarted: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Background glowColor={C.primary} glowIntensity={0.06} />
      <ScanLine color={C.primary} speed={1.5} opacity={0.04} />
      <Particles count={40} colors={[C.primary, C.accent]} seed={55} maxSize={3} />

      {/* Title */}
      <Sequence from={0} durationInFrames={seconds(3)}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Badge text="Tutorial" color={C.primary} icon="📖" fontSize={28} />
          <div style={{ height: 40 }} />
          <GlowText
            text="Getting Started"
            gradient
            gradientFrom={C.primary}
            gradientTo={C.accent}
            fontSize={160}
            fontWeight={900}
            showAt={seconds(0.3)}
          />
          <div style={{ height: 30 }} />
          <GlowText
            text="From zero to AI coding agent in 60 seconds"
            color={rgba(C.white, 0.5)}
            fontSize={48}
            fontWeight={300}
            letterSpacing={2}
            showAt={seconds(1)}
          />
        </div>
      </Sequence>

      {/* Step 1: Install */}
      <Sequence from={seconds(3)} durationInFrames={seconds(7)}>
        <StepIndicator number={1} title="Install" color={C.primary} showAt={seconds(3)} />
        <Terminal
          x={200}
          y={320}
          width={1800}
          title="terminal"
          accentColor={C.primary}
          showAt={seconds(3.5)}
          lines={[
            { prefix: '$', prefixColor: C.primary, text: 'npm install -g helixmind', color: C.white, delay: seconds(0.5), speed: 2.5 },
            { text: '', color: C.gray, delay: seconds(1.5), speed: 100 },
            { icon: '📦', text: 'added 47 packages in 8.2s', color: C.gray, delay: seconds(2), speed: 3 },
            { icon: '✓', text: 'helixmind@0.2.30 — ready to use', color: C.success, delay: seconds(3), speed: 3, bold: true },
            { text: '', color: C.gray, delay: seconds(3.5), speed: 100 },
            { prefix: '$', prefixColor: C.primary, text: 'helixmind --version', color: C.white, delay: seconds(4), speed: 2.5 },
            { text: 'HelixMind v0.2.30 (spiral-context-mcp)', color: C.primary, delay: seconds(5), speed: 3 },
          ]}
        />
      </Sequence>

      {/* Step 2: Init */}
      <Sequence from={seconds(10)} durationInFrames={seconds(8)}>
        <StepIndicator number={2} title="Initialize Your Project" color={C.L2} showAt={seconds(10)} />
        <Terminal
          x={200}
          y={320}
          width={1800}
          title="~/my-project"
          accentColor={C.L2}
          showAt={seconds(10.5)}
          lines={[
            { prefix: '$', prefixColor: C.L2, text: 'cd my-project && helixmind init', color: C.white, delay: seconds(0.5), speed: 2 },
            { icon: '📁', text: 'Created .helixmind/ directory', color: C.L2, delay: seconds(2), speed: 2.5 },
            { icon: '🧠', text: 'Spiral database initialized (SQLite + embeddings)', color: C.accent, delay: seconds(3), speed: 2 },
            { icon: '📊', text: 'Project analyzed: 142 files, 28,400 lines', color: C.primary, delay: seconds(4), speed: 2 },
            { icon: '✓', text: 'Ready! Run `helixmind` to start chatting.', color: C.success, delay: seconds(5.5), speed: 2, bold: true },
          ]}
        />
      </Sequence>

      {/* Step 3: First chat */}
      <Sequence from={seconds(18)} durationInFrames={seconds(10)}>
        <StepIndicator number={3} title="Your First Conversation" color={C.agent} showAt={seconds(18)} />
        <Terminal
          x={200}
          y={320}
          width={1800}
          title="helixmind — agent"
          accentColor={C.agent}
          showAt={seconds(18.5)}
          lines={[
            { prefix: 'You:', text: '"Explain how the auth middleware works"', color: C.white, delay: seconds(0.5), speed: 1.8 },
            { icon: '📄', text: 'Reading src/middleware/auth.ts...', color: C.primary, delay: seconds(2.5), speed: 2 },
            { icon: '🌀', text: 'Storing context in Spiral L1 (Focus)', color: C.L1, delay: seconds(3.5), speed: 2 },
            { icon: '🤖', text: 'The auth middleware uses JWT tokens with a 24h expiry...', color: C.white, delay: seconds(4.5), speed: 2 },
            { icon: '🧠', text: 'Knowledge saved — will remember this across sessions!', color: C.accent, delay: seconds(6.5), speed: 2, bold: true },
          ]}
        />
      </Sequence>

      {/* Step 4: Brain */}
      <Sequence from={seconds(28)} durationInFrames={seconds(10)}>
        <StepIndicator number={4} title="Visualize Your Brain" color={C.accent} showAt={seconds(28)} />
        <Terminal
          x={200}
          y={320}
          width={1200}
          title="helixmind"
          accentColor={C.accent}
          showAt={seconds(28.5)}
          lines={[
            { prefix: '/', text: 'brain', color: C.accent, delay: seconds(0.5), speed: 2 },
            { icon: '🌐', text: 'Brain server started on http://localhost:9420', color: C.primary, delay: seconds(1.5), speed: 2 },
            { icon: '✨', text: 'Opening 3D visualization in browser...', color: C.accent, delay: seconds(2.5), speed: 2 },
          ]}
        />

        {/* Browser mockup */}
        <div
          style={{
            position: 'absolute',
            right: 200,
            top: 350,
            width: 1200,
            height: 700,
            borderRadius: 20,
            background: rgba(C.surface, 0.9),
            border: `1px solid ${rgba(C.white, 0.08)}`,
            overflow: 'hidden',
            opacity: interpolate(frame - seconds(30), [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
            transform: `scale(${interpolate(frame - seconds(30), [0, 20], [0.95, 1], { extrapolateRight: 'clamp' })})`,
            boxShadow: `0 20px 60px ${rgba(C.accent, 0.15)}`,
          }}
        >
          {/* Browser chrome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: rgba(C.white, 0.03), borderBottom: `1px solid ${rgba(C.white, 0.06)}` }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
            </div>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 16, color: rgba(C.white, 0.3), fontFamily: 'system-ui' }}>
              localhost:9420/brain
            </div>
          </div>

          {/* Simulated brain inside browser */}
          <div style={{ position: 'relative', width: '100%', height: 640, background: C.bg }}>
            {/* Simulated glowing nodes */}
            {Array.from({ length: 25 }, (_, i) => {
              const rng = () => { let s = i * 997 + 1; s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
              const colors = [C.L1, C.L2, C.L3, C.L4, C.L6];
              const c = colors[i % 5];
              const x = 100 + rng() * 1000;
              const y = 50 + rng() * 540;
              const size = 4 + rng() * 8;
              const pulse = Math.sin(frame * 0.04 + i) * 0.3 + 0.7;

              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: x,
                    top: y,
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    background: c,
                    opacity: pulse * 0.8,
                    boxShadow: `0 0 ${size * 3}px ${rgba(c, 0.5)}`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </Sequence>

      {/* Summary CTA */}
      <Sequence from={seconds(38)}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 40,
          }}
        >
          <GlowText
            text="You're Ready."
            gradient
            gradientFrom={C.primary}
            gradientTo={C.success}
            fontSize={160}
            fontWeight={900}
          />
          <div
            style={{
              display: 'flex',
              gap: 60,
              marginTop: 40,
            }}
          >
            {[
              { icon: '🧠', label: 'Spiral Memory' },
              { icon: '⚡', label: '22 Agent Tools' },
              { icon: '🌐', label: '3D Brain' },
              { icon: '✦', label: 'Jarvis AGI' },
            ].map((item, i) => {
              const p = spring({ frame: frame - seconds(39) - i * 8, fps, config: { damping: 15 } });
              return (
                <div key={i} style={{ textAlign: 'center', opacity: p, transform: `translateY(${interpolate(p, [0, 1], [20, 0])}px)` }}>
                  <div style={{ fontSize: 56, marginBottom: 12 }}>{item.icon}</div>
                  <div style={{ fontSize: 24, color: rgba(C.white, 0.5), fontFamily: 'Inter, system-ui' }}>{item.label}</div>
                </div>
              );
            })}
          </div>

          {/* Install command */}
          <div
            style={{
              marginTop: 60,
              padding: '20px 48px',
              borderRadius: 16,
              background: rgba(C.white, 0.04),
              border: `1px solid ${rgba(C.primary, 0.2)}`,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 32,
              color: rgba(C.white, 0.7),
              opacity: interpolate(frame - seconds(41), [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            <span style={{ color: C.primary, fontWeight: 700 }}>$</span>{' '}
            npm install -g helixmind
          </div>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
