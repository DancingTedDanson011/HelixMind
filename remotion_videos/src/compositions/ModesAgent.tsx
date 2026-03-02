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

// 20s @ 60fps = 1200 frames
// Agent mode — cyan themed, showing tool chain execution
// Timeline:
// 0-2s:   Title + badge
// 2-14s:  Terminal: user prompt → tool calls → output → success
// 14-20s: Tool pipeline visualization

export const ModesAgent: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tools = [
    { name: 'read_file', icon: '📄', color: C.primary },
    { name: 'spiral_query', icon: '🌀', color: C.accent },
    { name: 'edit_file', icon: '✏️', color: C.warning },
    { name: 'run_command', icon: '⚡', color: C.L2 },
    { name: 'git_commit', icon: '📦', color: C.success },
  ];

  return (
    <AbsoluteFill>
      <Background glowColor={C.agent} glowIntensity={0.08} />
      <ScanLine color={C.agent} speed={2} opacity={0.05} />
      <Particles count={50} colors={[C.agent, '#0088cc', '#44ddff']} seed={21} maxSize={3} />

      {/* Badge */}
      <Sequence from={0}>
        <div style={{ position: 'absolute', top: 160, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <Badge text="Agent Mode" color={C.agent} icon=">" fontSize={32} />
        </div>
      </Sequence>

      {/* Title */}
      <Sequence from={seconds(0.3)}>
        <div style={{ position: 'absolute', top: 280, left: 0, right: 0, textAlign: 'center' }}>
          <GlowText
            text="22 Tools. One Goal."
            gradient
            gradientFrom={C.agent}
            gradientTo="#44ddff"
            fontSize={120}
            fontWeight={800}
          />
        </div>
      </Sequence>

      {/* Terminal */}
      <Sequence from={seconds(2)} durationInFrames={seconds(14)}>
        <Terminal
          x={200}
          y={500}
          width={1700}
          title="helixmind — agent"
          accentColor={C.agent}
          lines={[
            { prefix: 'You:', text: '"Fix the login timeout bug"', color: C.white, delay: 0, speed: 2 },
            { icon: '📄', text: 'Reading src/auth/session.ts...', color: C.primary, delay: seconds(1.5), speed: 2.5 },
            { icon: '🌀', text: 'Querying spiral memory for session patterns...', color: C.accent, delay: seconds(2.5), speed: 2.5 },
            { icon: '💡', text: 'Found: Session timeout set to 300ms instead of 300s', color: C.warning, delay: seconds(4), speed: 2, bold: true },
            { icon: '✏️', text: 'Editing session.ts line 42: timeout: 300_000', color: C.warning, delay: seconds(5.5), speed: 2.5 },
            { icon: '⚡', text: 'Running: npm test -- auth/session.test.ts', color: C.L2, delay: seconds(7), speed: 2.5 },
            { icon: '✅', text: '14 tests passed (0 failed) — 0.8s', color: C.success, delay: seconds(8.5), speed: 2.5, bold: true },
            { icon: '📦', text: 'Committed: fix(auth): correct session timeout from 300ms to 300s', color: C.success, delay: seconds(10), speed: 2 },
          ]}
        />
      </Sequence>

      {/* Tool pipeline visualization */}
      <Sequence from={seconds(14)}>
        <div
          style={{
            position: 'absolute',
            bottom: 200,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 20,
          }}
        >
          {tools.map((tool, i) => {
            const p = spring({
              frame: frame - seconds(14) - i * 6,
              fps,
              config: { damping: 12, stiffness: 100 },
            });

            const isActive = frame > seconds(14) + i * 6 + 10;

            return (
              <React.Fragment key={i}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    opacity: p,
                    transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px) scale(${interpolate(p, [0, 1], [0.8, 1])})`,
                  }}
                >
                  <div
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 40,
                      background: rgba(tool.color, 0.1),
                      border: `2px solid ${rgba(tool.color, isActive ? 0.6 : 0.2)}`,
                      boxShadow: isActive ? `0 0 20px ${rgba(tool.color, 0.3)}` : 'none',
                      transition: 'all 0.3s',
                    }}
                  >
                    {tool.icon}
                  </div>
                  <span
                    style={{
                      fontSize: 18,
                      color: rgba(tool.color, 0.8),
                      fontFamily: '"JetBrains Mono", monospace',
                      fontWeight: 500,
                    }}
                  >
                    {tool.name}
                  </span>
                </div>

                {/* Arrow between tools */}
                {i < tools.length - 1 && (
                  <div
                    style={{
                      fontSize: 28,
                      color: rgba(C.white, 0.2),
                      opacity: p,
                    }}
                  >
                    →
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
