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
  // Group by level AND by type for clustered layout
  const levelBuckets: Record<number, number[]> = {};
  const typeInLevel: Record<string, number[]> = {};
  
  nodes.forEach((node, i) => {
    const lvl = node.level;
    const key = `${lvl}-${node.type}`;
    if (!levelBuckets[lvl]) levelBuckets[lvl] = [];
    levelBuckets[lvl].push(i);
    if (!typeInLevel[key]) typeInLevel[key] = [];
    typeInLevel[key].push(i);
  });

  const positions: THREE.Vector3[] = [];

  nodes.forEach((node, i) => {
    const lvl = node.level;
    const params = HELIX_PARAMS[lvl as keyof typeof HELIX_PARAMS] || HELIX_PARAMS[3];
    const sector = TYPE_SECTORS[node.type as keyof typeof TYPE_SECTORS] || { xOff: 0, yOff: 0, zOff: 0 };
    
    // Count nodes of same type within same level for distribution
    const key = `${lvl}-${node.type}`;
    const sameTypeNodes = typeInLevel[key] || [];
    const indexInType = sameTypeNodes.indexOf(i);
    const countInType = sameTypeNodes.length || 1;
    
    // Spread nodes within the level zone using 3D grid-like distribution
    const typeSpread = countInType > 1 ? indexInType / (countInType - 1) : 0.5;
    
    // Calculate position within elongated zone
    // X: spread along the main axis
    const xSpread = (typeSpread - 0.5) * params.spread;
    // Y: vertical distribution
    const ySpread = (seededRandom(i * 17) - 0.5) * params.height;
    // Z: depth distribution
    const zSpread = (seededRandom(i * 23) - 0.5) * params.depth;
    
    // Add jitter for organic feel
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

  // Set per-instance colors using setColorAt
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

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;

    nodes.forEach((node, i) => {
      const pos = positions[i];
      const floatOffset = Math.sin(time * 0.5 + i * 0.3) * 2;
      dummy.position.set(pos.x, pos.y + floatOffset, pos.z);

      const baseScale = node.level === 6 ? 5 : 6 - node.level * 0.6;
      const pulse = 1 + Math.sin(time * (0.8 + node.level * 0.2) + i) * 0.1;
      dummy.scale.setScalar(baseScale * pulse);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, nodes.length]}>
      <icosahedronGeometry args={[1, 3]} />
      <meshStandardMaterial
        toneMapped={false}
        emissive="#ffffff"
        emissiveIntensity={0.4}
        roughness={0.2}
        metalness={0.5}
      />
    </instancedMesh>
  );
}
