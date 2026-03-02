import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const VERSIONS = [
  { commit: '7651f7a', label: 'v0.2.14 — Original Force-Directed' },
  { commit: '6f6cfd8', label: 'v3 Nebula Rendering' },
  { commit: 'c058fbd', label: 'v3 Fix — Vertical Layers' },
  { commit: 'e46bdaa', label: 'v0.2.22 — 6-Layer Separation' },
  { commit: 'c825667', label: 'v0.2.23 — Inverted Funnel' },
  { commit: 'a5eedab', label: 'v0.2.24 — Organic Nebula' },
  { commit: 'e6b5385', label: 'V7 Clustered Galaxy' },
  { commit: 'c138cdc', label: 'V7 Colorful Nodes' },
];

// Read real data from spiral.db
const Database = require('better-sqlite3');
const db = new Database('C:/Users/DancingTedDanson/Desktop/Neuer Ordner (4)/.helixmind/spiral.db', { readonly: true });

const rawNodes = db.prepare('SELECT id, type, content, summary, level, relevance_score, created_at, accessed_at, metadata FROM nodes').all();
const rawEdges = db.prepare('SELECT source_id, target_id, relation_type, weight FROM edges').all();
db.close();

console.log(`Loaded ${rawNodes.length} nodes, ${rawEdges.length} edges from spiral.db`);

// Convert to BrainExport format
const webNodes = rawNodes.filter(n => {
  try { const m = JSON.parse(n.metadata || '{}'); return m.webSource; } catch { return false; }
});

const brainData = {
  meta: {
    totalNodes: rawNodes.length,
    totalEdges: rawEdges.length,
    webKnowledgeCount: webNodes.length,
    exportDate: new Date().toISOString(),
    projectName: 'desktop-camera',
    brainScope: 'local',
  },
  nodes: rawNodes.map(n => {
    let meta = {};
    try { meta = JSON.parse(n.metadata || '{}'); } catch {}
    return {
      id: n.id,
      label: (n.summary || n.content || '').slice(0, 60),
      content: (n.content || '').slice(0, 200),
      type: n.type || 'code',
      level: n.level || 1,
      relevanceScore: n.relevance_score || 0.5,
      createdAt: n.created_at || new Date().toISOString(),
      lastAccessed: n.accessed_at || new Date().toISOString(),
      ...(meta.webSource ? { webSource: meta.webSource, webTopic: meta.webTopic || '' } : {}),
    };
  }),
  edges: rawEdges.map(e => ({
    source: e.source_id,
    target: e.target_id,
    type: e.relation_type || 'related_to',
    weight: e.weight || 0.5,
  })),
};

const dataJSON = JSON.stringify(brainData);
console.log(`BrainExport JSON: ${(dataJSON.length / 1024).toFixed(0)} KB`);

mkdirSync('brain-versions/tmp', { recursive: true });

for (const { commit, label } of VERSIONS) {
  try {
    let ts = execSync(`git show ${commit}:src/cli/brain/template.ts`, { encoding: 'utf8', maxBuffer: 2*1024*1024 });
    ts = ts.replace(/^import\s+type\s+.*$/gm, '');
    ts = ts.replace(/data:\s*BrainExport/g, 'data');
    ts = ts.replace(/\):\s*string\s*\{/, ') {');
    ts = ts.replace('export function', 'function');

    const runner = `
const __data = ${dataJSON};
const __html = generateBrainHTML(__data);
process.stdout.write(__html);
`;
    const tmpFile = `brain-versions/tmp/brain-${commit.slice(0,7)}.mjs`;
    writeFileSync(tmpFile, ts + '\n' + runner, 'utf8');

    const html = execSync(`node ${tmpFile}`, { encoding: 'utf8', maxBuffer: 20*1024*1024, timeout: 30000 });
    const outFile = `brain-versions/brain-${commit.slice(0,7)}.html`;
    writeFileSync(outFile, html, 'utf8');
    console.log(`OK ${outFile} (${(html.length/1024).toFixed(0)} KB) — ${label}`);
  } catch(e) {
    console.log(`FAIL ${commit} (${label}): ${e.message?.slice(0,300)}`);
  }
}

// Index
const indexItems = VERSIONS.map(({commit, label}) => ({ filename: `brain-${commit.slice(0,7)}.html`, label }));
const indexHTML = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>HelixMind Brain — Version Vergleich (Real Data: ${rawNodes.length} nodes)</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0a0a1a;color:#ccc;font-family:'Segoe UI',sans-serif;height:100vh;display:flex;flex-direction:column}
  .toolbar{display:flex;gap:8px;padding:12px 16px;background:#111128;border-bottom:1px solid #222;flex-wrap:wrap;align-items:center}
  .toolbar h1{color:#00ffff;font-size:16px;margin-right:16px;white-space:nowrap}
  .btn{padding:6px 14px;border:1px solid #333;background:#1a1a2e;color:#aaa;border-radius:6px;cursor:pointer;font-size:12px;transition:all 0.2s}
  .btn:hover{border-color:#00ffff;color:#fff}
  .btn.active{border-color:#00ffff;color:#00ffff;background:rgba(0,255,255,0.08)}
  .info{color:#888;font-size:12px;padding:8px 16px;background:#0d0d20;border-bottom:1px solid #1a1a2e}
  iframe{flex:1;border:none;width:100%}
</style>
</head>
<body>
  <div class="toolbar">
    <h1>Brain Versions — ${rawNodes.length} Nodes / ${rawEdges.length} Edges</h1>
    ${indexItems.map((item,i) => `<button class="btn${i===0?' active':''}" onclick="load('${item.filename}',this,'${item.label}')">${item.label}</button>`).join('\n    ')}
  </div>
  <div class="info" id="info">${indexItems[0].label}</div>
  <iframe id="viewer" src="${indexItems[0].filename}"></iframe>
  <script>
    function load(file,btn,label){
      document.getElementById('viewer').src=file;
      document.getElementById('info').textContent=label;
      document.querySelectorAll('.btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    }
  </script>
</body>
</html>`;
writeFileSync('brain-versions/index.html', indexHTML, 'utf8');
console.log('\\nindex.html updated!');
