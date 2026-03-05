'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useVoiceBrain } from './VoiceBrainContext';

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
  const { voiceState, audioLevel } = useVoiceBrain();

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

    // Voice-reactive parameters
    const isListening = voiceState === 'listening';
    const isSpeaking = voiceState === 'speaking';
    const isProcessing = voiceState === 'processing';
    const isVoiceActive = voiceState !== 'idle';

    // --- Outer wireframe ---
    if (outerRef.current) {
      // Faster rotation during voice activity
      const rotSpeed = isVoiceActive ? 0.35 : 0.12;
      outerRef.current.rotation.y += dt * rotSpeed;
      outerRef.current.rotation.x += dt * (rotSpeed * 0.5);

      // Listening: pulse scale with audio level; Speaking: steady expanded; else: normal
      let outerScale: number;
      if (isListening) {
        outerScale = 1.1 + audioLevel * 0.4 + Math.sin(t * 0.004) * 0.06;
      } else if (isSpeaking) {
        outerScale = 1.2 + Math.sin(t * 0.003) * 0.1;
      } else if (isProcessing) {
        outerScale = 1 + Math.sin(t * 0.006) * 0.15; // fast subtle throb
      } else {
        outerScale = 1 + Math.sin(t * 0.001) * 0.08;
      }
      outerRef.current.scale.setScalar(outerScale);

      // Color: listening=emerald, speaking=cyan, processing=amber, default=gold
      let hue: number, sat: number, lit: number;
      if (isListening) {
        hue = 0.42 + Math.sin(t * 0.002) * 0.03; // green
        sat = 0.85;
        lit = 0.5 + audioLevel * 0.15;
      } else if (isSpeaking) {
        hue = 0.52 + Math.sin(t * 0.001) * 0.04; // cyan
        sat = 0.8;
        lit = 0.55;
      } else if (isProcessing) {
        hue = 0.1 + Math.sin(t * 0.003) * 0.02; // amber
        sat = 0.9;
        lit = 0.5 + Math.sin(t * 0.008) * 0.1;
      } else {
        hue = 0.07 + Math.sin(t * 0.0003) * 0.04; // gold default
        sat = 0.9;
        lit = 0.55;
      }
      tmpColor.setHSL(hue, sat, lit);
      outerMat.color.copy(tmpColor);
      outerMat.opacity = isVoiceActive ? 0.15 + audioLevel * 0.1 : 0.08;
    }

    // --- Inner solid ---
    if (innerRef.current) {
      let innerScale: number;
      if (isListening) {
        innerScale = 1 + audioLevel * 0.3 + Math.sin(t * 0.005) * 0.05;
      } else if (isSpeaking) {
        innerScale = 1.15 + Math.sin(t * 0.004) * 0.08;
      } else {
        innerScale = 1 + Math.sin(t * 0.0015) * 0.1;
      }
      innerRef.current.scale.setScalar(innerScale);
      innerMat.opacity = isVoiceActive ? 0.12 + audioLevel * 0.08 : 0.06;
    }

    // --- Point light matches core color, brighter during voice ---
    if (lightRef.current) {
      lightRef.current.color.copy(tmpColor);
      lightRef.current.intensity = isVoiceActive ? 0.3 + audioLevel * 0.2 : 0.15;
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
