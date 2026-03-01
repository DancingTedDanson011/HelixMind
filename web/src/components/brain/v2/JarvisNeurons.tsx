'use client';

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { JARVIS_ORBIT_GREEN, JARVIS_ORBIT_YELLOW } from '@/lib/constants';
import { neuronVertexShader, neuronFragmentShader } from './shaders';

const MAX_NEURONS = 30;
const TRAIL_LENGTH = 8;
const TOTAL_POINTS = MAX_NEURONS * (1 + TRAIL_LENGTH); // head + trail per neuron

interface Neuron {
  active: boolean;
  progress: number;     // 0 → 1 (orbit → core)
  speed: number;        // units per second
  startPos: THREE.Vector3;
  color: THREE.Color;
  trail: THREE.Vector3[]; // last TRAIL_LENGTH positions
}

interface JarvisNeuronsProps {
  /** Radius of the orbits where neurons spawn */
  orbitRadius?: number;
  /** Events that trigger neuron firing — increment to fire */
  fireCount?: number;
  /** Color for fired neurons: 'green' | 'yellow' | 'magenta' */
  fireColor?: string;
}

const COLOR_MAP: Record<string, number> = {
  green: JARVIS_ORBIT_GREEN,
  yellow: JARVIS_ORBIT_YELLOW,
  magenta: 0xff00ff,
};

/**
 * Neuron particles that shoot from orbit positions to core center (0,0,0).
 * Each neuron leaves an 8-frame trail with fading opacity.
 * Fire neurons by incrementing fireCount prop.
 */
export function JarvisNeurons({
  orbitRadius = 80,
  fireCount = 0,
  fireColor = 'green',
}: JarvisNeuronsProps) {
  const pointsRef = useRef<THREE.Points>(null!);
  const geoRef = useRef<THREE.BufferGeometry>(null!);
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const neuronsRef = useRef<Neuron[]>([]);
  const lastFireCountRef = useRef(0);

  // Initialize neuron pool
  useEffect(() => {
    neuronsRef.current = Array.from({ length: MAX_NEURONS }, () => ({
      active: false,
      progress: 0,
      speed: 0.5 + Math.random(),
      startPos: new THREE.Vector3(),
      color: new THREE.Color(JARVIS_ORBIT_GREEN),
      trail: Array.from({ length: TRAIL_LENGTH }, () => new THREE.Vector3()),
    }));
  }, []);

  // Buffer arrays
  const buffers = useMemo(() => ({
    positions: new Float32Array(TOTAL_POINTS * 3),
    colors: new Float32Array(TOTAL_POINTS * 3),
    sizes: new Float32Array(TOTAL_POINTS),
    alphas: new Float32Array(TOTAL_POINTS),
  }), []);

  // Set initial attributes
  useEffect(() => {
    const geo = geoRef.current;
    if (!geo) return;
    geo.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(buffers.colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(buffers.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(buffers.alphas, 1));
  }, [buffers]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  // Fire a neuron from a random orbit position
  const fireNeuron = useCallback((color: string) => {
    const neurons = neuronsRef.current;
    const inactive = neurons.find(n => !n.active);
    if (!inactive) return;

    // Random position on orbit sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    inactive.startPos.set(
      Math.sin(phi) * Math.cos(theta) * orbitRadius,
      Math.sin(phi) * Math.sin(theta) * orbitRadius * 0.5,
      Math.cos(phi) * orbitRadius,
    );
    inactive.color.set(COLOR_MAP[color] ?? JARVIS_ORBIT_GREEN);
    inactive.progress = 0;
    inactive.speed = 0.5 + Math.random();
    inactive.active = true;
    // Reset trail
    for (const t of inactive.trail) {
      t.copy(inactive.startPos);
    }
  }, [orbitRadius]);

  // React to fireCount changes
  useEffect(() => {
    if (fireCount > lastFireCountRef.current) {
      const fires = Math.min(fireCount - lastFireCountRef.current, 5);
      for (let i = 0; i < fires; i++) {
        fireNeuron(fireColor);
      }
    }
    lastFireCountRef.current = fireCount;
  }, [fireCount, fireColor, fireNeuron]);

  // Auto-fire periodically for ambient activity
  const autoFireRef = useRef(0);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (matRef.current) matRef.current.uniforms.uTime.value = t;

    const neurons = neuronsRef.current;
    const { positions, colors, sizes, alphas } = buffers;

    // Auto-fire every ~3 seconds
    autoFireRef.current += delta;
    if (autoFireRef.current > 3) {
      autoFireRef.current = 0;
      fireNeuron(Math.random() > 0.5 ? 'green' : 'yellow');
    }

    // Update each neuron
    for (let ni = 0; ni < MAX_NEURONS; ni++) {
      const n = neurons[ni];
      const baseIdx = ni * (1 + TRAIL_LENGTH);

      if (!n.active) {
        // Hide inactive neuron points
        for (let j = 0; j < 1 + TRAIL_LENGTH; j++) {
          const idx = (baseIdx + j) * 3;
          positions[idx] = 0; positions[idx + 1] = -9999; positions[idx + 2] = 0;
          alphas[baseIdx + j] = 0;
        }
        continue;
      }

      // Advance progress
      n.progress += delta * n.speed;

      if (n.progress >= 1) {
        // Arrived at core — deactivate
        n.active = false;
        for (let j = 0; j < 1 + TRAIL_LENGTH; j++) {
          alphas[baseIdx + j] = 0;
        }
        continue;
      }

      // Current position: lerp from start to origin (core)
      const ease = n.progress * n.progress; // ease-in for acceleration
      const cx = n.startPos.x * (1 - ease);
      const cy = n.startPos.y * (1 - ease);
      const cz = n.startPos.z * (1 - ease);

      // Shift trail history
      for (let ti = TRAIL_LENGTH - 1; ti > 0; ti--) {
        n.trail[ti].copy(n.trail[ti - 1]);
      }
      n.trail[0].set(cx, cy, cz);

      // Head particle
      const headIdx = baseIdx * 3;
      positions[headIdx] = cx;
      positions[headIdx + 1] = cy;
      positions[headIdx + 2] = cz;
      colors[headIdx] = n.color.r;
      colors[headIdx + 1] = n.color.g;
      colors[headIdx + 2] = n.color.b;
      sizes[baseIdx] = 6;
      alphas[baseIdx] = 0.9;

      // Trail particles
      for (let ti = 0; ti < TRAIL_LENGTH; ti++) {
        const pidx = baseIdx + 1 + ti;
        const p3 = pidx * 3;
        positions[p3] = n.trail[ti].x;
        positions[p3 + 1] = n.trail[ti].y;
        positions[p3 + 2] = n.trail[ti].z;
        colors[p3] = n.color.r;
        colors[p3 + 1] = n.color.g;
        colors[p3 + 2] = n.color.b;
        sizes[pidx] = 4 - ti * 0.4;
        alphas[pidx] = 0.4 * (1 - ti / TRAIL_LENGTH); // fade out
      }
    }

    // Flag updates
    const geo = geoRef.current;
    if (geo) {
      const pa = geo.getAttribute('position') as THREE.BufferAttribute;
      const ca = geo.getAttribute('aColor') as THREE.BufferAttribute;
      const sa = geo.getAttribute('aSize') as THREE.BufferAttribute;
      const aa = geo.getAttribute('aAlpha') as THREE.BufferAttribute;
      if (pa) pa.needsUpdate = true;
      if (ca) ca.needsUpdate = true;
      if (sa) sa.needsUpdate = true;
      if (aa) aa.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geoRef} />
      <shaderMaterial
        ref={matRef}
        vertexShader={neuronVertexShader}
        fragmentShader={neuronFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
