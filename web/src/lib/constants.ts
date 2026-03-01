// ─── Brand Colors (from src/cli/ui/theme.ts) ────────────────

export const colors = {
  primary: '#00d4ff',     // Cyan
  secondary: '#4169e1',   // Royal Blue
  accent: '#8a2be2',      // Blue Violet
  background: '#050510',  // Deep space black
  surface: '#0a0a1a',
  surfaceLight: '#12122a',

  // Spiral levels
  spiralL1: '#00ffff',    // Focus — Cyan
  spiralL2: '#00ff88',    // Active — Green
  spiralL3: '#4169e1',    // Reference — Blue
  spiralL4: '#8a2be2',    // Archive — Violet
  spiralL5: '#6c757d',    // Deep Archive — Gray
  spiralL6: '#ffaa00',    // Web Knowledge — Orange

  // Monitor
  threat: '#ff4444',
  defense: '#4488ff',

  // Semantic
  success: '#00ff88',
  error: '#ff4444',
  warning: '#ffaa00',
  info: '#00d4ff',
} as const;

// ─── Helix Layout (elongated linear zones for better connection visibility) ──

// Each level is a distinct horizontal zone, spreading along X-axis
export const HELIX_PARAMS = {
  // Level 1 (Focus) - compact front-center cluster
  1: { xCenter: 0,    yBase: 0,    zBase: 0,    spread: 200,  height: 220,  depth: 140,  jitter: 18 },
  // Level 2 (Active) - larger zone, more separation
  2: { xCenter: 400,  yBase: 60,   zBase: 120,  spread: 300,  height: 280,  depth: 200, jitter: 24 },
  // Level 3 (Reference) - middle-right, tall and wide
  3: { xCenter: 850,  yBase: 0,    zBase: 0,    spread: 400,  height: 450,  depth: 300, jitter: 30 },
  // Level 4 (Archive) - back-right, spacious
  4: { xCenter: 1350, yBase: -40,  zBase: -150, spread: 450,  height: 500,  depth: 350, jitter: 35 },
  // Level 5 (Deep Archive) - far back, spread out
  5: { xCenter: 1900, yBase: 30,   zBase: 80,   spread: 500,  height: 400,  depth: 280, jitter: 40 },
  // Level 6 (Web Knowledge) - orbiting outer zone, wide
  6: { xCenter: 1000, yBase: 500,  zBase: -300, spread: 800,  height: 300,  depth: 600, jitter: 50 },
} as const;

// Type-based spatial offsets within each level zone
export const TYPE_SECTORS: Record<string, { xOff: number; yOff: number; zOff: number }> = {
  code:        { xOff: 0,    yOff: 0,    zOff: 0 },
  decision:    { xOff: 30,   yOff: 40,   zOff: 25 },
  pattern:     { xOff: -20,  yOff: -30,  zOff: 35 },
  architecture: { xOff: 50,  yOff: 20,   zOff: -30 },
  summary:     { xOff: -40,  yOff: -50,  zOff: -20 },
} as const;

export const LEVEL_COLORS = {
  1: 0x00ffff,
  2: 0x00ff88,
  3: 0x4169e1,
  4: 0x8a2be2,
  5: 0x6c757d,
  6: 0xffaa00,
  // Monitor node types
  7: 0xff4444,   // Security Threat — Red
  8: 0x4488ff,   // Defense Action — Blue
  9: 0x00ff88,   // Monitor Baseline — Green
} as const;

export const LEVEL_SIZES = {
  1: 8, 2: 7, 3: 5.5, 4: 4.5, 5: 3.5, 6: 9,
  7: 10, 8: 7, 9: 6,  // Monitor nodes
} as const;

export const LEVEL_GLOW = {
  1: 1.2, 2: 0.9, 3: 0.6, 4: 0.4, 5: 0.2, 6: 1.5,
  7: 2.0, 8: 1.0, 9: 0.8,  // Monitor nodes
} as const;

export const LEVEL_NAMES = {
  1: 'Focus',
  2: 'Active',
  3: 'Reference',
  4: 'Archive',
  5: 'Deep Archive',
  6: 'Web Knowledge',
  7: 'Security Threat',
  8: 'Defense Action',
  9: 'Monitor Baseline',
} as const;

// ─── Plans ───────────────────────────────────

export const plans = {
  FREE: {
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
  },
  PRO: {
    name: 'Pro',
    monthlyPrice: 19,
    yearlyPrice: 190,
  },
  TEAM: {
    name: 'Team',
    monthlyPrice: 39,
    yearlyPrice: 390, // per user, billed annually
  },
  ENTERPRISE: {
    name: 'Enterprise',
    monthlyPrice: null,
    yearlyPrice: null,
  },
} as const;
