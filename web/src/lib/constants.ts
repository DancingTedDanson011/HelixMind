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

// ─── Force-Directed Layout Params (matches CLI brain template.ts) ──

export const FORCE_LAYOUT = {
  BASE_SPREAD: 400,
  REP: 28000,
  ATT: 0.002,
  ILEN: 100,
  DAMP: 0.82,
  GCELL: 160,
  MAX_E: 18000,
  CPULL: 0.005,
  SAT_SIZE: 7,
} as const;

// Level colors — exact match of CLI brain template LVL_HEX
export const LEVEL_COLORS = {
  1: 0xE040FB,   // Focus — Magenta/Fuchsia (characteristic L1)
  2: 0x00FF88,   // Active — Green
  3: 0x7B68EE,   // Reference — Medium Slate Blue
  4: 0x00FFFF,   // Archive — Cyan
  5: 0xFF6B6B,   // Deep Archive — Coral Red
  6: 0xFFD700,   // Web Knowledge — Gold
  7: 0xFF00FF,   // Jarvis
  // Monitor node types
  8: 0xff4444,   // Security Threat — Red
  9: 0x4488ff,   // Defense Action — Blue
  10: 0x00ff88,  // Monitor Baseline — Green
} as const;

// Point sizes per level — exact match of CLI brain template LVL_SIZE
export const LEVEL_SIZES = {
  1: 6, 2: 7, 3: 12, 4: 16, 5: 22, 6: 10, 7: 8,
  8: 10, 9: 7, 10: 6,
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
