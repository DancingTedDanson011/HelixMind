import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from 'remotion';
import { Background } from '../components/Background';
import { Particles } from '../components/Particles';
import { Terminal } from '../components/Terminal';
import { GlowText } from '../components/GlowText';
import { Badge } from '../components/Badge';
import { ScanLine } from '../components/ScanLine';
import { C, rgba, glow } from '../utils/colors';
import { WIDTH, HEIGHT, seconds } from '../utils/layout';

// 30 seconds @ 60fps = 1800 frames
// Timeline:
// 0-2s:   Fade in from black, particles emerge
// 2-5s:   Particles drift, badge appears "AI CODING AGENT"
// 5-10s:  Terminal fades in, types install command
// 10-16s: Terminal shows output (spiral init, brain connect, etc.)
// 16-20s: Particles converge to center
// 20-26s: HelixMind title reveal with massive glow
// 26-30s: Subtitle + tagline fade in

export const HeroIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Global fade from black
  const fadeIn = interpolate(frame, [0, seconds(1.5)], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Spiral DNA helix animation (center of screen during convergence)
  const showHelix = frame > seconds(18);
  const helixProgress = showHelix
    ? interpolate(frame, [seconds(18), seconds(22)], [0, 1], {
        extrapolateRight: 'clamp',
      })
    : 0;

  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <Audio src={staticFile('audio/01-hero-intro.wav')} />
      <Background glowColor={C.primary} glowIntensity={0.06} />

      {/* Scan line overlay */}
      <ScanLine color={C.primary} speed={1.5} opacity={0.08} />

      {/* Floating particles — converge at 16s */}
      <Particles
        count={200}
        colors={[C.primary, C.accent, C.L2, C.jarvis]}
        convergeAt={seconds(16)}
        convergeDuration={seconds(4)}
        convergeX={WIDTH / 2}
        convergeY={HEIGHT / 2 - 100}
        seed={7}
        maxSize={5}
      />

      {/* Phase 1: Badge (2s-30s) */}
      <Sequence from={seconds(2)}>
        <div
          style={{
            position: 'absolute',
            top: 240,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Badge text="AI Coding Agent" color={C.primary} icon=">" fontSize={28} />
        </div>
      </Sequence>

      {/* Phase 2: Terminal (5s-16s) */}
      <Sequence from={seconds(5)} durationInFrames={seconds(13)}>
        <Terminal
          x={WIDTH / 2 - 900}
          y={HEIGHT / 2 - 250}
          width={1800}
          title="~/project"
          accentColor={C.primary}
          lines={[
            {
              prefix: '$',
              prefixColor: C.primary,
              text: 'npm install -g helixmind',
              color: C.white,
              delay: 0,
              speed: 2,
            },
            {
              icon: '✓',
              text: 'helixmind@0.2.30 installed globally',
              color: C.success,
              delay: seconds(2),
              speed: 3,
            },
            {
              prefix: '$',
              prefixColor: C.primary,
              text: 'helixmind',
              color: C.white,
              delay: seconds(3),
              speed: 2,
            },
            {
              icon: '🧠',
              text: 'Spiral Memory initialized — 6 levels active',
              color: C.L1,
              delay: seconds(4),
              speed: 2.5,
            },
            {
              icon: '🌐',
              text: 'Brain visualization ready on :9420',
              color: C.accent,
              delay: seconds(5),
              speed: 2.5,
            },
            {
              icon: '⚡',
              text: 'Jarvis AGI daemon standing by...',
              color: C.jarvis,
              delay: seconds(6),
              speed: 2,
            },
          ]}
        />
      </Sequence>

      {/* Phase 3: Terminal fades out, helix DNA appears */}
      {showHelix && (
        <div
          style={{
            position: 'absolute',
            top: HEIGHT / 2 - 200,
            left: WIDTH / 2 - 200,
            width: 400,
            height: 400,
            opacity: helixProgress,
            transform: `scale(${interpolate(helixProgress, [0, 1], [0.3, 1])})`,
          }}
        >
          {/* DNA Helix SVG */}
          <svg width="400" height="400" viewBox="0 0 400 400">
            {Array.from({ length: 20 }, (_, i) => {
              const t = (frame * 0.02 + i * 0.3);
              const x1 = 200 + Math.sin(t) * 80;
              const x2 = 200 - Math.sin(t) * 80;
              const y = 40 + i * 17;
              const opacity = Math.abs(Math.sin(t)) * 0.8 + 0.2;
              const frontStrand = Math.sin(t) > 0;

              return (
                <g key={i}>
                  {/* Connection bar */}
                  <line
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke={rgba(C.primary, opacity * 0.3)}
                    strokeWidth={2}
                  />
                  {/* Strand 1 */}
                  <circle
                    cx={x1}
                    cy={y}
                    r={frontStrand ? 7 : 5}
                    fill={C.primary}
                    opacity={frontStrand ? opacity : opacity * 0.4}
                  />
                  {/* Strand 2 */}
                  <circle
                    cx={x2}
                    cy={y}
                    r={frontStrand ? 5 : 7}
                    fill={C.accent}
                    opacity={frontStrand ? opacity * 0.4 : opacity}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Phase 4: Title reveal (20s) */}
      <Sequence from={seconds(20)}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <GlowText
            text="HelixMind"
            gradient
            gradientFrom={C.primary}
            gradientTo={C.accent}
            fontSize={280}
            fontWeight={900}
            letterSpacing={-8}
            glowSize={60}
            y={-60}
          />
        </div>
      </Sequence>

      {/* Phase 5: Subtitle (23s) */}
      <Sequence from={seconds(23)}>
        <div
          style={{
            position: 'absolute',
            bottom: HEIGHT / 2 - 200,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <GlowText
            text="The AI That Remembers Everything"
            color={rgba(C.white, 0.7)}
            fontSize={64}
            fontWeight={300}
            letterSpacing={4}
            glowSize={10}
          />
        </div>
      </Sequence>

      {/* Phase 6: Mode pills (25s) */}
      <Sequence from={seconds(25)}>
        <div
          style={{
            position: 'absolute',
            bottom: HEIGHT / 2 - 350,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
          }}
        >
          <Badge text="Jarvis AGI" color={C.jarvis} showAt={0} fontSize={24} />
          <Badge text="Agent" color={C.agent} showAt={seconds(0.3)} fontSize={24} />
          <Badge text="Monitor" color={C.monitor} showAt={seconds(0.6)} fontSize={24} />
        </div>
      </Sequence>

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 70% 60% at 50% 50%, transparent, ${rgba(C.bg, 0.5)})`,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
