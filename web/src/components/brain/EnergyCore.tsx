'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface EnergyCoreProps {
  spread: number;
  centroid: THREE.Vector3;
}

/**
 * Golden energy core — port of the CLI brain template's pulsing icosahedron core.
 * Outer wireframe + inner solid icosahedron with a matching point light.
 */
export function EnergyCore({ spread, centroid }: EnergyCoreProps) {
  const outerRef = useRef<THREE.Mesh>(null!);
  const innerRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  const outerRadius = spread * 0.06;
  const innerRadius = spread * 0.025;

  const outerGeo = useMemo(() => new THREE.IcosahedronGeometry(outerRadius, 3), [outerRadius]);
  const innerGeo = useMemo(() => new THREE.IcosahedronGeometry(innerRadius, 2), [innerRadius]);

  const outerMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xFFB800,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    wireframe: true,
    depthWrite: false,
  }), []);

  const innerMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xFFD080,
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  // Temp color object reused each frame
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 1000; // ms-like time for compat with CLI template
    const dt = state.clock.getDelta();

    // --- Outer wireframe ---
    if (outerRef.current) {
      outerRef.current.rotation.y += dt * 0.12;
      outerRef.current.rotation.x += dt * 0.06;

      const outerScale = 1 + Math.sin(t * 0.001) * 0.08;
      outerRef.current.scale.setScalar(outerScale);

      // Color cycle: gold-orange hue range
      const hue = 0.07 + Math.sin(t * 0.0003) * 0.04;
      tmpColor.setHSL(hue, 0.9, 0.55);
      outerMat.color.copy(tmpColor);
    }

    // --- Inner solid ---
    if (innerRef.current) {
      const innerScale = 1 + Math.sin(t * 0.0015) * 0.1;
      innerRef.current.scale.setScalar(innerScale);
    }

    // --- Point light matches core color ---
    if (lightRef.current) {
      lightRef.current.color.copy(tmpColor);
    }
  });

  return (
    <group position={[centroid.x, centroid.y, centroid.z]}>
      {/* Outer wireframe icosahedron */}
      <mesh ref={outerRef} geometry={outerGeo} material={outerMat} />

      {/* Inner solid icosahedron */}
      <mesh ref={innerRef} geometry={innerGeo} material={innerMat} />

      {/* Center point light */}
      <pointLight
        ref={lightRef}
        color={0xFFB800}
        intensity={0.15}
        distance={spread * 0.3}
      />
    </group>
  );
}
