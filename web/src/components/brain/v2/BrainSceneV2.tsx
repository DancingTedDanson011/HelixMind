'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { NebulaNodes } from './NebulaNodes';
import { NebulaEdges } from './NebulaEdges';
import { NebulaStars } from './NebulaStars';
import { demoNodes, demoEdges } from '../brain-demo-data';

export function BrainSceneV2() {
  return (
    <Canvas
      camera={{ position: [350, 150, 450], fov: 50, near: 1, far: 5000 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      dpr={1}
      style={{ background: 'transparent' }}
      frameloop="always"
    >
      <color attach="background" args={['#030308']} />

      <NebulaStars />
      <NebulaNodes nodes={demoNodes} />
      <NebulaEdges nodes={demoNodes} edges={demoEdges} />

      <OrbitControls
        target={[0, -50, 0]}
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.12}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={(3 * Math.PI) / 4}
      />
    </Canvas>
  );
}
