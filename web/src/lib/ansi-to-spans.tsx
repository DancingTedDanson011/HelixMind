'use client';

import React from 'react';

/* ─── ANSI SGR color map ─────────────────────── */

const FG_COLORS: Record<number, string> = {
  30: '#4a4a4a', 31: '#ef4444', 32: '#22c55e', 33: '#eab308',
  34: '#3b82f6', 35: '#a855f7', 36: '#06b6d4', 37: '#d1d5db',
  90: '#6b7280', 91: '#f87171', 92: '#4ade80', 93: '#facc15',
  94: '#60a5fa', 95: '#c084fc', 96: '#22d3ee', 97: '#f3f4f6',
};

/* ─── Parser ─────────────────────────────────── */

interface Style {
  color?: string;
  fontWeight?: string;
  opacity?: number;
  fontStyle?: string;
  textDecoration?: string;
}

function parseSGR(codes: number[], style: Style): Style {
  const next = { ...style };
  for (const code of codes) {
    if (code === 0) { return {}; }
    if (code === 1) { next.fontWeight = 'bold'; }
    else if (code === 2) { next.opacity = 0.6; }
    else if (code === 3) { next.fontStyle = 'italic'; }
    else if (code === 4) { next.textDecoration = 'underline'; }
    else if (code === 22) { delete next.fontWeight; delete next.opacity; }
    else if (code === 23) { delete next.fontStyle; }
    else if (code === 24) { delete next.textDecoration; }
    else if (code === 39) { delete next.color; }
    else if (FG_COLORS[code]) { next.color = FG_COLORS[code]; }
  }
  return next;
}

/* ─── Regex patterns ─────────────────────────── */

/** Matches ALL ANSI escape sequences (CSI, OSC, cursor, etc.) */
const ALL_ANSI = /\x1b(?:\[[0-9;?]*[a-zA-Z]|\][^\x07]*\x07|\[[\s\S]|.)/g;

/** Matches only SGR (color/style) sequences: \x1b[...m */
const SGR_SEQ = /\x1b\[([0-9;]*)m/g;

/** Strip ALL ANSI escape codes from a string — use for plain text contexts */
export function stripAnsi(text: string): string {
  return text.replace(ALL_ANSI, '');
}

/* ─── Component ──────────────────────────────── */

export function AnsiLine({ text }: { text: string }): React.ReactElement {
  if (!text.includes('\x1b[')) {
    return <>{text}</>;
  }

  // First strip non-SGR sequences (cursor movement, erase, etc.)
  const cleaned = text.replace(
    /\x1b\[[\?]?[0-9;]*[A-HJKSTfhlnsu]/g,
    '',
  );

  if (!cleaned.includes('\x1b[')) {
    return <>{cleaned}</>;
  }

  const spans: React.ReactNode[] = [];
  let style: Style = {};
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset lastIndex to ensure clean matching
  SGR_SEQ.lastIndex = 0;

  while ((match = SGR_SEQ.exec(cleaned)) !== null) {
    // Text before this escape
    if (match.index > lastIndex) {
      const chunk = cleaned.slice(lastIndex, match.index);
      const hasStyle = Object.keys(style).length > 0;
      spans.push(
        hasStyle
          ? <span key={spans.length} style={style}>{chunk}</span>
          : chunk
      );
    }

    // Parse SGR codes
    const codes = match[1] ? match[1].split(';').map(Number) : [0];
    style = parseSGR(codes, style);

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < cleaned.length) {
    const chunk = cleaned.slice(lastIndex);
    const hasStyle = Object.keys(style).length > 0;
    spans.push(
      hasStyle
        ? <span key={spans.length} style={style}>{chunk}</span>
        : chunk
    );
  }

  return <>{spans}</>;
}
