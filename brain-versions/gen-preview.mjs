import { generateBrainHTML } from '../dist/cli/brain/template.js';
import { writeFileSync } from 'fs';
import Database from 'better-sqlite3';

const db = new Database('C:/Users/DancingTedDanson/Desktop/Neuer Ordner (4)/.helixmind/spiral.db', { readonly: true });

const rawNodes = db.prepare('SELECT id, type, content, summary, level, relevance_score, created_at, updated_at, accessed_at FROM nodes').all();
const rawEdges = db.prepare('SELECT source_id, target_id, relation_type, weight FROM edges').all();
db.close();

const nodes = rawNodes.map(n => ({
  id: n.id,
  label: (n.summary || n.content || '').slice(0, 80),
  content: n.content || '',
  type: n.type || 'code',
  level: n.level || 1,
  relevanceScore: n.relevance_score || 0.5,
  createdAt: new Date(n.created_at).toISOString(),
  lastAccessed: new Date(n.accessed_at).toISOString(),
}));

const edges = rawEdges.map(e => ({
  source: e.source_id,
  target: e.target_id,
  type: e.relation_type,
  weight: e.weight,
}));

const data = {
  meta: { totalNodes: nodes.length, totalEdges: edges.length, webKnowledgeCount: 0, exportDate: new Date().toISOString(), projectName: 'TestProject', brainScope: 'project' },
  nodes, edges
};

console.log('Nodes:', nodes.length, '| Edges:', edges.length);
const lvlCounts = {};
nodes.forEach(n => { lvlCounts[n.level] = (lvlCounts[n.level] || 0) + 1; });
console.log('Per level:', JSON.stringify(lvlCounts));

const html = generateBrainHTML(data);
writeFileSync('C:/Users/DancingTedDanson/Desktop/brain-preview.html', html);
console.log('Written to C:/Users/DancingTedDanson/Desktop/brain-preview.html');
