// Static demo data for the 3D Brain hero section
// Mimics the BrainExport interface from src/cli/brain/exporter.ts

export interface DemoNode {
  id: string;
  label: string;
  type: string;
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  relevanceScore: number;
}

export interface DemoEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
}

const nodeTemplates: Array<{ label: string; type: string; level: DemoNode['level'] }> = [
  // L1 Focus — core active context
  { label: 'auth/login.ts', type: 'code', level: 1 },
  { label: 'JWT Strategy', type: 'decision', level: 1 },
  { label: 'useAuth hook', type: 'code', level: 1 },
  { label: 'Session middleware', type: 'code', level: 1 },
  { label: 'OAuth flow', type: 'pattern', level: 1 },

  // L2 Active — recent patterns
  { label: 'API route handler', type: 'pattern', level: 2 },
  { label: 'Error boundary', type: 'pattern', level: 2 },
  { label: 'React Query setup', type: 'code', level: 2 },
  { label: 'Prisma schema', type: 'code', level: 2 },
  { label: 'Stripe webhook', type: 'code', level: 2 },
  { label: 'Zod validation', type: 'pattern', level: 2 },
  { label: 'tRPC router', type: 'code', level: 2 },

  // L3 Reference — stable knowledge
  { label: 'Next.js App Router', type: 'architecture', level: 3 },
  { label: 'REST conventions', type: 'pattern', level: 3 },
  { label: 'Database indexes', type: 'decision', level: 3 },
  { label: 'Component structure', type: 'architecture', level: 3 },
  { label: 'State management', type: 'decision', level: 3 },
  { label: 'CSS methodology', type: 'pattern', level: 3 },
  { label: 'Testing strategy', type: 'decision', level: 3 },
  { label: 'TypeScript strict', type: 'pattern', level: 3 },
  { label: 'ESM modules', type: 'architecture', level: 3 },

  // L4 Archive — historical
  { label: 'Migration v1→v2', type: 'summary', level: 4 },
  { label: 'Old auth system', type: 'code', level: 4 },
  { label: 'Redux removal', type: 'decision', level: 4 },
  { label: 'API redesign', type: 'summary', level: 4 },
  { label: 'Performance audit', type: 'summary', level: 4 },
  { label: 'Webpack config', type: 'code', level: 4 },
  { label: 'CSS-in-JS removal', type: 'decision', level: 4 },

  // L5 Deep Archive — compressed
  { label: 'Project genesis', type: 'summary', level: 5 },
  { label: 'Tech evaluation', type: 'summary', level: 5 },
  { label: 'v0.1 architecture', type: 'summary', level: 5 },
  { label: 'Initial patterns', type: 'summary', level: 5 },
  { label: 'Legacy decisions', type: 'summary', level: 5 },

  // L6 Web Knowledge
  { label: 'Next.js 15 docs', type: 'pattern', level: 6 },
  { label: 'Prisma best practices', type: 'pattern', level: 6 },
  { label: 'React 19 changes', type: 'pattern', level: 6 },
  { label: 'Stripe API v2024', type: 'pattern', level: 6 },
  { label: 'Auth.js migration', type: 'pattern', level: 6 },
  { label: 'Tailwind v4 guide', type: 'pattern', level: 6 },
];

export const demoNodes: DemoNode[] = nodeTemplates.map((t, i) => ({
  id: `node-${i}`,
  label: t.label,
  type: t.type,
  level: t.level,
  relevanceScore: Math.max(0.1, 1 - (t.level - 1) * 0.18 + (Math.random() - 0.5) * 0.1),
}));

// Generate edges based on logical connections
const edgeDefinitions: Array<[number, number, string]> = [
  // Auth cluster
  [0, 1, 'implements'], [0, 2, 'calls'], [2, 3, 'depends_on'], [1, 4, 'related_to'],
  // API cluster
  [5, 8, 'depends_on'], [5, 10, 'calls'], [9, 5, 'related_to'],
  // Architecture connections
  [12, 5, 'related_to'], [12, 15, 'part_of'], [13, 5, 'related_to'],
  // Cross-level connections
  [0, 21, 'supersedes'], [8, 14, 'implements'], [7, 11, 'calls'],
  [16, 6, 'related_to'], [17, 19, 'related_to'],
  // Archive connections
  [20, 22, 'related_to'], [23, 13, 'related_to'],
  // Web knowledge connections
  [33, 12, 'related_to'], [34, 8, 'related_to'], [35, 7, 'related_to'],
  [36, 9, 'related_to'], [37, 0, 'related_to'], [38, 18, 'related_to'],
  // More connections for density
  [3, 0, 'part_of'], [6, 7, 'related_to'], [10, 8, 'calls'],
  [14, 19, 'related_to'], [15, 12, 'part_of'],
];

export const demoEdges: DemoEdge[] = edgeDefinitions
  .filter(([s, t]) => s < demoNodes.length && t < demoNodes.length)
  .map(([source, target, type], i) => ({
    source: `node-${source}`,
    target: `node-${target}`,
    type,
    weight: 0.5 + Math.random() * 0.5,
  }));
