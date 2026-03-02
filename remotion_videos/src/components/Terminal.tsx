import React from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { C, rgba, glow } from '../utils/colors';

interface TerminalLine {
  prefix?: string;
  prefixColor?: string;
  text: string;
  color?: string;
  delay: number; // frame when this line starts typing
  speed?: number; // chars per frame (default 1.5)
  icon?: string;
  bold?: boolean;
}

export const Terminal: React.FC<{
  lines: TerminalLine[];
  title?: string;
  width?: number;
  x?: number;
  y?: number;
  showAt?: number;
  accentColor?: string;
}> = ({
  lines,
  title = 'helixmind',
  width = 1800,
  x = 0,
  y = 0,
  showAt = 0,
  accentColor = C.primary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Terminal entrance animation
  const enterProgress = spring({
    frame: frame - showAt,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const opacity = interpolate(enterProgress, [0, 1], [0, 1]);
  const translateY = interpolate(enterProgress, [0, 1], [60, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        opacity,
        transform: `translateY(${translateY}px)`,
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      }}
    >
      {/* Window chrome */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '20px 28px',
          background: rgba(C.white, 0.03),
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottom: `1px solid ${rgba(C.white, 0.06)}`,
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#28c840' }} />
        </div>
        <span style={{ color: rgba(C.white, 0.4), fontSize: 22, letterSpacing: 1 }}>{title}</span>
      </div>

      {/* Terminal body */}
      <div
        style={{
          padding: '36px 36px 44px',
          background: rgba(C.black || '#000000', 0.5),
          backdropFilter: 'blur(20px)',
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
          border: `1px solid ${rgba(C.white, 0.06)}`,
          borderTop: 'none',
          minHeight: 200,
          boxShadow: `0 40px 100px ${rgba(accentColor, 0.1)}, inset 0 1px 0 ${rgba(C.white, 0.02)}`,
        }}
      >
        {lines.map((line, i) => {
          const lineFrame = frame - line.delay;
          if (lineFrame < 0) return null;

          const speed = line.speed ?? 1.5;
          const visibleChars = Math.min(
            Math.floor(lineFrame * speed),
            line.text.length,
          );
          const displayText = line.text.slice(0, visibleChars);
          const showCursor = visibleChars < line.text.length;

          // Line fade in
          const lineOpacity = interpolate(lineFrame, [0, 8], [0, 1], {
            extrapolateRight: 'clamp',
          });

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                marginBottom: 20,
                opacity: lineOpacity,
                fontSize: 28,
                lineHeight: 1.6,
              }}
            >
              {line.icon && (
                <span style={{ flexShrink: 0, width: 36, textAlign: 'center' }}>
                  {line.icon}
                </span>
              )}
              {line.prefix && (
                <span
                  style={{
                    color: line.prefixColor || accentColor,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {line.prefix}
                </span>
              )}
              <span
                style={{
                  color: line.color || C.white,
                  fontWeight: line.bold ? 700 : 400,
                }}
              >
                {displayText}
                {showCursor && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 14,
                      height: 30,
                      background: accentColor,
                      marginLeft: 2,
                      verticalAlign: 'middle',
                      opacity: Math.sin(frame * 0.15) > 0 ? 1 : 0,
                      boxShadow: glow(accentColor, 8),
                    }}
                  />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
