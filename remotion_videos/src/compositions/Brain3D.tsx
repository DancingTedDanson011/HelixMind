import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { GlowText } from '../components/GlowText';
import { Badge } from '../components/Badge';
import { C, rgba } from '../utils/colors';
import { WIDTH, HEIGHT, seconds } from '../utils/layout';

// 25s @ 60fps = 1500 frames
// 3D Brain visualization (2D simulation of 3D brain with orbiting nodes)
// Timeline:
// 0-2s:   Title "Brain Visualization"
// 2-18s:  Brain forms with nodes, rotates, connections appear
// 18-25s: Web knowledge popup + "Live Neural Map"

// Simulated 3D brain using projected coordinates
function sr(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

interface BrainNode {
  x: number; y: number; z: number;
  size: number;
  color: string;
  level: number;
  phase: number;
}

export const Brain3D: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  // Generate brain nodes in a spherical distribution
  const brainNodes: BrainNode[] = useMemo(() => {
    const rng = sr(777);
    const levelColors = [C.L1, C.L2, C.L3, C.L4, C.L5, C.L6];
    const nodes: BrainNode[] = [];

    for (let i = 0; i < 80; i++) {
      const level = Math.floor(rng() * 6);
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const r = 200 + level * 60 + rng() * 40;

      nodes.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta) * 0.7, // squash Y for perspective
        z: r * Math.cos(phi),
        size: 6 + rng() * 10 - level * 0.5,
        color: levelColors[level],
        level,
        phase: rng() * Math.PI * 2,
      });
    }
    return nodes;
  }, []);

  // Connections between nearby nodes
  const connections = useMemo(() => {
    const conns: [number, number][] = [];
    for (let i = 0; i < brainNodes.length; i++) {
      for (let j = i + 1; j < brainNodes.length; j++) {
        const dx = brainNodes[i].x - brainNodes[j].x;
        const dy = brainNodes[i].y - brainNodes[j].y;
        const dz = brainNodes[i].z - brainNodes[j].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 250) conns.push([i, j]);
      }
    }
    return conns;
  }, [brainNodes]);

  // Rotation angle
  const rotAngle = frame * 0.005;

  // Project 3D to 2D with rotation
  const project = (node: BrainNode) => {
    const x = node.x * Math.cos(rotAngle) - node.z * Math.sin(rotAngle);
    const z = node.x * Math.sin(rotAngle) + node.z * Math.cos(rotAngle);
    const scale = 800 / (800 + z);
    return {
      px: cx + x * scale,
      py: cy + node.y * scale - 50,
      scale,
      z,
    };
  };

  // Sort nodes by Z for depth ordering
  const sortedNodes = useMemo(() => {
    return brainNodes
      .map((n, i) => ({ ...n, idx: i }))
      .sort((a, b) => {
        const za = a.x * Math.sin(rotAngle) + a.z * Math.cos(rotAngle);
        const zb = b.x * Math.sin(rotAngle) + b.z * Math.cos(rotAngle);
        return za - zb;
      });
  }, [frame]);

  // Brain appearance progress
  const brainAppear = interpolate(frame, [seconds(2), seconds(5)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <Background glowColor={C.accent} glowIntensity={0.08} showGrid={false} />

      {/* Title */}
      <Sequence from={0}>
        <div style={{ position: 'absolute', top: 120, left: 0, right: 0, textAlign: 'center' }}>
          <Badge text="Brain Visualization" color={C.accent} icon="🧠" fontSize={30} />
        </div>
      </Sequence>

      {/* Brain connections */}
      {brainAppear > 0 && (
        <svg width={WIDTH} height={HEIGHT} style={{ position: 'absolute', top: 0, left: 0 }}>
          {connections.map(([i, j], ci) => {
            const a = project(brainNodes[i]);
            const b = project(brainNodes[j]);
            const connAppear = interpolate(
              frame,
              [seconds(3) + ci * 0.5, seconds(3) + ci * 0.5 + 10],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );
            if (connAppear <= 0) return null;

            const avgZ = (a.z + b.z) / 2;
            const depthOpacity = interpolate(avgZ, [-400, 400], [0.05, 0.25], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <line
                key={ci}
                x1={a.px}
                y1={a.py}
                x2={b.px}
                y2={b.py}
                stroke={rgba(C.white, depthOpacity * connAppear)}
                strokeWidth={1}
              />
            );
          })}
        </svg>
      )}

      {/* Brain nodes */}
      {brainAppear > 0 &&
        sortedNodes.map((node, i) => {
          const { px, py, scale, z } = project(node);
          const nodeAppear = interpolate(
            frame,
            [seconds(2) + i * 0.3, seconds(2) + i * 0.3 + 15],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          if (nodeAppear <= 0) return null;

          const depthOpacity = interpolate(z, [-400, 400], [0.3, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          const pulse = Math.sin(frame * 0.03 + node.phase) * 0.3 + 0.7;
          const size = node.size * scale * nodeAppear;

          return (
            <div
              key={node.idx}
              style={{
                position: 'absolute',
                left: px - size / 2,
                top: py - size / 2,
                width: size,
                height: size,
                borderRadius: '50%',
                background: node.color,
                opacity: depthOpacity * nodeAppear * pulse,
                boxShadow: `0 0 ${size * 2}px ${rgba(node.color, 0.5 * depthOpacity)}`,
              }}
            />
          );
        })}

      {/* Web Knowledge popup */}
      <Sequence from={seconds(18)}>
        <div
          style={{
            position: 'absolute',
            right: 200,
            top: 400,
            width: 600,
            padding: '32px 40px',
            background: rgba(C.surface, 0.95),
            borderRadius: 20,
            border: `1px solid ${rgba(C.L6, 0.3)}`,
            boxShadow: `0 0 40px ${rgba(C.L6, 0.15)}`,
            opacity: interpolate(frame - seconds(18), [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
            transform: `translateY(${interpolate(frame - seconds(18), [0, 20], [20, 0], { extrapolateRight: 'clamp' })}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 28 }}>🌐</span>
            <span style={{ fontSize: 24, fontWeight: 600, color: C.L6, fontFamily: 'Inter, system-ui' }}>
              New Web Knowledge
            </span>
          </div>
          <div style={{ fontSize: 22, color: rgba(C.white, 0.5), fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.6 }}>
            React Server Components best practices<br />
            → Stored in L6 (Web Knowledge)<br />
            → 3 related nodes enriched
          </div>
        </div>
      </Sequence>

      {/* Tagline */}
      <Sequence from={seconds(21)}>
        <div style={{ position: 'absolute', bottom: 180, left: 0, right: 0, textAlign: 'center' }}>
          <GlowText
            text="Your Live Neural Map"
            gradient
            gradientFrom={C.primary}
            gradientTo={C.accent}
            fontSize={80}
            fontWeight={700}
            glowSize={20}
          />
        </div>
      </Sequence>

      {/* Level legend */}
      <Sequence from={seconds(6)}>
        <div style={{ position: 'absolute', left: 140, bottom: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { color: C.L1, label: 'L1 Focus' },
            { color: C.L2, label: 'L2 Active' },
            { color: C.L3, label: 'L3 Reference' },
            { color: C.L4, label: 'L4 Archive' },
            { color: C.L5, label: 'L5 Deep' },
            { color: C.L6, label: 'L6 Web' },
          ].map((item, i) => {
            const p = spring({ frame: frame - seconds(6) - i * 5, fps, config: { damping: 15 } });
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: p }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: item.color, boxShadow: `0 0 8px ${rgba(item.color, 0.5)}` }} />
                <span style={{ fontSize: 20, color: rgba(C.white, 0.5), fontFamily: 'Inter, system-ui' }}>{item.label}</span>
              </div>
            );
          })}
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
