import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { Terminal } from '../components/Terminal';
import { GlowText } from '../components/GlowText';
import { Badge } from '../components/Badge';
import { Particles } from '../components/Particles';
import { ScanLine } from '../components/ScanLine';
import { C, rgba } from '../utils/colors';
import { WIDTH, HEIGHT, seconds } from '../utils/layout';

// 20s @ 60fps = 1200 frames
// Jarvis AGI mode — magenta themed
// Timeline:
// 0-2s:   Title "Jarvis AGI" with magenta glow
// 2-4s:   Brain thinking animation (pulsing circles)
// 4-12s:  Terminal: Jarvis analyzing, proposing, executing
// 12-16s: Proposal card with approve/deny
// 16-20s: Success + stats

export const ModesJarvis: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Brain pulse (thinking rings)
  const showBrain = frame > seconds(2) && frame < seconds(14);
  const ringCount = 5;

  return (
    <AbsoluteFill>
      <Audio src={staticFile('audio/02-modes-jarvis.wav')} />
      <Background glowColor={C.jarvis} glowIntensity={0.1} />
      <ScanLine color={C.jarvis} speed={1} opacity={0.06} />
      <Particles
        count={60}
        colors={[C.jarvis, '#ff66cc', '#cc00cc']}
        seed={13}
        maxSize={4}
      />

      {/* Mode Badge */}
      <Sequence from={0}>
        <div style={{ position: 'absolute', top: 160, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <Badge text="Jarvis AGI Mode" color={C.jarvis} icon="✦" fontSize={32} />
        </div>
      </Sequence>

      {/* Title */}
      <Sequence from={seconds(0.3)}>
        <div style={{ position: 'absolute', top: 280, left: 0, right: 0, textAlign: 'center' }}>
          <GlowText
            text="Autonomous Intelligence"
            gradient
            gradientFrom={C.jarvis}
            gradientTo="#ff66cc"
            fontSize={120}
            fontWeight={800}
            glowSize={40}
          />
        </div>
      </Sequence>

      {/* Thinking brain rings */}
      {showBrain && (
        <div style={{ position: 'absolute', right: 300, top: HEIGHT / 2 - 200, width: 400, height: 400 }}>
          {Array.from({ length: ringCount }, (_, i) => {
            const delay = i * 0.15;
            const pulse = Math.sin((frame - seconds(2)) * 0.04 - delay * 3) * 0.5 + 0.5;
            const size = 80 + i * 60;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 200 - size / 2,
                  top: 200 - size / 2,
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  border: `2px solid ${rgba(C.jarvis, pulse * 0.5)}`,
                  boxShadow: `0 0 ${20 * pulse}px ${rgba(C.jarvis, pulse * 0.3)}, inset 0 0 ${10 * pulse}px ${rgba(C.jarvis, pulse * 0.1)}`,
                }}
              />
            );
          })}
          {/* Core dot */}
          <div
            style={{
              position: 'absolute',
              left: 190,
              top: 190,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: C.jarvis,
              boxShadow: `0 0 30px ${C.jarvis}, 0 0 60px ${rgba(C.jarvis, 0.5)}`,
            }}
          />
        </div>
      )}

      {/* Terminal with Jarvis output */}
      <Sequence from={seconds(4)} durationInFrames={seconds(12)}>
        <Terminal
          x={200}
          y={500}
          width={1600}
          title="jarvis — autonomous"
          accentColor={C.jarvis}
          lines={[
            { icon: '🧠', text: 'Analyzing project structure...', color: C.jarvis, delay: 0, speed: 2 },
            { icon: '🧠', text: 'Found 3 security vulnerabilities in auth.ts', color: C.jarvis, delay: seconds(1.5), speed: 2 },
            { icon: '💡', text: 'PROPOSAL: Fix SQL injection in user query', color: C.warning, delay: seconds(3), bold: true, speed: 2 },
            { prefix: '  ', text: '→ Parameterize query on line 47', color: C.gray, delay: seconds(4), speed: 2 },
            { prefix: '  ', text: '→ Add input validation with Zod schema', color: C.gray, delay: seconds(4.5), speed: 2 },
            { icon: '✅', text: 'User approved — executing fix...', color: C.success, delay: seconds(6), speed: 2 },
            { icon: '✓', text: 'All 3 vulnerabilities patched. Tests pass.', color: C.success, delay: seconds(7.5), bold: true, speed: 2 },
          ]}
        />
      </Sequence>

      {/* Approval card overlay */}
      <Sequence from={seconds(12)} durationInFrames={seconds(4)}>
        <div
          style={{
            position: 'absolute',
            left: WIDTH / 2 - 400,
            top: HEIGHT / 2 - 100,
            width: 800,
            padding: '48px 56px',
            background: rgba('#0a0a1a', 0.95),
            borderRadius: 24,
            border: `1px solid ${rgba(C.jarvis, 0.3)}`,
            boxShadow: `0 0 60px ${rgba(C.jarvis, 0.15)}`,
            opacity: interpolate(frame - seconds(12), [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
            transform: `scale(${interpolate(frame - seconds(12), [0, 15], [0.9, 1], { extrapolateRight: 'clamp' })})`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <span style={{ fontSize: 40 }}>✦</span>
            <span style={{ fontSize: 36, fontWeight: 700, color: C.jarvis, fontFamily: 'Inter, system-ui' }}>
              Proposal Approved
            </span>
          </div>
          <div style={{ fontSize: 28, color: rgba(C.white, 0.6), fontFamily: 'Inter, system-ui', lineHeight: 1.6 }}>
            3 files modified · 12 lines changed · All tests passing
          </div>

          {/* Approve button glow */}
          <div
            style={{
              marginTop: 32,
              display: 'inline-flex',
              padding: '14px 40px',
              borderRadius: 12,
              background: rgba(C.success, 0.15),
              border: `1px solid ${rgba(C.success, 0.4)}`,
              color: C.success,
              fontSize: 24,
              fontWeight: 600,
              fontFamily: 'Inter, system-ui',
              boxShadow: `0 0 20px ${rgba(C.success, 0.2)}`,
            }}
          >
            ✓ Approved & Committed
          </div>
        </div>
      </Sequence>

      {/* Final stats */}
      <Sequence from={seconds(16)}>
        <div
          style={{
            position: 'absolute',
            bottom: 200,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 80,
          }}
        >
          {[
            { label: 'Vulnerabilities', value: '3 Fixed', color: C.success },
            { label: 'Time Saved', value: '2.5 hours', color: C.primary },
            { label: 'Confidence', value: '97%', color: C.jarvis },
          ].map((stat, i) => {
            const p = spring({ frame: frame - seconds(16) - i * 8, fps, config: { damping: 15 } });
            return (
              <div
                key={i}
                style={{
                  textAlign: 'center',
                  opacity: p,
                  transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px)`,
                }}
              >
                <div style={{ fontSize: 56, fontWeight: 800, color: stat.color, fontFamily: 'Inter, system-ui' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 24, color: rgba(C.white, 0.4), fontFamily: 'Inter, system-ui', marginTop: 8 }}>
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
