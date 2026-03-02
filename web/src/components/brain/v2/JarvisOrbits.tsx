'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { JARVIS_ORBIT_GREEN, JARVIS_ORBIT_YELLOW } from '@/lib/constants';
import { orbitVertexShader, orbitFragmentShader } from './shaders';

export interface OrbitNodeData {
  id: string | number;
  label?: string;
  status?: string;
}

interface JarvisOrbitsProps {
  /** Orbit radius */
  radius?: number;
  /** Particles per ring */
  count?: number;
  /** Current thinking phase for speed control */
  thinkingPhase?: string;
  /** Active Jarvis tasks — displayed as nodes on the green orbit */
  tasks?: OrbitNodeData[];
  /** Active Jarvis proposals — displayed as nodes on the gold orbit */
  proposals?: OrbitNodeData[];
}

const PHASE_SPEED: Record<string, number> = {
  idle: 1.0,
  quick: 1.5,
  medium: 2.5,
  deep: 4.0,
};

const PARTICLES_PER_RING = 40;
const NODE_SPACING = 8; // every Nth particle becomes a task/proposal node

/**
 * Two orbit rings around the golden core:
 * - Green ring (thoughts) — tilted on XZ plane — shows active Jarvis tasks
 * - Yellow ring (proposals) — tilted on YZ plane — shows pending proposals
 * Speed scales with thinking phase depth.
 */
export function JarvisOrbits({
  radius = 80,
  count = PARTICLES_PER_RING,
  thinkingPhase = 'idle',
  tasks = [],
  proposals = [],
}: JarvisOrbitsProps) {
  const greenGeoRef = useRef<THREE.BufferGeometry>(null!);
  const yellowGeoRef = useRef<THREE.BufferGeometry>(null!);
  const greenMatRef = useRef<THREE.ShaderMaterial>(null!);
  const yellowMatRef = useRef<THREE.ShaderMaterial>(null!);

  const greenColor = useMemo(() => new THREE.Color(JARVIS_ORBIT_GREEN), []);
  const yellowColor = useMemo(() => new THREE.Color(JARVIS_ORBIT_YELLOW), []);

  // Backup base sizes for reset
  const greenBaseSizes = useRef<Float32Array | null>(null);
  const greenBaseColors = useRef<Float32Array | null>(null);
  const yellowBaseSizes = useRef<Float32Array | null>(null);
  const yellowBaseColors = useRef<Float32Array | null>(null);

  // Create static attributes for each ring
  const greenAttrs = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const pulses = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = 0;
      col[i * 3] = greenColor.r; col[i * 3 + 1] = greenColor.g; col[i * 3 + 2] = greenColor.b;
      sizes[i] = 4 + Math.random() * 3;
      pulses[i] = Math.random();
    }
    greenBaseSizes.current = new Float32Array(sizes);
    greenBaseColors.current = new Float32Array(col);
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
    yellowBaseSizes.current = new Float32Array(sizes);
    yellowBaseColors.current = new Float32Array(col);
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
      const sizeAttr = gGeo.getAttribute('aSize') as THREE.BufferAttribute;
      const colAttr = gGeo.getAttribute('aColor') as THREE.BufferAttribute;
      if (posAttr) {
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < count; i++) {
          const a = angle + (i / count) * Math.PI * 2;
          arr[i * 3] = Math.cos(a) * radius;
          arr[i * 3 + 1] = Math.sin(a * 0.5) * radius * 0.15;
          arr[i * 3 + 2] = Math.sin(a) * radius;
        }
        posAttr.needsUpdate = true;
      }
      // Apply task nodes — enlarge and brighten evenly-spaced particles
      if (sizeAttr && colAttr && greenBaseSizes.current && greenBaseColors.current) {
        const sArr = sizeAttr.array as Float32Array;
        const cArr = colAttr.array as Float32Array;
        // Reset to base
        sArr.set(greenBaseSizes.current);
        cArr.set(greenBaseColors.current);
        const taskCount = Math.min(tasks.length, Math.floor(count / NODE_SPACING));
        for (let ti = 0; ti < taskCount; ti++) {
          const pi = ti * NODE_SPACING;
          const task = tasks[ti];
          const isActive = task.status === 'in_progress';
          // Pulse size for active tasks
          const pulse = isActive ? 1 + Math.sin(t * 3 + ti) * 0.3 : 1;
          sArr[pi] = (isActive ? 14 : 10) * pulse;
          // Bright green for active, dimmer for pending
          cArr[pi * 3] = isActive ? 0.2 : 0.1;
          cArr[pi * 3 + 1] = isActive ? 1.0 : 0.6;
          cArr[pi * 3 + 2] = isActive ? 0.5 : 0.3;
        }
        sizeAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      }
    }

    // Update yellow orbit positions (YZ plane, tilted 75°)
    const yGeo = yellowGeoRef.current;
    if (yGeo) {
      const posAttr = yGeo.getAttribute('position') as THREE.BufferAttribute;
      const sizeAttr = yGeo.getAttribute('aSize') as THREE.BufferAttribute;
      const colAttr = yGeo.getAttribute('aColor') as THREE.BufferAttribute;
      if (posAttr) {
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < count; i++) {
          const a = -angle * 0.7 + (i / count) * Math.PI * 2;
          arr[i * 3] = Math.cos(a * 0.3) * radius * 0.2;
          arr[i * 3 + 1] = Math.cos(a) * radius;
          arr[i * 3 + 2] = Math.sin(a) * radius;
        }
        posAttr.needsUpdate = true;
      }
      // Apply proposal nodes — enlarge and brighten
      if (sizeAttr && colAttr && yellowBaseSizes.current && yellowBaseColors.current) {
        const sArr = sizeAttr.array as Float32Array;
        const cArr = colAttr.array as Float32Array;
        sArr.set(yellowBaseSizes.current);
        cArr.set(yellowBaseColors.current);
        const propCount = Math.min(proposals.length, Math.floor(count / NODE_SPACING));
        for (let pi = 0; pi < propCount; pi++) {
          const idx = pi * NODE_SPACING;
          // Slow pulse for pending proposals
          const pulse = 1 + Math.sin(t * 2 + pi * 1.5) * 0.2;
          sArr[idx] = 12 * pulse;
          // Bright gold
          cArr[idx * 3] = 1.0;
          cArr[idx * 3 + 1] = 0.85;
          cArr[idx * 3 + 2] = 0.2;
        }
        sizeAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {/* Green orbit — thoughts / active tasks */}
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
