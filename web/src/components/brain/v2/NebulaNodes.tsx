'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DemoNode } from '../brain-demo-data';
import { LEVEL_COLORS, LEVEL_GLOW } from '@/lib/constants';
import { nodeVertexShader, nodeFragmentShader } from './shaders';

// ─── V2 Helix Layer Layout ──────────────────────────────────
// Vertical stacking with helix twist per level
export const LAYER_CONFIG: Record<number, { y: number; radius: number; twist: number }> = {
  1: { y: 300,  radius: 100, twist: 0 },                       // Focus — top
  2: { y: 160,  radius: 130, twist: Math.PI / 3 },              // Active
  3: { y: 20,   radius: 160, twist: (2 * Math.PI) / 3 },        // Reference — center
  4: { y: -120, radius: 180, twist: Math.PI },                   // Archive
  5: { y: -260, radius: 150, twist: (4 * Math.PI) / 3 },        // Deep Archive — bottom
  6: { y: -400, radius: 200, twist: (5 * Math.PI) / 3 },        // Web Knowledge
};

const NODE_SIZES: Record<number, number> = {
  1: 60, 2: 48, 3: 40, 4: 32, 5: 24, 6: 55,
  7: 50, 8: 40, 9: 35,
};

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export function computeNebulaPositions(nodes: DemoNode[]): THREE.Vector3[] {
  const byLevel: Record<number, number[]> = {};
  nodes.forEach((n, i) => {
    const lvl = Math.min(n.level, 6);
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(i);
  });

  const positions: THREE.Vector3[] = new Array(nodes.length);

  for (const [lvlStr, indices] of Object.entries(byLevel)) {
    const lvl = parseInt(lvlStr);
    const config = LAYER_CONFIG[lvl] || LAYER_CONFIG[3];
    const count = indices.length;

    indices.forEach((nodeIdx, j) => {
      const angle = (j / Math.max(count, 1)) * Math.PI * 2 + config.twist;
      const radiusVar = config.radius * (0.4 + seededRandom(nodeIdx * 7) * 0.6);
      const jitter = 18;

      positions[nodeIdx] = new THREE.Vector3(
        Math.cos(angle) * radiusVar + (seededRandom(nodeIdx * 3) - 0.5) * jitter,
        config.y + (seededRandom(nodeIdx * 11) - 0.5) * 30,
        Math.sin(angle) * radiusVar + (seededRandom(nodeIdx * 13) - 0.5) * jitter,
      );
    });
  }

  return positions;
}

// ─── Component ──────────────────────────────────────────────

interface NebulaNodesProps {
  nodes: DemoNode[];
}

export function NebulaNodes({ nodes }: NebulaNodesProps) {
  const geoRef = useRef<THREE.BufferGeometry>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  const positions = useMemo(() => computeNebulaPositions(nodes), [nodes]);

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
