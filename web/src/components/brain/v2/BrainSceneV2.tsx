'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { NebulaNodes } from './NebulaNodes';
import { NebulaEdges } from './NebulaEdges';
import { NebulaStars } from './NebulaStars';
import { GoldenCore } from './GoldenCore';
import { JarvisOrbits } from './JarvisOrbits';
import { JarvisNeurons } from './JarvisNeurons';
import { demoNodes, demoEdges } from '../brain-demo-data';

interface BrainSceneV2Props {
  /** Jarvis thinking phase for dynamic effects */
  thinkingPhase?: string;
  /** Increment to fire a neuron */
  neuronFireCount?: number;
  /** Color for fired neurons */
  neuronFireColor?: string;
}

export function BrainSceneV2({
  thinkingPhase = 'idle',
  neuronFireCount = 0,
  neuronFireColor = 'green',
}: BrainSceneV2Props) {
  return (
    <Canvas
      camera={{ position: [900, 500, 900], fov: 50, near: 1, far: 8000 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      dpr={1}
      style={{ background: 'transparent' }}
      frameloop="always"
    >
      <color attach="background" args={['#030308']} />
      <fog attach="fog" args={['#030308', 1200, 5000]} />

      <NebulaStars />
      <NebulaNodes nodes={demoNodes} edges={demoEdges} />
      <NebulaEdges nodes={demoNodes} edges={demoEdges} />

      {/* Jarvis AGI visualization */}
      <GoldenCore radius={25} thinkingPhase={thinkingPhase} />
      <JarvisOrbits radius={80} thinkingPhase={thinkingPhase} />
      <JarvisNeurons
        orbitRadius={80}
        fireCount={neuronFireCount}
        fireColor={neuronFireColor}
      />

      <OrbitControls
        target={[0, 0, 0]}
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.15}
      />
    </Canvas>
  );
}
