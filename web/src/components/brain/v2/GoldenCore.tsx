'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { JARVIS_CORE_COLOR, JARVIS_CORE_LIGHT } from '@/lib/constants';
import { coreVertexShader, coreFragmentShader } from './shaders';

interface GoldenCoreProps {
  /** Radius of the core sphere */
  radius?: number;
  /** Thinking phase: 'idle' | 'quick' | 'medium' | 'deep' */
  thinkingPhase?: string;
}

const PHASE_PULSE: Record<string, number> = {
  idle: 0.5,
  quick: 1.0,
  medium: 1.8,
  deep: 3.0,
};

/**
 * Golden icosahedron core for Jarvis AGI — warm glow with breathing animation.
 * Pulse intensity scales with thinking phase depth.
 */
export function GoldenCore({ radius = 25, thinkingPhase = 'idle' }: GoldenCoreProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  const coreColor = useMemo(() => new THREE.Color(JARVIS_CORE_COLOR), []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: coreColor },
    uOpacity: { value: 0.22 },
    uPulse: { value: PHASE_PULSE[thinkingPhase] ?? 0.5 },
  }), [coreColor]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;
    uniforms.uPulse.value = PHASE_PULSE[thinkingPhase] ?? 0.5;

    // Light intensity breathing
    if (lightRef.current) {
      const pulse = PHASE_PULSE[thinkingPhase] ?? 0.5;
      lightRef.current.intensity = 0.3 + Math.sin(t * 0.8) * 0.1 * pulse;
    }
  });

  return (
    <group>
      {/* Core mesh */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[radius, 2]} />
        <shaderMaterial
          vertexShader={coreVertexShader}
          fragmentShader={coreFragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner bright core */}
      <mesh>
        <icosahedronGeometry args={[radius * 0.5, 1]} />
        <meshBasicMaterial
          color={0xffffff}
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Warm point light for bloom effect on nearby nodes */}
      <pointLight
        ref={lightRef}
        color={JARVIS_CORE_LIGHT}
        intensity={0.4}
        distance={400}
        decay={2}
      />
    </group>
  );
}
