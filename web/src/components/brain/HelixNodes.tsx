'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DemoNode } from './brain-demo-data';
import { HELIX_PARAMS, LEVEL_COLORS, TYPE_SECTORS } from '@/lib/constants';

interface HelixNodesProps {
  nodes: DemoNode[];
}

// Seeded random for deterministic positions
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export function computeNodePositions(nodes: DemoNode[]) {
  const typeInLevel: Record<string, number[]> = {};

  nodes.forEach((node, i) => {
    const key = `${node.level}-${node.type}`;
    if (!typeInLevel[key]) typeInLevel[key] = [];
    typeInLevel[key].push(i);
  });

  const positions: THREE.Vector3[] = [];

  nodes.forEach((node, i) => {
    const lvl = node.level;
    const params = HELIX_PARAMS[lvl as keyof typeof HELIX_PARAMS] || HELIX_PARAMS[3];
    const sector = TYPE_SECTORS[node.type as keyof typeof TYPE_SECTORS] || { xOff: 0, yOff: 0, zOff: 0 };

    const key = `${lvl}-${node.type}`;
    const sameTypeNodes = typeInLevel[key] || [];
    const indexInType = sameTypeNodes.indexOf(i);
    const countInType = sameTypeNodes.length || 1;

    const typeSpread = countInType > 1 ? indexInType / (countInType - 1) : 0.5;

    const xSpread = (typeSpread - 0.5) * params.spread;
    const ySpread = (seededRandom(i * 17) - 0.5) * params.height;
    const zSpread = (seededRandom(i * 23) - 0.5) * params.depth;

    const jitterX = (seededRandom(i * 3) - 0.5) * params.jitter;
    const jitterY = (seededRandom(i * 7) - 0.5) * params.jitter * 0.6;
    const jitterZ = (seededRandom(i * 11) - 0.5) * params.jitter * 0.4;

    positions.push(new THREE.Vector3(
      params.xCenter + xSpread + sector.xOff + jitterX,
      params.yBase + ySpread + sector.yOff + jitterY,
      params.zBase + zSpread + sector.zOff + jitterZ,
    ));
  });

  return positions;
}

export function HelixNodes({ nodes }: HelixNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const positions = useMemo(() => computeNodePositions(nodes), [nodes]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  // Track birth times for smooth fade-in
  const birthTimesRef = useRef<Float32Array>(new Float32Array(0));
  const knownIdsRef = useRef<Set<string>>(new Set());
  const clockRef = useRef(0);

  // Detect new nodes and assign birth times
  useEffect(() => {
    const prevIds = knownIdsRef.current;
    const newBirths = new Float32Array(nodes.length);
    const now = clockRef.current;

    nodes.forEach((node, i) => {
      if (prevIds.has(node.id)) {
        // Existing node — keep old birth time or 0 (fully visible)
        const oldIdx = Array.from(prevIds).indexOf(node.id);
        newBirths[i] = birthTimesRef.current[oldIdx] ?? 0;
      } else {
        // New node — set birth to current time for fade-in
        newBirths[i] = now > 0 ? now : -1; // -1 = initial load, show instantly
      }
    });

    birthTimesRef.current = newBirths;
    knownIdsRef.current = new Set(nodes.map((n) => n.id));
  }, [nodes]);

  // Set per-instance colors
  useEffect(() => {
    if (!meshRef.current) return;
    nodes.forEach((node, i) => {
      tempColor.set(LEVEL_COLORS[node.level as keyof typeof LEVEL_COLORS] || 0x00ffff);
      meshRef.current.setColorAt(i, tempColor);
    });
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [nodes, tempColor]);

  const frameRef = useRef(0);

  useFrame((state) => {
    if (!meshRef.current) return;
    frameRef.current++;
    clockRef.current = state.clock.elapsedTime;

    if (frameRef.current % 3 !== 0) return;

    const time = state.clock.elapsedTime;
    const n = nodes.length;
    const FADE_DURATION = 1.2; // seconds for smooth scale-in

    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      const pos = positions[i];
      const floatOffset = Math.sin(time * 0.5 + i * 0.3) * 2;
      dummy.position.set(pos.x, pos.y + floatOffset, pos.z);

      let baseScale: number;
      let pulse: number;
      if (node.level === 7) {
        baseScale = 5;
        pulse = 1 + Math.sin(time * 3.0 + i) * 0.3;
      } else if (node.level === 8) {
        baseScale = 4;
        pulse = 1 + Math.sin(time * 1.5 + i) * 0.15;
      } else if (node.level === 9) {
        baseScale = 3.5;
        pulse = 1 + Math.sin(time * 0.3 + i) * 0.05;
      } else {
        baseScale = node.level === 6 ? 5 : 6 - node.level * 0.6;
        pulse = 1 + Math.sin(time * (0.8 + node.level * 0.2) + i) * 0.1;
      }

      // Smooth fade-in: scale from 0 → target over FADE_DURATION
      let fadeScale = 1;
      const birth = birthTimesRef.current[i] ?? -1;
      if (birth > 0) {
        const age = time - birth;
        if (age < FADE_DURATION) {
          // Ease-out cubic for smooth appearance
          const t = age / FADE_DURATION;
          fadeScale = 1 - Math.pow(1 - t, 3);
        }
      }

      dummy.scale.setScalar(baseScale * pulse * fadeScale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, nodes.length]}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
