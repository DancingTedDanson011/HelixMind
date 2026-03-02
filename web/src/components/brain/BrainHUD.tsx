'use client';

import React, { useEffect, useRef, useState } from 'react';

// ─── Level definitions (matches CLI brain template LVL_CSS / LVL_HEX) ───

const LEVELS = [
  { level: 1, color: '#E040FB', name: 'Focus' },
  { level: 2, color: '#00FF88', name: 'Active' },
  { level: 3, color: '#7B68EE', name: 'Reference' },
  { level: 4, color: '#00FFFF', name: 'Archive' },
  { level: 5, color: '#FF6B6B', name: 'Deep Archive' },
  { level: 6, color: '#FFD700', name: 'Web Knowledge' },
] as const;

// ─── Types ──────────────────────────────────────────────────

interface BrainHUDProps {
  nodeCount: number;
  edgeCount: number;
  levelCounts: Record<number, number>;
  webKnowledgeCount: number;
  projectName?: string;
}

// ─── Shared glass-panel style ───────────────────────────────

const glassPanel: React.CSSProperties = {
  background: 'rgba(5,5,16,0.9)',
  border: '1px solid rgba(0,212,255,0.15)',
  borderRadius: 12,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

const fontStack =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', monospace";

// ─── Component ──────────────────────────────────────────────

export const BrainHUD = React.memo(function BrainHUD({
  nodeCount,
  edgeCount,
  levelCounts,
  webKnowledgeCount,
  projectName,
}: BrainHUDProps) {
  // Simple FPS counter
  const fpsRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafRef = useRef<number>(0);
  const [fps, setFps] = useState(60);

  useEffect(() => {
    function tick() {
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastTimeRef.current >= 1000) {
        fpsRef.current = frameCountRef.current;
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Build stats string
  const statsParts: string[] = [
    `${nodeCount} nodes`,
    `${edgeCount} connections`,
  ];
  if (webKnowledgeCount > 0) {
    statsParts.push(`${webKnowledgeCount} web`);
  }
  if (projectName) {
    statsParts.push(projectName);
  }
  const statsText = statsParts.join(' \u00B7 ');

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
        fontFamily: fontStack,
      }}
    >
      {/* ── Pulse animation ─────────────────────────────── */}
      <style>{`
        @keyframes hud-live-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 4px #0f0; }
          50% { opacity: 0.4; box-shadow: none; }
        }
      `}</style>

      {/* ── Header (top-left) ───────────────────────────── */}
      <div
        style={{
          ...glassPanel,
          position: 'absolute',
          top: 16,
          left: 16,
          padding: '12px 20px',
          pointerEvents: 'auto',
        }}
      >
        <h1
          style={{
            fontSize: 15,
            color: '#00d4ff',
            marginBottom: 4,
            letterSpacing: 1,
            fontWeight: 600,
            lineHeight: 1.3,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Live dot */}
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#0f0',
              flexShrink: 0,
              animation: 'hud-live-pulse 2s ease infinite',
            }}
          />
          {'\u{1F300}'} HelixMind Brain
        </h1>
        <div
          style={{
            fontSize: 11,
            color: '#556',
            lineHeight: 1.4,
          }}
        >
          {statsText}
        </div>
      </div>

      {/* ── Level Legend (bottom-left) ───────────────────── */}
      <div
        style={{
          ...glassPanel,
          position: 'absolute',
          bottom: 56,
          left: 16,
          padding: '10px 14px',
          borderRadius: 8,
          pointerEvents: 'auto',
        }}
      >
        {LEVELS.map(({ level, color, name }) => {
          const count = levelCounts[level] ?? 0;
          return (
            <div
              key={level}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                margin: '2px 0',
                fontSize: 10,
                color: '#556',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  boxShadow: `0 0 6px ${color}`,
                  flexShrink: 0,
                }}
              />
              <span>
                L{level} {name}
              </span>
              {count > 0 && (
                <span style={{ color: '#445', marginLeft: 2 }}>
                  {count}
                </span>
              )}
            </div>
          );
        })}
        <div
          style={{
            marginTop: 4,
            fontSize: 9,
            color: '#445',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            paddingTop: 4,
          }}
        >
          Edges = node level colors
        </div>
      </div>

      {/* ── FPS / Status (bottom-right) ─────────────────── */}
      <div
        style={{
          ...glassPanel,
          position: 'absolute',
          bottom: 16,
          right: 16,
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 10,
          color: '#556',
          pointerEvents: 'auto',
        }}
      >
        <span>{nodeCount}</span> nodes {'\u00B7'}{' '}
        <span>{fps}</span> fps
        {webKnowledgeCount > 0 && (
          <>
            {' '}{'\u00B7'}{' '}
            <span style={{ color: '#FFAA00' }}>
              {webKnowledgeCount} web
            </span>
          </>
        )}
      </div>
    </div>
  );
});
