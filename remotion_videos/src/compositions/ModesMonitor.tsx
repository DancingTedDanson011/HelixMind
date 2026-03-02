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
// Monitor mode — red themed, security scanning feel

export const ModesMonitor: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Radar sweep
  const radarAngle = (frame * 1.5) % 360;

  const findings = [
    { severity: 'CRITICAL', color: '#ff4444', text: 'Hardcoded API key in config.ts', icon: '🔴' },
    { severity: 'HIGH', color: '#ff8800', text: 'SQL injection in user.query()', icon: '🟠' },
    { severity: 'MEDIUM', color: '#ffaa00', text: 'Missing CSRF token on /api/update', icon: '🟡' },
    { severity: 'LOW', color: '#00d4ff', text: 'Console.log in production build', icon: '🟢' },
  ];

  return (
    <AbsoluteFill>
      <Background glowColor={C.monitor} glowIntensity={0.1} />
      <ScanLine color={C.monitor} speed={3} opacity={0.1} />
      <Particles count={40} colors={[C.monitor, '#ff6666', '#cc0000']} seed={37} maxSize={3} />

      {/* Badge */}
      <Sequence from={0}>
        <div style={{ position: 'absolute', top: 160, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <Badge text="Security Monitor" color={C.monitor} icon="⛨" fontSize={32} />
        </div>
      </Sequence>

      {/* Title */}
      <Sequence from={seconds(0.3)}>
        <div style={{ position: 'absolute', top: 280, left: 0, right: 0, textAlign: 'center' }}>
          <GlowText
            text="Always Watching"
            gradient
            gradientFrom={C.monitor}
            gradientTo="#ff8800"
            fontSize={120}
            fontWeight={800}
          />
        </div>
      </Sequence>

      {/* Radar circle (top-right) */}
      <Sequence from={seconds(1.5)} durationInFrames={seconds(14)}>
        <div style={{ position: 'absolute', right: 200, top: 500, width: 500, height: 500 }}>
          {/* Radar rings */}
          {[1, 2, 3].map((ring) => (
            <div
              key={ring}
              style={{
                position: 'absolute',
                left: 250 - ring * 80,
                top: 250 - ring * 80,
                width: ring * 160,
                height: ring * 160,
                borderRadius: '50%',
                border: `1px solid ${rgba(C.monitor, 0.15)}`,
              }}
            />
          ))}

          {/* Sweep line */}
          <div
            style={{
              position: 'absolute',
              left: 250,
              top: 250,
              width: 240,
              height: 2,
              background: `linear-gradient(90deg, ${C.monitor}, transparent)`,
              transformOrigin: '0 50%',
              transform: `rotate(${radarAngle}deg)`,
              boxShadow: `0 0 20px ${rgba(C.monitor, 0.5)}`,
            }}
          />

          {/* Sweep trail */}
          <div
            style={{
              position: 'absolute',
              left: 250,
              top: 250,
              width: 240,
              height: 240,
              borderRadius: '50%',
              transformOrigin: '0 0',
              transform: `rotate(${radarAngle}deg)`,
              background: `conic-gradient(from 0deg, ${rgba(C.monitor, 0.15)}, transparent 60deg)`,
            }}
          />

          {/* Center dot */}
          <div
            style={{
              position: 'absolute',
              left: 244,
              top: 244,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: C.monitor,
              boxShadow: `0 0 15px ${C.monitor}`,
            }}
          />

          {/* Threat dots on radar */}
          {findings.map((f, i) => {
            const angle = (i * 90 + 30) * (Math.PI / 180);
            const dist = 60 + i * 40;
            const px = 250 + Math.cos(angle) * dist;
            const py = 250 + Math.sin(angle) * dist;
            const pulse = Math.sin(frame * 0.1 + i) * 0.5 + 0.5;

            const showAt = seconds(3) + i * seconds(1);
            if (frame < showAt) return null;

            const appear = interpolate(frame - showAt, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: px - 6,
                  top: py - 6,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: f.color,
                  opacity: appear * (0.5 + pulse * 0.5),
                  boxShadow: `0 0 ${10 + pulse * 10}px ${f.color}`,
                }}
              />
            );
          })}
        </div>
      </Sequence>

      {/* Findings list (left side) */}
      <Sequence from={seconds(3)} durationInFrames={seconds(13)}>
        <div style={{ position: 'absolute', left: 200, top: 520, width: 1400 }}>
          {findings.map((f, i) => {
            const showAt = i * seconds(1.5);
            const p = spring({
              frame: frame - seconds(3) - showAt,
              fps,
              config: { damping: 15, stiffness: 100 },
            });

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  marginBottom: 28,
                  opacity: p,
                  transform: `translateX(${interpolate(p, [0, 1], [-30, 0])}px)`,
                  fontFamily: '"JetBrains Mono", monospace',
                }}
              >
                <span style={{ fontSize: 28 }}>{f.icon}</span>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    padding: '6px 16px',
                    borderRadius: 8,
                    color: f.color,
                    background: rgba(f.color, 0.1),
                    border: `1px solid ${rgba(f.color, 0.3)}`,
                  }}
                >
                  {f.severity}
                </span>
                <span style={{ fontSize: 26, color: rgba(C.white, 0.6) }}>{f.text}</span>
              </div>
            );
          })}
        </div>
      </Sequence>

      {/* Auto-fix summary */}
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
            { label: 'Files Scanned', value: '247', color: C.primary },
            { label: 'Threats Found', value: '4', color: C.monitor },
            { label: 'Auto-Fixed', value: '3', color: C.success },
          ].map((stat, i) => {
            const p = spring({ frame: frame - seconds(16) - i * 8, fps, config: { damping: 15 } });
            return (
              <div key={i} style={{ textAlign: 'center', opacity: p, transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px)` }}>
                <div style={{ fontSize: 72, fontWeight: 800, color: stat.color, fontFamily: 'Inter, system-ui' }}>
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
