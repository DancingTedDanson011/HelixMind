/**
 * Generate web/public/brain.html from the demo spiral.db using the real CLI template.
 * Usage: npx tsx brain-versions/gen-demo-brain-html.mts
 */
import Database from 'better-sqlite3';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateBrainHTML } from '../src/cli/brain/template.js';
import type { BrainExport } from '../src/cli/brain/exporter.js';

const DB_PATH = resolve('web/Webseit_demo_brain/.helixmind/spiral.db');
const OUT_PATH = resolve('web/public/brain.html');

const db = new Database(DB_PATH, { readonly: true });

// Read all nodes
const rawNodes = db.prepare(`
  SELECT id, summary, content, type, level, relevance_score, created_at, accessed_at
  FROM nodes ORDER BY level, relevance_score DESC
`).all() as Array<{
  id: string; summary: string; content: string; type: string;
  level: number; relevance_score: number; created_at: string; accessed_at: string;
}>;

// Read all edges
const rawEdges = db.prepare(`
  SELECT source_id, target_id, relation_type, weight FROM edges ORDER BY weight DESC
`).all() as Array<{
  source_id: string; target_id: string; relation_type: string; weight: number;
}>;

db.close();

// Build BrainExport
let webKnowledgeCount = 0;

const nodes = rawNodes.map(n => {
  const isWeb = n.content.includes('[Web Knowledge:') || n.level === 6;
  if (isWeb) webKnowledgeCount++;

  const sourceMatch = n.content.match(/Source:\s*(\S+)/);
  const topicMatch = n.content.match(/\[Web Knowledge:\s*([^\]]+)\]/);

  return {
    id: n.id,
    label: n.summary || n.content.slice(0, 60),
    content: n.content,
    type: n.type,
    level: (isWeb ? 6 : n.level) as 1 | 2 | 3 | 4 | 5 | 6,
    relevanceScore: n.relevance_score,
    createdAt: n.created_at,
    lastAccessed: n.accessed_at,
    ...(isWeb && sourceMatch?.[1] ? { webSource: sourceMatch[1] } : {}),
    ...(isWeb && topicMatch?.[1] ? { webTopic: topicMatch[1] } : {}),
  };
});

const edges = rawEdges.map(e => ({
  source: e.source_id,
  target: e.target_id,
  type: e.relation_type,
  weight: e.weight,
}));

const data: BrainExport = {
  meta: {
    projectName: 'HelixMind Demo Brain',
    totalNodes: nodes.length,
    totalEdges: edges.length,
    webKnowledgeCount,
    exportDate: new Date().toISOString(),
    brainScope: 'project',
  },
  nodes,
  edges,
};

console.log(`Nodes: ${nodes.length}, Edges: ${edges.length}, Web: ${webKnowledgeCount}`);

const html = generateBrainHTML(data);
writeFileSync(OUT_PATH, html, 'utf-8');

console.log(`Written ${(html.length / 1024 / 1024).toFixed(2)} MB → ${OUT_PATH}`);
