'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { HelixNodes } from './HelixNodes';
import { HelixEdges } from './HelixEdges';
import { BackgroundStars } from './BackgroundStars';
import { demoNodes, demoEdges } from './brain-demo-data';

export function BrainScene() {
  return (
    <Canvas
      camera={{ position: [550, 200, 700], fov: 50, near: 1, far: 12000 }}
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
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.15}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={(2.5 * Math.PI) / 3.5}
      />
    </Canvas>
  );
}
