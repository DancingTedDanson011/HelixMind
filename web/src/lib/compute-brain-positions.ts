/**
 * Helix layout algorithm for brain node positioning.
 * Ported from CLI template.ts — computes 3D [x,y,z] positions for each node
 * using a force-directed simulation with helix-path level centroids.
 */
import type { BrainNodeInfo, BrainEdgeInfo } from './cli-types';
import type { DemoNode, DemoEdge } from '@/components/brain/brain-types';
import { FORCE_LAYOUT } from './constants';

function srand(s: number): number {
  const x = Math.sin(s * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

const GA = 2.399963; // golden angle

/**
 * Convert BrainExport data to DemoNode/DemoEdge/positions for BrainInner.
 * Runs the helix force simulation synchronously.
 */
export function computeBrainLayout(
  nodes: BrainNodeInfo[],
  edges: BrainEdgeInfo[],
): { demoNodes: DemoNode[]; demoEdges: DemoEdge[]; demoPositions: [number, number, number][] } {
  const nC = nodes.length;

  // Convert to DemoNode/DemoEdge format
  const demoNodes: DemoNode[] = nodes.map(n => ({
    id: n.id,
    label: n.label,
    type: n.type,
    level: n.level,
    relevance: n.relevanceScore,
  }));

  // Build node index map for edge resolution
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < nC; i++) idToIndex.set(nodes[i].id, i);

  // Filter edges to only those referencing existing nodes, cap for performance
  const maxEdges = FORCE_LAYOUT.MAX_E;
  const validEdges: DemoEdge[] = [];
  const ePairs: [number, number][] = [];
  for (const e of edges) {
    const si = idToIndex.get(e.source);
    const ti = idToIndex.get(e.target);
    if (si !== undefined && ti !== undefined) {
      validEdges.push({ source: e.source, target: e.target, type: e.type, weight: e.weight });
      ePairs.push([si, ti]);
      if (validEdges.length >= maxEdges) break;
    }
  }

  // If no nodes, return empty
  if (nC === 0) {
    return { demoNodes: [], demoEdges: [], demoPositions: [] };
  }

  // Extract levels array
  const levels = demoNodes.map(n => n.level);
  const lvlCounts: Record<number, number> = {};
  for (const lv of levels) lvlCounts[lv] = (lvlCounts[lv] || 0) + 1;

  const SPREAD = FORCE_LAYOUT.BASE_SPREAD + Math.sqrt(nC) * 25;
  const { REP, ATT, ILEN, DAMP, GCELL, SAT_SIZE } = FORCE_LAYOUT;
  const CPULL = 0.005;

  // Fewer simulation steps for smaller brains (diminishing returns)
  const STEPS = nC < 50 ? 40 : nC < 200 ? 60 : 80;

  // Level centroids along a HELIX path
  const uLvl = [...new Set(levels)].sort().filter(l => l !== 6);
  const centroids: Record<number, { x: number; y: number; z: number }> = {};
  uLvl.forEach((lv, i) => {
    const t = (i + 0.5) / Math.max(uLvl.length, 1);
    const height = (t - 0.5) * SPREAD * 2.4;
    const radius = SPREAD * 0.7 + SPREAD * 0.15 * Math.sin(t * Math.PI * 2);
    const angle = GA * i * 2.5;
    centroids[lv] = { x: radius * Math.cos(angle), y: height, z: radius * Math.sin(angle) };
  });

  // L6 satellite clusters
  const l6Indices: number[] = [];
  for (let i = 0; i < nC; i++) if (levels[i] === 6) l6Indices.push(i);
  const numSats = Math.max(1, Math.ceil(l6Indices.length / SAT_SIZE));
  const satCentroids: { x: number; y: number; z: number }[] = [];
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
  const l6Sat: Record<number, number> = {};
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
  for (let step = 0; step < STEPS; step++) {
    const decay = 1 - step / STEPS * 0.3;

    // Grid-based repulsion
    const grid: Record<string, number[]> = {};
    for (let i = 0; i < nC; i++) {
      const k = `${Math.floor(P[i * 3] / GCELL)},${Math.floor(P[i * 3 + 1] / GCELL)},${Math.floor(P[i * 3 + 2] / GCELL)}`;
      if (!grid[k]) grid[k] = [];
      grid[k].push(i);
    }
    for (let i = 0; i < nC; i++) {
      const gx = Math.floor(P[i * 3] / GCELL);
      const gy = Math.floor(P[i * 3 + 1] / GCELL);
      const gz = Math.floor(P[i * 3 + 2] / GCELL);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const c = grid[`${gx + dx},${gy + dy},${gz + dz}`];
        if (!c) continue;
        for (const j of c) {
          if (j <= i) continue;
          const ddx = P[i * 3] - P[j * 3];
          const ddy = P[i * 3 + 1] - P[j * 3 + 1];
          const ddz = P[i * 3 + 2] - P[j * 3 + 2];
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
      const ddx = P[ti * 3] - P[si * 3];
      const ddy = P[ti * 3 + 1] - P[si * 3 + 1];
      const ddz = P[ti * 3 + 2] - P[si * 3 + 2];
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

  // Extract positions
  const demoPositions: [number, number, number][] = new Array(nC);
  for (let i = 0; i < nC; i++) {
    demoPositions[i] = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  }

  return { demoNodes, demoEdges: validEdges, demoPositions };
}
