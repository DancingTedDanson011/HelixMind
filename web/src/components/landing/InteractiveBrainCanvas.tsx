'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BrainInner } from '../brain/BrainInner';

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
