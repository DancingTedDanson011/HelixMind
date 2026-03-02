import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const db = new Database('C:/Users/DancingTedDanson/Desktop/Neuer Ordner (4)/.helixmind/spiral.db');
const now = Date.now();

const l4Nodes = [
  { type: 'architecture', content: 'Legacy REST API v1 used Express.js with callback-based middleware chain. Migrated to v2 with async/await and Koa.', summary: 'Legacy REST API v1 (Express to Koa migration)' },
  { type: 'pattern', content: 'Old authentication flow used session cookies with server-side storage in Redis. Replaced by JWT stateless tokens in 2024.', summary: 'Session-based auth to JWT migration' },
  { type: 'decision', content: 'Initially chose MongoDB for user data but migrated to PostgreSQL for relational integrity and ACID transactions.', summary: 'MongoDB to PostgreSQL migration decision' },
  { type: 'code', content: 'Deprecated utility functions: formatDate(), slugify(), deepClone() now using date-fns, slugify npm, structuredClone().', summary: 'Deprecated utility functions replaced by stdlib' },
  { type: 'architecture', content: 'Monolith architecture phase: single Node.js process handling API, SSR, background jobs. Split into microservices Q3 2024.', summary: 'Monolith to microservices transition' },
  { type: 'pattern', content: 'Redux was used for global state management. Migrated to Zustand for simplicity and reduced boilerplate.', summary: 'Redux to Zustand state management migration' },
  { type: 'decision', content: 'Webpack build pipeline replaced by Vite for 10x faster dev server startup and simpler configuration.', summary: 'Webpack to Vite build tool migration' },
  { type: 'code', content: 'Old test suite used Mocha+Chai with manual mocking. Replaced by Vitest with built-in mocking and faster execution.', summary: 'Mocha/Chai to Vitest test framework migration' },
  { type: 'architecture', content: 'Original deployment was on Heroku dynos. Migrated to Docker containers on DigitalOcean for cost and flexibility.', summary: 'Heroku to Docker/DigitalOcean deployment' },
  { type: 'pattern', content: 'CSS Modules approach was replaced by Tailwind CSS utility classes for faster UI development and consistent design.', summary: 'CSS Modules to Tailwind CSS migration' },
];

const l5Nodes = [
  { type: 'wisdom', content: 'Project genesis: Initial idea was a simple CLI note-taking tool. Evolved into AI coding assistant after exploring LLM integration possibilities.', summary: 'Project genesis: note-tool to AI coding assistant' },
  { type: 'knowledge', content: 'Technology evaluation 2023: Compared Langchain, LlamaIndex, and custom LLM integration. Chose custom for full control and minimal dependencies.', summary: 'Tech evaluation: custom LLM over frameworks' },
  { type: 'wisdom', content: 'Spiral memory concept inspired by human memory consolidation: frequent access strengthens connections, decay promotes forgetting irrelevant data.', summary: 'Spiral memory inspired by human memory consolidation' },
  { type: 'knowledge', content: 'Embedding model selection: tested OpenAI ada-002, Cohere embed-v3, and MiniLM-L6-v2. Chose MiniLM for offline capability and zero API cost.', summary: 'Embedding model: MiniLM-L6-v2 for offline use' },
  { type: 'wisdom', content: 'Architecture principle: CLI-first design ensures functionality works without GUI. Browser brain visualization is enhancement, not requirement.', summary: 'CLI-first architecture principle' },
  { type: 'knowledge', content: 'SQLite chosen over Postgres/Redis for single-file portability. With sqlite-vec extension for vector similarity search without external services.', summary: 'SQLite + sqlite-vec for portable vector DB' },
  { type: 'wisdom', content: 'Permission model research: studied VS Code, Docker, and Android permission systems. Designed 3-tier model: auto/ask/dangerous with YOLO escape hatch.', summary: 'Permission model inspired by VS Code/Docker/Android' },
  { type: 'knowledge', content: 'Early prototype used GPT-3.5 exclusively. Claude integration added after Anthropic released tool-use API, which better suited agent workflows.', summary: 'GPT-3.5 to Claude migration for tool-use support' },
];

const insertNode = db.prepare('INSERT INTO nodes (id, type, content, summary, level, relevance_score, token_count, metadata, created_at, updated_at, accessed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const insertEdge = db.prepare('INSERT OR IGNORE INTO edges (id, source_id, target_id, relation_type, weight, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');

const allNewIds = [];
const relTypes = ['evolved_from', 'references', 'supports', 'related_to', 'depends_on', 'implements', 'extends', 'uses', 'inspired_by', 'contradicts'];

const existingL1 = db.prepare('SELECT id FROM nodes WHERE level=1 LIMIT 15').all().map(r => r.id);
const existingL2 = db.prepare('SELECT id FROM nodes WHERE level=2 LIMIT 10').all().map(r => r.id);
const existingL3 = db.prepare('SELECT id FROM nodes WHERE level=3 LIMIT 10').all().map(r => r.id);

const insert = db.transaction(() => {
  for (const n of l4Nodes) {
    const id = randomUUID();
    allNewIds.push({ id, level: 4 });
    insertNode.run(id, n.type, n.content, n.summary, 4, 0.3 + Math.random() * 0.3, n.content.length, '{}', now - 86400000 * 30, now, now - 86400000 * 10);
  }
  for (const n of l5Nodes) {
    const id = randomUUID();
    allNewIds.push({ id, level: 5 });
    insertNode.run(id, n.type, n.content, n.summary, 5, 0.2 + Math.random() * 0.2, n.content.length, '{}', now - 86400000 * 90, now, now - 86400000 * 60);
  }

  // Edges between new nodes
  for (let i = 0; i < allNewIds.length; i++) {
    for (let j = i + 1; j < allNewIds.length; j++) {
      if (Math.random() < 0.35) {
        const rt = relTypes[Math.floor(Math.random() * relTypes.length)];
        insertEdge.run(randomUUID(), allNewIds[i].id, allNewIds[j].id, rt, 0.2 + Math.random() * 0.5, '{}', now);
      }
    }
  }

  // L4 -> L1/L3 cross-level edges
  for (const n4 of allNewIds.filter(n => n.level === 4)) {
    for (let k = 0; k < 3; k++) {
      const target = existingL1[Math.floor(Math.random() * existingL1.length)];
      if (target) insertEdge.run(randomUUID(), target, n4.id, 'evolved_from', 0.4 + Math.random() * 0.4, '{}', now);
    }
    for (let k = 0; k < 2; k++) {
      const target = existingL3[Math.floor(Math.random() * existingL3.length)];
      if (target) insertEdge.run(randomUUID(), n4.id, target, 'references', 0.3 + Math.random() * 0.3, '{}', now);
    }
  }

  // L5 -> L4 and L5 -> L2 cross-level edges
  for (const n5 of allNewIds.filter(n => n.level === 5)) {
    for (let k = 0; k < 2; k++) {
      const l4s = allNewIds.filter(n => n.level === 4);
      const l4target = l4s[Math.floor(Math.random() * l4s.length)];
      if (l4target) insertEdge.run(randomUUID(), n5.id, l4target.id, 'inspired_by', 0.5 + Math.random() * 0.3, '{}', now);
    }
    for (let k = 0; k < 2; k++) {
      const target = existingL2[Math.floor(Math.random() * existingL2.length)];
      if (target) insertEdge.run(randomUUID(), n5.id, target, 'supports', 0.3 + Math.random() * 0.3, '{}', now);
    }
  }
});
insert();

const counts = db.prepare('SELECT level, count(*) as cnt FROM nodes GROUP BY level ORDER BY level').all();
console.log('Node counts per level:', JSON.stringify(counts));
const totalE = db.prepare('SELECT count(*) as c FROM edges').get();
console.log('Total edges:', totalE.c);
db.close();
console.log('Done: Added', l4Nodes.length, 'L4 +', l5Nodes.length, 'L5 nodes');
