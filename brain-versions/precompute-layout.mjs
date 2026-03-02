/**
 * Pre-computes force-directed layout positions for all brain nodes.
 * Exact port of CLI brain template.ts worker code.
 * Output is appended to brain-demo-data.ts as `demoPositions`.
 */
import { readFileSync, writeFileSync } from 'fs';

const DATA_FILE = 'C:\\Users\\DancingTedDanson\\Desktop\\HelixMind\\web\\src\\components\\brain\\brain-demo-data.ts';

// Parse nodes from TS file (extract the JSON array)
const src = readFileSync(DATA_FILE, 'utf-8');
const nodesMatch = src.match(/export const demoNodes: DemoNode\[\] = (\[[\s\S]*?\]);\s*\n\s*export const demoEdges/);
const edgesMatch = src.match(/export const demoEdges: DemoEdge\[\] = (\[[\s\S]*?\]);\s*$/m);

if (!nodesMatch || !edgesMatch) {
  console.error('Could not parse brain-demo-data.ts');
  process.exit(1);
}

const nodes = JSON.parse(nodesMatch[1]);
const edges = JSON.parse(edgesMatch[1]);

console.log(`Nodes: ${nodes.length}, Edges: ${edges.length}`);

// === Force layout params (from CLI template.ts) ===
const BASE_SPREAD = 400, REP = 28000, ATT = 0.002, ILEN = 100, DAMP = 0.82, GCELL = 160;
const MAX_E = 18000, CPULL = 0.005, SAT_SIZE = 7;
const GA = 2.399963;

const nC = nodes.length;
const SPREAD = BASE_SPREAD + Math.sqrt(nC) * 25;
const STEPS = nC > 2000 ? 300 : nC > 1000 ? 500 : 800;

console.log(`SPREAD: ${SPREAD.toFixed(0)}, STEPS: ${STEPS}`);

function srand(s) {
  const x = Math.sin(s * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// Build levels
const levels = new Int32Array(nC);
const lvlCounts = {};
nodes.forEach((n, i) => {
  levels[i] = n.level;
  lvlCounts[n.level] = (lvlCounts[n.level] || 0) + 1;
});

// Build edge pairs
const idxMap = {};
nodes.forEach((n, i) => { idxMap[n.id] = i; });
const ePairs = [];
for (const e of edges) {
  const si = idxMap[e.source];
  const ti = idxMap[e.target];
  if (si !== undefined && ti !== undefined) {
    ePairs.push([si, ti]);
    if (ePairs.length >= MAX_E) break;
  }
}
console.log(`Edge pairs: ${ePairs.length}`);

// Level centroids along helix
const uLvl = [...new Set(Array.from(levels))].sort().filter(l => l !== 6);
const centroids = {};
uLvl.forEach((lv, i) => {
  const t = (i + 0.5) / Math.max(uLvl.length, 1);
  const height = (t - 0.5) * SPREAD * 2.4;
  const radius = SPREAD * 0.7 + SPREAD * 0.15 * Math.sin(t * Math.PI * 2);
  const angle = GA * i * 2.5;
  centroids[lv] = { x: radius * Math.cos(angle), y: height, z: radius * Math.sin(angle) };
});

// L6 satellite clusters
const l6Indices = [];
for (let i = 0; i < nC; i++) if (levels[i] === 6) l6Indices.push(i);
const numSats = Math.max(1, Math.ceil(l6Indices.length / SAT_SIZE));
const satCentroids = [];
for (let s = 0; s < numSats; s++) {
  const phi = Math.acos(1 - 2 * (s + 0.5) / numSats);
  const theta = GA * s * 3.7;
  const satR = SPREAD * 1.6;
  satCentroids.push({
    x: satR * Math.sin(phi) * Math.cos(theta),
    y: satR * Math.cos(phi) * 0.8,
    z: satR * Math.sin(phi) * Math.sin(theta),
  });
}
const l6Sat = {};
l6Indices.forEach((ni, idx) => { l6Sat[ni] = Math.floor(idx / SAT_SIZE) % numSats; });

// Initialize positions
const P = new Float64Array(nC * 3);
const V = new Float64Array(nC * 3);
for (let i = 0; i < nC; i++) {
  const lv = levels[i];
  const phi = Math.acos(2 * srand(i * 13) - 1);
  const th = srand(i * 17) * Math.PI * 2;
  if (lv === 1) {
    const r = SPREAD * 0.9 * Math.cbrt(srand(i * 23));
    P[i * 3] = r * Math.sin(phi) * Math.cos(th);
    P[i * 3 + 1] = r * Math.sin(phi) * Math.sin(th);
    P[i * 3 + 2] = r * Math.cos(phi);
  } else if (lv === 6) {
    const sc = satCentroids[l6Sat[i]] || satCentroids[0];
    const r = SPREAD * 0.06 * Math.cbrt(srand(i * 23));
    P[i * 3] = sc.x + r * Math.sin(phi) * Math.cos(th);
    P[i * 3 + 1] = sc.y + r * Math.sin(phi) * Math.sin(th);
    P[i * 3 + 2] = sc.z + r * Math.cos(phi);
  } else {
    const c = centroids[lv] || { x: 0, y: 0, z: 0 };
    const lc = lvlCounts[lv] || 1;
    const initR = SPREAD * 0.15 * Math.sqrt(Math.max(lc / 50, 1));
    const r = initR * Math.cbrt(srand(i * 23));
    P[i * 3] = c.x + r * Math.sin(phi) * Math.cos(th);
    P[i * 3 + 1] = c.y + r * Math.sin(phi) * Math.sin(th);
    P[i * 3 + 2] = c.z + r * Math.cos(phi);
  }
}

// Force simulation
console.time('Force simulation');
for (let step = 0; step < STEPS; step++) {
  if (step % 50 === 0) process.stdout.write(`Step ${step}/${STEPS}... `);
  const decay = 1 - step / STEPS * 0.3;

  // Grid-based repulsion
  const grid = {};
  for (let i = 0; i < nC; i++) {
    const k = Math.floor(P[i * 3] / GCELL) + ',' + Math.floor(P[i * 3 + 1] / GCELL) + ',' + Math.floor(P[i * 3 + 2] / GCELL);
    if (!grid[k]) grid[k] = [];
    grid[k].push(i);
  }
  for (let i = 0; i < nC; i++) {
    const gx = Math.floor(P[i * 3] / GCELL);
    const gy = Math.floor(P[i * 3 + 1] / GCELL);
    const gz = Math.floor(P[i * 3 + 2] / GCELL);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const c = grid[(gx + dx) + ',' + (gy + dy) + ',' + (gz + dz)];
      if (!c) continue;
      for (const j of c) {
        if (j <= i) continue;
        const ddx = P[i * 3] - P[j * 3], ddy = P[i * 3 + 1] - P[j * 3 + 1], ddz = P[i * 3 + 2] - P[j * 3 + 2];
        const dSq = ddx * ddx + ddy * ddy + ddz * ddz + 1;
        const d = Math.sqrt(dSq);
        const f = REP * decay / dSq;
        const fx = ddx * f / d, fy = ddy * f / d, fz = ddz * f / d;
        V[i * 3] += fx; V[i * 3 + 1] += fy; V[i * 3 + 2] += fz;
        V[j * 3] -= fx; V[j * 3 + 1] -= fy; V[j * 3 + 2] -= fz;
      }
    }
  }

  // Edge attraction
  for (const [si, ti] of ePairs) {
    const ddx = P[ti * 3] - P[si * 3], ddy = P[ti * 3 + 1] - P[si * 3 + 1], ddz = P[ti * 3 + 2] - P[si * 3 + 2];
    const d = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) + 0.1;
    const sameLvl = levels[si] === levels[ti] ? 2.0 : 0.6;
    const f = (d - ILEN) * ATT * sameLvl;
    const fx = ddx / d * f, fy = ddy / d * f, fz = ddz / d * f;
    V[si * 3] += fx; V[si * 3 + 1] += fy; V[si * 3 + 2] += fz;
    V[ti * 3] -= fx; V[ti * 3 + 1] -= fy; V[ti * 3 + 2] -= fz;
  }

  // Cluster pull
  for (let i = 0; i < nC; i++) {
    if (levels[i] === 1) continue;
    if (levels[i] === 6) {
      const sc = satCentroids[l6Sat[i]];
      if (sc) {
        V[i * 3] += (sc.x - P[i * 3]) * CPULL * 2;
        V[i * 3 + 1] += (sc.y - P[i * 3 + 1]) * CPULL * 2;
        V[i * 3 + 2] += (sc.z - P[i * 3 + 2]) * CPULL * 2;
      }
      continue;
    }
    const c = centroids[levels[i]];
    if (!c) continue;
    V[i * 3] += (c.x - P[i * 3]) * CPULL;
    V[i * 3 + 1] += (c.y - P[i * 3 + 1]) * CPULL;
    V[i * 3 + 2] += (c.z - P[i * 3 + 2]) * CPULL;
  }

  // Apply velocity + damping
  for (let i = 0; i < nC * 3; i++) { P[i] += V[i]; V[i] *= DAMP; }
}
console.log('');
console.timeEnd('Force simulation');

// Round to 1 decimal place for file size
const positions = [];
for (let i = 0; i < nC; i++) {
  positions.push([
    Math.round(P[i * 3] * 10) / 10,
    Math.round(P[i * 3 + 1] * 10) / 10,
    Math.round(P[i * 3 + 2] * 10) / 10,
  ]);
}

// Append to brain-demo-data.ts
const positionsStr = `\n// Pre-computed force-directed layout positions [x, y, z] per node
// SPREAD=${SPREAD.toFixed(0)}, STEPS=${STEPS}
export const demoPositions: [number, number, number][] = ${JSON.stringify(positions)};\n`;

const updatedSrc = src + positionsStr;
writeFileSync(DATA_FILE, updatedSrc);

console.log(`Written ${positions.length} positions to brain-demo-data.ts`);
const size = Buffer.byteLength(updatedSrc) / 1024 / 1024;
console.log(`Total file size: ${size.toFixed(2)} MB`);
