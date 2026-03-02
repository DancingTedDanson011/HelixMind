'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { HelixNodes } from './HelixNodes';
import { HelixEdges } from './HelixEdges';
import { BackgroundStars } from './BackgroundStars';
import { EnergyCore } from './EnergyCore';
import { OrbitStreams } from './OrbitStreams';
import { SignalParticles } from './SignalParticles';
import { demoNodes, demoEdges, demoPositions } from './brain-demo-data';
import { LEVEL_COLORS, FORCE_LAYOUT } from '@/lib/constants';
import { srand } from './brain-utils';

const nC = demoNodes.length;
const spread = FORCE_LAYOUT.BASE_SPREAD + Math.sqrt(nC) * 25;

/** Shared inner Three.js scene — used by BrainScene (demo) and InteractiveBrainCanvas (landing) */
export function BrainInner() {
  const positions = useMemo(() =>
    demoPositions.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  []);

  const centroid = useMemo(() => {
    let cx = 0, cy = 0, cz = 0;
    for (const p of positions) { cx += p.x; cy += p.y; cz += p.z; }
    return new THREE.Vector3(cx / nC, cy / nC, cz / nC);
  }, [positions]);

  const nodeColors = useMemo(() => {
    const colArr = new Float32Array(nC * 3);
    const tc = new THREE.Color();
    const coolColor = new THREE.Color();
    const maxD = spread * 1.2;

    for (let i = 0; i < nC; i++) {
      const node = demoNodes[i];
      const p = positions[i];
      const dx = p.x - centroid.x, dy = p.y - centroid.y, dz = p.z - centroid.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const distRatio = Math.min(dist / maxD, 1);

      if (node.level === 1) {
        tc.setHSL(0.78 + srand(i * 137 + 42) * 0.1, 0.7 + srand(i * 173) * 0.3, 0.45 + srand(i * 211) * 0.2);
      } else {
        tc.set(LEVEL_COLORS[node.level as keyof typeof LEVEL_COLORS] || 0x00FFFF);
      }

      if (distRatio > 0.55) {
        const fade = Math.min((distRatio - 0.55) / 0.45, 1);
        coolColor.setHSL(0.58, 0.15 + 0.1 * (1 - fade), 0.65 + fade * 0.15);
        tc.lerp(coolColor, fade * 0.85);
      }

      colArr[i * 3] = tc.r;
      colArr[i * 3 + 1] = tc.g;
      colArr[i * 3 + 2] = tc.b;
    }
    return colArr;
  }, [positions, centroid]);

  return (
    <>
      <BackgroundStars />

      {/* Energy core — golden pulsing icosahedron at centroid */}
      <EnergyCore spread={spread} centroid={centroid} />

      {/* 3 orbit particle streams with trails */}
      <OrbitStreams spread={spread} centroid={centroid} />

      {/* Neural signal impulses traveling along edges */}
      <SignalParticles
        positions={positions}
        nodes={demoNodes}
        edges={demoEdges}
        nodeColors={nodeColors}
      />

      <HelixNodes positions={positions} nodes={demoNodes} nodeColors={nodeColors} />
      <HelixEdges
        nodes={demoNodes}
        edges={demoEdges}
        positions={positions}
        nodeColors={nodeColors}
      />
    </>
  );
}
