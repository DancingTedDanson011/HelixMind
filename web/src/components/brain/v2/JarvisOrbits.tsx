'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { JARVIS_ORBIT_GREEN, JARVIS_ORBIT_YELLOW } from '@/lib/constants';
import { orbitVertexShader, orbitFragmentShader } from './shaders';

interface JarvisOrbitsProps {
  /** Orbit radius */
  radius?: number;
  /** Particles per ring */
  count?: number;
  /** Current thinking phase for speed control */
  thinkingPhase?: string;
}

const PHASE_SPEED: Record<string, number> = {
  idle: 1.0,
  quick: 1.5,
  medium: 2.5,
  deep: 4.0,
};

const PARTICLES_PER_RING = 40;

/**
 * Two orbit rings around the golden core:
 * - Green ring (thoughts) — tilted on XZ plane
 * - Yellow ring (proposals) — tilted on YZ plane
 * Speed scales with thinking phase depth.
 */
export function JarvisOrbits({
  radius = 80,
  count = PARTICLES_PER_RING,
  thinkingPhase = 'idle',
}: JarvisOrbitsProps) {
  const greenGeoRef = useRef<THREE.BufferGeometry>(null!);
  const yellowGeoRef = useRef<THREE.BufferGeometry>(null!);
  const greenMatRef = useRef<THREE.ShaderMaterial>(null!);
  const yellowMatRef = useRef<THREE.ShaderMaterial>(null!);

  const total = count * 2; // two rings

  const greenColor = useMemo(() => new THREE.Color(JARVIS_ORBIT_GREEN), []);
  const yellowColor = useMemo(() => new THREE.Color(JARVIS_ORBIT_YELLOW), []);

  // Create static attributes for each ring
  const greenAttrs = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const pulses = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Positions will be updated in useFrame
      pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = 0;
      col[i * 3] = greenColor.r; col[i * 3 + 1] = greenColor.g; col[i * 3 + 2] = greenColor.b;
      sizes[i] = 4 + Math.random() * 3;
      pulses[i] = Math.random();
    }
    return { pos, col, sizes, pulses };
  }, [count, greenColor]);

  const yellowAttrs = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const pulses = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = 0;
      col[i * 3] = yellowColor.r; col[i * 3 + 1] = yellowColor.g; col[i * 3 + 2] = yellowColor.b;
      sizes[i] = 4 + Math.random() * 3;
      pulses[i] = Math.random();
    }
    return { pos, col, sizes, pulses };
  }, [count, yellowColor]);

  // Set initial attributes
  useEffect(() => {
    const gGeo = greenGeoRef.current;
    if (gGeo) {
      gGeo.setAttribute('position', new THREE.BufferAttribute(greenAttrs.pos, 3));
      gGeo.setAttribute('aColor', new THREE.BufferAttribute(greenAttrs.col, 3));
      gGeo.setAttribute('aSize', new THREE.BufferAttribute(greenAttrs.sizes, 1));
      gGeo.setAttribute('aPulse', new THREE.BufferAttribute(greenAttrs.pulses, 1));
    }
    const yGeo = yellowGeoRef.current;
    if (yGeo) {
      yGeo.setAttribute('position', new THREE.BufferAttribute(yellowAttrs.pos, 3));
      yGeo.setAttribute('aColor', new THREE.BufferAttribute(yellowAttrs.col, 3));
      yGeo.setAttribute('aSize', new THREE.BufferAttribute(yellowAttrs.sizes, 1));
      yGeo.setAttribute('aPulse', new THREE.BufferAttribute(yellowAttrs.pulses, 1));
    }
  }, [greenAttrs, yellowAttrs]);

  const greenUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const yellowUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speed = PHASE_SPEED[thinkingPhase] ?? 1.0;
    const angle = t * 0.3 * speed;

    if (greenMatRef.current) greenMatRef.current.uniforms.uTime.value = t;
    if (yellowMatRef.current) yellowMatRef.current.uniforms.uTime.value = t;

    // Update green orbit positions (XZ plane, tilted 15°)
    const gGeo = greenGeoRef.current;
    if (gGeo) {
      const posAttr = gGeo.getAttribute('position') as THREE.BufferAttribute;
      if (posAttr) {
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < count; i++) {
          const a = angle + (i / count) * Math.PI * 2;
          arr[i * 3] = Math.cos(a) * radius;
          arr[i * 3 + 1] = Math.sin(a * 0.5) * radius * 0.15; // slight Y wave
          arr[i * 3 + 2] = Math.sin(a) * radius;
        }
        posAttr.needsUpdate = true;
      }
    }

    // Update yellow orbit positions (YZ plane, tilted 75°)
    const yGeo = yellowGeoRef.current;
    if (yGeo) {
      const posAttr = yGeo.getAttribute('position') as THREE.BufferAttribute;
      if (posAttr) {
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < count; i++) {
          const a = -angle * 0.7 + (i / count) * Math.PI * 2;
          arr[i * 3] = Math.cos(a * 0.3) * radius * 0.2; // slight X wobble
          arr[i * 3 + 1] = Math.cos(a) * radius;
          arr[i * 3 + 2] = Math.sin(a) * radius;
        }
        posAttr.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {/* Green orbit — thoughts */}
      <points>
        <bufferGeometry ref={greenGeoRef} />
        <shaderMaterial
          ref={greenMatRef}
          vertexShader={orbitVertexShader}
          fragmentShader={orbitFragmentShader}
          uniforms={greenUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Yellow orbit — proposals */}
      <points>
        <bufferGeometry ref={yellowGeoRef} />
        <shaderMaterial
          ref={yellowMatRef}
          vertexShader={orbitVertexShader}
          fragmentShader={orbitFragmentShader}
          uniforms={yellowUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
