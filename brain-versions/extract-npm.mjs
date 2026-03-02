import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Read real data from spiral.db
const Database = require('better-sqlite3');
const db = new Database('C:/Users/DancingTedDanson/Desktop/Neuer Ordner (4)/.helixmind/spiral.db', { readonly: true });
const rawNodes = db.prepare('SELECT id, type, content, summary, level, relevance_score, created_at, accessed_at, metadata FROM nodes').all();
const rawEdges = db.prepare('SELECT source_id, target_id, relation_type, weight FROM edges').all();
db.close();
console.log(`Loaded ${rawNodes.length} nodes, ${rawEdges.length} edges`);

const brainData = {
  meta: { totalNodes: rawNodes.length, totalEdges: rawEdges.length, webKnowledgeCount: 0, exportDate: new Date().toISOString(), projectName: 'real-brain', brainScope: 'local' },
  nodes: rawNodes.map(n => {
    let meta = {}; try { meta = JSON.parse(n.metadata || '{}'); } catch {}
    return { id: n.id, label: (n.summary||n.content||'').slice(0,60), content: (n.content||'').slice(0,200), type: n.type||'code', level: n.level||1, relevanceScore: n.relevance_score||0.5, createdAt: n.created_at||new Date().toISOString(), lastAccessed: n.accessed_at||new Date().toISOString(), ...(meta.webSource?{webSource:meta.webSource,webTopic:meta.webTopic||''}:{}) };
  }),
  edges: rawEdges.map(e => ({ source: e.source_id, target: e.target_id, type: e.relation_type||'related_to', weight: e.weight||0.5 })),
};

const ALL_VERSIONS = [
  '0.1.0','0.1.1','0.1.2','0.2.0','0.2.1','0.2.2','0.2.3','0.2.4','0.2.5','0.2.6','0.2.7',
  '0.2.8','0.2.9','0.2.10','0.2.11','0.2.12','0.2.13','0.2.14','0.2.15','0.2.16','0.2.17',
  '0.2.18','0.2.19','0.2.20','0.2.21','0.2.22','0.2.23','0.2.24','0.2.25','0.2.26','0.2.27',
  '0.2.28','0.2.29','0.2.30'
];

mkdirSync('brain-versions/npm-tmp', { recursive: true });

const results = [];

for (const ver of ALL_VERSIONS) {
  const tag = ver.replace(/\./g, '-');
  const outFile = `brain-versions/brain-npm-${tag}.html`;

  try {
    // Download tarball
    execSync(`npm pack helixmind@${ver} --pack-destination brain-versions/npm-tmp`, { encoding: 'utf8', timeout: 30000 });

    // Extract
    const tgz = `brain-versions/npm-tmp/helixmind-${ver}.tgz`;
    execSync(`tar -xzf "${tgz}" -C brain-versions/npm-tmp`, { timeout: 10000 });

    // Check if template.js exists
    const templatePath = 'brain-versions/npm-tmp/package/dist/cli/brain/template.js';
    if (!existsSync(templatePath)) {
      console.log(`SKIP ${ver} — no brain template`);
      // Cleanup
      try { rmSync('brain-versions/npm-tmp/package', { recursive: true }); } catch {}
      try { rmSync(tgz); } catch {}
      continue;
    }

    // Read compiled template.js
    let js = readFileSync(templatePath, 'utf8');

    // The compiled JS exports generateBrainHTML function
    // We need to call it with our data
    const runnerFile = `brain-versions/npm-tmp/runner-${tag}.mjs`;

    // Convert CJS to callable: replace export
    js = js.replace(/^export\s+/gm, '');
    // Remove source map reference
    js = js.replace(/\/\/# sourceMappingURL=.*$/m, '');

    const runner = `
${js}
const __data = ${JSON.stringify(brainData)};
const __html = generateBrainHTML(__data);
process.stdout.write(__html);
`;
    writeFileSync(runnerFile, runner, 'utf8');

    const html = execSync(`node ${runnerFile}`, { encoding: 'utf8', maxBuffer: 20*1024*1024, timeout: 15000 });
    writeFileSync(outFile, html, 'utf8');
    console.log(`OK v${ver} — ${(html.length/1024).toFixed(0)} KB`);
    results.push({ ver, filename: `brain-npm-${tag}.html`, size: html.length });

  } catch(e) {
    console.log(`FAIL v${ver}: ${e.message?.slice(0,150)}`);
  }

  // Cleanup
  try { rmSync('brain-versions/npm-tmp/package', { recursive: true, force: true }); } catch {}
}

// Generate index with ALL versions
const indexHTML = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>HelixMind Brain — ALLE ${results.length} Versionen</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0a0a1a;color:#ccc;font-family:'Segoe UI',sans-serif;height:100vh;display:flex;flex-direction:column}
  .toolbar{display:flex;gap:6px;padding:10px 16px;background:#111128;border-bottom:1px solid #222;flex-wrap:wrap;align-items:center}
  .toolbar h1{color:#00ffff;font-size:14px;margin-right:12px;white-space:nowrap;width:100%}
  .btn{padding:5px 10px;border:1px solid #333;background:#1a1a2e;color:#aaa;border-radius:5px;cursor:pointer;font-size:11px;transition:all 0.2s}
  .btn:hover{border-color:#00ffff;color:#fff}
  .btn.active{border-color:#00ffff;color:#00ffff;background:rgba(0,255,255,0.08)}
  .info{color:#888;font-size:12px;padding:6px 16px;background:#0d0d20;border-bottom:1px solid #1a1a2e}
  iframe{flex:1;border:none;width:100%}
</style>
</head>
<body>
  <div class="toolbar">
    <h1>Alle Brain Versionen — ${rawNodes.length} Nodes / ${rawEdges.length} Edges</h1>
    ${results.map((r,i) => `<button class="btn${i===0?' active':''}" onclick="load('${r.filename}',this,'v${r.ver}')">v${r.ver}</button>`).join('\n    ')}
  </div>
  <div class="info" id="info">v${results[0]?.ver || '?'}</div>
  <iframe id="viewer" src="${results[0]?.filename || ''}"></iframe>
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
console.log(`\\nindex.html mit ${results.length} Versionen erstellt!`);
