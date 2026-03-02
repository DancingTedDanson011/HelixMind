import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';

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

// Demo data
const demoData = {
  meta: { totalNodes: 40, totalEdges: 55, webKnowledgeCount: 3, exportDate: new Date().toISOString(), projectName: 'demo', brainScope: 'local' },
  nodes: [],
  edges: [],
};
const types = ['code','module','architecture','pattern','error','decision','summary','web_knowledge'];
const edgeTypes = ['imports','calls','depends_on','related_to','similar_to','belongs_to','part_of','supersedes'];
for (let i = 0; i < 40; i++) {
  const level = i < 20 ? 1 : i < 26 ? 2 : i < 31 ? 3 : i < 35 ? 4 : i < 37 ? 5 : 6;
  demoData.nodes.push({ id: `n${i}`, label: `Node ${i} L${level}`, content: `Content ${i}`, type: types[i%types.length], level, relevanceScore: Math.random()*0.8+0.2, createdAt: new Date(Date.now()-i*3600000).toISOString(), lastAccessed: new Date().toISOString(), ...(level===6?{webSource:'https://example.com',webTopic:'demo'}:{}) });
}
for (let i = 0; i < 55; i++) {
  const src = Math.floor(Math.random()*40);
  let tgt = Math.floor(Math.random()*40); if(tgt===src) tgt=(tgt+1)%40;
  demoData.edges.push({ source:`n${src}`, target:`n${tgt}`, type: edgeTypes[i%edgeTypes.length], weight: Math.random()*0.8+0.2 });
}

mkdirSync('brain-versions/tmp', { recursive: true });

for (const { commit, label } of VERSIONS) {
  try {
    // Get template.ts
    let ts = execSync(`git show ${commit}:src/cli/brain/template.ts`, { encoding: 'utf8', maxBuffer: 2*1024*1024 });

    // Remove type import (not needed at runtime)
    ts = ts.replace(/^import\s+type\s+.*$/gm, '');
    // Remove ': BrainExport' type annotation from function param
    ts = ts.replace(/data:\s*BrainExport/g, 'data');
    // Remove ': string' return type
    ts = ts.replace(/\):\s*string\s*\{/, ') {');
    // Change export function to just function
    ts = ts.replace('export function', 'function');

    // Add runner code at the end
    const runner = `
const __data = ${JSON.stringify(demoData)};
const __html = generateBrainHTML(__data);
process.stdout.write(__html);
`;

    const tmpFile = `brain-versions/tmp/brain-${commit.slice(0,7)}.mjs`;
    writeFileSync(tmpFile, ts + '\n' + runner, 'utf8');

    // Run with node (it's pure JS after removing types)
    const html = execSync(`node ${tmpFile}`, { encoding: 'utf8', maxBuffer: 5*1024*1024, timeout: 10000 });

    const outFile = `brain-versions/brain-${commit.slice(0,7)}.html`;
    writeFileSync(outFile, html, 'utf8');
    console.log(`OK ${outFile} (${html.length} bytes) — ${label}`);
  } catch(e) {
    console.log(`FAIL ${commit} (${label}): ${e.message?.slice(0,200)}`);
  }
}

// Index page
const indexItems = VERSIONS.map(({commit, label}) => ({ filename: `brain-${commit.slice(0,7)}.html`, label, commit }));
const indexHTML = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>HelixMind Brain — Version Vergleich</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0a0a1a;color:#ccc;font-family:'Segoe UI',sans-serif;height:100vh;display:flex;flex-direction:column}
  .toolbar{display:flex;gap:8px;padding:12px 16px;background:#111128;border-bottom:1px solid #222;flex-wrap:wrap;align-items:center}
  .toolbar h1{color:#00ffff;font-size:16px;margin-right:16px;white-space:nowrap}
  .btn{padding:6px 14px;border:1px solid #333;background:#1a1a2e;color:#aaa;border-radius:6px;cursor:pointer;font-size:12px;transition:all 0.2s}
  .btn:hover{border-color:#00ffff;color:#fff}
  .btn.active{border-color:#00ffff;color:#00ffff;background:rgba(0,255,255,0.08)}
  .info{color:#666;font-size:11px;padding:8px 16px;background:#0d0d20;border-bottom:1px solid #1a1a2e}
  iframe{flex:1;border:none;width:100%}
</style>
</head>
<body>
  <div class="toolbar">
    <h1>Brain Versions</h1>
    ${indexItems.map((item,i) => `<button class="btn${i===0?' active':''}" onclick="load('${item.filename}',this,'${item.label}')">${item.label}</button>`).join('\n    ')}
  </div>
  <div class="info" id="info">${indexItems[0].label}</div>
  <iframe id="viewer" src="${indexItems[0].filename}"></iframe>
  <script>
    function load(file,btn,label){
      document.getElementById('viewer').src=file;
      document.getElementById('info').textContent=label+' — '+file;
      document.querySelectorAll('.btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    }
  </script>
</body>
</html>`;
writeFileSync('brain-versions/index.html', indexHTML, 'utf8');
console.log('\\nindex.html updated!');
