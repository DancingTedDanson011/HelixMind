import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const DB = 'C:\\Users\\DancingTedDanson\\Desktop\\Webseit_demo_brain\\.helixmind\\spiral.db';

// Extract ALL nodes
console.log('Extracting ALL nodes...');
const nodesRaw = execSync(
  `sqlite3 -json "${DB}" "SELECT id, type, summary, level, relevance_score FROM nodes ORDER BY level, relevance_score DESC"`,
  { maxBuffer: 100 * 1024 * 1024 }
).toString();
const allNodes = JSON.parse(nodesRaw);
console.log(`Got ${allNodes.length} nodes`);

// Extract ALL edges
console.log('Extracting ALL edges...');
const edgesRaw = execSync(
  `sqlite3 -json "${DB}" "SELECT source_id, target_id, relation_type, weight FROM edges"`,
  { maxBuffer: 100 * 1024 * 1024 }
).toString();
const allEdges = JSON.parse(edgesRaw);
console.log(`Got ${allEdges.length} edges`);

// Build node ID set for edge filtering
const nodeIds = new Set(allNodes.map(n => n.id));

// Clean label function
function cleanLabel(summary, type) {
  if (!summary) return type || 'node';
  let label = summary;
  // Remove prefixes
  label = label.replace(/^User:\s*/i, '');
  label = label.replace(/^\[validation\]\s*/i, '');
  label = label.replace(/^Tool\s+/i, '');
  label = label.replace(/^Summary:\s*/i, '');
  label = label.replace(/^Context:\s*/i, '');
  // Remove quotes
  label = label.replace(/^["']|["']$/g, '');
  // Truncate
  if (label.length > 60) label = label.substring(0, 57) + '...';
  // Fallback
  if (!label.trim()) return type || 'node';
  return label.trim();
}

// Process nodes
const demoNodes = allNodes.map(n => ({
  id: n.id,
  label: cleanLabel(n.summary, n.type),
  type: n.type || 'context',
  level: n.level || 1,
  relevance: n.relevance_score || 0.5,
}));

// Process edges — only keep edges where both source and target exist
const demoEdges = allEdges
  .filter(e => nodeIds.has(e.source_id) && nodeIds.has(e.target_id))
  .map(e => ({
    source: e.source_id,
    target: e.target_id,
    type: e.relation_type || 'related_to',
    weight: e.weight || 0.5,
  }));

console.log(`Final: ${demoNodes.length} nodes, ${demoEdges.length} edges`);

// Level distribution
const levels = {};
demoNodes.forEach(n => { levels[n.level] = (levels[n.level] || 0) + 1; });
console.log('Level distribution:', levels);

// Write TypeScript file
const tsContent = `// Auto-generated from Webseit_demo_brain spiral.db — COMPLETE dataset
// ${demoNodes.length} nodes, ${demoEdges.length} edges
// Generated: ${new Date().toISOString()}

export interface DemoNode {
  id: string;
  label: string;
  type: string;
  level: number;
  relevance: number;
}

export interface DemoEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
}

export const demoNodes: DemoNode[] = ${JSON.stringify(demoNodes, null, 2)};

export const demoEdges: DemoEdge[] = ${JSON.stringify(demoEdges, null, 2)};
`;

writeFileSync(
  'C:\\Users\\DancingTedDanson\\Desktop\\HelixMind\\web\\src\\components\\brain\\brain-demo-data.ts',
  tsContent
);
console.log('Written to brain-demo-data.ts');
console.log(`File size: ${(Buffer.byteLength(tsContent) / 1024 / 1024).toFixed(2)} MB`);
