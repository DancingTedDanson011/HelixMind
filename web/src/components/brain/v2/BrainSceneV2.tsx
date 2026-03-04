'use client';

import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { NebulaNodes } from './NebulaNodes';
import { NebulaEdges } from './NebulaEdges';
import { NebulaStars } from './NebulaStars';
import { GoldenCore } from './GoldenCore';
import { JarvisOrbits, type OrbitNodeData } from './JarvisOrbits';
import { JarvisNeurons } from './JarvisNeurons';
import type { DemoNode, DemoEdge } from '../brain-types';

interface BrainSceneV2Props {
  /** Jarvis thinking phase for dynamic effects */
  thinkingPhase?: string;
  /** Increment to fire a neuron */
  neuronFireCount?: number;
  /** Color for fired neurons */
  neuronFireColor?: string;
  /** Active Jarvis tasks — shown as nodes on the green orbit */
  jarvisTasks?: OrbitNodeData[];
  /** Active Jarvis proposals — shown as nodes on the gold orbit */
  jarvisProposals?: OrbitNodeData[];
}

export function BrainSceneV2({
  thinkingPhase = 'idle',
  neuronFireCount = 0,
  neuronFireColor = 'green',
  jarvisTasks = [],
  jarvisProposals = [],
}: BrainSceneV2Props) {
  const [data, setData] = useState<{ demoNodes: DemoNode[]; demoEdges: DemoEdge[] } | null>(null);

  useEffect(() => {
    import('../brain-demo-data').then((m) => {
      setData({ demoNodes: m.demoNodes, demoEdges: m.demoEdges });
    });
  }, []);

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
      {data && (
        <>
          <NebulaNodes nodes={data.demoNodes} edges={data.demoEdges} />
          <NebulaEdges nodes={data.demoNodes} edges={data.demoEdges} />
        </>
      )}

      {/* Jarvis AGI visualization */}
      <GoldenCore radius={25} thinkingPhase={thinkingPhase} />
      <JarvisOrbits radius={80} thinkingPhase={thinkingPhase} tasks={jarvisTasks} proposals={jarvisProposals} />
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
