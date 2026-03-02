'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function srand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export function BackgroundStars() {
  const ref1 = useRef<THREE.Points>(null!);
  const ref2 = useRef<THREE.Points>(null!);

  // Layer 1: 1500 small stars
  const positions1 = useMemo(() => {
    const arr = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      arr[i * 3] = (srand(i * 31) - 0.5) * 5000;
      arr[i * 3 + 1] = (srand(i * 37) - 0.5) * 5000;
      arr[i * 3 + 2] = (srand(i * 41) - 0.5) * 5000;
    }
    return arr;
  }, []);

  // Layer 2: 200 larger dim stars for depth
  const positions2 = useMemo(() => {
    const arr = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) {
      arr[i * 3] = (srand(i * 71) - 0.5) * 8000;
      arr[i * 3 + 1] = (srand(i * 73) - 0.5) * 8000;
      arr[i * 3 + 2] = (srand(i * 79) - 0.5) * 8000;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (ref1.current) ref1.current.rotation.y = state.clock.elapsedTime * 0.005;
    if (ref2.current) ref2.current.rotation.y = state.clock.elapsedTime * 0.003;
  });

  return (
    <>
      <points ref={ref1}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions1, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={1.2}
          color="#223344"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <points ref={ref2}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions2, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={2.5}
          color="#1a2a3a"
          transparent
          opacity={0.25}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </>
  );
}
