'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { HelixNodes } from '../brain/HelixNodes';
import { HelixEdges } from '../brain/HelixEdges';
import { BackgroundStars } from '../brain/BackgroundStars';
import { demoNodes, demoEdges } from '../brain/brain-demo-data';

export function InteractiveBrainCanvas() {
  return (
    <Canvas
      camera={{ position: [900, 300, 1200], fov: 50, near: 1, far: 15000 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      dpr={1}
      style={{ background: 'transparent' }}
      frameloop="always"
    >
      <color attach="background" args={['#050510']} />

      <BackgroundStars />
      <HelixNodes nodes={demoNodes} />
      <HelixEdges nodes={demoNodes} edges={demoEdges} />

      <OrbitControls
        enableZoom={true}
        enablePan={true}
        autoRotate
        autoRotateSpeed={0.2}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={(3 * Math.PI) / 4}
        minDistance={300}
        maxDistance={3000}
      />
    </Canvas>
  );
}
