'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function BackgroundStars() {
  const ref = useRef<THREE.Points>(null!);
  const count = 600;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 4000;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 4000;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 4000;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.01;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={1.5}
        color="#334466"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}
