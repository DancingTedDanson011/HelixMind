'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DemoNode } from '../brain-demo-data';
import { LEVEL_COLORS, LEVEL_GLOW } from '@/lib/constants';
import { nodeVertexShader, nodeFragmentShader } from './shaders';

// ─── V6 Force-Directed Galaxy Layout ──────────────────────────────────
const NODE_SIZES: Record<number, number> = {
  1: 22, 2: 20, 3: 17, 4: 15, 5: 13, 6: 18,
  7: 15, 8: 13, 9: 11,
};

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export function computeNebulaPositions(nodes: DemoNode[], edges?: { source: string; target: string; weight: number }[]): THREE.Vector3[] {
  const N = nodes.length;
  if (N === 0) return [];

  const idxMap: Record<string, number> = {};
  nodes.forEach((n, i) => { idxMap[n.id] = i; });

  // Group nodes by level
  const lvG: Record<number, number[]> = {};
  for (let i = 0; i < N; i++) {
    const lv = Math.min(nodes[i].level, 6);
    if (!lvG[lv]) lvG[lv] = [];
    lvG[lv].push(i);
  }

  // Seed centroids per level (spread on sphere)
  const lvs = Object.keys(lvG).map(Number).sort();
  const seedC: Record<number, { x: number; y: number; z: number }> = {};
  const CS = 320;
  for (let li = 0; li < lvs.length; li++) {
    const lv = lvs[li];
    const golden = 2.399963;
    const theta = golden * li * 2.5;
    const phi = Math.acos(1 - 2 * (li + 0.5) / Math.max(lvs.length, 2));
    seedC[lv] = {
      x: CS * Math.sin(phi) * Math.cos(theta),
      y: CS * Math.cos(phi),
      z: CS * Math.sin(phi) * Math.sin(theta),
    };
  }

  // Initialize nodes near their level centroid
  const pos: { x: number; y: number; z: number }[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const lv = Math.min(nodes[i].level, 6);
    const c = seedC[lv] || { x: 0, y: 0, z: 0 };
    const SP = 100;
    pos[i] = {
      x: c.x + (seededRandom(i * 7) - 0.5) * SP,
      y: c.y + (seededRandom(i * 13) - 0.5) * SP,
      z: c.z + (seededRandom(i * 19) - 0.5) * SP,
    };
  }

  // Build adjacency
  const adjL: number[][] = new Array(N);
  for (let i = 0; i < N; i++) adjL[i] = [];
  if (edges) {
    for (const e of edges) {
      const si = idxMap[e.source], ti = idxMap[e.target];
      if (si !== undefined && ti !== undefined) { adjL[si].push(ti); adjL[ti].push(si); }
    }
  }

  // Force simulation with clustering
  const ITER = 60, REP = 5000, ATT = 0.012, CPULL = 0.02, IREP = 18000, CEN = 0.0005, DAMP = 0.82;
  const KS = Math.min(N, 25);
  const vel: { x: number; y: number; z: number }[] = new Array(N);
  for (let i = 0; i < N; i++) vel[i] = { x: 0, y: 0, z: 0 };

  for (let it = 0; it < ITER; it++) {
    const temp = 1.0 - it / ITER;
    const repS = REP * temp;

    // Dynamic centroids
    const dynC: Record<number, { x: number; y: number; z: number }> = {};
    const dynN: Record<number, number> = {};
    for (let i = 0; i < N; i++) {
      const lv = Math.min(nodes[i].level, 6);
      if (!dynC[lv]) { dynC[lv] = { x: 0, y: 0, z: 0 }; dynN[lv] = 0; }
      dynC[lv].x += pos[i].x; dynC[lv].y += pos[i].y; dynC[lv].z += pos[i].z;
      dynN[lv]++;
    }
    for (const lv in dynC) {
      dynC[Number(lv)].x /= dynN[Number(lv)];
      dynC[Number(lv)].y /= dynN[Number(lv)];
      dynC[Number(lv)].z /= dynN[Number(lv)];
    }

    for (let i = 0; i < N; i++) {
      let fx = 0, fy = 0, fz = 0;
      const myLv = Math.min(nodes[i].level, 6);

      // Node repulsion (sampled)
      for (let k = 0; k < KS; k++) {
        const j = Math.floor(seededRandom(it * 10007 + i * 997 + k * 31) * N);
        if (j === i) continue;
        const dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y, dz = pos[i].z - pos[j].z;
        const dSq = dx * dx + dy * dy + dz * dz + 1;
        const cm = Math.min(nodes[j].level, 6) !== myLv ? 2.5 : 1.0;
        const f = repS * cm / dSq;
        const d = Math.sqrt(dSq);
        fx += (dx / d) * f; fy += (dy / d) * f; fz += (dz / d) * f;
      }
      const rb = N / KS;
      fx *= rb; fy *= rb; fz *= rb;

      // Edge attraction (stronger same-level)
      for (const j of adjL[i]) {
        const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y, dz = pos[j].z - pos[i].z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz + 1);
        const sl = Math.min(nodes[j].level, 6) === myLv ? 2.5 : 0.3;
        const f = ATT * d * sl;
        fx += (dx / d) * f; fy += (dy / d) * f; fz += (dz / d) * f;
      }

      // Cluster pull toward own centroid
      const mc = dynC[myLv];
      if (mc) {
        fx += (mc.x - pos[i].x) * CPULL * temp;
        fy += (mc.y - pos[i].y) * CPULL * temp;
        fz += (mc.z - pos[i].z) * CPULL * temp;
      }

      // Inter-cluster repulsion
      for (const lv in dynC) {
        if (Number(lv) === myLv) continue;
        const oc = dynC[Number(lv)];
        const dx = pos[i].x - oc.x, dy = pos[i].y - oc.y, dz = pos[i].z - oc.z;
        const dSq = dx * dx + dy * dy + dz * dz + 1;
        const f = IREP * temp / dSq;
        const d = Math.sqrt(dSq);
        fx += (dx / d) * f; fy += (dy / d) * f; fz += (dz / d) * f;
      }

      fx -= pos[i].x * CEN; fy -= pos[i].y * CEN; fz -= pos[i].z * CEN;
      vel[i].x = (vel[i].x + fx) * DAMP; vel[i].y = (vel[i].y + fy) * DAMP; vel[i].z = (vel[i].z + fz) * DAMP;
      const maxV = 30 * temp + 2;
      const vL = Math.sqrt(vel[i].x * vel[i].x + vel[i].y * vel[i].y + vel[i].z * vel[i].z);
      if (vL > maxV) { vel[i].x = vel[i].x / vL * maxV; vel[i].y = vel[i].y / vL * maxV; vel[i].z = vel[i].z / vL * maxV; }
    }
    for (let i = 0; i < N; i++) { pos[i].x += vel[i].x; pos[i].y += vel[i].y; pos[i].z += vel[i].z; }
  }

  // Scale to fit (650 for spacious clusters)
  let maxD = 0;
  for (let i = 0; i < N; i++) {
    const d = Math.sqrt(pos[i].x * pos[i].x + pos[i].y * pos[i].y + pos[i].z * pos[i].z);
    if (d > maxD) maxD = d;
  }
  const sc = maxD > 0 ? 650 / maxD : 1;

  const positions: THREE.Vector3[] = new Array(N);
  for (let i = 0; i < N; i++) {
    positions[i] = new THREE.Vector3(pos[i].x * sc, pos[i].y * sc, pos[i].z * sc);
  }
  return positions;
}

// ─── Component ──────────────────────────────────────────────

interface NebulaNodesProps {
  nodes: DemoNode[];
  edges?: { source: string; target: string; weight: number }[];
}

export function NebulaNodes({ nodes, edges }: NebulaNodesProps) {
  const geoRef = useRef<THREE.BufferGeometry>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  const positions = useMemo(() => computeNebulaPositions(nodes, edges), [nodes, edges]);

  // Track births for smooth appearance of new nodes
  const birthTimesRef = useRef<Map<string, number>>(new Map());
  const clockRef = useRef(0);

  const attributes = useMemo(() => {
    const n = nodes.length;
    const posArr = new Float32Array(n * 3);
    const colArr = new Float32Array(n * 3);
    const sizeArr = new Float32Array(n);
    const birthArr = new Float32Array(n);
    const glowArr = new Float32Array(n);
    const tmpColor = new THREE.Color();
    const now = clockRef.current;
    const prevBirths = birthTimesRef.current;
    const newBirths = new Map<string, number>();

    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      const p = positions[i];

      posArr[i * 3] = p.x;
      posArr[i * 3 + 1] = p.y;
      posArr[i * 3 + 2] = p.z;

      tmpColor.set(LEVEL_COLORS[node.level as keyof typeof LEVEL_COLORS] || 0x00ffff);
      colArr[i * 3] = tmpColor.r;
      colArr[i * 3 + 1] = tmpColor.g;
      colArr[i * 3 + 2] = tmpColor.b;

      sizeArr[i] = NODE_SIZES[node.level] || 40;
      glowArr[i] = LEVEL_GLOW[node.level as keyof typeof LEVEL_GLOW] || 0.6;

      if (prevBirths.has(node.id)) {
        birthArr[i] = prevBirths.get(node.id)!;
      } else {
        birthArr[i] = now > 0.1 ? now : -1; // -1 = instant for initial load
      }
      newBirths.set(node.id, birthArr[i]);
    }

    birthTimesRef.current = newBirths;
    return { posArr, colArr, sizeArr, birthArr, glowArr };
  }, [nodes, positions]);

  // Set geometry attributes imperatively for correct updates
  useEffect(() => {
    const geo = geoRef.current;
    if (!geo) return;
    geo.setAttribute('position', new THREE.BufferAttribute(attributes.posArr, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(attributes.colArr, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(attributes.sizeArr, 1));
    geo.setAttribute('aBirth', new THREE.BufferAttribute(attributes.birthArr, 1));
    geo.setAttribute('aGlow', new THREE.BufferAttribute(attributes.glowArr, 1));
  }, [attributes]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame((state) => {
    clockRef.current = state.clock.elapsedTime;
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points>
      <bufferGeometry ref={geoRef} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={nodeVertexShader}
        fragmentShader={nodeFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
