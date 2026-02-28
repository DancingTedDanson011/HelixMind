'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { HelixNodes } from './HelixNodes';
import { HelixEdges } from './HelixEdges';
import { BackgroundStars } from './BackgroundStars';
import { demoNodes, demoEdges } from './brain-demo-data';

export function BrainScene() {
  return (
    <Canvas
      camera={{ position: [550, 200, 700], fov: 50, near: 1, far: 12000 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.5]}
      style={{ background: 'transparent' }}
    >
      <color attach="background" args={['#050510']} />
      <ambientLight intensity={0.5} />
      <pointLight position={[600, 300, 0]} intensity={0.7} color="#00d4ff" />
      <pointLight position={[0, -200, 400]} intensity={0.4} color="#8a2be2" />
      <pointLight position={[1100, 100, -300]} intensity={0.3} color="#00ff88" />

      <BackgroundStars />
      <HelixNodes nodes={demoNodes} />
      <HelixEdges nodes={demoNodes} edges={demoEdges} />

      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.5}
          mipmapBlur
        />
      </EffectComposer>

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
