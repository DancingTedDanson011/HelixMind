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
  // Level 1 (Focus) — dense core cluster (1054 nodes)
  1: { xCenter: 0,    yBase: 0,    zBase: 0,    spread: 800,  height: 800,  depth: 600,  jitter: 60 },
  // Level 2 (Active) — surrounding ring (712 nodes)
  2: { xCenter: 1200, yBase: 100,  zBase: 300,  spread: 1000, height: 900,  depth: 700,  jitter: 70 },
  // Level 3 (Reference) — extended zone (720 nodes)
  3: { xCenter: 2800, yBase: 0,    zBase: 0,    spread: 1200, height: 1200, depth: 900,  jitter: 80 },
  // Level 4 (Archive) — back region (60 nodes)
  4: { xCenter: 4200, yBase: -80,  zBase: -300, spread: 600,  height: 600,  depth: 500,  jitter: 50 },
  // Level 5 (Deep Archive) — far back (48 nodes)
  5: { xCenter: 5200, yBase: 60,   zBase: 150,  spread: 500,  height: 500,  depth: 400,  jitter: 45 },
  // Level 6 (Web Knowledge) — orbiting outer zone (68 nodes)
  6: { xCenter: 2500, yBase: 1200, zBase: -700, spread: 1400, height: 600,  depth: 1000, jitter: 80 },
} as const;

// Type-based spatial offsets within each level zone
export const TYPE_SECTORS: Record<string, { xOff: number; yOff: number; zOff: number }> = {
  code:         { xOff: 0,    yOff: 0,    zOff: 0 },
  decision:     { xOff: 100,  yOff: 120,  zOff: 80 },
  pattern:      { xOff: -80,  yOff: -100, zOff: 110 },
  architecture: { xOff: 150,  yOff: 60,   zOff: -100 },
  summary:      { xOff: -120, yOff: -150, zOff: -60 },
  context:      { xOff: 60,   yOff: -80,  zOff: 50 },
  focus:        { xOff: -50,  yOff: 90,   zOff: -70 },
  instant:      { xOff: 40,   yOff: -60,  zOff: 90 },
  web:          { xOff: -90,  yOff: 70,   zOff: -40 },
  knowledge:    { xOff: 70,   yOff: -40,  zOff: -80 },
  wisdom:       { xOff: -60,  yOff: 110,  zOff: 60 },
  conversation: { xOff: 110,  yOff: -70,  zOff: 30 },
} as const;

export const LEVEL_COLORS = {
  1: 0x00ffff,   // Focus — Cyan
  2: 0x00ff88,
  3: 0x4169e1,
  4: 0x8a2be2,
  5: 0x6c757d,
  6: 0xffaa00,
  // Monitor node types
  7: 0xff4444,   // Security Threat — Red
  8: 0x4488ff,   // Defense Action — Blue
  9: 0x00ff88,   // Monitor Baseline — Green
  // Jarvis AGI
  10: 0xff00ff,  // Jarvis Consciousness — Magenta
} as const;

export const LEVEL_SIZES = {
  1: 8, 2: 7, 3: 5.5, 4: 4.5, 5: 3.5, 6: 9,
  7: 10, 8: 7, 9: 6,  // Monitor nodes
  10: 8,               // Jarvis consciousness
} as const;

export const LEVEL_GLOW = {
  1: 1.2, 2: 0.9, 3: 0.6, 4: 0.4, 5: 0.2, 6: 1.5,
  7: 2.0, 8: 1.0, 9: 0.8,  // Monitor nodes
  10: 2.5,                   // Jarvis consciousness — strong glow
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
  10: 'Jarvis Consciousness',
} as const;

// ─── Jarvis AGI Brain Colors ───────────────────────────────
export const JARVIS_CORE_COLOR = 0xffb800;        // Golden core
export const JARVIS_CORE_LIGHT = 0xffd080;        // Warm point light
export const JARVIS_ORBIT_GREEN = 0x00ff66;        // Thoughts orbit
export const JARVIS_ORBIT_YELLOW = 0xffdd00;       // Proposals orbit
export const JARVIS_CONSCIOUSNESS = 0xff00ff;      // Consciousness nodes

// ─── Plans ───────────────────────────────────

export const plans = {
  FREE: {
    name: 'Open Source',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'Full CLI agent, unlimited local use',
    brains: { maxGlobal: 0, maxLocal: 1, maxActive: 1 },
    jarvisInstances: 0,
  },
  FREE_PLUS: {
    name: 'Free+',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'Jarvis AGI + Brain Management',
    brains: { maxGlobal: 1, maxLocal: 2, maxActive: 3 },
    jarvisInstances: 1,
  },
  PRO: {
    name: 'Pro',
    monthlyPrice: 19,
    yearlyPrice: 190,
    description: 'Power-user, cloud sync, 15 brains',
    brains: { maxGlobal: 5, maxLocal: 10, maxActive: 10 },
    jarvisInstances: 3,
  },
  TEAM: {
    name: 'Team',
    monthlyPrice: 39,
    yearlyPrice: 390, // per user, billed annually
    description: 'Shared brains, unlimited Jarvis',
    brains: { maxGlobal: Infinity, maxLocal: Infinity, maxActive: Infinity },
    jarvisInstances: Infinity,
  },
  ENTERPRISE: {
    name: 'Enterprise',
    monthlyPrice: null,
    yearlyPrice: null,
    description: 'Full API, self-hosted, everything',
    brains: { maxGlobal: Infinity, maxLocal: Infinity, maxActive: Infinity },
    jarvisInstances: Infinity,
  },
} as const;
