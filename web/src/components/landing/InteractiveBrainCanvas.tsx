'use client';

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { HelixNodes } from '../brain/HelixNodes';
import { HelixEdges } from '../brain/HelixEdges';
import { BackgroundStars } from '../brain/BackgroundStars';
import { demoNodes, demoEdges, demoPositions } from '../brain/brain-demo-data';
import * as THREE from 'three';
import { LEVEL_COLORS, FORCE_LAYOUT } from '@/lib/constants';

function srand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function BrainInner() {
  const nC = demoNodes.length;
  const spread = FORCE_LAYOUT.BASE_SPREAD + Math.sqrt(nC) * 25;

  const positions = useMemo(() =>
    demoPositions.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  []);

  const centroid = useMemo(() => {
    let cx = 0, cy = 0, cz = 0;
    for (const p of positions) { cx += p.x; cy += p.y; cz += p.z; }
    return new THREE.Vector3(cx / nC, cy / nC, cz / nC);
  }, [positions, nC]);

  const nodeColors = useMemo(() => {
    const colArr = new Float32Array(nC * 3);
    const tc = new THREE.Color();
    for (let i = 0; i < nC; i++) {
      const node = demoNodes[i];
      const p = positions[i];
      const dx = p.x - centroid.x, dy = p.y - centroid.y, dz = p.z - centroid.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const maxD = spread * 1.2;
      const distRatio = Math.min(dist / maxD, 1);

      if (node.level === 1) {
        const h = 0.78 + srand(i * 137 + 42) * 0.1;
        const s = 0.7 + srand(i * 173) * 0.3;
        const l = 0.45 + srand(i * 211) * 0.2;
        tc.setHSL(h, s, l);
      } else {
        tc.set(LEVEL_COLORS[node.level as keyof typeof LEVEL_COLORS] || 0x00FFFF);
      }

      if (distRatio > 0.55) {
        const fade = Math.min((distRatio - 0.55) / 0.45, 1);
        const coolC = new THREE.Color().setHSL(0.58, 0.15 + 0.1 * (1 - fade), 0.65 + fade * 0.15);
        tc.lerp(coolC, fade * 0.85);
      }

      colArr[i * 3] = tc.r;
      colArr[i * 3 + 1] = tc.g;
      colArr[i * 3 + 2] = tc.b;
    }
    return colArr;
  }, [positions, centroid, spread, nC]);

  return (
    <>
      <BackgroundStars />
      <HelixNodes positions={positions} nodes={demoNodes} spread={spread} />
      <HelixEdges
        nodes={demoNodes}
        edges={demoEdges}
        positions={positions}
        nodeColors={nodeColors}
      />
    </>
  );
}

export function InteractiveBrainCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 500, 3000], fov: 55, near: 1, far: 30000 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
      style={{ background: 'transparent' }}
      frameloop="always"
    >
      <color attach="background" args={['#050510']} />
      <fog attach="fog" args={['#050510', 5000, 15000]} />

      <BrainInner />

      <OrbitControls
        enableZoom
        enablePan
        autoRotate
        autoRotateSpeed={0.08}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.85}
        minDistance={200}
        maxDistance={8000}
      />
    </Canvas>
  );
}
